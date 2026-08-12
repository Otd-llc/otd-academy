// SANDBOX - the tuning bench for the quiet cut. DEV ONLY.
//
// TEN AXES, ONE AT A TIME. That is a performance decision as much as an
// editorial one: a full stage is a live 60fps loop carrying a QuizBlock, a
// 44-line ring and a twelve-wing carousel, and a page of them turns a bench
// about TIMING into a slideshow of dropped frames.
//
// WHAT IS JUDGED ON WHAT, which is the whole design of this page:
//
//   whole cut      flow, layout, position, parallax, camera
//   one part solo  motion, and the per-part place/size round
//   type only      the word's entrance and its exit
//   two seconds    the patch flip
//
// Solo is what makes the per-part axes affordable AND correct: nine live
// ten-second cuts is unusable, nine live rings is fine, and judging a part's
// entrance means watching that part rather than waiting two beats for it.
//
// THE AXES COMBINE. Every axis reads the other nine off the URL, so a settled
// choice carries forward instead of the next round being judged against a stale
// baseline:
//
//   ?axis=motion&flow=snappy&layout=weighted&camera=pan&parallax=deep
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
  KINETIC_OUTS,
  POSITIONS,
  type Flow,
  type Jaunty,
  type Kinetic,
  type KineticOut,
  type Tuning,
  type WordPos,
} from "../tuning";
import {
  CAMERAS,
  LAYOUTS,
  MOTIONS,
  PARALLAXES,
  PARTS,
  PART_LABEL,
  PLACES,
  type Camera,
  type Motion,
  type Parallax,
  type PartId,
  type Place,
} from "../motion";

type Axis =
  | "flow"
  | "layout"
  | "motion"
  | "part"
  | "kinetic"
  | "kineticOut"
  | "position"
  | "parallax"
  | "camera"
  | "jaunty";

const AXES: { id: Axis; label: string; blurb: string }[] = [
  { id: "flow", label: "1 / flow", blurb: "How early a picture arms and how long it takes to hand over." },
  { id: "layout", label: "2 / composition", blurb: "Place, size, entrance and exit for all four parts at once." },
  { id: "part", label: "3 / one part", blurb: "That part, solo, at every placement and size." },
  { id: "motion", label: "4 / dynamics", blurb: "What a part does while it sits there. Solo, so the motion is the only thing moving." },
  { id: "parallax", label: "5 / parallax", blurb: "How far apart the backdrop, the subject and the word travel." },
  { id: "camera", label: "6 / camera", blurb: "The one move applied to everything. Parallax has nothing to separate against without it." },
  { id: "kinetic", label: "7 / word in", blurb: "Eleven entrances. Type layer only." },
  { id: "kineticOut", label: "8 / word out", blurb: "Seven exits, including the hard cut every round so far used by default." },
  { id: "position", label: "9 / word position", blurb: "Where the word sits, and what that costs the picture." },
  { id: "jaunty", label: "10 / the patch flip", blurb: "Twelve ways to stop being locked. Two plate the gold on rather than swapping it." },
];

/** The placements the per-part round shows. Seven boxes times four parts is a
 *  lot of live tiles, so the round shows the five that actually differ on a
 *  16:9 frame and leaves the diagonals to the URL. */
const PART_PLACES: Place[] = PLACES.filter((p) => !p.includes("-"));
const PART_SIZES = [0.8, 1, 1.2];

type Params = Promise<Record<string, string | undefined>>;

