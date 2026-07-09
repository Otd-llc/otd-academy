// Unit test for the dunning sender. It POSTs the built email to Resend, and CRUCIALLY it
// never throws: the webhook fires it AFTER the event claim commits, so a thrown error
// would make Stripe retry the event → hit the claim's P2002 → no-op → no resend anyway.
// The fetch is injected so this never touches the network.
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { AUTH_RESEND_KEY: "re_test", AUTH_RESEND_FROM: "billing@academy.test" },
}));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl: () => "https://academy.test" }));

import { sendPaymentFailedEmail } from "@/lib/subscription-dunning";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendPaymentFailedEmail", () => {
  test("POSTs the email to Resend addressed to the given recipient", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await sendPaymentFailedEmail({ toEmail: "learner@test" }, fakeFetch as unknown as typeof fetch);

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toBe("learner@test");
    expect(body.from).toBe("billing@academy.test");
    expect(body.subject).toMatch(/payment/i);
    // Links back to the account/billing page.
    expect(body.html).toContain("https://academy.test/account");
  });

  test("a non-ok Resend response does NOT throw", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: "boom" }) });
    await expect(
      sendPaymentFailedEmail({ toEmail: "learner@test" }, fakeFetch as unknown as typeof fetch),
    ).resolves.toBeUndefined();
  });

  test("a thrown fetch does NOT propagate", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(
      sendPaymentFailedEmail({ toEmail: "learner@test" }, fakeFetch as unknown as typeof fetch),
    ).resolves.toBeUndefined();
  });
});
