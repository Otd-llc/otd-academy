import { describe, it, expect } from "vitest";
import { pickVerifiedGithubEmail } from "@/lib/github-verified-email";

// GitHub's OAuth profile carries no "verified" flag, so auth.ts resolves the
// account email from /user/emails. The identity MUST be the VERIFIED PRIMARY
// email — never a secondary, never an unverified one — so that cross-provider
// account-linking happens on the address the user considers their GitHub
// identity. Anything else returns undefined → the sign-in guard rejects.
describe("pickVerifiedGithubEmail", () => {
  it("returns the verified primary email", () => {
    expect(
      pickVerifiedGithubEmail([
        { email: "secondary@example.com", primary: false, verified: true },
        { email: "raven@example.com", primary: true, verified: true },
      ]),
    ).toBe("raven@example.com");
  });

  it("returns undefined when the primary is unverified (does NOT fall back to a verified secondary)", () => {
    expect(
      pickVerifiedGithubEmail([
        { email: "raven@example.com", primary: true, verified: false },
        { email: "secondary@example.com", primary: false, verified: true },
      ]),
    ).toBeUndefined();
  });

  it("returns undefined when there is no primary entry", () => {
    expect(
      pickVerifiedGithubEmail([
        { email: "a@example.com", primary: false, verified: true },
      ]),
    ).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    expect(pickVerifiedGithubEmail([])).toBeUndefined();
  });

  it("is defensive against a non-array body (GitHub error object)", () => {
    // The caller only parses on res.ok, but GitHub can still return a non-array
    // JSON body; treat anything that isn't an array as "no verified email".
    expect(pickVerifiedGithubEmail({ message: "Bad credentials" } as never)).toBeUndefined();
    expect(pickVerifiedGithubEmail(undefined as never)).toBeUndefined();
  });
});
