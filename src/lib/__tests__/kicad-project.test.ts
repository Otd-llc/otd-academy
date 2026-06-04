// Tests for KiCad project-config + placement + base-PCB generation
// (export-engine Task 5, design §3.2 / §3.3).
//
// These modules are PURE: no React, no DB, no env, no network, no fs.
//   - project.ts  → `.kicad_pro` JSON (parsed back with JSON.parse + asserted).
//   - placement.ts → deterministic grid layout (natural sort, no overlaps).
//   - pcb.ts      → minimal `.kicad_pcb` S-expr (round-tripped via parseSexpr).
//
// Target format is KiCad 10. We cannot run KiCad here, so tests LOCK IN our
// output shape (golden-style) and structural invariants for later manual
// acceptance; the KiCad-10 fidelity assumptions are documented in each module.

import { describe, expect, test } from "vitest";
import {
  parseSexpr,
  serializeSexpr,
  head,
  findChild,
  findChildren,
  isList,
  isStr,
  isAtom,
  type SNode,
} from "@/lib/kicad/sexpr";
import {
  buildKicadPro,
  resolveBoardConfig,
  DEFAULT_BOARD_CONFIG,
} from "@/lib/kicad/project";
import { gridPlacement } from "@/lib/kicad/placement";
import { buildBasePcb } from "@/lib/kicad/pcb";

// ── project.ts — buildKicadPro / board config ──────────────────────────────

describe("project — DEFAULT_BOARD_CONFIG + resolveBoardConfig", () => {
  test("ships a learner-friendly 2-layer / 1 oz default with Default + Power classes", () => {
    expect(DEFAULT_BOARD_CONFIG.copperLayers).toBe(2);
    expect(DEFAULT_BOARD_CONFIG.copperWeightOz).toBe(1);
    const names = DEFAULT_BOARD_CONFIG.netClasses.map((c) => c.name);
    expect(names[0]).toBe("Default");
    expect(names).toContain("Power");
  });

  test("Power class track is wider than Default (rails carry more current)", () => {
    const def = DEFAULT_BOARD_CONFIG.netClasses.find((c) => c.name === "Default")!;
    const pwr = DEFAULT_BOARD_CONFIG.netClasses.find((c) => c.name === "Power")!;
    expect(pwr.trackWidth).toBeGreaterThan(def.trackWidth);
    expect(pwr.clearance).toBeGreaterThanOrEqual(def.clearance);
  });

  test("Power class is assigned the +3V3/+5V/GND rails", () => {
    const pwr = DEFAULT_BOARD_CONFIG.netClasses.find((c) => c.name === "Power")!;
    expect(pwr.nets).toEqual(expect.arrayContaining(["+3V3", "+5V", "GND"]));
  });

  test("resolveBoardConfig merges overrides over the defaults", () => {
    const merged = resolveBoardConfig({ copperLayers: 4, minTrackWidth: 0.15 });
    expect(merged.copperLayers).toBe(4);
    expect(merged.minTrackWidth).toBe(0.15);
    // untouched fields fall through
    expect(merged.copperWeightOz).toBe(DEFAULT_BOARD_CONFIG.copperWeightOz);
    expect(merged.netClasses).toEqual(DEFAULT_BOARD_CONFIG.netClasses);
  });

  test("resolveBoardConfig replaces netClasses wholesale when supplied", () => {
    const custom = resolveBoardConfig({
      netClasses: [
        { name: "Default", trackWidth: 0.2, clearance: 0.2, viaDiameter: 0.8, viaDrill: 0.4, nets: [] },
      ],
    });
    expect(custom.netClasses).toHaveLength(1);
  });
});

