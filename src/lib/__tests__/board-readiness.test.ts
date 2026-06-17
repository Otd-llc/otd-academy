import { describe, expect, test } from "vitest";
import { assessBoardReadiness, type BoardReadinessInput } from "@/lib/board-readiness";

const base: BoardReadinessInput = {
  hasDesignValidation: true,
  designValidationComplete: true,
  bomFrozenAt: new Date("2026-06-16"),
  bomLineCount: 5,
  lifecycleWarningCount: 0,
  unpricedCount: 0,
  overTarget: false,
  designDocPath: "docs/boards/x/design.md",
};

const req = (r: ReturnType<typeof assessBoardReadiness>, label: RegExp) =>
  r.checks.find((c) => label.test(c.label));

describe("assessBoardReadiness", () => {
  test("all four required checks pass → ready", () => {
    const r = assessBoardReadiness(base);
    expect(r.ready).toBe(true);
    expect(r.checks.filter((c) => c.tier === "required").every((c) => c.ok)).toBe(true);
  });

  test("no DESIGN_VALIDATION checklist → not ready", () => {
    const r = assessBoardReadiness({ ...base, hasDesignValidation: false });
    expect(r.ready).toBe(false);
    expect(req(r, /validated/i)!.ok).toBe(false);
  });

  test("DESIGN_VALIDATION incomplete → not ready", () => {
    const r = assessBoardReadiness({ ...base, designValidationComplete: false });
    expect(r.ready).toBe(false);
    expect(req(r, /validated/i)!.ok).toBe(false);
  });

  test("BOM not frozen → not ready", () => {
    const r = assessBoardReadiness({ ...base, bomFrozenAt: null });
    expect(r.ready).toBe(false);
    expect(req(r, /frozen/i)!.ok).toBe(false);
  });

  test("empty BOM → not ready", () => {
    const r = assessBoardReadiness({ ...base, bomLineCount: 0 });
    expect(r.ready).toBe(false);
    expect(req(r, /parts/i)!.ok).toBe(false);
  });

  test("an EOL part → not ready", () => {
    const r = assessBoardReadiness({ ...base, lifecycleWarningCount: 2 });
    expect(r.ready).toBe(false);
    expect(req(r, /end-of-life|EOL|lifecycle/i)!.ok).toBe(false);
  });

  test("info checks (unpriced / over-target) never affect ready", () => {
    const r = assessBoardReadiness({ ...base, unpricedCount: 3, overTarget: true });
    expect(r.ready).toBe(true);
    expect(r.checks.some((c) => c.tier === "info")).toBe(true);
  });

  test("a design-doc pointer info line is always present", () => {
    const r = assessBoardReadiness(base);
    expect(r.checks.some((c) => c.tier === "info" && /design doc/i.test(c.label))).toBe(true);
  });
});
