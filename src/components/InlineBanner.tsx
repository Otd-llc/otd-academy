// Reusable inline banner for server-action status messages (design §9.4).
//
// Styled in the bioscale-viz inspector language: a glass-card gradient surface
// with a subtle full state-colored border (no chunky side bar) + a leading state
// dot (pulsing on error), and Space-Mono bold text in the state color. Three
// variants — error / info / success — keep their conventional alert-red /
// signal-blue / status-green.
//
// Per design §9.4, banner text is Space-Mono ≥14px bold; at 14px bold the
// state-color-on-dark contrast meets WCAG AA 3:1 for large/UI text. The
// `font-mono text-sm font-bold` combo here lands on that threshold.
//
// Used in forms across the app to surface every server-action failure the same
// way. The API (variant / children / className) is unchanged — this is a visual
// refresh only.
import type { ReactNode } from "react";

export type InlineBannerVariant = "error" | "info" | "success";

type Tone = {
  /** Full subtle state-colored border (no chunky side bar). */
  border: string;
  text: string;
  dot: string;
};

const TONE: Record<InlineBannerVariant, Tone> = {
  error: { border: "border-alert-red/50", text: "text-alert-red", dot: "bg-alert-red" },
  info: { border: "border-signal-blue/45", text: "text-signal-blue", dot: "bg-signal-blue" },
  success: {
    border: "border-status-green/45",
    text: "text-status-green",
    dot: "bg-status-green",
  },
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
  // <ul> for multi-reason gate failures without producing invalid HTML. The
  // children sit in a flex-1 <div> beside the state dot for the same reason.
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-md border px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider [background:linear-gradient(180deg,#13131f_0%,#0d0e14_100%)] ${tone.border} ${tone.text} ${className}`}
    >
      <span
        aria-hidden
        className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot} ${
          variant === "error" ? "animate-pulse" : ""
        }`}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
