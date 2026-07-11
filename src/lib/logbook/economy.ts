// The Logbook economy: every amount, curve, and key in ONE tunable module
// (design §5/§7/§13). Pure — no DB, no clock reads (callers inject `now`).

export const XP = {
  QUIZ_FULL: 5,
  QUIZ_REPOP: 2,
  LESSON_PER_MIN_FULL: 3,
  LESSON_PER_MIN_REPOP: 1,
  FEEDBACK_SUBMIT: 2,
  FEEDBACK_USEFUL: 25,
} as const;
export const CLUSTER_XP = 100;
export const LIBRARY_XP = 500;
export const FEEDBACK_DAILY_CAP = 3; // max FEEDBACK_SUBMIT XP awards per academy day
export const FEEDBACK_ROW_DAILY_LIMIT = 10; // hard flood guard on feedback ROWS/day
export const CURRENT_WINDOW_DAYS = 14;

// Course (build-guide) XP — Phase 2 (design 2026-07-11). Stage quizzes reuse the
// library QUIZ_FULL/QUIZ_REPOP amounts; these are the once-ever milestone awards.
export const STAGE_CLEAR_XP = 20;
export const COURSE_EXAM_XP = 150;
export const COURSE_COMPLETE_XP = 300;

// The flight-training ladder (design §8). Front-loaded: fast early levels.
export const LEVELS = [
  { level: 1, minXp: 0, title: "Ground School" },
  { level: 2, minXp: 50, title: "First Solo" },
  { level: 3, minXp: 200, title: "Cross-Country" },
  { level: 4, minXp: 600, title: "Instrument" },
  { level: 5, minXp: 1300, title: "Commercial" },
  { level: 6, minXp: 2400, title: "Flight Instructor" },
] as const;

export function levelFor(xpTotal: number) {
  let cur: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xpTotal >= l.minXp) cur = l;
  const next = LEVELS.at(cur.level) ?? null; // index = level (1-based levels)
  return { ...cur, next };
}

/** The academy-local (America/Chicago) calendar day for `now`, as yyyy-mm-dd. */
export function academyDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA renders yyyy-mm-dd
}

/** The same academy day as a Date (00:00Z) — the ONE derivation both
 * `XpEvent.earnedOn` and `QuizLock.lockedOn` use, so they can never disagree. */
export function academyDate(now: Date): Date {
  return new Date(`${academyDay(now)}T00:00:00Z`);
}

export const quizXp = (o: { firstEver: boolean }) =>
  o.firstEver ? XP.QUIZ_FULL : XP.QUIZ_REPOP;
export const lessonXp = (readMin: number, o: { firstEver: boolean }) =>
  Math.max(1, readMin) *
  (o.firstEver ? XP.LESSON_PER_MIN_FULL : XP.LESSON_PER_MIN_REPOP);

export const dedupe = {
  quizCorrect: (userId: string, qKey: string, now: Date) =>
    `QUIZ_CORRECT:${userId}:${qKey}:${academyDay(now)}`,
  lessonComplete: (userId: string, slug: string, now: Date) =>
    `LESSON_COMPLETE:${userId}:${slug}:${academyDay(now)}`,
  clusterComplete: (userId: string, clusterKey: string) =>
    `CLUSTER_COMPLETE:${userId}:${clusterKey}`,
  libraryComplete: (userId: string) => `LIBRARY_COMPLETE:${userId}`,
  feedbackSubmit: (userId: string, pageRef: string) =>
    `FEEDBACK_SUBMIT:${userId}:${pageRef}`,
  feedbackUseful: (feedbackId: string) => `FEEDBACK_USEFUL:${feedbackId}`,
  // Course (build-guide) sources — Phase 2. Stage-quiz is daily (repop); the rest
  // are once-ever. `qKey` is a guide questionKey (guide:<slug>:<rev>:<stage>#<id>).
  stageQuiz: (userId: string, qKey: string, now: Date) =>
    `STAGE_QUIZ_CORRECT:${userId}:${qKey}:${academyDay(now)}`,
  stageClear: (userId: string, slug: string, stage: string) =>
    `STAGE_CLEAR:${userId}:${slug}:${stage}`,
  courseExam: (userId: string, slug: string) =>
    `COURSE_EXAM_PASS:${userId}:${slug}`,
  courseComplete: (userId: string, slug: string) =>
    `COURSE_COMPLETE:${userId}:${slug}`,
} as const;
