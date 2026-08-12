"use client";

// SANDBOX - the Logbook in ten seconds, with the REAL components live. DEV ONLY.
//
// Third subject for this pipeline. The first was a three.js rig, the second was
// live diagram components; this one is product UI, which behaves differently
// from both and brings three problems neither had.
//
// 1. PRODUCT UI CARRIES ITS OWN CHROME. A diagram had an eyebrow and a caption
//    to switch off. These have a resume link, a dismiss X, a "View in Logbook",
//    a hover state and a click target that opens a modal. There is no `bare`
//    prop to reach for, so the three arrangements below differ mostly in HOW
//    MUCH of that chrome survives - that is the actual question for the owner,
//    and it is a looking question, not a reading one.
//
// 2. TWO OF THESE COMPONENTS ESCAPE THE FRAME. RankLadderModal portals to
//    document.body on purpose (the sticky aside traps a fixed overlay), and
//    FanfareProvider paints a `fixed inset-x-0 top-0` banner. On a page showing
//    three stages at once, both land at the top of the WINDOW rather than in
//    their own frame. The stage therefore carries `transform: translateZ(0)`,
//    which makes it the containing block for fixed descendants, and the fanfare
//    lands inside it. A PORTAL to body cannot be caught that way, so the rank
//    ladder is composed here from the real RankWing and the real LEVELS instead
//    of opening the modal - the modal shell is page chrome (card, radius, close
//    X, "Flight levels" header) that has no business in a film frame anyway.
//
// 3. SCRUB, NEVER PLAY. Every beat here IS a CSS animation - .xp-pop,
//    .patch-pop, fanfare-drop, the type entrance - so the clock has to own them.
//    On every t the stage pauses each animation under it and pins currentTime to
//    scene time. That is also why no state fades with a `transition`: a
//    transition has no seek and lands wherever real time reached.
//
// A FREEZE PARAM EXISTS BEFORE ANY SCREENSHOT DOES. `?t=8.4` pins the clock, so
// a capture lands on a chosen frame rather than wherever wall time happened to
// be - which is how the first shot of the cluster sandbox came back as an empty
// opening bar and was a perfectly correct render of nothing.
//
// ASCII only.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LibraryStanding } from "@/components/learn/LibraryStanding";
import { StandingRail } from "@/components/logbook/StandingRail";
import { RankWing } from "@/components/logbook/RankWing";
import { PatchBadge } from "@/components/logbook/Patch";
import { PatchWall } from "@/components/logbook/PatchWall";
import type { PatchEntry } from "@/components/logbook/PatchWall";
import { FanfareProvider, useFanfare } from "@/components/logbook/Fanfare";
import { XpTick } from "@/components/library/XpTick";
import { LEVELS } from "@/lib/logbook/economy";
import { ROADMAP_PATCHES, artForBadge } from "@/lib/logbook/patches";
import type { LearnLibraryStanding } from "@/lib/logbook/load";
import { QuizBlock } from "@/components/guide/QuizBlock";
import {
  DEFAULT_TUNING,
  FLOWS,
  jauntyById,
  jauntyCss,
  subjectBox,
  subjectScale,
  WAIT_PERIOD,
  type JauntySpec,
  type Kinetic,
  type KineticOut,
  type Tuning,
  type WordPos,
} from "./tuning";
import {
  applyOverride,
  cameraVec,
  DEPTH,
  fitScale,
  layoutById,
  parallaxVec,
  partStyle,
  PARTS,
  type Motion,
  type Parallax,
  type Vec,
} from "./motion";
import {
  AFTER,
  AWARD,
  BEATS,
  BEFORE,
  LEAD,
  PATCH,
  QUIET_BEATS,
  QUIET_CLICK,
  QUIZ_XP,
  SECONDS,
  XP_AFTER,
  XP_BEFORE,
  arcSheet,
  armAt,
  bandPct,
  num,
  type Arrangement,
} from "./beats";
import { LogbookType } from "./LogbookType";

/** useLayoutEffect, minus the server warning. The pin MUST run before paint or
 *  the frame a beat mounts on shows one unpinned frame of its animation. */
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The scene clock: a loop, or a frozen instant. Shared by the full stage and
 *  the bench's small tiles so a tile cannot drift from the film it is judging. */
