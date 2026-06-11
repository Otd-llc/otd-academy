// Parse a KiCad DRC report (.rpt text) and decide whether it "passes muster".
// A clean DRC means ZERO violations. KiCad writes one or more summary lines,
// stable across KiCad 6–10 in the "** Found N … **" form:
//   ** Found 0 DRC violations **
//   ** Found 0 unconnected items **
//   ** Found 0 schematic parity issues **   ← clean (all zero)
//   ** Found 3 DRC violations **            ← dirty
// We sum every "Found N", so DRC violations + unconnected items + parity issues
// all count toward the total. This is the layout-stage analog of erc-report.ts
// (the SCHEMATIC gate). PURE: no DB / IO.

export interface DrcCounts {
  violations: number;
}

// Every KiCad DRC summary line: "** Found <n> <kind> **".
const FOUND_RE = /\*\*\s*Found\s+(\d+)\b/gi;

/**
 * Total DRC violations from a report (summing every "Found N" summary line), or
 * null when the text isn't a recognizable DRC report — so a random/empty file
 * fails loudly rather than passing blind.
 */
export function parseDrcReport(text: string): DrcCounts | null {
  const found = [...text.matchAll(FOUND_RE)];
  if (found.length > 0) {
    return { violations: found.reduce((n, m) => n + Number(m[1]), 0) };
  }
  // Fallback for exports without the summary lines: count per-violation severity
  // markers — but only trust it if the file is plausibly DRC output.
  if (!/\bDRC\b|Drc report|design rule/i.test(text)) return null;
  return { violations: (text.match(/Severity:\s*error/gi) ?? []).length };
}

export interface DrcValidation {
  ok: boolean;
  /** Human-readable outcome for the gate + modal, e.g. "3 violations". */
  detail: string;
}

/**
 * Decide whether a DRC report passes: clean = ZERO violations. An unrecognizable
 * file fails with a clear message rather than passing blind.
 */
export function validateDrcReport(text: string): DrcValidation {
  const counts = parseDrcReport(text);
  if (!counts) {
    return {
      ok: false,
      detail:
        "not a recognizable KiCad DRC report — upload the .rpt saved from the DRC dialog",
    };
  }
  const { violations } = counts;
  const detail = `${violations} violation${violations === 1 ? "" : "s"}`;
  return { ok: violations === 0, detail };
}
