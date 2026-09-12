// The GO-FURTHER RIBBON: the comb at the foot of /courses that carries the four-ish
// destinations a finished learner can walk to next.
//
// Promoted from the sandbox prototype the owner picked (`/sandbox/path`, 2026-08-13),
// which was itself the lesson-top ribbon's lacing (`phase-comb.ts`) restated as ratios
// of a MEASURED cell rather than as numbers inside a fixed 48-unit drawing box. Pure
// geometry: no React, no DOM, no DB, so it unit-tests in the fast project. The
// components own the markup; this file owns the numbers.
//
// WHY THIS IS A SIBLING OF `comb-spine.ts` AND NOT A COPY OF IT. The spine is a single
// file of pointy-top hexes running DOWN the page, and it is the shape the build-guide
// hub and the skill tree already ship. This comb wants to run ACROSS: four destinations
// at the foot of a page have no vertical room, and stacking them turns a footer into a
// second scroll. So the ribbon is the same one-point camera and the same stroke system
// wearing a horizontal axis - until the column gets narrow, at which point a laced run
// of four hexes solves to a cell too small to read and the only honest move is to
// become the spine. Hence ONE module with TWO axes rather than two modules that drift.
//
// Everything the spine already states is IMPORTED, not restated. `POINTY_RATIO` is its
// `SPINE_RATIO`, `POINTY_CORNERS` is its corner set, and the spine axis places its
// boxes by calling `placeSpine` itself. That is deliberate: the first cut of the
// sandbox round restated 1.1547 and the six pointy corners locally, and the two combs
// then sat on the same page one rounding apart, which reads as a wobble rather than as
// a decision.
//
// TWO THINGS ARE LOAD-BEARING, both inherited from the spine.
//
// SCALE INVARIANCE. The camera is expressed in CELL WIDTHS, so the ribbon projects
// identically at 320px and at 1100px. A camera stated in pixels makes the phone layout
// look like a different lens.
//
// FIT. Both axes' extents are LINEAR in the cell width, so "the biggest hex that fits
// this column" is a divide rather than a search: measure the layout once per unit cell
// (`combUnits`), then solve. That is also what makes `chooseAxis` cheap enough to run
// on every resize observation - it is the same divide, compared against a floor.

import {
  layoutUnits,
  placeSpine,
  SPINE_RATIO,
  SPINE_UNIT_CORNERS,
  SPINE_VSTEP,
  SPINE_CLIP,
} from "@/lib/comb-spine";
import type { HexSolid, Pt } from "@/lib/hex-perspective";

/** Which way the run travels. `laced` across, `spine` down. */
export type CombAxis = "laced" | "spine";

/** flat-top regular hex: height / width. */
export const FLAT_RATIO = Math.sqrt(3) / 2;

/** pointy-top regular hex: height / width. The spine's own constant, imported rather
 *  than restated so the two combs on one page cannot disagree by a rounding. */
export const POINTY_RATIO = SPINE_RATIO;

/**
 * How far the prism casts on the cell FARTHEST from the vanishing point, in cell
 * widths. Owner pick, sandbox round two.
 *
 * Stated as a far-end cast for the same reason the spine states it that way: under
 * one-point the cast at a cell is proportional to that cell's distance from the
 * vanishing point, so a fixed focal/depth pair draws a hairline on a three-hex run and
 * a wedge on a nine-hex one. Pinning the far end solves the focal per layout instead.
 *
 * It is SHALLOWER than the spine's 0.23. A laced run overlaps its neighbours by a
 * quarter of a cell, so a slab that reads as a comfortable wedge on the spine's
 * edge-to-edge stack reads as a smear here, with every cell's cast crossing the cell
 * beside it. 0.15 is where the owner stopped.
 */
export const RIBBON_CAST = 0.15;

/**
 * The legibility floor for the laced run, and therefore the whole collapse rule.
 *
 * A go-further cell carries a title, a chip and a tap target. Below roughly this width
 * the title wraps to three lines inside a flat-top hex, whose usable inner box is only
 * half its height at the shoulders, and the chip drops out of the face entirely.
 *
 * The arithmetic it implies is worth stating once: four destinations lace to 3.25 cell
 * widths, so the laced axis needs about 650px of column to survive. A 1152px content
 * column is comfortably laced (and cap-bound), a 768px tablet still laces at 236px per
 * cell, and a 390px phone solves to 120px and collapses to the spine.
 */
export const RIBBON_MIN_CELL = 200;

/**
 * The cell cap. Slightly under the spine's 360 because a laced run is wider than it is
 * tall, so an uncapped cell that merely looks large on the spine looks like a banner
 * here: four cells at 354px (what a 1152px column actually solves to) is a footer as
 * tall as the section above it.
 */
