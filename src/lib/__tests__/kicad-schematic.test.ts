// Tests for `.kicad_sch` generation — placed-parts (UNWIRED) export
// (export-engine Task 7).
//
// buildSchematic places each part's symbol instance at its placement and
// registers each part's symbol in lib_symbols. The export is UNWIRED (no nets /
// power ports) — wiring is the student's lesson. The tests prove the header /
// title block, per-part instance fields (Value/Footprint/Datasheet/Description),
// the lib_symbols unit-prefix rename invariant, and that generation is
// deterministic.
//
// PURE module (no React/DB/env/network/fs). Target format KiCad 10. We can't run
// KiCad here; tests lock OUR output shape for manual acceptance.

import { describe, expect, test } from "vitest";
import {
  parseSexpr,
  serializeSexpr,
  head,
  findChild,
  findChildren,
  isList,
  isStr,
  atomValue,
  type SList,
} from "@/lib/kicad/sexpr";
import {
  buildSchematic,
  type SchematicPart,
} from "@/lib/kicad/schematic";
import type { Placement } from "@/lib/kicad/placement";

// Two parts, each with a known GND pin on the left edge. Pin `(at)` is the
// connection point (KiCad convention). U2 also has a VOUT signal pin (right
// edge) we assert is left open.
const SYM_U2 = `(symbol "AP2112K-3.3" (in_bom yes) (on_board yes)
  (property "Reference" "U" (at 0 0 0) (effects (font (size 1.27 1.27))))
  (property "Value" "AP2112K-3.3" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
  (symbol "AP2112K-3.3_0_1"
    (pin power_in line (at -7.62 0 0) (length 2.54)
      (name "VIN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin power_in line (at -7.62 -2.54 0) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin power_out line (at 7.62 0 180) (length 2.54)
      (name "VOUT" (effects (font (size 1.27 1.27))))
      (number "5" (effects (font (size 1.27 1.27))))
    )
  )
)`;

const SYM_C2 = `(symbol "C" (in_bom yes) (on_board yes)
  (property "Reference" "C" (at 0 0 0) (effects (font (size 1.27 1.27))))
  (property "Value" "100nF" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
  (symbol "C_0_1"
    (pin passive line (at 0 2.54 270) (length 2.54)
      (name "~" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 0 -2.54 90) (length 2.54)
      (name "~" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
  )
)`;

function baseInput() {
  const placements = new Map<string, Placement>([
    ["U2", { x: 100, y: 100, rotation: 0 }],
    ["C2", { x: 150, y: 100, rotation: 0 }],
  ]);
  return {
    projectName: "wroom-breakout",
    parts: [
      { refDes: "U2", symbolText: SYM_U2, libId: "wroom-breakout:AP2112K-3.3" },
      { refDes: "C2", symbolText: SYM_C2, libId: "wroom-breakout:C" },
    ] as SchematicPart[],
    placements,
  };
}

