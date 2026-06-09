// PURE, import-safe webhook helpers (GTM Phase 3, A4).
//
// This module does NO db work and makes NO Stripe calls — importing it is always
// safe. It exists so the metadata→grant extraction can be unit-tested in isolation
// from the route's signature-verification / idempotency machinery.
import type Stripe from "stripe";

/**
 * Extract the `{ userId, projectId }` to grant from a completed Checkout Session.
 *
 * The Checkout Session carries our `metadata: { userId, projectId }` (set when the
 * session was created). Returns the pair ONLY when both are present non-empty
 * strings; otherwise `null` (there is nothing we can safely grant, and nothing to
 * retry). Pure: no db, no Stripe.
 */
export function entitlementFromCheckoutSession(
  session: Stripe.Checkout.Session,
): { userId: string; projectId: string } | null {
  const userId = session.metadata?.userId;
  const projectId = session.metadata?.projectId;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof projectId !== "string" || projectId.length === 0) return null;
  return { userId, projectId };
}
