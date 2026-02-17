export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-3 animate-pulse rounded-full bg-[color-mix(in srgb,var(--color-ink) 20%,transparent)] ${className}`}
    />
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[color-mix(in srgb,var(--color-ink) 12%,transparent)] ${className}`}
    />
  );
}
