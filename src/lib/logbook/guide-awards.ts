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
  autoReviewItemId,
  advanceSchedule,
  jitterFactor,
} from "@/lib/logbook/review-schedule";
import { seedReviewItem } from "@/lib/logbook/review-seed";
import { loadStageCard } from "@/lib/logbook/stage-card-load";
import { capture } from "@/lib/analytics";
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

// Seed a STAGE-quiz question into the review deck (forward-only). Two ways in:
//   - a reviewId-tagged question seeds on ANY answer (the author wants it reviewed,
//     keyed by the fully-stable reviewId), OR
//   - an untagged question seeds only on a WRONG answer ("review your mistakes",
//     auto, no authoring), keyed by its questionKey.
// The questionKey itself prefers a stable authored `id` over a text hash, so an
// id'd question is stable across text edits; a hash-keyed one degrades gracefully
// (the QuizItem snapshot still renders it; the prune job clears stale rows).
async function seedStageReviewItem(
  userId: string,
  projectSlug: string,
  stage: Stage,
  q: QuizQ,
  questionKey: string,
  wrong: boolean,
  now: Date,
): Promise<void> {
  if (!q.options) return;
  // The question's own identity (id or text-hash) is the part of questionKey
  // after the last '#' — stable across revisions, unlike the full questionKey
  // (which embeds the revision label). Auto items key on THAT so a rev bump
  // doesn't orphan the schedule.
  const qIdent = questionKey.slice(questionKey.lastIndexOf("#") + 1);
  const itemId = q.reviewId
    ? reviewItemId(projectSlug, stage, q.reviewId)
    : wrong
      ? autoReviewItemId(projectSlug, stage, qIdent)
      : null;
  if (!itemId) return;
  await seedReviewItem({
    userId,
    reviewItemId: itemId,
    projectSlug,
    stage,
    q: q.q,
    options: q.options,
    answer: q.answer,
    now,
  });
}

export async function recordStageQuizAnswer(
  input: { enrollmentId: string; stage: Stage; questionKey: string; pick: number },
  userId: string,
  now: Date,
): Promise<StageQuizResult> {
  // Shared load (loadStageCard): same enrollment→card shape the exit-gate scorer
  // uses, so the gate and this per-pick XP can never drift on which card they
  // read. The PARSE stays local (XP flattens every quiz question; the gate picks
  // one gate block) — deliberately different intents over the same data.
  const load = await loadStageCard(db, input.enrollmentId, input.stage, userId);
  if (!load.owned || load.contentBlocks == null) return { ok: false };

  const gk = guideKey(load.projectSlug, load.revLabel, input.stage);
  const q = quizQuestions(load.contentBlocks).find(
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
  await seedStageReviewItem(
    userId,
    load.projectSlug,
    input.stage,
    q,
    input.questionKey,
    wrong,
    now,
  ).catch((e) => {
    // Telemetry, not just console: a silent seed failure means this question
    // never enters the deck, invisible in unwatched Vercel logs.
    console.error("[review] seed failed", e);
    capture(
      "review_seed_failed",
      { surface: "guide", detail: e instanceof Error ? e.message : String(e) },
      userId,
    );
  });

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
  // `answer` is the ORIGINAL (unshuffled) index of the correct option, returned
  // AFTER the pick so the deck can reveal it — the client no longer receives the
  // answer key up front (it can't be read before answering).
  | { ok: true; correct: boolean; answer: number; xp: number; levelUp: LevelUp };

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

  const answer = schedule.item.answer;
  const correct = input.pick === answer;
  const today = academyDate(now);

  // Not due (already reviewed this cycle, or a stale double-submit) → no-op. This is
  // the idempotency guard: never advance or award twice for one due cycle.
  if (schedule.dueOn.getTime() > today.getTime()) {
    return { ok: true, correct, answer, xp: 0, levelUp: null };
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
  // AWARD BEFORE ADVANCE (atomicity fix): the two writes are independently
  // idempotent — the award on its per-cycle dedupeKey, the advance on the
  // conditional `dueOn <= today` race guard — so ordering does not affect the
  // net state (exactly one award, exactly one advance, whichever concurrent
  // caller wins each). But if the advance ran FIRST and the award then threw
  // (transient serialization / connection blip), `dueOn` had already moved out
  // of this cycle and the REVIEW_CORRECT XP was lost with no re-eligibility.
  // Awarding first means a failed advance keeps the XP and simply leaves the
  // item due for a dedupe-protected retry — an under-advance beats an
  // unrecoverable under-credit.
  let xp = 0;
  let awardedLevelUp: { level: number; title: string } | null = null;
  if (correct) {
    const res = await awardXp({
      userId,
      source: "REVIEW_CORRECT",
      amount: XP.REVIEW_CORRECT,
      refId: input.reviewItemId,
      dedupeKey: dedupe.review(userId, input.reviewItemId, cycleDueDay),
      now,
    });
    if (res.awarded) {
      xp = XP.REVIEW_CORRECT;
      awardedLevelUp = res.levelUp;
    }
  }

  // CONDITIONAL advance (race guard): only if the row is STILL due. The early
  // dueOn check above catches a serial re-answer, but two concurrent submits could
  // both pass it (both read the row before either writes). Gating the write on
  // `dueOn <= today` means exactly one wins; a loser gets count 0 and no-ops, so the
  // schedule can never double-advance.
  await db.reviewSchedule.updateMany({
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

  return { ok: true, correct, answer, xp, levelUp: awardedLevelUp };
}
