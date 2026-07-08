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

// ─── Phase 2: subscription / invoice / refund extraction ────────────────────
// All pure (no db, no Stripe calls), so the Basil+ field access can be unit-tested.

// The fields for a Subscription upsert, extracted from a Stripe Subscription.
export interface SubscriptionFields {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string | null;
  stripeProductId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  // The userId stamped at checkout (subscription_data.metadata.userId), if present.
  metadataUserId: string | null;
  metadata?: Record<string, string>;
}

/**
 * Extract the Subscription-mirror fields from a Stripe Subscription. Pure.
 *
 * Basil+ API note (we pin 2026-05-27.dahlia, which postdates basil): the period
 * bounds moved off the Subscription onto each `items.data[i]`, so we read
 * `current_period_end` from the items and take the MAX (single-price subs have one
 * item; mixed-interval subs, Stripe 2025-07-30+, can carry several). The price /
 * product id come from `items.data[0].price`.
 */
export function subscriptionFromEvent(
  sub: Stripe.Subscription,
): SubscriptionFields {
  const items = sub.items?.data ?? [];
  const periodEnds = items
    .map((i) => (i as { current_period_end?: number }).current_period_end)
    .filter((n): n is number => typeof n === "number");
  const maxEnd = periodEnds.length > 0 ? Math.max(...periodEnds) : null;

  const price = items[0]?.price;
  const productId =
    price && typeof price.product === "string"
      ? price.product
      : stripeId(price?.product ?? null);

  const metaUserId = sub.metadata?.userId;
  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: stripeId(sub.customer) ?? "",
    stripePriceId: price?.id ?? null,
    stripeProductId: productId,
    status: sub.status,
    currentPeriodEnd: maxEnd != null ? new Date(maxEnd * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    metadataUserId:
      typeof metaUserId === "string" && metaUserId.length > 0 ? metaUserId : null,
    ...(sub.metadata ? { metadata: sub.metadata } : {}),
  };
}

// The fields for an Invoice write, extracted from a Stripe Invoice.
export interface InvoiceFields {
  stripeInvoiceId: string;
  stripeSubscriptionId: string | null;
  userId: string | null;
  stripeCustomerId: string | null;
  amountPaidCents: number;
  currency: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  paidAt: Date;
  metadata?: Record<string, string>;
}

/**
 * Extract the Invoice fields from a Stripe Invoice (invoice.paid). Pure.
 *
 * Basil+ API note: the subscription id moved to
 * `invoice.parent.subscription_details.subscription` (from the old top-level
 * `invoice.subscription`). `paidAt` comes from
 * `status_transitions.paid_at`, falling back to `created` (both are unix seconds).
 */
export function invoiceFromEvent(inv: Stripe.Invoice): InvoiceFields {
  const parent = (
    inv as {
      parent?: {
        subscription_details?: { subscription?: string | { id: string } | null };
      };
    }
  ).parent;
  const stripeSubscriptionId = stripeId(
    parent?.subscription_details?.subscription ?? null,
  );

  const paidAtUnix = inv.status_transitions?.paid_at ?? inv.created;
  const metaUserId = inv.metadata?.userId;
  return {
    stripeInvoiceId: inv.id ?? "",
    stripeSubscriptionId,
    userId:
      typeof metaUserId === "string" && metaUserId.length > 0 ? metaUserId : null,
    stripeCustomerId: stripeId(inv.customer ?? null),
    amountPaidCents: inv.amount_paid ?? 0,
    currency: inv.currency ?? "usd",
    periodStart:
      typeof inv.period_start === "number"
        ? new Date(inv.period_start * 1000)
        : null,
    periodEnd:
      typeof inv.period_end === "number" ? new Date(inv.period_end * 1000) : null,
    paidAt: new Date(paidAtUnix * 1000),
    ...(inv.metadata ? { metadata: inv.metadata } : {}),
  };
}

// One Stripe Refund object, flattened for a Refund row.
export interface RefundFields {
  stripeRefundId: string;
  stripeChargeId: string;
  amountCents: number;
  reason: string | null;
  status: string;
}

// The refund picture for a charge.refunded event.
export interface ChargeRefundInfo {
  // PRIMARY Purchase-correlation key (always present on the refund event's charge).
  paymentIntentId: string | null;
  // Stripe's CUMULATIVE refunded total (smallest unit) — SET onto refundedCents.
  amountRefunded: number;
  amountTotal: number;
  fullyRefunded: boolean;
  refunds: RefundFields[];
}

/**
 * Extract the refund picture from a Stripe Charge (charge.refunded). Pure. The
 * cumulative `amount_refunded` is authoritative (SET, never incremented); a full
 * refund is `amount_refunded >= amount` (with a non-zero amount).
 */
export function refundInfoFromCharge(charge: Stripe.Charge): ChargeRefundInfo {
  const chargeId = charge.id;
  const refunds: RefundFields[] = (charge.refunds?.data ?? []).map((r) => ({
    stripeRefundId: r.id,
    stripeChargeId: chargeId,
    amountCents: r.amount,
    reason: r.reason ?? null,
    status: r.status ?? "unknown",
  }));
  const amountRefunded = charge.amount_refunded ?? 0;
  const amountTotal = charge.amount ?? 0;
  return {
    paymentIntentId: stripeId(charge.payment_intent ?? null),
    amountRefunded,
    amountTotal,
    fullyRefunded: amountTotal > 0 && amountRefunded >= amountTotal,
    refunds,
  };
}

// One Stripe Refund from a refund.created event, with its Purchase-correlation key.
export interface SingleRefund {
  fields: RefundFields;
  paymentIntentId: string | null;
}

/**
 * Extract a single Refund from a refund.created event. Pure. Unlike
 * charge.refunded (whose `refunds` list may not be expanded on the payload), this
 * event IS the Refund object, so the itemized ledger row is guaranteed. It carries
 * only THIS refund's amount, not the cumulative — so charge.refunded still owns
 * Purchase.refundedCents + the full-refund revoke; refund.created only writes the
 * ledger row (both upsert the same stripeRefundId, idempotently).
 */
export function refundFromEvent(refund: Stripe.Refund): SingleRefund {
  return {
    fields: {
      stripeRefundId: refund.id,
      stripeChargeId: stripeId(refund.charge ?? null) ?? "",
      amountCents: refund.amount,
      reason: refund.reason ?? null,
      status: refund.status ?? "unknown",
    },
    paymentIntentId: stripeId(refund.payment_intent ?? null),
  };
}

// A Stripe Dispute (chargeback), flattened for a Dispute row + its Purchase key.
export interface DisputeFields {
  stripeDisputeId: string;
  stripeChargeId: string;
  amountCents: number;
  reason: string | null;
  status: string;
  paymentIntentId: string | null;
}

/**
 * Extract the Dispute fields from a Stripe Dispute (charge.dispute.*). Pure. The
 * Purchase is correlated by `payment_intent` (same key as refunds); `status` is
 * Stripe's verbatim lifecycle string (needs_response → under_review → won / lost).
 */
export function disputeFromEvent(dispute: Stripe.Dispute): DisputeFields {
  return {
    stripeDisputeId: dispute.id,
    stripeChargeId: stripeId(dispute.charge ?? null) ?? "",
    amountCents: dispute.amount,
    reason: dispute.reason ?? null,
    status: dispute.status,
    paymentIntentId: stripeId(dispute.payment_intent ?? null),
  };
}
