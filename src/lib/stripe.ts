// Lazily-constructed server-side Stripe client (GTM Phase 3).
//
// BUILD-SAFETY (hard rule — lesson from the Phase 1 sitemap CI break): the Stripe
// client is NEVER constructed at import time, and STRIPE_SECRET_KEY is an OPTIONAL
// env var. A `next build` / CI with no keys set must still pass. `getStripe()`
// throws a clear "not configured" error ONLY when actually called without a key —
// so importing this module is always safe.
import Stripe from "stripe";
import { env } from "@/env";
import { db } from "@/lib/db";

// Module-level singleton: constructed on first `getStripe()` call, reused after.
let stripeSingleton: Stripe | null = null;

/**
 * Return the shared Stripe client, constructing it lazily on first use.
 * Throws a friendly error (only when called) if STRIPE_SECRET_KEY is unset, so a
 * keyless build never crashes at import time.
 */
export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Payments are not configured (STRIPE_SECRET_KEY missing)");
  }
  // Pin the API version so payload/param shapes stay deterministic across SDK
  // bumps. This string is the exact version the installed `stripe` package's
  // types expect (Stripe.LatestApiVersion), so tsc stays happy.
  stripeSingleton = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return stripeSingleton;
}

/**
 * Resolve (create-or-reuse) the Stripe Customer for a user and return its id.
 *
 * If the user has a stored `stripeCustomerId`, VERIFY it still resolves under the
 * current Stripe key before trusting it. A stored id can go stale: it may belong
 * to the OTHER Stripe mode (a test-mode customer once live keys are in use, or vice
 * versa), it may have been deleted, or it may belong to a different account. Stripe
 * rejects any of these with `resource_missing` ("No such customer ... exists in test
 * mode, but a live mode key was used"), which otherwise surfaces as a hard render
 * error on /pricing. In every such case we SELF-HEAL: mint a fresh customer for the
 * current mode and persist the new id. Any other Stripe/network error is re-thrown.
 */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  const stripe = getStripe();

  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      // A live, non-deleted customer under this key is safe to reuse.
      if (!("deleted" in existing && existing.deleted)) return user.stripeCustomerId;
      // Deleted → fall through and recreate.
    } catch (err) {
      const missing =
        err instanceof Stripe.errors.StripeError && err.code === "resource_missing";
      if (!missing) throw err; // real failure (network, auth, rate limit) — surface it
      // stale/foreign/wrong-mode id → fall through and recreate.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { userId: user.id },
  });

  await db.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
