// The released part list, as the SLUGS the R2 keys actually use.
//
// GENERATED UPSTREAM. The list itself lives in `hex-release-tables.ts`, written
// by hex-cluster's `tools/gen_release_tables.py` from `tools/parts-licence.json`
// and the release manifest (launch readiness 4.6): every `cc-by` part, minus the
// parts owner decision 1.6 withholds. This module is the stable name the pack
// route and its tests import. The v1 names are not here: they are the published
// record in `hex-published-record.ts`, and nothing live reads them.
//
// WHY A LIST AT ALL, when the download proxy already validates a name grammar.
// The grammar answers "is this a well-formed slug", which is enough when the
// caller names one file and a miss is a 404. The custom pack endpoint takes
// hundreds of names at once and fans them out into R2 reads, so a grammar-only
// check would let a caller spray arbitrary well-formed slugs and use the
// response as a probe for what exists. Membership answers "is this one of ours",
// which is the question that actually bounds the work.
import {
  HEX_PART_FAMILY,
  HEX_PART_SLUGS,
  type HexReleaseFamily,
} from "@/lib/hex-release-tables";

export {
  HEX_PART_COUNT,
  HEX_PART_FAMILIES,
  HEX_PART_FAMILY,
  HEX_PART_SLUGS,
  type HexReleaseFamily,
} from "@/lib/hex-release-tables";

export type HexPartSlug = (typeof HEX_PART_SLUGS)[number];

const SLUG_SET: ReadonlySet<string> = new Set(HEX_PART_SLUGS);

/** Membership, not shape. See the note above. */
export function isHexPartSlug(value: string): value is HexPartSlug {
  return SLUG_SET.has(value);
}

/** What CLASS of part a slug is DRAWN as -- the thumbnail's vocabulary.
 *
 *  THE SAME SIX NAMES the configurator's `PartFamily` uses
 *  (`bs-cap-hex/src/hex/export/bom.ts`), spelled identically on purpose: that is
 *  the vocabulary the BOM, the exploded figures and the balloons over there are
 *  already banded by, so a reader who knows one knows the other. It is NOT
 *  imported -- the two repos deploy separately and share no package.
 *
 *  NOT the release's own families. The v2 manifest files every part under one
 *  of twelve finer families (`HEX_PART_FAMILIES`, generated), and
 *  `HEX_DISPLAY_FAMILY_OF` below folds those onto these six for drawing.
 *
 *  Declared HERE rather than beside the generated table, so the dependency runs
 *  one way -- the same arrangement `PartBox` has in `hex-plate.ts`. */
export type HexPartFamily =
  | "base"
  | "insert"
  | "pcb"
  | "cap"
  | "spike"
  | "accessory";

/** Every display family, in the order the thumbnail's value ramp walks them.
 *
 *  ORDERED, and the order is the data rather than a detail of the palette: it is
 *  the assembly order (a base takes a carrier insert, which takes a lid, the caps
 *  close the edges, the spikes stand it up, and an accessory bolts to a spike),
 *  and it is also -- not by coincidence, since a part that goes on later is a part
 *  that goes on the outside -- descending part size. The thumbnail leans on the
 *  second reading: it walks this list from its darkest gold to its lightest, so
 *  the smallest parts get the most contrast against the bed, which is where
 *  contrast is scarcest.
 *
 *  Exported so the palette can be held to a length instead of re-typing the
 *  list. */
export const HEX_DISPLAY_FAMILIES = [
  "base",
  "insert",
  "pcb",
  "cap",
  "spike",
  "accessory",
] as const satisfies readonly HexPartFamily[];

/** Which display family a release family is drawn as.
 *
 *  The manifest's families (`hex-release-tables.ts`) are finer than the six the
 *  thumbnail ladder has rungs for, so they are folded the way the configurator's
 *  v2 bill folds them (`familyForPath` in bs-cap `src/hex/v2/export-bom.ts`): a
 *  base is a base, a spike a spike, a spike accessory an accessory, and
 *  everything fitted to a cell (covers, bins, collars, ports, inserts, joins, PVC
 *  sections) reads as an insert. Caps keep their own rung, since the ladder has
 *  one. The jigs are printed on their own and drawn as accessories.
 *
 *  A Record over the whole release vocabulary, so a family the generator adds
 *  fails the typecheck here instead of falling through to "no family". */
export const HEX_DISPLAY_FAMILY_OF: Readonly<
  Record<HexReleaseFamily, HexPartFamily>
> = {
  accessory: "accessory",
  base: "base",
  bin: "insert",
  cap: "cap",
  collar: "insert",
  cover: "insert",
  insert: "insert",
  jig: "accessory",
  join: "insert",
  port: "insert",
  pvc: "insert",
  spike: "spike",
};

/** The display family of a released part, or undefined for a slug that is not
 *  in the release. */
export function displayFamilyOf(slug: string): HexPartFamily | undefined {
  const f = HEX_PART_FAMILY[slug];
  return f === undefined ? undefined : HEX_DISPLAY_FAMILY_OF[f];
}
