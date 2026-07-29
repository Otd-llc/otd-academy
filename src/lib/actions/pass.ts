"use server";

// All-Access Pass server actions (GTM monetization).
//
//   - createPassCheckoutSession()    — Hosted Stripe Checkout for the Pass.
//   - createUpgradeCheckoutSession() — pay-the-difference: credits the learner's
//     prior per-project purchases against the Pass price. When the credit covers
//     the Pass, grants the bundle entitlement directly (no checkout).
//
// The webhook is the source of truth for granting a PURCHASED Pass (it reads
// metadata.kind === "bundle"); these actions only START the purchase. The
// "already covered" upgrade is the one direct grant — there's nothing to charge,
// so there's no Stripe round-trip to wait on.
//
// "use server" rule: this file exports ONLY async functions. The pure pricing /
// credit math lives in `@/lib/pass-pricing` + `@/lib/pass-upgrade` (no type
// re-exports here — those crash at runtime, uncaught by tsc/build).
//
// BUILD-SAFETY: `getStripe()` is called only inside the action bodies (never at
// import), so importing this module with no Stripe keys is always safe.
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { enforceCheckoutLimit } from "@/lib/abuse-checkout";
import { ensureStripeCustomer, getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";
import { currentPassPriceId, passSellable } from "@/lib/pass-pricing";
import { countPublishedPremiumProjects } from "@/lib/premium-catalog";
import { quoteUpgrade } from "@/lib/pass-upgrade";

// The stable lookup key for the one All-Access Pass bundle.
export async function passBundleKey(): Promise<string> {
  return "all-access";
}

const BUNDLE_KEY = "all-access";

// Load the configured Pass bundle, or throw a clear "not for sale" error.
//
// Three necessary conditions (see passSellable): a Stripe price id, a price that
// resolves now, and at least one PUBLISHED PREMIUM project. A bundle entitlement
// unlocks every project (@/lib/entitlements), so selling with nothing published
// charges for an empty catalog.
//
// This is the chokepoint for BOTH the straight buy and the pay-the-difference
// upgrade — including the upgrade's `alreadyCovered` branch, which grants an
// entitlement DIRECTLY with no Stripe round-trip. Do NOT move this gate down to
// the individual call sites; that reopens the direct-grant path.
//
// Internal helper — not exported (this is a "use server" file).
async function loadSellablePass(now: Date): Promise<{
  id: string;
  stripePriceId: string;
  currentCents: number;
}> {
  const [bundle, publishedPremium] = await Promise.all([
    db.bundle.findUnique({ where: { key: BUNDLE_KEY } }),
    countPublishedPremiumProjects(),
  ]);
  if (!passSellable(bundle, publishedPremium, now)) {
    throw new Error("The All-Access Pass isn't available yet.");
  }
  // Sound: passSellable returned true, so bundle is non-null, stripePriceId is
  // non-null, and currentPassPriceId is pure over the same bundle and the same
  // `now`, so it cannot now return null. It is not a type predicate, hence `!`.
  return {
    id: bundle!.id,
    stripePriceId: bundle!.stripePriceId!,
    currentCents: currentPassPriceId(bundle!, now)!,
  };
}

/**
 * Create a Hosted Stripe Checkout session for the All-Access Pass.
 *
 * Requires a signed-in user. Charges the price active right now (launch price
 * while the window is open, else standard). Tags the session
 * `metadata: { kind: "bundle", userId, bundleKey }` so the webhook grants a
 * bundle Entitlement. Returns the hosted session URL.
 */
export async function createPassCheckoutSession(): Promise<{ url: string }> {
  const user = await requireUser();
  await enforceCheckoutLimit(user.id);
  const pass = await loadSellablePass(new Date());
  const customer = await ensureStripeCustomer(user);
  const base = siteUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pass.currentCents,
          product_data: { name: "All-Access Pass" },
        },
        quantity: 1,
      },
    ],
    customer,
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
    allow_promotion_codes: true,
    metadata: { kind: "bundle", userId: user.id, bundleKey: BUNDLE_KEY },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}

/**
 * Pay-the-difference upgrade to the All-Access Pass.
 *
 * Credits what the learner ACTUALLY PAID for their prior per-course purchases
 * (`Purchase.amountTotalCents`, net of refunds, frozen at purchase time) against
 * the active Pass price — never the current catalog price, so a later price change
 * can't retroactively re-credit past buyers. When the credit covers the Pass,
 * grants the bundle Entitlement directly (and records a $0 Purchase) and returns
 * `{ granted: true }` (no checkout). Otherwise starts a Hosted Checkout for the
 * difference and returns `{ url }`.
 */
