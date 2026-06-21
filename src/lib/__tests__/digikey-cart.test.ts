import { describe, expect, test } from "vitest";
import { buildFastAddUrl } from "@/lib/digikey-cart";

describe("buildFastAddUrl", () => {
  test("maps BOM lines to FastAdd part/qty/cref params + utm_source", () => {
    const url = buildFastAddUrl(
      [
        { dkPartNumber: "311-10.0KCRCT-ND", quantity: 2, refDes: "R1,R2" },
        { dkPartNumber: "1028-1509-1-ND", quantity: 1, refDes: "U2" },
      ],
      { utmSource: "otd-academy" },
    );
    expect(url).not.toBeNull();
    const u = new URL(url!);
    expect(u.origin + u.pathname).toBe(
      "https://www.digikey.com/classic/ordering/fastadd.aspx",
    );
    expect(u.searchParams.get("part1")).toBe("311-10.0KCRCT-ND");
    expect(u.searchParams.get("qty1")).toBe("2");
    expect(u.searchParams.get("cref1")).toBe("R1,R2");
    expect(u.searchParams.get("part2")).toBe("1028-1509-1-ND");
    expect(u.searchParams.get("qty2")).toBe("1");
    expect(u.searchParams.get("cref2")).toBe("U2");
    expect(u.searchParams.get("utm_source")).toBe("otd-academy");
  });

  test("skips lines with no DigiKey part number and renumbers the rest", () => {
    const url = buildFastAddUrl([
      { dkPartNumber: null, quantity: 3, refDes: "X1" },
      { dkPartNumber: "F2112CT-ND", quantity: 1, refDes: "F1" },
    ]);
    const u = new URL(url!);
    // The unmatched line is dropped; the matched one becomes part1 (not part2).
    expect(u.searchParams.get("part1")).toBe("F2112CT-ND");
    expect(u.searchParams.has("part2")).toBe(false);
  });

  test("returns null when no line has a DigiKey part number", () => {
    expect(
      buildFastAddUrl([{ dkPartNumber: null, quantity: 1, refDes: "X1" }]),
    ).toBeNull();
  });

  test("skips qty <= 0 and non-integer qty lines (cart + cost safety)", () => {
    const url = buildFastAddUrl([
      { dkPartNumber: "A-ND", quantity: 0, refDes: "C1" },
      { dkPartNumber: "B-ND", quantity: -1, refDes: "C2" },
      { dkPartNumber: "C-ND", quantity: 1.5, refDes: "C3" },
      { dkPartNumber: "D-ND", quantity: 2, refDes: "C4" },
    ]);
    const u = new URL(url!);
    expect(u.searchParams.get("part1")).toBe("D-ND"); // only the valid line, renumbered to 1
    expect(u.searchParams.has("part2")).toBe(false);
  });

  test("large BOM stays under the URL ceiling by dropping WHOLE lines (never truncating a param)", () => {
    const lines = Array.from({ length: 80 }, (_, i) => ({
      dkPartNumber: `2345-PARTNUMBER-${String(i).padStart(4, "0")}-ND`,
      quantity: i + 1,
      refDes: `U${i},V${i},W${i}`,
    }));
    const url = buildFastAddUrl(lines)!;
    expect(url).not.toBeNull();
    expect(url.length).toBeLessThanOrEqual(1700);

    // Parses cleanly (no value cut mid-%-escape) and every partN has a matching
    // qtyN — i.e. no line was split; whole lines were dropped instead.
    const u = new URL(url);
    const nums = [...u.searchParams.keys()]
      .filter((k) => k.startsWith("part"))
      .map((k) => Number(k.slice(4)));
    expect(nums.length).toBeGreaterThan(0);
    for (const n of nums) {
      expect(u.searchParams.get(`part${n}`)).toMatch(/^2345-PARTNUMBER-\d{4}-ND$/); // value intact, not truncated
      expect(u.searchParams.get(`qty${n}`)).not.toBeNull();
    }
    // Contiguous part1..partN, and fewer than all 80 fit (so lines were dropped).
    const max = Math.max(...nums);
    expect(max).toBeLessThan(80);
    expect(new Set(nums).size).toBe(max); // 1..max with no gaps
  });
});
