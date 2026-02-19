type LogFields = Record<string, unknown>;

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitize(entry);
    }
    return out;
  }
  return String(value);
}

export function logEvent(component: string, event: string, fields: LogFields = {}): void {
  const safeFields = sanitize(fields);
  const payload = {
    at: new Date().toISOString(),
    component,
    event,
    ...((safeFields && typeof safeFields === "object" ? safeFields : {}) as Record<
      string,
      unknown
    >),
  };
  // firebase-functions captures structured JSON in stdout.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}
