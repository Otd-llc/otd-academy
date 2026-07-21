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
//
// WS4 (advisory-first): when the host page resolves the revision as NOT
// board-ready (`boardReady === false`), this renders a soft-confirm nudge +
// "I've reviewed board readiness" checkbox and gates the submit pill behind
// that ack. The gate is CLIENT-SIDE ONLY — `materializeGuide` is unchanged.
// When `boardReady` is true/undefined there is no nudge and the button
// behaves exactly as before.

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type GuideFormState,
  materializeGuideFormAction,
} from "@/lib/actions/guides-form";

const initialState: GuideFormState = {};

function SubmitPill({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "GENERATING…" : "Generate build guide"}
    </button>
  );
}

export function GenerateGuideButton({
  revisionId,
  boardReady,
  boardIssueCount,
}: {
  revisionId: string;
  boardReady?: boolean;
  boardIssueCount?: number;
}) {
  const [state, action] = useActionState(
    materializeGuideFormAction,
    initialState,
  );
  const [acked, setAcked] = useState(false);
  const needsAck = boardReady === false;
  return (
    <div className="inline-flex flex-col items-start gap-2">
      {needsAck ? (
        <div className="flex flex-col gap-2 rounded border border-panel-border p-3">
          <span className="font-mono text-xs uppercase tracking-wider text-alert-red">
            ⚠ Board not ready — {boardIssueCount ?? 0} issue(s); see board
            readiness on the revision page.
          </span>
          <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              className="accent-command-gold"
            />
            I&apos;ve reviewed board readiness
          </label>
        </div>
      ) : null}
      <form action={action}>
        <input type="hidden" name="revisionId" value={revisionId} />
        <SubmitPill disabled={needsAck && !acked} />
      </form>
      {state.message ? (
        <span className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
