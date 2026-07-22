// Loads the learner gate inputs for one enrollment: its proof artifacts +
// the Set of stages whose comprehension quiz it has passed — and, when a stage
// is supplied, whether that stage's card on the enrollment's OWN revision
// (the guide the learner actually follows) carries a renderable quiz block.
// That input lets a quiz-less card auto-satisfy the quiz gate instead of
// stranding the learner behind an unproducible QuizPass (the gate UI already
// says "coming soon" for those). Far lighter than the author loadGateContext,
// and it leaves that loader (and its tests) untouched. Accepts the global
// client or a transaction client.
import type { Prisma, PrismaClient, Stage } from "@prisma/client";
import type { LearnerGateContext } from "@/lib/learner-gates";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";

type TxClient = PrismaClient | Prisma.TransactionClient;

export async function loadLearnerGateContext(
  tx: TxClient,
  enrollmentId: string,
  stage?: Stage,
): Promise<LearnerGateContext> {
  const [artifacts, quiz, card] = await Promise.all([
    tx.artifact.findMany({
      where: { enrollmentId },
      select: { subkind: true, valid: true },
    }),
    tx.quizPass.findMany({
      where: { enrollmentId },
      select: { stage: true },
    }),
    stage
      ? tx.guideCard.findFirst({
          where: {
            stage,
            guide: {
              revision: { enrollments: { some: { id: enrollmentId } } },
            },
          },
          select: { contentBlocks: true },
        })
      : Promise.resolve(null),
  ]);

  // Server-derived, never client-supplied. Only RENDERABLE quiz blocks count
  // (per-block parse): a malformed quiz block doesn't render for the learner,
  // so it must not gate them either. A missing card (or no stage supplied)
  // leaves cardHasQuiz undefined -> quiz stays required (safe default).
  const cardHasQuiz = card
    ? parseGuideBlocks(card.contentBlocks).blocks.some((b) => b.type === "quiz")
    : undefined;

  return {
    enrollmentArtifacts: artifacts,
    quizPasses: new Set(quiz.map((q) => q.stage)),
    cardHasQuiz,
  };
}
