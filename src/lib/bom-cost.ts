export interface BomCostLine {
  quantity: number;
  unitPriceCents: number | null;
  part: { lifecycle: string };
}

export interface BomCost {
  totalCents: number;
  unpricedCount: number;
  targetCents: number | null;
  overTarget: boolean;
}

export function bomCost(
  lines: BomCostLine[],
  targetCost: string | { toString(): string } | null,
): BomCost {
  const totalCents = lines.reduce((s, l) => s + l.quantity * (l.unitPriceCents ?? 0), 0);
  const unpricedCount = lines.filter((l) => l.unitPriceCents == null).length;
  const targetCents =
    targetCost == null ? null : Math.round(Number(targetCost.toString()) * 100);
  const overTarget = targetCents != null && totalCents > targetCents;
  return { totalCents, unpricedCount, targetCents, overTarget };
}

export type BomWarning =
  | { kind: "lifecycle"; refDesOrMpn: string; lifecycle: string }
  | { kind: "unpriced"; count: number }
  | { kind: "over-target"; totalCents: number; targetCents: number };

export function assessBomSourcing(
  lines: BomCostLine[],
  targetCost: string | { toString(): string } | null,
): { warnings: BomWarning[] } {
  const warnings: BomWarning[] = [];
  for (const l of lines) {
    if (l.part.lifecycle !== "ACTIVE") {
      warnings.push({ kind: "lifecycle", refDesOrMpn: "", lifecycle: l.part.lifecycle });
    }
  }
  const cost = bomCost(lines, targetCost);
  if (cost.unpricedCount > 0) warnings.push({ kind: "unpriced", count: cost.unpricedCount });
  if (cost.overTarget && cost.targetCents != null)
    warnings.push({ kind: "over-target", totalCents: cost.totalCents, targetCents: cost.targetCents });
  return { warnings };
}
