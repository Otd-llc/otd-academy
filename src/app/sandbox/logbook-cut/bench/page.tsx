// SANDBOX - the tuning bench for the quiet cut. DEV ONLY.
//
// ONE AXIS AT A TIME, and that is a performance decision as much as an
// editorial one. Every full stage on this page is a live 60fps loop carrying a
// QuizBlock, a 44-line ring, a twelve-wing carousel and a patch; ten of them at
// once turns the comparison into a slideshow of dropped frames, which is the one
// thing a page about TIMING must not do. `?axis=` shows one group.
//
// THE AXES COMBINE. Every axis reads the other three off the URL, so once flow
// is settled you can carry it into the position round instead of judging the
// new axis against a stale baseline:
//
//   ?axis=position&flow=snappy&kinetic=snap&transition=wipe&jaunty=pop
//
// WHAT IS JUDGED ON WHAT. Flow, position and transition need the whole frame
// and the whole cut. A kinetic is one word arriving, so it gets the type layer
// over an empty frame - five complete cuts to compare five entrances means
// watching four subjects you are not judging. The patch flip is two seconds of
// itself, six ways, side by side on a short loop.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseGuideBlocks } from "@/lib/guide-blocks-parse";
import {
  FlipTile,
  LogbookLive,
  WordTile,
  type FilmLesson,
  type FilmQuestion,
} from "../LogbookLive";
import { QUIET_BEATS } from "../beats";
import {
  DEFAULT_TUNING,
  FLOWS,
  JAUNTIES,
  KINETICS,
  POSITIONS,
  TRANSITIONS,
  type Flow,
  type Jaunty,
  type Kinetic,
  type Transition,
  type Tuning,
  type WordPos,
} from "../tuning";

type Axis = "flow" | "position" | "kinetic" | "transition" | "jaunty";
const AXES: { id: Axis; label: string; blurb: string }[] = [
  { id: "flow", label: "1 / flow + timing", blurb: "How early a picture arms and how long it takes to hand over." },
  { id: "transition", label: "2 / transitions", blurb: "What the handover itself looks like." },
  { id: "kinetic", label: "3 / word kinetics", blurb: "How the word arrives. Type layer only." },
  { id: "position", label: "4 / word position", blurb: "Where the word sits, and what that costs the picture." },
  {
    id: "jaunty",
    label: "5 / the patch flip",
    blurb:
      "Twelve ways to stop being locked. Two of them plate the gold on rather than swapping it.",
  },
];

type Params = Promise<Record<string, string | undefined>>;

