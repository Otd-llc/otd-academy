// The single load behind BOTH stage-quiz code paths (audit Phase 8): the
// exit-gate scorer (actions/quiz.ts) and the per-pick XP scorer
// (guide-awards.ts) each independently loaded the SAME enrollment → revision →
// card shape + ownership check. Two copies of one select drift silently — a
// column added to one, a where-clause fixed in one — and the gate then scores
// against different card data than the XP. One loader, one shape.
//
// NOTE: the two callers still PARSE differently on purpose — the gate needs the
// single gate quiz block, the XP scorer needs every quiz question flattened —
// so this returns the raw card + identity, not a parsed quiz.
import type { Prisma, PrismaClient, Stage } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

export type StageCardLoad = {
  /** True iff the enrollment exists AND belongs to `userId`. */
  owned: boolean;
  projectSlug: string;
  revLabel: string;
  /** Raw contentBlocks for this stage's card, or null when there is no card. */
  contentBlocks: unknown | null;
};

/**
 * Load one enrollment's stage card + the ownership fact. Returns owned:false
 * (with empty fields) when the enrollment is missing or belongs to someone
 * else — callers must refuse in that case.
 */
export async function loadStageCard(
  db: TxClient,
  enrollmentId: string,
  stage: Stage,
  userId: string,
): Promise<StageCardLoad> {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      userId: true,
      project: { select: { slug: true } },
      revision: {
        select: {
          label: true,
          guide: {
            select: {
              cards: { where: { stage }, select: { contentBlocks: true } },
            },
          },
        },
      },
    },
  });
  if (!enrollment || enrollment.userId !== userId) {
    return { owned: false, projectSlug: "", revLabel: "", contentBlocks: null };
  }
  return {
    owned: true,
    projectSlug: enrollment.project.slug,
    revLabel: enrollment.revision.label,
    contentBlocks: enrollment.revision.guide?.cards[0]?.contentBlocks ?? null,
  };
}
