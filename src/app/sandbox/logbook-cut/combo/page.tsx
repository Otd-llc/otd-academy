// SANDBOX - round two: B and C together, three ways. DEV ONLY.
//
// Round one is still at /sandbox/logbook-cut, unchanged, so the two rounds can
// be flipped between rather than remembered.
//
// Same clock, same beats, same numbers, same components. What changed is only
// the staging, which is the only thing that was ever in question.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LogbookLive, type FilmLesson } from "../LogbookLive";
import { BEATS, COMBOS, PATCH, type Arrangement } from "../beats";

type Params = Promise<{ t?: string; a?: string }>;

export default function LogbookComboSandbox({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; round two
      </p>
      <h1 className="title-section mt-3">B and C, three ways of meaning it</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        B&rsquo;s claim was <strong className="text-title">continuity</strong>: one
        surface, no cuts, the product doing the work. C&rsquo;s was{" "}
        <strong className="text-title">austerity</strong>: film scale, nothing of
        the page left around it. Those combine in more than one way and the
        results look nothing like each other, so here are three rather than a
        split difference &mdash; strip the continuous surface, travel from one to
        the other, or run both registers at once.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        None of the three mounts the fanfare, and that is worth a line: A was the
        only arrangement that did, and its banner is the one component here whose
        dwell and countdown are wall-clock timers inside itself. Dropping A takes
        the last unscrubbable thing out of the film. Every frame below comes from
        a seek, which is what makes a render reproducible.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        One thing had to be reached past. <code>StandingRail</code> draws its
        title, its next-rank line and its XP total as a second column, and the
        type already says &ldquo;1,100 XP is Instrument Rated&rdquo; &mdash; the
        same sentence twice, which is the two-titles problem the cluster explainer
        hit, arriving this time from a component with no <code>bare</code> prop.
        D switches that column off and E fades it out; both are two CSS rules in{" "}
        <code>LogbookLive</code>, keyed off a data attribute, not a fork of the
        component.
      </p>

      <p className="mt-4 font-mono text-xs text-muted">
        <Link href="/sandbox/logbook-cut" className="text-command-gold hover:text-gold-light">
          &larr; round one (A / B / C)
        </Link>{" "}
        &middot; <code>?t=</code> freezes the clock &middot;{" "}
        <code>?a=strip|morph|split</code> isolates one
      </p>

      <Suspense
        fallback={<p className="mt-8 font-mono text-xs text-muted">reading the library&hellip;</p>}
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
  const only = COMBOS.find((a) => a.id === sp.a)?.id as Arrangement | undefined;

  const where = { published: true, accessTier: "PUBLIC" as const };
  const [total, fundDone, row] = await Promise.all([
    db.miniLesson.count({ where }),
    db.miniLesson.count({ where: { ...where, cluster: "fundamentals" } }),
    db.miniLesson.findFirst({
      where: { ...where, cluster: "fundamentals" },
      orderBy: { clusterOrdinal: "desc" },
      select: { slug: true, title: true },
    }),
  ]);

  const lesson: FilmLesson = row
    ? { slug: row.slug, title: row.title, clusterLabel: "Fundamentals" }
    : { slug: "no-lesson", title: "NO LESSON IN THE LOCAL DB", clusterLabel: "Fundamentals" };

  const shown = only ? COMBOS.filter((a) => a.id === only) : COMBOS;

  return (
    <>
      {row ? null : (
        <p className="mt-4 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
          The local database has no published Fundamentals lesson, so beat one is a
          placeholder. Hydrate with <code>pnpm db:pull-prod</code>.
        </p>
      )}

      <p className="mt-8 font-mono text-xs text-muted">
        Downbeats on {BEATS.map((b) => b.at.toFixed(1)).join(" / ")} &middot; ten
        seconds &middot; bar one establishes &middot; the badge is{" "}
        {PATCH.label.toLowerCase()}, on its real earn condition
      </p>

      <ul className="mt-4 border-t border-panel-border/60">
        {shown.map((a) => (
          <li key={a.id} className="border-b border-panel-border/60 py-6">
            <p className="title-card">{a.label}</p>
            <p className="mt-1 max-w-3xl font-serif text-sm text-muted">{a.note}</p>
            <div className="mt-3">
              <LogbookLive
                arrangement={a.id}
                lesson={lesson}
                libraryTotal={total}
                libraryDone={fundDone}
                fixedT={fixedT}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 font-mono text-xs text-muted">
        delete this route before the PR
      </p>
    </>
  );
}
