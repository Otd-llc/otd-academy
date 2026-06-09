// Generate a real KiCad export zip for l1-01-wroom-breakout@v1 headlessly,
// so it can be opened in KiCad 10 for manual fidelity acceptance (the one gate I
// can't run myself). The export is UNWIRED (placed parts only — no nets/power),
// so it just loads the revision id and calls the real buildKicadExportZip.
// Run: pnpm exec tsx scripts/gen-kicad-export.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { writeFileSync } from "node:fs";

const PROJECT_SLUG = "l1-01-wroom-breakout";
const OUT = "c:\\tmp\\foundry-kicad-export.zip";

async function main() {
  const { db } = await import("@/lib/db");
  const { buildKicadExportZip } = await import("@/lib/kicad/export");

  const rev = await db.revision.findFirst({
    where: { label: "v1", project: { slug: PROJECT_SLUG } },
    select: { id: true },
  });
  if (!rev) throw new Error(`${PROJECT_SLUG}@v1 not found`);

  // ── Generate the real export ──
  const { zip, report, coverage } = await buildKicadExportZip(rev.id);
  writeFileSync(OUT, zip);
  console.log(`\nwrote ${OUT}  (${zip.length} bytes)\n`);
  console.log(`coverage: ${coverage.length} parts`);
  console.log("\n──── EXPORT_REPORT.md ────\n" + report);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
