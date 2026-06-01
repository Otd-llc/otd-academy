// Inbound-edge advisory for revision regress (proposal §3.1, Task 12.7).
//
// Inverse direction of `checkProjectDependencies` (Task 12.5). Given a
// project whose latest revision is being regressed `fromStage → toStage`,
// return the inbound edges (where this project is the `dependsOnProject`)
// that were being satisfied at `fromStage` but won't be at `toStage`.
//
// Filter: `fromIdx >= requiredIdx && toIdx < requiredIdx`. Forward moves
// short-circuit to `[]`. The caller surfaces these as an advisory in the
// regress UI (Task 12.8) — this helper does not mutate.

import type { Prisma, PrismaClient, Stage } from "@prisma/client";
import { STAGE_ORDER } from "@/lib/stages";

type TxClient = PrismaClient | Prisma.TransactionClient;

function stageIndex(s: Stage): number {
  return STAGE_ORDER.indexOf(s);
}

export async function dependentsAtRisk(
  tx: TxClient,
  projectId: string,
  fromStage: Stage,
  toStage: Stage,
) {
  const fromIdx = stageIndex(fromStage);
  const toIdx = stageIndex(toStage);
  if (toIdx >= fromIdx) return [];

  const edges = await tx.projectDependency.findMany({
    where: { dependsOnProjectId: projectId },
    include: {
      dependentProject: { select: { slug: true, name: true } },
    },
  });

  return edges.filter((e) => {
    const requiredIdx = stageIndex(e.dependsOnStageRequired);
    return fromIdx >= requiredIdx && toIdx < requiredIdx;
  });
}
