// Tests for THE gate-quiz selection. This logic used to live inline in
// recordQuizPass, and Phase 1 of the exit-criteria plan adds three more callers
// (the first-pick recorder, the pass scorer, the review-snapshot refresher) — so
// the selection rule is pinned here before anything else depends on it.
//
// The rule: the block flagged `gate: true`, else the FIRST quiz block. That
// fallback is load-bearing back-compat — no authored lesson sets the flag yet, so
// today every card gates on its only quiz block.
import { describe, expect, test } from "vitest";
import {
  allQuizQuestions,
  gateQuizBlock,
  gateQuizQuestions,
} from "@/lib/gate-quiz";

const q = (id: string) => ({
  id,
  q: `Question ${id}?`,
  options: ["a", "b", "c"],
  answer: 1,
});

const quiz = (ids: string[], gate?: boolean) => ({
  type: "quiz",
  ...(gate === undefined ? {} : { gate }),
  questions: ids.map(q),
});

const prose = { type: "prose", md: "words" };

describe("gateQuizBlock", () => {
  test("a single unflagged quiz block IS the gate (back-compat fallback)", () => {
    const blocks = [prose, quiz(["one", "two"])];
    expect(gateQuizBlock(blocks)?.questions.map((x) => x.id)).toEqual([
      "one",
      "two",
    ]);
  });

  test("a flagged block wins over an earlier unflagged one", () => {
    const blocks = [quiz(["mini"]), quiz(["real"], true)];
    expect(gateQuizBlock(blocks)?.questions.map((x) => x.id)).toEqual(["real"]);
  });

  test("with no flag anywhere, the FIRST quiz block wins", () => {
    const blocks = [quiz(["first"]), quiz(["second"])];
    expect(gateQuizBlock(blocks)?.questions.map((x) => x.id)).toEqual(["first"]);
  });

  test("gate: false is not a flag — it falls back to first", () => {
    const blocks = [quiz(["first"], false), quiz(["second"], false)];
    expect(gateQuizBlock(blocks)?.questions.map((x) => x.id)).toEqual(["first"]);
  });

  test("a card with no quiz block returns null", () => {
    expect(gateQuizBlock([prose])).toBeNull();
  });

  test("non-array / null contentBlocks returns null rather than throwing", () => {
    expect(gateQuizBlock(null)).toBeNull();
    expect(gateQuizBlock(undefined)).toBeNull();
    expect(gateQuizBlock("not blocks")).toBeNull();
  });
});

describe("resilience to a malformed sibling", () => {
  // The whole reason parseGuideBlocks exists: one bad block must not blank the
  // card, and MUST NOT take the stage gate down with it.
  test("a malformed sibling does not remove the gate quiz", () => {
    const blocks = [{ type: "callout" /* missing required fields */ }, quiz(["ok"])];
    expect(gateQuizBlock(blocks)?.questions.map((x) => x.id)).toEqual(["ok"]);
  });

  test("a malformed FIRST quiz block does not become the gate", () => {
    // answer indexes past options → fails the schema refine, so it never renders
    // for the learner and must not gate them either.
    const broken = {
      type: "quiz",
      questions: [{ id: "broken", q: "Q?", options: ["a", "b"], answer: 5 }],
    };
    const blocks = [broken, quiz(["renderable"])];
    expect(gateQuizBlock(blocks)?.questions.map((x) => x.id)).toEqual([
      "renderable",
    ]);
  });
});

describe("gateQuizQuestions vs allQuizQuestions", () => {
  const blocks = [quiz(["mini-a", "mini-b"]), quiz(["gate-a"], true)];

  test("gateQuizQuestions returns ONLY the gate block's questions", () => {
    expect(gateQuizQuestions(blocks).map((x) => x.id)).toEqual(["gate-a"]);
  });

  test("allQuizQuestions spans every quiz block, in order", () => {
    expect(allQuizQuestions(blocks).map((x) => x.id)).toEqual([
      "mini-a",
      "mini-b",
      "gate-a",
    ]);
  });

  test("both return [] for a quiz-less card", () => {
    expect(gateQuizQuestions([prose])).toEqual([]);
    expect(allQuizQuestions([prose])).toEqual([]);
  });
});
