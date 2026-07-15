import { describe, it, expect } from "vitest";
import { deriveLessonMeta } from "@/lib/library/derived";

// Blocks must satisfy guideContentBlocksSchema or quizQuestions() safe-parses to
// [] and the test passes for the WRONG reason. Real shapes (src/lib/schemas/guide.ts):
//   prose -> { md }            (NOT `body`)
//   image -> { src, alt }      (alt is required)
//   quiz  -> { questions: [{ q, options[2..6], answer }] }
const prose400 = { type: "prose", md: "word ".repeat(400).trim() };
const heroImage = { type: "image", src: "/guide-diagrams/foo.svg", alt: "a diagram" };
const quiz2 = {
  type: "quiz",
  questions: [
    { q: "First question?", options: ["a", "b"], answer: 0 },
    { q: "Second question?", options: ["a", "b", "c"], answer: 2 },
  ],
};

describe("deriveLessonMeta", () => {
  it("derives all three scalars from contentBlocks", () => {
    // 400 words at WORDS_PER_MINUTE=200 -> 2 min.
    expect(deriveLessonMeta([prose400, heroImage, quiz2])).toEqual({
      readingMinutes: 2,
      questionCount: 2,
      diagramSrc: "/guide-diagrams/foo.svg",
    });
  });

  it("is defensive over non-array Json (Prisma Json is unknown at runtime)", () => {
    // readingMinutes floors at 1 so nothing ever reads "0 min".
    const empty = { readingMinutes: 1, questionCount: 0, diagramSrc: null };
    expect(deriveLessonMeta(null)).toEqual(empty);
    expect(deriveLessonMeta(undefined)).toEqual(empty);
    expect(deriveLessonMeta([])).toEqual(empty);
    expect(deriveLessonMeta("garbage")).toEqual(empty);
    expect(deriveLessonMeta({ not: "an array" })).toEqual(empty);
  });

  it("takes the FIRST guide-diagram image as the hero", () => {
    const second = { type: "image", src: "/guide-diagrams/second.svg", alt: "second" };
    expect(deriveLessonMeta([heroImage, second]).diagramSrc).toBe("/guide-diagrams/foo.svg");
  });

  it("ignores images that are not guide diagrams", () => {
    const shot = { type: "image", src: "/api/shot/abc.webp", alt: "a screenshot" };
    expect(deriveLessonMeta([shot]).diagramSrc).toBeNull();
  });

  it("counts questions across MULTIPLE quiz blocks", () => {
    expect(deriveLessonMeta([quiz2, quiz2]).questionCount).toBe(4);
  });

  it("yields no questions when a quiz block fails schema validation", () => {
    // answer must index a valid option; this block is invalid, so the whole
    // safeParse fails and quizQuestions degrades to [] rather than throwing.
    const bad = { type: "quiz", questions: [{ q: "?", options: ["a"], answer: 9 }] };
    expect(deriveLessonMeta([bad]).questionCount).toBe(0);
  });
});
