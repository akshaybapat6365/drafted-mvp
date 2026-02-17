export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

type ApiErrorLike = {
  code?: string;
  message?: string;
  detail?: string;
  error?:
    | string
    | {
        code?: string;
        message?: string;
        detail?: string;
      };
};

async function authToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { firebaseAuth } = await import("./firebaseClient");
    if (!firebaseAuth?.currentUser) return null;
    return firebaseAuth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

function parseResponseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown, status: number): string {
  const fallback =
    status >= 500
      ? `API request failed (${status}). Check backend service health/logs.`
      : `Request failed (${status})`;

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return fallback;
    const lower = trimmed.toLowerCase();
    if (
      lower === "internal server error" ||
      lower.startsWith("<!doctype") ||
      lower.startsWith("<html")
    ) {
      return fallback;
    }
    return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
  }

  if (!body || typeof body !== "object") return fallback;

  const payload = body as ApiErrorLike;
  const nested = payload.error;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  if (nested && typeof nested === "object") {
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
    if (typeof nested.detail === "string" && nested.detail.trim()) {
      return nested.detail.trim();
    }
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return fallback;
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const token = await authToken();
    const res = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });

    const text = await res.text();
    const data = parseResponseBody(text);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: extractErrorMessage(data, res.status),
      };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    if (e instanceof Error && /failed to fetch|networkerror/i.test(e.message)) {
      return { ok: false, error: "Network error reaching API. Ensure web and API services are running." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
