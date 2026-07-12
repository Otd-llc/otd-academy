// The core Library XP loop (design §5), server-authoritative like recordQuizPass:
// every award re-validates against the lesson's OWN contentBlocks in the DB, so a
// fabricated client POST cannot mint XP. Pure-ish core (takes userId + injected
// `now`); the "use server" wrappers in actions/logbook.ts resolve the session.
import { db } from "@/lib/db";
import { readingMinutes } from "@/lib/library/reading-time";
import { clusterByKey } from "@/lib/library/clusters";
import { questionKey } from "@/lib/logbook/question-key";
import { quizQuestions } from "@/lib/logbook/lesson-content";
import { awardXp } from "@/lib/logbook/award";
import { milestonesFor } from "@/lib/logbook/milestones";
import { earnBadge, isUniqueViolation } from "@/lib/logbook/badge";
import {
  academyDate,
  quizXp,
  lessonXp,
  dedupe,
  CLUSTER_XP,
  LIBRARY_XP,
} from "@/lib/logbook/economy";

type LevelUp = { level: number; title: string } | null;

export type QuizAnswerResult =
  | { ok: false }
  | { ok: true; correct: false; xp: 0 }
  | { ok: true; correct: true; xp: number; locked?: boolean; levelUp: LevelUp };

// Record ONE quiz answer (design §5). The client MUST call this on wrong picks too
// — the lock row it writes is what later satisfies the completion "attempted"
// check. Correct picks award full (first-ever) or repop (already done) rate.
export async function recordQuizAnswer(
  input: { slug: string; questionKey: string; pick: number },
  userId: string,
  now: Date,
): Promise<QuizAnswerResult> {
  const lesson = await db.miniLesson.findFirst({
    where: { slug: input.slug, published: true, accessTier: "PUBLIC" },
    select: { contentBlocks: true },
  });
  if (!lesson) return { ok: false };
  const q = quizQuestions(lesson.contentBlocks).find(
    (qq) => questionKey(input.slug, qq) === input.questionKey,
  );
  if (!q) return { ok: false };

  const day = academyDate(now);
  const lockWhere = {
    userId_questionKey_lockedOn: {
      userId,
      questionKey: input.questionKey,
      lockedOn: day,
    },
  };

  // Wrong pick → lock the question for today (anti guess-farming); feeds completion.
  if (input.pick !== q.answer) {
    await db.quizLock.upsert({
      where: lockWhere,
      create: { userId, questionKey: input.questionKey, lockedOn: day },
      update: {},
    });
    return { ok: true, correct: false, xp: 0 };
  }

  // Correct, but a wrong pick earlier today already locked it → no XP.
  const locked = await db.quizLock.findUnique({ where: lockWhere });
  if (locked) return { ok: true, correct: true, xp: 0, locked: true, levelUp: null };

  // firstEver: never awarded for this question AND the lesson isn't yet completed.
  // Keying on LessonCompletion (not just prior events) means an admin XP reset
  // re-enables practice at the REPOP rate, never full-rate re-inflation (§5/§6).
  const [priorAward, completion] = await Promise.all([
    db.xpEvent.findFirst({
      where: { userId, source: "QUIZ_CORRECT", refId: input.questionKey },
      select: { id: true },
    }),
    db.lessonCompletion.findUnique({
      where: { userId_lessonSlug: { userId, lessonSlug: input.slug } },
      select: { userId: true },
    }),
  ]);
  const firstEver = !priorAward && !completion;
  const amount = quizXp({ firstEver });
  const res = await awardXp({
    userId,
    source: "QUIZ_CORRECT",
    amount,
    refId: input.questionKey,
    dedupeKey: dedupe.quizCorrect(userId, input.questionKey, now),
    now,
  });
  // A same-day replay dedupes to awarded:false → the client already saw the tick.
  if (!res.awarded) return { ok: true, correct: true, xp: 0, locked: true, levelUp: null };
  return { ok: true, correct: true, xp: amount, levelUp: res.levelUp };
}

export type LessonCompleteResult =
  | { ok: false; incomplete?: true }
  | { ok: true; xp: number; levelUp: LevelUp; newBadges: string[] };

