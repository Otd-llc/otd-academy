// Hex Cluster v2: every number the /hex page states, with where it came from.
//
// DRAFT FOR OWNER REVIEW (launch item 6.4). Nothing here is imported from the
// configurator or the CAD repo, because neither ships a package this repo can
// depend on. Each value is transcribed from a named source and the test beside
// it (`__tests__/hex-v2-page.test.ts`) pins the derivations, so a changed
// number fails a test instead of drifting quietly.
//
// SOURCES (read 2026-09-25, all read-only)
//   hex-cluster  docs/naming-v2.md §3        hexWidth 200 (corners), jointDepth
//                                              4, tol 0.25, pitch formula, the
//                                              dovetail bearing table
//   hex-cluster  docs/naming-v2.md §4.1      bases, halves, quarters
//   hex-cluster  docs/naming-v2.md §4.5      cap grammar (profile/variant/gender)
//   bs-explode   src/hex/v2/lattice.ts:16-31 PITCH_MM, same formula
//   bs-explode   src/hex/v2/lattice.ts:101-108 HEX_EDGES bearings and genders
//   bs-explode   src/hex/v2/view.ts:177-193  largest part 190.77 x 169.21, 220 bed
//   bs-explode   src/hex/part-facts.json      hex-main bbox + reference print
//   hex-cluster  tools/slice_reference.py     the profile those minutes came from
//   hex-cluster  tools/parts-copy.json        jig titles and uses
//   launch readiness decisions 1.3, 1.4, 1.5, 1.12, 1.13, 1.21

/** Release segment of the v2 mesh set.
 *
 *  PLACEHOLDER. Set at publish (launch Phase 10) to the immutable release date
 *  the uploader stamps. Until then every download link on the page resolves to
 *  a 404 from `/api/printable`, which rejects a segment that is not a date. */
export const HEX_V2_RELEASE = "TODO-v2-release";

// -- geometry ----------------------------------------------------------------

/** `hexWidth` in hex-main's vars sheet. ACROSS CORNERS, in CAD. */
export const HEX_V2_HEX_WIDTH_MM = 200;
/** `jointDepth` and `tol`, same sheet. */
export const HEX_V2_JOINT_DEPTH_MM = 4;
export const HEX_V2_TOL_MM = 0.25;
/** Centre to opposite flat of the 200 mm hexagon. */
export const HEX_V2_APOTHEM_MM = (Math.sqrt(3) / 4) * HEX_V2_HEX_WIDTH_MM;

/** Cell pitch, centre to centre. Derived the way the configurator derives it
 *  (lattice.ts:31), never typed: 2 x 86.6025 - 2 x (4 - 0.25) = 165.705. */
export const HEX_V2_PITCH_MM =
  2 * HEX_V2_APOTHEM_MM - 2 * (HEX_V2_JOINT_DEPTH_MM - HEX_V2_TOL_MM);

/** `hex-main` as printed (part-facts.json `bbox`). The corners are cut back, so
 *  the long side is 190.762 rather than the 200 of the construction hexagon. */
export const HEX_V2_MAIN_BBOX_MM = { x: 190.762, y: 169.205, z: 80 } as const;

/** The six edges, bearings in degrees counter-clockwise from east. */
export const HEX_V2_MALE_BEARINGS = [30, 150, 270] as const;
export const HEX_V2_FEMALE_BEARINGS = [90, 210, 330] as const;

/** Largest part on the bed (`hex-half-n`), and the bed floor from decision 1.5. */
export const HEX_V2_LARGEST_PART_MM = { x: 190.77, y: 169.21 } as const;
export const HEX_V2_BED_MIN_MM = 220;

// -- print -------------------------------------------------------------------

export type SpecRow = { label: string; value: string; aside?: string };

/** Decision 1.4, verbatim in substance. Temperatures are deliberately absent:
 *  they belong to the filament and the slicer's own profile. */
export const HEX_V2_PRINT_PROFILE: SpecRow[] = [
  { label: "Material", value: "PETG" },
  { label: "Nozzle diameter", value: "0.4 mm", aside: "0.6 also works" },
  { label: "Layer height", value: "0.20 mm", aside: "0.30 on a 0.6 nozzle" },
  { label: "Walls", value: "4" },
  { label: "Infill", value: "30% adaptive cubic" },
  { label: "Bed", value: `${HEX_V2_BED_MIN_MM} × ${HEX_V2_BED_MIN_MM} mm`, aside: "or larger" },
];

/** The four slicers the page names (item 6.4). Order is the owner's. */
export const HEX_V2_SLICERS = [
  "Creality Print",
  "OrcaSlicer",
  "PrusaSlicer",
  "Cura",
] as const;

/** Reference print, one part. From part-facts.json `print`, which build_printables
 *  merges from tools/slice_reference.py: Creality K2 Plus, Creality Print, the
 *  vendor's 0.20 mm Standard process with 4 walls and 30% adaptive cubic, PETG
 *  at 1.27 g/cm3, supports not enabled. */
