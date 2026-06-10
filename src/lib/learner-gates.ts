// Learner exit-gate predicate (design §4). SEPARATE from the author path: the
// author gates check signals a learner can't produce (commits, build/board
// state, design-review checklists). The learner gate is lightweight — a
// per-enrollment proof artifact at the 3 design stages, ANDed with the stage's
// comprehension quiz. Pure function over LearnerGateContext (no DB access).
import type { Artifact, ArtifactSubkind, Stage } from "@prisma/client";
import type { GateResult } from "@/lib/stages";
import { gateSpec } from "@/lib/gate-spec";

export const QUIZ_NOT_PASSED_MSG =
  "Comprehension check not passed yet — pass the quiz on this stage's guide card.";

export interface LearnerGateContext {
  enrollmentArtifacts: Pick<Artifact, "subkind">[];
  quizPasses: Set<Stage>;
}

/** The proof-artifact subkind a stage requires of a learner, or undefined when
 *  the stage is quiz-only. Delegates to the single gate spec (gate-spec.ts). */
export function learnerProofSubkind(stage: Stage): ArtifactSubkind | undefined {
  return gateSpec(stage).artifact?.subkind;
}

export function learnerExitGate(
  stage: Stage,
  ctx: LearnerGateContext,
): GateResult {
  const reasons: string[] = [];
  const spec = gateSpec(stage);
  if (
    spec.artifact &&
    !ctx.enrollmentArtifacts.some((a) => a.subkind === spec.artifact!.subkind)
  ) {
    reasons.push(`Upload your ${spec.artifact.label} on this stage to advance.`);
  }
  if (spec.quiz && !ctx.quizPasses.has(stage)) {
    reasons.push(QUIZ_NOT_PASSED_MSG);
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
