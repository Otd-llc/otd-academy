// Parts-knowledge Stage A — WROOM-breakout BOM pilot seed (design §7).
//
// One-off, idempotent seed-style script. Writes via Prisma directly (the
// `"use server"` action layer can't be scripted headlessly because
// `requireUser()` reads an Auth.js request-context session and the actions call
// `revalidatePath`, which throws outside a Next request — the documented
// `[[foundry-headless-scripting]]` constraint). Matches the structure of
// `populate-curriculum-dag.ts`: dotenv loads `.env.local` BEFORE a dynamic
// `import("@/lib/db")` so @prisma/client reads DATABASE_URL; all writes are
// existence-checked / upserted so re-running is a no-op.
//
// What it seeds (design §7 — the 7 pilot parts):
//   1. Upserts the 7 pilot Parts (by the `@@unique([manufacturer, mpn])`) with
//      canonical `PartCategory` tokens, descriptions, footprints, ACTIVE
//      lifecycle, and real manufacturer datasheet URLs (these feed the R2-off
//      provenance fallback).
//   2. Attaches BomLines to the `foundry-l1-01-wroom-breakout` v1 Revision
//      (idempotent via the `@@unique([revisionId, partId])`). refDes is a
//      comma-joined string whose comma-count MUST equal `quantity` (the DB CHECK
//      `array_length(string_to_array(refDes,','),1) = quantity`).
//   3. Freezes that revision's BOM — sets `bomFrozenAt = now()` (only if unset)
//      so `lookupBom("foundry-l1-01-wroom-breakout")` resolves to it.
//
// Does NOT curate any PartFacts — curation/verification is the human demo. The
// seed only creates parts + BOM + freeze. Leaves every other project untouched.
//
// Run: tsx scripts/seed-wroom-bom.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { PartCategory } from "@prisma/client";

const PROJECT_SLUG = "foundry-l1-01-wroom-breakout";

interface PartSpec {
  manufacturer: string;
  mpn: string;
  category: PartCategory;
  description: string;
  footprint: string;
  datasheetUrl: string;
}

// The 7 pilot parts (design §7). Real, plausible MPNs; real manufacturer
// datasheet URLs where known (these are the R2-off provenance fallback source).
const PARTS: PartSpec[] = [
  {
    manufacturer: "Espressif Systems",
    mpn: "ESP32-WROOM-32E",
    category: "RF_MODULE",
    description:
      "ESP32-WROOM-32E Wi-Fi + BT/BLE module (ESP32-D0WD-V3, 4 MB flash). PCB antenna; requires antenna keep-out per datasheet.",
    footprint: "Espressif WROOM-32 SMD module (18x25.5 mm, 38-pad)",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf",
  },
  {
    manufacturer: "Diodes Incorporated",
    mpn: "AP2112K-3.3TRG1",
    category: "LDO_REGULATOR",
    description:
      "AP2112K-3.3 600 mA fixed 3.3 V low-dropout (LDO) regulator with enable. Requires output ceramic cap for stability.",
    footprint: "SOT-23-5",
    datasheetUrl: "https://www.diodes.com/assets/Datasheets/AP2112.pdf",
  },
  {
    manufacturer: "Silicon Labs",
    mpn: "CP2102N-A02-GQFN28R",
    category: "USB_UART_IC",
    description:
      "CP2102N single-chip USB-to-UART bridge (USB 2.0 full-speed). Drives the auto-program (DTR/RTS) circuit; requires VDD decoupling.",
    footprint: "QFN-28 (5x5 mm)",
    datasheetUrl:
      "https://www.silabs.com/documents/public/data-sheets/cp2102n-datasheet.pdf",
  },
  {
    manufacturer: "Murata",
    mpn: "GRM188R61A106KE69J",
    category: "MLCC_CAPACITOR",
    description:
      "10 uF 6.3 V X5R 0603 MLCC. Headline DC-bias derating demo: effective capacitance drops sharply with applied DC bias (per-curve datasheet page).",
    footprint: "0603 (1608 metric)",
    datasheetUrl:
      "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM188R61A106KE69-01.pdf",
  },
  {
    manufacturer: "GCT",
    mpn: "USB4085-GF-A",
    category: "USB_CONNECTOR",
    description:
      "USB Type-C 2.0 receptacle, 16-pin, SMT with through-hole mounting tabs. Shield/mounting mechanical detail for the demo.",
    footprint: "USB-C 16P SMT receptacle (GCT USB4085)",
    datasheetUrl: "https://gct.co/files/drawings/usb4085.pdf",
  },
  {
    manufacturer: "Samsung Electro-Mechanics",
    mpn: "CL05B104KO5NNNC",
    category: "MLCC_CAPACITOR",
    description:
      "0.1 uF 16 V X7R 0402 MLCC. Decoupling/bypass cap; minimal DC-bias derating (contrast with the 10 uF X5R headline part).",
    footprint: "0402 (1005 metric)",
    datasheetUrl:
      "https://product.samsungsem.com/mlcc/CL05B104KO5NNN.do",
  },
  {
    manufacturer: "Yageo",
    mpn: "RC0402FR-0710KL",
    category: "PASSIVE_RESISTOR",
    description:
      "10 kOhm +/-1% 1/16 W 0402 thick-film resistor. Thin part — PARAMETRICS only, no PINOUT (a pinout query must abstain).",
    footprint: "0402 (1005 metric)",
    datasheetUrl:
      "https://www.yageo.com/upload/media/product/productsearch/datasheet/rchip/PYu-RC_Group_51_RoHS_L_12.pdf",
  },
];

