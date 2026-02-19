"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const auth_1 = require("firebase-admin/auth");
const runtime_1 = require("./runtime");
const types_1 = require("./types");
async function requireAuth(req, res, next) {
    const authz = req.header("authorization") ?? "";
    const token = extractBearer(authz);
    if (!token) {
        res.status(401).json({
            code: "http_401",
            message: "Missing Authorization bearer token",
            retryable: false,
        });
        return;
    }
    try {
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
        req.user = decoded;
        await runtime_1.db
            .collection("users")
            .doc(decoded.uid)
            .set({
            uid: decoded.uid,
            email: decoded.email ?? null,
            planTier: "free",
            credits: 50,
            updatedAt: (0, types_1.isoNow)(),
            createdAt: (0, types_1.isoNow)(),
        }, { merge: true });
        next();
    }
    catch {
        res.status(401).json({
            code: "http_401",
            message: "Invalid or expired auth token",
            retryable: false,
        });
    }
}
function extractBearer(raw) {
    const lower = raw.toLowerCase();
    if (!lower.startsWith("bearer "))
        return null;
    const token = raw.slice(7).trim();
    return token || null;
}
//# sourceMappingURL=auth.js.map