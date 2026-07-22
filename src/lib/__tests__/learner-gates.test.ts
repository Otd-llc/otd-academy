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

describe("learnerExitGate — quiz-less card (cardHasQuiz: false)", () => {
  // A stage card that ships WITHOUT a quiz block must not strand the learner
  // behind an unproducible QuizPass: the gate UI already says "coming soon" for
  // a quiz-less card, so the gate itself treats the quiz as auto-satisfied.
  test("quiz requirement auto-satisfies when the card has no quiz", () => {
    const r = learnerExitGate("REQUIREMENTS", ctx({ cardHasQuiz: false }));
    expect(r.ok).toBe(true);
  });

  test("artifact requirement still applies on a quiz-less SCHEMATIC card", () => {
    const r = learnerExitGate("SCHEMATIC", ctx({ cardHasQuiz: false }));
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons).toHaveLength(1);
    expect((r as { reasons: string[] }).reasons[0]).toMatch(/ERC report/);
  });

  test("cardHasQuiz undefined keeps the quiz required (back-compat)", () => {
    const r = learnerExitGate("REQUIREMENTS", ctx());
    expect(r.ok).toBe(false);
  });
});

describe("learnerExitGate — non-fab course (hasFabOutputs: false)", () => {
  // Seam for a future course whose build produces no ERC/DRC artifacts (module
  // integration, firmware-only). No catalog course flips this yet; the seam
  // exists so the first one cannot strand learners at SCHEMATIC/DRC_GERBER.
  test("SCHEMATIC needs only the quiz when the course has no fab outputs", () => {
    const r = learnerExitGate("SCHEMATIC", {
      ...ctx({ quizPasses: new Set<Stage>(["SCHEMATIC"]) }),
      hasFabOutputs: false,
    });
    expect(r.ok).toBe(true);
  });

  test("DRC_GERBER artifact skipped when the course has no fab outputs", () => {
    const r = learnerExitGate("DRC_GERBER", {
      ...ctx(),
      hasFabOutputs: false,
    });
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

  test("blocked when quiz not passed (passing proof present)", () => {
    const r = learnerExitGate(
      "SCHEMATIC",
      ctx({ enrollmentArtifacts: [{ subkind: "ERC_REPORT", valid: true }] }),
    );
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons).toContain(QUIZ_NOT_PASSED_MSG);
  });

  test("blocked when the ERC report is present but did NOT pass (valid: false)", () => {
    const r = learnerExitGate(
      "SCHEMATIC",
      ctx({
        enrollmentArtifacts: [{ subkind: "ERC_REPORT", valid: false }],
        quizPasses: new Set<Stage>(["SCHEMATIC"]),
      }),
    );
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons.some((x) => /ERC/i.test(x))).toBe(
      true,
    );
  });

  test("ok when a PASSING ERC report and the quiz pass are present", () => {
    const r = learnerExitGate(
      "SCHEMATIC",
      ctx({
        enrollmentArtifacts: [{ subkind: "ERC_REPORT", valid: true }],
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
