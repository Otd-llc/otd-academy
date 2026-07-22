// Unit tests for the pure billing-metrics aggregation (rows in, numbers out — no DB).
// Covers the empty-state / divide-by-zero paths explicitly, because zero volume is the
// DEFAULT reality until content ships + the sub program launches.
//
// Audit Phase 5 rewrote the shapes: MRR is subscriber-priced (each sub's stored
// priceCents/interval, annual ÷ 12, catalog fallback for pre-column rows),
// revenue is grouped per currency (never summed across currencies as if they
// were one unit), and the refund/dispute denominators are payments-inclusive.
import { describe, expect, test } from "vitest";
import {
  mrrByCurrency,
  activeSubCount,
  grossRevenueByCurrency,
  refundRate,
  disputeRate,
} from "@/lib/billing-metrics";

describe("mrrByCurrency", () => {
  test("sums each active sub's OWN price; annual divides by 12; grouped by currency", () => {
    const subs = [
      { status: "active", priceCents: 2900, interval: "month", currency: "usd" },
      { status: "active", priceCents: 2400, interval: "year", currency: "usd" }, // $2/mo
      { status: "trialing", priceCents: 1900, interval: "month", currency: "eur" },
      { status: "past_due", priceCents: 2900, interval: "month", currency: "usd" },
      { status: "canceled", priceCents: 2900, interval: "month", currency: "usd" },
    ];
    expect(mrrByCurrency(subs, 9900)).toEqual({ usd: 3100, eur: 1900 });
  });

  test("null priceCents falls back to the catalog price (pre-column rows)", () => {
    const subs = [
      { status: "active", priceCents: null, interval: null, currency: "usd" },
    ];
    expect(mrrByCurrency(subs, 2900)).toEqual({ usd: 2900 });
  });

  test("null price AND no catalog price → contributes nothing", () => {
    const subs = [
      { status: "active", priceCents: null, interval: null, currency: "usd" },
    ];
    expect(mrrByCurrency(subs, null)).toEqual({});
  });

  test("no active subs → empty", () => {
    expect(
      mrrByCurrency(
        [{ status: "canceled", priceCents: 2900, interval: "month", currency: "usd" }],
        2900,
      ),
    ).toEqual({});
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

describe("grossRevenueByCurrency", () => {
  test("purchases (net refunds) + paid invoices, grouped per currency", () => {
    const purchases = [
      { amountTotalCents: 4900, refundedCents: 0, currency: "usd" },
      { amountTotalCents: 8900, refundedCents: 1000, currency: "usd" },
      { amountTotalCents: 5000, refundedCents: 0, currency: "eur" },
    ];
    const invoices = [
      { amountPaidCents: 2900, currency: "usd" },
      { amountPaidCents: 2900, currency: "eur" },
    ];
    // usd: 4900 + 7900 + 2900 = 15700 · eur: 5000 + 2900 = 7900
    expect(grossRevenueByCurrency(purchases, invoices)).toEqual({
      usd: 15700,
      eur: 7900,
    });
  });

  test("empty → empty object", () => {
    expect(grossRevenueByCurrency([], [])).toEqual({});
  });
});

describe("refundRate", () => {
  test("purchase refunds / ALL payments (purchases + invoices)", () => {
    const purchases = [
      { amountTotalCents: 10000, refundedCents: 2500 },
      { amountTotalCents: 10000, refundedCents: 0 },
    ];
    const invoices = [{ amountPaidCents: 5000 }];
    // 2500 / 25000
    expect(refundRate(purchases, invoices)).toBeCloseTo(0.1);
  });

  test("no payment volume → 0 (no divide-by-zero)", () => {
    expect(refundRate([], [])).toBe(0);
    expect(refundRate([{ amountTotalCents: 0, refundedCents: 0 }], [])).toBe(0);
  });
});

describe("disputeRate", () => {
  test("disputes / ALL payments (purchases + invoices)", () => {
    expect(disputeRate(1, 2, 2)).toBe(0.25);
  });

  test("no payments → 0 (no divide-by-zero)", () => {
    expect(disputeRate(0, 0, 0)).toBe(0);
  });
});
