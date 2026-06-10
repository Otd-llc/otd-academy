// Loads the learner gate inputs for one enrollment: its proof artifacts +
// the Set of stages whose comprehension quiz it has passed. Far lighter than
// the author loadGateContext, and it leaves that loader (and its tests)
// untouched. Accepts the global client or a transaction client.
import type { Prisma, PrismaClient } from "@prisma/client";
import type { LearnerGateContext } from "@/lib/learner-gates";

type TxClient = PrismaClient | Prisma.TransactionClient;

export async function loadLearnerGateContext(
  tx: TxClient,
  enrollmentId: string,
): Promise<LearnerGateContext> {
  const [artifacts, quiz] = await Promise.all([
    tx.artifact.findMany({
      where: { enrollmentId },
      select: { subkind: true, valid: true },
    }),
    tx.quizPass.findMany({
      where: { enrollmentId },
      select: { stage: true },
    }),
  ]);
  return {
    enrollmentArtifacts: artifacts,
    quizPasses: new Set(quiz.map((q) => q.stage)),
  };
}
