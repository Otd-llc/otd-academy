// SANDBOX - everything settled, in every shape, before anything is encoded.
// DEV ONLY.
//
// The last look before a render: the picked cut, the picked bed, and the four
// frames we deliver into, on one clock. ASCII only.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { FilmLesson, FilmQuestion } from "../LogbookLive";
import { FormatGrid } from "./FormatGrid";

export default function FormatsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; assembled, in every shape
      </p>
      <h1 className="title-section mt-3">Before the encode</h1>

      <section className="mt-4 border-y border-panel-border/60 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; settled
        </p>
        <ul className="mt-2 max-w-3xl space-y-1 font-serif text-sm text-muted">
          <li>
            <b className="text-title">Cut</b> &mdash; <code>seam-drop</code>: long
            read, push-l/grow, iris/iris, fade/push-d, swing-out into drop-in at
            the seam. Plating flip. Pre-roll 0.1s, so every word lands three
            frames before its hit.
          </li>
          <li>
            <b className="text-title">Quiz</b> &mdash; the picked selection and
            verdict animations, now shipped in <code>globals.css</code> rather
            than living only in a sandbox that gets deleted.
          </li>
          <li>
            <b className="text-title">Bed</b> &mdash; <code>keel / filter opens</code>,
            mixolydian. An idling machine an octave down, eighths, and a lowpass
            that travels 500 Hz to 2.6 kHz across the ten seconds &mdash; so the
            piece escalates by brightness and never by volume, which is the one
            build that leaves the weight curve completely alone. Mastered to
            &minus;16.94 LUFS, linear, LRA 3.0 against a ceiling of 9.
          </li>
        </ul>
      </section>

      <p className="mt-4 max-w-3xl font-serif text-base text-text">
        <b className="text-title">These are re-frames, not crops.</b> Every
        subject is sized by <code>fitScale(id, w, h)</code> and the type layer
        places its words in the corners off the same width and height, so
        centre-cropping a 16:9 render to 9:16 would not give a vertical cut of
        this film &mdash; it would give a vertical cut with the copy outside the
        frame, and you would conclude the copy needs moving. Each panel below is
        a real render at its own aspect, which is what an encode at that ratio
        produces.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        <b className="text-title">The safe areas are approximate.</b> No platform
        publishes its chrome as a spec and it moves between releases. The hatched
        bands are the commonly-cited ones &mdash; a caption block and an action
        rail on 9:16 &mdash; and they are a prompt to look, not a certificate.
      </p>

      <Suspense
        fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}
      >
        <Body />
      </Suspense>
    </main>
  );
}

/** The same question the rest of the sandbox films, found the same way. */
async function findQuestion() {
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
  return lesson && question ? { lesson, question } : null;
}

async function Body() {
  // No searchParams and no session here, so nothing else establishes that this
  // runs at request time and the Prisma client's clock read trips the
  // current-time prerender error. Same fix the sibling routes carry.
  await connection();
  const found = await findQuestion();
  if (!found) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database carries a parseable
        quiz block. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }
  return <FormatGrid lesson={found.lesson} question={found.question} />;
}
