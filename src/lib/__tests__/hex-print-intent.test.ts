// The print settings, and the one table every surface that states them reads.
//
// ===========================================================================
// THIS FILE EXISTS BECAUSE THE DRIFT ALREADY SHIPPED.
// ===========================================================================
// The same three facts -- infill pattern, density, perimeters -- were written in
// five places: here as slicer keys, in `hex-spec.ts` as the /hex spec card's
// `Infill` and `Perimeters` rows, in both archive READMEs through those, on the
// configurator's build sheet, and once more in the configurator's download
// strip. They disagreed. Release 2026-08-17 baked 15% infill at 2 walls into
// every plate while every sentence beside it said 30% gyroid at 4 perimeters,
// so an archive shipped a README contradicting the file it was wrapped around.
//
// Every surface was internally consistent. The SET of them was not, and nothing
// compared them, because nothing could. So the rows below assert the thing no
// single-surface test can: that the card, the README and the bytes in the
// download all say one thing, and that they say it because they read one table.
import { describe, expect, it } from "vitest";

import {
  INTENT_BRIM_PARTS,
  INTENT_EVERY_PART,
  INTENT_SUPPORT_PARTS,
  PRINT_INTENT_FACTS,
  PRINT_INTENT_LEAD,
  PRINT_INTENT_TABLE,
  type PrintIntentRow,
  assertPrintIntentIsSlicerLegal,
  assertRowsAreSlicerLegal,
  intentFor,
} from "@/lib/hex-print-intent";
import { plateReadme, packReadme } from "@/lib/hex-pack-readme";
import type { Placement } from "@/lib/hex-plate";
import { HEX_LICENSE, HEX_PRINT_PARAMS } from "@/lib/hex-spec";

/** A row that passes every branch of the guard, to be spoiled one field at a
 *  time. Written out rather than taken from the real table, so a test of the
 *  guard cannot start passing because the table changed. */
const OK: PrintIntentRow = {
  key: "wall_loops",
  value: "4",
  label: "perimeters",
  display: "4",
  scope: "every",
  // REQUIRED, with no default, so a new setting has to SAY whether it crosses
  // the fork to PrusaSlicer. Inheriting null silently would be a setting the
  // card promises and the Prusa file omits.
  prusa: { key: "perimeters", value: "4" },
  // Also required, for the same reason: a new setting must SAY whether it
  // crosses to Cura, whose per-object surface is narrower than the others.
  cura: { key: "wall_line_count", value: "4" },
};

const rowsFor = (scope: PrintIntentRow["scope"]) =>
  PRINT_INTENT_TABLE.filter((r) => r.scope === scope);

