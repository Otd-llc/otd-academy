// isAdminOnlyPath decides which routes the middleware gate restricts to ADMINs.
// Operator/authoring surfaces (curriculum, parts, the project lifecycle) are
// admin-only; the learner-facing guide lives UNDER /projects/[slug]/[rev]/guide
// and must stay reachable by learners.
import { describe, it, expect } from "vitest";
import { isAdminOnlyPath } from "@/lib/admin-routes";

describe("isAdminOnlyPath", () => {
  it("gates the curriculum surface", () => {
    expect(isAdminOnlyPath("/curriculum")).toBe(true);
    expect(isAdminOnlyPath("/curriculum/anything")).toBe(true);
  });

  it("gates the parts surface", () => {
    expect(isAdminOnlyPath("/parts")).toBe(true);
    expect(isAdminOnlyPath("/parts/abc123")).toBe(true);
    expect(isAdminOnlyPath("/parts/new")).toBe(true);
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
    // The guide exemption keys on the path POSITION, not the substring, so an
    // unlucky slug doesn't accidentally open the operator pages to learners.
    expect(isAdminOnlyPath("/projects/guide/v1")).toBe(true);
  });

  it("does NOT gate learner-facing or neutral routes", () => {
    expect(isAdminOnlyPath("/")).toBe(false);
    expect(isAdminOnlyPath("/learn")).toBe(false);
    expect(isAdminOnlyPath("/learn/wroom")).toBe(false);
    expect(isAdminOnlyPath("/sign-in")).toBe(false);
  });
});
