"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
function sanitize(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry) => sanitize(entry));
    }
    if (typeof value === "object") {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            out[key] = sanitize(entry);
        }
        return out;
    }
    return String(value);
}
function logEvent(component, event, fields = {}) {
    const safeFields = sanitize(fields);
    const payload = {
        at: new Date().toISOString(),
        component,
        event,
        ...(safeFields && typeof safeFields === "object" ? safeFields : {}),
    };
    // firebase-functions captures structured JSON in stdout.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
}
//# sourceMappingURL=logging.js.map