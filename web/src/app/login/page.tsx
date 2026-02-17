"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { apiJson } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await apiJson<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!r.ok) return setError(r.error);
    router.push("/app");
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-14 text-zinc-950">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-zinc-900/10 bg-white p-8 shadow-sm">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Log in
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use your Drafted MVP account.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Email</span>
            <input
              className="h-11 rounded-xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium text-zinc-700">Password</span>
            <input
              className="h-11 rounded-xl border border-zinc-900/10 px-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            type="submit"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-600">
          New here?{" "}
          <Link className="font-medium text-zinc-950 underline" href="/signup">
            Create an account
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
