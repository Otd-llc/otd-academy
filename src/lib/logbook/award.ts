// The single write path for XP (design §3): idempotent on dedupeKey, updates the
// cached User.xpTotal/level/currentThrough in the same transaction, and detects
// level-ups server-side (design §14 — never client-side).
import { Prisma, type XpSource } from "@prisma/client";
import { db } from "@/lib/db";
import { academyDate, levelFor, CURRENT_WINDOW_DAYS } from "@/lib/logbook/economy";

export type AwardResult =
  | {
      awarded: true;
      xpTotal: number;
      levelUp: { level: number; title: string } | null;
    }
  | { awarded: false };

export async function awardXp(o: {
  userId: string;
  source: XpSource;
  amount: number;
  refId?: string;
  dedupeKey: string;
  now: Date;
}): Promise<AwardResult> {
  const earnedOn = academyDate(o.now); // shared helper: Date at 00:00Z of academyDay
  const currentThrough = new Date(earnedOn);
  currentThrough.setUTCDate(currentThrough.getUTCDate() + CURRENT_WINDOW_DAYS);
  try {
    // Level recompute stays INSIDE the transaction so two concurrent awards can't
    // both observe the crossing and double-report a level-up (double email).
    const result = await db.$transaction(async (tx) => {
      await tx.xpEvent.create({
        data: {
          userId: o.userId,
          source: o.source,
          amount: o.amount,
          refId: o.refId,
          earnedOn,
          dedupeKey: o.dedupeKey,
        },
      });
      const bumped = await tx.user.update({
        where: { id: o.userId },
        data: { xpTotal: { increment: o.amount }, currentThrough },
        select: { xpTotal: true, level: true, id: true },
      });
      const after = levelFor(bumped.xpTotal);
      let levelUp: { level: number; title: string } | null = null;
      if (after.level > bumped.level) {
        await tx.user.update({
          where: { id: bumped.id },
          data: { level: after.level },
        });
        levelUp = { level: after.level, title: after.title };
      }
      return { xpTotal: bumped.xpTotal, levelUp };
    });
    return { awarded: true, ...result };
  } catch (e) {
    // Unique violation on dedupeKey = an idempotent replay: a no-op, not an error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { awarded: false };
    }
    throw e;
  }
}
