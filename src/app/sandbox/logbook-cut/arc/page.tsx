// SANDBOX - round three: E, with the lesson at the front. DEV ONLY.
//
// THE QUESTIONS ARE REAL, parsed out of a published Fundamentals lesson's own
// contentBlocks, and the component answering them is the real `QuizBlock`. The
// page picks the first lesson that actually carries enough of them rather than
// naming one, so a re-authored lesson does not quietly leave the film with two
// questions and a wrong total.
//
// LIBRARY QUIZ QUESTIONS, NEVER EXAM ONES. A mini-lesson's quiz already sits on
// a public page - anyone reading the lesson sees it - so putting one on screen
// shows the free thing off. Exam banks are the opposite: their answer keys gate
// the /verify certificates. Nothing here reads an Exam.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import { ARC, ARC_MAX_Q, QUIZ_XP, READ_XP, XP_AFTER, arcSheet, num } from "../beats";

type Params = Promise<{ t?: string }>;

export default function LogbookArcSandbox({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; round three
      </p>
      <h1 className="title-section mt-3">The lesson, then the morph</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        E from 2.0 on, unchanged: the rail scaling, shedding its text column,
        ending as a dimmed halo behind the patch. What is new is bar one, which
        stops establishing and starts <em>causing</em> &mdash; the real{" "}
        <code>QuizBlock</code>, this lesson&rsquo;s real questions, answered
        correctly on the half-beats, and the rail beside it counting what each
        pick pays.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The film clicks the options rather than posing with a fork of the
        component. <code>QuizBlock</code> only reaches a server when it is handed
        a stage <code>context</code> or the <code>logbook</code> XP wiring; with
        neither it is a pure self-check, which is the editor-preview case its own
        header describes. Not one pick here touches an action.
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
          round two
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

  // The first lesson that actually carries enough questions, not a named one.
  let lesson: FilmLesson | null = null;
  let questions: FilmQuestion[] = [];
  for (const r of rows) {
    const qs = parseGuideBlocks(r.contentBlocks)
      .blocks.filter((b) => b.type === "quiz")
      .flatMap((b) => (b.type === "quiz" ? b.questions : []))
      .filter(
        (q): q is FilmQuestion =>
          Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number",
      );
    if (qs.length >= questions.length) {
      questions = qs.slice(0, ARC_MAX_Q);
      lesson = { slug: r.slug, title: r.title, clusterLabel: "Fundamentals" };
    }
    if (questions.length >= ARC_MAX_Q) break;
  }

  if (!lesson || questions.length === 0) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database carries a parseable
        quiz block, so there is nothing real to answer and the arc is not worth
        looking at yet. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }

  const sheet = arcSheet(questions.length);

  return (
    <>
      <section className="mt-8 border-t border-panel-border/60 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; the arithmetic bar one performs
        </p>
        <ul className="mt-3 grid gap-1.5 font-mono text-xs text-muted sm:grid-cols-2">
          <li>
            <span className="text-text">
              {questions.length} &times; {QUIZ_XP} = {sheet.quiz} XP
            </span>{" "}
            &mdash; the real questions in <code>{lesson.slug}</code>
          </li>
          <li>
            <span className="text-text">+{READ_XP} XP</span> &mdash; the read award,
            landing on 2.0
          </li>
          <li>
            <span className="text-text">
              {num(sheet.before)} &rarr; {num(XP_AFTER)}
            </span>{" "}
            &mdash; derived backwards off the FL6 floor, so the last award and the
            crossing are one frame
          </li>
          <li>
            <span className="text-text">
              {sheet.ticks.map((x) => x.toFixed(2)).join(" / ")}
            </span>{" "}
            &mdash; the picks, on bar one&rsquo;s half-beats
          </li>
          <li>
            <span className="text-text">
              {fundDone} / {total}
            </span>{" "}
            &mdash; lessons read, queried
          </li>
          <li>
            <span className="text-text">
              {sheet.beats.map((b) => b.word).join(" / ")}
            </span>{" "}
            &mdash; the four downbeats
          </li>
        </ul>
        <p className="mt-3 max-w-3xl font-serif text-sm text-muted">
          Your arc was lessons &rarr; XP &rarr; XP &rarr; patches, so the words
          moved up a beat: 2.0 is what the lesson paid, 4.0 is the rank it bought,
          6.0 is the wall of six cluster patches with all six still locked, and 8.0
          is the one that lights up. Bar one is no longer empty, which is the
          change you asked for and also the reason the film now has a cause in it.
        </p>
      </section>

      <ul className="mt-6 border-t border-panel-border/60">
        <li className="border-b border-panel-border/60 py-6">
          <p className="title-card">{ARC.label}</p>
          <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{ARC.note}</p>
          <div className="mt-3">
            <LogbookLive
              arrangement="arc"
              lesson={lesson}
              libraryTotal={total}
              libraryDone={fundDone}
              questions={questions}
              fixedT={fixedT}
            />
          </div>
        </li>
      </ul>

      <p className="mt-8 font-mono text-xs text-muted">delete this route before the PR</p>
    </>
  );
}
