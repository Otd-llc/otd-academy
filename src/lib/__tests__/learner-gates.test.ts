// Unit tests for the learner exit-gate predicate (pure function, no DB).
// The learner path is SEPARATE from the author path: it checks per-enrollment
// proof artifacts (at the 3 design stages) ANDed with the stage's quiz pass.
import { describe, expect, test } from "vitest";
import type { Stage } from "@prisma/client";
import {
  learnerExitGate,
  learnerProofSubkind,
  QUIZ_NOT_PASSED_MSG,
  type LearnerGateContext,
} from "@/lib/learner-gates";

function ctx(over: Partial<LearnerGateContext> = {}): LearnerGateContext {
  return {
    enrollmentArtifacts: [],
    quizPasses: new Set<Stage>(),
    ...over,
  };
}

describe("learnerExitGate — REQUIREMENTS (quiz-only, no proof artifact)", () => {
  // There is no artifact requirement until the SCHEMATIC stage: REQUIREMENTS is
  // pure comprehension, gated only by its quiz.
  test("requires no proof subkind", () => {
    expect(learnerProofSubkind("REQUIREMENTS")).toBeUndefined();
  });

  test("ok with just the quiz pass (no proof artifact required)", () => {
    const r = learnerExitGate(
      "REQUIREMENTS",
      ctx({ quizPasses: new Set<Stage>(["REQUIREMENTS"]) }),
    );
    expect(r.ok).toBe(true);
  });

  test("blocked only on the quiz when not passed", () => {
    const r = learnerExitGate("REQUIREMENTS", ctx());
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons).toEqual([QUIZ_NOT_PASSED_MSG]);
  });
});

describe("learnerExitGate — SCHEMATIC (proof + quiz)", () => {
  test("requires a clean ERC report as the proof artifact", () => {
    expect(learnerProofSubkind("SCHEMATIC")).toBe("ERC_REPORT");
  });

  test("blocked when no ERC_REPORT proof artifact (quiz passed)", () => {
    const r = learnerExitGate(
      "SCHEMATIC",
      ctx({ quizPasses: new Set<Stage>(["SCHEMATIC"]) }),
    );
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons.some((x) => /ERC/i.test(x))).toBe(true);
  });

  test("blocked when quiz not passed (proof present)", () => {
    const r = learnerExitGate(
      "SCHEMATIC",
      ctx({ enrollmentArtifacts: [{ subkind: "ERC_REPORT" }] }),
    );
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons).toContain(QUIZ_NOT_PASSED_MSG);
  });

  test("ok when both the ERC report and quiz pass are present", () => {
    const r = learnerExitGate(
      "SCHEMATIC",
      ctx({
        enrollmentArtifacts: [{ subkind: "ERC_REPORT" }],
        quizPasses: new Set<Stage>(["SCHEMATIC"]),
      }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("learnerExitGate — ORDERING (quiz-only, no proof artifact)", () => {
  test("ok with just the quiz pass (no proof artifact required)", () => {
    const r = learnerExitGate(
      "ORDERING",
      ctx({ quizPasses: new Set<Stage>(["ORDERING"]) }),
    );
    expect(r.ok).toBe(true);
  });

  test("blocked only on the quiz when not passed", () => {
    const r = learnerExitGate("ORDERING", ctx());
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons).toEqual([QUIZ_NOT_PASSED_MSG]);
  });
});
