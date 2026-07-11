// Admin: Logbook instrumentation (design §9.6). The first-class content-quality
// dashboard — three hairline tables, most-broken first: per-question fail rate
// (the "what to fix" list that feeds E-E-A-T depth), per-lesson completion vs
// attempters, and feedback by page + status. Admin-gated by middleware +
// requireAdmin. Read-only at v1 scale; the note flags rollup-if-hot per design.
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Logbook instrumentation",
  robots: { index: false, follow: false },
};

const lessonSlugOf = (key: string) => key.split("#")[0] ?? key;
const keySuffix = (key: string) => key.split("#")[1] ?? key;

export default async function LogbookInstrumentationPage() {
  await requireAdmin();

  const [quizEvents, locks, completionGroups, feedbackGroups, lessons] =
    await Promise.all([
      db.xpEvent.findMany({
        where: { source: "QUIZ_CORRECT" },
        select: { refId: true, userId: true },
      }),
      db.quizLock.findMany({ select: { questionKey: true, userId: true } }),
      db.lessonCompletion.groupBy({ by: ["lessonSlug"], _count: { _all: true } }),
      db.lessonFeedback.groupBy({
        by: ["pageRef", "status"],
        _count: { _all: true },
      }),
      db.miniLesson.findMany({
        where: { published: true, accessTier: "PUBLIC" },
        select: { slug: true, title: true },
      }),
    ]);

  const titleOf = new Map(lessons.map((l) => [l.slug, l.title]));

  // Per-question: correct-award count vs lock count → fail rate.
  const perQ = new Map<string, { correct: number; lock: number }>();
  const attempters = new Map<string, Set<string>>();
  const touch = (key: string, userId: string) => {
    const slug = lessonSlugOf(key);
    if (!attempters.has(slug)) attempters.set(slug, new Set());
    attempters.get(slug)!.add(userId);
  };
  for (const e of quizEvents) {
    if (!e.refId) continue;
    const cur = perQ.get(e.refId) ?? { correct: 0, lock: 0 };
    cur.correct += 1;
    perQ.set(e.refId, cur);
    touch(e.refId, e.userId);
  }
  for (const l of locks) {
    const cur = perQ.get(l.questionKey) ?? { correct: 0, lock: 0 };
    cur.lock += 1;
    perQ.set(l.questionKey, cur);
    touch(l.questionKey, l.userId);
  }
  const questionRows = [...perQ.entries()]
    .map(([key, v]) => {
      const attempts = v.correct + v.lock;
      return { key, ...v, attempts, failRate: attempts ? v.lock / attempts : 0 };
    })
    .sort((a, b) => b.failRate - a.failRate || b.attempts - a.attempts)
    .slice(0, 50);

  // Per-lesson: completions vs distinct attempters.
  const completionsOf = new Map(
    completionGroups.map((g) => [g.lessonSlug, g._count._all]),
  );
  const lessonSlugs = new Set<string>([
    ...completionsOf.keys(),
    ...attempters.keys(),
  ]);
  const lessonRows = [...lessonSlugs]
    .map((slug) => ({
      slug,
      completions: completionsOf.get(slug) ?? 0,
      attempters: attempters.get(slug)?.size ?? 0,
    }))
    .sort((a, b) => b.attempters - a.attempters);

  // Feedback by page + status.
  const fbByPage = new Map<
    string,
    { NEW: number; USEFUL: number; DISMISSED: number }
  >();
  for (const g of feedbackGroups) {
    const row = fbByPage.get(g.pageRef) ?? { NEW: 0, USEFUL: 0, DISMISSED: 0 };
    row[g.status] += g._count._all;
    fbByPage.set(g.pageRef, row);
  }
  const feedbackRows = [...fbByPage.entries()]
    .map(([pageRef, v]) => ({ pageRef, ...v, total: v.NEW + v.USEFUL + v.DISMISSED }))
    .sort((a, b) => b.NEW - a.NEW || b.total - a.total);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR"
        title="Logbook instrumentation"
        lead="What to fix, most-broken first: quiz fail rates, lesson completion, and feedback."
      />

      {/* Per-question fail rate */}
      <section className="mt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Question fail rate
        </p>
        {questionRows.length === 0 ? (
          <p className="mt-3 font-serif text-sm text-muted">No quiz activity yet.</p>
        ) : (
          <ul className="mt-2">
            {questionRows.map((r) => (
              <li
                key={r.key}
                className="flex items-baseline justify-between gap-4 border-b border-panel-border/50 py-2.5"
              >
                <span className="min-w-0 truncate font-serif text-sm text-text">
                  {titleOf.get(lessonSlugOf(r.key)) ?? lessonSlugOf(r.key)}{" "}
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-3">
                    {keySuffix(r.key)}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  <span>
                    ok <span className="font-numeral tabular-nums text-status-green">{r.correct}</span>
                  </span>
                  <span>
                    lock <span className="font-numeral tabular-nums text-command-gold">{r.lock}</span>
                  </span>
                  <span className="w-12 text-right">
                    <span className="font-numeral tabular-nums text-text">
                      {Math.round(r.failRate * 100)}
                    </span>
                    %
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-gray-3">
          Top 50 by fail rate. Ledger scan; rollup if hot.
        </p>
      </section>

      {/* Per-lesson completion */}
      <section className="mt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Lesson completion
        </p>
        {lessonRows.length === 0 ? (
          <p className="mt-3 font-serif text-sm text-muted">No lesson activity yet.</p>
        ) : (
          <ul className="mt-2">
            {lessonRows.map((r) => (
              <li
                key={r.slug}
                className="flex items-baseline justify-between gap-4 border-b border-panel-border/50 py-2.5"
              >
                <Link
                  href={`/library/${r.slug}`}
                  className="min-w-0 truncate font-serif text-sm text-text transition-colors hover:text-command-gold"
                >
                  {titleOf.get(r.slug) ?? r.slug}
                </Link>
                <span className="flex shrink-0 items-baseline gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  <span>
                    done <span className="font-numeral tabular-nums text-command-gold">{r.completions}</span>
                  </span>
                  <span>
                    tried <span className="font-numeral tabular-nums text-text">{r.attempters}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Feedback by page */}
      <section className="mt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Feedback by page
        </p>
        {feedbackRows.length === 0 ? (
          <p className="mt-3 font-serif text-sm text-muted">No feedback yet.</p>
        ) : (
          <ul className="mt-2">
            {feedbackRows.map((r) => (
              <li
                key={r.pageRef}
                className="flex items-baseline justify-between gap-4 border-b border-panel-border/50 py-2.5"
              >
                <span className="min-w-0 truncate font-mono text-[11px] tracking-[0.04em] text-text">
                  {r.pageRef}
                </span>
                <span className="flex shrink-0 items-baseline gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  <span>
                    new <span className="font-numeral tabular-nums text-command-gold">{r.NEW}</span>
                  </span>
                  <span>
                    useful <span className="font-numeral tabular-nums text-status-green">{r.USEFUL}</span>
                  </span>
                  <span>
                    dismissed <span className="font-numeral tabular-nums text-gray-3">{r.DISMISSED}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
