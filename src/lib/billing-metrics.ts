// Pure billing aggregation for the /admin/billing report (Stripe Phase 3). Rows in,
// numbers out — DB-free so it is trivially unit-testable, mirroring the pass-pricing /
// pass-upgrade split. The page queries rows and passes them in; every function guards the
// empty / zero-volume case (the default reality until content ships).

export type SubRow = { status: string };
export type PurchaseRow = { amountTotalCents: number; refundedCents: number };
export type InvoiceRow = { amountPaidCents: number };

// Stripe statuses that count as live recurring revenue.
const ACTIVE = new Set(["active", "trialing"]);

/**
 * Monthly recurring revenue in cents: active/trialing subs × the monthly price.
 *
 * ASSUMES A MONTHLY interval. `set-subscription-price.ts` provisions the interval
 * (default `month`, env `SUBSCRIPTION_INTERVAL`) but our DB stores only the cents
 * (`Bundle.subscriptionPriceCents`), not the interval. If the price is ever provisioned
 * as `year`, divide the annual cents by 12 before passing them in.
 */
export function mrrCents(subs: SubRow[], monthlyPriceCents: number | null): number {
  if (!monthlyPriceCents) return 0;
  return activeSubCount(subs) * monthlyPriceCents;
}

/** Count of active + trialing subscriptions. */
export function activeSubCount(subs: SubRow[]): number {
  return subs.filter((s) => ACTIVE.has(s.status)).length;
}

/**
 * Gross revenue in cents: one-time purchases (net of refunds) + paid subscription
 * invoices. DISJOINT: the webhook writes a Purchase only for `mode === "payment"`
 * sessions, so a subscription payment is an Invoice and never also a Purchase — no
 * double-count.
 */
export function grossRevenueCents(
  purchases: PurchaseRow[],
  invoices: InvoiceRow[],
): number {
  const p = purchases.reduce(
    (n, r) => n + r.amountTotalCents - r.refundedCents,
    0,
  );
  const i = invoices.reduce((n, r) => n + r.amountPaidCents, 0);
  return p + i;
}

/** Refunded cents / gross purchase cents, in [0,1]. 0 when there is no purchase volume. */
export function refundRate(purchases: PurchaseRow[]): number {
  const gross = purchases.reduce((n, r) => n + r.amountTotalCents, 0);
  if (gross <= 0) return 0;
  const refunded = purchases.reduce((n, r) => n + r.refundedCents, 0);
  return refunded / gross;
}

/** Disputes / purchases, in [0,1]. 0 when there are no purchases. */
export function disputeRate(disputeCount: number, purchaseCount: number): number {
  if (purchaseCount <= 0) return 0;
  return disputeCount / purchaseCount;
}
