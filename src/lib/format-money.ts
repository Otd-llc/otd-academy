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
