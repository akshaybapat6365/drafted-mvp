import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_30%_0%,#ffe4b5,transparent_55%),radial-gradient(circle_at_80%_10%,#bfe7ff,transparent_45%),linear-gradient(to_bottom,#fff,#fafafa)] text-zinc-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-baseline gap-3">
          <div className="text-xl font-semibold tracking-tight">
            <span className="font-[family-name:var(--font-display)] text-2xl">
              Drafted
            </span>{" "}
            MVP
          </div>
          <div className="rounded-full border border-zinc-900/10 bg-white/60 px-3 py-1 text-xs text-zinc-700 backdrop-blur">
            API-first drafting
          </div>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            className="rounded-full px-4 py-2 text-zinc-800 hover:bg-white/70"
            href="/login"
          >
            Log in
          </Link>
          <Link
            className="rounded-full bg-zinc-950 px-4 py-2 text-white hover:bg-zinc-800"
            href="/signup"
          >
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
        <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Draft floor plans in seconds.
              <span className="block text-zinc-600">
                Structured specs first. Visuals second.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-7 text-zinc-700">
              This MVP follows the architecture we discussed: authoritative{" "}
              <span className="font-medium text-zinc-900">HouseSpec</span> +{" "}
              <span className="font-medium text-zinc-900">PlanGraph</span>, then
              deterministic plan SVG, and optional API-based exterior images.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
                href="/app"
              >
                Open My Studio
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-zinc-950/10 bg-white/60 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-white"
                href="/app/drafts/new"
              >
                New draft
              </Link>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              No local model inference. AI calls are online/API-based. If keys
              are missing, the workflow runs with a mock provider.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-900/10 bg-white/70 p-6 shadow-[0_30px_80px_-60px_rgba(0,0,0,.35)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-900">
                Example output artifacts
              </div>
              <div className="text-xs text-zinc-500">plan.svg + spec.json</div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-zinc-900/10 bg-gradient-to-br from-zinc-50 to-white p-4">
                <div className="text-xs font-semibold text-zinc-700">
                  HouseSpec (authoritative)
                </div>
                <pre className="mt-2 overflow-hidden rounded-xl bg-zinc-950 px-4 py-3 text-[11px] leading-5 text-zinc-100">
{`{
  "style": "modern_farmhouse",
  "bedrooms": 3,
  "bathrooms": 2,
  "rooms": [...]
}`}
                </pre>
              </div>
              <div className="rounded-2xl border border-zinc-900/10 bg-gradient-to-br from-zinc-50 to-white p-4">
                <div className="text-xs font-semibold text-zinc-700">
                  PlanGraph (deterministic)
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  Rectangular room packing with labeled SVG output.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-900/10 bg-gradient-to-br from-zinc-50 to-white p-4">
                <div className="text-xs font-semibold text-zinc-700">
                  Optional exterior image (API)
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  Enabled when <code>GEMINI_API_KEY</code> is set.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
