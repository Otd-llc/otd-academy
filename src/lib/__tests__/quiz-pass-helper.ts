// Test helper: satisfy the soft quiz-gate for a revision.
//
// The stage exit gate ANDs `quizPasses.has(stage)` (stages.ts), so any
// integration test that drives a revision through a gate (advanceStage, the
// e2e gate walks, the dual-source completion checks) now needs the stage's
// quiz passed. These tests exercise the WORK-gate, not the quiz, so they call
// this to mark every stage's quiz passed up front. QuizPass rows cascade with
// the revision on cleanup, so there's nothing extra to tear down.

import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";

const ALL_GATED_STAGES: Stage[] = [
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
];

export async function passAllQuizzes(revisionId: string): Promise<void> {
  await db.quizPass.createMany({
    data: ALL_GATED_STAGES.map((stage) => ({
      revisionId,
      stage,
      score: 1,
      total: 1,
    })),
    skipDuplicates: true,
  });
}