function useSceneClock(
  cycle: number,
  fixedT?: number,
  /** Pass the stage's own element and the clock only runs while it is on
   *  screen. Optional so a caller without a ref keeps the old behaviour. */
  host?: React.RefObject<HTMLElement | null>,
) {
  const [tick, setTick] = useState(0);
  const frozen = fixedT !== undefined;
  // A stage with no host observes nothing and is always live.
  const [live, setLive] = useState(!host);

  // OFF-SCREEN STAGES MUST STOP, and this is the whole reason the bench felt
  // broken rather than slow. Every tile was a 60fps loop calling setState, and
  // one setState per frame re-renders that tile's QuizBlock, its 44-line ring
  // and its twelve-wing carousel. The per-part round has fifteen tiles and
  // shows three, so twelve invisible stages were saturating the main thread -
  // and a server navigation cannot get a slot on a saturated main thread, so
  // clicking an axis looked like a link that does not work.
  useEffect(() => {
    const el = host?.current;
    if (!el || frozen) return;
    const io = new IntersectionObserver(
      ([e]) => setLive(e.isIntersecting),
      // A little early, so a tile is already running by the time it is worth
      // looking at rather than starting its cycle under the reader's eye.
      { rootMargin: "160px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [host, frozen]);

  useEffect(() => {
    if (frozen || !live) return;
    let raf = 0;
    let last = -Infinity;
    const start = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      // 30fps, which is not a compromise: the film is rendered at 30, so the
      // preview and the deliverable are sampling the same clock. Halving the
      // rate halves the React renders AND the getAnimations() sweep the pin
      // does, which is the expensive half.
      if (now - last < 33) return;
      last = now;
      setTick(((now - start) / 1000) % cycle);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen, live, cycle]);

  return fixedT ?? tick;
}

/**
 * THE CLOCK OWNS EVERY ANIMATION UNDER `host`. Pause, then pin currentTime to
 * time-since-the-beat-this-element-belongs-to. Elements tag themselves with
 * `data-anim-at`; anything untagged runs from zero.
 *
 * The XpTick's float variant is picked with Math.random() at mount, which is
 * right for a page and wrong for a film - two renders of the same frame would
 * differ. Pinning it to v1 here is the same deliberate reach past a component
 * that ClusterLive makes for useScrollReveal, and for the same reason.
 */
function usePin(host: React.RefObject<HTMLElement | null>, t: number, ...deps: unknown[]) {
  useIso(() => {
    const el = host.current;
    if (!el) return;
    el.querySelectorAll(".xp-pop").forEach((n) => {
      n.classList.remove("v2", "v3", "v4", "v5");
      n.classList.add("v1");
    });
    // PIN TWICE, AND THE SECOND ONE IS THE ONE THAT WORKS.
    //
    // A state change made in this same tick - the quiz being clicked - does not
    // commit until after the effects return, so the animations that state
    // selects do not exist yet and pinning now finds nothing. A running loop
    // hides it because the next tick corrects it; a FROZEN frame has no next
    // tick, so `?t=` screenshots came back with the animation already over,
    // which is exactly the failure the freeze param exists to prevent. The rAF
    // pass runs after the commit, when there is something to seek.
    const pin = () => {
      for (const a of el.getAnimations({ subtree: true })) {
        const target = (a.effect as KeyframeEffect | null)?.target ?? null;
        if (!target) continue;
        const owner = target.closest("[data-anim-at]") as HTMLElement | null;
        const at = Number(owner?.dataset.animAt ?? 0);
        a.pause();
        try {
          // `CSSNumberish` in the current lib.dom; the browser takes plain ms.
          (a as unknown as { currentTime: number }).currentTime = Math.max(0, (t - at) * 1000);
        } catch {
          /* an animation can be replaced mid-pin; the next pass re-pins it */
        }
      }
    };
    pin();
    const raf = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(raf);
    // The caller spreads its own deps; `host` is a stable ref.
  }, [t, ...deps]);
}

export type FilmLesson = { slug: string; title: string; clusterLabel: string | null };
/** Shape-compatible with QuizBlock's own QuizQuestion, parsed server-side out of
 *  the lesson's contentBlocks. Real questions, real answer indices. */
export type FilmQuestion = { q: string; options: string[]; answer: number; explain?: string };

const IN = 0.22;
const OUT = 0.14;

/**
 * THE PRODUCT-UI EQUIVALENT OF `bare`.
 *
 * A diagram had a `bare` prop, because a diagram was built knowing it would be
 * exported on its own. StandingRail was not: its second child is the title,
 * the next-rank line and the XP total, and on a page that is the whole point.
 * In a frame where the TYPE already says "1,100 XP is Instrument Rated", it is
 * the same sentence twice - the two-titles-and-two-captions problem the cluster
 * explainer hit, arriving from a component that has no switch for it.
 *
 * So the switch is here, keyed off a data attribute the sandbox sets, and it is
 * two rules rather than a fork of the component. Reaching past a component is
 * worth a note every time; this is the note.
 *
 * `off` hides it outright (D). The custom property fades it (E), because
 * `display` cannot be animated and, more to the point, a transition cannot be
 * seeked - the opacity is computed from scene time like everything else here.
 */
// `antialiased` is not a preference here. A scaled layer keeps subpixel text
// rendering, and at 0.82 the rail's title came back with red and blue fringing
// down one edge - fine on a page nobody scales, and a compression artifact
// waiting to happen on a 30 fps encode. Grayscale AA removes it.
const RAIL_CHROME = `
[data-rail]{-webkit-font-smoothing:antialiased}
[data-rail-text="off"] [data-rail] button{gap:0}
[data-rail-text="off"] [data-rail] button > div:nth-child(2){display:none}
[data-rail] button > div:nth-child(2){opacity:var(--rail-text-op,1)}
`;

/** How far right the ring has to move to sit in the middle of the frame once
 *  the text column beside it is invisible. Measured off the rendered button:
 *  ring block 168, gap 24, text ~200, so the button's centre is 112px right of
 *  the ring's. Opacity does not free layout, so E has to do this by hand -
 *  otherwise the emblem it spends ten seconds becoming ends up off-centre. */
const RAIL_RECENTRE = 112;

/**
 * The quiet round's own rules. Two of them switch OFF product chrome the film
 * has no use for; two are the animations the owner asked for by name.
 *
 * `qWait` is the locked patch "animated" while it waits - a slow breathing
 * tilt, not a glow, so it reads as something not yet yours rather than as a
 * button. `qJaunty` is the moment it becomes yours: an overshoot in scale AND
 * rotation, which is what makes it jaunty rather than merely large.
 *
 * Both are keyframes rather than transitions, because a transition has no seek
 * and this stage pins every animation's currentTime to scene time.
 */
const QUIET_CSS = `
[data-quiz-bare] .title-rule{display:none}
[data-quiz-bare] section > div:last-child{display:none}
/* XpTick draws the award TWICE on purpose: a floating pop that rises and fades,
   and a quiet persistent marker that stays on the row afterwards. On a page
   that is right - the value must survive the animation and reduced motion hides
   the float entirely. In a frame at 2x it is two "+5 XP" forty pixels apart.
   The film keeps the float, because the film IS the moment; the residue has
   nowhere to sit once the quiz has left. */
[data-xp-film] > span > span:first-child{display:none}
${jauntyCss()}`;

/** StandingRail's own height with the ring and the FL chip, unscaled. Measured,
 *  because a scaled element keeps its layout box and the column under it has to
 *  be told what the scale actually occupies. */
const RAIL_H = 190;

/** Computed, never transitioned. See the header. */
function fade(t: number, from: number, to: number) {
  if (t < from || t >= to) return 0;
  return Math.max(0, Math.min(1, Math.min((t - from) / IN, (to - t) / OUT)));
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** Eased ramp between two scene times, for state that moves rather than cuts. */
const ramp = (t: number, from: number, to: number) => {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
};

// ---- the shared ladder ------------------------------------------------------
//
// Real RankWing, real LEVELS, real `earned` dimming - the emblems above the
// learner's rank render in the component's own locked grey.

/** The twelve wings as a rising row: the shape of the ladder in one look. The
 *  vertical step is the whole point, so it is not decoration - and the row is
 *  pushed back down by half the total rise, or a bottom-anchored flex line
 *  reads as a composition that has slid off the top of the frame. */
const LADDER_STEP = 0.3;
function LadderRow({ level, size = 30 }: { level: number; size?: number }) {
  const rise = (LEVELS.length - 1) * size * LADDER_STEP;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: size * 0.2,
        transform: `translateY(${rise / 2}px)`,
      }}
    >
      {LEVELS.map((l, i) => {
        const mine = l.level === level;
        return (
          <div
            key={l.level}
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 5,
              marginBottom: i * (size * LADDER_STEP),
              transform: mine ? "scale(1.7)" : undefined,
              transformOrigin: "center bottom",
              zIndex: mine ? 2 : 1,
            }}
          >
            <RankWing level={l.level} size={size} earned={l.level <= level} />
            <span
              className={`font-mono tabular-nums ${mine ? "text-command-gold" : "text-gray-3"}`}
              style={{ fontSize: mine ? 6.5 : 9, letterSpacing: ".08em" }}
            >
              FL{l.level}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The rolodex the real modal draws, minus the modal: a window of rows around
 *  the learner's rank, the current one grown, the rest falling away. */
function LadderColumn({ level, span = 5 }: { level: number; span?: number }) {
  const first = Math.max(0, Math.min(LEVELS.length - span, level - 1 - Math.floor(span / 2)));
  const rows = LEVELS.slice(first, first + span);
  return (
    <div
      style={{
        display: "grid",
        gap: 2,
        WebkitMaskImage: "linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)",
        maskImage: "linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)",
      }}
    >
      {rows.map((l) => {
        const d = Math.abs(l.level - level);
        const cur = d === 0;
        return (
          <div
            key={l.level}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 44,
              opacity: cur ? 1 : Math.max(0.3, 1 - d * 0.3),
            }}
          >
            <span className="font-mono text-[11px] text-command-gold" style={{ width: 10 }}>
              {cur ? "▸" : ""}
            </span>
            <div style={{ transform: cur ? "scale(1.7)" : "none", transformOrigin: "center" }}>
              <RankWing level={l.level} size={22} earned={l.level <= level} />
            </div>
            <div style={{ width: 150 }}>
              <p
                className={`font-mono text-[10px] uppercase tracking-[0.1em] ${cur ? "text-command-gold" : "text-muted"}`}
              >
                FL{l.level} &middot; {l.title}
              </p>
              {cur ? (
                <p className="font-numeral text-[10px] tabular-nums text-command-gold">
                  {num(l.minXp)} XP
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- the fanfare, fired on the downbeat -------------------------------------
//
// The real provider and the real banner. It cannot be scrubbed: the dwell and
// the three-dash countdown are wall-clock timers inside the component, so under
// a frozen clock it drops in and leaves again four seconds later. That is fine
// for looking and for a screenshot taken promptly; it is the ONE thing on this
// stage that a render pass would have to solve, and knowing that now is the
// point of putting it on screen.
function FanfareFirer({ t, frozen }: { t: number; frozen: boolean }) {
  const fire = useFanfare();
  const armed = useRef(false);
  useEffect(() => {
    if (t < 7.5) armed.current = false;
    if (t >= 8 && !armed.current) {
      armed.current = true;
      fire({ kind: "patch", label: PATCH.label, xp: PATCH.xp, art: PATCH.art });
    }
  }, [t, fire]);
  // Frozen, the banner still dismisses itself on its own timer, so re-fire it
  // to keep the frame inspectable. Wall clock on purpose, and only here.
  //
  // 4600ms, not 3400: the banner lives DWELL 4000 plus a 300ms exit, so a
  // shorter period stacks a second banner on the first - which is exactly what
  // the first screenshot showed, two "Badge earned FUNDAMENTALS" bars at once.
  useEffect(() => {
    if (!frozen || t < 8) return;
    const id = window.setInterval(
      () => fire({ kind: "patch", label: PATCH.label, xp: PATCH.xp, art: PATCH.art }),
      4600,
    );
    return () => window.clearInterval(id);
  }, [frozen, t, fire]);
  return null;
}

// ---- the stage --------------------------------------------------------------

export function LogbookLive({
  arrangement,
  lesson,
  libraryTotal,
  libraryDone,
  questions = [],
  tuning = DEFAULT_TUNING,
  fixedT,
  w = 880,
}: {
  arrangement: Arrangement;
  lesson: FilmLesson;
  libraryTotal: number;
  libraryDone: number;
  /** The arc round only. The lesson's real quiz, parsed server-side. */
  questions?: FilmQuestion[];
  /** The quiet round's four tuning axes. See tuning.ts. */
  tuning?: Tuning;
  /** Freeze the clock. Without it a capture lands wherever wall time was. */
  fixedT?: number;
  w?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const h = Math.round((w * 9) / 16);
  const frozen = fixedT !== undefined;
  const t = useSceneClock(SECONDS, fixedT, hostRef);

  // CLIENT ONLY, and not out of laziness. XpTick picks its float variant with
  // Math.random() at mount, which is correct for a page and produces a real
  // hydration mismatch here (server said v5, client said v1) - React logs it
  // and leaves the attribute unpatched, so the frame the pin is about to fix is
  // not the frame the server drew. Nothing on this stage is content anyone
  // needs from SSR, so the frame simply starts empty and fills.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- "have we hydrated yet" is exactly a mount flag; there is no external store to subscribe to
    setMounted(true);
  }, []);

  usePin(hostRef, t, arrangement, tuning.kinetic, tuning.jaunty);

  const win = (i: number): [number, number] =>
    [armAt(i), i + 1 < BEATS.length ? armAt(i + 1) : SECONDS] as [number, number];

  // The standing, moment by moment. The crossing sits EXACTLY on the FL6
  // threshold, so the ring closing and the wing changing are one event: the bar
  // fills across bar two, the rank flips on the downbeat, and the bar then
  // drains to the new band - which is not a flourish, it is what 1,100 XP
  // actually is (the top of FL5 and the floor of FL6 are the same number).
  const crossed = t >= 4;
  const level = crossed ? AFTER.level : BEFORE.level;
  const xp = Math.round(XP_BEFORE + (XP_AFTER - XP_BEFORE) * ramp(t, 2.0, 4.0));
  // The drain runs to 5.4 rather than 4.6 because a ring that empties in half a
  // second reads as a loss. Over most of the bar it reads as what it is: the
  // band you just finished handing over to the band you just started.
  const band = crossed
    ? 1 - ramp(t, 4.0, 5.4)
    : bandPct(XP_BEFORE, BEFORE.level) +
      (1 - bandPct(XP_BEFORE, BEFORE.level)) * ramp(t, 2.0, 4.0);
  // `.find`, not `LEVELS[level]`: the ladder is a const tuple, so indexing it
  // with a level that could be 12 is a compile error rather than an undefined.
  const nextRow = LEVELS.find((l) => l.level === level + 1) ?? null;
  const nextMinXp = nextRow?.minXp ?? null;
  const nextLevel = nextRow?.level ?? null;

  const standing: LearnLibraryStanding = {
    doneCount: libraryDone,
    totalCount: libraryTotal,
    rank: { level: BEFORE.level, title: BEFORE.title, xpTotal: XP_BEFORE },
    resume: { slug: lesson.slug, title: lesson.title, clusterLabel: lesson.clusterLabel, mode: "continue" },
  };

  const patchEntries: PatchEntry[] = ROADMAP_PATCHES.map((p) => ({
    key: p.key,
    label: p.label,
    howToEarn: p.howToEarn,
    earned: p.key === PATCH.key,
    art: artForBadge(p.key),
  }));

  // THE ARC RUNS ITS OWN ARITHMETIC, because its totals depend on how many
  // questions the lesson actually has - three fives is not the same film as two.
  // Everything is still derived: `before` comes backwards off the FL6 floor, so
  // the last award of bar one and the crossing are the same instant.
  const arc = arcSheet(questions.length);
  const arcXp =
    arc.before +
    QUIZ_XP * arc.ticks.filter((x) => t >= x).length +
    (t >= 2 ? XP_AFTER - arc.before - QUIZ_XP * arc.ticks.length : 0);
  const arcLevel = t >= 2 ? AFTER.level : BEFORE.level;
  const arcNext = LEVELS.find((l) => l.level === arcLevel + 1) ?? null;
  const arcRail: Rail = {
    level: arcLevel,
    title: LEVELS[arcLevel - 1].title,
    xp: arcXp,
    // Full on the downbeat, then handing over to the new band - the same read
    // the other rounds give the crossing, moved to where the arc puts it.
    band: t >= 2 ? 1 - ramp(t, 2.0, 3.2) : bandPct(arcXp, BEFORE.level),
    nextMinXp: arcNext?.minXp ?? null,
    nextLevel: arcNext?.level ?? null,
  };

  const rail: Rail = { level, xp, band, nextMinXp, nextLevel, title: LEVELS[level - 1].title };

  const scenes = (
    <>
      <style>{RAIL_CHROME}</style>
      <style>{QUIET_CSS}</style>
      {arrangement === "page" ? (
        <PageScene
          t={t}
          win={win}
          standing={standing}
          level={level}
          xp={xp}
          band={band}
          nextMinXp={nextMinXp}
          nextLevel={nextLevel}
          patchEntries={patchEntries}
          frozen={frozen}
        />
      ) : arrangement === "rail" ? (
        <RailScene
          t={t}
          win={win}
          level={level}
          xp={xp}
          band={band}
          nextMinXp={nextMinXp}
          nextLevel={nextLevel}
          lesson={lesson}
        />
      ) : arrangement === "emblem" ? (
        <EmblemScene t={t} win={win} level={level} />
      ) : arrangement === "strip" ? (
        <StripScene t={t} win={win} rail={rail} />
      ) : arrangement === "morph" ? (
        <MorphScene t={t} win={win} rail={rail} />
      ) : arrangement === "split" ? (
        <SplitScene t={t} win={win} rail={rail} lesson={lesson} />
      ) : arrangement === "quiet" ? (
        <QuietScene t={t} question={questions[0]} tuning={tuning} w={w} />
      ) : (
        <ArcScene t={t} rail={arcRail} questions={questions} sheet={arc} lesson={lesson} />
      )}

      {/* Solo is about one PART, so the words come off - otherwise the thing
          moving in the corner of every tile is the thing you are not judging. */}
      {tuning.solo ? null : (
      <LogbookType
        arrangement={arrangement}
        t={t}
        w={w}
        h={h}
        beats={
          arrangement === "arc" ? arc.beats : arrangement === "quiet" ? QUIET_BEATS : BEATS
        }
        bare={arrangement === "quiet"}
        kinetic={arrangement === "quiet" ? tuning.kinetic : "rise"}
        kineticPerBeat={arrangement === "quiet" ? tuning.kineticPerBeat : undefined}
        preRoll={arrangement === "quiet" ? (tuning.preRoll ?? 0) : 0}
        kineticOut={arrangement === "quiet" ? tuning.kineticOut : "none"}
        outDur={FLOWS[tuning.flow].outDur}
        pos={arrangement === "quiet" ? tuning.pos : undefined}
      />
      )}
    </>
  );

  // THE PROVIDER GOES INSIDE THE FRAME, not around it. FanfareProvider renders
  // its `fixed inset-x-0 top-0` banner as a SIBLING of its children, so a
  // transform on the scene box would not contain it - the containing block has
  // to be an ancestor of the BANNER. Hence the wrapper: it owns the aspect, the
  // clip and the transform, the provider sits inside it, and the banner lands in
  // this frame instead of at the top of the window with two other stages'.
  return (
    <div
      data-logbook-stage
      ref={hostRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "var(--color-deep-space, #08090d)",
        overflow: "hidden",
        transform: "translateZ(0)",
      }}
    >
      {!mounted ? null : arrangement === "page" ? (
        <FanfareProvider>{scenes}</FanfareProvider>
      ) : (
        scenes
      )}
    </div>
  );
}

// ---- A: the surfaces, filmed ------------------------------------------------

function PageScene({
  t,
  win,
  standing,
  level,
  xp,
  band,
  nextMinXp,
  nextLevel,
  patchEntries,
  frozen,
}: {
  t: number;
  win: (i: number) => [number, number];
  standing: LearnLibraryStanding;
  level: number;
  xp: number;
  band: number;
  nextMinXp: number | null;
  nextLevel: number | null;
  patchEntries: PatchEntry[];
  frozen: boolean;
}) {
  const box: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    // The type takes the bottom band, so the subject sits above it.
    padding: "9% 7% 34%",
    pointerEvents: "none",
  };
  return (
    <>
      <FanfareFirer t={t} frozen={frozen} />

      <div style={{ ...box, opacity: fade(t, ...win(0)) }} data-anim-at={0}>
        <div style={{ width: "100%", maxWidth: 620 }}>
          {/* The real /learn strip, mt-12 and all. */}
          <div style={{ marginTop: -48 }}>
            <LibraryStanding standing={standing} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              lesson complete
            </span>
            <XpTick amount={AWARD} />
          </div>
        </div>
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(1)) }} data-anim-at={BEATS[1].at - LEAD}>
        <StandingRail
          level={level}
          title={LEVELS[level - 1].title}
          xp={xp}
          nextMinXp={nextMinXp}
          nextLevel={nextLevel}
          bandPct={band}
        />
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(2)) }} data-anim-at={BEATS[2].at - LEAD}>
        <LadderColumn level={level} span={5} />
      </div>

      {/* The wall clears the banner rather than sharing the top of the frame
          with it: at 340px wide the four-column grid also ran two cluster
          labels into each other, so it is 520 here. Both are the same lesson -
          product UI brings its own layout assumptions and a film frame is not
          the column it was designed for. */}
      <div
        style={{ ...box, padding: "26% 7% 32%", opacity: fade(t, ...win(3)) }}
        data-anim-at={BEATS[3].at - LEAD}
      >
        <div style={{ width: 520 }}>
          <PatchWall entries={patchEntries} />
        </div>
      </div>
    </>
  );
}

// ---- B: one rail, four moments ---------------------------------------------

function RailScene({
  t,
  win,
  level,
  xp,
  band,
  nextMinXp,
  nextLevel,
  lesson,
}: {
  t: number;
  win: (i: number) => [number, number];
  level: number;
  xp: number;
  band: number;
  nextMinXp: number | null;
  nextLevel: number | null;
  lesson: FilmLesson;
}) {
  // The rail slides left once the ladder needs the right half, so nothing is
  // ever covered up - the composition rearranges instead of stacking.
  const shift = -ramp(t, 5.65, 6.3) * 21;
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "6% 7% 32%",
          pointerEvents: "none",
          transform: `translateX(${shift}%) scale(1.12)`,
        }}
      >
        <StandingRail
          level={level}
          title={LEVELS[level - 1].title}
          xp={xp}
          nextMinXp={nextMinXp}
          nextLevel={nextLevel}
          bandPct={band}
        />
      </div>

      {/* The award that caused it, over the rail's shoulder. */}
      <div
        data-anim-at={0}
        style={{
          position: "absolute",
          left: "9%",
          top: "16%",
          opacity: fade(t, ...win(0)),
          transform: "scale(1.5)",
          transformOrigin: "left top",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {lesson.clusterLabel ?? "The Library"}
        </p>
        <p className="mt-1 max-w-[260px] font-display text-lg leading-tight tracking-wide text-title">
          {lesson.title}
        </p>
        <div className="mt-1.5">
          <XpTick amount={AWARD} />
        </div>
      </div>

      {/* The ladder unrolls beside the rail rather than replacing it, and hands
          the right-hand slot to the patch on the last beat. The first pass let
          it run to the end and landed the patch on top of the rank wing it had
          spent two bars earning - the badge covered the thing it was the reward
          for. */}
      <div
        data-anim-at={BEATS[2].at - LEAD}
        style={{
          position: "absolute",
          right: "7%",
          top: "17%",
          opacity: fade(t, armAt(2), armAt(3)),
          transform: `translateX(${(1 - ramp(t, 5.65, 6.3)) * 12}%)`,
        }}
      >
        <LadderColumn level={level} span={5} />
      </div>

      <div
        data-anim-at={BEATS[3].at - LEAD}
        style={{
          position: "absolute",
          right: "11%",
          top: "20%",
          opacity: fade(t, armAt(3), SECONDS),
          transform: `scale(${0.74 + 0.26 * ramp(t, 7.65, 8.3)})`,
          transformOrigin: "center",
        }}
      >
        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <PatchBadge art={PATCH.art} earned size={140} />
          <p className="font-display text-lg tracking-wide text-title">{PATCH.label}</p>
        </div>
      </div>
    </>
  );
}

// ---- C: emblem space --------------------------------------------------------

function EmblemScene({
  t,
  win,
  level,
}: {
  t: number;
  win: (i: number) => [number, number];
  level: number;
}) {
  const box: React.CSSProperties = {
    position: "absolute",
    right: "8%",
    top: 0,
    bottom: 0,
    width: "50%",
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
  };
  return (
    <>
      <div style={{ ...box, opacity: fade(t, ...win(0)) }} data-anim-at={0}>
        <div style={{ transform: "scale(3.4)" }}>
          <XpTick amount={AWARD} />
        </div>
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(1)) }} data-anim-at={BEATS[1].at - LEAD}>
        <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
          <RankWing level={level} size={104} />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-command-gold">
            FL{level} &middot; {LEVELS[level - 1].title}
          </p>
        </div>
      </div>

      {/* Twelve wings in a row is a WIDTH problem, not a taste one: at the size
          the other emblems get, the line is half again wider than the frame.
          24 is the largest that fits this box (12 x 24 x 2.1 plus gaps = 662 of
          683 available), so the ladder beat is the one shot where the subject
          is small - which is itself the honest picture of a twelve-rank ladder. */}
      <div
        style={{ ...box, right: "4%", width: "70%", opacity: fade(t, ...win(2)) }}
        data-anim-at={BEATS[2].at - LEAD}
      >
        <LadderRow level={level} size={24} />
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(3)) }} data-anim-at={BEATS[3].at - LEAD}>
        <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
          <PatchBadge art={PATCH.art} earned size={196} />
          <p className="font-display text-2xl tracking-wide text-title">{PATCH.label}</p>
        </div>
      </div>
    </>
  );
}