export default function BenchPage({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; tuning bench
      </p>
      <h1 className="title-section mt-3">
        {QUIET_BEATS.map((b) => b.word).join(" → ")}, tuned
      </h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Five axes, one at a time. Each one reads the other four off the URL, so a
        choice carries forward instead of every round being judged against the
        same stale baseline. Every value is a keyframe or a number computed from
        scene time &mdash; nothing here is a CSS transition, because the render
        pass seeks and a transition cannot be seeked.
      </p>
      <Suspense fallback={<p className="mt-8 font-mono text-xs text-muted">loading&hellip;</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function pick<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

async function Body({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const axis = pick<Axis>(sp.axis, AXES.map((a) => a.id), "flow");
  const base: Tuning = {
    flow: pick<Flow>(sp.flow, Object.keys(FLOWS) as Flow[], DEFAULT_TUNING.flow),
    transition: pick<Transition>(sp.transition, TRANSITIONS.map((x) => x.id), DEFAULT_TUNING.transition),
    kinetic: pick<Kinetic>(sp.kinetic, KINETICS.map((x) => x.id), DEFAULT_TUNING.kinetic),
    pos: pick<WordPos>(sp.pos, POSITIONS.map((x) => x.id), DEFAULT_TUNING.pos),
    jaunty: pick<Jaunty>(sp.jaunty, JAUNTIES.map((x) => x.id), DEFAULT_TUNING.jaunty),
  };
  const qs = (over: Partial<Record<string, string>>) =>
    new URLSearchParams({
      axis,
      flow: base.flow,
      transition: base.transition,
      kinetic: base.kinetic,
      pos: base.pos,
      jaunty: base.jaunty,
      ...over,
    }).toString();

  const where = { published: true, accessTier: "PUBLIC" as const };
  const rows = await db.miniLesson.findMany({
    where: { ...where, cluster: "fundamentals" },
    orderBy: { clusterOrdinal: "asc" },
    select: { slug: true, title: true, contentBlocks: true },
    take: 12,
  });

  let lesson: FilmLesson | null = null;
  let question: FilmQuestion | null = null;
  for (const r of rows) {
    const qsx = parseGuideBlocks(r.contentBlocks)
      .blocks.filter((b) => b.type === "quiz")
      .flatMap((b) => (b.type === "quiz" ? b.questions : []))
      .filter(
        (q): q is FilmQuestion =>
          Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number",
      );
    for (const q of qsx) {
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

  // `?t=` freezes every stage AND every tile, so a screenshot lands on a chosen
  // frame rather than wherever wall time happened to be.
  const fixedT =
    sp.t !== undefined && Number.isFinite(Number(sp.t)) ? Number(sp.t) : undefined;

  const Stage = ({ tuning }: { tuning: Tuning }) => (
    <LogbookLive
      arrangement="quiet"
      lesson={lesson}
      libraryTotal={0}
      libraryDone={0}
      questions={[question]}
      tuning={tuning}
      fixedT={fixedT}
      w={520}
    />
  );

  return (
    <>
      {/* The axis switcher, and the running state of the other four. */}
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-y border-panel-border/60 py-3">
        {AXES.map((a) => (
          <Link
            key={a.id}
            href={`?${qs({ axis: a.id })}`}
            className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
              a.id === axis ? "text-command-gold" : "text-muted hover:text-gold-light"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 font-mono text-[11px] text-muted">
        carrying &middot; flow <span className="text-text">{base.flow}</span> &middot;
        transition <span className="text-text">{base.transition}</span> &middot; kinetic{" "}
        <span className="text-text">{base.kinetic}</span> &middot; position{" "}
        <span className="text-text">{base.pos}</span> &middot; flip{" "}
        <span className="text-text">{base.jaunty}</span> &middot;{" "}
        <Link href={`?${qs({})}&`} className="text-command-gold">
          {AXES.find((a) => a.id === axis)?.blurb}
        </Link>
      </p>

      {axis === "flow" ? (
        <Group>
          {(Object.keys(FLOWS) as Flow[]).map((id) => (
            <Cell
              key={id}
              label={FLOWS[id].label}
              note={FLOWS[id].note}
              meta={`lead ${FLOWS[id].lead}s · in ${FLOWS[id].inDur}s · out ${FLOWS[id].outDur}s`}
              href={`?${qs({ flow: id })}`}
              on={base.flow === id}
            >
              <Stage tuning={{ ...base, flow: id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "transition" ? (
        <Group>
          {TRANSITIONS.map((x) => (
            <Cell
              key={x.id}
              label={x.label}
              note={x.note}
              href={`?${qs({ transition: x.id })}`}
              on={base.transition === x.id}
            >
              <Stage tuning={{ ...base, transition: x.id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "position" ? (
        <Group>
          {POSITIONS.map((x) => (
            <Cell
              key={x.id}
              label={x.label}
              note={x.note}
              href={`?${qs({ pos: x.id })}`}
              on={base.pos === x.id}
            >
              <Stage tuning={{ ...base, pos: x.id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "kinetic" ? (
        <Group>
          {KINETICS.map((x) => (
            <Cell
              key={x.id}
              label={x.label}
              note={x.note}
              href={`?${qs({ kinetic: x.id })}`}
              on={base.kinetic === x.id}
            >
              {/* Same `w` the stages get, so the word is the same size here as
                  in the cut it is being chosen for. */}
              <WordTile kinetic={x.id} pos={base.pos} fixedT={fixedT} w={520} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "jaunty" ? (
        <ul className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {JAUNTIES.map((j) => (
            <li key={j.id}>
              <FlipTile spec={j} fixedT={fixedT} />
              <p className="mt-2 flex items-baseline justify-between gap-2">
                <Link
                  href={`?${qs({ jaunty: j.id })}`}
                  className={`title-card ${base.jaunty === j.id ? "text-command-gold" : ""}`}
                >
                  {j.label}
                </Link>
                <span className="font-mono text-[10px] tabular-nums text-muted">{j.dur}s</span>
              </p>
              <p className="mt-1 font-serif text-sm text-muted">{j.note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-10 font-mono text-xs text-muted">
        <Link href="/sandbox/logbook-cut/quiet" className="text-command-gold hover:text-gold-light">
          the cut as it stands
        </Link>{" "}
        &middot; <code>?t=</code> freezes every stage &middot; delete this route before the PR
      </p>
    </>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-6 grid gap-x-6 gap-y-8 lg:grid-cols-2">{children}</ul>
  );
}

function Cell({
  label,
  note,
  meta,
  href,
  on,
  children,
}: {
  label: string;
  note: string;
  meta?: string;
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      {children}
      <p className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <Link href={href} className={`title-card ${on ? "text-command-gold" : ""}`}>
          {on ? "▸ " : ""}
          {label}
        </Link>
        {meta ? <span className="font-mono text-[10px] text-muted">{meta}</span> : null}
      </p>
      <p className="mt-1 font-serif text-sm text-muted">{note}</p>
    </li>
  );
}
