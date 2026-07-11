// Read-side loaders for the Logbook (design §9.2/§9.5, §14 "one batched query").
// The award path (lesson-awards / feedback) writes; these read. All user-state
// reads are per-user and indexed; the lesson metadata is one MiniLesson read the
// page shares across getLibraryProgress + getLogbook (never 69 lookups).
import { db } from "@/lib/db";
import { LIBRARY_CLUSTERS, clusterByKey } from "@/lib/library/clusters";
import { readingMinutes } from "@/lib/library/reading-time";
import { quizQuestions } from "@/lib/logbook/lesson-content";
import { academyDate, levelFor, quizXp, lessonXp } from "@/lib/logbook/economy";

// The static content facts a progress calc needs, derived once from contentBlocks.
export type LessonMeta = {
  slug: string;
  cluster: string | null;
  questionCount: number;
  readingMinutes: number;
};

/** Every published, PUBLIC lesson's progress-relevant metadata (one DB read). The
 * page loads this once and passes it to both getLibraryProgress and getLogbook. */
export async function loadLessonMeta(): Promise<LessonMeta[]> {
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    select: { slug: true, cluster: true, contentBlocks: true },
  });
  return rows.map((r) => ({
    slug: r.slug,
    cluster: r.cluster,
    questionCount: quizQuestions(r.contentBlocks).length,
    readingMinutes: readingMinutes(r.contentBlocks),
  }));
}

export type LibraryProgress = {
  byLesson: Map<
    string,
    { earnedToday: number; maxToday: number; completed: boolean }
  >;
  byCluster: Map<string, { done: number; total: number }>;
};

// Per-lesson today's earned / today's max + completion, plus per-cluster done/total.
// maxToday FOLLOWS the completion state so earned never exceeds max: a not-yet-done
// lesson maxes at the FULL rate (Qs×5 + readMin×3); a completed one at REPOP
// (Qs×2 + readMin×1). Two user-scoped reads (completions + today's events).
export async function getLibraryProgress(
  userId: string,
  lessons: LessonMeta[],
  now: Date,
): Promise<LibraryProgress> {
  const today = academyDate(now);
  const [completions, events] = await Promise.all([
    db.lessonCompletion.findMany({ where: { userId }, select: { lessonSlug: true } }),
    db.xpEvent.findMany({
      where: {
        userId,
        source: { in: ["QUIZ_CORRECT", "LESSON_COMPLETE"] },
        earnedOn: today,
      },
      select: { source: true, refId: true, amount: true },
    }),
  ]);
  const completed = new Set(completions.map((c) => c.lessonSlug));

  // Attribute each of today's events to its lesson: LESSON_COMPLETE.refId is the
  // slug; QUIZ_CORRECT.refId is `slug#questionKey` (slugs never contain '#').
  const earnedBySlug = new Map<string, number>();
  for (const e of events) {
    if (!e.refId) continue;
    const slug = e.source === "LESSON_COMPLETE" ? e.refId : e.refId.split("#")[0];
    earnedBySlug.set(slug, (earnedBySlug.get(slug) ?? 0) + e.amount);
  }

  const byLesson = new Map<
    string,
    { earnedToday: number; maxToday: number; completed: boolean }
  >();
  const byCluster = new Map<string, { done: number; total: number }>();
  for (const lesson of lessons) {
    const isDone = completed.has(lesson.slug);
    const firstEver = !isDone;
    const maxToday =
      lesson.questionCount * quizXp({ firstEver }) +
      lessonXp(lesson.readingMinutes, { firstEver });
    const earnedToday = Math.min(earnedBySlug.get(lesson.slug) ?? 0, maxToday);
    byLesson.set(lesson.slug, { earnedToday, maxToday, completed: isDone });

    const key = clusterByKey(lesson.cluster)?.key;
    if (!key) continue;
    const c = byCluster.get(key) ?? { done: 0, total: 0 };
    c.total += 1;
    if (isDone) c.done += 1;
    byCluster.set(key, c);
  }
  return { byLesson, byCluster };
}

export type QuestionState = "earned" | "locked" | "open";

