// resolveLearnerGuideProgress maps a learner's Enrollment.currentStage onto the
// 8-stage rail: stages already passed are complete (you can't advance without
// passing the gate), the current stage is in-progress, the rest are untouched.
// This is the learner's OWN journey — distinct from the revision-scoped author
// completion in resolveGuideProgress.
import { describe, it, expect } from "vitest";
import { resolveLearnerGuideProgress } from "@/lib/guide-progress";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";

describe("resolveLearnerGuideProgress", () => {
  it("passed → complete, current → partial, ahead → untouched", () => {
    const byStage = Object.fromEntries(
      resolveLearnerGuideProgress("SCHEMATIC").map((s) => [s.stage, s.state]),
    );
    expect(byStage.REQUIREMENTS).toBe("complete");
    expect(byStage.BOM_SOURCING).toBe("complete");
    expect(byStage.SCHEMATIC).toBe("partial");
    expect(byStage.LAYOUT).toBe("untouched");
    expect(byStage.BRINGUP).toBe("untouched");
  });

  it("marks the first stage in-progress at the start of the journey", () => {
    const p = resolveLearnerGuideProgress("REQUIREMENTS");
    expect(p[0]!.state).toBe("partial");
    expect(p.slice(1).every((s) => s.state === "untouched")).toBe(true);
  });

  it("marks every guide stage complete once advanced past the last (REVISION / completed)", () => {
    expect(
      resolveLearnerGuideProgress("REVISION").every((s) => s.state === "complete"),
    ).toBe(true);
  });

  it("marks everything untouched when there is no enrollment", () => {
    expect(
      resolveLearnerGuideProgress(null).every((s) => s.state === "untouched"),
    ).toBe(true);
  });

  it("returns all 8 guide stages in pipeline order with 0-based ordinals", () => {
    const p = resolveLearnerGuideProgress("LAYOUT");
    expect(p.map((s) => s.stage)).toEqual([...GUIDE_STAGES]);
    expect(p.map((s) => s.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
