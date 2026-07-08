// Phase-2 webhook tests — the subscription / invoice / refund branches + their pure
// extraction helpers. Isolated from stripe-webhook.test.ts (its own db mock) so the
// day-1 tests stay untouched.
//
// The route wraps each branch's claim + writes in db.$transaction(cb); the mock
// invokes the callback with a `tx` exposing every spy the branches touch. A rejected
// claim (P2002) rejects the callback → the route's outer catch 200-no-ops.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  subscriptionFromEvent,
  invoiceFromEvent,
  refundInfoFromCharge,
  refundFromEvent,
  disputeFromEvent,
} from "@/lib/stripe-webhook";

const S = <T>(o: unknown) => o as T;

// ─── Pure helpers ───────────────────────────────────────────────────────────

describe("subscriptionFromEvent (pure)", () => {
  test("extracts fields; period from items.data (max); metadata userId", () => {
    const sub = S<import("stripe").Stripe.Subscription>({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [
          { current_period_end: 1780000000, price: { id: "price_1", product: "prod_1" } },
          { current_period_end: 1790000000, price: { id: "price_2", product: "prod_2" } },
        ],
      },
      metadata: { userId: "user_1" },
    });
    const f = subscriptionFromEvent(sub);
    expect(f.stripeSubscriptionId).toBe("sub_1");
    expect(f.stripeCustomerId).toBe("cus_1");
    expect(f.stripePriceId).toBe("price_1");
    expect(f.stripeProductId).toBe("prod_1");
    expect(f.status).toBe("active");
    expect(f.cancelAtPeriodEnd).toBe(false);
    expect(f.metadataUserId).toBe("user_1");
    // MAX of the item period ends.
    expect(f.currentPeriodEnd).toEqual(new Date(1790000000 * 1000));
  });

  test("null period + null metadata userId when absent", () => {
    const f = subscriptionFromEvent(
      S<import("stripe").Stripe.Subscription>({
        id: "sub_2",
        customer: "cus_2",
        status: "canceled",
        items: { data: [] },
        metadata: {},
      }),
    );
    expect(f.currentPeriodEnd).toBeNull();
    expect(f.metadataUserId).toBeNull();
    expect(f.stripePriceId).toBeNull();
  });
});

describe("invoiceFromEvent (pure)", () => {
  test("basil subscription id from parent.subscription_details; paidAt from status_transitions", () => {
    const inv = S<import("stripe").Stripe.Invoice>({
      id: "in_1",
      customer: "cus_1",
      amount_paid: 2900,
      currency: "usd",
      created: 1770000000,
      status_transitions: { paid_at: 1770000100 },
      period_start: 1769000000,
      period_end: 1771000000,
      parent: { subscription_details: { subscription: "sub_1" } },
      metadata: { userId: "user_1" },
    });
    const f = invoiceFromEvent(inv);
    expect(f.stripeInvoiceId).toBe("in_1");
    expect(f.stripeSubscriptionId).toBe("sub_1");
    expect(f.userId).toBe("user_1");
    expect(f.amountPaidCents).toBe(2900);
    expect(f.paidAt).toEqual(new Date(1770000100 * 1000));
    expect(f.periodStart).toEqual(new Date(1769000000 * 1000));
  });

  test("falls back to created when paid_at is absent; null sub id when no parent", () => {
    const f = invoiceFromEvent(
      S<import("stripe").Stripe.Invoice>({
        id: "in_2",
        customer: "cus_2",
        amount_paid: 0,
        currency: "usd",
        created: 1772000000,
      }),
    );
    expect(f.stripeSubscriptionId).toBeNull();
    expect(f.paidAt).toEqual(new Date(1772000000 * 1000));
  });
});

describe("refundInfoFromCharge (pure)", () => {
  test("payment_intent, cumulative amount, fullyRefunded, and per-refund rows", () => {
    const charge = S<import("stripe").Stripe.Charge>({
      id: "ch_1",
      payment_intent: "pi_1",
      amount: 4900,
      amount_refunded: 4900,
      refunds: {
        data: [
          { id: "re_1", amount: 4900, reason: "requested_by_customer", status: "succeeded" },
        ],
      },
    });
    const info = refundInfoFromCharge(charge);
    expect(info.paymentIntentId).toBe("pi_1");
    expect(info.amountRefunded).toBe(4900);
    expect(info.fullyRefunded).toBe(true);
    expect(info.refunds).toEqual([
      {
        stripeRefundId: "re_1",
        stripeChargeId: "ch_1",
        amountCents: 4900,
        reason: "requested_by_customer",
        status: "succeeded",
      },
    ]);
  });

  test("a partial refund is not fullyRefunded", () => {
    const info = refundInfoFromCharge(
      S<import("stripe").Stripe.Charge>({
        id: "ch_2",
        payment_intent: "pi_2",
        amount: 4900,
        amount_refunded: 1000,
        refunds: { data: [{ id: "re_2", amount: 1000, reason: null, status: "succeeded" }] },
      }),
    );
    expect(info.fullyRefunded).toBe(false);
    expect(info.refunds[0]?.reason).toBeNull();
  });
});

