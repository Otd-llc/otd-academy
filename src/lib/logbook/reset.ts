// Admin lesson-XP reset core (design §6/§14). Deletes a lesson's practice XP
// (QUIZ_CORRECT + LESSON_COMPLETE events + its QuizLocks), per-user or all-users,
// then decrements each affected user's cached xpTotal by exactly the removed sum
// and RECOMPUTES level from the new total in the SAME transaction — the one place
// a level may go DOWN. LessonCompletion rows are deliberately NOT deleted (durable
// milestone + the firstEver guard against full-rate re-inflation). Pure-ish (no
// auth); the action wrapper enforces requireAdmin.
import { db } from "@/lib/db";
import { levelFor } from "@/lib/logbook/economy";

export async function resetLessonXp(
  slug: string,
  userId?: string,
): Promise<{ affected: number }> {
  const scope = userId ? { userId } : {};
  const quizWhere = {
    ...scope,
    source: "QUIZ_CORRECT" as const,
    refId: { startsWith: `${slug}#` },
  };
  const lessonWhere = {
    ...scope,
    source: "LESSON_COMPLETE" as const,
    refId: slug,
  };

  const affected = await db.$transaction(async (tx) => {
    const removed = await tx.xpEvent.findMany({
      where: { OR: [quizWhere, lessonWhere] },
      select: { userId: true, amount: true },
    });
    const removedByUser = new Map<string, number>();
    for (const e of removed) {
      removedByUser.set(e.userId, (removedByUser.get(e.userId) ?? 0) + e.amount);
    }

    await tx.xpEvent.deleteMany({ where: quizWhere });
    await tx.xpEvent.deleteMany({ where: lessonWhere });
    await tx.quizLock.deleteMany({
      where: { ...scope, questionKey: { startsWith: `${slug}#` } },
    });

    for (const [uid, amount] of removedByUser) {
      const u = await tx.user.findUnique({
        where: { id: uid },
        select: { xpTotal: true },
      });
      if (!u) continue;
      const newTotal = Math.max(0, u.xpTotal - amount);
      await tx.user.update({
        where: { id: uid },
        data: { xpTotal: newTotal, level: levelFor(newTotal).level },
      });
    }
    return removedByUser.size;
  });

  return { affected };
}
