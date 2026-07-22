// Pricing decision (2026-07): only L1.01 is free. L1.02–L1.05 + L2.01 move
// FREE → PREMIUM so the access tier matches the copy (course pages, OG chips,
// and the paywall all read tier). Idempotent; DRY-RUN by default.
//
//   LOCAL:  pnpm tsx scripts/set-l102-l201-premium.ts            (dry-run)
//           pnpm tsx scripts/set-l102-l201-premium.ts --write
//   PROD:   pnpm db:prod scripts/set-l102-l201-premium.ts --yes -- --write
//
// These five are UNPUBLISHED, so this has no live-visible effect today; it keeps
// the data honest for when they publish. Prices stay unset (they show as "Soon"
// in the pricing catalog) until a per-course price is decided.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SLUGS = [
  "l1-02-espnow-link",
  "l1-03-ws2812-node",
  "l1-04-single-servo",
  "l1-05-internal-adc",
  "l2-01-battery-power-module",
];

async function main() {
  const write = process.argv.includes("--write");
  const { db } = await import("@/lib/db");
  for (const slug of SLUGS) {
    const p = await db.project.findUnique({
      where: { slug },
      select: { accessTier: true },
    });
    if (!p) {
      console.log(`MISS ${slug} (not found)`);
      continue;
    }
    console.log(`${write ? "SET " : "DRY "} ${slug}: ${p.accessTier} -> PREMIUM`);
    if (write && p.accessTier !== "PREMIUM") {
      await db.project.update({ where: { slug }, data: { accessTier: "PREMIUM" } });
    }
  }
  console.log(write ? "\nDONE." : "\nDRY-RUN (pass --write to persist).");
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
