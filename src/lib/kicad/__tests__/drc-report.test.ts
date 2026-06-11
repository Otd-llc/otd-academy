// Tests for the KiCad DRC-report validator. Fixtures use the real KiCad report
// shape (`** Found N … **` summaries + per-violation `Severity:` markers). Policy
// MIRRORS ERC: clean = zero ERRORS; warnings are counted but do not block.
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

// A real-world beginner case: only harmless warning-severity flags (silk over a
// pad). These are counted but must NOT block — the layout is fundamentally fine.
const WARN_ONLY = `** Drc report for board.kicad_pcb **
** Created on 2024-04-22T18:38:28+0000 **

** Found 1 DRC violations **
[silk_over_copper]: Silkscreen overlaps with pad ; Severity: warning
@(40.0 mm, 12.0 mm): Footprint J1 ; Pad 1

** Found 0 unconnected items **

** Found 0 schematic parity issues **

** End of Report **
`;

describe("parseDrcReport", () => {
  test("counts error- and warning-severity markers", () => {
    expect(parseDrcReport(CLEAN)).toEqual({ errors: 0, warnings: 0 });
    expect(parseDrcReport(DIRTY)).toEqual({ errors: 3, warnings: 0 });
    expect(parseDrcReport(WARN_ONLY)).toEqual({ errors: 0, warnings: 1 });
  });

  test("falls back to summing 'Found N' as errors when there's no severity line", () => {
    const noSeverity = `** Drc report **
** Found 2 DRC violations **
** Found 1 unconnected items **`;
    expect(parseDrcReport(noSeverity)).toEqual({ errors: 3, warnings: 0 });
  });

  test("returns null for an unrelated / empty file", () => {
    expect(parseDrcReport("")).toBeNull();
    expect(parseDrcReport("hello world, not a report")).toBeNull();
  });
});

describe("validateDrcReport", () => {
  test("clean report (0 errors) passes", () => {
    const v = validateDrcReport(CLEAN);
    expect(v.ok).toBe(true);
    expect(v.detail).toBe("0 errors, 0 warnings");
  });

  test("errors block", () => {
    const v = validateDrcReport(DIRTY);
    expect(v.ok).toBe(false);
    expect(v.detail).toBe("3 errors, 0 warnings");
  });

  test("warnings alone do NOT block (matches the ERC policy)", () => {
    const v = validateDrcReport(WARN_ONLY);
    expect(v.ok).toBe(true);
    expect(v.detail).toBe("0 errors, 1 warning");
  });

  test("an unrecognizable file fails with a clear message, not a blind pass", () => {
    const v = validateDrcReport("just some text");
    expect(v.ok).toBe(false);
    expect(v.detail).toMatch(/not a recognizable/i);
  });
});
