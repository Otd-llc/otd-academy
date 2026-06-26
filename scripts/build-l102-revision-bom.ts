// Build the l1-02-espnow-link@v1 revision BOM + materialize its DESIGN_VALIDATION
// checklist. Faithfully replicates the `materializeCanonicalChecklist` (revision
// branch) + `importBomCsv` server actions, which can't be driven headlessly
// (they are `"use server"` + `requireAdmin()`). See the adding-parts skill.
//
// Idempotent + freeze-guarded:
//   - refuses to touch a FROZEN bom (bomFrozenAt != null);
//   - DESIGN_VALIDATION dedupes by (revisionId, subkind) like the real action;
//   - BOM lines upsert on (revisionId, partId) like importBomCsv.
// Does NOT advance the stage → bomFrozenAt stays null (HOLD before LAYOUT freeze).
// All parts already exist in the catalog (100% reuse) — nothing is created here.
//
// Run (PowerShell): pnpm exec tsx scripts/build-l102-revision-bom.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" }); // PROD — env BEFORE the db import
import { readFileSync } from "node:fs";

const PROJECT_SLUG = "l1-02-espnow-link";
const REV_LABEL = "v1";
const BOM_CSV = "docs/boards/l1-02-espnow-link/bom.csv";

async function main() {
  const { db } = await import("@/lib/db");
  const { parseBomCsv } = await import("@/lib/bom-csv");
  const { CANONICAL_TEMPLATES } = await import(
    "@/lib/canonical-checklist-templates"
  );

  const rev = await db.revision.findFirst({
    where: { label: REV_LABEL, project: { slug: PROJECT_SLUG } },
    select: {
      id: true,
      bomFrozenAt: true,
      currentStage: true,
      project: {
        select: {
          createdById: true,
          hasMainsNet: true,
          requiresStripboard: true,
          hasLiIon: true,
          hasThermalConcern: true,
        },
      },
    },
  });
  if (!rev) throw new Error(`Revision ${PROJECT_SLUG}@${REV_LABEL} not found`);
  if (rev.bomFrozenAt) {
    throw new Error(
      `BOM is FROZEN (${rev.bomFrozenAt.toISOString()}) — refusing to modify.`,
    );
  }
  const userId = rev.project.createdById;
  const flags = rev.project;

  // ── 1. Materialize DESIGN_VALIDATION (revision-scoped), idempotent ──
  const template = CANONICAL_TEMPLATES.DESIGN_VALIDATION;
  const existingDv = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: template.subkind },
    select: { id: true },
  });
  if (existingDv) {
    console.log(`DESIGN_VALIDATION checklist already present — leaving as is.`);
  } else {
    const items = [
      ...template.items,
      ...(template.conditionalItems ?? [])
        .filter((c) => flags[c.flag])
        .flatMap((c) => c.items),
    ];
    await db.checklist.create({
      data: {
        revisionId: rev.id,
        stage: template.stage,
        subkind: template.subkind,
        title: template.title,
        createdById: userId,
        items: { create: items.map((it, idx) => ({ ordinal: idx, label: it.label })) },
      },
    });
    console.log(
      `Materialized DESIGN_VALIDATION (${items.length} items; flags all false → 6 core, 0 conditional).`,
    );
  }

  // ── 2. Import BOM lines (strict-match upsert on revisionId_partId) ──
  const text = readFileSync(BOM_CSV, "utf8");
  const { rows, errors } = parseBomCsv(text);
  if (errors.length) {
    for (const e of errors) console.error(`  parse error row ${e.row}: ${e.message}`);
    throw new Error(`bom.csv has ${errors.length} parse error(s) — aborting.`);
  }

  let created = 0;
  let updated = 0;
  const unmatched: string[] = [];
  await db.$transaction(async (tx) => {
    for (const r of rows) {
      const part = await tx.part.findUnique({
        where: { manufacturer_mpn: { manufacturer: r.manufacturer, mpn: r.mpn } },
        select: { id: true },
      });
      if (!part) {
        unmatched.push(`${r.manufacturer} / ${r.mpn}`);
        continue;
      }
      const data = {
        refDes: r.refDes,
        quantity: r.quantity,
        unitPriceCents: r.unitPriceCents,
        altMpn: r.altMpn,
        altManufacturer: r.altManufacturer,
        notes: r.notes,
      };
      const existing = await tx.bomLine.findUnique({
        where: { revisionId_partId: { revisionId: rev.id, partId: part.id } },
        select: { id: true },
      });
      await tx.bomLine.upsert({
        where: { revisionId_partId: { revisionId: rev.id, partId: part.id } },
        create: { revisionId: rev.id, partId: part.id, createdById: userId, ...data },
        update: data,
      });
      if (existing) updated++;
      else created++;
    }
  });

  if (unmatched.length) {
    console.error(`\n${unmatched.length} UNMATCHED (not imported):`);
    for (const u of unmatched) console.error(`  ${u}`);
    throw new Error("Unmatched rows — create the parts first (none expected here).");
  }

  // ── 3. Report ──
  const lines = await db.bomLine.findMany({
    where: { revisionId: rev.id },
    orderBy: { refDes: "asc" },
    select: {
      refDes: true,
      quantity: true,
      unitPriceCents: true,
      part: { select: { mpn: true, manufacturer: true } },
    },
  });
  console.log(
    `\n${PROJECT_SLUG}@${REV_LABEL} (stage ${rev.currentStage}, bomFrozenAt=null): ` +
      `${created} created / ${updated} updated → ${lines.length} BOM lines\n`,
  );
  let totalCents = 0;
  for (const l of lines) {
    const cents = (l.unitPriceCents ?? 0) * l.quantity;
    totalCents += cents;
    const price = l.unitPriceCents == null ? "?" : `$${(l.unitPriceCents / 100).toFixed(2)}`;
    console.log(
      `  ${l.refDes.padEnd(12)} x${l.quantity}  ${l.part.mpn.padEnd(26)} ${l.part.manufacturer.padEnd(28)} ${price}`,
    );
  }
  console.log(`\n  Per-node BOM cost ≈ $${(totalCents / 100).toFixed(2)} (×2 for the pair).`);

  const dv = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    select: { items: { select: { label: true, checked: true, notApplicable: true } } },
  });
  const done = dv?.items.filter((i) => i.checked || i.notApplicable).length ?? 0;
  console.log(
    `\n  DESIGN_VALIDATION: ${done}/${dv?.items.length ?? 0} items attested ` +
      `(left UNCHECKED — honest human attestations, owner ticks them).`,
  );
  console.log(`\n  BOM NOT frozen. Stage NOT advanced. (HOLD before LAYOUT freeze.)`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
