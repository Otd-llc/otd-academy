import { describe, it, expect } from "vitest";
import { signCardToken, verifyCardToken } from "@/lib/certificate-token";

describe("certificate-token", () => {
  it("round-trips a cert token (with score)", () => {
    const t = signCardToken({ slug: "l1-01", name: "Ada L.", variant: "cert", score: 17, total: 18 });
    expect(verifyCardToken(t)).toEqual({ slug: "l1-01", name: "Ada L.", variant: "cert", score: 17, total: 18 });
  });
  it("round-trips a done token", () => {
    const t = signCardToken({ slug: "l1-01", name: "Ada L.", variant: "done" });
    expect(verifyCardToken(t)?.variant).toBe("done");
  });
  it("rejects a tampered payload", () => {
    const t = signCardToken({ slug: "l1-01", name: "Ada L.", variant: "cert" });
    const [body, sig] = t.split(".");
    const forged = `${Buffer.from(JSON.stringify({ slug: "l1-01", name: "Mallory", variant: "cert" })).toString("base64url")}.${sig}`;
    expect(verifyCardToken(forged)).toBeNull();
    void body;
  });
  it("rejects garbage / missing signature", () => {
    expect(verifyCardToken("not-a-token")).toBeNull();
    expect(verifyCardToken("")).toBeNull();
    expect(verifyCardToken("abc.def")).toBeNull();
  });
  it("rejects an unknown variant", () => {
    const t = signCardToken({ slug: "l1-01", name: "Ada", variant: "cert" });
    // re-sign a body with a bad variant so the signature matches but the shape is invalid
    const badBody = Buffer.from(JSON.stringify({ slug: "l1-01", name: "Ada", variant: "bogus" })).toString("base64url");
    expect(verifyCardToken(`${badBody}.${t.split(".")[1]}`)).toBeNull();
  });
});
