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
const emptyImage: ContentBlock = { type: "image", src: "", alt: "todo" };

// A fully-vetted lesson: every stage has a quiz + a real image, no empty
// placeholders, no TODO.
function doneCards(): LessonCard[] {
  return STAGES.map((stage) => ({ stage, blocks: [quiz, image] }));
}

// The publishable-but-not-vetted shape: same as done but media is still a
// placeholder (empty src) — fine for free/SEO, not for premium.
function placeholderMediaCards(): LessonCard[] {
  return STAGES.map((stage) => ({ stage, blocks: [quiz, emptyImage] }));
}

describe("assessLessonReadiness — two-tier bar", () => {
  it("a complete lesson with real media + a brought-up board is VETTED", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: { questions: 18 },
      broughtUpBoards: 1,
      published: false,
    });
    expect(r.publishable).toBe(true);
    expect(r.vetted).toBe(true);
    // publish is informational, not gating either bar
    expect(r.checks.find((c) => c.label === "Published")?.ok).toBe(false);
  });

  it("placeholder media + no board is PUBLISHABLE but NOT vetted", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: placeholderMediaCards(),
      exam: { questions: 18 },
      broughtUpBoards: 0,
      published: false,
    });
    expect(r.publishable).toBe(true);
    expect(r.vetted).toBe(false);
  });

  it("real media but no brought-up board is NOT vetted", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: { questions: 18 },
      broughtUpBoards: 0,
      published: false,
    });
    expect(r.publishable).toBe(true);
    expect(r.vetted).toBe(false);
    expect(
      r.checks.find((c) => c.label === "At least one board brought up")?.ok,
    ).toBe(false);
  });

  it("a failing publishable check fails BOTH bars", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: [{ stage: "A", blocks: [quiz, image] }], // missing stage B
      exam: { questions: 18 },
      broughtUpBoards: 5,
      published: true,
    });
    expect(r.publishable).toBe(false);
    expect(r.vetted).toBe(false);
    expect(r.checks.find((c) => c.label === "All stage cards present")?.ok).toBe(
      false,
    );
  });

  it("flags a stage with no quiz (publishable-tier)", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: [
        { stage: "A", blocks: [quiz, image] },
        { stage: "B", blocks: [image] },
      ],
      exam: { questions: 18 },
      broughtUpBoards: 1,
      published: true,
    });
    expect(r.publishable).toBe(false);
    const quizCheck = r.checks.find(
      (c) => c.label === "Every stage has a quiz checkpoint",
    );
    expect(quizCheck?.ok).toBe(false);
    expect(quizCheck?.tier).toBe("publishable");
  });

  it("placeholder media is a VETTED-tier failure, not publishable", () => {
    const r = assessLessonReadiness({
      stages: STAGES,
      cards: placeholderMediaCards(),
      exam: { questions: 18 },
      broughtUpBoards: 1,
      published: true,
    });
    expect(r.publishable).toBe(true);
    expect(r.vetted).toBe(false);
    const mediaCheck = r.checks.find(
      (c) => c.label === "No empty media placeholders remain",
    );
    expect(mediaCheck?.ok).toBe(false);
    expect(mediaCheck?.tier).toBe("vetted");
  });

  it("flags leftover TODO authoring stubs (publishable-tier)", () => {
    const todoQuiz: ContentBlock = {
      type: "quiz",
      questions: [{ q: "TODO — write a check", options: ["a", "b"], answer: 0 }],
    };
    const r = assessLessonReadiness({
      stages: ["A"],
      cards: [{ stage: "A", blocks: [todoQuiz, image] }],
      exam: { questions: 18 },
      broughtUpBoards: 1,
      published: true,
    });
    expect(r.publishable).toBe(false);
    expect(
      r.checks.find((c) => c.label === "No TODO authoring stubs remain")?.ok,
    ).toBe(false);
  });

  it("flags a missing or too-small exam (publishable-tier)", () => {
    const small = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: { questions: 4 },
      broughtUpBoards: 1,
      published: true,
    });
    expect(small.publishable).toBe(false);
    const none = assessLessonReadiness({
      stages: STAGES,
      cards: doneCards(),
      exam: null,
      broughtUpBoards: 1,
      published: true,
    });
    expect(none.publishable).toBe(false);
  });
});
