import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-900/10 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
              Drafted
            </span>
            <span className="text-xs text-zinc-500">MVP</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-full px-4 py-2 hover:bg-zinc-100" href="/app">
              My Studio
            </Link>
            <Link
              className="rounded-full bg-zinc-950 px-4 py-2 text-white hover:bg-zinc-800"
              href="/app/drafts/new"
            >
              New Draft
            </Link>
            <form action="/api/v1/auth/logout" method="post">
              <button
                className="rounded-full px-4 py-2 text-zinc-700 hover:bg-zinc-100"
                type="submit"
              >
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
