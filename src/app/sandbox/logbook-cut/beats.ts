// SANDBOX - the cut sheet for a Library gamification film. DEV ONLY.
//
// A PLAIN MODULE, so a server component gets values rather than client refs.
//
// EVERY NUMBER IS READ OUT OF src/lib/logbook/economy.ts. Not one of them is
// typed here as a literal the economy already owns: the per-minute read rate,
// the quiz award, the cluster award, the twelve rank titles and their
// thresholds all come from the real module. A gamification film whose XP totals
// were invented for a nice frame is a film that contradicts the product on the
// first screenshot someone compares it to, and this ladder has already been
// rebalanced once (WI-1, 2026-07-18) - reading it means a future rebalance
// MOVES the film rather than dating it.
//
// ONE CORRECTION TO THE BRIEF, made in the copy rather than argued around.
// "Ranks earn badges" is not what the code does. Every badge in patches.ts is
// earned by FINISHING LESSONS - a cluster patch for a cluster, Wings for the
// whole library - and nothing is gated on a rank. So beat four lands the
// Fundamentals patch on its REAL condition, quoting ROADMAP_PATCHES' own
// howToEarn string, instead of implying a rank -> badge link that does not
// exist. What the film can honestly claim is the shape it already had: lessons
// pay XP, XP moves the rank, and the same lessons fill the patch wall.
//
// ASCII only.

import {
  CLUSTER_XP,
  LEVELS,
  XP,
  lessonXp,
  levelFor,
  quizXp,
} from "@/lib/logbook/economy";
import { ROADMAP_PATCHES, artForBadge } from "@/lib/logbook/patches";

/** How the real components are staged. See LogbookLive. */
export type Arrangement = "page" | "rail" | "emblem";

export const SECONDS = 10;
/** The reveal is armed slightly BEFORE the downbeat so its first frames are
 *  spent by the time the word lands. Same lead ClusterLive carries. */
export const LEAD = 0.35;

export const num = (n: number) => n.toLocaleString("en-US");

// ---- the arithmetic the film shows -----------------------------------------
//
// One lesson, read once, at the FIRST-EVER rate. 7 minutes is an ordinary
// mini-lesson; the two awards are the real functions rather than a plausible
// number, so `26` below is computed and not asserted.
const READ_MIN = 7;
export const READ_XP = lessonXp(READ_MIN, { firstEver: true });
export const QUIZ_XP = quizXp({ firstEver: true });
export const AWARD = READ_XP + QUIZ_XP;

/** The crossing is placed EXACTLY on a threshold, so the ring closing and the
 *  chip flipping are the same event rather than two things that nearly line up.
 *  The before-total is therefore derived backwards from it. */
export const XP_AFTER = LEVELS[5].minXp;
export const XP_BEFORE = XP_AFTER - AWARD;
export const BEFORE = levelFor(XP_BEFORE);
export const AFTER = levelFor(XP_AFTER);
export const TOP = LEVELS[LEVELS.length - 1];

/** Where inside its own rank band a total sits, 0..1 - the same expression the
 *  real /logbook page feeds StandingRail. */
export function bandPct(xp: number, level: number) {
  const min = LEVELS[level - 1]?.minXp ?? 0;
  const next = LEVELS[level]?.minXp ?? null;
  if (next === null) return 1;
  return Math.max(0, Math.min(1, (xp - min) / (next - min)));
}

const FUND = ROADMAP_PATCHES.find((p) => p.key === "cluster:fundamentals");
if (!FUND) throw new Error("no cluster:fundamentals patch - the catalog moved");

/** The badge that lands on 8.0, with its real earn condition and real award. */
export const PATCH = {
  key: FUND.key,
  label: FUND.label,
  howToEarn: FUND.howToEarn,
  art: artForBadge(FUND.key),
  xp: CLUSTER_XP,
};

// ---- the sheet --------------------------------------------------------------

export type Beat = {
  /** Downbeat, seconds. 120 BPM, five bars, cues on 2/4/6/8. */
  at: number;
  /** One hard word, the way the film uses one word. */
  word: string;
  /** What it means, with the number in it. One line, no hedging. */
  line: string;
};

export const BEATS: Beat[] = [
  {
    at: 2.0,
    word: "READ",
    line: `${XP.LESSON_PER_MIN_FULL} XP a minute, ${QUIZ_XP} more for the quiz. That lesson paid ${AWARD}.`,
  },
  {
    at: 4.0,
    word: "CLIMB",
    line: `${num(XP_AFTER)} XP is ${AFTER.title}. Those ${AWARD} were the difference.`,
  },
  {
    at: 6.0,
    word: "RANK",
    line: `${LEVELS.length} levels, ${LEVELS[0].title} to ${TOP.title}. ${num(TOP.minXp)} XP to the top.`,
  },
  {
    at: 8.0,
    word: "PATCH",
    line: `${PATCH.howToEarn}. Worth ${PATCH.xp} on its own.`,
  },
];

export const LABEL = "The Logbook";
export const PAYOFF = "academy.onethousanddrones.com/library";

/** Beat i is up from here. Beat one is up from frame zero: bar one establishes
 *  with the picture already on, and only the WORD waits for the downbeat. */
export const armAt = (i: number) => (i === 0 ? 0 : BEATS[i].at - LEAD);

export const ARRANGEMENTS: { id: Arrangement; label: string; note: string }[] = [
  {
    id: "page",
    label: "A / the surfaces, filmed",
    note:
      "The product as it ships, cut per beat: the /learn Library strip, the /logbook standing rail, the rank ladder, and the real Fanfare banner dropping in on 8.0. Most honest to what a learner sees, and the one carrying the most chrome it did not choose - a resume link, a dismiss X, a View in Logbook.",
  },
  {
    id: "rail",
    label: "B / one rail, four moments",
    note:
      "No cuts. The standing rail holds the middle for the whole clip and each beat changes exactly one thing in it: the tick lands, the ring closes and the wing flips FL5 to FL6, the ladder unrolls beside it, the patch arrives. The camera never moves; the product does the work.",
  },
  {
    id: "emblem",
    label: "C / emblem space",
    note:
      "The same real components with every page around them removed: the tick, the wing, the twelve-wing ladder and the patch, at film scale on deep space. The type carries the story and the components are the picture. Furthest from the product, closest to a title sequence.",
  },
];
