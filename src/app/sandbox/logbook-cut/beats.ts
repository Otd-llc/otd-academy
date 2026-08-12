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

/** How the real components are staged. See LogbookLive.
 *
 *  ROUND ONE: page / rail / emblem. ROUND TWO is three readings of "B and C"
 *  together (owner, 2026-08-11), which is a real question rather than a
 *  splitting of the difference: B's claim is CONTINUITY (one surface, no cuts,
 *  the product does the work) and C's is AUSTERITY (film scale, no page around
 *  it). Those can be combined by stripping the chrome off the continuous
 *  surface, by moving from one to the other across the clip, or by running both
 *  registers at once - and they look nothing like each other. */
export type Arrangement =
  | "page"
  | "rail"
  | "emblem"
  | "strip"
  | "morph"
  | "split"
  | "arc"
  | "quiet";

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

// ---- round three: E, with the lesson at the front --------------------------
//
// THE STORY ARC, owner 2026-08-11: you do lessons in the Library, you gain XP,
// you gain rank, and there are patches. So bar one stops being an empty
// establishing bar and becomes the thing that causes everything after it - a
// quiz being answered, correctly, one question at a time.
//
// THE QUESTIONS ARE THE REAL ONES, parsed out of the lesson's own contentBlocks,
// and the component answering them is the real `QuizBlock`. That is safe to
// drive because QuizBlock only touches the server when it is handed a `context`
// (the stage gate) or a `logbook` (the XP wiring); with neither it is a pure
// self-check, which is exactly the "editor preview" case its own header calls
// out. Every pick below is a real click on a real option.
//
// WHY LIBRARY QUIZ QUESTIONS AND NOT EXAM ONES. A mini-lesson's quiz is already
// on a public page - anyone reading the lesson sees it - so putting one in a
// promo shows the free thing off. Exam banks are the opposite: their answer
// keys gate the /verify certificates. Nothing here reads an Exam.

/** How the four downbeats map to the owner's arc. Bar one is the lesson now, so
 *  the words move up: the XP the quiz paid, the rank it bought, the wall it
 *  belongs to, and the one patch that lands. */
export function arcSheet(nQuestions: number) {
  const quiz = nQuestions * QUIZ_XP;
  const award = quiz + READ_XP;
  /** Derived BACKWARDS from the threshold, so the ring closing, the chip
   *  flipping and the last XP landing are all the same instant rather than
   *  three things that nearly line up. */
  const before = XP_AFTER - award;
  const beats: Beat[] = [
    {
      at: 2.0,
      word: "XP",
      line: `${QUIZ_XP} a question, ${READ_XP} for the read. That lesson paid ${award}.`,
    },
    {
      at: 4.0,
      word: "RANK",
      line: `${num(XP_AFTER)} XP is ${AFTER.title}, ${AFTER.level} of ${LEVELS.length}. ${TOP.title} is ${num(TOP.minXp)}.`,
    },
    {
      at: 6.0,
      word: "PATCHES",
      line: `Six clusters, six patches. One for finishing each of them.`,
    },
    {
      at: 8.0,
      word: "EARNED",
      // One line, not two. The longer version wrapped and orphaned "it."
      line: `${PATCH.label}. Every lesson in the cluster, plus ${PATCH.xp} XP.`,
    },
  ];
  // On the half-beats of bar one at 120 BPM, which is where the ear expects
  // them. The last lands at 1.6 so it has cleared before the downbeat.
  const ticks = Array.from({ length: nQuestions }, (_, i) =>
    nQuestions === 1 ? 1.0 : 0.5 + (i * 1.1) / (nQuestions - 1),
  );
  return { quiz, award, before, beats, ticks };
}

/** The film answers at most three questions. Not a data limit - a bar limit:
 *  four half-beats is what bar one has, and a fourth tick would land on the
 *  downbeat the word needs. */
export const ARC_MAX_Q = 3;

export const ARC: { id: Arrangement; label: string; note: string } = {
  id: "arc",
  label: "E+ / the lesson, then the morph",
  note:
    "E unchanged from 2.0 on - the rail scaling, shedding its text column, ending as a halo behind the patch - with bar one now carrying the cause rather than establishing. The real QuizBlock, the lesson's real questions, answered correctly on the half-beats, five XP each, and the read award landing on the downbeat exactly as the total crosses into FL6.",
};

// ---- round four: one thing at a time ---------------------------------------
//
// "Too much going on" (owner, 2026-08-11). Every round so far put two or three
// things in a frame and asked the eye to rank them. This one holds exactly one
// subject per beat, four words, and NO second line under any of them.
//
// THE ONE CLICK CROSSES THE THRESHOLD, which is why a single question is enough
// to justify what the ring does next. `before` is derived backwards off the FL6
// floor by one quiz award, so answering one question really is the five XP that
// takes 1,095 to 1,100. Nothing is inflated to make the beat land.
export const QUIET_BEFORE = XP_AFTER - QUIZ_XP;

/** Four words, no sub-lines. The `line` field is kept empty rather than removed
 *  so the type layer stays one component; `bare` is what suppresses it. */
export const QUIET_BEATS: Beat[] = [
  { at: 2.0, word: "READ", line: "" },
  { at: 4.0, word: "GAIN", line: "" },
  { at: 6.0, word: "RANK", line: "" },
  { at: 8.0, word: "PATCHES", line: "" },
];

/** When the single answer lands. Half a bar in: late enough that the question
 *  has been read, early enough that the tick clears before the word. */
export const QUIET_CLICK = 1.0;

export const QUIET: { id: Arrangement; label: string; note: string } = {
  id: "quiet",
  label: "G / one thing at a time",
  note:
    "One subject per beat and four words with nothing under them. A single real question, one click, five XP; the quiz dissolves rightward as READ lands. The ring draws itself and the rank changes on GAIN. The ladder spins in and settles on RANK. On PATCHES a locked patch waits, then flips to gold. The running index is gone too - it was one more thing on screen.",
};

export const COMBOS: { id: Arrangement; label: string; note: string }[] = [
  {
    id: "strip",
    label: "D / the rail, stripped",
    note:
      "B's choreography at C's scale. The standing rail never leaves and never cuts, but its text column is switched off and the ring runs at film size, so what persists is the ring, the wing and the FL chip - which is the emblem C was reaching for, except it is the real component still keeping score. The type says the title and the total, because the rail no longer does.",
  },
  {
    id: "morph",
    label: "E / product becomes insignia",
    note:
      "B first, C last, in one continuous move rather than a cut. Beat one is the rail at product size with its text column on, and it reads as a screenshot on purpose. Across the next two bars it scales up and sheds the text, and by 8.0 the ring is a halo behind the patch. The clip argues that the badge came out of the product, because you watch it happen.",
  },
  {
    id: "split",
    label: "F / two registers at once",
    note:
      "The rail sits small in the corner keeping score for the whole clip - B's promise, kept literally - while the beat plays large beside it at C's scale: the tick, the wing, the ladder, the patch. Nothing ever replaces anything. The cost is that neither register gets the whole frame, so the ladder is the five-rank rolodex here rather than all twelve.",
  },
];
