import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "plate";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-transparent bg-[var(--color-accent)] text-[#00131f] hover:bg-[var(--color-accent-strong)]",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-surface-strong)] text-[var(--color-ink)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]",
  ghost:
    "border border-transparent text-[var(--color-ink-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-ink)]",
  danger:
    "border border-transparent bg-[var(--color-danger)] text-[#260205] hover:brightness-95",
  plate:
    "border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-ink)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: Props) {
  const classes = [
    "inline-flex items-center justify-center rounded-[0.8rem] font-semibold tracking-[0.01em] transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-canvas)]",
    "disabled:pointer-events-none disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