// Record a lesson completion (design §5): the daily practice XP +, the first time,
// the durable milestone that drives the cluster/library patch cascade. The server
// refuses while any question is unattempted — it never trusts a client claim.
export async function recordLessonComplete(
  input: { slug: string },
  userId: string,
  now: Date,
): Promise<LessonCompleteResult> {
  const lesson = await db.miniLesson.findFirst({
    where: { slug: input.slug, published: true, accessTier: "PUBLIC" },
    select: { contentBlocks: true },
  });
  if (!lesson) return { ok: false };

  const keys = quizQuestions(lesson.contentBlocks).map((q) =>
    questionKey(input.slug, q),
  );
  const day = academyDate(now);

  // Gate: every question attempted TODAY (a correct award today OR a lock today).
  // Zero-question lessons complete on call — a dead path (all 69 carry ≥1 quiz)
  // but the guard stays.
  if (keys.length > 0) {
    const [awardedToday, lockedToday] = await Promise.all([
      db.xpEvent.findMany({
        where: { userId, source: "QUIZ_CORRECT", refId: { in: keys }, earnedOn: day },
        select: { refId: true },
      }),
      db.quizLock.findMany({
        where: { userId, questionKey: { in: keys }, lockedOn: day },
        select: { questionKey: true },
      }),
    ]);
    const attempted = new Set<string>();
    for (const e of awardedToday) if (e.refId) attempted.add(e.refId);
    for (const l of lockedToday) attempted.add(l.questionKey);
    if (!keys.every((k) => attempted.has(k))) return { ok: false, incomplete: true };
  }

  // firstEver keys off the durable LessonCompletion row (survives an admin reset),
  // NOT prior events — so a reset never re-inflates the completion at full rate.
  const priorCompletion = await db.lessonCompletion.findUnique({
    where: { userId_lessonSlug: { userId, lessonSlug: input.slug } },
    select: { userId: true },
  });
  const firstEver = !priorCompletion;
  const amount = lessonXp(readingMinutes(lesson.contentBlocks), { firstEver });
  const res = await awardXp({
    userId,
    source: "LESSON_COMPLETE",
    amount,
    refId: input.slug,
    dedupeKey: dedupe.lessonComplete(userId, input.slug, now),
    now,
  });

  let xp = res.awarded ? amount : 0;
  let levelUp: LevelUp = res.awarded ? res.levelUp : null;
  const newBadges: string[] = [];

  // Repop day (already completed once): no new milestone, no cascade.
  if (!firstEver) return { ok: true, xp, levelUp, newBadges };

  // First-ever completion: write the durable row, then run the patch cascade.
  try {
    await db.lessonCompletion.create({ data: { userId, lessonSlug: input.slug } });
  } catch (e) {
    // concurrent double-fire of a first completion → the other call owns the cascade
    if (isUniqueViolation(e)) return { ok: true, xp, levelUp, newBadges };
    throw e;
  }

  // First Flight — the very first lesson this user ever completed (cold-start win).
  const completionCount = await db.lessonCompletion.count({ where: { userId } });
  if (completionCount === 1 && (await earnBadge(userId, "skill:first-flight"))) {
    newBadges.push("skill:first-flight");
  }

  // Cluster + library milestones against the CURRENT published content set.
  const [completedRows, publishedRows] = await Promise.all([
    db.lessonCompletion.findMany({ where: { userId }, select: { lessonSlug: true } }),
    db.miniLesson.findMany({
      where: { published: true, accessTier: "PUBLIC" },
      select: { slug: true, cluster: true },
    }),
  ]);
  const completedSlugs = new Set(completedRows.map((r) => r.lessonSlug));
  const publishedByCluster = new Map<string, string[]>();
  for (const r of publishedRows) {
    const key = clusterByKey(r.cluster)?.key;
    if (!key) continue; // null/unknown cluster earns no patch (all 69 are clustered)
    const list = publishedByCluster.get(key) ?? [];
    list.push(r.slug);
    publishedByCluster.set(key, list);
  }
  const asOfLessonCount = publishedRows.length;
  const { clusterKeys, libraryComplete } = milestonesFor(
    completedSlugs,
    publishedByCluster,
  );

  for (const key of clusterKeys) {
    const award = await awardXp({
      userId,
      source: "CLUSTER_COMPLETE",
      amount: CLUSTER_XP,
      refId: key,
      dedupeKey: dedupe.clusterComplete(userId, key),
      now,
    });
    if (award.awarded) {
      xp += CLUSTER_XP;
      if (award.levelUp) levelUp = award.levelUp;
    }
    if (await earnBadge(userId, `cluster:${key}`, { asOfLessonCount })) {
      newBadges.push(`cluster:${key}`);
    }
  }

  if (libraryComplete) {
    const award = await awardXp({
      userId,
      source: "LIBRARY_COMPLETE",
      amount: LIBRARY_XP,
      refId: "all-library",
      dedupeKey: dedupe.libraryComplete(userId),
      now,
    });
    if (award.awarded) {
      xp += LIBRARY_XP;
      if (award.levelUp) levelUp = award.levelUp;
    }
    if (await earnBadge(userId, "wings:all-library", { asOfLessonCount })) {
      newBadges.push("wings:all-library");
    }
  }

  return { ok: true, xp, levelUp, newBadges };
}
