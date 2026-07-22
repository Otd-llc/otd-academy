// Tests for the Stripe webhook (A4) — the SECURITY-CRITICAL grant path. Surfaces:
//
//   1. The PURE helpers in `@/lib/stripe-webhook`:
//        - `entitlementFromCheckoutSession` — reads metadata.userId/projectId.
//        - `tipFromCheckoutSession` — reads a "tip" session's amount (from Stripe).
//        - `purchaseFromCheckoutSession` — the Purchase audit fields, with the
//          amount_total null-guard and expandable-id normalization.
//
//   2. The POST route handler (`src/app/api/stripe/webhook/route.ts`). The webhook
//      is the ONLY thing that grants a purchase, so we assert:
//        - missing signature / secret / bad signature → 400
//        - a paid course session → claims, grants the entitlement, AND records the
//          Purchase (in one transaction) → 200
//        - a paid Pass (bundle) session → grants via the [userId,bundleId] unique +
//          records the Purchase → 200
//        - a paid session with a null amount_total → grants but records NO Purchase
//        - a REDELIVERED event (claim → P2002) → 200 no-op, no grant, no Purchase
//        - a tip / missing-metadata / unpaid / unrelated event → 200, no grant
//
// The route wraps its claim + grant + Purchase writes in `db.$transaction(cb)`, so
// the `@/lib/db` mock models `$transaction` by invoking the callback with a `tx`
// exposing the same spies (finding 18); a rejected spy rejects the callback exactly
// as a real aborted transaction would, so the route's OUTER P2002 catch is exercised.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  entitlementFromCheckoutSession,
  purchaseFromCheckoutSession,
  tipFromCheckoutSession,
} from "@/lib/stripe-webhook";

// Cast a plain object to a Checkout Session for the pure-helper tests (no db, no
// Stripe) without pulling the full Stripe type shape into every fixture.
const S = (o: Record<string, unknown>) =>
  o as unknown as import("stripe").Stripe.Checkout.Session;

// --- Pure helpers ---------------------------------------------------------

describe("entitlementFromCheckoutSession (pure)", () => {
  test("returns { userId, projectId } when both metadata fields are present", () => {
    expect(
      entitlementFromCheckoutSession(
        S({ metadata: { userId: "user_1", projectId: "proj_1" } }),
      ),
    ).toEqual({ userId: "user_1", projectId: "proj_1" });
  });

  test("returns null when userId is missing", () => {
    expect(
      entitlementFromCheckoutSession(S({ metadata: { projectId: "proj_1" } })),
    ).toBeNull();
  });

  test("returns null when projectId is missing", () => {
    expect(
      entitlementFromCheckoutSession(S({ metadata: { userId: "user_1" } })),
    ).toBeNull();
  });

  test("returns null when metadata is absent entirely", () => {
    expect(entitlementFromCheckoutSession(S({}))).toBeNull();
  });

  test("returns null when a field is the empty string", () => {
    expect(
      entitlementFromCheckoutSession(
        S({ metadata: { userId: "", projectId: "proj_1" } }),
      ),
    ).toBeNull();
  });
});

describe("tipFromCheckoutSession (pure)", () => {
  const base = {
    id: "cs_tip_1",
    amount_total: 500,
    currency: "usd",
    customer_details: { email: "fan@example.com" },
  };

  test("returns the tip record for a signed-in tip (amount from Stripe)", () => {
    expect(
      tipFromCheckoutSession(S({ ...base, metadata: { kind: "tip", userId: "user_1" } })),
    ).toEqual({
      stripeSessionId: "cs_tip_1",
      userId: "user_1",
      email: "fan@example.com",
      amountCents: 500,
      currency: "usd",
    });
  });

  test("returns a guest tip (userId null) when no userId metadata", () => {
    expect(
      tipFromCheckoutSession(S({ ...base, metadata: { kind: "tip" } }))?.userId,
    ).toBeNull();
  });

  test("returns null when kind is not 'tip'", () => {
    expect(
      tipFromCheckoutSession(
        S({ ...base, metadata: { userId: "user_1", projectId: "proj_1" } }),
      ),
    ).toBeNull();
  });

  test("returns null when amount_total is missing or non-positive", () => {
    expect(
      tipFromCheckoutSession(S({ ...base, amount_total: 0, metadata: { kind: "tip" } })),
    ).toBeNull();
  });
});

