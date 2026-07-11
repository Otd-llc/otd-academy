// Parse a lesson's contentBlocks into its quiz questions + stable keys. Shared by
// the award core, the progress loaders, and the lesson page (which computes the
// server-side questionKeys to hand DOWN to the client QuizBlock — questionKey is
// node:crypto and must never be imported client-side, design §3 / Task 2).
//
// Defensive over the raw JSON (contentBlocks is Prisma `Json`): a parse failure
// yields no questions rather than throwing on the public path (matches
// reading-time's degrade-don't-crash posture).
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { questionKey } from "@/lib/logbook/question-key";

export type QuizQ = { id?: string; q: string; answer: number };

export function quizQuestions(contentBlocks: unknown): QuizQ[] {
  const parsed = guideContentBlocksSchema.safeParse(contentBlocks);
  if (!parsed.success) return [];
  return parsed.data
    .filter((b) => b.type === "quiz")
    .flatMap((b) => (b.type === "quiz" ? b.questions : []));
}

export function lessonQuestionKeys(slug: string, contentBlocks: unknown): string[] {
  return quizQuestions(contentBlocks).map((q) => questionKey(slug, q));
}
