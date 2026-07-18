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
import { awardXp, type AwardResult } from "@/lib/logbook/award";
import { earnBadge } from "@/lib/logbook/badge";
import {
  academyDate,
  quizXp,
  dedupe,
  stageClearXp,
  COURSE_EXAM_XP,
  COURSE_COMPLETE_XP,
} from "@/lib/logbook/economy";

type LevelUp = { level: number; title: string } | null;

// Course stage-clear XP — Phase 2. Awarded once-ever when a learner passes a
// stage's exit gate and advances (hooked in advanceEnrollment). Idempotent on the
// dedupeKey, so a stale re-advance can never double-pay. `stage` is the FROM stage
// (the one just cleared); the amount is graduated by that stage (WI-1) via
// stageClearXp — the caller must derive its toast/telemetry amount the same way.
export async function recordStageClear(
  userId: string,
  slug: string,
  stage: string,
  now: Date,
): Promise<AwardResult> {
  return awardXp({
    userId,
    source: "STAGE_CLEAR",
    amount: stageClearXp(stage),
    refId: `${slug}:${stage}`,
    dedupeKey: dedupe.stageClear(userId, slug, stage),
    now,
  });
}

// Course final-exam-pass XP — Phase 2. Once-ever per course (hooked in submitExam
// on a genuine pass). Idempotent; a re-pass no-ops.
export async function recordCourseExamPass(
  userId: string,
  slug: string,
  now: Date,
): Promise<AwardResult> {
  return awardXp({
    userId,
    source: "COURSE_EXAM_PASS",
    amount: COURSE_EXAM_XP,
    refId: slug,
    dedupeKey: dedupe.courseExam(userId, slug),
    now,
  });
}

// Course completion — Phase 2. Hooked on issuance of the achievement certificate
// (variant "cert", which requires MASTERED, i.e. the exam is passed — so the
// course:<slug> RATING is genuinely exam-backed, design §5). Once-ever XP + the
// permanent, grandfathered rating badge.
export async function recordCourseComplete(
  userId: string,
  slug: string,
  now: Date,
): Promise<{
  awarded: boolean;
  xp: number;
  levelUp: LevelUp;
  newBadges: string[];
}> {
  const award = await awardXp({
    userId,
    source: "COURSE_COMPLETE",
    amount: COURSE_COMPLETE_XP,
    refId: slug,
    dedupeKey: dedupe.courseComplete(userId, slug),
    now,
  });
  const newBadges: string[] = [];
  if (await earnBadge(userId, `course:${slug}`)) newBadges.push(`course:${slug}`);
  return {
    awarded: award.awarded,
    xp: award.awarded ? COURSE_COMPLETE_XP : 0,
    levelUp: award.awarded ? award.levelUp : null,
    newBadges,
  };
}

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
