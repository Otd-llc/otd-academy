import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { academyDate } from "@/lib/logbook/economy";
import { resetLessonXp } from "@/lib/logbook/reset";

const DAY = academyDate(new Date("2026-07-11T12:00:00Z"));
const users: string[] = [];

afterAll(async () => {
  for (const id of users) await db.user.delete({ where: { id } });
});

describe("resetLessonXp", () => {
  it("removes the lesson's XP + locks, keeps completion, recomputes a lower level", async () => {
    const u = await db.user.create({
      data: {
        email: `logbook-reset-${Date.now()}@test.local`,
        xpTotal: 165, // level 3 (>= 150 on the 12-rank ladder)
        level: 3,
      },
    });
    users.push(u.id);
    const slug = `reset-me-${Date.now()}`;
    const seed = (data: {
      source: "QUIZ_CORRECT" | "LESSON_COMPLETE" | "CLUSTER_COMPLETE";
      amount: number;
      refId: string;
      key: string;
    }) =>
      db.xpEvent.create({
        data: {
          userId: u.id,
          source: data.source,
          amount: data.amount,
          refId: data.refId,
          earnedOn: DAY,
          dedupeKey: data.key,
        },
      });

    await seed({ source: "QUIZ_CORRECT", amount: 5, refId: `${slug}#q1`, key: `${slug}:q1` });
    await seed({ source: "LESSON_COMPLETE", amount: 12, refId: slug, key: `${slug}:lc` });
    // untouched by a per-lesson reset:
    await seed({ source: "CLUSTER_COMPLETE", amount: 100, refId: "fundamentals", key: `${slug}:cl` });
    await seed({ source: "QUIZ_CORRECT", amount: 5, refId: "other-lesson#q1", key: `${slug}:other` });
    await db.quizLock.create({ data: { userId: u.id, questionKey: `${slug}#q2`, lockedOn: DAY } });
    await db.lessonCompletion.create({ data: { userId: u.id, lessonSlug: slug } });

    const res = await resetLessonXp(slug);
    expect(res.affected).toBe(1);

    const fresh = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(fresh.xpTotal).toBe(165 - 17); // 148
    expect(fresh.level).toBe(2); // recomputed DOWN from 3 (148 < 150)

    // lesson XP + lock gone
    expect(await db.xpEvent.count({ where: { userId: u.id, refId: { startsWith: `${slug}#` } } })).toBe(0);
    expect(await db.xpEvent.count({ where: { userId: u.id, source: "LESSON_COMPLETE", refId: slug } })).toBe(0);
    expect(await db.quizLock.count({ where: { userId: u.id, questionKey: { startsWith: `${slug}#` } } })).toBe(0);
    // cluster award + the other lesson survive
    expect(await db.xpEvent.count({ where: { userId: u.id, source: "CLUSTER_COMPLETE" } })).toBe(1);
    expect(await db.xpEvent.count({ where: { userId: u.id, refId: "other-lesson#q1" } })).toBe(1);
    // the durable milestone is preserved (firstEver guard)
    const completion = await db.lessonCompletion.findUnique({
      where: { userId_lessonSlug: { userId: u.id, lessonSlug: slug } },
    });
    expect(completion).not.toBeNull();
  });
});
