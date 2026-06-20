import { describe, expect, test } from "vitest";
import { liveBomCost } from "@/lib/live-bom-cost";

describe("liveBomCost", () => {
  test("sums qty × dkUnitPriceCents over priced lines", () => {
    const r = liveBomCost([
      { quantity: 2, dkUnitPriceCents: 150 },
      { quantity: 5, dkUnitPriceCents: 10 },
    ]);
    expect(r.totalCents).toBe(350);
    expect(r.pricedCount).toBe(2);
    expect(r.unpricedCount).toBe(0);
    expect(r.anyPriced).toBe(true);
  });
  test("counts unpriced (null) lines and excludes them from the total", () => {
    const r = liveBomCost([
      { quantity: 2, dkUnitPriceCents: 150 },
      { quantity: 1, dkUnitPriceCents: null },
    ]);
    expect(r.totalCents).toBe(300);
    expect(r.unpricedCount).toBe(1);
  });
  test("no priced lines → anyPriced false (caller hides the total)", () => {
    const r = liveBomCost([{ quantity: 1, dkUnitPriceCents: null }]);
    expect(r.anyPriced).toBe(false);
    expect(r.totalCents).toBe(0);
  });
});
