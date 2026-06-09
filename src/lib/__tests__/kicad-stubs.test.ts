// Tests for the missing-asset STUB generators + coverage report (export-engine
// Task 6, design §3.5).
//
// 16 of 17 BOM parts have no uploaded CAD assets, so the export must degrade
// gracefully: synthesize clearly-labeled STUB symbols/footprints so the KiCad
// project still opens, and emit an `EXPORT_REPORT.md` coverage report.
//
// These modules are PURE: no React, no DB, no env, no network, no fs. The stub
// generators emit `.kicad_sym`-style `(symbol ...)` and `.kicad_mod`-style
// `(footprint ...)` S-expressions that round-trip through `parseSexpr` and feed
// straight into Task 4's `buildSymbolLib`. The report is deterministic markdown.

import { describe, expect, test } from "vitest";
import {
  parseSexpr,
  serializeSexpr,
  isList,
  isStr,
  findChild,
  findChildren,
  head,
  atomValue,
  type SNode,
  type SList,
} from "@/lib/kicad/sexpr";
import { buildSymbolLib } from "@/lib/kicad/symbol-lib";
import { buildStubSymbol, buildStubFootprint } from "@/lib/kicad/stubs";

// In a real `.kicad_sym`, pins live inside the `(symbol "<name>_0_1" ...)` unit
// sub-symbol, not directly under the top `(symbol ...)`. Collect every `(pin
// ...)` node anywhere in the tree.
function allPins(node: SNode): SList[] {
  if (!isList(node)) return [];
  const out: SList[] = [];
  for (const child of node.items) {
    if (isList(child)) {
      if (head(child) === "pin") out.push(child);
      else out.push(...allPins(child));
    }
  }
  return out;
}
import {
  buildExportReport,
  type PartCoverage,
} from "@/lib/kicad/report";
import type { Pinout } from "@/lib/schemas/part-fact";

// A representative PINOUT fact (mirrors the LDO fixture used in
// nets-actions.test.ts / part-fact-schema.test.ts): one pin of every electrical
// flavour the mapping has to handle.
const SAMPLE_PINOUT: Pinout = {
  pins: [
    { number: "1", name: "GND", function: "ground", type: "gnd" },
    { number: "2", name: "VIN", function: "power input", type: "power" },
    { number: "3", name: "EN", function: "enable", type: "io" },
    { number: "4", name: "NC", function: "no connect", type: "nc" },
    { number: "5", name: "ADC0", function: "analog input", type: "analog" },
    { number: "6", name: "XTAL", function: "clock", type: "clock" },
    { number: "7", name: "IO0", function: ["boot strap", "GPIO"], type: "strapping" },
    { number: "8", name: "MYSTERY", function: "unknown" }, // no type → unspecified
  ],
};

