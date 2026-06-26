// Rewrite l2-01's seeded REQUIREMENTS_REVIEW checklist items: the materialized
// items were generic boilerplate (WS2812 / servo brownout / ADC1-only / antenna
// keep-out) copy-pasted from other boards — none apply to a Li-ion power module.
// Replace the labels with the power-module's actual design requirements. Items are
// unchecked (no attestation yet), so this only retitles the gate. Idempotent.
// PROD write. Run: pnpm exec tsx scripts/fix-l201-requirements.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const NEW_LABELS = [
  "Charge profile + current chosen and thermally justified (CC/CV 4.20 V; ~196 mA via PROG=5.1k; copper pour under charger).",
  "Load-share strategy chosen — system runs from USB while the cell charges (cell isolated from load during charge).",
  "Cell protection strategy chosen — independent 1S PCM: over-charge / over-discharge / over-current / short.",
  "Output rails defined — 5 V boost (workhorse rail) + 3.3 V LDO-after-switcher (low-noise quiet rail).",
  "Li-ion safety bounded — reverse-polarity mitigation (keyed JST + silk) + worst-case thermal of charger and LDO.",
];

async function main() {
  const { db } = await import("@/lib/db");
  const proj = await db.project.findUnique({
    where: { slug: "l2-01-battery-power-module" },
    select: { revisions: { select: { id: true, label: true } } },
  });
  const rev = proj?.revisions.find((r) => r.label === "v1");
  if (!rev) throw new Error("no v1 revision");

  const cl = await db.checklist.findFirst({
    where: { revisionId: rev.id, subkind: "REQUIREMENTS_REVIEW" },
    include: { items: { orderBy: { ordinal: "asc" } } },
  });
  if (!cl) throw new Error("no REQUIREMENTS_REVIEW checklist");

  console.log(`checklist ${cl.id} "${cl.title}" — ${cl.items.length} items`);
  for (const it of cl.items) {
    const label = NEW_LABELS[it.ordinal];
    if (label === undefined) {
      console.log(`  ordinal ${it.ordinal}: no replacement label (left as-is) — "${it.label.slice(0, 50)}"`);
      continue;
    }
    if (it.label === label) { console.log(`  ordinal ${it.ordinal}: already correct`); continue; }
    await db.checklistItem.update({ where: { id: it.id }, data: { label } });
    console.log(`  ordinal ${it.ordinal}: -> ${label.slice(0, 60)}...`);
  }
  if (cl.items.length < NEW_LABELS.length)
    console.log(`  NOTE: ${NEW_LABELS.length - cl.items.length} target labels unused (checklist has fewer items).`);

  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
