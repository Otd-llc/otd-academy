// One-shot DigiKey offboarding: clears all cached DigiKey Data (Part.dk* +
// PartAvailabilityEvent) per the API User Agreement deletion clause. Direct-Prisma
// (server actions can't be scripted — [[foundry-headless-scripting]]).
//
// ⚠️ `.env.local` DATABASE_URL is LOCAL (`foundry_dev`) since 2026-07-15, so a bare
// run wipes LOCAL dk* data, not production. To wipe PROD you must go through
// `pnpm db:prod scripts/purge-digikey-data.ts` -- which prints the target host and
// makes you type `prod`. Do not read a successful bare run as a completed prod purge.
// Dry-run by default; pass --confirm to execute. Executing additionally requires
// a typed project name as a second factor (--project=otd-academy) so a library-
// wide prod purge can't fire from --confirm alone.
//
//   Dry run:  pnpm exec tsx scripts/purge-digikey-data.ts
//   Execute:  pnpm exec tsx scripts/purge-digikey-data.ts --confirm --project=otd-academy
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// Second-factor confirmation for the destructive (library-wide) path: --confirm
// alone is not enough; the invocation must also name the target project.
const PROJECT_CONFIRM = "otd-academy";

async function main() {
  const confirm = process.argv.includes("--confirm");
  const projectConfirmed = process.argv.includes(`--project=${PROJECT_CONFIRM}`);
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
    console.log(`Would clear DigiKey snapshot data library-wide (${parts} part(s) currently carry a snapshot) + delete ${events} availability event(s).`);

    if (!confirm) {
      console.log("\nDRY RUN — no changes. Re-run with --confirm --project=otd-academy to execute.");
      return;
    }

    if (!projectConfirmed) {
      console.error(
        `\nrefusing library-wide purge: pass --project=${PROJECT_CONFIRM} to confirm the target.`,
      );
      process.exit(1);
    }

    const result = await purgeDigikeyData(db);
    // partsCleared counts every row touched by the library-wide updateMany, not just
    // the snapshot-carrying subset previewed above.
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
