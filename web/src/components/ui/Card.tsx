import type { ReactNode } from "react";

type Tone = "paper" | "elevated" | "muted" | "ink" | "frost" | "plate";

const toneClass: Record<Tone, string> = {
  paper: "panel-frost",
  elevated: "panel-ink",
  muted: "panel-plate",
  ink: "panel-ink",
  frost: "panel-frost",
  plate: "panel-plate",
};

export function Card({
  children,
  className = "",
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return <div className={`${toneClass[tone]} ${className}`}>{children}</div>;
}
