// Tests for the layered async symbol resolver (Phase C, Task 5):
// committed JSON → KicadSymbolDefCache → R2 fetch + flatten + cache.
// Real `db` (throwaway cache rows, swept in afterAll); `@/lib/part-r2` mocked.
import { afterAll, describe, expect, test, vi } from "vitest";

const { mockGetR2 } = vi.hoisted(() => ({
  mockGetR2: vi.fn<(key: string) => Promise<string>>(),
}));
vi.mock("@/lib/part-r2", () => ({
  getR2ObjectText: (key: string) => mockGetR2(key),
}));

import { db } from "@/lib/db";
import standardSymbols from "@/lib/kicad/vendor/standard-symbols.json";
import {
  resolveVendoredSymbol,
  vendoredSymbolIds,
} from "@/lib/kicad/vendor-symbols";

const DEFS = standardSymbols as Record<string, string>;
const STAMP = Date.now();
const cacheIds: string[] = [];

afterAll(async () => {
  if (cacheIds.length > 0) {
    await db.kicadSymbolDefCache
      .deleteMany({ where: { libId: { in: cacheIds } } })
      .catch(() => {});
  }
});

describe("resolveVendoredSymbol", () => {
  test("committed-snapshot hit returns the JSON def (no R2 fetch)", async () => {
    const ids = vendoredSymbolIds();
    if (ids.length === 0) return; // nothing committed to assert against
    mockGetR2.mockClear();
    expect(await resolveVendoredSymbol(ids[0])).toBe(DEFS[ids[0]]);
    expect(mockGetR2).not.toHaveBeenCalled();
  });

  test("cache hit returns the cached text (no R2 fetch)", async () => {
    const libId = `TestCache${STAMP}:X`;
    cacheIds.push(libId);
    await db.kicadSymbolDefCache.create({
      data: { libId, text: "CACHED_TEXT", version: "test" },
    });
    mockGetR2.mockClear();
    expect(await resolveVendoredSymbol(libId)).toBe("CACHED_TEXT");
    expect(mockGetR2).not.toHaveBeenCalled();
  });

  test("miss → fetch from R2, flatten, and cache the def", async () => {
    const lib = `TestLib${STAMP}`;
    const libId = `${lib}:MyDerived`;
    cacheIds.push(libId);
    mockGetR2.mockResolvedValueOnce(`(kicad_symbol_lib
      (version 20211014)
      (symbol "Base" (property "Value" "Base") (symbol "Base_0_1" (rectangle (start -1 1) (end 1 -1))))
      (symbol "MyDerived" (extends "Base") (property "Value" "MyDerived"))
    )`);

    const text = await resolveVendoredSymbol(libId);
    expect(text).toBeDefined();
    expect(text).toContain("MyDerived");
    expect(text).toContain("rectangle"); // base graphics carried over
    expect(text).not.toContain("extends"); // flattened
    expect(mockGetR2).toHaveBeenCalledWith(`kicad/symbols/10.0/${lib}.kicad_sym`);

    const row = await db.kicadSymbolDefCache.findUnique({ where: { libId } });
    expect(row?.text).toBe(text);
    expect(row?.version).toBe("10.0");
  });

  test("miss with no R2 object returns undefined (caller falls back to stub)", async () => {
    mockGetR2.mockRejectedValueOnce(new Error("NoSuchKey"));
    expect(await resolveVendoredSymbol(`Nope${STAMP}:Z`)).toBeUndefined();
  });
});
