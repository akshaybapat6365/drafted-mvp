import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral:
    "border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
  accent:
    "border border-[color-mix(in srgb,var(--color-accent) 46%,transparent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  success:
    "border border-[color-mix(in srgb,var(--color-success) 46%,transparent)] bg-[color-mix(in srgb,var(--color-success) 16%,transparent)] text-[var(--color-success)]",
  warning:
    "border border-[color-mix(in srgb,var(--color-warning) 46%,transparent)] bg-[color-mix(in srgb,var(--color-warning) 16%,transparent)] text-[var(--color-warning)]",
  danger:
    "border border-[color-mix(in srgb,var(--color-danger) 48%,transparent)] bg-[color-mix(in srgb,var(--color-danger) 14%,transparent)] text-[var(--color-danger)]",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
  pulse = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${toneClass[tone]} ${pulse ? "animate-pulse" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
