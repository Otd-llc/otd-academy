// Entitlement loading (Task A3). A premium project is gated by an Entitlement
// row keyed on [userId, projectId]; the guide pages call this to decide whether
// the viewer may read locked cards (resolveLessonAccess's `hasEntitlement`).
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

// True when the user may access `projectId`. Two ways to qualify:
//   1. a per-project Entitlement on [userId, projectId] (the original path), OR
//   2. ANY bundle Entitlement the user holds (a non-null `bundleId`) — the
//      All-Access Pass unlocks every project, so a single bundle row is access to
//      all of them.
// We check the cheap unique-index lookup first, then fall back to the bundle
// check only when that misses.
export async function hasProjectEntitlement(
  db: TxClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const direct = await db.entitlement.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { id: true },
  });
  if (direct != null) return true;

  // All-Access Pass: any entitlement this user holds with a non-null bundleId
  // unlocks every project.
  const bundle = await db.entitlement.findFirst({
    where: { userId, bundleId: { not: null } },
    select: { id: true },
  });
  return bundle != null;
}
