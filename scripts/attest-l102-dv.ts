// Attest the design-stage DESIGN_VALIDATION items for l1-02-espnow-link@v1.
// Replicates `editChecklistItem` (the "use server" action): sets checked=true and
// stamps completedAt / completedById on the first transition to checked. Idempotent
// (skips already-checked items). Owner = project.createdById.
//
// Ticks ONLY the 3 items the validation-log evidences at the DESIGN stage:
//   1. Calc trail recorded
//   2. Each IC datasheet-verified
//   5. BOM availability confirmed
// Leaves 3/4/6 (footprint↔pinout [S], fab-DRU [L], all-risks-de-risked — RK5/RK6
// close at layout) UNCHECKED — they can't honestly close pre-schematic/pre-layout.
//
// Run (PowerShell): pnpm exec tsx scripts/attest-l102-dv.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" }); // PROD — env BEFORE the db import

const PROJECT_SLUG = "l1-02-espnow-link";
const REV_LABEL = "v1";

// Match the canonical DESIGN_VALIDATION item labels by a stable prefix.
const TICK_PREFIXES = [
  "Calc trail recorded",
  "Each IC datasheet-verified",
  "BOM availability confirmed",
];

async function main() {
  const { db } = await import("@/lib/db");

  const rev = await db.revision.findFirst({
    where: { label: REV_LABEL, project: { slug: PROJECT_SLUG } },
    select: { id: true, bomFrozenAt: true, project: { select: { createdById: true } } },
  });
  if (!rev) throw new Error(`Revision ${PROJECT_SLUG}@${REV_LABEL} not found`);
  if (rev.bomFrozenAt) throw new Error("BOM frozen — refusing to modify checklist.");
  const userId = rev.project.createdById;

  const checklist = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    select: { id: true, items: { select: { id: true, label: true, checked: true, notApplicable: true }, orderBy: { ordinal: "asc" } } },
  });
  if (!checklist) throw new Error("DESIGN_VALIDATION checklist not found — run build-l102-revision-bom.ts first.");

  for (const item of checklist.items) {
    const shouldTick = TICK_PREFIXES.some((p) => item.label.startsWith(p));
    if (!shouldTick) continue;
    if (item.checked) {
      console.log(`  already ✓  ${item.label.slice(0, 60)}`);
      continue;
    }
    if (item.notApplicable) throw new Error(`Item is N/A, cannot check: ${item.label}`);
    await db.checklistItem.update({
      where: { id: item.id },
      data: { checked: true, completedAt: new Date(), completedBy: { connect: { id: userId } } },
    });
    console.log(`  ticked  ✓  ${item.label.slice(0, 60)}`);
  }

  const after = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    select: { items: { select: { label: true, checked: true, notApplicable: true }, orderBy: { ordinal: "asc" } } },
  });
  const done = after!.items.filter((i) => i.checked || i.notApplicable).length;
  console.log(`\nDESIGN_VALIDATION: ${done}/${after!.items.length} attested. Remaining (owed at [S]/[L]):`);
  for (const i of after!.items) {
    if (!i.checked && !i.notApplicable) console.log(`  ⏸  ${i.label.slice(0, 70)}`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
