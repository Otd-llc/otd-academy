// seedReviewItem: the QuizItem row is GLOBAL (one per question, shared by every
// learner) and the old upsert ran an unconditional UPDATE on every tagged
// answer — row-lock contention + WAL churn scaling with answer volume, not
// content edits. It must rewrite only when the content actually changed, and
// the item + schedule must land atomically (a QuizItem without its schedule
// was invisible in prod and silently never entered the deck).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { seedReviewItem } from "@/lib/logbook/review-seed";

const TAG = `review-seed-${Date.now()}`;
const ITEM = `${TAG}:item`;
let userId = "";

beforeAll(async () => {
  const u = await db.user.create({
    data: { email: `${TAG}@example.com`, name: "Seeder", role: "LEARNER" },
  });
  userId = u.id;
});

afterAll(async () => {
  await db.reviewSchedule.deleteMany({ where: { reviewItemId: ITEM } });
  await db.quizItem.deleteMany({ where: { reviewItemId: ITEM } });
  await db.user.deleteMany({ where: { id: userId } });
});

const base = {
  userId: "",
  reviewItemId: ITEM,
  projectSlug: `${TAG}-slug`,
  stage: null,
  q: "What is 2+2?",
  options: ["3", "4"],
  answer: 1,
  now: new Date("2026-07-22T12:00:00Z"),
};

describe("seedReviewItem", () => {
  test("first encounter creates item + schedule", async () => {
    await seedReviewItem({ ...base, userId });
    const item = await db.quizItem.findUniqueOrThrow({
      where: { reviewItemId: ITEM },
    });
    expect(item.q).toBe("What is 2+2?");
    const sched = await db.reviewSchedule.findUnique({
      where: { userId_reviewItemId: { userId, reviewItemId: ITEM } },
    });
    expect(sched).not.toBeNull();
  });

  test("an UNCHANGED re-encounter does not rewrite the shared row", async () => {
    const before = await db.quizItem.findUniqueOrThrow({
      where: { reviewItemId: ITEM },
      select: { updatedAt: true },
    });
    await seedReviewItem({ ...base, userId });
    const after = await db.quizItem.findUniqueOrThrow({
      where: { reviewItemId: ITEM },
      select: { updatedAt: true },
    });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test("a CONTENT EDIT does propagate on the next encounter", async () => {
    await seedReviewItem({ ...base, userId, q: "What is two plus two?" });
    const item = await db.quizItem.findUniqueOrThrow({
      where: { reviewItemId: ITEM },
    });
    expect(item.q).toBe("What is two plus two?");
  });
});
