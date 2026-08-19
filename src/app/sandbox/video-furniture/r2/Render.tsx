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
// Windows below are written in BEATS, not seconds. See the block above each
// treatment for why, and meter.ts for the tempo argument.
import { beats } from "./meter";
import { EntryProvider } from "./Part";
import { PIECES, type PieceKey } from "./variants";
import { Hairline } from "./Render2";
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
  /**
   * Drop the piece's own ground so it can be exported with transparency.
   *
   * THIS IS THE FOURTH OPAQUE LAYER, and the one that is easiest to miss. The
   * others (`html`, `body`, `.app-backdrop`) are page furniture; this one is
   * inside the component and paints `FIELD` across the whole frame. An overlay
   * exported without it is a black rectangle -- or, under `data-theme="light"`,
   * a CREAM rectangle, since the deep-space token flips with the theme and the
   * failure stops even looking like the failure you were expecting.
   *
   * Only OVERLAY pieces set this. The full-frame compositions keep their ground.
   */
  alpha?: boolean;
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
const PERSISTENT: ReadonlySet<string> = new Set(["chapter", "outro", "outro-short"]);

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
        ...(p.alpha ? {} : { background: FIELD }),
        fontFamily: "var(--font-display)",
      }}
    >
      {p.piece === "intro" ? <Intro {...p} /> : null}
      {p.piece === "lower" ? <LowerThird {...p} /> : null}
      {p.piece === "outro" ? <Outro {...p} /> : null}
      {p.piece === "chapter" ? <Chapter {...p} /> : null}
      {p.piece === "intro-short" ? <IntroShort {...p} /> : null}
      {p.piece === "outro-short" ? <OutroShort {...p} /> : null}
      {p.piece === "callout" ? <Annotate {...p} kind="callout" /> : null}
      {p.piece === "label" ? <LabelRound {...p} /> : null}
      {p.piece === "pause" ? <Annotate {...p} kind="pause" /> : null}
      {p.piece === "beforeafter" ? <Annotate {...p} kind="beforeafter" /> : null}
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

/**
 * The concepts each stage teaches, as NOUNS.
 *
 * Pre-training is naming the main concepts before showing the process, and it is
 * the largest opening effect available (median d = 0.75, against signalling 0.70
 * and segmenting 0.67). Nouns, not verbs: the finding is about knowing what the
 * parts ARE, not what happens to them.
 */
const STAGE_PARTS: Partial<Record<string, string[]>> = {
  REQUIREMENTS: ["Power budget", "Interface list", "Form factor"],
  BOM_SOURCING: ["Package", "Tolerance", "Lead time"],
  SCHEMATIC: ["Decoupling", "Feedback divider", "Net class"],
  LAYOUT: ["Ground pour", "Differential pair", "Keep-out"],
  DRC_GERBER: ["Clearance", "Annular ring", "Aperture"],
  ORDERING: ["Stack-up", "Panelisation", "Finish"],
  ASSEMBLY: ["Paste stencil", "Reflow profile", "Drag solder"],
  BRINGUP: ["Rail check", "Continuity", "First light"],
};

/**
 * The nouns, five ways.
 *
 * One component rather than five branches inside the intro, because what varies
 * between the options is entirely the PRESENTATION of the same three names -
 * and putting that in one place is what stops "manifest" and "held" drifting
 * into two different type scales.
 */
function PartNames({
  stage,
  p,
  t,
  stepped,
  numbered,
  titled,
  centre,
  label = "in this stage",
}: {
  stage: Stage;
  p: number;
  t: number;
  stepped?: boolean;
  numbered?: boolean;
  titled?: boolean;
  centre?: boolean;
  /** A short is not a stage, so it says so. */
  label?: string;
}) {
  const names = STAGE_PARTS[stage] ?? [];
  // STEPPED lands one noun a beat, each on a CUT rather than a fade: a step
  // function of `t`, which is the permitted state change and which also means
  // every frame between two names is one picture or the other, never a blur.
  const shown = (n: number) => (stepped ? (t >= 1.0 + n * 0.5 ? 1 : 0) : p);
  return (
    <div style={{ marginTop: centre ? 0 : "3cqh", textAlign: centre ? "center" : "left", opacity: stepped ? 1 : p }}>
      {titled ? (
        <div style={{ marginBottom: "1.4cqh", opacity: p }}>
          <Title size={2.6} o={p}>
            {STAGE_LABELS[stage]}
          </Title>
        </div>
      ) : null}
      <Eyebrow o={stepped ? 1 : p}>{label}</Eyebrow>
      <div style={{ marginTop: "2.6cqh" }}>
        {names.map((n, k) => (
          <div
            key={n}
            style={{
              marginTop: "2.1cqh",
              display: "flex",
              alignItems: "baseline",
              justifyContent: centre ? "center" : "flex-start",
              gap: "1.1cqw",
              opacity: shown(k),
            }}
          >
            {numbered ? (
              <>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: ts(1.7),
                    letterSpacing: "0.2em",
                    color: GOLD,
                  }}
                >
                  {String(k + 1).padStart(2, "0")}
                </span>
                {/* A FIXED rule, not a flexing one. Letting it flex pushed every
                    name to the right edge, so the numbers ran down a left margin
                    and the names down a right one with a ragged gutter between -
                    two alignments where the list wants one. A manifest reads
                    number, tick, name, and the names line up. */}
                <span style={{ width: "4.4cqw", height: hw(0.14), background: HAIR, alignSelf: "center", flex: "0 0 auto" }} />
              </>
            ) : null}
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: ts(numbered ? 3.0 : 3.2),
                color: TITLE,
                lineHeight: 1.15,
                whiteSpace: "nowrap",
              }}
            >
              {n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The FINDING per stage, for the option that leads with the answer rather
 *  than the symptom. Written as a claim, not a topic - "your ground pour is the
 *  antenna" is a hook; "ground pours" is a label. */
const STAGE_ANSWER: Partial<Record<string, string>> = {
  REQUIREMENTS: "Your power budget is three numbers, not one.",
  BOM_SOURCING: "The part you cannot buy is not a part.",
  SCHEMATIC: "The cap belongs to the pin, not to the rail.",
  LAYOUT: "Your ground pour is an antenna.",
  DRC_GERBER: "The fab checks less than you think.",
  ORDERING: "The stack-up decides your impedance, not your traces.",
  ASSEMBLY: "Heat kills more parts than solder does.",
  BRINGUP: "Measure the rail before you blame the code.",
};

/** A sample symptom per stage, so the question is a real one. */
const STAGE_QUESTION: Partial<Record<string, string>> = {
  REQUIREMENTS: "How much current does this thing actually need?",
  BOM_SOURCING: "Why is my part suddenly 30 weeks out?",
  SCHEMATIC: "Where does the decoupling cap really go?",
  LAYOUT: "Why does my board reset when the motor starts?",
  DRC_GERBER: "What is the fab actually checking?",
  ORDERING: "Which stack-up should I be asking for?",
  ASSEMBLY: "How do I not cook a fine-pitch part?",
  BRINGUP: "It powers up and does nothing. Now what?",
};

/**
 * THE GENERIC OPENER. No comb.
 *
 * A short is not a stage of a build, so the stage map would be a picture of
 * somewhere the video is not. The subject is the QUESTION instead - and for a
 * troubleshooting short the symptom IS the hook, which is the one case where
 * the honest opening and the effective one are the same sentence.
 *
 * The naming block is unchanged, because pre-training is not a course device.
 * Stylised hex elements are allowed as FRAMING; the honeycomb as a map is not.
 */
/**
 * THE MID-VIDEO SET. The first furniture that fires over LIVE WORK.
 *
 * Every opener so far sits on deep-space, where the ground is ours. These sit
 * on a screencast: the background is someone else's contrast and it changes
 * every frame. So each treatment carries its OWN ground - a scrim, a hairline,
 * a bracket - and none may assume the field is dark.
 *
 * The work surface below is a stand-in, and it is deliberately BUSY. Auditioning
 * an annotation over a bare field would audition the thing that never happens.
 */
/**
 * THE CALLOUT LABEL, in the two forms the label round took.
 *
 * TAB hangs off the mark and shares its edge, so the pointer and the name are
 * one object rather than a caption parked nearby. It brings its own ground - a
 * solid bar with the text knocked out - which is why it cannot be lost over
 * copper whatever the frame is showing.
 *
 * DISPLAY refuses a frame entirely: Bebas at size with a dark halo, reading as
 * a title rather than a tag. It is the right form where there is no mark edge to
 * attach to, and it is the riskier of the two because the halo is its only
 * ground.
 *
 * This replaces a bordered `Tag`, which was a box - and the design law is
 * explicit that content groups with hairlines on the bare field and never in a
 * filled card. Rebuilding that box with correct tokens made it a well-built
 * instance of the thing the law rejects, which is why the round was run at all.
 */
function CalloutLabel({
  children,
  x,
  y,
  o = 1,
  tone = GOLD,
  form = "tab",
  from,
}: {
  children: React.ReactNode;
  /** Where the label sits, as a share of frame. */
  x: number;
  y: number;
  o?: number;
  tone?: string;
  form?: "tab" | "display";
  /** Length of the connector back to the mark, in cqw. Tab only. */
  from?: number;
}) {
  const MONO: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: ts(1.3),
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  if (form === "display") {
    return (
      <div style={{ position: "absolute", left: `${x}cqw`, top: `${y}cqh`, opacity: o }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: ts(2.9),
            color: tone === GOLD ? TITLE : tone,
            lineHeight: 1,
            textShadow: `0 0 ${hw(1)} ${FIELD}, 0 0 ${hw(0.4)} ${FIELD}, 0 0 ${hw(0.18)} ${FIELD}`,
          }}
        >
          {children}
        </span>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: `${x}cqw`, top: `${y}cqh`, display: "flex", alignItems: "center", opacity: o }}>
      <span style={{ width: `${from ?? 3}cqw`, height: hw(0.3), background: tone }} />
      <span style={{ ...MONO, color: FIELD, background: tone, padding: "0.9cqh 1.4cqw" }}>{children}</span>
    </div>
  );
}

