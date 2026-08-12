// SANDBOX - ten whole cuts, side by side. DEV ONLY.
//
// This replaces the axis bench as the place a decision gets made. The bench is
// still there and still useful for asking ONE question, but a film is not the
// sum of ten independent answers, and picking a flow, then a composition, then
// a word entrance produced exactly the disjointed result it sounds like.
//
// `?only=<id>` isolates one at full width. `?t=` freezes every stage.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import { CANDIDATES, candidateById } from "../candidates";
import { QUIET_BEATS } from "../beats";

type Params = Promise<{ t?: string; only?: string }>;

export default function RoundPage({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; ten cuts
      </p>
      <h1 className="title-section mt-3">
        {QUIET_BEATS.map((b) => b.word).join(" -> ")}, ten ways
      </h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Whole cuts, judged whole. The bench asked ten questions separately, and a
        film is not the sum of ten independent answers &mdash; the plating is the
        right flip beside a still frame and the wrong one beside a whip pan, and
        a tenth-of-a-second handover is right when nothing else moves and
        unreadable under a travelling layout. Each of these has a thesis and
        loses or wins on it.
      </p>

      <section className="mt-6 border-y border-panel-border/60 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; two things the research changed, rather than confirmed
        </p>
        <p className="mt-2 max-w-3xl font-serif text-sm text-text">
          <b className="text-title">The picture lands before the bed does.</b> A
          visual hit reads as simultaneous with a beat when it arrives two to
          four frames early and never a frame late &mdash; 0.067s to 0.133s at
          the 30fps this renders at. Every round so far landed exactly on the
          downbeat, which is measurably correct and feels late. All ten carry a
          0.1s pre-roll now.
        </p>
        <p className="mt-2 max-w-3xl font-serif text-sm text-text">
          <b className="text-title">The bed already decided the shape, and no
          round had honoured it.</b> <code>academy-bed.py</code> weighs its four
          landings 0.55, 0.78, <b className="text-title">0.70</b>, 1.00 &mdash;
          the dip at the third is deliberate, and it escalates there by changing
          colour to a dry mechanical click rather than by getting louder. A
          picture that escalates only by getting bigger contradicts its own
          soundtrack on beat three. Candidate 03 draws that curve exactly.
        </p>
      </section>

      <Suspense fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Found once per dev-server process. The scan JSON-parses twelve lessons'
 *  contentBlocks, and the corpus does not move while the server is up. */
let CACHE: { lesson: FilmLesson; question: FilmQuestion } | null = null;

async function findQuestion() {
  if (CACHE) return CACHE;
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC", cluster: "fundamentals" },
    orderBy: { clusterOrdinal: "asc" },
    select: { slug: true, title: true, contentBlocks: true },
    take: 12,
  });
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
  if (!lesson || !question) return null;
  CACHE = { lesson, question };
  return CACHE;
}

async function Body({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const fixedT =
    sp.t !== undefined && Number.isFinite(Number(sp.t)) ? Number(sp.t) : undefined;
  const only = candidateById(sp.only);
  const shown = only ? [only] : CANDIDATES;

  const found = await findQuestion();
  if (!found) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database carries a parseable
        quiz block. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }

  return (
    <>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
        <Link prefetch={false} href="?"
          className={`font-mono text-[11px] uppercase tracking-[0.14em] ${only ? "text-muted hover:text-gold-light" : "text-command-gold"}`}>
          all ten
        </Link>
        {CANDIDATES.map((c) => (
          <Link prefetch={false} key={c.id} href={`?only=${c.id}`}
            className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
              only?.id === c.id ? "text-command-gold" : "text-muted hover:text-gold-light"
            }`}>
            {c.name}
          </Link>
        ))}
      </nav>

      <ul className="mt-4 border-t border-panel-border/60">
        {shown.map((c) => (
          <li key={c.id} className="border-b border-panel-border/60 py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="title-card">{c.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-3">
                {c.tuning.flow} &middot; {c.tuning.layout} &middot; {c.tuning.motionAll}{" "}
                &middot; {c.tuning.kinetic}
                {c.tuning.kineticPerBeat ? "*" : ""} / {c.tuning.kineticOut} &middot;{" "}
                {c.tuning.camera} &middot; plx {c.tuning.parallax} &middot; {c.tuning.jaunty}
              </p>
            </div>
            <p className="mt-1 max-w-3xl font-serif text-base text-title">{c.thesis}</p>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{c.note}</p>
            <div className="mt-3 border border-panel-border/50">
              <LogbookLive
                arrangement="quiet"
                lesson={found.lesson}
                libraryTotal={0}
                libraryDone={0}
                questions={[found.question]}
                tuning={c.tuning}
                fixedT={fixedT}
                w={only ? 880 : 720}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 font-mono text-xs text-muted">
        <Link prefetch={false} href="/sandbox/logbook-cut/bench"
          className="text-command-gold hover:text-gold-light">
          the axis bench
        </Link>{" "}
        is still there for asking one question &middot; <code>?only=</code>{" "}
        isolates &middot; <code>?t=</code> freezes &middot; delete this route
        before the PR
      </p>
    </>
  );
}
