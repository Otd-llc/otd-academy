"use client";

// Round 2 renderers. Scrub-only, shares-of-frame, tokens-only.
//
// THE COLOUR RULE IS ABSOLUTE HERE. Not one literal hex, not one `#fff`, not one
// `text-white`. Every colour resolves through `var(--color-*)`, which is what
// makes the theme toggle on this page a real test rather than a decoration: a
// hardcoded colour simply fails to flip, visibly, and the round catches it
// instead of the decontamination backlog catching it later.
//
// FOUR FACES, FOUR JOBS. Bebas (`--font-display`) for titles, Saira
// (`--font-numeral`) for the NUMBER-HERO - a big hex/stat readout - Space Mono
// (`--font-mono`) for eyebrows, labels and console chrome, Lora
// (`--font-serif`) for the reading voice. Round 1 set number-heroes in mono,
// which is the substitution the system calls out.
//
// THE LINE IS SIZE AND ROLE, NOT GLYPH. globals.css scopes Saira to "big
// hex/stat number-heroes + instrument readouts" and says "codes/labels still
// Space Mono" in the same breath. So `outro/count` sets `NN / NN` in Saira at
// ts(7) because it is a hero, and `Chapter` sets the same glyphs in mono at
// ts(1.3) because it is chrome. That is not two rules; it is one rule applied
// to two sizes. This paragraph used to read "Saira for every number including
// small inline ones", which contradicted the chapter piece the moment it
// landed.
//
// ASCII only.

import type { Stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/stages";
import { combAbbr } from "@/lib/phase-comb";
import { stageArt, stageArtGhost } from "@/lib/guide-stage-art";
import { STAGE_ORDER } from "../furniture";
import { WELLS_16X9, GRAPHICS_16X9, GRAPHICS_SAFE_INSET, LOWER_THIRD_BOTTOM } from "../youtube";
import { furnitureOutStack, exitP, DEFAULT_EXIT, type FurnitureOut } from "./exits";
import { entryStack, DEFAULT_ENTRY, type EntryEffect } from "./entries";
import { EntryProvider } from "./Part";
import { PIECES, type PieceKey } from "./variants";
import { Ghost, CombWalk, Hairline } from "./Render2";
import { Chapter } from "./Chapter";
import { Carousel, type Cell as CombCell2 } from "@/app/sandbox/comb-carousel/Carousel";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "@/lib/pdf/certificate-content";
import { ts, hw } from "./units";

// ---- easing ----------------------------------------------------------------
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const outCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
/**
 * DEPRECATED, and kept only so the deprecation is visible at every call site.
 *
 * `inOut` fuses an entrance and an exit into ONE number. That was fine while a
 * treatment owned its whole life, and it is exactly wrong now: the exit is a
 * pulled-out dimension the owner dials from the exit stack, and an exit baked
 * into an entrance driver is one the stack cannot see, cannot change and
 * cannot turn off. Every piece using this ALSO gets the frame-level exit, so
 * they double-fade - section fades locally at 1.35 while the frame exit starts
 * at 1.25, lower at 3.3 against 3.45, hairline 3.4 against 3.45, combwalk 1.8
 * against 1.65.
 *
 * Use `entryP` and let `PieceFrame` own the exit.
 */
export const inOut = (t: number, a: number, b: number, c: number, d: number) =>
  Math.min(outCubic(seg(t, a, b)), 1 - outCubic(seg(t, c, d)));

/**
 * Arrival progress, 0 to 1. The entrance half of the old `inOut`, with the exit
 * half deliberately absent: a piece arrives here and LEAVES through the exit
 * stack, which is the only place an exit should live.
 */
export const entryP = (t: number, a: number, b: number) => outCubic(seg(t, a, b));

export const GOLD = "var(--color-command-gold)";
export const TITLE = "var(--color-title)";
export const TEXT = "var(--color-text)";
export const MUTED = "var(--color-muted)";
export const FIELD = "var(--color-deep-space)";
export const HAIR = "var(--color-panel-border)";

export type VProps = {
  piece: string;
  /** How the piece LEAVES, as a STACK applied outermost first. Defaulted, never
   *  absent - see DEFAULT_EXIT, which is a chosen fade rather than the fade
   *  you get when nobody decides. */
  exit?: FurnitureOut[];
  /** How the piece ARRIVES, as a STACK applied outermost first. The entrance
   *  was baked into each treatment until the mixer pulled it out - the same
   *  mistake the exit had, and for the same reason: a dimension hidden inside
   *  sixty variants is a dimension nobody can dial. */
  entry?: EntryEffect[];
  variant: string;
  stage: Stage;
  title: string;
  lesson: string;
  t: number;
  /** frame width / height. Needed only where a GROUP of physically-sized
   *  elements has to fit the frame - see CombWalk. */
  aspect?: number;
  guides?: boolean;
};

/**
 * Pieces that do NOT take an exit, because they never leave.
 *
 * `PieceFrame` used to apply the exit stack to every piece without exception,
 * which is right for a timed insert and precisely wrong for a persistent one:
 * the chapter indicator - whose entire premise is that it stays on screen -
 * dissolved out over the last 0.55 s of its own audition, by default, including
 * under the measurement rig. The round was asking the owner to judge a
 * persistent element by watching it exit.
 *
 * THE OUTRO IS THE SAME CASE and was missed. An end screen arrives and HOLDS
 * until the video stops; there is no frame after it to cut to, so an exit
 * animates the composition away while the viewer is still deciding whether to
 * click it - and YouTube's own end-screen elements sit on top of it for the
 * whole window. It was fading out at `seconds - 0.55` like every timed insert.
 */
const PERSISTENT: ReadonlySet<string> = new Set(["chapter", "outro"]);

export function PieceFrame(p: VProps) {
  // THE EXIT IS APPLIED HERE, ONCE, for every piece that HAS one. Doing it
  // per-variant is how ten treatments end up with nine fades and one considered
  // ending; doing it to a persistent piece is how it stops being persistent.
  const seconds = (PIECES[p.piece as PieceKey] ?? PIECES.intro).seconds;
  // One wrapper per stacked exit, outermost first. See furnitureOutStack for
  // why this is nesting rather than a merged style object.
  const outLayers = PERSISTENT.has(p.piece)
    ? []
    : furnitureOutStack(p.exit?.length ? p.exit : [DEFAULT_EXIT], exitP(p.t, seconds));
  // Entry wrappers sit INSIDE the exit wrappers: a piece that is arriving and
  // a piece that is leaving are two gestures on one object, and the exit owns
  // the outer coordinate space because it acts on the assembly as a whole.
  const inLayers = entryStack(p.entry ?? DEFAULT_ENTRY, p.t);
  const layers = [...outLayers, ...inLayers];
  const body = (
    <div
      data-furniture
      style={{
        position: "absolute",
        inset: 0,
        containerType: "size",
        overflow: "hidden",
        background: FIELD,
        fontFamily: "var(--font-display)",
      }}
    >
      {p.piece === "intro" ? <Intro {...p} /> : null}
      {p.piece === "ghost" ? <Ghost {...p} /> : null}
      {p.piece === "combwalk" ? <CombWalk {...p} /> : null}
      {p.piece === "hairline" ? <Hairline {...p} /> : null}
      {p.piece === "section" ? <Section {...p} /> : null}
      {p.piece === "lower" ? <Lower {...p} /> : null}
      {p.piece === "outro" ? <Outro {...p} /> : null}
      {p.piece === "chapter" ? <Chapter {...p} /> : null}
    </div>
  );

  const wrapped = layers.reduceRight(
    (inner, style, i) => (
      <div key={i} data-fx-layer={i} style={{ position: "absolute", inset: 0, ...style }}>
        {inner}
      </div>
    ),
    body,
  );
  // The provider sits OUTSIDE the wrappers so a part can be driven whether or
  // not the piece as a whole is.
  return (
    <EntryProvider stack={p.entry ?? DEFAULT_ENTRY} t={p.t}>
      {wrapped}
    </EntryProvider>
  );
}

// ---- shared ----------------------------------------------------------------

export function Eyebrow({ children, o = 1, size = 1.35 }: { children: React.ReactNode; o?: number; size?: number }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: ts(size),
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: GOLD,
        opacity: o,
      }}
    >
      {children}
    </div>
  );
}

