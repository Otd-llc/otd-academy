// The Hex Cluster print specification — the ONE place the academy states it.
//
// WHY THIS MODULE EXISTS
// The values below are already stated on a surface that leaves the building:
// the build sheet the configurator prints (bioscale-viz
// `src/hex/export/html.ts`), which a maker holds in one hand while reading
// /hex with the other. A dimensioned drawing exists to stop someone converting
// numbers by hand; two pages disagreeing about the same dimension undoes that
// completely. So every number here is transcribed from the shipped sheet, and
// `__tests__/hex-spec.test.ts` pins the transcription.
//
// bioscale-viz deploys separately and shares no package with this repo, so the
// values CANNOT be imported. Transcription + a pin test is the available
// mechanism; if the sheet changes, the test is the thing that has to be edited
// deliberately rather than a number drifting unnoticed.
//
// SOURCES (verified 2026-08-02)
//   bioscale-viz/src/hex/export/html.ts:272-282   the PARAMS band
//   bioscale-viz/src/hex/export/html.ts:359       assembly step 1 (orientation)
//   bioscale-viz/src/hex/export/html.ts:313-322   fabrication + clearance notes
//   bioscale-viz/src/hex/types.ts:281-289         HEX_SIZE, HEX_GAP
//
// RENDERED-GLYPH NOTE: the ranges use EN dashes (70–85), matching the sheet.
// The house ban is on EM dashes; do not "fix" these to hyphens or the two
// surfaces stop matching.

import {
  INTENT_EVERY_PART,
  INTENT_EVERY_PART_DISPLAY,
} from "@/lib/hex-print-intent";
import {
  HEX_RELEASE_FILES as GENERATED_RELEASE_FILES,
  HEX_TABLES_RELEASE,
} from "@/lib/hex-release-tables";

/** The release the app serves: the immutable R2 segment every download link,
 *  the LICENSE.txt stamp and the pack route are keyed on.
 *
 *  ONE CONSTANT, AND IT IS THE GENERATOR'S INPUT. Launch readiness 4.2 makes the
 *  release id the input to hex-cluster's `tools/gen_release_tables.py`, which
 *  stamps it into `hex-release-tables.ts` along with every table measured from
 *  that release. Reading it from there means the id cannot disagree with the
 *  tables: changing it is regenerating them, never editing a string here.
 *
 *  The earlier releases (2026-07-31, 2026-08-03, 2026-08-17) are v1 and are not
 *  deleted -- their keys are immutable and carry a one-year cache header. They
 *  are the published record (`hex-published-record.ts`); nothing live reads
 *  them. Which releases `/api/printable` serves is `PUBLISHED_RELEASES`, which
 *  lives on its own branch, and the new id is added there only at launch. */
export const HEX_RELEASE: string = HEX_TABLES_RELEASE;

/** The configurator (a separate deploy). Also the URL printed in the release
 *  README and on every build sheet. */
export const HEX_CONFIGURATOR_URL = "https://demo.onethousanddrones.com/hex";

/** Number of parts in the release, generated with the list it counts.
 *
 *  NOT PAGE COPY, deliberately. The set grows whenever a part is added, so a
 *  count printed on /hex is a promise the page cannot keep on its own. The
 *  count exists only where it is CHECKED: the pack test asserts it against
 *  HEX_PART_SLUGS.length. */
export { HEX_PART_COUNT } from "@/lib/hex-release-tables";

/** Sizes of the published downloads, so the page can tell someone what a tap
 *  will cost them before they take it on a phone tether.
 *
 *  `set` is the 3MF-only full-set zip (decision 1.3), from the generated table:
 *  its bytes are the SUM OF ITS MEMBERS, a floor rather than the object size,
 *  because the zip is built by the uploader and its exact size is recorded by
 *  the upload dry run (4.9).
 *
 *  `license` is the 2026-08-17 notice, 836 bytes, carried until the v2
 *  LICENSE.txt wording lands (6.8) and is measured. */
export const HEX_RELEASE_FILES = {
  set: {
    bytes: GENERATED_RELEASE_FILES.set.contentBytes,
    label: GENERATED_RELEASE_FILES.set.label,
  },
  license: { bytes: 836, label: "836 B" },
} as const;

export type SpecRow = {
  label: string;
  value: string;
  /** Small qualifier rendered beside the value, e.g. "(brand-dependent)". */
  aside?: string;
};

