// Deterministic grid placement of symbol/footprint instances
// (export-engine Task 5, design §3.3).
//
// PURE (no React/DB/env/network/fs). Lays the BOM's reference designators out
// on a regular grid — left-to-right, top-to-bottom — producing one
// `{ x, y, rotation }` per refDes. NOT a human layout; a usable, non-overlapping
// starting canvas the learner rearranges. Same input → byte-identical output
// (deterministic), so golden tests and downstream schematic/PCB generation are
// reproducible.
//
// Coordinates are in millimetres (KiCad's schematic/PCB unit). Rotation is 0 for
// every instance in v1.

export type Placement = {
  x: number;
  y: number;
  rotation: number;
};

export type GridPlacementOpts = {
  /** Instances per row before wrapping to the next row. Default 8. */
  cols?: number;
  /** Horizontal pitch between instance origins (mm). Default 25.4. */
  pitchX?: number;
  /** Vertical pitch between instance origins (mm). Default 25.4. */
  pitchY?: number;
  /** X coordinate of the first (top-left) instance (mm). Default 25.4. */
  originX?: number;
  /** Y coordinate of the first (top-left) instance (mm). Default 25.4. */
  originY?: number;
};

const DEFAULTS: Required<GridPlacementOpts> = {
  cols: 8,
  pitchX: 25.4,
  pitchY: 25.4,
  originX: 25.4,
  originY: 25.4,
};

/**
 * Split a reference designator into its alpha prefix + numeric suffix so a
 * "natural" (human) sort can order `R2` before `R10` and group by prefix.
 * `"R10"` → `{ prefix: "R", num: 10, raw: "R10" }`. A refDes with no trailing
 * number sorts as if its number were -1 (so a bare prefix precedes its numbered
 * siblings), and a leftover suffix after the number (rare, e.g. `U1A`) is kept
 * for a final tiebreak.
 */
function parseRefDes(refDes: string): {
  prefix: string;
  num: number;
  rest: string;
  raw: string;
} {
  const m = /^([^\d]*)(\d+)(.*)$/.exec(refDes);
  if (!m) {
    return { prefix: refDes, num: -1, rest: "", raw: refDes };
  }
  return {
    prefix: m[1] ?? "",
    num: Number(m[2]),
    rest: m[3] ?? "",
    raw: refDes,
  };
}

/**
 * Natural/human comparison: order by alpha prefix (case-insensitive, then
 * case-sensitive tiebreak), then by numeric suffix, then by any trailing rest,
 * then by the raw string. Total + stable so the sort is deterministic.
 */
function compareRefDes(a: string, b: string): number {
  const pa = parseRefDes(a);
  const pb = parseRefDes(b);
  const prefixCmp =
    pa.prefix.toLowerCase() < pb.prefix.toLowerCase()
      ? -1
      : pa.prefix.toLowerCase() > pb.prefix.toLowerCase()
        ? 1
        : pa.prefix < pb.prefix
          ? -1
          : pa.prefix > pb.prefix
            ? 1
            : 0;
  if (prefixCmp !== 0) return prefixCmp;
  if (pa.num !== pb.num) return pa.num - pb.num;
  if (pa.rest !== pb.rest) return pa.rest < pb.rest ? -1 : 1;
  return pa.raw < pb.raw ? -1 : pa.raw > pb.raw ? 1 : 0;
}

/**
 * Deterministic grid placement for a set of reference designators.
 *
 * Sorts `refDes` with a natural/human sort (so `R2` < `R10`, and prefixes group:
 * all `C`s, then `R`s, then `U`s …), de-duplicates, then lays them out on a grid
 * `cols` wide, left-to-right then top-to-bottom, every instance at rotation 0.
 * Pitch defaults guarantee non-overlapping origins. Returns an insertion-ordered
 * `Map<refDes, { x, y, rotation }>` — same input always yields identical output.
 */
export function gridPlacement(
  refDes: string[],
  opts: GridPlacementOpts = {},
): Map<string, Placement> {
  const cfg: Required<GridPlacementOpts> = { ...DEFAULTS, ...opts };
  // Guard against a non-positive cols collapsing the grid to a single column.
  const cols = cfg.cols >= 1 ? Math.floor(cfg.cols) : 1;

  // De-duplicate (a refDes appearing twice would otherwise stack), then sort.
  const unique = Array.from(new Set(refDes));
  unique.sort(compareRefDes);

  const out = new Map<string, Placement>();
  unique.forEach((ref, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.set(ref, {
      x: cfg.originX + col * cfg.pitchX,
      y: cfg.originY + row * cfg.pitchY,
      rotation: 0,
    });
  });
  return out;
}
