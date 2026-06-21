import { describe, expect, test } from "vitest";
import { httpUrlOrNull } from "@/lib/safe-url";

describe("httpUrlOrNull", () => {
  test("passes http(s) URLs through", () => {
    expect(httpUrlOrNull("https://example.com/ds.pdf")).toBe("https://example.com/ds.pdf");
    expect(httpUrlOrNull("http://x.test")).toBe("http://x.test");
    expect(httpUrlOrNull("  https://trim.me  ")).toBe("https://trim.me");
  });

  test("rejects non-http schemes (XSS hardening)", () => {
    expect(httpUrlOrNull("javascript:alert(1)")).toBeNull();
    expect(httpUrlOrNull("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(httpUrlOrNull("JavaScript:alert(1)")).toBeNull();
    expect(httpUrlOrNull("/relative/path")).toBeNull();
    expect(httpUrlOrNull("ftp://x")).toBeNull();
  });

  test("handles null/undefined/empty", () => {
    expect(httpUrlOrNull(null)).toBeNull();
    expect(httpUrlOrNull(undefined)).toBeNull();
    expect(httpUrlOrNull("")).toBeNull();
  });
});
