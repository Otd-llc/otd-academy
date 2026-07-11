import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { guideQuestionKeys } from "@/lib/logbook/lesson-content";
import {
  recordStageQuizAnswer,
  recordStageClear,
  recordCourseExamPass,
} from "@/lib/logbook/guide-awards";

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
    { q: "Stage question two?", options: ["a", "b", "c"], answer: 1 },
  ],
};
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

  it("a wrong pick awards 0 and writes a lock", async () => {
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[1], pick: 0 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: false, xp: 0 });
    const lock = await db.quizLock.findFirst({ where: { userId, questionKey: keys[1] } });
    expect(lock).not.toBeNull();
  });

  it("dedupes a same-day replay (xp 0)", async () => {
    const r = await recordStageQuizAnswer(
      { enrollmentId, stage: STAGE, questionKey: keys[0], pick: 2 },
      userId,
      DAY,
    );
    expect(r).toMatchObject({ ok: true, correct: true, xp: 0 });
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

describe("recordStageClear", () => {
  it("awards +20 once; a re-clear no-ops (dedupe)", async () => {
    const first = await recordStageClear(userId, slug, "REQUIREMENTS", DAY);
    expect(first).toMatchObject({ awarded: true });
    const again = await recordStageClear(userId, slug, "REQUIREMENTS", DAY);
    expect(again).toMatchObject({ awarded: false });
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
