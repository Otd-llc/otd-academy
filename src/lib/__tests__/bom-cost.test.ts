import { describe, expect, test } from "vitest";
import { bomCost, assessBomSourcing } from "@/lib/bom-cost";

const line = (over: Partial<{ quantity: number; unitPriceCents: number | null; lifecycle: string }>) => ({
  quantity: 1,
  unitPriceCents: 100,
  part: { lifecycle: (over.lifecycle ?? "ACTIVE") as never },
  ...over,
});

describe("bomCost", () => {
  test("sums qty × price; counts unpriced; compares to Decimal-dollar target", () => {
    const lines = [line({ quantity: 2, unitPriceCents: 150 }), line({ unitPriceCents: null })];
    const r = bomCost(lines, "2.50"); // targetCost is a Decimal serialized as dollars
    expect(r.totalCents).toBe(300);
    expect(r.unpricedCount).toBe(1);
    expect(r.targetCents).toBe(250);
    expect(r.overTarget).toBe(true);
  });

  test("null target → no overTarget", () => {
    const r = bomCost([line({})], null);
    expect(r.targetCents).toBeNull();
    expect(r.overTarget).toBe(false);
  });
});

describe("assessBomSourcing", () => {
  test("flags non-ACTIVE lifecycle (incl OBSOLETE), unpriced, over-target", () => {
    const { warnings } = assessBomSourcing(
      [line({ lifecycle: "OBSOLETE" }), line({ unitPriceCents: null })],
      "0.50",
    );
    const kinds = warnings.map((w) => w.kind).sort();
    expect(kinds).toContain("lifecycle");
    expect(kinds).toContain("unpriced");
    expect(kinds).toContain("over-target");
  });

  test("clean BOM → no warnings", () => {
    expect(assessBomSourcing([line({})], "10.00").warnings).toEqual([]);
  });
});
