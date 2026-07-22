// Stripe webhook — the SECURITY-CRITICAL grant path (GTM Phase 3, A4).
//
// This endpoint is the ONLY thing that grants a purchase. We NEVER trust the
// client redirect; a purchase is real only once Stripe POSTs us a
// `checkout.session.completed` event whose signature verifies against
// STRIPE_WEBHOOK_SECRET. Get the signature check + idempotency exactly right.
//
// Idempotency is double-layered (defense in depth):
//   1. `ProcessedStripeEvent.create({ eventId })` — the event id is the table's
//      @id, so a REDELIVERED event (Stripe retries until it sees a 2xx) hits a
//      P2002 unique violation → we treat it as already-processed and 200 no-op.
//   2. The grant is an `upsert` keyed on a unique ([userId, projectId] for a
//      course, [userId, bundleId] for the Pass) — even if the same purchase
//      somehow reached the grant twice, it can't double-grant.
//
// The claim (layer 1) and the grant + Purchase writes run in ONE
// `db.$transaction`, so a crash between them rolls BOTH back and Stripe's retry
// re-runs the whole event — instead of the old failure where the claim committed,
// the grant didn't, and the redelivery no-oped on the claim's P2002, losing the
// purchase forever. The P2002 redelivery catch stays OUTSIDE the transaction (a
// duplicate event aborts the txn; the outer catch maps P2002 → 200). Telemetry
// (`capture`) fires AFTER commit, outside the txn — a network call must never hold
// the transaction connection (5s timeout) or roll back a real grant.
//
// runtime = "nodejs": we need the RAW request bytes (constructEvent verifies the
// HMAC over the exact body) and node crypto; the edge runtime would mangle both.
// It also gives us the @neondatabase/serverless WebSocket Pool, which supports
// interactive `$transaction(async tx => …)` (the HTTP driver would not).
import { Prisma } from "@prisma/client";

import { env } from "@/env";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  bundleFromCheckoutSession,
  disputeFromEvent,
  entitlementFromCheckoutSession,
  invoiceFromEvent,
  purchaseFromCheckoutSession,
  refundFromEvent,
  refundInfoFromCharge,
  subscriptionFromEvent,
  tipFromCheckoutSession,
} from "@/lib/stripe-webhook";
import { capture } from "@/lib/analytics";
import { sendPaymentFailedEmail } from "@/lib/subscription-dunning";
import { recordDunningPending } from "@/lib/dunning-retry";

// Runs on the Node runtime (raw body + crypto), which is the default — cacheComponents
// rejects an explicit `runtime` route-segment config, so it is no longer declared here.
// Never statically prerendered: it depends on the request body, headers, and a runtime
// secret, and POST is never prerendered regardless.

// The all-access bundle key: both the one-time Pass and an active subscription
// grant an Entitlement on THIS bundle (the access is identical; the source column
// distinguishes them — PURCHASE vs SUBSCRIPTION — so a sub cancel never revokes a
// purchased Pass).
const ALL_ACCESS_KEY = "all-access";

