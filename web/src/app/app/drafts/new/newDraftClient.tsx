"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  status: string;
  stage: string;
  error: string | null;
};

const STYLE_OPTIONS = [
  { value: "modern_farmhouse", label: "Modern Farmhouse" },
  { value: "contemporary", label: "Contemporary" },
  { value: "hill_country", label: "Hill Country" },
  { value: "midcentury_modern", label: "Mid-Century Modern" },
];

export default function NewDraftClient({
  sessionFromQuery,
  q,
}: {
  sessionFromQuery: string | null;
  q: string | null;
}) {
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(sessionFromQuery);
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
  const [submitting, setSubmitting] = useState(false);

  async function loadSessions() {
    const r = await apiJson<SessionOut[]>("/api/v1/sessions");
    if (!r.ok) {
      setError(r.status === 401 ? "Please log in to draft." : r.error);
      return;
    }
    setSessions(r.data);
    if (!sessionId && r.data.length) setSessionId(r.data[0].id);
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    const r = await apiJson<SessionOut>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "My Studio" }),
    });
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    setSessionId(r.data.id);
    return r.data.id;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const sid = await ensureSession();
    if (!sid) {
      setSubmitting(false);
      return;
    }
    const r = await apiJson<JobOut>(
      `/api/v1/jobs/sessions/${encodeURIComponent(sid)}`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt,
          bedrooms,
          bathrooms,
          style,
          want_exterior_image: wantExteriorImage,
          idempotency_key: idempotencyKey || null,
          priority: "normal",
        }),
      },
    );
    setSubmitting(false);
    if (!r.ok) return setError(r.error);
    router.push(`/app/jobs/${encodeURIComponent(r.data.id)}`);
  }

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          New draft
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          This creates a job: prompt and constraints get converted into a
          structured spec, then a deterministic plan SVG artifact. If{" "}
          <code>GEMINI_API_KEY</code> is set on the API, an exterior image will
          also be requested via online API.
        </p>
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
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="font-medium text-zinc-700">Prompt</span>
            <textarea
              className="min-h-28 rounded-2xl border border-zinc-900/10 px-4 py-3 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Tip: include layout constraints, style, and must-have rooms.
            </span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Style</span>
            <select
              className="h-11 rounded-2xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              {STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Session</span>
            <select
              className="h-11 rounded-2xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(e.target.value || null)}
            >
              <option value="">Auto-create “My Studio”</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Bedrooms</span>
            <input
              className="h-11 rounded-2xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
              type="number"
              min={1}
              max={10}
              value={bedrooms}
              onChange={(e) => setBedrooms(parseInt(e.target.value || "3", 10))}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Bathrooms</span>
            <input
              className="h-11 rounded-2xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
              type="number"
              min={1}
              max={10}
              value={bathrooms}
              onChange={(e) =>
                setBathrooms(parseInt(e.target.value || "2", 10))
              }
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Idempotency key</span>
            <div className="flex gap-2">
              <input
                className="h-11 flex-1 rounded-2xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                placeholder="Optional. Same key reuses the same submitted job."
              />
              <button
                type="button"
                className="rounded-full border border-zinc-900/10 px-4 text-xs hover:bg-zinc-100"
                onClick={() => setIdempotencyKey(crypto.randomUUID())}
              >
                Generate
              </button>
            </div>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Exterior image</span>
            <button
              type="button"
              onClick={() => setWantExteriorImage((v) => !v)}
              className={`h-11 rounded-2xl border px-4 text-left ${
                wantExteriorImage
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-zinc-900/10 bg-white text-zinc-700"
              }`}
            >
              {wantExteriorImage ? "Enabled" : "Disabled"}
            </button>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500">
            If the API returns 401, log in first.
          </div>
          <button
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            onClick={submit}
          >
            {submitting ? "Drafting..." : "Draft now"}
          </button>
        </div>
      </div>
    </div>
  );
}
