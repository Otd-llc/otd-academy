// THE gate quiz on a guide card: the block flagged `gate: true`, else the first
// quiz block (back-compat — no authored lesson sets the flag yet, so every card
// today gates on its only quiz block).
//
// WHY THIS IS ITS OWN MODULE. This selection lived inline in `recordQuizPass`, and
// more callers are arriving: the first-pick recorder, the pass scorer, and the
// review-snapshot refresher all have to agree on which block opens the stage. That
// class of drift — the same rule re-implemented per call site — is what silently
// hid the SCHEMATIC ERC upload for a release (see the docblock on gate-spec.ts,
// which exists for the same reason). One home, one rule.
//
// Per-block parse (parseGuideBlocks), NOT a whole-array parse: a malformed sibling
// block must not blank the card, and it must not take the gate quiz down with it
// either — that would strand the learner behind an unpassable gate.
//
// PURE: no DB, React, env, or network.
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { ContentBlock } from "@/lib/schemas/guide";

export type QuizContentBlock = Extract<ContentBlock, { type: "quiz" }>;
export type GateQuizQuestion = QuizContentBlock["questions"][number];

function quizBlocks(contentBlocks: unknown): QuizContentBlock[] {
  return parseGuideBlocks(contentBlocks).blocks.filter(
    (b): b is QuizContentBlock => b.type === "quiz",
  );
}

/**
 * The block whose pass records the QuizPass the stage exit-gate reads, or null
 * when the card carries no renderable quiz.
 *
 * Note `gate: false` is treated the same as absent: the flag marks the gate, it
 * does not veto the fallback. A card whose only quiz is `gate: false` still gates
 * on it — otherwise that one keystroke would silently make the stage passable with
 * no comprehension check at all.
 */
export function gateQuizBlock(contentBlocks: unknown): QuizContentBlock | null {
  const qs = quizBlocks(contentBlocks);
  return qs.find((b) => b.gate === true) ?? qs[0] ?? null;
}

/** Questions of THE gate quiz only — what the stage gate is scored from. */
export function gateQuizQuestions(contentBlocks: unknown): GateQuizQuestion[] {
  return gateQuizBlock(contentBlocks)?.questions ?? [];
}

/**
 * Questions of EVERY quiz block, gate and practice mini-quizzes alike.
 *
 * Deliberately distinct from `gateQuizQuestions`: the XP ledger and the
 * spaced-review registry span all blocks, while only the gate block opens the
 * stage. Conflating the two is precisely how a practice mini-quiz would silently
 * become the thing a learner must pass to advance.
 */
export function allQuizQuestions(contentBlocks: unknown): GateQuizQuestion[] {
  return quizBlocks(contentBlocks).flatMap((b) => b.questions);
}
