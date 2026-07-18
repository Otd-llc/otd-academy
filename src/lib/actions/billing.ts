"use server";

// Customer billing portal (Stripe Phase 3). Opens a Stripe-hosted Customer Portal
// session so a customer can view invoices, update their card, and self-cancel a
// subscription. The portal is DISPLAY + self-service only: any change round-trips back
// through the webhook (customer.subscription.* / invoice.*), which stays the sole writer
// of Stripe-originated rows — this action never writes our DB.
//
// "use server" rule: this file exports ONLY async functions. BUILD-SAFETY: getStripe()
// is called only inside the body, never at import, so importing this module without keys
// is always safe.
import { requireUser } from "@/lib/auth-helpers";
import { enforceCheckoutLimit } from "@/lib/abuse-checkout";
import { getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";

/**
 * Create a Stripe Customer Portal session for the signed-in user and return its URL.
 *
 * The customer id is read from the authenticated user's OWN row (never client input),
 * so there is no IDOR surface. Requires the user to have transacted at least once (a
 * `stripeCustomerId`); the UI only renders the button when one exists, and this is the
 * server-side backstop. If the Stripe Portal is not configured in the dashboard,
 * `billingPortal.sessions.create` throws a clear "No configuration" error that the button
 * surfaces inline (it never crashes the page).
 */
export async function createBillingPortalSession(): Promise<{ url: string }> {
  const user = await requireUser();
  await enforceCheckoutLimit(user.id);
  if (!user.stripeCustomerId) {
    throw new Error("You do not have a billing account yet.");
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${siteUrl()}/account`,
  });
  if (!session.url) {
    throw new Error("Stripe did not return a portal URL.");
  }
  return { url: session.url };
}
