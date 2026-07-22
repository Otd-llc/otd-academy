// Course (build-guide) stage-quiz XP — Phase 2 (design 2026-07-11). The per-pick
// parallel of the library `recordQuizAnswer`, but server-validated against the
// GUIDE CARD's contentBlocks (via the enrollment), keyed under the guide-scoped
// slug, and sourced STAGE_QUIZ_CORRECT. Ownership-checked (a learner records only
// their own enrollment). firstEver keys off the durable QuizPass gate row (not
// prior events) so an admin XP reset re-enables practice at the REPOP rate, never
// full-rate re-inflation (mirrors the library's LessonCompletion guard).
import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { quizQuestions, type QuizQ } from "@/lib/logbook/lesson-content";
import { questionKey, guideKey } from "@/lib/logbook/question-key";
import { awardXp, type AwardResult } from "@/lib/logbook/award";
import { earnBadge } from "@/lib/logbook/badge";
import {
  reviewItemId,
  initialSchedule,
  advanceSchedule,
  jitterFactor,
} from "@/lib/logbook/review-schedule";
import {
  academyDate,
  academyDay,
  quizXp,
  dedupe,
  stageClearXp,
  COURSE_EXAM_XP,
  COURSE_COMPLETE_XP,
  XP,
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
  // `xp` can be > 0 even when `correct` is false: the FIRST answer of the day is
  // rewarded regardless of correctness (attempt-reward, see below).
  | { ok: true; correct: boolean; xp: number; locked?: boolean; levelUp: LevelUp };

// Snapshot a reviewable question into the QuizItem registry and OPEN its
// ReviewSchedule (first-encounter only). Called from the stage-answer path, so the
// deck is seeded forward-only (no history bootstrap). The QuizItem is refreshed on
// every encounter (last-writer-wins) so a content edit propagates on the next
// answer; the schedule is created once and thereafter advanced only by the review
// path. A question with no `reviewId` (not opted in) is skipped.
async function seedReviewItem(
  userId: string,
  projectSlug: string,
  stage: Stage,
  q: QuizQ,
  now: Date,
): Promise<void> {
  if (!q.reviewId || !q.options) return;
  const itemId = reviewItemId(projectSlug, stage, q.reviewId);
  await db.quizItem.upsert({
    where: { reviewItemId: itemId },
    create: {
      reviewItemId: itemId,
      projectSlug,
      stage,
      q: q.q,
      options: q.options,
      answer: q.answer,
    },
    update: { q: q.q, options: q.options, answer: q.answer },
  });
  const init = initialSchedule(now);
  await db.reviewSchedule.upsert({
    where: { userId_reviewItemId: { userId, reviewItemId: itemId } },
    create: {
      userId,
      reviewItemId: itemId,
      dueOn: init.dueOn,
      intervalDays: init.intervalDays,
      lastSeenOn: academyDate(now),
    },
    update: {},
  });
}

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

  const wrong = input.pick !== q.answer;

  // A wrong pick still records the day-lock (greys the slot + keeps parity with the
  // library completion check), but it no longer FORFEITS the XP. The first answer
  // of the day is rewarded regardless of correctness: penalising a first-attempt
  // error taught the learner to not answer rather than commit and learn from the
  // correction, and errorful generation aids retention. The per-day dedupe key —
  // not correctness — is the anti-farm cap, so a wrong-then-right cycle can't
  // double-pay, and there is no XP incentive to guess wrong.
  if (wrong) {
    await db.quizLock.upsert({
      where: lockWhere,
      create: { userId, questionKey: input.questionKey, lockedOn: day },
      update: {},
    });
  }

  // Forward-only review seeding (step 4): the first time a learner answers a
  // REVIEWABLE question (one carrying an authored reviewId), snapshot it into the
  // QuizItem registry and open its ReviewSchedule. Best-effort — the review deck
  // must never break the quiz answer, so a failure here is logged and swallowed.
  await seedReviewItem(userId, enrollment.project.slug, input.stage, q, now).catch(
    (e) => console.error("[review] seed failed", e),
  );

  // Reward the FIRST answer of the day for this question (right or wrong), once,
  // via the per-day dedupe key. firstEver keys off the durable pass + any prior
  // award so an admin XP reset repops at the repop rate, never full-rate
  // re-inflation (mirrors the library's LessonCompletion guard).
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
  // Already answered this question today (dedupe) → the attempt XP was already paid.
  if (!res.awarded)
    return { ok: true, correct: !wrong, xp: 0, locked: true, levelUp: null };
  return { ok: true, correct: !wrong, xp: amount, levelUp: res.levelUp };
}

