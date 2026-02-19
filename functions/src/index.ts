import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";

import express, { type NextFunction, type Request, type Response } from "express";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import JSZip from "jszip";

import { AuthedRequest, requireAuth } from "./auth";
import { logEvent } from "./logging";
import { processQueuedJob } from "./pipeline";
import { bucket, db } from "./runtime";
import type { ArtifactDoc, JobDoc, SessionDoc } from "./types";
import { isoNow } from "./types";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const requestId =
    req.header("x-trace-id") ??
    req.header("x-request-id") ??
    `fn-${randomUUID()}`;
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "same-origin");
  res.setHeader("cache-control", "no-store");
  const started = Date.now();
  res.on("finish", () => {
    logEvent("functions_api", "request_complete", {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      latency_ms: Date.now() - started,
    });
  });
  next();
});

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const asyncRoute =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };

function jsonError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  retryable = false,
): void {
  const requestId = String(res.locals.requestId ?? `fn-${randomUUID()}`);
  res.status(status).json({
    code,
    message,
    details: details ?? null,
    retryable,
    request_id: requestId,
  });
}

function toSessionOut(id: string, data: SessionDoc) {
  return {
    id,
    title: data.title,
    status: data.status,
    created_at: data.createdAt,
  };
}

function toJobOut(id: string, data: JobDoc) {
  return {
    id,
    session_id: data.sessionId,
    prompt: data.prompt,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    style: data.style,
    status: data.status,
    stage: data.stage,
    error: data.error ?? null,
    failure_code: data.failureCode ?? null,
    retry_count: data.retryCount ?? 0,
    provider_meta: data.providerMeta ?? { calls: [] },
    stage_timestamps: data.stageTimestamps ?? {},
    warnings: data.warnings ?? [],
    created_at: data.createdAt,
    updated_at: data.updatedAt,
  };
}

async function assertSessionOwner(uid: string, sessionId: string): Promise<SessionDoc> {
  const snap = await db.collection("sessions").doc(sessionId).get();
  if (!snap.exists) throw new Error("not_found:session");
  const data = snap.data() as SessionDoc;
  if (data.uid !== uid) throw new Error("not_found:session");
  return data;
}

async function assertJobOwner(uid: string, jobId: string): Promise<JobDoc> {
  const snap = await db.collection("jobs").doc(jobId).get();
  if (!snap.exists) throw new Error("not_found:job");
  const data = snap.data() as JobDoc;
  if (data.uid !== uid) throw new Error("not_found:job");
  return data;
}

app.get(
  "/api/v1/system/health",
  asyncRoute(async (_req, res) => {
    const queued = await countByStatus("queued");
    const running = await countByStatus("running");
    const failed = await countByStatus("failed");
    const succeeded = await countByStatus("succeeded");
    const providerMode = process.env.GEMINI_API_KEY ? "gemini" : "mock";
    res.json({
      ok: true,
      provider_mode: providerMode,
      database: {
        status: "ok",
        backend: "firestore",
        migration_version: "firestore-native",
        error: null,
      },
      queue: {
        queued,
        running,
        failed_last_24h: failed,
        succeeded_last_24h: succeeded,
      },
      queue_backend: {
        kind: "firestore_trigger",
        status: "ok",
      },
      worker: {
        heartbeat: null,
        heartbeat_age_seconds: null,
        stale: false,
        heartbeat_ttl_seconds: 120,
      },
      redis: { status: "not_configured" },
      request_id: String(res.locals.requestId ?? ""),
    });
  }),
);

app.get(
  "/api/v1/auth/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.data() as Record<string, unknown> | undefined;
    res.json({
      id: uid,
      email: (req as AuthedRequest).user.email ?? null,
      plan_tier: (user?.planTier as string) ?? "free",
      credits: Number(user?.credits ?? 50),
    });
  }),
);

app.get(
  "/api/v1/me/limits",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.data() as Record<string, unknown> | undefined;
    res.json({
      credits: Number(user?.credits ?? 50),
      plan_tier: (user?.planTier as string) ?? "free",
    });
  }),
);

app.post(
  "/api/v1/sessions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const titleRaw = req.body?.title;
    const title =
      typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, 200) : "My Studio";
    const now = isoNow();
    const ref = db.collection("sessions").doc();
    const payload: SessionDoc = {
      uid,
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(payload);
    res.json(toSessionOut(ref.id, payload));
  }),
);

app.get(
  "/api/v1/sessions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const snap = await db.collection("sessions").where("uid", "==", uid).get();
    const sessions = snap.docs
      .map((d) => toSessionOut(d.id, d.data() as SessionDoc))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(sessions);
  }),
);

app.get(
  "/api/v1/jobs",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const snap = await db.collection("jobs").where("uid", "==", uid).limit(100).get();
    const jobs = snap.docs
      .map((d) => toJobOut(d.id, d.data() as JobDoc))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(jobs);
  }),
);

