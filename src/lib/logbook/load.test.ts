import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { academyDate, quizXp, lessonXp } from "@/lib/logbook/economy";
import {
  getLibraryProgress,
  getLessonState,
  getLogbook,
  type LessonMeta,
} from "@/lib/logbook/load";

const DAY = new Date("2026-07-11T12:00:00Z");
const today = academyDate(DAY);
const users: string[] = [];

async function mkUser(tag: string, data: Record<string, unknown> = {}): Promise<string> {
  const u = await db.user.create({
    data: { email: `logbook-load-${tag}-${Date.now()}-${Math.round(performance.now())}@test.local`, ...data },
  });
  users.push(u.id);
  return u.id;
}

afterAll(async () => {
  for (const id of users) await db.user.delete({ where: { id } });
});

// Synthetic lesson metadata — no coupling to the seeded content set.
const lessons: LessonMeta[] = [
  { slug: "prog-a", cluster: "fundamentals", questionCount: 2, readingMinutes: 3 },
  { slug: "prog-b", cluster: "fundamentals", questionCount: 1, readingMinutes: 2 },
];

describe("getLibraryProgress", () => {
  it("reports earned/max/completed per lesson and done/total per cluster", async () => {
    const userId = await mkUser("prog");
    // prog-a: completed, with today's repop earnings (a quiz + the lesson-complete)
    await db.lessonCompletion.create({ data: { userId, lessonSlug: "prog-a" } });
    await db.xpEvent.create({
      data: {
        userId, source: "QUIZ_CORRECT", amount: 2, refId: "prog-a#q1",
        earnedOn: today, dedupeKey: `t:${userId}:qa`,
      },
    });
    await db.xpEvent.create({
      data: {
        userId, source: "LESSON_COMPLETE", amount: 3, refId: "prog-a",
        earnedOn: today, dedupeKey: `t:${userId}:la`,
      },
    });

    const p = await getLibraryProgress(userId, lessons, DAY);

    const a = p.byLesson.get("prog-a")!;
    expect(a.completed).toBe(true);
    expect(a.earnedToday).toBe(5); // 2 (quiz) + 3 (lesson)
    // completed → REPOP max: 2*2 + lessonXp(3, repop) = 4 + 3 = 7
    expect(a.maxToday).toBe(2 * quizXp({ firstEver: false }) + lessonXp(3, { firstEver: false }));

    const b = p.byLesson.get("prog-b")!;
    expect(b.completed).toBe(false);
    expect(b.earnedToday).toBe(0);
    // not done → FULL max: 1*5 + lessonXp(2, full) = 5 + 6 = 11
    expect(b.maxToday).toBe(1 * quizXp({ firstEver: true }) + lessonXp(2, { firstEver: true }));

    expect(p.byCluster.get("fundamentals")).toEqual({ done: 1, total: 2 });
  });
});

describe("getLessonState", () => {
  it("classifies each question earned / locked / open for today", async () => {
    const userId = await mkUser("state");
    const keys = ["s#k1", "s#k2", "s#k3"];
    await db.xpEvent.create({
      data: {
        userId, source: "QUIZ_CORRECT", amount: 5, refId: "s#k1",
        earnedOn: today, dedupeKey: `st:${userId}:k1`,
      },
    });
    await db.quizLock.create({ data: { userId, questionKey: "s#k2", lockedOn: today } });

    const s = await getLessonState(userId, "s", keys, DAY);
    expect(s.perQuestion).toEqual({ "s#k1": "earned", "s#k2": "locked", "s#k3": "open" });
    expect(s.completed).toBe(false);
  });
});

describe("getLogbook", () => {
  it("derives level/title from the XP total and rolls up clusters + badges", async () => {
    const userId = await mkUser("book", {
      xpTotal: 210, // ≥ 200 → level 3 Cross-Country
      currentThrough: academyDate(new Date("2026-07-20T12:00:00Z")),
    });
    await db.lessonCompletion.create({ data: { userId, lessonSlug: "prog-a" } });
    await db.badgeEarned.create({ data: { userId, badgeKey: "skill:first-flight" } });
    await db.xpEvent.create({
      data: {
        userId, source: "QUIZ_CORRECT", amount: 5, refId: "prog-a#q1",
        earnedOn: today, dedupeKey: `bk:${userId}:e1`,
      },
    });

    const lb = await getLogbook(userId, lessons, DAY);
    expect(lb.xpTotal).toBe(210);
    expect(lb.level).toBe(3);
    expect(lb.title).toBe("Cross-Country");
    expect(lb.next?.level).toBe(4);
    expect(lb.isCurrent).toBe(true);
    expect(lb.clusters.find((c) => c.key === "fundamentals")).toMatchObject({ done: 1, total: 2 });
    expect(lb.badges.map((b) => b.badgeKey)).toContain("skill:first-flight");
    expect(lb.recent.length).toBe(1);
  });

  it("marks a lapsed window as not current", async () => {
    const userId = await mkUser("lapsed", {
      xpTotal: 10,
      currentThrough: academyDate(new Date("2026-07-01T12:00:00Z")), // before DAY
    });
    const lb = await getLogbook(userId, lessons, DAY);
    expect(lb.isCurrent).toBe(false);
    expect(lb.level).toBe(1);
  });
});
