// Tests for the KiCad library-assembly primitives (export-engine Task 4).
//
// These modules are PURE: no React, no DB, no env, no network, no fs. They
// PARSE uploaded `.kicad_sym` / `.kicad_mod` S-expression text, tweak it
// (footprint association, 3D-model path), and re-serialize it, and they emit
// the `sym-lib-table` / `fp-lib-table` index files.
//
// Target format is KiCad 10. We cannot run KiCad here, so fidelity is anchored
// to the real S-expression shapes already exercised by `kicad-meta.test.ts`
// (reused below as ground-truth fixtures) plus the documented KiCad format.
// Golden-text assertions lock in OUR output for later manual acceptance.

import { describe, expect, test } from "vitest";
import {
  parseSexpr,
  serializeSexpr,
  sym,
  str,
  list,
  isList,
  isAtom,
  findChild,
  findChildren,
  type SNode,
} from "@/lib/kicad/sexpr";
import { setSymbolFootprint, buildSymbolLib } from "@/lib/kicad/symbol-lib";
import { setFootprintModelPath } from "@/lib/kicad/footprint-lib";
import { buildSymLibTable, buildFpLibTable } from "@/lib/kicad/lib-tables";

// ── Ground-truth fixtures (reused from kicad-meta.test.ts) ─────────────────
// A native KiCad symbol library wrapping a single symbol, including the
// `(property "Footprint" ...)` node the association step rewrites.
const SAMPLE_SYM = `(kicad_symbol_lib (version 20211014) (generator kicad_symbol_editor)
  (symbol "AP2112K-3.3" (in_bom yes) (on_board yes)
    (property "Reference" "U" (at 0 0 0)
      (effects (font (size 1.27 1.27)))
    )
    (property "Value" "AP2112K-3.3" (at 0 2.54 0)
      (effects (font (size 1.27 1.27)))
    )
    (property "Footprint" "" (at 0 -2.54 0)
      (effects (font (size 1.27 1.27)) hide)
    )
    (pin power_in line (at -7.62 0 0) (length 2.54)
      (name "VIN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
  )
)`;

// A quoted KiCad 6/7+ footprint WITH an existing 3D model node (offset/scale/
// rotate present) — the path-rewrite must preserve those sub-nodes.
const SAMPLE_FP_WITH_MODEL = `(footprint "SOP65P640X120-8N" (layer "F.Cu")
  (attr smd)
  (fp_text reference "REF**" (at 0 0))
  (model "\${KIPRJMOD}/old/path/SOP65P640X120-8N.step"
    (offset (xyz 0 0 0))
    (scale (xyz 1 1 1))
    (rotate (xyz 0 0 0))
  )
)`;

// A footprint WITHOUT any 3D model node — the rewrite must INSERT one.
const SAMPLE_FP_NO_MODEL = `(footprint "R_0805" (layer "F.Cu")
  (attr smd)
  (fp_text reference "REF**" (at 0 0))
)`;

describe("sexpr — parse / serialize round-trip", () => {
  test("distinguishes bare symbols from quoted strings", () => {
    const node = parseSexpr(`(symbol "My Part" yes 20211014)`);
    expect(isList(node)).toBe(true);
    if (!isList(node)) throw new Error("unreachable");
    expect(node.items[0]).toEqual(sym("symbol"));
    expect(node.items[1]).toEqual(str("My Part"));
    expect(node.items[2]).toEqual(sym("yes"));
    expect(node.items[3]).toEqual(sym("20211014"));
  });

  test("parses nested lists and arbitrary whitespace/newlines", () => {
    const node = parseSexpr("(a\n  (b   c)\n\t(d (e f)))");
    expect(node).toEqual(
      list([
        sym("a"),
        list([sym("b"), sym("c")]),
        list([sym("d"), list([sym("e"), sym("f")])]),
      ]),
    );
  });

  test("decodes \\\" and \\\\ escapes inside quoted strings", () => {
    const node = parseSexpr(`(property "a\\"b" "c\\\\d")`);
    if (!isList(node)) throw new Error("unreachable");
    expect(node.items[1]).toEqual(str(`a"b`));
    expect(node.items[2]).toEqual(str(`c\\d`));
  });

  test("serializer re-quotes only the values that need quoting and re-escapes", () => {
    const text = serializeSexpr(
      list([sym("property"), str(`a"b`), str(`c\\d`), sym("yes")]),
    );
    expect(text).toContain(`"a\\"b"`);
    expect(text).toContain(`"c\\\\d"`);
    // bare atom stays bare (no quotes around it)
    expect(text).toContain(" yes");
  });

  test("serialize(parse(x)) is structurally stable (re-parse equals first parse)", () => {
    const once = parseSexpr(SAMPLE_SYM);
    const twice = parseSexpr(serializeSexpr(once));
    expect(twice).toEqual(once);
  });

  test("round-trips the sample footprint structurally", () => {
    const once = parseSexpr(SAMPLE_FP_WITH_MODEL);
    const twice = parseSexpr(serializeSexpr(once));
    expect(twice).toEqual(once);
  });

  test("quotes an empty-string atom", () => {
    expect(serializeSexpr(str(""))).toBe(`""`);
  });

  test("findChild / findChildren locate child lists by head keyword", () => {
    const node = parseSexpr(SAMPLE_SYM);
    if (!isList(node)) throw new Error("unreachable");
    const symbolNode = findChild(node, "symbol");
    expect(symbolNode).toBeDefined();
    const props = findChildren(symbolNode!, "property");
    expect(props).toHaveLength(3);
    expect(findChild(node, "nonexistent")).toBeUndefined();
  });
});

