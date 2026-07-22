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
import { db } from "@/lib/db";
import { requireAdmin, currentUserId } from "@/lib/auth-helpers";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";
import { resetLessonXp as resetLessonXpCore } from "@/lib/logbook/reset";
import { afterAward } from "@/lib/logbook/after-award";
import {
  recordQuizAnswer as awardQuizAnswer,
  recordLessonComplete as awardLessonComplete,
  type QuizAnswerResult,
  type LessonCompleteResult,
} from "@/lib/logbook/lesson-awards";
import {
  recordStageQuizAnswer as awardStageQuiz,
  recordReviewAnswer as awardReview,
  type StageQuizResult,
  type ReviewAnswerResult,
} from "@/lib/logbook/guide-awards";

type NeedsAuth = { ok: false; needsAuth: true };

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
  const result = await awardQuizAnswer(parsed, userId, new Date());
  if (result.ok && "correct" in result && result.correct) {
    await afterAward(userId, {
      source: "QUIZ_CORRECT",
      xp: result.xp,
      levelUp: result.levelUp,
    });
  }
  return result;
}

const stageQuizSchema = z.object({
  enrollmentId: z.cuid(),
  stage: z.enum(STAGE_VALUES),
  questionKey: z.string().trim().min(1).max(300),
  pick: z.int().nonnegative(),
});

// Course (build-guide) stage-quiz XP (design Phase 2). The per-pick award for a
// guide card's quiz; server-validates against the card, then the funnel/milestone
// side effects. Signed-out → needsAuth (the guide QuizBlock shows the same affordance).
export async function recordStageQuizAnswer(
  input: unknown,
): Promise<StageQuizResult | NeedsAuth> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, needsAuth: true };
  const parsed = stageQuizSchema.parse(input);
  const result = await awardStageQuiz(parsed, userId, new Date());
  if (result.ok && "correct" in result && result.correct) {
    await afterAward(userId, {
      source: "STAGE_QUIZ_CORRECT",
      xp: result.xp,
      levelUp: result.levelUp,
    });
  }
  return result;
}

const reviewAnswerSchema = z.object({
  reviewItemId: z.string().trim().min(1).max(300),
  pick: z.int().nonnegative(),
});

// Cross-session review deck answer (step 4). Server re-scores against the QuizItem
// snapshot, advances the schedule, and awards the once-per-due-cycle REVIEW_CORRECT.
// `Math.random()` is injected here (the core stays pure) for the schedule jitter.
export async function recordReviewAnswer(
  input: unknown,
): Promise<ReviewAnswerResult | NeedsAuth> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, needsAuth: true };
  const parsed = reviewAnswerSchema.parse(input);
  const result = await awardReview(parsed, userId, new Date(), Math.random());
  if (result.ok && result.correct && result.xp > 0) {
    await afterAward(userId, {
      source: "REVIEW_CORRECT",
      xp: result.xp,
      levelUp: result.levelUp,
    });
  }
  return result;
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
  const result = await awardLessonComplete(parsed, userId, new Date());
  if (result.ok) {
    await afterAward(userId, {
      source: "LESSON_COMPLETE",
      xp: result.xp,
      levelUp: result.levelUp,
      newBadges: result.newBadges,
    });
  }
  return result;
}

const resetSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  userId: z.string().trim().min(1).optional(),
});

// Admin: reset a lesson's practice XP (design §6/§14). Deletes the lesson's
// QUIZ_CORRECT + LESSON_COMPLETE events and its QuizLocks (per-user or all-users),
// decrements each affected user's cached xpTotal by exactly the removed sum, and
// RECOMPUTES level from the new total in the same transaction (the one place a
// level may go DOWN — leaving a stale-high level would lie on the cert flair).
// LessonCompletion rows are NOT deleted: they are the durable milestone and the
// firstEver guard that stops a reset re-inflating XP at full rate.
export async function resetLessonXp(
  input: unknown,
): Promise<{ ok: boolean; affected: number }> {
  await requireAdmin();
  const { slug, userId } = resetSchema.parse(input);
  const { affected } = await resetLessonXpCore(slug, userId);
  return { ok: true, affected };
}

// Stamp the one-time /library Logbook intro as seen (design §9.1). Idempotent:
// a second call just re-stamps. Signed-out is a silent no-op.
export async function dismissLogbookIntro(): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await db.user.update({
    where: { id: userId },
    data: { logbookIntroSeenAt: new Date() },
  });
  return { ok: true };
}
