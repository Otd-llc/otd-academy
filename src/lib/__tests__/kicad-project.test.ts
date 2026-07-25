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

  test("Power class is assigned the VBUS/+3V3/+5V/GND rails", () => {
    const pwr = DEFAULT_BOARD_CONFIG.netClasses.find((c) => c.name === "Power")!;
    // VBUS (raw pre-fuse 5 V) must be here: the L1.01 LAYOUT lesson promises it
    // is on the 0.5 mm Power class; a missing pattern drops it to 0.25 mm Default.
    expect(pwr.nets).toEqual(expect.arrayContaining(["VBUS", "+3V3", "+5V", "GND"]));
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

  test("net_settings has a Default and a wider Power class, each with a priority and no legacy nets", () => {
    const classes = pro.net_settings.classes as Array<Record<string, any>>;
    const def = classes.find((c) => c.name === "Default")!;
    const pwr = classes.find((c) => c.name === "Power")!;
    expect(def).toBeDefined();
    expect(pwr).toBeDefined();
    expect(pwr.track_width).toBeGreaterThan(def.track_width);
    expect(pwr.clearance).toBeGreaterThanOrEqual(def.clearance);
    // KiCad 9/10 shape: every class has a numeric priority; Default is the INT_MAX fallback.
    expect(def.priority).toBe(2147483647);
    expect(typeof pwr.priority).toBe("number");
    // The legacy per-class `nets` array is gone — membership moved to netclass_patterns.
    expect(def).not.toHaveProperty("nets");
    expect(pwr).not.toHaveProperty("nets");
  });

  test("net_settings assigns VBUS/+3V3/+5V/GND to Power via netclass_patterns (assignments map is null)", () => {
    expect(pro.net_settings.netclass_assignments).toBeNull();
    const patterns = pro.net_settings.netclass_patterns as Array<{ netclass: string; pattern: string }>;
    for (const net of ["VBUS", "+3V3", "+5V", "GND"]) {
      expect(patterns).toEqual(expect.arrayContaining([{ netclass: "Power", pattern: net }]));
    }
  });

  test("via_dimensions leads with a fab-floor via (min drill + 2x min annular) for tight-spot escapes", () => {
    const vias = pro.board.design_settings.via_dimensions as Array<{ diameter: number; drill: number }>;
    // index 0 = the small escape via a learner picks at e.g. D1's GND via.
    expect(vias[0]).toEqual({ diameter: 0.6, drill: 0.3 }); // 0.3 drill + 2×0.15 annular
    // the per-class Default + Power sizes still follow it.
    expect(vias).toEqual(
      expect.arrayContaining([
        { diameter: 0.8, drill: 0.4 },
        { diameter: 1.0, drill: 0.5 },
      ]),
    );
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

  test("erc severities silence lib_symbol_mismatch (embedded std-lib symbols differ from the user's stock)", () => {
    expect(pro.erc.rule_severities.lib_symbol_mismatch).toBe("ignore");
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
      expect(gen.items[1].value).toBe("otd-academy");
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

  test("emits a physical stackup carrying the ENIG board finish", () => {
    expect(text).toContain("stackup");
    expect(text).toContain('"ENIG"');
  });

  test("the 4-layer stackup carries the inner core dielectric + inner copper", () => {
    const four = buildBasePcb({ config: { copperLayers: 4 } });
    expect(four).toContain("1.24"); // core thickness — present only in the 4-layer stackup
    expect(four).toContain("In1.Cu");
  });

  test("is deterministic — same input twice yields identical bytes", () => {
    expect(buildBasePcb()).toBe(buildBasePcb());
  });

  // The Plot dialog opens with whatever `layerselection` pre-ticks. It must be
  // EXACTLY the fab set, or the learner plots courtyard/fab/empty-user layers the
  // board house then has to be told to ignore.
  test("layerselection pre-ticks exactly the fab set, paste excluded (2-layer)", () => {
    // bits: F.Cu 0, B.Cu 31 | B.SilkS 36, F.SilkS 37, B.Mask 38, F.Mask 39, Edge.Cuts 44
    expect(text).toContain("(layerselection 0x000010f0_80000001)");
    // F.Paste 34 / B.Paste 35 would set 0x…c in the high word's low nibble-pair.
    expect(text).not.toContain("0xffffffff");
  });

  test("layerselection picks up the inner coppers on a 4-layer board", () => {
    // adds In1.Cu 1 + In2.Cu 2 → low word 0x80000007
    expect(buildBasePcb({ config: { copperLayers: 4 } })).toContain(
      "(layerselection 0x000010f0_80000007)",
    );
  });

  // KiCad copies the board title-block revision into every Gerber's
  // %TF.ProjectId and into the .gbrjob "Revision". With no title block it ships
  // as the literal `rev?`.
  test("omits the title block entirely when no projectName is supplied", () => {
    expect(findChild(node, "title_block")).toBeUndefined();
  });

  test("emits a title block with the revision when supplied", () => {
    const withTitle = buildBasePcb({
      projectName: "l1-01-wroom-breakout",
      rev: "v1",
      date: "2026-07-24",
      company: "One Thousand Drones",
    });
    const tb = findChild(parseSexpr(withTitle), "title_block")!;
    expect(tb).toBeDefined();
    expect(withTitle).toContain('(rev "v1")');
    expect(withTitle).toContain('(title "l1-01-wroom-breakout")');
    expect(withTitle).toContain('(company "One Thousand Drones")');
  });

  test("omits empty title-block sub-nodes rather than emitting (rev \"\")", () => {
    const noRev = buildBasePcb({ projectName: "x" });
    expect(noRev).toContain('(title "x")');
    expect(noRev).not.toContain("(rev ");
    expect(noRev).not.toContain("(date ");
  });

  // Comment1 is what board text prints as ${COMMENT1}, so a silk build-stamp can
  // be generated rather than hand-typed.
  test("stamps the build SHA into Comment1 when supplied", () => {
    expect(buildBasePcb({ projectName: "x", gitSha: "4ef28f4" })).toContain('(comment 1 "4ef28f4")');
  });

  test("omits Comment1 when there is no SHA (no provenance beats wrong provenance)", () => {
    expect(buildBasePcb({ projectName: "x" })).not.toContain("(comment ");
  });

  test("a SHA without a projectName emits no title block at all", () => {
    expect(buildBasePcb({ gitSha: "4ef28f4" })).not.toContain("(comment ");
  });
});
