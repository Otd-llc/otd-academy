import { describe, expect, it } from "vitest";
import { isPublicPath, isAdminOnlyPath } from "@/lib/admin-routes";

describe("saved hex-cluster path gating", () => {
  it("a shared build page is public — it is what a printed QR resolves to", () => {
    // A scanned sheet that 307s to /sign-in is a dead drawing.
    expect(isPublicPath("/c/zK3pQ7wR2fL9xN4vB8tCmA")).toBe(true);
  });

  it("the save page is public-ELIGIBLE, because it gates itself in-page", () => {
    // Middleware would redirect before any page JS runs, and the build being
    // saved lives in the URL fragment — which an island has to stash across
    // the magic-link round trip.
    expect(isPublicPath("/account/hex-clusters/save")).toBe(true);
  });

  it("the rest of the account area stays gated", () => {
    expect(isPublicPath("/account")).toBe(false);
    expect(isPublicPath("/account/hex-clusters")).toBe(false);
    // ONE page, not a prefix: a nested path under save does not slip through.
    expect(isPublicPath("/account/hex-clusters/save/extra")).toBe(false);
    expect(isPublicPath("/account/billing")).toBe(false);
  });

  it("does not open /courses or /checkout by sharing the /c prefix", () => {
    // The robots Disallow carries a trailing slash for the same reason.
    expect(isPublicPath("/courses")).toBe(true); // public for its own reason
    expect(isAdminOnlyPath("/c/abc")).toBe(false);
  });
});

describe("library path gating", () => {
  it("the library index is public", () => {
    expect(isPublicPath("/library")).toBe(true);
  });
  it("a library article is public", () => {
    expect(isPublicPath("/library/motor-imagery-bci")).toBe(true);
  });
  it("the admin authoring route is NOT public and IS admin-only", () => {
    expect(isPublicPath("/admin/library")).toBe(false);
    expect(isAdminOnlyPath("/admin/library")).toBe(true); // already covered by the top==="admin" rule
  });
  it("the glossary index is public", () => {
    expect(isPublicPath("/glossary")).toBe(true);
  });
  it("the tools hub and an embed widget are public", () => {
    expect(isPublicPath("/tools")).toBe(true);
    expect(isPublicPath("/tools/resistor-power")).toBe(true);
    expect(isPublicPath("/embed/resistor-power")).toBe(true);
  });
});
