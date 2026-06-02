"use client";

// Mark-bring-up-complete button (design §9.2).
//
// Visibility, computed by the parent server component:
//   • parent revision is at stage BRINGUP
//   • this Build is the active (unfrozen) Build
//   • no BRINGUP_COMPLETE artifact exists on this Build yet
//
// Disabled state — when any board's status is NOT in {BROUGHT_UP, QUARANTINED}.
// A Radix `Tooltip` lists up to 5 blocking serials, then `…and N more` if more
// exist (design §9.2 truncation rule). Full list reachable via the Boards table
// below the header strip. Because a disabled <button> fires no pointer/focus
// events, the trigger is a focusable wrapper <span> (tabIndex=0 + focus ring) so
// keyboard users can reach the blocking-reason hint too.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  markBringupCompleteAction,
  type BringupCompleteFormState,
} from "@/lib/actions/bringup";
import { InlineBanner } from "@/components/InlineBanner";
import { Tooltip } from "@/components/Tooltip";

const initialState: BringupCompleteFormState = {};

function SubmitButton({ tooltip }: { tooltip?: string }) {
  const { pending } = useFormStatus();
  const button = (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-command-gold px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-deep-space transition-colors hover:bg-deep-space hover:text-command-gold disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Mark bring-up complete"}
    </button>
  );
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
}

export function MarkBringupCompleteButton({
  buildId,
  blockingSerials,
}: {
  buildId: string;
  /** Empty array → enabled. Non-empty → disabled with the §9.2 truncated tooltip. */
  blockingSerials: string[];
}) {
  const [state, action] = useActionState(
    markBringupCompleteAction,
    initialState,
  );

  if (blockingSerials.length > 0) {
    const sample = blockingSerials.slice(0, 5).join(", ");
    const more =
      blockingSerials.length > 5
        ? ` …and ${blockingSerials.length - 5} more`
        : "";
    const tooltip = `Boards not yet BROUGHT_UP or QUARANTINED: ${sample}${more}`;
    return (
      <Tooltip label="Blocked" content={tooltip}>
        {/* Disabled <button> fires no pointer/focus events, so the Radix
            Trigger targets this wrapper span instead. Radix's asChild Trigger
            does NOT inject tabIndex, so we set tabIndex=0 (+ a visible focus
            ring) ourselves so keyboard users can focus the wrapper and surface
            the blocking-reason tooltip. */}
        <span
          tabIndex={0}
          className="inline-flex rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
        >
          <button
            type="button"
            disabled
            className="rounded border border-panel-border bg-deep-space px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted opacity-60"
          >
            Mark bring-up complete
          </button>
        </span>
      </Tooltip>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="buildId" value={buildId} />
      <SubmitButton />
      {state.message ? (
        <div className="max-w-xs">
          <InlineBanner variant="error">{state.message}</InlineBanner>
        </div>
      ) : null}
    </form>
  );
}