app.get(
  "/api/v1/jobs/sessions/:sessionId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const sessionId = req.params.sessionId;
    await assertSessionOwner(uid, sessionId);
    const snap = await db.collection("jobs").where("uid", "==", uid).where("sessionId", "==", sessionId).get();
    const jobs = snap.docs
      .map((d) => toJobOut(d.id, d.data() as JobDoc))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(jobs);
  }),
);

app.post(
  "/api/v1/jobs/sessions/:sessionId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const sessionId = req.params.sessionId;
    await assertSessionOwner(uid, sessionId);

    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
      jsonError(res, 422, "validation_error", "Prompt is required", undefined, false);
      return;
    }

    const bedrooms = clampInt(Number(req.body?.bedrooms ?? 3), 1, 10);
    const bathrooms = clampInt(Number(req.body?.bathrooms ?? 2), 1, 10);
    const style =
      typeof req.body?.style === "string" && req.body.style.trim()
        ? req.body.style.trim().slice(0, 64)
        : "contemporary";
    const idempotencyKey =
      typeof req.body?.idempotency_key === "string" && req.body.idempotency_key.trim()
        ? req.body.idempotency_key.trim().slice(0, 80)
        : null;
    const priority = req.body?.priority === "high" ? "high" : "normal";
    const wantExteriorImage = req.body?.want_exterior_image !== false;

    let ref = db.collection("jobs").doc();
    if (idempotencyKey) {
      const deterministicId = `idemp_${createHash("sha1")
        .update(`${uid}:${sessionId}:${idempotencyKey}`)
        .digest("hex")
        .slice(0, 32)}`;
      ref = db.collection("jobs").doc(deterministicId);
      const existing = await ref.get();
      if (existing.exists) {
        res.json(toJobOut(existing.id, existing.data() as JobDoc));
        return;
      }
    }

    const now = isoNow();
    const payload: JobDoc = {
      uid,
      sessionId,
      prompt,
      bedrooms,
      bathrooms,
      style,
      wantExteriorImage,
      idempotencyKey,
      requestHash: createHash("sha256")
        .update(JSON.stringify({ prompt, bedrooms, bathrooms, style, wantExteriorImage }))
        .digest("hex"),
      priority,
      status: "queued",
      stage: "init",
      error: null,
      failureCode: null,
      retryCount: 0,
      providerMeta: { calls: [] },
      stageTimestamps: { queued: now },
      warnings: [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(payload);
    res.json(toJobOut(ref.id, payload));
  }),
);

app.get(
  "/api/v1/jobs/:jobId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const job = await assertJobOwner(uid, req.params.jobId);
    res.json(toJobOut(req.params.jobId, job));
  }),
);

app.post(
  "/api/v1/jobs/:jobId/regenerate",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const parentId = req.params.jobId;
    const parent = await assertJobOwner(uid, parentId);

    const now = isoNow();
    const ref = db.collection("jobs").doc(randomUUID());
    const payload: JobDoc = {
      uid,
      sessionId: parent.sessionId,
      parentJobId: parentId,
      prompt:
        typeof req.body?.prompt === "string" && req.body.prompt.trim()
          ? req.body.prompt.trim()
          : parent.prompt,
      bedrooms: clampInt(Number(req.body?.bedrooms ?? parent.bedrooms), 1, 10),
      bathrooms: clampInt(Number(req.body?.bathrooms ?? parent.bathrooms), 1, 10),
      style:
        typeof req.body?.style === "string" && req.body.style.trim()
          ? req.body.style.trim().slice(0, 64)
          : parent.style,
      wantExteriorImage:
        typeof req.body?.want_exterior_image === "boolean"
          ? req.body.want_exterior_image
          : parent.wantExteriorImage,
      idempotencyKey: null,
      requestHash: null,
      priority: parent.priority ?? "normal",
      status: "queued",
      stage: "init",
      error: null,
      failureCode: null,
      retryCount: 0,
      providerMeta: {
        calls: [],
        reuseSpec: Boolean(req.body?.reuse_spec),
        regeneratedFromJobId: parentId,
      },
      stageTimestamps: { queued: now },
      warnings: [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(payload);
    res.json(toJobOut(ref.id, payload));
  }),
);

