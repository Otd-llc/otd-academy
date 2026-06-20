// Live-BOM cost roll-up from the DigiKey watchdog snapshot price
// (`dkUnitPriceCents`), distinct from bom-cost.ts (the operator's quoted
// `unitPriceCents`). The total is a DESIGN estimate — qty × unit, excluding
// DigiKey MOQ/price-breaks & shipping — so the UI must caveat it; the live
// DigiKey cart is the source of the real total.
export interface LiveCostLine {
  quantity: number;
  dkUnitPriceCents: number | null;
}

export interface LiveBomCost {
  totalCents: number;
  pricedCount: number;
  unpricedCount: number;
  anyPriced: boolean;
}

export function liveBomCost(lines: LiveCostLine[]): LiveBomCost {
  let totalCents = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  for (const l of lines) {
    if (l.dkUnitPriceCents == null) unpricedCount++;
    else {
      totalCents += l.quantity * l.dkUnitPriceCents;
      pricedCount++;
    }
  }
  return { totalCents, pricedCount, unpricedCount, anyPriced: pricedCount > 0 };
}

// True when at least one BOM row carries a DigiKey snapshot (dkCheckedAt set).
// Drives whether the public BOM shows the price columns / cart button — so a
// purged or never-checked library renders the bare parts list. ([[digikey-availability-watchdog]])
export function bomTableHasDkData(rows: { dkCheckedAt: Date | null }[]): boolean {
  return rows.some((r) => r.dkCheckedAt != null);
}
