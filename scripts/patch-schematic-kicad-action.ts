// One-off, idempotent: add the "Download KiCad starter" action block to the
// SCHEMATIC GuideCard of every already-materialized curriculum guide that lacks
// it. The SCHEMATIC stage skeleton now emits this block for NEWLY composed
// guides (src/lib/guide-templates/stage-skeletons.ts); this backfills guides
// materialized before that change. Re-running is a no-op (skips cards that
// already have the action — including L1.01, whose guide is hand-authored).
//
// Additive + schema-validated; safe to run against prod. Run after the skeleton
// change merges:
//   pnpm exec tsx scripts/patch-schematic-kicad-action.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { Prisma } from "@prisma/client";

const ACTION_BLOCK = {
  type: "action",
  action: "downloadKicadStarter",
  label: "Download the KiCad starter (placed parts)",
} as const;

// Mirror materialize-curriculum-guides.ts: the 22 curriculum projects carry a
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
  const { guideContentBlocksSchema } = await import("@/lib/schemas/guide");

  const cards = await db.guideCard.findMany({
    where: {
      stage: "SCHEMATIC",
      guide: { revision: { project: CURRICULUM_PROJECT } },
    },
    select: {
      id: true,
      contentBlocks: true,
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
    const blocks = Array.isArray(card.contentBlocks)
      ? (card.contentBlocks as unknown[])
      : [];
    const hasAction = blocks.some((b) => {
      const o = b as { type?: unknown; action?: unknown };
      return o?.type === "action" && o?.action === "downloadKicadStarter";
    });
    if (hasAction) {
      skipped++;
      continue;
    }
    const next = [...blocks, ACTION_BLOCK];
    // Defense-in-depth: the patched array must still satisfy the persisted schema.
    guideContentBlocksSchema.parse(next);
    await db.guideCard.update({
      where: { id: card.id },
      data: { contentBlocks: next as unknown as Prisma.InputJsonValue },
    });
    patched++;
    console.log(`  patched ${card.guide.revision.project.slug}`);
  }
  console.log(`done: ${patched} patched, ${skipped} already had it`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
