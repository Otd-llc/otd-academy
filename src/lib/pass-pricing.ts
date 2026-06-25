// Pure All-Access Pass pricing helpers (no db, no Stripe) — unit-testable in
// isolation from the server actions in `src/lib/actions/pass.ts`.
//
// A Bundle carries a standard price (`priceCents`) and an optional time-boxed
// launch price (`launchPriceCents` + `launchEndsAt`). The launch price applies
// only while `now < launchEndsAt`; after the window closes (or if no launch price
// is configured) the standard price applies.

export interface BundlePricing {
  priceCents: number | null;
  launchPriceCents: number | null;
  launchEndsAt: Date | null;
}

/**
 * The Pass price (in cents) that applies at `now`.
 *
 * Returns `launchPriceCents` while a launch window is open
 * (`launchPriceCents` set AND `launchEndsAt` set AND `now < launchEndsAt`),
 * otherwise the standard `priceCents`. Returns `null` only when no standard price
 * is configured (the Pass isn't set up yet) — callers treat that as "not for
 * sale".
 *
 * Named `currentPassPriceId` to match the task contract; it resolves the active
 * AMOUNT in cents (the Bundle carries a single Stripe price id, so checkout
 * charges this amount via an ad-hoc `price_data` line item — see pass.ts).
 */
export function currentPassPriceId(
  bundle: BundlePricing,
  now: Date,
): number | null {
  const launchOpen =
    typeof bundle.launchPriceCents === "number" &&
    bundle.launchPriceCents > 0 &&
    bundle.launchEndsAt != null &&
    now.getTime() < bundle.launchEndsAt.getTime();

  if (launchOpen) return bundle.launchPriceCents;
  return typeof bundle.priceCents === "number" && bundle.priceCents > 0
    ? bundle.priceCents
    : null;
}

/** True when a launch window is configured and still open at `now`. */
export function isLaunchActive(bundle: BundlePricing, now: Date): boolean {
  return (
    typeof bundle.launchPriceCents === "number" &&
    bundle.launchPriceCents > 0 &&
    bundle.launchEndsAt != null &&
    now.getTime() < bundle.launchEndsAt.getTime()
  );
}