export const RIBBON_MAX_CELL = 340;

/** Flat-top corners in a unit cell, clockwise from the left point. */
export const FLAT_CORNERS: Pt[] = [
  [0, 0.5],
  [0.25, 0],
  [0.75, 0],
  [1, 0.5],
  [0.75, 1],
  [0.25, 1],
];

/** Pointy-top corners in a unit cell. The spine's set, imported. */
export const POINTY_CORNERS: Pt[] = SPINE_UNIT_CORNERS;

/** flat-top neighbours sit three quarters of a width apart. */
const LACED_HSTEP = 0.75;

export interface RibbonBox {
  left: number;
  top: number;
  w: number;
  h: number;
}

export interface RibbonLayout {
  axis: CombAxis;
  boxes: RibbonBox[];
  /** the extent the run actually occupies, NOT the container it was centred in. Once
   *  the cap binds these differ, and the projection needs the former. */
  width: number;
  height: number;
  cellW: number;
}

export const combRatio = (axis: CombAxis) => (axis === "laced" ? FLAT_RATIO : POINTY_RATIO);

export const combCorners = (axis: CombAxis) =>
  axis === "laced" ? FLAT_CORNERS : POINTY_CORNERS;

/**
 * The run's extent, in multiples of one cell width.
 *
 * Laced: each extra hex steps 0.75 of a width across (the flat-top neighbour step) and
 * the run is one and a half hex heights tall, because the zig-zag drops every other
 * cell by half. Note the height does NOT depend on the count - a two-hex ribbon is
 * exactly as tall as a nine-hex one, which is why this axis costs a footer so little.
 *
 * Spine: delegated to `comb-spine.ts` outright. Restating `1.5` and the vstep here is
 * how the two combs would drift.
 */
export function combUnits(axis: CombAxis, count: number): { wu: number; hu: number } {
  if (count <= 0) return { wu: 0, hu: 0 };
  if (axis === "spine") return layoutUnits(count);
  return { wu: LACED_HSTEP * (count - 1) + 1, hu: FLAT_RATIO * 1.5 };
}

/**
 * Pick the axis for `count` cells in `availW` of column.
 *
 * Solve the laced cell width and compare it against the legibility floor: if the run
 * can lace and still be read, it laces; otherwise it collapses to the spine, which has
 * no width problem because it only ever needs 1.5 cells across.
 *
 * The comparison is deliberately against the UNCAPPED solve. The cap only ever makes
 * the cell smaller than the column allows, so applying it first could only ever push a
 * comfortable layout below the floor and collapse a comb that had room to spare.
 *
 * The guards return `spine` rather than throwing. Both degenerate cases are things a
 * real page does on its first paint: `availW` is 0 for one frame before the resize
 * observer reports, and `count` is 0 while the destination list is still loading. The
 * spine is the safe answer because it fits any column.
 */
/** The cell silhouette per axis, as a CSS clip-path. See `SPINE_CLIP` for why this
 *  exists: it clips HIT TESTING, and a laced run overlaps its neighbours even harder
 *  than the spine does. */
export const COMB_CLIP: Record<CombAxis, string> = {
  laced: "polygon(0 50%, 25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%)",
  spine: SPINE_CLIP,
};

export function chooseAxis(count: number, availW: number): CombAxis {
  if (count <= 0 || availW <= 0) return "spine";
  const { wu } = combUnits("laced", count);
  if (wu <= 0) return "spine";
  return availW / wu >= RIBBON_MIN_CELL ? "laced" : "spine";
}

/**
 * Choose the axis, solve the cell, place the boxes centred in `availW`.
 *
 * Centring is what makes `width` load-bearing rather than decorative: once the cap
 * binds, the run is narrower than the column and sits in the middle of it, so its own
 * box no longer starts at x = 0. `projectComb` reads the boxes back to find that box.
 */
export function layoutComb(count: number, availW: number): RibbonLayout {
  const axis = chooseAxis(count, availW);
  const { wu, hu } = combUnits(axis, count);
  if (count <= 0 || availW <= 0 || wu <= 0) {
    return { axis, boxes: [], width: 0, height: 0, cellW: 0 };
  }

  const cellW = Math.min(availW / wu, RIBBON_MAX_CELL);
  const h = cellW * combRatio(axis);

  if (axis === "spine") {
    // Straight through to the shipped spine, container width and all, so a collapsed
    // ribbon is not merely similar to the comb the rest of the site draws - it is that
    // comb, byte for byte.
    const { boxes } = placeSpine(count, cellW, availW);
    return { axis, boxes, width: wu * cellW, height: hu * cellW, cellW };
  }

  const pad = Math.max(0, (availW - wu * cellW) / 2);
  const boxes: RibbonBox[] = [];
  for (let i = 0; i < count; i++) {
    boxes.push({ left: pad + i * LACED_HSTEP * cellW, top: (i % 2) * 0.5 * h, w: cellW, h });
  }
  return { axis, boxes, width: wu * cellW, height: hu * cellW, cellW };
}

