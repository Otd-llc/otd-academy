// Board "definition of done" — scores a revision as de-risked BEFORE a guide is
// authored around it (parent plan WS4, advisory-first). Pure + testable: the
// revision page and the guide hub load the DB rows and feed them in. Mirrors
// assessLessonReadiness. "Design doc present" is folded into "DESIGN_VALIDATION
// complete" (the checklist references the design.md §s) — no repo read.

export type BoardReadinessTier = "required" | "info";

export interface BoardCheck {
  label: string;
  ok: boolean;
  tier: BoardReadinessTier;
  detail?: string;
}

export interface BoardReadinessInput {
  hasDesignValidation: boolean;
  designValidationComplete: boolean;
  bomFrozenAt: Date | null;
  bomLineCount: number;
  lifecycleWarningCount: number;
  unpricedCount: number;
  overTarget: boolean;
  designDocPath: string;
}

export interface BoardReadiness {
  checks: BoardCheck[];
  ready: boolean;
}

export function assessBoardReadiness(input: BoardReadinessInput): BoardReadiness {
  const checks: BoardCheck[] = [];

  const designOk = input.hasDesignValidation && input.designValidationComplete;
  checks.push({
    label: "Design validated",
    tier: "required",
    ok: designOk,
    detail: !input.hasDesignValidation
      ? "no DESIGN_VALIDATION checklist materialized"
      : !input.designValidationComplete
        ? "DESIGN_VALIDATION items still unchecked"
        : undefined,
  });

  checks.push({
    label: "BOM frozen",
    tier: "required",
    ok: input.bomFrozenAt != null,
    detail: input.bomFrozenAt == null ? "advance past BOM_SOURCING to freeze" : undefined,
  });

  checks.push({
    label: "BOM has parts",
    tier: "required",
    ok: input.bomLineCount > 0,
    detail: input.bomLineCount === 0 ? "no BOM lines" : `${input.bomLineCount} lines`,
  });

  checks.push({
    label: "No end-of-life parts",
    tier: "required",
    ok: input.lifecycleWarningCount === 0,
    detail:
      input.lifecycleWarningCount > 0
        ? `${input.lifecycleWarningCount} NRND/EOL/obsolete`
        : undefined,
  });

  // ── Info: reported, gates nothing ──
  const costBits: string[] = [];
  if (input.unpricedCount > 0) costBits.push(`${input.unpricedCount} unpriced`);
  if (input.overTarget) costBits.push("over target");
  checks.push({
    label: "Cost",
    tier: "info",
    ok: !input.overTarget && input.unpricedCount === 0,
    detail: costBits.length ? costBits.join(", ") : "within target, fully priced",
  });

  checks.push({
    label: "Design doc",
    tier: "info",
    ok: true,
    detail: input.designDocPath,
  });

  const ready = checks.filter((c) => c.tier === "required").every((c) => c.ok);
  return { checks, ready };
}
