// THE ALPHA CAROUSEL: which cells of a spine are LIT, and where the run has to sit
// so the current one is centred.
//
// The spine draws a whole course as one file. That is right for a hub page, where the
// map is the point, and wrong the moment the comb is furniture in a video or a rail
// beside a lesson: nine cells at speaking size is a wall, and the viewer only needs to
// know where they are and what is either side of them.
//
// So this windows it. Three cells carry the full treatment - previous, current, next -
// and everything else stays exactly where the spine put it, ghosted. Nothing moves to
// a different place when the window slides over it; the run is one object and the
// window is a light.
//
// WHY THE GHOSTS STAY, rather than being dropped from the layout. A run of three cells
// with no context reads as a three-stage course. The ghosts are what make it read as
// "three of nine", and they cost nothing to draw because the geometry already placed
// them. It is the same argument the chapter indicator makes with `NN / NN`, in a shape
// that does not need a number.
//
// THE EDGE CASES ARE THE OWNER'S, and they are not symmetric on purpose:
//   - no previous  -> current plus the NEXT TWO. The window keeps its size; a first
//     cell should not be shown with a hole where its predecessor would be.
//   - no next      -> previous plus the NEXT COURSE. A last stage does not dead-end,
//     it hands over, so the run spills past its own end rather than shrinking.
//
// Pure geometry: no React, no DOM, so it unit-tests in the fast project, exactly like
// `comb-spine.ts` next to it.
//
// ASCII only.

import { SPINE_RATIO, SPINE_VSTEP, type SpineBox } from "@/lib/comb-spine";

/** How many cells carry the full treatment. Three: back, here, forward. */
export const WINDOW = 3;

/** What sits beyond the end of this run, when the window runs off it. */
export type Spill = "none" | "next-course" | "prev-course";

export interface CombWindow {
  /** Indices of the lit cells, ascending. Always within [0, count). */
  lit: number[];
  /** The cell the run is centred on. */
  current: number;
  /**
   * Whether the window ran off an end, and which way.
   *
   * `next-course` is the owner's rule for a final stage: it does not dead-end, it
   * hands over, so the caller renders one more cell from the FOLLOWING course rather
   * than a short window.
   */
  spill: Spill;
}

/**
 * Which cells are lit, for a run of `count` centred on `current`.
 *
 * The window is always `WINDOW` wide where the run allows it, so it never shows a gap
 * where a neighbour would be. It is clamped rather than wrapped: a course is a
 * sequence, not a loop, and wrapping would tell a learner on stage 8 that stage 1
 * comes next.
 */
export function combWindow(count: number, current: number, size: number = WINDOW): CombWindow {
  if (count <= 0) return { lit: [], current: 0, spill: "none" };
  const cur = Math.max(0, Math.min(count - 1, Math.round(current)));
  if (count <= size) {
    return { lit: Array.from({ length: count }, (_, i) => i), current: cur, spill: "none" };
  }

  const half = Math.floor(size / 2);
  let from = cur - half;
  let spill: Spill = "none";

  if (from < 0) {
    // No previous: keep the window's width by taking more of what IS ahead.
    from = 0;
  } else if (from + size > count) {
    // No next: the run hands over to the following course rather than shrinking.
    from = count - size;
    spill = "next-course";
  }

  return {
    lit: Array.from({ length: size }, (_, k) => from + k),
    current: cur,
    spill,
  };
}

/** Is this index inside the lit window? */
export const isLit = (w: CombWindow, i: number) => w.lit.includes(i);

/**
 * How far to slide the run so the CURRENT cell's centre sits at `viewH / 2`.
 *
 * Positive moves the run down. The spine stacks on a constant `vstep`, so this is one
 * multiply rather than a lookup - and it is derived from the same two constants the
 * layout uses, so a change to the nestle ratio moves the carousel with it instead of
 * leaving it half a cell out.
 */
export function centreOffset(current: number, cellW: number, viewH: number): number {
  const h = cellW * SPINE_RATIO;
  const vstep = h * SPINE_VSTEP;
  return viewH / 2 - (current * vstep + h / 2);
}

/**
 * The alpha for a cell, given its distance from the window.
 *
 * Lit cells are full. Everything else falls away with distance rather than dropping to
 * one flat ghost value, so a long run reads as receding instead of as two groups. The
 * floor keeps the farthest cells present: a ghost at zero is a cell that is not there,
 * and then the comb stops saying "of nine".
 */
export function ghostAlpha(w: CombWindow, i: number, floor = 0.12, falloff = 0.55): number {
  if (isLit(w, i)) return 1;
  const nearest = w.lit.reduce((best, k) => Math.min(best, Math.abs(k - i)), Infinity);
  return Math.max(floor, Math.pow(falloff, nearest));
}

/**
 * The boxes for a run, sliced to the lit window.
 *
 * For callers that want ONLY the three - a video frame at speaking size, where a
 * ghosted column would be noise the encoder pays for. The boxes keep their original
 * positions, so the perspective a caller projects from them is the same perspective
 * the full run would have given.
 */
export function litBoxes(boxes: SpineBox[], w: CombWindow): SpineBox[] {
  return boxes.filter((_, i) => isLit(w, i));
}
