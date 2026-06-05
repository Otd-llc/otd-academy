// src/lib/__tests__/parts-list-url.test.ts
import { describe, test, expect } from "vitest";
import { partsHref } from "@/lib/parts-list-url";

describe("partsHref", () => {
  test("no params → /parts", () => {
    expect(partsHref({}, {})).toBe("/parts");
  });

  test("setting a filter drops the page param (reset to page 1)", () => {
    expect(partsHref({ q: "x", page: "5" }, { lifecycle: "EOL" })).toBe("/parts?q=x&lifecycle=EOL");
  });

  test("a page patch preserves existing filters", () => {
    const href = partsHref({ q: "10k", lifecycle: "ACTIVE" }, { page: "2" });
    expect(href).toBe("/parts?q=10k&lifecycle=ACTIVE&page=2");
  });

  test("empty-string or undefined patch value removes that key", () => {
    expect(partsHref({ q: "x", lifecycle: "EOL" }, { q: "" })).toBe("/parts?lifecycle=EOL");
    expect(partsHref({ mains: "1" }, { mains: undefined })).toBe("/parts");
  });
});
