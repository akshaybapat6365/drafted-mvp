"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import {
  Badge,
  Button,
  Card,
  ErrorPanel,
  FadeSlideIn,
  StaggerGroup,
  StaggerItem,
} from "@/components/ui";
import { firebaseAuth } from "@/lib/firebaseClient";
import { apiJson } from "@/lib/api";
import { emitTelemetry } from "@/lib/telemetry";

export default function LoginPage() {
  const router = useRouter();
  const firebaseEnabled = Boolean(firebaseAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [errorAttempts, setErrorAttempts] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function isRetryable(status?: number): boolean {
    if (!status) return false;
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setErrorRetryable(false);
    setErrorAttempts(null);
    setLoading(true);
    if (!firebaseEnabled) {
      const r = await apiJson<{ access_token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
        retries: 1,
      });
      setLoading(false);
      if (!r.ok) {
        setErrorCode(r.code ?? null);
        setErrorRetryable(isRetryable(r.status));
        setErrorAttempts(r.attempts ?? null);
        setError(r.status === 401 ? "Invalid email or password." : r.error);
        emitTelemetry({
          event_name: "login_failed",
          page: "/login",
          status: "error",
          metadata: {
            code: r.code ?? null,
            attempts: r.attempts ?? null,
            request_id: r.requestId ?? null,
          },
        });
        return;
      }
      emitTelemetry({ event_name: "login_succeeded", page: "/login", status: "success" });
      router.push("/app");
      return;
    }
    try {
      await signInWithEmailAndPassword(firebaseAuth!, email, password);
    } catch (e) {
      setLoading(false);
      setError(toAuthMessage(e));
      emitTelemetry({
        event_name: "login_failed",
        page: "/login",
        status: "error",
        metadata: { provider: "firebase_email" },
      });
      return;
    }
    setLoading(false);
    emitTelemetry({ event_name: "login_succeeded", page: "/login", status: "success" });
    router.push("/app");
  }

  async function onGoogle() {
    setError(null);
    setErrorCode(null);
    setErrorRetryable(false);
    setErrorAttempts(null);
    if (!firebaseEnabled) {
      setError("Google sign-in is unavailable because Firebase auth is not configured.");
      emitTelemetry({
        event_name: "login_failed",
        page: "/login",
        status: "error",
        metadata: { provider: "google", reason: "firebase_not_configured" },
      });
      return;
    }
    setGoogleLoading(true);
    try {
      await signInWithPopup(firebaseAuth!, new GoogleAuthProvider());
    } catch (e) {
      setGoogleLoading(false);
      setError(toAuthMessage(e));
      emitTelemetry({
        event_name: "login_failed",
        page: "/login",
        status: "error",
        metadata: { provider: "google" },
      });
      return;
    }
    setGoogleLoading(false);
    emitTelemetry({
      event_name: "login_succeeded",
      page: "/login",
      status: "success",
      metadata: { provider: "google" },
    });
    router.push("/app");
  }

  return (
    <div className="min-h-screen px-6 py-10 md:py-14">
      <StaggerGroup className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.08fr_.92fr]" delay={0.05}>
        <StaggerItem>
          <Card className="relative overflow-hidden blueprint-grid p-8 md:p-10" tone="ink">
            <div className="pointer-events-none absolute -right-14 -top-10 h-36 w-36 rounded-full bg-[color-mix(in srgb,var(--color-accent) 28%,transparent)] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-[color-mix(in srgb,var(--color-warm-action) 30%,transparent)] blur-2xl" />
            <Badge tone="accent">Studio Access</Badge>
            <h1 className="display-hero mt-6 max-w-xl">Re-enter the drafting room.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--color-ink-muted)]">
              Continue where you left off with session tracking, job telemetry, and export manifests.
            </p>
            <div className="soft-divider my-6" />
            <div className="grid gap-3 text-sm text-[var(--color-ink-muted)]">
              <div>1. Structured prompt intake</div>
              <div>2. Deterministic layout checks</div>
              <div>3. Online-rendered artifact pipeline</div>
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-7 md:p-8" tone="frost">
            <div className="kicker">Authentication</div>
            <h2 className="mt-4 text-3xl font-semibold">Log in</h2>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Use your credentials to access your workspace.
            </p>
            {!firebaseEnabled ? (
              <div className="mt-4 rounded-xl border border-[color-mix(in srgb,var(--color-warning) 52%,transparent)] bg-[color-mix(in srgb,var(--color-warning) 14%,transparent)] px-4 py-3 text-xs text-[var(--color-warning)]">
                Firebase auth is not configured. Email/password login is running in local backend mode.
              </div>
            ) : null}

            <form className="mt-6 grid gap-4" onSubmit={onSubmit} aria-describedby="login-help">
              <p id="login-help" className="sr-only">
                Enter email and password, then submit to access the studio.
              </p>
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Email</span>
                <input
                  id="login-email"
                  className="input-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Password</span>
                <input
                  id="login-password"
                  className="input-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error ? (
                <FadeSlideIn delay={0.02}>
                  <ErrorPanel
                    message={error}
                    code={errorCode}
                    retryable={errorRetryable}
                    attempts={errorAttempts ?? undefined}
                  />
                </FadeSlideIn>
              ) : null}

              <Button disabled={loading || !email.trim() || !password} size="lg" type="submit" fullWidth>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <div className="flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span>or</span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <Button
                disabled={googleLoading || !firebaseEnabled}
                variant="secondary"
                size="lg"
                type="button"
                onClick={onGoogle}
                fullWidth
              >
                {googleLoading ? "Connecting..." : "Continue with Google"}
              </Button>
            </form>

            <div className="mt-6 text-sm text-[var(--color-ink-muted)]">
              New here?{" "}
              <Link className="font-semibold text-[var(--color-accent)] underline" href="/signup">
                Create an account
              </Link>
              .
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}

function toAuthMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Authentication failed.";
  const m = err.message.toLowerCase();
  if (m.includes("invalid-credential")) return "Invalid email or password.";
  if (m.includes("too-many-requests")) return "Too many attempts. Try again later.";
  if (m.includes("popup-closed-by-user")) return "Google sign-in was canceled.";
  return err.message;
}
