import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { globSync } from "node:fs";

// MiniLesson.readingMinutes/questionCount/diagramSrc are derived from
// contentBlocks and kept fresh by the client extension in src/lib/db.ts. That
// extension hooks create/update/upsert ONLY -- `updateMany` and raw SQL go
// straight to the database and would silently leave the columns stale, so
// /library would serve wrong read-times with nothing failing.
//
// This is a STATIC guard rather than a data check on purpose. A data-drift test
// cannot run meaningfully here: the vitest branch pool is a stale clone of prod
// that gets migrations but never the backfill, so its rows legitimately sit at
// the placeholder defaults. The real risk is a NEW bypass being introduced, and
// that is a fact about the code -- catchable deterministically, at PR time.
//
// For a real data check run:  pnpm exec tsx scripts/check-lesson-derived-drift.ts
// See docs/plans/2026-07-15-library-derived-columns.md.
const ROOT = join(__dirname, "..", "..", "..");

const BYPASS_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "miniLesson.updateMany", re: /\bminiLesson\s*\.\s*updateMany\b/ },
  { name: "miniLesson.createMany", re: /\bminiLesson\s*\.\s*createMany\b/ },
  // Raw SQL that writes MiniLesson. Matches an UPDATE/INSERT naming the table.
  {
    name: "raw SQL write to MiniLesson",
    re: /\$(?:execute|query)Raw(?:Unsafe)?[\s\S]{0,200}?(?:UPDATE|INSERT\s+INTO)\s+"?(?:public"?\.)?"?MiniLesson"?/i,
  },
];

function sourceFiles(): string[] {
  return globSync("**/*.{ts,tsx}", {
    cwd: ROOT,
    exclude: (p) =>
      p.includes("node_modules") ||
      p.includes(".next") ||
      p.includes("worktrees") ||
      // this guard names the patterns it forbids
      p.endsWith("library-derived-bypass-guard.test.ts"),
  }).map((p) => join(ROOT, p));
}

describe("nothing bypasses the MiniLesson derived-column extension", () => {
  it("no updateMany / createMany / raw-SQL write targets MiniLesson", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      let src: string;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (!src.includes("miniLesson") && !src.includes("MiniLesson")) continue;
      for (const { name, re } of BYPASS_PATTERNS) {
        if (re.test(src)) {
          offenders.push(`${relative(ROOT, file)}: ${name}`);
        }
      }
    }

    // If this fails, that write path skips src/lib/db.ts's $extends hook and
    // leaves the derived columns stale. Either route it through
    // create/update/upsert, or run scripts/backfill-lesson-derived.ts after it
    // and add the file here with a comment explaining why it is safe.
    expect(offenders).toEqual([]);
  });

  it("the guard's own patterns actually match (so it cannot rot into a no-op)", () => {
    // A regex guard that silently stops matching is worse than no guard.
    expect(BYPASS_PATTERNS[0].re.test("await db.miniLesson.updateMany({ where: {} })")).toBe(true);
    expect(BYPASS_PATTERNS[1].re.test("db.miniLesson.createMany({ data: [] })")).toBe(true);
    expect(
      BYPASS_PATTERNS[2].re.test('await db.$executeRaw`UPDATE "MiniLesson" SET "title" = 1`'),
    ).toBe(true);
    // and do not fire on the legitimate paths
    expect(BYPASS_PATTERNS[0].re.test("await db.miniLesson.update({ where: {} })")).toBe(false);
    expect(BYPASS_PATTERNS[2].re.test('await db.$queryRaw`SELECT * FROM "MiniLesson"`')).toBe(false);
  });
});
