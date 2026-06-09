// Unit tests for the lazy Stripe client (A2). Fully mocked — no live Stripe and
// no live DB. The critical guarantees:
//   - getStripe() throws a friendly "not configured" error (only when CALLED)
//     with no STRIPE_SECRET_KEY, and NEVER at import time (build-safety).
//   - getStripe() constructs the client once and returns a cached singleton.
//   - ensureStripeCustomer reuses an existing id without creating, and creates +
//     persists a new Customer when the user has none.
//
// We mock `stripe` (the SDK), `@/env` (to flip STRIPE_SECRET_KEY), and `@/lib/db`
// (to assert the persist without touching Neon). Because getStripe caches a
// module-level singleton, the env-dependent cases use vi.resetModules() +
// per-test dynamic import so each starts from a clean module state.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A single Stripe constructor spy shared across module reloads. Each `new Stripe`
// call records the key and returns a fresh fake instance with the client surface
// we exercise (customers.create).
const stripeCtor = vi.fn();
const customersCreate = vi.fn();

vi.mock("stripe", () => ({
  default: class FakeStripe {
    customers = { create: customersCreate };
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
  test("returns the existing stripeCustomerId without creating a Customer", async () => {
    fakeEnv.STRIPE_SECRET_KEY = "sk_test_123";
    const { ensureStripeCustomer } = await import("@/lib/stripe");

    const id = await ensureStripeCustomer({
      id: "user_1",
      email: "a@example.com",
      stripeCustomerId: "cus_existing",
    });

    expect(id).toBe("cus_existing");
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
});
