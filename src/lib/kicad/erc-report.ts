// Parse a KiCad ERC report (.rpt text) and decide whether it "passes muster".
// A clean ERC means ZERO errors; warnings are counted but DO NOT block (the
// locked gate policy). KiCad's report ends with a summary line, stable across
// KiCad 6–10:
//   ** ERC messages: 5 Errors 5 Warnings 0
//   ** ERC messages: 0 Errors 0 Warnings 0      ← clean
// and each violation above it reads `[rule_id]: <msg> ; Severity: error|warning`.
// PURE: no DB / IO.

export interface ErcCounts {
  errors: number;
  warnings: number;
}

// `** ERC messages: <errors> Errors <warnings> Warnings …`
const SUMMARY_RE = /\*\*\s*ERC messages:\s*(\d+)\s+Errors?\s+(\d+)\s+Warnings?/i;
// A per-violation severity marker, either "Severity: <sev>" (6–8) or a bare
// "; <sev>" ending the Rule/override line (KiCad 10). Line-anchored.
const SEVERITY_RE = /(?:Severity:\s*|;\s*)(error|warning)\s*$/gim;

/**
 * Error + warning counts from an ERC report, or null when the text is not a
 * recognizable ERC report (no summary line and nothing that looks like ERC
 * output) — so a random/empty file fails loudly rather than passing blind.
 */
export function parseErcReport(text: string): ErcCounts | null {
  const summary = SUMMARY_RE.exec(text);
  if (summary) {
    return { errors: Number(summary[1]), warnings: Number(summary[2]) };
  }
  // Fallback for exports without the summary line: count per-violation severity
  // markers (both the 6–8 "Severity:" and KiCad-10 "; <sev>" shapes) — but only
  // trust it if the file is plausibly ERC output.
  let errors = 0;
  let warnings = 0;
  let sawSeverity = false;
  for (const m of text.matchAll(SEVERITY_RE)) {
    sawSeverity = true;
    if (m[1].toLowerCase() === "error") errors++;
    else warnings++;
  }
  if (!sawSeverity && !/\bERC\b/i.test(text)) return null;
  return { errors, warnings };
}

export interface ErcValidation {
  ok: boolean;
  /** Human-readable outcome for the gate + modal, e.g. "5 errors, 5 warnings". */
  detail: string;
}

/**
 * Decide whether an ERC report passes: clean = ZERO errors (warnings allowed).
 * An unrecognizable file fails with a clear message rather than passing blind.
 */
export function validateErcReport(text: string): ErcValidation {
  const counts = parseErcReport(text);
  if (!counts) {
    return {
      ok: false,
      detail:
        "not a recognizable KiCad ERC report — upload the .rpt saved from the ERC dialog",
    };
  }
  const { errors, warnings } = counts;
  const detail = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
    warnings === 1 ? "" : "s"
  }`;
  return { ok: errors === 0, detail };
}
