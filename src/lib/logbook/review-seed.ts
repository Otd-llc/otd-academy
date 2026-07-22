// Forward-only review-item seeding (step 4): snapshot a reviewable question into the
// QuizItem registry and OPEN its ReviewSchedule (first-encounter only). Shared by the
// guide stage-quiz path (guide-awards) and the library quiz path (lesson-awards).
// Best-effort at the call site: the review deck must never break a quiz answer, so
// callers `.catch` this (and report to telemetry, not console — a silent seed
// failure meant an item never entered the deck with nothing to grep for).
//
// The QuizItem row is GLOBAL (one per question, shared by every learner). It is
// refreshed ONLY when the content actually changed — the old last-writer-wins
// upsert ran an unconditional UPDATE per tagged answer, a hot-row write that
// scaled with answer volume instead of content edits. Item + schedule commit in
// ONE transaction so a partial write can't leave an item that renders wrong or
// never surfaces.
import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { academyDate } from "@/lib/logbook/economy";
import { initialSchedule } from "@/lib/logbook/review-schedule";

function sameContent(
  a: { q: string; options: string[]; answer: number },
  b: { q: string; options: string[]; answer: number },
): boolean {
  return (
    a.q === b.q &&
    a.answer === b.answer &&
    a.options.length === b.options.length &&
    a.options.every((o, i) => o === b.options[i])
  );
}

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
  await db.$transaction(async (tx) => {
    const existing = await tx.quizItem.findUnique({
      where: { reviewItemId },
      select: { q: true, options: true, answer: true },
    });
    if (!existing) {
      // upsert with an empty update, not create(): concurrent first encounters
      // race, and a P2002 inside the transaction would abort the schedule too.
      await tx.quizItem.upsert({
        where: { reviewItemId },
        create: { reviewItemId, projectSlug, stage, q, options, answer },
        update: {},
      });
    } else if (!sameContent(existing, { q, options, answer })) {
      await tx.quizItem.update({
        where: { reviewItemId },
        data: { q, options, answer },
      });
    }
    const init = initialSchedule(now);
    await tx.reviewSchedule.upsert({
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
  });
}
