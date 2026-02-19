"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onJobCreated = exports.api = void 0;
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const express_1 = __importDefault(require("express"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const jszip_1 = __importDefault(require("jszip"));
const auth_1 = require("./auth");
const logging_1 = require("./logging");
const pipeline_1 = require("./pipeline");
const runtime_1 = require("./runtime");
const types_1 = require("./types");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: "2mb" }));
app.use((req, res, next) => {
    const requestId = req.header("x-trace-id") ??
        req.header("x-request-id") ??
        `fn-${(0, node_crypto_1.randomUUID)()}`;
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "same-origin");
    res.setHeader("cache-control", "no-store");
    const started = Date.now();
    res.on("finish", () => {
        (0, logging_1.logEvent)("functions_api", "request_complete", {
            request_id: requestId,
            method: req.method,
            path: req.path,
            status_code: res.statusCode,
            latency_ms: Date.now() - started,
        });
    });
    next();
});
const asyncRoute = (fn) => (req, res, next) => {
    void fn(req, res, next).catch(next);
};
function jsonError(res, status, code, message, details, retryable = false) {
    const requestId = String(res.locals.requestId ?? `fn-${(0, node_crypto_1.randomUUID)()}`);
    res.status(status).json({
        code,
        message,
        details: details ?? null,
        retryable,
        request_id: requestId,
    });
}
function toSessionOut(id, data) {
    return {
        id,
        title: data.title,
        status: data.status,
        created_at: data.createdAt,
    };
}
function toJobOut(id, data) {
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
async function assertSessionOwner(uid, sessionId) {
    const snap = await runtime_1.db.collection("sessions").doc(sessionId).get();
    if (!snap.exists)
        throw new Error("not_found:session");
    const data = snap.data();
    if (data.uid !== uid)
        throw new Error("not_found:session");
    return data;
}
async function assertJobOwner(uid, jobId) {
    const snap = await runtime_1.db.collection("jobs").doc(jobId).get();
    if (!snap.exists)
        throw new Error("not_found:job");
    const data = snap.data();
    if (data.uid !== uid)
        throw new Error("not_found:job");
    return data;
}
app.get("/api/v1/system/health", asyncRoute(async (_req, res) => {
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
}));
app.get("/api/v1/auth/me", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const userSnap = await runtime_1.db.collection("users").doc(uid).get();
    const user = userSnap.data();
    res.json({
        id: uid,
        email: req.user.email ?? null,
        plan_tier: user?.planTier ?? "free",
        credits: Number(user?.credits ?? 50),
    });
}));
app.get("/api/v1/me/limits", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const userSnap = await runtime_1.db.collection("users").doc(uid).get();
    const user = userSnap.data();
    res.json({
        credits: Number(user?.credits ?? 50),
        plan_tier: user?.planTier ?? "free",
    });
}));
app.post("/api/v1/sessions", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const titleRaw = req.body?.title;
    const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, 200) : "My Studio";
    const now = (0, types_1.isoNow)();
    const ref = runtime_1.db.collection("sessions").doc();
    const payload = {
        uid,
        title,
        status: "active",
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(payload);
    res.json(toSessionOut(ref.id, payload));
}));
app.get("/api/v1/sessions", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const snap = await runtime_1.db.collection("sessions").where("uid", "==", uid).get();
    const sessions = snap.docs
        .map((d) => toSessionOut(d.id, d.data()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(sessions);
}));
app.get("/api/v1/jobs", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const snap = await runtime_1.db.collection("jobs").where("uid", "==", uid).limit(100).get();
    const jobs = snap.docs
        .map((d) => toJobOut(d.id, d.data()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(jobs);
}));
app.get("/api/v1/jobs/sessions/:sessionId", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const sessionId = req.params.sessionId;
    await assertSessionOwner(uid, sessionId);
    const snap = await runtime_1.db.collection("jobs").where("uid", "==", uid).where("sessionId", "==", sessionId).get();
    const jobs = snap.docs
        .map((d) => toJobOut(d.id, d.data()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(jobs);
}));
app.post("/api/v1/jobs/sessions/:sessionId", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const sessionId = req.params.sessionId;
    await assertSessionOwner(uid, sessionId);
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
        jsonError(res, 422, "validation_error", "Prompt is required", undefined, false);
        return;
    }
    const bedrooms = clampInt(Number(req.body?.bedrooms ?? 3), 1, 10);
    const bathrooms = clampInt(Number(req.body?.bathrooms ?? 2), 1, 10);
    const style = typeof req.body?.style === "string" && req.body.style.trim()
        ? req.body.style.trim().slice(0, 64)
        : "contemporary";
    const idempotencyKey = typeof req.body?.idempotency_key === "string" && req.body.idempotency_key.trim()
        ? req.body.idempotency_key.trim().slice(0, 80)
        : null;
    const priority = req.body?.priority === "high" ? "high" : "normal";
    const wantExteriorImage = req.body?.want_exterior_image !== false;
    let ref = runtime_1.db.collection("jobs").doc();
    if (idempotencyKey) {
        const deterministicId = `idemp_${(0, node_crypto_1.createHash)("sha1")
            .update(`${uid}:${sessionId}:${idempotencyKey}`)
            .digest("hex")
            .slice(0, 32)}`;
        ref = runtime_1.db.collection("jobs").doc(deterministicId);
        const existing = await ref.get();
        if (existing.exists) {
            res.json(toJobOut(existing.id, existing.data()));
            return;
        }
    }
    const now = (0, types_1.isoNow)();
    const payload = {
        uid,
        sessionId,
        prompt,
        bedrooms,
        bathrooms,
        style,
        wantExteriorImage,
        idempotencyKey,
        requestHash: (0, node_crypto_1.createHash)("sha256")
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
}));
app.get("/api/v1/jobs/:jobId", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const job = await assertJobOwner(uid, req.params.jobId);
    res.json(toJobOut(req.params.jobId, job));
}));
app.post("/api/v1/jobs/:jobId/regenerate", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const parentId = req.params.jobId;
    const parent = await assertJobOwner(uid, parentId);
    const now = (0, types_1.isoNow)();
    const ref = runtime_1.db.collection("jobs").doc((0, node_crypto_1.randomUUID)());
    const payload = {
        uid,
        sessionId: parent.sessionId,
        parentJobId: parentId,
        prompt: typeof req.body?.prompt === "string" && req.body.prompt.trim()
            ? req.body.prompt.trim()
            : parent.prompt,
        bedrooms: clampInt(Number(req.body?.bedrooms ?? parent.bedrooms), 1, 10),
        bathrooms: clampInt(Number(req.body?.bathrooms ?? parent.bathrooms), 1, 10),
        style: typeof req.body?.style === "string" && req.body.style.trim()
            ? req.body.style.trim().slice(0, 64)
            : parent.style,
        wantExteriorImage: typeof req.body?.want_exterior_image === "boolean"
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
}));
app.get("/api/v1/jobs/:jobId/artifacts", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const jobId = req.params.jobId;
    await assertJobOwner(uid, jobId);
    const snap = await runtime_1.db.collection("jobs").doc(jobId).collection("artifacts").get();
    const items = await Promise.all(snap.docs.map(async (d) => {
        const artifact = d.data();
        const [signedUrl] = await (0, runtime_1.bucket)().file(artifact.storagePath).getSignedUrl({
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
    }));
    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    (0, logging_1.logEvent)("functions_api", "artifacts_listed", {
        request_id: String(res.locals.requestId ?? ""),
        uid,
        job_id: jobId,
        count: items.length,
    });
    res.json({ job_id: jobId, items });
}));
app.get("/api/v1/jobs/:jobId/artifacts/:artifactId/download", auth_1.requireAuth, asyncRoute(async (req, res) => {
    const uid = req.user.uid;
    const jobId = req.params.jobId;
    const artifactId = req.params.artifactId;
    await assertJobOwner(uid, jobId);
    const artifactSnap = await runtime_1.db.collection("jobs").doc(jobId).collection("artifacts").doc(artifactId).get();
    if (!artifactSnap.exists) {
        jsonError(res, 404, "artifact_missing", "Artifact missing on disk", undefined, false);
        return;
    }
    const artifact = artifactSnap.data();
    const [signedUrl] = await (0, runtime_1.bucket)().file(artifact.storagePath).getSignedUrl({
        action: "read",
        expires: Date.now() + 15 * 60 * 1000,
        version: "v4",
    });
    (0, logging_1.logEvent)("functions_api", "artifact_download_issued", {
        request_id: String(res.locals.requestId ?? ""),
        uid,
        job_id: jobId,
        artifact_id: artifactId,
        ttl_seconds: 900,
    });
    res.redirect(302, signedUrl);
}));
async function handleExport(req, res) {
    const uid = req.user.uid;
    const jobId = req.params.jobId;
    await assertJobOwner(uid, jobId);
    const artifactSnap = await runtime_1.db.collection("jobs").doc(jobId).collection("artifacts").get();
    const artifacts = artifactSnap.docs.map((d) => d.data());
    if (artifacts.length === 0) {
        jsonError(res, 409, "no_artifacts", "No artifacts to export yet", undefined, false);
        return;
    }
    const zip = new jszip_1.default();
    for (const artifact of artifacts) {
        const file = (0, runtime_1.bucket)().file(artifact.storagePath);
        const [exists] = await file.exists();
        if (!exists) {
            jsonError(res, 404, "artifact_missing", "Artifact missing on disk", undefined, false);
            return;
        }
        const [bytes] = await file.download();
        const filename = (0, node_path_1.basename)(artifact.storagePath);
        zip.file(filename, bytes);
    }
    const manifest = {
        job_id: jobId,
        generated_at: (0, types_1.isoNow)(),
        artifact_count: artifacts.length,
        artifacts: artifacts.map((a) => ({
            id: a.id,
            type: a.type,
            filename: (0, node_path_1.basename)(a.storagePath),
            mime: a.mimeType,
            checksum_sha256: a.checksumSha256,
            size_bytes: a.sizeBytes,
        })),
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const exportPath = `exports/${jobId}/drafted_export_${jobId}.zip`;
    await (0, runtime_1.bucket)().file(exportPath).save(zipBytes, {
        resumable: false,
        contentType: "application/zip",
        metadata: { cacheControl: "private,max-age=0" },
    });
    const [signedUrl] = await (0, runtime_1.bucket)().file(exportPath).getSignedUrl({
        action: "read",
        expires: Date.now() + 15 * 60 * 1000,
        version: "v4",
    });
    (0, logging_1.logEvent)("functions_api", "export_signed_url_issued", {
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
app.post("/api/v1/jobs/:jobId/export", auth_1.requireAuth, asyncRoute(handleExport));
app.get("/api/v1/jobs/:jobId/export", auth_1.requireAuth, asyncRoute(handleExport));
app.use((err, _req, res, _next) => {
    (0, logging_1.logEvent)("functions_api", "request_error", {
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
    jsonError(res, 500, "internal_error", err instanceof Error ? err.message : "Unexpected server error", undefined, false);
});
exports.api = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "1GiB",
    cors: true,
}, app);
exports.onJobCreated = (0, firestore_1.onDocumentCreated)({
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
    document: "jobs/{jobId}",
}, async (event) => {
    const jobId = String(event.params.jobId);
    (0, logging_1.logEvent)("functions_worker", "job_created_trigger", { job_id: jobId });
    await (0, pipeline_1.processQueuedJob)(jobId);
});
async function countByStatus(status) {
    const snap = await runtime_1.db.collection("jobs").where("status", "==", status).count().get();
    return snap.data().count;
}
function clampInt(n, min, max) {
    if (!Number.isFinite(n))
        return min;
    return Math.max(min, Math.min(max, Math.round(n)));
}
//# sourceMappingURL=index.js.map