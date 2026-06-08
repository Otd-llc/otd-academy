// Where a learner lands after advanceEnrollment succeeds: the next stage's guide
// card when it has one, else the learn dashboard (advancing into the terminal
// REVISION stage completes the enrollment — REVISION is not a guide card).
import { describe, it, expect } from "vitest";
import { advanceTargetHref } from "@/lib/learner-advance-nav";

const GUIDE_STAGES = [
  "REQUIREMENTS",
  "BOM_SOURCING",
  "SCHEMATIC",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
];
const BASE = "/projects/wroom/v1/guide";

describe("advanceTargetHref", () => {
  it("navigates to the next stage card when it is a guide stage", () => {
    expect(advanceTargetHref("BOM_SOURCING", GUIDE_STAGES, BASE, "/learn")).toBe(
      "/projects/wroom/v1/guide/BOM_SOURCING",
    );
  });

  it("navigates to a later guide stage card", () => {
    expect(advanceTargetHref("SCHEMATIC", GUIDE_STAGES, BASE, "/learn")).toBe(
      "/projects/wroom/v1/guide/SCHEMATIC",
    );
  });

  it("falls back to the completed dashboard for the terminal REVISION stage", () => {
    expect(advanceTargetHref("REVISION", GUIDE_STAGES, BASE, "/learn")).toBe(
      "/learn",
    );
  });
});
