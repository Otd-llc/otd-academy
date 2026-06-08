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
//   2. `entitlement.upsert` keyed on the `[userId, projectId]` unique — even if
//      the same purchase somehow reached the grant twice, it can't double-grant.
//
// runtime = "nodejs": we need the RAW request bytes (constructEvent verifies the
// HMAC over the exact body) and node crypto; the edge runtime would mangle both.
import { Prisma } from "@prisma/client";

import { env } from "@/env";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { entitlementFromCheckoutSession } from "@/lib/stripe-webhook";

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
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // 5. We only act on a completed Checkout Session. Everything else is acked.
  if (event.type === "checkout.session.completed") {
    // 5a. First idempotency layer: claim this event id. If it's already claimed
    //     (P2002), the event was processed before (a Stripe redelivery) — return
    //     200 and do NOTHING else, so we never grant twice.
    try {
      await db.processedStripeEvent.create({
        data: { eventId: event.id, type: event.type },
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

    // 5b. Pull the grant target from the session metadata. Without it we cannot
    //     grant — log and ack (nothing to retry; a redelivery wouldn't help).
    const grant = entitlementFromCheckoutSession(event.data.object);
    if (!grant) {
      console.warn(
        `[stripe-webhook] checkout.session.completed ${event.id} has no userId/projectId metadata; skipping grant`,
      );
      return new Response(null, { status: 200 });
    }

    // 5c. Second idempotency layer: upsert keyed on the [userId, projectId]
    //     unique, so this can never produce a duplicate entitlement.
    await db.entitlement.upsert({
      where: {
        userId_projectId: { userId: grant.userId, projectId: grant.projectId },
      },
      create: {
        userId: grant.userId,
        projectId: grant.projectId,
        source: "PURCHASE",
      },
      update: {},
    });
  }

  // 6. Stripe only needs a 2xx to consider the event delivered — for handled AND
  //    ignored event types alike.
  return new Response(null, { status: 200 });
}
