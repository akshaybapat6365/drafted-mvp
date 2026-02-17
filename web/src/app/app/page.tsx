"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiJson } from "@/lib/api";

type SessionOut = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type JobOut = {
  id: string;
  session_id: string;
  prompt: string;
  bedrooms: number;
  bathrooms: number;
  style: string;
  status: string;
  stage: string;
  error: string | null;
   failure_code: string | null;
   retry_count: number;
   warnings: string[];
  created_at: string;
  updated_at: string;
};

export default function StudioPage() {
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [providerMode, setProviderMode] = useState<"mock" | "gemini" | "unknown">("unknown");

  const latest = useMemo(() => sessions[0], [sessions]);

  async function refresh() {
    setLoading(true);
    setError(null);
    const r = await apiJson<SessionOut[]>("/api/v1/sessions");
    if (!r.ok) {
      setLoading(false);
      setError(r.status === 401 ? "Please log in to continue." : r.error);
      setSessions([]);
      setJobs([]);
      return;
    }
    setSessions(r.data);

    const j = await apiJson<JobOut[]>("/api/v1/jobs");
    setLoading(false);
    if (!j.ok) {
      setJobs([]);
      return;
    }
    setJobs(j.data);
  }

  async function refreshHealth() {
    const h = await apiJson<{ provider_mode: "mock" | "gemini" }>("/api/v1/system/health");
    if (h.ok) setProviderMode(h.data.provider_mode);
  }

  async function createSession() {
    setCreating(true);
    setError(null);
    const r = await apiJson<SessionOut>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "My Studio" }),
    });
    setCreating(false);
    if (!r.ok) return setError(r.error);
    await refresh();
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
      void refreshHealth();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            My Studio
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Sessions group your draft jobs. This MVP runs jobs asynchronously in
            an in-process worker and stores artifacts on disk.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-900/10 bg-white px-5 text-sm font-medium hover:bg-zinc-100"
            href="/app/drafts/new"
          >
            New draft
          </Link>
          <button
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            onClick={createSession}
            disabled={creating}
          >
            {creating ? "Creating..." : "New session"}
          </button>
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

      <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">Sessions</div>
          <button
            className="text-xs text-zinc-600 hover:text-zinc-950"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-900/15 bg-zinc-50 px-5 py-6 text-sm text-zinc-700">
              No sessions yet. Create one, then draft your first plan.
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-900/10 bg-white px-5 py-4"
              >
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    {s.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-950 px-4 text-xs font-medium text-white hover:bg-zinc-800"
                  href={`/app/drafts/new?session=${encodeURIComponent(s.id)}`}
                >
                  Draft in session
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">Recent drafts</div>
          <div className="text-xs text-zinc-500">
            {jobs.length} jobs · provider:{" "}
            <span className="font-medium text-zinc-700">{providerMode}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-900/15 bg-zinc-50 px-5 py-6 text-sm text-zinc-700">
              No jobs yet. Create a new draft to generate artifacts.
            </div>
          ) : (
            jobs.slice(0, 10).map((j) => (
              <Link
                key={j.id}
                href={`/app/jobs/${encodeURIComponent(j.id)}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-zinc-900/10 bg-white px-5 py-4 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {j.prompt}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-600">
                    <span className="rounded-full border border-zinc-900/10 bg-zinc-50 px-3 py-1">
                      {j.bedrooms} bed / {j.bathrooms} bath
                    </span>
                    <span className="rounded-full border border-zinc-900/10 bg-zinc-50 px-3 py-1">
                      {j.style}
                    </span>
                    <span className="rounded-full border border-zinc-900/10 bg-zinc-50 px-3 py-1">
                      {j.status}:{j.stage}
                    </span>
                    {j.warnings.length > 0 ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-800">
                        {j.warnings.length} warning{j.warnings.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {j.failure_code ? (
                      <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-red-800">
                        {j.failure_code}
                      </span>
                    ) : null}
                    {j.retry_count > 0 ? (
                      <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-zinc-700">
                        retry {j.retry_count}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 group-hover:text-zinc-700">
                  {new Date(j.created_at).toLocaleString()}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {latest ? (
        <div className="rounded-3xl border border-zinc-900/10 bg-white p-6">
          <div className="text-sm font-medium text-zinc-900">
            Quick actions
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800"
              href={`/app/drafts/new?session=${encodeURIComponent(latest.id)}`}
            >
              New draft in “{latest.title}”
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
