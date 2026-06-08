// Entitlement loading (Task A3). A premium project is gated by an Entitlement
// row keyed on [userId, projectId]; the guide pages call this to decide whether
// the viewer may read locked cards (resolveLessonAccess's `hasEntitlement`).
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

// True when an Entitlement exists for {userId, projectId}. Thin wrapper over the
// [userId, projectId] unique index so callers don't repeat the where shape.
export async function hasProjectEntitlement(
  db: TxClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const row = await db.entitlement.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { id: true },
  });
  return row != null;
}