// The lesson-page slice (Task 10): per-question state for TODAY + completion.
// One read of today's QUIZ_CORRECT events + today's locks, filtered to the keys.
export async function getLessonState(
  userId: string,
  slug: string,
  questionKeys: string[],
  now: Date,
): Promise<{ perQuestion: Record<string, QuestionState>; completed: boolean }> {
  const today = academyDate(now);
  const [earned, locks, completion] = await Promise.all([
    db.xpEvent.findMany({
      where: { userId, source: "QUIZ_CORRECT", refId: { in: questionKeys }, earnedOn: today },
      select: { refId: true },
    }),
    db.quizLock.findMany({
      where: { userId, questionKey: { in: questionKeys }, lockedOn: today },
      select: { questionKey: true },
    }),
    db.lessonCompletion.findUnique({
      where: { userId_lessonSlug: { userId, lessonSlug: slug } },
      select: { userId: true },
    }),
  ]);
  const earnedSet = new Set(earned.map((e) => e.refId).filter((v): v is string => !!v));
  const lockedSet = new Set(locks.map((l) => l.questionKey));
  const perQuestion: Record<string, QuestionState> = {};
  for (const key of questionKeys) {
    perQuestion[key] = earnedSet.has(key)
      ? "earned"
      : lockedSet.has(key)
        ? "locked"
        : "open";
  }
  return { perQuestion, completed: completion != null };
}

// The course-quiz analog of getLessonState (design Phase 2): per-question state
// for TODAY from STAGE_QUIZ_CORRECT events + locks. No completion concept — a
// guide card has no LessonCompletion; the stage gate is separate.
export async function getStageQuestionState(
  userId: string,
  questionKeys: string[],
  now: Date,
): Promise<Record<string, QuestionState>> {
  const today = academyDate(now);
  const [earned, locks] = await Promise.all([
    db.xpEvent.findMany({
      where: {
        userId,
        source: "STAGE_QUIZ_CORRECT",
        refId: { in: questionKeys },
        earnedOn: today,
      },
      select: { refId: true },
    }),
    db.quizLock.findMany({
      where: { userId, questionKey: { in: questionKeys }, lockedOn: today },
      select: { questionKey: true },
    }),
  ]);
  const earnedSet = new Set(earned.map((e) => e.refId).filter((v): v is string => !!v));
  const lockedSet = new Set(locks.map((l) => l.questionKey));
  const perQuestion: Record<string, QuestionState> = {};
  for (const key of questionKeys) {
    perQuestion[key] = earnedSet.has(key)
      ? "earned"
      : lockedSet.has(key)
        ? "locked"
        : "open";
  }
  return perQuestion;
}

export type LogbookView = {
  xpTotal: number;
  level: number;
  title: string;
  next: { level: number; minXp: number; title: string } | null;
  currentThrough: Date | null;
  isCurrent: boolean;
  clusters: { key: string; label: string; done: number; total: number }[];
  badges: { badgeKey: string; earnedAt: Date; meta: unknown }[];
  recent: {
    source: string;
    amount: number;
    refId: string | null;
    earnedOn: Date;
    createdAt: Date;
  }[];
};

// The full Logbook page payload (design §9.5). Level/title/next DERIVE from the XP
// total (the ledger is truth), not the cached column. isCurrent compares today's
// academy date against the stay-current window end.
export async function getLogbook(
  userId: string,
  lessons: LessonMeta[],
  now: Date,
): Promise<LogbookView> {
  const [user, completions, badges, recent] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xpTotal: true, currentThrough: true },
    }),
    db.lessonCompletion.findMany({ where: { userId }, select: { lessonSlug: true } }),
    db.badgeEarned.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      select: { badgeKey: true, earnedAt: true, meta: true },
    }),
    db.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { source: true, amount: true, refId: true, earnedOn: true, createdAt: true },
    }),
  ]);

  const completed = new Set(completions.map((c) => c.lessonSlug));
  const totals = new Map<string, { done: number; total: number }>();
  for (const lesson of lessons) {
    const key = clusterByKey(lesson.cluster)?.key;
    if (!key) continue;
    const c = totals.get(key) ?? { done: 0, total: 0 };
    c.total += 1;
    if (completed.has(lesson.slug)) c.done += 1;
    totals.set(key, c);
  }
  const clusters = LIBRARY_CLUSTERS.map((c) => ({
    key: c.key,
    label: c.label,
    done: totals.get(c.key)?.done ?? 0,
    total: totals.get(c.key)?.total ?? 0,
  }));

  const lv = levelFor(user.xpTotal);
  const isCurrent =
    user.currentThrough != null &&
    academyDate(now).getTime() <= user.currentThrough.getTime();

  return {
    xpTotal: user.xpTotal,
    level: lv.level,
    title: lv.title,
    next: lv.next
      ? { level: lv.next.level, minXp: lv.next.minXp, title: lv.next.title }
      : null,
    currentThrough: user.currentThrough,
    isCurrent,
    clusters,
    badges,
    recent,
  };
}
