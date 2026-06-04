// Tests for `.kicad_sch` generation + power-rail geometric wiring
// (export-engine Task 7, design §3.4 — the crux).
//
// buildSchematic places each part's symbol instance at its placement and, for
// each VERIFIED GROUND/POWER net node, drops a power-port symbol at the target
// pin's COMPUTED connection coordinate (via pin-geometry). The test proves the
// carrier lands exactly on the pin, that SIGNAL pins / unlisted pins are left
// open, that SIGNAL nets are skipped, that the output is a well-formed
// `.kicad_sch`, and that generation is deterministic.
//
// PURE module (no React/DB/env/network/fs). Target format KiCad 10. We can't run
// KiCad here; tests lock OUR output shape + the geometric-coincidence invariant
// for manual acceptance.

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
  type SNode,
  type SList,
} from "@/lib/kicad/sexpr";
import {
  buildSchematic,
  type SchematicNet,
  type SchematicPart,
} from "@/lib/kicad/schematic";
import { extractSymbolPins, pinConnectionPoint } from "@/lib/kicad/pin-geometry";
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
    nets: [
      {
        name: "GND",
        netClass: "GROUND",
        nodes: [
          { refDes: "U2", pin: "2" }, // U2 GND pin (number "2")
          { refDes: "C2", pin: "2" }, // C2 pin 2
        ],
      },
    ] as SchematicNet[],
  };
}

// The expected absolute connection coordinate of a node, computed the same way
// the module should — proves geometric coincidence rather than re-deriving.
function expectedPoint(
  symbolText: string,
  pinKey: string,
  placement: Placement,
): { x: number; y: number } {
  const pins = extractSymbolPins(symbolText);
  const pin = pins.find((p) => p.number === pinKey || p.name === pinKey)!;
  const p = pinConnectionPoint(pin, placement);
  return { x: p.x, y: p.y };
}

// Collect all power-port symbol instances (lib_id starting "power:") from the
// schematic, with their `(at x y rot)`.
function powerPorts(node: SNode): { libId: string; x: number; y: number }[] {
  if (!isList(node)) return [];
  const out: { libId: string; x: number; y: number }[] = [];
  for (const sym of findChildren(node, "symbol")) {
    const libId = findChild(sym, "lib_id");
    const libVal = libId && isStr(libId.items[1]) ? libId.items[1].value : "";
    if (!libVal.startsWith("power:")) continue;
    const at = findChild(sym, "at")!;
    out.push({
      libId: libVal,
      x: Number(atomValue(at.items[1])),
      y: Number(atomValue(at.items[2])),
    });
  }
  return out;
}

