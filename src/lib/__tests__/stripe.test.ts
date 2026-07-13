// Unit tests for the lazy Stripe client (A2). Fully mocked — no live Stripe and
// no live DB. The critical guarantees:
//   - getStripe() throws a friendly "not configured" error (only when CALLED)
//     with no STRIPE_SECRET_KEY, and NEVER at import time (build-safety).
//   - getStripe() constructs the client once and returns a cached singleton.
//   - ensureStripeCustomer reuses an existing, still-valid id; creates + persists
//     a new Customer when the user has none; and SELF-HEALS a stale stored id (a
//     wrong-mode / deleted / foreign customer that Stripe rejects with
//     resource_missing) by minting a fresh one. Other Stripe errors re-throw.
//
// We mock `stripe` (the SDK), `@/env` (to flip STRIPE_SECRET_KEY), and `@/lib/db`
// (to assert the persist without touching Neon). Because getStripe caches a
// module-level singleton, the env-dependent cases use vi.resetModules() +
// per-test dynamic import so each starts from a clean module state.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The minimal Stripe error shape our code narrows on (`instanceof` + `.code`).
class FakeStripeError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

// A single Stripe constructor spy shared across module reloads. Each `new Stripe`
// call records the key and returns a fresh fake instance with the client surface
// we exercise (customers.create + customers.retrieve). `errors.StripeError` is a
// static so `Stripe.errors.StripeError` resolves like the real SDK.
const stripeCtor = vi.fn();
const customersCreate = vi.fn();
const customersRetrieve = vi.fn();

vi.mock("stripe", () => ({
  default: class FakeStripe {
    static errors = { StripeError: FakeStripeError };
    customers = { create: customersCreate, retrieve: customersRetrieve };
    constructor(key: string) {
      stripeCtor(key);
    }
  },
}));

// Mutable env the @/env mock reads from, so individual tests can set/unset the key.
const fakeEnv: { STRIPE_SECRET_KEY?: string } = {};
vi.mock("@/env", () => ({ env: fakeEnv }));

const userUpdate = vi.fn();
vi.mock("@/lib/db", () => ({ db: { user: { update: (...a: unknown[]) => userUpdate(...a) } } }));

beforeEach(() => {
  vi.resetModules();
  stripeCtor.mockReset();
  customersCreate.mockReset();
  customersRetrieve.mockReset();
  userUpdate.mockReset();
  delete fakeEnv.STRIPE_SECRET_KEY;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getStripe", () => {
  test("throws a friendly 'not configured' error when STRIPE_SECRET_KEY is unset", async () => {
    delete fakeEnv.STRIPE_SECRET_KEY;
    const { getStripe } = await import("@/lib/stripe");
    expect(() => getStripe()).toThrow(
      "Payments are not configured (STRIPE_SECRET_KEY missing)",
    );
    expect(stripeCtor).not.toHaveBeenCalled();
  });

  test("constructs with the key and returns a cached singleton on repeat calls", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    const { getStripe } = await import("@/lib/stripe");
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b); // same cached instance
    expect(stripeCtor).toHaveBeenCalledTimes(1); // constructed exactly once
    expect(stripeCtor).toHaveBeenCalledWith("sk_test_123");
  });
});

describe("ensureStripeCustomer", () => {
  test("reuses an existing id that still resolves under the current key", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    customersRetrieve.mockResolvedValue({ id: "cus_existing" }); // live, not deleted
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    const id = await ensureStripeCustomer({
      id: "user_1",
      email: "a@example.com",
      stripeCustomerId: "cus_existing",
    });

    expect(id).toBe("cus_existing");
    expect(customersRetrieve).toHaveBeenCalledWith("cus_existing");
    expect(customersCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  test("creates a Customer (email + metadata.userId) and persists the new id when absent", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    customersCreate.mockResolvedValue({ id: "cus_new" });
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    const id = await ensureStripeCustomer({
      id: "user_2",
      email: "b@example.com",
      stripeCustomerId: null,
    });

    expect(id).toBe("cus_new");
    expect(customersRetrieve).not.toHaveBeenCalled();
    expect(customersCreate).toHaveBeenCalledWith({
      email: "b@example.com",
      metadata: { userId: "user_2" },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: { stripeCustomerId: "cus_new" },
    });
  });

  test("passes undefined email to Stripe when the user has no email", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    customersCreate.mockResolvedValue({ id: "cus_noemail" });
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    await ensureStripeCustomer({ id: "user_3", email: null, stripeCustomerId: null });

    expect(customersCreate).toHaveBeenCalledWith({
      email: undefined,
      metadata: { userId: "user_3" },
    });
  });

  test("self-heals a stale wrong-mode id (resource_missing) by minting a fresh customer", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_live_123";
    // The stored id is a test-mode customer; a live key rejects it.
    customersRetrieve.mockRejectedValue(
      new FakeStripeError(
        "No such customer: 'cus_stale'; a similar object exists in test mode, but a live mode key was used.",
        "resource_missing",
      ),
    );
    customersCreate.mockResolvedValue({ id: "cus_live_new" });
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    const id = await ensureStripeCustomer({
      id: "user_4",
      email: "c@example.com",
      stripeCustomerId: "cus_stale",
    });

    expect(id).toBe("cus_live_new");
    expect(customersCreate).toHaveBeenCalledWith({
      email: "c@example.com",
      metadata: { userId: "user_4" },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user_4" },
      data: { stripeCustomerId: "cus_live_new" },
    });
  });

  test("recreates when the stored customer was deleted", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    customersRetrieve.mockResolvedValue({ id: "cus_gone", deleted: true });
    customersCreate.mockResolvedValue({ id: "cus_fresh" });
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    const id = await ensureStripeCustomer({
      id: "user_5",
      email: "d@example.com",
      stripeCustomerId: "cus_gone",
    });

    expect(id).toBe("cus_fresh");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user_5" },
      data: { stripeCustomerId: "cus_fresh" },
    });
  });

  test("re-throws a non-resource_missing Stripe error instead of masking it", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    customersRetrieve.mockRejectedValue(new FakeStripeError("rate limited", "rate_limit"));
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    await expect(
      ensureStripeCustomer({ id: "user_6", email: "e@example.com", stripeCustomerId: "cus_x" }),
    ).rejects.toThrow("rate limited");
    expect(customersCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