describe("schematic — buildSchematic structure", () => {
  test("emits a well-formed (kicad_sch ...) that round-trips through parseSexpr", () => {
    const out = buildSchematic(baseInput());
    const node = parseSexpr(out);
    expect(head(node)).toBe("kicad_sch");
    // round-trip stable
    expect(parseSexpr(serializeSexpr(node))).toEqual(node);
  });

  test("carries header: version, generator project-foundry, uuid, paper, title_block (title+date+rev), lib_symbols", () => {
    const input = { ...baseInput(), rev: "v3", date: "2026-06-03" };
    const node = parseSexpr(buildSchematic(input));
    expect(findChild(node, "version")).toBeDefined();
    const gen = findChild(node, "generator")!;
    expect(isList(gen) && isStr(gen.items[1]) && gen.items[1].value).toBe(
      "project-foundry",
    );
    expect(findChild(node, "uuid")).toBeDefined();
    const paper = findChild(node, "paper")!;
    expect(isList(paper) && isStr(paper.items[1]) && paper.items[1].value).toBe(
      "A4",
    );
    // title_block carries the project name as its title, plus date + rev when
    // they're supplied.
    const titleBlock = findChild(node, "title_block")!;
    expect(titleBlock).toBeDefined();
    const title = findChild(titleBlock, "title")!;
    expect(isStr(title.items[1]) && title.items[1].value).toBe(
      "wroom-breakout",
    );
    const date = findChild(titleBlock, "date")!;
    expect(isStr(date.items[1]) && date.items[1].value).toBe("2026-06-03");
    const rev = findChild(titleBlock, "rev")!;
    expect(isStr(rev.items[1]) && rev.items[1].value).toBe("v3");
    expect(findChild(node, "lib_symbols")).toBeDefined();
  });

  test("title_block omits date/rev sub-nodes entirely when not supplied (no empty values)", () => {
    // baseInput() supplies neither rev nor date → no (date ...)/(rev ...) at all.
    const titleBlock = findChild(
      parseSexpr(buildSchematic(baseInput())),
      "title_block",
    )!;
    expect(titleBlock).toBeDefined();
    // title is present, but date + rev sub-nodes are absent (not emitted empty).
    expect(findChild(titleBlock, "title")).toBeDefined();
    expect(findChild(titleBlock, "date")).toBeUndefined();
    expect(findChild(titleBlock, "rev")).toBeUndefined();
  });

  test("title_block omits an empty-string rev/date (treated same as absent)", () => {
    const input = { ...baseInput(), rev: "", date: "" };
    const titleBlock = findChild(
      parseSexpr(buildSchematic(input)),
      "title_block",
    )!;
    expect(findChild(titleBlock, "date")).toBeUndefined();
    expect(findChild(titleBlock, "rev")).toBeUndefined();
  });

  test("places one component instance per part at its placement with lib_id + reference", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
    if (!isList(node)) throw new Error("unreachable");
    // component (non-power) symbol instances
    const comps = findChildren(node, "symbol").filter((s) => {
      const libId = findChild(s, "lib_id");
      const v = libId && isStr(libId.items[1]) ? libId.items[1].value : "";
      return !v.startsWith("power:");
    });
    expect(comps).toHaveLength(2);

    const byRef = new Map<string, SList>();
    for (const c of comps) {
      const refProp = findChildren(c, "property").find(
        (p) => isStr(p.items[1]) && p.items[1].value === "Reference",
      );
      const ref = refProp && isStr(refProp.items[2]) ? refProp.items[2].value : "";
      byRef.set(ref, c);
    }
    const u2 = byRef.get("U2")!;
    const at = findChild(u2, "at")!;
    expect(Number(atomValue(at.items[1]))).toBe(100);
    expect(Number(atomValue(at.items[2]))).toBe(100);
    const libId = findChild(u2, "lib_id")!;
    expect(isStr(libId.items[1]) && libId.items[1].value).toBe(
      "wroom-breakout:AP2112K-3.3",
    );
  });

  test("each component instance carries Value (bare name) + Footprint (full libId, hidden)", () => {
    // Use a libId with a distinct bare name to prove the split logic.
    const input = baseInput();
    input.parts = [
      { refDes: "J1", symbolText: SYM_U2, libId: "wroom-breakout:USB4110-GF-A" },
    ];
    input.placements = new Map<string, Placement>([
      ["J1", { x: 100, y: 100, rotation: 0 }],
    ]);
    const node = parseSexpr(buildSchematic(input));
    if (!isList(node)) throw new Error("unreachable");
    const comp = findChildren(node, "symbol").find((s) => {
      const lib = findChild(s, "lib_id");
      return lib && isStr(lib.items[1]) && lib.items[1].value === "wroom-breakout:USB4110-GF-A";
    })!;
    expect(comp).toBeDefined();

    const props = findChildren(comp, "property");
    const value = props.find((p) => isStr(p.items[1]) && p.items[1].value === "Value")!;
    expect(value).toBeDefined();
    // bare name = substring after last ":" in the libId
    expect(isStr(value.items[2]) && value.items[2].value).toBe("USB4110-GF-A");

    const fp = props.find((p) => isStr(p.items[1]) && p.items[1].value === "Footprint")!;
    expect(fp).toBeDefined();
    // Footprint == full libId
    expect(isStr(fp.items[2]) && fp.items[2].value).toBe(
      "wroom-breakout:USB4110-GF-A",
    );
    // Footprint property is hidden (KiCad convention) — `hide` atom in effects.
    const fpEffects = findChild(fp, "effects")!;
    const hidden = fpEffects.items.some(
      (it) => !isList(it) && atomValue(it) === "hide",
    );
    expect(hidden).toBe(true);
  });

  test("each component instance carries Datasheet + Description (from part data, hidden)", () => {
    const input = baseInput();
    input.parts = [
      {
        refDes: "U2",
        symbolText: SYM_U2,
        libId: "wroom-breakout:AP2112K-3.3",
        datasheet: "https://example.com/AP2112K-3.3.pdf",
        description: "600mA LDO regulator, 3.3V fixed",
      },
    ];
    input.placements = new Map<string, Placement>([
      ["U2", { x: 100, y: 100, rotation: 0 }],
    ]);
    const node = parseSexpr(buildSchematic(input));
    if (!isList(node)) throw new Error("unreachable");
    const comp = findChildren(node, "symbol").find((s) => {
      const lib = findChild(s, "lib_id");
      return lib && isStr(lib.items[1]) && lib.items[1].value === "wroom-breakout:AP2112K-3.3";
    })!;
    expect(comp).toBeDefined();

    const props = findChildren(comp, "property");
    const isHidden = (p: SList) => {
      const effects = findChild(p, "effects")!;
      return effects.items.some((it) => !isList(it) && atomValue(it) === "hide");
    };

    const datasheet = props.find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Datasheet",
    )!;
    expect(datasheet).toBeDefined();
    expect(isStr(datasheet.items[2]) && datasheet.items[2].value).toBe(
      "https://example.com/AP2112K-3.3.pdf",
    );
    expect(isHidden(datasheet)).toBe(true);

    const description = props.find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Description",
    )!;
    expect(description).toBeDefined();
    expect(isStr(description.items[2]) && description.items[2].value).toBe(
      "600mA LDO regulator, 3.3V fixed",
    );
    expect(isHidden(description)).toBe(true);
  });

  test("Datasheet + Description are ALWAYS emitted (empty value) when part data is absent", () => {
    // No datasheet/description supplied on the part — KiCad's Datasheet field is
    // mandatory, so both properties must still be present with an empty value.
    const input = baseInput();
    input.parts = [
      { refDes: "U2", symbolText: SYM_U2, libId: "wroom-breakout:AP2112K-3.3" },
    ];
    input.placements = new Map<string, Placement>([
      ["U2", { x: 100, y: 100, rotation: 0 }],
    ]);
    const node = parseSexpr(buildSchematic(input));
    if (!isList(node)) throw new Error("unreachable");
    const comp = findChildren(node, "symbol").find((s) => {
      const lib = findChild(s, "lib_id");
      return lib && isStr(lib.items[1]) && lib.items[1].value === "wroom-breakout:AP2112K-3.3";
    })!;
    expect(comp).toBeDefined();

    const props = findChildren(comp, "property");
    const datasheet = props.find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Datasheet",
    )!;
    expect(datasheet).toBeDefined();
    expect(isStr(datasheet.items[2]) && datasheet.items[2].value).toBe("");

    const description = props.find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Description",
    )!;
    expect(description).toBeDefined();
    expect(isStr(description.items[2]) && description.items[2].value).toBe("");
  });

  test("lib_symbols def for a part carries a Footprint property == its libId", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
    const libSymbols = findChild(node, "lib_symbols")!;
    const def = findChildren(libSymbols, "symbol").find(
      (s) => isStr(s.items[1]) && s.items[1].value === "wroom-breakout:AP2112K-3.3",
    )!;
    expect(def).toBeDefined();
    const fp = findChildren(def, "property").find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Footprint",
    )!;
    expect(fp).toBeDefined();
    expect(isStr(fp.items[2]) && fp.items[2].value).toBe(
      "wroom-breakout:AP2112K-3.3",
    );
  });

  test("each component instance carries an (instances ...) block with project + path + reference + unit", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
    if (!isList(node)) throw new Error("unreachable");
    const comps = findChildren(node, "symbol").filter((s) => {
      const libId = findChild(s, "lib_id");
      const v = libId && isStr(libId.items[1]) ? libId.items[1].value : "";
      return !v.startsWith("power:");
    });
    expect(comps).toHaveLength(2);

    for (const c of comps) {
      // the refDes on this instance's Reference property
      const refProp = findChildren(c, "property").find(
        (p) => isStr(p.items[1]) && p.items[1].value === "Reference",
      )!;
      const refDes = isStr(refProp.items[2]) ? refProp.items[2].value : "";

      const instances = findChild(c, "instances")!;
      expect(instances).toBeDefined();
      const project = findChild(instances, "project")!;
      // project name threaded through buildSchematic
      expect(isStr(project.items[1]) && project.items[1].value).toBe(
        "wroom-breakout",
      );
      const path = findChild(project, "path")!;
      // root-sheet path is "/"
      expect(isStr(path.items[1]) && path.items[1].value).toBe("/");
      const reference = findChild(path, "reference")!;
      expect(isStr(reference.items[1]) && reference.items[1].value).toBe(refDes);
      const unit = findChild(path, "unit")!;
      expect(atomValue(unit.items[1])).toBe("1");
    }
  });

  test("root carries a (sheet_instances ...) node with path '/' and page '1'", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
    const sheetInstances = findChild(node, "sheet_instances")!;
    expect(sheetInstances).toBeDefined();
    const path = findChild(sheetInstances, "path")!;
    expect(isStr(path.items[1]) && path.items[1].value).toBe("/");
    const page = findChild(path, "page")!;
    expect(isStr(page.items[1]) && page.items[1].value).toBe("1");
  });

  test("REGRESSION (KiCad load error): each lib_symbols component's unit prefix matches its parent name", () => {
    // A stub-style part whose INTERNAL parent + unit names carry a `STUB-`
    // prefix, re-hosted under lib_id `wroom-breakout:USB4110-GF-A`. KiCad rejects
    // the schematic if the unit name prefix (e.g. STUB-USB4110-GF-A_0_1) does not
    // match the parent's unqualified name (USB4110-GF-A) — so symbolDefForPart
    // must rename the unit sub-symbol too.
    const stub = `(symbol "STUB-USB4110-GF-A" (in_bom yes) (on_board yes)
  (property "Reference" "U" (at 0 0 0) (effects (font (size 1.27 1.27))))
  (property "Value" "USB4110-GF-A" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
  (symbol "STUB-USB4110-GF-A_0_1"
    (pin passive line (at -7.62 0 0) (length 2.54)
      (name "VBUS" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
  )
)`;
    const input = baseInput();
    input.parts = [
      { refDes: "J1", symbolText: stub, libId: "wroom-breakout:USB4110-GF-A" },
    ];
    input.placements = new Map<string, Placement>([
      ["J1", { x: 100, y: 100, rotation: 0 }],
    ]);
    const node = parseSexpr(buildSchematic(input));
    const libSymbols = findChild(node, "lib_symbols")!;
    const comp = findChildren(libSymbols, "symbol").find(
      (s) => isStr(s.items[1]) && s.items[1].value === "wroom-breakout:USB4110-GF-A",
    )!;
    expect(comp).toBeDefined();
    // EVERY nested unit sub-symbol's name must start with the parent's
    // UNQUALIFIED name + "_".
    for (const unit of findChildren(comp, "symbol")) {
      const unitName = isStr(unit.items[1]) ? unit.items[1].value : "";
      if (!/_\d+_\d+$/.test(unitName)) continue;
      expect(unitName.startsWith("USB4110-GF-A_")).toBe(true);
    }
    // Specifically, the unit is renamed (no STUB- leak).
    expect(isStr(comp.items[1]) && comp.items[1].value).toBe(
      "wroom-breakout:USB4110-GF-A",
    );
    expect(findChild(comp, "symbol")!.items[1]).toEqual({
      kind: "str",
      value: "USB4110-GF-A_0_1",
    });
  });
});

