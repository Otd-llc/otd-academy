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
 * THE TABLE. One row per setting, and every surface that states a setting reads
 * this and nothing else.
 *
 * WHY ONE TABLE, AND WHY IT IS NOT TIDINESS. The same three facts were written
 * in five places -- here as slicer keys, in `hex-spec.ts` as the /hex spec
 * card's `Infill` and `Perimeters` rows, in both archive READMEs through those,
 * on the configurator's build sheet, and once more in the configurator's
 * download strip -- and they had ALREADY DRIFTED. The plate baked 15% infill at
 * 2 walls while every sentence beside it said 30% gyroid at 4 perimeters, so an
 * archive shipped a README contradicting the file it was wrapped around.
 * Nothing caught it, because nothing compared them. That is the
 * `hex-support.ts` lesson arriving a second time, and this time it had shipped.
 *
 * `value` is what the SLICER parses: a literal from Orca's own enum maps,
 * lowercase, checked by `assertPrintIntentIsSlicerLegal` below. `display` is the
 * same fact spelled for a person. Two fields rather than one derived from the
 * other, because they are genuinely different languages -- `sparse_infill_
 * density` takes "30%" and so does a reader, but `wall_loops` takes "4" where
 * every surface this project has ever printed calls it "perimeters".
 *
 * `scope` decides which objects on a plate carry the row AND, separately,
 * whether a reader is ever shown it: only `every` rows are rendered. Support and
 * brim rows still carry human text they do not currently use, because ONE ROW
 * SHAPE is the point -- parallel structures are how a value ends up beside the
 * wrong label, which is the failure `hex-support.ts` documents at length.
 */
export type PrintIntentRow = {
  /** Orca's key, as `Metadata/model_settings.config` spells it. */
  key: string;
  /** The literal the slicer parses. Lowercase; enum values are validated. */
  value: string;
  /** What a reader is told this setting is called. */
  label: string;
  /** What a reader is told it is set to. */
  display: string;
  /** Which objects carry it -- and whether a reader sees it at all. */
  scope: "every" | "support" | "brim";
  /**
   * The same intent in PrusaSlicer's dialect, or `null` for "deliberately not
   * carried".
   *
   * A SECOND KEY AND A SECOND VALUE, not just a rename, because the two forks
   * disagree about more than spelling. Orca says "support is on" with
   * `enable_support` plus a `support_type` naming an algorithm; PrusaSlicer
   * splits the same idea across two booleans, and setting only the first gives
   * you support ONLY where an enforcer says so -- which is off, for our
   * purposes, while looking on.
   *
   * On the row rather than in a lookup table beside it, for the reason this
   * whole module exists: a parallel map is a second place to edit and the one
   * nobody remembers.
   */
  prusa: { key: string; value: string } | null;
  /**
   * The same intent in Cura's dialect, or `null` for "deliberately not carried".
   *
   * A THIRD KEY AND A THIRD VALUE, and more nulls than the other two, because
   * Cura restricts per-object settings to those flagged `settable_per_mesh` in
   * its own `fdmprinter.def.json`. Verified there, not assumed:
   *
   *   infill_pattern         enum  settable_per_mesh TRUE   (gyroid is an option)
   *   infill_sparse_density  float settable_per_mesh TRUE   (percent, NO `%` sign)
   *   wall_line_count        int   settable_per_mesh TRUE
   *   support_enable         bool  settable_per_mesh TRUE   (`True`, Python-cased)
   *   support_angle          float settable_per_mesh TRUE   -- omitted anyway, see below
   *   support_type           enum  settable_per_mesh FALSE  -- and means something else
   *   adhesion_type          enum  settable_per_mesh FALSE
   *   brim_width             float settable_per_mesh FALSE
   *   brim_line_count        int   settable_per_mesh FALSE
   *
   * SO THE WHOLE BRIM SCOPE IS `null`. Cura has no per-object brim at all;
   * translating one would ship a setting that looks carried and does nothing.
   */
  cura: { key: string; value: string } | null;
};

