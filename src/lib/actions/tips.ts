"use server";

// One-time "Support the Academy" tip checkout (GTM). Turns a chosen amount into a
// Hosted Stripe Checkout session. Unlike the course-purchase checkout this grants
// NO entitlement — the webhook records a Tip row keyed on metadata.kind = "tip".
//
// GUEST-CAPABLE: no requireUser. A tip needs no account (it grants nothing), so we
// read the session optionally — attaching the Stripe customer + metadata.userId
// only when signed in. The amount is re-validated server-side; the webhook (not
// this) is the source of truth for the recorded amount.
//
// "use server" rule: this file exports ONLY async functions.
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getStripe, ensureStripeCustomer } from "@/lib/stripe";
import { siteUrl } from "@/lib/seo/jsonld";
import { parseTipAmountCents } from "@/lib/tips";

const inputSchema = z.object({
  amountCents: z.number(),
  // The complete-screen slug the success/cancel URLs return to.
  slug: z.string().trim().min(1).max(200),
});

export async function createTipCheckout(input: {
  amountCents: number;
  slug: string;
}): Promise<{ url: string }> {
  const { amountCents: raw, slug } = inputSchema.parse(input);
  const amountCents = parseTipAmountCents(raw); // throws on out-of-range / non-int

  // Optional signed-in user — a tip is guest-capable.
  const session = await auth();
  const email = session?.user?.email ?? null;
  const user = email
    ? await db.user.findUnique({
        where: { email },
        select: { id: true, email: true, stripeCustomerId: true },
      })
    : null;

  const metadata: Record<string, string> = { kind: "tip" };
  let customer: string | undefined;
  if (user) {
    metadata.userId = user.id;
    customer = await ensureStripeCustomer(user);
  }

  const base = siteUrl();
  const checkout = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Support the Academy",
            description: "A one-time tip — thank you for supporting the work.",
          },
        },
      },
    ],
    customer,
    success_url: `${base}/learn/${slug}/complete?tipped=1`,
    cancel_url: `${base}/learn/${slug}/complete`,
    metadata,
  });

  if (!checkout.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: checkout.url };
}