/** The slicer band, in the sheet's order.
 *
 *  TWO OF THESE ROWS ARE DERIVED, NOT TRANSCRIBED, and the two are exactly the
 *  ones a downloaded plate now sets for itself. `Perimeters` and `Infill` come
 *  from `PRINT_INTENT_TABLE`, so this card cannot state a number the file
 *  contradicts -- which it did: the file baked 15% at 2 walls while this band,
 *  both archive READMEs and the build sheet all said 30% gyroid at 4, and
 *  nothing compared them because nothing could.
 *
 *  THE PIN TEST STILL PINS THE SHEET, and that is the point rather than a
 *  casualty. `hex-spec.test.ts` asserts these rows against the literals
 *  transcribed from bioscale-viz `html.ts`, so changing the table now FAILS that
 *  test until the sheet is changed to match. The two repos share no package and
 *  cannot import each other; a failing transcription pin is the whole mechanism
 *  keeping them honest, and deriving the value gives it something real to check
 *  rather than a second copy agreeing with itself. */
export const HEX_PRINT_PARAMS: SpecRow[] = [
  { label: "Material", value: "FDM PETG" },
  { label: "Nozzle", value: "240 °C" },
  { label: "Bed", value: "70–85 °C", aside: "brand-dependent" },
  { label: "Layer", value: "0.20 mm" },
  // `wall_loops` to the slicer, "Perimeters" to every surface a reader holds.
  { label: "Perimeters", value: INTENT_EVERY_PART.wall_loops },
  // Density then pattern, the order the sheet prints and the order it is said
  // aloud. Both halves come from the table; neither is spelled here.
  //
  // THE DISPLAY MAP, NOT THE VALUE MAP. This is a card a person reads, and the
  // pattern's slicer enum is `adaptivecubic` -- one word, no space. It used to
  // not matter, because every value was its own display back when the pattern
  // was "gyroid".
  {
    label: "Infill",
    value: `${INTENT_EVERY_PART.sparse_infill_density} ${INTENT_EVERY_PART_DISPLAY.sparse_infill_pattern}`,
  },
  { label: "Speed", value: "40–50 mm/s" },
  { label: "Cooling", value: "~30%" },
  { label: "Filament", value: "dry before use" },
];

/** Fit and tolerance. The 0.25 mm gap is the number the whole standard turns
 *  on: it is toleranced against PETG shrinkage, which is why the material is
 *  not a suggestion. */
export const HEX_CLEARANCE: SpecRow[] = [
  { label: "Design gap", value: "0.25 mm", aside: "0.010 in" },
  {
    label: "FDM convention",
    value: "0.2–0.3 mm snug",
    aside: "0.5 mm general",
  },
  { label: "PETG shrinkage", value: "0.3–0.6%", aside: "up to ~0.8%" },
];

/** Cell pitch, DERIVED from the two geometry constants rather than transcribed,
 *  so it cannot disagree with them:
 *    HEX_SIZE 43.85 mm (circumradius) × √3 = 75.95 mm across flats
 *    + HEX_GAP 0.25 mm                     = 76.20 mm centre to centre
 *  The sheet does not print a pitch; a maker adapting the standard needs one. */
export const HEX_CIRCUMRADIUS_MM = 43.85;
export const HEX_GAP_MM = 0.25;
export const HEX_PITCH_MM =
  Math.round((HEX_CIRCUMRADIUS_MM * Math.sqrt(3) + HEX_GAP_MM) * 100) / 100;

/** Print orientation. Transcribed verbatim in substance from assembly step 1;
 *  it is the one instruction that changes whether a joint survives load. */
export const HEX_ORIENTATION = {
  value: "hex-face-down",
  why:
    "The only symmetric orientation across all six dovetails. Pull-apart force " +
    "loads interlayer bonds, the weak FDM axis; PETG layer adhesion compensates.",
} as const;

/** CC BY 4.0. One-way: files already published under it stay under it, and only
 *  a future release could carry different terms. Mirrors the LICENSE.txt built
 *  in `scripts/upload-printables.ts`. */
export const HEX_LICENSE = {
  name: "CC BY 4.0",
  fullName: "Creative Commons Attribution 4.0 International",
  deed: "https://creativecommons.org/licenses/by/4.0/",
  legalCode: "https://creativecommons.org/licenses/by/4.0/legalcode",
  holder: "One Thousand Drones, LLC",
  /** The canonical attribution line a remixer can copy verbatim. */
  credit:
    "Hex Cluster by One Thousand Drones, LLC, licensed CC BY 4.0. " +
    "Source: https://academy.onethousanddrones.com/hex",
} as const;
