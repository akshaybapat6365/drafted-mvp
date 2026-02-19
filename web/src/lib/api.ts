export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; code?: string };

export type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

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

const DEFAULT_TIMEOUT_MS = 16_000;
const DEFAULT_RETRY_DELAY_MS = 450;
const MAX_RETRIES = 2;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    error.message,
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const payload = body as ApiErrorLike;
  if (typeof payload.code === "string" && payload.code.trim()) {
    return payload.code.trim();
  }
  const nested = payload.error;
  if (nested && typeof nested === "object") {
    if (typeof nested.code === "string" && nested.code.trim()) {
      return nested.code.trim();
    }
  }
  return undefined;
}

export async function apiJson<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<ApiResult<T>> {
  const retries = clampInt(init?.retries ?? 0, 0, MAX_RETRIES);
  const retryDelayMs = clampInt(
    init?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    100,
    6_000,
  );
  const timeoutMs = clampInt(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_500, 60_000);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const upstream = init?.signal;
    let detachUpstreamAbort: (() => void) | null = null;
    if (upstream) {
      if (upstream.aborted) {
        controller.abort();
      } else {
        const onAbort = () => controller.abort();
        upstream.addEventListener("abort", onAbort, { once: true });
        detachUpstreamAbort = () => upstream.removeEventListener("abort", onAbort);
      }
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = await authToken();
      const res = await fetch(path, {
        ...init,
        signal: controller.signal,
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
        if (attempt < retries && retryableStatus(res.status)) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        return {
          ok: false,
          status: res.status,
          code: extractErrorCode(data),
          error: extractErrorMessage(data, res.status),
        };
      }
      return { ok: true, data: data as T };
    } catch (e) {
      const canRetry = attempt < retries && (isNetworkError(e) || isAbortError(e));
      if (canRetry) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }

      if (isAbortError(e)) {
        return {
          ok: false,
          code: "timeout",
          error: `Request timed out after ${timeoutMs}ms.`,
        };
      }
      if (isNetworkError(e)) {
        return {
          ok: false,
          code: "network",
          error:
            "Network error reaching API. Ensure web and API services are running.",
        };
      }
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    } finally {
      clearTimeout(timeoutId);
      if (detachUpstreamAbort) detachUpstreamAbort();
    }
  }

  return {
    ok: false,
    code: "retry_exhausted",
    error: "Request failed after retry attempts were exhausted.",
  };
}
