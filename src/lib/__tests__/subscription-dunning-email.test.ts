// Unit test for the dunning email builder (pure function → subject/html/text). Mirrors
// auth-magic-link-email.test.ts: assert the subject names the problem, the body links to
// the account/billing page, and NO em-dash appears (house voice is an absolute).
import { describe, expect, test } from "vitest";
import { subscriptionPaymentFailedEmail } from "@/lib/subscription-dunning-email";

describe("subscriptionPaymentFailedEmail", () => {
  const out = subscriptionPaymentFailedEmail({
    accountUrl: "https://academy.test/account",
    host: "academy.test",
  });

  test("subject names the payment problem", () => {
    expect(out.subject).toMatch(/payment/i);
  });

  test("html + text link to the account/billing page", () => {
    expect(out.html).toContain("https://academy.test/account");
    expect(out.text).toContain("https://academy.test/account");
  });

  test("no em-dash anywhere (house voice)", () => {
    expect(out.html).not.toContain("—");
    expect(out.text).not.toContain("—");
  });

  test("returns the three-part shape", () => {
    expect(out).toEqual({
      subject: expect.any(String),
      html: expect.any(String),
      text: expect.any(String),
    });
  });
});
