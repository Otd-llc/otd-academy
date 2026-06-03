// Migration smoke test for the parts-knowledge Stage A data model
// (`PartCategory` enum + `PartFact` + `PartDatasheet`).
//
// Exercises the real Neon DB directly via Prisma (no server-action layer, so
// no `@/auth` / `next/cache` mocks are needed). Asserts:
//   - a `Part` accepts the new `PartCategory` enum value (`MLCC_CAPACITOR`);
//   - a `PartFact` row round-trips its JSON `data` and applies the column
//     defaults (`trust = UNVERIFIED`, `sourceKind = DATASHEET`);
//   - the `@@unique([partId, group])` constraint rejects a duplicate group.
//
// Isolation: a single throwaway `Part` (with a real `createdById` resolved
// from the seeded user, mirroring parts-actions.test.ts) is created in
// beforeAll and deleted in afterAll. Deleting the Part cascades its PartFacts
// (onDelete: Cascade), and afterAll asserts zero leftover rows. The real
// curriculum / seed parts are never touched.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "PartFactModel-TestCo";

let throwawayPartId: string;
const createdFactIds: string[] = [];

beforeAll(async () => {
  // Resolve a real user id for the required `createdById` column, the same
  // way parts-actions.test.ts gets its actor.
  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });

  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: `PFM-${Date.now()}`,
      description: "parts-knowledge migration smoke-test part",
      category: "MLCC_CAPACITOR",
      createdById: seedUser.id,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;
});

afterAll(async () => {
  // Deleting the Part cascades its PartFacts. Sweep by id and by the
  // test-manufacturer prefix for safety.
  if (throwawayPartId) {
    await db.part.deleteMany({ where: { id: throwawayPartId } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});

  // Verify zero leftover rows: the facts (cascade) and the part are gone.
  const leftoverFacts = createdFactIds.length
    ? await db.partFact.count({ where: { id: { in: createdFactIds } } })
    : 0;
  const leftoverParts = throwawayPartId
    ? await db.part.count({ where: { id: throwawayPartId } })
    : 0;
  expect(leftoverFacts).toBe(0);
  expect(leftoverParts).toBe(0);
});

describe("PartFact model + PartCategory enum", () => {
  test("the throwaway Part stored the PartCategory enum value", async () => {
    const part = await db.part.findUniqueOrThrow({
      where: { id: throwawayPartId },
      select: { category: true },
    });
    expect(part.category).toBe("MLCC_CAPACITOR");
  });

  test("a PartFact round-trips its JSON data and applies trust/sourceKind defaults", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
      select: { id: true },
    });

    const fact = await db.partFact.create({
      data: {
        partId: throwawayPartId,
        group: "PARAMETRICS",
        data: { entries: [] },
        createdById: seedUser.id,
      },
    });
    createdFactIds.push(fact.id);

    // Defaults applied by the migration.
    expect(fact.trust).toBe("UNVERIFIED");
    expect(fact.sourceKind).toBe("DATASHEET");
    expect(fact.group).toBe("PARAMETRICS");

    // The JSON `data` round-trips on a fresh read.
    const read = await db.partFact.findUniqueOrThrow({
      where: { id: fact.id },
      select: { data: true, trust: true, sourceKind: true },
    });
    expect(read.data).toEqual({ entries: [] });
    expect(read.trust).toBe("UNVERIFIED");
    expect(read.sourceKind).toBe("DATASHEET");
  });

  test("@@unique([partId, group]) rejects a duplicate group on the same part", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
      select: { id: true },
    });

    await expect(
      db.partFact.create({
        data: {
          partId: throwawayPartId,
          group: "PARAMETRICS", // same (partId, group) as the row above
          data: { entries: [{ label: "capacitance", value: "10uF" }] },
          createdById: seedUser.id,
        },
      }),
    ).rejects.toThrow();
  });
});
