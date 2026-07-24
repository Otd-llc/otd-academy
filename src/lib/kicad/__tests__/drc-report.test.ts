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

// KiCad 10 report shape: the severity ENDS the "Rule:" / "Local override" line
// as "; warning" / "; error" — there is no "Severity:" token. A real beginner
// board carries only cosmetic silk + lib-mismatch WARNINGS and must PASS.
const KICAD10_WARN = `** Drc report for board.kicad_pcb **
** Created on 2026-07-24T05:15:54 **
** Report includes: Errors, Warnings **

** Found 3 DRC violations **
[silk_edge_clearance]: Silkscreen clipped by board edge
    Rule: board setup constraints silk; warning
    @(81.6 mm, 75.9 mm): Segment of U1 on F.Silkscreen
[lib_footprint_mismatch]: Footprint 'X' does not match copy in library 'Y'
    Local override; warning
    @(96.6 mm, 83.4 mm): Footprint U1
[silk_overlap]: Silkscreen clearance (rule 'Pad to Silkscreen' clearance 0.15 mm; actual 0.02 mm)
    Rule: Pad to Silkscreen; warning
    @(99.6 mm, 125.2 mm): Segment of U2 on F.Silkscreen

** Found 0 unconnected pads **

** Found 0 Footprint errors **

** End of Report **
`;

// KiCad 10 with real errors: "Rule: <name>; error" / "Local override; error".
const KICAD10_ERR = `** Drc report for board.kicad_pcb **
** Found 2 DRC violations **
[drill_out_of_range]: Hole size out of range
    Rule: Pad Size; error
    @(96.5 mm, 86.5 mm): PTH pad 41 [GND] of U1
[clearance]: Clearance violation
    Rule: clearance; error
    @(1 mm, 1 mm): Track
** Found 1 unconnected pads **
[unconnected_items]: Missing connection
    Local override; error
    @(1 mm, 1 mm): Pad
** End of Report **
`;

describe("parseDrcReport", () => {
  test("counts error- and warning-severity markers", () => {
    expect(parseDrcReport(CLEAN)).toEqual({ errors: 0, warnings: 0 });
    expect(parseDrcReport(DIRTY)).toEqual({ errors: 3, warnings: 0 });
    expect(parseDrcReport(WARN_ONLY)).toEqual({ errors: 0, warnings: 1 });
  });

  test("reads the KiCad 10 '; <severity>' shape (no 'Severity:' token)", () => {
    // Regression: warnings must NOT be miscounted as errors (the summary
    // '** Found N **' lumps them together; only the per-line severity splits them).
    expect(parseDrcReport(KICAD10_WARN)).toEqual({ errors: 0, warnings: 3 });
    expect(parseDrcReport(KICAD10_ERR)).toEqual({ errors: 3, warnings: 0 });
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

  test("KiCad 10 warning-only board passes; KiCad 10 errors block", () => {
    const w = validateDrcReport(KICAD10_WARN);
    expect(w.ok).toBe(true);
    expect(w.detail).toBe("0 errors, 3 warnings");
    const e = validateDrcReport(KICAD10_ERR);
    expect(e.ok).toBe(false);
    expect(e.detail).toBe("3 errors, 0 warnings");
  });

  test("an unrecognizable file fails with a clear message, not a blind pass", () => {
    const v = validateDrcReport("just some text");
    expect(v.ok).toBe(false);
    expect(v.detail).toMatch(/not a recognizable/i);
  });
});