describe("refundFromEvent (pure)", () => {
  test("extracts the single refund + the payment_intent correlation key", () => {
    const r = refundFromEvent(
      S<import("stripe").Stripe.Refund>({
        id: "re_1",
        charge: "ch_1",
        payment_intent: "pi_1",
        amount: 4900,
        reason: "requested_by_customer",
        status: "succeeded",
      }),
    );
    expect(r.paymentIntentId).toBe("pi_1");
    expect(r.fields).toEqual({
      stripeRefundId: "re_1",
      stripeChargeId: "ch_1",
      amountCents: 4900,
      reason: "requested_by_customer",
      status: "succeeded",
    });
  });
});

describe("disputeFromEvent (pure)", () => {
  test("extracts the dispute fields + payment_intent correlation key", () => {
    const f = disputeFromEvent(
      S<import("stripe").Stripe.Dispute>({
        id: "dp_1",
        charge: "ch_1",
        payment_intent: "pi_1",
        amount: 4900,
        reason: "fraudulent",
        status: "needs_response",
      }),
    );
    expect(f).toEqual({
      stripeDisputeId: "dp_1",
      stripeChargeId: "ch_1",
      amountCents: 4900,
      reason: "fraudulent",
      status: "needs_response",
      paymentIntentId: "pi_1",
    });
  });
});

// ─── Route handler ───────────────────────────────────────────────────────────

const {
  constructEvent,
  processedCreate,
  userFindUnique,
  bundleFindUnique,
  subscriptionUpsert,
  subscriptionFindUnique,
  invoiceUpsert,
  invoiceUpdateMany,
  refundUpsert,
  purchaseFindFirst,
  purchaseUpdate,
  entitlementUpsert,
  entitlementDeleteMany,
  disputeUpsert,
  fakeEnv,
} = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  processedCreate: vi.fn(),
  userFindUnique: vi.fn(),
  bundleFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  invoiceUpsert: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  refundUpsert: vi.fn(),
  purchaseFindFirst: vi.fn(),
  purchaseUpdate: vi.fn(),
  entitlementUpsert: vi.fn(),
  entitlementDeleteMany: vi.fn(),
  disputeUpsert: vi.fn(),
  fakeEnv: {} as { STRIPE_WEBHOOK_SECRET?: string },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    processedStripeEvent: { create: (...a: unknown[]) => processedCreate(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    bundle: { findUnique: (...a: unknown[]) => bundleFindUnique(...a) },
    subscription: {
      upsert: (...a: unknown[]) => subscriptionUpsert(...a),
      findUnique: (...a: unknown[]) => subscriptionFindUnique(...a),
    },
    invoice: {
      upsert: (...a: unknown[]) => invoiceUpsert(...a),
      updateMany: (...a: unknown[]) => invoiceUpdateMany(...a),
    },
    refund: { upsert: (...a: unknown[]) => refundUpsert(...a) },
    purchase: {
      findFirst: (...a: unknown[]) => purchaseFindFirst(...a),
      update: (...a: unknown[]) => purchaseUpdate(...a),
    },
    entitlement: {
      upsert: (...a: unknown[]) => entitlementUpsert(...a),
      deleteMany: (...a: unknown[]) => entitlementDeleteMany(...a),
    },
    dispute: { upsert: (...a: unknown[]) => disputeUpsert(...a) },
  };
  return {
    db: { $transaction: <T>(cb: (client: typeof tx) => Promise<T>) => cb(tx) },
  };
});

vi.mock("@/env", () => ({ env: fakeEnv }));

import { POST } from "@/app/api/stripe/webhook/route";

function makeRequest(body: string): Request {
  return new Request("https://example.com/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body,
  });
}
const req = () => makeRequest("rawbody");

