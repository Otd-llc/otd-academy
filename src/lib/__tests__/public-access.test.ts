import { describe, it, expect } from "vitest";
import { resolvePublicLessonAccess } from "@/lib/public-access";

describe("resolvePublicLessonAccess", () => {
  it("allows any signed-in user (role logic handles the rest)", () => {
    expect(resolvePublicLessonAccess({ hasSession: true, accessTier: "FREE" })).toBe("allow");
    expect(resolvePublicLessonAccess({ hasSession: true, accessTier: "PREMIUM" })).toBe("allow");
  });
  it("allows anonymous ONLY on PUBLIC projects", () => {
    expect(resolvePublicLessonAccess({ hasSession: false, accessTier: "PUBLIC" })).toBe("allow");
  });
  it("redirects anonymous on non-PUBLIC projects", () => {
    expect(resolvePublicLessonAccess({ hasSession: false, accessTier: "FREE" })).toBe("redirectSignIn");
    expect(resolvePublicLessonAccess({ hasSession: false, accessTier: "PREMIUM" })).toBe("redirectSignIn");
  });
});
