"use client";

// Reusable two-tap delete control — the single destructive-action affordance
// used across the app (checklist items, errata, BOM lines, project
// dependencies). Mirrors the inline-confirm pattern originally grown inside
// ChecklistEditor so EVERY delete in the app looks and behaves identically:
//
//   • At rest: a ghost trashcan IconButton (muted → alert-red on hover,
//     `tone="danger"`).
//   • First tap ARMS the control (a stray gloved tap can't drop a row): the
//     trash is replaced by a red confirm ✓ + a cancel ✕.
//   • The confirm ✓ is a real submit inside a `<form action={…}>` carrying a
//     hidden `id`, so it works with the existing FormData server actions
//     (plain `(formData) => void` actions AND useActionState dispatch fns —
//     both are valid `<form action>` targets).
//   • The cancel ✕ disarms without mutating.
//
// The confirm glyph reads red at rest (inherited via currentColor) so the
// destructive step is unmistakable while the button stays ghost-light — same
// treatment as the original checklist confirm.
//
// `onDeleted` fires on click of the confirm submit (post-commit hooks like the
// guide route's router.refresh() are wired through it; the checklist passes
// its `onMutated` here). It is best-effort UI sugar, not a correctness gate —
// the server action + its revalidation remain the source of truth.
import { useState } from "react";
import { IconButton } from "@/components/IconButton";
import { CheckIcon, CloseIcon, TrashIcon } from "@/components/icons";

export function DeleteConfirmButton({
  action,
  id,
  hint = "Delete",
  confirmHint = "Confirm delete",
  cancelHint = "Keep",
  ariaLabel = "Delete",
  confirmAriaLabel = "Confirm delete",
  cancelAriaLabel = "Cancel delete",
  disabled,
  onDeleted,
}: {
  /**
   * Server (or useActionState dispatch) action invoked with the form's
   * FormData. Typed to match React's `<form action>` slot so both plain
   * `(fd) => Promise<void>` server actions AND `useActionState` dispatch fns
   * (which return `void`) are accepted.
   */
  action: (formData: FormData) => void | Promise<void>;
  /** Row id, submitted as the hidden `id` field the delete actions read. */
  id: string;
  /** Tooltip on the resting trash button. */
  hint?: string;
  /** Tooltip on the armed confirm ✓ button. */
  confirmHint?: string;
  /** Tooltip on the armed cancel ✕ button. */
  cancelHint?: string;
  /** Accessible name for the resting trash button. */
  ariaLabel?: string;
  /** Accessible name for the armed confirm ✓ button. */
  confirmAriaLabel?: string;
  /** Accessible name for the armed cancel ✕ button. */
  cancelAriaLabel?: string;
  disabled?: boolean;
  /** Optional post-commit hook (e.g. router.refresh()); fired on confirm. */
  onDeleted?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <>
        <form action={action} className="inline-block">
          <input type="hidden" name="id" value={id} />
          <IconButton
            hint={confirmHint}
            ariaLabel={confirmAriaLabel}
            disabled={disabled}
            tone="danger"
            onClick={onDeleted}
          >
            {/* Armed confirm reads red at rest (the icon inherits this span's
                color via currentColor) so the destructive step is unmistakable
                while the button stays ghost-light. */}
            <span className="text-alert-red">
              <CheckIcon className="h-5 w-5" />
            </span>
          </IconButton>
        </form>
        <IconButton
          type="button"
          hint={cancelHint}
          ariaLabel={cancelAriaLabel}
          onClick={() => setConfirming(false)}
          disabled={disabled}
        >
          <CloseIcon className="h-5 w-5" />
        </IconButton>
      </>
    );
  }

  return (
    <IconButton
      type="button"
      hint={hint}
      ariaLabel={ariaLabel}
      onClick={() => setConfirming(true)}
      disabled={disabled}
      tone="danger"
    >
      <TrashIcon className="h-5 w-5" />
    </IconButton>
  );
}
