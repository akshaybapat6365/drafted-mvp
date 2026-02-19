import Link from "next/link";

import { ThemeToggle } from "@/components/ui";
import LogoutButton from "./LogoutButton";
import RuntimeModeBadge from "./RuntimeModeBadge";

const navItemBase =
  "nav-pill border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]";

const navItemPrimary =
  "nav-pill border border-transparent bg-[var(--color-accent)] text-[#00131f] hover:bg-[var(--color-accent-strong)]";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[color-mix(in srgb,var(--color-bg-canvas) 88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="flex flex-col">
            <span className="kicker w-max">Drafted Control Deck</span>
            <span className="mt-1 text-[clamp(1.5rem,2.5vw,2.2rem)] leading-none tracking-tight">
              Blueprint Studio
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Primary">
            <Link className={navItemBase} href="/app">
              Studio
            </Link>
            <Link className={navItemBase} href="/">
              Landing
            </Link>
            <Link className={navItemPrimary} href="/app/drafts/new">
              Launch Draft
            </Link>
            <RuntimeModeBadge />
            <ThemeToggle />
            <LogoutButton />
          </nav>
        </div>
        <div className="mx-auto w-full max-w-6xl px-6 pb-3 text-[11px] uppercase tracking-[0.09em] text-[var(--color-ink-muted)]">
          Runtime-aware pipeline: Firebase + Gemini primary, local mock fallback for recovery.
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
