// Learner exit-gate predicate (design §4). SEPARATE from the author path: the
// author gates check signals a learner can't produce (commits, build/board
// state, design-review checklists). The learner gate is lightweight — a
// per-enrollment proof artifact at the 3 design stages, ANDed with the stage's
// comprehension quiz. Pure function over LearnerGateContext (no DB access).
import type { Artifact, ArtifactSubkind, Stage } from "@prisma/client";
import type { GateResult } from "@/lib/stages";

export const QUIZ_NOT_PASSED_MSG =
  "Comprehension check not passed yet — pass the quiz on this stage's guide card.";

// A per-enrollment proof artifact is required only once the learner is producing
// real CAD: SCHEMATIC and LAYOUT. Everything before (REQUIREMENTS, BOM_SOURCING)
// is comprehension — quiz-only — and the deep fab chain after stays the shared
// reference. Each entry here MUST have matching how-to help in learner-proof-help.
const LEARNER_PROOF: Partial<Record<Stage, ArtifactSubkind>> = {
  SCHEMATIC: "SCHEMATIC_FILE",
  LAYOUT: "LAYOUT_FILE",
};

const PROOF_LABEL: Record<string, string> = {
  SCHEMATIC_FILE: "schematic",
  LAYOUT_FILE: "layout file",
};

export interface LearnerGateContext {
  enrollmentArtifacts: Pick<Artifact, "subkind">[];
  quizPasses: Set<Stage>;
}

/** The proof-artifact subkind a stage requires of a learner, or undefined when
 *  the stage is quiz-only. */
export function learnerProofSubkind(stage: Stage): ArtifactSubkind | undefined {
  return LEARNER_PROOF[stage];
}

export function learnerExitGate(
  stage: Stage,
  ctx: LearnerGateContext,
): GateResult {
  const reasons: string[] = [];
  const proof = LEARNER_PROOF[stage];
  if (proof && !ctx.enrollmentArtifacts.some((a) => a.subkind === proof)) {
    reasons.push(`Upload your ${PROOF_LABEL[proof]} on this stage to advance.`);
  }
  if (!ctx.quizPasses.has(stage)) reasons.push(QUIZ_NOT_PASSED_MSG);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
