import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { guideQuestionKeys } from "@/lib/logbook/lesson-content";
import {
  recordStageQuizAnswer,
  recordStageClear,
  recordCourseExamPass,
  recordCourseComplete,
  recordReviewAnswer,
} from "@/lib/logbook/guide-awards";
import { XP } from "@/lib/logbook/economy";

const stamp = Date.now();
const slug = `stagequiz-${stamp}`;
const STAGE: Stage = "SCHEMATIC";
const DAY = new Date("2026-07-11T12:00:00Z");
let userId = "";
let otherId = "";
let enrollmentId = "";

const quizBlock = {
  type: "quiz",
  questions: [
    { q: "Stage question one?", options: ["a", "b", "c"], answer: 2 },
    // reviewId opts this question into the review deck on ANY answer (step 4).
    { q: "Stage question two?", options: ["a", "b", "c"], answer: 1, reviewId: "stage-q-two" },
    // untagged: only a WRONG answer feeds it into the deck (auto path).
    { q: "Stage question three?", options: ["a", "b", "c"], answer: 0 },
  ],
};
const REVIEW_ITEM_ID = `${slug}:SCHEMATIC:stage-q-two`;
const keys = guideQuestionKeys(slug, "v1", STAGE, [quizBlock]);

beforeAll(async () => {
  const u = await db.user.create({ data: { email: `sq-${stamp}@test.local` } });
  userId = u.id;
  const o = await db.user.create({ data: { email: `sq-other-${stamp}@test.local` } });
  otherId = o.id;
  const project = await db.project.create({
    data: { slug, name: "Stage quiz", createdById: userId },
  });
  const rev = await db.revision.create({ data: { projectId: project.id, label: "v1" } });
  const guide = await db.guide.create({
    data: { revisionId: rev.id, title: "g", createdById: userId },
  });
  await db.guideCard.create({
    data: {
      guideId: guide.id,
      stage: STAGE,
      ordinal: 0,
      eyebrow: "e",
      title: "t",
      contentBlocks: [quizBlock],
    },
  });
  const e = await db.enrollment.create({
    data: { userId, projectId: project.id, revisionId: rev.id },
  });
  enrollmentId = e.id;
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId: { in: [userId, otherId] } } });
  // QuizItem is not user/project-scoped by FK, so clean it explicitly; its FK
  // cascades any remaining ReviewSchedule rows. Project must go before User
  // (Project.createdById restricts), so keep that original order.
  await db.quizItem.deleteMany({ where: { projectSlug: slug } });
  await db.project.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

describe("recordStageQuizAnswer", () => {
  it("awards full XP on a correct first pick", async () => {
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[0], pick: 2 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: true, xp: 5 });
  });

  it("rewards a wrong FIRST pick (attempt-reward) and still writes a lock", async () => {
    // keys[1] not yet answered, so firstEver → full rate even though the pick is
    // wrong. The lock still lands (greys the slot / library parity).
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[1], pick: 0 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: false, xp: 5 });
    const lock = await db.quizLock.findFirst({ where: { userId, questionKey: keys[1] } });
    expect(lock).not.toBeNull();
  });

  it("does not double-pay: a same-day retry after the wrong pick awards 0", async () => {
    // keys[1] was already answered (wrong) this day → the per-day dedupe caps it,
    // so the corrected retry pays nothing. correct is now true, xp 0.
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[1], pick: 1 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: true, xp: 0, locked: true });
  });

  it("dedupes a same-day replay (xp 0)", async () => {
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[0], pick: 2 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: true, xp: 0 });
  });

  it("seeds a QuizItem snapshot + opens a ReviewSchedule for a reviewable question", async () => {
    // keys[1] carries a reviewId, so the earlier answers to it opened the review
    // item (forward-only seeding from the stage-answer path).
    const item = await db.quizItem.findUnique({
      where: { reviewItemId: REVIEW_ITEM_ID },
    });
    expect(item).toMatchObject({ projectSlug: slug, stage: STAGE, answer: 1 });
    expect(item?.options).toEqual(["a", "b", "c"]);

    const sched = await db.reviewSchedule.findUnique({
      where: { userId_reviewItemId: { userId, reviewItemId: REVIEW_ITEM_ID } },
    });
    expect(sched).not.toBeNull();
    expect(sched?.intervalDays).toBe(1);
    expect(sched?.lapses).toBe(0);
  });

  it("does NOT seed an untagged question that was answered CORRECTLY", async () => {
    // keys[0] (untagged) was answered correctly above, so nothing feeds the deck
    // for it (the auto path only fires on a WRONG answer).
    const item = await db.quizItem.findUnique({
      where: { reviewItemId: keys[0] },
    });
    expect(item).toBeNull();
  });

  it("a WRONG answer to an UNTAGGED question seeds it keyed by its questionKey", async () => {
    // keys[2] has no reviewId; answering it wrong feeds the deck (review-your-mistakes).
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[2], pick: 1 }, // answer is 0
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: false });
    const item = await db.quizItem.findUnique({
      where: { reviewItemId: keys[2] },
    });
    expect(item).toMatchObject({ projectSlug: slug, stage: STAGE, answer: 0 });
    const sched = await db.reviewSchedule.findUnique({
      where: { userId_reviewItemId: { userId, reviewItemId: keys[2] } },
    });
    expect(sched).not.toBeNull();
  });

  it("refuses another user's enrollment", async () => {
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[0], pick: 2 },
      otherId,
      DAY,
    );
    expect(r).toMatchObject({ ok: false });
  });

  it("refuses an unknown question", async () => {
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: "nope", pick: 0 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: false });
  });
});

