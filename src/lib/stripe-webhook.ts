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

/**
 * Extract the All-Access Pass (bundle) grant from a completed Checkout Session.
 *
 * The Pass / upgrade checkout sets `metadata: { kind: "bundle", userId,
 * bundleKey }`. Returns `{ userId, bundleKey }` ONLY when `kind === "bundle"` and
 * both fields are present non-empty strings; otherwise `null`. Pure: no db, no
 * Stripe. (The webhook resolves `bundleKey` → the Bundle row id before granting.)
 */
export function bundleFromCheckoutSession(
  session: Stripe.Checkout.Session,
): { userId: string; bundleKey: string } | null {
  if (session.metadata?.kind !== "bundle") return null;
  const userId = session.metadata?.userId;
  const bundleKey = session.metadata?.bundleKey;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof bundleKey !== "string" || bundleKey.length === 0) return null;
  return { userId, bundleKey };
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

// The Stripe-derived audit fields for a Purchase row, extracted from a completed
// Checkout Session. Owner (projectId/bundleId), userId, and entitlementId are the
// caller's to add (they come from the grant, not the session).
export interface PurchaseFields {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  stripeProductId: string | null;
  amountTotalCents: number;
  amountDiscountCents: number;
  stripePromotionCodeId: string | null;
  currency: string;
  // Session metadata snapshot — our own ids only (userId/projectId/kind/bundleKey/
  // stripePriceId); never customer PII. Omitted when the session carries none.
  metadata?: Record<string, string>;
}

// Normalize a Stripe expandable field (id string, or an object with an `id`, or
// null) to its id string.
function stripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

/**
 * Extract the Stripe-derived audit fields for a Purchase row from a completed
 * Checkout Session, or `null` when the session has no usable `amount_total`
 * (`number | null` in Stripe's types — a paid payment-mode session with a null
 * total is anomalous; the caller logs and records NO Purchase rather than a corrupt
 * $0 row, which would also zero that buyer's grandfathering credit). Pure: no db,
 * no Stripe calls. The caller owns the `mode === "payment"` guard (a subscription-
 * mode session's money lands in an Invoice, not a Purchase).
 *
 * `stripeChargeId` is null here (not on the bare session; correlation stays on
 * `payment_intent`) and `stripeProductId`/`stripePromotionCodeId` are null day-1
 * (columns exist for phase 2). `stripePriceId` comes from the metadata the
 * course checkout stamps (Pass/upgrade use inline price_data → no price id).
 */
export function purchaseFromCheckoutSession(
  session: Stripe.Checkout.Session,
): PurchaseFields | null {
  const amountTotalCents = session.amount_total;
  if (typeof amountTotalCents !== "number") return null;

  const rawPriceId = session.metadata?.stripePriceId;
  const stripePriceId =
    typeof rawPriceId === "string" && rawPriceId.length > 0 ? rawPriceId : null;

  return {
    stripeSessionId: session.id,
    stripePaymentIntentId: stripeId(session.payment_intent),
    stripeChargeId: null,
    stripeCustomerId: stripeId(session.customer),
    stripePriceId,
    stripeProductId: null,
    amountTotalCents,
    amountDiscountCents: session.total_details?.amount_discount ?? 0,
    stripePromotionCodeId: null,
    currency: session.currency ?? "usd",
    ...(session.metadata ? { metadata: session.metadata } : {}),
  };
}
