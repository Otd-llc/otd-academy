// Tests for the Stripe webhook (A4) — the SECURITY-CRITICAL grant path. Two
// surfaces are covered:
//
//   1. The PURE helper `entitlementFromCheckoutSession(session)` — reads
//      metadata.userId / metadata.projectId and returns the pair only when BOTH
//      are present non-empty strings, else null. No db, no Stripe.
//
//   2. The POST route handler (`src/app/api/stripe/webhook/route.ts`). The
//      webhook is the ONLY thing that grants a purchase, so we assert:
//        - missing signature header  → 400
//        - missing STRIPE_WEBHOOK_SECRET → 400
//        - a bad signature (constructEvent throws) → 400
//        - a valid checkout.session.completed → records the ProcessedStripeEvent
//          AND upserts the Entitlement exactly once → 200
//        - a REDELIVERED event (ProcessedStripeEvent.create throws P2002) → 200
//          and does NOT upsert the entitlement (no double grant)
//        - an unrelated event type → 200, no grant
//
// Everything is mocked: `@/lib/stripe` (so `webhooks.constructEvent` is fully
// controllable), `@/lib/db` (so we assert the writes without touching Neon), and
// `@/env` (to flip STRIPE_WEBHOOK_SECRET). The Prisma P2002 dup is simulated by
// rejecting the mocked `create` with a real `Prisma.PrismaClientKnownRequestError`.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { entitlementFromCheckoutSession } from "@/lib/stripe-webhook";

// --- Pure helper ----------------------------------------------------------

describe("entitlementFromCheckoutSession (pure)", () => {
  test("returns { userId, projectId } when both metadata fields are present", () => {
    const session = {
      metadata: { userId: "user_1", projectId: "proj_1" },
    } as unknown as import("stripe").Stripe.Checkout.Session;

    expect(entitlementFromCheckoutSession(session)).toEqual({
      userId: "user_1",
      projectId: "proj_1",
    });
  });

  test("returns null when userId is missing", () => {
    const session = {
      metadata: { projectId: "proj_1" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(entitlementFromCheckoutSession(session)).toBeNull();
  });

  test("returns null when projectId is missing", () => {
    const session = {
      metadata: { userId: "user_1" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(entitlementFromCheckoutSession(session)).toBeNull();
  });

  test("returns null when metadata is absent entirely", () => {
    const session = {} as unknown as import("stripe").Stripe.Checkout.Session;
    expect(entitlementFromCheckoutSession(session)).toBeNull();
  });

  test("returns null when a field is the empty string", () => {
    const session = {
      metadata: { userId: "", projectId: "proj_1" },
    } as unknown as import("stripe").Stripe.Checkout.Session;
    expect(entitlementFromCheckoutSession(session)).toBeNull();
  });
});

// --- Route handler --------------------------------------------------------

// The route is imported statically, so its dependency mocks must already be in
// place when the module loads. `vi.mock` is hoisted ABOVE these declarations, so
// the mutable spies/env they close over live in a `vi.hoisted` block (also
// hoisted) to avoid the temporal-dead-zone error on first import.
const { constructEvent, processedCreate, entitlementUpsert, fakeEnv } =
  vi.hoisted(() => ({
    // constructEvent is the signature-verifier; the route is only as trustworthy
    // as this call, so the mock lets each test drive it (return a parsed event,
    // or throw to simulate a bad signature).
    constructEvent: vi.fn(),
    processedCreate: vi.fn(),
    entitlementUpsert: vi.fn(),
    // Mutable env so tests can set/unset STRIPE_WEBHOOK_SECRET.
    fakeEnv: {} as { STRIPE_WEBHOOK_SECRET?: string },
  }));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    processedStripeEvent: { create: (...a: unknown[]) => processedCreate(...a) },
    entitlement: { upsert: (...a: unknown[]) => entitlementUpsert(...a) },
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

beforeEach(() => {
  constructEvent.mockReset();
  processedCreate.mockReset();
  entitlementUpsert.mockReset();
  fakeEnv.STRIPE_WEBHOOK_SECRET = "whsec_test";
  processedCreate.mockResolvedValue({ eventId: "evt_1" });
  entitlementUpsert.mockResolvedValue({});
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
  test("records the event and upserts the entitlement once, returns 200", async () => {
    constructEvent.mockReturnValue({
      id: "evt_grant",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // First idempotency layer: dedupe row written with the event id + type.
    expect(processedCreate).toHaveBeenCalledTimes(1);
    expect(processedCreate).toHaveBeenCalledWith({
      data: { eventId: "evt_grant", type: "checkout.session.completed" },
    });
    // Second idempotency layer: upsert keyed on the [userId, projectId] unique.
    expect(entitlementUpsert).toHaveBeenCalledTimes(1);
    expect(entitlementUpsert).toHaveBeenCalledWith({
      where: { userId_projectId: { userId: "user_1", projectId: "proj_1" } },
      create: { userId: "user_1", projectId: "proj_1", source: "PURCHASE" },
      update: {},
    });
  });

  test("a REDELIVERED event (ProcessedStripeEvent.create → P2002) is a 200 no-op, no double grant", async () => {
    constructEvent.mockReturnValue({
      id: "evt_grant",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });
    // The dedupe row already exists — the unique @id violates with P2002.
    processedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // CRITICAL: the redelivery must NOT grant again.
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });

  test("returns 200 without granting when metadata is missing (nothing to grant)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_nometa",
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", metadata: {} } },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    expect(processedCreate).toHaveBeenCalledTimes(1);
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });

  test("an UNPAID session is acked (200) with NO ProcessedStripeEvent and NO grant", async () => {
    constructEvent.mockReturnValue({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "unpaid",
          metadata: { userId: "user_1", projectId: "proj_1" },
        },
      },
    });

    const res = await POST(makeRequest("rawbody", SIG_HEADER));

    expect(res.status).toBe(200);
    // The guard runs BEFORE any write: neither layer is touched.
    expect(processedCreate).not.toHaveBeenCalled();
    expect(entitlementUpsert).not.toHaveBeenCalled();
  });

  test("rethrows a non-P2002 Prisma error from the dedupe insert", async () => {
    constructEvent.mockReturnValue({
      id: "evt_grant",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
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
  });
});
