// Spaced-review scheduling primitives (build-order step 4). PURE: no DB, no clock
// reads (callers inject `now` and the jitter factor), so it unit-tests without a
// database and stays deterministic. The design is
// docs/plans/2026-07-21-review-deck-design.md.
//
// Identity: a reviewable question carries an authored `reviewId`. The schedule keys
// on `reviewItemId = <projectSlug>:<stage>:<reviewId>`, which is revision-INDEPENDENT
// (no revLabel) so a concept survives a revision bump, globally unique (scoped by
// project + stage), and decoupled from `questionKey` so adding a `reviewId` never
// perturbs the shipped XP ledger.
import { academyDate } from "@/lib/logbook/economy";

/** Fixed expanding ladder (days). Graduates past the top by x2.5. */
export const REVIEW_LADDER = [1, 3, 7, 21, 60] as const;
const LADDER: readonly number[] = REVIEW_LADDER;

// Repeated lapses on the same item make it a "leech"; suspend rather than re-drill
// it forever.
const LEECH_THRESHOLD = 8;
// A miss steps the interval DOWN toward the floor, not a full reset to 1 (interval
// over-reset amplifies MCQ noise and burns the daily cap).
const LAPSE_FACTOR = 0.4;
const GRADUATE_FACTOR = 2.5;

const MS_PER_DAY = 86_400_000;

export function reviewItemId(
  projectSlug: string,
  stage: string,
  reviewId: string,
): string {
  return `${projectSlug}:${stage}:${reviewId}`;
}

// Library (mini-lesson) reviewable item id. A distinct `lib:` prefix + the lesson
// slug keeps it from ever colliding with a guide item id (`<project>:<stage>:<id>`),
// and library lessons carry no stage.
export function libraryReviewItemId(slug: string, reviewId: string): string {
  return `lib:${slug}:${reviewId}`;
}

export type ScheduleState = {
  intervalDays: number;
  lapses: number;
  suspended: boolean;
};

export type ScheduleAdvance = {
  intervalDays: number;
  dueOn: Date;
  lapses: number;
  suspended: boolean;
};

/** The next rung above `current`; past the top rung, grow by GRADUATE_FACTOR. */
function nextUp(current: number): number {
  const above = LADDER.find((r) => r > current);
  return above ?? Math.round(current * GRADUATE_FACTOR);
}

function dueAfter(now: Date, intervalDays: number): Date {
  return new Date(academyDate(now).getTime() + intervalDays * MS_PER_DAY);
}

/**
 * The schedule at an item's FIRST encounter (the in-lesson stage-quiz answer, not a
 * review). Forward-only creation: due one ladder-step out.
 */
export function initialSchedule(now: Date): ScheduleAdvance {
  const intervalDays = LADDER[0]!;
  return { intervalDays, dueOn: dueAfter(now, intervalDays), lapses: 0, suspended: false };
}

/**
 * Advance a schedule after a REVIEW answer. Correct climbs the ladder; a miss steps
 * down and counts a lapse (suspending as a leech past LEECH_THRESHOLD). `jitter` in
 * ~[0.85, 1.15] fuzzes the interval so items seeded together do not clump on one
 * future day; tests pass 1 for determinism. A suspended item stays suspended.
 */
export function advanceSchedule(
  prev: ScheduleState,
  correct: boolean,
  now: Date,
  jitter: number,
): ScheduleAdvance {
  const base = correct ? nextUp(prev.intervalDays) : Math.max(1, Math.round(prev.intervalDays * LAPSE_FACTOR));
  const intervalDays = Math.max(1, Math.round(base * jitter));
  const lapses = correct ? prev.lapses : prev.lapses + 1;
  const suspended = prev.suspended || (!correct && lapses >= LEECH_THRESHOLD);
  return { intervalDays, dueOn: dueAfter(now, intervalDays), lapses, suspended };
}

/** The jitter factor for a live advance (callers inject Math.random()). */
export function jitterFactor(rand: number): number {
  return 1 + (rand * 0.3 - 0.15); // ~[0.85, 1.15]
}
