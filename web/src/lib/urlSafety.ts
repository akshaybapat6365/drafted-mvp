export function safeExternalUrl(raw: string): string | null {
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
