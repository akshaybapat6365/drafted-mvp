import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        storageBucket: process.env.GCS_BUCKET,
      });

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

export function bucket() {
  return getStorage(app).bucket(process.env.GCS_BUCKET || undefined);
}