describe("schematic — determinism", () => {
  test("same input twice yields byte-identical output", () => {
    const a = buildSchematic(baseInput());
    const b = buildSchematic(baseInput());
    expect(a).toBe(b);
  });

  test("UUIDs are deterministic (no random) — stable across runs", () => {
    const a = buildSchematic(baseInput());
    const b = buildSchematic(baseInput());
    // pull every uuid string and compare the multiset
    const uuids = (text: string) =>
      [...text.matchAll(/\(uuid "([0-9a-f-]+)"\)/g)].map((m) => m[1]).sort();
    expect(uuids(a)).toEqual(uuids(b));
    expect(uuids(a).length).toBeGreaterThan(0);
    // well-formed uuid-ish shape
    for (const u of uuids(a)) {
      expect(u).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  test("instance UUIDs are seeded per refDes (stable regardless of part list order)", () => {
    // The per-instance UUID seed is `${projectName}|inst|${refDes}`, so reversing
    // the part list must not change any instance's UUID — proving seeds are keyed
    // by refDes, not by position.
    const a = buildSchematic(baseInput());
    const reversed = baseInput();
    reversed.parts = [...reversed.parts].reverse();
    const b = buildSchematic(reversed);
    const uuids = (text: string) =>
      [...text.matchAll(/\(uuid "([0-9a-f-]+)"\)/g)].map((m) => m[1]).sort();
    expect(uuids(a)).toEqual(uuids(b));
  });
});
