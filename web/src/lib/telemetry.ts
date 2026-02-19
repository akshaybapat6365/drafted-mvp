type TelemetryPayload = {
  event_name: string;
  page: string;
  status?: string;
  metadata?: Record<string, unknown>;
  at?: string;
};

export function emitTelemetry(payload: TelemetryPayload): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...payload,
    at: payload.at ?? new Date().toISOString(),
  });

  const target = "/api/v1/system/events";
  const blob = new Blob([body], { type: "application/json" });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(target, blob);
    if (sent) return;
  }

  void fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
    cache: "no-store",
  });
}