describe("the table is the only place a value is written", () => {
  // ONE ASSERTION PER SETTING, transcribed rather than derived. The
  // configurator's `print-intent.test.ts` holds the identical literals on its
  // side of a repo boundary the two cannot import across; between them, a change
  // to either turns red instead of drifting. Deriving these from the module
  // under test would produce a pin that agrees with itself forever.
  it.each([
    ["sparse_infill_pattern", "gyroid"],
    ["sparse_infill_density", "30%"],
    ["wall_loops", "4"],
    ["enable_support", "1"],
    ["support_type", "normal(auto)"],
    ["support_threshold_angle", "30"],
    ["brim_type", "outer_only"],
    ["brim_width", "5"],
  ])("%s = %s", (key, value) => {
    expect(PRINT_INTENT_TABLE.find((r) => r.key === key)?.value).toBe(value);
  });

  it("carries no key twice, in any scope", () => {
    const keys = PRINT_INTENT_TABLE.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each([
    ["every", INTENT_EVERY_PART],
    ["support", INTENT_SUPPORT_PARTS],
    ["brim", INTENT_BRIM_PARTS],
  ] as const)("the %s map is exactly its scope's rows", (scope, map) => {
    expect(map).toEqual(
      Object.fromEntries(rowsFor(scope).map((r) => [r.key, r.value])),
    );
  });

  it("hands out frozen maps, because they are spread on every request", () => {
    // A warm serverless instance spreads these into every plate it builds. A
    // mutation upstream would change what every LATER download bakes, which is
    // the class of bug that reproduces for nobody. `DEFAULT_BED` carries the
    // same freeze for the same reason.
    expect(Object.isFrozen(INTENT_EVERY_PART)).toBe(true);
    expect(Object.isFrozen(INTENT_SUPPORT_PARTS)).toBe(true);
    expect(Object.isFrozen(INTENT_BRIM_PARTS)).toBe(true);
  });
});

describe("what a reader is shown", () => {
  it("shows the every-part rows, in table order", () => {
    expect([...PRINT_INTENT_FACTS]).toEqual([
      { label: "infill", value: "gyroid" },
      { label: "density", value: "30%" },
      { label: "perimeters", value: "4" },
    ]);
  });

  it("shows no support row and no brim row", () => {
    // NOT AN OVERSIGHT, AND ASSERTED FOR THAT REASON. A brim is written for
    // three measured parts and support for twenty-five, not for the plate, so
    // either row would be false of almost every build -- and the card is worth
    // nothing unless every line on it is true of the file just taken. "We left
    // it out on purpose" is exactly the restraint a later edit undoes.
    const labels = PRINT_INTENT_FACTS.map((f) => f.label);
    for (const row of [...rowsFor("support"), ...rowsFor("brim")]) {
      expect(labels).not.toContain(row.label);
    }
  });

  it("names no support COUNT, which lives in hex-support.ts alone", () => {
    // That list is in one place because it used to be in two and drifted.
    // Restating a count here would rebuild the defect that file prevents.
    const text = PRINT_INTENT_FACTS.map((f) => `${f.label} ${f.value}`).join(
      " ",
    );
    expect(text).not.toMatch(/support/i);
    expect(text).not.toMatch(/\d+\s*parts?/i);
  });

  it("is pure ASCII, so the README can reuse the same strings", () => {
    const text = [
      PRINT_INTENT_LEAD,
      ...PRINT_INTENT_FACTS.flatMap((f) => [f.label, f.value]),
    ].join(" ");
    expect(text).toMatch(/^[\x20-\x7e]*$/);
    // The em-dash ban applies to every rendered glyph. En dashes are allowed on
    // the spec sheet, where they carry ranges; nothing here is a range.
    expect(text).not.toMatch(/[–—]/);
  });
});

describe("the surfaces cannot disagree with the file", () => {
  // ==========================================================================
  // THESE TWO USED TO BE TAUTOLOGIES, UNDER THIS EXACT HEADING.
  // ==========================================================================
  // They asserted `HEX_PRINT_PARAMS.find("Perimeters").value` equalled
  // `INTENT_EVERY_PART.wall_loops` -- while `hex-spec.ts` DERIVES that row as
  // literally that expression. `x === x`. No edit to the table could fail them,
  // which meant the describe block named for the feature's headline claim was
  // true by import rather than by test.
  //
  // The transcribed pin that does have teeth lives in `hex-spec.test.ts`, which
  // holds `["Infill", "30% gyroid"]` against the build sheet in the other repo.
  // Duplicating it here would just be the same assertion twice.
  //
  // WHAT IS ASSERTED INSTEAD IS THE ONE GAP NOTHING ELSE COVERS: the spec card
  // is built from each row's SLICER value, and the print card from its DISPLAY
  // value, and those are two separate fields on the row. Nothing structural
  // stops `value: "25%"` sitting beside `display: "30%"` -- the file would print
  // one density and the page would promise another, and every other test in this
  // repo would stay green because each reads only its own field.
  const factValue = (label: string) => {
    const f = PRINT_INTENT_FACTS.find((x) => x.label === label);
    if (!f) throw new Error(`no rendered fact labelled ${label}`);
    return f.value;
  };

  it("the spec card's perimeters is the number the print card shows", () => {
    expect(HEX_PRINT_PARAMS.find((r) => r.label === "Perimeters")?.value).toBe(
      factValue("perimeters"),
    );
  });

  it("the spec card's infill is the density and pattern the print card shows", () => {
    expect(HEX_PRINT_PARAMS.find((r) => r.label === "Infill")?.value).toBe(
      `${factValue("density")} ${factValue("infill")}`,
    );
  });

  const BOX = { x0: 0, y0: 0, z0: 0, dx: 40, dy: 30, dz: 10 } as const;
  /** 826 sq mm on the bed and no warning from the slicer. NOT `hex-tb-main`,
   *  which the calibration sweep moved onto the support list along with the rest
   *  of the base family -- a neutral fixture has to actually be neutral. */
  const PLAIN: Placement = {
    slug: "hex-tb-spike-platform-lrg",
    name: "Hex-TB-Spike-Platform-Lrg",
    box: BOX,
    x: 4,
    y: 4,
  };

  const plated = () =>
    plateReadme({
      release: "2026-08-17",
      bed: { x: 220, y: 220 },
      plates: [[PLAIN]],
      credit: HEX_LICENSE.credit,
      specUrl: "https://academy.onethousanddrones.com/hex",
      stem: "OTD-Hex-Cluster",
    });

  it("the plated README states the lead and every fact", () => {
    // Whitespace-flattened: the module hard-wraps at 72 columns for a terminal,
    // so a phrase is free to land across a line break.
    const flat = plated().replace(/\s+/g, " ");
    expect(flat).toContain(PRINT_INTENT_LEAD);
    for (const f of PRINT_INTENT_FACTS) {
      expect(flat).toContain(`${f.label}: ${f.value}`);
    }
  });

  it("the LOOSE README does not, because loose meshes carry no settings", () => {
    // `format=stl` and every pre-plating link serve published R2 objects exactly
    // as they were cut. "Already set in the file" over those would be false in
    // the direction that stops someone setting the one thing that matters.
    const loose = packReadme({
      release: "2026-08-17",
      format: "stl",
      parts: [{ slug: "hex-tb-spike-platform-lrg", qty: 1 }],
      credit: HEX_LICENSE.credit,
      specUrl: "https://academy.onethousanddrones.com/hex",
    }).replace(/\s+/g, " ");
    expect(loose).not.toContain(PRINT_INTENT_LEAD);
  });

  it("the plated README never claims the plate carries no settings", () => {
    // IT DID. "These files carry geometry only, with no printer or process
    // settings" was true when written and stopped being true the day a plate
    // started carrying `Metadata/model_settings.config` -- so the README denied
    // having settings four lines above the block listing them. What is actually
    // absent is the printer-and-process BUNDLE, deliberately, because shipping
    // it would overwrite the reader's own presets.
    const flat = plated().replace(/\s+/g, " ");
    expect(flat).not.toMatch(/geometry only/i);
    expect(flat).not.toMatch(/no printer or process settings/i);
  });

  it("the plated README says how the settings can be lost", () => {
    // Measured: an open-as-project keeps them, `File > Import` calls
    // `config.reset()`. A reader who imports and finds the slicer's own defaults
    // has been told why rather than left concluding the claim was a lie.
    const flat = plated().replace(/\s+/g, " ");
    expect(flat).toMatch(/Import/);
    expect(flat).toMatch(/Open Project/i);
  });
});

describe("what one part is asked to print with", () => {
  it("gives a plain part the every-part settings and nothing else", () => {
    expect(intentFor({ support: false, brim: false })).toEqual(
      INTENT_EVERY_PART,
    );
  });

  it("adds support and a brim only when each is asked for, separately", () => {
    // A brim answers "will it stick" and support answers "is anything printing
    // into thin air". Bundling them put a pointless brim on a corner with
    // 417 sq mm of bed contact, so the two flags stay independent.
    expect(intentFor({ support: true, brim: false })).toEqual({
      ...INTENT_EVERY_PART,
      ...INTENT_SUPPORT_PARTS,
    });
    expect(intentFor({ support: false, brim: true })).toEqual({
      ...INTENT_EVERY_PART,
      ...INTENT_BRIM_PARTS,
    });
  });
});

describe("the guard against a silently rewritten value", () => {
  it("passes the real table", () => {
    expect(() => assertPrintIntentIsSlicerLegal()).not.toThrow();
  });

  // EVERY BRANCH IS EXERCISED WITH A BAD TABLE. Each refuses a defect whose
  // whole signature is that it ships looking correct, so a guard only ever run
  // against the input known to pass is a guard nobody has seen work.
  it("refuses an infill pattern Orca would replace with grid", () => {
    expect(() =>
      assertRowsAreSlicerLegal([
        { ...OK, key: "sparse_infill_pattern", value: "notapattern" },
      ]),
    ).toThrow(/not a value Orca accepts/);
  });

  it("refuses a capitalised enum, which degrades without failing", () => {
    // MEASURED: "Gyroid" became grid behind a dialog blaming a version
    // mismatch, which sends the reader after the wrong bug entirely.
    expect(() =>
      assertRowsAreSlicerLegal([
        { ...OK, key: "sparse_infill_pattern", value: "Gyroid" },
      ]),
    ).toThrow(/capital letter/);
  });

  it("refuses a support type Orca does not spell that way", () => {
    expect(() =>
      assertRowsAreSlicerLegal([
        { ...OK, key: "support_type", value: "normal(automatic)" },
      ]),
    ).toThrow(/not a value Orca accepts/);
  });

  it("refuses a duplicated key, which would collapse silently", () => {
    // `Object.fromEntries` keeps the last one, so two rows disagreeing about
    // `wall_loops` would bake one and render the other -- the exact drift the
    // table was written to end, rebuilt inside the table itself.
    expect(() => assertRowsAreSlicerLegal([OK, { ...OK, value: "2" }])).toThrow(
      /appears twice/,
    );
  });

  it("refuses a rendered row with no label", () => {
    expect(() => assertRowsAreSlicerLegal([{ ...OK, label: "" }])).toThrow(
      /no label/,
    );
  });

  it("refuses a rendered row with no display value", () => {
    expect(() => assertRowsAreSlicerLegal([{ ...OK, display: "" }])).toThrow(
      /no display value/,
    );
  });

  it("checks the BRIM rows too, which the previous guard skipped", () => {
    // The old loop spread `INTENT_EVERY_PART` and `INTENT_SUPPORT_PARTS` and
    // nothing said the third map was missing, so a capitalised `brim_type`
    // would have shipped.
    expect(() =>
      assertRowsAreSlicerLegal([
        { ...OK, key: "brim_type", value: "Outer_Only", scope: "brim" },
      ]),
    ).toThrow(/capital letter/);
  });
});
