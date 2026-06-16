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

export type TipRecord = {
  stripeSessionId: string;
  userId: string | null;
  email: string | null;
  amountCents: number;
  currency: string;
};

/**
 * Extract a one-time "Support the Academy" tip to record from a completed
 * Checkout Session. Returns a record ONLY when `metadata.kind === "tip"` and the
 * session carries a usable id + paid amount; otherwise `null` (not a tip, or
 * nothing safe to record). The amount comes from Stripe's `amount_total` — NEVER
 * the client. `userId` is null for a guest tip. Pure: no db, no Stripe.
 */
export function tipFromCheckoutSession(
  session: Stripe.Checkout.Session,
): TipRecord | null {
  if (session.metadata?.kind !== "tip") return null;
  const stripeSessionId = session.id;
  if (typeof stripeSessionId !== "string" || stripeSessionId.length === 0) {
    return null;
  }
  const amountCents = session.amount_total;
  if (typeof amountCents !== "number" || amountCents <= 0) return null;
  const rawUserId = session.metadata?.userId;
  const userId =
    typeof rawUserId === "string" && rawUserId.length > 0 ? rawUserId : null;
  return {
    stripeSessionId,
    userId,
    email: session.customer_details?.email ?? null,
    amountCents,
    currency: session.currency ?? "usd",
  };
}
