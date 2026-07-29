// Pure money formatting for the storefront. The DB stores prices as whole cents
// (`Project.priceCents`); the UI shows USD. Keep this dependency-free and pure so
// it's safe in both server and client islands (the BuyButton + admin form import
// it) and trivially unit-testable.

/**
 * Format an integer number of US cents as a USD string, e.g. `4900 → "$49.00"`.
 *
 * Always shows two decimal places. Negative inputs are clamped to 0 (a price is
 * never negative). Non-finite / non-integer inputs fall back to `$0.00`.
 */
export function formatUsd(priceCents: number): string {
  const cents =
    Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Like `formatUsd` but drops a trailing `.00` so whole-dollar prices read clean
 * for display headlines (`4900 → "$49"`, `4950 → "$49.50"`). Use on the
 * storefront's big price numbers; keep `formatUsd` where exact cents matter.
 */
export function formatUsdShort(priceCents: number): string {
  return formatUsd(priceCents).replace(/\.00$/, "");
}

/**
 * Resolve a project's buy price in cents, or `null` when it isn't purchasable.
 *
 * A course is purchasable only when it carries BOTH a non-empty `stripePriceId`
 * (a real Stripe price to charge against) AND a positive `priceCents` (a display
 * price). Returns the cents when both hold, else `null` — so a `!== null` check
 * narrows the type for the BuyButton call site. Pure + dependency-free so it's
 * shared across server render sites; `checkout.ts` keeps its own server-side
 * re-check for defense-in-depth.
 */
export function resolveBuyPriceCents(project: {
  stripePriceId: string | null;
  priceCents: number | null;
}): number | null {
  const hasPriceId =
    typeof project.stripePriceId === "string" &&
    project.stripePriceId.length > 0;
  return hasPriceId &&
    typeof project.priceCents === "number" &&
    project.priceCents > 0
    ? project.priceCents
    : null;
}

/**
 * Resolve a project's buy price only when the project is actually BUYABLE:
 * priced AND published AND not archived.
 *
 * `resolveBuyPriceCents` answers "does it carry a price", which is a different
 * question and was the wrong one for a buy CTA. As of 2026-07-28, 16 PREMIUM
 * projects carry a live Stripe price and none of them has a published revision,
 * so pricing alone rendered a buy button whose server action refuses — a dead
 * button on every premium guide page.
 *
 * Use this anywhere a purchase is OFFERED. `checkout.ts` keeps its own
 * server-side re-check for defense-in-depth; a hidden button is not a gate.
 */
export function projectBuyable(project: {
  stripePriceId: string | null;
  priceCents: number | null;
  publishedRevisionId: string | null;
  archivedAt: Date | null;
}): number | null {
  if (project.publishedRevisionId === null) return null;
  if (project.archivedAt !== null) return null;
  return resolveBuyPriceCents(project);
}