beforeEach(() => {
  vi.clearAllMocks();
  fakeEnv.STRIPE_WEBHOOK_SECRET = "whsec_test";
  processedCreate.mockResolvedValue({});
  userFindUnique.mockResolvedValue({ id: "user_1" });
  bundleFindUnique.mockResolvedValue({ id: "bundle_1" });
  subscriptionUpsert.mockResolvedValue({ id: "subrow_1" });
  subscriptionFindUnique.mockResolvedValue({ id: "subrow_1", userId: "user_1" });
  invoiceUpsert.mockResolvedValue({});
  invoiceUpdateMany.mockResolvedValue({ count: 0 });
  refundUpsert.mockResolvedValue({});
  purchaseFindFirst.mockResolvedValue({
    id: "pur_1",
    entitlementId: "ent_1",
    amountTotalCents: 4900,
  });
  purchaseUpdate.mockResolvedValue({});
  entitlementUpsert.mockResolvedValue({ id: "ent_1" });
  entitlementDeleteMany.mockResolvedValue({ count: 1 });
  disputeUpsert.mockResolvedValue({});
});

const SUB_EVENT = (status: string, type = "customer.subscription.updated") => ({
  id: `evt_${status}`,
  type,
  data: {
    object: {
      id: "sub_1",
      customer: "cus_1",
      status,
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1780000000, price: { id: "price_1", product: "prod_1" } }] },
      metadata: { userId: "user_1" },
    },
  },
});