describe("purchaseFromCheckoutSession (pure)", () => {
  const paid = {
    id: "cs_1",
    mode: "payment",
    amount_total: 4900,
    currency: "usd",
    payment_intent: "pi_1",
    customer: "cus_1",
    total_details: { amount_discount: 0 },
    metadata: { userId: "user_1", projectId: "proj_1", stripePriceId: "price_1" },
  };

  test("extracts the audit fields from a paid session", () => {
    expect(purchaseFromCheckoutSession(S(paid))).toEqual({
      stripeSessionId: "cs_1",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: null,
      stripeCustomerId: "cus_1",
      stripePriceId: "price_1",
      stripeProductId: null,
      amountTotalCents: 4900,
      amountDiscountCents: 0,
      stripePromotionCodeId: null,
      currency: "usd",
      // Fixture has no livemode field → defaults true (real sessions stamp it).
      livemode: true,
      metadata: { userId: "user_1", projectId: "proj_1", stripePriceId: "price_1" },
    });
  });

  test("returns null when amount_total is null (the anomaly guard)", () => {
    expect(purchaseFromCheckoutSession(S({ ...paid, amount_total: null }))).toBeNull();
  });

  test("normalizes expanded payment_intent / customer objects to their ids", () => {
    const f = purchaseFromCheckoutSession(
      S({ ...paid, payment_intent: { id: "pi_exp" }, customer: { id: "cus_exp" } }),
    );
    expect(f?.stripePaymentIntentId).toBe("pi_exp");
    expect(f?.stripeCustomerId).toBe("cus_exp");
  });

  test("stripePriceId is null when metadata omits it (Pass/upgrade inline price_data)", () => {
    const f = purchaseFromCheckoutSession(
      S({ ...paid, metadata: { kind: "bundle", userId: "user_1", bundleKey: "all-access" } }),
    );
    expect(f?.stripePriceId).toBeNull();
  });

  test("amount_discount defaults to 0 when total_details is absent", () => {
    const noDetails = { ...paid };
    delete (noDetails as { total_details?: unknown }).total_details;
    expect(purchaseFromCheckoutSession(S(noDetails))?.amountDiscountCents).toBe(0);
  });
});

// --- Route handler --------------------------------------------------------

