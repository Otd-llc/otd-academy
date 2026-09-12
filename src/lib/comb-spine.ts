// The VERTICAL SPINE: the layout and projection the build-guide hub and the /courses
// skill tree draw themselves with.
//
// Promoted verbatim from the sandbox rounds the owner picked (`/sandbox/comb`,
// `/sandbox/comb/site`, 2026-08-13). Pure geometry: no React, no DOM, no DB, so it
// unit-tests in the fast project. The components own the markup; this file owns the
// numbers.
//
// WHY ONE-POINT, AND WHY A SPINE. The grid combs used to be THREE-point (camera S5 in
// `hex-perspective.ts`): a wide tessellated sheet whose faces foreshorten, which means
// every cell's content has to be BILLBOARDED onto its face and scaled to fit a
// trapezoid. The lesson-top ribbon (`phase-comb.ts`) is one-point instead, and that is
// what got carried over here: the hex faces stay parallel to the picture plane, so
// nothing foreshortens, only the prism DEPTH converges, and a cell's title, chip and
// tap target are exactly the size the layout says they are. That is what lets the
// cells be grown to fill the space without the content drifting out of its own face.
//
// The run is a single file, laced edge to edge, alternating left and right: the lesson
// ribbon's own lacing turned ninety degrees. A staggered single file has exactly one
// reading order, which is why this comb carries NO direction indicator; the shape says
// it once instead of a mark saying it on every seam.
//
// TWO THINGS ARE LOAD-BEARING.
//
// SCALE INVARIANCE. The camera and every stroke are expressed in CELL WIDTHS, so the
// comb projects identically at 320px and at 900px. `phase-comb.ts` states the same
// numbers inside its own fixed 48-unit drawing box, which is these ratios wearing a
// size.
//
// FIT. The layout's extent is LINEAR in the cell width, so "the biggest hex that fits
// this box" is a divide rather than a search: measure the layout once per unit cell
// (`layoutUnits`), then solve.

import type { HexSolid, Pt } from "@/lib/hex-perspective";

/** regular pointy-top: height / width. */
export const SPINE_RATIO = 1.1547;

/** rows nestle by a quarter of a hex height. */
export const SPINE_VSTEP = 0.75;

export type SpineBox = { left: number; top: number; w: number; h: number };

/** Pointy-top corners in a unit cell, the same six the shipped comb is cut from. */
export const SPINE_UNIT_CORNERS: Pt[] = [
  [0.5, 0],
  [1, 0.25],
  [1, 0.75],
  [0.5, 1],
  [0, 0.75],
  [0, 0.25],
];

/**
 * Stroke weights, as a share of the CELL WIDTH, taken from the lesson-top ribbon and
 * then trimmed by the owner.
 *
 * That comb draws its hexes in a 48-unit box and strokes them at 1.1 and 0.5 for the
 * face and the prism sides, and its svg is scaled to the rendered cell, so those are
 * ratios wearing fixed numbers. Restating them as ratios is what stops a small hex
 * getting a fat outline: the first cut stroked everything at a flat 3px, which is
 * right on a 300px cell and a third of a hex thick on a 90px one.
 *
 * `TRIM` is the owner's pick on top of that (sandbox round three, live slider): the
 * lesson comb's own weight reads heavy once a cell is this large.
 *
 * The floor keeps the outline from disappearing entirely at the smallest sizes, and it
 * is scaled by the trim too, or the trim would stop having any effect down there.
 */
export const SPINE_STROKE = {
  face: 1.1 / 48,
  side: 0.5 / 48,
  floor: 0.55,
  /** owner pick, 2026-08-13. */
  trim: 0.4,
} as const;

export const spineStroke = (
  part: "face" | "side",
  cellW: number,
  trim: number = SPINE_STROKE.trim,
) => Math.max(SPINE_STROKE.floor * Math.min(1, trim), SPINE_STROKE[part] * cellW * trim);

/**
 * The cell cap, carried over from the grid comb it replaces (`MAXW` there).
 *
 * It barely bit on a 3-up grid, because a 1152px column divided by 3.5 already lands
 * near this number. A single-file spine divides the same column by 1.5, so without the
 * cap one hex solves to 768px and fills a desktop viewport on its own.
 */
export const SPINE_MAX_CELL = 360;

/**
 * The cell silhouette as a CSS clip-path.
 *
 * Load-bearing for HIT TESTING, not for looks. A measured cell is an absolutely
 * positioned RECTANGLE, and a laced run overlaps its neighbours by half a cell across
 * and a quarter down. Every cell sits at the same z-index, so the browser resolves the
 * overlap by DOM order and the LATER cell wins - including over the earlier cell's own
 * visible hex face. Un-clipped, roughly a sixteenth of each cell's face navigates to
 * the next destination instead of its own, and hovering it lights the wrong outline.
 *
 * `clip-path` clips pointer events as well as paint, so clipping to the hex makes the
 * hit box the shape the user can actually see. Apply it to the interactive cell only:
 * the artwork layer deliberately overflows its hex and must NOT be clipped.
 */
export const SPINE_CLIP =
  "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

/** The spine's extent, in multiples of one cell width. 1.5 across because the zig-zag
 *  parks every other hex half a cell over. */