// ---- round two: B and C together ------------------------------------------
//
// Three readings, because "combine them" is a question and not an instruction.
// B's claim is CONTINUITY - one surface, no cuts, the product doing the work.
// C's is AUSTERITY - film scale, nothing of the page left. D strips the
// continuous surface, E travels from one to the other, F runs both at once.
//
// NONE OF THE THREE MOUNTS THE FANFARE, which is not an omission: A was the
// only arrangement that did, and the banner is the one component on this stage
// whose dwell and countdown are wall-clock timers inside itself. Dropping A
// takes the last unscrubbable thing out of the film, so every frame of every
// one of these comes from a seek.

type Rail = {
  level: number;
  title: string;
  xp: number;
  band: number;
  nextMinXp: number | null;
  nextLevel: number | null;
};

function TheRail({ rail }: { rail: Rail }) {
  return (
    <StandingRail
      level={rail.level}
      title={rail.title}
      xp={rail.xp}
      nextMinXp={rail.nextMinXp}
      nextLevel={rail.nextLevel}
      bandPct={rail.band}
    />
  );
}

// ---- D: the rail, stripped --------------------------------------------------

function StripScene({
  t,
  win,
  rail,
}: {
  t: number;
  win: (i: number) => [number, number];
  rail: Rail;
}) {
  // The ring gives up a third of its size on the RANK downbeat so the ladder
  // has somewhere to be. It never leaves, which is B's whole claim.
  const open = ramp(t, 5.65, 6.3);
  const s = 1.95 - 0.6 * open;
  const slotH = 132 * open;
  return (
    <div
      data-rail-text="off"
      style={{
        position: "absolute",
        right: "5%",
        top: 0,
        bottom: 0,
        width: "60%",
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      {/* width:100% so the slot below is as wide as the BOX, not as wide as the
          ring. Without it the twelve-wing row was laid out against a 330px
          column, overflowed both sides, and lost FL10 to FL12 off the frame. */}
      <div style={{ display: "grid", justifyItems: "center", gap: 10, width: "100%" }}>
        <div style={{ height: RAIL_H * s, display: "grid", placeItems: "center" }}>
          <div data-rail style={{ transform: `scale(${s})`, transformOrigin: "center" }}>
            <TheRail rail={rail} />
          </div>
        </div>

        <div style={{ position: "relative", height: slotH, width: "100%" }}>
          <div
            data-anim-at={BEATS[2].at - LEAD}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              opacity: fade(t, armAt(2), armAt(3)),
            }}
          >
            <LadderRow level={rail.level} size={21} />
          </div>
          <div
            data-anim-at={BEATS[3].at - LEAD}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              opacity: fade(t, armAt(3), SECONDS),
              transform: `scale(${0.76 + 0.24 * ramp(t, 7.65, 8.3)})`,
            }}
          >
            <PatchBadge art={PATCH.art} earned size={118} />
          </div>
        </div>
      </div>

      {/* The award, over the ring's shoulder, on bar one only. */}
      <div
        data-anim-at={0}
        style={{
          position: "absolute",
          right: "6%",
          top: "13%",
          opacity: fade(t, ...win(0)),
          transform: "scale(2)",
          transformOrigin: "right top",
        }}
      >
        <XpTick amount={AWARD} />
      </div>
    </div>
  );
}

