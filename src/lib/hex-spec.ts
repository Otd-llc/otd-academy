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

/** Immutable release segment of the published mesh set. Mirrors
 *  `PRINTABLES_RELEASE` in `scripts/upload-printables.ts` — the R2 keys and the
 *  LICENSE.txt inside every published file are stamped with it. */
export const HEX_RELEASE = "2026-07-31";

/** The configurator (a separate deploy). Also the URL printed in the release
 *  README and on every build sheet. */
export const HEX_CONFIGURATOR_URL = "https://demo.onethousanddrones.com/hex";

/** Number of parts in the published set (`build/printables/manifest.json`,
 *  release 2026-07-31; TB-1-POWER withheld on disclosure grounds). */
export const HEX_PART_COUNT = 53;

/** Sizes of the published downloads, so the page can tell someone what a tap
 *  will cost them before they take it on a phone tether.
 *
 *  Safe as constants precisely because release keys are IMMUTABLE: a segment is
 *  never overwritten, so these bytes cannot change under the page. Re-cutting
 *  the meshes mints a new release, which is when these get updated alongside
 *  HEX_RELEASE. Measured from the published objects, not estimated. */
export const HEX_RELEASE_FILES = {
  set: { bytes: 13_682_756, label: "13.7 MB" },
  license: { bytes: 836, label: "836 B" },
} as const;

export type SpecRow = {
  label: string;
  value: string;
  /** Small qualifier rendered beside the value, e.g. "(brand-dependent)". */
  aside?: string;
};

/** The slicer band, in the sheet's order. */
export const HEX_PRINT_PARAMS: SpecRow[] = [
  { label: "Material", value: "FDM PETG" },
  { label: "Nozzle", value: "240 °C" },
  { label: "Bed", value: "70–85 °C", aside: "brand-dependent" },
  { label: "Layer", value: "0.20 mm" },
  { label: "Perimeters", value: "4" },
  { label: "Infill", value: "30% gyroid" },
  { label: "Speed", value: "40–50 mm/s" },
  { label: "Cooling", value: "~30%" },
  { label: "Filament", value: "dry before use" },
];

/** Fit and tolerance. The 0.25 mm gap is the number the whole standard turns
 *  on: it is toleranced against PETG shrinkage, which is why the material is
 *  not a suggestion. */
export const HEX_CLEARANCE: SpecRow[] = [
  { label: "Design gap", value: "0.25 mm", aside: "0.010 in" },
  { label: "FDM convention", value: "0.2–0.3 mm snug", aside: "0.5 mm general" },
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
