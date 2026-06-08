import { describe, it, expect } from "vitest";
import {
  resolvePublicLessonAccess,
  resolveLessonAccess,
} from "@/lib/public-access";

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

describe("resolveLessonAccess", () => {
  const base = {
    cardOrdinal: 0,
    hasSession: false,
    hasEntitlement: false,
    isAdmin: false,
  };

  it("always allows an admin (any tier / any card)", () => {
    expect(
      resolveLessonAccess({
        ...base,
        accessTier: "PREMIUM",
        cardOrdinal: 5,
        isAdmin: true,
      }),
    ).toBe("allow");
  });

  it("always allows PUBLIC (any card, signed in or not)", () => {
    expect(resolveLessonAccess({ ...base, accessTier: "PUBLIC" })).toBe("allow");
    expect(
      resolveLessonAccess({ ...base, accessTier: "PUBLIC", cardOrdinal: 9 }),
    ).toBe("allow");
  });

  it("FREE needs a session", () => {
    expect(resolveLessonAccess({ ...base, accessTier: "FREE" })).toBe(
      "redirectSignIn",
    );
    expect(
      resolveLessonAccess({ ...base, accessTier: "FREE", hasSession: true }),
    ).toBe("allow");
  });

  it("PREMIUM: entitled allows, card 0 is the free preview, rest paywall", () => {
    expect(
      resolveLessonAccess({
        ...base,
        accessTier: "PREMIUM",
        hasEntitlement: true,
        cardOrdinal: 4,
      }),
    ).toBe("allow");
    expect(
      resolveLessonAccess({ ...base, accessTier: "PREMIUM", cardOrdinal: 0 }),
    ).toBe("allow");
    expect(
      resolveLessonAccess({ ...base, accessTier: "PREMIUM", cardOrdinal: 1 }),
    ).toBe("paywall");
    // a session alone (without an entitlement) does NOT unlock a premium card 1+
    expect(
      resolveLessonAccess({
        ...base,
        accessTier: "PREMIUM",
        cardOrdinal: 1,
        hasSession: true,
      }),
    ).toBe("paywall");
  });
});
