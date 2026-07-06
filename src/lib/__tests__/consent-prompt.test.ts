// Pure-gate tests for the post-signup email-consent prompt. No DB — the layout's
// render decision is a pure function of (signedIn, account, pathname).
import { describe, expect, test } from "vitest";
import { shouldAskEmailConsent } from "@/lib/consent-prompt";

const chose = { emailConsentUpdatedAt: new Date("2026-07-06T00:00:00Z") };
const neverChose = { emailConsentUpdatedAt: null };

describe("shouldAskEmailConsent", () => {
  test("shows for a signed-in user who has never chosen", () => {
    expect(
      shouldAskEmailConsent({ signedIn: true, account: neverChose, pathname: "/" }),
    ).toBe(true);
  });

  test("hidden when signed out", () => {
    expect(
      shouldAskEmailConsent({ signedIn: false, account: neverChose, pathname: "/" }),
    ).toBe(false);
  });

  test("hidden when the user row did not load", () => {
    expect(
      shouldAskEmailConsent({ signedIn: true, account: null, pathname: "/" }),
    ).toBe(false);
  });

  test("hidden once a choice has been recorded (opted in OR out)", () => {
    expect(
      shouldAskEmailConsent({ signedIn: true, account: chose, pathname: "/" }),
    ).toBe(false);
  });

  test("suppressed on /account (its own toggle lives there)", () => {
    expect(
      shouldAskEmailConsent({ signedIn: true, account: neverChose, pathname: "/account" }),
    ).toBe(false);
  });

  test("still shows on other routes that merely contain 'account' later", () => {
    expect(
      shouldAskEmailConsent({ signedIn: true, account: neverChose, pathname: "/parts/account-ic" }),
    ).toBe(true);
  });
});
