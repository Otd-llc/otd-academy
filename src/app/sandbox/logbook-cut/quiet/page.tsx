// SANDBOX - round four: one thing at a time. DEV ONLY.
//
// READ, GAIN, RANK, PATCHES. One subject per beat, four words, no second line
// under any of them, and no running index either - that was one more thing on
// screen.
//
// The question is a real one, parsed out of a published Fundamentals lesson,
// and the film clicks the real option. One click, five XP, and that five is
// what takes the total to the FL6 floor: the starting number is derived
// backwards by exactly one quiz award, so the beat that follows is earned
// rather than staged.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import {
  AFTER,
  BEFORE,
  QUIET,
  QUIET_BEATS,
  QUIET_BEFORE,
  QUIET_CLICK,
  QUIZ_XP,
  XP_AFTER,
  num,
} from "../beats";

type Params = Promise<{ t?: string }>;

export default function LogbookQuietSandbox({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; round four
      </p>
      <h1 className="title-section mt-3">
        {QUIET_BEATS.map((b) => b.word).join(" → ")}
      </h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        One subject per beat. Nothing shares a frame, nothing has a line under it,
        and the running index is gone. The quiz answers itself once and dissolves
        rightward under READ; the ring draws itself and the rank changes under
        GAIN; the ladder spins up, overshoots and settles under RANK; a locked
        patch waits, breathing, and flips to gold under PATCHES.
      </p>

      <p className="mt-4 font-mono text-xs text-muted">
        <Link href="/sandbox/logbook-cut" className="text-command-gold hover:text-gold-light">
          round one
        </Link>{" "}
        &middot;{" "}
        <Link
          href="/sandbox/logbook-cut/combo"
          className="text-command-gold hover:text-gold-light"
        >
          two
        </Link>{" "}
        &middot;{" "}
        <Link
          href="/sandbox/logbook-cut/arc"
          className="text-command-gold hover:text-gold-light"
        >
          three
        </Link>{" "}
        &middot; <code>?t=</code> freezes the clock
      </p>

      <Suspense
        fallback={<p className="mt-8 font-mono text-xs text-muted">reading the lesson&hellip;</p>}
      >
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Body({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const fixedT =
    sp.t !== undefined && Number.isFinite(Number(sp.t)) ? Number(sp.t) : undefined;

  const where = { published: true, accessTier: "PUBLIC" as const };
  const [total, fundDone, rows] = await Promise.all([
    db.miniLesson.count({ where }),
    db.miniLesson.count({ where: { ...where, cluster: "fundamentals" } }),
    db.miniLesson.findMany({
      where: { ...where, cluster: "fundamentals" },
      orderBy: { clusterOrdinal: "asc" },
      select: { slug: true, title: true, contentBlocks: true },
      take: 12,
    }),
  ]);

  // The SHORTEST real question with the fewest options: one click has to read at
  // a glance, and a four-option question with a two-line stem does not.
  let lesson: FilmLesson | null = null;
  let question: FilmQuestion | null = null;
  for (const r of rows) {
    const qs = parseGuideBlocks(r.contentBlocks)
      .blocks.filter((b) => b.type === "quiz")
      .flatMap((b) => (b.type === "quiz" ? b.questions : []))
      .filter(
        (q): q is FilmQuestion =>
          Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number",
      );
    for (const q of qs) {
      const worse =
        question &&
        q.options.length * 100 + q.q.length >=
          question.options.length * 100 + question.q.length;
      if (worse) continue;
      question = q;
      lesson = { slug: r.slug, title: r.title, clusterLabel: "Fundamentals" };
    }
  }

  if (!lesson || !question) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database carries a parseable
        quiz block. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }

  return (
    <>
      <section className="mt-8 border-t border-panel-border/60 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; what is on screen, and when
        </p>
        <ul className="mt-3 grid gap-1.5 font-mono text-xs text-muted sm:grid-cols-2">
          <li>
            <span className="text-text">{QUIET_CLICK.toFixed(1)}s</span> &mdash; the one
            click, on option {String.fromCharCode(65 + question.answer)} of{" "}
            <code>{lesson.slug}</code>
          </li>
          <li>
            <span className="text-text">
              {num(QUIET_BEFORE)} + {QUIZ_XP} = {num(XP_AFTER)}
            </span>{" "}
            &mdash; one award, landing exactly on the FL{AFTER.level} floor
          </li>
          <li>
            <span className="text-text">
              FL{BEFORE.level} &rarr; FL{AFTER.level}
            </span>{" "}
            &mdash; the change the ring hands over at 5.4
          </li>
          <li>
            <span className="text-text">2.4 &rarr; 3.6s</span> &mdash; the quiz
            dissolving rightward into the ring
          </li>
          <li>
            <span className="text-text">8.5s</span> &mdash; locked to gold, half a bar
            after the word
          </li>
          <li>
            <span className="text-text">
              {fundDone} / {total}
            </span>{" "}
            &mdash; lessons read, queried (not shown; kept honest)
          </li>
        </ul>
      </section>

      <ul className="mt-6 border-t border-panel-border/60">
        <li className="border-b border-panel-border/60 py-6">
          <p className="title-card">{QUIET.label}</p>
          <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{QUIET.note}</p>
          <div className="mt-3">
            <LogbookLive
              arrangement="quiet"
              lesson={lesson}
              libraryTotal={total}
              libraryDone={fundDone}
              questions={[question]}
              fixedT={fixedT}
            />
          </div>
        </li>
      </ul>

      <p className="mt-8 font-mono text-xs text-muted">delete this route before the PR</p>
    </>
  );
}
