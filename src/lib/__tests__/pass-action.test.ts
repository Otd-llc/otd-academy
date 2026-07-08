// DB-layer tests for the pay-the-difference upgrade action
// (`createUpgradeCheckoutSession` in `src/lib/actions/pass.ts`). The action was
// previously untested at the DB layer; these lock in the GRANDFATHERING fix: the
// upgrade credit derives from what the learner actually PAID
// (`Purchase.amountTotalCents`, net of refunds) — NOT the current catalog price —
// and the zero-charge "already covered" grant records a $0 Purchase idempotently.
//
// Everything the action touches is mocked EXCEPT the pure pricing/credit math
// (`@/lib/pass-pricing`, `@/lib/pass-upgrade`), which runs for real so the credit
// derivation is genuinely exercised.
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  requireUser,
  bundleFindUnique,
  purchaseFindMany,
  entitlementUpsert,
  purchaseFindFirst,
  purchaseCreate,
  ensureStripeCustomer,
  sessionsCreate,
  siteUrl,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  bundleFindUnique: vi.fn(),
  purchaseFindMany: vi.fn(),
  entitlementUpsert: vi.fn(),
  purchaseFindFirst: vi.fn(),
  purchaseCreate: vi.fn(),
  ensureStripeCustomer: vi.fn(),
  sessionsCreate: vi.fn(),
  siteUrl: vi.fn(() => "https://academy.test"),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl }));
vi.mock("@/lib/stripe", () => ({
  ensureStripeCustomer,
  getStripe: () => ({
    checkout: { sessions: { create: (...a: unknown[]) => sessionsCreate(...a) } },
  }),
}));

// db.$transaction(cb) invokes the callback with a `tx` exposing the grant spies.
vi.mock("@/lib/db", () => {
  const tx = {
    entitlement: { upsert: (...a: unknown[]) => entitlementUpsert(...a) },
    purchase: {
      findFirst: (...a: unknown[]) => purchaseFindFirst(...a),
      create: (...a: unknown[]) => purchaseCreate(...a),
    },
  };
  return {
    db: {
      bundle: { findUnique: (...a: unknown[]) => bundleFindUnique(...a) },
      purchase: { findMany: (...a: unknown[]) => purchaseFindMany(...a) },
      $transaction: <T>(cb: (client: typeof tx) => Promise<T>) => cb(tx),
    },
  };
});

import {
  createUpgradeCheckoutSession,
  createSubscriptionCheckoutSession,
} from "@/lib/actions/pass";

// A sellable Pass at $399.00, no launch window (currentPassPriceId → priceCents),
// plus a recurring subscription price.
const SELLABLE_BUNDLE = {
  id: "bundle_1",
  key: "all-access",
  stripePriceId: "price_pass",
  priceCents: 39900,
  launchPriceCents: null,
  launchEndsAt: null,
  subscriptionPriceId: "price_sub",
  subscriptionPriceCents: 2900,
};

beforeEach(() => {
  requireUser.mockReset();
  bundleFindUnique.mockReset();
  purchaseFindMany.mockReset();
  entitlementUpsert.mockReset();
  purchaseFindFirst.mockReset();
  purchaseCreate.mockReset();
  ensureStripeCustomer.mockReset();
  sessionsCreate.mockReset();

  requireUser.mockResolvedValue({ id: "user_1" });
  bundleFindUnique.mockResolvedValue(SELLABLE_BUNDLE);
  ensureStripeCustomer.mockResolvedValue("cus_1");
  sessionsCreate.mockResolvedValue({ url: "https://stripe.test/checkout" });
  entitlementUpsert.mockResolvedValue({ id: "ent_1" });
  purchaseFindFirst.mockResolvedValue(null);
  purchaseCreate.mockResolvedValue({ id: "purch_1" });
});

