// Reusable inline banner for server-action status messages (design §9.4).
//
// Three variants, all on a navy-dark chip with Space-Mono bold text. Borders
// shift to alert-red / signal-blue / status-green per variant. Text color
// follows the border so the banner reads at a glance.
//
// Per design §9.4, banner text is Space-Mono ≥14px bold; at 14px bold the
// alert-red on navy-dark contrast meets WCAG AA 3:1 for large/UI text. The
// `font-mono text-sm font-bold` combo here lands on that threshold.
//
// Used in forms to replace ad-hoc inline `<p>` error tags so every server
// action surfaces failures the same way.
import type { ReactNode } from "react";

export type InlineBannerVariant = "error" | "info" | "success";

type Tone = {
  border: string;
  text: string;
};

const TONE: Record<InlineBannerVariant, Tone> = {
  error: { border: "border-alert-red", text: "text-alert-red" },
  info: { border: "border-signal-blue", text: "text-signal-blue" },
  success: { border: "border-status-green", text: "text-status-green" },
};

export function InlineBanner({
  variant = "error",
  children,
  className = "",
}: {
  variant?: InlineBannerVariant;
  children: ReactNode;
  className?: string;
}) {
  const tone = TONE[variant];
  // Root is a <div> (not <p>) so callers can nest structured content like
  // <ul> for multi-reason gate failures without producing invalid HTML.
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`rounded border bg-navy-dark px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider ${tone.border} ${tone.text} ${className}`}
    >
      {children}
    </div>
  );
}
