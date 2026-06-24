// L1.01 WROOM-breakout — C1 sourcing ECN (2026-06-24): swap the 10 µF 3V3 bulk cap
// from Murata GRM21BR61E106KA73L (backordered) → KEMET C0805C106K3PACTU (Active,
// 272k+ in stock). Parametrically identical (10 µF / 25 V / X5R / 0805 / ±10%) — a
// drop-in sourcing substitution, NOT a design change. Scoped validation:
// docs/boards/l1-01-wroom-breakout/validation-log.md (ECN 2026-06-24).
//
// Direct-Prisma per [[foundry-headless-scripting]] (the "use server" actions can't be
// scripted). Idempotent: upsert KEMET by (manufacturer, mpn); repoint C1's line only if
// it isn't already KEMET. Leaves the BOM FROZEN (errata — no regress/unfreeze).
//
// Run: pnpm exec tsx scripts/swap-l101-c1-kemet.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const MURATA = { manufacturer: "Murata Electronics", mpn: "GRM21BR61E106KA73L" };
const KEMET = {
  manufacturer: "KEMET",
  mpn: "C0805C106K3PACTU",
  description: "10 µF ±10% 25 V X5R MLCC",
  category: "MLCC_CAPACITOR" as const,
  footprint: "0805",
  kicadSymbol: "Device:C",
  kicadFootprint: "Capacitor_SMD:C_0805_2012Metric",
  notes:
    "C1 — 10 µF bulk on 3V3. ECN 2026-06-24: drop-in sourcing swap from Murata " +
    "GRM21BR61E106KA73L (backordered, restock 15-Jul-2026) → KEMET (Active, 272k+ in " +
    "stock at DigiKey). Identical 10 µF/25 V/X5R/0805/±10%; 1.45 mm max height (vs Murata " +
    "~0.85 mm, fine on the open 3V3-bulk position). Scoped validation in " +
    "docs/boards/l1-01-wroom-breakout/validation-log.md.",
};

async function main() {
  const { db } = await import("@/lib/db");

  // ── Read the outgoing Murata part (mirror its CAD fields where present) ──
  const murata = await db.part.findUnique({
    where: { manufacturer_mpn: MURATA },
    select: {
      id: true,
      footprint: true,
      kicadSymbol: true,
      kicadFootprint: true,
      category: true,
    },
  });
  if (!murata) throw new Error(`Outgoing part not found: ${MURATA.manufacturer} / ${MURATA.mpn}`);
  console.log("Murata C1 CAD fields:", {
    footprint: murata.footprint,
    kicadSymbol: murata.kicadSymbol,
    kicadFootprint: murata.kicadFootprint,
    category: murata.category,
  });

  // ── Locate C1's BomLine on the wroom board's frozen revision (slug-rename-proof) ──
  const project = await db.project.findFirst({
    where: { slug: { contains: "wroom-breakout" }, archivedAt: null },
    select: { id: true, slug: true },
  });
  if (!project) throw new Error("wroom-breakout project not found");
  const rev = await db.revision.findFirst({
    where: { projectId: project.id, bomFrozenAt: { not: null } },
    orderBy: { bomFrozenAt: "desc" },
    select: { id: true, label: true, bomFrozenAt: true },
  });
  if (!rev) throw new Error(`${project.slug} has no BOM-frozen revision`);
  const line = await db.bomLine.findFirst({
    where: { revisionId: rev.id, refDes: "C1" },
    select: { id: true, partId: true, createdById: true },
  });
  if (!line) throw new Error(`C1 line not found on ${project.slug}@${rev.label}`);
  console.log(
    `C1 line on ${project.slug}@${rev.label} (frozen=${rev.bomFrozenAt ? "yes" : "no"}), currently partId=${line.partId}`,
  );

  // ── Upsert the KEMET part (idempotent; never clobber curated fields on re-run) ──
  const kemet = await db.part.upsert({
    where: { manufacturer_mpn: { manufacturer: KEMET.manufacturer, mpn: KEMET.mpn } },
    update: {},
    create: {
      manufacturer: KEMET.manufacturer,
      mpn: KEMET.mpn,
      description: KEMET.description,
      category: KEMET.category,
      footprint: murata.footprint ?? KEMET.footprint,
      kicadSymbol: murata.kicadSymbol ?? KEMET.kicadSymbol,
      kicadFootprint: murata.kicadFootprint ?? KEMET.kicadFootprint,
      datasheetUrl: null, // KEMET C-series F-3102 verified in the log; no rot-prone URL guessed
      lifecycle: "ACTIVE",
      notes: KEMET.notes,
      createdById: line.createdById,
    },
    select: {
      id: true,
      manufacturer: true,
      mpn: true,
      footprint: true,
      kicadSymbol: true,
      kicadFootprint: true,
      lifecycle: true,
      dkPartNumber: true,
      dkCheckedAt: true,
    },
  });
  console.log("KEMET part:", kemet);

  // ── Repoint C1 → KEMET (keep BOM frozen; idempotent) ──
  if (line.partId === kemet.id) {
    console.log("C1 already points at the KEMET part — no change.");
  } else {
    await db.bomLine.update({ where: { id: line.id }, data: { partId: kemet.id } });
    console.log(`C1 repointed: ${MURATA.mpn} → ${KEMET.mpn} (BOM left frozen).`);
  }

  // ── Verify ──
  const after = await db.bomLine.findUnique({
    where: { id: line.id },
    select: {
      refDes: true,
      quantity: true,
      part: {
        select: {
          manufacturer: true,
          mpn: true,
          lifecycle: true,
          dkPartNumber: true,
          dkCheckedAt: true,
        },
      },
    },
  });
  console.log("C1 after:", after);
  console.log(`Parts page: /parts/${kemet.id}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
