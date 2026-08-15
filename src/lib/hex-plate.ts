// Laying parts out on a bed.
//
// SHELF PACKING, tallest row first. Deliberately naive, and that is a design
// decision rather than a shortcut: Creality Print (and every Orca-lineage
// slicer) preserves our relative layout but the user's own auto-arrange is one
// click away, so the job is "opens ready to slice", not "beats the slicer".
// Optimal 2D packing is NP-hard and would buy nothing anyone sees.
//
// DETERMINISM IS A REQUIREMENT, not a nicety. The pack response is cached per
// URL, so identical requests must produce identical bytes.
import type { Bed } from "@/lib/hex-pack";

/** Axis-aligned bounding box of a part in its shipped print orientation: the
 *  minimum corner and the size, in millimetres.
 *
 *  Declared HERE rather than beside the generated table, so the dependency runs
 *  one way: the generated data conforms to what the packer needs, and the packer
 *  does not import generated output to describe its own input. */
export type PartBox = {
  x0: number;
  y0: number;
  z0: number;
  dx: number;
  dy: number;
  dz: number;
};

/** Margin at the bed edge and between parts, in mm. Enough for a skirt line and
 *  a nozzle path between neighbours.
 *
 *  Exported because it is an INVARIANT other code is held to, not a private
 *  tuning knob: `BED_MIN` only clears the largest part once this gap is counted
 *  twice (87.8 + 2 * 4 = 95.8 <= 100), and the geometry table's guard test
 *  derives its size limit from it. A second copy of the number somewhere else
 *  would drift, and the symptom would be a part the table accepts and the
 *  packer throws on. */
export const PLATE_GAP = 4;

/** One line of the pack, with the geometry needed to place it. */
export type PackInput = { slug: string; qty: number; box: PartBox };

/** A placed part: `x`/`y` are the MINIMUM corner on the bed, not the centre. */
export type Placement = { slug: string; box: PartBox; x: number; y: number };

/** Most plates one request may produce. See the cap test for the arithmetic:
 *  the instance cap does NOT imply a plate cap, and the gap between them is
 *  three orders of magnitude of response size. */
export const MAX_PLATES = 20;

/** Why a layout could not be produced.
 *
 *  Two failures, and the route has to tell them apart: `part-too-large` is OUR
 *  data being wrong for a bed we said we accept (a 500-shaped fault, and a sign
 *  the geometry table or `BED_MIN` needs revisiting), while `too-many-plates` is
 *  a request we are refusing on purpose (a 400 with a message the caller can
 *  act on -- pick a bigger bed, or fewer parts). Carried as a FIELD rather than
 *  left to be recovered by matching the prose: a message is a human sentence
 *  somebody will reword, and a route that switches on its wording turns a copy
 *  edit into a wrong status code. */
export type PlatePackFailure = "part-too-large" | "too-many-plates";

export class PlatePackError extends Error {
  readonly reason: PlatePackFailure;

  constructor(reason: PlatePackFailure, message: string) {
    super(message);
    this.name = "PlatePackError";
    this.reason = reason;
  }
}

/**
 * Lay every instance out across as many plates as it takes.
 *
 * Throws rather than returning a partial layout: there is no useful "here are
 * the first twenty plates" answer, and the caller's next move differs by reason
 * (see `PlatePackFailure`). Pure arithmetic, so the route can run this BEFORE
 * touching R2 and refuse an abusive request for the cost of a loop.
 */
export function packPlates(
  input: PackInput[],
  bed: Bed,
  maxPlates: number = MAX_PLATES,
): Placement[][] {
  // Expand quantities, then sort by depth descending so each shelf is as full as
  // it can be. Ties break on slug so the order is TOTAL and the output is stable.
  //
  // The tiebreak is load-bearing, not tidiness. Without it the result depends on
  // the order the parts arrived in, and `a:1,b:1` and `b:1,a:1` are the same
  // build spelled two ways -- so two people with the identical build would get
  // byte-different files, and each spelling would hold its own cache entry.
  const items: PackInput[] = [];
  for (const p of input) for (let i = 0; i < p.qty; i++) items.push(p);
  items.sort((a, b) => b.box.dy - a.box.dy || a.slug.localeCompare(b.slug));

  const plates: Placement[][] = [];
  let plate: Placement[] = [];
  // The cursor is the minimum corner of the NEXT placement, so it starts one
  // gap in from the origin and every advance leaves a gap behind it.
  let cx = PLATE_GAP;
  let cy = PLATE_GAP;
  let rowH = 0;

  const newPlate = () => {
    if (plate.length) plates.push(plate);
    plate = [];
    cx = PLATE_GAP;
    cy = PLATE_GAP;
    rowH = 0;
  };

  for (const it of items) {
    const { dx, dy } = it.box;
    // Guarded by the geometry test and by BED_MIN, but a future part could break
    // the invariant and an infinite loop is a worse way to find out: without
    // this, a part wider than the bed wraps to a fresh row, still does not fit,
    // opens a fresh plate, and repeats until the plate cap stops it -- turning a
    // data fault into a misleading "too many plates".
    if (dx + 2 * PLATE_GAP > bed.x || dy + 2 * PLATE_GAP > bed.y) {
      throw new PlatePackError(
        "part-too-large",
        `${it.slug} is ${dx}x${dy} mm and cannot fit a ${bed.x}x${bed.y} bed`,
      );
    }
    if (cx + dx + PLATE_GAP > bed.x) {
      cx = PLATE_GAP;
      cy += rowH + PLATE_GAP;
      rowH = 0;
    }
    if (cy + dy + PLATE_GAP > bed.y) newPlate();
    // Checked as plates are opened rather than after the fact, so an abusive
    // request costs the loop it has already run and nothing more. `plates` holds
    // only CLOSED plates, so reaching the cap here means the plate about to be
    // written to is number `maxPlates + 1` -- exactly `maxPlates` is allowed.
    if (plates.length >= maxPlates) {
      throw new PlatePackError(
        "too-many-plates",
        `this build needs more than ${maxPlates} plates on a ${bed.x}x${bed.y} bed`,
      );
    }
    plate.push({ slug: it.slug, box: it.box, x: cx, y: cy });
    cx += dx + PLATE_GAP;
    rowH = Math.max(rowH, dy);
  }
  if (plate.length) plates.push(plate);
  return plates;
}
