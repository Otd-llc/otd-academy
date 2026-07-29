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

/** A Bundle as far as sellability is concerned: pricing + Stripe provisioning. */
export interface BundleSellability extends BundlePricing {
  stripePriceId: string | null;
}

/**
 * Is the All-Access Pass sellable right now? Three necessary conditions:
 *   1. the bundle row exists and carries a Stripe price id (set-pass-price.ts ran),
 *   2. a price resolves at `now` (launch window or standard),
 *   3. at least one PREMIUM project is PUBLISHED.
 *
 * (3) is the one that was missing. A bundle entitlement unlocks every project
 * (@/lib/entitlements), so with nothing published a buyer pays for an empty
 * catalog. Encoded here rather than as an operator flag so it cannot be
 * forgotten in either direction.
 *
 * SELL-SIDE ONLY. Never use this to decide whether to REVOKE an existing
 * entitlement: revoking from a customer Stripe is still billing converts them
 * into an unpaid customer rather than stopping the charge.
 */
export function passSellable(
  bundle: BundleSellability | null,
  publishedPremiumCount: number,
  now: Date,
): boolean {
  if (!bundle || !bundle.stripePriceId) return false;
  if (currentPassPriceId(bundle, now) === null) return false;
  return publishedPremiumCount > 0;
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
