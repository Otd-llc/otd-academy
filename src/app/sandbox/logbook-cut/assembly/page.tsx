// SANDBOX - the assembled cut, five ways to close the loop. DEV ONLY.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import { LogbookLive, type FilmLesson, type FilmQuestion } from "../LogbookLive";
import { ASSEMBLY } from "../assembly";

type Params = Promise<{ t?: string; only?: string }>;

export default function AssemblyPage({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; assembled
      </p>
      <h1 className="title-section mt-3">The cut, and the join nobody has seen</h1>

      <section className="mt-4 border-y border-panel-border/60 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; settled
        </p>
        <ul className="mt-2 max-w-3xl space-y-1 font-serif text-sm text-muted">
          <li>
            <b className="text-title">the long read</b> (27) &mdash; the quiz gets
            a 0.6s arrival, the slowest in the film, because it is the only part
            that has to be <em>read</em> rather than looked at. Breath flow, and
            the word tracks in over it.
          </li>
          <li>
            <b className="text-title">learn &rarr; gain</b> (02) &mdash; the quiz
            leaves left and the ring grows in. The film&rsquo;s one lateral move,
            spent on its one real scene change: a page handing over to an emblem.
          </li>
          <li>
            <b className="text-title">gain &rarr; rank</b> (08) &mdash; the ring
            irises out and the wheel irises in, so the wheel appears to come out
            of the middle of the ring it replaces. The only join that is a match
            rather than a cut.
          </li>
          <li>
            <b className="text-title">rank &rarr; patches</b> (14) &mdash; the
            wheel fades and the patch pushes down into place. The wheel is the
            bed&rsquo;s dip; the patch is its heaviest landing, and dropping in is
            the only arrival in the film with weight behind it.
          </li>
        </ul>
      </section>

      <p className="mt-4 max-w-3xl font-serif text-base text-text">
        <b className="text-title">Still open: patches &rarr; learn, the loop
        seam.</b> It is a real edit and nobody has ever seen it, because the
        patch&rsquo;s window ran to the last frame and the quiz&rsquo;s began on
        the first &mdash; so the clip cut hard from a gold badge to a question with
        nothing in between, once every ten seconds, forever. On a feed that seam
        is the most-watched frame in the film. All five below give the patch a
        real exit inside the clip rather than at its edge.
      </p>

      <Suspense fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

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
  const shown = sp.only ? ASSEMBLY.filter((a) => a.id === sp.only) : ASSEMBLY;
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
      <p className="mt-5 font-mono text-[11px] text-muted">
        the seam is at 10.0s / 0.0s &middot; <code>?t=9.85</code> catches the badge
        leaving, <code>?t=0.15</code> catches the question arriving
      </p>
      <ul className="mt-3">
        {shown.map((c) => (
          <li key={c.id} className="border-b border-panel-border/60 py-7">
            <p className="title-card">{c.name}</p>
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
                w={820}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
