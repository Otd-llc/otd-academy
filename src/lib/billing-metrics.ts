// Pure billing aggregation for the /admin/billing report (Stripe Phase 3). Rows in,
// numbers out — DB-free so it is trivially unit-testable, mirroring the pass-pricing /
// pass-upgrade split. The page queries rows and passes them in; every function guards the
// empty / zero-volume case (the default reality until content ships).
//
// Audit Phase 5 truth rules:
//   • The PAGE filters livemode=true at query time — test-mode rows (the admin
//     StartTestSubscriptionButton, a test webhook delivery) must never reach these
//     functions as if they were money.
//   • Money is grouped PER CURRENCY, never summed across currencies as if a euro
//     cent were a dollar cent. Display renders one line per currency.
//   • MRR is subscriber-priced: each sub's stored priceCents/interval (annual ÷ 12),
//     falling back to the current catalog price only for pre-column rows.
//   • Refund/dispute denominators are payments-inclusive (purchases + invoices),
//     so a dispute on a subscription invoice cannot inflate a purchases-only rate.

export type SubRow = { status: string };
export type SubPriceRow = {
  status: string;
  priceCents: number | null;
  interval: string | null;
  currency: string;
};
export type PurchaseRow = {
  amountTotalCents: number;
  refundedCents: number;
  currency: string;
};
export type InvoiceRow = { amountPaidCents: number; currency: string };

// Stripe statuses that count as live recurring revenue.
const ACTIVE = new Set(["active", "trialing"]);

/** Cents per currency, e.g. { usd: 15700, eur: 7900 }. */
export type ByCurrency = Record<string, number>;

function add(map: ByCurrency, currency: string, cents: number): void {
  if (cents === 0 && !(currency in map)) return;
  map[currency] = (map[currency] ?? 0) + cents;
}

/**
 * Monthly recurring revenue per currency: each active/trialing sub contributes
 * its OWN stored price (annual interval ÷ 12). `catalogMonthlyCents` covers only
 * pre-column rows (priceCents null) — assumed monthly + usd, matching how the
 * catalog price is provisioned.
 */
export function mrrByCurrency(
  subs: SubPriceRow[],
  catalogMonthlyCents: number | null,
): ByCurrency {
  const out: ByCurrency = {};
  for (const s of subs) {
    if (!ACTIVE.has(s.status)) continue;
    if (s.priceCents != null) {
      const monthly =
        s.interval === "year" ? Math.round(s.priceCents / 12) : s.priceCents;
      add(out, s.currency, monthly);
    } else if (catalogMonthlyCents) {
      add(out, s.currency || "usd", catalogMonthlyCents);
    }
  }
  return out;
}

/** Count of active + trialing subscriptions. */
export function activeSubCount(subs: SubRow[]): number {
  return subs.filter((s) => ACTIVE.has(s.status)).length;
}

/**
 * Gross revenue per currency: one-time purchases (net of refunds) + paid
 * subscription invoices. DISJOINT: the webhook writes a Purchase only for
 * `mode === "payment"` sessions, so a subscription payment is an Invoice and
 * never also a Purchase — no double-count.
 */
export function grossRevenueByCurrency(
  purchases: PurchaseRow[],
  invoices: InvoiceRow[],
): ByCurrency {
  const out: ByCurrency = {};
  for (const p of purchases) {
    add(out, p.currency, p.amountTotalCents - p.refundedCents);
  }
  for (const i of invoices) add(out, i.currency, i.amountPaidCents);
  return out;
}

/**
 * Purchase-refund cents / ALL payment cents (purchases gross + invoices paid),
 * in [0,1]. 0 when there is no payment volume. Numerator stays purchase-side
 * (Refund rows correlate by payment_intent → purchases); invoice refunds are
 * not tracked yet, which UNDERSTATES the rate slightly — never overstates.
 */
export function refundRate(
  purchases: { amountTotalCents: number; refundedCents: number }[],
  invoices: { amountPaidCents: number }[],
): number {
  const gross =
    purchases.reduce((n, r) => n + r.amountTotalCents, 0) +
    invoices.reduce((n, r) => n + r.amountPaidCents, 0);
  if (gross <= 0) return 0;
  const refunded = purchases.reduce((n, r) => n + r.refundedCents, 0);
  return refunded / gross;
}

/** Disputes / ALL payments (purchase count + invoice count), in [0,1]. */
export function disputeRate(
  disputeCount: number,
  purchaseCount: number,
  invoiceCount: number,
): number {
  const payments = purchaseCount + invoiceCount;
  if (payments <= 0) return 0;
  return disputeCount / payments;
}
