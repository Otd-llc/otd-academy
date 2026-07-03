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

export interface CombPoint {
  x: number;
  y: number;
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