function HexMark({
  px,
  py,
  aspect,
  scale = 1,
  colour,
  o,
  w = 0.009,
}: {
  px: number;
  py: number;
  aspect: number;
  scale?: number;
  colour: string;
  o: number;
  w?: number;
}) {
  const W = 1000 * aspect;
  const H = 1000;
  const cx = px * W;
  const cy = py * H;
  const rw = H * 0.1 * scale;
  const rh = rw * 1.1547;
  const pts = [
    [cx, cy - rh],
    [cx + rw, cy - rh / 2],
    [cx + rw, cy + rh / 2],
    [cx, cy + rh],
    [cx - rw, cy + rh / 2],
    [cx - rw, cy - rh / 2],
  ]
    .map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2))
    .join(' ');
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: o }} aria-hidden>
      <polygon points={pts} fill="none" stroke={FIELD} strokeWidth={H * w * 3} strokeOpacity={0.85} />
      <polygon points={pts} fill="none" stroke={colour} strokeWidth={H * w} />
    </svg>
  );
}

/**
 * THE LABEL ROUND. Six ways to name the thing, over the settled hex.
 *
 * All six carry the SAME words at the SAME size on the SAME mark, so what is
 * being judged is the framing and nothing else. `naked` is in the set to lose:
 * it proves the ground is load-bearing rather than decorative, which is the
 * claim every other option is quietly making.
 */
/**
 * THE LOWER THIRDS, rebuilt to the house rules, one drawing per JOB.
 *
 * Read against the design law rather than restyled by eye, and the law decides
 * most of it:
 *
 *   - HAIRLINES ON THE BARE FIELD, never a filled card. Every type here groups
 *     with a gold rule on deep-space; not one draws a box.
 *   - The mono eyebrow is the section lead - uppercase, 0.24em, gold, with the
 *     house triangle.
 *   - SAIRA IS THE NUMBER-HERO FACE AND NOTHING ELSE. `measure` gets it because
 *     a measurement IS the signature readout; `part` gets it for the designator
 *     because Bebas draws `0` and `O` identically; nothing else does.
 *   - LORA IS THE READING VOICE, so `term` - the only type carrying a sentence -
 *     is the only one that uses it. A definition is not a transcription, which
 *     is why it is allowed to be prose at all.
 *   - status-green and alert-red are a BORDER AND A LABEL, never a flood, and
 *     `danger-coral` is the destructive channel distinct from a failed gate.
 *   - `\u00b7` as the separator, never an em-dash, anywhere rendered.
 *
 * Every type sits above the CEA-708 caption band via `LOWER_THIRD_BOTTOM`.
 */
