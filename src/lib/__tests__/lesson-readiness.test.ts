import { describe, it, expect } from "vitest";
import {
  assessLessonReadiness,
  type LessonCard,
} from "@/lib/lesson-readiness";
import type { ContentBlock } from "@/lib/schemas/guide";

const STAGES = ["A", "B"] as const;

const quiz: ContentBlock = {
  type: "quiz",
  questions: [{ q: "Real question?", options: ["yes", "no"], answer: 0 }],
};
const image: ContentBlock = { type: "image", src: "/shot.png", alt: "shot" };

// A "done" lesson: every stage has a quiz + a real image, no TODO.
function doneCards(): LessonCard[] {
  return STAGES.map((stage) => ({ stage, blocks: [quiz, image] }));
}

describe("assessLessonReadiness", () => {
  it("a complete lesson with an exam is READY", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: { questions: 18 },
      published: false,
    });
    expect(r.ready).toBe(true);
    // publish is informational, not gating
    expect(r.checks.find((c) => c.label === "Published")?.ok).toBe(false);
  });

  it("flags a missing stage card", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: [{ stage: "A", blocks: [quiz, image] }],
      exam: { questions: 18 },
      published: true,
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.label === "All stage cards present")?.ok).toBe(
      false,
    );
  });

  it("flags a stage with no quiz", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: [
        { stage: "A", blocks: [quiz, image] },
        { stage: "B", blocks: [image] },
      ],
      exam: { questions: 18 },
      published: true,
    });
    expect(r.ready).toBe(false);
    expect(
      r.checks.find((c) => c.label === "Every stage has a quiz checkpoint")?.ok,
    ).toBe(false);
  });

  it("flags an empty-src image placeholder as not a real screenshot", () => {
    const r = assessLessonReadiness({
      stages: ["A"],
      cards: [{ stage: "A", blocks: [quiz, { type: "image", src: "", alt: "x" }] }],
      exam: { questions: 18 },
      published: true,
    });
    expect(
      r.checks.find((c) => c.label === "Every stage has a screenshot/diagram")
        ?.ok,
    ).toBe(false);
  });

  it("flags leftover TODO authoring stubs", () => {
    const todoQuiz: ContentBlock = {
      type: "quiz",
      questions: [
        { q: "TODO — write a check", options: ["a", "b"], answer: 0 },
      ],
    };
    const r = assessLessonReadiness({
      stages: ["A"],
      cards: [{ stage: "A", blocks: [todoQuiz, image] }],
      exam: { questions: 18 },
      published: true,
    });
    expect(r.ready).toBe(false);
    expect(
      r.checks.find((c) => c.label === "No TODO authoring stubs remain")?.ok,
    ).toBe(false);
  });

  it("flags a missing or too-small exam", () => {
    const small = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: { questions: 4 },
      published: true,
    });
    expect(small.ready).toBe(false);
    const none = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: null,
      published: true,
    });
    expect(none.ready).toBe(false);
  });
});
