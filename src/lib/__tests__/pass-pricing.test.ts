import { describe, it, expect } from "vitest";
import { passSellable } from "@/lib/pass-pricing";

// The All-Access Pass unlocks EVERY project (src/lib/entitlements.ts), so
// "provisioned in Stripe" is not the same question as "there is something to
// sell". These pin the third condition, which is the one that was missing.
describe("passSellable", () => {
  const now = new Date("2026-07-28T00:00:00Z");
  const provisioned = {
    stripePriceId: "price_123",
    priceCents: 39900,
    launchPriceCents: null,
    launchEndsAt: null,
  };

  it("is false with no published premium project, even fully provisioned", () => {
    expect(passSellable(provisioned, 0, now)).toBe(false);
  });

  it("is true when provisioned and at least one premium project is published", () => {
    expect(passSellable(provisioned, 1, now)).toBe(true);
  });

  it("is false without a Stripe price id", () => {
    expect(passSellable({ ...provisioned, stripePriceId: null }, 5, now)).toBe(false);
  });

  it("is false when no price resolves at `now`", () => {
    expect(passSellable({ ...provisioned, priceCents: null }, 5, now)).toBe(false);
  });

  it("is false when the bundle row does not exist", () => {
    expect(passSellable(null, 5, now)).toBe(false);
  });

  it("honours an open launch window as a resolved price", () => {
    expect(
      passSellable(
        {
          stripePriceId: "price_123",
          priceCents: null,
          launchPriceCents: 29900,
          launchEndsAt: new Date("2026-08-30T00:00:00Z"),
        },
        1,
        now,
      ),
    ).toBe(true);
  });
});
