// Tests for the All-Access Pass (bundle) grant path through the Stripe webhook.
//
// Two surfaces:
//   1. The PURE helper `bundleFromCheckoutSession(session)` — reads
//      metadata.kind === "bundle" + userId + bundleKey, else null.
//   2. The POST route handler's bundle branch: a paid bundle checkout records the
//      ProcessedStripeEvent (layer 1) and creates a bundle Entitlement exactly
//      once; a REDELIVERED event (P2002 on the dedupe insert) is a 200 no-op (no
//      double grant); an already-held bundle is not re-created (findFirst guard,
//      layer 2); an unknown bundleKey is acked without granting.
//
// Everything is mocked (no live Stripe, no Neon): @/lib/stripe, @/lib/db, @/env.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { bundleFromCheckoutSession } from "@/lib/stripe-webhook";

// --- Pure helper ----------------------------------------------------------

describe("bundleFromCheckoutSession (pure)", () => {
  test("returns { userId, bundleKey } for a bundle session", () => {
    const session = {
      metadata: { kind: "bundle", userId: "user_1", bundleKey: "all-access" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(bundleFromCheckoutSession(session)).toEqual({
      userId: "user_1",
      bundleKey: "all-access",
    });
  });

  test("returns null when kind is not 'bundle'", () => {
    const session = {
      metadata: { userId: "user_1", projectId: "proj_1" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(bundleFromCheckoutSession(session)).toBeNull();
  });

  test("returns null when userId or bundleKey is missing/empty", () => {
    const noUser = {
      metadata: { kind: "bundle", bundleKey: "all-access" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(bundleFromCheckoutSession(noUser)).toBeNull();
    const emptyKey = {
      metadata: { kind: "bundle", userId: "user_1", bundleKey: "" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(bundleFromCheckoutSession(emptyKey)).toBeNull();
  });
});

// --- Route handler --------------------------------------------------------

const {
  constructEvent,
  processedCreate,
  bundleFindUnique,
  entitlementFindFirst,
  entitlementCreate,
  fakeEnv,
} = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  processedCreate: vi.fn(),
  bundleFindUnique: vi.fn(),
  entitlementFindFirst: vi.fn(),
  entitlementCreate: vi.fn(),
  fakeEnv: {} as { STRIPE_WEBHOOK_SECRET?: string },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    processedStripeEvent: { create: (...a: unknown[]) => processedCreate(...a) },
    bundle: { findUnique: (...a: unknown[]) => bundleFindUnique(...a) },
    entitlement: {
      findFirst: (...a: unknown[]) => entitlementFindFirst(...a),
      create: (...a: unknown[]) => entitlementCreate(...a),
      // Unused on the bundle path, but the route imports the same db object.
      upsert: vi.fn(),
    },
    tip: { upsert: vi.fn() },
  },
}));

vi.mock("@/env", () => ({ env: fakeEnv }));

import { POST } from "@/app/api/stripe/webhook/route";

function makeRequest(body: string, headers: Record<string, string>): Request {
  return new Request("https://example.com/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

const SIG_HEADER = { "stripe-signature": "t=1,v1=deadbeef" };

const BUNDLE_EVENT = {
  id: "evt_bundle",
  type: "checkout.session.completed",
  data: {
    object: {
      payment_status: "paid",
      metadata: { kind: "bundle", userId: "user_1", bundleKey: "all-access" },
    },
  },
};

beforeEach(() => {
  constructEvent.mockReset();
  processedCreate.mockReset();
  bundleFindUnique.mockReset();
  entitlementFindFirst.mockReset();
  entitlementCreate.mockReset();
  fakeEnv.STRIPE_WEBHOOK_SECRET = "whsec_test";
  processedCreate.mockResolvedValue({ eventId: "evt_bundle" });
  bundleFindUnique.mockResolvedValue({ id: "bundle_1" });
  entitlementFindFirst.mockResolvedValue(null);
  entitlementCreate.mockResolvedValue({});
});

describe("POST /api/stripe/webhook — bundle (All-Access Pass) grant", () => {
  test("a paid bundle checkout records the event and creates the bundle entitlement once", async () => {
    constructEvent.mockReturnValue(BUNDLE_EVENT);

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(processedCreate).toHaveBeenCalledTimes(1);
    expect(bundleFindUnique).toHaveBeenCalledWith({
      where: { key: "all-access" },
      select: { id: true },
    });
    expect(entitlementCreate).toHaveBeenCalledTimes(1);
    expect(entitlementCreate).toHaveBeenCalledWith({
      data: { userId: "user_1", bundleId: "bundle_1", source: "PURCHASE" },
    });
  });

  test("a REDELIVERED bundle event (P2002 on dedupe) is a 200 no-op, no grant", async () => {
    constructEvent.mockReturnValue(BUNDLE_EVENT);
    processedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(entitlementCreate).not.toHaveBeenCalled();
  });

  test("an already-held bundle entitlement is NOT re-created (findFirst guard)", async () => {
    constructEvent.mockReturnValue(BUNDLE_EVENT);
    entitlementFindFirst.mockResolvedValue({ id: "ent_existing" });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // Layer 1 still claimed the (new) event, but no duplicate grant is written.
    expect(processedCreate).toHaveBeenCalledTimes(1);
    expect(entitlementCreate).not.toHaveBeenCalled();
  });

  test("an unknown bundleKey is acked (200) without granting", async () => {
    constructEvent.mockReturnValue(BUNDLE_EVENT);
    bundleFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(entitlementCreate).not.toHaveBeenCalled();
  });
});
