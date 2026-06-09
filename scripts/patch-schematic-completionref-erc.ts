// One-off, idempotent: realign existing curriculum SCHEMATIC cards' completionRef
// from SCHEMATIC_FILE to ERC_REPORT, matching the clean-ERC gate (#58). The
// SCHEMATIC stage skeleton now emits the ERC_REPORT completionRef for NEWLY
// composed guides; this backfills the already-materialized cards. completionRef
// is a locked gate-wiring field (seeded at materialize, excluded from
// editGuideCard), so it is patched here via direct Prisma.
//
// Additive + idempotent; safe to run against prod:
//   pnpm exec tsx scripts/patch-schematic-completionref-erc.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { Prisma } from "@prisma/client";

const ERC_REF = { kind: "artifact", subkinds: ["ERC_REPORT"] };

// Mirror the other curriculum patches: the 22 curriculum projects carry a
// level/track slug prefix, distinguishing them from the seed fixture.
const CURRICULUM_PROJECT = {
  OR: [
    { slug: { startsWith: "l1-" } },
    { slug: { startsWith: "l2-" } },
    { slug: { startsWith: "l3-" } },
    { slug: { startsWith: "bn-" } },
  ],
};

async function main() {
  const { db } = await import("@/lib/db");

  const cards = await db.guideCard.findMany({
    where: {
      stage: "SCHEMATIC",
      guide: { revision: { project: CURRICULUM_PROJECT } },
    },
    select: {
      id: true,
      completionRef: true,
      guide: {
        select: {
          revision: { select: { project: { select: { slug: true } } } },
        },
      },
    },
  });
  console.log(`SCHEMATIC cards found: ${cards.length}`);

  let patched = 0;
  let skipped = 0;
  for (const card of cards) {
    const ref = card.completionRef as { kind?: string; subkinds?: string[] } | null;
    const subs = ref?.subkinds ?? [];
    const alreadyErc =
      ref?.kind === "artifact" && subs.length === 1 && subs[0] === "ERC_REPORT";
    if (alreadyErc) {
      skipped++;
      continue;
    }
    await db.guideCard.update({
      where: { id: card.id },
      data: { completionRef: ERC_REF as unknown as Prisma.InputJsonValue },
    });
    patched++;
    console.log(`  patched ${card.guide.revision.project.slug}`);
  }
  console.log(`done: ${patched} patched, ${skipped} already ERC_REPORT`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
