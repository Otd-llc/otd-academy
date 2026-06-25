// Create the All-Access Pass Stripe product + prices and upsert the Bundle row.
//
// RUN MANUALLY against the intended Stripe mode; do not run here. This creates a
// real Stripe Product + Prices and writes the Bundle row on the PROD DB
// (.env.local DATABASE_URL is PROD, and STRIPE_SECRET_KEY may be live). Verify the
// Stripe mode (test vs live) BEFORE running:  tsx scripts/set-pass-price.ts
//
// Locked Pass prices (USD cents): standard = 39900, launch = 29900.
// The launch window closes at the RFC-3339 / ISO timestamp in LAUNCH_WINDOW_END
// (e.g. LAUNCH_WINDOW_END=2026-08-01T00:00:00Z). If LAUNCH_WINDOW_END is unset,
// the Bundle is written with no launch price (standard only).
//
// Idempotent: if the Bundle already carries a stripePriceId we SKIP creating new
// Stripe prices and only refresh the cents/launch fields (so re-running to extend
// the launch window is safe and never duplicates Stripe objects).
//
// Direct-Prisma + direct-Stripe (the pass actions can't be scripted headlessly —
// requireUser). Mirrors scripts/set-prices.ts.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const BUNDLE_KEY = "all-access";
const BUNDLE_NAME = "All-Access Pass";
const STANDARD_CENTS = 39900;
const LAUNCH_CENTS = 29900;

async function main() {
  const { db } = await import("@/lib/db");
  const { getStripe } = await import("@/lib/stripe");

  const launchRaw = process.env.LAUNCH_WINDOW_END;
  let launchEndsAt: Date | null = null;
  if (launchRaw) {
    const d = new Date(launchRaw);
    if (Number.isNaN(d.getTime())) {
      throw new Error(
        `LAUNCH_WINDOW_END is not a valid date: ${JSON.stringify(launchRaw)}`,
      );
    }
    launchEndsAt = d;
  }
  const launchPriceCents = launchEndsAt ? LAUNCH_CENTS : null;

  const existing = await db.bundle.findUnique({ where: { key: BUNDLE_KEY } });

  if (existing?.stripePriceId) {
    // Already provisioned — only refresh the cents/launch window (no new Stripe
    // objects). Lets you extend or close the launch window by re-running.
    await db.bundle.update({
      where: { key: BUNDLE_KEY },
      data: { priceCents: STANDARD_CENTS, launchPriceCents, launchEndsAt },
    });
    console.log(
      `set-pass-price: refreshed Bundle ${BUNDLE_KEY} (price id kept ${existing.stripePriceId}); launch ${
        launchEndsAt ? launchEndsAt.toISOString() : "none"
      }`,
    );
    await db.$disconnect();
    return;
  }

  // First-time provision: one Product, a standard Price + (optionally) a launch
  // Price. The Bundle stores the STANDARD price id (checkout charges the active
  // amount via ad-hoc price_data, so the stored id is the canonical reference).
  const product = await getStripe().products.create({
    name: BUNDLE_NAME,
    metadata: { bundleKey: BUNDLE_KEY },
  });
  const standardPrice = await getStripe().prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: STANDARD_CENTS,
  });
  if (launchPriceCents) {
    await getStripe().prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: launchPriceCents,
      metadata: { window: "launch" },
    });
  }

  await db.bundle.upsert({
    where: { key: BUNDLE_KEY },
    create: {
      key: BUNDLE_KEY,
      name: BUNDLE_NAME,
      stripePriceId: standardPrice.id,
      priceCents: STANDARD_CENTS,
      launchPriceCents,
      launchEndsAt,
    },
    update: {
      name: BUNDLE_NAME,
      stripePriceId: standardPrice.id,
      priceCents: STANDARD_CENTS,
      launchPriceCents,
      launchEndsAt,
    },
  });

  console.log(
    `set-pass-price: provisioned Bundle ${BUNDLE_KEY} → ${standardPrice.id} (standard $${(
      STANDARD_CENTS / 100
    ).toFixed(2)}); launch ${
      launchEndsAt
        ? `$${(LAUNCH_CENTS / 100).toFixed(2)} until ${launchEndsAt.toISOString()}`
        : "none"
    }`,
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
