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
import { ensureStripeCustomer, getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";
import { currentPassPriceId } from "@/lib/pass-pricing";
import { quoteUpgrade } from "@/lib/pass-upgrade";

// The stable lookup key for the one All-Access Pass bundle.
export async function passBundleKey(): Promise<string> {
  return "all-access";
}

const BUNDLE_KEY = "all-access";

// Load the configured Pass bundle, or throw a clear "not for sale" error. A Pass
// is sellable only once `set-pass-price.ts` has run (a stripePriceId + a resolved
// current price). Internal helper — not exported (this is a "use server" file).
async function loadSellablePass(now: Date): Promise<{
  id: string;
  stripePriceId: string;
  currentCents: number;
}> {
  const bundle = await db.bundle.findUnique({ where: { key: BUNDLE_KEY } });
  if (!bundle || !bundle.stripePriceId) {
    throw new Error("The All-Access Pass isn't available yet.");
  }
  const currentCents = currentPassPriceId(bundle, now);
  if (currentCents === null) {
    throw new Error("The All-Access Pass isn't available yet.");
  }
  return {
    id: bundle.id,
    stripePriceId: bundle.stripePriceId,
    currentCents,
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
    success_url: `${base}/learn?pass=1`,
    cancel_url: `${base}/pricing`,
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
 * Credits the learner's prior per-project purchases (source PURCHASE
 * entitlements' `priceCents`) against the active Pass price. When the credit
 * covers the Pass, grants the bundle Entitlement directly and returns
 * `{ granted: true }` (no checkout). Otherwise starts a Hosted Checkout for the
 * difference and returns `{ url }`.
 */
export async function createUpgradeCheckoutSession(): Promise<
  { url: string; granted?: false } | { granted: true; url?: undefined }
> {
  const user = await requireUser();
  const pass = await loadSellablePass(new Date());

  // The learner's PURCHASE project entitlements → the credit pool. We join to
  // Project for the price actually on the project (the credit is the catalog
  // price the learner paid; we never trust a client amount).
  const purchases = await db.entitlement.findMany({
    where: { userId: user.id, source: "PURCHASE", projectId: { not: null } },
    select: { project: { select: { priceCents: true } } },
  });
  const prices = purchases.map((p) => p.project?.priceCents ?? null);

  const quote = quoteUpgrade(pass.currentCents, prices);

  // Already covered: grant the bundle entitlement directly, idempotently. We
  // can't use the [userId, projectId] unique (projectId is null for a bundle),
  // so guard with a findFirst before create.
  if (quote.alreadyCovered) {
    const existing = await db.entitlement.findFirst({
      where: { userId: user.id, bundleId: pass.id },
      select: { id: true },
    });
    if (!existing) {
      await db.entitlement.create({
        data: { userId: user.id, bundleId: pass.id, source: "PURCHASE" },
      });
    }
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
    success_url: `${base}/learn?pass=1`,
    cancel_url: `${base}/pricing`,
    metadata: { kind: "bundle", userId: user.id, bundleKey: BUNDLE_KEY },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}
