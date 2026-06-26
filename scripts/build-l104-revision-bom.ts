// l1-04-single-servo: materialize the DESIGN_VALIDATION checklist + write the BOM
// lines onto revision v1. Replicates the server actions' logic (which can't be
// driven headlessly): materializeCanonicalChecklist (revision-scoped) +
// importBomCsv (strict (manufacturer,mpn) match → upsert on [revisionId,partId]).
//
// Freeze-guarded (refuses if frozenAt or bomFrozenAt is set) + idempotent
// (DV dedupes by (revisionId, subkind); BOM upserts on [revisionId, partId]).
// Does NOT advance the stage and does NOT freeze the BOM (HOLD before LAYOUT).
//
// PROD write. Run in PowerShell:  pnpm exec tsx scripts/build-l104-revision-bom.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { readFileSync } from "node:fs";

const PROJECT_SLUG = "l1-04-single-servo";
const CSV_PATH = "docs/boards/l1-04-single-servo/bom.csv";

async function main() {
  const { db } = await import("@/lib/db");
  const { parseBomCsv } = await import("@/lib/bom-csv");
  const { CANONICAL_TEMPLATES } = await import("@/lib/canonical-checklist-templates");

  const seed = await db.part.findFirst({ select: { createdById: true } });
  const createdById = seed!.createdById!;

  // Resolve the revision (single v1) + read the project flags + freeze state.
  const project = await db.project.findUniqueOrThrow({
    where: { slug: PROJECT_SLUG },
    select: {
      hasMainsNet: true,
      requiresStripboard: true,
      hasLiIon: true,
      hasThermalConcern: true,
      revisions: {
        select: { id: true, label: true, currentStage: true, frozenAt: true, bomFrozenAt: true },
      },
    },
  });
  if (project.revisions.length !== 1) {
    throw new Error(`Expected exactly 1 revision, found ${project.revisions.length}.`);
  }
  const rev = project.revisions[0]!;
  console.log(`Revision ${rev.label} (${rev.id}) stage=${rev.currentStage} frozenAt=${rev.frozenAt} bomFrozenAt=${rev.bomFrozenAt}`);

  // Freeze guard — refuse to touch a frozen revision/BOM.
  if (rev.frozenAt) throw new Error("Revision is frozen — refusing to write.");
  if (rev.bomFrozenAt) throw new Error("BOM is frozen — refusing to write.");

  // ── 1 · Materialize DESIGN_VALIDATION (revision-scoped, flag-driven) ──
  const template = CANONICAL_TEMPLATES.DESIGN_VALIDATION;
  const flags: Record<"hasMainsNet" | "requiresStripboard" | "hasLiIon" | "hasThermalConcern", boolean> = {
    hasMainsNet: project.hasMainsNet,
    requiresStripboard: project.requiresStripboard,
    hasLiIon: project.hasLiIon,
    hasThermalConcern: project.hasThermalConcern,
  };
  const items = [
    ...template.items,
    ...(template.conditionalItems ?? [])
      .filter((c) => flags[c.flag])
      .flatMap((c) => c.items),
  ];

  const existingDv = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    select: { id: true },
  });
  if (existingDv) {
    console.log(`  DV checklist already exists (${existingDv.id}) — skipping materialize (idempotent).`);
  } else {
    const dv = await db.checklist.create({
      data: {
        revisionId: rev.id,
        stage: template.stage,
        subkind: template.subkind,
        title: template.title,
        createdById,
        items: { create: items.map((it, idx) => ({ ordinal: idx, label: it.label })) },
      },
      select: { id: true, items: { select: { id: true } } },
    });
    console.log(`  DV checklist created (${dv.id}) with ${dv.items.length} items (flags all false → no conditionals).`);
  }

  // ── 2 · Write BOM lines (strict match → upsert on [revisionId, partId]) ──
  const { rows, errors } = parseBomCsv(readFileSync(CSV_PATH, "utf8"));
  if (errors.length) throw new Error(`CSV parse errors: ${JSON.stringify(errors)}`);

  let created = 0, updated = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const part = await db.part.findUnique({
      where: { manufacturer_mpn: { manufacturer: r.manufacturer, mpn: r.mpn } },
      select: { id: true },
    });
    if (!part) { unmatched.push(`${r.manufacturer} / ${r.mpn}`); continue; }

    const data = {
      refDes: r.refDes,
      quantity: r.quantity,
      unitPriceCents: r.unitPriceCents,
      altMpn: r.altMpn,
      altManufacturer: r.altManufacturer,
      notes: r.notes,
    };
    const existing = await db.bomLine.findUnique({
      where: { revisionId_partId: { revisionId: rev.id, partId: part.id } },
      select: { id: true },
    });
    await db.bomLine.upsert({
      where: { revisionId_partId: { revisionId: rev.id, partId: part.id } },
      create: { revisionId: rev.id, partId: part.id, createdById, ...data },
      update: data,
    });
    if (existing) updated++; else created++;
  }

  console.log(`  BOM: ${created} created, ${updated} updated, ${unmatched.length} unmatched.`);
  if (unmatched.length) throw new Error(`UNMATCHED (aborting): ${unmatched.join(", ")}`);

  const total = await db.bomLine.count({ where: { revisionId: rev.id } });
  console.log(`\nDone. Revision ${rev.label} now has ${total} BOM lines. bomFrozenAt stays NULL (HOLD before LAYOUT).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
