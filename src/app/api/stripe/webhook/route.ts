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
  entitlementFromCheckoutSession,
  purchaseFromCheckoutSession,
  tipFromCheckoutSession,
} from "@/lib/stripe-webhook";
import { capture } from "@/lib/analytics";

// Node runtime (raw body + crypto), and never statically prerender this route —
// it depends on the request body, headers, and a runtime secret.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // 5a. Guard against granting on an UNPAID session. With `mode: "payment"` +
    //     card checkout this is normally `"paid"`, but asynchronous payment
    //     methods can deliver `checkout.session.completed` as `"unpaid"` and
    //     settle later via `checkout.session.async_payment_succeeded` (not
    //     handled — card-only for now). Ack (200) BEFORE the transaction, so
    //     nothing is claimed, granted, or recorded.
    if (session.payment_status !== "paid") {
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
  }

  // 6. Stripe only needs a 2xx to consider the event delivered — for handled AND
  //    ignored event types alike.
  return new Response(null, { status: 200 });
}
