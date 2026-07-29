"use server";

// Checkout server action (GTM Phase 3). Turns a paywalled PREMIUM project into a
// Hosted Stripe Checkout session. The webhook is the source of truth for
// granting the entitlement — this action only starts the purchase.
//
// "use server" rule: this file exports ONLY async functions. No type re-exports
// (a `export type { … }` here crashes at runtime, uncaught by tsc/build).
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { enforceCheckoutLimit } from "@/lib/abuse-checkout";
import { ensureStripeCustomer, getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";
import { capture } from "@/lib/analytics";

const createCheckoutSessionSchema = z.object({ projectId: z.cuid() });

/**
 * Create a Hosted Stripe Checkout session for a PREMIUM, priced project.
 *
 * Requires a signed-in user (so there's a User row to grant the entitlement to).
 * Refuses projects that don't exist, aren't PREMIUM, or have no `stripePriceId`.
 * Returns the hosted session URL for the caller to redirect to.
 */
export async function createCheckoutSession(input: {
  projectId: string;
}): Promise<{ url: string }> {
  const { projectId } = createCheckoutSessionSchema.parse(input);
  const user = await requireUser();
  await enforceCheckoutLimit(user.id);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      slug: true,
      accessTier: true,
      stripePriceId: true,
      publishedRevisionId: true,
      archivedAt: true,
    },
  });

  // Priced AND published AND not archived. Without the last two, a PREMIUM row
  // carrying a Stripe price sells access to a project that renders nothing --
  // the state of all 16 priced projects as of 2026-07-28. `projectId` is
  // client-supplied, so the archived check is a real gate, not a formality.
  if (
    !project ||
    project.accessTier !== "PREMIUM" ||
    project.stripePriceId === null ||
    project.publishedRevisionId === null ||
    project.archivedAt !== null
  ) {
    throw new Error("This course isn't available for purchase.");
  }

  const customer = await ensureStripeCustomer(user);

  const base = siteUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: project.stripePriceId, quantity: 1 }],
    customer,
    // Success lands on the post-checkout confirmation page. Stripe fills in
    // {CHECKOUT_SESSION_ID}; the page reads the session to show the receipt.
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    // Cancel returns to the project's guide hub.
    cancel_url: `${base}/learn/${project.slug}`,
    allow_promotion_codes: true,
    // `stripePriceId` is stamped so the webhook can record it on the Purchase row
    // (the session's price id is otherwise only on the expanded line_items). Pass
    // / upgrade checkouts use inline price_data and have no price id to stamp.
    metadata: {
      userId: user.id,
      projectId: project.id,
      stripePriceId: project.stripePriceId,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  // Funnel: a learner started checkout for a premium course. After the session
  // is created, best-effort (try/catch) so telemetry never blocks the redirect;
  // no-op when PostHog is unconfigured. `purchase_completed` is fired later from
  // the Stripe webhook (the source of truth for an actual grant).
  try {
    capture(
      "checkout_started",
      { projectSlug: project.slug, projectId: project.id },
      user.id,
    );
  } catch {
    // best-effort
  }

  return { url: session.url };
}
