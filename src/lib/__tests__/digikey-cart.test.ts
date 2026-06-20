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
});
