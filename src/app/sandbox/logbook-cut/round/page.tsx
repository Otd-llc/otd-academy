// SANDBOX - thirty cuts, one list, scroll and pick. DEV ONLY.
//
// No tabs, no axes, no "one thing each". Every earlier round asked a question;
// this one only offers answers. `?t=` freezes every stage on a frame, and
// `?only=<id>` isolates one for a screenshot - neither is in the UI, because
// the UI is the list.
//
// Off-screen stages do not tick (IntersectionObserver in useSceneClock), which
// is what makes thirty live ten-second loops on one page affordable.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import { MIXES } from "../mixes";
import { QUIET_BEATS } from "../beats";

type Params = Promise<{ t?: string; only?: string }>;

export default function RoundPage({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; thirty cuts
      </p>
      <h1 className="title-section mt-3">
        {QUIET_BEATS.map((b) => b.word).join(" -> ")}, thirty ways
      </h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Scroll. Each one is a whole ten seconds and they differ in how much of
        the toolbox they spend as much as in which parts of it &mdash; one has no
        slides at all, one has eight, one is nothing but wipes, one is four
        different Ken Burns moves. The recipe under each name is{" "}
        <em>counted off the cut itself</em> rather than typed beside it, so it
        cannot drift from what you are watching.
      </p>

      <section className="mt-5 border-y border-panel-border/60 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; settled, and now fixed across all thirty
        </p>
        <ul className="mt-2 max-w-3xl space-y-1 font-serif text-sm text-muted">
          <li>
            <b className="text-title">The flip is plating</b>, from the flip
            round. It is no longer varied.
          </li>
          <li>
            <b className="text-title">Everything is fit to the frame.</b> Each
            part declares its natural size and the share of the frame it may
            occupy, and the scale is derived &mdash; so the rank wheel is now sized
            for legibility rather than shrunk by the same factor as a badge that
            reads at any size. Its rows, wings and type all grew at source rather
            than being scaled up, because 10px mono blown up by a transform is
            still 10px mono.
          </li>
          <li>
            <b className="text-title">The read area is on the grid.</b> The click
            lands on beat three or four of bar one and the XP tick clears before
            the bar line, so the downbeat belongs to READ. It used to hold to
            2.6s with its float still running as the word landed, which is what
            made that section feel disjointed.
          </li>
          <li>
            <b className="text-title">The picture runs three frames ahead of the
            bed</b>, which is where a visual hit reads as simultaneous.
          </li>
        </ul>
        <p className="mt-3 max-w-3xl font-serif text-sm text-muted">
          The second line under each name is the three handovers &mdash;
          read&rarr;gain, gain&rarr;rank, rank&rarr;patch. They are three separate
          edits and there is no reason they should be the same edit.
        </p>
      </section>

      <Suspense fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Found once per dev-server process; the corpus does not move while it is up. */
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
  const shown = sp.only ? MIXES.filter((m) => m.id === sp.only) : MIXES;

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
    <ul className="mt-2">
      {shown.map((c) => (
        <li key={c.id} className="border-b border-panel-border/60 py-7">
          <p className="title-card">{c.name}</p>
          <p className="mt-1 max-w-3xl font-serif text-base text-title">{c.thesis}</p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-gray-3">
            {c.note}
          </p>
          <div className="mt-3 border border-panel-border/50">
            <LogbookLive
              arrangement="quiet"
              lesson={found.lesson}
              libraryTotal={0}
              libraryDone={0}
              questions={[found.question]}
              tuning={c.tuning}
              fixedT={fixedT}
              w={820}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
