// The Logbook economy: every amount, curve, and key in ONE tunable module
// (design §5/§7/§13). Pure — no DB, no clock reads (callers inject `now`).
import type { Stage } from "@prisma/client";

export const XP = {
  QUIZ_FULL: 5,
  QUIZ_REPOP: 2,
  LESSON_PER_MIN_FULL: 3,
  LESSON_PER_MIN_REPOP: 1,
  FEEDBACK_SUBMIT: 2,
  FEEDBACK_USEFUL: 25,
  // Cross-session review correct answer (step 4). Small on purpose: the deck exists
  // for retention, not grinding, and the once-per-due-cycle dedupe (below) caps it.
  REVIEW_CORRECT: 2,
} as const;
export const CLUSTER_XP = 100;
export const LIBRARY_XP = 500;
export const FEEDBACK_DAILY_CAP = 3; // max FEEDBACK_SUBMIT XP awards per academy day
export const FEEDBACK_ROW_DAILY_LIMIT = 10; // hard flood guard on feedback ROWS/day
export const CURRENT_WINDOW_DAYS = 14;

// Course (build-guide) XP — Phase 2 (design 2026-07-11). Stage quizzes reuse the
// library QUIZ_FULL/QUIZ_REPOP amounts; these are the once-ever milestone awards.
// STAGE_CLEAR_XP is the legacy flat award, kept as the graduated table's fallback
// for any stage not listed (e.g. REVISION) — see stageClearXp below.
export const STAGE_CLEAR_XP = 20;
export const COURSE_EXAM_XP = 150;
export const COURSE_COMPLETE_XP = 300;

// Graduated stage-clear XP (WI-1, 2026-07-18): the hard, verifiable stages pay more
// than the read stages. The design-stage gates already REQUIRE the proof artifact to
// advance (ERC=0 for SCHEMATIC, DRC=0 + attestation for LAYOUT), so a bigger award
// here is already tied to producing verified work. Keyed by the FROM stage (the one
// just cleared); stages absent from the table (REVISION) fall back to STAGE_CLEAR_XP.
// Typed Record<Stage, number> (not Record<string, …>): every Stage MUST appear,
// so adding a stage to the Prisma enum breaks the build here instead of silently
// paying the STAGE_CLEAR_XP fallback. REVISION is the terminal stage (nothing
// clears out of it), listed explicitly at the base value so the map is
// exhaustive and there is no silent `??` gap.
export const STAGE_CLEAR_XP_BY_STAGE: Record<Stage, number> = {
  REQUIREMENTS: 10,
  BOM_SOURCING: 15,
  SCHEMATIC: 40, // ERC=0 gate
  LAYOUT: 60, // DRC=0 + attestation — the hardest stage
  DRC_GERBER: 25,
  ORDERING: 30, // the leap to a physical order
  ASSEMBLY: 40,
  BRINGUP: 60, // "it works" payoff
  REVISION: STAGE_CLEAR_XP, // terminal — never actually cleared FROM
};
export const stageClearXp = (stage: string): number =>
  STAGE_CLEAR_XP_BY_STAGE[stage as Stage] ?? STAGE_CLEAR_XP;

// The flight-training ladder (design §8; 12 ranks / 6 wing tiers, owner 2026-07-11).
// Front-loaded: fast early levels, widening toward the top. Top (FL12) ≈ finishing
// the library plus several build courses (~7.6k first-time XP). Tunable on-screen.
//
// Rebalanced 2026-07-18 (WI-1): graduated STAGE_CLEAR raised a full course from ~160
// to ~280 stage-clear XP (≈ +120/course), so the upper band (FL6–FL12) is widened to
// keep "library + several courses = FL12" and preserve the widening-toward-the-top
// shape. FL1–FL5 are LEFT UNCHANGED on purpose: the early on-ramp pace is untouched,
// and — since level recompute is increment-only (award.ts) and no real account sits
// past FL5 — nobody is demoted. (The only fresh-recompute surface is the public
// certificate flair, verify/page.tsx; it re-derives from xpTotal.)
export const LEVELS = [
  { level: 1, minXp: 0, title: "Ground School" },
  { level: 2, minXp: 50, title: "First Solo" },
  { level: 3, minXp: 150, title: "Cross-Country" },
  { level: 4, minXp: 350, title: "Private Pilot" },
  { level: 5, minXp: 650, title: "Night Rated" },
  { level: 6, minXp: 1100, title: "Instrument Rated" },
  { level: 7, minXp: 1700, title: "Commercial" },
  { level: 8, minXp: 2400, title: "Multi-Engine" },
  { level: 9, minXp: 3300, title: "Flight Instructor" },
  { level: 10, minXp: 4500, title: "Instrument Instructor" },
  { level: 11, minXp: 5900, title: "Airline Transport" },
  { level: 12, minXp: 7600, title: "Examiner" },
] as const;

export function levelFor(xpTotal: number) {
  let cur: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xpTotal >= l.minXp) cur = l;
  const next = LEVELS.at(cur.level) ?? null; // index = level (1-based levels)
  return { ...cur, next };
}

// The rank-emblem wing tier (1-6) for a level — the 6 wing designs each cover 2
// ranks (design 2026-07-11), so the wings graduate every second level. Drives the
// rank/wings art. FL1-2 → 1, FL3-4 → 2, ..., FL11-12 → 6.
export function wingTier(level: number): number {
  return Math.min(6, Math.max(1, Math.ceil(level / 2)));
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
  // Review award is once per DUE CYCLE, not per day: the key embeds the cycle's
  // dueOn (the day the item was due when answered), so a still-due item cannot be
  // farmed once per calendar day. `dueDay` is academyDay(dueOn).
  review: (userId: string, reviewItemId: string, dueDay: string) =>
    `REVIEW_CORRECT:${userId}:${reviewItemId}:${dueDay}`,
} as const;
