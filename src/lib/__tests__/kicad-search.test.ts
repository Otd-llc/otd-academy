// Tests for the pg_trgm-ranked KiCad search actions (Phase C, Task 6). Real DB:
// throwaway rows under a Date.now()-suffixed lib, swept in afterAll.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";
import { searchKicadSymbols, searchKicadFootprints } from "@/lib/actions/kicad-search";

const STAMP = Date.now();
const LIB = `KS${STAMP}`;
const LIB2 = `KS2${STAMP}`;
const FPLIB = `KF${STAMP}`;

beforeAll(async () => {
  await db.kicadLibSymbol.createMany({
    data: [
      { libId: `${LIB}:R`, lib: LIB, name: "R", keywords: "resistor" },
      { libId: `${LIB}:R_Pack04`, lib: LIB, name: "R_Pack04", keywords: "resistor network" },
      { libId: `${LIB}:Regulator_Linear`, lib: LIB, name: "Regulator_Linear", keywords: "ldo" },
      { libId: `${LIB}:Capacitor_SMD`, lib: LIB, name: "Capacitor_SMD", keywords: "cap" },
      { libId: `${LIB2}:R`, lib: LIB2, name: "R", keywords: "resistor" },
    ],
  });
  await db.kicadLibFootprint.createMany({
    data: [
      { libId: `${FPLIB}:R_0805`, lib: FPLIB, name: "R_0805", description: "resistor 0805", tags: "resistor", padCount: 2 },
      { libId: `${FPLIB}:R_0603`, lib: FPLIB, name: "R_0603", description: "resistor 0603", tags: "resistor", padCount: 2 },
    ],
  });
});

afterAll(async () => {
  await db.kicadLibSymbol.deleteMany({ where: { lib: { in: [LIB, LIB2] } } }).catch(() => {});
  await db.kicadLibFootprint.deleteMany({ where: { lib: FPLIB } }).catch(() => {});
});

describe("searchKicadSymbols", () => {
  test("a 1-char name is found via the prefix path (trigram alone misses it) and ranks exact-first", async () => {
    const r = await searchKicadSymbols({ q: "R", lib: LIB });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].name).toBe("R"); // exact match first
    expect(r.map((x) => x.name)).toContain("R_Pack04"); // prefix sibling
  });

  test("the lib filter scopes results", async () => {
    const r = await searchKicadSymbols({ q: "R", lib: LIB2 });
    expect(r.every((x) => x.lib === LIB2)).toBe(true);
    expect(r.some((x) => x.name === "R")).toBe(true);
    expect(r.some((x) => x.name === "R_Pack04")).toBe(false); // that lives in LIB
  });

  test("take caps the result count", async () => {
    const r = await searchKicadSymbols({ q: "R", lib: LIB, take: 1 });
    expect(r).toHaveLength(1);
  });

  test("a typo in a full name is caught by trigram (no prefix match)", async () => {
    const r = await searchKicadSymbols({ q: "Regulatr_Linear", lib: LIB });
    expect(r.some((x) => x.name === "Regulator_Linear")).toBe(true);
  });
});

describe("searchKicadFootprints", () => {
  test("finds footprints exact-first and filters by lib", async () => {
    const r = await searchKicadFootprints({ q: "R_0805", lib: FPLIB });
    expect(r[0].name).toBe("R_0805");
    expect(r.every((x) => x.lib === FPLIB)).toBe(true);
  });

  test("fpFilters narrows results to the symbol's glob patterns", async () => {
    const r = await searchKicadFootprints({ q: "R", lib: FPLIB, fpFilters: "R_0603*" });
    const names = r.map((x) => x.name);
    expect(names).toContain("R_0603");
    expect(names).not.toContain("R_0805"); // glob R_0603* excludes it
  });

  test("multiple fpFilters globs are OR'd; '_' in a glob is literal", async () => {
    const r = await searchKicadFootprints({ q: "R", lib: FPLIB, fpFilters: "R_0805* C_*" });
    const names = r.map((x) => x.name);
    expect(names).toContain("R_0805");
    expect(names).not.toContain("R_0603"); // matches neither glob
  });

  test("empty/absent fpFilters imposes no glob constraint", async () => {
    const names = (await searchKicadFootprints({ q: "R", lib: FPLIB })).map((x) => x.name);
    expect(names).toContain("R_0805");
    expect(names).toContain("R_0603");
  });
});
