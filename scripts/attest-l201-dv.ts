// Record the DESIGN_VALIDATION attestations for l2-01 v1 that the validation-log
// EVIDENCES (design-stage `[D]` items, DRY at 13 passes). These are honest human
// attestations — checked here on the owner's explicit authorization ("Validate."),
// with validation-log.md as the proof behind each tick. Idempotent.
//
//   ATTEST (8): 0 calc trail · 1 IC datasheet · 4 BOM availability · 5 all risks ·
//               6 Li-ion protection · 7 pack thermal/mech containment ·
//               8 thermal budget · 9 derating
//   OWED  (2): 2 footprint↔pinout  [S] (needs chosen symbols) ·
//              3 fab-DRU DRC        [L] (needs layout)
//
// PROD write. Run:  pnpm exec tsx scripts/attest-l201-dv.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const ATTEST_ORDINALS = new Set([0, 1, 4, 5, 6, 7, 8, 9]);

async function main() {
  const { db } = await import("@/lib/db");
  const proj = await db.project.findUnique({
    where: { slug: "l2-01-battery-power-module" },
    select: { revisions: { select: { id: true, label: true } } },
  });
  const rev = proj?.revisions.find((r) => r.label === "v1");
  if (!rev) throw new Error("no v1 revision");

  const cl = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    include: { items: { orderBy: { ordinal: "asc" } } },
  });
  if (!cl) throw new Error("no DESIGN_VALIDATION checklist — run build-l201-revision-bom.ts first");

  // completedById = the catalog owner (borrow an existing part's creator = Josh).
  const seed = await db.part.findFirst({ select: { createdById: true } });
  const completedById = seed!.createdById;
  const now = new Date();

  for (const it of cl.items) {
    const want = ATTEST_ORDINALS.has(it.ordinal);
    if (want && !it.checked) {
      await db.checklistItem.update({
        where: { id: it.id },
        data: { checked: true, notApplicable: false, completedById, completedAt: now },
      });
      console.log(`  ✓ attest ${it.ordinal}. ${it.label.slice(0, 56)}`);
    } else if (want && it.checked) {
      console.log(`  · already ${it.ordinal}. ${it.label.slice(0, 56)}`);
    } else {
      console.log(`  ☐ OWED   ${it.ordinal}. ${it.label.slice(0, 56)}  [${it.ordinal === 2 ? "S" : "L"}]`);
    }
  }

  const checked = await db.checklistItem.count({ where: { checklistId: cl.id, checked: true } });
  console.log(`\nDESIGN_VALIDATION: ${checked}/${cl.items.length} attested; 2 owed ([S] footprint↔pinout, [L] fab-DRU).`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