export const PRINT_INTENT_TABLE: readonly PrintIntentRow[] = [
  // =====================================================================
  // EVERY PART ON THE PLATE.
  //
  // Infill is the load-bearing one, and it is a PATTERN requirement before
  // it is a density one: these parts are loaded in torsion, and gyroid is
  // what that choice was made for. Density and perimeters travel with it
  // because 30% was chosen against four -- stating either alone describes a
  // part nobody tested.
  // =====================================================================
  {
    key: "sparse_infill_pattern",
    value: "gyroid",
    prusa: { key: "fill_pattern", value: "gyroid" },
    cura: { key: "infill_pattern", value: "gyroid" },
    label: "infill",
    display: "gyroid",
    scope: "every",
  },
  {
    key: "sparse_infill_density",
    value: "30%",
    prusa: { key: "fill_density", value: "30%" },
    // NO `%`. Cura types this as a FLOAT, where Orca and Prusa both want a
    // percent string -- and Prusa actively multiplies a bare number by 100.
    // Three dialects, three spellings of one number.
    cura: { key: "infill_sparse_density", value: "30" },
    label: "density",
    display: "30%",
    scope: "every",
  },
  {
    // "perimeters", not "walls". The slicer's name for it is the `key` on the
    // line above; the reader's name for it is whatever the build sheet and the
    // /hex spec card have said all along, and those two surfaces sit inches
    // from this one. One fact under two names on one page is the same defect as
    // one fact with two values, a step less obvious.
    key: "wall_loops",
    value: "4",
    prusa: { key: "perimeters", value: "4" },
    cura: { key: "wall_line_count", value: "4" },
    label: "perimeters",
    display: "4",
    scope: "every",
  },

  // =====================================================================
  // ONLY the parts that print into thin air, from `hex-support.ts`.
  //
  // NOT APPLIED TO EVERY PART, and the restraint is the point. Support is
  // `normal(auto)` at a 30 degree threshold, so the slicer generates it where
  // the geometry demands it and nowhere else.
  //
  // `support_threshold_angle` is STATED rather than left to the profile
  // because 30 is measured FROM HORIZONTAL, and every overhang figure this
  // project has measured was scored against that number. Inheriting a profile
  // set to 45 would silently change what "needs support" means after the fact.
  // =====================================================================
  {
    key: "enable_support",
    value: "1",
    prusa: { key: "support_material", value: "1" },
    // `True`, Python-cased -- Cura parses its own bool spelling, not `1`.
    cura: { key: "support_enable", value: "True" },
    label: "support",
    display: "on",
    scope: "support",
  },
  {
    key: "support_type",
    value: "normal(auto)",
    // NOT A RENAME. PrusaSlicer has no `support_type` naming an algorithm; it
    // splits the idea in two, and `support_material=1` ALONE means "support
    // only where an enforcer says so" -- off, for our purposes, while reading as
    // on. `support_material_auto=1` is the half that means "and find the
    // overhangs yourself", which is what `normal(auto)` says over here.
    prusa: { key: "support_material_auto", value: "1" },
    // NOT CARRIED. Cura has no separate "and find the overhangs yourself"
    // flag -- `support_enable` alone already means automatic support there.
    // A key that does not exist would be parked in Cura's node metadata and
    // silently never applied.
    cura: null,
    label: "support type",
    display: "normal, automatic",
    scope: "support",
  },
  {
    key: "support_threshold_angle",
    value: "30",
    // SAME NUMBER, SAME DIRECTION, DIFFERENT DEFAULT. Both are measured from
    // horizontal and both mean "support what lies within this angle of it", so
    // 30 carries across unchanged. What does NOT carry across is the default:
    // Orca ships 30, PrusaSlicer ships 0, and 0 there means "automatic
    // detection (recommended)" rather than "never". So writing 30 into a Prusa
    // file is an OVERRIDE of its recommended behaviour, not agreement with it.
    // Stated anyway, and for the reason above: every overhang figure this
    // project has measured was scored against 30.
    prusa: { key: "support_material_threshold", value: "30" },
    // ====================================================================
    // NOT CARRIED, AND THIS ONE IS A TRAP RATHER THAN AN ABSENCE.
    // ====================================================================
    // Cura HAS a per-mesh equivalent (`support_angle`) and the number would
    // look like it transfers. It does not. Cura measures from VERTICAL and
    // INVERTS the direction -- its own description: "At a value of 0 all
    // overhangs are supported, 90 will not provide any support." Orca and
    // Prusa measure from HORIZONTAL, where larger means MORE support.
    //
    // So our 30-from-horizontal is 60 in Cura's terms, and writing 30 there
    // would ask for support on anything more than 30 degrees off vertical --
    // far more than intended, and more aggressive than Cura's own default of
    // 50. That is a wrong print, not a missing setting.
    //
    // The complement is easy arithmetic and is STILL not carried, because it
    // would be a derived number asserted into a slicer nobody here has
    // opened. `support_enable` alone leaves Cura on its own recommended 50,
    // which is close to the 60 we would have asked for. Omission is the
    // honest option until someone opens Cura.
    cura: null,
    label: "support threshold",
    display: "30 deg from horizontal",
    scope: "support",
  },

  // =====================================================================
  // ONLY the parts whose first layer is too small to hold them.
  //
  // SEPARATE FROM SUPPORT, and keeping them apart is the correction rather
  // than a tidy-up. They answer different questions with different causes:
  //
  //   a brim   answers "will it stay stuck to the bed", and is decided by the
  //            FIRST LAYER AREA;
  //   support  answers "is anything printing into thin air", and is decided
  //            by what happens at every layer ABOVE the first.
  //
  // Bundling them was wrong in both directions at once. `Hex-TB-Corner-M-
  // Solid` has 416.8 sq mm of bed contact and wants no brim whatsoever, but
  // Creality reports it "has floating regions" and asks for support.
  // `Hex-TB-Spike-Ball-Joint` is the mirror image: it needs support badly and
  // a brim cannot help it, because there is almost no perimeter for one to
  // hold on to. One flag could not be right for both.
  // =====================================================================
  {
    key: "brim_type",
    value: "outer_only",
    prusa: { key: "brim_type", value: "outer_only" },
    // NOT CARRIED: `adhesion_type` is settable_per_mesh FALSE in Cura.
    cura: null,
    label: "brim",
    display: "outer only",
    scope: "brim",
  },
  {
    key: "brim_width",
    value: "5",
    prusa: { key: "brim_width", value: "5" },
    // NOT CARRIED: `brim_width` is settable_per_mesh FALSE in Cura. There is
    // no per-object brim in Cura at all.
    cura: null,
    label: "brim width",
    display: "5 mm",
    scope: "brim",
  },
];

