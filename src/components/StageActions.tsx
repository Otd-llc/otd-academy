"use client";

// Advance / Regress buttons for the revision header strip (Task 8.3).
//
// The StageTracker itself stays read-only per design §9.1; this sibling
// component renders the two buttons next to / under the tracker band and
// surfaces gate-failure reasons inline (alert-red Space Mono per §9.4).
//
// Visibility rules (design §5.3):
//   • Advance: unfrozen revision AND currentStage !== "REVISION".
//   • Regress: unfrozen revision AND currentStage !== "REQUIREMENTS".
//
// Regress opens a <dialog> modal that collects the required reason. The
// reason is sent to regressStageAction inside the form's action.

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  advanceStageAction,
  regressStageAction,
  type StageFormState,
} from "@/lib/actions/stages";
import type { StageName } from "@/lib/stages";
import { InlineBanner } from "@/components/InlineBanner";

const initialState: StageFormState = {};

function AdvanceSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-command-gold px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-deep-space transition-colors hover:bg-deep-space hover:text-command-gold disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Advance →"}
    </button>
  );
}

function RegressTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-panel-border bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-alert-red hover:text-alert-red"
    >
      ← Regress
    </button>
  );
}

function RegressSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-alert-red bg-deep-space px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-alert-red transition-colors hover:bg-alert-red hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Confirm regress"}
    </button>
  );
}

function ReasonsBanner({ reasons }: { reasons?: string[] }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <InlineBanner variant="error">
      <span className="block">Gate blocked:</span>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </InlineBanner>
  );
}

function MessageBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <InlineBanner variant="error">{message}</InlineBanner>;
}

export function StageActions({
  revisionId,
  currentStage,
  isFrozen,
}: {
  revisionId: string;
  currentStage: StageName;
  isFrozen: boolean;
}) {
  const [advanceState, advanceAction] = useActionState(
    advanceStageAction,
    initialState,
  );
  const [regressState, regressAction] = useActionState(
    regressStageAction,
    initialState,
  );

  const dialogRef = useRef<HTMLDialogElement>(null);

  if (isFrozen) {
    // No actions surface when frozen — the revision is locked except for
    // errata (design §5.4). Render a quiet read-only marker.
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        Revision frozen — no further transitions.
      </p>
    );
  }

  const canAdvance = currentStage !== "REVISION";
  const canRegress = currentStage !== "REQUIREMENTS";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {canRegress ? (
          <RegressTrigger onClick={() => dialogRef.current?.showModal()} />
        ) : null}
        {canAdvance ? (
          <form action={advanceAction}>
            <input type="hidden" name="revisionId" value={revisionId} />
            <AdvanceSubmit />
          </form>
        ) : null}
      </div>

      {/* Advance feedback — inline reasons / message. */}
      <ReasonsBanner reasons={advanceState.reasons} />
      <MessageBanner message={advanceState.message} />

      {/* Regress modal — native <dialog>; reason required. */}
      {canRegress ? (
        <dialog
          ref={dialogRef}
          className="rounded border border-panel-border bg-navy-dark p-0 text-link-muted backdrop:bg-deep-space/80"
        >
          <form
            action={regressAction}
            className="w-[min(90vw,32rem)] space-y-4 p-6"
          >
            <h3 className="font-display text-2xl tracking-wider text-white">
              REGRESS STAGE
            </h3>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Regressing from{" "}
              <span className="text-command-gold">{currentStage}</span>. The
              reason is written to the transitions log.
            </p>
            <input type="hidden" name="revisionId" value={revisionId} />
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Reason
              <textarea
                name="reason"
                required
                minLength={1}
                maxLength={2000}
                rows={4}
                placeholder="Why are we regressing?"
                className="mt-2 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
              />
            </label>
            {regressState.errors?.reason ? (
              <p className="font-mono text-xs font-bold text-alert-red">
                {regressState.errors.reason.join("; ")}
              </p>
            ) : null}
            <MessageBanner message={regressState.message} />
            <ReasonsBanner reasons={regressState.reasons} />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded border border-panel-border bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted hover:border-muted"
              >
                Cancel
              </button>
              <RegressSubmit />
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
