// Assign the KiCad-10 standard-library SYMBOL to l1-05's one new part, RV1
// (Bourns 3362P-1-103LF trimpot). Without it the export has no symbol to
// resolve and auto-stubs the part.
//
// `Device:R_Potentiometer_Trim` is a 3-pin trimmer symbol whose **pin 2 is the
// wiper**, which is what design.md §7 captured for the `[S]` audit: "RV1 3362P
// terminal 2 = wiper". Pin 1 and pin 3 are the track ends, wired across
// 3V3 and GND.
//
// The FOOTPRINT is deliberately NOT set here. KiCad ships no 3362 land pattern
// and every near-miss in `Potentiometer_THT` has the wrong body and a
// triangular pin pattern this part does not have, so RV1 gets a hand-authored
// footprint asset instead: `scripts/seed-l105-trimpot-footprint.ts`. Run that
// one too, or the export will stub the footprint.
//
// Idempotent: sets the field by MPN, re-runnable.
//
//   LOCAL: pnpm exec tsx scripts/assign-l105-kicad.ts
//   PROD:  pnpm db:prod scripts/assign-l105-kicad.ts        (owner only)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const ASSIGN = [{ mpn: "3362P-1-103LF", sym: "Device:R_Potentiometer_Trim" }];

async function main() {
  const { db } = await import("@/lib/db");
  const dbUrl = process.env.DATABASE_URL ?? "";
  console.log(`DB: ${/localhost|127\.0\.0\.1/.test(dbUrl) ? "LOCAL" : "*** REMOTE ***"}\n`);

  for (const a of ASSIGN) {
    const s = await db.kicadLibSymbol.findUnique({ where: { libId: a.sym }, select: { libId: true } });
    if (!s) throw new Error(`symbol not in index: ${a.sym}`);
  }
  for (const a of ASSIGN) {
    const p = await db.part.findFirst({ where: { mpn: a.mpn }, select: { id: true } });
    if (!p) throw new Error(`part not found: ${a.mpn}`);
    const r = await db.part.update({
      where: { id: p.id },
      data: { kicadSymbol: a.sym },
      select: { mpn: true, kicadSymbol: true, kicadFootprint: true },
    });
    console.log(`  ok ${r.mpn.padEnd(16)} ${r.kicadSymbol}  (footprint: ${r.kicadFootprint ?? "hand-authored asset"})`);
  }
  await db.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