// EVERY BRANCH ROOT CARRIES `data-lower-third`, and that is load-bearing rather
// than decorative: `scripts/check-video-furniture.ts` measures the marked box
// against the caption band, so an unmarked branch is not an unchecked branch --
// it is a branch that reports a PASS having measured nothing.
//
// That was live. This component replaced an earlier `Lower` that carried the
// marker, the selector was never moved across, and for all 24 variants the band
// assertion read null at every sample, left `worst` at 0, compared 0 > 0.72,
// and passed. Under `--mutate` the band became 0 and `worst > 0` was also
// false, so it was blind in both directions. Adding a variant without the
// marker now FAILS the gate ("never rendered"), which is the backstop that
// makes this comment enforceable instead of merely true.
function LowerThird({ variant, t }: VProps) {
  const life = outCubic(seg(t, 0, 0.6));
  const rule = outExpo(seg(t, 0.1, 0.95));
  const late = outCubic(seg(t, 0.45, 1.3));
  const CORAL = "var(--color-danger-coral)";
  const base: React.CSSProperties = {
    position: "absolute",
    left: "6cqw",
    bottom: `${LOWER_THIRD_BOTTOM * 100}cqh`,
    opacity: life,
    width: "48cqw",
  };
  const Rule = ({ p = 1, tone = GOLD, w = 0.14 }: { p?: number; tone?: string; w?: number }) => (
    <div style={{ height: hw(w), width: `${p * 100}%`, background: tone }} />
  );
  const Mono = ({ children, size = 1.2, tone = GOLD, o = 1 }: { children: React.ReactNode; size?: number; tone?: string; o?: number }) => (
    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: ts(size), letterSpacing: "0.24em", textTransform: "uppercase", color: tone, opacity: o, lineHeight: 1 }}>
      {children}
    </span>
  );
  const Tagg = ({ children, tone = GOLD, o = 1 }: { children: React.ReactNode; tone?: string; o?: number }) => (
    <span style={{ display: "inline-block", border: `${hw(0.14)} solid ${tone}`, padding: "0.6cqh 1.1cqw", opacity: o }}>
      <Mono tone={tone} size={1.15}>
        {children}
      </Mono>
    </span>
  );
  const passed = t >= 2.0;
  const gTone = passed ? "var(--color-status-green)" : "var(--color-alert-red)";

  switch (variant) {
    // ---- FORMS. Shapes the whole family could take, auditioned on `part`
    // because it is the canonical job: whatever wins here can carry all six.
    case "form-tab":
      // The callout's winning tab, at the frame edge. One vocabulary across the
      // set rather than two, and it brings its own ground.
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", opacity: life }}>
          <span style={{ width: "2.6cqw", height: hw(0.3), background: GOLD, opacity: rule }} />
          <span style={{ display: "flex", alignItems: "baseline", gap: "1cqw", background: GOLD, padding: "1cqh 1.5cqw", opacity: late }}>
            <Mono tone={FIELD} size={1.15}>U2</Mono>
            <span style={{ fontFamily: "var(--font-numeral)", fontWeight: 800, fontSize: ts(2), color: FIELD, letterSpacing: "0.02em" }}>
              AP2112K-3.3
            </span>
          </span>
        </div>
      );
    case "form-display":
      return (
        <div data-lower-third style={base}>
          <div style={{ opacity: late }}>
            <Mono tone={GOLD} size={1.1}>&#9656; U2 &middot; regulator</Mono>
          </div>
          <div style={{ marginTop: "0.7cqh", opacity: late }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: ts(3.4),
                color: TITLE,
                lineHeight: 1,
                textShadow: `0 0 ${hw(1)} ${FIELD}, 0 0 ${hw(0.4)} ${FIELD}`,
              }}
            >
              AP2112K-3.3
            </span>
          </div>
        </div>
      );
    case "form-ticker":
      // One run, a third of the height. For a video that needs a lower third
      // often rather than rarely.
      return (
        <div data-lower-third style={{ ...base, width: "62cqw", display: "flex", alignItems: "center", gap: "1.2cqw" }}>
          <Mono o={late} size={1.05}>U2</Mono>
          <span style={{ width: "2.4cqw", height: hw(0.12), background: HAIR, opacity: rule }} />
          <Desig size={1.5} color={TEXT} o={late}>
            AP2112K-3.3
          </Desig>
          <span style={{ width: "2.4cqw", height: hw(0.12), background: HAIR, opacity: rule }} />
          <Mono o={late} tone={MUTED} size={1.05}>3.3 V &middot; 600 mA</Mono>
        </div>
      );
    case "form-column":
      // Rotated to the edge. Costs no horizontal space, which is the one thing
      // a 9:16 frame has none of.
      return (
        <div
          data-lower-third
          style={{
            position: "absolute",
            left: "4cqw",
            bottom: `${LOWER_THIRD_BOTTOM * 100}cqh`,
            opacity: life,
            transform: "rotate(-90deg)",
            transformOrigin: "left bottom",
            display: "flex",
            alignItems: "baseline",
            gap: "1.2cqw",
            whiteSpace: "nowrap",
          }}
        >
          <Mono o={late} size={1.05}>U2</Mono>
          <Desig size={1.7} color={TEXT} o={late}>
            AP2112K-3.3
          </Desig>
        </div>
      );
    case "form-bracket":
      return (
        <div data-lower-third style={base}>
          <Rule p={rule} w={0.16} />
          <div style={{ padding: "1cqh 0", display: "flex", alignItems: "baseline", gap: "1.2cqw" }}>
            <Mono o={late} size={1.1}>U2</Mono>
            <Desig size={2} color={TEXT} o={late}>
              AP2112K-3.3
            </Desig>
          </div>
          <Rule p={rule} w={0.16} />
        </div>
      );
    case "form-plate":
      // A deep-space plate with a gold top-rule: the masthead at full width.
      // The most readable over anything, and the most furniture on screen.
      return (
        <div data-lower-third style={{ ...base, width: "56cqw" }}>
          <Rule p={rule} w={0.24} />
          <div style={{ background: FIELD, padding: "1.4cqh 1.6cqw", opacity: late }}>
            <Mono size={1.05} tone={MUTED}>U2 &middot; regulator</Mono>
            <div style={{ marginTop: "0.7cqh" }}>
              <Desig size={2.3} color={TITLE}>
                AP2112K-3.3
              </Desig>
            </div>
          </div>
        </div>
      );

    // ---- PART -------------------------------------------------------------
    case "part-tag":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.2cqw" }}>
          <Tagg o={late}>U2</Tagg>
          <Desig size={2} color={TEXT} o={late}>
            AP2112K-3.3
          </Desig>
        </div>
      );
    case "part-lead":
      return (
        <div data-lower-third style={base}>
          <Desig size={3} color={TITLE} o={late}>
            AP2112K-3.3
          </Desig>
          <div style={{ marginTop: "0.7cqh" }}>
            <Rule p={rule} />
          </div>
          <div style={{ marginTop: "0.8cqh" }}>
            <Mono o={late} tone={MUTED}>U2 &middot; regulator</Mono>
          </div>
        </div>
      );

    // ---- MEASURE ----------------------------------------------------------
    case "measure-line":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.4cqw" }}>
          <Mono o={late}>&#9656; draw</Mono>
          <div style={{ flex: 1, height: hw(0.12), background: HAIR, opacity: rule }} />
          <Num size={2.6}>2.42 A</Num>
        </div>
      );
    case "measure-delta":
      return (
        <div data-lower-third style={base}>
          <Mono o={late}>&#9656; quiescent draw</Mono>
          <div style={{ marginTop: "0.8cqh" }}>
            <Rule p={rule} />
          </div>
          <div style={{ marginTop: "1cqh", display: "flex", alignItems: "baseline", gap: "1.4cqw" }}>
            <Num size={4.4}>2.42 A</Num>
            <span style={{ position: "relative", opacity: late * 0.75 }}>
              <Num size={2} color={MUTED}>
                3.10 A
              </Num>
              <span aria-hidden style={{ position: "absolute", left: 0, right: 0, top: "50%", height: hw(0.12), background: MUTED }} />
            </span>
          </div>
        </div>
      );

    // ---- TERM -------------------------------------------------------------
    case "term-inline":
      return (
        <div data-lower-third style={{ ...base, width: "56cqw" }}>
          <Rule p={rule} />
          <div style={{ marginTop: "0.9cqh", opacity: late }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: GOLD }}>Keep-out&nbsp;</span>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: ts(1.4), color: MUTED }}>
              a region the router may not enter.
            </span>
          </div>
        </div>
      );
    case "term-eyebrow":
      return (
        <div data-lower-third style={{ ...base, width: "56cqw" }}>
          <Mono o={late}>&#9656; keep-out</Mono>
          <div style={{ marginTop: "0.8cqh" }}>
            <Rule p={rule} />
          </div>
          <div style={{ marginTop: "1cqh", opacity: late }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: ts(1.75), color: TITLE, lineHeight: 1.4 }}>
              A region the router may not enter, whatever it costs.
            </span>
          </div>
        </div>
      );

    // ---- SOURCE -----------------------------------------------------------
    case "source-tag":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.1cqw" }}>
          <Tagg o={late} tone={MUTED}>IPC-2221B</Tagg>
          <Mono o={late} tone={MUTED} size={1.1}>
            &sect;6.3 &middot; conductor spacing
          </Mono>
        </div>
      );
    case "source-corner":
      return (
        <div data-lower-third style={{ position: "absolute", right: "5cqw", bottom: `${LOWER_THIRD_BOTTOM * 40}cqh`, opacity: life * late }}>
          <Mono tone={MUTED} size={0.95}>
            IPC-2221B &sect;6.3
          </Mono>
        </div>
      );

    // ---- GATE -------------------------------------------------------------
    case "gate-badge":
      return (
        <div data-lower-third style={{ ...base, display: "flex", alignItems: "center", gap: "1.2cqw" }}>
          <Tagg o={late} tone={gTone}>
            {passed ? "DRC pass" : "DRC fail"}
          </Tagg>
          <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: TITLE, opacity: late }}>
            {passed ? "clean, 0 errors" : "3 clearance violations"}
          </span>
        </div>
      );
    case "gate-count":
      return (
        <div data-lower-third style={base}>
          <Rule p={rule} tone={gTone} w={0.18} />
          <div style={{ marginTop: "1cqh", display: "flex", alignItems: "baseline", gap: "1.2cqw" }}>
            <Num size={4.6} color={gTone}>
              {passed ? "0" : "3"}
            </Num>
            <Mono o={late} tone={gTone} size={1.3}>
              {passed ? "errors" : "violations"}
            </Mono>
          </div>
          <div style={{ marginTop: "0.6cqh" }}>
            <Mono o={late} tone={MUTED} size={1.05}>
              design rule check
            </Mono>
          </div>
        </div>
      );

    // ---- WARN -------------------------------------------------------------
    case "warn-stencil":
      return (
        <div data-lower-third style={base}>
          <span style={{ display: "inline-block", background: CORAL, padding: "0.9cqh 1.4cqw", opacity: late }}>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: ts(1.3), letterSpacing: "0.24em", textTransform: "uppercase", color: FIELD }}>
              polarised
            </span>
          </span>
          <div style={{ marginTop: "0.9cqh", display: "flex", alignItems: "baseline", gap: "0.7cqw" }}>
            <Desig size={2} color={TEXT} o={late}>
              D2 / C11
            </Desig>
            <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: TITLE, opacity: late }}>
              fail loudly if reversed
            </span>
          </div>
        </div>
      );
    case "warn-brackets":
      return (
        <div data-lower-third style={base}>
          <Rule p={rule} tone={CORAL} w={0.18} />
          <div style={{ padding: "1cqh 0", display: "flex", alignItems: "baseline", gap: "1.1cqw" }}>
            <Mono o={late} tone={CORAL}>polarised</Mono>
            <Desig size={1.9} color={TEXT} o={late}>
              D2 / C11
            </Desig>
          </div>
          <Rule p={rule} tone={CORAL} w={0.18} />
        </div>
      );
    case "warn-bar":
      return (
        <div data-lower-third style={{ ...base, display: "flex", gap: "1.4cqw" }}>
          <div style={{ width: hw(0.5), background: CORAL, opacity: rule }} />
          <div>
            <Mono o={late} tone={CORAL}>polarised</Mono>
            <div style={{ marginTop: "0.7cqh", display: "flex", alignItems: "baseline", gap: "0.7cqw" }}>
              <Desig size={2} color={TEXT} o={late}>
                D2 / C11
              </Desig>
              <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: TITLE, opacity: late }}>
                fail loudly if reversed
              </span>
            </div>
          </div>
        </div>
      );

    // ---- the house treatments -------------------------------------------
    case "measure-hero":
      return (
        <div data-lower-third style={base}>
          <Mono o={late}>&#9656; quiescent draw</Mono>
          <div style={{ marginTop: "0.8cqh" }}>
            <Rule p={rule} />
          </div>
          <div style={{ marginTop: "1.1cqh", display: "flex", alignItems: "baseline", gap: "0.8cqw" }}>
            <Num size={5.2}>2.42</Num>
            <Num size={2.4}>A</Num>
          </div>
        </div>
      );
    case "term-stack":
      return (
        <div data-lower-third style={{ ...base, width: "52cqw" }}>
          <Mono o={late}>&#9656; term</Mono>
          <div style={{ marginTop: "0.8cqh" }}>
            <Rule p={rule} />
          </div>
          <div style={{ marginTop: "1cqh" }}>
            <Title size={2.2} o={late}>
              Keep-out
            </Title>
          </div>
          <div style={{ marginTop: "0.8cqh" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: ts(1.35), color: MUTED, lineHeight: 1.45, opacity: late }}>
              A region the router may not enter, whatever it costs.
            </span>
          </div>
        </div>
      );
    case "source-rule":
      return (
        <div data-lower-third style={{ ...base, width: "50cqw" }}>
          <Rule p={rule} w={0.1} tone={HAIR} />
          <div style={{ marginTop: "0.9cqh" }}>
            <Mono o={late} tone={MUTED} size={1.15}>
              IPC-2221B &middot; &sect;6.3 &middot; conductor spacing
            </Mono>
          </div>
        </div>
      );
    case "gate-rule":
      return (
        <div data-lower-third style={base}>
          <Rule p={rule} tone={gTone} w={0.18} />
          <div style={{ marginTop: "0.9cqh", display: "flex", alignItems: "baseline", gap: "1.2cqw" }}>
            <Mono o={late} tone={gTone}>{passed ? "DRC pass" : "DRC fail"}</Mono>
            <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: TITLE, opacity: late }}>
              {passed ? "clean, 0 errors" : "3 clearance violations"}
            </span>
          </div>
        </div>
      );
    case "part-rule":
    default:
      return (
        <div data-lower-third style={base}>
          <Mono o={late}>&#9656; U2 &middot; regulator</Mono>
          <div style={{ marginTop: "0.8cqh" }}>
            <Rule p={rule} />
          </div>
          <div style={{ marginTop: "0.9cqh" }}>
            <Desig size={2.2} color={TEXT} o={late}>
              AP2112K-3.3
            </Desig>
          </div>
        </div>
      );
  }
}

