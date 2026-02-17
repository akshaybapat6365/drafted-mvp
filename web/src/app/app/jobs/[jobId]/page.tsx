"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { apiJson } from "@/lib/api";

type JobOut = {
  id: string;
  status: string;
  stage: string;
  error: string | null;
  failure_code: string | null;
  retry_count: number;
  prompt: string;
  bedrooms: number;
  bathrooms: number;
  style: string;
  provider_meta: { calls?: Array<{ model?: string; provider?: string }> };
  stage_timestamps: Record<string, string>;
  warnings: string[];
  created_at: string;
  updated_at: string;
};

type ArtifactOut = {
  id: string;
  type: string;
  mime_type: string;
  checksum_sha256: string | null;
  size_bytes: number | null;
  url: string;
  created_at: string;
};

type ArtifactsOut = { job_id: string; items: ArtifactOut[] };
type SystemHealthOut = { provider_mode: "mock" | "gemini" };

function sizeLabel(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function JobPage({ params }: { params: { jobId: string } }) {
  const jobId = params.jobId;
  const router = useRouter();
  const [job, setJob] = useState<JobOut | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [providerMode, setProviderMode] = useState<"mock" | "gemini" | "unknown">("unknown");

  const planSvg = useMemo(
    () => artifacts.find((a) => a.type === "plan_svg"),
    [artifacts],
  );
  const specJson = useMemo(
    () => artifacts.find((a) => a.type === "spec_json"),
    [artifacts],
  );
  const exterior = useMemo(
    () => artifacts.find((a) => a.type === "exterior_image"),
    [artifacts],
  );
  const timeline = useMemo(() => {
    if (!job) return [];
    return Object.entries(job.stage_timestamps)
      .map(([k, v]) => ({ stage: k, at: v }))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [job]);

  async function refresh() {
    setError(null);
    const r = await apiJson<JobOut>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
    if (!r.ok) {
      setError(r.status === 401 ? "Please log in to view this job." : r.error);
      return;
    }
    setJob(r.data);
    if (r.data.status === "succeeded" || r.data.status === "failed") {
      const a = await apiJson<ArtifactsOut>(
        `/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts`,
      );
      if (a.ok) setArtifacts(a.data.items);
    }
    if (r.data.status === "failed") {
      setError(r.data.error || "Job failed.");
    }
  }

  async function refreshHealth() {
    const h = await apiJson<SystemHealthOut>("/api/v1/system/health");
    if (h.ok) setProviderMode(h.data.provider_mode);
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

  useEffect(() => {
    let alive = true;
    void refresh();
    void refreshHealth();
    const t = setInterval(() => {
      if (!alive) return;
      void refresh();
    }, 800);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-zinc-900/10 bg-white px-5 py-3 text-xs text-zinc-600">
        Provider mode:{" "}
        <span className="font-medium text-zinc-900">{providerMode}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Draft job
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {job ? (
              <>
                <span className="font-medium text-zinc-900">{job.status}</span>{" "}
                · stage <span className="font-medium">{job.stage}</span>
                {job.retry_count > 0 ? (
                  <>
                    {" "}
                    · retries <span className="font-medium">{job.retry_count}</span>
                  </>
                ) : null}
              </>
            ) : (
              "Loading..."
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-900/10 bg-white px-4 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
            onClick={regenerate}
            disabled={regenerating}
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </button>
          {job?.status === "failed" ? (
            <button
              className="inline-flex h-9 items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-4 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              onClick={retryFailedStage}
              disabled={retryingFailed}
            >
              {retryingFailed ? "Retrying..." : "Retry failed stage"}
            </button>
          ) : null}
          <a
            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-900/10 bg-white px-4 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
            href={`/api/v1/jobs/${encodeURIComponent(jobId)}/export`}
            target="_blank"
            rel="noreferrer"
          >
            Export zip
          </a>
          <div className="text-xs text-zinc-500">
            Job ID: <code>{jobId}</code>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}{" "}
          {error.includes("log in") ? (
            <Link className="font-medium underline" href="/login">
              Log in
            </Link>
          ) : null}
        </div>
      ) : null}

      {job ? (
        <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
          <div className="grid gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Inputs
              </div>
              <div className="mt-1 text-zinc-900">{job.prompt}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                <span className="rounded-full border border-zinc-900/10 bg-zinc-50 px-3 py-1">
                  {job.bedrooms} bed
                </span>
                <span className="rounded-full border border-zinc-900/10 bg-zinc-50 px-3 py-1">
                  {job.bathrooms} bath
                </span>
                <span className="rounded-full border border-zinc-900/10 bg-zinc-50 px-3 py-1">
                  style: {job.style}
                </span>
                {job.failure_code ? (
                  <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-red-800">
                    {job.failure_code}
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Stage timeline
              </div>
              <div className="mt-2 grid gap-2">
                {timeline.length === 0 ? (
                  <div className="text-xs text-zinc-500">No stage timestamps yet.</div>
                ) : (
                  timeline.map((t) => (
                    <div
                      key={`${t.stage}-${t.at}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-900/10 bg-zinc-50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-zinc-800">{t.stage}</span>
                      <span className="text-zinc-500">{new Date(t.at).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Warnings
              </div>
              <div className="mt-2 grid gap-2">
                {job.warnings.length === 0 ? (
                  <div className="text-xs text-zinc-500">No warnings.</div>
                ) : (
                  job.warnings.map((w, i) => (
                    <div
                      key={`w-${i}`}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                    >
                      {w}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-900">Plan SVG</div>
            {planSvg ? (
              <a
                className="text-xs text-zinc-600 underline hover:text-zinc-950"
                href={planSvg.url}
                target="_blank"
                rel="noreferrer"
              >
                Download
              </a>
            ) : null}
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-900/10 bg-zinc-50">
            {planSvg ? (
              <img alt="Plan" src={planSvg.url} className="h-auto w-full" />
            ) : (
              <div className="px-5 py-10 text-sm text-zinc-600">Waiting for plan artifact...</div>
            )}
          </div>
          {planSvg ? (
            <div className="mt-3 text-xs text-zinc-500">
              checksum: <code>{planSvg.checksum_sha256 ?? "n/a"}</code> · size:{" "}
              <span>{sizeLabel(planSvg.size_bytes)}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-900">HouseSpec JSON</div>
              {specJson ? (
                <a
                  className="text-xs text-zinc-600 underline hover:text-zinc-950"
                  href={specJson.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-zinc-900/10 bg-zinc-950 px-4 py-3 text-[12px] leading-5 text-zinc-100">
              {specJson ? (
                <div>
                  <div className="text-zinc-300">Available as an artifact. Open to view full JSON.</div>
                  <div className="mt-2 text-zinc-400">{specJson.url}</div>
                </div>
              ) : (
                "Waiting for spec artifact..."
              )}
            </div>
            {specJson ? (
              <div className="mt-3 text-xs text-zinc-500">
                checksum: <code>{specJson.checksum_sha256 ?? "n/a"}</code> · size:{" "}
                <span>{sizeLabel(specJson.size_bytes)}</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-900">Exterior image (API)</div>
              {exterior ? (
                <a
                  className="text-xs text-zinc-600 underline hover:text-zinc-950"
                  href={exterior.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
              ) : null}
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-900/10 bg-zinc-50">
              {exterior ? (
                <img alt="Exterior" src={exterior.url} className="h-auto w-full" />
              ) : (
                <div className="px-5 py-10 text-sm text-zinc-600">
                  Not available (set <code>GEMINI_API_KEY</code> on the API to enable).
                </div>
              )}
            </div>
            {exterior ? (
              <div className="mt-3 text-xs text-zinc-500">
                checksum: <code>{exterior.checksum_sha256 ?? "n/a"}</code> · size:{" "}
                <span>{sizeLabel(exterior.size_bytes)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

