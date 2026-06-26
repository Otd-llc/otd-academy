// l1-03-ws2812-node — BOM_SOURCING stage prep (after design-stage DRY + 8 parts created).
// Idempotent direct-Prisma equivalents of: Generate DESIGN_VALIDATION checklist +
// import bom.csv onto revision v1. Mirrors the server actions' logic
// (materializeCanonicalChecklist revision-branch; finalize-wroom-bom BOM write) but
// runs headless (F9). HARD STOP BEFORE FREEZE: leaves bomFrozenAt=null and does NOT
// advance the stage (freeze is a side-effect of entering LAYOUT). Reports WS4 board-
// readiness so the held state is explicit. Re-runnable while UNFROZEN.
// Run: pnpm exec tsx scripts/build-l103-revision-bom.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { readFileSync } from "node:fs";

const SLUG = "l1-03-ws2812-node";
const REV_LABEL = "v1";

async function main() {
  const { Prisma } = await import("@prisma/client");
  const { db } = await import("@/lib/db");
  const { CANONICAL_TEMPLATES } = await import("@/lib/canonical-checklist-templates");
  const { parseBomCsv } = await import("@/lib/bom-csv");

  const project = await db.project.findUnique({
    where: { slug: SLUG },
    select: {
      id: true, createdById: true, targetCost: true,
      hasMainsNet: true, requiresStripboard: true, hasLiIon: true, hasThermalConcern: true,
    },
  });
  if (!project) throw new Error(`Project ${SLUG} not found`);
  const flags: Record<string, boolean> = {
    hasMainsNet: project.hasMainsNet,
    requiresStripboard: project.requiresStripboard,
    hasLiIon: project.hasLiIon,
    hasThermalConcern: project.hasThermalConcern,
  };

  const rev = await db.revision.findFirst({
    where: { label: REV_LABEL, projectId: project.id },
    select: { id: true, bomFrozenAt: true, currentStage: true },
  });
  if (!rev) throw new Error(`Revision ${SLUG}@${REV_LABEL} not found`);
  if (rev.bomFrozenAt) throw new Error("BOM is FROZEN — refusing to touch it.");
  const userId = project.createdById;

  // ── 1. Generate DESIGN_VALIDATION checklist (idempotent) ──────────────
  const template = CANONICAL_TEMPLATES.DESIGN_VALIDATION;
  const existingDv = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: template.subkind },
    select: { id: true },
  });
  if (existingDv) {
    console.log(`DESIGN_VALIDATION checklist already present (${existingDv.id}) — leaving as-is.`);
  } else {
    const items = [
      ...template.items,
      ...(template.conditionalItems ?? [])
        .filter((c) => flags[c.flag])
        .flatMap((c) => c.items),
    ];
    const dv = await db.$transaction(
      (tx) =>
        tx.checklist.create({
          data: {
            revisionId: rev.id,
            stage: template.stage,
            subkind: template.subkind,
            title: template.title,
            createdById: userId,
            items: { create: items.map((it, idx) => ({ ordinal: idx, label: it.label })) },
          },
          select: { id: true, items: { select: { label: true }, orderBy: { ordinal: "asc" } } },
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    console.log(`DESIGN_VALIDATION checklist created (${dv.id}) — ${dv.items.length} items, all UNCHECKED (Josh attests):`);
    dv.items.forEach((it, i) => console.log(`   [ ] ${i + 1}. ${it.label}`));
  }

  // ── 2. Import bom.csv → BomLines (idempotent replace, UNFROZEN) ────────
  const text = readFileSync(`docs/boards/${SLUG}/bom.csv`, "utf8");
  const { rows, errors } = parseBomCsv(text);
  if (errors.length) {
    for (const e of errors) console.error(`  bom.csv row ${e.row}: ${e.message}`);
    throw new Error("bom.csv has parse errors — aborting.");
  }
  const lines: { partId: string; refDes: string; quantity: number; unitPriceCents: number | null; altMpn: string | null; altManufacturer: string | null; notes: string | null }[] = [];
  for (const r of rows) {
    const part = await db.part.findUnique({
      where: { manufacturer_mpn: { manufacturer: r.manufacturer, mpn: r.mpn } },
      select: { id: true },
    });
    if (!part) throw new Error(`BOM part not in library: ${r.manufacturer} / ${r.mpn}`);
    lines.push({ partId: part.id, refDes: r.refDes, quantity: r.quantity, unitPriceCents: r.unitPriceCents, altMpn: r.altMpn, altManufacturer: r.altManufacturer, notes: r.notes });
  }
  await db.$transaction(async (tx) => {
    const fresh = await tx.revision.findUniqueOrThrow({ where: { id: rev.id }, select: { bomFrozenAt: true } });
    if (fresh.bomFrozenAt) throw new Error("BOM froze mid-run — aborting.");
    await tx.bomLine.deleteMany({ where: { revisionId: rev.id } });
    await tx.bomLine.createMany({
      data: lines.map((l) => ({ revisionId: rev.id, ...l, createdById: userId })),
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log(`\nBOM: wrote ${lines.length} lines onto ${SLUG}@${REV_LABEL} (UNFROZEN, stage=${rev.currentStage}).`);

  // ── 3. Board-readiness (WS4 assessor) — the held state, explicit ──────
  const after = await db.revision.findUniqueOrThrow({
    where: { id: rev.id },
    select: {
      bomFrozenAt: true,
      bomLines: { select: { quantity: true, unitPriceCents: true, part: { select: { lifecycle: true } } } },
      checklists: { select: { subkind: true, items: { select: { checked: true, notApplicable: true } } } },
    },
  });
  // Readiness derived inline — decoupled from board-readiness-load (whose input
  // type now requires DigiKey availability fields the seed scripts don't carry).
  const dvCl = after.checklists.find((c) => c.subkind === "DESIGN_VALIDATION");
  const dvItems = dvCl?.items ?? [];
  const dvDone = dvItems.filter((i) => i.checked || i.notApplicable).length;
  const dvComplete = dvItems.length > 0 && dvDone === dvItems.length;
  const noEol = after.bomLines.every((b) => b.part.lifecycle === "ACTIVE");
  const ready = !!after.bomFrozenAt && after.bomLines.length > 0 && noEol && dvComplete;
  console.log(`\nBOARD READINESS: ready=${ready}`);
  console.log(`   ${after.bomLines.length > 0 ? "PASS" : "----"}  [required] BOM has parts (${after.bomLines.length})`);
  console.log(`   ${noEol ? "PASS" : "----"}  [required] No EOL/NRND parts`);
  console.log(`   ${after.bomFrozenAt ? "PASS" : "----"}  [required] BOM frozen`);
  console.log(`   ${dvComplete ? "PASS" : "----"}  [required] Design validated (DV ${dvDone}/${dvItems.length})`);
  console.log(`\nHELD before freeze. Remaining (Josh): attest the ${"6"} DESIGN_VALIDATION items, advance REQUIREMENTS→BOM_SOURCING, then freeze (advance into LAYOUT).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