export function Title({ children, size = 4, o = 1, dy = 0 }: { children: React.ReactNode; size?: number; o?: number; dy?: number }) {
  return (
    <h1
      style={{
        fontFamily: "var(--font-display)",
        fontSize: ts(size),
        lineHeight: 1.08,
        letterSpacing: "0.005em",
        color: TITLE,
        opacity: o,
        transform: `translateY(${dy}cqh)`,
        margin: 0,
      }}
    >
      {children}
    </h1>
  );
}

/** The signature readout. Saira, gold - for ANY number, including a small
 *  inline one.
 *
 *  `tabular-nums` below is INERT and is kept only because the design system
 *  asks for it by name. Measured: Saira Condensed's digit advances at 200px are
 *  95.8 63.8 91.2 88.6 94.6 91.8 95 85.4 97.8 95 - nine distinct widths, `1`
 *  53% narrower than `8` - and the family ships no `tnum` feature in GSUB, so
 *  there is nothing for the property to switch on. Bebas, by contrast, is
 *  already perfectly tabular (every digit 80).
 *
 *  CONSEQUENCE, and it is a real one: a numeral that CHANGES over time in this
 *  face will reflow as it changes. That is survivable here only because
 *  counting numerals are on the research ban list; if a counter ever comes
 *  back, it needs a per-digit fixed-width span, not this component. */
export function Num({ children, size = 6, color = GOLD }: { children: React.ReactNode; size?: number; color?: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-numeral)",
        fontWeight: 800,
        fontSize: ts(size),
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
        color,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Bebas cap height / em = 0.700; Saira Condensed 800 = 0.690. Swapping the face
 * at an unchanged `font-size` therefore shrinks the cap by 1.45%, which is
 * invisible on its own and becomes a mystery the third time someone asks why
 * the lower third looks smaller than it used to. Hold the cap instead.
 */
const CAP_MATCH = 0.700 / 0.690;

/**
 * A DESIGNATOR or a VALUE: `AP2112K-3.3`, `10 uF / 16 V / X7R`, `SS34`.
 * Alphanumeric, and critically WITHOUT LEXICAL CONTEXT - nobody recovers a
 * misread `C11` the way they recover a misread `the`.
 *
 * WHY THIS IS NOT BEBAS, measured rather than cited: in Bebas Neue the glyphs
 * `0` and `O` are THE SAME DRAWING. Identical ink and identical advance
 * (15.36/15.36 at delivery size, 120.00/120.00 at 300px), with a control pair
 * differing at both sizes. So a Bebas `C0` and a Bebas `CO` are not merely hard
 * to tell apart, they are the same picture, and no size, weight, contrast or
 * hold duration can separate them. Saira draws them differently (advance 18.39
 * vs 19.47). That is the whole argument; the counter-width one below is a
 * bonus.
 *
 * Advance-per-cap, measured from the served fonts: Bebas 0.600, Saira 0.752,
 * Arial 1.010. Legibility at threshold is limited by counter width, so the
 * swap buys about 25% more of it at the same cap height.
 *
 * `"zero" 1` IS CURRENTLY INERT and is set deliberately anyway. The upstream
 * SairaCondensed-ExtraBold.ttf carries `zero` in GSUB (aalt case ccmp dnom frac
 * liga locl ordn salt sups titl zero), but the Google Fonts css2 API strips it
 * from the woff2 that globals.css actually loads: rendering `0` with the
 * feature on and off is pixel-identical via the CDN and DIFFERS when the
 * upstream TTF is injected directly. Self-hosting that file is what makes this
 * line start working; until then the swap stands on `0` != `O`, which needs no
 * feature at all.
 *
 * WORDS DO NOT COME HERE. `USB differential pair` is prose and belongs in
 * Bebas. Bebas is for words, not parts.
 */
export function Desig({
  children,
  size = 2,
  color = TEXT,
  o = 1,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  o?: number;
}) {
  return (
    <span
      // Declared so the face check can assert on INTENT rather than on a
      // guessed selector, and so a reviewer sees the classification in the diff.
      data-kind="part"
      style={{
        fontFamily: "var(--font-numeral)",
        fontWeight: 800,
        fontSize: ts(size * CAP_MATCH),
        // Opens the counters a little further, which is the axis that actually
        // limits reading an alphanumeric run at threshold.
        letterSpacing: "0.02em",
        fontFeatureSettings: '"zero" 1',
        color,
        opacity: o,
        lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  );
}

/**
 * A rule.
 *
 * `w` is authored in the 16:9 `cqw` scale like every other size in this
 * sandbox, and is emitted through `hw()`. It used to emit `${w}cqw` directly,
 * which quietly bypassed BOTH fixes this round shipped: the short-edge
 * conversion, so every rule in the set was 1.78x wrong in one delivery, and the
 * 2px-at-1080 codec floor, so a thin rule could land sub-pixel and produce
 * exactly the ringing `hw()` exists to prevent. The helpers were correct and
 * the one component that draws most of the rules did not call them.
 */
export function Hair({ p = 1, w = 0.14, color = GOLD }: { p?: number; w?: number; color?: string }) {
  return <div style={{ height: hw(w), width: `${p * 100}%`, background: color }} />;
}

/** The brand hex, using the real polygon geometry the `.gh-hex` SVG uses rather
 *  than a clip-path lookalike. */
export function Hex({
  children,
  size,
  filled,
  p = 1,
  dim,
}: {
  children?: React.ReactNode;
  size: number;
  filled?: boolean;
  p?: number;
  dim?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: `${size}cqw`, height: `${size * 1.1547}cqw`, opacity: p }}>
      <svg viewBox="0 0 100 115.47" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <polygon
          points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87"
          fill={filled ? GOLD : FIELD}
          stroke={filled ? GOLD : dim ? HAIR : "var(--color-gold-dim)"}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

/** The eight-stage comb, in the product's own hex language. */
export function Comb({ stage, size, lit = 1, prev }: { stage: Stage; size: number; lit?: number; prev?: Stage }) {
  const i = STAGE_ORDER.indexOf(stage);
  const pi = prev ? STAGE_ORDER.indexOf(prev) : -1;
  return (
    <div style={{ display: "flex", gap: `${size * 0.09}cqw` }}>
      {STAGE_ORDER.map((s, n) => {
        const isCur = n === i;
        const isPrev = n === pi;
        const done = n < i;
        const on = isCur ? lit : isPrev ? 1 - lit : 0;
        return (
          <Hex key={s} size={size} filled={on > 0.5} dim={!done && !isCur && !isPrev}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: ts(size * 0.25),
                letterSpacing: "0.06em",
                fontWeight: on > 0.5 ? 700 : 400,
                color: on > 0.5 ? FIELD : done ? GOLD : MUTED,
              }}
            >
              {combAbbr(s)}
            </span>
          </Hex>
        );
      })}
    </div>
  );
}

/** One full guide hex: Saira number owning the top, title, lead, status chip.
 *  The build-guide hub's actual anatomy. */
/** The guide hub's stage anatomy. `kind` is REQUIRED, not defaulted: the first
 *  pass hardcoded the chip to "current" and rendered a row of three stages all
 *  claiming to be current, which is a card that lies about where the viewer is. */
export function GuideHex({
  stage,
  size,
  num,
  kind,
}: {
  stage: Stage;
  size: number;
  num: string;
  kind: "done" | "current" | "pending";
}) {
  const accent = kind === "pending" ? MUTED : GOLD;
  return (
    <div style={{ position: "relative", width: `${size}cqw`, height: `${size * 1.1547}cqw` }}>
      <svg viewBox="0 0 100 115.47" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <polygon
          points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87"
          fill={FIELD}
          stroke={kind === "current" ? GOLD : "var(--color-gold-dim)"}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: `${size * 0.02}cqw`,
          padding: `0 ${size * 0.16}cqw`,
          textAlign: "center",
        }}
      >
        <Num size={size * 0.3} color={accent}>{num}</Num>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: ts(size * 0.115),
            color: kind === "current" ? TITLE : MUTED,
            lineHeight: 1.05,
          }}
        >
          {STAGE_LABELS[stage]}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: ts(size * 0.055),
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: accent,
            border: `0.06cqw solid ${accent}`,
            padding: `${size * 0.018}cqw ${size * 0.05}cqw`,
          }}
        >
          {kind}
        </div>
      </div>
    </div>
  );
}

