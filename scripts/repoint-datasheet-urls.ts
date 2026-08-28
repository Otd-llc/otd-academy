// Repoint datasheet URLs off distributor mirrors (media.digikey.com / mm.digikey.com
// / mouser.com) onto manufacturer-hosted PDFs. A manufacturer-copyright tidy-up that
// also improves link durability. Idempotent updateMany per MPN; warns (doesn't throw)
// on a missing MPN. Direct-Prisma — server actions can't be scripted
// ([[foundry-headless-scripting]]); bare `new PrismaClient()` fails on this repo's
// Prisma 7.8 + Neon adapter, so import the shared client AFTER loadEnv populates
// DATABASE_URL ([[prisma-migrate-prod]]).
//
// ⚠️ `.env.local` DATABASE_URL is LOCAL (`foundry_dev`) since 2026-07-15, so a bare
// run rewrites LOCAL part data, not production. Prod requires
// `pnpm db:prod scripts/repoint-datasheet-urls.ts`, which prints the target host and
// makes you type `prod`. A green bare run is NOT evidence prod was repointed.
// Dry-run by default; pass --confirm to execute.
//
//   Dry run:  pnpm exec tsx scripts/repoint-datasheet-urls.ts
//   Execute:  pnpm exec tsx scripts/repoint-datasheet-urls.ts --confirm
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// ONLY URLs confirmed-resolving to the correct manufacturer-hosted datasheet PDF
// (2026-06-19):
//   - Samsung specsheet endpoint (masterKey = the part base): returns the part's
//     own manufacturer specsheet PDF. Verified both keys return application/pdf.
//   - Yageo RC_L-series "GENERAL PURPOSE CHIP RESISTORS" datasheet on yageogroup.com
//     (Yageo's official domain): covers the 0805 size and the RC<size>F R-07…L global
//     part-number scheme — i.e. all three RC0805FR-07…L resistors below.
// PRPC040SAAN-RC (Sullins) intentionally OMITTED — could not confirm a
// sullinscorp.com-hosted drawing URL for the single-row part (drawing 11635); the
// Sullins filename carries an unpredictable numeric prefix and direct guesses 404.
// Left on its existing mm.digikey.com mirror rather than guess a URL.
const REPOINTS: Record<string, string> = {
  CL21A106KOQNNNE:
    "https://product.samsungsem.com/part/download.do?masterKey=CL21A106KOQNNN&type=specsheet",
  CL21B104KBCNNNC:
    "https://product.samsungsem.com/part/download.do?masterKey=CL21B104KBCNNN&type=specsheet",
  "RC0805FR-0710KL":
    "https://yageogroup.com/content/datasheet/asset/file/PYU-RC_GROUP_51_ROHS_L",
  "RC0805FR-075K1L":
    "https://yageogroup.com/content/datasheet/asset/file/PYU-RC_GROUP_51_ROHS_L",
  "RC0805FR-07470RL":
    "https://yageogroup.com/content/datasheet/asset/file/PYU-RC_GROUP_51_ROHS_L",
};

async function main() {
  const confirm = process.argv.includes("--confirm");
  const { db } = await import("@/lib/db");
  try {
    const host = (process.env.DATABASE_URL ?? "").replace(/.*@/, "").replace(/\/.*/, "");
    console.log(`Target DB host: ${host}`);

    if (!confirm) {
      for (const [mpn, datasheetUrl] of Object.entries(REPOINTS)) {
        const n = await db.part.count({ where: { mpn } });
        if (n === 0) console.warn(`no part with mpn=${mpn}`);
        else console.log(`would repoint ${mpn} (${n} part(s)) → ${datasheetUrl}`);
      }
      console.log("\nDRY RUN — no changes. Re-run with --confirm to execute.");
      return;
    }

    for (const [mpn, datasheetUrl] of Object.entries(REPOINTS)) {
      // Rollback record: log the prior value(s) before overwriting so the run log
      // captures what to revert to.
      const before = await db.part.findMany({ where: { mpn }, select: { id: true, datasheetUrl: true } });
      for (const p of before) console.log(`rollback ${mpn} part=${p.id} old=${p.datasheetUrl ?? "(null)"}`);
      const res = await db.part.updateMany({ where: { mpn }, data: { datasheetUrl } });
      if (res.count === 0) console.warn(`No part with mpn=${mpn} — skipped.`);
      else console.log(`Repointed ${mpn} → ${datasheetUrl}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
