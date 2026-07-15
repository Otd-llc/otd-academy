// Verify MiniLesson's derived columns still match a fresh derive from
// contentBlocks. Exits 1 on drift, so it works as a manual gate.
//
//   pnpm exec tsx scripts/check-lesson-derived-drift.ts     -> local foundry_dev
//   pnpm db:prod scripts/check-lesson-derived-drift.ts      -> PROD (prompts)
//
// Why a script and not a vitest test: the vitest branch pool is a stale clone of
// prod that receives migrations but never the backfill, so its rows legitimately
// sit at the placeholder defaults and a data-drift test would always fail there.
// The CODE-level risk (a write path skipping the db.ts extension) is covered
// automatically by src/lib/__tests__/library-derived-bypass-guard.test.ts; this
// script is the DATA-level check against a real database.
//
// Drift means something wrote contentBlocks without going through the extension.
// Fix: re-run `scripts/backfill-lesson-derived.ts` against the same target, then
// work out what bypassed it.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

async function main() {
  const { db } = await import("@/lib/db");
  const { deriveLessonMeta } = await import("@/lib/library/derived");

  const host = new URL(process.env.DATABASE_URL!).hostname;
  console.log(`  target: ${host}`);

  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    select: {
      slug: true,
      contentBlocks: true,
      readingMinutes: true,
      questionCount: true,
      diagramSrc: true,
    },
    orderBy: { slug: "asc" },
  });

  const drifted = rows
    .map((r) => {
      const want = deriveLessonMeta(r.contentBlocks);
      const got = {
        readingMinutes: r.readingMinutes,
        questionCount: r.questionCount,
        diagramSrc: r.diagramSrc,
      };
      return { slug: r.slug, want, got };
    })
    .filter((r) => JSON.stringify(r.want) !== JSON.stringify(r.got));

  console.log(`  checked ${rows.length} published lessons`);

  if (drifted.length === 0) {
    console.log("  OK: no drift");
    await db.$disconnect();
    return;
  }

  console.error(`\n  DRIFT: ${drifted.length} lesson(s) disagree with a fresh derive\n`);
  for (const d of drifted.slice(0, 20)) {
    console.error(`    ${d.slug}`);
    console.error(`      stored : ${JSON.stringify(d.got)}`);
    console.error(`      derived: ${JSON.stringify(d.want)}`);
  }
  if (drifted.length > 20) console.error(`    ... ${drifted.length - 20} more`);
  console.error(`\n  Fix: pnpm exec tsx scripts/backfill-lesson-derived.ts (same target)`);
  await db.$disconnect();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
