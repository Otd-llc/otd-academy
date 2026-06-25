// Unit tests for the pay-the-difference (Pass upgrade) math + the Pass-pricing
// window helper. Both are PURE (no db, no Stripe), so these run with no mocks.
import { describe, expect, test } from "vitest";

import { upgradeCreditCents, quoteUpgrade } from "@/lib/pass-upgrade";
import { currentPassPriceId, isLaunchActive } from "@/lib/pass-pricing";

describe("upgradeCreditCents", () => {
  test("sums the purchased project prices", () => {
    expect(upgradeCreditCents([4900, 8900, 14900])).toBe(28700);
  });

  test("ignores null / undefined / non-positive prices", () => {
    expect(upgradeCreditCents([4900, null, undefined, 0, -100, 8900])).toBe(
      13800,
    );
  });

  test("an empty purchase set yields zero credit", () => {
    expect(upgradeCreditCents([])).toBe(0);
  });
});

describe("quoteUpgrade", () => {
  const PASS = 39900;

  test("charges the difference when the credit is below the Pass price", () => {
    const q = quoteUpgrade(PASS, [4900, 8900]); // 13800 credit
    expect(q.creditCents).toBe(13800);
    expect(q.chargeCents).toBe(39900 - 13800);
    expect(q.alreadyCovered).toBe(false);
  });

  test("a learner with no purchases pays the full Pass price", () => {
    const q = quoteUpgrade(PASS, []);
    expect(q.creditCents).toBe(0);
    expect(q.chargeCents).toBe(PASS);
    expect(q.alreadyCovered).toBe(false);
  });

  test("credit EQUAL to the Pass price is already covered (charge 0)", () => {
    const q = quoteUpgrade(PASS, [14900, 14900, 8900, 1200]); // 39900
    expect(q.chargeCents).toBe(0);
    expect(q.alreadyCovered).toBe(true);
    // The applied credit is capped at the Pass price (never negative charge).
    expect(q.creditCents).toBe(PASS);
  });

  test("credit OVER the Pass price is already covered and the charge floors at 0", () => {
    const q = quoteUpgrade(PASS, [14900, 14900, 14900]); // 44700 > 39900
    expect(q.chargeCents).toBe(0);
    expect(q.alreadyCovered).toBe(true);
    expect(q.creditCents).toBe(PASS); // capped, not 44700
  });
});

describe("currentPassPriceId (Pass-pricing window)", () => {
  const ENDS = new Date("2026-08-01T00:00:00Z");
  const bundle = {
    priceCents: 39900,
    launchPriceCents: 29900,
    launchEndsAt: ENDS,
  };

  test("returns the launch price while the window is open", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    expect(currentPassPriceId(bundle, now)).toBe(29900);
    expect(isLaunchActive(bundle, now)).toBe(true);
  });

  test("returns the standard price once the window has closed", () => {
    const now = new Date("2026-08-02T00:00:00Z");
    expect(currentPassPriceId(bundle, now)).toBe(39900);
    expect(isLaunchActive(bundle, now)).toBe(false);
  });

  test("at the exact end instant the launch price no longer applies", () => {
    expect(currentPassPriceId(bundle, ENDS)).toBe(39900);
  });

  test("with no launch price configured, always the standard price", () => {
    const noLaunch = {
      priceCents: 39900,
      launchPriceCents: null,
      launchEndsAt: null,
    };
    expect(currentPassPriceId(noLaunch, new Date("2026-07-15T00:00:00Z"))).toBe(
      39900,
    );
  });

  test("returns null when no standard price is configured (not for sale)", () => {
    const unset = {
      priceCents: null,
      launchPriceCents: null,
      launchEndsAt: null,
    };
    expect(currentPassPriceId(unset, new Date())).toBeNull();
  });
});
