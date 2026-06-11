// Tests for the KiCad DRC-report validator. Fixtures use the real KiCad report
// shape (summary lines `** Found N … **`). Policy: clean = zero violations.
import { describe, expect, test } from "vitest";
import { parseDrcReport, validateDrcReport } from "@/lib/kicad/drc-report";

const CLEAN = `** Drc report for board.kicad_pcb **
** Created on 2024-04-22T18:38:28+0000 **

** Found 0 DRC violations **

** Found 0 unconnected items **

** Found 0 schematic parity issues **

** End of Report **
`;

const DIRTY = `** Drc report for board.kicad_pcb **
** Created on 2024-04-22T18:38:28+0000 **

** Found 2 DRC violations **
[clearance]: Clearance violation (board minimum 0.2 mm) ; Severity: error
@(120.0 mm, 60.0 mm): Track ; Net "GND"
[track_width]: Track width 0.1 mm, minimum 0.15 mm ; Severity: error
@(121.0 mm, 61.0 mm): Track ; Net "+3V3"

** Found 1 unconnected items **
[unconnected_items]: Missing connection ; Severity: error

** Found 0 schematic parity issues **

** End of Report **
`;

describe("parseDrcReport", () => {
  test("sums every 'Found N' summary line", () => {
    expect(parseDrcReport(CLEAN)).toEqual({ violations: 0 });
    expect(parseDrcReport(DIRTY)).toEqual({ violations: 3 });
  });

  test("falls back to counting Severity markers when there's no summary line", () => {
    const noSummary = `Some DRC dump
[x]: msg ; Severity: error
[y]: msg ; Severity: error`;
    expect(parseDrcReport(noSummary)).toEqual({ violations: 2 });
  });

  test("returns null for an unrelated / empty file", () => {
    expect(parseDrcReport("")).toBeNull();
    expect(parseDrcReport("hello world, not a report")).toBeNull();
  });
});

describe("validateDrcReport", () => {
  test("clean report (0 violations) passes", () => {
    const v = validateDrcReport(CLEAN);
    expect(v.ok).toBe(true);
    expect(v.detail).toBe("0 violations");
  });

  test("violations block", () => {
    const v = validateDrcReport(DIRTY);
    expect(v.ok).toBe(false);
    expect(v.detail).toBe("3 violations");
  });

  test("an unrecognizable file fails with a clear message, not a blind pass", () => {
    const v = validateDrcReport("just some text");
    expect(v.ok).toBe(false);
    expect(v.detail).toMatch(/not a recognizable/i);
  });
});
