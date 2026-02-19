"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.bucket = bucket;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const app = (0, app_1.getApps)().length > 0
    ? (0, app_1.getApp)()
    : (0, app_1.initializeApp)({
        storageBucket: process.env.GCS_BUCKET,
    });
exports.db = (0, firestore_1.getFirestore)(app);
exports.db.settings({ ignoreUndefinedProperties: true });
function bucket() {
    return (0, storage_1.getStorage)(app).bucket(process.env.GCS_BUCKET || undefined);
}
//# sourceMappingURL=runtime.js.map