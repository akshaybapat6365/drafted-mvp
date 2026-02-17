"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorPanel,
  FadeSlideIn,
  SectionHeader,
  SkeletonBlock,
  SkeletonLine,
  StaggerGroup,
  StaggerItem,
  StatusPill,
  Timeline,
} from "@/components/ui";
import { apiJson } from "@/lib/api";
import type { ArtifactsOut, ArtifactOut, JobOut, ProviderMode } from "@/types/api";

type SystemHealthOut = { provider_mode: ProviderMode };

function sizeLabel(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function artifactLabel(raw: string): string {
  return raw.replaceAll("_", " ").replace(/(^\w)|(\s\w)/g, (match) => match.toUpperCase());
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function elapsedSeconds(fromIso: string, toIso: string): number {
  const start = new Date(fromIso).getTime();
  const end = new Date(toIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 1000);
}

export default function JobDetailClient({ jobId }: { jobId: string }) {
  const router = useRouter();

  const [job, setJob] = useState<JobOut | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactOut[]>([]);
  const [providerMode, setProviderMode] = useState<ProviderMode | "unknown">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const planSvg = useMemo(
    () => artifacts.find((artifact) => artifact.type === "plan_svg") ?? null,
    [artifacts],
  );
  const specJson = useMemo(
    () => artifacts.find((artifact) => artifact.type === "spec_json") ?? null,
    [artifacts],
  );
  const exterior = useMemo(
    () => artifacts.find((artifact) => artifact.type === "exterior_image") ?? null,
    [artifacts],
  );
  const timelineItems = useMemo(() => {
    if (!job) return [];
    return Object.entries(job.stage_timestamps)
      .map(([stage, at]) => ({ stage, at }))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [job]);

  const runTime = useMemo(() => {
    if (!job) return 0;
    return elapsedSeconds(job.created_at, job.updated_at);
  }, [job]);

  const stageDurations = useMemo(() => {
    if (!job || timelineItems.length === 0) return [];
    return timelineItems.map((item, index) => {
      const next = timelineItems[index + 1];
      const endAt = next ? next.at : job.updated_at;
      return {
        stage: item.stage,
        seconds: elapsedSeconds(item.at, endAt),
      };
    });
  }, [job, timelineItems]);

  async function refreshHealth() {
    const h = await apiJson<SystemHealthOut>("/api/v1/system/health");
    if (h.ok) setProviderMode(h.data.provider_mode);
  }

  async function refresh() {
    setError(null);
    const r = await apiJson<JobOut>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
    if (!r.ok) {
      setLoading(false);
      setError(r.status === 401 ? "Please log in to view this job." : r.error);
      return;
    }

    setJob(r.data);
    setLoading(false);

    if (r.data.status === "failed" && r.data.error) {
      setError(r.data.error);
    }

    if (r.data.status === "succeeded" || r.data.status === "failed") {
      const a = await apiJson<ArtifactsOut>(
        `/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts`,
      );
      if (a.ok) setArtifacts(a.data.items);
      return;
    }
    setArtifacts([]);
  }

  async function regenerate() {
    setError(null);
    setRegenerating(true);
    const r = await apiJson<JobOut>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    setRegenerating(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/app/jobs/${encodeURIComponent(r.data.id)}`);
  }

  async function retryFailedStage() {
    setError(null);
    setRetryingFailed(true);
    const r = await apiJson<JobOut>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify({ reuse_spec: true }),
      },
    );
    setRetryingFailed(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/app/jobs/${encodeURIComponent(r.data.id)}`);
  }

  async function exportArtifacts() {
    setError(null);
    setExporting(true);
    const r = await apiJson<{ url: string }>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/export`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    setExporting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    window.open(r.data.url, "_blank", "noopener,noreferrer");
  }

  async function copyJobId() {
    if (!navigator.clipboard) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1400);
      return;
    }
    try {
      await navigator.clipboard.writeText(jobId);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1400);
    }
  }

  useEffect(() => {
    let mounted = true;
    void refresh();
    void refreshHealth();

    if (!autoRefresh) {
      return () => {
        mounted = false;
      };
    }

    const intervalId = setInterval(() => {
      if (!mounted) return;
      void refresh();
    }, 1100);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, autoRefresh]);

  return (
    <div className="grid gap-8">
      <FadeSlideIn>
        <SectionHeader
          kicker="Execution Feed"
          overline="Job Detail"
          title="Draft lifecycle and artifact manifest"
          description={job ? `Job ${job.id} is ${job.status} at stage ${job.stage}.` : `Loading job ${jobId}.`}
          actions={
            <>
              <Badge tone={providerMode === "gemini" ? "success" : "warning"}>
                provider: {providerMode}
              </Badge>
              <Button
                variant={autoRefresh ? "primary" : "plate"}
                size="md"
                onClick={() => setAutoRefresh((value) => !value)}
              >
                {autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
              </Button>
              <Button variant="ghost" size="md" onClick={copyJobId}>
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy job ID"}
              </Button>
              <Button variant="secondary" size="md" onClick={refresh} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="secondary" size="md" onClick={regenerate} disabled={regenerating}>
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
              {job?.status === "failed" ? (
                <Button
                  variant="danger"
                  size="md"
                  onClick={retryFailedStage}
                  disabled={retryingFailed}
                >
                  {retryingFailed ? "Retrying..." : "Retry failed stage"}
                </Button>
              ) : null}
              <Button variant="primary" size="md" onClick={exportArtifacts} disabled={exporting}>
                {exporting ? "Exporting..." : "Export zip"}
              </Button>
            </>
          }
        />
      </FadeSlideIn>

      {error ? (
        <FadeSlideIn delay={0.05}>
          <ErrorPanel
            message={error}
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

      {job ? (
        <StaggerGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" delay={0.06}>
          <StaggerItem>
            <Card className="p-4" tone="plate">
              <div className="text-tech">Elapsed</div>
              <div className="mt-2 text-3xl font-semibold">{durationLabel(runTime)}</div>
              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                from created to last update
              </div>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="p-4" tone="plate">
              <div className="text-tech">Retries</div>
              <div className="mt-2 text-3xl font-semibold">{job.retry_count}</div>
              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                failure code: {job.failure_code ?? "none"}
              </div>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="p-4" tone="plate">
              <div className="text-tech">Warnings</div>
              <div className="mt-2 text-3xl font-semibold">{job.warnings.length}</div>
              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                prompt + validation advisories
              </div>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="p-4" tone="plate">
              <div className="text-tech">Artifacts</div>
              <div className="mt-2 text-3xl font-semibold">{artifacts.length}</div>
              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                persisted outputs for this run
              </div>
            </Card>
          </StaggerItem>
        </StaggerGroup>
      ) : null}

      {!job ? (
        <FadeSlideIn delay={0.08}>
          <Card className="p-6 md:p-7" tone="ink">
            <div className="grid gap-3">
              <SkeletonLine className="w-40" />
              <SkeletonLine className="w-[85%]" />
              <SkeletonLine className="w-[65%]" />
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                <SkeletonBlock className="h-56" />
                <SkeletonBlock className="h-56" />
              </div>
            </div>
          </Card>
        </FadeSlideIn>
      ) : (
        <StaggerGroup className="grid gap-6" delay={0.08}>
          <StaggerItem>
            <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
              <Card className="p-6 md:p-7" tone="ink">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={job.status} stage={job.stage} />
                  <Badge tone="neutral">{job.bedrooms} bed</Badge>
                  <Badge tone="neutral">{job.bathrooms} bath</Badge>
                  <Badge tone="neutral">{job.style}</Badge>
                  {job.retry_count > 0 ? <Badge tone="accent">retry {job.retry_count}</Badge> : null}
                  {job.failure_code ? <Badge tone="danger">{job.failure_code}</Badge> : null}
                </div>

                <div className="soft-divider my-4" />

                <div className="text-sm font-semibold">Prompt</div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{job.prompt}</p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-tech">Started</div>
                    <div className="mt-1 text-xs text-[var(--color-ink)]">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-tech">Updated</div>
                    <div className="mt-1 text-xs text-[var(--color-ink)]">
                      {new Date(job.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {job.provider_meta.calls?.length ? (
                  <div className="mt-5">
                    <div className="text-tech">Provider calls</div>
                    <div className="mt-2 grid gap-2">
                      {job.provider_meta.calls.map((call, index) => (
                        <div
                          key={`${call.provider ?? "provider"}-${call.model ?? "model"}-${index}`}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-[var(--color-ink)]">
                            {call.provider ?? "provider"}
                          </span>
                          <span className="text-[var(--color-ink-muted)]">
                            {" "}
                            · {call.model ?? "model"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  <div className="text-tech">Warnings</div>
                  {job.warnings.length === 0 ? (
                    <div className="mt-2 text-xs text-[var(--color-ink-muted)]">No warnings.</div>
                  ) : (
                    <div className="mt-2 grid gap-2">
                      {job.warnings.map((warning, index) => (
                        <div
                          key={`warning-${index}`}
                          className="rounded-xl border border-[color-mix(in srgb,var(--color-warning) 48%,transparent)] bg-[color-mix(in srgb,var(--color-warning) 16%,transparent)] px-3 py-2 text-xs text-[var(--color-warning)]"
                        >
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6" tone="plate">
                <div className="text-tech">Timeline</div>
                <div className="mt-4">
                  <Timeline items={timelineItems} activeStage={job.stage} />
                </div>

                <div className="mt-4 grid gap-2">
                  {stageDurations.map((item) => (
                    <div
                      key={item.stage}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-[var(--color-ink)]">
                        {item.stage.replaceAll("_", " ")}
                      </span>
                      <span className="ml-2 text-[var(--color-ink-muted)]">
                        {durationLabel(item.seconds)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-xs text-[var(--color-ink-muted)]">
                  Job ID: <code>{jobId}</code>
                </div>
              </Card>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
              <Card className="p-6 md:p-7" tone="ink">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Primary outputs</h2>
                  <Badge tone="accent">{artifacts.length} artifacts</Badge>
                </div>
                <div className="soft-divider mt-4" />

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="panel-frost p-3">
                    <div className="mb-2 text-sm font-semibold">Plan SVG</div>
                    {planSvg ? (
                      <>
                        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                          <img alt="Plan SVG preview" src={planSvg.url} className="h-auto w-full" />
                        </div>
                        <div className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
                          {sizeLabel(planSvg.size_bytes)}
                        </div>
                      </>
                    ) : (
                      <EmptyState title="Plan pending" description="Waiting for deterministic plan artifact." />
                    )}
                  </div>

                  <div className="panel-frost p-3">
                    <div className="mb-2 text-sm font-semibold">Exterior render</div>
                    {exterior ? (
                      <>
                        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                          <img alt="Exterior render" src={exterior.url} className="h-auto w-full" />
                        </div>
                        <div className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
                          {sizeLabel(exterior.size_bytes)}
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        title="No exterior artifact"
                        description="This run may have skipped exterior generation."
                      />
                    )}
                  </div>
                </div>

                {specJson ? (
                  <div className="mt-4">
                    <a
                      className="nav-pill border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
                      href={specJson.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View structured spec JSON
                    </a>
                  </div>
                ) : null}
              </Card>

              <Card className="p-6" tone="frost">
                <div className="text-tech">Artifact manifest</div>
                <div className="soft-divider mt-4" />
                <div className="mt-4 grid gap-3">
                  {artifacts.length === 0 ? (
                    <EmptyState
                      title="No artifacts yet"
                      description={
                        job.status === "running"
                          ? "Artifacts populate when this job reaches terminal state."
                          : "No files were persisted for this run."
                      }
                    />
                  ) : (
                    artifacts.map((artifact) => (
                      <a
                        key={artifact.id}
                        href={artifact.url}
                        target="_blank"
                        rel="noreferrer"
                        className="panel-frost block p-3 transition hover:translate-y-[-1px]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{artifactLabel(artifact.type)}</div>
                            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                              {artifact.mime_type} · {sizeLabel(artifact.size_bytes)}
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                              {new Date(artifact.created_at).toLocaleString()}
                            </div>
                          </div>
                          <Badge tone="neutral">Open</Badge>
                        </div>
                        {artifact.checksum_sha256 ? (
                          <div className="mt-2 truncate text-[11px] text-[var(--color-ink-muted)]">
                            sha256: <code>{artifact.checksum_sha256}</code>
                          </div>
                        ) : null}
                      </a>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </StaggerItem>
        </StaggerGroup>
      )}
    </div>
  );
}
