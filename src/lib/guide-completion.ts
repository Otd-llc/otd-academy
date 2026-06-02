// Task 6.1 — completion adapters: resolve a guide card's `completionRef`
// (+ stage) to the LIVE completion state for the uniform stage-gate footer.
//
// Returns `{ state, done, total, href? }` where:
//   - `done`/`total`/`href` come from the card's `completionRef` — it selects
//     WHICH actionable widget to render (the primary affordance) and drives the
//     "✓ done / N remaining" numbers + the deep link.
//   - `state.complete` is the AUTHORITATIVE-DONE verdict: for any stage that has
//     a real exit gate (`src/lib/stages.ts`), `complete` is computed from that
//     stage's ACTUAL gate predicate — NOT from `completionRef` alone. This is
//     what keeps the guide footer from ever saying "done" while the real gate
//     is still closed, and it is the whole point of the dual-source stages:
//       · BRINGUP   — boardStatus ref, but the gate ALSO needs BRINGUP_LOG +
//                     BRINGUP_COMPLETE artifacts.
//       · SCHEMATIC — artifact SCHEMATIC_FILE ref, but the gate ALSO needs
//                     `schematicCommit`.
//       · ASSEMBLY  — buildChecklist ref (boardMeasurements is a secondary
//                     affordance); the build-checklist gate defines done.
//
// This is a pure-ish READ helper (imports `db` directly, callable from an RSC);
// it is intentionally NOT a "use server" action.
//
// Reuse: `loadGateContext` (src/lib/load-gate-context.ts) loads the same
// substrate the gates consume; the per-stage gate evaluator is
// `STAGES[stage].exitGate(ctx)`. The one subtlety is that `loadGateContext`
// filters revision-scoped artifacts to the revision's `currentStage`, so when a
// card's stage ≠ `currentStage` we re-load that stage's revision artifacts and
// splice them into a stage-aligned context before evaluating the gate.

