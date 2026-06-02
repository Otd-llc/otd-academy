"use client";

// Shared ghost icon button used for every per-row / per-card action across the
// app (checklist rows, delete-confirm controls, future icon CTAs). Renders a
// real <button> (keyboard + SR accessible via `aria-label`), wrapped in a
// <Tooltip> so the label shows on hover/focus — consistent with SaveButton /
// MarkBringupCompleteButton across the app. No border, no filled background:
// just a muted ghost glyph that warms to gold on hover. The `p-2.5` padding
// around the `h-5 w-5` glyph preserves a ~40px touch target for bench use.
//
// The Tooltip's Radix Trigger forwards a ref + handlers to its single child.
// A disabled <button> fires no pointer/focus events, so (matching SaveButton)
// we wrap the button in a focusable <span> so the tooltip stays reachable;
// the `aria-label` on the button remains the always-available accessible name.
//
// Extracted verbatim from ChecklistEditor's internal IconButton so other
// surfaces can adopt the same icon affordance (see DeleteConfirmButton).
import { Tooltip } from "@/components/Tooltip";

export function IconButton({
  hint,
  ariaLabel,
  children,
  type = "submit",
  onClick,
  disabled,
  tone = "default",
}: {
  hint: string;
  ariaLabel: string;
  children: React.ReactNode;
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
  /** `danger` tints toward alert-red on hover (destructive actions). */
  tone?: "default" | "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "text-muted hover:text-alert-red hover:bg-navy-dark/40"
      : "text-muted hover:text-command-gold hover:bg-navy-dark/40";
  return (
    <Tooltip content={hint}>
      <span
        tabIndex={0}
        className="inline-flex rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
      >
        <button
          type={type}
          aria-label={ariaLabel}
          onClick={onClick}
          disabled={disabled}
          className={`inline-flex shrink-0 items-center justify-center rounded p-2.5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${toneClasses} disabled:hover:text-muted`}
        >
          {children}
        </button>
      </span>
    </Tooltip>
  );
}
