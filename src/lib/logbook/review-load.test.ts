import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { dueReviewItems, dueReviewCount } from "@/lib/logbook/review-load";

const stamp = Date.now();
const NOW = new Date("2026-07-21T18:00:00Z");
const PROJECT = `revload-${stamp}`;
let userId = "";

const item = (suffix: string) => `${PROJECT}:SCHEMATIC:${suffix}`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: `revload-${stamp}@test.local` } });
  userId = u.id;
  const mk = (suffix: string, answer: number) =>
    db.quizItem.create({
      data: {
        reviewItemId: item(suffix),
        projectSlug: PROJECT,
        stage: "SCHEMATIC",
        q: `Q ${suffix}?`,
        options: ["a", "b", "c"],
        answer,
      },
    });
  await Promise.all([mk("overdue", 0), mk("today", 1), mk("future", 2), mk("leech", 0)]);
  const sched = (suffix: string, dueOn: string, suspended = false) =>
    db.reviewSchedule.create({
      data: {
        userId,
        reviewItemId: item(suffix),
        dueOn: new Date(dueOn),
        intervalDays: 7,
        suspended,
        lastSeenOn: new Date("2026-07-14T00:00:00Z"),
      },
    });
  await sched("overdue", "2026-07-18T00:00:00Z"); // due
  await sched("today", "2026-07-21T00:00:00Z"); // due (== today)
  await sched("future", "2026-07-28T00:00:00Z"); // not due
  await sched("leech", "2026-07-10T00:00:00Z", true); // due but suspended
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: userId } });
  await db.quizItem.deleteMany({ where: { projectSlug: PROJECT } });
});

describe("dueReviewItems", () => {
  it("returns only due, non-suspended items, most-overdue first", async () => {
    const items = await dueReviewItems(userId, NOW);
    expect(items.map((i) => i.reviewItemId)).toEqual([item("overdue"), item("today")]);
    // future is not due; leech is suspended → both excluded.
  });

  it("respects the cap", async () => {
    const items = await dueReviewItems(userId, NOW, 1);
    expect(items).toHaveLength(1);
    expect(items[0].reviewItemId).toBe(item("overdue"));
  });

  it("carries the snapshot content", async () => {
    const items = await dueReviewItems(userId, NOW, 1);
    expect(items[0]).toMatchObject({ q: "Q overdue?", options: ["a", "b", "c"], answer: 0 });
  });
});

describe("dueReviewCount", () => {
  it("counts due non-suspended items only", async () => {
    expect(await dueReviewCount(userId, NOW)).toBe(2);
  });
});
