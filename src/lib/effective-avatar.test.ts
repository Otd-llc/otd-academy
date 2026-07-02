import { describe, it, expect } from "vitest";
import { avatarSrc } from "./effective-avatar";

describe("avatarSrc", () => {
  it("prefers a custom avatar → the proxy URL with a cache-bust from the timestamp", () => {
    expect(avatarSrc("u1", new Date(1000), "https://p/img")).toBe(
      "/api/avatar/u1?v=1000",
    );
  });

  it("uses the custom avatar even when there's no provider image", () => {
    expect(avatarSrc("u1", new Date(5), null)).toBe("/api/avatar/u1?v=5");
  });

  it("falls back to the provider image when there's no custom avatar", () => {
    expect(avatarSrc("u1", null, "https://p/img")).toBe("https://p/img");
    expect(avatarSrc("u1", undefined, "https://p/img")).toBe("https://p/img");
  });

  it("returns null when there's neither (caller shows the initial)", () => {
    expect(avatarSrc("u1", null, null)).toBeNull();
    expect(avatarSrc("u1", undefined, undefined)).toBeNull();
  });
});
