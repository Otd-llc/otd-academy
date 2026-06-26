// Materialize the DESIGN_VALIDATION checklist + write the BOM lines for
// l2-01-battery-power-module v1. Headless equivalent of materializeCanonicalChecklist
// (revision branch) + importBomCsv — the server actions can't be scripted (requireAdmin
// + revalidatePath). Faithfully replicates their logic incl. the conditional-item
// injection (hasLiIon + hasThermalConcern → +4 items) and the strict (manufacturer,mpn)
// match. **Freeze-guarded + idempotent**: refuses a frozen BOM; skips re-materialize;
// upserts BOM lines. Does NOT advance the stage (no freeze).
//
// PROD write. Run:  pnpm exec tsx scripts/build-l201-revision-bom.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { readFileSync } from "node:fs";

async function main() {
  const { db } = await import("@/lib/db");
  const { parseBomCsv } = await import("@/lib/bom-csv");
  const { CANONICAL_TEMPLATES } = await import("@/lib/canonical-checklist-templates");

  const proj = await db.project.findUnique({
    where: { slug: "l2-01-battery-power-module" },
    select: {
      hasMainsNet: true, requiresStripboard: true, hasLiIon: true, hasThermalConcern: true,
      revisions: { select: { id: true, label: true, bomFrozenAt: true, frozenAt: true } },
    },
  });
  const rev = proj?.revisions.find((r) => r.label === "v1");
  if (!proj || !rev) throw new Error("no l2-01 v1 revision");
  if (rev.bomFrozenAt || rev.frozenAt)
    throw new Error(`REFUSING: revision frozen (bomFrozenAt=${rev.bomFrozenAt}, frozenAt=${rev.frozenAt})`);

  const seed = await db.part.findFirst({ select: { createdById: true } });
  const createdById = seed!.createdById;

  // ── 1. Materialize DESIGN_VALIDATION (idempotent) ──
  const flags = proj as Record<string, boolean>;
  const tmpl = CANONICAL_TEMPLATES.DESIGN_VALIDATION;
  const dvItems = [
    ...tmpl.items,
    ...(tmpl.conditionalItems ?? []).filter((c) => flags[c.flag]).flatMap((c) => c.items),
  ];
  const existing = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    include: { items: { orderBy: { ordinal: "asc" } } },
  });
  if (existing) {
    console.log(`DESIGN_VALIDATION already exists (${existing.items.length} items) — skip materialize`);
  } else {
    const cl = await db.checklist.create({
      data: {
        revisionId: rev.id, stage: tmpl.stage, subkind: tmpl.subkind, title: tmpl.title, createdById,
        items: { create: dvItems.map((it, idx) => ({ ordinal: idx, label: it.label })) },
      },
      include: { items: { orderBy: { ordinal: "asc" } } },
    });
    console.log(`Materialized DESIGN_VALIDATION (${cl.items.length} items):`);
    cl.items.forEach((it) => console.log(`  ${it.ordinal}. [ ] ${it.label.slice(0, 64)}`));
  }

  // ── 2. Write BOM lines (strict match, upsert) ──
  const csv = readFileSync("docs/boards/l2-01-battery-power-module/bom.csv", "utf8");
  const { rows, errors } = parseBomCsv(csv);
  if (errors.length) { errors.forEach((e) => console.log(`  PARSE ERR row ${e.row}: ${e.message}`)); throw new Error("parse errors"); }

  let created = 0, updated = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const part = await db.part.findUnique({
      where: { manufacturer_mpn: { manufacturer: r.manufacturer, mpn: r.mpn } }, select: { id: true },
    });
    if (!part) { unmatched.push(`${r.manufacturer} | ${r.mpn}`); continue; }
    const data = { refDes: r.refDes, quantity: r.quantity, unitPriceCents: r.unitPriceCents,
      altMpn: r.altMpn, altManufacturer: r.altManufacturer, notes: r.notes };
    const ex = await db.bomLine.findUnique({ where: { revisionId_partId: { revisionId: rev.id, partId: part.id } }, select: { id: true } });
    await db.bomLine.upsert({
      where: { revisionId_partId: { revisionId: rev.id, partId: part.id } },
      create: { revisionId: rev.id, partId: part.id, createdById, ...data },
      update: data,
    });
    if (ex) updated++; else created++;
  }
  console.log(`\nBOM: ${created} created, ${updated} updated, ${unmatched.length} unmatched`);
  unmatched.forEach((u) => console.log(`  UNMATCHED ${u}`));
  if (unmatched.length) throw new Error("unmatched rows — create the parts first");

  const total = await db.bomLine.count({ where: { revisionId: rev.id } });
  console.log(`Revision v1 now has ${total} BOM lines. Stage unchanged (REQUIREMENTS), bomFrozenAt=null (HOLD).`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
