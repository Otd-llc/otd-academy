// Generate a board's KiCad starter zip headlessly, so it can be opened in
// KiCad 10 and checked before anyone ships it to a learner.
//
// This is the same code path the `exportKicad` server action runs — it calls
// `buildKicadExportZip` directly — minus the auth gate, the R2 PUT and the
// `BOM_EXPORT` Artifact row. So it is READ-ONLY: it reads the revision's BOM
// and the curated part assets, and writes one zip to disk. Nothing is mutated,
// in the database or in R2.
//
// The zip is the deliverable the learner downloads, so generating it here is
// how a starter gets reviewed before the owner runs the real export against
// production.
//
//   pnpm exec tsx scripts/gen-kicad-starter.ts <project-slug> [rev-label] [--out <path>]
//
// Defaults: rev-label `v1`, out `<slug>-starter.zip` in the current directory.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { writeFileSync } from "node:fs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const slug = positional[0];
  const revLabel = positional[1] ?? "v1";
  if (!slug) {
    console.error(
      "usage: pnpm exec tsx scripts/gen-kicad-starter.ts <project-slug> [rev-label] [--out <path>]",
    );
    process.exit(2);
  }
  const out = arg("--out") ?? `${slug}-starter.zip`;

  const { db } = await import("@/lib/db");
  const { buildKicadExportZip } = await import("@/lib/kicad/export");

  const dbUrl = process.env.DATABASE_URL ?? "";
  console.log(
    `DB: ${/localhost|127\.0\.0\.1/.test(dbUrl) ? "LOCAL" : "*** REMOTE ***"} (${dbUrl.replace(/:[^:@]*@/, ":***@").slice(0, 60)})`,
  );

  const rev = await db.revision.findFirst({
    where: { label: revLabel, project: { slug } },
    select: { id: true, label: true },
  });
  if (!rev) throw new Error(`${slug}@${revLabel} not found`);

  const { zip, report, coverage } = await buildKicadExportZip(rev.id);
  writeFileSync(out, zip);
  console.log(`\nwrote ${out}  (${zip.length} bytes, ${coverage.length} parts)\n`);
  console.log(report);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
