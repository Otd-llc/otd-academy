// Pure pay-the-difference (Pass upgrade) math (no db, no Stripe) — unit-testable
// in isolation from the server action in `src/lib/actions/pass.ts`.
//
// A learner who already bought one or more individual projects can upgrade to the
// All-Access Pass and pay only the difference: the Pass price minus a credit equal
// to the sum of what they already paid (their source:"PURCHASE" project
// entitlements' `priceCents`). The credit floors the charge at 0, and once the
// credit covers the Pass the upgrade is "already covered" (grant the Pass
// directly, no checkout).

/**
 * Sum the credit a learner has earned toward the Pass: the total `priceCents`
 * over their PURCHASE project entitlements. A null/absent price contributes 0
 * (defensive — a purchased project always had a price, but never trust it).
 */
export function upgradeCreditCents(
  purchasedPrices: (number | null | undefined)[],
): number {
  return purchasedPrices.reduce<number>(
    (sum, cents) =>
      sum + (typeof cents === "number" && cents > 0 ? cents : 0),
    0,
  );
}

export interface UpgradeQuote {
  // The Pass price the learner is upgrading to (cents).
  passPriceCents: number;
  // Credit applied (sum of prior purchases), never more than the Pass price.
  creditCents: number;
  // Amount to charge now (cents), floored at 0.
  chargeCents: number;
  // True when the credit covers the Pass — grant directly, skip checkout.
  alreadyCovered: boolean;
}

/**
 * Resolve the upgrade quote: charge = passPrice - credit, floored at 0. When the
 * credit is >= the Pass price the upgrade is free (`alreadyCovered`), so the
 * caller grants the bundle entitlement directly with no Stripe checkout.
 */
export function quoteUpgrade(
  passPriceCents: number,
  purchasedPrices: (number | null | undefined)[],
): UpgradeQuote {
  const rawCredit = upgradeCreditCents(purchasedPrices);
  const creditCents = Math.min(rawCredit, passPriceCents);
  const chargeCents = Math.max(0, passPriceCents - rawCredit);
  return {
    passPriceCents,
    creditCents,
    chargeCents,
    alreadyCovered: chargeCents === 0,
  };
}