app.get(
  "/api/v1/jobs/:jobId/artifacts",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const jobId = req.params.jobId;
    await assertJobOwner(uid, jobId);
    const snap = await db.collection("jobs").doc(jobId).collection("artifacts").get();
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const artifact = d.data() as ArtifactDoc;
        const [signedUrl] = await bucket().file(artifact.storagePath).getSignedUrl({
          action: "read",
          expires: Date.now() + 15 * 60 * 1000,
          version: "v4",
        });
        return {
          id: artifact.id,
          type: artifact.type,
          mime_type: artifact.mimeType,
          checksum_sha256: artifact.checksumSha256,
          size_bytes: artifact.sizeBytes,
          url: signedUrl,
          created_at: artifact.createdAt,
        };
      }),
    );
    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    logEvent("functions_api", "artifacts_listed", {
      request_id: String(res.locals.requestId ?? ""),
      uid,
      job_id: jobId,
      count: items.length,
    });
    res.json({ job_id: jobId, items });
  }),
);

app.get(
  "/api/v1/jobs/:jobId/artifacts/:artifactId/download",
  requireAuth,
  asyncRoute(async (req, res) => {
    const uid = (req as AuthedRequest).user.uid;
    const jobId = req.params.jobId;
    const artifactId = req.params.artifactId;
    await assertJobOwner(uid, jobId);
    const artifactSnap = await db.collection("jobs").doc(jobId).collection("artifacts").doc(artifactId).get();
    if (!artifactSnap.exists) {
      jsonError(res, 404, "artifact_missing", "Artifact missing on disk", undefined, false);
      return;
    }
    const artifact = artifactSnap.data() as ArtifactDoc;
    const [signedUrl] = await bucket().file(artifact.storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
      version: "v4",
    });
    logEvent("functions_api", "artifact_download_issued", {
      request_id: String(res.locals.requestId ?? ""),
      uid,
      job_id: jobId,
      artifact_id: artifactId,
      ttl_seconds: 900,
    });
    res.redirect(302, signedUrl);
  }),
);

async function handleExport(req: Request, res: Response): Promise<void> {
  const uid = (req as AuthedRequest).user.uid;
  const jobId = req.params.jobId;
  await assertJobOwner(uid, jobId);

  const artifactSnap = await db.collection("jobs").doc(jobId).collection("artifacts").get();
  const artifacts = artifactSnap.docs.map((d) => d.data() as ArtifactDoc);
  if (artifacts.length === 0) {
    jsonError(res, 409, "no_artifacts", "No artifacts to export yet", undefined, false);
    return;
  }

  const zip = new JSZip();
  for (const artifact of artifacts) {
    const file = bucket().file(artifact.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      jsonError(res, 404, "artifact_missing", "Artifact missing on disk", undefined, false);
      return;
    }
    const [bytes] = await file.download();
    const filename = basename(artifact.storagePath);
    zip.file(filename, bytes);
  }

  const manifest = {
    job_id: jobId,
    generated_at: isoNow(),
    artifact_count: artifacts.length,
    artifacts: artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      filename: basename(a.storagePath),
      mime: a.mimeType,
      checksum_sha256: a.checksumSha256,
      size_bytes: a.sizeBytes,
    })),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const exportPath = `exports/${jobId}/drafted_export_${jobId}.zip`;
  await bucket().file(exportPath).save(zipBytes, {
    resumable: false,
    contentType: "application/zip",
    metadata: { cacheControl: "private,max-age=0" },
  });

  const [signedUrl] = await bucket().file(exportPath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
    version: "v4",
  });
  logEvent("functions_api", "export_signed_url_issued", {
    request_id: String(res.locals.requestId ?? ""),
    uid,
    job_id: jobId,
    ttl_seconds: 900,
    artifact_count: artifacts.length,
  });
  res.json({
    url: signedUrl,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    request_id: String(res.locals.requestId ?? ""),
  });
}

app.post("/api/v1/jobs/:jobId/export", requireAuth, asyncRoute(handleExport));
app.get("/api/v1/jobs/:jobId/export", requireAuth, asyncRoute(handleExport));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logEvent("functions_api", "request_error", {
    request_id: String(res.locals.requestId ?? ""),
    error_type: err instanceof Error ? err.name : "Unknown",
    message: err instanceof Error ? err.message : String(err),
  });
  if (err instanceof Error && err.message === "not_found:session") {
    jsonError(res, 404, "http_404", "Session not found", undefined, false);
    return;
  }
  if (err instanceof Error && err.message === "not_found:job") {
    jsonError(res, 404, "http_404", "Job not found", undefined, false);
    return;
  }
  jsonError(
    res,
    500,
    "internal_error",
    err instanceof Error ? err.message : "Unexpected server error",
    undefined,
    false,
  );
});

export const api = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    cors: true,
  },
  app,
);

export const onJobCreated = onDocumentCreated(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
    document: "jobs/{jobId}",
  },
  async (event) => {
    const jobId = String(event.params.jobId);
    logEvent("functions_worker", "job_created_trigger", { job_id: jobId });
    await processQueuedJob(jobId);
  },
);

async function countByStatus(status: string): Promise<number> {
  const snap = await db.collection("jobs").where("status", "==", status).count().get();
  return snap.data().count;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
