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
