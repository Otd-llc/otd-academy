// Parse a KiCad DRC report (.rpt text) and decide whether it "passes muster".
// Policy MIRRORS erc-report.ts: clean = ZERO errors; WARNINGS are counted but do
// NOT block. A correct beginner board often carries harmless warning-severity
// flags (silk over a pad on a hand-soldered part, a tight courtyard) that
// shouldn't gate them — only real errors (clearance, track width, unconnected)
// must be zero. KiCad lists each violation with `; Severity: error|warning`, and
// closes each section with a `** Found N … **` summary (DRC violations +
// unconnected items + parity issues). Note the summary lumps errors+warnings
// together, so the pass/fail split MUST come from the per-violation severity.
// KiCad marks that severity differently across versions:
//   6–8:       "[rule]: <msg> ; Severity: warning"
//   KiCad 10:  "Rule: <name>; warning"  /  "Local override; error"
//              (the severity word ENDS the Rule/override line — no "Severity:")
// We accept BOTH. PURE: no DB / IO.

export interface DrcCounts {
  errors: number;
  warnings: number;
}

// Every KiCad DRC summary line: "** Found <n> <kind> **".
const FOUND_RE = /\*\*\s*Found\s+(\d+)\b/gi;
// A per-violation severity marker, either "Severity: <sev>" (6–8) or a bare
// "; <sev>" that ends the Rule/override line (KiCad 10). Line-anchored so a
// stray "; error" inside a description doesn't false-match.
const SEVERITY_RE = /(?:Severity:\s*|;\s*)(error|warning)\s*$/gim;

/**
 * Error + warning counts from a DRC report, or null when the text isn't a
 * recognizable DRC report — so a random/empty file fails loudly rather than
 * passing blind. Errors are the per-violation error-severity markers (these
 * include clearance/width/unconnected); warnings are warning-severity. A clean
 * export has only `** Found 0 … **` lines and no severity markers → 0/0.
 */
export function parseDrcReport(text: string): DrcCounts | null {
  let errors = 0;
  let warnings = 0;
  let sawSeverity = false;
  for (const m of text.matchAll(SEVERITY_RE)) {
    sawSeverity = true;
    if (m[1].toLowerCase() === "error") errors++;
    else warnings++;
  }
  const found = [...text.matchAll(FOUND_RE)];
  const recognizable =
    found.length > 0 ||
    sawSeverity ||
    /\bDRC\b|Drc report|design rule/i.test(text);
  if (!recognizable) return null;
  if (sawSeverity) return { errors, warnings };
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