// ---- E: product becomes insignia -------------------------------------------

function MorphScene({
  t,
  win,
  rail,
}: {
  t: number;
  win: (i: number) => [number, number];
  rail: Rail;
}) {
  // Three ramps rather than one, so the growth happens BETWEEN beats and the
  // downbeats themselves stay still. 1.80 is the ceiling and it is arithmetic,
  // not taste: the rail is 190px unscaled and the usable height here is 351.
  const grow = 1 + 0.32 * ramp(t, 2.2, 4.0) + 0.36 * ramp(t, 4.6, 6.4) + 0.12 * ramp(t, 7.6, 8.4);
  const textOp = 1 - ramp(t, 4.2, 5.6);
  const payoff = ramp(t, 7.8, 8.5);
  // The subject holds the left of the frame, not the middle, which is what buys
  // the ladder a column instead of a collision.
  const subject: React.CSSProperties = {
    position: "absolute",
    left: "3%",
    top: 0,
    bottom: 0,
    width: "56%",
    display: "grid",
    placeItems: "center",
    // PERCENTAGE PADDING RESOLVES AGAINST WIDTH, not height - which is why the
    // first pass, reasoned about as a share of the frame's height, put the ring
    // 30px off the top edge instead of centred. These are tuned against the
    // rendered frame rather than derived.
    padding: "14% 0 26%",
  };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        ["--rail-text-op" as string]: String(textOp),
      }}
    >
      <div style={subject}>
        <div
          data-rail
          style={{
            transform: `scale(${grow}) translateX(${(1 - textOp) * RAIL_RECENTRE}px)`,
            transformOrigin: "center",
            // Dimmed, not removed. The ring is the halo the patch sits in, and
            // the argument of this arrangement is that you watched it get there.
            // 0.78 rather than 0.68 because the wing's feather tips reach wider
            // than the patch and were reading as something stuck to its side.
            opacity: 1 - 0.78 * payoff,
          }}
        >
          <TheRail rail={rail} />
        </div>
      </div>

      {/* THE ROLODEX, NOT THE TWELVE-WING ROW, and the reason is worth keeping:
          the first cut put the row across the top and the growing ring simply
          ate it - twelve wings and a ring at 1.8 do not both fit a 549px frame,
          whatever you do with them. A frame holds one big thing. That is the
          strongest argument D has, and it is why E and F both pay this price. */}
      <div
        data-anim-at={BEATS[2].at - LEAD}
        style={{
          position: "absolute",
          right: "4%",
          top: "44%",
          transform: `translateY(-50%) translateX(${(1 - ramp(t, 5.65, 6.3)) * 10}%)`,
          opacity: fade(t, armAt(2), SECONDS),
        }}
      >
        <LadderColumn level={rail.level} span={5} />
      </div>

      <div
        data-anim-at={BEATS[3].at - LEAD}
        style={{ ...subject, opacity: fade(t, armAt(3), SECONDS) }}
      >
        <div style={{ transform: `scale(${0.7 + 0.3 * payoff})` }}>
          <PatchBadge art={PATCH.art} earned size={186} />
        </div>
      </div>

      <div
        data-anim-at={0}
        style={{
          position: "absolute",
          left: "6%",
          top: "13%",
          opacity: fade(t, ...win(0)),
          transform: "scale(1.9)",
          transformOrigin: "left top",
        }}
      >
        <XpTick amount={AWARD} />
      </div>
    </div>
  );
}

