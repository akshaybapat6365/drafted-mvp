"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  ErrorPanel,
  FadeSlideIn,
  SectionHeader,
  StaggerGroup,
  StaggerItem,
} from "@/components/ui";
import { apiJson } from "@/lib/api";
import {
  asError,
  asLoading,
  asSuccess,
  initialAsyncState,
  uiStateLabel,
} from "@/lib/asyncState";
import { emitTelemetry } from "@/lib/telemetry";
import type { JobOut, SessionOut } from "@/types/api";

type CreateJobOut = Pick<JobOut, "id" | "session_id" | "status" | "stage" | "error">;

type Preset = {
  id: string;
  label: string;
  style: string;
  bedrooms: number;
  bathrooms: number;
  prompt: string;
};

const STYLE_OPTIONS = [
  { value: "modern_farmhouse", label: "Modern Farmhouse" },
  { value: "contemporary", label: "Contemporary" },
  { value: "hill_country", label: "Hill Country" },
  { value: "midcentury_modern", label: "Mid-Century Modern" },
];

const PRESETS: Preset[] = [
  {
    id: "urban-family",
    label: "Urban Family",
    style: "contemporary",
    bedrooms: 4,
    bathrooms: 3,
    prompt:
      "4 bedroom contemporary family house with open kitchen, daylight stair core, office niche, and a connected indoor-outdoor living zone.",
  },
  {
    id: "compact-retreat",
    label: "Compact Retreat",
    style: "midcentury_modern",
    bedrooms: 2,
    bathrooms: 2,
    prompt:
      "Compact 2 bedroom retreat with strong privacy between bedrooms, vaulted living room, small patio, and efficient circulation.",
  },
  {
    id: "hill-estate",
    label: "Hill Estate",
    style: "hill_country",
    bedrooms: 5,
    bathrooms: 4,
    prompt:
      "5 bedroom hill country home with split private/public wings, large great room, covered outdoor kitchen, and panoramic rear facade.",
  },
  {
    id: "farmhouse-flex",
    label: "Farmhouse Flex",
    style: "modern_farmhouse",
    bedrooms: 3,
    bathrooms: 2,
    prompt:
      "3 bedroom modern farmhouse with mudroom drop zone, oversized pantry, wide island kitchen, and direct line of sight to backyard play area.",
  },
];

const CONSTRAINT_CHIPS = [
  "No dead-end circulation",
  "Primary suite far from public zone",
  "Kitchen near garage entry",
  "Max daylight in living room",
  "Separate guest wing",
  "Quiet home office",
];

