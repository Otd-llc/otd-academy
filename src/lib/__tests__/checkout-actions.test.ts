// Unit tests for createCheckoutSession (A3). Fully mocked — no live Stripe, no
// live DB, no real session. We mock:
//   - @/lib/stripe        → getStripe (checkout.sessions.create) + ensureStripeCustomer
//   - @/lib/auth-helpers  → requireUser (the signed-in user)
//   - @/lib/db            → db.project.findUnique
//
// Guarantees asserted:
//   - refuses a non-existent project, a non-PREMIUM project, and a PREMIUM
//     project with no stripePriceId ("not available for purchase").
//   - on success passes the correct `price`, `customer`, and
//     `metadata: { userId, projectId }` to checkout.sessions.create, and returns
//     the session url.
//   - throws if Stripe returns a null url.
import { beforeEach, describe, expect, test, vi } from "vitest";

const sessionsCreate = vi.fn();
const ensureStripeCustomer = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
  ensureStripeCustomer: (...a: unknown[]) => ensureStripeCustomer(...a),
}));

const requireUser = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({
  requireUser: () => requireUser(),
}));

const projectFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { project: { findUnique: (...a: unknown[]) => projectFindUnique(...a) } },
}));

import { createCheckoutSession } from "@/lib/actions/checkout";

// A valid cuid so the Zod `z.cuid()` gate passes (matches enrollment's projectId).
const PROJECT_ID = "clh1234567890abcdefghijkl";
const USER = {
  id: "user_1",
  email: "buyer@example.com",
  stripeCustomerId: null,
};

beforeEach(() => {
  sessionsCreate.mockReset();
  ensureStripeCustomer.mockReset();
  requireUser.mockReset();
  projectFindUnique.mockReset();

  requireUser.mockResolvedValue(USER);
  ensureStripeCustomer.mockResolvedValue("cus_123");
});

describe("createCheckoutSession — refusals", () => {
  test("rejects an invalid (non-cuid) projectId via Zod", async () => {
    await expect(
      createCheckoutSession({ projectId: "not-a-cuid" }),
    ).rejects.toThrow();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test("refuses a project that does not exist", async () => {
    projectFindUnique.mockResolvedValue(null);
    await expect(
      createCheckoutSession({ projectId: PROJECT_ID }),
    ).rejects.toThrow(/available for purchase/i);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test("refuses a non-PREMIUM project (even with a price)", async () => {
    projectFindUnique.mockResolvedValue({
      id: PROJECT_ID,
      slug: "free-course",
      accessTier: "FREE",
      stripePriceId: "price_abc",
    });
    await expect(
      createCheckoutSession({ projectId: PROJECT_ID }),
    ).rejects.toThrow(/available for purchase/i);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test("refuses a PREMIUM project with no stripePriceId", async () => {
    projectFindUnique.mockResolvedValue({
      id: PROJECT_ID,
      slug: "premium-no-price",
      accessTier: "PREMIUM",
      stripePriceId: null,
    });
    await expect(
      createCheckoutSession({ projectId: PROJECT_ID }),
    ).rejects.toThrow(/available for purchase/i);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("createCheckoutSession — success", () => {
  beforeEach(() => {
    projectFindUnique.mockResolvedValue({
      id: PROJECT_ID,
      slug: "premium-course",
      accessTier: "PREMIUM",
      stripePriceId: "price_xyz",
    });
  });

  test("passes the right price, customer, and metadata, and returns the url", async () => {
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/abc" });

    const result = await createCheckoutSession({ projectId: PROJECT_ID });

    expect(result).toEqual({ url: "https://checkout.stripe.com/c/pay/abc" });
    expect(ensureStripeCustomer).toHaveBeenCalledWith(USER);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);

    const arg = sessionsCreate.mock.calls[0]![0] as {
      mode: string;
      line_items: { price: string; quantity: number }[];
      customer: string;
      success_url: string;
      cancel_url: string;
      metadata: { userId: string; projectId: string };
    };
    expect(arg.mode).toBe("payment");
    expect(arg.line_items).toEqual([{ price: "price_xyz", quantity: 1 }]);
    expect(arg.customer).toBe("cus_123");
    expect(arg.metadata).toEqual({ userId: "user_1", projectId: PROJECT_ID });
    // URLs are absolute and reference the project slug (built off siteUrl()).
    expect(arg.success_url).toMatch(/\/learn\?purchased=premium-course$/);
    expect(arg.cancel_url).toMatch(/\/learn\/premium-course$/);
    expect(arg.success_url).toMatch(/^https?:\/\//);
  });

  test("throws when Stripe returns a null url", async () => {
    sessionsCreate.mockResolvedValue({ url: null });
    await expect(
      createCheckoutSession({ projectId: PROJECT_ID }),
    ).rejects.toThrow(/checkout url/i);
  });
});
