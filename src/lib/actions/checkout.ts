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
import { ensureStripeCustomer, getStripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";

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

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, slug: true, accessTier: true, stripePriceId: true },
  });

  if (
    !project ||
    project.accessTier !== "PREMIUM" ||
    project.stripePriceId === null
  ) {
    throw new Error("This course isn't available for purchase.");
  }

  const customer = await ensureStripeCustomer(user);

  const base = siteUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: project.stripePriceId, quantity: 1 }],
    customer,
    // Success lands on the learner home, which shows the purchase-confirmation
    // banner for `?purchased=<slug>`. Escape the slug as a query value.
    success_url: `${base}/learn?purchased=${encodeURIComponent(project.slug)}`,
    // Cancel returns to the project's guide hub.
    cancel_url: `${base}/learn/${project.slug}`,
    metadata: { userId: user.id, projectId: project.id },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}
