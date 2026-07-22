// Load a learner's DUE review items for the /review deck (step 4). Server-only
// (DB). Overdue-first and capped so the deck never walls the learner; suspended
// leeches are excluded. Joins the QuizItem snapshot so the item renders without
// re-parsing contentBlocks.
import { db } from "@/lib/db";
import { academyDate } from "@/lib/logbook/economy";

export type ReviewItem = {
  reviewItemId: string;
  q: string;
  options: string[];
  answer: number;
};

export const REVIEW_DAILY_CAP = 15;

export async function dueReviewItems(
  userId: string,
  now: Date,
  limit = REVIEW_DAILY_CAP,
): Promise<ReviewItem[]> {
  const today = academyDate(now);
  const rows = await db.reviewSchedule.findMany({
    where: { userId, suspended: false, dueOn: { lte: today } },
    orderBy: { dueOn: "asc" }, // most overdue first (a miss steps down, so it resurfaces sooner)
    take: limit,
    select: {
      item: {
        select: { reviewItemId: true, q: true, options: true, answer: true },
      },
    },
  });
  return rows.map((r) => r.item);
}

/** How many items are due right now (for the "N due" nudge). */
export async function dueReviewCount(userId: string, now: Date): Promise<number> {
  const today = academyDate(now);
  return db.reviewSchedule.count({
    where: { userId, suspended: false, dueOn: { lte: today } },
  });
}
