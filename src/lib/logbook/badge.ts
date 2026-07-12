// Shared idempotent badge grant for the Logbook cascade (design §7). Earned
// badges are permanent; the composite PK (userId, badgeKey) makes a re-grant a
// no-op. Used by the lesson-completion cascade and the feedback "Shipped It" path.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** A Prisma P2002 (unique/PK violation) — a benign idempotent replay, not an error. */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// Grant a badge once. Returns true only when THIS call created the row, so the
// caller can surface it as newly earned; a concurrent double-fire / replay
// returns false rather than throwing.
export async function earnBadge(
  userId: string,
  badgeKey: string,
  meta?: Prisma.InputJsonValue,
): Promise<boolean> {
  try {
    await db.badgeEarned.create({ data: { userId, badgeKey, meta } });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}
