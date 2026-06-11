// Parse a KiCad DRC report (.rpt text) and decide whether it "passes muster".
// Policy MIRRORS erc-report.ts: clean = ZERO errors; WARNINGS are counted but do
// NOT block. A correct beginner board often carries harmless warning-severity
// flags (silk over a pad on a hand-soldered part, a tight courtyard) that
// shouldn't gate them — only real errors (clearance, track width, unconnected)
// must be zero. KiCad lists each violation with `; Severity: error|warning`, and
// closes each section with a `** Found N … **` summary (DRC violations +
// unconnected items + parity issues). PURE: no DB / IO.

export interface DrcCounts {
  errors: number;
  warnings: number;
}

// Every KiCad DRC summary line: "** Found <n> <kind> **".
const FOUND_RE = /\*\*\s*Found\s+(\d+)\b/gi;

/**
 * Error + warning counts from a DRC report, or null when the text isn't a
 * recognizable DRC report — so a random/empty file fails loudly rather than
 * passing blind. Errors are the per-violation `Severity: error` markers (these
 * include clearance/width/unconnected); warnings are `Severity: warning`. A clean
 * export has only `** Found 0 … **` lines and no severity markers → 0/0.
 */
export function parseDrcReport(text: string): DrcCounts | null {
  const hasSeverity = /Severity:\s*(error|warning)/i.test(text);
  const found = [...text.matchAll(FOUND_RE)];
  const recognizable =
    found.length > 0 ||
    hasSeverity ||
    /\bDRC\b|Drc report|design rule/i.test(text);
  if (!recognizable) return null;
  if (hasSeverity) {
    return {
      errors: (text.match(/Severity:\s*error/gi) ?? []).length,
      warnings: (text.match(/Severity:\s*warning/gi) ?? []).length,
    };
  }
  // No per-violation severities (a summary-only export). Conservatively treat the
  // summed "Found N" totals as errors so a nonzero count still blocks.
  return {
    errors: found.reduce((n, m) => n + Number(m[1]), 0),
    warnings: 0,
  };
}

export interface DrcValidation {
  ok: boolean;
  /** Human-readable outcome for the gate + modal, e.g. "3 errors, 1 warning". */
  detail: string;
}

/**
 * Decide whether a DRC report passes: clean = ZERO errors (warnings allowed). An
 * unrecognizable file fails with a clear message rather than passing blind.
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
  const { errors, warnings } = counts;
  const detail = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
    warnings === 1 ? "" : "s"
  }`;
  return { ok: errors === 0, detail };
}