describe("project — buildKicadPro golden JSON shape", () => {
  const json = buildKicadPro({ projectName: "wroom-breakout" });
  const pro = JSON.parse(json) as Record<string, any>;

  test("is valid JSON, pretty-printed (2-space) with a trailing newline", () => {
    expect(json.endsWith("\n")).toBe(true);
    // pretty-printed → contains indented lines, not a single minified line
    expect(json).toContain('\n  "meta"');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test("meta carries the project filename", () => {
    expect(pro.meta.filename).toBe("wroom-breakout.kicad_pro");
    expect(typeof pro.meta.version).toBe("number");
  });

  test("net_settings has a Default and a wider Power class", () => {
    const classes = pro.net_settings.classes as Array<Record<string, any>>;
    const def = classes.find((c) => c.name === "Default")!;
    const pwr = classes.find((c) => c.name === "Power")!;
    expect(def).toBeDefined();
    expect(pwr).toBeDefined();
    expect(pwr.track_width).toBeGreaterThan(def.track_width);
    expect(pwr.clearance).toBeGreaterThanOrEqual(def.clearance);
    // Power carries the rail nets
    expect(pwr.nets).toEqual(expect.arrayContaining(["+3V3", "+5V", "GND"]));
  });

  test("net_settings assigns +3V3/+5V/GND to the Power class", () => {
    const assign = pro.net_settings.netclass_assignments as Record<string, string>;
    expect(assign["+3V3"]).toBe("Power");
    expect(assign["+5V"]).toBe("Power");
    expect(assign["GND"]).toBe("Power");
  });

  test("board.design_settings.rules reflect the BoardConfig floors (2-layer defaults)", () => {
    const rules = pro.board.design_settings.rules;
    expect(rules.min_clearance).toBe(DEFAULT_BOARD_CONFIG.minClearance);
    expect(rules.min_track_width).toBe(DEFAULT_BOARD_CONFIG.minTrackWidth);
  });

  test("libraries pin the project-local sym/fp libs by nickname == project name", () => {
    expect(pro.libraries.pinned_symbol_libs).toContain("wroom-breakout");
    expect(pro.libraries.pinned_footprint_libs).toContain("wroom-breakout");
  });

  test("pcbnew section present with a last_paths block", () => {
    expect(pro.pcbnew).toBeDefined();
    expect(pro.pcbnew.last_paths).toBeDefined();
  });

  test("overrides flow through to the emitted JSON", () => {
    const out = JSON.parse(
      buildKicadPro({ projectName: "p", config: { minTrackWidth: 0.1 } }),
    );
    expect(out.board.design_settings.rules.min_track_width).toBe(0.1);
  });

  test("is deterministic — same input twice yields identical bytes", () => {
    const a = buildKicadPro({ projectName: "wroom-breakout" });
    const b = buildKicadPro({ projectName: "wroom-breakout" });
    expect(a).toBe(b);
  });
});

// ── placement.ts — gridPlacement ───────────────────────────────────────────

describe("placement — gridPlacement", () => {
  test("is deterministic — same input twice yields identical maps", () => {
    const refs = ["U1", "R10", "C2", "R2", "C1"];
    const a = gridPlacement(refs);
    const b = gridPlacement(refs);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  test("natural-sorts: R2 before R10, and prefixes group (C before R before U)", () => {
    const out = gridPlacement(["U1", "R10", "C2", "R2", "C1"]);
    expect([...out.keys()]).toEqual(["C1", "C2", "R2", "R10", "U1"]);
  });

  test("input order does not affect output (any permutation → same layout)", () => {
    const sorted = gridPlacement(["C1", "C2", "R2", "R10", "U1"]);
    const shuffled = gridPlacement(["R10", "C2", "U1", "C1", "R2"]);
    expect([...shuffled.entries()]).toEqual([...sorted.entries()]);
  });

  test("no two refDes share a coordinate", () => {
    const out = gridPlacement(
      Array.from({ length: 20 }, (_, i) => `R${i + 1}`),
    );
    const coords = new Set([...out.values()].map((p) => `${p.x},${p.y}`));
    expect(coords.size).toBe(out.size);
    expect(out.size).toBe(20);
  });

  test("respects cols — wraps to a new row after `cols` items", () => {
    const out = gridPlacement(["A1", "A2", "A3", "A4", "A5"], {
      cols: 2,
      pitchX: 10,
      pitchY: 10,
      originX: 0,
      originY: 0,
    });
    // 5 items, 2 cols → rows: [A1 A2] [A3 A4] [A5]
    expect(out.get("A1")).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(out.get("A2")).toEqual({ x: 10, y: 0, rotation: 0 });
    expect(out.get("A3")).toEqual({ x: 0, y: 10, rotation: 0 });
    expect(out.get("A4")).toEqual({ x: 10, y: 10, rotation: 0 });
    expect(out.get("A5")).toEqual({ x: 0, y: 20, rotation: 0 });
  });

  test("every instance has rotation 0", () => {
    const out = gridPlacement(["U1", "U2", "U3"]);
    for (const p of out.values()) expect(p.rotation).toBe(0);
  });

  test("de-duplicates repeated refDes", () => {
    const out = gridPlacement(["R1", "R1", "R2"]);
    expect(out.size).toBe(2);
  });
});

// ── pcb.ts — buildBasePcb ──────────────────────────────────────────────────

describe("pcb — buildBasePcb", () => {
  const text = buildBasePcb();
  const node = parseSexpr(text);

  test("round-trips through parseSexpr/serializeSexpr (structurally stable)", () => {
    const once = parseSexpr(text);
    const twice = parseSexpr(serializeSexpr(once));
    expect(twice).toEqual(once);
  });

  test("head is kicad_pcb", () => {
    expect(head(node)).toBe("kicad_pcb");
  });

  test("has version, generator, paper, layers and setup", () => {
    expect(findChild(node, "version")).toBeDefined();
    const gen = findChild(node, "generator")!;
    expect(isList(gen)).toBe(true);
    if (isList(gen) && isStr(gen.items[1])) {
      expect(gen.items[1].value).toBe("project-foundry");
    }
    const paper = findChild(node, "paper")!;
    if (isList(paper) && isAtom(paper.items[1])) {
      expect(paper.items[1].value).toBe("A4");
    }
    expect(findChild(node, "layers")).toBeDefined();
    expect(findChild(node, "setup")).toBeDefined();
  });

  test("layers block contains the 2-layer copper stack (F.Cu + B.Cu)", () => {
    const layers = findChild(node, "layers")!;
    if (!isList(layers)) throw new Error("unreachable");
    const names = layers.items
      .filter((it): it is SNode & { kind: "list" } => isList(it))
      .map((row) => (isStr(row.items[1]) ? row.items[1].value : undefined));
    expect(names).toContain("F.Cu");
    expect(names).toContain("B.Cu");
    // exactly two copper (signal) layers for the 2-layer default
    const copper = layers.items.filter(
      (row) =>
        isList(row) &&
        isStr(row.items[1]) &&
        row.items[1].value.endsWith(".Cu"),
    );
    expect(copper).toHaveLength(2);
  });

  test("contains NO footprint children and NO net children (board-setup only)", () => {
    expect(findChildren(node, "footprint")).toHaveLength(0);
    expect(findChildren(node, "net")).toHaveLength(0);
    expect(text).not.toContain("(footprint ");
  });

  test("a 4-layer override emits inner copper layers", () => {
    const four = parseSexpr(buildBasePcb({ config: { copperLayers: 4 } }));
    const layers = findChild(four, "layers")!;
    if (!isList(layers)) throw new Error("unreachable");
    const copper = layers.items.filter(
      (row) =>
        isList(row) && isStr(row.items[1]) && row.items[1].value.endsWith(".Cu"),
    );
    expect(copper).toHaveLength(4);
  });

  test("is deterministic — same input twice yields identical bytes", () => {
    expect(buildBasePcb()).toBe(buildBasePcb());
  });
});