interface BomLineSpec {
  manufacturer: string;
  mpn: string;
  refDes: string; // comma-joined; comma-count MUST equal quantity (DB CHECK)
  quantity: number;
}

// BomLines for the WROOM-breakout v1 revision. Each refDes' comma-count equals
// its quantity (the `array_length(string_to_array(refDes,','),1) = quantity`
// CHECK constraint).
const BOM_LINES: BomLineSpec[] = [
  { manufacturer: "Espressif Systems", mpn: "ESP32-WROOM-32E", refDes: "U1", quantity: 1 },
  { manufacturer: "Diodes Incorporated", mpn: "AP2112K-3.3TRG1", refDes: "U2", quantity: 1 },
  { manufacturer: "Silicon Labs", mpn: "CP2102N-A02-GQFN28R", refDes: "U3", quantity: 1 },
  { manufacturer: "Murata", mpn: "GRM188R61A106KE69J", refDes: "C1", quantity: 1 },
  { manufacturer: "GCT", mpn: "USB4085-GF-A", refDes: "J1", quantity: 1 },
  { manufacturer: "Samsung Electro-Mechanics", mpn: "CL05B104KO5NNNC", refDes: "C2,C3,C4", quantity: 3 },
  { manufacturer: "Yageo", mpn: "RC0402FR-0710KL", refDes: "R1,R2", quantity: 2 },
];

