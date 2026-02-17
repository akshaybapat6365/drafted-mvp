import type { ReactNode } from "react";

export function SectionHeader({
  kicker,
  overline,
  title,
  description,
  actions,
}: {
  kicker?: string;
  overline?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          {kicker ? <span className="kicker">{kicker}</span> : null}
          {overline ? <span className="text-tech">{overline}</span> : null}
        </div>
        <h1 className="page-title mt-2 text-balance">{title}</h1>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
