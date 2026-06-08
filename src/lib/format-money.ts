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
