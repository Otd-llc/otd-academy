// The PrusaSlicer half of the print intent.
//
// NOTHING CALLS `prusaModelConfig` YET -- see the header of the module for why
// it is built and not wired. That makes this file the only thing standing
// between the source reading and a future session shipping it, so it asserts the
// two traps that fail the WHOLE import rather than one setting, not merely that
// the happy path looks plausible.
import { describe, expect, it } from "vitest";

import {
  PRUSA_CONFIG_PATH,
  prusaModelConfig,
  type PrusaObject,
} from "@/lib/hex-prusa-config";
import { PRINT_INTENT_TABLE } from "@/lib/hex-print-intent";

const plain = (id = 1, name = "Hex-TB-Main"): PrusaObject => ({
  id,
  name,
  support: false,
  brim: false,
});

describe("the file PrusaSlicer actually reads", () => {
  it("is written to the path PrusaSlicer looks in", () => {
    // `Metadata/Slic3r_PE_model.config`, from `3mf.cpp`'s MODEL_CONFIG_FILE.
    // Orca reads `Metadata/model_settings.config` and the two coexist -- MEASURED
    // in Creality Print 7.2.1, which loaded a plate carrying both.
    expect(PRUSA_CONFIG_PATH).toBe("Metadata/Slic3r_PE_model.config");
  });

  it("puts type=\"object\" on EVERY metadata line", () => {
    // TRAP 1, AND IT IS FATAL. `_handle_start_config_metadata` accepts exactly
    // "object" or "volume" and otherwise calls add_error("Found invalid metadata
    // type") and returns false -- the whole import, not the one setting. Orca's
    // dialect has no `type` attribute at all, so the natural move (copy the Orca
    // block, rename the keys) produces a file PrusaSlicer refuses.
    const cfg = prusaModelConfig([plain()]);
    const lines = cfg.match(/<metadata[^>]*\/>/g) ?? [];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain('type="object"');
  });

  it("refuses a duplicated object id rather than emitting it", () => {
    // TRAP 2's sibling. An id matching no model object is fatal on Prusa's side
    // ("Cannot assign metadata to valid object id"), and a duplicate is fatal on
    // Creality's ("The file does not contain any geometry data"). Both are the
    // whole file, so this throws at build time.
    expect(() => prusaModelConfig([plain(1), plain(1, "Other")])).toThrow(
      /share id 1/,
    );
  });

  it("escapes a name that would otherwise break the attribute", () => {
    const cfg = prusaModelConfig([plain(1, 'A & B <c> "d"')]);
    expect(cfg).toContain('value="A &amp; B &lt;c&gt; &quot;d&quot;"');
    // The raw ampersand must not survive anywhere -- the ordering bug writes
    // `&amp;lt;`, which reads back as the literal text rather than the glyph.
    expect(cfg).not.toContain("&amp;lt;");
  });
});

