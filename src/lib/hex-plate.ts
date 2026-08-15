// Laying parts out on a bed.
//
// SHELF PACKING, tallest row first. Deliberately naive, and that is a design
// decision rather than a shortcut: Creality Print (and every Orca-lineage
// slicer) preserves our relative layout but the user's own auto-arrange is one
// click away, so the job is "opens ready to slice", not "beats the slicer".
// Optimal 2D packing is NP-hard and would buy nothing anyone sees.
//
// NO ROTATION either. A part is laid down in the orientation it ships in, which
// is the PRINT orientation. Turning parts in XY would fit more per plate; the
// price of not doing it is that a part is judged on the axis it happens to be
// long in, so a hypothetical 30 x 95 mm part is refused by a bed only 100 mm
// DEEP even though it would fit lying across one. Nothing published is near
// that -- the geometry guard test holds EVERY part to BED_MIN on BOTH axes,
// which is what lets a bed choice change the plate COUNT and never make a part
// unprintable -- so today this costs nothing. It stops being free the first time
// a part is long and thin, and the answer then is to rotate, not to relax that
// guard.
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
 *  packer throws on.
 *
 *  Bounded from BOTH sides by tests, because the two directions fail
 *  differently and neither test catches the other's direction. WIDENING it eats
 *  the 4.2 mm of headroom the largest part has on the smallest bed, which the
 *  geometry guard catches. NARROWING it ships parts closer together than a
 *  nozzle can travel, which no derived assertion can catch -- every one of them
 *  moves with the constant -- so the packer's own suite pins the floor. */
export const PLATE_GAP = 4;

/** One line of the pack, with the geometry needed to place it.
 *
 *  `box` is READONLY because a `Placement` ALIASES it rather than copying it,
 *  and the route passes rows straight out of `HEX_PART_BOX` -- a module-level
 *  table that lives as long as a warm serverless instance. A downstream clamp
 *  or normalisation written through a placement would edit the shared table and
 *  change the geometry for every later request on that instance. `hex-pack.ts`
 *  freezes `DEFAULT_BED` against exactly this hazard; this is the compile-time
 *  half of the same idea, at no runtime cost. */
export type PackInput = { slug: string; qty: number; box: Readonly<PartBox> };

/** A placed part: `x`/`y` are the MINIMUM corner on the bed, not the centre. */
export type Placement = {
  slug: string;
  box: Readonly<PartBox>;
  x: number;
  y: number;
};

/** Most plates one request may produce. See the cap test for the arithmetic:
 *  the instance cap does NOT imply a plate cap, and the gap between them is
 *  three orders of magnitude of response size. */
export const MAX_PLATES = 20;

/** Why a layout could not be produced.
 *
 *  Three failures, and the route has to tell them apart. `part-too-large` is OUR
 *  data being wrong for a bed we said we accept (a 500-shaped fault, and a sign
 *  the geometry table or `BED_MIN` needs revisiting), `too-many-plates` is a
 *  request we are refusing on purpose (a 400 with a message the caller can act
 *  on -- pick a bigger bed, or fewer parts), and `bad-quantity` is neither: the
 *  request grammar in `hex-pack.ts` already rejects a quantity that is not a
 *  positive whole number, so reaching it means a caller skipped `resolvePack`.
 *  That is a programming fault, and the route should treat it like one rather
 *  than blaming the request.
 *
 *  Carried as a FIELD rather than left to be recovered by matching the prose: a
 *  message is a human sentence somebody will reword, and a route that switches
 *  on its wording turns a copy edit into a wrong status code. */
export type PlatePackFailure =
  | "part-too-large"
  | "too-many-plates"
  | "bad-quantity";

export class PlatePackError extends Error {
  readonly reason: PlatePackFailure;

  constructor(reason: PlatePackFailure, message: string) {
    super(message);
    this.name = "PlatePackError";
    this.reason = reason;
  }
}

/** An upper bound on the items `maxPlates` plates of this bed could ever hold.
 *
 *  A PROOF, not a policy number, which is why it is derived rather than chosen.
 *  Every placement advances the cursor by at least `PLATE_GAP` in X (a part is
 *  strictly positive in size, so `dx + PLATE_GAP > PLATE_GAP`), and every row
 *  advances it by at least `PLATE_GAP` in Y, so one plate cannot hold more parts
 *  than the number of `PLATE_GAP`-wide slots that fit the bed on each axis.
 *
 *  Deliberately LOOSE -- roughly 60,500 items on the default bed, against a
 *  route cap of 250. It exists to refuse the absurd before paying for it, not to
 *  estimate capacity, and a bound tight enough to be interesting would sooner or
 *  later refuse a build that packs. */
function itemCeiling(bed: Bed, maxPlates: number): number {
  return (
    Math.floor(bed.x / PLATE_GAP) * Math.floor(bed.y / PLATE_GAP) * maxPlates
  );
}

/**
 * Lay every instance out across as many plates as it takes.
 *
 * Throws rather than returning a partial layout: there is no useful "here are
 * the first twenty plates" answer, and the caller's next move differs by reason
 * (see `PlatePackFailure`). Pure arithmetic, so the route can run this BEFORE
 * touching R2 and refuse an abusive request for the cost of a loop.
 *
 * SELF-BOUNDING, so that promise holds however it is called. Quantities are
 * checked and totalled BEFORE they are expanded into an array, because the
 * expansion is the one step whose cost a caller writes for free: `qty` is three
 * characters in a URL and one array element per unit. Bounding it here rather
 * than trusting the route's own cap keeps the refusal honest for anyone who
 * reads the paragraph above and calls this first.
 */
