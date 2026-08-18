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
//   bioscale-viz/src/hex/export/html.ts:206-215   the PARAMS band
//   bioscale-viz/src/hex/export/html.ts:299       assembly step 1 (orientation)
//   bioscale-viz/src/hex/export/html.ts:313-322   fabrication + clearance notes
//   bioscale-viz/src/hex/types.ts:281-289         HEX_SIZE, HEX_GAP
//
// RENDERED-GLYPH NOTE: the ranges use EN dashes (70–85), matching the sheet.
// The house ban is on EM dashes; do not "fix" these to hyphens or the two
// surfaces stop matching.

import { INTENT_EVERY_PART } from "@/lib/hex-print-intent";

/** Immutable release segment of the published mesh set. Mirrors
 *  `PRINTABLES_RELEASE` in `scripts/upload-printables.ts` — the R2 keys and the
 *  LICENSE.txt inside every published file are stamped with it.
 *
 *  2026-08-03 supersedes 2026-07-31, which is NOT deleted: the keys are
 *  immutable and carry a one-year cache header, so any URL already in the wild
 *  keeps resolving. Two things were wrong with that release and neither could be
 *  edited in place — the twelve FEMALE dovetail caps exported upside down (the
 *  exporter applied one X rotation to the whole cap family, which is correct for
 *  the male half and inverts the female one), and its README named PLA. Both are
 *  fixed here. */
/** 2026-08-17 re-cuts the meshes again. What it changes, all of it orientation:
 *
 *  THE CAP FIX ABOVE ONLY FIXED HALF THE CAPS. 08-03's note says the twelve
 *  FEMALE caps had exported upside down and were corrected. Measured on 08-03's
 *  own meshes -- flat area at the extreme low against the extreme high, which is
 *  a test holes cannot invert -- the females are indeed outward-face-down and
 *  the six MALE variants are outward-face-up. The exporter mirrored the ROTATION
 *  to match a mirrored part, and mirroring a rotation on an already-mirrored
 *  part points the two outward faces in opposite directions. That is also the
 *  "why do they alternate in the slicer?" the owner spotted. Both families now
 *  carry the same entry, which is the fix stated as an assertion that they do
 *  not differ.
 *
 *  FOUR PARTS WERE RESTING ON ALMOST NOTHING. Measured as a real first-layer
 *  cross-section rather than by summing downward-facing facets (which reports
 *  ZERO on a curved contact, and did): the two corners stood 30 mm tall on
 *  19.58 sq mm, and the ball platform and zip-1H on 11.56. Re-oriented they
 *  measure 416.8, 655.3 and 1623.8 sq mm. The corners rest on a HEX FLANK, a
 *  pose no axis-aligned search can find, because a wedge's best face is not
 *  perpendicular to any axis -- cluster the mesh by face normal instead.
 *
 *  Ten further parts (ball platforms, carrier solids, parts trays) were turned
 *  onto their largest face. `Hex-TB-Spike-Ball-Zip-Single` was left alone at
 *  6.74 sq mm: every candidate pose was swept and the best alternative is 13.40
 *  sq mm at 17.3 mm tall, a worse aspect than 6.74 at 11.6. It keeps its brim.
 *  Do not move a part without somewhere better to move it to.
 *
 *  NO GEOMETRY CHANGED. Owner constraint: the models are what they are. */
export const HEX_RELEASE = "2026-08-17";

/** The configurator (a separate deploy). Also the URL printed in the release
 *  README and on every build sheet. */
export const HEX_CONFIGURATOR_URL = "https://demo.onethousanddrones.com/hex";

/** Number of parts in the published set (`build/printables/manifest.json`,
 *  TB-1-POWER withheld on disclosure grounds). Unchanged across both releases:
 *  2026-08-03 re-cut the geometry, it did not add or drop a part.
 *
 *  NOT PAGE COPY, deliberately. /hex used to print it three times -- in the
 *  hero line, in the spec list and on the download row -- and the set grows
 *  whenever a part is added, so every one of those was a promise the page could
 *  not keep on its own. The count now exists only where it is CHECKED: the pack
 *  test asserts it against HEX_PART_SLUGS.length, so a mismatch fails the suite
 *  instead of shipping a wrong number to a reader. */
export const HEX_PART_COUNT = 53;

/** Sizes of the published downloads, so the page can tell someone what a tap
 *  will cost them before they take it on a phone tether.
 *
 *  Safe as constants precisely because release keys are IMMUTABLE: a segment is
 *  never overwritten, so these bytes cannot change under the page. Re-cutting
 *  the meshes mints a new release, which is when these get updated alongside
 *  HEX_RELEASE. Measured from the published objects, not estimated. */
export const HEX_RELEASE_FILES = {
  // HEAD'd off the published objects for 2026-08-17, not carried over: the set
  // is a zip of re-oriented meshes, so its size moved (13_688_628 on 08-03).
  // The licence is byte-identical because the text did not change.
  set: { bytes: 13_718_988, label: "13.1 MB" },
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
  {
    label: "Infill",
    value: `${INTENT_EVERY_PART.sparse_infill_density} ${INTENT_EVERY_PART.sparse_infill_pattern}`,
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