// ---- F: two registers at once -----------------------------------------------

function SplitScene({
  t,
  win,
  rail,
  lesson,
}: {
  t: number;
  win: (i: number) => [number, number];
  rail: Rail;
  lesson: FilmLesson;
}) {
  const box: React.CSSProperties = {
    position: "absolute",
    right: "5%",
    top: 0,
    bottom: 0,
    width: "46%",
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
  };
  return (
    <>
      {/* The score keeper. Full product chrome, deliberately small, never
          touched by a beat - the one thing in the frame that does not change
          is the thing the film is about. */}
      <div
        data-rail
        style={{
          position: "absolute",
          left: "7%",
          top: "16%",
          transform: "scale(0.82)",
          transformOrigin: "left top",
          pointerEvents: "none",
        }}
      >
        <TheRail rail={rail} />
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(0)) }} data-anim-at={0}>
        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {lesson.clusterLabel ?? "The Library"}
          </p>
          <p className="max-w-[300px] text-center font-display text-xl leading-tight tracking-wide text-title">
            {lesson.title}
          </p>
          <div style={{ transform: "scale(2.4)", marginTop: 14 }}>
            <XpTick amount={AWARD} />
          </div>
        </div>
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(1)) }} data-anim-at={BEATS[1].at - LEAD}>
        <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
          <RankWing level={rail.level} size={92} />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-command-gold">
            FL{rail.level} &middot; {rail.title}
          </p>
        </div>
      </div>

      {/* The five-rank rolodex, not the twelve-wing row: half a frame cannot
          hold twelve wings at a size anyone can read, and shrinking them to fit
          would be the ladder beat losing the argument to the layout. */}
      <div style={{ ...box, opacity: fade(t, ...win(2)) }} data-anim-at={BEATS[2].at - LEAD}>
        <LadderColumn level={rail.level} span={5} />
      </div>

      <div style={{ ...box, opacity: fade(t, ...win(3)) }} data-anim-at={BEATS[3].at - LEAD}>
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: 12,
            transform: `scale(${0.78 + 0.22 * ramp(t, 7.65, 8.3)})`,
          }}
        >
          <PatchBadge art={PATCH.art} earned size={168} />
          <p className="font-display text-xl tracking-wide text-title">{PATCH.label}</p>
        </div>
      </div>
    </>
  );
}

// ---- round four: one thing at a time ----------------------------------------
//
// "Too much going on." Every earlier round put two or three things in a frame
// and asked the eye to rank them; this one holds ONE subject per beat and hands
// off between them, so nothing ever competes.
//
// THE HANDOFFS OVERLAP BY A TENTH OF A SECOND and the gaps are zero. An earlier
// cut let the quiz finish dissolving at 2.8 and brought the ring up at 3.65,
// which is nearly a second of empty frame - in a feed that is where the viewer
// leaves. Each subject now leaves as the next arrives.

// BIGGER AT SOURCE, not scaled up afterwards. The wheel is the only part made
// of text rows, and 10px mono blown up by a transform is a blurry 10px mono.
// Growing the row, the wing and the type instead means the fit scale is doing
// less work and the glyphs are rasterised at the size they are seen.
const CAR_ROW = 74;
const CAR_WIN = 5;
const CAR_WING = 38;
const CAR_TEXT = 300;

/** The ladder as a WHEEL rather than a list: it spins up from FL1, overshoots,
 *  and settles on the learner's rank. The wobble is a damped sine of scene time
 *  - a pure function of t, so it seeks like everything else here. A spring
 *  integrated frame to frame would not. */
