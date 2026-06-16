import { describe, it, expect } from "vitest";
import { affiliateLink } from "@/lib/affiliates";

describe("affiliateLink", () => {
  it("resolves the jlcpcb vendor to a fallback URL when unconfigured", () => {
    const link = affiliateLink("jlcpcb");
    expect(link.href).toContain("jlcpcb.com");
    expect(link.tracked).toBe(false);
  });
});