describe("createUpgradeCheckoutSession — grandfathering credit", () => {
  test("credit derives from Purchase amounts; charges the difference", async () => {
    // $49 + $89 previously PAID → $138 credit against the $399 Pass → $261 charge.
    purchaseFindMany.mockResolvedValue([
      { amountTotalCents: 4900, refundedCents: 0 },
      { amountTotalCents: 8900, refundedCents: 0 },
    ]);

    const result = await createUpgradeCheckoutSession();

    // Credit is read from Purchase rows (what was paid), scoped to course purchases.
    expect(purchaseFindMany).toHaveBeenCalledWith({
      where: { userId: "user_1", projectId: { not: null } },
      select: { amountTotalCents: true, refundedCents: true },
    });
    // The checkout is created for the DIFFERENCE derived from those amounts.
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 26100 }),
          }),
        ],
      }),
    );
    expect(result).toEqual({ url: "https://stripe.test/checkout" });
    // Not covered → no direct grant.
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  test("a refund on a prior purchase reduces the credit (net amount)", async () => {
    // Paid $400 then fully refunded → net 0 credit → full $399 charged.
    purchaseFindMany.mockResolvedValue([
      { amountTotalCents: 40000, refundedCents: 40000 },
    ]);

    await createUpgradeCheckoutSession();

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 39900 }),
          }),
        ],
      }),
    );
  });

  test("credit covering the Pass grants directly + records a $0 Purchase, no checkout", async () => {
    // A single $399 purchase covers the $399 Pass → already covered.
    purchaseFindMany.mockResolvedValue([
      { amountTotalCents: 39900, refundedCents: 0 },
    ]);

    const result = await createUpgradeCheckoutSession();

    expect(result).toEqual({ granted: true });
    // Bundle entitlement granted idempotently via the [userId, bundleId] unique.
    expect(entitlementUpsert).toHaveBeenCalledWith({
      where: { userId_bundleId: { userId: "user_1", bundleId: "bundle_1" } },
      create: { userId: "user_1", bundleId: "bundle_1", source: "PURCHASE" },
      update: {},
    });
    // A $0 Purchase preserves the "every PURCHASE entitlement traces to a Purchase"
    // invariant (metadata carries our own ids only).
    expect(purchaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        bundleId: "bundle_1",
        entitlementId: "ent_1",
        amountTotalCents: 0,
        metadata: {
          kind: "upgrade-grant",
          userId: "user_1",
          bundleKey: "all-access",
        },
      }),
    });
    // No Stripe round-trip on a fully-covered upgrade.
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test("already-covered is idempotent: an existing $0 grant is not duplicated", async () => {
    purchaseFindMany.mockResolvedValue([
      { amountTotalCents: 50000, refundedCents: 0 },
    ]);
    // The $0 grant Purchase already exists (guard hits).
    purchaseFindFirst.mockResolvedValue({ id: "purch_existing" });

    const result = await createUpgradeCheckoutSession();

    expect(result).toEqual({ granted: true });
    // Entitlement upsert still runs (idempotent), but NO second $0 Purchase.
    expect(entitlementUpsert).toHaveBeenCalledTimes(1);
    expect(purchaseCreate).not.toHaveBeenCalled();
  });
});

describe("createSubscriptionCheckoutSession", () => {
  test("starts a mode:subscription checkout with the recurring price + userId metadata", async () => {
    const result = await createSubscriptionCheckoutSession();
    expect(result).toEqual({ url: "https://stripe.test/checkout" });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_sub", quantity: 1 }],
        subscription_data: { metadata: { userId: "user_1" } },
        metadata: {
          kind: "subscription",
          userId: "user_1",
          bundleKey: "all-access",
        },
      }),
    );
  });

  test("refuses when no recurring price is provisioned", async () => {
    bundleFindUnique.mockResolvedValue({
      ...SELLABLE_BUNDLE,
      subscriptionPriceId: null,
    });
    await expect(createSubscriptionCheckoutSession()).rejects.toThrow(
      /isn't available/i,
    );
  });
});
