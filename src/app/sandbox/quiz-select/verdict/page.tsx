// SANDBOX - how the verdict arrives, on the picked selection. DEV ONLY.
//
// The SELECTION is settled: `others`, where the chosen node barely moves and
// what animates is the two rows nobody picked, standing down in sequence. Every
// stage below runs it, so the only variable is the second half of the moment.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import type { QuizQuestion } from "@/components/guide/QuizBlock";
import { SelectStage } from "../SelectStage";
import { CLICK, VERDICTS, selectById } from "../select-anim";

type Params = Promise<{ t?: string; only?: string }>;

const PICKED = selectById("others");

export default function VerdictSandbox({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE QUIZ &middot; the verdict
      </p>
      <h1 className="title-section mt-3">How &ldquo;powered&rdquo; arrives</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The selection is settled &mdash;{" "}
        <b className="text-title">{PICKED.label.replace(/^\d+ \/ /, "")}</b>, where
        the chosen node barely moves and what animates is the two rows nobody
        picked, standing down in sequence. Every stage below runs it, so the only
        thing changing is the half that was never animated at all.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        It matters more than it looks. The second line is the{" "}
        <b className="text-title">teaching</b> &mdash; the only place in the whole
        interaction where a learner is told <em>why</em> they were right &mdash; and
        today it arrives with no more ceremony than a layout shift, at the exact
        instant three other things are also happening. Four things becoming true
        at once is the mush this round exists to fix.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-sm text-muted">
        One trap, already paid for: the block <em>mounts</em> on the solve, so
        anything that animates height moves the &ldquo;1 / 1 correct&rdquo; footer
        under it &mdash; three times on a three-question card. That is why{" "}
        <code>unfold</code> is on the page to be judged rather than assumed fine.
      </p>

      <p className="mt-4 font-mono text-xs text-muted">
        <Link prefetch={false} href="/sandbox/quiz-select" className="text-command-gold hover:text-gold-light">
          &larr; the selection round
        </Link>{" "}
        &middot; the pick lands at {CLICK.toFixed(2)}s &middot; <code>?t=1.2</code>{" "}
        freezes half a second after it
      </p>

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
          Array.isArray(q.options) &&
          q.options.length >= 3 &&
          typeof q.answer === "number" &&
          // The verdict round is ABOUT the explanation, so a question without
          // one has nothing to judge.
          typeof q.explain === "string" &&
          q.explain.length > 0,
      );
    for (const q of qs) {
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
  const shown = sp.only ? VERDICTS.filter((v) => v.id === sp.only) : VERDICTS;
  const question = await findQuestion();

  if (!question) {
    return (
      <p className="mt-6 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
        No published Fundamentals lesson in the local database has a quiz question
        that carries an <code>explain</code> line, which is the thing this round is
        about. Hydrate with <code>pnpm db:pull-prod</code>.
      </p>
    );
  }

  return (
    <ul className="mt-4">
      {shown.map((v) => (
        <li key={v.id} className="border-b border-panel-border/60 py-7">
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="title-card">{v.label}</span>
            <span className="font-mono text-[10px] tabular-nums text-muted">
              {v.dur ? `${v.dur}s` : "instant"}
            </span>
          </p>
          <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{v.note}</p>
          <div className="mt-3">
            <SelectStage anim={PICKED} verdict={v} question={question} fixedT={fixedT} />
          </div>
        </li>
      ))}
    </ul>
  );
}
