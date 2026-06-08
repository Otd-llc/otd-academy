import { describe, it, expect } from "vitest";
import { STAGE_CARD_SKELETONS, GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";

describe("stage skeletons", () => {
  it("covers exactly the 8 design->bringup stages (REVISION excluded)", () => {
    expect(GUIDE_STAGES).toEqual([
      "REQUIREMENTS",
      "BOM_SOURCING",
      "SCHEMATIC",
      "LAYOUT",
      "DRC_GERBER",
      "ORDERING",
      "ASSEMBLY",
      "BRINGUP",
    ]);
  });
  it("gives REQUIREMENTS a revisionChecklist completionRef", () => {
    expect(STAGE_CARD_SKELETONS.REQUIREMENTS.completionRef).toEqual({
      kind: "revisionChecklist",
      subkind: "REQUIREMENTS_REVIEW",
    });
  });
  it("gives ASSEMBLY a buildChecklist completionRef", () => {
    expect(STAGE_CARD_SKELETONS.ASSEMBLY.completionRef?.kind).toBe("buildChecklist");
    expect((STAGE_CARD_SKELETONS.ASSEMBLY.completionRef as any).subkind).toBe("POST_ASSEMBLY_CONTINUITY");
  });
  it("marks gate stages isGate", () => {
    expect(STAGE_CARD_SKELETONS.LAYOUT.isGate).toBe(true);
  });
});
