// SANDBOX - how a quiz answer lands. DEV ONLY.
//
// Its own route, because the outcome is not a film choice. The pick is the
// most-repeated interaction in the Academy - 207 questions across 69 library
// lessons, plus every stage gate - and whatever wins here ships into
// globals.css and changes the product for everyone, not just the promo.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { QuizQuestion } from "@/components/guide/QuizBlock";
import { SelectStage } from "./SelectStage";
// CLICK from the PLAIN module, never from the client one: across a "use client"
// boundary an export is a client reference, not the number.
import { CLICK, SELECTS } from "./select-anim";

type Params = Promise<{ t?: string; only?: string }>;

export default function QuizSelectSandbox({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE QUIZ &middot; how an answer lands
      </p>
      <h1 className="title-section mt-3">The pick, animated</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Every stage below is the <b className="text-title">real</b>{" "}
        <code>QuizBlock</code>, unmodified, answered by a real click on a real
        option. It is given neither a <code>context</code> nor a{" "}
        <code>logbook</code>, which is the case its own header calls the editor
        preview: with neither it touches no server action and records nothing.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        What ships today is candidate 00 &mdash; a 0.3s scale pop with two 0.2s
        colour transitions under it. On a page it passes. In the cut it is the
        disjointed moment, because nothing connects the pick to the verdict: the
        fill, the label, the rule-outs and the &ldquo;powered&rdquo; line all
        simply become true at once.
      </p>

      <section className="mt-5 border-y border-panel-border/60 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; two constraints, because this one is going to ship
        </p>
        <ul className="mt-2 max-w-3xl space-y-1 font-serif text-sm text-muted">
          <li>
            <b className="text-title">Keyframes, never transitions.</b> The film
            renders by seeking and a transition has no seek. The base sheet
            transitions <code>fill</code>, <code>stroke</code> and{" "}
            <code>color</code>, so every candidate switches those off and drives
            the same properties from keyframes. That also makes the product
            animation deterministic under test.
          </li>
          <li>
            <b className="text-title">Nothing new in the component.</b> Every
            rule hangs off markup <code>QuizBlock</code> already emits, so
            shipping the winner is a <code>globals.css</code> change &mdash; drop
            the <code>[data-qsel]</code> prefix and paste. The existing
            reduced-motion guard in that section already covers all of it.
          </li>
        </ul>
        <p className="mt-3 max-w-3xl font-serif text-sm text-muted">
          Half of them use the wired net. <code>.qzh-opts::before</code> already
          draws a bus down the left with each hex hanging off it as a node, and
          an answer landing is a circuit closing &mdash; it is the one piece of
          this design that has been asking to be animated and never has been.
        </p>
      </section>

      <Suspense fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

let CACHE: QuizQuestion | null = null;

async function findQuestion(): Promise<QuizQuestion | null> {
  if (CACHE) return CACHE;
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC", cluster: "fundamentals" },
    orderBy: { clusterOrdinal: "asc" },
    select: { contentBlocks: true },
    take: 12,
  });
  let best: QuizQuestion | null = null;
  for (const r of rows) {
    const qs = parseGuideBlocks(r.contentBlocks)
      .blocks.filter((b) => b.type === "quiz")
      .flatMap((b) => (b.type === "quiz" ? b.questions : []))
      .filter(
        (q): q is QuizQuestion =>
          Array.isArray(q.options) && q.options.length >= 3 && typeof q.answer === "number",
      );
    for (const q of qs) {
      // Prefer three short options: the rule-out cascade needs at least three
      // rows to read as a cascade, and a wrapped label changes the row height
      // mid-animation.
      const score = q.options.length * 100 + q.q.length;
      const bestScore = best ? best.options.length * 100 + best.q.length : Infinity;
      if (score < bestScore) best = q;
    }
  }
  CACHE = best;
  return best;
}

async function Body({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const fixedT =
    sp.t !== undefined && Number.isFinite(Number(sp.t)) ? Number(sp.t) : undefined;
  const shown = sp.only ? SELECTS.filter((s) => s.id === sp.only) : SELECTS;
  const question = await findQuestion();

  if (!question) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database carries a quiz block
        with three or more options. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }

  return (
    <>
      <p className="mt-6 font-mono text-[11px] text-muted">
        the pick lands at <span className="text-command-gold">{CLICK.toFixed(2)}s</span> of
        each loop &middot; <code>?t=0.9</code> freezes every stage 0.2s after it
        &middot; <code>?only=energise</code> isolates one
      </p>

      <ul className="mt-4">
        {shown.map((s) => (
          <li key={s.id} className="border-b border-panel-border/60 py-7">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="title-card">{s.label}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted">{s.dur}s</span>
            </p>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{s.note}</p>
            <div className="mt-3">
              <SelectStage anim={s} question={question} fixedT={fixedT} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 font-mono text-xs text-muted">
        delete this route before the PR &mdash; the winner moves into{" "}
        <code>globals.css</code>, not into a sandbox
      </p>
    </>
  );
}
