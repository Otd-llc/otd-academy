import { describe, it, expect } from "vitest";
import { safeCallbackPath } from "@/lib/safe-callback";

// safeCallbackPath is the open-redirect guard for the post-auth ?callbackUrl.
// It must let legitimate in-app return paths through and reject anything that
// could send the browser to another origin.
describe("safeCallbackPath", () => {
  it("passes through legitimate same-origin relative paths", () => {
    for (const p of [
      "/start",
      "/learn/l1-01-wroom-breakout",
      "/projects/l1-01-wroom-breakout/v1/guide/SCHEMATIC",
      "/courses?ref=email",
      "/verify#cert",
    ]) {
      expect(safeCallbackPath(p)).toBe(p);
    }
  });

  it("falls back for non-strings and empties", () => {
    expect(safeCallbackPath(undefined)).toBe("/start");
    expect(safeCallbackPath(null)).toBe("/start");
    expect(safeCallbackPath(42)).toBe("/start");
    expect(safeCallbackPath("")).toBe("/start");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackPath("https://evil.com")).toBe("/start");
    expect(safeCallbackPath("http://evil.com/x")).toBe("/start");
    expect(safeCallbackPath("//evil.com")).toBe("/start");
    expect(safeCallbackPath("//evil.com/learn")).toBe("/start");
  });

  it("rejects backslash and encoded-slash smuggling", () => {
    expect(safeCallbackPath("/\\evil.com")).toBe("/start");
    expect(safeCallbackPath("/\\/evil.com")).toBe("/start");
    expect(safeCallbackPath("/%2fevil.com")).toBe("/start");
    expect(safeCallbackPath("/%2Fevil.com")).toBe("/start");
  });

  it("rejects whitespace and control characters", () => {
    expect(safeCallbackPath("/ /evil")).toBe("/start");
    expect(safeCallbackPath("/foo\nbar")).toBe("/start");
    expect(safeCallbackPath("  /leading-space")).toBe("/leading-space"); // trimmed then valid
  });

  it("honors a custom fallback", () => {
    expect(safeCallbackPath(null, "/")).toBe("/");
    expect(safeCallbackPath("//evil.com", "/courses")).toBe("/courses");
  });
});
