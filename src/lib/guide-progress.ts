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
