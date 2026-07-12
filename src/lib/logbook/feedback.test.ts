import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { academyDate, dedupe } from "@/lib/logbook/economy";
import { submitFeedback, markFeedback } from "@/lib/logbook/feedback";

const DAY = new Date("2026-07-11T12:00:00Z");
const earnedOn = academyDate(DAY);
const createdUsers: string[] = [];

async function mkUser(tag: string): Promise<string> {
  const u = await db.user.create({
    data: { email: `logbook-fb-${tag}-${Date.now()}-${Math.round(performance.now())}@test.local` },
  });
  createdUsers.push(u.id);
  return u.id;
}

afterAll(async () => {
  for (const id of createdUsers) await db.user.delete({ where: { id } });
});

describe("submitFeedback", () => {
  it("awards +2 the first time on a page and saves the row", async () => {
    const userId = await mkUser("submit");
    const r = await submitFeedback({ pageRef: "library/ohms-law", body: "typo in step 3 here" }, userId, DAY);
    expect(r).toMatchObject({ ok: true, xp: 2 });
    const rows = await db.lessonFeedback.count({ where: { userId } });
    expect(rows).toBe(1);
  });

  it("re-submitting the same page saves a row but earns 0 (dedupe)", async () => {
    const userId = await mkUser("dedupe");
    await submitFeedback({ pageRef: "library/p", body: "first note here ok" }, userId, DAY);
    const r = await submitFeedback({ pageRef: "library/p", body: "second note here ok" }, userId, DAY);
    expect(r).toMatchObject({ ok: true, xp: 0 });
    expect(await db.lessonFeedback.count({ where: { userId } })).toBe(2);
  });

  it("earns 0 once the daily XP cap is reached but still saves", async () => {
    const userId = await mkUser("cap");
    // inject 3 prior FEEDBACK_SUBMIT awards for today (the cap)
    for (let i = 0; i < 3; i++) {
      await db.xpEvent.create({
        data: {
          userId,
          source: "FEEDBACK_SUBMIT",
          amount: 2,
          refId: `library/seed-${i}`,
          earnedOn,
          dedupeKey: dedupe.feedbackSubmit(userId, `library/seed-${i}`),
        },
      });
    }
    const r = await submitFeedback({ pageRef: "library/fresh", body: "a genuinely new note" }, userId, DAY);
    expect(r).toMatchObject({ ok: true, xp: 0 });
    expect(await db.lessonFeedback.count({ where: { userId } })).toBe(1);
  });

  it("refuses the insert past the daily row flood guard", async () => {
    const userId = await mkUser("flood");
    for (let i = 0; i < 10; i++) {
      await db.lessonFeedback.create({
        data: { userId, pageRef: `library/x${i}`, body: "flood row", createdAt: DAY },
      });
    }
    const r = await submitFeedback({ pageRef: "library/over", body: "one row too many" }, userId, DAY);
    expect(r).toMatchObject({ ok: false, error: "daily limit" });
    expect(await db.lessonFeedback.count({ where: { userId } })).toBe(10);
  });
});

describe("markFeedback", () => {
  it("USEFUL from NEW pays the author +25 + Shipped It, once", async () => {
    const userId = await mkUser("useful");
    const sub = await submitFeedback({ pageRef: "library/ohms-law", body: "this fixed my build" }, userId, DAY);
    if (!sub.ok) throw new Error("submit failed");

    const first = await markFeedback({ id: sub.id, status: "USEFUL" }, DAY);
    expect(first).toMatchObject({ ok: true, paidUseful: true });

    const useful = await db.xpEvent.findFirst({
      where: { userId, source: "FEEDBACK_USEFUL", refId: sub.id },
    });
    expect(useful?.amount).toBe(25);
    const badge = await db.badgeEarned.findUnique({
      where: { userId_badgeKey: { userId, badgeKey: "skill:shipped-it" } },
    });
    expect(badge).not.toBeNull();

    // a second mark is a no-op (already triaged), never a double-pay
    const second = await markFeedback({ id: sub.id, status: "USEFUL" }, DAY);
    expect(second).toMatchObject({ ok: false });
  });

  it("DISMISS from NEW pays nothing", async () => {
    const userId = await mkUser("dismiss");
    const sub = await submitFeedback({ pageRef: "library/x", body: "not actionable really" }, userId, DAY);
    if (!sub.ok) throw new Error("submit failed");
    const r = await markFeedback({ id: sub.id, status: "DISMISSED" }, DAY);
    expect(r).toMatchObject({ ok: true, paidUseful: false });
    expect(await db.xpEvent.count({ where: { userId, source: "FEEDBACK_USEFUL" } })).toBe(0);
  });
});