// Claim the event id + run its writes in ONE transaction (the day-1 atomicity
// pattern, shared by the phase-2 branches). A redelivery violates the claim's @id
// unique (P2002) → the txn rolls back and this returns a 200 no-op Response; any
// other error propagates (Stripe retries). Returns null on success (the caller
// proceeds to the final 200).
async function claimAndWrite(
  eventId: string,
  type: string,
  work: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<Response | null> {
  try {
    await db.$transaction(async (tx) => {
      await tx.processedStripeEvent.create({ data: { eventId, type } });
      await work(tx);
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return new Response(null, { status: 200 });
    }
    throw e;
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  // 1. Read the RAW body. Do NOT JSON.parse first — Stripe verifies the HMAC over
  //    the exact bytes it sent, so any re-serialization would break the signature.
  const rawBody = await req.text();

  // 2. The signature header Stripe sends alongside the event.
  const sig = req.headers.get("stripe-signature");

  // 3. Without the signing secret OR the signature header we cannot verify the
  //    event — refuse with a 400 (Stripe will surface the failure).
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sig) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  // 4. Verify the signature. A bad signature is a forged/garbled request → 400.
  //    getStripe() is only called HERE (inside POST) so the module stays
  //    import-safe even with no STRIPE_SECRET_KEY configured.
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    // A misconfigured prod webhook secret 400s EVERY event; logging the error
    // MESSAGE (never the raw body or the secret) makes that diagnosable.
    console.warn(
      "Stripe webhook signature verification failed:",
      e instanceof Error ? e.message : String(e),
    );
    return new Response("Invalid signature", { status: 400 });
  }

  // 5. We only act on a completed Checkout Session. Everything else is acked.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // 5a. Guard against granting on an UNPAID session. Card checkout is normally
    //     `"paid"`; a 100%-off promo code completes with NO PaymentIntent and
    //     `payment_status: "no_payment_required"` (Stripe's no-cost-order path) —
    //     that IS a completed purchase and must grant, so we accept both. Async
    //     payment methods can deliver `"unpaid"` and settle later via
    //     `async_payment_succeeded` (not handled — card-only). Ack (200) BEFORE the
    //     transaction, so an unpaid session is never claimed, granted, or recorded.
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return new Response(null, { status: 200 });
    }

    // 5b. Pure branch extraction (no db, no Stripe calls): tip, else bundle Pass,
    //     else per-project course.
    const tip = tipFromCheckoutSession(session);
    const bundleGrant = tip ? null : bundleFromCheckoutSession(session);
    const grant =
      tip || bundleGrant ? null : entitlementFromCheckoutSession(session);

    // 5c. Purchase audit fields (course/bundle purchases only, never tips). We
    //     record a Purchase ONLY for one-time payment-mode sessions: a
    //     subscription-mode checkout fires this same event but its money belongs
    //     in an Invoice (phase 2). `purchaseFields` is null when amount_total is
    //     missing (anomalous on a paid session — see purchaseFromCheckoutSession).
    const isPayment = session.mode === "payment";
    const purchaseFields = purchaseFromCheckoutSession(session);

    // Returned from the transaction (a captured `let` mutated inside the async
    // callback narrows to `never` at the read site); the `purchase_completed`
    // funnel event fires AFTER the transaction commits (never inside — see header).
    let purchaseCompleted: { userId: string; projectId: string } | null = null;
    // Set inside the txn, CAPTURED after commit (telemetry never runs inside the
    // transaction — see header). Non-null = money moved but no Purchase row was
    // recordable (null amount_total): a revenue-audit hole that console alone
    // left invisible.
    let purchaseRecordMissing: { sessionId: string; kind: string } | null = null;

    // 5d. Claim + grant + Purchase in ONE transaction (atomicity — see header).
    try {
      purchaseCompleted = await db.$transaction(async (tx) => {
        // First idempotency layer: claim this event id. A redelivery violates the
        // @id unique (P2002) → the txn rolls back and the OUTER catch 200-no-ops.
        await tx.processedStripeEvent.create({
          data: { eventId: event.id, type: event.type },
        });

        // A one-time "Support the Academy" tip grants NO entitlement — record it
        // for accounting (amount from Stripe, not the client) and ack. Idempotent
        // on the unique stripeSessionId. A tip is never a Purchase.
        if (tip) {
          await tx.tip.upsert({
            where: { stripeSessionId: tip.stripeSessionId },
            create: {
              stripeSessionId: tip.stripeSessionId,
              userId: tip.userId,
              email: tip.email,
              amountCents: tip.amountCents,
              currency: tip.currency,
            },
            update: {},
          });
          return null;
        }

        // An All-Access Pass purchase grants a bundle Entitlement (access to every
        // project). Idempotent via the [userId, bundleId] unique (added in this
        // migration): a concurrent double-grant collapses to one row, while a real
        // double-charge (two distinct sessions) records two Purchases — the
        // duplicate Purchase is the refund evidence, not noise.
        if (bundleGrant) {
          const bundle = await tx.bundle.findUnique({
            where: { key: bundleGrant.bundleKey },
            select: { id: true },
          });
          if (!bundle) {
            console.warn(
              `[stripe-webhook] bundle checkout ${event.id} references unknown bundleKey ${bundleGrant.bundleKey}; skipping grant`,
            );
            return null;
          }
          const entitlement = await tx.entitlement.upsert({
            where: {
              userId_bundleId: {
                userId: bundleGrant.userId,
                bundleId: bundle.id,
              },
            },
            create: {
              userId: bundleGrant.userId,
              bundleId: bundle.id,
              source: "PURCHASE",
            },
            update: {},
          });
          if (isPayment && purchaseFields) {
            await tx.purchase.create({
              data: {
                ...purchaseFields,
                userId: bundleGrant.userId,
                bundleId: bundle.id,
                entitlementId: entitlement.id,
              },
            });
          } else if (isPayment) {
            console.error(
              `[stripe-webhook] paid payment-mode bundle session ${session.id} has null amount_total; entitlement granted, Purchase NOT recorded`,
            );
            purchaseRecordMissing = { sessionId: session.id, kind: "bundle" };
          }
          return null;
        }

        // A per-project premium purchase. Second idempotency layer: upsert on the
        // [userId, projectId] unique. Records the Purchase in the same transaction,
        // back-linked to the entitlement it grants.
        if (grant) {
          const entitlement = await tx.entitlement.upsert({
            where: {
              userId_projectId: {
                userId: grant.userId,
                projectId: grant.projectId,
              },
            },
            create: {
              userId: grant.userId,
              projectId: grant.projectId,
              source: "PURCHASE",
            },
            update: {},
          });
          if (isPayment && purchaseFields) {
            await tx.purchase.create({
              data: {
                ...purchaseFields,
                userId: grant.userId,
                projectId: grant.projectId,
                entitlementId: entitlement.id,
              },
            });
          } else if (isPayment) {
            console.error(
              `[stripe-webhook] paid payment-mode session ${session.id} has null amount_total; entitlement granted, Purchase NOT recorded`,
            );
            purchaseRecordMissing = { sessionId: session.id, kind: "course" };
          }
          return {
            userId: grant.userId,
            projectId: grant.projectId,
          };
        }

        // No tip/bundle/project metadata — nothing to grant. The event is claimed
        // (so a redelivery no-ops) and acked; a retry wouldn't help.
        console.warn(
          `[stripe-webhook] checkout.session.completed ${event.id} has no tip/bundle/project metadata; skipping grant`,
        );
        return null;
      });
    } catch (e) {
      // A redelivered event rolls back on the claim's P2002 → already processed,
      // 200 no-op. Any other error → rethrow so Stripe retries the whole event.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return new Response(null, { status: 200 });
      }
      throw e;
    }

    // Funnel: `purchase_completed` — fired on the per-project grant path, AFTER the
    // transaction commits and OUTSIDE it. Best-effort (try/catch) so telemetry can
    // never break the webhook 2xx Stripe needs; no-op when PostHog is unconfigured.
    if (purchaseCompleted) {
      try {
        capture(
          "purchase_completed",
          { projectId: purchaseCompleted.projectId },
          purchaseCompleted.userId,
        );
      } catch {
        // never break the webhook ack on telemetry
      }
    }
    if (purchaseRecordMissing) {
      try {
        capture("purchase_record_missing", purchaseRecordMissing);
      } catch {
        // never break the webhook ack on telemetry
      }
    }
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.paused" ||
    event.type === "customer.subscription.resumed" ||
    event.type === "customer.subscription.pending_update_applied" ||
    event.type === "customer.subscription.pending_update_expired" ||
    event.type === "customer.subscription.trial_will_end"
  ) {
    // ANY subscription lifecycle event (create/update/delete/pause/resume/pending-
    // update/trial-will-end) — they all carry the Subscription object, and the logic
    // is STATUS-DRIVEN, so one branch reconciles them all. Upsert the mirror + drive
    // the ACCESS consequence: an active/trialing sub mints the all-access Entitlement
    // (source SUBSCRIPTION); ANY other status (canceled, past_due, paused, unpaid, …)
    // revokes it. A purchased Pass (source PURCHASE) is never touched. `trial_will_end`
    // fires while still trialing, so it correctly leaves access in place.
    const f = subscriptionFromEvent(event.data.object);
    const early = await claimAndWrite(event.id, event.type, async (tx) => {
      // Resolve the user: the metadata stamped at checkout, else the Stripe customer.
      let userId = f.metadataUserId;
      if (!userId && f.stripeCustomerId) {
        const u = await tx.user.findUnique({
          where: { stripeCustomerId: f.stripeCustomerId },
          select: { id: true },
        });
        userId = u?.id ?? null;
      }

      const subData = {
        userId,
        stripeCustomerId: f.stripeCustomerId,
        stripePriceId: f.stripePriceId,
        stripeProductId: f.stripeProductId,
        status: f.status,
        currentPeriodEnd: f.currentPeriodEnd,
        cancelAtPeriodEnd: f.cancelAtPeriodEnd,
        ...(f.metadata ? { metadata: f.metadata } : {}),
      };
      const subRow = await tx.subscription.upsert({
        where: { stripeSubscriptionId: f.stripeSubscriptionId },
        create: { stripeSubscriptionId: f.stripeSubscriptionId, ...subData },
        update: subData,
      });

      // Backfill any Invoice that landed before this Subscription row existed.
      await tx.invoice.updateMany({
        where: {
          stripeSubscriptionId: f.stripeSubscriptionId,
          subscriptionId: null,
        },
        data: { subscriptionId: subRow.id },
      });

      if (!userId) return; // recorded the sub; no user to grant/revoke access for
      const bundle = await tx.bundle.findUnique({
        where: { key: ALL_ACCESS_KEY },
        select: { id: true },
      });
      if (!bundle) return;

      const active = f.status === "active" || f.status === "trialing";
      if (active) {
        await tx.entitlement.upsert({
          where: { userId_bundleId: { userId, bundleId: bundle.id } },
          create: { userId, bundleId: bundle.id, source: "SUBSCRIPTION" },
          update: {}, // never downgrade a purchased Pass (source PURCHASE)
        });
      } else {
        // Only revoke SUBSCRIPTION-granted access, never a purchased Pass.
        await tx.entitlement.deleteMany({
          where: { userId, bundleId: bundle.id, source: "SUBSCRIPTION" },
        });
      }
    });
    if (early) return early;
  } else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded"
  ) {
    // A paid subscription invoice. Both events fire on a successful renewal; the
    // write-once upsert makes recording on either idempotent. One-time payments never
    // hit this — Purchase covers those. Resolve the Subscription FK if its row exists
    // yet; the subscription upsert backfills the link for an invoice that landed first.
    const f = invoiceFromEvent(event.data.object);
    const early = await claimAndWrite(event.id, event.type, async (tx) => {
      let userId = f.userId;
      let subscriptionId: string | null = null;
      if (f.stripeSubscriptionId) {
        const sub = await tx.subscription.findUnique({
          where: { stripeSubscriptionId: f.stripeSubscriptionId },
          select: { id: true, userId: true },
        });
        if (sub) {
          subscriptionId = sub.id;
          if (!userId) userId = sub.userId;
        }
      }
      if (!userId && f.stripeCustomerId) {
        const u = await tx.user.findUnique({
          where: { stripeCustomerId: f.stripeCustomerId },
          select: { id: true },
        });
        userId = u?.id ?? null;
      }

      await tx.invoice.upsert({
        where: { stripeInvoiceId: f.stripeInvoiceId },
        create: {
          stripeInvoiceId: f.stripeInvoiceId,
          stripeSubscriptionId: f.stripeSubscriptionId,
          subscriptionId,
          userId,
          stripeCustomerId: f.stripeCustomerId,
          amountPaidCents: f.amountPaidCents,
          currency: f.currency,
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
          paidAt: f.paidAt,
          ...(f.metadata ? { metadata: f.metadata } : {}),
        },
        update: {}, // write-once
      });
    });
    if (early) return early;
  } else if (event.type === "charge.refunded") {
    // Refund audit + access consequence. Correlate the Purchase by payment_intent,
    // record each Stripe Refund, SET refundedCents to the cumulative amount, and on
    // a FULL refund revoke the granted entitlement. A refunded tip matches no
    // Purchase — record nothing further and DO NOT throw (a 500 loops Stripe's retry).
    const info = refundInfoFromCharge(event.data.object);
    const early = await claimAndWrite(event.id, event.type, async (tx) => {
      const purchase = info.paymentIntentId
        ? await tx.purchase.findFirst({
            where: { stripePaymentIntentId: info.paymentIntentId },
            select: { id: true, entitlementId: true, amountTotalCents: true },
          })
        : null;

      for (const r of info.refunds) {
        await tx.refund.upsert({
          where: { stripeRefundId: r.stripeRefundId },
          create: { ...r, purchaseId: purchase?.id ?? null },
          update: { purchaseId: purchase?.id ?? null, status: r.status },
        });
      }

      if (!purchase) return; // e.g. a refunded tip — nothing more to reconcile

      // SET (never increment) to Stripe's cumulative total; clamp to the charge so
      // the purchase_amount_nonneg CHECK (refundedCents <= amountTotalCents) holds.
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          refundedCents: Math.min(
            info.amountRefunded,
            purchase.amountTotalCents,
          ),
        },
      });

      // Full refund → revoke the granted entitlement (the Purchase audit row and its
      // now-dangling entitlementId survive). Partial refund keeps access.
      if (info.fullyRefunded && purchase.entitlementId) {
        await tx.entitlement.deleteMany({
          where: { id: purchase.entitlementId },
        });
      }
    });
    if (early) return early;
  } else if (event.type === "refund.created") {
    // The itemized Refund ledger, guaranteed: this event IS the Refund object (vs
    // charge.refunded's possibly-unexpanded list). Records/updates the Refund row and
    // correlates the Purchase by payment_intent. It carries only THIS refund's amount,
    // NOT the cumulative — so charge.refunded still owns Purchase.refundedCents + the
    // full-refund revoke; both upsert the same stripeRefundId idempotently.
    const { fields, paymentIntentId } = refundFromEvent(event.data.object);
    const early = await claimAndWrite(event.id, event.type, async (tx) => {
      const purchase = paymentIntentId
        ? await tx.purchase.findFirst({
            where: { stripePaymentIntentId: paymentIntentId },
            select: { id: true },
          })
        : null;
      await tx.refund.upsert({
        where: { stripeRefundId: fields.stripeRefundId },
        create: { ...fields, purchaseId: purchase?.id ?? null },
        update: { purchaseId: purchase?.id ?? null, status: fields.status },
      });
    });
    if (early) return early;
  } else if (event.type === "invoice.payment_failed") {
    // A subscription renewal payment FAILED → dunning. ACCESS is already handled by
    // customer.subscription.updated (status → past_due/incomplete → revoke), and the
    // failing sub is queryable via Subscription.status — so there is no new DB state to
    // record. The event CLAIM is the idempotency point: a redelivery hits the claim's
    // P2002 → 200 no-op → NO duplicate email. Send the email AFTER the claim commits
    // (post-commit, like capture()); the sender never throws (see subscription-dunning).
    const inv = event.data.object;
    const early = await claimAndWrite(event.id, event.type, async () => {
      // No DB writes; the claim alone guards the single send.
    });
    if (early) return early;
    const customerId =
      typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
    if (customerId) {
      const user = await db.user.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true, email: true },
      });
      if (user?.email) {
        const ok = await sendPaymentFailedEmail({ toEmail: user.email });
        if (!ok && inv.id) {
          // The claim above already committed, so Stripe will never redeliver
          // this send — park it for the lifecycle cron's durable retry instead
          // of letting the customer's only "your card failed" notice vanish.
          await recordDunningPending(db, user.id, inv.id);
          capture("dunning_send_failed", { stage: "webhook", invoiceId: inv.id }, user.id);
        }
      } else {
        console.warn(
          `[stripe-webhook] payment_failed for customer ${customerId}: no user/email to notify`,
        );
      }
    }
  } else if (
    event.type === "invoice.payment_action_required" ||
    event.type === "invoice.payment_attempt_required"
  ) {
    // SCA / retry-needed — a DIFFERENT message than a hard failure (the billing portal
    // does not resolve an authentication requirement), and rare for our card-only flow.
    // Log-only for ops visibility; access still follows the subscription status.
    const inv = event.data.object;
    const cust =
      typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? "?";
    console.warn(
      `[stripe-webhook] ${event.type} for invoice ${inv.id} (customer ${cust}) — access follows the subscription status`,
    );
  } else if (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.updated" ||
    event.type === "charge.dispute.closed" ||
    event.type === "charge.dispute.funds_withdrawn" ||
    event.type === "charge.dispute.funds_reinstated"
  ) {
    // Chargeback lifecycle. Record the Dispute (upsert by stripeDisputeId, tracking
    // its status), correlated to the Purchase by payment_intent. RECORD-ONLY: access
    // is NOT auto-revoked (an education chargeback is often won; pull-then-restore is
    // worse than an admin decision). To auto-revoke on `created`, delete the
    // purchase's entitlement here the same way charge.refunded does.
    const f = disputeFromEvent(event.data.object);
    const early = await claimAndWrite(event.id, event.type, async (tx) => {
      const purchase = f.paymentIntentId
        ? await tx.purchase.findFirst({
            where: { stripePaymentIntentId: f.paymentIntentId },
            select: { id: true },
          })
        : null;
      await tx.dispute.upsert({
        where: { stripeDisputeId: f.stripeDisputeId },
        create: {
          stripeDisputeId: f.stripeDisputeId,
          stripeChargeId: f.stripeChargeId,
          purchaseId: purchase?.id ?? null,
          amountCents: f.amountCents,
          reason: f.reason,
          status: f.status,
        },
        update: { status: f.status, purchaseId: purchase?.id ?? null },
      });
    });
    if (early) return early;
  }

  // 6. Stripe only needs a 2xx to consider the event delivered — for handled AND
  //    ignored event types alike.
  return new Response(null, { status: 200 });
}