function RankCarousel({ t, level, from }: { t: number; level: number; from: number }) {
  // IT STARTS AT FL3, NOT FL1, and that is a picture decision. The window shows
  // five rows with the focused one in the middle, so a wheel parked on the
  // first rank has nothing above it and reads as broken rather than as the
  // bottom of a ladder. Index 2 is the first position with a full window.
  const START = 2;
  const settle = ramp(t, from, from + 0.8);
  const wob =
    t >= from ? Math.max(0, 1 - (t - from) / 1.2) * Math.sin((t - from) * 10) * 0.42 : 0;
  const focus = START + (level - 1 - START) * settle + wob;
  return (
    <div style={{ position: "relative", height: CAR_ROW * CAR_WIN }}>
      {/* The focus band the real rank ladder draws. Without it the wheel is a
          list that happens to be moving; with it, it is a rolodex stopping. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: -14,
          right: -14,
          top: "50%",
          height: CAR_ROW,
          transform: "translateY(-50%)",
          borderTop: "1px solid rgba(200,150,62,.25)",
          borderBottom: "1px solid rgba(200,150,62,.25)",
          background: "rgba(200,150,62,.06)",
          borderRadius: 4,
        }}
      />
      <div
        style={{
          height: CAR_ROW * CAR_WIN,
          overflow: "hidden",
          WebkitMaskImage: "linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)",
          maskImage: "linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)",
        }}
      >
        <div
          style={{
            transform: `translateY(${CAR_ROW * ((CAR_WIN - 1) / 2 - focus)}px)`,
            willChange: "transform",
          }}
        >
          {LEVELS.map((l, i) => {
            const d = Math.abs(i - focus);
            const scale = d < 1 ? 1 + 0.85 * (1 - d) : 1;
            const mine = l.level === level;
            return (
              <div
                key={l.level}
                style={{
                  height: CAR_ROW,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  opacity: Math.max(0.16, 1 - d * 0.34),
                }}
              >
                {/* The marker points at the row from OUTSIDE it. On the right it
                    sat past a title that wraps, so it read as detached. */}
                <span
                  className="font-mono text-command-gold"
                  style={{ width: 18, fontSize: 17 }}
                >
                  {mine && d < 0.5 ? "▸" : ""}
                </span>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
                  <RankWing level={l.level} size={CAR_WING} earned={l.level <= level} />
                </div>
                {/* Wide enough that "FL6 - INSTRUMENT RATED" cannot wrap: a
                    wrapped title is the one row tall enough to break the wheel. */}
                <div style={{ width: CAR_TEXT }}>
                  <p
                    className={`font-mono uppercase tracking-[0.12em] ${
                      d < 0.5 ? "text-command-gold" : "text-muted"
                    }`}
                    style={{ fontSize: 15, whiteSpace: "nowrap" }}
                  >
                    FL{l.level} &middot; {l.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * THE THING PARALLAX SEPARATES AGAINST.
 *
 * Parallax is not an effect you can apply to one layer: it is the same motion
 * at different rates, so a film with a single plane has nothing to be parallax
 * BETWEEN. The subject and the word were already two; this is the third, and it
 * is deliberately almost nothing - a hex lattice and a dust field at a few
 * percent opacity, both drawn in CSS so there is no asset to ship and nothing
 * to load before a frame can be captured.
 *
 * At `off` it does not render at all rather than rendering still. An invisible
 * layer that still costs a composite on every frame is the kind of thing that
 * turns up later as a mysterious four milliseconds.
 */
function Backdrop({ t, cam, parallax }: { t: number; cam: Vec; parallax: Parallax }) {
  if (parallax === "off") return null;
  const v = parallaxVec(parallax, DEPTH.backdrop, cam);
  const drift = Math.sin(t * 0.22) * 0.6;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: "-8%",
        pointerEvents: "none",
        transform: `translate(${(v.x + drift).toFixed(3)}%, ${v.y.toFixed(3)}%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(200,150,62,.16) 0 1px, transparent 1.4px)",
          backgroundSize: "46px 46px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(241,236,224,.1) 0 1px, transparent 1.6px)",
          backgroundSize: "137px 119px",
        }}
      />
    </div>
  );
}

/**
 * The patch flip, on its own so the bench can loop six of them side by side.
 *
 * TWO REAL RENDERS, CROSSFADED, not a tween. `PatchBadge` draws locked and
 * earned as different pictures - dim plus desaturate against a gold scene - and
 * there is no colour to interpolate between them. `goldAt` is where in the
 * animation the swap hides: at the top of a stamp's impact, at the edge-on
 * frame of a card flip, and at zero for the ones that never occlude themselves.
 */
export function PatchFlip({
  t,
  at,
  spec,
  size = 210,
}: {
  t: number;
  at: number;
  spec: JauntySpec;
  size?: number;
}) {
  const gold = t >= at;
  // Two ways for the gold to arrive. `fade` swaps the renders in 80ms, hidden
  // by whatever the movement is doing at `goldAt`. `wipe` plates it across on a
  // diagonal, driven by scene time rather than by a keyframe, so a badge that
  // never moves can still visibly become yours.
  const p = clamp01((t - at) / spec.dur);
  const edge = -30 + 130 * p;
  const goldStyle: React.CSSProperties =
    spec.reveal === "wipe"
      ? {
          opacity: 1,
          WebkitMaskImage: `linear-gradient(118deg,#000 ${edge}%,transparent ${edge + 30}%)`,
          maskImage: `linear-gradient(118deg,#000 ${edge}%,transparent ${edge + 30}%)`,
        }
      : { opacity: clamp01((t - (at + spec.goldAt * spec.dur)) / 0.08) };
  return (
    <div className={gold ? `j-${spec.id}` : undefined} data-anim-at={at}>
      {/* The idle stops the moment the flip starts; two animations writing the
          same transform property fight, and the later one wins even while the
          earlier is still filling.
          Pinned ONE WHOLE PERIOD before the flip, so it is at rest on the frame
          the flip takes over. Its keyframes rest at 0% and 100% for exactly
          this. */}
      <div className={gold ? undefined : "j-wait"} data-anim-at={at - WAIT_PERIOD}>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <PatchBadge art={PATCH.art} earned={false} size={size} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              ...goldStyle,
            }}
          >
            <PatchBadge art={PATCH.art} earned size={size} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The type layer alone, over an empty frame, for judging an ENTRANCE.
 *
 * A kinetic is a property of one word arriving, and putting five complete cuts
 * on a page to compare five entrances means watching four subjects you are not
 * judging and paying for four QuizBlocks and four carousels to do it. This runs
 * the same clock and the same words with the picture removed.
 */
export function WordTile({
  kinetic,
  kineticOut = "none",
  outDur = 0.1,
  pos = "lower-left",
  w = 420,
  fixedT,
}: {
  kinetic: Kinetic;
  kineticOut?: KineticOut;
  outDur?: number;
  pos?: WordPos;
  w?: number;
  /** Freeze, so a screenshot lands on a chosen frame of the entrance. */
  fixedT?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useSceneClock(SECONDS, fixedT, ref);
  usePin(ref, t, kinetic);
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "var(--color-deep-space, #08090d)",
        overflow: "hidden",
      }}
    >
      <LogbookType
        arrangement="quiet"
        t={t}
        w={w}
        h={Math.round((w * 9) / 16)}
        beats={QUIET_BEATS}
        bare
        kinetic={kinetic}
        kineticOut={kineticOut}
        outDur={outDur}
        pos={pos}
      />
    </div>
  );
}

/** One candidate, looping on its own short clock, for the bench grid. */
export function FlipTile({
  spec,
  size = 150,
  fixedT,
}: {
  spec: JauntySpec;
  size?: number;
  /** Freeze. The tile's own cycle is 2.6s with the flip at 1.0, so 1.0 to 1.9
   *  is the part worth stopping on. */
  fixedT?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const CYCLE = 2.6;
  const AT = 1.0;
  const t = useSceneClock(CYCLE, fixedT, ref);
  usePin(ref, t, spec.id);
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "grid",
        placeItems: "center",
        height: size + 60,
        background: "var(--color-deep-space, #08090d)",
        overflow: "hidden",
      }}
    >
      <style>{QUIET_CSS}</style>
      <PatchFlip t={t} at={AT} spec={spec} size={size} />
    </div>
  );
}