// ---- INTRO / ARTIFACT (10) --------------------------------------------------

function Intro({ variant, stage, title, lesson, t }: VProps) {
  // THE OUTRO'S MIRROR. Same hex, same gutter, same scroll, same trace-and-vise
  // lock - and the only difference is where it lands. The outro travels from the
  // stage just finished to the NEXT one; the intro travels from the stage BEFORE
  // to the one this video is about. Arriving is handing over, run backwards.
  //
  // Everything the outro round settled comes with it rather than being decided
  // again: sized off the viewport not the column, `show` filling the box with the
  // window, type cell-relative through `.comb-video`, the wells left empty, the
  // lock drawn behind the artwork and resting proud of the outline.
  const i = Math.max(0, STAGE_ORDER.indexOf(stage));
  const from = Math.max(0, i - 1);
  const cold = variant === "arrive-cold";

  const inP = outCubic(seg(t, 0, 0.8));
  const travel = cold ? 1 : outCubic(seg(t, 0.5, 2.1));
  const landed = from + (i - from) * travel;
  // The lock closes once the run has arrived. On the cold open there is no
  // travel, so it closes immediately and the first frame is already the answer.
  const lockP = outCubic(seg(t, cold ? 0.25 : 2.0, cold ? 1.0 : 2.8));
  const late = outCubic(seg(t, 1.4, 2.4));

  const cells: CombCell2[] = STAGE_ORDER.map((s, n) => ({
    stage: s as CombCell2["stage"],
    num: String(n + 1).padStart(2, "0"),
    title: STAGE_LABELS[s],
    lead: "",
    kind: n < i ? "done" : n === i ? "current" : "pending",
    statusText: n < i ? "done" : n === i ? "here" : n === i + 1 ? "next" : "locked",
  }));

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* The mark, in the same well the outro uses, so a viewer meets the same
          object at both ends of the video. */}
      <div
        style={{
          position: "absolute",
          left: `${GRAPHICS_16X9.x * 100}cqw`,
          top: `${GRAPHICS_16X9.y * 100}cqh`,
          width: `${GRAPHICS_16X9.w * 100}cqw`,
          height: `${GRAPHICS_16X9.h * 100}cqh`,
          // A COLUMN, not a centred grid. Both children centred in the same cell
          // stacked the title straight over the mark. The mark also has to give
          // ground when a title is present - it cannot hold the whole well and
          // leave room underneath it.
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: inP,
        }}
      >
        <svg
          viewBox={BRANDMARK_VIEWBOX}
          style={{
            width: variant === "arrive-title" ? "54%" : "100%",
            height: "auto",
            display: "block",
          }}
          aria-hidden
        >
          <defs>
            <linearGradient id="intro-mk" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={GOLD} />
              <stop offset="100%" stopColor="var(--color-gold-light)" />
            </linearGradient>
          </defs>
          <path d={BRANDMARK_PATH} fill="url(#intro-mk)" />
        </svg>
        {variant === "arrive-title" ? (
          <div style={{ marginTop: "2.2cqh", textAlign: "center", opacity: late }}>
            <Eyebrow o={late}>{lesson}</Eyebrow>
            <div style={{ marginTop: "1.2cqh" }}>
              <Title size={2.4} o={late}>
                {title}
              </Title>
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: "30cqw",
          width: "29cqw",
          top: 0,
          height: "100cqh",
          opacity: inP,
        }}
      >
        <Carousel
          cells={cells}
          current={i}
          centreOn={landed}
          ghost="veil"
          veil={{ top: 20, bottom: 70 }}
          art="art-only"
          show={4.6}
          lock="trace-vise"
          lockP={lockP}
          video
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "7cqh",
          textAlign: "center",
          opacity: late,
        }}
      >
        <Eyebrow o={late}>{URL}</Eyebrow>
      </div>
    </div>
  );
}

