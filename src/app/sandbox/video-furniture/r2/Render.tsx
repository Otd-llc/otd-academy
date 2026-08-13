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
// (`--font-numeral`) for every number including small inline ones, Space Mono
// (`--font-mono`) for eyebrows and labels, Lora (`--font-serif`) for the reading
// voice. Round 1 set numbers in mono, which is the one substitution the system
// specifically calls out.
//
// ASCII only.

import type { Stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/stages";
import { combAbbr } from "@/lib/phase-comb";
import { stageArt, stageArtGhost } from "@/lib/guide-stage-art";
import { STAGE_ORDER } from "../furniture";
import { WELLS_16X9, GRAPHICS_16X9, PLAYER_BAR_BOTTOM } from "../youtube";
import { furnitureOutStack, exitP, type FurnitureOut } from "./exits";
import { PIECES, type PieceKey } from "./variants";
import { Ghost, CombWalk, Hairline } from "./Render2";
import { ts, hw } from "./units";

// ---- easing ----------------------------------------------------------------
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const outCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
export const inOut = (t: number, a: number, b: number, c: number, d: number) =>
  Math.min(outCubic(seg(t, a, b)), 1 - outCubic(seg(t, c, d)));

export const GOLD = "var(--color-command-gold)";
export const TITLE = "var(--color-title)";
export const TEXT = "var(--color-text)";
export const MUTED = "var(--color-muted)";
export const FIELD = "var(--color-deep-space)";
export const HAIR = "var(--color-panel-border)";

export type VProps = {
  piece: string;
  /** How the piece LEAVES, as a STACK applied outermost first. Defaulted, never
   *  absent - a piece with no exit is the fade nobody chose. */
  exit?: FurnitureOut[];
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

export function PieceFrame(p: VProps) {
  // THE EXIT IS APPLIED HERE, ONCE, for every piece. Doing it per-variant is how
  // ten treatments end up with nine fades and one considered ending.
  const seconds = (PIECES[p.piece as PieceKey] ?? PIECES.intro).seconds;
  // One wrapper per stacked exit, outermost first. See furnitureOutStack for
  // why this is nesting rather than a merged style object.
  const layers = furnitureOutStack(p.exit?.length ? p.exit : ["settle"], exitP(p.t, seconds));
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
    </div>
  );

  return layers.reduceRight(
    (inner, style, i) => (
      <div key={i} style={{ position: "absolute", inset: 0, ...style }}>
        {inner}
      </div>
    ),
    body,
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

/** The signature readout. Saira, tabular, gold - for ANY number, including a
 *  small inline one. */
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

export function Hair({ p = 1, w = 0.14, color = GOLD }: { p?: number; w?: number; color?: string }) {
  return <div style={{ height: `${w}cqw`, width: `${p * 100}%`, background: color }} />;
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
  const art = stageArt(stage);
  const ghost = stageArtGhost(stage);
  const push = seg(t, 0, 3.5);
  const rule = outExpo(seg(t, 0.5, 1.5));
  const words = outCubic(seg(t, 0.75, 1.9));
  const eye = outCubic(seg(t, 0.3, 1));
  const dy = (1 - words) * 2;
  const fade = outCubic(seg(t, 0, 1.2));
  // No local fade: the frame wrapper owns the exit now, so a variant that also
  // faded would double the ending and make every exit look like a fade.
  const out = 1;

  const art_ = (style: React.CSSProperties) =>
    art ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={art} alt="" style={{ position: "absolute", objectFit: "contain", opacity: 0.92 * fade, ...style }} />
    ) : null;

  const scrim = (dir: "l" | "r", strong = false) => (
    <div
      data-backdrop
      style={{
        position: "absolute",
        inset: 0,
        background: strong
          ? `linear-gradient(${dir === "l" ? "90deg" : "270deg"}, ${FIELD} 42%, color-mix(in oklab, ${FIELD} 88%, transparent) 62%, color-mix(in oklab, ${FIELD} 45%, transparent) 82%)`
          : `linear-gradient(${dir === "l" ? "90deg" : "270deg"}, ${FIELD} 30%, color-mix(in oklab, ${FIELD} 72%, transparent) 50%, transparent 68%)`,
      }}
    />
  );

  const copy_ = (style: React.CSSProperties, size = 3.4, align: "left" | "center" = "left") => (
    <div style={{ position: "absolute", textAlign: align, ...style }}>
      <Eyebrow o={eye}>
        {lesson} &middot; {STAGE_LABELS[stage]}
      </Eyebrow>
      <div style={{ marginTop: "1.5cqh", display: "flex", justifyContent: align === "center" ? "center" : "flex-start" }}>
        <div style={{ width: align === "center" ? "40%" : "100%" }}>
          <Hair p={rule} />
        </div>
      </div>
      <div style={{ marginTop: "1.8cqh" }}>
        <Title size={size} o={words} dy={dy}>
          {title}
        </Title>
      </div>
    </div>
  );

  const wrap = (children: React.ReactNode) => (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>{children}</div>
  );

  switch (variant) {
    case "left":
      return wrap(
        <>
          {art_({ left: "-3cqw", top: "50cqh", width: "50cqw", height: "86cqh", transform: `translateY(-50%) scale(${1 + push * 0.04})` })}
          {scrim("r")}
          {copy_({ right: "8cqw", top: "50cqh", width: "44cqw", transform: "translateY(-50%)" })}
        </>,
      );
    case "bleed":
      return wrap(
        <>
          {art_({ right: "-16cqw", top: "44cqh", width: "72cqw", height: "112cqh", transform: `translateY(-50%) scale(${1 + push * 0.05})` })}
          {/* DELIBERATE: bleed is the variant where the artifact runs under the
              type. The scrim is what makes that legible, so it is stronger here
              and the overlap is declared rather than argued about. */}
          {scrim("l", true)}
          {copy_({ left: "7cqw", bottom: "13cqh", width: "44cqw" }, 3.6)}
        </>,
      );
    case "inset":
      return wrap(
        <>
          <div
            style={{
              position: "absolute",
              right: "7cqw",
              top: "50cqh",
              transform: "translateY(-50%)",
              width: "38cqw",
              height: "70cqh",
              border: `0.12cqw solid ${HAIR}`,
              opacity: fade,
            }}
          >
            {art_({ inset: "6%", width: "88%", height: "88%", transform: `scale(${1 + push * 0.03})` })}
          </div>
          {copy_({ left: "7cqw", top: "50cqh", width: "40cqw", transform: "translateY(-50%)" })}
        </>,
      );
    case "hex":
      return wrap(
        <>
          <div style={{ position: "absolute", right: "9cqw", top: "50cqh", transform: "translateY(-50%)", opacity: fade }}>
            <div
              style={{
                width: "30cqw",
                height: "34.6cqw",
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                position: "relative",
                background: "color-mix(in oklab, var(--color-gold-dim) 14%, transparent)",
              }}
            >
              {art_({ inset: 0, width: "100%", height: "100%", transform: `scale(${1.08 + push * 0.04})` })}
            </div>
          </div>
          {copy_({ left: "7cqw", top: "50cqh", width: "40cqw", transform: "translateY(-50%)" })}
        </>,
      );
    case "strip":
      return wrap(
        <>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "26cqw", overflow: "hidden", opacity: fade }}>
            {art_({ inset: 0, width: "100%", height: "100%", transform: `scale(${1.25 + push * 0.04})` })}
          </div>
          <div style={{ position: "absolute", right: "26cqw", top: 0, bottom: 0, width: "0.12cqw", background: HAIR, opacity: fade }} />
          {copy_({ left: "7cqw", top: "50cqh", width: "58cqw", transform: "translateY(-50%)" }, 4.2)}
        </>,
      );
    case "ghost":
      return wrap(
        <>
          {ghost ? (
            <div
              data-backdrop
              style={{
                position: "absolute",
                left: "50cqw",
                top: "50cqh",
                width: "62cqw",
                height: "92cqh",
                transform: `translate(-50%,-50%) scale(${1 + push * 0.03})`,
                background: GOLD,
                opacity: 0.16 * fade,
                WebkitMaskImage: `url(${ghost})`,
                maskImage: `url(${ghost})`,
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
              }}
            />
          ) : null}
          {copy_({ left: "16cqw", right: "16cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.6, "center")}
        </>,
      );
    case "corner":
      return wrap(
        <>
          {art_({ right: "6cqw", top: "8cqh", width: "26cqw", height: "34cqh", transform: `scale(${1 + push * 0.03})` })}
          {copy_({ left: "7cqw", bottom: "12cqh", width: "62cqw" }, 4.6)}
        </>,
      );
    case "stack":
      return wrap(
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2cqh" }}>
          <div style={{ position: "relative", width: "34cqw", height: "34cqh" }}>
            {art_({ inset: 0, width: "100%", height: "100%", transform: `scale(${1 + push * 0.03})` })}
          </div>
          <div style={{ width: "26cqw" }}>
            <Hair p={rule} />
          </div>
          <Eyebrow o={eye}>
            {lesson} &middot; {STAGE_LABELS[stage]}
          </Eyebrow>
          <div style={{ maxWidth: "72cqw", textAlign: "center" }}>
            <Title size={3} o={words} dy={dy}>
              {title}
            </Title>
          </div>
        </div>,
      );
    case "datum":
      return wrap(
        <>
          <div style={{ position: "absolute", left: 0, top: "58cqh", width: `${outExpo(seg(t, 0.2, 1.2)) * 100}%`, height: "0.12cqw", background: "var(--color-gold-dim)" }} />
          {art_({ right: "8cqw", bottom: "42cqh", width: "34cqw", height: "44cqh", transform: `scale(${1 + push * 0.03})` })}
          {copy_({ left: "8cqw", top: "64cqh", width: "50cqw" }, 3.2)}
        </>,
      );
    case "right":
    default:
      return wrap(
        <>
          {art_({ right: "-3cqw", top: "50cqh", width: "50cqw", height: "86cqh", transform: `translateY(-50%) scale(${1 + push * 0.04})` })}
          {scrim("l")}
          {copy_({ left: "8cqw", top: "50cqh", width: "44cqw", transform: "translateY(-50%)" })}
        </>,
      );
  }
}

// ---- SECTION (10) -----------------------------------------------------------

function Section({ variant, stage, t }: VProps) {
  const life = inOut(t, 0, 0.55, 1.35, 1.8);
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
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${PLAYER_BAR_BOTTOM * 100 + 5}cqh`, opacity: life }}>
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

const L_SAMPLE: Record<string, { label: string; value: string; num?: string; unit?: string }> = {
  hairline: { label: "U2 / regulator", value: "AP2112K-3.3" },
  accent: { label: "net class", value: "USB differential pair" },
  bracket: { label: "keep-out", value: "antenna clearance zone" },
  masthead: { label: "this pass", value: "drag-solder the fine pitch" },
  readout: { label: "recommended supply", value: "", num: "2.42", unit: "A" },
  badge: { label: "C11", value: "10 uF / 16 V / X7R" },
  tag: { label: "D2", value: "SS34 schottky" },
  warn: { label: "polarised", value: "D2 and C11 fail loudly if reversed" },
  fail: { label: "DRC", value: "3 clearance violations" },
  pass: { label: "ERC", value: "clean, 0 errors" },
};

function Lower({ variant, t }: VProps) {
  const s = L_SAMPLE[variant] ?? L_SAMPLE.hairline;
  const life = inOut(t, 0, 0.6, 3.3, 4);
  const grow = outExpo(seg(t, 0.1, 0.95));
  const bottom = PLAYER_BAR_BOTTOM * 100 + 5;
  const base: React.CSSProperties = { position: "absolute", left: "6cqw", bottom: `${bottom}cqh`, opacity: life };

  const label_ = (color: string = GOLD) => (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", textTransform: "uppercase", color }}>
      {s.label}
    </div>
  );
  const value_ = (size = 2, color: string = TEXT) => (
    <div style={{ fontFamily: "var(--font-display)", fontSize: ts(size), color, lineHeight: 1.1 }}>{s.value}</div>
  );

  switch (variant) {
    case "accent":
      return (
        <div style={{ ...base, borderLeft: `0.3cqw solid ${GOLD}`, paddingLeft: "1.6cqw" }}>
          {label_()}
          <div style={{ marginTop: "0.5cqh" }}>
            {value_()}
          </div>
        </div>
      );
    case "bracket":
      return (
        <div style={{ ...base, width: "42cqw" }}>
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
        <div style={{ ...base, width: "44cqw" }}>
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
        <div style={base}>
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
        <div style={{ ...base, display: "flex", alignItems: "center", gap: "1.4cqw" }}>
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
        <div style={{ ...base, display: "flex", alignItems: "stretch", gap: "1cqw" }}>
          <div style={{ border: `0.1cqw solid ${GOLD}`, display: "grid", placeItems: "center", padding: "0 1cqw" }}>
            <Num size={2.2}>{s.label}</Num>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: ts(1.5), letterSpacing: "0.1em", color: TEXT }}>
            {s.value}
          </div>
        </div>
      );
    case "warn":
      return (
        <div style={{ ...base, borderLeft: "0.3cqw solid var(--color-danger-coral)", paddingLeft: "1.6cqw" }}>
          {label_("var(--color-danger-coral)")}
          <div style={{ marginTop: "0.5cqh" }}>
            {value_()}
          </div>
        </div>
      );
    case "fail":
      return (
        <div style={{ ...base, display: "flex", alignItems: "center", gap: "1.2cqw", borderTop: "0.18cqw solid var(--color-alert-red)", paddingTop: "1.1cqh", width: "40cqw" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", color: "var(--color-alert-red)" }}>
            {s.label}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: TITLE }}>{s.value}</span>
        </div>
      );
    case "pass":
      return (
        <div style={{ ...base, display: "flex", alignItems: "center", gap: "1.2cqw", borderTop: "0.18cqw solid var(--color-status-green)", paddingTop: "1.1cqh", width: "40cqw" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", color: "var(--color-status-green)" }}>
            {s.label}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: ts(2), color: TITLE }}>{s.value}</span>
        </div>
      );
    case "hairline":
    default:
      return (
        <div style={{ ...base, width: "42cqw" }}>
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
      {graphics_()}
      {body()}
    </div>
  );
}
