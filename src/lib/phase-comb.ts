// Pure geometry + state helpers for the PhaseComb — the connected zig-zag hex
// breadcrumb at the foot of a lesson (design: sandbox variant "c1"). No DB, no
// React: safe to import from a server component AND unit-test in the fast "unit"
// project. The component (components/guide/PhaseComb.tsx) owns the markup; this
// file owns the numbers and the completion-state mapping.

// Flat-top hexagon, laced edge-to-edge into a zig-zag ribbon: each hex shares a
// face with the next (SE face of N touches NW face of N+1), alternating down/up.
// Canonical flat-top box so neighbours tessellate exactly: height = width·√3/2,
// the SE/NE neighbour sits +0.75·W across and ±0.5·H down.
export const COMB_HEX_W = 48;
export const COMB_HEX_H = (COMB_HEX_W * Math.sqrt(3)) / 2; // ≈ 41.569
export const COMB_DX = 0.75 * COMB_HEX_W; // 36 — horizontal step
export const COMB_DY = COMB_HEX_H / 2; // ≈ 20.785 — vertical zig-zag

// Flat-top hex corners in the cell's own 48 × 41.57 local box, clockwise from the
// left point. Shared with the component so the face and its prism are cut from one
// set of numbers.
export const COMB_HEX_CORNERS: [number, number][] = [
  [0, COMB_DY],
  [COMB_HEX_W / 4, 0],
  [(COMB_HEX_W * 3) / 4, 0],
  [COMB_HEX_W, COMB_DY],
  [(COMB_HEX_W * 3) / 4, COMB_HEX_H],
  [COMB_HEX_W / 4, COMB_HEX_H],
];

// ── one-point perspective (sandbox round "P1a", 2026-07-20) ─────────────
//
// The comb used to be drawn in OBLIQUE projection: a constant 3.5-unit cast,
// down-right, identical on every hex. Parallel casts have no vanishing point, so
// eight hexes read as eight copies of one stamp rather than eight objects in one
// scene.
//
// It is now ONE-POINT. The hex faces stay parallel to the picture plane, which is
// the whole reason this projection was chosen over the more dramatic two- and
// three-point cuts: no face is foreshortened, so no face, label or tap target ever
// shrinks, at any width, and the responsive behaviour is exactly what it was. Only
// the depth axis converges, on a single vanishing point at the centre of the run.
//
// A prism's far face is therefore the near face scaled TOWARD that point. With the
// camera at COMB_FOCAL and the prism COMB_PRISM_DEPTH units deep, the far face is
// COMB_PRISM_RATIO of the near one.
export const COMB_FOCAL = 900;
export const COMB_PRISM_DEPTH = 70;
export const COMB_PRISM_RATIO = COMB_FOCAL / (COMB_FOCAL + COMB_PRISM_DEPTH);

export interface CombPoint {
  x: number;
  y: number;
}

/** The single point every prism's depth axis converges on: the centre of the run. */
export function combVanishingPoint(n: number): CombPoint {
  const { w, h } = combViewBox(n);
  return { x: w / 2, y: h / 2 };
}

/** That same point, expressed inside hex `i`'s own local box. */
export function combCellVp(i: number, n: number): CombPoint {
  const v = combVanishingPoint(n);
  const o = combPositions(n)[i] ?? { x: 0, y: 0 };
  return { x: v.x - o.x, y: v.y - o.y };
}

/** Hex `i`'s far face, in its own local box: the near face scaled toward the VP.
 *  Hexes left of the VP therefore cast right and hexes right of it cast LEFT, so
 *  the run converges inward and no cast escapes the comb's box. */
export function combRearFace(i: number, n: number): CombPoint[] {
  const v = combCellVp(i, n);
  return COMB_HEX_CORNERS.map(([x, y]) => ({
    x: v.x + (x - v.x) * COMB_PRISM_RATIO,
    y: v.y + (y - v.y) * COMB_PRISM_RATIO,
  }));
}

/** Top-left origin of each hex, in intrinsic drawing units, for `n` hexes. */
export function combPositions(n: number): CombPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: i * COMB_DX,
    y: i % 2 === 0 ? 0 : COMB_DY,
  }));
}

/** Intrinsic drawing box for `n` hexes: all columns + one hex, two half-rows. */
export function combViewBox(n: number): { w: number; h: number } {
  return {
    w: COMB_DX * Math.max(0, n - 1) + COMB_HEX_W,
    h: COMB_HEX_H + COMB_DY,
  };
}

// One record per stage, structurally compatible with GuideStageStatus (whose
// `state` is a CompletionState string) — declared loosely here so this module
// never has to import the DB-backed guide-completion types.
export interface CombStageStatus {
  stage: string;
  ordinal: number;
  state: string;
}

/** The base visual token a hex renders in, from its completion state. The
 *  "you are viewing this card" and "this is the next step" cues are layered on
 *  by the component from the viewed stage, independent of completion. */
export type CombState = "complete" | "current" | "pending" | "blocked";

/** Map a stage's completion state to its hex fill token. */
export function combNodeState(state: string): CombState {
  switch (state) {
    case "complete":
      return "complete";
    case "blocked":
      return "blocked";
    case "partial":
      return "current";
    default:
      return "pending"; // untouched / unknown
  }
}

/** The glyph on a hex face: a check when done, else the zero-padded ordinal. */
export function combGlyph(state: CombState, ordinal: number): string {
  return state === "complete"
    ? "✓"
    : String(ordinal + 1).padStart(2, "0");
}

// Three-letter stage abbreviations for the hex faces (top comb only), mirroring
// StageTracker's STAGE_SHORT. Unknown stages fall back to their first 3 letters.
const STAGE_ABBR: Record<string, string> = {
  REQUIREMENTS: "REQ",
  BOM_SOURCING: "BOM",
  SCHEMATIC: "SCH",
  LAYOUT: "LAY",
  DRC_GERBER: "DRC",
  ORDERING: "ORD",
  ASSEMBLY: "ASM",
  BRINGUP: "BRG",
  REVISION: "REV",
};

export function combAbbr(stage: string): string {
  return STAGE_ABBR[stage] ?? stage.slice(0, 3).toUpperCase();
}
