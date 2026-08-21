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
import { SaveIcon, SpinnerIcon } from "@/components/icons";

export function SaveButton({ className = "" }: { className?: string }) {
  const { pending } = useFormStatus();
  const hint = pending ? "Saving…" : "Save";
  return (
    // `wrapDisabled`: while pending the button is disabled and fires no
    // pointer/focus events, so Tooltip wraps it in a focusable span. aria-label
    // stays on the button as the always-available accessible name.
    <Tooltip content={hint} wrapDisabled>
      <button
        type="submit"
        disabled={pending}
        aria-label={hint}
        className={`glass-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-command-gold transition-colors hover:text-gold-light disabled:opacity-50 ${className}`}
      >
        {pending ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" />
        ) : (
          <SaveIcon className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}
