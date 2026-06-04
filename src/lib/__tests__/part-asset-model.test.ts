// Migration smoke test for the parts CAD-assets Stage C data model
// (`PartAssetKind` enum + `PartAsset` model).
//
// Exercises the real Neon DB directly via Prisma (no server-action layer, so
// no `@/auth` / `next/cache` mocks are needed). Asserts:
//   - a `PartAsset` row (kind `SYMBOL`, contentType "text/plain") applies the
//     column default `trust = UNVERIFIED` and round-trips on a fresh read;
//   - the `@@unique([partId, kind])` constraint REJECTS a second `SYMBOL` on the
//     same part, but ALLOWS a `FOOTPRINT` (different kind) on that same part.
//
// Isolation: a single throwaway `Part` (with a real `createdById` resolved from
// the seeded user, mirroring part-fact-model.test.ts) is created in beforeAll
// and deleted in afterAll. Deleting the Part cascades its PartAssets
// (onDelete: Cascade); afterAll asserts zero leftover rows. The real
// curriculum / seed parts are never touched.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "PartAssetModel-TestCo";

let throwawayPartId: string;
const createdAssetIds: string[] = [];

beforeAll(async () => {
  // Resolve a real user id for the required `createdById` column, the same
  // way part-fact-model.test.ts gets its actor.
  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });

  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: `PAM-${Date.now()}`,
      description: "parts CAD-assets migration smoke-test part",
      createdById: seedUser.id,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;
});

afterAll(async () => {
  // Deleting the Part cascades its PartAssets. Sweep by id and by the
  // test-manufacturer prefix for safety.
  if (throwawayPartId) {
    await db.part.deleteMany({ where: { id: throwawayPartId } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});

  // Verify zero leftover rows: the assets (cascade) and the part are gone.
  const leftoverAssets = createdAssetIds.length
    ? await db.partAsset.count({ where: { id: { in: createdAssetIds } } })
    : 0;
  const leftoverParts = throwawayPartId
    ? await db.part.count({ where: { id: throwawayPartId } })
    : 0;
  expect(leftoverAssets).toBe(0);
  expect(leftoverParts).toBe(0);
});

describe("PartAsset model + PartAssetKind enum", () => {
  test("a SYMBOL PartAsset applies the trust=UNVERIFIED default and round-trips", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
      select: { id: true },
    });

    const asset = await db.partAsset.create({
      data: {
        partId: throwawayPartId,
        kind: "SYMBOL",
        r2Key: `parts/${throwawayPartId}/symbol-stub.kicad_sym`,
        filename: "stub.kicad_sym",
        byteSize: 1234,
        contentType: "text/plain",
        createdById: seedUser.id,
      },
    });
    createdAssetIds.push(asset.id);

    // Defaults applied by the migration.
    expect(asset.kind).toBe("SYMBOL");
    expect(asset.trust).toBe("UNVERIFIED");
    expect(asset.verifiedById).toBeNull();
    expect(asset.verifiedAt).toBeNull();

    // Values round-trip on a fresh read.
    const read = await db.partAsset.findUniqueOrThrow({
      where: { id: asset.id },
      select: {
        kind: true,
        trust: true,
        contentType: true,
        r2Key: true,
        filename: true,
        byteSize: true,
      },
    });
    expect(read.kind).toBe("SYMBOL");
    expect(read.trust).toBe("UNVERIFIED");
    expect(read.contentType).toBe("text/plain");
    expect(read.r2Key).toBe(`parts/${throwawayPartId}/symbol-stub.kicad_sym`);
    expect(read.filename).toBe("stub.kicad_sym");
    expect(read.byteSize).toBe(1234);
  });

  test("@@unique([partId, kind]) rejects a second SYMBOL on the same part", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
      select: { id: true },
    });

    await expect(
      db.partAsset.create({
        data: {
          partId: throwawayPartId,
          kind: "SYMBOL", // same (partId, kind) as the row above
          r2Key: `parts/${throwawayPartId}/symbol-dup.kicad_sym`,
          filename: "dup.kicad_sym",
          byteSize: 2345,
          contentType: "text/plain",
          createdById: seedUser.id,
        },
      }),
    ).rejects.toThrow();
  });

  test("@@unique([partId, kind]) ALLOWS a FOOTPRINT on the same part", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
      select: { id: true },
    });

    const footprint = await db.partAsset.create({
      data: {
        partId: throwawayPartId,
        kind: "FOOTPRINT", // different kind => different (partId, kind) key
        r2Key: `parts/${throwawayPartId}/footprint-stub.kicad_mod`,
        filename: "stub.kicad_mod",
        byteSize: 3456,
        contentType: "text/plain",
        createdById: seedUser.id,
      },
    });
    createdAssetIds.push(footprint.id);

    expect(footprint.kind).toBe("FOOTPRINT");
    expect(footprint.trust).toBe("UNVERIFIED");

    // The part now carries exactly two assets: one SYMBOL + one FOOTPRINT.
    const count = await db.partAsset.count({
      where: { partId: throwawayPartId },
    });
    expect(count).toBe(2);
  });
});
