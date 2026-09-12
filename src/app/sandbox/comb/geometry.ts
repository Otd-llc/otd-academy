// SANDBOX geometry — vertical comb layouts + a ONE-POINT projection for them.
//
// The shipped grid combs (build-guide hub, /courses skill tree) are THREE-point
// (`lib/hex-perspective.ts`, camera S5). The lesson-top ribbon (`lib/phase-comb.ts`)
// is ONE-point: the hex faces stay parallel to the picture plane, so nothing is
// foreshortened and only the prism DEPTH converges, on a single vanishing point.
//
// This module carries that one-point rule over to an arbitrary measured layout, and
// adds the two vertical layout families under test:
//
//   "ribbon" — single file, pointy-top, laced edge to edge, alternating left/right.
//              The lesson ribbon's lacing, turned ninety degrees.
//   "comb2"  — the shipped tessellated grid at a portrait count-per-row.
//
// Pure geometry: no React, no DOM. Two things are load-bearing here.
//
// SCALE INVARIANCE. Focal length and prism depth are expressed in CELL WIDTHS, so a
// comb projects identically at 320px and at 900px. `phase-comb.ts` states them in the
// ribbon's own 48-unit drawing space, which is the same numbers wearing a fixed size.
//
// FIT. Both families' extents are LINEAR in the cell width, so "the biggest hex that
// fits this box" is a divide rather than a search: measure the layout once per unit
// cell (`layoutUnits`), then solve. That is what lets the round offer a fit mode that
// fills the viewport height instead of only the container width.

import type { HexSolid, Pt } from "@/lib/hex-perspective";

/** regular pointy-top: height / width. Same constant the shipped comb uses. */
export const RATIO = 1.1547;

/** rows nestle by a quarter of a hex height. */
export const VSTEP = 0.75;

export type Box = { left: number; top: number; w: number; h: number };

/** Pointy-top corners in a unit cell — the same six the shipped comb is cut from. */
export const HEX_UNIT_CORNERS: Pt[] = [
  [0.5, 0],
  [1, 0.25],
  [1, 0.75],
  [0.5, 1],
  [0, 0.75],
  [0, 0.25],
];

/** Edge length of a pointy-top hex, as a share of its width. Across-flats is the
 *  width, so the circumradius (and therefore the edge) is w/√3. */
export const HEX_EDGE = 1 / Math.sqrt(3);

/**
 * Stroke weights, as a share of the CELL WIDTH, taken from the lesson-top ribbon.
 *
 * That comb draws its hexes in a 48-unit box and strokes them at 1.1 / 0.5 / 0.4 for
 * the face, the prism sides and the inset rim, and the svg is scaled to the rendered
 * cell, so those are ratios wearing fixed numbers. Restating them as ratios is the
 * fix for the round's first cut, which stroked everything at a flat 3px: right on a
 * 300px cell, and a third of a hex thick once the fit solve dropped a sixteen-course
 * spine to 90px cells.
 *
 * A floor keeps the outline from disappearing entirely at the smallest sizes; a
 * hairline is thin, not absent.
 */
export const STROKE = {
  face: 1.1 / 48,
  side: 0.5 / 48,
  floor: 0.55,
} as const;

export const strokeFor = (part: "face" | "side", cellW: number, mult = 1) =>
  Math.max(STROKE.floor * Math.min(1, mult), STROKE[part] * cellW * mult);

export type Family = "ribbon" | "grid";

export interface LayoutSpec {
  family: Family;
  /** grid only: cells across. Ignored by the ribbon, which is single file. */
  perRow?: number;
}

/** How many rows a spec puts `count` cells into. */
export function rowCount(spec: LayoutSpec, count: number): number {
  if (count <= 0) return 0;
  return spec.family === "ribbon" ? count : Math.ceil(count / (spec.perRow ?? 2));
}

/**
 * The layout's extent, in multiples of one cell width. Both families are linear in
 * the cell, which is what makes the fit solve below a divide.
 *
 * The ribbon is 1.5 cells wide because the zig-zag parks every other hex half a cell
 * across; the grid is `perRow` cells plus the half-cell its odd rows are offset by.
 */
export function layoutUnits(
  spec: LayoutSpec,
  count: number,
): { wu: number; hu: number } {
  if (count <= 0) return { wu: 0, hu: 0 };
  const rows = rowCount(spec, count);
  const hu = RATIO * (VSTEP * (rows - 1) + 1);
  if (spec.family === "ribbon") return { wu: count > 1 ? 1.5 : 1, hu };
  const perRow = Math.min(count, spec.perRow ?? 2);
  return { wu: perRow + (perRow > 1 ? 0.5 : 0), hu };
}

/**
 * The shipped cell cap (`MAXW` in components/guide/GuideHoneycomb.tsx).
 *
 * Easy to leave out, and leaving it out is very visible on a vertical comb. The
 * shipped grid is 3-up, so a 1152px column already lands near this number and the cap
 * rarely bites; a SINGLE-FILE spine divides that column by 1.5 instead of 3.5, so
 * without a cap one hex solves to 768px and fills the entire viewport on its own.
 */
export const MAX_CELL = 360;

/**
 * The largest cell width that fits the given box. `availH` null means "width only" —
 * the shipped behaviour, where the comb fills the container and the page scrolls.
 * `maxW` null lifts the cap, which is a thing to look at, not a thing to ship.
 */
