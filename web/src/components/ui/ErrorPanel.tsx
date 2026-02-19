import type { ReactNode } from "react";

export function ErrorPanel({
  message,
  code,
  retryable = false,
  attempts,
  action,
}: {
  message: string;
  code?: string | null;
  retryable?: boolean;
  attempts?: number;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color-mix(in srgb,var(--color-danger) 58%,transparent)] bg-[color-mix(in srgb,var(--color-danger) 15%,transparent)] px-5 py-4 text-sm text-[var(--color-danger)]">
      <div>{message}</div>
      {code || retryable || attempts ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.08em]">
          {code ? (
            <span className="rounded-full border border-[color-mix(in srgb,var(--color-danger) 58%,transparent)] px-2 py-0.5">
              code: {code}
            </span>
          ) : null}
          {attempts && attempts > 1 ? (
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-ink-muted)]">
              attempts: {attempts}
            </span>
          ) : null}
          {retryable ? (
            <span className="rounded-full border border-[color-mix(in srgb,var(--color-warning) 52%,transparent)] px-2 py-0.5 text-[var(--color-warning)]">
              retry suggested
            </span>
          ) : null}
        </div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