describe("recordReviewAnswer", () => {
  const RITEM = `${slug}:SCHEMATIC:review-target`;
  beforeAll(async () => {
    await db.quizItem.create({
      data: {
        reviewItemId: RITEM,
        projectSlug: slug,
        stage: STAGE,
        q: "Review target?",
        options: ["a", "b", "c"],
        answer: 2,
      },
    });
    // A clearly past-due schedule (interval 3), so the item is due on DAY.
    await db.reviewSchedule.create({
      data: {
        userId,
        reviewItemId: RITEM,
        dueOn: new Date("2026-07-08T00:00:00Z"),
        intervalDays: 3,
        lapses: 0,
        lastSeenOn: new Date("2026-07-05T00:00:00Z"),
      },
    });
  });

  it("refuses an item the user has no schedule for", async () => {
    const r = await recordReviewAnswer(
      { reviewItemId: `${slug}:SCHEMATIC:not-scheduled`, pick: 0 },
      userId,
      DAY,
      0.5,
    );
    expect(r).toMatchObject({ ok: false });
  });

  it("a correct DUE answer awards REVIEW_CORRECT and climbs the ladder", async () => {
    const r = await recordReviewAnswer({ reviewItemId: RITEM, pick: 2 }, userId, DAY, 0);
    expect(r).toMatchObject({ ok: true, correct: true, xp: XP.REVIEW_CORRECT });
    const s = await db.reviewSchedule.findUnique({
      where: { userId_reviewItemId: { userId, reviewItemId: RITEM } },
    });
    // 3 -> 7, jitterFactor(0) = 0.85: round(7 * 0.85) = 6.
    expect(s?.intervalDays).toBe(6);
  });

  it("a same-day re-answer is a no-op (not due after the advance)", async () => {
    const r = await recordReviewAnswer({ reviewItemId: RITEM, pick: 2 }, userId, DAY, 0);
    expect(r).toMatchObject({ ok: true, xp: 0 });
  });
});

describe("recordStageClear", () => {
  const xpOf = async () =>
    (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { xpTotal: true } }))
      .xpTotal;

  it("awards the stage's graduated amount once; a re-clear no-ops (dedupe)", async () => {
    const first = await recordStageClear(userId, slug, "REQUIREMENTS", DAY);
    expect(first).toMatchObject({ awarded: true });
    const again = await recordStageClear(userId, slug, "REQUIREMENTS", DAY);
    expect(again).toMatchObject({ awarded: false });
  });

  it("graduates the ledger amount by stage (SCHEMATIC = 40, not the flat 20)", async () => {
    const before = await xpOf();
    const cleared = await recordStageClear(userId, slug, "SCHEMATIC", DAY);
    expect(cleared).toMatchObject({ awarded: true });
    expect((await xpOf()) - before).toBe(40); // stageClearXp("SCHEMATIC")
  });

  it("an unlisted stage (REVISION) falls back to the flat 20", async () => {
    const before = await xpOf();
    const cleared = await recordStageClear(userId, slug, "REVISION", DAY);
    expect(cleared).toMatchObject({ awarded: true });
    expect((await xpOf()) - before).toBe(20);
  });
});

describe("recordCourseExamPass", () => {
  it("awards +150 once; a re-pass no-ops (dedupe)", async () => {
    const first = await recordCourseExamPass(userId, slug, DAY);
    expect(first).toMatchObject({ awarded: true, xpTotal: expect.any(Number) });
    const again = await recordCourseExamPass(userId, slug, DAY);
    expect(again).toMatchObject({ awarded: false });
  });
});

describe("recordCourseComplete", () => {
  it("awards +300 + the course rating once; a re-issue no-ops", async () => {
    const first = await recordCourseComplete(userId, slug, DAY);
    expect(first).toMatchObject({ awarded: true, xp: 300 });
    expect(first.newBadges).toContain(`course:${slug}`);
    const badge = await db.badgeEarned.findUnique({
      where: { userId_badgeKey: { userId, badgeKey: `course:${slug}` } },
    });
    expect(badge).not.toBeNull();
    const again = await recordCourseComplete(userId, slug, DAY);
    expect(again).toMatchObject({ awarded: false });
    expect(again.newBadges).toEqual([]);
  });
});
