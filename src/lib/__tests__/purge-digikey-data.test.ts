// DB-backed (PROD Neon via .env.local) — THROWAWAY rows only, never the shared
// esp32-sensor-breakout fixture. Single vitest process. ([[test-seed-fixture]])
import { afterAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { purgeDigikeyData } from "@/lib/purge-digikey-data";

const TEST_MFR = "T-Purge-TestCo";
const createdPartIds: string[] = [];

afterAll(async () => {
  await db.partAvailabilityEvent.deleteMany({ where: { partId: { in: createdPartIds } } });
  await db.part.deleteMany({ where: { id: { in: createdPartIds } } });
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } });
});

describe("purgeDigikeyData", () => {
  test("nulls every dk* field and deletes derived availability events", async () => {
    const seedUser = await db.user.findFirstOrThrow();
    const part = await db.part.create({
      data: {
        manufacturer: TEST_MFR,
        mpn: `PURGE-${Date.now()}`,
        description: "purge throwaway",
        createdById: seedUser.id,
        dkStockQty: 100,
        dkUnitPriceCents: 150,
        dkInStock: true,
        dkLifecycle: "Active",
        dkProductUrl: "https://www.digikey.com/x",
        dkPartNumber: "311-10.0KCRCT-ND",
        dkCheckedAt: new Date(),
      },
    });
    createdPartIds.push(part.id);
    await db.partAvailabilityEvent.create({
      data: { partId: part.id, kind: "WENT_OOS", fromValue: "in stock", toValue: "out of stock" },
    });

    const result = await purgeDigikeyData(db, { partIds: [part.id] });
    expect(result.partsCleared).toBe(1);
    expect(result.eventsDeleted).toBe(1);

    const after = await db.part.findUniqueOrThrow({ where: { id: part.id } });
    expect(after.dkStockQty).toBeNull();
    expect(after.dkUnitPriceCents).toBeNull();
    expect(after.dkInStock).toBeNull();
    expect(after.dkLifecycle).toBeNull();
    expect(after.dkProductUrl).toBeNull();
    expect(after.dkPartNumber).toBeNull();
    expect(after.dkCheckedAt).toBeNull();
    const events = await db.partAvailabilityEvent.findMany({ where: { partId: part.id } });
    expect(events).toHaveLength(0);
  });
});