function LabelRound({ variant, stage, t, aspect = 16 / 9 }: VProps) {
  const art = stageArt(stage);
  const inP = outCubic(seg(t, 0.3, 1.0));
  const grip = outCubic(seg(t, 0.9, 1.7));
  const hold = 1 - outCubic(seg(t, 3.2, 3.9));
  const o = inP * hold;
  const px = 0.42;
  const py = 0.46;

  // BOLDER. Space Mono ships a 700, and the previous round set every label at
  // 400 - which is the weight for an eyebrow on a quiet page, not for a mark
  // that has to hold its own over a screencast.
  const MONO = {
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: ts(1.35),
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
  };
  const LX = `${px * 100 + 10}cqw`;
  const LY = `${py * 100 - 16}cqh`;
  const WORD = "ground pour";

  const isTab = variant.startsWith("tab");
  const under = variant === "tab-under";

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />
      ) : null}
      <HexMark px={px} py={py} aspect={aspect} scale={grip} colour={GOLD} o={o * grip} />

      {/* TAB - attached to the mark, sharing its edge, so the pointer and the
          name are one object. Positioned FROM the hex rather than parked near
          it, which is the whole distinction from a caption. */}
      {isTab ? (
        <div
          style={{
            position: "absolute",
            left: under ? `${px * 100 - 5}cqw` : `${px * 100 + 5.6}cqw`,
            top: under ? `${py * 100 + 12}cqh` : `${py * 100 - 3}cqh`,
            display: "flex",
            flexDirection: under ? "column" : "row",
            alignItems: under ? "flex-start" : "center",
            opacity: o * grip,
          }}
        >
          <span
            style={
              under
                ? { width: hw(0.3), height: "3cqh", background: GOLD, marginLeft: "2cqw" }
                : { width: "3cqw", height: hw(0.3), background: GOLD }
            }
          />
          <span
            style={{
              ...MONO,
              ...(variant === "tab-outline"
                ? {
                    color: GOLD,
                    background: FIELD,
                    border: `${hw(0.16)} solid ${GOLD}`,
                    padding: "0.8cqh 1.3cqw",
                  }
                : { color: FIELD, background: GOLD, padding: "0.9cqh 1.4cqw" }),
            }}
          >
            {WORD}
          </span>
        </div>
      ) : null}

      {/* DISPLAY - no frame. The halo is the only ground, which is the bet: a
          title that survives copper on contrast alone. */}
      {!isTab ? (
        <div style={{ position: "absolute", left: LX, top: LY, opacity: o * grip }}>
          {variant === "display-eyebrow" ? (
            <div style={{ marginBottom: "1cqh" }}>
              <span style={{ ...MONO, fontSize: ts(1.1), color: GOLD, textShadow: `0 0 ${hw(0.7)} ${FIELD}` }}>
                &#9656; net class
              </span>
            </div>
          ) : null}
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: ts(3.2),
              color: TITLE,
              lineHeight: 1,
              textShadow: `0 0 ${hw(1)} ${FIELD}, 0 0 ${hw(0.4)} ${FIELD}, 0 0 ${hw(0.18)} ${FIELD}`,
            }}
          >
            {WORD}
          </span>
          {variant === "display-rule" ? (
            <div
              style={{
                marginTop: "0.9cqh",
                height: hw(0.34),
                width: `${grip * 100}%`,
                background: GOLD,
                boxShadow: `0 0 0 ${hw(0.12)} ${FIELD}`,
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Annotate({ variant, stage, t, kind, aspect = 16 / 9 }: VProps & { kind: "callout" | "pause" | "beforeafter" }) {
  const art = stageArt(stage);
  const inP = outCubic(seg(t, 0.3, 1.0));
  // The grip closes after the mark has arrived, same order as the outro's lock:
  // a reticle that grips a moving target has not locked onto anything.
  const grip = outCubic(seg(t, 0.9, 1.7));
  const hold = 1 - outCubic(seg(t, 3.2, 3.9));
  const o = inP * hold;
  // The point being annotated, as a share of frame.
  const px = 0.46;
  const py = 0.44;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* THE WORK. A stand-in for a screencast, and busy on purpose. */}
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
        />
      ) : null}

      {kind === "callout" && variant === "region" ? (
        <>
          {/* THE SAME LOCK THE LESSON PAIR USES, at annotation scale. Trace the
              hex, then close two half-hex jaws onto it - one gesture the viewer
              has already been taught by the intro and outro, rather than a
              second thing that also means "look here". A vocabulary is only a
              vocabulary if it is reused. */}
          {(() => {
            // THE ACTUAL trace-vise, ported from  rather than
            // re-derived. Three earlier attempts failed for one reason: they
            // used  with , and
            // those do not compose - the dash is applied in the scaled space, so
            //  stops meaning "the whole perimeter" and the outline came out
            // as disconnected segments.
            //
            // The real one has no such attribute. Its viewBox is in PIXEL units,
            // so stroke widths and dash lengths are already in the space they
            // are drawn in. That is the whole trick, and it also removes the
            // aspect-stretch problem for free.
            const W = 1000 * aspect;
            const H = 1000;
            const cx = px * W;
            const cy = py * H;
            const rw = H * 0.1;
            const rh = rw * 1.1547;
            const ptsAt = (g: number) =>
              [
                [cx, cy - rh * g],
                [cx + rw * g, cy - (rh * g) / 2],
                [cx + rw * g, cy + (rh * g) / 2],
                [cx, cy + rh * g],
                [cx - rw * g, cy + (rh * g) / 2],
                [cx - rw * g, cy - (rh * g) / 2],
              ]
                .map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2))
                .join(' ');
            // Same proportions the carousel uses: trace leads, jaws follow.
            const traceP = Math.min(1, grip / 0.6);
            const gripP = Math.max(0, (grip - 0.45) / 0.55);
            // The jaws rest PROUD and travel from further out, so the two halves
            // are seen to close rather than simply resolving.
            const grow = 1.07 + (1 - gripP) * 0.9;
            const wgt = H * 0.009;
            return (
              <svg viewBox={'0 0 ' + W + ' ' + H} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: o }} aria-hidden>
                {/* A dark ground under each pass, because this one is drawn over
                    gold copper rather than over deep-space. */}
                <polygon points={ptsAt(1)} fill="none" stroke={FIELD} strokeWidth={wgt * 3} strokeOpacity={0.85} strokeLinecap="round" pathLength={600} strokeDasharray={600 * traceP + ' 600'} />
                <polygon points={ptsAt(1)} fill="none" stroke={GOLD} strokeWidth={wgt} strokeLinecap="round" pathLength={600} strokeDasharray={600 * traceP + ' 600'} opacity={0.85} />
                <polygon points={ptsAt(grow)} fill="none" stroke={FIELD} strokeWidth={wgt * 3} strokeOpacity={0.85} strokeLinecap="square" pathLength={600} strokeDasharray="150 150" strokeDashoffset={-75} opacity={gripP} />
                <polygon points={ptsAt(grow)} fill="none" stroke={GOLD} strokeWidth={wgt} strokeLinecap="square" pathLength={600} strokeDasharray="150 150" strokeDashoffset={-75} opacity={gripP} />
              </svg>
            );
          })()}
          <CalloutLabel x={px * 100 + 5.6} y={py * 100 - 3} o={o * grip}>ground pour</CalloutLabel>
        </>
      ) : null}

      {/* GROUP - one label serving several marks. A ring per item would read
          as three unrelated callouts rather than one set, so the members get a
          light tick each and the label belongs to the group. */}
      {kind === "callout" && variant === "group" ? (
        <>
          {[
            [0.38, 0.4],
            [0.47, 0.47],
            [0.55, 0.38],
          ].map(([gx, gy], k) => (
            <HexMark
              key={k}
              px={gx}
              py={gy}
              aspect={aspect}
              scale={0.42}
              colour={GOLD}
              o={o * clamp01((grip - k * 0.12) / 0.5)}
            />
          ))}
          <CalloutLabel x={58} y={30} o={o * grip} form="display">decoupling &middot; 3</CalloutLabel>
        </>
      ) : null}

      {/* OFF-SCREEN - the only callout whose subject cannot be seen. An edge
          marker pointing at where the thing would be, so the frame stays honest
          about the fact that it is not showing it. */}
      {kind === "callout" && variant === "offscreen" ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "44cqh",
            display: "flex",
            alignItems: "center",
            gap: "1cqw",
            opacity: o * grip,
          }}
        >
          <span />
          <CalloutLabel x={62} y={40} o={o * grip} form="display">USB connector &rarr;</CalloutLabel>
        </div>
      ) : null}

      {/* MEASUREMENT - a value anchored to a PLACE. Same content the lower-third
          `measure` carries; only the anchor differs, which is why it should end
          up one component with two anchors rather than two that drift. */}
      {/* MEASUREMENT. One readout, not three objects competing for the same
          space - which is what the first cut was: a tab, a number and a leader
          all landing on top of each other, with the value set in gold over a
          light schematic and no ground at all.

          Now: a ring on the node, a leader running up from it, and the label and
          value together in a single block at the top of that leader. The leader
          stops WHERE THE BLOCK BEGINS rather than running behind it, so nothing
          crosses the number. */}
      {kind === "callout" && variant === "measure" ? (
        (() => {
          const lx = px * 100;
          const ly = py * 100;
          const lead = 13;
          return (
            <>
              {/* The node itself: a ring, not a filled dot - it marks a place
                  without hiding what is at that place. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${lx}cqw`,
                  top: `${ly}cqh`,
                  width: "1.5cqw",
                  height: "1.5cqw",
                  transform: "translate(-50%,-50%)",
                  border: `${hw(0.32)} solid ${GOLD}`,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 ${hw(0.16)} ${FIELD}`,
                  opacity: o * grip,
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${lx}cqw`,
                  top: `${ly - lead * grip}cqh`,
                  width: hw(0.32),
                  height: `${lead * grip}cqh`,
                  background: GOLD,
                  boxShadow: `0 0 0 ${hw(0.14)} ${FIELD}`,
                  opacity: o,
                }}
              />
              {/* Label and value as ONE block, sitting on the leader's head. */}
              <div
                style={{
                  position: "absolute",
                  left: `${lx}cqw`,
                  top: `${ly - lead}cqh`,
                  transform: "translate(-50%, -100%)",
                  opacity: o * grip,
                  textAlign: "center",
                }}
              >
                {/* The taken TAB form, with no connector - the leader below is
                    already doing that job, so a second one would be a stray
                    rule rather than an attachment. */}
                <div style={{ position: "relative", height: ts(2.6) }}>
                  <CalloutLabel x={0} y={0} o={1} from={0}>
                    node
                  </CalloutLabel>
                </div>
                {/* The value carries its own dark ground, because a gold numeral
                    over a light schematic is the exact failure this set keeps
                    producing. */}
                <div
                  style={{
                    background: FIELD,
                    padding: "0.8cqh 1cqw",
                    borderLeft: `${hw(0.32)} solid ${GOLD}`,
                    borderRight: `${hw(0.32)} solid ${GOLD}`,
                    borderBottom: `${hw(0.32)} solid ${GOLD}`,
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "center",
                    gap: "0.5cqw",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Num size={2.6}>2.42</Num>
                  <Num size={1.4}>A</Num>
                </div>
              </div>
            </>
          );
        })()
      ) : null}

      {/* WARNING - the coral channel. Deliberately unlike a label, because a
          warning that looks like a label does not get read. */}
      {kind === "callout" && variant === "warn" ? (
        <>
          <HexMark px={px} py={py} aspect={aspect} scale={grip} colour="var(--color-danger-coral)" o={o * grip} w={0.011} />
          <CalloutLabel x={px * 100 + 5.6} y={py * 100 - 3} o={o * grip} tone="var(--color-danger-coral)">live at 240 V</CalloutLabel>
        </>
      ) : null}

      {kind === "callout" && variant === "element" ? (
        <>
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sy], k) => (
            <div
              key={k}
              aria-hidden
              style={{
                position: "absolute",
                left: `${px * 100 + sx * (7 + (1 - grip) * 4)}cqw`,
                top: `${py * 100 + sy * (11 + (1 - grip) * 6)}cqh`,
                width: "3.4cqw",
                height: "6cqh",
                borderTop: sy < 0 ? `${hw(0.42)} solid ${GOLD}` : undefined,
                borderBottom: sy > 0 ? `${hw(0.42)} solid ${GOLD}` : undefined,
                borderLeft: sx < 0 ? `${hw(0.42)} solid ${GOLD}` : undefined,
                borderRight: sx > 0 ? `${hw(0.42)} solid ${GOLD}` : undefined,
                transform: "translate(-50%,-50%)",
                // A DARK HALO, so the mark reads on gold copper as well as on a
                // dark field. Annotation over live work cannot borrow contrast
                // from a background it does not control.
                filter: `drop-shadow(0 0 ${hw(0.5)} ${FIELD}) drop-shadow(0 0 ${hw(0.2)} ${FIELD})`,
                opacity: o * grip,
              }}
            />
          ))}
          <CalloutLabel x={px * 100 + 9} y={py * 100 - 13} o={o * grip}>ground pour</CalloutLabel>
        </>
      ) : null}

      {kind === "callout" && variant === "point" ? (
        <>
          {/* Nothing overlaps the work. The only option that guarantees it. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${px * 100}cqw`,
              top: `${py * 100}cqh`,
              // STOPS AT THE LABEL, not at the frame edge. The leader used to
              // run the full width and the tab now sits on it, so the line
              // carried on past the label and out of frame - a pointer that
              // points through the thing it is pointing with.
              width: `${grip * 10}cqw`,
              height: hw(0.4),
              background: GOLD,
              boxShadow: `0 0 0 ${hw(0.16)} ${FIELD}`,
              opacity: o,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${px * 100}cqw`,
              top: `${py * 100}cqh`,
              width: "1.8cqw",
              height: "1.8cqw",
              transform: "translate(-50%,-50%)",
              border: `${hw(0.42)} solid ${GOLD}`,
              boxShadow: `0 0 0 ${hw(0.16)} ${FIELD}`,
              opacity: o * grip,
            }}
          />
          <CalloutLabel x={px * 100 + 10} y={py * 100 - 3} o={o * grip} from={0}>ground pour</CalloutLabel>
        </>
      ) : null}

      {kind === "pause" && variant === "card" ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            textAlign: "center",
            opacity: o,
          }}
        >
          {/* Its own ground, because it has to be readable over anything. */}
          <div style={{ position: "absolute", inset: "-6cqh -8cqw", background: FIELD, opacity: 0.82 }} aria-hidden />
          <div style={{ position: "relative" }}>
            <Eyebrow o={o}>pause here</Eyebrow>
            <div style={{ marginTop: "1.6cqh" }}>
              <Title size={3.2} o={o}>
                Do this bit before you carry on
              </Title>
            </div>
            <div style={{ marginTop: "2cqh", display: "flex", justifyContent: "center" }}>
              <div style={{ width: "22cqw", height: hw(0.14), background: GOLD }} />
            </div>
          </div>
        </div>
      ) : null}


      {kind === "pause" && variant === "band" ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "16cqh", opacity: o }}>
          <div style={{ position: "absolute", inset: "-2cqh 0", background: FIELD, opacity: 0.86 }} aria-hidden />
          <div style={{ position: "relative", textAlign: "center" }}>
            <Eyebrow o={o}>pause here</Eyebrow>
            <div style={{ marginTop: "1cqh" }}>
              <Title size={2.4} o={o}>
                Do this bit before you carry on
              </Title>
            </div>
          </div>
        </div>
      ) : null}

      {kind === "pause" && variant === "corner" ? (
        <div
          style={{
            position: "absolute",
            right: "6cqw",
            top: "8cqh",
            opacity: o,
            border: `${hw(0.1)} solid ${GOLD}`,
            background: FIELD,
            padding: "1cqh 1.4cqw",
          }}
        >
          <Eyebrow o={o}>pause here</Eyebrow>
        </div>
      ) : null}

      {kind === "pause" && variant === "dim" ? (
        <>
          {/* Nothing is covered - the work stays readable underneath - but it is
              unmistakably stopped. */}
          <div style={{ position: "absolute", inset: 0, background: FIELD, opacity: 0.55 * o }} aria-hidden />
          <div style={{ position: "absolute", left: 0, right: 0, top: "44cqh", textAlign: "center", opacity: o }}>
            <Title size={3} o={o}>
              Pause here
            </Title>
          </div>
        </>
      ) : null}

      {kind === "beforeafter" && variant === "compare" ? (
        <>
          <div style={{ position: "absolute", inset: 0, clipPath: "inset(0 0 0 50%)", background: FIELD, opacity: 0.55 }} aria-hidden />
          <div aria-hidden style={{ position: "absolute", left: "50cqw", top: 0, bottom: 0, width: hw(0.16), background: GOLD, opacity: o }} />
          <div style={{ position: "absolute", left: "6cqw", bottom: "12cqh", opacity: o }}>
            <Eyebrow o={o}>after</Eyebrow>
          </div>
          <div style={{ position: "absolute", right: "6cqw", bottom: "12cqh", opacity: o }}>
            <Eyebrow o={o}>before</Eyebrow>
          </div>
        </>
      ) : null}



      {/* REVEAL - a dissolve, because NOTHING changed except what is being
          shown. A wipe would claim the board turned into its own layer stack. */}
      {kind === "beforeafter" && variant === "reveal" ? (
        <>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: FIELD, opacity: 0.55 * (1 - grip) }} />
          <div style={{ position: "absolute", left: "6cqw", bottom: "12cqh", opacity: o }}>
            <Eyebrow o={o}>{grip > 0.5 ? "copper, shown" : "copper, hidden"}</Eyebrow>
          </div>
        </>
      ) : null}

      {kind === "beforeafter" && variant === "chrono" ? (
        <>
          {/* The fix is on the other side of a hard edge. A wipe along an axis
              is permitted vocabulary, so this costs nothing to add. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(0 0 0 ${grip * 100}%)`,
              background: FIELD,
              opacity: 0.55,
            }}
            aria-hidden
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${grip * 100}cqw`,
              top: 0,
              bottom: 0,
              width: hw(0.16),
              background: GOLD,
              opacity: o,
            }}
          />
          <div style={{ position: "absolute", left: "6cqw", bottom: "12cqh", opacity: o }}>
            <Eyebrow o={o}>after</Eyebrow>
          </div>
          <div style={{ position: "absolute", right: "6cqw", bottom: "12cqh", opacity: o }}>
            <Eyebrow o={o}>before</Eyebrow>
          </div>
        </>
      ) : null}
    </div>
  );
}

function IntroShort({ variant, stage, t, aspect = 16 / 9 }: VProps) {
  const tall = aspect < 1;
  const q = STAGE_QUESTION[stage] ?? "";
  const art = stageArt(stage);
  const inP = outCubic(seg(t, 0, 0.7));
  const parts = outCubic(seg(t, 0.9, 2.1));
  const late = outCubic(seg(t, 1.6, 2.6));
  // WASH IS THE DIRECTION. What varies is where it sits, how much is in frame,
  // and - the half worth a round - what it is made of. Every option is the same
  // drawing at the same faintness; none may become a second logo competing with
  // the question for the eye.
  const wash = variant === "wash" ? "plain" : variant.replace("wash-", "");
  // The vertical is composed, not reflowed.
  const stacked = tall;
  const MARK_SVG =
    "url(\"data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='" +
        BRANDMARK_VIEWBOX +
        "'><path d='" +
        BRANDMARK_PATH +
        "' fill='black'/></svg>",
    ) +
    "\")";

  // Where the words go, given how much room the mark is taking.
  const copyTop = wash === "subject" ? (stacked ? "30cqh" : "34cqh") : stacked ? "16cqh" : "22cqh";
  const copyLeft = "8cqw";
  const copyRight = stacked ? "8cqw" : "34cqw";

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* THE FIELD. Two directions taken - the mark as the field, or the
          artifact as the field - and these are variations within each. */}
      {wash === "plain" || wash === "wash-corner" ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            opacity: 0.07 * inP,
            ...(wash === "wash-corner"
              ? { right: "-10cqw", bottom: "-16cqh", width: "58cqw", height: "84cqh" }
              : { left: "-18cqw", top: "-14cqh", width: "92cqw", height: "128cqh" }),
          }}
        >
          <svg viewBox={BRANDMARK_VIEWBOX} style={{ width: "100%", height: "100%", display: "block" }}>
            <path d={BRANDMARK_PATH} fill={GOLD} />
          </svg>
        </div>
      ) : null}

      {/* THE BOARD, three ways: ghosted across the field, bled so it reads as a
          detail of something bigger, or held at strength in one half. */}
      {art && (wash === "subject" || wash === "subject-bleed" || wash === "subject-half" || wash === "wash-board") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            ...(wash === "subject-bleed"
              ? { left: "-24cqw", top: "-20cqh", width: "116cqw", height: "150cqh", opacity: 0.2 * inP, objectFit: "cover" }
              : wash === "subject-half"
                ? { right: 0, top: 0, width: "48cqw", height: "100cqh", opacity: 0.5 * inP, objectFit: "cover" }
                : wash === "wash-board"
                  ? { right: "6cqw", top: "22cqh", width: "30cqw", height: "44cqh", opacity: 0.85 * inP, objectFit: "contain" }
                  : { inset: 0, width: "100%", height: "100%", opacity: 0.16 * inP, objectFit: "cover" }),
          }}
        />
      ) : null}

      {wash === "wash-board" ? (
        <div aria-hidden style={{ position: "absolute", left: "-14cqw", top: "-10cqh", width: "78cqw", height: "112cqh", opacity: 0.06 * inP }}>
          <svg viewBox={BRANDMARK_VIEWBOX} style={{ width: "100%", height: "100%", display: "block" }}>
            <path d={BRANDMARK_PATH} fill={GOLD} />
          </svg>
        </div>
      ) : null}

      <div style={{ position: "absolute", left: copyLeft, right: copyRight, top: copyTop, opacity: inP }}>
        {wash.startsWith("subject") ? null : (
          <Eyebrow o={inP}>{wash === "answer" ? "the finding" : "the question"}</Eyebrow>
        )}
        <div style={{ marginTop: "2cqh", position: "relative" }}>
          {wash === "knockout" ? (
            // THE WORDS ARE HOLES IN THE MARK. One object rather than two
            // stacked, so it cannot be misread as a logo with text over it.
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: ts(stacked ? 3.4 : 3.8),
                lineHeight: 1.08,
                color: "transparent",
                opacity: inP,
                backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
                  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${BRANDMARK_VIEWBOX}'><path d='${BRANDMARK_PATH}' fill='%23c8963e'/></svg>`,
                )}")`,
                backgroundSize: "150cqw auto",
                backgroundPosition: "-20cqw -30cqh",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {q}
            </div>
          ) : (
            <Title size={stacked ? 3.4 : 3.8} o={inP}>
              {wash === "answer" ? STAGE_ANSWER[stage] ?? q : q}
            </Title>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: copyLeft,
          right: "8cqw",
          top: stacked ? "58cqh" : "48cqh",
          opacity: parts,
        }}
      >
        <PartNames stage={stage} p={parts} t={t} numbered label="what you will know" />
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: "8cqh", textAlign: "center", opacity: late }}>
        <Eyebrow o={late}>{URL}</Eyebrow>
      </div>
    </div>
  );
}