export function packPlates(
  input: PackInput[],
  bed: Bed,
  maxPlates: number = MAX_PLATES,
): Placement[][] {
  // Quantities first, on the LINES rather than the expanded items -- fifty-odd
  // checks instead of two hundred and fifty, and it has to precede the expansion
  // anyway. `Number.isInteger` rejects a fraction, a sign, Infinity and NaN in
  // one test: `qty: 2.5` otherwise loops `i < 2.5` three times and silently
  // ships a part somebody asked for two and a half of.
  let total = 0;
  for (const p of input) {
    if (!Number.isInteger(p.qty) || p.qty < 1) {
      throw new PlatePackError(
        "bad-quantity",
        `${p.slug} has a quantity of ${p.qty}, which is not a whole number of parts`,
      );
    }
    total += p.qty;
  }
  // Then the total, still before expanding it. The plate cap below would refuse
  // this build anyway, but only after allocating one array element per instance
  // -- so a five-million quantity would cost a five-million-element array and a
  // sort over it before the refusal it was always going to get.
  if (total > itemCeiling(bed, maxPlates)) {
    throw new PlatePackError(
      "too-many-plates",
      `this build is ${total} items, more than ${maxPlates} plates on a ${bed.x}x${bed.y} bed can hold`,
    );
  }

  // Sizes next, once per line and before the expansion, for the same reason.
  //
  // Guarded by the geometry test and by BED_MIN, but a future part could break
  // the invariant and an infinite loop is a worse way to find out: without this,
  // a part wider than the bed wraps to a fresh row, still does not fit, opens a
  // fresh plate, and repeats until the plate cap stops it -- turning a data
  // fault into a misleading "too many plates".
  //
  // Written as the NEGATION of "it fits" rather than as "it is too big", because
  // the two are not the same test on a value that is not a number. `NaN > bed.x`
  // is FALSE, so the positive form waves a NaN part straight through and places
  // it at NaN, which serialises into a 3MF transform. The generator that
  // produces these boxes seeds its sweep with +/-Infinity, so a mesh it cannot
  // parse yields exactly that. The `> 0` half is not redundant with the `<=`
  // half: `-Infinity + 8 <= 220` is TRUE, so the size comparison alone accepts a
  // negative part and lays it off the bed.
  for (const p of input) {
    const { dx, dy } = p.box;
    if (
      !(
        dx > 0 &&
        dy > 0 &&
        dx + 2 * PLATE_GAP <= bed.x &&
        dy + 2 * PLATE_GAP <= bed.y
      )
    ) {
      throw new PlatePackError(
        "part-too-large",
        `${p.slug} is ${dx}x${dy} mm and cannot fit a ${bed.x}x${bed.y} bed`,
      );
    }
  }

  // Expand quantities, then sort by depth descending so each shelf is as full as
  // it can be. Ties break on slug so the order is TOTAL and the output is stable.
  //
  // The tiebreak is load-bearing, not tidiness. Without it the result depends on
  // the order the parts arrived in, and `a:1,b:1` and `b:1,a:1` are the same
  // build spelled two ways -- so two people with the identical build would get
  // byte-different files, and each spelling would hold its own cache entry.
  //
  // Compared by CODE UNIT, not by `localeCompare`. That reads the host's default
  // ICU locale, which is ambient state this module has no say in and which the
  // deployment can change underneath it -- and in several locales punctuation is
  // IGNORABLE, so under th-TH `"tray-lid".localeCompare("traylid")` is 0. Two
  // distinct slugs comparing EQUAL destroys the totality that is the entire
  // point of the tiebreak, and our slugs are hyphen-dense with one tie group of
  // twelve members. The failure would be per-host and invisible: the same URL
  // served different bytes depending on where it was rendered.
  const items: PackInput[] = [];
  for (const p of input) for (let i = 0; i < p.qty; i++) items.push(p);
  items.sort(
    (a, b) =>
      b.box.dy - a.box.dy || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );

  const plates: Placement[][] = [];
  let plate: Placement[] = [];
  // The cursor is the minimum corner of the NEXT placement, so it starts one
  // gap in from the origin and every advance leaves a gap behind it.
  let cx = PLATE_GAP;
  let cy = PLATE_GAP;
  let rowH = 0;

  const newPlate = () => {
    // UNREACHABLE with an empty `plate`, and that is the proof the loop below
    // terminates rather than a defensive habit. This is called only when
    // `cy + dy + PLATE_GAP > bed.y`; on a fresh plate `cy` is `PLATE_GAP`, so
    // that condition is `dy + 2 * PLATE_GAP > bed.y`, which the size guard above
    // already refused. So a fresh plate always accepts the next item, no item
    // can open two plates, and the plate count is bounded by the item count.
    // Kept because the guard costs nothing and the argument for deleting it
    // depends on a guard fifty lines away staying exactly as strict as it is.
    if (plate.length) plates.push(plate);
    plate = [];
    cx = PLATE_GAP;
    cy = PLATE_GAP;
    rowH = 0;
  };

  for (const it of items) {
    const { dx, dy } = it.box;
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
    // The TALLEST part in the row, not the last one. A row is a shelf: the next
    // row has to clear whatever is deepest on this one, so tracking only the
    // last part's depth lays the next row on top of a deeper neighbour.
    rowH = Math.max(rowH, dy);
  }
  if (plate.length) plates.push(plate);
  return plates;
}
