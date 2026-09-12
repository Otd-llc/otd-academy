// The endpoint choice, tested where it can be tested.
//
// `r2` is constructed once at module scope from the real `env`, so which host it
// dials is not observable from a test that imports it. `s3Target` lives in its own
// import-free module so this file does not pull the AWS SDK graph in behind it;
// these assert the two things that would break silently: production must keep
// deriving the Cloudflare host, and the CI override must switch on path-style
// addressing at the same time.
import { describe, expect, test } from "vitest";
import { s3Target } from "@/lib/r2-target";

describe("s3Target", () => {
  test("with no override, derives the Cloudflare host from the account id", () => {
    expect(s3Target({ R2_ACCOUNT_ID: "acct123" })).toEqual({
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      forcePathStyle: false,
    });
  });

  test("an override wins, and forces path style with it", () => {
    // Coupled deliberately: virtual-host addressing resolves `<bucket>.localhost`,
    // which does not exist, and the failure reads as a bucket problem rather than
    // an addressing one. Tying the flag to the override makes the pair unsettable
    // inconsistently.
    expect(
      s3Target({ R2_ENDPOINT: "http://localhost:9000", R2_ACCOUNT_ID: "acct123" }),
    ).toEqual({ endpoint: "http://localhost:9000", forcePathStyle: true });
  });

  test("an empty override is not an override", () => {
    // Belt-and-braces, not the primary guard: `@/env` types R2_ENDPOINT as
    // `z.string().url().optional()`, so "" fails validation at import and never
    // reaches here. That is the louder failure and the right one -- an unset
    // GitHub secret interpolates to "" and would otherwise silently dial nowhere.
    // This asserts the function is still safe if it is ever called directly.
    expect(s3Target({ R2_ENDPOINT: "", R2_ACCOUNT_ID: "acct123" }).endpoint).toBe(
      "https://acct123.r2.cloudflarestorage.com",
    );
  });
});