/**
 * The vanishing point per axis, as a fraction of the run's OWN box.
 *
 * WHY THE LACED VP IS BELOW THE RUN AND NOT AT ITS CENTRE. Laced hexes overlap by a
 * quarter of their width. Under a centre vanishing point the cells left of centre cast
 * right and the cells right of centre cast left, so roughly half the slabs are aimed
 * straight INTO the neighbour that overlaps them: the cast lands under the next hex,
 * the scene's face mask removes it, and where a slab should be there is a hairline
 * seam. Dropping the vanishing point below the run makes every cast point the same
 * way - down and slightly inward - so no slab is ever hidden by the cell it leans
 * toward. 1.6 is far enough below that even the outermost cell's cast still reads as
 * downward rather than sideways.
 *
 * The spine keeps [0.5, 0.5], the lesson ribbon's own centre convergence, because its
 * cells only TOUCH, at a seam. Nothing overlaps, so a cell above the middle can cast
 * down and one below can cast up and both stay visible. Do not "fix" the two to match.
 */
export const COMB_VP: Record<CombAxis, [number, number]> = {
  laced: [0.5, 1.6],
  spine: [0.5, 0.5],
};

/**
 * Project a measured layout in one-point perspective. Identical rule to `projectSpine`;
 * only the corner set and the vanishing point differ.
 *
 * The near faces are NOT transformed: under one-point they lie in the picture plane, so
 * each hex draws at exactly its measured box and the cell's HTML sits upright on it at
 * true size. Only the REAR face moves, scaled toward the vanishing point, and the ratio
 * is solved from the far-end cast so the slab reads the same at any count.
 *
 * THE CENTRED-RUN TRAP. The vanishing point is a fraction of the RUN's box, taken from
 * the measured boxes, not of the container the run was centred in. Those are the same
 * number until the cap binds, at which point a container-relative vanishing point sits
 * off to one side of a centred run and the whole comb casts sideways. The sandbox hit
 * this the first time a four-hex ribbon was given a full-bleed column.
 *
 * Returns `HexSolid`s so the existing `.ghp` scene CSS applies unchanged. `scale` and
 * `fit` are 1 by construction (nothing foreshortens) and `z` is 0 for every cell (every
 * near face shares a depth), which is exactly why the scene component must paint ALL
 * slabs before ANY face rather than sort by depth.
 */
export function projectComb(layout: RibbonLayout, castFar: number = RIBBON_CAST): HexSolid[] {
  const { boxes } = layout;
  if (boxes.length === 0) return [];

  const corners = combCorners(layout.axis);
  const vp = COMB_VP[layout.axis];
  let minLeft = Infinity;
  let minTop = Infinity;
  for (const b of boxes) {
    if (b.left < minLeft) minLeft = b.left;
    if (b.top < minTop) minTop = b.top;
  }
  const vx = minLeft + vp[0] * layout.width;
  const vy = minTop + vp[1] * layout.height;

  // Solve the near/far ratio from the far-end cast. The cast at a point is `(1 - r)`
  // times its distance from the vanishing point, so pinning it at the farthest corner
  // pins the whole camera.
  let maxDist = 0;
  for (const b of boxes) {
    for (const [ux, uy] of corners) {
      const d = Math.hypot(b.left + ux * b.w - vx, b.top + uy * b.h - vy);
      if (d > maxDist) maxDist = d;
    }
  }
  // A single cell centred exactly on the vanishing point would divide by zero; clamp
  // rather than special-case, and keep the far face from collapsing through the
  // vanishing point on an extreme setting.
  const r =
    maxDist > 0
      ? Math.min(0.999, Math.max(0.5, 1 - (castFar * boxes[0]!.w) / maxDist))
      : 1;

  return boxes.map((b, i) => {
    const face: Pt[] = corners.map(([ux, uy]) => [b.left + ux * b.w, b.top + uy * b.h]);
    const rear: Pt[] = face.map(([x, y]) => [vx + (x - vx) * r, vy + (y - vy) * r]);
    return {
      i,
      face,
      rear,
      centre: [b.left + b.w / 2, b.top + b.h / 2] as Pt,
      scale: 1,
      fit: 1,
      z: 0,
    };
  });
}

/** Re-exported so a caller that only imports this module can still state the spine's
 *  vertical step (the collapsed axis's own rhythm) without reaching past it. */
export { SPINE_VSTEP };