export type ReferencePrint = { part: string; minutes: number; grams: number };

export const HEX_V2_REFERENCE_PRINTS: ReferencePrint[] = [
  { part: "hex-main", minutes: 397, grams: 255.49 },
  { part: "hex-half-n", minutes: 318, grams: 219.96 },
  { part: "hex-main-cover", minutes: 76, grams: 61.16 },
  { part: "hex-cap-edge-solid-m", minutes: 36, grams: 28.44 },
];

/** Filament per spool the spool count assumes. */
export const HEX_V2_SPOOL_GRAMS = 1000;

/** The smallest first build the page proposes: two bases on one joint.
 *  OWNER-REVIEW: the choice of build is a draft. */
export const HEX_V2_FIRST_BUILD: { part: string; count: number }[] = [
  { part: "hex-main", count: 2 },
];

export function referenceFor(part: string): ReferencePrint {
  const hit = HEX_V2_REFERENCE_PRINTS.find((p) => p.part === part);
  if (!hit) throw new Error(`no reference print for ${part}`);
  return hit;
}

export function firstBuildTotals(): { minutes: number; grams: number; spools: number } {
  let minutes = 0;
  let grams = 0;
  for (const { part, count } of HEX_V2_FIRST_BUILD) {
    const r = referenceFor(part);
    minutes += r.minutes * count;
    grams += r.grams * count;
  }
  return { minutes, grams, spools: grams / HEX_V2_SPOOL_GRAMS };
}

/** 397 -> "6 h 37 min". Mono-free: the page sets the face. */
export function hoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

// -- downloads ---------------------------------------------------------------

/** Every v2 download goes through the academy's `/api/printable` route
 *  (decision 1.2: allow-list, capture, 302 to a presigned object). Never the
 *  direct-R2 form, because the v2 bucket is private. */
export function printableProxyPath(release: string, rest: string): string {
  return `/api/printable/${release}/${rest}`;
}

/** Decision 1.3: one full-set archive, 3MF only. STL and STEP are per part.
 *
 *  The size is the 4.9 DRY RUN's measurement (2026-09-25), re-run after its
 *  three defects were fixed: 18,542,930 bytes for release 2026-10-01, 290
 *  parts, byte-identical across two runs, against the real unfiltered manifest
 *  (docs/plans/2026-09-25-hex-v2-upload-dry-run.md). It replaces the decision's
 *  "~19.5 MB" estimate. It is still NOT a published object: the README inside
 *  the zip carries a placeholder where the 2.6 safety text goes, and the owner's
 *  text will change the size again, so `sizeMeasured` stays false until 10.3
 *  HEADs the real key. Decimal MB. */
export const HEX_V2_SET = {
  name: "hex-cluster",
  sizeBytes: 18_542_930,
  sizeLabel: "~18.5 MB",
  sizeMeasured: false,
} as const;

export type Jig = {
  stem: string;
  title: string;
  /** What printing it tells you. */
  reading: string;
  /** What to do with that reading. */
  action: string;
};

/** "Print these first". Titles and the substance of each line come from
 *  hex-cluster tools/parts-copy.json; the reading/action split and the order
 *  are the draft's. OWNER-REVIEW. */
export const HEX_V2_JIGS: Jig[] = [
  {
    stem: "hex-jig-tolerance-ladder",
    title: "Tolerance ladder",
    reading:
      "Seven rungs of dovetail clearance in one print, each with a bolt hole stepped by the same index.",
    action:
      "Find the rung your dovetail slides into cleanly. Read the bolt fit off the same rung.",
  },
  {
    stem: "hex-jig-dovetail-gauge",
    title: "Dovetail gauge",
    reading:
      "GO on one face and NO-GO on the other. A correct tab enters GO; a tab that also enters NO-GO is undersize.",
    action:
      "Slide it down one printed flat before you commit a batch, and again after any change of filament, profile or nozzle.",
  },
  {
    stem: "hex-jig-grate-sample",
    title: "Grate sample tile",
    reading:
      "Every cover hole pattern side by side, each at its real size.",
    action:
      "Choose a cover pattern by holding it. If your printer renders these cleanly, it will render a cover cleanly.",
  },
  {
    stem: "hex-jig-drill-guide",
    title: "Drill guide",
    reading:
      "Drops onto any perimeter flat, locates on the side port and presents the four bolt holes as bushings.",
    action:
      "Drill through it to add the bolt pattern to a base printed without it. It drills the through hole only.",
  },
];

// -- people ------------------------------------------------------------------

/** Decision 1.13. PLACEHOLDER: the alias does not exist yet (TODO-owner). */
export const HEX_V2_SUPPORT_EMAIL = "hex@onethousanddrones.com";
/** 72 h reply target, decision 1.13. */
export const HEX_V2_SUPPORT_REPLY_HOURS = 72;
