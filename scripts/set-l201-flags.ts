// Set the l2-01-battery-power-module project safety flags so the right
// DESIGN_VALIDATION conditional audits fire. This is the first safety-critical
// (Li-ion) board:
//   hasLiIon          = true  → Li-ion protection/charge-limit/thermal-containment audit
//   hasThermalConcern = true  → deep-thermal audit (charger ~1 W + LDO ~0.85 W worst-case)
//   requiresStripboard / hasMainsNet stay FALSE (fabbed PCB, no mains).
// Idempotent; metadata-only (NOT a part/BOM/revision write — does not cross the gate).
// PROD write. Run: pnpm exec tsx scripts/set-l201-flags.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");
  const slug = "l2-01-battery-power-module";
  const before = await db.project.findUnique({
    where: { slug },
    select: { hasLiIon: true, hasThermalConcern: true, hasMainsNet: true, requiresStripboard: true },
  });
  if (!before) throw new Error(`No project ${slug}`);
  console.log("before:", JSON.stringify(before));

  const after = await db.project.update({
    where: { slug },
    data: { hasLiIon: true, hasThermalConcern: true },
    select: { hasLiIon: true, hasThermalConcern: true, hasMainsNet: true, requiresStripboard: true },
  });
  console.log("after: ", JSON.stringify(after));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
