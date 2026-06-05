// src/lib/__tests__/parts-list.test.ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { listParts } from "@/lib/parts-list";

const SEED_EMAIL = "seed@example.com";
const MFR = `PartsList-TestCo-${Date.now()}`;
let userId: string;

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL }, select: { id: true } })).id;
  // 3 rows under one manufacturer, distinct mpn/description/lifecycle/certified.
  await db.part.createMany({
    data: [
      { manufacturer: MFR, mpn: "AA-100", description: "ten kilohm widget", lifecycle: "ACTIVE", isCertifiedModule: true,  createdById: userId },
      { manufacturer: MFR, mpn: "BB-200", description: "voltage regulator",  lifecycle: "EOL",    isCertifiedModule: false, createdById: userId },
      { manufacturer: MFR, mpn: "CC-300", description: "ten kilohm sensor",  lifecycle: "ACTIVE", isCertifiedModule: false, createdById: userId },
    ],
  });
});

afterAll(async () => {
  await db.part.deleteMany({ where: { manufacturer: MFR } }).catch(() => {});
  expect(await db.part.count({ where: { manufacturer: MFR } })).toBe(0);
});

// Helper: scope every query to this test's rows via q=MFR (contains match).
const base = { q: MFR, lifecycle: undefined, mains: false, sort: "manufacturer" as const, page: 1 };

describe("listParts", () => {
  test("q matches across mpn/manufacturer/description; returns full select + totals", async () => {
    const r = await listParts(db, base);
    expect(r.total).toBe(3);
    expect(r.totalPages).toBe(1);
    expect(r.parts.map((p) => p.mpn).sort()).toEqual(["AA-100", "BB-200", "CC-300"]);
    expect(r.parts[0]).toHaveProperty("category");
    expect(r.parts[0]).toHaveProperty("isCertifiedModule");
  });

  test("q narrows by description token", async () => {
    const r = await listParts(db, { ...base, q: "ten kilohm" });
    // scoped enough for the test set; assert our two matches are present
    const mine = r.parts.filter((p) => p.manufacturer === MFR).map((p) => p.mpn).sort();
    expect(mine).toEqual(["AA-100", "CC-300"]);
  });

  test("lifecycle filter", async () => {
    const r = await listParts(db, { ...base, lifecycle: "EOL" });
    expect(r.parts.map((p) => p.mpn)).toEqual(["BB-200"]);
  });

  test("mains filter → certified only", async () => {
    const r = await listParts(db, { ...base, mains: true });
    expect(r.parts.map((p) => p.mpn)).toEqual(["AA-100"]);
  });

  test("sort=mpn orders ascending by mpn", async () => {
    const r = await listParts(db, { ...base, sort: "mpn" });
    expect(r.parts.map((p) => p.mpn)).toEqual(["AA-100", "BB-200", "CC-300"]);
  });

  test("pagination: pageSize=2 → 2 pages, page 2 has the remainder", async () => {
    const p1 = await listParts(db, { ...base, sort: "mpn", page: 1 }, 2);
    expect(p1.total).toBe(3);
    expect(p1.totalPages).toBe(2);
    expect(p1.parts.map((p) => p.mpn)).toEqual(["AA-100", "BB-200"]);
    const p2 = await listParts(db, { ...base, sort: "mpn", page: 2 }, 2);
    expect(p2.parts.map((p) => p.mpn)).toEqual(["CC-300"]);
  });

  test("page past the end clamps to the last page", async () => {
    const r = await listParts(db, { ...base, sort: "mpn", page: 99 }, 2);
    expect(r.page).toBe(2);
    expect(r.parts.map((p) => p.mpn)).toEqual(["CC-300"]);
  });
});

// ─── Phase B — cat subtree filter ───────────────────────────────────────────
// `?cat=<path>` narrows to a category's subtree: parts on the node itself OR any
// descendant (matched by materialized-path prefix via subtreeWhere). Throwaway
// parent+child categories with Date.now()-suffixed slugs keep this isolated from
// the seeded tree; swept in afterAll (child before parent — parentId is RESTRICT).
describe("listParts cat subtree filter", () => {
  const STAMP = Date.now();
  const CAT_MFR = `PartsListCat-TestCo-${STAMP}`;
  const parentSlug = `test-parent-${STAMP}`;
  const childSlug = `test-child-${STAMP}`;
  const parentPath = parentSlug;
  const childPath = `${parentSlug}/${childSlug}`;
  let parentId: string;
  let childId: string;

  beforeAll(async () => {
    const parent = await db.category.create({
      data: { slug: parentSlug, name: "Test Parent", path: parentPath, depth: 0, order: 0 },
      select: { id: true },
    });
    parentId = parent.id;
    const child = await db.category.create({
      data: { slug: childSlug, name: "Test Child", path: childPath, depth: 1, order: 0, parentId },
      select: { id: true },
    });
    childId = child.id;
    await db.part.createMany({
      data: [
        { manufacturer: CAT_MFR, mpn: "PARENT-1", description: "on the parent node", categoryId: parentId, createdById: userId },
        { manufacturer: CAT_MFR, mpn: "CHILD-1", description: "on the child node", categoryId: childId, createdById: userId },
      ],
    });
  });

  afterAll(async () => {
    await db.part.deleteMany({ where: { manufacturer: CAT_MFR } }).catch(() => {});
    await db.category.deleteMany({ where: { id: childId } }).catch(() => {});
    await db.category.deleteMany({ where: { id: parentId } }).catch(() => {});
    expect(await db.part.count({ where: { manufacturer: CAT_MFR } })).toBe(0);
  });

  const catBase = { q: undefined, lifecycle: undefined, mains: false, sort: "mpn" as const, page: 1 };

  test("cat = parent path returns parts on the parent AND its descendants", async () => {
    const r = await listParts(db, { ...catBase, cat: parentPath });
    expect(r.parts.map((p) => p.mpn).sort()).toEqual(["CHILD-1", "PARENT-1"]);
  });

  test("cat = child path returns only the child's parts", async () => {
    const r = await listParts(db, { ...catBase, cat: childPath });
    expect(r.parts.map((p) => p.mpn)).toEqual(["CHILD-1"]);
  });

  test("the returned rows carry categoryRef {slug,name,path} for display", async () => {
    const r = await listParts(db, { ...catBase, cat: childPath });
    expect(r.parts[0].categoryRef).toEqual({
      slug: childSlug,
      name: "Test Child",
      path: childPath,
    });
  });

  test("an unknown cat path narrows nothing (degrades gracefully)", async () => {
    // Scope by manufacturer so the assertion sees only this test's rows.
    const r = await listParts(db, { ...catBase, q: CAT_MFR, cat: `no-such-path-${STAMP}` });
    expect(r.parts.map((p) => p.mpn).sort()).toEqual(["CHILD-1", "PARENT-1"]);
  });
});
