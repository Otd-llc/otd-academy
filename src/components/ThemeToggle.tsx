"use client";

// Theme toggle — flips the whole site between the primary DARK (deep-space)
// palette and the additive LIGHT (ivory paper) palette by setting `data-theme`
// on <html>. The token override in globals.css does the rest: every utility +
// component reads `var(--color-*)`, so one attribute flips them all at once.
//
// Persistence is DUAL on purpose:
//   • a `theme` cookie  — so the SSR root layout renders the right palette and
//     there is no hydration mismatch for a returning visitor.
//   • localStorage      — read by the no-flash inline script in layout.tsx
//     before first paint.
// A brand-new visitor with neither follows `prefers-color-scheme`; an explicit
// choice (either store) persists and wins.
//
// The ACTIVE theme is the DOM attribute (`<html data-theme>`), so it's read as
// an external store via useSyncExternalStore: `getServerSnapshot` returns the
// default ("dark") for SSR + hydration (no mismatch), and React re-reads the
// real client value right after hydration. The icon shows the TARGET theme
// (sun = "go light", moon = "go dark").

import { useSyncExternalStore } from "react";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year
const CHANGE_EVENT = "otd-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// SSR + the hydration pass use the default; the no-cookie/no-flash script can
// only resolve the real value on the client, which React picks up post-hydrate.
function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("otd-theme", theme);
  } catch {
    // private-mode / disabled storage — the cookie still carries the choice.
  }
  document.cookie = `theme=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isLight = theme === "light";
  // Affordance names the destination so the icon + label agree.
  const label = isLight ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      onClick={() => applyTheme(isLight ? "dark" : "light")}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-panel-border text-muted transition-colors hover:border-command-gold/60 hover:text-command-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
