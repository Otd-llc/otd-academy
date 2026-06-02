// Build the StageGate `widget` payload from a card's completionRef + the
// revision/build/board context (M9 / Task 9.1+9.2 glue).
//
// This is the render-side counterpart to `resolveCardCompletion`: that helper
// computes the AUTHORITATIVE done/total/state; this one resolves the LIVE
// substrate the footer's actionable widget needs (the checklist row + items,
// the selected board + its captured steps, or the read-only present/absent
// detail + deep link). Both read the same DB shapes; kept separate so the
// completion verdict stays pure and the widget stays presentation-shaped.
//
// Pure-ish READ helper (imports `db` directly, callable from an RSC); NOT a
// "use server" action.

import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import type { CompletionRef } from "@/lib/schemas/guide";
import type { ChecklistItemRow } from "@/components/ChecklistEditor";
import type { StageGateWidget } from "@/components/guide/StageGate";
import {
  resolveActiveBuild,
  type CardCompletion,
} from "@/lib/guide-completion";

export interface BuildWidgetInput {
  revisionId: string;
  stage: Stage;
  completionRef: CompletionRef;
  /** Slug + canonical (url-encoded-safe) labels for deep-link construction. */
  slug: string;
  revLabel: string;
  /** Selected board (ASSEMBLY/BRINGUP per-board scope). */
  boardId?: string;
  /** Whether the owning revision is frozen (disables the inline editors). */
  frozen: boolean;
  /** Pre-resolved completion (carries done/total for the read-only detail). */
  completion: CardCompletion;
}

function toItemRows(
  items: {
    id: string;
    ordinal: number;
    label: string;
    expectedValue: string | null;
    actualValue: string | null;
    checked: boolean;
    notApplicable: boolean;
  }[],
): ChecklistItemRow[] {
  return items.map((i) => ({
    id: i.id,
    ordinal: i.ordinal,
    label: i.label,
    expectedValue: i.expectedValue,
    actualValue: i.actualValue,
    checked: i.checked,
    notApplicable: i.notApplicable,
  }));
}

export async function buildStageGateWidget(
  input: BuildWidgetInput,
): Promise<StageGateWidget> {
  const { completionRef, revisionId, slug, revLabel, frozen, completion } =
    input;
  const revPath = `/projects/${slug}/${encodeURIComponent(revLabel)}`;
  const disabledReason = frozen ? "Revision is frozen." : undefined;

  switch (completionRef.kind) {
    case "revisionChecklist": {
      const checklist = await db.checklist.findFirst({
        where: { revisionId, subkind: completionRef.subkind },
        include: { items: { orderBy: { ordinal: "asc" } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        kind: "revisionChecklist",
        checklist: checklist
          ? { id: checklist.id, items: toItemRows(checklist.items) }
          : null,
        owner: { scope: "revision", revisionId },
        subkind: completionRef.subkind,
        disabled: frozen,
        disabledReason,
      };
    }

    case "buildChecklist": {
      const activeBuild = await resolveActiveBuild(revisionId);
      const checklist = activeBuild?.checklists.find(
        (c) => c.subkind === completionRef.subkind,
      );
      return {
        kind: "buildChecklist",
        checklist: checklist
          ? { id: checklist.id, items: toItemRows(checklist.items) }
          : null,
        owner: activeBuild
          ? { scope: "build", buildId: activeBuild.id }
          : null,
        subkind: completionRef.subkind,
        disabled: frozen,
        disabledReason,
      };
    }

    case "boardMeasurements": {
      const activeBuild = await resolveActiveBuild(revisionId);
      // Resolve the board: explicit boardId (validated to belong to the active
      // build), else the sole board of a single-board build.
      let board: { id: string; serial: string } | null = null;
      if (activeBuild) {
        if (input.boardId) {
          const found = activeBuild.boards.find((b) => b.id === input.boardId);
          if (found) board = { id: found.id, serial: found.serial };
        } else if (activeBuild.boards.length === 1) {
          const sole = activeBuild.boards[0]!;
          board = { id: sole.id, serial: sole.serial };
        }
      }
      let capturedSteps: string[] = [];
      if (board) {
        const measured = await db.measurement.findMany({
          where: { boardId: board.id, step: { in: completionRef.steps } },
          select: { step: true },
        });
        capturedSteps = measured.map((m) => m.step);
      }
      return {
        kind: "boardMeasurements",
        board,
        stage: input.stage,
        steps: completionRef.steps,
        capturedSteps,
        disabled: frozen,
        disabledReason,
      };
    }

    case "artifact": {
      const detail =
        completion.done >= completion.total
          ? `All required artifacts present (${completionRef.subkinds.join(", ")}).`
          : `${completion.done} of ${completion.total} required artifacts present (${completionRef.subkinds.join(", ")}).`;
      return {
        kind: "artifact",
        href: revPath,
        hrefLabel: "Open the artifacts pane",
        detail,
      };
    }

    case "commit": {
      const present = completion.done > 0;
      return {
        kind: "commit",
        href: revPath,
        hrefLabel: "Open the revision detail",
        detail: present
          ? `${completionRef.field} is recorded.`
          : `${completionRef.field} is not yet recorded.`,
      };
    }

    case "boardStatus": {
      const detail =
        completion.total === 0
          ? "No boards registered on the active build yet."
          : `${completion.done} of ${completion.total} boards in ${completionRef.statuses.join("/")}.`;
      return {
        kind: "boardStatus",
        href: revPath,
        hrefLabel: "Open the build / boards pane",
        detail,
      };
    }

    case "none":
      return { kind: "none" };
  }
}
