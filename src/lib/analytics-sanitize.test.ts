// The scrubber every page view passes through. The certificate cases are the
// reason it exists: both the title and the token in the path carry the
// learner's name, so neither may reach analytics.
import { describe, expect, it } from "vitest";
import { sanitizePage, sanitizeUrl } from "@/lib/analytics-sanitize";

const ORIGIN = "https://academy.onethousanddrones.com";
// A real-shaped card token: base64url JSON (with a name) + "." + signature.
const TOKEN = `${Buffer.from(JSON.stringify({ slug: "l1-01", name: "Ada Lovelace" })).toString("base64url")}.sig_abc`;

describe("sanitizePage", () => {
  it("strips the certificate token from the path and the name from the title", () => {
    const p = sanitizePage(
      `${ORIGIN}/learn/l1-01-wroom-breakout/certificate/${TOKEN}`,
      "Ada Lovelace · Verified Certificate of Achievement",
    );
    expect(p.location).toBe(`${ORIGIN}/learn/l1-01-wroom-breakout/certificate/[token]`);
    expect(p.title).toBe("Certificate · One Thousand Drones Academy");
    expect(JSON.stringify(p)).not.toMatch(/Ada|Lovelace|sig_abc/);
  });

  it("keeps a sub-path after the token (image / pdf) but not the token", () => {
    expect(sanitizeUrl(`/learn/x/certificate/${TOKEN}/pdf`)).toBe(
      `${ORIGIN}/learn/x/certificate/[token]/pdf`,
    );
  });

  it("drops lookup codes and secrets from the query, keeps the rest", () => {
    expect(sanitizeUrl(`${ORIGIN}/verify?code=OTD-1234-ABCD`)).toBe(`${ORIGIN}/verify`);
    expect(sanitizeUrl(`${ORIGIN}/checkout/success?session_id=cs_live_1`)).toBe(
      `${ORIGIN}/checkout/success`,
    );
    expect(
      sanitizeUrl(`${ORIGIN}/parts?q=esp32&cat=mcu&email=a%40b.c&callbackUrl=%2Flearn`),
    ).toBe(`${ORIGIN}/parts?q=esp32&cat=mcu`);
  });

  it("leaves ordinary pages untouched", () => {
    const p = sanitizePage(`${ORIGIN}/library/what-is-an-ldo?ref=nav`, "What is an LDO");
    expect(p).toEqual({ location: `${ORIGIN}/library/what-is-an-ldo?ref=nav`, title: "What is an LDO" });
  });
});