// ===========================================================================
// THE GUARD RUNS HERE, AT MODULE SCOPE, AND THAT PLACEMENT IS THE WHOLE POINT.
// ===========================================================================
// It used to run inside `buildPlate3mf`, once per plate, on a live request. Two
// things were wrong with that and both were invisible:
//
//   IT VALIDATED A SOURCE THE WRITER NO LONGER READS. The writer emits the
//   FROZEN SNAPSHOTS `byScope` takes below; the guard reads the table. The only
//   divergence a request-time check could observe is a post-load mutation of a
//   table row -- which cannot change a single byte of the emitted file, because
//   the snapshots were already taken. It could report defects that cannot ship
//   and could not report the defect that ships.
//
//   ITS MESSAGE WENT NOWHERE. The route wraps `buildPlate3mf` in a bare
//   `catch {}` and returns "Server error" with no logging. The twelve lines
//   below arguing that the case check must precede the membership check exist
//   solely to shape an error string -- and in production that string was
//   assigned to nothing, after the request had already paid for ~13 MB of R2
//   reads.
//
// Here, it runs at the exact moment the snapshots are taken from the table,
// which is the only moment the two can disagree.
//
// MEASURED, not assumed -- the claim it replaced was wrong in exactly this way.
// Capitalising the infill pattern and running `pnpm next build` exits 1 with:
//
//   Error: sparse_infill_pattern="Gyroid" has a capital letter. Orca's enum
//   maps are lowercase and a case mismatch is substituted with the option
//   default, silently.
//   > Build error occurred
//   Error: Failed to collect page data for /hex/opengraph-image-...
//
// Note WHERE it fires. Not because /hex prerenders -- `cacheComponents: true`
// makes dynamic the default and /hex opts into no cache, so it very likely does
// not. It fires because Next imports every page and route module while
// COLLECTING PAGE DATA, whatever each one's render mode. That is a far more
// robust hook than prerendering, and it is the reason the placement works.
//
// So a bad table fails the build, with the full message on stdout, inside the
// `Vercel` check -- which is REQUIRED on main, where `pnpm vitest run` is not.
// That is what the old comment claimed and never did.
assertRowsAreSlicerLegal(PRINT_INTENT_TABLE);