export async function createUpgradeCheckoutSession(): Promise<
  { url: string; granted?: false } | { granted: true; url?: undefined }
> {
  const user = await requireUser();
  await enforceCheckoutLimit(user.id);
  const pass = await loadSellablePass(new Date());

  // The learner's per-course Purchases → the credit pool. Credit = what they
  // actually PAID per course (Purchase.amountTotalCents), net of any refund, frozen
  // at purchase time. Bundle / $0-upgrade Purchases (projectId null) are excluded.
  // Historical test-mode entitlements have no Purchase row and so credit 0 —
  // accepted (test mode only; the old Project.priceCents fallback is intentionally
  // NOT carried, as it would resurrect the grandfathering bug this fixes).
  const purchases = await db.purchase.findMany({
    where: { userId: user.id, projectId: { not: null } },
    select: { amountTotalCents: true, refundedCents: true },
  });
  const prices = purchases.map((p) => p.amountTotalCents - p.refundedCents);

  const quote = quoteUpgrade(pass.currentCents, prices);

  // Already covered: grant the bundle entitlement directly (no Stripe round-trip)
  // and record a $0 Purchase, so every PURCHASE entitlement still traces to a
  // Purchase row (the audit invariant this design preserves). ONE transaction:
  // entitlement + $0 Purchase commit together or not at all — a mid-write crash
  // must not leave an untraceable entitlement. The entitlement is idempotent via
  // the [userId, bundleId] unique; the $0 Purchase is idempotent via a findFirst on
  // (entitlementId, null session) — Postgres allows many NULL stripeSessionIds, so
  // it never collides with real webhook Purchases (which carry a session id).
  if (quote.alreadyCovered) {
    await db.$transaction(async (tx) => {
      const entitlement = await tx.entitlement.upsert({
        where: { userId_bundleId: { userId: user.id, bundleId: pass.id } },
        create: { userId: user.id, bundleId: pass.id, source: "PURCHASE" },
        update: {},
      });
      const existingGrant = await tx.purchase.findFirst({
        where: { entitlementId: entitlement.id, stripeSessionId: null },
        select: { id: true },
      });
      if (!existingGrant) {
        await tx.purchase.create({
          data: {
            userId: user.id,
            bundleId: pass.id,
            entitlementId: entitlement.id,
            amountTotalCents: 0,
            metadata: {
              kind: "upgrade-grant",
              userId: user.id,
              bundleKey: BUNDLE_KEY,
            },
          },
        });
      }
    });
    return { granted: true };
  }

  const customer = await ensureStripeCustomer(user);
  const base = siteUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: quote.chargeCents,
          product_data: { name: "All-Access Pass (upgrade)" },
        },
        quantity: 1,
      },
    ],
    customer,
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
    allow_promotion_codes: true,
    metadata: { kind: "bundle", userId: user.id, bundleKey: BUNDLE_KEY },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}

/**
 * Start a recurring All-Access SUBSCRIPTION (Hosted Checkout, mode "subscription").
 *
 * Requires a signed-in user + a provisioned recurring price
 * (`Bundle.subscriptionPriceId`, set by scripts/set-subscription-price.ts). The same
 * bundle grants the same access as the one-time Pass; access is minted by the
 * `customer.subscription.*` webhook (source SUBSCRIPTION), NOT here — this only
 * starts the sub. We stamp `metadata.userId` on BOTH the session and the
 * subscription (subscription webhook events carry no session, so the sub itself must
 * carry the id). Promo codes allowed. Returns the hosted session URL.
 */
export async function createSubscriptionCheckoutSession(): Promise<{
  url: string;
}> {
  const user = await requireUser();
  await enforceCheckoutLimit(user.id);
  const [bundle, publishedPremium] = await Promise.all([
    db.bundle.findUnique({ where: { key: BUNDLE_KEY } }),
    countPublishedPremiumProjects(),
  ]);
  // Same bundle, same access, so the same sell-side gate: a subscription that
  // unlocks an empty catalog is the same defect billed monthly. Deliberately NOT
  // routed through passSellable — a subscription needs only subscriptionPriceId,
  // and coupling it to the one-time stripePriceId would be a new dependency.
  if (!bundle || !bundle.subscriptionPriceId || publishedPremium === 0) {
    throw new Error("The subscription isn't available yet.");
  }
  const customer = await ensureStripeCustomer(user);
  const base = siteUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: bundle.subscriptionPriceId, quantity: 1 }],
    customer,
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
    allow_promotion_codes: true,
    metadata: { kind: "subscription", userId: user.id, bundleKey: BUNDLE_KEY },
    subscription_data: { metadata: { userId: user.id } },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}