describe("symbol-lib — setSymbolFootprint", () => {
  test("sets the Footprint property value to <nick>:<fpName>", () => {
    const out = setSymbolFootprint(SAMPLE_SYM, "MyLib:SOT-23-5");
    const node = parseSexpr(out);
    const symbolNode = findChild(node as SNode, "symbol")!;
    const footprintProp = findChildren(symbolNode, "property").find(
      (p) => isList(p) && isAtom(p.items[1]) && p.items[1].value === "Footprint",
    );
    expect(footprintProp).toBeDefined();
    if (!isList(footprintProp!)) throw new Error("unreachable");
    expect(footprintProp.items[2]).toEqual(str("MyLib:SOT-23-5"));
  });

  test("preserves the property's (at ...) and (effects ...) sub-nodes", () => {
    const out = setSymbolFootprint(SAMPLE_SYM, "MyLib:SOT-23-5");
    expect(out).toContain("(at 0 -2.54 0)");
    expect(out).toContain("hide");
  });

  test("inserts a Footprint property when the symbol has none", () => {
    const noFp = `(symbol "X" (in_bom yes) (on_board yes)
  (property "Reference" "U" (at 0 0 0))
)`;
    const out = setSymbolFootprint(noFp, "MyLib:FP");
    // Input was a BARE (symbol ...) so output is too; the symbol node IS the
    // top node, not a child of it.
    const top = parseSexpr(out);
    if (!isList(top)) throw new Error("unreachable");
    const symbolNode = top.items[0] && isList(top) && top.items[0]!.kind === "sym"
      ? top
      : findChild(top, "symbol")!;
    const fp = findChildren(symbolNode, "property").find(
      (p) => isList(p) && isAtom(p.items[1]) && p.items[1].value === "Footprint",
    );
    expect(fp).toBeDefined();
    if (!isList(fp!)) throw new Error("unreachable");
    expect(fp.items[2]).toEqual(str("MyLib:FP"));
  });
});

describe("symbol-lib — buildSymbolLib", () => {
  test("unwraps a kicad_symbol_lib wrapper and re-hosts the symbol", () => {
    const out = buildSymbolLib([{ name: "AP2112K-3.3", kicadSymText: SAMPLE_SYM }], {});
    const node = parseSexpr(out);
    expect(isList(node)).toBe(true);
    if (!isList(node)) throw new Error("unreachable");
    expect(node.items[0]).toEqual(sym("kicad_symbol_lib"));
    // exactly ONE symbol (the wrapper was unwrapped, not nested)
    expect(findChildren(node, "symbol")).toHaveLength(1);
    // header carries our generator
    const gen = findChild(node, "generator");
    expect(gen).toBeDefined();
    if (!isList(gen!)) throw new Error("unreachable");
    expect(gen.items[1]).toEqual(str("project-foundry"));
  });

  test("merges N symbol bodies into one library", () => {
    const bare = `(symbol "R_Generic" (in_bom yes) (on_board yes)
  (property "Reference" "R" (at 0 0 0))
)`;
    const out = buildSymbolLib(
      [
        { name: "AP2112K-3.3", kicadSymText: SAMPLE_SYM },
        { name: "R_Generic", kicadSymText: bare },
      ],
      {},
    );
    const node = parseSexpr(out);
    if (!isList(node)) throw new Error("unreachable");
    const symbols = findChildren(node, "symbol");
    expect(symbols).toHaveLength(2);
  });

  test("applies a footprintRef per symbol via opts.footprintFor", () => {
    const out = buildSymbolLib([{ name: "AP2112K-3.3", kicadSymText: SAMPLE_SYM }], {
      footprintFor: (name) => (name === "AP2112K-3.3" ? "MyLib:SOT-23-5" : undefined),
    });
    const symbolNode = findChild(parseSexpr(out), "symbol")!;
    const fp = findChildren(symbolNode, "property").find(
      (p) => isList(p) && isAtom(p.items[1]) && p.items[1].value === "Footprint",
    );
    if (!isList(fp!)) throw new Error("unreachable");
    expect(fp.items[2]).toEqual(str("MyLib:SOT-23-5"));
  });

  test("output round-trips (parse(serialize) stable)", () => {
    const out = buildSymbolLib([{ name: "AP2112K-3.3", kicadSymText: SAMPLE_SYM }], {});
    const once = parseSexpr(out);
    const twice = parseSexpr(serializeSexpr(once));
    expect(twice).toEqual(once);
  });
});

