export type AsyncPhase = "idle" | "loading" | "success" | "error";

export type AsyncState = {
  phase: AsyncPhase;
  stale: boolean;
  error: string | null;
  updatedAt: string | null;
};

export function initialAsyncState(): AsyncState {
  return {
    phase: "idle",
    stale: false,
    error: null,
    updatedAt: null,
  };
}

export function asLoading(prev?: AsyncState): AsyncState {
  return {
    phase: "loading",
    stale: prev?.stale ?? false,
    error: null,
    updatedAt: prev?.updatedAt ?? null,
  };
}

export function asSuccess(timestampIso = new Date().toISOString()): AsyncState {
  return {
    phase: "success",
    stale: false,
    error: null,
    updatedAt: timestampIso,
  };
}

export function asError(message: string, prev?: AsyncState): AsyncState {
  return {
    phase: "error",
    stale: true,
    error: message,
    updatedAt: prev?.updatedAt ?? null,
  };
}

export function uiStateLabel(state: AsyncState): string {
  if (state.phase === "loading") return "loading";
  if (state.phase === "error") return "error";
  if (state.stale) return "stale";
  if (state.phase === "success") return "fresh";
  return "idle";
}
