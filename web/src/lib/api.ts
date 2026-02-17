export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          (data && (data.message || data.detail || data.error)) ||
          `Request failed (${res.status})`,
      };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
