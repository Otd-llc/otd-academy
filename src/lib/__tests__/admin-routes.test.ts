// Route classification behind the middleware (proxy.ts):
//  - isAdminOnlyPath: operator/authoring surfaces only a signed-in ADMIN may see.
//  - isPublicPath:    surfaces viewable by ANYONE incl. signed-out (the parts
//                     catalog — public for SEO / eye candy).
// The learner-facing guide lives UNDER /projects/[slug]/[rev]/guide and must
// stay reachable by learners; the parts CREATE form (/parts/new) is admin-only
// even though the catalog around it is public.
import { describe, it, expect } from "vitest";
import { isAdminOnlyPath, isPublicPath } from "@/lib/admin-routes";

describe("isAdminOnlyPath", () => {
  it("gates the curriculum surface", () => {
    expect(isAdminOnlyPath("/curriculum")).toBe(true);
    expect(isAdminOnlyPath("/curriculum/anything")).toBe(true);
  });

  it("gates ONLY the parts create form — the catalog list/detail are public", () => {
    expect(isAdminOnlyPath("/parts/new")).toBe(true);
    expect(isAdminOnlyPath("/parts")).toBe(false);
    expect(isAdminOnlyPath("/parts/abc123")).toBe(false);
  });

  it("gates the project lifecycle (detail / revision / builds / new forms)", () => {
    expect(isAdminOnlyPath("/projects/new")).toBe(true);
    expect(isAdminOnlyPath("/projects/wroom")).toBe(true);
    expect(isAdminOnlyPath("/projects/wroom/v1")).toBe(true);
    expect(isAdminOnlyPath("/projects/wroom/v1/builds/new")).toBe(true);
    expect(isAdminOnlyPath("/projects/wroom/revisions/new")).toBe(true);
    expect(isAdminOnlyPath("/projects/wroom/v1/errata/new")).toBe(true);
  });

  it("does NOT gate the learner guide hub or cards (under /projects/.../guide)", () => {
    expect(isAdminOnlyPath("/projects/wroom/v1/guide")).toBe(false);
    expect(isAdminOnlyPath("/projects/wroom/v1/guide/REQUIREMENTS")).toBe(false);
  });

  it("does NOT gate a project whose slug merely contains 'guide'", () => {
    expect(isAdminOnlyPath("/projects/guide/v1")).toBe(true);
  });

  it("does NOT gate learner-facing or neutral routes", () => {
    expect(isAdminOnlyPath("/")).toBe(false);
    expect(isAdminOnlyPath("/learn")).toBe(false);
    expect(isAdminOnlyPath("/learn/wroom")).toBe(false);
    expect(isAdminOnlyPath("/sign-in")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("treats the parts catalog list + detail as public (anonymous / SEO)", () => {
    expect(isPublicPath("/parts")).toBe(true);
    expect(isPublicPath("/parts/abc123")).toBe(true);
  });

  it("does NOT treat the parts create form as public", () => {
    expect(isPublicPath("/parts/new")).toBe(false);
  });

  it("admits guide routes (page enforces accessTier) and /courses", () => {
    expect(isPublicPath("/projects/wroom/v1/guide")).toBe(true);
    expect(isPublicPath("/projects/wroom/v1/guide/REQUIREMENTS")).toBe(true);
    expect(isPublicPath("/courses")).toBe(true);
    expect(isPublicPath("/courses/anything")).toBe(true);
  });

  it("still does not admit non-guide project routes", () => {
    expect(isPublicPath("/projects/wroom/v1")).toBe(false);
    expect(isPublicPath("/projects/new")).toBe(false);
  });

  it("admits the home page (it forwards anonymous visitors to /courses)", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("does NOT treat operator or learner routes as public", () => {
    expect(isPublicPath("/curriculum")).toBe(false);
    expect(isPublicPath("/projects/wroom/v1")).toBe(false);
    expect(isPublicPath("/learn")).toBe(false);
  });
});
