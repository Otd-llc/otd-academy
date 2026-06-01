// One-hop project dependency gate (proposal §3.1, Task 12.5).
//
// Given a project and its current stage, walk the direct outbound edges
// where the gate would be active (`currentStage >= dependentStageGated`)
// and verify each dependency's most-recent revision sits at or beyond
// `dependsOnStageRequired`. Returns merged `reasons[]` on failure.
//
// One-hop only: we do NOT walk transitively. If B depends on C, B's own
// gate will surface that when B tries to advance — the lazy-catch policy
// keeps this helper cheap and predictable.
//
// Wired into `advanceStage` in Task 12.6 alongside the existing
// `STAGES[stage].exitGate(ctx)`; reasons from both are unioned.

import type { Prisma, PrismaClient, Stage } from "@prisma/client";
import { STAGE_ORDER, type GateResult } from "@/lib/stages";

type TxClient = PrismaClient | Prisma.TransactionClient;

function stageIndex(s: Stage): number {
  return STAGE_ORDER.indexOf(s);
}

export async function checkProjectDependencies(
  tx: TxClient,
  projectId: string,
  currentStage: Stage,
): Promise<GateResult> {
  const edges = await tx.projectDependency.findMany({
    where: { dependentProjectId: projectId },
    include: {
      dependsOnProject: {
        select: {
          id: true,
          slug: true,
          revisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { currentStage: true, label: true },
          },
        },
      },
    },
  });

  const reasons: string[] = [];
  for (const edge of edges) {
    if (stageIndex(currentStage) < stageIndex(edge.dependentStageGated)) {
      continue;
    }
    const depRev = edge.dependsOnProject.revisions[0];
    if (!depRev) {
      reasons.push(
        `Depends on ${edge.dependsOnProject.slug} at ${edge.dependsOnStageRequired}; it has no revisions.`,
      );
      continue;
    }
    if (
      stageIndex(depRev.currentStage) < stageIndex(edge.dependsOnStageRequired)
    ) {
      reasons.push(
        `Depends on ${edge.dependsOnProject.slug} at ${edge.dependsOnStageRequired}; latest revision is at ${depRev.currentStage}.`,
      );
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
