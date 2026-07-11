// Course (build-guide) stage-quiz XP — Phase 2 (design 2026-07-11). The per-pick
// parallel of the library `recordQuizAnswer`, but server-validated against the
// GUIDE CARD's contentBlocks (via the enrollment), keyed under the guide-scoped
// slug, and sourced STAGE_QUIZ_CORRECT. Ownership-checked (a learner records only
// their own enrollment). firstEver keys off the durable QuizPass gate row (not
// prior events) so an admin XP reset re-enables practice at the REPOP rate, never
// full-rate re-inflation (mirrors the library's LessonCompletion guard).
import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { quizQuestions } from "@/lib/logbook/lesson-content";
import { questionKey, guideKey } from "@/lib/logbook/question-key";
import { awardXp } from "@/lib/logbook/award";
import { academyDate, quizXp, dedupe } from "@/lib/logbook/economy";

type LevelUp = { level: number; title: string } | null;

export type StageQuizResult =
  | { ok: false }
  | { ok: true; correct: false; xp: 0 }
  | { ok: true; correct: true; xp: number; locked?: boolean; levelUp: LevelUp };

export async function recordStageQuizAnswer(
  input: { enrollmentId: string; stage: Stage; questionKey: string; pick: number },
  userId: string,
  now: Date,
): Promise<StageQuizResult> {
  // Mirror recordQuizPass's load: the card's contentBlocks + the slug/label the
  // guide key is built from, all off the enrollment.
  const enrollment = await db.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: {
      userId: true,
      project: { select: { slug: true } },
      revision: {
        select: {
          label: true,
          guide: {
            select: {
              cards: {
                where: { stage: input.stage },
                select: { contentBlocks: true },
              },
            },
          },
        },
      },
    },
  });
  if (!enrollment || enrollment.userId !== userId) return { ok: false };
  const card = enrollment.revision.guide?.cards[0];
  if (!card) return { ok: false };

  const gk = guideKey(enrollment.project.slug, enrollment.revision.label, input.stage);
  const q = quizQuestions(card.contentBlocks).find(
    (qq) => questionKey(gk, qq) === input.questionKey,
  );
  if (!q) return { ok: false };

  const day = academyDate(now);
  const lockWhere = {
    userId_questionKey_lockedOn: {
      userId,
      questionKey: input.questionKey,
      lockedOn: day,
    },
  };

  // Wrong pick → lock the question for today (feeds nothing here, but keeps the
  // anti guess-farm parity with the library + greys the slot).
  if (input.pick !== q.answer) {
    await db.quizLock.upsert({
      where: lockWhere,
      create: { userId, questionKey: input.questionKey, lockedOn: day },
      update: {},
    });
    return { ok: true, correct: false, xp: 0 };
  }

  // Correct, but locked earlier today → no XP.
  const locked = await db.quizLock.findUnique({ where: lockWhere });
  if (locked) return { ok: true, correct: true, xp: 0, locked: true, levelUp: null };

  const [priorAward, pass] = await Promise.all([
    db.xpEvent.findFirst({
      where: { userId, source: "STAGE_QUIZ_CORRECT", refId: input.questionKey },
      select: { id: true },
    }),
    db.quizPass.findUnique({
      where: {
        enrollmentId_stage: { enrollmentId: input.enrollmentId, stage: input.stage },
      },
      select: { enrollmentId: true },
    }),
  ]);
  const firstEver = !priorAward && !pass;
  const amount = quizXp({ firstEver });
  const res = await awardXp({
    userId,
    source: "STAGE_QUIZ_CORRECT",
    amount,
    refId: input.questionKey,
    dedupeKey: dedupe.stageQuiz(userId, input.questionKey, now),
    now,
  });
  if (!res.awarded) return { ok: true, correct: true, xp: 0, locked: true, levelUp: null };
  return { ok: true, correct: true, xp: amount, levelUp: res.levelUp };
}