/**
 * THE GENERIC CLOSER, whose job is NOT to end.
 *
 * Shorts count every replay as a view and Instagram counts replays inside watch
 * time, so a vertical short that loops cleanly is watched more than one that
 * stops. And there is nothing to hand over to: end screens never render on
 * mobile web, and no vertical feed has an end-screen equivalent at all - so the
 * call to action lives in pixels we control or it does not exist.
 *
 * Which makes the brief measurable rather than vague: the LAST FRAME MUST CUT
 * BACK TO THE FIRST INVISIBLY. It resolves to the same field the intro opens
 * on, and `furniture:check` compares the two.
 */
function OutroShort({ variant, t, aspect = 16 / 9 }: VProps) {
  const tall = aspect < 1;
  const inP = outCubic(seg(t, 0, 0.8));
  // Everything RETIRES before the end, so the final frame is the bare field the
  // intro opens on. A composition still on screen at the seam is a visible cut.
  const out = 1 - outCubic(seg(t, 2.6, 3.6));
  // `loop-mark` lands ON the mark - the CTA clears first and the mark holds
  // alone - but it still has to clear before the seam. Keeping it up made the
  // last frame a mark and the intro's first frame a bare field, so the loop
  // showed a cut; the check caught it on its first run. The premise survives
  // (the mark is the last thing you see) without breaking the loop.
  const markOnly = variant === "loop-mark";
  const markOut = markOnly ? 1 - outCubic(seg(t, 3.3, 3.9)) : out;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: tall ? "30cqh" : "24cqh",
          display: "grid",
          placeItems: "center",
          opacity: inP * markOut,
          height: tall ? "22cqh" : "30cqh",
        }}
      >
        <svg viewBox={BRANDMARK_VIEWBOX} style={{ height: "100%", width: "auto", maxWidth: "60%", display: "block" }} aria-hidden>
          <defs>
            <linearGradient id="short-mk" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
              <stop offset="55%" stopColor={GOLD} />
              <stop offset="100%" stopColor="var(--color-gold-light)" />
            </linearGradient>
          </defs>
          <path d={BRANDMARK_PATH} fill="url(#short-mk)" />
        </svg>
      </div>

      {/* The CTA in pixels, because no vertical surface renders an end screen. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: tall ? "56cqh" : "60cqh", textAlign: "center", opacity: inP * out }}>
        <Eyebrow o={inP * out}>follow for the whole build</Eyebrow>
        <div style={{ marginTop: "2.2cqh" }}>
          <Title size={tall ? 3 : 2.6} o={inP * out}>
            {URL}
          </Title>
        </div>
      </div>
    </div>
  );
}

function Intro({ variant, stage, title, lesson, t, guides }: VProps) {
  // THE GRID. Thirds, and the composition is placed ON them rather than near
  // them. An intro is not an end screen, so none of YouTube's reserved wells
  // apply and the whole frame is available - which is exactly when a layout
  // drifts into "roughly left" and "roughly right" unless the lines are named.
  //
  //   comb    centred on the FIRST vertical third, so the run has the left
  //           column to itself and the current hex sits on the frame's own
  //           centre line.
  //   mark    centred on the SECOND vertical third, its foot resting on the
  //           first horizontal third.
  //   names   hung from that same horizontal third, in the mark's column.
  //
  // Three anchors, two of them shared, so the right-hand group reads as one
  // object rather than two things that happen to be stacked.
  const V1 = 100 / 3;
  const V2 = 200 / 3;
  const H1 = 100 / 3;
  const COMB_W = 27;
  const RIGHT_W = 34;

  const centre = variant === "parts-centre";
  const stepped = variant === "parts-step" || variant === "parts-manifest-step";
  const numbered = variant === "parts-numbered" || variant === "parts-manifest-step";
  const titled = variant === "parts-titled";

  const i = Math.max(0, STAGE_ORDER.indexOf(stage));
  const from = Math.max(0, i - 1);
  // RETIMED ONTO THE BAR GRID, 2026-08-19. The windows below were seconds
  // somebody liked once -- 0.8, 2.1, 2.8 -- and at 120 BPM none of them landed
  // on a beat, let alone a downbeat. The piece also ran 3.5s, which is 1.75
  // bars: it could not land on a downbeat even in principle. It is now 4.0s =
  // 2 bars = 8 beats, and every window is expressed in beats so it retimes with
  // the tempo instead of drifting away from its own bed.
  //
  //   beat 0-1.5   the comb arrives
  //   beat 0-2.5   the run travels
  //   beat 1.5-3   the three names dissolve TOGETHER, landing at beat 3 (t=1.5s)
  //   beat 2-3     the lock closes on them
  //   beat 3-4     held, then faded -- this is the 500ms of near-silence the
  //                narration needs to start clean
  //
  // THE NAMES STILL LAND TOGETHER AND THEN HOLD, which is the one thing here
  // that is not free to change: the variant's claim rests on pre-training
  // (median d = 0.75) and on motion over a naming block costing verbal memory.
  // They now hold for 4 beats instead of 1.7s, so the retime strengthens that
  // rather than trading against it.
  const inP = outCubic(seg(t, beats(0), beats(1.5)));
  const travel = outCubic(seg(t, beats(0), beats(2.5)));
  const landed = from + (i - from) * travel;
  const lockP = outCubic(seg(t, beats(2), beats(3)));
  const late = outCubic(seg(t, beats(2), beats(3.5)));
  const parts = outCubic(seg(t, beats(1.5), beats(3)));

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
      {/* THE COMB, on the first third. */}
      <div
        style={{
          position: "absolute",
          left: `${V1 / 2 - COMB_W / 2}cqw`,
          width: `${COMB_W}cqw`,
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
          veil={{ top: 18, bottom: 74 }}
          art="art-only"
          show={4.2}
          lock="trace-vise"
          lockP={lockP}
          video
        />
      </div>

      {/* THE MARK, on the second third, resting its foot on the first
          horizontal third - same gradient as the outro, so a viewer meets the
          same object at both ends of the video. */}
      <div
        style={{
          position: "absolute",
          left: `${V2 - RIGHT_W / 2}cqw`,
          width: `${RIGHT_W}cqw`,
          top: `${H1 - 26}cqh`,
          height: "26cqh",
          display: "grid",
          placeItems: "end center",
          opacity: inP,
        }}
      >
        <svg
          viewBox={BRANDMARK_VIEWBOX}
          // CONSTRAINED BY HEIGHT, not width. The mark is taller than it is
          // wide, so sizing it to 76% of a 34cqw column made it ~55cqh tall
          // inside a 27cqh box and it was cropped at the crown. Its box is
          // height-bounded, so the fit has to be too.
          style={{ height: "100%", width: "auto", maxWidth: "100%", display: "block" }}
          aria-hidden
        >
          <defs>
            <linearGradient id="intro-mk" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
              <stop offset="55%" stopColor={GOLD} />
              <stop offset="100%" stopColor="var(--color-gold-light)" />
            </linearGradient>
          </defs>
          <path d={BRANDMARK_PATH} fill="url(#intro-mk)" />
        </svg>
      </div>

      {/* THE NAMES, hung from the same horizontal third, in the mark's column. */}
      <div
        style={{
          position: "absolute",
          left: `${V2 - RIGHT_W / 2}cqw`,
          width: `${RIGHT_W}cqw`,
          top: `${H1 + 4}cqh`,
        }}
      >
        <PartNames
          stage={stage}
          p={parts}
          t={t}
          stepped={stepped}
          numbered={numbered}
          titled={titled}
          centre={centre}
        />
      </div>

      {/* The address on the foot, centred on the frame rather than the column -
          it belongs to the video, not to the right-hand group. */}
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

      {/* The thirds, drawn on request, so the placement is checkable rather
          than eyeballed. Same switch the outro uses for its reserved wells. */}
      {guides ? (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[V1, V2].map((x) => (
            <div
              key={`v${x}`}
              style={{ position: "absolute", left: `${x}cqw`, top: 0, bottom: 0, width: hw(0.06), background: "var(--color-signal-blue)", opacity: 0.5 }}
            />
          ))}
          {[H1, 200 / 3].map((y) => (
            <div
              key={`h${y}`}
              style={{ position: "absolute", top: `${y}cqh`, left: 0, right: 0, height: hw(0.06), background: "var(--color-signal-blue)", opacity: 0.5 }}
            />
          ))}
        </div>
      ) : null}
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
  // RETIMED ONTO THE BAR GRID, 2026-08-19, and this one was the bad case.
  //
  // MEASURED before the change: every window finished by t=2.6s in an 8.0s
  // piece, so the frame was FROZEN for the last 5.4 seconds -- 62% of the
  // runtime, 0.000 frame-to-frame delta. The variant's claim describes "the
  // outline draws itself, then two half-hex jaws travel in and close", and that
  // whole sequence was over inside the first second. A 4-bar piece that
  // finishes its choreography in half a bar is a defect, not a style.
  //
  // 8.0s at 120 BPM is exactly 4 bars / 16 beats, and academy-bed.py lands four
  // events on four consecutive bar downbeats. So the choreography is spread to
  // one landing per bar and they line up with the bed by construction:
  //
  //   beat  0-4   the comb arrives, the rule draws, the names dissolve
  //               -> LANDS on the bar-2 downbeat
  //   beat  4-8   the run travels one cell, the hand-over
  //               -> LANDS on the bar-3 downbeat
  //   beat  8-12  the jaws close on it
  //               -> LANDS on the bar-4 downbeat
  //   beat 12-14  the ladder turns, propagating up the run
  //   beat 14-16  held, deliberately -- an outro should rest before the cut
  //
  // NO GESTURE IS NEW. Every effect that existed still exists and still does the
  // same thing; only its window moved. That keeps this a timing fix rather than
  // a design round, which the owner's picks reserve.
  const inP = outCubic(seg(t, beats(0), beats(3)));
  const rule = outExpo(seg(t, beats(1), beats(4)));
  const late = outCubic(seg(t, beats(12), beats(14)));
  // One unhurried dissolve, and it is the only thing that happens to the names.
  const parts = outCubic(seg(t, beats(2), beats(4)));
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
        opacity: outCubic(seg(t, beats(2), beats(4))),
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
      const raw = outCubic(seg(t, beats(4), beats(8)));
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
      const lockP = outCubic(seg(t, beats(8), beats(12)));
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
      const TURN0 = beats(12);
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
