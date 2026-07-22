import { describe, it, expect } from "vitest";
import {
  quizQuestions,
  lessonQuestionKeys,
  guideQuestionKeys,
} from "@/lib/logbook/lesson-content";

const blocks = [
  { type: "prose", md: "intro" },
  {
    type: "quiz",
    questions: [
      { id: "a", q: "Question a?", options: ["x", "y"], answer: 0 },
      { q: "Question b?", options: ["x", "y"], answer: 1 },
    ],
  },
];

describe("quizQuestions", () => {
  it("flattens quiz questions and degrades to [] on a bad shape", () => {
    expect(quizQuestions(blocks)).toHaveLength(2);
    expect(quizQuestions({ nope: true })).toEqual([]);
  });

  it("keeps the quiz even when a SIBLING block is malformed (per-block parse)", () => {
    // A bad `prose` (missing `md`) sits before the quiz. The old all-or-nothing
    // parse returned [] and silently killed the gate + per-pick XP; per-block
    // parse keeps the quiz's questions.
    const withBadSibling = [{ type: "prose" }, ...blocks];
    expect(quizQuestions(withBadSibling)).toHaveLength(2);
  });
});

describe("lessonQuestionKeys", () => {
  it("keys under the plain lesson slug", () => {
    const keys = lessonQuestionKeys("ohms-law", blocks);
    expect(keys[0]).toBe("ohms-law#a");
    expect(keys[1]).toMatch(/^ohms-law#h[0-9a-f]{8}$/);
  });
});

describe("guideQuestionKeys", () => {
  it("keys under the guide-scoped slug", () => {
    const keys = guideQuestionKeys("l1-01", "v1", "SCHEMATIC", blocks);
    expect(keys[0]).toBe("guide:l1-01:v1:SCHEMATIC#a");
    expect(keys[1]).toMatch(/^guide:l1-01:v1:SCHEMATIC#h[0-9a-f]{8}$/);
  });
});
