// Forward-only review-item seeding (step 4): snapshot a reviewable question into the
// QuizItem registry and OPEN its ReviewSchedule (first-encounter only). Shared by the
// guide stage-quiz path (guide-awards) and the library quiz path (lesson-awards).
// Best-effort at the call site: the review deck must never break a quiz answer, so
// callers `.catch` this. The QuizItem is refreshed on every encounter (last-writer-
// wins) so a content edit propagates on the next answer; the schedule is created once
// and thereafter advanced only by the review path.
import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { academyDate } from "@/lib/logbook/economy";
import { initialSchedule } from "@/lib/logbook/review-schedule";

export async function seedReviewItem(params: {
  userId: string;
  reviewItemId: string;
  /** Project slug (guide) or lesson slug (library). */
  projectSlug: string;
  /** The guide stage, or null for a library item. */
  stage: Stage | null;
  q: string;
  options: string[];
  answer: number;
  now: Date;
}): Promise<void> {
  const { userId, reviewItemId, projectSlug, stage, q, options, answer, now } =
    params;
  await db.quizItem.upsert({
    where: { reviewItemId },
    create: { reviewItemId, projectSlug, stage, q, options, answer },
    update: { q, options, answer },
  });
  const init = initialSchedule(now);
  await db.reviewSchedule.upsert({
    where: { userId_reviewItemId: { userId, reviewItemId } },
    create: {
      userId,
      reviewItemId,
      dueOn: init.dueOn,
      intervalDays: init.intervalDays,
      lastSeenOn: academyDate(now),
    },
    update: {},
  });
}