export function fitCellWidth(
  spec: LayoutSpec,
  count: number,
  availW: number,
  availH: number | null,
  maxW: number | null = MAX_CELL,
): number {
  const { wu, hu } = layoutUnits(spec, count);
  if (wu <= 0 || hu <= 0) return 0;
  let w = availW / wu;
  if (availH != null && availH > 0) w = Math.min(w, availH / hu);
  return maxW != null ? Math.min(w, maxW) : w;
}

/** Place `count` cells of width `w`, centred horizontally in `availW`. */
export function placeBoxes(
  spec: LayoutSpec,
  count: number,
  w: number,
  availW: number,
): { boxes: Box[]; height: number } {
  if (count <= 0 || w <= 0) return { boxes: [], height: 0 };
  const h = w * RATIO;
  const vstep = h * VSTEP;
  const { wu } = layoutUnits(spec, count);
  const pad = Math.max(0, (availW - wu * w) / 2);
  const boxes: Box[] = [];

  if (spec.family === "ribbon") {
    for (let i = 0; i < count; i++) {
      boxes.push({ left: pad + (i % 2) * (w / 2), top: i * vstep, w, h });
    }
  } else {
    const perRow = Math.min(count, spec.perRow ?? 2);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow);
      const pos = i % perRow;
      // snake, so the reading order runs down the comb rather than resetting left
      const col = row % 2 === 0 ? pos : perRow - 1 - pos;
      const xoff = row % 2 === 1 && perRow > 1 ? w / 2 : 0;
      boxes.push({ left: pad + col * w + xoff, top: row * vstep, w, h });
    }
  }
  return { boxes, height: (rowCount(spec, count) - 1) * vstep + h };
}

export interface OnePointCam {
  /**
   * How far the prism casts on the cell FARTHEST from the vanishing point, in cell
   * widths.
   *
   * Stating the camera this way rather than as a focal length and a depth is what
   * makes the variants COMPARABLE. Under one-point the cast at any cell is
   * proportional to that cell's distance from the vanishing point, so a fixed
   * focal/depth pair draws a hairline slab on an 8-cell comb and a slab half a hex
   * thick on a 16-cell one, and a vanishing point parked outside the comb blows both
   * up again because every cell is suddenly far from it. Pinning the far-end cast
   * instead solves the focal per layout, so two variants that differ only in where
   * the vanishing point sits differ ONLY in that.
   *
   * The lesson ribbon's own prism is 0.23 cell widths at its far end: focal 900 over
   * depth 70 is a far face 92.8% of the near one, and its farthest corner is 3.13
   * cells from the centre vanishing point.
   */
  castFar: number;
  /** the vanishing point, as a fraction of the comb's own box. [0.5, 0.5] is its
   *  centre, which is where the lesson ribbon puts it, and where the run converges
   *  inward on its own middle. Outside the box (y < 0 or y > 1) every prism casts the
   *  same way instead, toward the one point: above the comb they all cast UP, below
   *  it they all cast DOWN. */
  vp: [number, number];
}

/**
 * Project a measured layout in one-point perspective.
 *
 * The near faces are NOT transformed: under one-point they lie in the picture plane,
 * so each hex draws at exactly its measured box. That is the whole reason this
 * projection is worth testing on these two combs — the cells' HTML content sits
 * upright on an unforeshortened face instead of being billboarded and scaled, so a
 * title, a chip and a tap target are the size the layout says they are.
 *
 * Only the REAR face moves: it is the near face scaled toward the vanishing point.
 * Cells above the VP therefore cast down and cells below it cast UP, so the run
 * converges inward on itself.
 *
 * Returns `HexSolid`s so the shipped `.ghp` scene CSS and `CombArrows` apply
 * unchanged. `scale` and `fit` are 1 by construction (nothing foreshortens) and `z`
 * is 0 for every cell (every near face shares a depth) — which is exactly why the
 * scene component must paint ALL slabs before ANY face rather than sort by depth.
 */
export function projectOnePoint(
  boxes: Box[],
  cam: OnePointCam,
  sceneW: number,
  sceneH: number,
): HexSolid[] {
  if (boxes.length === 0) return [];
  const vx = cam.vp[0] * sceneW;
  const vy = cam.vp[1] * sceneH;

  // Solve the near/far ratio from the far-end cast (see OnePointCam.castFar). The
  // cast at a point is `(1 - r)` times its distance from the vanishing point, so
  // pinning it at the farthest corner pins the whole camera.
  let maxDist = 0;
  for (const b of boxes) {
    for (const [ux, uy] of HEX_UNIT_CORNERS) {
      const d = Math.hypot(b.left + ux * b.w - vx, b.top + uy * b.h - vy);
      if (d > maxDist) maxDist = d;
    }
  }
  // A degenerate layout (one cell centred exactly on the vanishing point) would
  // divide by zero; clamp rather than special-case, and keep the far face from
  // collapsing through the vanishing point on an extreme setting.
  const r = maxDist > 0 ? Math.min(0.999, Math.max(0.5, 1 - (cam.castFar * boxes[0]!.w) / maxDist)) : 1;

  return boxes.map((b, i) => {
    const face: Pt[] = HEX_UNIT_CORNERS.map(([ux, uy]) => [
      b.left + ux * b.w,
      b.top + uy * b.h,
    ]);
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
