import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

import { db } from "./runtime";
import { isoNow } from "./types";

export interface AuthedRequest extends Request {
  user: DecodedIdToken;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
    const decoded = await getAuth().verifyIdToken(token);
    (req as AuthedRequest).user = decoded;
    await db
      .collection("users")
      .doc(decoded.uid)
      .set(
        {
          uid: decoded.uid,
          email: decoded.email ?? null,
          planTier: "free",
          credits: 50,
          updatedAt: isoNow(),
          createdAt: isoNow(),
        },
        { merge: true },
      );
    next();
  } catch {
    res.status(401).json({
      code: "http_401",
      message: "Invalid or expired auth token",
      retryable: false,
    });
  }
}

function extractBearer(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (!lower.startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  return token || null;
}
