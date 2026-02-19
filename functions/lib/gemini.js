"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderHttpError = void 0;
exports.generateHouseSpec = generateHouseSpec;
exports.generateExteriorImage = generateExteriorImage;
const node_crypto_1 = require("node:crypto");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
const GEMINI_IMAGE_MODEL_PREVIEW = process.env.GEMINI_IMAGE_MODEL_PREVIEW ?? "gemini-3-pro-image-preview";
class ProviderHttpError extends Error {
    status;
    body;
    constructor(status, body) {
        super(`Gemini API error ${status}`);
        this.status = status;
        this.body = body;
    }
}
exports.ProviderHttpError = ProviderHttpError;
async function generateHouseSpec(params) {
    if (!GEMINI_API_KEY) {
        return {
            spec: makeFallbackSpec(params),
            meta: {
                provider: "fallback",
                model: "deterministic-spec",
                request_id: `fallback-${(0, node_crypto_1.randomUUID)()}`,
            },
        };
    }
    const body = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: "You are an architecture drafting assistant. Return only JSON matching the schema. " +
                            "Use realistic room areas in ft^2 and stable room IDs.",
                    },
                ],
            },
            {
                role: "user",
                parts: [
                    {
                        text: `User prompt: ${params.prompt}\n` +
                            `Constraints: bedrooms=${params.bedrooms}, bathrooms=${params.bathrooms}, style=${params.style}\n` +
                            "Include living, kitchen, dining and requested bedrooms/bathrooms.",
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: houseSpecSchema(),
        },
    };
    const { data, meta } = await generateContent(GEMINI_TEXT_MODEL, body);
    const text = extractFirstText(data);
    if (!text) {
        throw new Error("validation:missing_spec_json");
    }
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch {
        throw new Error("validation:invalid_spec_json");
    }
    const spec = normalizeSpec(raw, params);
    return { spec, meta };
}
async function generateExteriorImage(params) {
    if (!GEMINI_API_KEY)
        return null;
    const body = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: "Generate a photorealistic exterior rendering for a single-family home. " +
                            `Style: ${params.style}. Brief: ${params.prompt}. ` +
                            "No text overlay, no watermark, daylight, 3/4 front view.",
                    },
                ],
            },
        ],
        generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
                aspectRatio: "16:9",
                imageSize: "1K",
            },
        },
    };
    const { data, meta } = await generateContent(GEMINI_IMAGE_MODEL_PREVIEW, body);
    const inline = extractInlineImage(data);
    if (!inline)
        return null;
    return {
        bytes: Buffer.from(inline.data, "base64"),
        mimeType: inline.mimeType,
        meta,
    };
}
async function generateContent(model, body) {
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const t0 = Date.now();
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new ProviderHttpError(res.status, text.slice(0, 4000));
    }
    const data = (await res.json());
    const usage = (data.usageMetadata ?? {});
    const meta = {
        provider: "gemini",
        model,
        request_id: res.headers.get("x-goog-request-id"),
        latency_ms: Date.now() - t0,
        input_tokens: numberOrUndefined(usage.promptTokenCount),
        output_tokens: numberOrUndefined(usage.candidatesTokenCount),
        total_tokens: numberOrUndefined(usage.totalTokenCount),
        image_tokens: numberOrUndefined(usage.imageTokenCount),
    };
    return { data, meta };
}
function extractFirstText(data) {
    const candidates = asArray(data.candidates);
    const first = asObject(candidates[0]);
    const content = asObject(first.content);
    const parts = asArray(content.parts);
    for (const p of parts) {
        const part = asObject(p);
        if (typeof part.text === "string" && part.text.trim())
            return part.text;
    }
    return null;
}
function extractInlineImage(data) {
    const candidates = asArray(data.candidates);
    const first = asObject(candidates[0]);
    const content = asObject(first.content);
    const parts = asArray(content.parts);
    for (const p of parts) {
        const part = asObject(p);
        const inline = asObject(part.inlineData ?? part.inline_data);
        if (typeof inline.data === "string" && inline.data.length > 0) {
            return {
                data: inline.data,
                mimeType: (typeof inline.mimeType === "string" && inline.mimeType) ||
                    (typeof inline.mime_type === "string" && inline.mime_type) ||
                    "image/png",
            };
        }
    }
    return null;
}
function normalizeSpec(raw, params) {
    const obj = asObject(raw);
    const style = typeof obj.style === "string" && obj.style.trim() ? obj.style : params.style;
    const bedrooms = clampInt(numberOrUndefined(obj.bedrooms) ?? params.bedrooms, 1, 10);
    const bathrooms = clampInt(numberOrUndefined(obj.bathrooms) ?? params.bathrooms, 1, 10);
    const roomsRaw = asArray(obj.rooms);
    const rooms = [];
    for (const r of roomsRaw) {
        const room = asObject(r);
        const type = typeof room.type === "string" ? room.type : "";
        const name = typeof room.name === "string" ? room.name : "";
        const area = numberOrUndefined(room.area_ft2);
        if (!type || !name || !area)
            continue;
        rooms.push({
            id: typeof room.id === "string" && room.id ? room.id : (0, node_crypto_1.randomUUID)(),
            type,
            name,
            area_ft2: clamp(area, 20, 2000),
        });
    }
    if (rooms.length === 0) {
        return makeFallbackSpec(params);
    }
    ensureMinimumRooms(rooms, bedrooms, bathrooms);
    const notes = asArray(obj.notes).filter((n) => typeof n === "string");
    return {
        version: "1.0",
        style,
        bedrooms,
        bathrooms,
        rooms,
        notes,
    };
}
function makeFallbackSpec(params) {
    const style = inferStyle(params.prompt, params.style);
    const rooms = [
        { id: (0, node_crypto_1.randomUUID)(), type: "living", name: "Great Room", area_ft2: 320 },
        { id: (0, node_crypto_1.randomUUID)(), type: "kitchen", name: "Kitchen", area_ft2: 220 },
        { id: (0, node_crypto_1.randomUUID)(), type: "dining", name: "Dining", area_ft2: 160 },
        { id: (0, node_crypto_1.randomUUID)(), type: "laundry", name: "Laundry", area_ft2: 70 },
    ];
    rooms.push({ id: (0, node_crypto_1.randomUUID)(), type: "bedroom", name: "Primary Bedroom", area_ft2: 240 });
    for (let i = 0; i < Math.max(0, params.bedrooms - 1); i += 1) {
        rooms.push({
            id: (0, node_crypto_1.randomUUID)(),
            type: "bedroom",
            name: `Bedroom ${i + 2}`,
            area_ft2: 150,
        });
    }
    for (let i = 0; i < params.bathrooms; i += 1) {
        rooms.push({
            id: (0, node_crypto_1.randomUUID)(),
            type: "bathroom",
            name: `Bathroom ${i + 1}`,
            area_ft2: 70,
        });
    }
    return {
        version: "1.0",
        style,
        bedrooms: params.bedrooms,
        bathrooms: params.bathrooms,
        rooms,
        notes: [
            "Fallback spec used because GEMINI_API_KEY is not configured.",
            "Set GEMINI_API_KEY to force provider-backed structured output.",
        ],
    };
}
function inferStyle(prompt, defaultStyle) {
    const p = prompt.toLowerCase();
    if (p.includes("farmhouse"))
        return "modern_farmhouse";
    if (p.includes("hill country"))
        return "hill_country";
    if (p.includes("midcentury") || p.includes("mid-century"))
        return "midcentury_modern";
    if (p.includes("contemporary"))
        return "contemporary";
    return defaultStyle;
}
function ensureMinimumRooms(rooms, bedrooms, bathrooms) {
    const hasLiving = rooms.some((r) => r.type === "living");
    const hasKitchen = rooms.some((r) => r.type === "kitchen");
    const hasDining = rooms.some((r) => r.type === "dining");
    if (!hasLiving)
        rooms.push({ id: (0, node_crypto_1.randomUUID)(), type: "living", name: "Living Room", area_ft2: 260 });
    if (!hasKitchen)
        rooms.push({ id: (0, node_crypto_1.randomUUID)(), type: "kitchen", name: "Kitchen", area_ft2: 180 });
    if (!hasDining)
        rooms.push({ id: (0, node_crypto_1.randomUUID)(), type: "dining", name: "Dining", area_ft2: 140 });
    const bedCount = rooms.filter((r) => r.type === "bedroom").length;
    for (let i = bedCount; i < bedrooms; i += 1) {
        rooms.push({
            id: (0, node_crypto_1.randomUUID)(),
            type: "bedroom",
            name: i === 0 ? "Primary Bedroom" : `Bedroom ${i + 1}`,
            area_ft2: 130,
        });
    }
    const bathCount = rooms.filter((r) => r.type === "bathroom").length;
    for (let i = bathCount; i < bathrooms; i += 1) {
        rooms.push({
            id: (0, node_crypto_1.randomUUID)(),
            type: "bathroom",
            name: `Bathroom ${i + 1}`,
            area_ft2: 60,
        });
    }
}
function houseSpecSchema() {
    return {
        type: "object",
        required: ["version", "style", "bedrooms", "bathrooms", "rooms"],
        properties: {
            version: { type: "string" },
            style: { type: "string" },
            bedrooms: { type: "integer", minimum: 1, maximum: 10 },
            bathrooms: { type: "integer", minimum: 1, maximum: 10 },
            rooms: {
                type: "array",
                items: {
                    type: "object",
                    required: ["id", "type", "name", "area_ft2"],
                    properties: {
                        id: { type: "string" },
                        type: { type: "string" },
                        name: { type: "string" },
                        area_ft2: { type: "number", minimum: 20, maximum: 2000 },
                    },
                },
            },
            notes: { type: "array", items: { type: "string" } },
        },
    };
}
function asArray(v) {
    return Array.isArray(v) ? v : [];
}
function asObject(v) {
    if (!v || typeof v !== "object" || Array.isArray(v))
        return {};
    return v;
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function clampInt(n, min, max) {
    return Math.round(clamp(n, min, max));
}
function numberOrUndefined(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
//# sourceMappingURL=gemini.js.map