async function main() {
  const { db } = await import("@/lib/db");

  // ─── Resolve attributing User ───────────────────────────
  // Mirror the seed convention (`seed@example.com`, as the tests resolve
  // `createdById`); prefer the real app owner when present, like the curriculum
  // DAG seed, so attribution matches the rest of the seeded graph.
  const author =
    (await db.user.findUnique({ where: { email: "ravenduanesavage@gmail.com" } })) ??
    (await db.user.findFirst({
      where: { email: { not: "seed@example.com" } },
      orderBy: { createdAt: "asc" },
    })) ??
    (await db.user.findUniqueOrThrow({ where: { email: "seed@example.com" } }));
  console.log(`author: ${author.email} (${author.id})`);

  // ─── Locate the pilot project + its v1 revision ─────────
  // Seeded by the curriculum DAG; STOP (don't invent) if either is missing.
  const project = await db.project.findUnique({
    where: { slug: PROJECT_SLUG },
    select: { id: true, name: true },
  });
  if (!project) {
    throw new Error(
      `Pilot project "${PROJECT_SLUG}" not found. Run populate-curriculum-dag.ts first; refusing to invent a project.`,
    );
  }

  const revision = await db.revision.findFirst({
    where: { projectId: project.id, label: { equals: "v1", mode: "insensitive" } },
    select: { id: true, label: true, bomFrozenAt: true },
  });
  if (!revision) {
    throw new Error(
      `v1 Revision for "${PROJECT_SLUG}" not found. Run populate-curriculum-dag.ts first; refusing to invent a revision.`,
    );
  }
  console.log(`project: ${PROJECT_SLUG} (${project.id}) | revision: v1 (${revision.id})`);

  // ─── Step 1: upsert the 7 pilot parts (by manufacturer+mpn) ─
  const partIdByMpn = new Map<string, string>();
  let createdParts = 0;
  for (const p of PARTS) {
    const before = await db.part.findUnique({
      where: { manufacturer_mpn: { manufacturer: p.manufacturer, mpn: p.mpn } },
      select: { id: true },
    });
    const row = await db.part.upsert({
      where: { manufacturer_mpn: { manufacturer: p.manufacturer, mpn: p.mpn } },
      update: {
        category: p.category,
        description: p.description,
        footprint: p.footprint,
        datasheetUrl: p.datasheetUrl,
        lifecycle: "ACTIVE",
      },
      create: {
        manufacturer: p.manufacturer,
        mpn: p.mpn,
        category: p.category,
        description: p.description,
        footprint: p.footprint,
        datasheetUrl: p.datasheetUrl,
        lifecycle: "ACTIVE",
        createdById: author.id,
      },
      select: { id: true },
    });
    partIdByMpn.set(`${p.manufacturer} ${p.mpn}`, row.id);
    if (!before) createdParts++;
  }
  console.log(`parts: ${PARTS.length} present (${createdParts} newly created)`);

  // ─── Step 2: attach BomLines to the v1 revision (idempotent) ─
  let createdLines = 0;
  for (const line of BOM_LINES) {
    const partId = partIdByMpn.get(`${line.manufacturer} ${line.mpn}`);
    if (!partId) {
      throw new Error(`BOM line references unseeded part: ${line.manufacturer} ${line.mpn}`);
    }
    // Guard the DB CHECK here too, so a bad spec fails loudly before the insert.
    const commaCount = line.refDes.split(",").length;
    if (commaCount !== line.quantity) {
      throw new Error(
        `refDes/quantity mismatch for ${line.mpn}: "${line.refDes}" has ${commaCount} refs but quantity=${line.quantity}.`,
      );
    }

    const existing = await db.bomLine.findUnique({
      where: { revisionId_partId: { revisionId: revision.id, partId } },
      select: { id: true },
    });
    if (existing) {
      // Keep refDes/quantity in sync on re-run without creating duplicates.
      await db.bomLine.update({
        where: { id: existing.id },
        data: { refDes: line.refDes, quantity: line.quantity },
      });
      continue;
    }
    await db.bomLine.create({
      data: {
        revisionId: revision.id,
        partId,
        refDes: line.refDes,
        quantity: line.quantity,
        createdById: author.id,
      },
    });
    createdLines++;
  }
  console.log(`bom lines: ${BOM_LINES.length} present (${createdLines} newly created)`);

  // ─── Step 3: freeze the revision's BOM (only if not already frozen) ─
  let frozenNow = false;
  if (!revision.bomFrozenAt) {
    await db.revision.update({
      where: { id: revision.id },
      data: { bomFrozenAt: new Date() },
    });
    frozenNow = true;
  }
  const finalRev = await db.revision.findUniqueOrThrow({
    where: { id: revision.id },
    select: { bomFrozenAt: true },
  });
  console.log(
    `revision BOM-frozen: ${finalRev.bomFrozenAt?.toISOString()}` +
      (frozenNow ? " (frozen this run)" : " (already frozen)"),
  );

  // ─── Summary ────────────────────────────────────────────
  console.log(
    `seed-wroom-bom: complete — parts ${PARTS.length} (${createdParts} new), ` +
      `bom lines ${BOM_LINES.length} (${createdLines} new), ` +
      `revision ${frozenNow ? "frozen now" : "already frozen"}.`,
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
