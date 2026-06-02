// Revision-scoped Checklists pane (m15 / Task 15.6).
//
// Server component — mirrors BuildChecklistsPane / BoardChecklistsPane but
// for the Revision XOR Build XOR Board owner's third arm. Renders one row
// per revision-scoped checklist with the canonical subkind pill, stage tag,
// and completion ratio, plus the inline ChecklistEditor for items.
//
// Subkind allow-list: GENERIC is universal; the canonical review subkinds
// REQUIREMENTS_REVIEW + LAYOUT_REVIEW land in m16. Until then only GENERIC
// is offered to the picker — additional subkinds will be appended here when
// they ship so the dialog stays the source-of-truth for valid choices.
//
// Visibility (per proposal §3 #3): only the early-design stages —
// REQUIREMENTS, SCHEMATIC, BOM_SOURCING, LAYOUT — render the pane; past
// LAYOUT, revision-scoped checklists make no design sense and the page
// hides the pane entirely.
import type {
  Checklist,
  ChecklistItem,
  ChecklistSubkind,
  Stage,
} from "@prisma/client";
import { ChecklistEditor } from "./ChecklistEditor";
import { NewChecklistDialog } from "./NewChecklistDialog";
import { MaterializeReviewButton } from "./MaterializeReviewButton";

// m16: REQUIREMENTS_REVIEW + LAYOUT_REVIEW are now picker-creatable for
// revision-scoped checklists. The canonical materialize action populates the
// item set in one click (see MaterializeReviewButton below), but the picker
// still exposes the bare subkinds so users can hand-roll a review checklist
// if they want to.
// m17: STRIPBOARD_VALIDATION joins the picker too — only meaningful when
// `project.requiresStripboard === true`, but the picker stays the
// source-of-truth for valid revision-scoped subkinds.
const REVISION_SUBKINDS: ChecklistSubkind[] = [
  "GENERIC",
  "REQUIREMENTS_REVIEW",
  "LAYOUT_REVIEW",
  "STRIPBOARD_VALIDATION",
];

const REVISION_CHECKLIST_VISIBLE_STAGES: ReadonlySet<Stage> = new Set([
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
]);

export function isRevisionChecklistVisibleAtStage(stage: Stage): boolean {
  return REVISION_CHECKLIST_VISIBLE_STAGES.has(stage);
}

export type RevisionChecklistInput = Checklist & {
  items: ChecklistItem[];
};

function checklistSubkindPillClasses(_subkind: ChecklistSubkind): string {
  // No revision-scoped subkind is gate-relevant in m15 (review subkinds
  // arrive in m16). Use the muted pill for all rows for now.
  return "inline-block rounded border border-panel-border bg-navy-dark px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-link-muted";
}

export function RevisionChecklistsPane({
  revisionId,
  checklists,
  stage,
  requiresStripboard,
  disabled,
  disabledReason,
}: {
  revisionId: string;
  checklists: RevisionChecklistInput[];
  stage: Stage;
  /** m17: project-level flag — gates the STRIPBOARD_VALIDATION materialize
   *  button (also gated on stage === "BOM_SOURCING"). */
  requiresStripboard?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  // m16: stage-keyed canonical materialize affordances. Only one button can
  // show at a time (REQUIREMENTS at REQUIREMENTS / LAYOUT at LAYOUT) and we
  // hide it once a checklist of the matching subkind already exists, so
  // double-materialize is avoided in the UI as well as the action layer.
  // m17: STRIPBOARD_VALIDATION joins the same pattern but is additionally
  // gated on `requiresStripboard === true` so non-stripboard projects never
  // see the button.
  const hasReqReview = checklists.some(
    (c) => c.subkind === "REQUIREMENTS_REVIEW",
  );
  const hasLayoutReview = checklists.some(
    (c) => c.subkind === "LAYOUT_REVIEW",
  );
  const hasStripboardValidation = checklists.some(
    (c) => c.subkind === "STRIPBOARD_VALIDATION",
  );
  const showMaterializeRequirements =
    !disabled && stage === "REQUIREMENTS" && !hasReqReview;
  const showMaterializeLayout =
    !disabled && stage === "LAYOUT" && !hasLayoutReview;
  const showMaterializeStripboard =
    !disabled &&
    stage === "BOM_SOURCING" &&
    requiresStripboard === true &&
    !hasStripboardValidation;

  return (
    <section className="border border-panel-border bg-navy-dark p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-wider text-white">
          REVISION CHECKLISTS
        </h2>
        <NewChecklistDialog
          ownerKind="revision"
          ownerId={revisionId}
          stage={stage}
          allowedSubkinds={REVISION_SUBKINDS}
          disabled={disabled}
          disabledReason={disabledReason}
        />
      </div>

      {showMaterializeRequirements ||
      showMaterializeLayout ||
      showMaterializeStripboard ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            Materialize canonical:
          </span>
          {showMaterializeRequirements ? (
            <MaterializeReviewButton
              revisionId={revisionId}
              templateKey="REQUIREMENTS_REVIEW"
              label="REQUIREMENTS_REVIEW"
            />
          ) : null}
          {showMaterializeLayout ? (
            <MaterializeReviewButton
              revisionId={revisionId}
              templateKey="LAYOUT_REVIEW"
              label="LAYOUT_REVIEW"
            />
          ) : null}
          {showMaterializeStripboard ? (
            <MaterializeReviewButton
              revisionId={revisionId}
              templateKey="STRIPBOARD_VALIDATION"
              label="STRIPBOARD_VALIDATION"
            />
          ) : null}
        </div>
      ) : null}

      {checklists.length === 0 ? (
        <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
          NO REVISION-SCOPED CHECKLISTS.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-panel-border">
          {checklists.map((c) => {
            const total = c.items.length;
            const resolved = c.items.filter(
              (i) => i.checked || i.notApplicable,
            ).length;
            const pct =
              total === 0 ? 0 : Math.round((resolved / total) * 100);
            return (
              <li key={c.id} className="space-y-3 py-4 font-mono text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base text-white">{c.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={checklistSubkindPillClasses(c.subkind)}>
                        {c.subkind}
                      </span>
                      <span className="font-mono text-xs uppercase tracking-wider text-muted">
                        {c.stage}
                      </span>
                      <span className="font-mono text-xs uppercase tracking-wider text-muted">
                        {resolved}/{total} · {pct}%
                      </span>
                    </div>
                  </div>
                </div>
                <ChecklistEditor
                  checklistId={c.id}
                  items={c.items.map((i) => ({
                    id: i.id,
                    ordinal: i.ordinal,
                    label: i.label,
                    expectedValue: i.expectedValue,
                    actualValue: i.actualValue,
                    checked: i.checked,
                    notApplicable: i.notApplicable,
                  }))}
                  disabled={disabled}
                  disabledReason={disabledReason}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
