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
// Regress UX is now inline — click Regress to expand a glass-card panel
// in-place with an OPTIONAL reason field + dependents-at-risk advisory +
// Confirm / Cancel. No <dialog> modal. The reason defaults to
// "Manual rollback" on the server side when blank so the audit trail still
// records something; the user can override with anything more specific.

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  advanceStageAction,
  previewRegress,
  regressStageAction,
  type StageFormState,
} from "@/lib/actions/stages";
import type { StageName } from "@/lib/stages";
import { InlineBanner } from "@/components/InlineBanner";
import {
  RegressAtRiskBanner,
  type RegressAtRiskEntry,
} from "@/components/RegressAtRiskBanner";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

const initialState: StageFormState = {};

function AdvanceSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="glass-button glass-button-cta inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
    >
      {pending ? (
        "WORKING…"
      ) : (
        <>
          Advance
          <ChevronRightIcon className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

function RegressSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="glass-button glass-button-danger px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
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

  const [confirming, setConfirming] = useState(false);
  const [atRisk, setAtRisk] = useState<RegressAtRiskEntry[]>([]);

  // When the user opens the inline regress panel, fetch the
  // dependents-at-risk preview so the advisory banner can show the
  // downstream impact alongside the reason input.
  useEffect(() => {
    if (!confirming) return;
    let cancelled = false;
    (async () => {
      try {
        const { atRisk: next } = await previewRegress({ revisionId });
        if (!cancelled) setAtRisk(next);
      } catch {
        if (!cancelled) setAtRisk([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirming, revisionId]);

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
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            className="glass-button glass-button-danger inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Regress
          </button>
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

      {/* Inline regress confirm panel — replaces the previous <dialog>
          modal. Expands in-place under the action row when the user
          clicks Regress; collapses when they confirm or cancel. */}
      {canRegress && confirming ? (
        <form
          action={(formData) => {
            // Wrap the action so we collapse the panel optimistically once
            // submission starts; the useActionState reducer still surfaces
            // errors afterwards if the server rejects.
            setConfirming(false);
            return regressAction(formData);
          }}
          className="glass-card space-y-3 p-4"
        >
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-gold-dim">
            Regress from{" "}
            <span className="text-command-gold">{currentStage}</span>
          </h3>
          <input type="hidden" name="revisionId" value={revisionId} />
          <RegressAtRiskBanner atRisk={atRisk} />
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Reason (optional)
            <textarea
              name="reason"
              maxLength={2000}
              rows={2}
              placeholder='Leave blank for "Manual rollback"'
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
              onClick={() => setConfirming(false)}
              className="glass-button px-4 py-2 font-mono text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
            <RegressSubmit />
          </div>
        </form>
      ) : null}
    </div>
  );
}