export default function BenchPage({ searchParams }: { searchParams: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; THE LOGBOOK &middot; tuning bench
      </p>
      <h1 className="title-section mt-3">
        {/* ASCII in the source, entities on the page. A PowerShell rewrite of
            this file double-encoded the arrow once already, which is the whole
            reason these modules are ASCII-only. */}
        {QUIET_BEATS.map((b) => b.word).join(" -> ")}, tuned
      </h1>
      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Ten axes, one at a time, each reading the other nine off the URL so a
        choice carries forward. Everything below is a keyframe or a number
        computed from scene time &mdash; nothing is a CSS transition and nothing
        is a spring, because the render pass seeks and neither of those can be.
        Springs are damped sines of <code>t</code>, which look the same and can.
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
  const part = pick<PartId>(sp.part, PARTS, "ring");
  const base: Tuning = {
    flow: pick<Flow>(sp.flow, Object.keys(FLOWS) as Flow[], DEFAULT_TUNING.flow),
    kinetic: pick<Kinetic>(sp.kinetic, KINETICS.map((x) => x.id), DEFAULT_TUNING.kinetic),
    kineticOut: pick<KineticOut>(sp.kineticOut, KINETIC_OUTS.map((x) => x.id), DEFAULT_TUNING.kineticOut),
    pos: pick<WordPos>(sp.pos, POSITIONS.map((x) => x.id), DEFAULT_TUNING.pos),
    jaunty: pick<Jaunty>(sp.jaunty, JAUNTIES.map((x) => x.id), DEFAULT_TUNING.jaunty),
    layout: pick(sp.layout, LAYOUTS.map((x) => x.id), DEFAULT_TUNING.layout),
    motionAll: pick<Motion | "auto">(
      sp.motion,
      ["auto", ...MOTIONS.map((x) => x.id)],
      DEFAULT_TUNING.motionAll,
    ),
    parallax: pick<Parallax>(sp.parallax, PARALLAXES.map((x) => x.id), DEFAULT_TUNING.parallax),
    camera: pick<Camera>(sp.camera, CAMERAS.map((x) => x.id), DEFAULT_TUNING.camera),
  };
  const fixedT =
    sp.t !== undefined && Number.isFinite(Number(sp.t)) ? Number(sp.t) : undefined;

  const qs = (over: Record<string, string>) =>
    new URLSearchParams({
      axis,
      part,
      flow: base.flow,
      kinetic: base.kinetic,
      kineticOut: base.kineticOut,
      pos: base.pos,
      jaunty: base.jaunty,
      layout: base.layout,
      motion: base.motionAll,
      parallax: base.parallax,
      camera: base.camera,
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

  // The hairline is not decoration. Every stage is deep-space on a deep-space
  // page, so without an edge there is nothing to judge a PLACEMENT against -
  // the whole per-part round is about where a thing sits in a frame you cannot
  // see.
  const Stage = ({ tuning, w = 520 }: { tuning: Tuning; w?: number }) => (
    <div className="border border-panel-border/50">
      <LogbookLive
        arrangement="quiet"
        lesson={lesson}
        libraryTotal={0}
        libraryDone={0}
        questions={[question]}
        tuning={tuning}
        fixedT={fixedT}
        w={w}
      />
    </div>
  );

  return (
    <>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-y border-panel-border/60 py-3">
        {AXES.map((a) => (
          <Link
            key={a.id}
            href={`?${qs({ axis: a.id })}`}
            className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
              a.id === axis ? "text-command-gold" : "text-muted hover:text-gold-light"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
        carrying &middot; flow <b className="text-text">{base.flow}</b> &middot; comp{" "}
        <b className="text-text">{base.layout}</b> &middot; dyn{" "}
        <b className="text-text">{base.motionAll}</b> &middot; plx{" "}
        <b className="text-text">{base.parallax}</b> &middot; cam{" "}
        <b className="text-text">{base.camera}</b> &middot; in{" "}
        <b className="text-text">{base.kinetic}</b> &middot; out{" "}
        <b className="text-text">{base.kineticOut}</b> &middot; pos{" "}
        <b className="text-text">{base.pos}</b> &middot; flip{" "}
        <b className="text-text">{base.jaunty}</b>
        <br />
        <span className="text-gray-3">{AXES.find((a) => a.id === axis)?.blurb}</span>
      </p>

      {axis === "flow" ? (
        <Group>
          {(Object.keys(FLOWS) as Flow[]).map((id) => (
            <Cell key={id} label={FLOWS[id].label} note={FLOWS[id].note}
              meta={`lead ${FLOWS[id].lead}s / in ${FLOWS[id].inDur}s / out ${FLOWS[id].outDur}s`}
              href={`?${qs({ flow: id })}`} on={base.flow === id}>
              <Stage tuning={{ ...base, flow: id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "layout" ? (
        <Group>
          {LAYOUTS.map((x) => (
            <Cell key={x.id} label={x.label} note={x.note} href={`?${qs({ layout: x.id })}`}
              on={base.layout === x.id}>
              <Stage tuning={{ ...base, layout: x.id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "parallax" ? (
        <Group>
          {PARALLAXES.map((x) => (
            <Cell key={x.id} label={x.label} note={x.note} href={`?${qs({ parallax: x.id })}`}
              on={base.parallax === x.id}
              meta={base.camera === "locked" ? "needs a camera to read" : undefined}>
              <Stage tuning={{ ...base, parallax: x.id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "camera" ? (
        <Group>
          {CAMERAS.map((x) => (
            <Cell key={x.id} label={x.label} note={x.note} href={`?${qs({ camera: x.id })}`}
              on={base.camera === x.id}>
              <Stage tuning={{ ...base, camera: x.id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {axis === "position" ? (
        <Group>
          {POSITIONS.map((x) => (
            <Cell key={x.id} label={x.label} note={x.note} href={`?${qs({ pos: x.id })}`}
              on={base.pos === x.id}>
              <Stage tuning={{ ...base, pos: x.id }} />
            </Cell>
          ))}
        </Group>
      ) : null}

      {/* ---- solo rounds: one part, the whole clip, no words ---- */}
      {axis === "motion" ? (
        <>
          <PartPicker part={part} qs={qs} />
          <ul className="mt-5 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {MOTIONS.map((m) => (
              <li key={m.id}>
                <Stage tuning={{ ...base, motionAll: m.id, solo: part }} w={340} />
                <p className="mt-2">
                  <Link href={`?${qs({ motion: m.id })}`}
                    className={`title-card ${base.motionAll === m.id ? "text-command-gold" : ""}`}>
                    {m.label}
                  </Link>
                </p>
                <p className="mt-1 font-serif text-sm text-muted">{m.note}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {axis === "part" ? (
        <>
          <PartPicker part={part} qs={qs} />
          <p className="mt-3 font-mono text-[11px] text-muted">
            {PART_LABEL[part]}, solo, at every placement and three sizes. The
            composition preset supplies its entrance, exit and motion; this round
            is only about where it is and how big.
          </p>
          {PART_SIZES.map((size) => (
            <div key={size}>
              <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
                &#9656; size {size.toFixed(2)}
              </p>
              <ul className="mt-3 grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {PART_PLACES.map((pl) => (
                  <li key={pl}>
                    <Stage
                      tuning={{ ...base, solo: part, part, partOver: { place: pl, size } }}
                      w={340}
                    />
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                      {pl} &middot; {size.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {/* ---- type-only rounds ---- */}
      {axis === "kinetic" ? (
        <ul className="mt-6 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {KINETICS.map((x) => (
            <li key={x.id}>
              <div className="border border-panel-border/50"><WordTile kinetic={x.id} kineticOut={base.kineticOut} pos={base.pos}
                fixedT={fixedT} w={360} outDur={FLOWS[base.flow].outDur} /></div>
              <p className="mt-2">
                <Link href={`?${qs({ kinetic: x.id })}`}
                  className={`title-card ${base.kinetic === x.id ? "text-command-gold" : ""}`}>
                  {x.label}
                </Link>
              </p>
              <p className="mt-1 font-serif text-sm text-muted">{x.note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {axis === "kineticOut" ? (
        <ul className="mt-6 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {KINETIC_OUTS.map((x) => (
            <li key={x.id}>
              <div className="border border-panel-border/50"><WordTile kinetic={base.kinetic} kineticOut={x.id} pos={base.pos}
                fixedT={fixedT} w={360} outDur={FLOWS[base.flow].outDur} /></div>
              <p className="mt-2">
                <Link href={`?${qs({ kineticOut: x.id })}`}
                  className={`title-card ${base.kineticOut === x.id ? "text-command-gold" : ""}`}>
                  {x.label}
                </Link>
              </p>
              <p className="mt-1 font-serif text-sm text-muted">{x.note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {axis === "jaunty" ? (
        <ul className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {JAUNTIES.map((j) => (
            <li key={j.id}>
              <div className="border border-panel-border/50"><FlipTile spec={j} fixedT={fixedT} /></div>
              <p className="mt-2 flex items-baseline justify-between gap-2">
                <Link href={`?${qs({ jaunty: j.id })}`}
                  className={`title-card ${base.jaunty === j.id ? "text-command-gold" : ""}`}>
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

function PartPicker({ part, qs }: { part: PartId; qs: (o: Record<string, string>) => string }) {
  return (
    <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
      {PARTS.map((p) => (
        <Link key={p} href={`?${qs({ part: p })}`}
          className={p === part ? "text-command-gold" : "text-muted hover:text-gold-light"}>
          {PART_LABEL[p]}
        </Link>
      ))}
    </p>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <ul className="mt-6 grid gap-x-6 gap-y-8 lg:grid-cols-2">{children}</ul>;
}

function Cell({
  label, note, meta, href, on, children,
}: {
  label: string; note: string; meta?: string; href: string; on: boolean;
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

