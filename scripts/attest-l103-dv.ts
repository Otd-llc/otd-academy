// l1-03-ws2812-node — record the DESIGN_VALIDATION attestations Josh authorized
// (2026-06-18): check the 4 design-stage items the validation-log evidences, and
// LEAVE items 3 (footprint↔pinout) + 4 (fab-DRU) unchecked — they are [S]/[L]-stage
// by nature (F7). Idempotent. completedById = the project owner (the attester).
// Item order (materialized ordinals 0..5):
//   0 Calc trail            -> CHECK   (Passes 3/5/11, design §3)
//   1 IC datasheet-verified -> CHECK   (Pass 5/11: AHCT125, RT9080, D2, D3, LED3)
//   2 Footprint↔pinout      -> leave   ([S], Pass 6, schematic)
//   3 Fab-DRU DRC           -> leave   ([L], layout)
//   4 BOM availability       -> CHECK   (Pass 2/11: 25/25 resolve, all ACTIVE)
//   5 All top risks de-risked-> CHECK   (design §6/§7)
// Run: pnpm exec tsx scripts/attest-l103-dv.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SLUG = "l1-03-ws2812-node";
const CHECK_ORDINALS = [0, 1, 4, 5];

async function main() {
  const { db } = await import("@/lib/db");
  const { boardReadinessFromRows } = await import("@/lib/board-readiness-load");

  const rev = await db.revision.findFirst({
    where: { label: "v1", project: { slug: SLUG } },
    select: { id: true, bomFrozenAt: true, project: { select: { createdById: true, targetCost: true } } },
  });
  if (!rev) throw new Error(`Revision ${SLUG}@v1 not found`);
  if (rev.bomFrozenAt) throw new Error("BOM frozen — refusing to edit attestations.");
  const userId = rev.project.createdById;

  const dv = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "DESIGN_VALIDATION" },
    select: { id: true, items: { select: { id: true, ordinal: true, label: true, checked: true }, orderBy: { ordinal: "asc" } } },
  });
  if (!dv) throw new Error("No DESIGN_VALIDATION checklist — run build-l103-revision-bom.ts first.");

  const now = new Date();
  for (const it of dv.items) {
    const shouldCheck = CHECK_ORDINALS.includes(it.ordinal);
    if (shouldCheck && !it.checked) {
      await db.checklistItem.update({
        where: { id: it.id },
        data: { checked: true, completedAt: now, completedById: userId },
      });
    }
  }

  const after = await db.checklist.findUniqueOrThrow({
    where: { id: dv.id },
    select: { items: { select: { ordinal: true, label: true, checked: true }, orderBy: { ordinal: "asc" } } },
  });
  console.log("DESIGN_VALIDATION attestations:");
  for (const it of after.items) {
    console.log(`   ${it.checked ? "[x]" : "[ ]"} ${it.ordinal + 1}. ${it.label}`);
  }

  const r = await db.revision.findUniqueOrThrow({
    where: { id: rev.id },
    select: {
      bomFrozenAt: true,
      bomLines: { select: { quantity: true, unitPriceCents: true, part: { select: { lifecycle: true } } } },
      checklists: { select: { subkind: true, items: { select: { checked: true, notApplicable: true } } } },
    },
  });
  const readiness = boardReadinessFromRows({
    bomFrozenAt: r.bomFrozenAt,
    bomLines: r.bomLines.map((b) => ({ quantity: b.quantity, unitPriceCents: b.unitPriceCents, part: { lifecycle: b.part.lifecycle } })),
    checklists: r.checklists.map((c) => ({ subkind: c.subkind, items: c.items.map((i) => ({ checked: i.checked, notApplicable: i.notApplicable })) })),
    projectSlug: SLUG,
    targetCost: rev.project.targetCost as unknown as string | null,
  });
  console.log(`\nBOARD READINESS: ready=${readiness.ready}`);
  for (const c of readiness.checks) console.log(`   ${c.ok ? "PASS" : "----"}  [${c.tier}] ${c.label}`);
  console.log("\nDesign validated stays INCOMPLETE by design (items 3/4 owed to [S]/[L]). UNFROZEN, stage REQUIREMENTS.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
