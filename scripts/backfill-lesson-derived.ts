// Backfill MiniLesson's derived columns for every existing row.
//
// Idempotent -- re-running recomputes the same values. Safe to re-run after any
// bulk content edit that bypassed the db.ts extension (updateMany / raw SQL / a
// direct psql edit), which is exactly what the drift guardrail tells you to do.
//
// Targets whatever DATABASE_URL points at. Since 2026-07-15 that is LOCAL:
//   pnpm exec tsx scripts/backfill-lesson-derived.ts     -> local foundry_dev
//   pnpm db:prod scripts/backfill-lesson-derived.ts      -> PROD (prompts)
import { config as loadEnv } from "dotenv";
import { revalidate } from "./lib/revalidate";
loadEnv({ path: ".env.local", quiet: true });

async function main() {
  const { db } = await import("@/lib/db");
  const { deriveLessonMeta } = await import("@/lib/library/derived");

  const host = new URL(process.env.DATABASE_URL!).hostname;
  console.log(`  target: ${host}`);

  const rows = await db.miniLesson.findMany({
    select: { id: true, slug: true, contentBlocks: true },
    orderBy: { slug: "asc" },
  });
  console.log(`  backfilling ${rows.length} lessons...\n`);

  let changed = 0;
  for (const row of rows) {
    const derived = deriveLessonMeta(row.contentBlocks);
    // Write ONLY the derived fields. Passing contentBlocks back through would
    // also work (the extension would recompute), but rewriting a TOASTed JSON
    // column for no reason is exactly the waste this whole change removes.
    await db.miniLesson.update({ where: { id: row.id }, data: derived });
    changed++;
    console.log(
      `    ${String(derived.readingMinutes).padStart(2)} min | ` +
        `${String(derived.questionCount).padStart(2)} Q | ` +
        `${(derived.diagramSrc ?? "(no diagram)").padEnd(46)} ${row.slug}`,
    );
  }

  console.log(`\n  done: ${changed} rows`);

  // THE CASE THIS WHOLE MECHANISM EXISTS FOR. Migration
  // 20260715200000_minilesson_derived_columns tells you to run this script
  // afterwards; before the revalidate route existed, following that instruction
  // exactly left /library serving the placeholder defaults (readingMinutes = 1,
  // questionCount = 0) for up to a day, with nothing to grep for. Broad tag
  // because this rewrites every lesson. No-ops on a local run.
  if (changed > 0) await revalidate({ tags: ["mini-lessons"] });

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