function QuietScene({
  t,
  question,
  tuning,
  w,
}: {
  t: number;
  question?: FilmQuestion;
  tuning: Tuning;
  w: number;
}) {
  const quizRef = useRef<HTMLDivElement>(null);
  // EVERY SUBJECT SCALES WITH THE FRAME, because half of them are sized in
  // pixels that do not know how wide the frame is. The type already scales off
  // `w`; the quiz is page-sized prose, the ring is 168px of SVG and the patch
  // is a `size` in pixels. On the bench, where a stage is half width, the
  // unscaled version put a ring twice too big over a quiz clipped mid
  // explanation - the composition being judged was not the composition.
  //
  // `subjectScale` folds in the second reason: `corners` hands the top and the
  // bottom of the frame to the word, and the ring and the carousel were both
  // taller than what was left.
  const h = Math.round((w * 9) / 16);
  // WHERE THE ANSWER LANDS, on the 120 BPM grid. 1.5 is the last beat of bar
  // one, so the click is a call and READ on the bar line is the answer, one
  // beat apart. 1.0 puts two clear beats between them instead. Both are on the
  // grid; neither is where it was, which was "wherever 1.0 plus a 1.5s float
  // happened to finish".
  const click = tuning.quizClick ?? 1.5;

  // ONE click, on the real option. Same forward-only reconcile the arc uses:
  // state the target, fix it up, and press the component's own Start over when
  // the lap wraps.
  useIso(() => {
    const root = quizRef.current;
    if (!root || !question) return;
    if (t < click) {
      const over = Array.from(root.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Start over",
      );
      over?.click();
      return;
    }
    const field = root.querySelector("fieldset");
    if (!field || field.querySelector('[data-st="ok"]')) return;
    field.querySelectorAll<HTMLButtonElement>(".qzh-opt")[question.answer]?.click();
  }, [t, question, click]);

  const f = FLOWS[tuning.flow];
  // The composition, then the two overrides the bench can apply on top of it:
  // one motion for every part (so dynamics can be judged on its own), and one
  // part's spec (so a part can be judged on its own).
  // A candidate's own per-beat composition wins over the preset. `motionAll`
  // still overrides both, which is what the bench's dynamics round needs - and
  // is exactly why the first ten candidates all moved uniformly: they set it.
  let scheme = tuning.scheme ?? layoutById(tuning.layout).scheme;
  if (tuning.motionAll !== "auto") {
    scheme = Object.fromEntries(
      PARTS.map((p) => [p, { ...scheme[p], motion: tuning.motionAll as Motion }]),
    ) as typeof scheme;
  }
  if (tuning.part && tuning.partOver) {
    scheme = applyOverride(scheme, tuning.part, tuning.partOver);
  }
  const cam = cameraVec(tuning.camera, t, SECONDS);
  // THE FOUR SUBJECT WINDOWS, DERIVED FROM THE FLOW rather than written out.
  // Each subject holds until the next one arms, then hands over across one
  // `outDur`, so there is never a gap and never a stack - and changing the flow
  // moves all four together instead of leaving one behind.
  // THE PICTURE LANDS BEFORE THE SOUND DOES.
  //
  // Standard practice in animation and in scoring: a visual hit reads as
  // simultaneous with a beat when it arrives two to four frames EARLIER, and
  // never a frame later. At 30fps that is 0.067s to 0.133s, so the default is
  // 0.1 - and it is a whole-cut constant rather than a per-part nudge, because
  // what is being offset is the picture against the bed, not one shot against
  // another.
  const pre = tuning.preRoll ?? 0;
  const starts = [0, 4.0 - f.lead - pre, 6.0 - f.lead - pre, 8.0 - f.lead - pre];
  const ends = [
    starts[1] + f.outDur,
    starts[2] + f.outDur,
    starts[3] + f.outDur,
    SECONDS,
  ];
  // SOLO gives the chosen part the whole clip and hides the rest, so a place,
  // a size or an entrance can be looked at instead of waited for.
  const SOLO_WINDOW: [number, number] = [0.5, SECONDS - 0.4];
  const shot = (i: number): React.CSSProperties => {
    const id = PARTS[i];
    // THE FIT IS FOLDED INTO THE SPEC'S SIZE, not applied as a second wrapper.
    // A nested scale multiplies in the wrong order against the entrance and the
    // camera, so the entrance ends up scaled by the fit and a `grow` reads at a
    // different depth on a half-width stage than on a full one.
    const sized = { ...scheme[id], size: scheme[id].size * fitScale(id, w, h) };
    const [from, to] = tuning.solo ? SOLO_WINDOW : ([starts[i], ends[i]] as const);
    if (tuning.solo && tuning.solo !== id) return { opacity: 0, pointerEvents: "none" };
    return partStyle(sized, t, from, to, f.inDur, f.outDur, cam, tuning.parallax).style;
  };

  // THE BOX IS THE WHOLE FRAME NOW, and the fit fractions keep each part clear
  // of the corners instead of a band doing it. Two things fall out: `place`
  // offsets become percentages of the FRAME rather than of a band that changed
  // size with the word position, and a part can be as tall as it needs to be
  // without the word's corner deciding for it.
  const centre: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
  };

  // GAIN: the ring DRAWS ITSELF to where the learner now is, then the rank
  // changes under it. Not a claim that one question filled a band - the sweep
  // is a reveal and it lands on the true value, which after the click is the
  // top of FL5 and the floor of FL6 at the same time.
  const gainLevel = t >= starts[1] + 1.75 ? AFTER.level : BEFORE.level;

  // The flip sits on a MUSICAL position, half a bar after the word, so it does
  // not slide around when the flow changes. Everything else here is relative.
  const FLIP = 8.5;
  const spec = jauntyById(tuning.jaunty);

  return (
    <>
      <Backdrop t={t} cam={cam} parallax={tuning.parallax} />

      {/* READ */}
      <div data-quiz-bare style={{ ...centre, ...shot(0) }}>
        <div ref={quizRef} style={{ width: 560 }}>
          {question ? <QuizBlock prompt="Quick check" questions={[question]} /> : null}
        </div>
      </div>
      {/* THE TICK IS ON THE GRID AND CLEARS BEFORE THE DOWNBEAT.
          It used to pop on the click and hold to 2.6, so its float was still
          running while READ landed at 1.9 and the two events smeared into one
          another. Now it lands on its beat and is gone by 1.9, which leaves the
          downbeat to the word - a call on the last beat of the bar, the answer
          on the bar line. */}
      <div
        data-xp-film
        data-anim-at={click}
        style={{
          position: "absolute",
          right: "12%",
          top: "31%",
          opacity: fade(t, click, click + 0.75),
          transform: `scale(${2.1 * fitScale("quiz", w, h)})`,
          transformOrigin: "right top",
          pointerEvents: "none",
        }}
      >
        <XpTick amount={QUIZ_XP} />
      </div>

      {/* GAIN */}
      <div data-rail-text="off" style={{ ...centre, ...shot(1) }}>
        <div data-rail>
          <StandingRail
            level={gainLevel}
            title={LEVELS[gainLevel - 1].title}
            xp={XP_AFTER}
            nextMinXp={null}
            nextLevel={null}
            bandPct={ramp(t, starts[1] + 0.4, starts[1] + 1.6)}
          />
        </div>
      </div>

      {/* RANK */}
      <div style={{ ...centre, ...shot(2) }}>
        {/* +0.12, not +0.35: under `snappy` the arm is only a tenth of a beat
            before the word, and a third of a second of a parked wheel is the
            whole gap that flow was chosen to remove. */}
        <RankCarousel t={t} level={AFTER.level} from={starts[2] + 0.12} />
      </div>

      {/* PATCHES */}
      <div style={{ ...centre, ...shot(3) }}>
        <PatchFlip t={t} at={FLIP} spec={spec} size={210} />
      </div>
    </>
  );
}