describe("POST webhook — customer.subscription.*", () => {
  test("an ACTIVE subscription upserts the mirror and mints the all-access Entitlement (source SUBSCRIPTION)", async () => {
    constructEvent.mockReturnValue(SUB_EVENT("active", "customer.subscription.created"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    expect(invoiceUpdateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_1", subscriptionId: null },
      data: { subscriptionId: "subrow_1" },
    });
    expect(entitlementUpsert).toHaveBeenCalledWith({
      where: { userId_bundleId: { userId: "user_1", bundleId: "bundle_1" } },
      create: { userId: "user_1", bundleId: "bundle_1", source: "SUBSCRIPTION" },
      update: {},
    });
    expect(entitlementDeleteMany).not.toHaveBeenCalled();
  });

  test("a CANCELED subscription revokes ONLY the SUBSCRIPTION-granted entitlement", async () => {
    constructEvent.mockReturnValue(SUB_EVENT("canceled", "customer.subscription.deleted"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    expect(entitlementDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", bundleId: "bundle_1", source: "SUBSCRIPTION" },
    });
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });

  test("a PAUSED subscription revokes access (status-driven, not only 'canceled')", async () => {
    constructEvent.mockReturnValue(SUB_EVENT("paused", "customer.subscription.paused"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    expect(entitlementDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", bundleId: "bundle_1", source: "SUBSCRIPTION" },
    });
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });

  test("a REDELIVERED subscription event (claim P2002) is a 200 no-op, no writes", async () => {
    constructEvent.mockReturnValue(SUB_EVENT("active", "customer.subscription.created"));
    processedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
    );
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(subscriptionUpsert).not.toHaveBeenCalled();
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });
});

describe("POST webhook — invoice.paid", () => {
  test("writes the Invoice (write-once) with the resolved subscription FK", async () => {
    constructEvent.mockReturnValue({
      id: "evt_inv",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          customer: "cus_1",
          amount_paid: 2900,
          currency: "usd",
          created: 1770000000,
          status_transitions: { paid_at: 1770000100 },
          parent: { subscription_details: { subscription: "sub_1" } },
          metadata: { userId: "user_1" },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(invoiceUpsert).toHaveBeenCalledTimes(1);
    const arg = invoiceUpsert.mock.calls[0]![0] as {
      where: { stripeInvoiceId: string };
      create: { subscriptionId: string | null; amountPaidCents: number };
      update: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ stripeInvoiceId: "in_1" });
    expect(arg.create.subscriptionId).toBe("subrow_1");
    expect(arg.create.amountPaidCents).toBe(2900);
    expect(arg.update).toEqual({}); // write-once
  });
});

describe("POST webhook — charge.refunded", () => {
  const REFUND_EVENT = (pi: string, amount: number, refunded: number, refundId: string) => ({
    id: `evt_${refundId}`,
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_1",
        payment_intent: pi,
        amount,
        amount_refunded: refunded,
        refunds: { data: [{ id: refundId, amount: refunded, reason: null, status: "succeeded" }] },
      },
    },
  });

  test("a FULL refund records the Refund, SETs refundedCents, and revokes the entitlement", async () => {
    constructEvent.mockReturnValue(REFUND_EVENT("pi_1", 4900, 4900, "re_1"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(refundUpsert).toHaveBeenCalledWith({
      where: { stripeRefundId: "re_1" },
      create: expect.objectContaining({ stripeChargeId: "ch_1", amountCents: 4900, purchaseId: "pur_1" }),
      update: { purchaseId: "pur_1", status: "succeeded" },
    });
    expect(purchaseUpdate).toHaveBeenCalledWith({
      where: { id: "pur_1" },
      data: { refundedCents: 4900 },
    });
    expect(entitlementDeleteMany).toHaveBeenCalledWith({ where: { id: "ent_1" } });
  });

  test("a PARTIAL refund SETs refundedCents but KEEPS access", async () => {
    constructEvent.mockReturnValue(REFUND_EVENT("pi_1", 4900, 1000, "re_partial"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(purchaseUpdate).toHaveBeenCalledWith({
      where: { id: "pur_1" },
      data: { refundedCents: 1000 },
    });
    expect(entitlementDeleteMany).not.toHaveBeenCalled();
  });

  test("a refunded TIP (no matching Purchase) records the Refund and no-ops, returns 200", async () => {
    purchaseFindFirst.mockResolvedValue(null);
    constructEvent.mockReturnValue(REFUND_EVENT("pi_tip", 500, 500, "re_tip"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(refundUpsert).toHaveBeenCalledWith({
      where: { stripeRefundId: "re_tip" },
      create: expect.objectContaining({ purchaseId: null }),
      update: { purchaseId: null, status: "succeeded" },
    });
    expect(purchaseUpdate).not.toHaveBeenCalled();
    expect(entitlementDeleteMany).not.toHaveBeenCalled();
  });
});

describe("POST webhook — refund.created", () => {
  test("records the itemized Refund correlated to the Purchase; does NOT touch refundedCents or access", async () => {
    constructEvent.mockReturnValue({
      id: "evt_refcreated",
      type: "refund.created",
      data: {
        object: {
          id: "re_9",
          charge: "ch_9",
          payment_intent: "pi_1",
          amount: 4900,
          reason: null,
          status: "succeeded",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(refundUpsert).toHaveBeenCalledWith({
      where: { stripeRefundId: "re_9" },
      create: expect.objectContaining({
        stripeChargeId: "ch_9",
        amountCents: 4900,
        purchaseId: "pur_1",
      }),
      update: { purchaseId: "pur_1", status: "succeeded" },
    });
    // charge.refunded owns refundedCents + the revoke; refund.created only the ledger.
    expect(purchaseUpdate).not.toHaveBeenCalled();
    expect(entitlementDeleteMany).not.toHaveBeenCalled();
  });
});

describe("POST webhook — charge.dispute.*", () => {
  test("records a Dispute correlated to the Purchase; access is NOT auto-revoked", async () => {
    constructEvent.mockReturnValue({
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_9",
          charge: "ch_9",
          payment_intent: "pi_1",
          amount: 4900,
          reason: "fraudulent",
          status: "needs_response",
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(disputeUpsert).toHaveBeenCalledWith({
      where: { stripeDisputeId: "dp_9" },
      create: expect.objectContaining({
        stripeChargeId: "ch_9",
        amountCents: 4900,
        purchaseId: "pur_1",
        status: "needs_response",
      }),
      update: { status: "needs_response", purchaseId: "pur_1" },
    });
    // Record-only — access is never auto-revoked on a dispute.
    expect(entitlementDeleteMany).not.toHaveBeenCalled();
  });
});

describe("POST webhook — invoice payment states", () => {
  test("invoice.payment_succeeded records the Invoice (alias of invoice.paid)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_invsucc",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_9",
          customer: "cus_1",
          amount_paid: 2900,
          currency: "usd",
          created: 1770000000,
          status_transitions: { paid_at: 1770000100 },
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(invoiceUpsert).toHaveBeenCalledTimes(1);
  });

  test("invoice.payment_failed is logged only — no claim, no DB write, still 200", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    constructEvent.mockReturnValue({
      id: "evt_invfail",
      type: "invoice.payment_failed",
      data: { object: { id: "in_fail", customer: "cus_1" } },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(processedCreate).not.toHaveBeenCalled();
    expect(invoiceUpsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
