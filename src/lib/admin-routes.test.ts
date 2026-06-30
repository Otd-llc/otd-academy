import { describe, expect, it } from "vitest";
import { isPublicPath, isAdminOnlyPath } from "@/lib/admin-routes";

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
