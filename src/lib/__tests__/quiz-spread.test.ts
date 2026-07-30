// Answer-key positional spread. A bank whose correct option sits in the same slot
// most of the time isn't measuring comprehension — "always pick B" scores it.
//
// This is not hypothetical: measured on L1.01 (2026-07-29, all 49 questions) the
// spread was A=16, B=31, C=2. Option B was correct 63% of the time and option C
// 4%, against ~33% for a flat bank. `otd-content-writing` owns this rule for
// authoring; this module makes it machine-checkable so a re-author can't quietly
// reintroduce the bias.
import { describe, expect, test } from "vitest";
import {
  MAX_POSITION_SHARE,
  MIN_GUARDED_QUESTIONS,
  constantGuessYield,
  keySpread,
  spreadIsBalanced,
} from "@/lib/quiz-spread";

const q3 = (answer: number) => ({ answer, options: ["a", "b", "c"] });

describe("keySpread", () => {
  test("counts answer indices by position", () => {
    expect(keySpread([q3(0), q3(1), q3(1)])).toEqual([1, 2, 0]);
  });

  test("widens to the OPTION count, not the largest answer", () => {
    // Nothing here is keyed to slot C. Widening off max(answer) would return
    // [1, 2] — hiding the never-used slot, which is the exact bias this guard
    // exists to catch (L1.01 keyed only 2 of 49 to its last option).
    const spread = keySpread([q3(0), q3(1), q3(1)]);
    expect(spread).toHaveLength(3);
    expect(spread[2]).toBe(0);
  });

  test("handles a mixed bank by widening to the longest option list", () => {
    const mixed = [
      { answer: 0, options: ["a", "b"] },
      { answer: 3, options: ["a", "b", "c", "d"] },
    ];
    expect(keySpread(mixed)).toEqual([1, 0, 0, 1]);
  });

  test("an empty bank yields an empty spread", () => {
    expect(keySpread([])).toEqual([]);
  });
});

describe("spreadIsBalanced", () => {
  test("rejects the real L1.01 spread (31 of 49 on one position)", () => {
    expect(spreadIsBalanced([16, 31, 2], 49)).toBe(false);
  });

  test("accepts a near-uniform spread", () => {
    expect(spreadIsBalanced([16, 17, 16], 49)).toBe(true);
  });

  test("sits exactly on the cap without tripping", () => {
    // 45 of 100 is allowed; 46 is not. Pins the boundary so a refactor can't
    // quietly turn <= into <.
    expect(spreadIsBalanced([45, 30, 25], 100)).toBe(true);
    expect(spreadIsBalanced([46, 30, 24], 100)).toBe(false);
  });

  test("does not fire below the guarded minimum", () => {
    // 3 questions cannot satisfy a 45% cap at all (one slot must hold >= 34%),
    // so the guard would be unsatisfiable rather than useful on a tiny bank.
    expect(spreadIsBalanced([0, 3, 0], 3)).toBe(true);
    expect(MIN_GUARDED_QUESTIONS).toBeGreaterThan(3);
  });

  test("the threshold is a documented constant, not a magic number", () => {
    expect(MAX_POSITION_SHARE).toBe(0.45);
  });
});

describe("constantGuessYield", () => {
  // The per-lesson share cap can't apply to one stage's bank (4-9 questions, below
  // MIN_GUARDED_QUESTIONS). But a stage's quiz is what opens the stage, so the
  // property that matters there is: picking the same letter every time must not
  // reach the pass mark. That holds at any bank size.
  test("is the largest position's share", () => {
    expect(constantGuessYield([1, 4, 1], 6)).toBeCloseTo(4 / 6);
    expect(constantGuessYield([3, 3, 3], 9)).toBeCloseTo(1 / 3);
  });

  test("returns 1 when every answer is the same option", () => {
    expect(constantGuessYield([0, 5, 0], 5)).toBe(1);
  });

  test("returns 0 for an empty bank rather than dividing by zero", () => {
    expect(constantGuessYield([], 0)).toBe(0);
  });

  test("the real L1.01 per-stage worst case stays under an 80% pass mark", () => {
    // ORDERING after the re-key: keys 2,2,2,2,1,0 — the worst single-letter run in
    // the lesson. 4 of 6 is 67%, so even the best constant guess fails an 80% gate.
    expect(constantGuessYield([1, 1, 4], 6)).toBeCloseTo(4 / 6);
    expect(constantGuessYield([1, 1, 4], 6)).toBeLessThan(0.8);
  });
});
