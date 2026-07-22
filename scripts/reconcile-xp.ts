// XP ledger reconciliation (audit Phase 5 / Task 5.3). REPORT-ONLY.
//
// Displayed XP/rank read the denormalized User.xpTotal/level mirrors; the
// XpEvent ledger is the truth. The award paths keep them in sync
// transactionally, but two divergences are possible by design and were
// previously undetectable:
//   • adminSetLevel is a hard level override (audited, but level no longer
//     follows levelFor(xpTotal) afterwards);
//   • any historical partial write leaves xpTotal != SUM(XpEvent.amount).
//
// Run: npx tsx scripts/reconcile-xp.ts   (local; prod via `pnpm db:prod`)
// Exit 0 = clean; exit 2 = drift found (report printed, nothing mutated).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { levelFor } from "@/lib/logbook/economy";

async function main() {
  const { db } = await import("@/lib/db");

  const sums = await db.xpEvent.groupBy({
    by: ["userId"],
    _sum: { amount: true },
  });
  const sumByUser = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));

  const users = await db.user.findMany({
    where: { OR: [{ xpTotal: { gt: 0 } }, { xpEvents: { some: {} } }] },
    select: { id: true, email: true, xpTotal: true, level: true },
  });

  const drift: string[] = [];
  for (const u of users) {
    const ledger = sumByUser.get(u.id) ?? 0;
    const expectedLevel = levelFor(u.xpTotal).level;
    if (u.xpTotal !== ledger) {
      drift.push(
        `${u.email ?? u.id}: xpTotal ${u.xpTotal} != ledger SUM ${ledger} (delta ${u.xpTotal - ledger})`,
      );
    }
    if (u.level !== expectedLevel) {
      drift.push(
        `${u.email ?? u.id}: level ${u.level} != levelFor(xpTotal) ${expectedLevel} (admin override or drift; see AdminAudit set_level rows)`,
      );
    }
  }

  console.log(`Checked ${users.length} user(s) with XP activity.`);
  if (drift.length === 0) {
    console.log("✓ Mirrors match the ledger.");
    return;
  }
  console.log(`✗ ${drift.length} divergence(s):`);
  for (const line of drift) console.log(`  - ${line}`);
  process.exit(2);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
