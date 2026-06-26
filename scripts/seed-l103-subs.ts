// l1-03 sourcing subs (2026-06-20): create 3 DigiKey-IN-STOCK replacement parts for
// the lines that came back DK-out-of-stock on the live screen (C1/C10/D3). Mirrors
// each original's category. Idempotent upsert on (manufacturer, mpn); update:{} so a
// re-run never clobbers. Strict-match strings MUST equal the bom.csv rows byte-for-byte.
//   Run: pnpm exec tsx scripts/seed-l103-subs.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const CREATED_BY = "cmpq56v7n0000fouvxtn071rg"; // borrowed (no system user)

const PARTS = [
  {
    // C1 sub — DK-in-stock 10 µF (Samsung core part is DK-OOS). MLCC legacy enum fits.
    manufacturer: "Murata Electronics",
    mpn: "GRM21BR61E106KA73L",
    description: "10 µF ±10% 25 V X5R MLCC, 0805 (2012 metric)",
    category: "MLCC_CAPACITOR" as const,
    categoryId: "cmq0cxtmr0004wkuvbggaf0wq",
  },
  {
    // C10 sub — same Panasonic FM/FR radial family, same 1000 µF/16 V Ø10×20 mm.
    manufacturer: "Panasonic",
    mpn: "EEU-FM1C102",
    description: "1000 µF 16 V aluminum electrolytic, radial THT, Ø10×20 mm (5 mm pitch)",
    category: null,
    categoryId: "cmqk3503e0007h4uvx30qbwga", // ALU_ELECTROLYTIC
  },
  {
    // D3 sub — SOD-323 (same footprint), bidir 5 V ESD, ~3 pF (RC 1.4 ns, better SI).
    manufacturer: "Bourns",
    mpn: "CDSOD323-T05C",
    description: "Bidirectional 5 V ESD-protection diode, single line, SOD-323, ~3 pF, VC ~18 V",
    category: null,
    categoryId: "cmqk34zbn0004h4uvczymgeq8", // ESD_DIODE
  },
];

async function main() {
  const { db } = await import("@/lib/db");
  for (const p of PARTS) {
    const r = await db.part.upsert({
      where: { manufacturer_mpn: { manufacturer: p.manufacturer, mpn: p.mpn } },
      update: {}, // never clobber an existing row
      create: {
        manufacturer: p.manufacturer,
        mpn: p.mpn,
        description: p.description,
        category: p.category,
        categoryId: p.categoryId,
        createdById: CREATED_BY,
      },
      select: { id: true, manufacturer: true, mpn: true, lifecycle: true },
    });
    console.log(`  ✓ ${r.manufacturer} ${r.mpn} (${r.lifecycle}) ${r.id}`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