describe("stubs — buildStubSymbol", () => {
  test("emits a valid (symbol ...) parseable by parseSexpr", () => {
    const out = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    const node = parseSexpr(out);
    expect(isList(node)).toBe(true);
    expect(head(node)).toBe("symbol");
  });

  test("emits exactly one (pin ...) per pinout pin, carrying real number + name", () => {
    const out = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const pins = allPins(node);
    expect(pins).toHaveLength(SAMPLE_PINOUT.pins.length);

    const seen = new Map<string, string>(); // number -> name
    for (const pin of pins) {
      const nameNode = findChild(pin, "name");
      const numberNode = findChild(pin, "number");
      const name = nameNode && isStr(nameNode.items[1]) ? nameNode.items[1].value : undefined;
      const number = numberNode && isStr(numberNode.items[1]) ? numberNode.items[1].value : undefined;
      expect(name).toBeDefined();
      expect(number).toBeDefined();
      seen.set(number!, name!);
    }
    for (const p of SAMPLE_PINOUT.pins) {
      expect(seen.get(p.number)).toBe(p.name);
    }
  });

  test("maps pin types to KiCad electrical pin types", () => {
    const out = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const pins = allPins(node);

    // pin elec type is items[1] of (pin <elec> <style> (at ...) (length ...) ...)
    const elecByNumber = new Map<string, string>();
    for (const pin of pins) {
      const numberNode = findChild(pin, "number");
      const number = numberNode && isStr(numberNode.items[1]) ? numberNode.items[1].value : "?";
      elecByNumber.set(number, atomValue(pin.items[1]) ?? "?");
    }

    expect(elecByNumber.get("1")).toBe("power_in"); // gnd
    expect(elecByNumber.get("2")).toBe("power_in"); // power
    expect(elecByNumber.get("3")).toBe("bidirectional"); // io
    expect(elecByNumber.get("4")).toBe("no_connect"); // nc
    expect(elecByNumber.get("5")).toBe("passive"); // analog
    expect(elecByNumber.get("6")).toBe("passive"); // clock
    expect(elecByNumber.get("7")).toBe("passive"); // strapping
    expect(elecByNumber.get("8")).toBe("unspecified"); // absent type
  });

  test("carries a visible UNVERIFIED auto-stub marker", () => {
    const out = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    expect(out).toContain("STUB");
    expect(out).toMatch(/UNVERIFIED/i);
    // The marker is visible in KiCad: a (property ...) and/or (text ...).
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const props = findChildren(node, "property");
    const hasMarkerProp = props.some(
      (p) =>
        isStr(p.items[1]) &&
        /stub|unverified/i.test((p.items[2] && isStr(p.items[2]) ? p.items[2].value : "") + (isStr(p.items[1]) ? p.items[1].value : "")),
    );
    const hasMarkerText = findChildren(node, "text").length > 0;
    expect(hasMarkerProp || hasMarkerText).toBe(true);
  });

  test("symbol Value property is the mpn", () => {
    const out = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const value = findChildren(node, "property").find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Value",
    );
    expect(value).toBeDefined();
    if (!value || !isStr(value.items[2])) throw new Error("unreachable");
    expect(value.items[2].value).toBe("AP2112K-3.3");
  });

  test("no-pinout path emits a generic box with a note and zero real pins", () => {
    const out = buildStubSymbol({ mpn: "WIDGET-1" });
    const node = parseSexpr(out);
    expect(head(node)).toBe("symbol");
    if (!isList(node)) throw new Error("unreachable");
    // generic box: no real pins
    expect(allPins(node)).toHaveLength(0);
    expect(out).toContain("STUB");
    expect(out).toMatch(/no pinout/i);
    // still carries the mpn as its Value
    const value = findChildren(node, "property").find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Value",
    );
    expect(value).toBeDefined();
  });

  test("output feeds straight into Task 4 buildSymbolLib", () => {
    const stub = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    const lib = buildSymbolLib([{ name: "AP2112K-3.3", kicadSymText: stub }], {
      footprintFor: () => "wroom-breakout:STUB-AP2112K-3.3",
    });
    const node = parseSexpr(lib);
    expect(head(node)).toBe("kicad_symbol_lib");
    if (!isList(node)) throw new Error("unreachable");
    const symbols = findChildren(node, "symbol");
    expect(symbols).toHaveLength(1);
    // footprint association applied
    const fp = findChildren(symbols[0]!, "property").find(
      (p) => isStr(p.items[1]) && p.items[1].value === "Footprint",
    );
    expect(fp).toBeDefined();
    if (!fp || !isStr(fp.items[2])) throw new Error("unreachable");
    expect(fp.items[2].value).toBe("wroom-breakout:STUB-AP2112K-3.3");
  });

  test("output round-trips structurally (parse(serialize) stable)", () => {
    const out = buildStubSymbol({ mpn: "AP2112K-3.3", pinout: SAMPLE_PINOUT });
    const once = parseSexpr(out);
    const twice = parseSexpr(serializeSexpr(once));
    expect(twice).toEqual(once);
  });
});

