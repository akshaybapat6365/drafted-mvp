"use client";

import Link from "next/link";
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
  StaggerGroup,
  StaggerItem,
  StatusPill,
} from "@/components/ui";
import { apiJson } from "@/lib/api";
import type { HealthOut, JobOut, ProviderMode, SessionOut } from "@/types/api";

type JobFilter = "all" | "running" | "succeeded" | "failed";

const FILTERS: Array<{ value: JobFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
];

export default function StudioPage() {
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");
  const [jobSearch, setJobSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<ProviderMode | "unknown">("unknown");

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [sessions],
  );

  const latest = useMemo(() => sortedSessions[0] ?? null, [sortedSessions]);

  const jobsBySession = useMemo(() => {
    const bySession = new Map<string, number>();
    for (const job of jobs) {
      bySession.set(job.session_id, (bySession.get(job.session_id) ?? 0) + 1);
    }
    return bySession;
  }, [jobs]);

  const stats = useMemo(() => {
    const total = jobs.length;
    const running = jobs.filter((j) => j.status === "running").length;
    const succeeded = jobs.filter((j) => j.status === "succeeded").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const retries = jobs.filter((j) => j.retry_count > 0).length;
    const warnings = jobs.reduce((acc, j) => acc + j.warnings.length, 0);
    const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 0;
    return { total, running, succeeded, failed, retries, warnings, successRate };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (jobFilter !== "all" && job.status !== jobFilter) return false;
      if (!q) return true;
      return (
        job.prompt.toLowerCase().includes(q) ||
        job.style.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q) ||
        job.status.toLowerCase().includes(q) ||
        job.stage.toLowerCase().includes(q)
      );
    });
  }, [jobs, jobFilter, jobSearch]);

  function isRetryable(status?: number): boolean {
    if (!status) return false;
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  async function refresh() {
    const firstLoad = sessions.length === 0 && jobs.length === 0;
    if (firstLoad) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setErrorCode(null);
    setErrorRetryable(false);

    const [r, j] = await Promise.all([
      apiJson<SessionOut[]>("/api/v1/sessions", { retries: 1 }),
      apiJson<JobOut[]>("/api/v1/jobs", { retries: 1 }),
    ]);

    if (!r.ok) {
      setLoading(false);
      setRefreshing(false);
      setErrorCode(r.code ?? null);
      setErrorRetryable(isRetryable(r.status));
      setError(r.status === 401 ? "Please log in to continue." : r.error);
      setSessions([]);
      setJobs([]);
      return;
    }
    setSessions(r.data);
    if (!j.ok) {
      setLoading(false);
      setRefreshing(false);
      setErrorCode(j.code ?? null);
      setErrorRetryable(isRetryable(j.status));
      setError("Session data refreshed, but jobs could not be loaded.");
      setLastSyncedAt(new Date().toISOString());
      return;
    }
    setJobs(j.data);
    setLastSyncedAt(new Date().toISOString());
    setLoading(false);
    setRefreshing(false);
  }

  async function refreshHealth() {
    const h = await apiJson<HealthOut>("/api/v1/system/health", { retries: 1 });
    if (h.ok) setProviderMode(h.data.provider_mode);
  }

  async function createSession() {
    setCreating(true);
    setError(null);
    setErrorCode(null);
    setErrorRetryable(false);
    const r = await apiJson<SessionOut>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "My Studio" }),
      retries: 1,
    });
    setCreating(false);
    if (!r.ok) {
      setErrorCode(r.code ?? null);
      setErrorRetryable(isRetryable(r.status));
      return setError(r.error);
    }
    await refresh();
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
      void refreshHealth();
    }, 0);
    return () => clearTimeout(t);
    // Initial boot fetch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-8">
      <FadeSlideIn>
        <SectionHeader
          kicker="Mission Control"
          overline="Studio"
          title="Session rail and draft operations ledger"
          description="Track run health, filter your queue instantly, and branch new drafts from active sessions."
          actions={
            <>
              <Badge
                tone={
                  providerMode === "gemini"
                    ? "success"
                    : providerMode === "mock"
                      ? "warning"
                      : "neutral"
                }
              >
                provider: {providerMode}
              </Badge>
              <Button
                variant="secondary"
                size="md"
                onClick={refresh}
                disabled={loading || refreshing}
              >
                {loading || refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="primary" size="md" onClick={createSession} disabled={creating}>
                {creating ? "Creating..." : "New session"}
              </Button>
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

      {lastSyncedAt ? (
        <div className="text-xs uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
          Last sync: {new Date(lastSyncedAt).toLocaleString()}
        </div>
      ) : null}

      <StaggerGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" delay={0.06}>
        <StaggerItem>
          <Card className="p-4" tone="plate">
            <div className="text-tech">Total Jobs</div>
            <div className="mt-2 text-3xl font-semibold">{stats.total}</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {stats.running} currently running
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-4" tone="plate">
            <div className="text-tech">Success Rate</div>
            <div className="mt-2 text-3xl font-semibold">{stats.successRate}%</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {stats.succeeded} succeeded / {stats.failed} failed
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-4" tone="plate">
            <div className="text-tech">Retry Pressure</div>
            <div className="mt-2 text-3xl font-semibold">{stats.retries}</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
              jobs with at least one retry
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-4" tone="plate">
            <div className="text-tech">Warnings</div>
            <div className="mt-2 text-3xl font-semibold">{stats.warnings}</div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
              validation and provider advisories
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>

      <StaggerGroup className="grid gap-6 xl:grid-cols-[1fr_1.3fr]" delay={0.1}>
        <StaggerItem>
          <Card className="p-6 md:p-7" tone="ink">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Session Rail</h2>
              <Badge tone="neutral">{sortedSessions.length} total</Badge>
            </div>
            <div className="soft-divider mt-4" />
            <div className="mt-4 grid gap-3">
              {loading && sortedSessions.length === 0 ? (
                <>
                  <SkeletonBlock className="h-20" />
                  <SkeletonBlock className="h-20" />
                </>
              ) : sortedSessions.length === 0 ? (
                <EmptyState
                  title="No sessions yet"
                  description="Create a session, then launch your first draft run."
                  action={
                    <Button variant="secondary" size="sm" onClick={createSession} disabled={creating}>
                      {creating ? "Creating..." : "Create session"}
                    </Button>
                  }
                />
              ) : (
                sortedSessions.map((session) => (
                  <div key={session.id} className="panel-frost p-4 transition hover:translate-y-[-1px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--color-ink)]">
                          {session.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                          {new Date(session.created_at).toLocaleString()}
                        </div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                          {jobsBySession.get(session.id) ?? 0} linked job
                          {(jobsBySession.get(session.id) ?? 0) === 1 ? "" : "s"}
                        </div>
                      </div>
                      <Link
                        className="nav-pill border border-transparent bg-[var(--color-accent)] px-3 py-1 text-[11px] text-[#00131f] hover:bg-[var(--color-accent-strong)]"
                        href={`/app/drafts/new?session=${encodeURIComponent(session.id)}`}
                      >
                        Draft
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-6 md:p-7" tone="frost">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Draft Ledger</h2>
              <Badge tone="accent">
                {filteredJobs.length}/{jobs.length} jobs
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                className="input-base"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search by prompt, style, or job ID"
                type="search"
              />
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={jobFilter === filter.value ? "primary" : "plate"}
                    size="sm"
                    onClick={() => setJobFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="soft-divider mt-4" />
            <div className="mt-4 grid gap-3">
              {loading && jobs.length === 0 ? (
                <>
                  <SkeletonBlock className="h-24" />
                  <SkeletonBlock className="h-24" />
                  <SkeletonBlock className="h-24" />
                </>
              ) : jobs.length === 0 ? (
                <EmptyState
                  title="No jobs yet"
                  description="Launch a draft to produce plan and artifact outputs."
                  action={
                    <Link
                      className="nav-pill border border-transparent bg-[var(--color-accent)] px-4 py-2 text-xs text-[#00131f]"
                      href="/app/drafts/new"
                    >
                      New draft
                    </Link>
                  }
                />
              ) : filteredJobs.length === 0 ? (
                <EmptyState
                  title="No jobs match this filter"
                  description="Change filters or clear search terms to inspect the full ledger."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setJobFilter("all");
                        setJobSearch("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                filteredJobs.slice(0, 14).map((job) => (
                  <Link
                    key={job.id}
                    href={`/app/jobs/${encodeURIComponent(job.id)}`}
                    className="panel-frost block p-4 transition hover:translate-y-[-1px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{job.prompt}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="neutral">
                            {job.bedrooms} bed / {job.bathrooms} bath
                          </Badge>
                          <Badge tone="neutral">{job.style}</Badge>
                          <StatusPill status={job.status} stage={job.stage} />
                          {job.warnings.length > 0 ? (
                            <Badge tone="warning">
                              {job.warnings.length} warning{job.warnings.length > 1 ? "s" : ""}
                            </Badge>
                          ) : null}
                          {job.failure_code ? <Badge tone="danger">{job.failure_code}</Badge> : null}
                          {job.retry_count > 0 ? <Badge tone="accent">retry {job.retry_count}</Badge> : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-[var(--color-ink-muted)]">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>

      {latest ? (
        <FadeSlideIn delay={0.14}>
          <Card className="p-6" tone="plate">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-tech">Quick branch</div>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                  Start the next run in your most recent session.
                </p>
              </div>
              <Link
                className="nav-pill border border-transparent bg-[var(--color-accent)] px-5 text-sm text-[#00131f] hover:bg-[var(--color-accent-strong)]"
                href={`/app/drafts/new?session=${encodeURIComponent(latest.id)}`}
              >
                New draft in &quot;{latest.title}&quot;
              </Link>
            </div>
          </Card>
        </FadeSlideIn>
      ) : null}
    </div>
  );
}
