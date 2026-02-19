type Item = {
  stage: string;
  at: string;
};

export function Timeline({
  items,
  activeStage,
}: {
  items: Item[];
  activeStage?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4 text-xs text-[var(--color-ink-muted)]"
      >
        No stage events yet.
      </div>
    );
  }

  return (
    <ol className="grid gap-2" aria-label="Job stage timeline">
      {items.map((item) => {
        const active = item.stage === activeStage;
        return (
          <li
            key={`${item.stage}-${item.at}`}
            aria-current={active ? "step" : undefined}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
              active
                ? "border-[var(--color-border-strong)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-muted)]"
            }`}
          >
            <span className="font-semibold text-[var(--color-ink)]">
              {humanizeStage(item.stage)}
            </span>
            <span className="text-[var(--color-ink-muted)]">
              {displayAt(item.at)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function humanizeStage(raw: string): string {
  return raw
    .replaceAll("_", " ")
    .replace(/(^\w)|(\s\w)/g, (match) => match.toUpperCase());
}

function displayAt(raw: string): string {
  const hasOffset = /(?:z|[+-]\d{2}:\d{2})$/i.test(raw);
  const normalized = hasOffset ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }
  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleString();
  }
  return raw;
}
