// Parse a lesson's contentBlocks into its quiz questions + stable keys. Shared by
// the award core, the progress loaders, and the lesson page (which computes the
// server-side questionKeys to hand DOWN to the client QuizBlock — questionKey is
// node:crypto and must never be imported client-side, design §3 / Task 2).
//
// Defensive over the raw JSON (contentBlocks is Prisma `Json`): a parse failure
// yields no questions rather than throwing on the public path (matches
// reading-time's degrade-don't-crash posture). Parses per-block (parseGuideBlocks)
// so ONE malformed block no longer discards every quiz on the card — the gate quiz
// and per-pick XP survive alongside a bad sibling.
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { questionKey, guideKey } from "@/lib/logbook/question-key";

export type QuizQ = { id?: string; q: string; answer: number };

export function quizQuestions(contentBlocks: unknown): QuizQ[] {
  return parseGuideBlocks(contentBlocks)
    .blocks.filter((b) => b.type === "quiz")
    .flatMap((b) => (b.type === "quiz" ? b.questions : []));
}

export function lessonQuestionKeys(slug: string, contentBlocks: unknown): string[] {
  return quizQuestions(contentBlocks).map((q) => questionKey(slug, q));
}

// Course (build-guide) quiz keys — Phase 2. Same as lessonQuestionKeys but keyed
// under the guide-scoped slug (guide:<project>:<rev>:<stage>) so a guide card's
// quiz keys never collide with a library lesson's.
export function guideQuestionKeys(
  projectSlug: string,
  revLabel: string,
  stage: string,
  contentBlocks: unknown,
): string[] {
  const gk = guideKey(projectSlug, revLabel, stage);
  return quizQuestions(contentBlocks).map((q) => questionKey(gk, q));
}
