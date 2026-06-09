// Seed the Phase B Category tree + backfill Part.categoryId.
//
// One-off, IDEMPOTENT, direct-Prisma seed (the `"use server"` action layer
// can't be scripted headlessly — requireUser()/revalidatePath — the documented
// headless-scripting constraint). The tree is defined ONCE in
// `src/lib/categories.ts` (CATEGORY_TREE); this script materializes it.
//
// What it does:
//   1. Upserts every Category node BY slug (pre-order, so a parent exists before
//      its children) with computed path/depth/order/parentId. Re-runnable: an
//      existing node is updated in place, never duplicated.
//   2. Backfills Part.categoryId: for each leaf whose slug is an old PartCategory
//      enum token, links every part whose `category` enum equals that token and
//      has no categoryId yet. The retained enum column is the bridge source.
//   3. Prints an orphan count (parts with category set but still no categoryId);
//      should be 0 once the 6 tokens are backfilled.
//
// Does NOT commit DB state — this script IS the record. Re-running is safe.
// Run: pnpm exec tsx scripts/seed-category-tree.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PartCategory } from "@prisma/client";
import { flattenCategoryTree } from "@/lib/categories";

async function main() {
  const { db } = await import("@/lib/db");

  // ─── Step 1: upsert the tree (parents-first via pre-order walk) ──────────
  const flat = flattenCategoryTree();
  const idBySlug = new Map<string, string>();
  let created = 0;
  for (const node of flat) {
    const parentId = node.parentSlug ? idBySlug.get(node.parentSlug) ?? null : null;
    const before = await db.category.findUnique({
      where: { slug: node.slug },
      select: { id: true },
    });
    const row = await db.category.upsert({
      where: { slug: node.slug },
      update: {
        name: node.name,
        path: node.path,
        depth: node.depth,
        order: node.order,
        parentId,
      },
      create: {
        slug: node.slug,
        name: node.name,
        path: node.path,
        depth: node.depth,
        order: node.order,
        parentId,
      },
      select: { id: true },
    });
    idBySlug.set(node.slug, row.id);
    if (!before) created++;
  }
  console.log(`categories: ${flat.length} present (${created} newly created)`);

  // ─── Step 2: backfill Part.categoryId for the enum-token leaves ──────────
  const enumTokens = new Set<string>(Object.values(PartCategory));
  let totalBackfilled = 0;
  for (const node of flat) {
    if (!enumTokens.has(node.slug)) continue; // interior node — no enum token
    const categoryId = idBySlug.get(node.slug)!;
    const { count } = await db.part.updateMany({
      where: { category: node.slug as PartCategory, categoryId: null },
      data: { categoryId },
    });
    totalBackfilled += count;
    console.log(`  backfill ${node.slug}: ${count} part(s) linked`);
  }
  console.log(`parts backfilled this run: ${totalBackfilled}`);

  // ─── Step 3: orphan check (category set but no categoryId) ───────────────
  const orphans = await db.part.count({
    where: { category: { not: null }, categoryId: null },
  });
  console.log(
    `parts with category set but no categoryId: ${orphans} (expected 0 — every enum token has a leaf)`,
  );

  console.log("seed-category-tree: complete.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
