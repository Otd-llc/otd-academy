// Give every stored guide / mini-lesson content block a stable `id`.
//
//   pnpm exec tsx scripts/backfill-block-ids.ts            LOCAL, DRY (default)
//   pnpm exec tsx scripts/backfill-block-ids.ts --write    LOCAL, applies
//   pnpm db:prod scripts/backfill-block-ids.ts --write     PROD (prompts)
//
// WHY. Every reference to a block outside the database is POSITIONAL -- the
// video scripts cite "blocks [8]-[18] of the SCHEMATIC card", media writes take
// a `blockIndex`. Insert one block and each of those silently names different
// content. `withBlockIds` closes that for blocks that pass through a write; this
// closes it for the rows nobody is about to edit.
//
// DO THIS BEFORE THE SCRIPTS EXIST, NOT AFTER. With one video script written
// the backfill is free. With 127 written against positional references it is a
// migration of the scripts as well as the rows.
//
// IDEMPOTENT. An existing id is never replaced -- re-minting would break exactly
// the references the ids exist to protect. Re-running is a no-op.
//
// DRY BY DEFAULT because this rewrites a JSON column on every content row in the
// database, and the interesting failure is not "it crashed", it is "it wrote
// something subtly wrong to all of them".
//
// IT VERIFIES BY READING BACK. A count of update calls that returned without
// throwing is a report of INTENT. After writing, this re-queries every row and
// recomputes coverage from what is actually stored, and fails if the second pass
// disagrees with the first. It also fails on DUPLICATE ids, which matter more
// than missing ones: a duplicate means two blocks answer to one reference, which
// is the ambiguity ids were added to remove.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

const WRITE = process.argv.includes("--write");

type Row = { id: string; label: string; contentBlocks: unknown };

async function main() {
  const { db } = await import("@/lib/db");
  const { withBlockIds, blockIdCoverage, blockIds } = await import("@/lib/guide-block-ids");

  const host = new URL(process.env.DATABASE_URL!).hostname;
  console.log(`\n  target: ${host}`);
  console.log(`  mode:   ${WRITE ? "WRITE" : "DRY RUN (pass --write to apply)"}\n`);

  const cards = await db.guideCard.findMany({
    select: { id: true, stage: true, title: true, contentBlocks: true },
    orderBy: { id: "asc" },
  });
  const lessons = await db.miniLesson.findMany({
    select: { id: true, slug: true, contentBlocks: true },
    orderBy: { slug: "asc" },
  });

  const groups: { name: string; rows: Row[]; update: (id: string, blocks: unknown) => Promise<unknown> }[] = [
    {
      name: "guideCard",
      rows: cards.map((c) => ({ id: c.id, label: `${c.stage} / ${c.title}`, contentBlocks: c.contentBlocks })),
      update: (id, blocks) =>
        db.guideCard.update({ where: { id }, data: { contentBlocks: blocks as never } }),
    },
    {
      name: "miniLesson",
      rows: lessons.map((l) => ({ id: l.id, label: l.slug, contentBlocks: l.contentBlocks })),
      update: (id, blocks) =>
        db.miniLesson.update({ where: { id }, data: { contentBlocks: blocks as never } }),
    },
  ];

  let problems = 0;

  for (const g of groups) {
    let rowsNeeding = 0;
    let blocksTotal = 0;
    let blocksMissing = 0;

    for (const r of g.rows) {
      const cov = blockIdCoverage(r.contentBlocks);
      blocksTotal += cov.total;
      blocksMissing += cov.total - cov.withId;
      if (cov.total !== cov.withId) rowsNeeding += 1;
    }

    console.log(
      `  ${g.name}: ${g.rows.length} rows, ${blocksTotal} blocks, ` +
        `${blocksMissing} without an id (${rowsNeeding} rows affected)`,
    );

    if (!WRITE) continue;

    let written = 0;
    for (const r of g.rows) {
      const cov = blockIdCoverage(r.contentBlocks);
      if (cov.total === cov.withId) continue; // untouched rows are not rewritten
      await g.update(r.id, withBlockIds(r.contentBlocks));
      written += 1;
    }
    console.log(`    wrote ${written} rows`);
  }

  // ---- READ BACK ----------------------------------------------------------
  // Not "did the updates return", but "what is in the database now". These are
  // different questions and only the second one is evidence.
  console.log("\n  reading back...");
  const cards2 = await db.guideCard.findMany({ select: { id: true, stage: true, title: true, contentBlocks: true } });
  const lessons2 = await db.miniLesson.findMany({ select: { id: true, slug: true, contentBlocks: true } });
  const after: Row[] = [
    ...cards2.map((c) => ({ id: c.id, label: `guideCard ${c.stage} / ${c.title}`, contentBlocks: c.contentBlocks })),
    ...lessons2.map((l) => ({ id: l.id, label: `miniLesson ${l.slug}`, contentBlocks: l.contentBlocks })),
  ];

  let total = 0;
  let withId = 0;
  const seen = new Map<string, string>();
  for (const r of after) {
    const cov = blockIdCoverage(r.contentBlocks);
    total += cov.total;
    withId += cov.withId;
    for (const id of blockIds(r.contentBlocks)) {
      const prev = seen.get(id);
      if (prev) {
        console.log(`  !! DUPLICATE id ${id}: "${prev}" and "${r.label}"`);
        problems += 1;
      } else {
        seen.set(id, r.label);
      }
    }
  }

  if (total === 0) {
    // A backfill over an empty set reports success. Say so instead.
    console.log("\n  NO BLOCKS FOUND. Nothing was verified; this is not a clean result.");
    await db.$disconnect();
    process.exit(1);
  }

  const pct = ((withId / total) * 100).toFixed(1);
  console.log(`  coverage: ${withId}/${total} blocks carry an id (${pct}%)`);

  if (WRITE && withId !== total) {
    console.log(`  !! ${total - withId} blocks still have no id AFTER a write pass`);
    problems += 1;
  }

  if (problems > 0) {
    console.log(`\n  FAILED (${problems}). The schema field must stay optional.`);
    await db.$disconnect();
    process.exit(1);
  }

  console.log(
    WRITE
      ? "\n  done. Coverage is complete and every id is unique."
      : "\n  dry run only -- nothing was written. Re-run with --write to apply.",
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
