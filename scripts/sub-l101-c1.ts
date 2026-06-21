// Update the LIVE L1-01 lesson: repoint C1 from the DK-out-of-stock Samsung
// CL21A106KOQNNNE to the in-stock Murata GRM21BR61E106KA73L (same 10 µF / 0805 —
// KiCad footprint unchanged). Surgical: touches ONLY C1's BomLine on l1-01's
// frozen published revision; keeps Samsung as the documented alt. Idempotent.
//   Dry run:  pnpm exec tsx scripts/_sub-l101-c1.ts
//   Apply:    pnpm exec tsx scripts/_sub-l101-c1.ts --confirm
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const CONFIRM = process.argv.includes("--confirm");
const OLD = { manufacturer: "Samsung Electro-Mechanics", mpn: "CL21A106KOQNNNE" };
const NEW = { manufacturer: "Murata Electronics", mpn: "GRM21BR61E106KA73L" };

async function main() {
  const { db } = await import("@/lib/db");
  const rev = await db.revision.findFirst({
    where: { project: { slug: "l1-01-wroom-breakout" }, bomFrozenAt: { not: null } },
    orderBy: { bomFrozenAt: "desc" },
    select: { id: true, label: true, bomFrozenAt: true },
  });
  if (!rev) throw new Error("no frozen l1-01 revision");
  console.log(`l1-01 rev ${rev.label} (FROZEN ${rev.bomFrozenAt?.toISOString()})`);

  const newPart = await db.part.findUnique({
    where: { manufacturer_mpn: NEW },
    select: { id: true, lifecycle: true },
  });
  if (!newPart) throw new Error(`new part ${NEW.mpn} not in library`);

  const line = await db.bomLine.findFirst({
    where: { revisionId: rev.id, refDes: "C1" },
    select: { id: true, refDes: true, quantity: true, unitPriceCents: true,
      part: { select: { manufacturer: true, mpn: true } } },
  });
  if (!line) throw new Error("no C1 line on l1-01");
  console.log(`C1 currently: ${line.part.manufacturer} ${line.part.mpn}`);

  if (line.part.mpn === NEW.mpn) { console.log("Already Murata — no-op."); return; }
  if (line.part.mpn !== OLD.mpn) throw new Error(`C1 is ${line.part.mpn}, expected ${OLD.mpn} — abort (guard)`);

  console.log(`WOULD repoint C1 -> ${NEW.manufacturer} ${NEW.mpn} (${newPart.lifecycle}); alt=${OLD.mpn}; price=16c`);
  if (!CONFIRM) { console.log("\nDRY RUN — pass --confirm to apply."); return; }

  await db.bomLine.update({
    where: { id: line.id },
    data: { partId: newPart.id, unitPriceCents: 16,
      altMpn: OLD.mpn, altManufacturer: OLD.manufacturer,
      notes: "10uF 3V3 bulk; DK-in-stock sub for Samsung CL21A106KOQNNNE (DK-OOS 2026-06-21); same 0805 footprint - KiCad unchanged; alt = Samsung" },
  });
  console.log("✅ C1 repointed on the live l1-01 BOM.");
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
