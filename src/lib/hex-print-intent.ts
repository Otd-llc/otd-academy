// The print settings a downloaded plate carries, and the guard that stops a
// typo shipping as a silently wrong print.
//
// WHY THE FILE CARRIES SETTINGS AT ALL. Alpha testers do not read the README.
// Not "some of them" -- the reported behaviour was that nobody selected the
// infill the parts need, and gyroid on these parts is a TORSION REQUIREMENT
// rather than a preference. Advice that must be read is advice that does not
// arrive, so the intent travels inside the file instead.
//
// WHERE IT LANDS. `Metadata/model_settings.config`, the Orca-family dialect
// (OrcaSlicer, Bambu Studio, Creality Print, ElegooSlicer, Anycubic Slicer Next
// and the rest of that fork tree, which is very nearly the whole consumer
// market). Any `<metadata key value>` under `<object>` is deserialised into that
// object's config -- there is no whitelist on read -- and the settable set is
// `PrintRegionConfig` union `PrintObjectConfig`. Every key below is in one of
// those two.
//
// ============================================================================
// MEASURED, 2026-08-17, Creality Print 7.2.1, not inferred from documentation
// ============================================================================
// A probe battery settled what survives, because three separate research passes
// disagreed with each other and two of them were wrong:
//
//   - Settings ride when the file is OPENED AS A PROJECT. On `File > Import`
//     the slicer parses them and then deliberately calls `config.reset()`,
//     keeping only `extruder`. Double-clicking onto an EMPTY PLATE is an
//     open-as-project, so the ordinary path keeps them; a deliberate Import
//     does not. That gap is accepted (owner, 2026-08-17) rather than papered
//     over with instructions nobody reads.
//   - A BAD ENUM VALUE DOES NOT FAIL. `"Gyroid"` and `"notapattern"` were both
//     silently replaced with **grid**, behind a dialog that blames "a newer
//     version of CrealityPrint" and sends the reader after the wrong problem.
//     Grid is the wrong answer in a part chosen for torsion. That is the entire
//     reason `assertPrintIntentIsSlicerLegal` exists below: the failure mode is
//     a file that looks right, opens clean, prints weak.
//
// See `docs/plans/` and the probe battery for the full matrix.

/**
 * Values Orca's `InfillPattern` enum actually accepts, lowercase exactly as the
 * enum map spells them. Not the full list -- the ones we might plausibly use --
 * because a guard that allows everything is not a guard.
 */
const LEGAL_INFILL = new Set([
  "gyroid",
  "grid",
  "honeycomb",
  "adaptivecubic",
  "cubic",
  "line",
  "concentric",
  "triangles",
  "crosshatch",
]);

/** Orca's `SupportType` spellings. The parentheses are part of the value. */
const LEGAL_SUPPORT_TYPE = new Set([
  "normal(auto)",
  "tree(auto)",
  "normal(manual)",
  "tree(manual)",
]);

/**
 * What EVERY part on a plate is asked to print with.
 *
 * Infill is the load-bearing one. Walls come with it because two perimeters is
 * what the density above was chosen against, and stating one without the other
 * describes a part nobody tested.
 */
export const INTENT_EVERY_PART: Readonly<Record<string, string>> = {
  sparse_infill_pattern: "gyroid",
  sparse_infill_density: "15%",
  wall_loops: "2",
};

/**
 * Added ONLY for the parts that rest on a line, from `hex-support.ts`.
 *
 * NOT APPLIED TO EVERY PART, and the restraint is the point. Support is
 * `normal(auto)` at a 30 degree threshold, so the slicer generates it where the
 * geometry demands it and nowhere else; a brim on all two dozen objects would be
 * two dozen brims to cut off for the benefit of the two that need one.
 *
 * `support_threshold_angle` is stated rather than left to the profile because 30
 * is measured FROM HORIZONTAL, and every overhang figure this project has
 * measured was scored against that number. Inheriting a profile set to 45 would
 * silently change what "needs support" means after the fact.
 */
export const INTENT_SUPPORT_PARTS: Readonly<Record<string, string>> = {
  enable_support: "1",
  support_type: "normal(auto)",
  support_threshold_angle: "30",
  brim_type: "outer_only",
  brim_width: "5",
};

/**
 * Refuse to build a plate whose settings the slicer would silently rewrite.
 *
 * THIS IS NOT DEFENSIVE TIDINESS. It is the one guard standing between a typo
 * and a part that prints at grid infill, looks perfect, and shears under torsion
 * months later. The slicer will not raise it as an error; it substitutes a
 * default and blames a version mismatch.
 *
 * Throws rather than warns, and runs at build time rather than in a test alone,
 * because a warning in a server log is a warning nobody reads -- which is the
 * failure this whole module exists to route around.
 */
export function assertPrintIntentIsSlicerLegal(): void {
  const pattern = INTENT_EVERY_PART.sparse_infill_pattern;
  if (!LEGAL_INFILL.has(pattern)) {
    throw new Error(
      `sparse_infill_pattern "${pattern}" is not a value Orca accepts. ` +
        `It would be silently replaced with grid. Legal: ${[...LEGAL_INFILL].join(", ")}`,
    );
  }
  const support = INTENT_SUPPORT_PARTS.support_type;
  if (!LEGAL_SUPPORT_TYPE.has(support)) {
    throw new Error(
      `support_type "${support}" is not a value Orca accepts. ` +
        `Legal: ${[...LEGAL_SUPPORT_TYPE].join(", ")}`,
    );
  }
  // Enum maps are all-lowercase, and "Gyroid" was MEASURED to degrade silently.
  // Checked separately from set membership so the error names the real defect
  // rather than listing legal values at someone who typed one of them in caps.
  for (const [k, v] of Object.entries({
    ...INTENT_EVERY_PART,
    ...INTENT_SUPPORT_PARTS,
  })) {
    if (v !== v.toLowerCase()) {
      throw new Error(
        `${k}="${v}" has a capital letter. Orca's enum maps are lowercase and ` +
          `a case mismatch is substituted with the option default, silently.`,
      );
    }
  }
}

/** The settings for one part, by whether it is one of the line-resting ones. */
export function intentFor(needsSupport: boolean): Readonly<Record<string, string>> {
  return needsSupport
    ? { ...INTENT_EVERY_PART, ...INTENT_SUPPORT_PARTS }
    : INTENT_EVERY_PART;
}
