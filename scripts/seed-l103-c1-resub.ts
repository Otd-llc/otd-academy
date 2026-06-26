// l1-03 C1 re-sub (2026-06-25): the Pass-16 DK-in-stock sub for C1 (Murata
// GRM21BR61E106KA73L) itself went DK-out-of-stock on the live screen — as did the
// original Samsung CL21A106KOQNNNE and every other 10 µF/0805 candidate except two.
// Re-sub C1 → Yageo CC0805KKX5R7BB106 (DigiKey-VERIFIED Active, 169,157 in stock,
// 10 µF / ±10% / 16 V / X5R / 0805) — deepest stock of the in-stock options, so most
// resilient to another flip; prior subs kept as documented alts. Idempotent upsert on
// (manufacturer, mpn); sets category (MLCC) + KiCad (same 0805 std-lib as the old C1)
// + datasheet. update:{} so a re-run never clobbers.
//   Run: pnpm exec tsx scripts/seed-l103-c1-resub.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const CREATED_BY = "cmpq56v7n0000fouvxtn071rg"; // borrowed (no system user)
const PART = {
  manufacturer: "Yageo",
  mpn: "CC0805KKX5R7BB106",
  description: "10 µF ±10% 16 V X5R MLCC, 0805 (2012 metric)",
  category: "MLCC_CAPACITOR" as const,
  categoryId: "cmq0cxtmr0004wkuvbggaf0wq", // MLCC_CAPACITOR (same as the prior C1 subs)
  kicadSymbol: "Device:C",
  kicadFootprint: "Capacitor_SMD:C_0805_2012Metric",
  datasheetUrl: "https://yageogroup.com/content/datasheet/asset/file/UPY-GPHC_X5R_4V-TO-50V",
};

async function main() {
  const { db } = await import("@/lib/db");

  // Sanity: the KiCad lib-ids must exist in the indexed library.
  const s = await db.kicadLibSymbol.findUnique({ where: { libId: PART.kicadSymbol }, select: { libId: true } });
  const f = await db.kicadLibFootprint.findUnique({ where: { libId: PART.kicadFootprint }, select: { libId: true } });
  if (!s) throw new Error(`symbol not in index: ${PART.kicadSymbol}`);
  if (!f) throw new Error(`footprint not in index: ${PART.kicadFootprint}`);

  const r = await db.part.upsert({
    where: { manufacturer_mpn: { manufacturer: PART.manufacturer, mpn: PART.mpn } },
    update: {}, // never clobber an existing row
    create: {
      manufacturer: PART.manufacturer,
      mpn: PART.mpn,
      description: PART.description,
      category: PART.category,
      categoryId: PART.categoryId,
      kicadSymbol: PART.kicadSymbol,
      kicadFootprint: PART.kicadFootprint,
      datasheetUrl: PART.datasheetUrl,
      createdById: CREATED_BY,
    },
    select: { id: true, manufacturer: true, mpn: true, lifecycle: true, kicadSymbol: true, kicadFootprint: true },
  });
  console.log(`  ✓ ${r.manufacturer} ${r.mpn} (${r.lifecycle}) ${r.id}  [${r.kicadSymbol} + ${r.kicadFootprint}]`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
