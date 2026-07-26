// src/lib/__tests__/review-verdict.test.ts
//
// Pins the /review deck's verdict rule. The bug this guards against: pick() set
// the picked option and awaited the server, but the failure branch was silent —
// no else, no try/catch. `recordReviewAnswer` has three non-success exits
// ({ok:false,needsAuth:true} when the session is gone, a Zod throw, and {ok:false}
// when there is no schedule), and all three left answerDisplay null while the
// card already counted as answered. The derivation was
// `answered && pickedDisplay === answerDisplay`, so null read as false and the
// learner was told "Not quite" — announced through role="status" as authoritative
// feedback — for an answer that may well have been right. No XP, no SRS advance,
// and firedRef blocked a retry. This is the one surface whose entire job is
// telling someone whether they were right.
import { describe, test, expect } from "vitest";
import { isGraded, reviewVerdict } from "@/lib/review-verdict";

describe("reviewVerdict", () => {
  test("no pick yet is unanswered", () => {
    expect(reviewVerdict(null, null)).toBe("unanswered");
    expect(reviewVerdict(null, 2)).toBe("unanswered");
  });

  test("grades against the server's answer once it arrives", () => {
    expect(reviewVerdict(1, 1)).toBe("correct");
    expect(reviewVerdict(0, 3)).toBe("wrong");
  });

  test("index 0 grades normally on both sides (no falsy-zero confusion)", () => {
    expect(reviewVerdict(0, 0)).toBe("correct");
    expect(reviewVerdict(0, 1)).toBe("wrong");
    expect(reviewVerdict(1, 0)).toBe("wrong");
  });

  // The regression guard.
  test("a pick with no answer from the server is awaiting, NEVER wrong", () => {
    for (const picked of [0, 1, 2, 3]) {
      expect(reviewVerdict(picked, null)).toBe("awaiting");
      expect(reviewVerdict(picked, null)).not.toBe("wrong");
    }
  });
});

describe("isGraded", () => {
  test("only a real grade counts — the UI keys its verdict on this", () => {
    expect(isGraded("correct")).toBe(true);
    expect(isGraded("wrong")).toBe(true);
    expect(isGraded("awaiting")).toBe(false);
    expect(isGraded("unanswered")).toBe(false);
  });

  test("an ungraded pick is not renderable as a verdict", () => {
    expect(isGraded(reviewVerdict(2, null))).toBe(false);
  });
});