describe("stubs — buildStubFootprint", () => {
  test("emits a valid (footprint ...) parseable by parseSexpr", () => {
    const out = buildStubFootprint({ mpn: "AP2112K-3.3", footprint: "SOT-23-5" });
    const node = parseSexpr(out);
    expect(head(node)).toBe("footprint");
  });

  test("silk carries the mpn and a STUB marker", () => {
    const out = buildStubFootprint({ mpn: "AP2112K-3.3", footprint: "SOT-23-5" });
    expect(out).toContain("AP2112K-3.3");
    expect(out).toContain("STUB");
    // mpn appears on a silk fp_text
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const texts = findChildren(node, "fp_text");
    const silkValues = texts
      .map((t) => (isStr(t.items[2]) ? t.items[2].value : undefined))
      .filter((v): v is string => v !== undefined);
    expect(silkValues.some((v) => v.includes("AP2112K-3.3"))).toBe(true);
  });

  test("has a courtyard rectangle (fp_rect or fp_line on a courtyard layer)", () => {
    const out = buildStubFootprint({ mpn: "X", footprint: "0805" });
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const rects = findChildren(node, "fp_rect");
    expect(rects.length).toBeGreaterThan(0);
    // a courtyard layer is referenced somewhere
    expect(out).toContain("CrtYd");
  });

  test("a known small package (0805) is roughly sized; unknown package falls back to default", () => {
    const known = buildStubFootprint({ mpn: "C1", footprint: "0805" });
    const unknown = buildStubFootprint({ mpn: "X1", footprint: "TOTALLY-MADE-UP-PKG" });
    // both well-formed
    expect(head(parseSexpr(known))).toBe("footprint");
    expect(head(parseSexpr(unknown))).toBe("footprint");
    // the known small package is sized smaller than the default placeholder
    const knownRect = findChild(parseSexpr(known), "fp_rect")!;
    const unknownRect = findChild(parseSexpr(unknown), "fp_rect")!;
    const width = (r: typeof knownRect) => {
      const start = findChild(r, "start")!;
      const end = findChild(r, "end")!;
      const sx = Number(atomValue(start.items[1]));
      const ex = Number(atomValue(end.items[1]));
      return Math.abs(ex - sx);
    };
    expect(width(knownRect)).toBeLessThan(width(unknownRect));
  });

  test("adds 2 generic pads for a 2-terminal package (0805)", () => {
    const out = buildStubFootprint({ mpn: "C1", footprint: "0805" });
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const pads = findChildren(node, "pad");
    expect(pads).toHaveLength(2);
  });

  test("no-footprint path still produces a well-formed placeholder", () => {
    const out = buildStubFootprint({ mpn: "U99" });
    const node = parseSexpr(out);
    expect(head(node)).toBe("footprint");
    expect(out).toContain("U99");
    expect(out).toContain("STUB");
  });

  test("output round-trips structurally (parse(serialize) stable)", () => {
    const out = buildStubFootprint({ mpn: "AP2112K-3.3", footprint: "SOT-23-5" });
    const once = parseSexpr(out);
    const twice = parseSexpr(serializeSexpr(once));
    expect(twice).toEqual(once);
  });
});

