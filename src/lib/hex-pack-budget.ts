// What a pack request will cost, priced from the committed byte table BEFORE
// any R2 read. (Launch readiness 5.5.)
//
// Before this, one pack GET could read every part out of the bucket and spend
// about 80 s of CPU and 134 MB assembling a zip. The budget bounds a response to
// about 8 MB, and it is checked on arithmetic, so refusing a request costs a
// table lookup rather than the reads it refuses.
import type { PackFormat, PackPart } from "@/lib/hex-pack";
import type { Placement } from "@/lib/hex-plate";
import { HEX_PART_BYTES, type HexPartBytes } from "@/lib/hex-part-bytes";

/** The most one response may be estimated at: 8 MB, decimal. */
export const PACK_BYTE_BUDGET = 8_000_000;

type Table = Readonly<Record<string, HexPartBytes>>;

/**
 * The estimated size of a WHOLE pack, or null if any part has no row.
 *
 * 3MF: Σ qty × the part's 3MF bytes, the formula 5.5 specifies. Every copy is
 * its own `<object>` in a plate (a shared object loses its name and settings in
 * Creality Print), so the work grows with quantity even though identical copies
 * deflate to little. It is an upper bound on the output rather than a
 * prediction, computable before packing: `hex-main-cover-cable:250` is priced
 * at 137 MB and refused.
 *
 * STL: Σ of each DISTINCT part's STL bytes, because that is what the loose zip
 * holds: one file per name, whatever the quantity. Pricing it by quantity would
 * refuse `hex-main:20` as STL for 20 copies of a file it ships once.
 *
 * NULL, NOT ZERO, for a part with no row. A missing row is an unknown part, and
 * a price of zero would wave it through to R2.
 */
export function estimatePackBytes(
  parts: readonly PackPart[],
  format: PackFormat,
  table: Table = HEX_PART_BYTES,
): number | null {
  let total = 0;
  for (const p of parts) {
    const row = table[p.slug];
    if (!row) return null;
    total += format === "stl" ? row.stl : p.qty * row["3mf"];
  }
  return total;
}

/**
 * The estimated size of ONE plate: the same formula over the parts placed on
 * it, one mesh per copy, as the plate writer emits them. On a 350 mm bed the
 * heaviest v2 part (`hex-main-cover-cable`, 550 KB) fits four to a plate, about
 * 2.2 MB. Null if a placement has no row, which the whole-pack estimate would
 * already have refused.
 */
export function estimatePlateBytes(
  plate: readonly Placement[],
  table: Table = HEX_PART_BYTES,
): number | null {
  let total = 0;
  for (const p of plate) {
    const row = table[p.slug];
    if (!row) return null;
    total += row["3mf"];
  }
  return total;
}

/** `12.3 MB`, for a message a person reads. Decimal, like the budget. */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
