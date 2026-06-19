import { describe, expect, test } from "vitest";
import {
  boardReadinessFromRows,
  failingRequiredCount,
  type BoardReadinessRows,
} from "@/lib/board-readiness-load";

const dkNull = { dkInStock: null, dkLifecycle: null, dkCheckedAt: null };

const ready: BoardReadinessRows = {
  bomFrozenAt: new Date("2026-06-16"),
  bomLines: [
    { quantity: 2, unitPriceCents: 150, part: { lifecycle: "ACTIVE", ...dkNull } },
    { quantity: 1, unitPriceCents: 99, part: { lifecycle: "ACTIVE", ...dkNull } },
  ],
  checklists: [
    {
      subkind: "DESIGN_VALIDATION",
      items: [
        { checked: true, notApplicable: false },
        { checked: false, notApplicable: true },
      ],
    },
  ],
  projectSlug: "esp32-sensor-breakout",
  targetCost: "10.00",
};

describe("boardReadinessFromRows", () => {
  test("a ready set → ready: true, no failing required checks", () => {
    const r = boardReadinessFromRows(ready);
    expect(r.ready).toBe(true);
    expect(failingRequiredCount(r)).toBe(0);
  });

  test("unfrozen BOM → ready: false (and counted)", () => {
    const r = boardReadinessFromRows({ ...ready, bomFrozenAt: null });
    expect(r.ready).toBe(false);
    expect(failingRequiredCount(r)).toBeGreaterThan(0);
  });

  test("an EOL part → ready: false", () => {
    const r = boardReadinessFromRows({
      ...ready,
      bomLines: [
        { quantity: 2, unitPriceCents: 150, part: { lifecycle: "ACTIVE", ...dkNull } },
        { quantity: 1, unitPriceCents: 99, part: { lifecycle: "EOL", ...dkNull } },
      ],
    });
    expect(r.ready).toBe(false);
    expect(failingRequiredCount(r)).toBeGreaterThan(0);
  });
});
