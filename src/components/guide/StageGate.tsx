// Stage-gate footer — the uniform per-card completion affordance (M9 / Task 9.1).
//
// SERVER COMPONENT. The card route (an RSC) resolves the card's live
// completion substrate (the checklist row + items, the board roster, the
// deep-link target) and feeds it here as the `widget` prop; StageGate composes
// the presentation + the client leaves (ChecklistEditor / AddMeasurementForm /
// GenerateChecklistButton) without itself needing any client state. Server
// components can render client components as children, so no "use client"
// boundary is needed at this level.
//
// Two parts, fixed order:
//   1. A uniform STATUS LINE driven by the `resolveCardCompletion` result:
//        complete  → "✓ Complete"               (sub-count SUPPRESSED — review
//                     UX note: never show "✓ Complete" alongside "1/2")
//        partial   → "N of M done"
//        blocked   → "Blocked — needs a build / boards"
//        untouched → "Not started"
//   2. The ACTIONABLE WIDGET selected by `completionRef.kind`:
//        revisionChecklist / buildChecklist → <ChecklistEditor> if materialized,
//                     else a <GenerateChecklistButton> (canonical subkinds) or a
//                     plain "not materialized" note (non-canonical).
//        boardMeasurements → <AddMeasurementForm> for the selected board + the
//                     captured/remaining step tally.
//        artifact / commit / boardStatus → read-only present/absent state with a
//                     deep link to where the learner satisfies it.
//        none → no widget (pure teaching card).
//
// The `completion.state` is AUTHORITATIVE (gate-driven, see guide-completion.ts);
// the widget is purely the affordance to move that state forward.

import type { Stage } from "@prisma/client";
import type { CardCompletion } from "@/lib/guide-completion";
import type { ChecklistItemRow } from "@/components/ChecklistEditor";
import { GuideChecklistEditor } from "@/components/guide/GuideChecklistEditor";
import { GuideMeasurementForm } from "@/components/guide/GuideMeasurementForm";
import { GenerateChecklistButton } from "@/components/guide/GenerateChecklistButton";

// Canonical checklist subkinds that have a one-click materialize template.
// (Mirrors `canonicalTemplateKeySchema` in schemas/canonical-checklist.ts.)
const CANONICAL_REVISION_SUBKINDS = new Set([
  "REQUIREMENTS_REVIEW",
  "LAYOUT_REVIEW",
  "STRIPBOARD_VALIDATION",
]);

// ─── Resolved live data the RSC page passes down per kind ───
//
// A discriminated union mirroring `CompletionRef.kind`. The page resolves only
// the slice the card actually needs (so e.g. an artifact card carries just an
// href + label, never a checklist).

export type StageGateWidget =
  | {
      kind: "revisionChecklist" | "buildChecklist";
      /** The materialized checklist, or null when it hasn't been created yet. */
      checklist: { id: string; items: ChecklistItemRow[] } | null;
      /** Owner context for the "Generate checklist" affordance when absent. */
      owner:
        | { scope: "revision"; revisionId: string }
        | { scope: "build"; buildId: string }
        | null;
      subkind: string;
      disabled?: boolean;
      disabledReason?: string;
    }
  | {
      kind: "boardMeasurements";
      /** The selected board, or null when no board scope is resolvable. */
      board: { id: string; serial: string } | null;
      stage: Stage;
      steps: string[];
      /** Steps already captured for the selected board. */
      capturedSteps: string[];
      disabled?: boolean;
      disabledReason?: string;
    }
  | {
      kind: "artifact" | "commit" | "boardStatus";
      /** Where the learner goes to satisfy this gate. */
      href?: string;
      hrefLabel: string;
      /** Short read-only description of what's present/absent. */
      detail: string;
    }
  | { kind: "none" };

function StatusLine({ completion }: { completion: CardCompletion }) {
  let text: string;
  let toneClass: string;

  switch (completion.state) {
    case "complete":
      // Review UX note: SUPPRESS the sub-count so a dual-source stage never
      // reads "✓ Complete" alongside "1/2".
      text = "✓ Complete";
      toneClass = "text-status-green border-status-green";
      break;
    case "partial":
      text = `${completion.done} of ${completion.total} done`;
      toneClass = "text-command-gold border-command-gold";
      break;
    case "blocked":
      text = "Blocked — needs a build / boards";
      toneClass = "text-alert-red border-alert-red";
      break;
    case "untouched":
    default:
      text = "Not started";
      toneClass = "text-muted border-panel-border";
      break;
  }

  return (
    <span
      className={`inline-flex items-center rounded border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${toneClass}`}
    >
      {text}
    </span>
  );
}

