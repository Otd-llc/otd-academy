// Maps loaded Prisma rows → assessBoardReadiness input. Kept OUT of the pure
// board-readiness.ts (which stays DB-free, mirroring lesson-readiness.ts).
import { assessBoardReadiness, type BoardReadiness } from "@/lib/board-readiness";
import { bomCost, assessBomSourcing } from "@/lib/bom-cost";

export interface BoardReadinessRows {
  bomFrozenAt: Date | null;
  bomLines: { quantity: number; unitPriceCents: number | null; part: { lifecycle: string } }[];
  checklists: { subkind: string; items: { checked: boolean; notApplicable: boolean }[] }[];
  projectSlug: string;
  targetCost: string | { toString(): string } | null;
}

export function boardReadinessFromRows(rows: BoardReadinessRows): BoardReadiness {
  const dv = rows.checklists.find((c) => c.subkind === "DESIGN_VALIDATION");
  const dvItems = dv?.items ?? [];
  const cost = bomCost(rows.bomLines, rows.targetCost);
  const { warnings } = assessBomSourcing(rows.bomLines, rows.targetCost);
  return assessBoardReadiness({
    hasDesignValidation: !!dv,
    designValidationComplete:
      dvItems.length > 0 && dvItems.every((i) => i.checked || i.notApplicable),
    bomFrozenAt: rows.bomFrozenAt,
    bomLineCount: rows.bomLines.length,
    lifecycleWarningCount: warnings.filter((w) => w.kind === "lifecycle").length,
    unpricedCount: cost.unpricedCount,
    overTarget: cost.overTarget,
    designDocPath: `docs/boards/${rows.projectSlug}/design.md`,
  });
}

export function failingRequiredCount(r: BoardReadiness): number {
  return r.checks.filter((c) => c.tier === "required" && !c.ok).length;
}
