import { describe, it, expect } from "vitest";

import { signFieldGuideToken, verifyFieldGuideToken } from "@/lib/field-guide-token";

const NOW = 1_700_000_000_000; // fixed clock (Date.now is not deterministic)

describe("field-guide download token", () => {
  it("round-trips a valid token", () => {
    const t = signFieldGuideToken("user_1", "fundamentals", NOW);
    const claims = verifyFieldGuideToken(t, NOW);
    expect(claims).toMatchObject({ userId: "user_1", guide: "fundamentals", kind: "fgd" });
  });

  it("rejects a tampered payload", () => {
    const t = signFieldGuideToken("user_1", "fundamentals", NOW);
    const [body, sig] = t.split(".");
    // swap the guide in the payload but keep the old signature
    const forged = Buffer.from(
      JSON.stringify({ userId: "user_1", guide: "combined", exp: NOW / 1000 + 999, kind: "fgd" }),
    ).toString("base64url");
    expect(verifyFieldGuideToken(`${forged}.${sig}`, NOW)).toBeNull();
    // and a bit-flipped signature
    expect(verifyFieldGuideToken(`${body}.${sig.slice(0, -1)}x`, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const t = signFieldGuideToken("user_1", "fundamentals", NOW);
    const eightDaysLater = NOW + 8 * 24 * 60 * 60 * 1000;
    expect(verifyFieldGuideToken(t, eightDaysLater)).toBeNull();
    // still valid a day before expiry
    expect(verifyFieldGuideToken(t, NOW + 6 * 24 * 60 * 60 * 1000)).not.toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyFieldGuideToken("", NOW)).toBeNull();
    expect(verifyFieldGuideToken("nodot", NOW)).toBeNull();
    expect(verifyFieldGuideToken(".sigonly", NOW)).toBeNull();
  });
});
