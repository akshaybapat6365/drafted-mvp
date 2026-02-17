"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
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

export default function SignupPage() {
  const router = useRouter();
  const firebaseEnabled = Boolean(firebaseAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!firebaseEnabled) {
      const r = await apiJson<{ access_token: string }>("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setLoading(false);
      if (!r.ok) {
        setError(r.status === 409 ? "This email is already registered." : r.error);
        return;
      }
      router.push("/app");
      return;
    }
    try {
      await createUserWithEmailAndPassword(firebaseAuth!, email, password);
    } catch (e) {
      setLoading(false);
      setError(toAuthMessage(e));
      return;
    }
    setLoading(false);
    router.push("/app");
  }

  async function onGoogle() {
    setError(null);
    if (!firebaseEnabled) {
      setError("Google sign-up is unavailable because Firebase auth is not configured.");
      return;
    }
    setGoogleLoading(true);
    try {
      await signInWithPopup(firebaseAuth!, new GoogleAuthProvider());
    } catch (e) {
      setGoogleLoading(false);
      setError(toAuthMessage(e));
      return;
    }
    setGoogleLoading(false);
    router.push("/app");
  }

  return (
    <div className="min-h-screen px-6 py-10 md:py-14">
      <StaggerGroup className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.08fr_.92fr]" delay={0.05}>
        <StaggerItem>
          <Card className="relative overflow-hidden blueprint-grid p-8 md:p-10" tone="ink">
            <div className="pointer-events-none absolute -left-12 top-4 h-36 w-36 rounded-full bg-[color-mix(in srgb,var(--color-accent) 28%,transparent)] blur-2xl" />
            <div className="pointer-events-none absolute right-8 top-20 h-28 w-28 rounded-full bg-[color-mix(in srgb,var(--color-warm-action) 30%,transparent)] blur-2xl" />
            <Badge tone="warning">New Workspace</Badge>
            <h1 className="display-hero mt-6 max-w-xl">Start a new plan pipeline.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--color-ink-muted)]">
              Create your account to run structured draft jobs, compare outputs, and ship artifact packages.
            </p>
            <div className="soft-divider my-6" />
            <div className="grid gap-3 text-sm text-[var(--color-ink-muted)]">
              <div>1. Prompt briefing and constraints</div>
              <div>2. Geometry and adjacency validation</div>
              <div>3. External model rendering and export</div>
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-7 md:p-8" tone="frost">
            <div className="kicker">Authentication</div>
            <h2 className="mt-4 text-3xl font-semibold">Create account</h2>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Accounts unlock sessions, retries, and artifact history.
            </p>
            {!firebaseEnabled ? (
              <div className="mt-4 rounded-xl border border-[color-mix(in srgb,var(--color-warning) 52%,transparent)] bg-[color-mix(in srgb,var(--color-warning) 14%,transparent)] px-4 py-3 text-xs text-[var(--color-warning)]">
                Firebase auth is not configured. Account creation is running in local backend mode.
              </div>
            ) : null}

            <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-[var(--color-ink)]">Email</span>
                <input
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
                  className="input-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              {error ? (
                <FadeSlideIn delay={0.02}>
                  <ErrorPanel message={error} />
                </FadeSlideIn>
              ) : null}

              <Button disabled={loading || !email.trim() || password.length < 8} size="lg" type="submit" fullWidth>
                {loading ? "Creating..." : "Create account"}
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
              Already have an account?{" "}
              <Link className="font-semibold text-[var(--color-accent)] underline" href="/login">
                Log in
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
  if (m.includes("email-already-in-use")) return "This email is already registered.";
  if (m.includes("weak-password")) return "Password is too weak.";
  if (m.includes("popup-closed-by-user")) return "Google sign-up was canceled.";
  return err.message;
}
