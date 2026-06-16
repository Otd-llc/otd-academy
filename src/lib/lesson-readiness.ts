// Lesson "definition of done" — scores a guide against the L1.01 bar so "ready
// to publish" is measurable, not a vibe. Pure + testable: the script
// (scripts/lesson-readiness.ts) loads the DB rows and feeds the parsed cards in.
//
// Pairs with the per-stage authoring scaffold (stage-skeletons.ts): that seeds
// every new stage with a screenshot placeholder + a quiz stub (marked TODO), and
// this flags any of those left unfilled.

import type { ContentBlock } from "@/lib/schemas/guide";

export interface LessonCard {
  stage: string;
  blocks: ContentBlock[];
}

export interface LessonReadinessInput {
  /** The canonical stage order (GUIDE_STAGES). */
  stages: readonly string[];
  cards: LessonCard[];
  exam: { questions: number } | null;
  published: boolean;
}

export interface ReadinessCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface LessonReadiness {
  checks: ReadinessCheck[];
  /** True when every GATING check passes (publish status is informational). */
  ready: boolean;
}

// Minimum exam size to count as a real final exam (L1.01 has 18).
const MIN_EXAM_QUESTIONS = 10;

// Crude but effective: a leftover authoring stub anywhere in a card's blocks.
function hasTodo(blocks: ContentBlock[]): boolean {
  return JSON.stringify(blocks).includes("TODO");
}

function cardFor(cards: LessonCard[], stage: string): LessonCard | undefined {
  return cards.find((c) => c.stage === stage);
}

export function assessLessonReadiness(
  input: LessonReadinessInput,
): LessonReadiness {
  const { stages, cards, exam, published } = input;
  const checks: ReadinessCheck[] = [];

  const missingStages = stages.filter((s) => !cardFor(cards, s));
  checks.push({
    label: "All stage cards present",
    ok: missingStages.length === 0,
    detail: missingStages.length ? `missing: ${missingStages.join(", ")}` : undefined,
  });

  const noQuiz = stages.filter((s) => {
    const c = cardFor(cards, s);
    return !c || !c.blocks.some((b) => b.type === "quiz");
  });
  checks.push({
    label: "Every stage has a quiz checkpoint",
    ok: noQuiz.length === 0,
    detail: noQuiz.length ? `no quiz: ${noQuiz.join(", ")}` : undefined,
  });

  const noImage = stages.filter((s) => {
    const c = cardFor(cards, s);
    return !c || !c.blocks.some((b) => b.type === "image" && b.src !== "");
  });
  checks.push({
    label: "Every stage has a screenshot/diagram",
    ok: noImage.length === 0,
    detail: noImage.length ? `no image: ${noImage.join(", ")}` : undefined,
  });

  const todoStages = cards.filter((c) => hasTodo(c.blocks)).map((c) => c.stage);
  checks.push({
    label: "No TODO authoring stubs remain",
    ok: todoStages.length === 0,
    detail: todoStages.length ? `TODO in: ${todoStages.join(", ")}` : undefined,
  });

  checks.push({
    label: `Final exam (≥ ${MIN_EXAM_QUESTIONS} questions)`,
    ok: !!exam && exam.questions >= MIN_EXAM_QUESTIONS,
    detail: exam ? `${exam.questions} questions` : "no exam",
  });

  // Publish status is reported but does NOT gate readiness — it's the action you
  // take once the lesson IS ready.
  checks.push({
    label: "Published",
    ok: published,
    detail: published ? undefined : "not yet published",
  });

  const ready = checks
    .filter((c) => c.label !== "Published")
    .every((c) => c.ok);

  return { checks, ready };
}