function ChecklistWidget({
  widget,
}: {
  widget: Extract<
    StageGateWidget,
    { kind: "revisionChecklist" | "buildChecklist" }
  >;
}) {
  if (widget.checklist) {
    return (
      <GuideChecklistEditor
        checklistId={widget.checklist.id}
        items={widget.checklist.items}
        disabled={widget.disabled}
        disabledReason={widget.disabledReason}
      />
    );
  }

  // Not materialized yet. Offer a one-click "Generate" button for canonical
  // subkinds; otherwise explain that there's nothing to materialize here.
  const isBuildScoped = widget.kind === "buildChecklist";
  const canMaterialize = isBuildScoped
    ? widget.subkind === "POST_ASSEMBLY_CONTINUITY"
    : CANONICAL_REVISION_SUBKINDS.has(widget.subkind);

  if (widget.disabled) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        {widget.disabledReason ?? "Checklist not yet available."}
      </p>
    );
  }

  if (canMaterialize && widget.owner) {
    if (widget.owner.scope === "revision") {
      return (
        <GenerateChecklistButton
          scope="revision"
          revisionId={widget.owner.revisionId}
          templateKey={
            widget.subkind as
              | "REQUIREMENTS_REVIEW"
              | "LAYOUT_REVIEW"
              | "STRIPBOARD_VALIDATION"
          }
        />
      );
    }
    return (
      <GenerateChecklistButton
        scope="build"
        buildId={widget.owner.buildId}
        templateKey="POST_ASSEMBLY_CONTINUITY"
      />
    );
  }

  return (
    <p className="font-mono text-xs uppercase tracking-wider text-muted">
      {isBuildScoped && !widget.owner
        ? "Blocked — no active build to attach this checklist to."
        : `No canonical ${widget.subkind} template — create the checklist on the owning pane.`}
    </p>
  );
}

function MeasurementsWidget({
  widget,
}: {
  widget: Extract<StageGateWidget, { kind: "boardMeasurements" }>;
}) {
  if (!widget.board) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        Select a board above to capture measurements.
      </p>
    );
  }

  const captured = new Set(widget.capturedSteps);
  const remaining = widget.steps.filter((s) => !captured.has(s));

  return (
    <div className="space-y-4">
      <div className="font-mono text-xs uppercase tracking-wider text-muted">
        <p>
          Board <span className="text-command-gold">{widget.board.serial}</span>{" "}
          · {captured.size}/{widget.steps.length} steps captured
        </p>
        {remaining.length > 0 ? (
          <p className="mt-1">
            Remaining:{" "}
            <span className="text-link-muted">{remaining.join(", ")}</span>
          </p>
        ) : (
          <p className="mt-1 text-status-green">All steps captured.</p>
        )}
      </div>
      <GuideMeasurementForm
        boardId={widget.board.id}
        defaultStage={widget.stage}
        disabled={widget.disabled}
        disabledReason={widget.disabledReason}
      />
    </div>
  );
}

function ReadOnlyWidget({
  widget,
}: {
  widget: Extract<
    StageGateWidget,
    { kind: "artifact" | "commit" | "boardStatus" }
  >;
}) {
  return (
    <div className="space-y-2 font-mono text-sm">
      <p className="text-link-muted">{widget.detail}</p>
      {widget.href ? (
        <a
          href={widget.href}
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-signal-blue underline-offset-4 hover:underline"
        >
          {widget.hrefLabel} →
        </a>
      ) : null}
    </div>
  );
}

export function StageGate({
  completion,
  widget,
}: {
  completion: CardCompletion;
  widget: StageGateWidget;
}) {
  return (
    <section className="mt-10 border-t border-panel-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-wider text-white">
          STAGE GATE
        </h2>
        <StatusLine completion={completion} />
      </div>

      <div className="mt-6">
        {widget.kind === "revisionChecklist" ||
        widget.kind === "buildChecklist" ? (
          <ChecklistWidget widget={widget} />
        ) : widget.kind === "boardMeasurements" ? (
          <MeasurementsWidget widget={widget} />
        ) : widget.kind === "artifact" ||
          widget.kind === "commit" ||
          widget.kind === "boardStatus" ? (
          <ReadOnlyWidget widget={widget} />
        ) : null}
      </div>
    </section>
  );
}