// The route is imported statically, so its dependency mocks must already be in
// place when the module loads. `vi.mock` is hoisted ABOVE these declarations, so
// the mutable spies/env they close over live in a `vi.hoisted` block (also hoisted)
// to avoid the temporal-dead-zone error on first import.
const {
  constructEvent,
  processedCreate,
  entitlementUpsert,
  tipUpsert,
  bundleFindUnique,
  purchaseCreate,
  fakeEnv,
} = vi.hoisted(() => ({
  // constructEvent is the signature-verifier; the route is only as trustworthy as
  // this call, so the mock lets each test drive it (return a parsed event, or throw
  // to simulate a bad signature).
  constructEvent: vi.fn(),
  processedCreate: vi.fn(),
  entitlementUpsert: vi.fn(),
  tipUpsert: vi.fn(),
  bundleFindUnique: vi.fn(),
  purchaseCreate: vi.fn(),
  // Mutable env so tests can set/unset STRIPE_WEBHOOK_SECRET.
  fakeEnv: {} as { STRIPE_WEBHOOK_SECRET?: string },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

// db.$transaction(cb) invokes the callback with a `tx` exposing the same spies the
// assertions read. A rejected spy (e.g. the P2002 claim) rejects the callback, so
// the route's outer catch runs — modelling a real aborted transaction.
vi.mock("@/lib/db", () => {
  const tx = {
    processedStripeEvent: { create: (...a: unknown[]) => processedCreate(...a) },
    tip: { upsert: (...a: unknown[]) => tipUpsert(...a) },
    bundle: { findUnique: (...a: unknown[]) => bundleFindUnique(...a) },
    entitlement: { upsert: (...a: unknown[]) => entitlementUpsert(...a) },
    purchase: { create: (...a: unknown[]) => purchaseCreate(...a) },
  };
  return {
    db: {
      $transaction: <T>(cb: (client: typeof tx) => Promise<T>) => cb(tx),
    },
  };
});

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

beforeEach(() => {
  constructEvent.mockReset();
  processedCreate.mockReset();
  entitlementUpsert.mockReset();
  tipUpsert.mockReset();
  bundleFindUnique.mockReset();
  purchaseCreate.mockReset();
  fakeEnv.STRIPE_WEBHOOK_SECRET = "whsec_test";
  processedCreate.mockResolvedValue({ eventId: "evt_1" });
  // The route reads `entitlement.id` off the upsert result to back-link the Purchase.
  entitlementUpsert.mockResolvedValue({ id: "ent_1" });
  tipUpsert.mockResolvedValue({});
  bundleFindUnique.mockResolvedValue({ id: "bundle_1" });
  purchaseCreate.mockResolvedValue({ id: "purch_1" });
});

describe("POST /api/stripe/webhook — rejections", () => {
  test("returns 400 when the stripe-signature header is missing", async () => {
    const res = await POST(makeRequest("{}", {}));
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  test("returns 400 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete fakeEnv.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeRequest("{}", SIG_HEADER));
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  test("returns 400 when the signature is invalid (constructEvent throws)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeRequest("{}", SIG_HEADER));
    expect(res.status).toBe(400);
    expect(processedCreate).not.toHaveBeenCalled();
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook — checkout.session.completed", () => {
  test("a paid course session claims, grants, AND records the Purchase, returns 200", async () => {
    constructEvent.mockReturnValue({
      id: "evt_grant",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_grant",
          mode: "payment",
          payment_status: "paid",
          amount_total: 4900,
          currency: "usd",
          payment_intent: "pi_1",
          customer: "cus_1",
          total_details: { amount_discount: 0 },
          metadata: {
            userId: "user_1",
            projectId: "proj_1",
            stripePriceId: "price_1",
          },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // First idempotency layer: dedupe row written with the event id + type.
    expect(processedCreate).toHaveBeenCalledWith({
      data: { eventId: "evt_grant", type: "checkout.session.completed" },
    });
    // Second idempotency layer: upsert keyed on the [userId, projectId] unique.
    expect(entitlementUpsert).toHaveBeenCalledWith({
      where: { userId_projectId: { userId: "user_1", projectId: "proj_1" } },
      create: { userId: "user_1", projectId: "proj_1", source: "PURCHASE" },
      update: {},
    });
    // The audit Purchase, back-linked to the granted entitlement.
    expect(purchaseCreate).toHaveBeenCalledTimes(1);
    expect(purchaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        projectId: "proj_1",
        entitlementId: "ent_1",
        stripeSessionId: "cs_grant",
        stripePaymentIntentId: "pi_1",
        stripeCustomerId: "cus_1",
        stripePriceId: "price_1",
        amountTotalCents: 4900,
        amountDiscountCents: 0,
      }),
    });
  });

  test("a paid Pass (bundle) session grants via [userId,bundleId] and records the Purchase", async () => {
    constructEvent.mockReturnValue({
      id: "evt_bundle",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_bundle",
          mode: "payment",
          payment_status: "paid",
          amount_total: 39900,
          currency: "usd",
          payment_intent: "pi_b",
          customer: "cus_b",
          metadata: { kind: "bundle", userId: "user_1", bundleKey: "all-access" },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(bundleFindUnique).toHaveBeenCalledWith({
      where: { key: "all-access" },
      select: { id: true },
    });
    expect(entitlementUpsert).toHaveBeenCalledWith({
      where: { userId_bundleId: { userId: "user_1", bundleId: "bundle_1" } },
      create: { userId: "user_1", bundleId: "bundle_1", source: "PURCHASE" },
      update: {},
    });
    expect(purchaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        bundleId: "bundle_1",
        entitlementId: "ent_1",
        stripeSessionId: "cs_bundle",
        amountTotalCents: 39900,
      }),
    });
  });

  test("a paid payment-mode session with a null amount_total grants but records NO Purchase", async () => {
    constructEvent.mockReturnValue({
      id: "evt_noamt",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_noamt",
          mode: "payment",
          payment_status: "paid",
          amount_total: null,
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(entitlementUpsert).toHaveBeenCalledTimes(1);
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  test("a REDELIVERED event (claim → P2002) is a 200 no-op — no grant, no Purchase", async () => {
    constructEvent.mockReturnValue({
      id: "evt_grant",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_grant",
          mode: "payment",
          payment_status: "paid",
          amount_total: 4900,
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });
    // The dedupe row already exists — the unique @id violates with P2002, which
    // aborts the transaction; the route's outer catch maps it to a 200 no-op.
    processedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // CRITICAL: the redelivery must NOT grant or record again.
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  test("returns 200 without granting when metadata is missing (nothing to grant)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_nometa",
      type: "checkout.session.completed",
      data: {
        object: { mode: "payment", payment_status: "paid", metadata: {} },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(processedCreate).toHaveBeenCalledTimes(1);
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  test("a TIP session records a Tip (idempotent on stripeSessionId) and does NOT grant or record a Purchase", async () => {
    constructEvent.mockReturnValue({
      id: "evt_tip",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_tip_1",
          mode: "payment",
          payment_status: "paid",
          amount_total: 500,
          currency: "usd",
          customer_details: { email: "fan@example.com" },
          metadata: { kind: "tip", userId: "user_1" },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(processedCreate).toHaveBeenCalledTimes(1);
    // Recorded the tip (amount from Stripe), keyed on the session id.
    expect(tipUpsert).toHaveBeenCalledTimes(1);
    expect(tipUpsert).toHaveBeenCalledWith({
      where: { stripeSessionId: "cs_tip_1" },
      create: {
        stripeSessionId: "cs_tip_1",
        userId: "user_1",
        email: "fan@example.com",
        amountCents: 500,
        currency: "usd",
      },
      update: {},
    });
    // A tip is NOT a purchase — never grant an entitlement or record a Purchase.
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  test("an UNPAID session is acked (200) with NO claim, grant, or Purchase", async () => {
    constructEvent.mockReturnValue({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          payment_status: "unpaid",
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // The guard runs BEFORE the transaction: nothing is written.
    expect(processedCreate).not.toHaveBeenCalled();
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });

  test("rethrows a non-P2002 Prisma error from the dedupe insert", async () => {
    constructEvent.mockReturnValue({
      id: "evt_grant",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          payment_status: "paid",
          amount_total: 4900,
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });
    processedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Some other DB error", {
        code: "P2010",
        clientVersion: "test",
      }),
    );

    await expect(POST(makeRequest("rawbody", SIG_HEADER))).rejects.toThrow();
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook — other event types", () => {
  test("an unrelated event type returns 200 and does not grant", async () => {
    constructEvent.mockReturnValue({
      id: "evt_pi",
      type: "payment_intent.created",
      data: { object: {} },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(processedCreate).not.toHaveBeenCalled();
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(purchaseCreate).not.toHaveBeenCalled();
  });
});
