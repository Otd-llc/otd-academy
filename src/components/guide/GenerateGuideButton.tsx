"use client";

// "Generate build guide" button (M9 / Task 9.3 hub affordance).
//
// One-click POST to `materializeGuideFormAction` for a revision with no guide
// yet. Mirrors `MaterializeReviewButton`: the host page gates visibility
// (only shown when no guide exists AND the revision is unfrozen); this
// component renders the form + submit pill and surfaces a single-line error
// if the action rejects (e.g. a concurrent materialize won the race).
//
// On success the action calls `revalidatePath` for the guide route, so the
// RSC hub re-renders with the freshly materialized two-tier layout — no
// client-side navigation needed.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type GuideFormState,
  materializeGuideFormAction,
} from "@/lib/actions/guides-form";

const initialState: GuideFormState = {};

function SubmitPill() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "GENERATING…" : "Generate build guide"}
    </button>
  );
}

export function GenerateGuideButton({ revisionId }: { revisionId: string }) {
  const [state, action] = useActionState(
    materializeGuideFormAction,
    initialState,
  );
  return (
    <div className="inline-flex flex-col items-start gap-2">
      <form action={action}>
        <input type="hidden" name="revisionId" value={revisionId} />
        <SubmitPill />
      </form>
      {state.message ? (
        <span className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
