// l1-03-ws2812-node — record the DESIGN_VALIDATION attestations Josh authorized:
// check the 5 items the validation-log now evidences, and LEAVE item 4 (fab-DRU)
// unchecked — it is [L]-stage by nature (F7). Idempotent. completedById = the owner.
// Item order (materialized ordinals 0..5):
//   0 Calc trail            -> CHECK   (Passes 3/5/11/14, design §3)
//   1 IC datasheet-verified -> CHECK   (Pass 5/11/13: AHCT125, RT9080, D2, D3, LED3)
//   2 Footprint↔pinout      -> CHECK   ([S]-VERIFIED Pass 17: 9 new parts, pad-by-pad)
//   3 Fab-DRU DRC           -> leave   ([L], layout)
//   4 BOM availability       -> CHECK   (Pass 16: 25/25 resolve, all ACTIVE + DK-in-stock)
//   5 All top risks de-risked-> CHECK   (design §6/§7)
// Run: pnpm exec tsx scripts/attest-l103-dv.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SLUG = "l1-03-ws2812-node";
const CHECK_ORDINALS = [0, 1, 2, 4, 5];

async function main() {
  const { db } = await import("@/lib/db");

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
  // Readiness derived inline — decoupled from board-readiness-load (whose input
  // type now requires DigiKey availability fields the seed scripts don't carry).
  const dvCl = r.checklists.find((c) => c.subkind === "DESIGN_VALIDATION");
  const dvItems = dvCl?.items ?? [];
  const dvDone = dvItems.filter((i) => i.checked || i.notApplicable).length;
  const dvComplete = dvItems.length > 0 && dvDone === dvItems.length;
  const noEol = r.bomLines.every((b) => b.part.lifecycle === "ACTIVE");
  const ready = !!r.bomFrozenAt && r.bomLines.length > 0 && noEol && dvComplete;
  console.log(`\nBOARD READINESS: ready=${ready}`);
  console.log(`   ${r.bomLines.length > 0 ? "PASS" : "----"}  [required] BOM has parts (${r.bomLines.length})`);
  console.log(`   ${noEol ? "PASS" : "----"}  [required] No EOL/NRND parts`);
  console.log(`   ${r.bomFrozenAt ? "PASS" : "----"}  [required] BOM frozen`);
  console.log(`   ${dvComplete ? "PASS" : "----"}  [required] Design validated (DV ${dvDone}/${dvItems.length})`);
  console.log("\nDesign validated stays INCOMPLETE by design (item 4 fab-DRU owed to [L]). UNFROZEN, BOM_SOURCING.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