describe("footprint-lib — setFootprintModelPath", () => {
  test("rewrites an existing (model ...) path to ${KIPRJMOD}/3dmodels/<file>", () => {
    const out = setFootprintModelPath(
      SAMPLE_FP_WITH_MODEL,
      "${KIPRJMOD}/3dmodels/SOP65P640X120-8N.step",
    );
    const fp = parseSexpr(out);
    const model = findChild(fp, "model")!;
    if (!isList(model)) throw new Error("unreachable");
    expect(model.items[1]).toEqual(
      str("${KIPRJMOD}/3dmodels/SOP65P640X120-8N.step"),
    );
  });

  test("preserves existing offset/scale/rotate sub-nodes", () => {
    const out = setFootprintModelPath(
      SAMPLE_FP_WITH_MODEL,
      "${KIPRJMOD}/3dmodels/SOP65P640X120-8N.step",
    );
    expect(out).toContain("(offset (xyz 0 0 0))");
    expect(out).toContain("(scale (xyz 1 1 1))");
    expect(out).toContain("(rotate (xyz 0 0 0))");
  });

  test("inserts a (model ...) with default offset/scale/rotate when absent", () => {
    const out = setFootprintModelPath(
      SAMPLE_FP_NO_MODEL,
      "${KIPRJMOD}/3dmodels/R_0805.wrl",
    );
    const fp = parseSexpr(out);
    const model = findChild(fp, "model");
    expect(model).toBeDefined();
    if (!isList(model!)) throw new Error("unreachable");
    expect(model.items[1]).toEqual(str("${KIPRJMOD}/3dmodels/R_0805.wrl"));
    expect(out).toContain("(offset (xyz 0 0 0))");
    expect(out).toContain("(scale (xyz 1 1 1))");
    expect(out).toContain("(rotate (xyz 0 0 0))");
  });

  test("output round-trips structurally", () => {
    const out = setFootprintModelPath(
      SAMPLE_FP_WITH_MODEL,
      "${KIPRJMOD}/3dmodels/x.step",
    );
    const once = parseSexpr(out);
    expect(parseSexpr(serializeSexpr(once))).toEqual(once);
  });
});

describe("lib-tables — buildSymLibTable / buildFpLibTable", () => {
  test("buildSymLibTable emits a sym_lib_table with one row per entry (golden text)", () => {
    const out = buildSymLibTable([
      { nick: "wroom-breakout", file: "wroom-breakout.kicad_sym", descr: "Project symbols" },
    ]);
    expect(out).toBe(
      `(sym_lib_table
  (version 7)
  (lib (name "wroom-breakout")(type "KiCad")(uri "\${KIPRJMOD}/libs/wroom-breakout.kicad_sym")(options "")(descr "Project symbols"))
)
`,
    );
  });

  test("buildFpLibTable emits an fp_lib_table with one row per entry (golden text)", () => {
    const out = buildFpLibTable([
      { nick: "wroom-breakout", file: "wroom-breakout.pretty", descr: "Project footprints" },
    ]);
    expect(out).toBe(
      `(fp_lib_table
  (version 7)
  (lib (name "wroom-breakout")(type "KiCad")(uri "\${KIPRJMOD}/libs/wroom-breakout.pretty")(options "")(descr "Project footprints"))
)
`,
    );
  });

  test("emits multiple rows in order and defaults descr to empty", () => {
    const out = buildSymLibTable([
      { nick: "a", file: "a.kicad_sym" },
      { nick: "b", file: "b.kicad_sym" },
    ]);
    expect(out).toBe(
      `(sym_lib_table
  (version 7)
  (lib (name "a")(type "KiCad")(uri "\${KIPRJMOD}/libs/a.kicad_sym")(options "")(descr ""))
  (lib (name "b")(type "KiCad")(uri "\${KIPRJMOD}/libs/b.kicad_sym")(options "")(descr ""))
)
`,
    );
  });

  test("escapes quotes/backslashes in nick and descr", () => {
    const out = buildSymLibTable([
      { nick: `a"b`, file: "x.kicad_sym", descr: `c\\d` },
    ]);
    expect(out).toContain(`(name "a\\"b")`);
    expect(out).toContain(`(descr "c\\\\d")`);
  });
});
