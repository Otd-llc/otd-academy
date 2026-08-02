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

describe("hex spec page gating", () => {
  it("/hex is public — an immutable LICENSE.txt cites it as the CC BY source", () => {
    // Every published .3mf/.stl/.step carries
    //   Source: https://academy.onethousanddrones.com/hex
    // and those objects cannot be un-published. If this 307s to /sign-in, every
    // attribution in the wild points at a redirect.
    expect(isPublicPath("/hex")).toBe(true);
    expect(isAdminOnlyPath("/hex")).toBe(false);
  });

  it("opens exactly that page, not a prefix", () => {
    // Nothing is nested under /hex today. A child must be added deliberately.
    expect(isPublicPath("/hex/parts")).toBe(false);
    expect(isPublicPath("/hex/2026-07-31/downloads")).toBe(false);
  });

  it("does not leak the signed-in hex-cluster surfaces", () => {
    expect(isPublicPath("/account/hex-clusters")).toBe(false);
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
