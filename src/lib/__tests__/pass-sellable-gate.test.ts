// The All-Access Pass unlocks EVERY project (@/lib/entitlements), so selling it
// with nothing published charges for an empty catalog. These pin the refusal at
// the SERVER, not at the button: all three checkout actions are directly
// callable by any signed-in user, so hiding the CTA is not a gate.
//
// vi.hoisted is load-bearing: vi.mock factories are hoisted above the imports,
// so plain consts declared below would be in the temporal dead zone when a
// factory runs.
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  counts,
  requireUser,
  bundleFindUnique,
  purchaseFindMany,
  countPublishedPremiumProjects,
  enforceCheckoutLimit,
  ensureStripeCustomer,
  getStripe,
  siteUrl,
} = vi.hoisted(() => {
  const counts = { premium: 0 };
  const bundleRow = {
    id: "bundle_1",
    key: "all-access",
    stripePriceId: "price_123",
    priceCents: 39900,
    launchPriceCents: null as number | null,
    launchEndsAt: null as Date | null,
    subscriptionPriceId: "price_sub_123",
  };
  return {
    counts,
    requireUser: vi.fn(async () => ({ id: "u1", email: "a@b.c" })),
    bundleFindUnique: vi.fn(async () => bundleRow),
    // Surplus but harmless: createUpgradeCheckoutSession reads purchase.findMany
    // AFTER loadSellablePass, so the gate throws first. Kept so the mock stays
    // complete if that ordering ever changes.
    purchaseFindMany: vi.fn(async () => []),
    countPublishedPremiumProjects: vi.fn(async () => counts.premium),
    enforceCheckoutLimit: vi.fn(async () => {}),
    ensureStripeCustomer: vi.fn(async () => "cus_1"),
    getStripe: vi.fn(() => {
      throw new Error("Stripe must not be reached when the Pass is not sellable");
    }),
    siteUrl: vi.fn(() => "https://academy.test"),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    bundle: { findUnique: bundleFindUnique },
    purchase: { findMany: purchaseFindMany },
  },
}));
vi.mock("@/lib/premium-catalog", () => ({ countPublishedPremiumProjects }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/abuse-checkout", () => ({ enforceCheckoutLimit }));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl }));
vi.mock("@/lib/stripe", () => ({ ensureStripeCustomer, getStripe }));

import {
  createPassCheckoutSession,
  createUpgradeCheckoutSession,
  createSubscriptionCheckoutSession,
} from "@/lib/actions/pass";

describe("Pass checkout refuses with no published premium content", () => {
  beforeEach(() => {
    counts.premium = 0;
  });

  it("createPassCheckoutSession throws before touching Stripe", async () => {
    await expect(createPassCheckoutSession()).rejects.toThrow(/isn't available yet/i);
  });

  // The upgrade's "already covered" branch grants the bundle entitlement
  // DIRECTLY with no Stripe round-trip, so gating only at the Stripe call would
  // miss it entirely. The gate lives in loadSellablePass for this reason.
  it("createUpgradeCheckoutSession throws before touching Stripe", async () => {
    await expect(createUpgradeCheckoutSession()).rejects.toThrow(/isn't available yet/i);
  });

  it("createSubscriptionCheckoutSession throws before touching Stripe", async () => {
    await expect(createSubscriptionCheckoutSession()).rejects.toThrow(
      /isn't available yet/i,
    );
  });
});

// Every other assertion here proves the gate REFUSES. Without this one, a gate
// that refuses unconditionally would look perfect and the first execution of the
// happy path would be a paying customer.
describe("Pass checkout proceeds once premium content is published", () => {
  beforeEach(() => {
    counts.premium = 1;
  });

  it("createPassCheckoutSession reaches Stripe", async () => {
    // The mocked getStripe throws a recognisable sentinel, so reaching it proves
    // the gate opened without needing a full Stripe session double.
    await expect(createPassCheckoutSession()).rejects.toThrow(
      /Stripe must not be reached/i,
    );
    expect(countPublishedPremiumProjects).toHaveBeenCalled();
  });
});