export default function NewDraftClient({
  sessionFromQuery,
  q,
}: {
  sessionFromQuery: string | null;
  q: string | null;
}) {
  const router = useRouter();
  const [asyncState, setAsyncState] = useState(initialAsyncState());

  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(sessionFromQuery);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    q ||
      "3 bed 2 bath modern farmhouse with an open kitchen and a big great room",
  );
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [style, setStyle] = useState("modern_farmhouse");
  const [wantExteriorImage, setWantExteriorImage] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [errorAttempts, setErrorAttempts] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  const normalizedPrompt = prompt.trim();
  const promptTooShort = normalizedPrompt.length > 0 && normalizedPrompt.length < 24;
  const roomMixInvalid = bathrooms > bedrooms + 2;
  const submitDisabled =
    submitting || !normalizedPrompt || promptTooShort || roomMixInvalid;
  const submitDisabledReason = submitting
    ? "A submit is already in progress."
    : !normalizedPrompt
      ? "Prompt is required."
      : promptTooShort
        ? "Prompt should be at least 24 characters."
        : roomMixInvalid
          ? "Bathrooms cannot exceed bedrooms by more than 2."
          : null;

  function isRetryable(status?: number): boolean {
    if (!status) return false;
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  function clampInt(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(10, Math.max(1, Math.floor(value)));
  }

  const requestPreview = useMemo(
    () =>
      JSON.stringify(
        {
          prompt: normalizedPrompt || "<add prompt>",
          bedrooms,
          bathrooms,
          style,
          want_exterior_image: wantExteriorImage,
          idempotency_key: idempotencyKey.trim().slice(0, 80) || null,
          priority: "normal",
        },
        null,
        2,
      ),
    [
      normalizedPrompt,
      bedrooms,
      bathrooms,
      style,
      wantExteriorImage,
      idempotencyKey,
    ],
  );

  async function loadSessions() {
    setAsyncState((current) => asLoading(current));
    setErrorCode(null);
    setErrorRetryable(false);
    setErrorAttempts(null);
    const r = await apiJson<SessionOut[]>("/api/v1/sessions", { retries: 1 });
    if (!r.ok) {
      setErrorCode(r.code ?? null);
      setErrorRetryable(isRetryable(r.status));
      setErrorAttempts(r.attempts ?? null);
      setError(r.status === 401 ? "Please log in to draft." : r.error);
      setAsyncState((current) => asError(r.error, current));
      return;
    }
    setSessions(r.data);
    setAsyncState(asSuccess());
    if (!sessionId && r.data.length) setSessionId(r.data[0].id);
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    const r = await apiJson<SessionOut>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "My Studio" }),
      retries: 1,
    });
    if (!r.ok) {
      setErrorCode(r.code ?? null);
      setErrorRetryable(isRetryable(r.status));
      setErrorAttempts(r.attempts ?? null);
      setError(r.error);
      setAsyncState((current) => asError(r.error, current));
      return null;
    }
    setSessionId(r.data.id);
    setAsyncState(asSuccess());
    return r.data.id;
  }

  async function submit() {
    setAsyncState((current) => asLoading(current));
    setError(null);
    setErrorCode(null);
    setErrorRetryable(false);
    setErrorAttempts(null);
    setSubmitting(true);
    const normalizedIdempotencyKey = idempotencyKey.trim().slice(0, 80);
    const sid = await ensureSession();
    if (!sid) {
      setSubmitting(false);
      return;
    }

    const r = await apiJson<CreateJobOut>(
      `/api/v1/jobs/sessions/${encodeURIComponent(sid)}`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: normalizedPrompt,
          bedrooms,
          bathrooms,
          style,
          want_exterior_image: wantExteriorImage,
          idempotency_key: normalizedIdempotencyKey || null,
          priority: "normal",
        }),
        retries: normalizedIdempotencyKey ? 1 : 0,
      },
    );
    setSubmitting(false);
    if (!r.ok) {
      setErrorCode(r.code ?? null);
      setErrorRetryable(isRetryable(r.status));
      setErrorAttempts(r.attempts ?? null);
      setError(r.error);
      setAsyncState((current) => asError(r.error, current));
      emitTelemetry({
        event_name: "draft_submit_failed",
        page: "/app/drafts/new",
        status: "error",
        metadata: {
          code: r.code ?? null,
          attempts: r.attempts ?? null,
          request_id: r.requestId ?? null,
        },
      });
      return;
    }
    setAsyncState(asSuccess());
    emitTelemetry({
      event_name: "draft_submit_succeeded",
      page: "/app/drafts/new",
      status: "success",
      metadata: {
        job_id: r.data.id,
      },
    });
    router.push(`/app/jobs/${encodeURIComponent(r.data.id)}`);
  }

  function generateIdempotency() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      setIdempotencyKey(crypto.randomUUID());
      return;
    }
    setIdempotencyKey(`draft-${Date.now()}`);
  }

  function applyPreset(preset: Preset) {
    setSelectedPresetId(preset.id);
    setPrompt(preset.prompt);
    setBedrooms(preset.bedrooms);
    setBathrooms(preset.bathrooms);
    setStyle(preset.style);
  }

  function appendConstraint(snippet: string) {
    setPrompt((current) => {
      const existing = current.trim();
      if (!existing) return snippet;
      if (existing.toLowerCase().includes(snippet.toLowerCase())) return current;
      const withoutTrailingPeriod = existing.endsWith(".")
        ? existing.slice(0, -1)
        : existing;
      return `${withoutTrailingPeriod}; ${snippet}`;
    });
  }

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="grid gap-8"
      data-ui-state={uiStateLabel(asyncState)}
      aria-busy={submitting}
    >
      <FadeSlideIn>
        <SectionHeader
          kicker="Mission Setup"
          overline="Draft Composer"
          title="Shape intent into a validated plan run"
          description="Use presets, add explicit constraints, and submit a clean request envelope for deterministic geometry checks and API rendering."
          actions={
            <>
              <Badge tone={selectedSession ? "success" : "warning"}>
                {selectedSession ? `session: ${selectedSession.title}` : "auto session"}
              </Badge>
              <Badge tone={wantExteriorImage ? "accent" : "neutral"}>
                exterior {wantExteriorImage ? "enabled" : "disabled"}
              </Badge>
            </>
          }
        />
      </FadeSlideIn>

      {error ? (
        <FadeSlideIn delay={0.05}>
          <ErrorPanel
            message={error}
            code={errorCode}
            retryable={errorRetryable}
            attempts={errorAttempts ?? undefined}
            action={
              error.includes("log in") ? (
                <Link className="font-semibold underline" href="/login">
                  Log in
                </Link>
              ) : undefined
            }
          />
        </FadeSlideIn>
      ) : null}

      <StaggerGroup className="grid gap-6 xl:grid-cols-[1.5fr_.9fr]" delay={0.08}>
        <StaggerItem>
          <Card className="p-6 md:p-7" tone="ink">
            <div className="text-tech">Preset launchpad</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    selectedPresetId === preset.id
                      ? "border-[var(--color-border-strong)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="text-sm font-semibold">{preset.label}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                    {preset.bedrooms} bed · {preset.bathrooms} bath ·{" "}
                    {preset.style.replaceAll("_", " ")}
                  </div>
                </button>
              ))}
            </div>

            <div className="soft-divider mt-5" />
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="font-semibold text-[var(--color-ink)]">Prompt</span>
                <textarea
                  className="textarea-base"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  aria-invalid={promptTooShort}
                  aria-describedby="prompt-help"
                />
                <span id="prompt-help" className="text-xs text-[var(--color-ink-muted)]">
                  Include room relationships and circulation constraints for better outcomes.
                </span>
              </label>

              <div className="md:col-span-2">
                <div className="mb-2 text-sm font-semibold text-[var(--color-ink)]">
                  Constraint chips
                </div>
                <div className="flex flex-wrap gap-2">
                  {CONSTRAINT_CHIPS.map((snippet) => (
                    <button
                      key={snippet}
                      type="button"
                      onClick={() => appendConstraint(snippet)}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                    >
                      {snippet}
                    </button>
                  ))}
                </div>
              </div>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Style</span>
                <select
                  className="select-base"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  {STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Session</span>
                <select
                  className="select-base"
                  value={sessionId ?? ""}
                  onChange={(e) => setSessionId(e.target.value || null)}
                >
                  <option value="">Auto-create &quot;My Studio&quot;</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Bedrooms</span>
                <input
                  className="input-base"
                  type="number"
                  min={1}
                  max={10}
                  value={bedrooms}
                  onChange={(e) =>
                    setBedrooms(clampInt(Number(e.target.value || "3"), 3))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Bathrooms</span>
                <input
                  className="input-base"
                  type="number"
                  min={1}
                  max={10}
                  value={bathrooms}
                  onChange={(e) =>
                    setBathrooms(clampInt(Number(e.target.value || "2"), 2))
                  }
                  aria-invalid={roomMixInvalid}
                  aria-describedby="roommix-help"
                />
              </label>

              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="font-semibold text-[var(--color-ink)]">Idempotency key</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input-base"
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value.slice(0, 80))}
                    placeholder="Optional key for deduplicating repeated submits"
                    aria-describedby="idempotency-help"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={generateIdempotency}
                  >
                    Generate
                  </Button>
                </div>
                <span id="idempotency-help" className="text-xs text-[var(--color-ink-muted)]">
                  Keep this key stable when manually retrying the same request payload.
                </span>
              </label>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setWantExteriorImage((value) => !value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    wantExteriorImage
                      ? "border-[color-mix(in srgb,var(--color-success) 52%,transparent)] bg-[color-mix(in srgb,var(--color-success) 14%,transparent)] text-[var(--color-success)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]"
                  }`}
                >
                  Exterior render {wantExteriorImage ? "enabled" : "disabled"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-xs text-[var(--color-ink-muted)]">
              <div>Prompt length: {normalizedPrompt.length} characters.</div>
              {promptTooShort ? (
                <div className="text-[var(--color-warning)]">
                  Prompt should be at least 24 characters for stable parsing.
                </div>
              ) : null}
              {roomMixInvalid ? (
                <div id="roommix-help" className="text-[var(--color-warning)]">
                  Bathroom count is unusually high relative to bedrooms.
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[var(--color-ink-muted)]">
                {submitDisabledReason ??
                  "401 responses indicate expired auth and require re-login."}
              </div>
              <Button disabled={submitDisabled} onClick={submit} size="lg">
                {submitting ? "Submitting..." : "Create draft job"}
              </Button>
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-6" tone="plate">
            <div className="text-tech">Run envelope</div>
            <h2 className="mt-4 text-xl font-semibold">API-first execution</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">
              No local image generation path is used. Structured output and deterministic
              geometry happen first, then remote models handle final visuals.
            </p>
            <div className="soft-divider my-5" />

            <div className="text-tech">Request preview</div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-[11px] leading-5 text-[var(--color-ink)]">
{requestPreview}
            </pre>

            <div className="mt-4 grid gap-2 text-sm text-[var(--color-ink-muted)]">
              <div>1. Parse prompt to structured house spec.</div>
              <div>2. Validate adjacency, circulation, and dimensions.</div>
              <div>3. Persist plan artifacts and optional exterior render.</div>
            </div>

            <div className="mt-5 grid gap-2 text-xs text-[var(--color-ink-muted)]">
              <div>
                Exterior rendering:{" "}
                <span className="font-semibold text-[var(--color-ink)]">
                  {wantExteriorImage ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div>
                Idempotency protection:{" "}
                <span className="font-semibold text-[var(--color-ink)]">
                  {idempotencyKey ? "Active" : "Not set"}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <Link
                className="nav-pill border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
                href="/app"
              >
                Back to studio
              </Link>
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
