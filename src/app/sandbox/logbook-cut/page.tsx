// SANDBOX - the Logbook in ten seconds, three arrangements to look at. DEV ONLY.
//
// `?t=8.4` freezes every stage on one frame, which exists BEFORE any screenshot
// does. `?a=rail` shows one arrangement on its own, for a full-width look.
//
// THE LESSON AND THE COUNTS ARE QUERIED, not typed. A gamification film is an
// argument about numbers, so the one place a made-up number could hide - "69
// lessons", a plausible lesson title - reads from the database instead. If the
// local DB is empty the page says so on screen rather than rendering a
// confident zero.
//
// EVERYTHING DYNAMIC LIVES UNDER THE SUSPENSE BOUNDARY. Both the searchParams
// read and the three counts are uncached, and under Cache Components an
// uncached read above a boundary blocks the whole route AND logs a console
// error on every load. That matters more here than on an ordinary page: this
// route exists to be driven by a headless browser, and a render pass that
// collects page errors cannot tell a warning it should ignore from the one it
// should not.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LogbookLive, type FilmLesson } from "./LogbookLive";
import {
  AFTER,
  ARRANGEMENTS,
  AWARD,
  BEATS,
  BEFORE,
  PATCH,
  QUIZ_XP,
  READ_XP,
  XP_AFTER,
  XP_BEFORE,
  num,
  type Arrangement,
} from "./beats";

type Params = Promise<{ t?: string; a?: string }>;

export default function LogbookCutSandbox({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; ten seconds
      </p>
      <h1 className="title-section mt-3">Lessons pay, the rank moves, the wall fills</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Third subject for this pipeline, after a three.js rig and live diagram
        components. This one is real product UI: <code>StandingRail</code>,{" "}
        <code>RankWing</code>, <code>PatchBadge</code>, <code>PatchWall</code>,{" "}
        <code>XpTick</code>, the <code>/learn</code> Library strip and the real{" "}
        <code>Fanfare</code> banner, all mounted live and driven off one clock.
      </p>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        The three arrangements differ mostly in how much of the product&rsquo;s own
        chrome survives. That is the actual question &mdash; a resume link, a
        dismiss <span className="font-mono">X</span> and a &ldquo;View in
        Logbook&rdquo; belong on a page and read as a screenshot in a film &mdash;
        and it is a looking question, not a reading one.
      </p>

      <p className="mt-4 font-mono text-xs text-muted">
        Owner picked B and C on 2026-08-11 &middot;{" "}
        <Link
          href="/sandbox/logbook-cut/combo"
          className="text-command-gold hover:text-gold-light"
        >
          round two, the three ways to combine them &rarr;
        </Link>
      </p>

      <Suspense
        fallback={
          <p className="mt-8 font-mono text-xs text-muted">reading the library&hellip;</p>
        }
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
  const only = ARRANGEMENTS.find((a) => a.id === sp.a)?.id as Arrangement | undefined;

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

  const shown = only ? ARRANGEMENTS.filter((a) => a.id === only) : ARRANGEMENTS;

  return (
    <>
      {row ? null : (
        <p className="mt-4 border border-danger-coral/40 bg-danger-coral/5 p-3 font-mono text-xs text-danger-coral">
          The local database has no published Fundamentals lesson, so the resume
          row is a placeholder. Hydrate with <code>pnpm db:pull-prod</code> before
          judging beat one.
        </p>
      )}

      <section className="mt-8 border-t border-panel-border/60 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          &#9656; every number on screen, and where it comes from
        </p>
        <ul className="mt-3 grid gap-1.5 font-mono text-xs text-muted sm:grid-cols-2">
          <li>
            <span className="text-text">{READ_XP} XP</span> &mdash; a 7-minute read at{" "}
            <code>lessonXp()</code>, first ever
          </li>
          <li>
            <span className="text-text">{QUIZ_XP} XP</span> &mdash; the quiz, at{" "}
            <code>quizXp()</code>
          </li>
          <li>
            <span className="text-text">
              {num(XP_BEFORE)} &rarr; {num(XP_AFTER)}
            </span>{" "}
            &mdash; the crossing, +{AWARD}, landing exactly on the FL{AFTER.level} floor
          </li>
          <li>
            <span className="text-text">
              FL{BEFORE.level} {BEFORE.title} &rarr; FL{AFTER.level} {AFTER.title}
            </span>{" "}
            &mdash; <code>LEVELS</code>
          </li>
          <li>
            <span className="text-text">{PATCH.label}</span> &mdash;{" "}
            {PATCH.howToEarn.toLowerCase()}, worth {PATCH.xp}
          </li>
          <li>
            <span className="text-text">
              {fundDone} / {total}
            </span>{" "}
            &mdash; lessons read, queried from the database
          </li>
        </ul>
        <p className="mt-3 max-w-3xl font-serif text-sm text-muted">
          One correction is baked into the copy rather than argued around.{" "}
          <em>Ranks earn badges</em> is not what the code does: every badge in{" "}
          <code>patches.ts</code> is earned by finishing lessons, and none is gated on
          a rank. Beat four therefore lands the patch on its real condition, quoting
          the catalog&rsquo;s own <code>howToEarn</code>. The chain the film can
          honestly claim is lessons &rarr; XP &rarr; rank, and the same lessons
          filling the wall.
        </p>
      </section>

      <h2 className="title-section mt-10">Three ways to stage it</h2>
      <p className="mt-2 max-w-3xl font-serif text-base text-text">
        Same beats, same numbers, same components. Only the staging changes.
        Downbeats on {BEATS.map((b) => b.at.toFixed(1)).join(" / ")}, ten seconds,
        bar one establishes.
      </p>

      <ul className="mt-6 border-t border-panel-border/60">
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
        <code>?t=</code> freezes the clock &middot; <code>?a=page|rail|emblem</code>{" "}
        isolates one &middot; delete this route before the PR
      </p>
    </>
  );
}
