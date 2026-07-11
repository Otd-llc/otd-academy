"use server";

// The Logbook server actions (design §3). Thin auth wrappers over the
// server-authoritative core in @/lib/logbook/lesson-awards: resolve the session to
// a User row, then call the core with the real clock. Signed-out callers get
// { ok: false, needsAuth: true } so the client can render the "sign in to log XP"
// affordance instead of silently failing.
//
// "use server" DISCIPLINE: this module exports ONLY async functions. Result TYPES
// live in the core module and are consumed by the client via `import type`
// (erased at build — the client never pulls db/Prisma). See use-server-export-rule.
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  recordQuizAnswer as awardQuizAnswer,
  recordLessonComplete as awardLessonComplete,
  type QuizAnswerResult,
  type LessonCompleteResult,
} from "@/lib/logbook/lesson-awards";

type NeedsAuth = { ok: false; needsAuth: true };

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

const quizAnswerSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  questionKey: z.string().trim().min(1).max(300),
  pick: z.int().nonnegative(),
});

export async function recordQuizAnswer(
  input: unknown,
): Promise<QuizAnswerResult | NeedsAuth> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, needsAuth: true };
  const parsed = quizAnswerSchema.parse(input);
  return awardQuizAnswer(parsed, userId, new Date());
}

const lessonCompleteSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

export async function recordLessonComplete(
  input: unknown,
): Promise<LessonCompleteResult | NeedsAuth> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, needsAuth: true };
  const parsed = lessonCompleteSchema.parse(input);
  return awardLessonComplete(parsed, userId, new Date());
}
