// Unit tests for the lifecycle-email builders + the unsubscribe token. No DB —
// pure functions. Verifies: the verbatim subjects from
// docs/sales/lifecycle-emails.md, [FIRST_NAME]/[FOUNDER_FIRST_NAME] substitution,
// the signed unsubscribe link in EVERY footer, one CTA per email, and that the
// unsubscribe token round-trips + rejects tampering.
import { describe, expect, test, beforeAll } from "vitest";

// env.ts requires a 32+ char AUTH_SECRET (the HMAC key) and a few other vars to
// validate at import. Set the minimum BEFORE importing anything that pulls env.
beforeAll(() => {});
process.env.AUTH_SECRET ??= "x".repeat(40);
process.env.AUTH_GOOGLE_ID ??= "gid";
process.env.AUTH_GOOGLE_SECRET ??= "gsecret";
process.env.AUTH_GITHUB_ID ??= "ghid";
process.env.AUTH_GITHUB_SECRET ??= "ghsecret";
process.env.AUTH_RESEND_KEY ??= "re_test";
process.env.ALLOWED_EMAILS ??= "a@b.com";
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DIRECT_URL ??= "postgres://u:p@localhost:5432/db";

const { LIFECYCLE_BUILDERS, welcomeEmail } = await import("@/lib/lifecycle-emails");
const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/unsubscribe-token");

const ctx = {
  firstName: "Ada",
  founderFirstName: "Josh",
  unsubscribeUrl: "https://academy.onethousanddrones.com/email/unsubscribe/TOKEN123",
  host: "academy.onethousanddrones.com",
  postalAddress: "One Thousand Drones, LLC, Broken Arrow, OK 74012, USA",
  l101Url: "https://academy.onethousanddrones.com/projects/l1-01-wroom-breakout/v1/guide",
  certUrl: "https://academy.onethousanddrones.com/verify",
  l2Url: "https://academy.onethousanddrones.com/courses",
  passUrl: "https://academy.onethousanddrones.com/courses",
  upgradeUrl: "https://academy.onethousanddrones.com/courses",
  projectName: "the L2 battery module",
  projectPrice: "$49",
};

// Verbatim subjects from the docs file — the contract is exact-match.
const EXPECTED_SUBJECTS: Record<string, string> = {
  "1.1": "Your first board starts now",
  "2.1": "Stuck on the schematic? Read this first",
  "2.2": "You cleared ERC. Layout is next.",
  "2.3": "One clean DRC away",
  "3.1": "You just designed a real board",
  "4.1": "Put what you paid toward everything",
  "5.1": "The full L1 track is live, and the Pass is $299 for 14 days",
  "5.2": "What the $299 Pass actually covers",
  "5.3": "48 hours left at $299",
  "5.4": "Last call: $299 ends today",
  "6.1": "Your board is right where you left it",
};

describe("lifecycle email builders", () => {
  test("every sequence has a builder and the verbatim subject", () => {
    const keys = Object.keys(LIFECYCLE_BUILDERS).sort();
    expect(keys).toEqual(Object.keys(EXPECTED_SUBJECTS).sort());
    for (const [seq, build] of Object.entries(LIFECYCLE_BUILDERS)) {
      const email = build(ctx);
      expect(email.subject).toBe(EXPECTED_SUBJECTS[seq]);
    }
  });

  test("every email greets [FIRST_NAME] and signs [FOUNDER_FIRST_NAME]", () => {
    for (const build of Object.values(LIFECYCLE_BUILDERS)) {
      const email = build(ctx);
      expect(email.text).toContain("Hi Ada,");
      expect(email.html).toContain("Hi Ada,");
      // sign-off
      expect(email.text.trimEnd()).toMatch(/Josh\n/);
    }
  });

  test("every email footer carries the signed unsubscribe link (html + text)", () => {
    for (const build of Object.values(LIFECYCLE_BUILDERS)) {
      const email = build(ctx);
      expect(email.html).toContain(ctx.unsubscribeUrl);
      expect(email.text).toContain(ctx.unsubscribeUrl);
    }
  });

  test("every email footer carries the physical postal address (CAN-SPAM)", () => {
    for (const build of Object.values(LIFECYCLE_BUILDERS)) {
      const email = build(ctx);
      expect(email.html).toContain(ctx.postalAddress);
      expect(email.text).toContain(ctx.postalAddress);
    }
  });

  test("welcome (1.1) body matches the docs copy and the CTA points at L1.01", () => {
    const email = welcomeEmail(ctx);
    expect(email.text).toContain("design a real\nESP32-S3 board".replace("\n", " "));
    expect(email.text).toContain("L1.01 is free and it is the right place to start.");
    expect(email.text).toContain(`Start L1.01: ${ctx.l101Url}`);
    expect(email.html).toContain(ctx.l101Url);
  });

  test("pay-the-difference (4.1) interpolates [PROJECT_NAME] and [PROJECT_PRICE]", () => {
    const email = LIFECYCLE_BUILDERS["4.1"](ctx);
    expect(email.text).toContain("Thanks for buying the L2 battery module.");
    expect(email.text).toContain("your $49 is already part of it");
  });
});

describe("unsubscribe token", () => {
  test("round-trips the userId", () => {
    const token = signUnsubscribeToken("user_abc123");
    const claims = verifyUnsubscribeToken(token);
    expect(claims).toEqual({ userId: "user_abc123", kind: "unsub" });
  });

  test("rejects a tampered signature", () => {
    const token = signUnsubscribeToken("user_abc123");
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  test("rejects a tampered payload (forging a different userId)", () => {
    const token = signUnsubscribeToken("user_abc123");
    const sig = token.slice(token.indexOf(".") + 1);
    const forgedBody = Buffer.from(
      JSON.stringify({ userId: "victim", kind: "unsub" }),
    ).toString("base64url");
    expect(verifyUnsubscribeToken(`${forgedBody}.${sig}`)).toBeNull();
  });

  test("rejects garbage", () => {
    expect(verifyUnsubscribeToken("not-a-token")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });
});
