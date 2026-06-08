// resolveGuideProgress — the 8 guide-stage completion states for a revision, in
// pipeline order (REQUIREMENTS → BRINGUP). Backs the GuideStepper "order of
// operations" rail on the guide hub + card pages.
//
// Thin orchestration over `resolveCardCompletion` (already the single source of
// truth for a card's done/total/state): for each GUIDE_STAGES entry it looks up
// the guide card's completionRef and resolves the live state. A missing card
// (shouldn't happen post-materialize) degrades to a `none` ref. Pure-ish READ
// helper (imports `db`); callable from an RSC, NOT a "use server" action.

import { db } from "@/lib/db";
import {
  GUIDE_STAGES,
  type GuideStage,
} from "@/lib/guide-templates/stage-skeletons";
import {
  resolveCardCompletion,
  type CompletionState,
} from "@/lib/guide-completion";
import { completionRefSchema, type CompletionRef } from "@/lib/schemas/guide";

export interface GuideStageStatus {
  stage: GuideStage;
  /** 0-based position in GUIDE_STAGES (REQUIREMENTS = 0 … BRINGUP = 7). */
  ordinal: number;
  state: CompletionState;
}

function parseRef(value: unknown): CompletionRef {
  if (value == null) return { kind: "none" };
  const r = completionRefSchema.safeParse(value);
  return r.success ? r.data : { kind: "none" };
}

export async function resolveGuideProgress(
  revisionId: string,
  guideId: string,
  boardId?: string,
): Promise<GuideStageStatus[]> {
  const cards = await db.guideCard.findMany({
    where: { guideId },
    select: { stage: true, completionRef: true },
  });
  const byStage = new Map(cards.map((c) => [c.stage, c]));

  return Promise.all(
    GUIDE_STAGES.map(async (stage, ordinal): Promise<GuideStageStatus> => {
      const card = byStage.get(stage);
      const completion = await resolveCardCompletion({
        revisionId,
        stage,
        completionRef: parseRef(card?.completionRef),
        boardId,
      });
      return { stage, ordinal, state: completion.state };
    }),
  );
}

// Learner-scoped progress: a learner's OWN journey through the pipeline, derived
// from their `Enrollment.currentStage` — NOT the shared reference revision's
// author completion (resolveGuideProgress). Because a learner cannot advance a
// stage without passing its gate, every stage before the current one is
// complete, the current stage is in-progress (partial), and the rest are
// untouched. `null` (not enrolled) → all untouched; a currentStage past the last
// guide stage (REVISION / COMPLETED) → all complete. Pure — no DB, no `await`.
export function resolveLearnerGuideProgress(
  currentStage: string | null,
): GuideStageStatus[] {
  if (!currentStage) {
    return GUIDE_STAGES.map((stage, ordinal) => ({
      stage,
      ordinal,
      state: "untouched" as CompletionState,
    }));
  }
  const ci = GUIDE_STAGES.indexOf(currentStage as GuideStage);
  return GUIDE_STAGES.map((stage, ordinal) => {
    const state: CompletionState =
      ci === -1 || ordinal < ci
        ? "complete"
        : ordinal === ci
          ? "partial"
          : "untouched";
    return { stage, ordinal, state };
  });
}
