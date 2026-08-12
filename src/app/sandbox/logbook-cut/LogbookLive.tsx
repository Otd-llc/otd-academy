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
import {
  AFTER,
  AWARD,
  BEATS,
  BEFORE,
  LEAD,
  PATCH,
  SECONDS,
  XP_AFTER,
  XP_BEFORE,
  armAt,
  bandPct,
  num,
  type Arrangement,
} from "./beats";
import { LogbookType } from "./LogbookType";

/** useLayoutEffect, minus the server warning. The pin MUST run before paint or
 *  the frame a beat mounts on shows one unpinned frame of its animation. */
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type FilmLesson = { slug: string; title: string; clusterLabel: string | null };

const IN = 0.22;
const OUT = 0.14;

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
  fixedT,
  w = 880,
}: {
  arrangement: Arrangement;
  lesson: FilmLesson;
  libraryTotal: number;
  libraryDone: number;
  /** Freeze the clock. Without it a capture lands wherever wall time was. */
  fixedT?: number;
  w?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The running clock and the frozen one are the same value DERIVED, not one
  // state pushed into the other: `setT(fixedT)` inside the effect was a
  // setState-in-effect, and worse, it made the freeze arrive a render late.
  const [tick, setTick] = useState(0);
  const h = Math.round((w * 9) / 16);
  const frozen = fixedT !== undefined;
  const t = fixedT ?? tick;

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

  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      setTick(((now - start) / 1000) % SECONDS);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [frozen]);

  // THE CLOCK OWNS EVERY ANIMATION UNDER THE STAGE. Pause, then pin
  // currentTime to time-since-the-beat-this-element-belongs-to. Elements tag
  // themselves with data-anim-at; anything untagged runs from zero.
  //
  // The XpTick's float variant is picked with Math.random() at mount, which is
  // right for a page and wrong for a film - two renders of the same frame would
  // differ. Pinning it to v1 here is the same deliberate reach past a component
  // that ClusterLive makes for useScrollReveal, and for the same reason.
  useIso(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll(".xp-pop").forEach((el) => {
      el.classList.remove("v2", "v3", "v4", "v5");
      el.classList.add("v1");
    });
    for (const a of host.getAnimations({ subtree: true })) {
      const target = (a.effect as KeyframeEffect | null)?.target ?? null;
      if (!target) continue;
      const owner = target.closest("[data-anim-at]") as HTMLElement | null;
      const at = Number(owner?.dataset.animAt ?? 0);
      a.pause();
      try {
        // `CSSNumberish` in the current lib.dom; the browser takes plain ms.
        (a as unknown as { currentTime: number }).currentTime = Math.max(0, (t - at) * 1000);
      } catch {
        /* an animation can be replaced mid-pin; the next frame re-pins it */
      }
    }
  }, [t, arrangement]);

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

  const scenes = (
    <>
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
      ) : (
        <EmblemScene t={t} win={win} level={level} />
      )}

      <LogbookType arrangement={arrangement} t={t} w={w} h={h} />
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
