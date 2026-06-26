// l1-05-internal-adc: record the DESIGN_VALIDATION attestations the
// validation-log.md actually evidences at design-stage DRY. Per the l1-02/l1-04
// precedent (same pre-schematic stage), tick ONLY:
//   • Calc trail recorded           (§3, 12 passes, worst-case from datasheet)
//   • Each IC datasheet-verified    (WROOM internal ADC + RV1 + D2 web-verified)
//   • BOM availability confirmed    (live DigiKey 2026-06-26, all Active)
// LEAVE OWED (honest, can't close pre-schematic/layout):
//   • Footprint ↔ pinout cross-checked   → [S] schematic stage (RK10)
//   • Fab-DRU DRC accounted for          → [L] layout stage
//   • All top risks de-risked            → RK10 closes at [S], RK11/RK12 at [L]
//
// Idempotent (skips an already-checked item) + freeze-guarded. PROD write.
// Run in PowerShell:  pnpm exec tsx scripts/attest-l105-dv.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const PROJECT_SLUG = "l1-05-internal-adc";

// Exact label prefixes of the items to attest (match the canonical template).
const ATTEST_PREFIXES = [
  "Calc trail recorded",
  "Each IC datasheet-verified",
  "BOM availability confirmed",
];

async function main() {
  const { db } = await import("@/lib/db");

  const seed = await db.part.findFirst({ select: { createdById: true } });
  const completedById = seed!.createdById!;

  const project = await db.project.findUniqueOrThrow({
    where: { slug: PROJECT_SLUG },
    select: { revisions: { select: { id: true, label: true, frozenAt: true, bomFrozenAt: true } } },
  });
  const rev = project.revisions[0]!;
  if (rev.frozenAt) throw new Error("Revision frozen — refusing.");
  if (rev.bomFrozenAt) throw new Error("BOM frozen — refusing.");

  const dv = await db.checklist.findFirstOrThrow({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    select: { id: true, items: { select: { id: true, label: true, checked: true, notApplicable: true }, orderBy: { ordinal: "asc" } } },
  });

  const now = new Date();
  for (const item of dv.items) {
    const shouldAttest = ATTEST_PREFIXES.some((p) => item.label.startsWith(p));
    if (!shouldAttest) {
      console.log(`  OWED   ${item.label.slice(0, 60)}…`);
      continue;
    }
    if (item.checked) {
      console.log(`  (done) ${item.label.slice(0, 60)}…`);
      continue;
    }
    if (item.notApplicable) throw new Error(`Item is N/A, cannot check: ${item.label}`);
    await db.checklistItem.update({
      where: { id: item.id },
      data: { checked: true, completedAt: now, completedById },
    });
    console.log(`  TICK ✓ ${item.label.slice(0, 60)}…`);
  }

  const checked = await db.checklistItem.count({ where: { checklistId: dv.id, checked: true } });
  const totalItems = dv.items.length;
  console.log(`\nDone. DESIGN_VALIDATION: ${checked}/${totalItems} attested (3 owed at [S]/[L]). bomFrozenAt untouched.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
