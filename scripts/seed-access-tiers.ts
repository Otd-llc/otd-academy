// §2 access-tier map → curriculum projects.
//
// One-off, idempotent seed-style script. Writes via Prisma directly (the
// `"use server"` action layer can't be scripted headlessly — see
// populate-curriculum-dag.ts for the why). Applies the §2 tiering map from
// docs/plans/2026-06-09-public-narrative-skill-tree.md onto Project.accessTier:
//   - PUBLIC  (1): l1-01-wroom-breakout (flagship / DAG root / SEO anchor)
//   - FREE    (5): l1-02..l1-05 + l2-01-battery-power-module (the shared-block hook)
//   - PREMIUM (16): every other curriculum board + all 6 bench tools
//
// Leaves priceCents / stripePriceId untouched — prices are DEFERRED (§7).
//
// Idempotent: updateMany by slug (no throw if a slug is absent — warns instead).
// Re-running is a no-op. Touches only the 22 slugs below; any other rows
// (e.g. the archived test-pdne-* fixture) are left alone.
//
// Run: tsx scripts/seed-access-tiers.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

type AccessTier = "PUBLIC" | "FREE" | "PREMIUM";

const ACCESS_TIERS: Record<string, AccessTier> = {
  // PUBLIC
  "l1-01-wroom-breakout": "PUBLIC",
  // FREE
  "l1-02-espnow-link": "FREE",
  "l1-03-ws2812-node": "FREE",
  "l1-04-single-servo": "FREE",
  "l1-05-internal-adc": "FREE",
  "l2-01-battery-power-module": "FREE",
  // PREMIUM
  "l2-02-ads1220-sense": "PREMIUM",
  "l2-03-motor-driver": "PREMIUM",
  "l2-04-power-led-driver": "PREMIUM",
  "l2-05-isolated-spi-bridge": "PREMIUM",
  "l3-de-ads1292r": "PREMIUM",
  "l3-01-eeg-front-end": "PREMIUM",
  "l3-02-brushless-motor": "PREMIUM",
  "l3-03-lighting-array": "PREMIUM",
  "l3-04-bms": "PREMIUM",
  "l3-05-wireless-hub": "PREMIUM",
  "bn-01-usb-c-power-meter": "PREMIUM",
  "bn-02-dc-electronic-load": "PREMIUM",
  "bn-03-dds-function-generator": "PREMIUM",
  "bn-04-curve-tracer": "PREMIUM",
  "bn-05-spot-welder-controller": "PREMIUM",
  "bn-06-tec-thermal-chamber": "PREMIUM",
};

async function main() {
  const { db } = await import("@/lib/db");

  let updated = 0;
  let missing = 0;
  for (const [slug, accessTier] of Object.entries(ACCESS_TIERS)) {
    const res = await db.project.updateMany({
      where: { slug },
      data: { accessTier },
    });
    if (res.count === 0) {
      console.warn(`No project for slug ${slug}`);
      missing++;
    } else {
      updated += res.count;
    }
  }
  console.log(
    `access tiers: ${Object.keys(ACCESS_TIERS).length} slugs in map | ${updated} rows updated | ${missing} missing`,
  );

  await db.$disconnect();
  console.log("seed-access-tiers: complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