export type ReviewAnswerResult =
  | { ok: false }
  | { ok: true; correct: boolean; xp: number; levelUp: LevelUp };

// A learner's answer in the /review deck. Re-scores against the QuizItem registry
// snapshot (server-authoritative), advances the schedule up/down the ladder, and
// awards a small once-per-due-cycle XP on a correct answer.
//
// IDEMPOTENT per due cycle: the schedule is only processed while the item is DUE
// (dueOn <= today). A first answer advances dueOn into the future, so a stale
// re-submit finds the item not-due and no-ops (no second advance, no second award).
// The award dedupe embeds the cycle's dueOn as a second guard. `rand` is injected
// (Math.random() at the call site) so jitter is testable.
export async function recordReviewAnswer(
  input: { reviewItemId: string; pick: number },
  userId: string,
  now: Date,
  rand: number,
): Promise<ReviewAnswerResult> {
  const schedule = await db.reviewSchedule.findUnique({
    where: {
      userId_reviewItemId: { userId, reviewItemId: input.reviewItemId },
    },
    include: { item: { select: { answer: true } } },
  });
  // Not scheduled for this user → they have not seen this item, so there is nothing
  // to review.
  if (!schedule) return { ok: false };

  const correct = input.pick === schedule.item.answer;
  const today = academyDate(now);

  // Not due (already reviewed this cycle, or a stale double-submit) → no-op. This is
  // the idempotency guard: never advance or award twice for one due cycle.
  if (schedule.dueOn.getTime() > today.getTime()) {
    return { ok: true, correct, xp: 0, levelUp: null };
  }

  // The cycle being answered is `schedule.dueOn`; advance BEFORE it changes.
  const cycleDueDay = academyDay(schedule.dueOn);
  const next = advanceSchedule(
    {
      intervalDays: schedule.intervalDays,
      lapses: schedule.lapses,
      suspended: schedule.suspended,
    },
    correct,
    now,
    jitterFactor(rand),
  );
  // CONDITIONAL advance (race guard): only if the row is STILL due. The early
  // dueOn check above catches a serial re-answer, but two concurrent submits could
  // both pass it (both read the row before either writes). Gating the write on
  // `dueOn <= today` means exactly one wins; a loser gets count 0 and no-ops, so the
  // schedule can never double-advance and the award only fires for the winner.
  const { count } = await db.reviewSchedule.updateMany({
    where: {
      userId,
      reviewItemId: input.reviewItemId,
      dueOn: { lte: today },
    },
    data: {
      intervalDays: next.intervalDays,
      dueOn: next.dueOn,
      lapses: next.lapses,
      suspended: next.suspended,
      lastSeenOn: today,
    },
  });
  if (count === 0) return { ok: true, correct, xp: 0, levelUp: null };

  if (!correct) return { ok: true, correct: false, xp: 0, levelUp: null };

  const res = await awardXp({
    userId,
    source: "REVIEW_CORRECT",
    amount: XP.REVIEW_CORRECT,
    refId: input.reviewItemId,
    dedupeKey: dedupe.review(userId, input.reviewItemId, cycleDueDay),
    now,
  });
  return {
    ok: true,
    correct: true,
    xp: res.awarded ? XP.REVIEW_CORRECT : 0,
    levelUp: res.awarded ? res.levelUp : null,
  };
}