// ---- round three: E, with the lesson at the front ---------------------------
//
// Bar one stops establishing and starts CAUSING. The real QuizBlock, the
// lesson's real questions, answered correctly on the half-beats, and the rail
// beside it counting the five XP each pick pays. The read award lands on 2.0
// and that is the frame where the total crosses the FL6 floor, the ring closes
// and the wing changes - one instant, not three near-misses.
//
// FROM 2.0 THIS IS E, UNCHANGED: the rail slides into the left, scales, sheds
// its text column, and ends as a dimmed halo behind the patch.

/** Drives the REAL QuizBlock by clicking its REAL options.
 *
 *  WHY CLICKING RATHER THAN A PROP. QuizBlock has no "show this as answered"
 *  input, and inventing one would mean shipping a fork of the assessment
 *  component so a promo could pose with it. It grades on pick, so the film
 *  picks. It is safe to drive because with no `context` and no `logbook` the
 *  component is a pure self-check - its own header calls that the editor-preview
 *  case - so not one of these clicks reaches a server action.
 *
 *  FORWARD-ONLY, WHICH IS WHAT SCRUBBING NEEDS. A click is not seekable
 *  backwards, so the rule is stated as a target ("how many should be solved by
 *  now") and reconciled: solve any that are behind, and on a wrap - target back
 *  to zero - press the component's own Start over. Frames are rendered in
 *  ascending t, so the target only ever grows within a lap. */
function QuizScroll({
  t,
  questions,
  ticks,
}: {
  t: number;
  questions: FilmQuestion[];
  ticks: number[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useIso(() => {
    const root = innerRef.current;
    if (!root) return;
    const target = ticks.filter((x) => t >= x).length;
    if (target === 0) {
      const over = Array.from(root.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Start over",
      );
      over?.click();
      return;
    }
    const fields = Array.from(root.querySelectorAll("fieldset"));
    fields.forEach((f, i) => {
      if (i >= target || f.querySelector('[data-st="ok"]')) return;
      const opts = f.querySelectorAll<HTMLButtonElement>(".qzh-opt");
      opts[questions[i].answer]?.click();
    });
  }, [t, questions, ticks]);

  // The scroll is written straight to the DOM rather than held in state: the
  // content grows as each explanation appears, so the travel has to be measured
  // every frame, and a setState here would be a render per frame for a number
  // React never needs to see.
  useIso(() => {
    const inner = innerRef.current;
    const box = boxRef.current;
    if (!inner || !box) return;
    const max = Math.max(0, inner.scrollHeight - box.clientHeight);
    inner.style.transform = `translateY(${-max * ramp(t, 0.15, 1.7)}px)`;
  }, [t]);

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        left: "5%",
        // Below the type layer's running index, which sits at 7%. At 9% the
        // quiz's own "Quick check" eyebrow ran straight through it.
        top: "15%",
        width: "42%",
        bottom: "9%",
        overflow: "hidden",
        WebkitMaskImage: "linear-gradient(180deg,transparent,#000 13%,#000 84%,transparent)",
        maskImage: "linear-gradient(180deg,transparent,#000 13%,#000 84%,transparent)",
      }}
    >
      <div ref={innerRef} style={{ willChange: "transform" }}>
        <QuizBlock prompt="Quick check" questions={questions} />
      </div>
    </div>
  );
}

function ArcScene({
  t,
  rail,
  questions,
  sheet,
  lesson,
}: {
  t: number;
  rail: Rail;
  questions: FilmQuestion[];
  sheet: ReturnType<typeof arcSheet>;
  lesson: FilmLesson;
}) {
  const grow = 1 + 0.32 * ramp(t, 2.2, 4.0) + 0.36 * ramp(t, 4.6, 6.4) + 0.12 * ramp(t, 7.6, 8.4);
  const textOp = 1 - ramp(t, 4.2, 5.6);
  const payoff = ramp(t, 7.8, 8.5);
  // The rail crosses the frame once, between the lesson and the morph. It is
  // the same continuous move E already makes, given somewhere to start.
  const railLeft = 50 - 49 * ramp(t, 1.8, 2.9);
  const subject: React.CSSProperties = {
    position: "absolute",
    left: `${railLeft}%`,
    top: 0,
    bottom: 0,
    width: "44%",
    display: "grid",
    placeItems: "center",
    padding: "14% 0 26%",
  };
  // All six LOCKED on the PATCHES beat: the wall is the shape of the thing, and
  // the one that lights up is the next beat's job. Wings is left out because
  // this beat's line says six clusters, six patches, and seven tiles would make
  // that a lie on screen.
  const wall: PatchEntry[] = ROADMAP_PATCHES.filter((p) => p.key.startsWith("cluster:")).map(
    (p) => ({
      key: p.key,
      label: p.label,
      howToEarn: p.howToEarn,
      earned: false,
      art: artForBadge(p.key),
    }),
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        ["--rail-text-op" as string]: String(textOp),
      }}
    >
      {/* BAR ONE: the lesson.
          NOT `armAt(0)`. That is 0 by design - beat one's picture is up from
          frame zero and only its WORD waits for the downbeat - so a window of
          `0 .. armAt(0) + 0.5` closed the quiz at 0.5s. The XP kept counting,
          because the clicks were landing on a component nobody could see, which
          is exactly the failure that looks like a styling problem. The lesson
          holds until the word takes over. */}
      <div style={{ opacity: fade(t, 0, 2.15), pointerEvents: "none" }}>
        <QuizScroll t={t} questions={questions} ticks={sheet.ticks} />
      </div>
      <div
        style={{
          position: "absolute",
          left: `${railLeft + 4}%`,
          top: "13%",
          opacity: fade(t, 0, 2.15),
          pointerEvents: "none",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {lesson.clusterLabel ?? "The Library"}
        </p>
        <p className="mt-0.5 font-display text-lg leading-tight tracking-wide text-title">
          {lesson.title}
        </p>
      </div>

      {/* The rail, present from frame zero, counting what the picks pay. */}
      <div style={{ ...subject, pointerEvents: "none" }}>
        <div
          data-rail
          style={{
            transform: `scale(${grow}) translateX(${(1 - textOp) * RAIL_RECENTRE}px)`,
            transformOrigin: "center",
            opacity: 1 - 0.78 * payoff,
          }}
        >
          <TheRail rail={rail} />
        </div>
      </div>

      {/* One tick per correct pick, in a row UNDER the rail. They were stacked
          beside it and landed on top of the rank title - the rail's text column
          is the one part of that half of the frame that is already occupied. */}
      {sheet.ticks.map((x, i) => (
        <div
          key={x}
          data-anim-at={x}
          style={{
            position: "absolute",
            left: `${railLeft + 4 + i * 13}%`,
            top: "63%",
            opacity: fade(t, x, x + 0.9),
            transform: "scale(1.6)",
            transformOrigin: "left top",
            pointerEvents: "none",
          }}
        >
          <XpTick amount={QUIZ_XP} />
        </div>
      ))}

      {/* 4.0 RANK: where FL6 sits among twelve. */}
      <div
        data-anim-at={3.65}
        style={{
          position: "absolute",
          right: "5%",
          top: "44%",
          transform: `translateY(-50%) translateX(${(1 - ramp(t, 3.65, 4.3)) * 10}%)`,
          opacity: fade(t, 3.65, 5.65),
          pointerEvents: "none",
        }}
      >
        <LadderColumn level={rail.level} span={5} />
      </div>

      {/* 6.0 PATCHES: the wall, all six still locked. */}
      <div
        data-anim-at={5.65}
        style={{
          position: "absolute",
          right: "3%",
          top: "44%",
          width: "52%",
          transform: "translateY(-50%)",
          opacity: fade(t, 5.65, 7.65),
          pointerEvents: "none",
        }}
      >
        <PatchWall entries={wall} />
      </div>

      {/* 8.0 EARNED: the one that lands, over the ring it came out of. */}
      <div
        data-anim-at={7.65}
        style={{ ...subject, opacity: fade(t, 7.65, SECONDS), pointerEvents: "none" }}
      >
        <div style={{ transform: `scale(${0.7 + 0.3 * payoff})` }}>
          <PatchBadge art={PATCH.art} earned size={186} />
        </div>
      </div>
    </div>
  );
}
