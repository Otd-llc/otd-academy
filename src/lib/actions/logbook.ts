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
import { capture } from "@/lib/analytics";
import { notifyLogbookMilestone } from "@/lib/logbook/notify";
import {
  recordQuizAnswer as awardQuizAnswer,
  recordLessonComplete as awardLessonComplete,
  type QuizAnswerResult,
  type LessonCompleteResult,
} from "@/lib/logbook/lesson-awards";

// Emit the funnel + milestone side effects of an award (design §10b/§11): server
// PostHog events, then the once-only milestone email. Both are defensive no-ops
// when unconfigured / no consent; neither throws into the award path.
async function afterAward(
  userId: string,
  o: {
    source: string;
    xp: number;
    levelUp: { level: number; title: string } | null;
    newBadges?: string[];
  },
): Promise<void> {
  if (o.xp > 0) capture("xp_earned", { source: o.source, amount: o.xp }, userId);
  if (o.levelUp) {
    capture("level_up", { level: o.levelUp.level, title: o.levelUp.title }, userId);
  }
  for (const badgeKey of o.newBadges ?? []) {
    capture("patch_earned", { badgeKey }, userId);
  }
  await notifyLogbookMilestone(userId, {
    levelUp: o.levelUp,
    newBadges: o.newBadges ?? [],
  });
}

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