/** Collapse one scope's rows into the key/value map the 3MF writer emits.
 *
 *  FROZEN. These are module-level objects handed to a function that spreads them
 *  into a per-object result on every request of a warm serverless instance, so a
 *  mutation upstream would change what every later download bakes -- the class of
 *  bug that reproduces for nobody. `DEFAULT_BED` in `hex-pack.ts` carries the
 *  same freeze for the same reason. */
function byScope(
  scope: PrintIntentRow["scope"],
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      PRINT_INTENT_TABLE.filter((r) => r.scope === scope).map((r) => [
        r.key,
        r.value,
      ]),
    ),
  );
}

/** What EVERY part on a plate is asked to print with. */
export const INTENT_EVERY_PART = byScope("every");

/** Added ONLY for the parts that print into thin air, from `hex-support.ts`. */
export const INTENT_SUPPORT_PARTS = byScope("support");

/** Added ONLY for the parts whose first layer is too small to hold them. */
export const INTENT_BRIM_PARTS = byScope("brim");

/**
 * The settings a READER is shown, in the order the surfaces read them.
 *
 * `every` rows only, and the filter is the whole argument. A brim is written for
 * three measured parts and support for twenty-five, not for the plate, so a flat
 * "brim 5 mm" on a card would be false of almost every build -- and a strip is
 * worth nothing unless every line on it is true of the file just taken. A count
 * of the support parts is worse still: that list lives in `hex-support.ts`
 * precisely because it used to live in two places, and restating it here would
 * rebuild the defect that file exists to prevent. Support needs no announcement
 * anyway -- on the normal path the slicer simply has it on.
 *
 * THAT SENTENCE USED TO CONTINUE "and on a geometry-only import the enforcers
 * make the slicer raise it itself." IT WAS FALSE. There are no enforcers in the
 * file, and there never have been. It was written in the present tense about a
 * fail-safe that was designed and not built, and it survived a merge -- the
 * third time this project has stated a slicer behaviour it had not opened. On a
 * geometry-only import today, the settings are simply gone and NOTHING warns.
 * That gap is real and currently uncovered; `scripts/hex-enforcer-probe.ts`
 * builds the two files that decide how to close it.
 *
 * Shaped `{ label, value }` rather than as the row type, so the configurator's
 * strip -- which deploys separately and cannot import across the repo boundary --
 * can pin a literal of exactly this shape against it.
 */
export const PRINT_INTENT_FACTS: readonly { label: string; value: string }[] =
  PRINT_INTENT_TABLE.filter((r) => r.scope === "every").map((r) => ({
    label: r.label,
    value: r.display,
  }));

/**
 * The lead line above those facts, wherever they are shown.
 *
 * One clause, because it is read in the second after a download starts, which is
 * not a moment anyone spends on a paragraph. It is not an instruction -- there is
 * no step to take. It is here to stop someone re-slicing from habit and quietly
 * replacing gyroid, which on these parts is a torsion requirement rather than a
 * preference.
 */
export const PRINT_INTENT_LEAD = "Already set in the file, leave as is";

/**
 * Refuse to build a plate whose settings the slicer would silently rewrite.
 *
 * THIS IS NOT DEFENSIVE TIDINESS. It is the one guard standing between a typo
 * and a part that prints at grid infill, looks perfect, and shears under torsion
 * months later. The slicer will not raise it as an error; it substitutes a
 * default and blames a version mismatch.
 *
 * Throws rather than warns, and runs AT MODULE SCOPE above rather than in a test
 * alone, because a warning in a server log is a warning nobody reads -- which is
 * the failure this whole module exists to route around.
 *
 * This wrapper is kept for the tests and for anything that wants to re-check the
 * real table by name. It is no longer called per request: see the block above
 * the module-scope call for why that placement validated the wrong object and
 * reported to nobody.
 */