describe("schematic — buildSchematic structure", () => {
  test("emits a well-formed (kicad_sch ...) that round-trips through parseSexpr", () => {
    const out = buildSchematic(baseInput());
    const node = parseSexpr(out);
    expect(head(node)).toBe("kicad_sch");
    // round-trip stable
    expect(parseSexpr(serializeSexpr(node))).toEqual(node);
  });

  test("carries header: version, generator project-foundry, uuid, paper, title_block, lib_symbols", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
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
    // title_block carries the project name as its title.
    const titleBlock = findChild(node, "title_block")!;
    expect(titleBlock).toBeDefined();
    const title = findChild(titleBlock, "title")!;
    expect(isStr(title.items[1]) && title.items[1].value).toBe(
      "wroom-breakout",
    );
    expect(findChild(node, "lib_symbols")).toBeDefined();
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
    input.nets = [];

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
    input.nets = [];

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
    input.nets = [];

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

  test("power-port instances are NOT annotated with an (instances ...) block", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
    if (!isList(node)) throw new Error("unreachable");
    const ports = findChildren(node, "symbol").filter((s) => {
      const libId = findChild(s, "lib_id");
      const v = libId && isStr(libId.items[1]) ? libId.items[1].value : "";
      return v.startsWith("power:");
    });
    expect(ports.length).toBeGreaterThan(0);
    for (const p of ports) {
      expect(findChild(p, "instances")).toBeUndefined();
    }
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
    input.nets = [];

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

describe("schematic — power-rail geometric wiring", () => {
  test("emits a GND power port at EACH gnd pin's computed connection coordinate", () => {
    const input = baseInput();
    const out = buildSchematic(input);
    const node = parseSexpr(out);
    const ports = powerPorts(node);

    // exactly two GND ports (one per node)
    const gndPorts = ports.filter((p) => p.libId === "power:GND");
    expect(gndPorts).toHaveLength(2);

    const u2Pt = expectedPoint(SYM_U2, "2", input.placements.get("U2")!);
    const c2Pt = expectedPoint(SYM_C2, "2", input.placements.get("C2")!);

    const has = (pt: { x: number; y: number }) =>
      gndPorts.some(
        (p) => Math.abs(p.x - pt.x) < 1e-6 && Math.abs(p.y - pt.y) < 1e-6,
      );
    expect(has(u2Pt)).toBe(true);
    expect(has(c2Pt)).toBe(true);
  });

  test("REGRESSION (KiCad load error): power-port def unit prefix is bare (no nick), matching its parent", () => {
    const node = parseSexpr(buildSchematic(baseInput()));
    const libSymbols = findChild(node, "lib_symbols")!;
    // EVERY symbol def — component AND synthesized power-port — must have units
    // whose name starts with the parent's UNQUALIFIED name (strip any "nick:") + "_".
    for (const def of findChildren(libSymbols, "symbol")) {
      const parent = isStr(def.items[1]) ? def.items[1].value : "";
      const bare = parent.includes(":") ? parent.slice(parent.indexOf(":") + 1) : parent;
      for (const unit of findChildren(def, "symbol")) {
        const unitName = isStr(unit.items[1]) ? unit.items[1].value : "";
        if (!/_\d+_\d+$/.test(unitName)) continue;
        expect(unitName.startsWith(`${bare}_`)).toBe(true);
      }
    }
    // Specifically: the power:GND def's unit is "GND_0_1", not "power:GND_0_1".
    const gndDef = findChildren(libSymbols, "symbol").find(
      (s) => isStr(s.items[1]) && s.items[1].value === "power:GND",
    )!;
    expect(gndDef).toBeDefined();
    expect(findChild(gndDef, "symbol")!.items[1]).toEqual({ kind: "str", value: "GND_0_1" });
  });

  test("uses the right power-port symbol per net class/name (GND vs +3V3 vs +5V)", () => {
    const input = baseInput();
    input.nets = [
      { name: "GND", netClass: "GROUND", nodes: [{ refDes: "U2", pin: "2" }] },
      { name: "+3V3", netClass: "POWER", nodes: [{ refDes: "U2", pin: "5" }] },
      { name: "+5V", netClass: "POWER", nodes: [{ refDes: "U2", pin: "1" }] },
    ];
    const ports = powerPorts(parseSexpr(buildSchematic(input)));
    const ids = ports.map((p) => p.libId).sort();
    expect(ids).toEqual(["power:+3V3", "power:+5V", "power:GND"]);
  });

  test("SIGNAL-class nets are skipped (defensive — no carrier emitted)", () => {
    const input = baseInput();
    input.nets = [
      // a SIGNAL net touching U2's VOUT pin — must NOT produce a port
      { name: "NET1", netClass: "SIGNAL", nodes: [{ refDes: "U2", pin: "5" }] },
    ];
    const ports = powerPorts(parseSexpr(buildSchematic(input)));
    expect(ports).toHaveLength(0);
  });

  test("a node referencing an unknown refDes or pin is skipped, not crashed", () => {
    const input = baseInput();
    input.nets = [
      {
        name: "GND",
        netClass: "GROUND",
        nodes: [
          { refDes: "U2", pin: "2" }, // valid
          { refDes: "NOPE", pin: "2" }, // unknown part
          { refDes: "U2", pin: "999" }, // unknown pin
        ],
      },
    ];
    const ports = powerPorts(parseSexpr(buildSchematic(input)));
    // only the one valid node produced a port
    expect(ports.filter((p) => p.libId === "power:GND")).toHaveLength(1);
  });

  test("signal pins (VOUT) get NO power port when not on a power/ground net", () => {
    const input = baseInput();
    const node = parseSexpr(buildSchematic(input));
    const u2VoutPt = expectedPoint(SYM_U2, "5", input.placements.get("U2")!);
    const ports = powerPorts(node);
    const onVout = ports.some(
      (p) => Math.abs(p.x - u2VoutPt.x) < 1e-6 && Math.abs(p.y - u2VoutPt.y) < 1e-6,
    );
    expect(onVout).toBe(false);
  });

  test("lib_symbols contains the power-port definitions actually used", () => {
    const input = baseInput();
    input.nets = [
      { name: "GND", netClass: "GROUND", nodes: [{ refDes: "U2", pin: "2" }] },
      { name: "+3V3", netClass: "POWER", nodes: [{ refDes: "U2", pin: "5" }] },
    ];
    const node = parseSexpr(buildSchematic(input));
    const libSymbols = findChild(node, "lib_symbols")!;
    if (!isList(libSymbols)) throw new Error("unreachable");
    const names = findChildren(libSymbols, "symbol")
      .map((s) => (isStr(s.items[1]) ? s.items[1].value : ""))
      .filter(Boolean);
    expect(names).toContain("power:GND");
    expect(names).toContain("power:+3V3");
    // a component symbol is registered too
    expect(names).toContain("wroom-breakout:AP2112K-3.3");
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

  test("ordering is stable: nodes wired by refDes then pin", () => {
    // reverse the node order in the input → output ports come out in the same
    // (sorted) sequence, proving the module sorts rather than echoing input.
    const a = buildSchematic(baseInput());
    const rev = baseInput();
    rev.nets[0]!.nodes.reverse();
    const b = buildSchematic(rev);
    expect(a).toBe(b);
  });
});
