"use client";

// Shared inline save-icon button for edit-in-place forms across the app.
//
// Renders a square glass icon button with a floppy-disk SVG; flips to a
// rotating arc while the form action is in flight (useFormStatus pending).
// Tooltip + aria-label preserved so the button is accessible without a
// visible label.
//
// Use this for any text input / textarea / number / URL field where the
// user might still be typing and an explicit commit affordance is the
// natural UX. Selects + checkboxes should autosave on change instead of
// rendering this button.

import { useFormStatus } from "react-dom";
import { Tooltip } from "@/components/Tooltip";

export function SaveButton({ className = "" }: { className?: string }) {
  const { pending } = useFormStatus();
  const hint = pending ? "Saving…" : "Save";
  return (
    <Tooltip content={hint}>
      {/* While pending the button is disabled and fires no pointer/focus
          events, so the Radix Trigger targets this wrapper span. Radix's
          asChild Trigger does NOT inject tabIndex, so we set tabIndex=0 (+ a
          visible focus ring) ourselves to keep the tooltip keyboard-reachable.
          aria-label stays on the button as the always-available accessible
          name. */}
      <span
        tabIndex={0}
        className="inline-flex rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
      >
        <button
          type="submit"
          disabled={pending}
          aria-label={hint}
          className={`glass-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-command-gold transition-colors hover:text-gold-light disabled:opacity-50 ${className}`}
        >
          {pending ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
          className="h-4 w-4 animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-4 w-4"
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
          )}
        </button>
      </span>
    </Tooltip>
  );
}
