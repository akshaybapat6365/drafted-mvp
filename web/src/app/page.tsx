import Link from "next/link";

import { Badge } from "@/components/ui";

export default function Home() {
  return (
    <div className="min-h-screen pb-16 text-[var(--color-ink)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex flex-col gap-1">
          <div className="kicker w-max reveal">Architectural AI</div>
          <div className="reveal delay-1 text-2xl leading-none tracking-tight">Drafted Blueprint Studio</div>
        </div>
        <nav className="reveal delay-2 flex items-center gap-2 text-sm">
          <Link
            className="nav-pill border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            href="/login"
          >
            Log in
          </Link>
          <Link
            className="nav-pill border border-transparent bg-[var(--color-accent)] text-[#00131f] hover:bg-[var(--color-accent-strong)]"
            href="/signup"
          >
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-4">
        <section className="grid gap-10 lg:grid-cols-[1.12fr_.88fr] lg:items-center">
          <div className="reveal delay-1">
            <h1 className="display-hero text-balance">
              Blueprint-grade
              <span className="block text-[var(--color-accent)]">home drafting.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-ink-muted)]">
              Drafted converts intent into deterministic structure before any polished render.
              You get inspectable geometry, stage visibility, and export-ready artifacts.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                className="nav-pill h-11 border border-transparent bg-[var(--color-accent)] px-6 text-sm text-[#00131f] hover:bg-[var(--color-accent-strong)]"
                href="/app"
              >
                Open Studio
              </Link>
              <Link
                className="nav-pill h-11 border border-[var(--color-border)] bg-[var(--color-surface)] px-6 text-sm text-[var(--color-ink)]"
                href="/app/drafts/new"
              >
                Launch Draft Job
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="accent">No local inference</Badge>
              <Badge tone="neutral">Deterministic layout graph</Badge>
              <Badge tone="success">Artifact-ready pipeline</Badge>
            </div>
          </div>

          <div className="reveal delay-2 panel-ink blueprint-grid draft-glow p-6 md:p-7">
            <div className="flex items-center justify-between">
              <div className="text-tech">Mission Dossier</div>
              <Badge tone="warning">API-only</Badge>
            </div>
            <div className="mt-5 grid gap-3">
              <article className="panel-frost p-4">
                <div className="text-tech">Intent packet</div>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-[11px] leading-5 text-[var(--color-ink)]">
{`{
  "style": "contemporary",
  "bedrooms": 4,
  "bathrooms": 3,
  "constraints": ["open kitchen", "sunlight"],
  "lot_mode": "urban"
}`}
                </pre>
              </article>
              <article className="panel-frost p-4">
                <div className="text-tech">Validation chain</div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                  House spec parsing, adjacency checks, circulation rules, then artifact rendering.
                </p>
              </article>
              <article className="panel-frost p-4">
                <div className="text-tech">Deliverables</div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                  Plan SVG, structured JSON, optional exterior visualization, downloadable export package.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="reveal delay-1 panel-frost p-5">
            <p className="text-tech">Step 1</p>
            <h3 className="mt-2 text-xl">Define design intent</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              Capture requirements and style in a constrained prompt envelope.
            </p>
          </div>
          <div className="reveal delay-2 panel-frost p-5">
            <p className="text-tech">Step 2</p>
            <h3 className="mt-2 text-xl">Validate geometry</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              Reject impossible room relationships before costly generation steps.
            </p>
          </div>
          <div className="reveal delay-3 panel-frost p-5">
            <p className="text-tech">Step 3</p>
            <h3 className="mt-2 text-xl">Review artifacts</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              Inspect timeline, warnings, and export outputs with provenance context.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