export function assertPrintIntentIsSlicerLegal(): void {
  assertRowsAreSlicerLegal(PRINT_INTENT_TABLE);
}

/**
 * The same guard, over any row set. EXPORTED FOR THE TESTS, and that is not a
 * convenience.
 *
 * Every branch below refuses a defect whose whole signature is that it ships
 * looking correct: a substituted enum, a collapsed duplicate, a nameless row.
 * A guard against silent failures that is itself only exercised by the one input
 * known to pass is a guard nobody has ever seen work. Taking the rows as an
 * argument is what lets a test hand it a bad table and watch it throw, instead
 * of the suite asserting that today's good table is good.
 */
export function assertRowsAreSlicerLegal(
  rows: readonly PrintIntentRow[],
): void {
  // Enum maps are all-lowercase, and "Gyroid" was MEASURED to degrade silently.
  // Checked separately from set membership so the error names the real defect
  // rather than listing legal values at someone who typed one of them in caps.
  //
  // Walks the ROWS, not the maps built from them. That covers every row including
  // the brim ones, which the old loop skipped: it spread two of the three maps
  // and nothing said the third was missing.
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.value !== row.value.toLowerCase()) {
      throw new Error(
        `${row.key}="${row.value}" has a capital letter. Orca's enum maps are ` +
          `lowercase and a case mismatch is substituted with the option ` +
          `default, silently.`,
      );
    }
    // A DUPLICATE KEY COLLAPSES SILENTLY -- `Object.fromEntries` keeps the last
    // one -- so two rows disagreeing about `wall_loops` would bake one of them
    // and render the other, which is precisely the drift this table exists to
    // end. Checked across ALL scopes: a key meaning one thing on every part and
    // another on the brim parts is a question this shape cannot answer.
    if (seen.has(row.key)) {
      throw new Error(
        `${row.key} appears twice in the intent table. One of the two would ` +
          `be baked into the file and the other rendered beside it.`,
      );
    }
    seen.add(row.key);
    // An `every` row reaches a reader, so it must have something to say. An
    // empty label renders as a bare number with nothing naming it.
    if (row.scope === "every" && (row.label === "" || row.display === "")) {
      throw new Error(
        `${row.key} is shown to a reader and has no ` +
          `${row.label === "" ? "label" : "display value"}.`,
      );
    }
  }

  // ==================================================================
  // MEMBERSHIP LAST, AND THE ORDER IS THE POINT.
  // ==================================================================
  // The case check above and these two overlap on `sparse_infill_pattern`:
  // "Gyroid" is both wrongly-cased AND absent from the legal set. Run this
  // first -- as it was until this ordering was fixed -- and a capitalised value
  // is reported as an unknown pattern, with the legal list printed at someone
  // who typed one of them in caps. That is the message the case check exists to
  // replace, and it was unreachable for the one key it was written for.
  //
  // So the specific diagnosis runs before the general one. A value that is
  // BOTH miscased and genuinely unknown still fails; it just gets told about
  // the capital letter first, which is the defect it more likely is.
  const valueOf = (key: string) => rows.find((r) => r.key === key)?.value;

  const pattern = valueOf("sparse_infill_pattern");
  if (pattern !== undefined && !LEGAL_INFILL.has(pattern)) {
    throw new Error(
      `sparse_infill_pattern "${pattern}" is not a value Orca accepts. ` +
        `It would be silently replaced with grid. Legal: ${[...LEGAL_INFILL].join(", ")}`,
    );
  }
  const support = valueOf("support_type");
  if (support !== undefined && !LEGAL_SUPPORT_TYPE.has(support)) {
    throw new Error(
      `support_type "${support}" is not a value Orca accepts. ` +
        `Legal: ${[...LEGAL_SUPPORT_TYPE].join(", ")}`,
    );
  }
}

/** The settings for one part: what everything gets, plus whichever of the two
 *  independent remedies it has been measured to need. */
export function intentFor(need: {
  support: boolean;
  brim: boolean;
}): Readonly<Record<string, string>> {
  return {
    ...INTENT_EVERY_PART,
    ...(need.support ? INTENT_SUPPORT_PARTS : {}),
    ...(need.brim ? INTENT_BRIM_PARTS : {}),
  };
}
