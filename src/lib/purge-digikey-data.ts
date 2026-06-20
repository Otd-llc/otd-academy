import type { PrismaClient } from "@prisma/client";

export interface PurgeArgs {
  // Optional scope: restrict to these part ids (tests / targeted purge). Omitted
  // → the whole library (the offboarding case).
  partIds?: string[];
}

export interface PurgeResult {
  partsCleared: number;
  eventsDeleted: number;
}

// Delete all DigiKey Data: null every cached dk* snapshot column on Part and
// remove the derived PartAvailabilityEvent log. Satisfies the API User
// Agreement's "delete all DigiKey Data in your possession or control" clause.
// One transaction so a partial purge can't leave events orphaned from a cleared
// Part. Idempotent — a second run clears 0/0.
export async function purgeDigikeyData(
  db: PrismaClient,
  args: PurgeArgs = {},
): Promise<PurgeResult> {
  const partWhere = args.partIds ? { id: { in: args.partIds } } : {};
  const eventWhere = args.partIds ? { partId: { in: args.partIds } } : {};

  return db.$transaction(async (tx) => {
    const events = await tx.partAvailabilityEvent.deleteMany({ where: eventWhere });
    const parts = await tx.part.updateMany({
      where: partWhere,
      data: {
        dkStockQty: null,
        dkUnitPriceCents: null,
        dkInStock: null,
        dkLifecycle: null,
        dkProductUrl: null,
        dkPartNumber: null,
        dkCheckedAt: null,
      },
    });
    return { partsCleared: parts.count, eventsDeleted: events.count };
  });
}
