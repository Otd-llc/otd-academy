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
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

/**
 * Resolve (create-or-reuse) the Stripe Customer for a user and return its id.
 * If the user already has a `stripeCustomerId`, return it untouched; otherwise
 * create a Stripe Customer (carrying `email` + `metadata.userId`), persist the
 * new id on the User row, and return it.
 */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email ?? undefined,
    metadata: { userId: user.id },
  });

  await db.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
