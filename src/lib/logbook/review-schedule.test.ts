import { describe, it, expect } from "vitest";
import {
  reviewItemId,
  initialSchedule,
  advanceSchedule,
  REVIEW_LADDER,
} from "@/lib/logbook/review-schedule";

const NOON = new Date("2026-07-21T18:00:00Z"); // 13:00 America/Chicago
// academyDate(NOON) = 2026-07-21T00:00:00Z
const DAY0 = Date.parse("2026-07-21T00:00:00Z");
const days = (n: number) => new Date(DAY0 + n * 86400_000);

describe("reviewItemId", () => {
  it("is revision-independent and globally scoped by project+stage", () => {
    expect(reviewItemId("l1-01", "SCHEMATIC", "ldo-output-cap")).toBe(
      "l1-01:SCHEMATIC:ldo-output-cap",
    );
    // The same reviewId in a different project/stage is a DIFFERENT item.
    expect(reviewItemId("l1-02", "SCHEMATIC", "ldo-output-cap")).not.toBe(
      reviewItemId("l1-01", "SCHEMATIC", "ldo-output-cap"),
    );
  });
});

describe("initialSchedule", () => {
  it("seeds due one ladder-step out, interval 1, no lapses", () => {
    const s = initialSchedule(NOON);
    expect(s.intervalDays).toBe(REVIEW_LADDER[0]);
    expect(s.dueOn).toEqual(days(REVIEW_LADDER[0]));
    expect(s.lapses).toBe(0);
    expect(s.suspended).toBe(false);
  });
});

describe("advanceSchedule", () => {
  it("climbs the ladder on a correct answer (jitter 1 = deterministic)", () => {
    const s = advanceSchedule(
      { intervalDays: 1, lapses: 0, suspended: false },
      true,
      NOON,
      1,
    );
    expect(s.intervalDays).toBe(3); // 1 -> 3
    expect(s.dueOn).toEqual(days(3));
    expect(s.lapses).toBe(0);
  });

  it("graduates past the top of the ladder (60 -> ~150)", () => {
    const s = advanceSchedule(
      { intervalDays: 60, lapses: 0, suspended: false },
      true,
      NOON,
      1,
    );
    expect(s.intervalDays).toBe(150); // round(60 * 2.5)
  });

  it("steps DOWN on a miss (not reset to 1) and counts a lapse", () => {
    const s = advanceSchedule(
      { intervalDays: 21, lapses: 0, suspended: false },
      false,
      NOON,
      1,
    );
    expect(s.intervalDays).toBe(8); // round(21 * 0.4)
    expect(s.lapses).toBe(1);
    expect(s.suspended).toBe(false);
  });

  it("suspends as a leech after repeated lapses", () => {
    const s = advanceSchedule(
      { intervalDays: 3, lapses: 7, suspended: false },
      false,
      NOON,
      1,
    );
    expect(s.lapses).toBe(8);
    expect(s.suspended).toBe(true);
  });

  it("applies jitter but never drops below 1 day", () => {
    const lo = advanceSchedule({ intervalDays: 1, lapses: 0, suspended: false }, true, NOON, 0.85);
    expect(lo.intervalDays).toBeGreaterThanOrEqual(1);
    const hi = advanceSchedule({ intervalDays: 7, lapses: 0, suspended: false }, true, NOON, 1.15);
    // 7 -> 21, jittered up ~15%: round(21 * 1.15) = 24
    expect(hi.intervalDays).toBe(24);
  });

  it("a suspended item stays suspended even on a correct answer", () => {
    const s = advanceSchedule(
      { intervalDays: 7, lapses: 8, suspended: true },
      true,
      NOON,
      1,
    );
    expect(s.suspended).toBe(true);
  });
});