function Section({ variant, stage, t }: VProps) {
  const life = entryP(t, 0, 0.55);
  const lit = outCubic(seg(t, 0.35, 1));
  const i = STAGE_ORDER.indexOf(stage);
  const num = String(i + 1).padStart(2, "0");
  const prev = i > 0 ? STAGE_ORDER[i - 1] : undefined;

  const centre = (children: React.ReactNode) => (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: life }}>{children}</div>
  );

  switch (variant) {
    case "guide-row":
      return centre(
        <div style={{ display: "flex", gap: "1.4cqw", alignItems: "center" }}>
          {[i - 1, i, i + 1]
            .filter((n) => n >= 0 && n < STAGE_ORDER.length)
            .map((n) => (
              <div key={n} style={{ opacity: n === i ? 1 : 0.42 }}>
                <GuideHex
                  stage={STAGE_ORDER[n]}
                  size={n === i ? 22 : 17}
                  num={String(n + 1).padStart(2, "0")}
                  kind={n < i ? "done" : n === i ? "current" : "pending"}
                />
              </div>
            ))}
        </div>,
      );
    case "guide-solo":
    case "guide-real":
      return centre(
        <div style={{ transform: `scale(${0.94 + 0.06 * lit})` }}>
          <GuideHex stage={stage} size={30} num={num} kind="current" />
        </div>,
      );
    case "path-strip":
      return (
        <div style={{ position: "absolute", left: 0, right: 0, top: "8cqh", display: "grid", placeItems: "center", opacity: life }}>
          <div style={{ display: "flex", gap: "1cqw", alignItems: "center" }}>
            {STAGE_ORDER.slice(0, 5).map((s, n) => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5cqh", opacity: n === i ? 1 : 0.4 }}>
                <Hex size={5.2} filled={n === i} dim={n !== i}>
                  <Num size={1.5} color={n === i ? FIELD : MUTED}>
                    {String(n + 1).padStart(2, "0")}
                  </Num>
                </Hex>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(0.75), letterSpacing: "0.18em", color: n === i ? GOLD : MUTED }}>
                  {combAbbr(s)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case "comb-corner":
      return (
        <div style={{ position: "absolute", right: "5cqw", top: "8cqh", opacity: life }}>
          <Comb stage={stage} size={3.4} lit={lit} />
        </div>
      );
    case "comb-walk":
      return centre(<Comb stage={stage} size={6} lit={lit} prev={prev} />);
    case "band-comb":
      return (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${LOWER_THIRD_BOTTOM * 100}cqh`, opacity: life }}>
          <div style={{ borderTop: `0.18cqw solid ${GOLD}`, paddingTop: "1.4cqh", marginLeft: "6cqw", marginRight: "6cqw", display: "flex", alignItems: "center", gap: "2cqw" }}>
            <Hex size={5} filled>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.2), fontWeight: 700, color: FIELD }}>{combAbbr(stage)}</span>
            </Hex>
            <div>
              <Eyebrow size={1.1}>stage</Eyebrow>
              <div style={{ fontFamily: "var(--font-display)", fontSize: ts(2.6), color: TITLE, lineHeight: 1.05 }}>{STAGE_LABELS[stage]}</div>
            </div>
          </div>
        </div>
      );
    case "num":
      return centre(
        <div style={{ textAlign: "center" }}>
          <Num size={14}>{num}</Num>
          <div style={{ marginTop: "1cqh", fontFamily: "var(--font-display)", fontSize: ts(3), color: TITLE }}>{STAGE_LABELS[stage]}</div>
          <div style={{ marginTop: "0.8cqh", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "12cqw" }}>
              <Hair p={lit} />
            </div>
          </div>
        </div>,
      );
    case "rule-comb":
      return (
        <div style={{ position: "absolute", inset: 0, opacity: life }}>
          {/* The comb SITS ON this rule; the crossing is the composition. */}
          <div data-backdrop style={{ position: "absolute", left: 0, right: 0, top: "46cqh", height: "0.14cqw", background: GOLD, opacity: 0.6 }} />
          <div style={{ position: "absolute", left: "50cqw", top: "46cqh", transform: "translate(-50%,-50%)" }}>
            <Comb stage={stage} size={5} lit={lit} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: "58cqh", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: ts(2.4), color: TITLE }}>{STAGE_LABELS[stage]}</div>
          </div>
        </div>
      );
    case "comb-8":
    default:
      return centre(
        <div style={{ textAlign: "center" }}>
          <Comb stage={stage} size={7} lit={lit} />
          <div style={{ marginTop: "2.4cqh", fontFamily: "var(--font-display)", fontSize: ts(2.6), color: TITLE }}>{STAGE_LABELS[stage]}</div>
        </div>,
      );
  }
}

// ---- LOWER THIRD (10) -------------------------------------------------------

/**
 * A lower third's value is not one kind of thing, and the face follows the
 * KIND rather than the slot. `part` is a designator or a value - alphanumeric,
 * no lexical context, set in Saira via `Desig`. `words` is prose, and prose
 * stays in Bebas, which is what Bebas is for. A row may carry both, in that
 * order, because a part followed by its plain-language name is how the BOM
 * itself reads.
 *
 * Labels are untouched: they are Space Mono, and mono was measured clean on
 * every confusable pair that matters (`0`/`O`, `1`/`I`, `1`/`l` all differ).
 */
type LowerSample = {
  label: string;
  /** Designator / value. Saira. */
  part?: string;
  /** Prose. Bebas. */
  words?: string;
  num?: string;
  unit?: string;
};

const L_SAMPLE: Record<string, LowerSample> = {
  hairline: { label: "U2 / regulator", part: "AP2112K-3.3" },
  accent: { label: "net class", words: "USB differential pair" },
  bracket: { label: "keep-out", words: "antenna clearance zone" },
  masthead: { label: "this pass", words: "drag-solder the fine pitch" },
  readout: { label: "recommended supply", num: "2.42", unit: "A" },
  badge: { label: "C11", part: "10 uF / 16 V / X7R" },
  tag: { label: "D2", part: "SS34", words: "schottky" },
  // Was "D2 and C11 fail loudly if reversed" - one sentence, so the two
  // designators inside it inherited the sentence's face. Leading with the parts
  // is both the correct typography and the better furniture: a warning names
  // what it is about before it explains itself.
  warn: { label: "polarised", part: "D2 / C11", words: "fail loudly if reversed" },
  // A COUNT is not prose, even inside a phrase. Set whole in Bebas, "clean, 0
  // errors" renders as "CLEAN, O ERRORS" - the 0/O collision, live, in a gate
  // result where the number IS the payload. The design system separately says
  // an inline count takes the numeral face. Both point the same way: lead with
  // the count, in Saira, and let the noun stay prose.
  fail: { label: "DRC", part: "3", words: "clearance violations" },
  pass: { label: "ERC", part: "0", words: "errors" },
};

function Lower({ variant, t }: VProps) {
  const s = L_SAMPLE[variant] ?? L_SAMPLE.hairline;
  const life = entryP(t, 0, 0.6);
  const grow = outExpo(seg(t, 0.1, 0.95));
  const bottom = LOWER_THIRD_BOTTOM * 100;
  const base: React.CSSProperties = { position: "absolute", left: "6cqw", bottom: `${bottom}cqh`, opacity: life };

  const label_ = (color: string = GOLD) => (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", textTransform: "uppercase", color }}>
      {s.label}
    </div>
  );
  // One renderer, two faces, chosen by the KIND of each fragment rather than by
  // the variant. A row carrying both sets the part first and the words after it.
  const value_ = (size = 2, color: string = TEXT) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "0.7cqw", lineHeight: 1.1 }}>
      {s.part ? (
        <Desig size={size} color={color}>
          {s.part}
        </Desig>
      ) : null}
      {s.words ? (
        <span data-kind="words" style={{ fontFamily: "var(--font-display)", fontSize: ts(size), color }}>
          {s.words}
        </span>
      ) : null}
    </div>
  );

  switch (variant) {
    case "accent":
      return (
        <div data-lower-third style={{ ...base, borderLeft: `0.3cqw solid ${GOLD}`, paddingLeft: "1.6cqw" }}>
          {label_()}
          <div style={{ marginTop: "0.5cqh" }}>
            {value_()}
          </div>
        </div>
      );
    case "bracket":
      return (
        <div data-lower-third style={{ ...base, width: "42cqw" }}>
          <Hair p={grow} w={0.1} />
          <div style={{ padding: "1.1cqh 0" }}>
            {label_()}
            <div style={{ marginTop: "0.4cqh" }}>
              {value_()}
            </div>
          </div>
          <Hair p={grow} w={0.1} />
        </div>
      );
    case "masthead":
      return (
        <div data-lower-third style={{ ...base, width: "44cqw" }}>
          <div style={{ borderTop: `0.22cqw solid ${GOLD}`, paddingTop: "1.1cqh" }}>
            {label_()}
            <div style={{ marginTop: "0.5cqh" }}>
              {value_(2.2)}
            </div>
          </div>
        </div>
      );
    case "readout":
      return (
        <div data-lower-third style={base}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.8cqw" }}>
            <Num size={7}>{s.num}</Num>
            <Num size={3.4}>{s.unit}</Num>
          </div>
          <div style={{ marginTop: "0.6cqh" }}>
            {label_(MUTED)}
          </div>
        </div>
      );
    case "badge":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.4cqw" }}>
          <div style={{ border: `0.1cqw solid ${GOLD}`, padding: "0.6cqh 1cqw", fontFamily: "var(--font-mono)", fontSize: ts(1.3), letterSpacing: "0.16em", color: GOLD }}>
            {s.label}
          </div>
          <div style={{ width: "30cqw" }}>
            <Hair p={grow} w={0.1} />
            <div style={{ marginTop: "0.6cqh" }}>
              {value_(1.9)}
            </div>
          </div>
        </div>
      );
    case "tag":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "stretch", gap: "1cqw" }}>
          <div style={{ border: `0.1cqw solid ${GOLD}`, display: "grid", placeItems: "center", padding: "0 1cqw" }}>
            <Num size={2.2}>{s.label}</Num>
          </div>
          {/* Deliberately NOT moved to Saira. This line is Space Mono, and mono
              measured clean on every confusable pair that matters (`0`/`O`,
              `1`/`I`, `1`/`l` all differ, at both sizes). The defect being
              fixed elsewhere is specific to Bebas, where `0` and `O` are one
              drawing; applying the swap here would be following the rule past
              its reason, and this variant's whole claim is that it reads the
              way a BOM reads. */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5cqw", fontFamily: "var(--font-mono)", fontSize: ts(1.5), letterSpacing: "0.1em", color: TEXT }}>
            {[s.part, s.words].filter(Boolean).join(" ")}
          </div>
        </div>
      );
    case "warn":
      return (
        <div data-lower-third style={{ ...base, borderLeft: "0.3cqw solid var(--color-danger-coral)", paddingLeft: "1.6cqw" }}>
          {label_("var(--color-danger-coral)")}
          <div style={{ marginTop: "0.5cqh" }}>
            {value_()}
          </div>
        </div>
      );
    case "fail":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.2cqw", borderTop: "0.18cqw solid var(--color-alert-red)", paddingTop: "1.1cqh", width: "40cqw" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", color: "var(--color-alert-red)" }}>
            {s.label}
          </span>
          {value_(2, TITLE)}
        </div>
      );
    case "pass":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.2cqw", borderTop: "0.18cqw solid var(--color-status-green)", paddingTop: "1.1cqh", width: "40cqw" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", color: "var(--color-status-green)" }}>
            {s.label}
          </span>
          {value_(2, TITLE)}
        </div>
      );
    case "hairline":
    default:
      return (
        <div data-lower-third style={{ ...base, width: "42cqw" }}>
          {label_()}
          <div style={{ marginTop: "0.7cqh" }}>
            <Hair p={grow} w={0.12} />
          </div>
          <div style={{ marginTop: "0.7cqh" }}>
            {value_()}
          </div>
        </div>
      );
  }
}

// ---- OUTRO / LADDER (10) ----------------------------------------------------

const URL = "academy.onethousanddrones.com";

function Outro({ variant, stage, lesson, t, guides }: VProps) {
  const inP = outCubic(seg(t, 0.1, 1.1));
  const rule = outExpo(seg(t, 0.5, 1.6));
  const late = outCubic(seg(t, 1.4, 2.4));
  const i = STAGE_ORDER.indexOf(stage);
  const next = STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];

  // Every ladder keeps the four element regions clear; the copy lives in the
  // centre gutter between them.
  // The reclaimed upper-left. Owner decision 2026-08-13: three elements
  // (subscribe + two videos), no channel element, so this quadrant is OURS -
  // and a region nobody composes into is just a hole where a fourth well used
  // to be imagined. It carries the comb: the map the learner already reads.
  const graphics_ = () => (
    <div
      style={{
        position: "absolute",
        left: `${GRAPHICS_16X9.x * 100}%`,
        top: `${GRAPHICS_16X9.y * 100}%`,
        width: `${GRAPHICS_16X9.w * 100}%`,
        height: `${GRAPHICS_16X9.h * 100}%`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "1.2cqh",
        opacity: outCubic(seg(t, 0.6, 1.8)),
      }}
    >
      <Eyebrow size={1}>the build</Eyebrow>
      <Comb stage={stage} size={2.4} lit={1} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: ts(0.85), letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
        {STAGE_LABELS[stage]} done
      </div>
    </div>
  );

  const wells_ = () =>
    guides ? (
      <>
        {Object.entries(WELLS_16X9).map(([k, w]) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: `${w.x * 100}%`,
              top: `${w.y * 100}%`,
              width: `${w.w * 100}%`,
              height: `${w.h * 100}%`,
              border: `0.1cqw dashed color-mix(in oklab, ${GOLD} 40%, transparent)`,
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono)",
              fontSize: ts(0.85),
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: `color-mix(in oklab, ${GOLD} 55%, transparent)`,
            }}
          >
            {k}
          </div>
        ))}
      </>
    ) : null;

  const gutter_ = (children: React.ReactNode) => (
    <div
      style={{
        position: "absolute",
        left: "29cqw",
        right: "37cqw",
        top: "50cqh",
        transform: `translateY(calc(-50% + ${(1 - inP) * 2}cqh))`,
        opacity: inP,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );

  const url_ = (o: number = late) => (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.2), letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, opacity: o }}>
      {URL}
    </div>
  );

  const body = () => {
    switch (variant) {
      case "rungs":
        return (
          gutter_(<>
            <Eyebrow>next in the build</Eyebrow>
            <div style={{ marginTop: "1.6cqh", display: "flex", flexDirection: "column", gap: "0.9cqh" }}>
              {STAGE_ORDER.slice(Math.max(0, i - 1), i + 3).map((s, n) => {
                const done = STAGE_ORDER.indexOf(s) <= i;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.9cqw" }}>
                    <div style={{ width: "2.2cqw", height: "0.14cqw", background: done ? GOLD : HAIR }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.05), letterSpacing: "0.16em", color: done ? GOLD : MUTED, opacity: outCubic(seg(t, 0.8 + n * 0.18, 1.6 + n * 0.18)) }}>
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: "1.8cqh" }}>
              {url_()}
            </div>
          </>)
        );
      case "comb":
        return (
          gutter_(<>
            <Eyebrow>next</Eyebrow>
            <div style={{ marginTop: "1.4cqh", display: "flex", justifyContent: "center" }}>
              <Comb stage={next} size={3} lit={outCubic(seg(t, 1, 2))} prev={stage} />
            </div>
            <div style={{ marginTop: "1.4cqh", fontFamily: "var(--font-display)", fontSize: ts(2.4), color: TITLE }}>{STAGE_LABELS[next]}</div>
            <div style={{ marginTop: "1.2cqh" }}>
              {url_()}
            </div>
          </>)
        );
      case "ladder-trace-vise": {
      // THE OWNER'S COMPOSITION. The comb is the ladder: there is no separate
      // rung list, no "next lesson" line competing with it, and the three
      // end-screen wells are left genuinely empty.
      //
      // SIZED OFF 702, NOT 1080, and that is the whole trick. Centred in a full
      // frame the next lit cell runs to y 0.924 - straight through the CEA-708
      // caption band at 0.72-0.90 that the lower thirds were just moved out of,
      // and on into the player bar. Solving the window against the top 65% puts
      // the run's foot at 0.70 and leaves the band alone.
      //
      // WIDTH IS PASSED, NOT MEASURED. Every comb in the codebase measures its
      // container with a ResizeObserver and draws nothing at zero, which in a
      // frame-grab pipeline is a render that can screenshot empty.
      const gut = 0.31; // the centre gutter, x 0.29 to 0.60
      // THE MARK'S TREATMENT, which is the only axis these variants differ on.
      //
      // `footer` is the academy footer's own: a 135-degree ALPHA ramp, faint at
      // the top-left and brightening into the bottom-right. It is a mask, so the
      // literal colours in it are alpha carriers rather than paint - the RGB
      // channels are discarded before compositing - which is why a token would be
      // wrong there rather than merely unnecessary.
      //
      // `shift` ramps the FILL from gold to gold-light across the same axis, so
      // the mark reads as catching light rather than as printed. Both tokens, so
      // it flips with the theme; a literal pair could not.
      // The mark is settled: the footer's ramp AND the highlight shift, together.
      const wantsGradient = true;
      const wantsShift = true;
      const wantsRule = false;
      const markMask =
        "linear-gradient(135deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.55) 45%, #000 85%)";
      const shiftId = `mk-${variant}`;
      // THE ENTRY IS A SCROLL, and it lands on NEXT rather than on the stage the
      // video just covered. An outro's job is not to say where you were - the
      // whole video said that - it is to hand over. So the run arrives centred on
      // the finished stage, travels one cell, and settles on what comes next.
      //
      // This is deliberate motion, not decoration: the report's strongest
      // positive is signalling (median d = 0.70) and this is motion that POINTS.
      // It is also the one gesture here that is not a register - the travel is a
      // full cell - and that is the trade taken for it.
      //
      // Pure function of `t`, like everything else: one eased ramp, no state.
      // HOW IT LANDS. A detent QUANTISES the travel into stops, which is what
      // makes it read as a mechanism rather than as easing - and because it is a
      // step function of `t` it seeks perfectly: every frame between two stops is
      // the same picture, by construction.
      // No detent on either survivor: the acquisition is what carries the
      // landing now, so the travel stays smooth and lets the lock be the event.
      const detented = false;
      const raw = outCubic(seg(t, 0.9, 2.6));
      const STOPS = 8;
      // THE LAST STAGE HAS NOWHERE TO HAND OVER TO, and that is the ending
      // rather than a gap to fill. Owner's call: let it end. So the run does not
      // travel, every cell goes done, and the comb switches to the product's own
      // finished state - green strokes, green chips - which exists precisely
      // because a comb with nothing current has no focal point otherwise.
      const finale = i >= STAGE_ORDER.length - 1;
      const travel = finale ? 0 : detented ? Math.round(raw * STOPS) / STOPS : raw;
      // The lock closes AFTER the run has arrived, not during: a reticle that
      // grips a moving target is a reticle that has not locked onto anything.
      const lockP = outCubic(seg(t, 2.5, 3.3));
      const lockKind = "trace-vise" as const;
      const landed = i + Math.min(1, i + 1 <= STAGE_ORDER.length - 1 ? 1 : 0) * travel;
      // The finished cell is marked done AS THE RUN PASSES IT, not at t=0 and not
      // at the end: the mark is the event the scroll exists to deliver.
      // THE FINALE HOLDS, THEN TURNS, AND TURNS IN ORDER.
      //
      // A HELD BEAT first: the jaws seat at 3.3 and nothing changes until 3.7.
      // Letting the last hex sit gold after it is gripped is what makes the turn
      // an event - fire them together and the grip and the completion cancel,
      // because the eye has one thing to watch and two things happen to it.
      //
      // Then a STAGGER, propagating UP the run from the stage just finished. A
      // simultaneous flip reads as a switch being thrown; one cell at a time
      // reads as the ladder completing, which is the thing that actually
      // happened. 0.09s a cell is under a sixteenth at 120 BPM, so the whole
      // sweep lands inside one beat and does not become a performance.
      const TURN0 = 3.7;
      const TURN_STEP = 0.09;
      const turnedAt = (n: number) => t >= TURN0 + (i - n) * TURN_STEP;
      const doneAt = finale ? t >= TURN0 : travel >= 0.55;
      const ladderCells: CombCell2[] = STAGE_ORDER.map((s, n) => ({
        stage: s as CombCell2["stage"],
        num: String(n + 1).padStart(2, "0"),
        title: STAGE_LABELS[s],
        lead: "",
        kind:
          finale
            ? turnedAt(n)
              ? "done"
              : n < i
                ? "current"
                : "current"
            : n < i
            ? "done"
            : n === i
              ? doneAt
                ? "done"
                : "current"
              : n === i + 1 && doneAt
                ? "current"
                : "pending",
        // ONE cell says NEXT, and only the one that IS next. Both arms of the
        // last ternary returned "next", so every pending stage carried the
        // label - which makes the word meaningless exactly where the whole
        // composition is trying to point.
        statusText:
          finale
            ? turnedAt(n)
              ? "done"
              : n < i
                ? "done"
                : "here"
            : n < i
            ? "done"
            : n === i
              ? doneAt
                ? "done"
                : "here"
              : n === i + 1
                ? "next"
                : "locked",
      }));
      return (
        <>
          {/* The mark, in the quadrant reclaimed by not reserving a channel
              element. An inline path rather than the raster: crisp at any
              delivery size, one token for its colour, and nothing to fetch.
              Sized to its well rather than to a fraction of it - the rule and
              the address that used to sit under it have moved out, so the mark
              is the only thing here and it can have the room. */}
          <div
            style={{
              position: "absolute",
              left: `${GRAPHICS_16X9.x * 100}cqw`,
              top: `${GRAPHICS_16X9.y * 100}cqh`,
              width: `${GRAPHICS_16X9.w * 100}cqw`,
              height: `${GRAPHICS_16X9.h * 100}cqh`,
              display: "grid",
              placeItems: "center",
              opacity: inP,
            }}
          >
            <svg
              viewBox={BRANDMARK_VIEWBOX}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                ...(wantsGradient
                  ? { WebkitMaskImage: markMask, maskImage: markMask }
                  : {}),
              }}
              aria-hidden
            >
              {wantsShift ? (
                <defs>
                  <linearGradient id={shiftId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={GOLD} />
                    <stop offset="100%" stopColor="var(--color-gold-light)" />
                  </linearGradient>
                </defs>
              ) : null}
              <path d={BRANDMARK_PATH} fill={wantsShift ? `url(#${shiftId})` : GOLD} />
            </svg>
            {wantsRule ? (
              <div style={{ width: "100%", marginTop: "2.4cqh" }}>
                <Hair p={rule} w={0.12} />
              </div>
            ) : null}
          </div>

          {/* The comb, down the gutter between the reserved wells, and CENTRED IN
              THE FRAME: the wrapper is the full height, so the carousel's own
              centring puts the current cell's middle exactly on y 0.5.

              `show={3}` fills the box with the WINDOW rather than the window plus
              a margin of ghosts. That is worth about 18% on the cell, which is the
              difference between a card that reads and one under the 200px floor
              where the comb collapses to its compact layout - the state that made
              the titles burst their hexes. The veil still takes the run out at
              both ends, so the ghosts are implied rather than cropped. */}
          <div
            style={{
              position: "absolute",
              left: "30cqw",
              width: "29cqw",
              top: 0,
              height: "100cqh",
              opacity: inP,
            }}
          >
            {/* The veil's solid band ends at 70%, which is just past the current
                cell's own foot, so the run fades from immediately below the window
                rather than through it.

                `show` is 4.6, not 3, and that number is the whole negotiation
                between two of the owner's instructions. Centred and filled with
                the window alone, the cell solves to the 360px cap, the third hex
                reaches y 0.98, and there is NO band left for a bottom address
                above the player bar - which is a constant 62 CSS px and takes
                12.9% of a laptop-window frame. At 4.6 the cell is 253px - still
                well over the 200px compact floor, and larger than the 211px the
                sandbox round was judged at - the current cell stays EXACTLY
                centred, and the run's foot lands at 0.838 with the address clear
                beneath it. */}
            <Carousel
              cells={ladderCells}
              // The WINDOW follows the landing cell so the run settles with the
              // next stage lit and centred; the POSITION is continuous.
              current={finale ? i : Math.min(i + 1, STAGE_ORDER.length - 1)}
              centreOn={finale ? i : landed}
              // The container class lands only once every cell has turned, so
              // the sweep is per-cell and the finished STATE arrives as one thing.
              complete={finale && turnedAt(0)}
              lock={lockKind}
              lockP={lockP}
              ghost="veil"
              veil={{ top: 20, bottom: 70 }}
              art="art-only"
              show={4.6}
              video
            />
          </div>

          {/* The address, centred along the foot. It is the one thing every viewer
              must be able to act on, and 9.4 is explicit that end-screen elements
              may never render at all - so the CTA lives in pixels we control, not
              in a well YouTube may leave empty. Above the player bar. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // CENTRED AND LOWER. The comb's run now ends at y 0.838 and
              // graphics-safe runs to 0.95, so the address sits in the middle of
              // that band rather than crowding the hexes. It is inside the
              // player's control row on a small player - that row is a constant
              // 62 CSS px, so it takes 12.9% of a laptop-window frame - which is
              // a deliberate trade for the placement, not an oversight.
              bottom: "7cqh",
              textAlign: "center",
              opacity: late,
            }}
          >
            <Eyebrow o={late}>{URL}</Eyebrow>
          </div>
        </>
      );
    }
    case "count":
        return (
          gutter_(<>
            <Eyebrow>stage</Eyebrow>
            <div style={{ marginTop: "0.8cqh", display: "flex", alignItems: "baseline", justifyContent: "center", gap: "0.5cqw" }}>
              <Num size={7}>{String(i + 1).padStart(2, "0")}</Num>
              <span style={{ fontFamily: "var(--font-numeral)", fontSize: ts(3), color: MUTED }}>/</span>
              <Num size={4} color={MUTED}>
                {String(STAGE_ORDER.length).padStart(2, "0")}
              </Num>
            </div>
            <div style={{ marginTop: "0.8cqh", fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.2em", color: MUTED }}>
              {STAGE_LABELS[stage]}
            </div>
            <div style={{ marginTop: "1.6cqh" }}>
              {url_()}
            </div>
          </>)
        );
      case "two-up":
        return (
          gutter_(<>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2cqh" }}>
              <div>
                <Eyebrow size={1.1}>just finished</Eyebrow>
                <div style={{ fontFamily: "var(--font-display)", fontSize: ts(1.9), color: MUTED }}>{STAGE_LABELS[stage]}</div>
              </div>
              <Hair p={rule} w={0.1} />
              <div>
                <Eyebrow size={1.1}>next</Eyebrow>
                <div style={{ fontFamily: "var(--font-display)", fontSize: ts(2.6), color: TITLE }}>{STAGE_LABELS[next]}</div>
              </div>
              {url_()}
            </div>
          </>)
        );
      case "path":
        return (
          gutter_(<>
            <Eyebrow>the path</Eyebrow>
            <div style={{ marginTop: "1.4cqh", display: "flex", justifyContent: "center", gap: "0.7cqw" }}>
              {STAGE_ORDER.slice(0, 5).map((s, n) => (
                <Hex key={s} size={3.4} filled={n <= i} dim={n > i}>
                  <Num size={1} color={n <= i ? FIELD : MUTED}>
                    {String(n + 1).padStart(2, "0")}
                  </Num>
                </Hex>
              ))}
            </div>
            <div style={{ marginTop: "1.6cqh" }}>
              {url_()}
            </div>
          </>)
        );
      case "gate":
        return (
          gutter_(<>
            <Eyebrow>the gate ahead</Eyebrow>
            <div style={{ marginTop: "1.2cqh", fontFamily: "var(--font-display)", fontSize: ts(2.4), color: TITLE, lineHeight: 1.1 }}>
              {STAGE_LABELS[next]}
            </div>
            <div style={{ marginTop: "1cqh", fontFamily: "var(--font-serif)", fontSize: ts(1.25), color: MUTED, lineHeight: 1.4 }}>
              opens when this stage passes clean
            </div>
            <div style={{ marginTop: "1.4cqh" }}>
              {url_()}
            </div>
          </>)
        );
      case "url":
        return (
          gutter_(<>
            <div style={{ fontFamily: "var(--font-display)", fontSize: ts(2.6), color: GOLD, letterSpacing: "0.01em" }}>{URL}</div>
            <div style={{ marginTop: "1.2cqh", display: "flex", justifyContent: "center" }}>
              <div style={{ width: "62%" }}>
                <Hair p={rule} />
              </div>
            </div>
            <div style={{ marginTop: "1.2cqh", fontFamily: "var(--font-mono)", fontSize: ts(1.05), letterSpacing: "0.18em", color: MUTED, opacity: late }}>
              next &middot; {STAGE_LABELS[next]}
            </div>
          </>)
        );
      case "quiet":
        return (
          gutter_(<>
            <div style={{ fontFamily: "var(--font-display)", fontSize: ts(2.2), color: TITLE }}>{STAGE_LABELS[next]}</div>
            <div style={{ marginTop: "1.4cqh", display: "flex", justifyContent: "center" }}>
              <div style={{ width: "50%" }}>
                <Hair p={rule} w={0.1} />
              </div>
            </div>
            <div style={{ marginTop: "1.4cqh" }}>
              {url_()}
            </div>
          </>)
        );
      case "stack":
        return (
          gutter_(<>
            <Eyebrow>keep going</Eyebrow>
            <div style={{ marginTop: "1.4cqh", display: "flex", flexDirection: "column", gap: "0.9cqh", alignItems: "center" }}>
              <div style={{ background: GOLD, color: FIELD, fontFamily: "var(--font-mono)", fontSize: ts(1.15), letterSpacing: "0.18em", textTransform: "uppercase", padding: "0.9cqh 1.8cqw" }}>
                start {STAGE_LABELS[next]}
              </div>
              <div style={{ border: `0.1cqw solid ${GOLD}`, color: GOLD, fontFamily: "var(--font-mono)", fontSize: ts(1.05), letterSpacing: "0.18em", textTransform: "uppercase", padding: "0.8cqh 1.6cqw", opacity: late }}>
                the whole build
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: ts(0.95), letterSpacing: "0.16em", color: MUTED, opacity: late }}>{URL}</div>
            </div>
          </>)
        );
      case "next":
      default:
        return (
          gutter_(<>
            <Eyebrow>next in the build</Eyebrow>
            <div style={{ marginTop: "1.3cqh", fontFamily: "var(--font-display)", fontSize: ts(2.8), color: TITLE, lineHeight: 1.1 }}>
              {STAGE_LABELS[next]}
            </div>
            <div style={{ marginTop: "1.4cqh", display: "flex", justifyContent: "center" }}>
              <div style={{ width: "58%" }}>
                <Hair p={rule} />
              </div>
            </div>
            <div style={{ marginTop: "1.5cqh" }}>
              {url_()}
            </div>
            <div style={{ marginTop: "0.8cqh", fontFamily: "var(--font-serif)", fontSize: ts(1.1), color: MUTED, opacity: late }}>
              {lesson}
            </div>
          </>)
        );
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {wells_()}
      {/* `ladder` OWNS the whole frame, so it does not get the shared graphics
          block on top of it. Every other variant composes AROUND that block - a
          comb strip, the stage label and "THE BUILD" in the reclaimed upper-left -
          and the ladder puts the OTD mark in exactly that well and the comb in the
          gutter. Rendering both stacks two compositions in one frame: the mark
          landed on top of the wordmark and the strip repeated, in miniature, the
          thing the comb is already saying at size. */}
      {/* Matched by PREFIX, not equality. The suppression was written when
          `ladder` was one variant; the moment it became a family the exact test
          silently stopped covering four of the five and the shared block came
          back on top of the mark. */}
      {variant.startsWith("ladder") ? null : graphics_()}
      {body()}
    </div>
  );
}
