// Tests for the KiCad ERC-report validator. Fixtures use the real KiCad report
// shape (summary line `** ERC messages: N Errors M Warnings K`). Policy: clean =
// zero ERRORS; warnings are counted but do not block.
import { describe, expect, test } from "vitest";
import { parseErcReport, validateErcReport } from "@/lib/kicad/erc-report";

const CLEAN = `ERC report (2024-04-22T18:38:28+0000, Encoding UTF8)
***** Sheet /
** ERC messages: 0 Errors 0 Warnings 0
`;

const DIRTY = `ERC report (Fri 21 Oct 2022 02:07:05 PM EDT, Encoding UTF8)
***** Sheet /
[pin_not_driven]: Input pin not driven by any Output pins ; Severity: error
@(149.86 mm, 60.96 mm): Symbol U1B [74LS00] Pin 4 [, Input, Line]
[pin_not_connected]: Pin not connected ; Severity: error
@(149.86 mm, 60.96 mm): Symbol U1B [74LS00] Pin 4 [, Input, Line]
** ERC messages: 2 Errors 3 Warnings 0
`;

const WARN_ONLY = `ERC report (2024-04-22T18:38:28+0000, Encoding UTF8)
***** Sheet /
[lib_symbol_mismatch]: Symbol doesn't match library ; Severity: warning
** ERC messages: 0 Errors 1 Warnings 0
`;

describe("parseErcReport", () => {
  test("reads the summary line counts", () => {
    expect(parseErcReport(CLEAN)).toEqual({ errors: 0, warnings: 0 });
    expect(parseErcReport(DIRTY)).toEqual({ errors: 2, warnings: 3 });
    expect(parseErcReport(WARN_ONLY)).toEqual({ errors: 0, warnings: 1 });
  });

  test("falls back to counting Severity markers when there's no summary line", () => {
    const noSummary = `Some ERC dump
[x]: msg ; Severity: error
[y]: msg ; Severity: warning
[z]: msg ; Severity: error`;
    expect(parseErcReport(noSummary)).toEqual({ errors: 2, warnings: 1 });
  });

  test("returns null for an unrelated / empty file", () => {
    expect(parseErcReport("")).toBeNull();
    expect(parseErcReport("hello world, not a report")).toBeNull();
  });
});

describe("validateErcReport", () => {
  test("clean report (0 errors) passes", () => {
    const v = validateErcReport(CLEAN);
    expect(v.ok).toBe(true);
    expect(v.detail).toBe("0 errors, 0 warnings");
  });

  test("errors block", () => {
    const v = validateErcReport(DIRTY);
    expect(v.ok).toBe(false);
    expect(v.detail).toBe("2 errors, 3 warnings");
  });

  test("warnings alone do NOT block (locked policy)", () => {
    const v = validateErcReport(WARN_ONLY);
    expect(v.ok).toBe(true);
    expect(v.detail).toBe("0 errors, 1 warning");
  });

  test("an unrecognizable file fails with a clear message, not a blind pass", () => {
    const v = validateErcReport("just some text");
    expect(v.ok).toBe(false);
    expect(v.detail).toMatch(/not a recognizable/i);
  });
});
