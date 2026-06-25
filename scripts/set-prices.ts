// Set the locked per-project prices on the 16 PREMIUM curriculum boards.
//
// RUN MANUALLY against the intended Stripe mode; do not run here. This creates
// real Stripe Products + Prices and writes stripePriceId/priceCents onto the
// PROD Project rows (.env.local DATABASE_URL is PROD, and STRIPE_SECRET_KEY may be
// live). Verify you are pointed at the Stripe mode you intend (test vs live)
// BEFORE running:  tsx scripts/set-prices.ts
//
// Direct-Prisma + direct-Stripe (modeled on scripts/seed-access-tiers.ts). The
// `setProjectPrice` server action can't be scripted headlessly (it calls
// requireAdmin + revalidatePath), so this replicates its create-product →
// create-price → persist logic inline.
//
// Idempotent: a project that already carries a stripePriceId is SKIPPED (we never
// create a duplicate Stripe price or overwrite an existing one). A missing slug is
// warned, not fatal. Touches only the 16 slugs below.
//
// Locked prices (USD cents), per the GTM monetization brief:
//   L2.02–L2.05                                   = 4900
//   L3 non-capstone (lighting, bms, wireless, ads1292r) = 8900
//   capstones (eeg-front-end, brushless-motor)    = 14900
//   bench bn-01..bn-06                            = 8900
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// Slug → locked price in whole USD cents.
const PRICES: Record<string, number> = {
  // L2 premium boards
  "l2-02-ads1220-sense": 4900,
  "l2-03-motor-driver": 4900,
  "l2-04-power-led-driver": 4900,
  "l2-05-isolated-spi-bridge": 4900,
  // L3 non-capstone
  "l3-03-lighting-array": 8900,
  "l3-04-bms": 8900,
  "l3-05-wireless-hub": 8900,
  "l3-de-ads1292r": 8900,
  // L3 capstones
  "l3-01-eeg-front-end": 14900,
  "l3-02-brushless-motor": 14900,
  // Bench tools
  "bn-01-usb-c-power-meter": 8900,
  "bn-02-dc-electronic-load": 8900,
  "bn-03-dds-function-generator": 8900,
  "bn-04-curve-tracer": 8900,
  "bn-05-spot-welder-controller": 8900,
  "bn-06-tec-thermal-chamber": 8900,
};

async function main() {
  const { db } = await import("@/lib/db");
  const { getStripe } = await import("@/lib/stripe");

  let priced = 0;
  let skipped = 0;
  let missing = 0;

  for (const [slug, priceCents] of Object.entries(PRICES)) {
    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true, name: true, stripePriceId: true },
    });
    if (!project) {
      console.warn(`No project for slug ${slug}`);
      missing++;
      continue;
    }
    if (project.stripePriceId) {
      console.log(`skip ${slug} (already priced: ${project.stripePriceId})`);
      skipped++;
      continue;
    }

    const product = await getStripe().products.create({
      name: project.name,
      metadata: { projectId: project.id },
    });
    const price = await getStripe().prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: priceCents,
      // One-time lifetime unlock — deliberately NO `recurring`.
    });
    await db.project.update({
      where: { id: project.id },
      data: { stripePriceId: price.id, priceCents },
    });
    console.log(`priced ${slug} → ${price.id} ($${(priceCents / 100).toFixed(2)})`);
    priced++;
  }

  console.log(
    `set-prices: ${Object.keys(PRICES).length} slugs | ${priced} priced | ${skipped} skipped | ${missing} missing`,
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
