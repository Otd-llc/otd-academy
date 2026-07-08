// Create the recurring All-Access SUBSCRIPTION price and store it on the (existing)
// all-access Bundle. The same bundle grants the same access as the one-time Pass;
// this just adds the recurring Stripe price the subscription checkout uses.
//
// RUN MANUALLY against the intended Stripe mode; do not run here. This creates a
// real recurring Stripe Price + writes the Bundle row on the PROD DB (.env.local
// DATABASE_URL is PROD, and STRIPE_SECRET_KEY may be live). Verify the Stripe mode
// (test vs live) BEFORE running:  tsx scripts/set-subscription-price.ts
//
// Amount + interval come from env (a business decision), defaulting to $29.00/month:
//   SUBSCRIPTION_PRICE_CENTS   (default 2900)
//   SUBSCRIPTION_INTERVAL      "month" | "year" (default "month")
//
// Idempotent: if the Bundle already carries a subscriptionPriceId we SKIP creating a
// new Stripe price and only refresh the stored cents (never duplicate a price).
// Requires the Bundle to exist — run set-pass-price.ts first.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BUNDLE_KEY = "all-access";
const DEFAULT_CENTS = 2900;

async function main() {
  const { db } = await import("@/lib/db");
  const { getStripe } = await import("@/lib/stripe");

  const cents = Number(process.env.SUBSCRIPTION_PRICE_CENTS ?? DEFAULT_CENTS);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(
      `SUBSCRIPTION_PRICE_CENTS invalid: ${JSON.stringify(
        process.env.SUBSCRIPTION_PRICE_CENTS,
      )}`,
    );
  }
  const interval = process.env.SUBSCRIPTION_INTERVAL === "year" ? "year" : "month";

  const bundle = await db.bundle.findUnique({ where: { key: BUNDLE_KEY } });
  if (!bundle) {
    throw new Error(
      `No Bundle "${BUNDLE_KEY}" — run scripts/set-pass-price.ts first.`,
    );
  }

  if (bundle.subscriptionPriceId) {
    await db.bundle.update({
      where: { key: BUNDLE_KEY },
      data: { subscriptionPriceCents: cents },
    });
    console.log(
      `set-subscription-price: refreshed cents on ${BUNDLE_KEY} (price id kept ${bundle.subscriptionPriceId})`,
    );
    await db.$disconnect();
    return;
  }

  const price = await getStripe().prices.create({
    currency: "usd",
    unit_amount: cents,
    recurring: { interval },
    product_data: { name: "All-Access Subscription" },
  });
  await db.bundle.update({
    where: { key: BUNDLE_KEY },
    data: { subscriptionPriceId: price.id, subscriptionPriceCents: cents },
  });
  console.log(
    `set-subscription-price: provisioned ${BUNDLE_KEY} → ${price.id} ($${(
      cents / 100
    ).toFixed(2)}/${interval})`,
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
