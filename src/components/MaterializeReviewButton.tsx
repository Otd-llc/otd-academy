"use client";

// Materialize canonical-checklist button (m16 / Task 16.10 UI affordance).
//
// One-click POST to `materializeCanonicalChecklistFormAction` for either
// REQUIREMENTS_REVIEW or LAYOUT_REVIEW. The host pane is responsible for
// gating visibility — this component just renders the form + button and
// surfaces a single-line error message if the action rejects (e.g., the
// canonical row was materialized by a concurrent request).
//
// Visual treatment matches the gold command-pill used by NewChecklistDialog
// so the affordance reads as the same "create something" gesture.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type ChecklistFormState,
  materializeCanonicalChecklistFormAction,
} from "@/lib/actions/checklists-form";

const initialState: ChecklistFormState = {};

function SubmitPill({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : `+ ${label}`}
    </button>
  );
}

export function MaterializeReviewButton({
  revisionId,
  templateKey,
  label,
}: {
  revisionId: string;
  templateKey:
    | "REQUIREMENTS_REVIEW"
    | "LAYOUT_REVIEW"
    | "STRIPBOARD_VALIDATION";
  label: string;
}) {
  const [state, action] = useActionState(
    materializeCanonicalChecklistFormAction,
    initialState,
  );
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <form action={action} className="inline-block">
        <input type="hidden" name="revisionId" value={revisionId} />
        <input type="hidden" name="templateKey" value={templateKey} />
        <SubmitPill label={label} />
      </form>
      {state.message ? (
        <span className="font-mono text-[10px] uppercase tracking-wider text-alert-red">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
