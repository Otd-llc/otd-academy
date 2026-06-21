// DB-backed (PROD Neon via .env.local) — uses THROWAWAY rows only, never the
// shared esp32-sensor-breakout fixture. Single vitest process. ([[test-seed-fixture]])
import { afterAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { refreshAvailability } from "@/lib/refresh-availability";
import type { DkClient, DkSnapshot } from "@/lib/digikey";

const TEST_MFR = "T-Watchdog-TestCo";
const createdPartIds: string[] = [];

afterAll(async () => {
  if (createdPartIds.length > 0) {
    await db.partAvailabilityEvent.deleteMany({ where: { partId: { in: createdPartIds } } });
    await db.part.deleteMany({ where: { id: { in: createdPartIds } } });
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } });
});

function stubClient(snap: DkSnapshot): DkClient {
  return { searchByMpn: async () => snap };
}

describe("refreshAvailability", () => {
  test("writes the snapshot + a WENT_OOS event when a part goes out of stock", async () => {
    const seedUser = await db.user.findFirstOrThrow();
    const mpn = `WD-${Date.now()}`;
    const part = await db.part.create({
      data: {
        manufacturer: TEST_MFR,
        mpn,
        description: "watchdog throwaway",
        createdById: seedUser.id,
      },
    });
    createdPartIds.push(part.id);

    const client = stubClient({
      matched: true,
      stockQty: 0,
      unitPriceCents: 150,
      inStock: false,
      lifecycle: "Active",
      productUrl: "https://www.digikey.com/x",
      partNumber: "311-10.0KCRCT-ND",
    });

    // Scope to the throwaway part ONLY — never touch real library rows on the
    // shared PROD DB.
    const result = await refreshAvailability({
      db,
      client,
      limit: 500,
      now: new Date(),
      partIds: [part.id],
    });
    expect(result.checked).toBe(1);

    const updated = await db.part.findUniqueOrThrow({ where: { id: part.id } });
    expect(updated.dkInStock).toBe(false);
    expect(updated.dkStockQty).toBe(0);
    expect(updated.dkUnitPriceCents).toBe(150);
    expect(updated.dkCheckedAt).not.toBeNull();

    const events = await db.partAvailabilityEvent.findMany({ where: { partId: part.id } });
    expect(events.some((e) => e.kind === "WENT_OOS")).toBe(true);
  });

  test("isolates a per-part failure — one DigiKey error doesn't abort the rest of the sweep", async () => {
    const seedUser = await db.user.findFirstOrThrow();
    const goodMpn = `WD-OK-${Date.now()}`;
    const badMpn = `WD-ERR-${Date.now()}`;
    const good = await db.part.create({ data: { manufacturer: TEST_MFR, mpn: goodMpn, description: "ok", createdById: seedUser.id } });
    const bad = await db.part.create({ data: { manufacturer: TEST_MFR, mpn: badMpn, description: "err", createdById: seedUser.id } });
    createdPartIds.push(good.id, bad.id);

    // Client throws for the bad MPN (a 429/500 in the wild), succeeds for the good one.
    const client: DkClient = {
      searchByMpn: async (mpn: string) => {
        if (mpn === badMpn) throw new Error("DigiKey search 500");
        return { matched: true, stockQty: 42, unitPriceCents: 100, inStock: true, lifecycle: "Active", productUrl: null, partNumber: "Z-ND" };
      },
    };

    // Must NOT throw, and must still process the good part.
    const result = await refreshAvailability({ db, client, limit: 500, now: new Date(), partIds: [good.id, bad.id] });
    expect(result.checked).toBe(1);
    expect(result.failed).toBe(1);

    const g = await db.part.findUniqueOrThrow({ where: { id: good.id } });
    expect(g.dkStockQty).toBe(42); // good part written
    const b = await db.part.findUniqueOrThrow({ where: { id: bad.id } });
    expect(b.dkCheckedAt).toBeNull(); // failed part untouched (keeps prior state)
  });
});
