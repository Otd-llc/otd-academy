// One-shot DigiKey offboarding: clears all cached DigiKey Data (Part.dk* +
// PartAvailabilityEvent) per the API User Agreement deletion clause. Direct-Prisma
// (server actions can't be scripted — [[foundry-headless-scripting]]).
//
// ⚠️ `.env.local` DATABASE_URL is PROD. This script wipes production dk* data.
// Dry-run by default; pass --confirm to execute.
//
//   Dry run:  pnpm exec tsx scripts/purge-digikey-data.ts
//   Execute:  pnpm exec tsx scripts/purge-digikey-data.ts --confirm
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const confirm = process.argv.includes("--confirm");
  // Use the shared Neon-adapter-backed client (Prisma 7.8 needs the adapter;
  // import AFTER loadEnv so DATABASE_URL is populated). [[prisma-migrate-prod]]
  const { db } = await import("@/lib/db");
  const { purgeDigikeyData } = await import("@/lib/purge-digikey-data");
  try {
    const host = (process.env.DATABASE_URL ?? "").replace(/.*@/, "").replace(/\/.*/, "");
    const [parts, events] = await Promise.all([
      db.part.count({ where: { dkCheckedAt: { not: null } } }),
      db.partAvailabilityEvent.count(),
    ]);
    console.log(`Target DB host: ${host}`);
    console.log(`Would clear ${parts} checked part(s) + delete ${events} availability event(s).`);

    if (!confirm) {
      console.log("\nDRY RUN — no changes. Re-run with --confirm to execute.");
      return;
    }

    const result = await purgeDigikeyData(db);
    console.log(`\nPurged: ${result.partsCleared} parts cleared, ${result.eventsDeleted} events deleted.`);
    console.log("Now redeploy so the public BOM re-renders without snapshot data.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
