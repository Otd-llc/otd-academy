// Pure tests for the KiCad symbol extends-chain flattener (Phase C, extracted
// from scripts/vendor-kicad-symbols.ts).
import { describe, it, expect } from "vitest";

import { parseSexpr, serializeSexpr, findChild, findChildren, isStr, type SList } from "@/lib/kicad/sexpr";
import { flattenSymbol, symbolByName } from "@/lib/kicad/flatten";

const LIB = parseSexpr(`(kicad_symbol_lib
  (version 20211014)
  (symbol "Base"
    (property "Reference" "U" (at 0 0 0))
    (property "Value" "Base" (at 0 0 0))
    (symbol "Base_0_1"
      (rectangle (start -2 2) (end 2 -2))
    )
  )
  (symbol "Derived"
    (extends "Base")
    (property "Value" "Derived" (at 0 0 0))
  )
)`) as SList;

function propValue(symbol: SList, name: string): string | undefined {
  const p = findChildren(symbol, "property").find(
    (n) => isStr(n.items[1]) && n.items[1].value === name,
  );
  return p && isStr(p.items[2]) ? p.items[2].value : undefined;
}

describe("flattenSymbol", () => {
  it("returns a self-contained symbol unchanged (no extends)", () => {
    const base = flattenSymbol(LIB, "Base");
    expect(serializeSexpr(base)).toBe(serializeSexpr(symbolByName(LIB, "Base")!));
    expect(findChild(base, "extends")).toBeUndefined();
  });

  it("flattens a derived symbol: base body + override, renamed, no extends", () => {
    const d = flattenSymbol(LIB, "Derived");
    // Renamed parent + no extends.
    expect(isStr(d.items[1]) && (d.items[1] as { value: string }).value).toBe("Derived");
    expect(findChild(d, "extends")).toBeUndefined();
    // Override applied; non-overridden property inherited from the base.
    expect(propValue(d, "Value")).toBe("Derived");
    expect(propValue(d, "Reference")).toBe("U");
    // Unit sub-symbol carried over AND renamed to the derived prefix.
    const unit = findChildren(d, "symbol")[0];
    expect(isStr(unit.items[1]) && (unit.items[1] as { value: string }).value).toBe("Derived_0_1");
  });

  it("throws on an extends cycle", () => {
    const cyclic = parseSexpr(
      `(kicad_symbol_lib (symbol "A" (extends "B")) (symbol "B" (extends "A")))`,
    ) as SList;
    expect(() => flattenSymbol(cyclic, "A")).toThrow(/cycle/i);
  });

  it("throws when the symbol is not found", () => {
    expect(() => flattenSymbol(LIB, "Nope")).toThrow(/not found/i);
  });
});
