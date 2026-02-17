"use client";

import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "drafted-theme";
const EVENT_NAME = "drafted-theme-change";

function getThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  const current = document.documentElement.dataset.theme;
  return current === "light" || current === "dark" ? current : "dark";
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => onStoreChange();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

function dispatchThemeChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => "dark");

  function apply(next: ThemeMode) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    dispatchThemeChange();
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-1 shadow-[0_10px_24px_-22px_rgba(0,0,0,0.95)]">
      <button
        type="button"
        aria-label="Switch to dark theme"
        onClick={() => apply("dark")}
        className={`nav-pill px-3 text-[11px] uppercase tracking-[0.1em] ${
          theme === "dark"
            ? "bg-[var(--color-accent)] text-[#00131f]"
            : "text-[var(--color-ink-muted)] hover:bg-[var(--color-accent-soft)]"
        }`}
      >
        Noir
      </button>
      <button
        type="button"
        aria-label="Switch to light theme"
        onClick={() => apply("light")}
        className={`nav-pill px-3 text-[11px] uppercase tracking-[0.1em] ${
          theme === "light"
            ? "bg-[var(--color-accent)] text-[#00131f]"
            : "text-[var(--color-ink-muted)] hover:bg-[var(--color-accent-soft)]"
        }`}
      >
        Paper
      </button>
    </div>
  );
}