describe("report — buildExportReport", () => {
  const PARTS: PartCoverage[] = [
    { mpn: "ESP32-WROOM-32E", refDes: "U1", symbol: "verified", footprint: "verified", model3d: "verified" },
    { mpn: "AP2112K-3.3", refDes: "U2", symbol: "stubbed", footprint: "stubbed", model3d: "missing" },
    { mpn: "GRM188R61A106KE69D", refDes: "C2,C3,C7", symbol: "unverified", footprint: "stubbed", model3d: "missing" },
    // A standard-lib REFERENCED part: symbol + footprint resolved from KiCad's
    // global libraries (no asset, no stub, no bundled file). 3D comes with it.
    { mpn: "Generic-R-0805", refDes: "R1", symbol: "referenced", footprint: "referenced", model3d: "missing" },
    { mpn: "RC0805FR-0710KL", refDes: "R2", symbol: "missing", footprint: "missing", model3d: "missing" },
  ];

  test("renders a per-part table with mpn / refDes / symbol / footprint / 3D", () => {
    const md = buildExportReport(PARTS);
    expect(md).toContain("| ESP32-WROOM-32E | U1 | verified | verified | verified |");
    expect(md).toContain("| AP2112K-3.3 | U2 | stubbed | stubbed | missing |");
    expect(md).toContain("| Generic-R-0805 | R1 | referenced | referenced | missing |");
    expect(md).toContain("| RC0805FR-0710KL | R2 | missing | missing | missing |");
    // the comma-joined refDes is preserved (it is data, not split)
    expect(md).toContain("C2,C3,C7");
  });

  test("summary counts verified/unverified/referenced/stubbed/missing per asset kind", () => {
    const md = buildExportReport(PARTS);
    // Symbol column: 1 verified, 1 unverified, 1 referenced, 1 stubbed, 1 missing
    // Footprint: 1 verified, 0 unverified, 1 referenced, 2 stubbed, 1 missing
    // 3D: 1 verified, 0 unverified, 0 referenced, 0 stubbed, 4 missing
    expect(md).toContain("| Symbol | 1 | 1 | 1 | 1 | 1 |");
    expect(md).toContain("| Footprint | 1 | 0 | 1 | 2 | 1 |");
    expect(md).toContain("| 3D model | 1 | 0 | 0 | 0 | 4 |");
  });

  test("includes a legend explaining the five statuses", () => {
    const md = buildExportReport(PARTS);
    expect(md).toMatch(/verified/);
    expect(md).toMatch(/unverified/);
    expect(md).toMatch(/referenced/);
    expect(md).toMatch(/stubbed/);
    expect(md).toMatch(/missing/);
    expect(md.toLowerCase()).toContain("legend");
  });

  test("honours projectName and generatedNote options", () => {
    const md = buildExportReport(PARTS, {
      projectName: "wroom-breakout",
      generatedNote: "Generated 2026-06-04 from revision v1.",
    });
    expect(md).toContain("wroom-breakout");
    expect(md).toContain("Generated 2026-06-04 from revision v1.");
  });

  test("is deterministic for the same input", () => {
    const a = buildExportReport(PARTS, { projectName: "p" });
    const b = buildExportReport(PARTS, { projectName: "p" });
    expect(a).toBe(b);
  });

  test("golden markdown for a mixed-coverage list", () => {
    const md = buildExportReport(PARTS, {
      projectName: "wroom-breakout",
      generatedNote: "Generated from revision v1.",
    });
    expect(md).toBe(GOLDEN_REPORT);
  });
});

const GOLDEN_REPORT = `# Export coverage report — wroom-breakout

Generated from revision v1.

This report lists the CAD-asset coverage for every part on the BOM. Parts
marked **stubbed** received an auto-generated placeholder symbol/footprint so
the KiCad project opens; replace them with verified assets before fabrication.

## Per-part coverage

| MPN | Ref des | Symbol | Footprint | 3D model |
| --- | --- | --- | --- | --- |
| ESP32-WROOM-32E | U1 | verified | verified | verified |
| AP2112K-3.3 | U2 | stubbed | stubbed | missing |
| GRM188R61A106KE69D | C2,C3,C7 | unverified | stubbed | missing |
| Generic-R-0805 | R1 | referenced | referenced | missing |
| RC0805FR-0710KL | R2 | missing | missing | missing |

## Summary

| Asset | Verified | Unverified | Referenced | Stubbed | Missing |
| --- | --- | --- | --- | --- | --- |
| Symbol | 1 | 1 | 1 | 1 | 1 |
| Footprint | 1 | 0 | 1 | 2 | 1 |
| 3D model | 1 | 0 | 0 | 0 | 4 |

## Legend

- **verified** — a curated asset that passed the verify gate.
- **unverified** — an uploaded asset not yet verified; used as-is.
- **referenced** — no uploaded asset; the part is emitted by KiCad standard-library lib-id (Device:R, etc.) and resolved from your global libraries (no file bundled).
- **stubbed** — no asset; an auto-generated placeholder was synthesized (replace before fabrication).
- **missing** — no asset and no stub emitted (3D models are optional and omitted when absent).
`;
