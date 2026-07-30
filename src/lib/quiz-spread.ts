// Answer-key positional spread for a multiple-choice bank.
//
// A bank whose correct option sits in the same slot most of the time is not
// measuring comprehension — "always pick B" scores it. Measured on L1.01
// (2026-07-29, all 49 questions) the spread was A=16, B=31, C=2: option B was
// correct 63% of the time and option C 4%, against ~33% for a flat bank. That
// matters more, not less, once a gate scores the learner's FIRST pick, because
// then positional luck converts directly into a pass.
//
// The `otd-content-writing` skill owns answer-key spread as an authoring rule.
// This module exists so the rule is machine-checkable and a re-author cannot
// quietly reintroduce the bias.
//
// PURE: no DB / IO.

/** A question, as far as spread is concerned. */
export interface SpreadQuestion {
  answer: number;
  options: readonly unknown[];
}

/**
 * Correct-option counts by position, widened to the longest OPTION list in the
 * bank — NOT to the largest `answer`.
 *
 * Widening off `answer` would hide the very bias this guard exists to catch: a
 * bank that never keys to its last slot would return a short array and read as
 * balanced. L1.01 keyed only 2 of 49 questions to option C, and that is exactly
 * the shape a learner exploits.
 */
export function keySpread(questions: readonly SpreadQuestion[]): number[] {
  const width = questions.reduce((w, q) => Math.max(w, q.options.length), 0);
  const out = new Array<number>(width).fill(0);
  for (const q of questions) {
    if (q.answer >= 0 && q.answer < width) out[q.answer]! += 1;
  }
  return out;
}

/** No single position may hold more than this share of a bank's correct answers. */
export const MAX_POSITION_SHARE = 0.45;

/**
 * Below this many questions the cap is arithmetically unsatisfiable (with 3
 * questions some slot must hold at least a third), so the guard would fail
 * every small bank instead of telling anyone anything.
 */
export const MIN_GUARDED_QUESTIONS = 10;

/** True when no position holds more than `MAX_POSITION_SHARE` of the keys. */
export function spreadIsBalanced(
  spread: readonly number[],
  total: number,
): boolean {
  if (total < MIN_GUARDED_QUESTIONS) return true;
  return spread.every((n) => n / total <= MAX_POSITION_SHARE);
}

/**
 * The best score a learner gets by ignoring the questions and picking the same
 * option every time, as a share of the bank.
 *
 * This is the check that maps to how a gate is actually scored. `spreadIsBalanced`
 * is a per-LESSON hygiene rule and cannot apply to a single stage's bank, because a
 * stage carries 4-9 questions — below `MIN_GUARDED_QUESTIONS`, where a share cap is
 * arithmetically unsatisfiable. But a stage's quiz is what opens the stage, so the
 * property worth guarding there is narrower and holds at any size: a constant guess
 * must not reach the pass mark.
 */
export function constantGuessYield(spread: readonly number[], total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, ...spread) / total;
}
