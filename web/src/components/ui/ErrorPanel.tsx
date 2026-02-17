import type { ReactNode } from "react";

export function ErrorPanel({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color-mix(in srgb,var(--color-danger) 58%,transparent)] bg-[color-mix(in srgb,var(--color-danger) 15%,transparent)] px-5 py-4 text-sm text-[var(--color-danger)]">
      <div>{message}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
