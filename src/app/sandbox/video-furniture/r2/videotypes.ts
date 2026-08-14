// THE SIX VIDEO TYPES, and the rule that stops the sandbox becoming a museum.
//
// The 127 planned videos are not one kind of thing. They are six, and their
// furniture needs differ sharply - a tutorial wants a step counter and a
// build-along wants a timer, a progress bar and a "pause here" card that
// nothing in this sandbox has built. Deciding which of the 127 is which, BEFORE
// production, is what makes the furniture spec finite.
//
// TABS ARE THE TYPES, AND THEY DO NOT ACCUMULATE. The convention is that a
// direction is deleted once it has been taken: it lives in the commit, not in
// the sandbox. Letting rounds pile up is how a sandbox becomes a second product
// with nobody owning it, and round 1's deletion was the last reminder.
//
// The convention used to be prose in a plan, which is the form a rule takes
// right before it erodes. Here it is two structural facts instead:
//
//   1. `VideoType` is a CLOSED UNION of the research's six. A seventh tab is a
//      type error, so adding one is a claim about the channel that shows up in
//      review rather than a new page that shows up in a directory listing.
//   2. `assertNoAccumulation` fails if a type has taken a direction and kept
//      its losers, or is auditioning more than three at once. `furniture:check`
//      runs it, so "we said we would delete the old tab" is now something that
//      breaks the build rather than something somebody remembers.
//
// ASCII only.

import type { PieceKey } from "./variants";
import { DEFAULT_ENTRY, HAIRLINE_ENTRY, type EntryEffect } from "./entries";

export type VideoType =
  | "explainer"
  | "walkthrough"
  | "tutorial"
  | "build-along"
  | "technique"
  | "troubleshoot";

/** One audition. Not a taxonomy entry - a thing that gets deleted when it loses. */
export type Direction = {
  id: string;
  /** What this direction believes, in one line. */
  note: string;
  entry: EntryEffect[];
};

/**
 * WHICH TYPES SHIP VERTICAL, and why it is not all of them.
 *
 * Owner's decision, recorded here because it is a content judgement that the
 * furniture has to obey rather than a furniture judgement: THE COURSE VIDEOS
 * ARE 16:9 ONLY. A tutorial, a build-along and a walkthrough cover small things
 * - a pad, a via, a net name, a menu - that need a big screen to see and
 * follow, so a vertical cut would be legible as video and useless as
 * instruction. The short forms - explainer, technique demo, troubleshooting -
 * do ship vertical, because an explanation survives the crop where a procedure
 * does not.
 *
 * This is load-bearing for the furniture: research 5 says a vertical clip must
 * DROP most furniture rather than reflow it, and now only three of the six
 * types ever have to.
 */
export type TypeSpec = {
  id: VideoType;
  name: string;
  /** The furniture consequence, from the research. */
  furniture: string;
  /** Pieces this type actually uses. The round renders only these. */
  pieces: PieceKey[];
  /** Delivery shapes. A vertical DROPS furniture rather than reflowing it, so
   *  this scopes the set; it does not resize it. */
  shapes: ("16:9" | "9:16")[];
  /** Furniture this type needs that we have NOT built. Named so the gap is
   *  visible in the tab instead of discovered in production. */
  missing: string[];
  directions: Direction[];
  /** Set when a direction is taken. Its losers must then be gone. */
  taken?: string;
};

const baseline: Direction = {
  id: "d1",
  note: "The set as it stands: a dissolve on the whole piece, nothing choreographed.",
  entry: DEFAULT_ENTRY,
};

export const TYPES: Record<VideoType, TypeSpec> = {
  explainer: {
    id: "explainer",
    name: "Explainer",
    furniture: "Diagrams, no step counter. The chapter indicator does the segmenting.",
    pieces: ["intro", "section", "lower", "outro", "chapter"],
    shapes: ["16:9", "9:16"],
    missing: [],
    directions: [baseline],
  },
  walkthrough: {
    id: "walkthrough",
    name: "Walkthrough",
    furniture: "Cursor highlight and callouts, no step counter - it is a tour, not a procedure.",
    pieces: ["intro", "section", "lower", "outro", "chapter"],
    // 16:9 only: a walkthrough is a tour of a real screen, and the screen does
    // not fit a phone any better than the procedure does.
    shapes: ["16:9"],
    missing: ["cursor highlight", "callout pointer"],
    directions: [baseline],
  },
  tutorial: {
    id: "tutorial",
    name: "Tutorial",
    furniture: "Step counter, and chapters ARE the steps - the two must not disagree.",
    pieces: ["intro", "section", "lower", "outro", "chapter"],
    // 16:9 ONLY. Owner's call, and it is about the CONTENT rather than the
    // furniture: a course video covers small things - a pad, a via, a net name -
    // that need a big screen to see and follow. A vertical cut of one would be
    // legible as video and useless as instruction. The short forms below can
    // ship vertical because they are explanations, not procedures.
    shapes: ["16:9"],
    missing: ["step counter"],
    directions: [
      baseline,
      {
        id: "d2",
        note: "The hairline set, choreographed: rule first, type a beat later. Timing is data, so this is one stack rather than ten hand-tuned windows.",
        entry: HAIRLINE_ENTRY,
      },
    ],
  },
  "build-along": {
    id: "build-along",
    name: "Build-along",
    furniture:
      "Everything a tutorial has, plus pause-here cards, a progress bar, a real-time versus speed-up label and a timer. The heaviest type by a distance.",
    pieces: ["intro", "section", "lower", "outro", "chapter"],
    // 16:9 only, for the same reason as the tutorial and more so.
    shapes: ["16:9"],
    missing: ["pause-here card", "progress bar", "real-time / speed-up label", "timer"],
    directions: [baseline],
  },
  technique: {
    id: "technique",
    name: "Technique demo",
    furniture: "Macro insert, spec chip, before/after. Short, and the lower third carries the spec.",
    pieces: ["intro", "lower", "outro", "chapter"],
    shapes: ["16:9", "9:16"],
    missing: ["macro insert frame", "before/after wipe"],
    directions: [baseline],
  },
  troubleshoot: {
    id: "troubleshoot",
    name: "Troubleshooting",
    furniture: "A symptom -> cause -> fix card triad. The gate states already exist as lower thirds.",
    pieces: ["intro", "lower", "outro", "chapter"],
    // Short enough to travel: a symptom and its fix is an explanation.
    shapes: ["16:9", "9:16"],
    missing: ["symptom / cause / fix triad"],
    directions: [baseline],
  },
};

export const TYPE_KEYS = Object.keys(TYPES) as VideoType[];

/**
 * The non-accumulation rule, as a check rather than as a habit.
 *
 * Returns the problems rather than throwing, so `furniture:check` can report
 * every offender in one run instead of stopping at the first.
 */
export function assertNoAccumulation(): string[] {
  const problems: string[] = [];
  for (const t of Object.values(TYPES)) {
    if (t.taken) {
      const kept = t.directions.map((d) => d.id);
      if (kept.length !== 1 || kept[0] !== t.taken) {
        problems.push(
          `${t.id}: direction "${t.taken}" was taken but ${kept.length} are still here (${kept.join(", ")}) - the losers live in the commit, not the sandbox`,
        );
      }
    } else if (t.directions.length > 3) {
      problems.push(`${t.id}: ${t.directions.length} directions is a catalogue, not an audition`);
    }
    if (t.directions.length === 0) problems.push(`${t.id}: no directions at all`);
  }
  return problems;
}
