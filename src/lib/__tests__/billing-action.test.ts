// Action-layer test for the customer billing portal (`createBillingPortalSession` in
// `src/lib/actions/billing.ts`). Mirrors the pass-action.test.ts mock pattern: everything
// the action touches is mocked (auth, Stripe, siteUrl) so this is a pure unit test of the
// action's control flow — reads the user's OWN customer id, opens a portal session, and
// refuses cleanly when there is no billing account.
import { beforeEach, describe, expect, test, vi } from "vitest";

const { requireUser, portalCreate, siteUrl } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  portalCreate: vi.fn(),
  siteUrl: vi.fn(() => "https://academy.test"),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    billingPortal: { sessions: { create: (...a: unknown[]) => portalCreate(...a) } },
  }),
}));

import { createBillingPortalSession } from "@/lib/actions/billing";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user_1", stripeCustomerId: "cus_1" });
  portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/session" });
});

describe("createBillingPortalSession", () => {
  test("opens a portal session for the user's own customer id, returns the url", async () => {
    const result = await createBillingPortalSession();
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://academy.test/account",
    });
    expect(result).toEqual({ url: "https://billing.stripe.test/session" });
  });

  test("throws when the user has no Stripe customer id (no billing account yet)", async () => {
    requireUser.mockResolvedValue({ id: "user_2", stripeCustomerId: null });
    await expect(createBillingPortalSession()).rejects.toThrow(/billing/i);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  test("throws when Stripe returns no url", async () => {
    portalCreate.mockResolvedValue({ url: null });
    await expect(createBillingPortalSession()).rejects.toThrow(/portal url/i);
  });
});
