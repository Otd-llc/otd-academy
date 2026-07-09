// Unit tests for the pure billing-metrics aggregation (rows in, numbers out — no DB).
// Covers the empty-state / divide-by-zero paths explicitly, because zero volume is the
// DEFAULT reality until content ships + the sub program launches.
import { describe, expect, test } from "vitest";
import {
  mrrCents,
  activeSubCount,
  grossRevenueCents,
  refundRate,
  disputeRate,
} from "@/lib/billing-metrics";

describe("mrrCents", () => {
  test("counts only active/trialing subs × the monthly price", () => {
    const subs = [
      { status: "active" },
      { status: "trialing" },
      { status: "past_due" },
      { status: "canceled" },
    ];
    expect(mrrCents(subs, 2900)).toBe(5800); // 2 recurring × $29
  });

  test("no price provisioned → 0", () => {
    expect(mrrCents([{ status: "active" }], null)).toBe(0);
  });

  test("no active subs → 0", () => {
    expect(mrrCents([{ status: "canceled" }], 2900)).toBe(0);
  });
});

describe("activeSubCount", () => {
  test("counts active + trialing only", () => {
    expect(
      activeSubCount([
        { status: "active" },
        { status: "trialing" },
        { status: "unpaid" },
      ]),
    ).toBe(2);
  });
});

describe("grossRevenueCents", () => {
  test("purchases (net refunds) + paid invoices, disjoint", () => {
    const purchases = [
      { amountTotalCents: 4900, refundedCents: 0 },
      { amountTotalCents: 8900, refundedCents: 1000 },
    ];
    const invoices = [{ amountPaidCents: 2900 }, { amountPaidCents: 2900 }];
    // (4900) + (8900-1000) + 2900 + 2900 = 18600
    expect(grossRevenueCents(purchases, invoices)).toBe(18600);
  });

  test("empty → 0", () => {
    expect(grossRevenueCents([], [])).toBe(0);
  });
});

describe("refundRate", () => {
  test("refunded / gross", () => {
    expect(
      refundRate([
        { amountTotalCents: 10000, refundedCents: 2500 },
        { amountTotalCents: 10000, refundedCents: 0 },
      ]),
    ).toBeCloseTo(0.125);
  });

  test("no purchase volume → 0 (no divide-by-zero)", () => {
    expect(refundRate([])).toBe(0);
    expect(refundRate([{ amountTotalCents: 0, refundedCents: 0 }])).toBe(0);
  });
});

describe("disputeRate", () => {
  test("disputes / purchases", () => {
    expect(disputeRate(1, 4)).toBe(0.25);
  });

  test("no purchases → 0 (no divide-by-zero)", () => {
    expect(disputeRate(0, 0)).toBe(0);
  });
});
