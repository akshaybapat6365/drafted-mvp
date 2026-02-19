"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processQueuedJob = processQueuedJob;
const node_crypto_1 = require("node:crypto");
const geometry_1 = require("./geometry");
const gemini_1 = require("./gemini");
const logging_1 = require("./logging");
const runtime_1 = require("./runtime");
const types_1 = require("./types");
const TRANSIENT_HTTP_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
async function processQueuedJob(jobId) {
    const jobRef = runtime_1.db.collection("jobs").doc(jobId);
    const claimed = await claim(jobRef);
    if (!claimed)
        return;
    (0, logging_1.logEvent)("functions_worker", "job_claimed", {
        job_id: jobId,
        retry_count: claimed.retryCount ?? 0,
    });
    const maxRetries = clampInt(Number(process.env.JOB_MAX_RETRIES ?? 2), 0, 6);
    for (let attempt = claimed.retryCount ?? 0; attempt <= maxRetries; attempt += 1) {
        const snap = await jobRef.get();
        if (!snap.exists)
            return;
        const job = snap.data();
        try {
            await runPipeline(jobRef, jobId, job, attempt);
            (0, logging_1.logEvent)("functions_worker", "job_succeeded", {
                job_id: jobId,
                retry_count: attempt,
            });
            return;
        }
        catch (err) {
            const classification = classifyFailure(err);
            if (classification.retryable && attempt < maxRetries) {
                (0, logging_1.logEvent)("functions_worker", "job_retry_scheduled", {
                    job_id: jobId,
                    retry_count: attempt + 1,
                    failure_code: classification.code,
                    error: safeMessage(err),
                });
                await jobRef.update({
                    retryCount: attempt + 1,
                    failureCode: classification.code,
                    error: safeMessage(err),
                    ...stagePatch("retry_wait"),
                });
                await sleep(Math.min(1200 * 2 ** attempt, 8000));
                await jobRef.update({
                    status: "running",
                    failureCode: null,
                    error: null,
                    ...stagePatch("spec"),
                });
                continue;
            }
            await jobRef.update({
                status: "failed",
                retryCount: attempt,
                failureCode: classification.code,
                error: safeMessage(err),
                ...stagePatch("done"),
            });
            (0, logging_1.logEvent)("functions_worker", "job_failed", {
                job_id: jobId,
                retry_count: attempt,
                failure_code: classification.code,
                error: safeMessage(err),
            });
            return;
        }
    }
}
async function claim(jobRef) {
    return runtime_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        if (!snap.exists)
            return null;
        const job = snap.data();
        if (job.status !== "queued")
            return null;
        tx.update(jobRef, {
            status: "running",
            failureCode: null,
            error: null,
            ...stagePatch("spec"),
        });
        return job;
    });
}
async function runPipeline(jobRef, jobId, job, attempt) {
    const calls = Array.isArray(job.providerMeta?.calls)
        ? [...job.providerMeta.calls]
        : [];
    let spec;
    if (job.providerMeta?.reuseSpec && job.parentJobId) {
        const parentSnap = await runtime_1.db.collection("jobs").doc(job.parentJobId).get();
        const parent = parentSnap.data();
        if (!parent?.houseSpec)
            throw new Error("validation:reuse_spec_unavailable");
        spec = parent.houseSpec;
        calls.push({
            provider: "reuse",
            model: "parent_house_spec",
            request_id: job.parentJobId,
        });
    }
    else {
        const specResult = await (0, gemini_1.generateHouseSpec)({
            prompt: job.prompt,
            bedrooms: job.bedrooms,
            bathrooms: job.bathrooms,
            style: job.style,
        });
        spec = specResult.spec;
        calls.push(specResult.meta);
    }
    validateSpec(job, spec);
    await jobRef.update(stagePatch("plan"));
    const planGraph = (0, geometry_1.generatePlanGraph)(spec);
    const warnings = planGraph.warnings ?? [];
    await jobRef.update({
        warnings,
        ...stagePatch("render"),
    });
    const specBuffer = Buffer.from(JSON.stringify(spec, null, 2), "utf-8");
    const svgBuffer = Buffer.from((0, geometry_1.renderPlanSvg)(planGraph), "utf-8");
    await writeArtifact(jobRef, jobId, job.uid, {
        id: "spec_json",
        type: "spec_json",
        mimeType: "application/json",
        storagePath: `artifacts/${jobId}/spec.json`,
        checksumSha256: sha256(specBuffer),
        sizeBytes: specBuffer.length,
        createdAt: (0, types_1.isoNow)(),
        updatedAt: (0, types_1.isoNow)(),
    }, specBuffer);
    await writeArtifact(jobRef, jobId, job.uid, {
        id: "plan_svg",
        type: "plan_svg",
        mimeType: "image/svg+xml",
        storagePath: `artifacts/${jobId}/plan.svg`,
        checksumSha256: sha256(svgBuffer),
        sizeBytes: svgBuffer.length,
        createdAt: (0, types_1.isoNow)(),
        updatedAt: (0, types_1.isoNow)(),
    }, svgBuffer);
    if (job.wantExteriorImage) {
        await jobRef.update(stagePatch("image"));
        const image = await (0, gemini_1.generateExteriorImage)({
            prompt: job.prompt,
            style: job.style,
        });
        if (image) {
            calls.push(image.meta);
            await writeArtifact(jobRef, jobId, job.uid, {
                id: "exterior_image",
                type: "exterior_image",
                mimeType: image.mimeType,
                storagePath: `artifacts/${jobId}/exterior.${image.mimeType.includes("png") ? "png" : "jpg"}`,
                checksumSha256: sha256(image.bytes),
                sizeBytes: image.bytes.length,
                createdAt: (0, types_1.isoNow)(),
                updatedAt: (0, types_1.isoNow)(),
            }, image.bytes);
        }
    }
    await jobRef.update({
        status: "succeeded",
        retryCount: attempt,
        failureCode: null,
        error: null,
        providerMeta: {
            ...(job.providerMeta ?? {}),
            calls,
        },
        houseSpec: spec,
        planGraph,
        warnings,
        ...stagePatch("done"),
    });
}
async function writeArtifact(jobRef, jobId, uid, artifact, bytes) {
    const b = (0, runtime_1.bucket)();
    const file = b.file(artifact.storagePath);
    await file.save(bytes, {
        resumable: false,
        contentType: artifact.mimeType,
        metadata: {
            cacheControl: "private,max-age=0",
        },
    });
    await jobRef.collection("artifacts").doc(artifact.id).set({
        ...artifact,
        jobId,
        uid,
    });
}
function validateSpec(job, spec) {
    const beds = spec.rooms.filter((r) => r.type === "bedroom").length;
    const baths = spec.rooms.filter((r) => r.type === "bathroom").length;
    if (beds < job.bedrooms)
        throw new Error("validation:bedrooms_mismatch");
    if (baths < job.bathrooms)
        throw new Error("validation:bathrooms_mismatch");
    for (const room of spec.rooms) {
        if (!room.name || !room.type || room.area_ft2 <= 0) {
            throw new Error("validation:invalid_room");
        }
    }
}
function classifyFailure(err) {
    if (err instanceof gemini_1.ProviderHttpError) {
        if (TRANSIENT_HTTP_CODES.has(err.status))
            return { code: "provider_transient", retryable: true };
        return { code: "provider_permanent", retryable: false };
    }
    if (err instanceof Error && err.message.startsWith("validation:")) {
        return { code: "validation", retryable: false };
    }
    if (err instanceof Error && err.name === "AbortError") {
        return { code: "provider_transient", retryable: true };
    }
    return { code: "system", retryable: false };
}
function stagePatch(stage) {
    const now = (0, types_1.isoNow)();
    return {
        stage,
        updatedAt: now,
        [`stageTimestamps.${stage}`]: now,
    };
}
function safeMessage(err) {
    if (err instanceof Error)
        return err.message.slice(0, 2000);
    return "Unknown error";
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
function sha256(bytes) {
    return (0, node_crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function clampInt(n, min, max) {
    if (!Number.isFinite(n))
        return min;
    return Math.max(min, Math.min(max, Math.round(n)));
}
//# sourceMappingURL=pipeline.js.map