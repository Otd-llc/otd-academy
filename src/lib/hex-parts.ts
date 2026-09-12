// The published part list, as the SLUGS the R2 keys actually use.
//
// Generated from `build/printables/manifest.json` in the hex-cluster repo,
// minus the parts withheld on disclosure grounds, and sorted. Regenerate it
// alongside HEX_RELEASE whenever the meshes are re-cut.
//
// WHY A LIST AT ALL, when the download proxy already validates a name grammar.
// The grammar answers "is this a well-formed slug", which is enough when the
// caller names one file and a miss is a 404. The custom pack endpoint takes
// FIFTY-THREE names at once and fans them out into R2 reads, so a grammar-only
// check would let a caller spray arbitrary well-formed slugs and use the
// response as a probe for what exists. Membership answers "is this one of ours",
// which is the question that actually bounds the work.
//
// It is also what lets the pack README list what is inside without a round trip
// to the manifest, which does not ship with the app.
export const HEX_PART_SLUGS = [
  "dovetail-cap-double-f-1h",
  "dovetail-cap-double-f-2h",
  "dovetail-cap-double-f-3h",
  "dovetail-cap-double-f-solid",
  "dovetail-cap-double-m-1h",
  "dovetail-cap-double-m-2h",
  "dovetail-cap-double-m-3h",
  "dovetail-cap-double-m-solid",
  "dovetail-cap-single-f-1h",
  "dovetail-cap-single-f-solid",
  "dovetail-cap-single-m-1h",
  "dovetail-cap-single-m-solid",
  "hex-tb-carrier-bot-parts-tray",
  "hex-tb-carrier-bot-parts-tray-lid",
  "hex-tb-carrier-bot-solid",
  "hex-tb-carrier-left-parts-tray",
  "hex-tb-carrier-left-parts-tray-lid",
  "hex-tb-carrier-left-solid",
  "hex-tb-carrier-parts-tray",
  "hex-tb-carrier-parts-tray-lid",
  "hex-tb-carrier-right-parts-tray",
  "hex-tb-carrier-right-parts-tray-lid",
  "hex-tb-carrier-right-solid",
  "hex-tb-carrier-solid",
  "hex-tb-carrier-top-parts-tray",
  "hex-tb-carrier-top-parts-tray-lid",
  "hex-tb-carrier-top-solid",
  "hex-tb-corner-f-solid",
  "hex-tb-corner-m-solid",
  "hex-tb-half-bot-1h",
  "hex-tb-half-bot-2h",
  "hex-tb-half-bot-3h",
  "hex-tb-half-bot-solid",
  "hex-tb-half-left-1h",
  "hex-tb-half-left-2h",
  "hex-tb-half-left-3h",
  "hex-tb-half-left-solid",
  "hex-tb-half-right-1h",
  "hex-tb-half-right-2h",
  "hex-tb-half-right-3h",
  "hex-tb-half-right-solid",
  "hex-tb-half-top-1h",
  "hex-tb-half-top-2h",
  "hex-tb-half-top-3h",
  "hex-tb-half-top-solid",
  "hex-tb-main",
  "hex-tb-spike-ball-joint",
  "hex-tb-spike-ball-platform-solid",
  "hex-tb-spike-ball-zip-1h",
  "hex-tb-spike-ball-zip-single",
  "hex-tb-spike-platform-lrg",
  "hex-tb-spike-platform-sm",
  "hex-tb-spike-solid",
] as const;

export type HexPartSlug = (typeof HEX_PART_SLUGS)[number];

const SLUG_SET: ReadonlySet<string> = new Set(HEX_PART_SLUGS);

/** Membership, not shape. See the note above. */
export function isHexPartSlug(value: string): value is HexPartSlug {
  return SLUG_SET.has(value);
}

/** What CLASS of part a slug is.
 *
 *  THE SAME SIX NAMES the configurator's `PartFamily` uses
 *  (`bs-cap-hex/src/hex/export/bom.ts`), spelled identically on purpose: that is
 *  the vocabulary the BOM, the exploded figures and the balloons over there are
 *  already banded by, so a reader who knows one knows the other. It is NOT
 *  imported -- the two repos deploy separately and share no package -- and it is
 *  not derived the same way either: over there a family comes from the glTF path
 *  a cell resolved to, and here from the published mesh FILENAME, because that is
 *  the only identity a printable carries.
 *
 *  DELIBERATELY NOT the `family` field in the hex-cluster manifest, which is a
 *  DIFFERENT and coarser three-way grouping (`base`/`insert`/`cap`) belonging to
 *  the exporter. It disagrees with this one on nine of the fifty-three parts: it
 *  files both corner caps under `base`, and all seven spike parts under `insert`.
 *  Cross-checking the two would fail forever on a disagreement that is correct.
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

/** Every family, in the order the thumbnail's value ramp walks them.
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
 *  Exported so the generator can refuse a family it does not know and the palette
 *  can be held to a length, instead of both re-typing the list. */
export const HEX_PART_FAMILIES = [
  "base",
  "insert",
  "pcb",
  "cap",
  "spike",
  "accessory",
] as const satisfies readonly HexPartFamily[];