export function layoutUnits(count: number): { wu: number; hu: number } {
  if (count <= 0) return { wu: 0, hu: 0 };
  return {
    wu: count > 1 ? 1.5 : 1,
    hu: SPINE_RATIO * (SPINE_VSTEP * (count - 1) + 1),
  };
}

/**
 * The largest cell width that fits. `availH` null means "width only", which is what
 * the real pages do: the comb fills its column and the page scrolls.
 */
export function fitCellWidth(
  count: number,
  availW: number,
  availH: number | null = null,
  maxW: number | null = SPINE_MAX_CELL,
): number {
  const { wu, hu } = layoutUnits(count);
  if (wu <= 0 || hu <= 0) return 0;
  let w = availW / wu;
  if (availH != null && availH > 0) w = Math.min(w, availH / hu);
  return maxW != null ? Math.min(w, maxW) : w;
}

/** Place `count` cells of width `w`, centred horizontally in `availW`. */
export function placeSpine(
  count: number,
  w: number,
  availW: number,
): { boxes: SpineBox[]; height: number } {
  if (count <= 0 || w <= 0) return { boxes: [], height: 0 };
  const h = w * SPINE_RATIO;
  const vstep = h * SPINE_VSTEP;
  const pad = Math.max(0, (availW - layoutUnits(count).wu * w) / 2);
  const boxes: SpineBox[] = [];
  for (let i = 0; i < count; i++) {
    boxes.push({ left: pad + (i % 2) * (w / 2), top: i * vstep, w, h });
  }
  return { boxes, height: (count - 1) * vstep + h };
}

export interface SpineCam {
  /**
   * How far the prism casts on the cell FARTHEST from the vanishing point, in cell
   * widths.
   *
   * Stating the camera this way rather than as a focal length and a depth is what
   * keeps a 3-cell path and a 9-stage guide in the same ballpark. Under one-point the
   * cast at any cell is proportional to that cell's distance from the vanishing point,
   * so a fixed focal/depth pair draws a hairline on a short comb and a wedge on a long
   * one. Pinning the far-end cast solves the focal per layout instead.
   *
   * It is NOT literally count-invariant, and the earlier wording here claimed it was.
   * What is pinned is the FARTHEST corner, so a short comb gets a bigger cast on every
   * cell than a long one does in its middle. The degenerate case is a one-node path (a
   * goal with no prerequisites, which `SkillHoneycomb` does render): all six corners
   * are equidistant from the vanishing point, so every one of them casts the full
   * 0.23 of a cell and it reads chunkier than the same component's six-node run.
   * Acceptable, and worth knowing before someone "fixes" a comb that looks heavy.
   *
   * The lesson ribbon's own prism is 0.23 cell widths at its far end: focal 900 over
   * depth 70 is a far face 92.8% of the near one, and its farthest corner sits 3.13
   * cells from the centre vanishing point. That is the value the owner picked.
   */
  castFar: number;
  /** the vanishing point, as a fraction of the comb's own box. [0.5, 0.5] is its
   *  centre, where the lesson ribbon puts it: cells above cast down, cells below cast
   *  up, and the run converges on its own middle. */
  vp: [number, number];
}

/** The owner's pick (sandbox round one, option V1): the lesson comb's own prism. */
export const SPINE_CAM: SpineCam = { castFar: 0.23, vp: [0.5, 0.5] };

/**
 * Project a measured spine in one-point perspective.
 *
 * The near faces are NOT transformed: under one-point they lie in the picture plane,
 * so each hex draws at exactly its measured box, and the cells' HTML sits upright on
 * it at its true size. Only the REAR face moves, scaled toward the vanishing point.
 *
 * Returns `HexSolid`s so the existing `.ghp` scene CSS applies unchanged. `scale` and
 * `fit` are 1 by construction (nothing foreshortens) and `z` is 0 for every cell
 * (every near face shares a depth), which is exactly why the scene component must
 * paint ALL slabs before ANY face rather than sort by depth.
 */
export function projectSpine(
  boxes: SpineBox[],
  sceneW: number,
  sceneH: number,
  cam: SpineCam = SPINE_CAM,
): HexSolid[] {
  if (boxes.length === 0) return [];
  const vx = cam.vp[0] * sceneW;
  const vy = cam.vp[1] * sceneH;

  // Solve the near/far ratio from the far-end cast. The cast at a point is `(1 - r)`
  // times its distance from the vanishing point, so pinning it at the farthest corner
  // pins the whole camera.
  let maxDist = 0;
  for (const b of boxes) {
    for (const [ux, uy] of SPINE_UNIT_CORNERS) {
      const d = Math.hypot(b.left + ux * b.w - vx, b.top + uy * b.h - vy);
      if (d > maxDist) maxDist = d;
    }
  }
  // A single cell centred exactly on the vanishing point would divide by zero; clamp
  // rather than special-case, and keep the far face from collapsing through the
  // vanishing point on an extreme setting.
  // The 0.5 floor is defensive, not measured: it needs `maxDist < 0.46w`, and a single
  // pointy hex already puts its farthest corner at 0.577w. Do not read it as evidence
  // that a case was found which needed it.
  const r =
    maxDist > 0
      ? Math.min(0.999, Math.max(0.5, 1 - (cam.castFar * boxes[0]!.w) / maxDist))
      : 1;

  return boxes.map((b, i) => {
    const face: Pt[] = SPINE_UNIT_CORNERS.map(([ux, uy]) => [
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