import type { Artifact, Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { loadGateContext } from "@/lib/load-gate-context";
import { STAGES, type GateContext } from "@/lib/stages";
import type { CompletionRef } from "@/lib/schemas/guide";

export type CompletionState = "complete" | "partial" | "untouched" | "blocked";

export interface CardCompletion {
  state: CompletionState;
  done: number;
  total: number;
  href?: string;
}

export interface ResolveCardCompletionInput {
  revisionId: string;
  /**
   * Card stage — REQUIRED. Drives the authoritative `complete` verdict via the
   * real stage gate. Every `GuideCard` always carries a non-null stage (it's a
   * non-null DB column and every skeleton supplies one), so making this required
   * structurally enforces the authoritative-done contract: there is no code path
   * that can report `complete` from the completionRef alone, bypassing the gate.
   */
  stage: Stage;
  /** Optional explicit board scope for board-scoped refs. */
  boardId?: string;
  completionRef: CompletionRef;
}

/** The active unfrozen Build for a revision (`build_one_unfrozen_per_revision`
 *  keeps this at most one), with the relations the adapters read. */
export async function resolveActiveBuild(revisionId: string) {
  return db.build.findFirst({
    where: { revisionId, frozenAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      boards: true,
      artifacts: true,
      checklists: { include: { items: true } },
    },
  });
}

type ActiveBuild = NonNullable<Awaited<ReturnType<typeof resolveActiveBuild>>>;

/** Boards of a build, ordered by serial (stable matrix order). */
export async function listBoards(buildId: string) {
  return db.board.findMany({
    where: { buildId },
    orderBy: { serial: "asc" },
  });
}

// ─── Gate evaluation (authoritative "complete") ────────────

/**
 * Evaluate the REAL exit gate for `stage` against a stage-aligned context.
 * Returns `null` when the stage has no gate (e.g. REVISION) — callers then
 * fall back to the completionRef-derived doneness.
 */
async function evaluateStageGate(
  revisionId: string,
  stage: Stage,
): Promise<boolean | null> {
  const def = STAGES[stage];
  if (!def.exitGate) return null;

  const base = await loadGateContext(db, revisionId);

  // `loadGateContext` filtered revision-scoped artifacts to the revision's
  // `currentStage`. The gates that inspect revision artifacts match on
  // `a.stage === <this stage>` (REQUIREMENTS/SCHEMATIC/LAYOUT) or on
  // `a.subkind` (DRC_GERBER). To evaluate the gate AS IF the revision sat at
  // the card's stage, realign: re-load revision artifacts at the card stage
  // and pin `currentStage` to it. Build-scoped artifacts (ORDERING/ASSEMBLY/
  // BRINGUP) ride on `activeBuild.artifacts`, which is already unfiltered.
  let artifacts = base.artifacts;
  if (stage !== base.revision.currentStage) {
    artifacts = await db.artifact.findMany({ where: { revisionId, stage } });
  }

  const ctx: GateContext = {
    ...base,
    revision: { ...base.revision, currentStage: stage },
    artifacts,
  };

  const result = await def.exitGate(ctx);
  return result.ok;
}

// ─── completionRef → done / total / href + scope-blocked ───

interface WidgetState {
  done: number;
  total: number;
  href?: string;
  /** True when the ref's required build/board scope is absent. */
  blocked: boolean;
  /** For checklist refs: the checklist row exists (materialized). */
  exists: boolean;
}

async function resolveWidget(
  input: ResolveCardCompletionInput,
  activeBuild: ActiveBuild | null,
): Promise<WidgetState> {
  const { revisionId, completionRef, boardId } = input;

  switch (completionRef.kind) {
    case "revisionChecklist": {
      const checklist = await db.checklist.findFirst({
        where: { revisionId, subkind: completionRef.subkind },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      });
      if (!checklist) {
        // Never materialized — surface a "materialize" affordance.
        return {
          done: 0,
          total: 0,
          href: `?materialize=${completionRef.subkind}`,
          blocked: false,
          exists: false,
        };
      }
      const done = checklist.items.filter(
        (i) => i.checked || i.notApplicable,
      ).length;
      return {
        done,
        total: checklist.items.length,
        blocked: false,
        exists: true,
      };
    }

    case "buildChecklist": {
      if (!activeBuild) {
        return { done: 0, total: 0, blocked: true, exists: false };
      }
      const checklist = activeBuild.checklists.find(
        (c) => c.subkind === completionRef.subkind,
      );
      if (!checklist) {
        return {
          done: 0,
          total: 0,
          href: `?materialize=${completionRef.subkind}`,
          blocked: false,
          exists: false,
        };
      }
      const done = checklist.items.filter(
        (i) => i.checked || i.notApplicable,
      ).length;
      return {
        done,
        total: checklist.items.length,
        blocked: false,
        exists: true,
      };
    }

    case "boardMeasurements": {
      // A board is required: explicit boardId, else (for a single-board build)
      // the active build's sole board. No board scope ⇒ blocked.
      let resolvedBoardId = boardId ?? null;
      if (!resolvedBoardId && activeBuild) {
        if (activeBuild.boards.length === 1) {
          resolvedBoardId = activeBuild.boards[0]!.id;
        }
      }
      if (!resolvedBoardId) {
        return {
          done: 0,
          total: completionRef.steps.length,
          blocked: true,
          exists: false,
        };
      }
      const measured = await db.measurement.findMany({
        where: { boardId: resolvedBoardId, step: { in: completionRef.steps } },
        select: { step: true },
      });
      const coveredSteps = new Set(measured.map((m) => m.step));
      const done = completionRef.steps.filter((s) => coveredSteps.has(s)).length;
      return {
        done,
        total: completionRef.steps.length,
        blocked: false,
        exists: true,
      };
    }

    case "artifact": {
      // Presence of any artifact with one of the subkinds, on the revision OR
      // the active build (artifacts are owner-XOR). done = subkinds present.
      const buildArtifacts: Artifact[] = activeBuild?.artifacts ?? [];
      const revArtifacts = await db.artifact.findMany({
        where: { revisionId, subkind: { in: completionRef.subkinds } },
        select: { subkind: true },
      });
      const present = new Set<string>();
      for (const a of revArtifacts) present.add(a.subkind);
      for (const a of buildArtifacts) {
        if (completionRef.subkinds.includes(a.subkind)) present.add(a.subkind);
      }
      const done = completionRef.subkinds.filter((s) =>
        present.has(s),
      ).length;
      return {
        done,
        total: completionRef.subkinds.length,
        blocked: false,
        exists: done > 0,
      };
    }

    case "commit": {
      const rev = await db.revision.findUniqueOrThrow({
        where: { id: revisionId },
        select: { schematicCommit: true, layoutCommit: true },
      });
      const present = rev[completionRef.field] != null;
      return {
        done: present ? 1 : 0,
        total: 1,
        blocked: false,
        exists: present,
      };
    }

    case "boardStatus": {
      if (!activeBuild) {
        return { done: 0, total: 0, blocked: true, exists: false };
      }
      if (activeBuild.boards.length === 0) {
        // Build exists but no boards registered — same "blocked" state the
        // ASSEMBLY/BRINGUP gates enumerate.
        return { done: 0, total: 0, blocked: true, exists: false };
      }
      const allowed = new Set<string>(completionRef.statuses);
      // QUARANTINED always passes the roster as "done" (schema note: removed
      // from build but counts as resolved).
      allowed.add("QUARANTINED");
      const done = activeBuild.boards.filter((b) =>
        allowed.has(b.status),
      ).length;
      return {
        done,
        total: activeBuild.boards.length,
        blocked: false,
        exists: done > 0,
      };
    }

    case "none":
      return { done: 0, total: 0, blocked: false, exists: true };
  }
}

// ─── Public API ────────────────────────────────────────────

export async function resolveCardCompletion(
  input: ResolveCardCompletionInput,
): Promise<CardCompletion> {
  const activeBuild = await resolveActiveBuild(input.revisionId);
  const widget = await resolveWidget(input, activeBuild);

  // Scope absent (no build / no boards for a build-or-board-scoped ref) is
  // terminal: report "blocked" regardless of the gate.
  if (widget.blocked) {
    return {
      state: "blocked",
      done: widget.done,
      total: widget.total,
      href: widget.href,
    };
  }

  // AUTHORITATIVE-DONE: the `complete` verdict ALWAYS comes from the real stage
  // gate (`STAGES[stage].exitGate(ctx).ok`) — never from `completionRef` alone.
  // `stage` is required, so there is no ref-only shortcut to `complete`.
  //
  // No-gate guard: if a stage genuinely has no `exitGate` defined in STAGES
  // (`evaluateStageGate` returns null — e.g. the terminal REVISION stage; all 8
  // guide stages currently define one), we CANNOT assert authoritative done. We
  // must not fake `complete` from the ref, so we leave `complete === false` and
  // let the partial/untouched logic below cap the state at `partial` (when the
  // widget shows progress/substrate) or `untouched`/`blocked` per scope.
  const gate = await evaluateStageGate(input.revisionId, input.stage);
  const complete = gate === true;

  let state: CompletionState;
  if (complete) {
    state = "complete";
  } else if (widget.done > 0 || widget.exists) {
    // Touched: progress made, or the actionable substrate (e.g. a materialized
    // checklist) exists even at 0 checked.
    state = "partial";
  } else {
    state = "untouched";
  }

  return { state, done: widget.done, total: widget.total, href: widget.href };
}
