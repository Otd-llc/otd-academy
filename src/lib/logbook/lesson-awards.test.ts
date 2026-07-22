import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { questionKey } from "@/lib/logbook/question-key";
import { readingMinutes } from "@/lib/library/reading-time";
import { lessonXp } from "@/lib/logbook/economy";
import {
  recordQuizAnswer,
  recordLessonComplete,
} from "@/lib/logbook/lesson-awards";

const stamp = Date.now();
const email = `logbook-lesson-${stamp}@test.local`;
const slug = `logbook-throwaway-${stamp}`;
let userId: string;

const contentBlocks = [
  // ~600 words, under the guide schema's md max(4000) chars so it parses; drives
  // readMin = round(600/200) = 3. The test computes the expected XP via
  // readingMinutes(), so it stays correct if the wording changes.
  { type: "prose", md: Array(600).fill("volt").join(" ") },
  {
    type: "quiz",
    questions: [
      // reviewId opts q1 into the review deck (library path, step 4).
      { id: "q1", q: "First question?", options: ["yes", "no"], answer: 0, reviewId: "lib-q1" },
      { id: "q2", q: "Second question?", options: ["yes", "no"], answer: 1 },
    ],
  },
];
const K1 = questionKey(slug, { id: "q1", q: "First question?" });
const K2 = questionKey(slug, { id: "q2", q: "Second question?" });
const DAY1 = new Date("2026-07-11T12:00:00Z");
const DAY2 = new Date("2026-07-12T12:00:00Z");
const readMin = readingMinutes(contentBlocks);

beforeAll(async () => {
  const u = await db.user.create({ data: { email } });
  userId = u.id;
  await db.miniLesson.create({
    data: {
      slug,
      title: "Throwaway lesson",
      contentBlocks,
      published: true,
      accessTier: "PUBLIC",
      cluster: null, // unclustered: no cluster/library cascade noise from this row
      createdById: userId,
    },
  });
});

afterAll(async () => {
  await db.miniLesson.deleteMany({ where: { slug } });
  if (userId) await db.user.delete({ where: { id: userId } }); // cascades ReviewSchedule
  await db.quizItem.deleteMany({ where: { projectSlug: slug } });
});

describe("recordQuizAnswer", () => {
  it("awards full XP on a correct first pick", async () => {
    const r = await recordQuizAnswer({ slug, questionKey: K1, pick: 0 }, userId, DAY1);
    expect(r).toMatchObject({ ok: true, correct: true, xp: 5 });
  });

  it("refuses completion while a question is unattempted", async () => {
    const r = await recordLessonComplete({ slug }, userId, DAY1);
    expect(r).toMatchObject({ ok: false, incomplete: true });
  });

  it("a wrong pick awards 0 and writes a lock row", async () => {
    const r = await recordQuizAnswer({ slug, questionKey: K2, pick: 0 }, userId, DAY1);
    expect(r).toMatchObject({ ok: true, correct: false, xp: 0 });
    const lock = await db.quizLock.findFirst({ where: { userId, questionKey: K2 } });
    expect(lock).not.toBeNull();
  });

  it("dedupes a same-day replay of a correct pick (xp 0)", async () => {
    const r = await recordQuizAnswer({ slug, questionKey: K1, pick: 0 }, userId, DAY1);
    expect(r).toMatchObject({ ok: true, correct: true, xp: 0 });
  });

  it("a correct pick on a question locked earlier today earns 0", async () => {
    const r = await recordQuizAnswer({ slug, questionKey: K2, pick: 1 }, userId, DAY1);
    expect(r).toMatchObject({ ok: true, correct: true, xp: 0, locked: true });
  });

  it("returns ok:false for an unknown question or lesson", async () => {
    expect(await recordQuizAnswer({ slug, questionKey: "nope", pick: 0 }, userId, DAY1))
      .toMatchObject({ ok: false });
    expect(await recordQuizAnswer({ slug: "missing", questionKey: K1, pick: 0 }, userId, DAY1))
      .toMatchObject({ ok: false });
  });

  it("seeds a stage-less review item for a reviewable LIBRARY question", async () => {
    // Answering K1 (reviewId "lib-q1") above opened a library review item, keyed
    // lib:<slug>:lib-q1 with a NULL stage (library lessons have no stage).
    const reviewItemId = `lib:${slug}:lib-q1`;
    const item = await db.quizItem.findUnique({ where: { reviewItemId } });
    expect(item).toMatchObject({ projectSlug: slug, stage: null, answer: 0 });
    const sched = await db.reviewSchedule.findUnique({
      where: { userId_reviewItemId: { userId, reviewItemId } },
    });
    expect(sched).not.toBeNull();
  });

  it("a WRONG answer to an UNTAGGED library question seeds it keyed by questionKey", async () => {
    // K2 (no reviewId) was answered wrong above → auto-fed into the deck, keyed by
    // its questionKey with a null stage.
    const item = await db.quizItem.findUnique({ where: { reviewItemId: K2 } });
    expect(item).toMatchObject({ projectSlug: slug, stage: null, answer: 1 });
  });
});

describe("recordLessonComplete", () => {
  it("completes once every question was attempted: readMin*3 + First Flight", async () => {
    const r = await recordLessonComplete({ slug }, userId, DAY1);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.xp).toBe(lessonXp(readMin, { firstEver: true }));
    expect(r.newBadges).toContain("skill:first-flight");
    const completion = await db.lessonCompletion.findUnique({
      where: { userId_lessonSlug: { userId, lessonSlug: slug } },
    });
    expect(completion).not.toBeNull();
  });

  it("a second-day completion is repop rate with no new milestone", async () => {
    // re-attempt both questions on day 2 to satisfy the daily gate
    await recordQuizAnswer({ slug, questionKey: K1, pick: 0 }, userId, DAY2);
    await recordQuizAnswer({ slug, questionKey: K2, pick: 1 }, userId, DAY2);
    const r = await recordLessonComplete({ slug }, userId, DAY2);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.xp).toBe(lessonXp(readMin, { firstEver: false }));
    expect(r.newBadges).toEqual([]);
  });
});
