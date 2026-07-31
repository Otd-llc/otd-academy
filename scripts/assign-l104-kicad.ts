// Assign KiCad-10 standard-library symbol + footprint to l1-04's 3 new parts
// (the `[S]` footprint↔pinout work). Without this the starter export has no
// CAD to resolve for D2/D3/F2 and auto-stubs them, and a stub is a placeholder
// outline, not a part.
//
// All lib-ids come from the in-DB indexed standard KiCad library (no vendor
// downloads), and the script refuses to run if any of them is missing from that
// index. Package calls are the ones design.md §5/§7 captured for the `[S]`
// audit and risk RK10:
//
//   D2  SS34-E3/57T       Schottky, **DO-214AB (SMC)**, NOT SMA. RK10 calls
//                         this out by name: assign the SMC footprint, do not
//                         reuse the SMA pads. Datasheet-confirmed 40 V / 3 A,
//                         2-pin DO-214AB. Cathode band faces VSERVO; anode to
//                         GND for the shunt crowbar. KiCad's Device diodes put
//                         pin 1 = K, and D_SMC's pad 1 is the cathode.
//   D3  SMAJ6.0A          Unidirectional TVS, SMA (DO-214AC). Same symbol and
//                         footprint pair l1-03 pass 17 `[S]`-verified for its
//                         SMAJ5.0A, which is the same body in the same family.
//   F2  miniSMDC150F-2    PPTC, 1812 (4532 metric), matching F1's 1206 pattern
//                         one size up. Littelfuse's miniSMDC terminals are
//                         concave; they land on the IPC-7351 rectangular 1812
//                         pads.
//
// Pin/pad counts match: every one of these is a 2-terminal part on a 2-pad
// footprint. Idempotent: sets the two fields by MPN, re-runnable.
//
//   LOCAL: pnpm exec tsx scripts/assign-l104-kicad.ts
//   PROD:  pnpm db:prod scripts/assign-l104-kicad.ts        (owner only)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const ASSIGN = [
  { mpn: "SS34-E3/57T", sym: "Device:D_Schottky", fp: "Diode_SMD:D_SMC" },
  { mpn: "SMAJ6.0A", sym: "Device:D_TVS", fp: "Diode_SMD:D_SMA" },
  { mpn: "miniSMDC150F-2", sym: "Device:Polyfuse", fp: "Fuse:Fuse_1812_4532Metric" },
];

async function main() {
  const { db } = await import("@/lib/db");
  const dbUrl = process.env.DATABASE_URL ?? "";
  console.log(`DB: ${/localhost|127\.0\.0\.1/.test(dbUrl) ? "LOCAL" : "*** REMOTE ***"}\n`);

  // Sanity: every lib-id must exist in the indexed library, and every footprint
  // must have the pad count the part needs, before we point a part at it.
  for (const a of ASSIGN) {
    const s = await db.kicadLibSymbol.findUnique({ where: { libId: a.sym }, select: { libId: true } });
    const f = await db.kicadLibFootprint.findUnique({
      where: { libId: a.fp },
      select: { libId: true, padCount: true },
    });
    if (!s) throw new Error(`symbol not in index: ${a.sym}`);
    if (!f) throw new Error(`footprint not in index: ${a.fp}`);
    if (f.padCount !== 2) throw new Error(`${a.fp} has ${f.padCount} pads, expected 2 for ${a.mpn}`);
  }

  for (const a of ASSIGN) {
    const p = await db.part.findFirst({ where: { mpn: a.mpn }, select: { id: true } });
    if (!p) throw new Error(`part not found: ${a.mpn}`);
    const r = await db.part.update({
      where: { id: p.id },
      data: { kicadSymbol: a.sym, kicadFootprint: a.fp },
      select: { mpn: true, kicadSymbol: true, kicadFootprint: true },
    });
    console.log(`  ok ${r.mpn.padEnd(18)} ${r.kicadSymbol}  +  ${r.kicadFootprint}`);
  }
  await db.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