describe("it says the same thing as the Orca payload, in Prusa's words", () => {
  it("gives every part the infill, density and perimeters from the table", () => {
    const cfg = prusaModelConfig([plain()]);
    expect(cfg).toContain('key="fill_pattern" value="gyroid"');
    expect(cfg).toContain('key="fill_density" value="30%"');
    expect(cfg).toContain('key="perimeters" value="4"');
  });

  it("carries no support or brim keys on a part that needs neither", () => {
    const cfg = prusaModelConfig([plain()]);
    expect(cfg).not.toMatch(/support_material/);
    expect(cfg).not.toMatch(/brim_/);
  });

  it("writes BOTH support booleans, not just the obvious one", () => {
    // `support_material=1` alone means "support only where an enforcer says so"
    // -- off, for our purposes, while reading as on. `support_material_auto=1`
    // is the half that means "and find the overhangs yourself", which is what
    // Orca's `normal(auto)` says. Asserted because the failure is a part that
    // prints with no support under a file that claims support is enabled.
    const cfg = prusaModelConfig([{ ...plain(), support: true }]);
    expect(cfg).toContain('key="support_material" value="1"');
    expect(cfg).toContain('key="support_material_auto" value="1"');
    expect(cfg).toContain('key="support_material_threshold" value="30"');
  });

  it("writes the brim keys only for a part measured to need one", () => {
    const cfg = prusaModelConfig([{ ...plain(), brim: true }]);
    expect(cfg).toContain('key="brim_type" value="outer_only"');
    expect(cfg).toContain('key="brim_width" value="5"');
    expect(cfg).not.toMatch(/support_material/);
  });

  it("reads the SAME TABLE the Orca payload and the card read", () => {
    // The point of the whole exercise. Every Prusa key/value below comes from a
    // row that also carries the Orca spelling, so a change to one dialect cannot
    // leave the other behind -- which is the drift that shipped in 2026-08-17,
    // one repo boundary over.
    const cfg = prusaModelConfig([{ id: 1, name: "n", support: true, brim: true }]);
    for (const row of PRINT_INTENT_TABLE) {
      if (row.prusa === null) continue;
      expect(cfg).toContain(
        `key="${row.prusa.key}" value="${row.prusa.value}"`,
      );
    }
  });

  it("gives each object its own block, named", () => {
    const cfg = prusaModelConfig([plain(1, "A"), plain(2, "B")]);
    expect(cfg.match(/<object id="\d+"/g)).toEqual([
      '<object id="1"',
      '<object id="2"',
    ]);
    expect(cfg).toContain('key="name" value="A"');
    expect(cfg).toContain('key="name" value="B"');
  });
});

/** The rows whose two dialects deliberately carry DIFFERENT values, and why.
 *
 *  Everything else must agree, and the row below enforces it. Splitting each
 *  setting into an Orca literal and a Prusa literal reintroduced, one level
 *  down, the exact defect this table was built to end: nothing would have
 *  stopped someone changing the density to 25% on one side only, and the
 *  symptom would be two slicers printing the same plate differently while every
 *  test stayed green. */
const DELIBERATELY_DIFFERENT: Record<string, string> = {
  // Orca names an algorithm; PrusaSlicer sets a second boolean. There is no
  // value these two could share -- see the row's own comment in the table.
  support_type: "normal(auto) has no Prusa equivalent; it is support_material_auto=1",
};

describe("the two dialects cannot drift apart", () => {
  it.each(PRINT_INTENT_TABLE.filter((r) => r.prusa !== null).map((r) => [r.key, r] as const))(
    "%s carries one value, not two",
    (key, row) => {
      if (key in DELIBERATELY_DIFFERENT) {
        expect(row.prusa!.value).not.toBe(row.value);
        return;
      }
      expect(row.prusa!.value).toBe(row.value);
    },
  );

  it("keeps the exception list honest", () => {
    // A row listed here that no longer differs is a stale exemption, and a stale
    // exemption is a hole in the check above.
    for (const key of Object.keys(DELIBERATELY_DIFFERENT)) {
      const row = PRINT_INTENT_TABLE.find((r) => r.key === key);
      expect(row, `${key} is exempted but not in the table`).toBeDefined();
    }
  });
});

describe("every row declares its Prusa half deliberately", () => {
  // `prusa` has no default. A new setting added to the table must SAY whether it
  // crosses the fork, because the alternative -- inheriting null and silently
  // not crossing -- is a setting the card promises and the Prusa file omits.
  it.each(PRINT_INTENT_TABLE.map((r) => [r.key, r] as const))(
    "%s",
    (_key, row) => {
      expect(row).toHaveProperty("prusa");
      if (row.prusa !== null) {
        expect(row.prusa.key).not.toBe("");
        expect(row.prusa.value).not.toBe("");
        // Prusa's enum maps are lowercase for the same reason Orca's are.
        expect(row.prusa.value).toBe(row.prusa.value.toLowerCase());
      }
    },
  );
});
