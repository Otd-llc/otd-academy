"use client";

// The furniture itself. One component, switched on piece + variant.
//
// SCRUB, NEVER PLAY. Every value below is a pure function of `t` - no CSS
// transitions, no springs, no animation timeline. That is not a style
// preference; it is what makes a frame reproducible. A transition is a
// conversation with the wall clock, and a renderer that seeks to t=1.4 twice
// must get the same picture both times. The Logbook film learned this the
// expensive way (24 of 120 frames differed between two runs of an unchanged
// tree), so this starts there instead.
//
// EVERYTHING IS A SHARE OF THE FRAME. Sizes are `cqw`/`cqh` against a container
// query, never px. The film's most expensive single mistake was tuning
// composition at preview scale and encoding it at delivery scale, where an
// "obviously correct" cap turned out to be 16% of a 1080-line frame. A share is
// resolution-independent by construction.
//
// ASCII only.

import type { Stage } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/stages";
import { combAbbr } from "@/lib/phase-comb";
import { stageArt } from "@/lib/guide-stage-art";
import { STAGE_ORDER, SAMPLE_LOWER } from "./furniture";
import { WELLS_16X9, PLAYER_BAR_BOTTOM } from "./youtube";

// ---- easing, all pure -------------------------------------------------------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Progress of a window [a,b], clamped. */
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** Decelerating - the workhorse for something arriving. */
const outCubic = (p: number) => 1 - Math.pow(1 - p, 3);
/** Sharp in, soft out. For a strike. */
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
/** Rises, overshoots slightly, settles. A damped sine, not a spring. */
const settle = (p: number) =>
  p >= 1 ? 1 : 1 - Math.pow(2, -7 * p) * Math.cos(p * Math.PI * 2.2);
/** In and back out again, for a piece that leaves. */
const inOut = (t: number, a: number, b: number, c: number, d: number) =>
  Math.min(outCubic(seg(t, a, b)), 1 - outCubic(seg(t, c, d)));

export type FurnitureProps = {
  piece: string;
  variant: string;
  stage: Stage;
  title: string;
  lesson: string;
  t: number;
  /** Draw the reserved end-screen wells and the player bar. Preview only. */
  guides?: boolean;
};

export function Furniture(props: FurnitureProps) {
  const { piece } = props;
  return (
    <div
      data-furniture
      style={{
        position: "absolute",
        inset: 0,
        containerType: "size",
        overflow: "hidden",
        fontFamily: "var(--font-display)",
      }}
    >
      {piece === "intro" ? <Intro {...props} /> : null}
      {piece === "section" ? <Section {...props} /> : null}
      {piece === "lower" ? <Lower {...props} /> : null}
      {piece === "outro" ? <Outro {...props} /> : null}
    </div>
  );
}

// ---- shared bits ------------------------------------------------------------

/** The mono eyebrow the whole product uses: small, wide-tracked, gold. */
function Eyebrow({ children, o = 1, size = 1.5 }: { children: React.ReactNode; o?: number; size?: number }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: `${size}cqw`,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: "var(--color-command-gold)",
        opacity: o,
      }}
    >
      {children}
    </div>
  );
}

/** A stage hex. The comb is the product's own geometry, so the furniture
 *  borrows it rather than inventing a badge. */
function StageHex({ stage, p, size = 9 }: { stage: Stage; p: number; size?: number }) {
  return (
    <div
      style={{
        width: `${size}cqw`,
        height: `${size * 1.1547}cqw`,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: "var(--color-command-gold)",
        display: "grid",
        placeItems: "center",
        transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * -12}deg)`,
        opacity: p,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: `${size * 0.26}cqw`,
          letterSpacing: "0.08em",
          color: "var(--color-deep-space)",
          fontWeight: 700,
        }}
      >
        {combAbbr(stage)}
      </span>
    </div>
  );
}

/** A rule that draws itself from the left. */
function Rule({ p, thickness = 0.22, color = "var(--color-command-gold)" }: { p: number; thickness?: number; color?: string }) {
  return (
    <div
      style={{
        height: `${thickness}cqw`,
        width: `${p * 100}%`,
        background: color,
        transformOrigin: "left center",
      }}
    />
  );
}

// ---- INTRO ------------------------------------------------------------------

function Intro({ variant, stage, title, lesson, t }: FurnitureProps) {
  const hex = settle(seg(t, 0.15, 0.95));
  const rule = outExpo(seg(t, 0.5, 1.5));
  const words = outCubic(seg(t, 0.75, 1.9));
  const lift = (1 - words) * 2.2;
  const out = 1 - outCubic(seg(t, 3.05, 3.5));

  if (variant === "artifact") {
    const art = stageArt(stage);
    const push = seg(t, 0, 3.5);
    return (
      <div style={{ position: "absolute", inset: 0, opacity: out, background: "var(--color-deep-space)" }}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            style={{
              // THE ART GETS ITS OWN HALF - it does NOT sit behind the type.
              // The first pass centred it at 34% opacity and called that
              // "behind". Shot at 1920x1080 the sheet ran straight through the
              // eyebrow and the rule crossed it: a dimmed thing under type is
              // still a thing under type, and the tile-overflow check passed it
              // because nothing left the frame. Collisions are not overflow.
              position: "absolute",
              right: "-3cqw",
              top: "50cqh",
              width: "50cqw",
              height: "86cqh",
              objectFit: "contain",
              // A slow push. 4% over the whole piece - enough to feel alive,
              // small enough that it never reads as a zoom.
              transform: `translateY(-50%) scale(${1.0 + push * 0.04})`,
              opacity: 0.9 * outCubic(seg(t, 0, 1.2)),
            }}
          />
        ) : null}
        {/* Scrim: opaque under the copy column, gone before the art. Belt and
            braces, so a future tile with a different silhouette cannot creep
            back into the text. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, var(--color-deep-space) 32%, color-mix(in oklab, var(--color-deep-space) 72%, transparent) 50%, transparent 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "8cqw",
            top: "50cqh",
            width: "44cqw",
            transform: `translateY(calc(-50% + ${lift}cqh))`,
          }}
        >
          <Eyebrow o={outCubic(seg(t, 0.3, 1))}>
            {lesson} &middot; {STAGE_LABELS[stage]}
          </Eyebrow>
          <div style={{ marginTop: "1.6cqh" }}>
            <Rule p={rule} />
          </div>
          <h1
            style={{
              marginTop: "2cqh",
              fontSize: "3.5cqw",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: "var(--color-white, #fff)",
              opacity: words,
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    );
  }

  if (variant === "bench") {
    // Datum lines draw in, then the title sits on them. The quiet one.
    const v = outExpo(seg(t, 0.2, 1.1));
    const h = outExpo(seg(t, 0.45, 1.4));
    return (
      <div style={{ position: "absolute", inset: 0, opacity: out, background: "var(--color-deep-space)" }}>
        <div
          style={{
            position: "absolute",
            left: "11cqw",
            top: `${50 - v * 50}cqh`,
            width: "0.14cqw",
            height: `${v * 100}cqh`,
            background: "var(--color-gold-dim)",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "11cqw",
            top: "62cqh",
            width: `${h * 78}cqw`,
            height: "0.14cqw",
            background: "var(--color-gold-dim)",
            opacity: 0.55,
          }}
        />
        {/* ANCHORED TO THE DATUM, GROWING UPWARD. Positioned from the top, a
            three-line title (which the longest real title in the shot list is)
            grew straight through the horizontal rule at 62cqh. Sitting the
            block's BOTTOM on the datum makes line count harmless: two lines or
            four, the type still rests on the line instead of crossing it. */}
        <div
          style={{
            position: "absolute",
            left: "14cqw",
            bottom: "40cqh",
            right: "12cqw",
          }}
        >
          <Eyebrow o={outCubic(seg(t, 0.6, 1.2))}>
            {lesson} &middot; {STAGE_LABELS[stage]}
          </Eyebrow>
          <h1
            style={{
              marginTop: "1.8cqh",
              fontSize: "4.2cqw",
              lineHeight: 1.1,
              color: "var(--color-white, #fff)",
              opacity: words,
              transform: `translateY(${lift}cqh)`,
              maxWidth: "80%",
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    );
  }

  // plate - the film's language
  const sweep = outExpo(seg(t, 0.55, 1.6));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out, background: "var(--color-deep-space)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(105deg, transparent 38%, rgba(212,175,90,0.13) 50%, transparent 62%)",
          transform: `translateX(${(sweep - 1) * 60}cqw)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "10cqw",
          top: "50cqh",
          transform: "translateY(-50%)",
          right: "10cqw",
          display: "flex",
          gap: "3.5cqw",
          alignItems: "center",
        }}
      >
        <StageHex stage={stage} p={hex} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow o={outCubic(seg(t, 0.45, 1.1))}>
            {lesson} &middot; {STAGE_LABELS[stage]}
          </Eyebrow>
          <div style={{ marginTop: "1.4cqh", maxWidth: "88%" }}>
            <Rule p={rule} />
          </div>
          <h1
            style={{
              marginTop: "1.8cqh",
              fontSize: "4.4cqw",
              lineHeight: 1.08,
              color: "var(--color-white, #fff)",
              opacity: words,
              transform: `translateY(${lift}cqh)`,
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}

// ---- SECTION ----------------------------------------------------------------

function Section({ variant, stage, title, t }: FurnitureProps) {
  const life = inOut(t, 0, 0.55, 1.15, 1.6);

  if (variant === "wipe") {
    const w = outExpo(seg(t, 0, 0.5));
    const off = outCubic(seg(t, 1.1, 1.6));
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--color-deep-space)",
          clipPath: `inset(0 ${(1 - w) * 100}% 0 0)`,
          opacity: 1 - off,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13cqw",
              letterSpacing: "0.06em",
              color: "var(--color-command-gold)",
              lineHeight: 1,
            }}
          >
            {combAbbr(stage)}
          </div>
          <Eyebrow size={1.7}>{STAGE_LABELS[stage]}</Eyebrow>
        </div>
      </div>
    );
  }

  if (variant === "comb") {
    // The whole comb, current cell lit. Says where you are in the build.
    const i = STAGE_ORDER.indexOf(stage);
    return (
      <div
        style={{
          position: "absolute",
          right: "5cqw",
          top: "7cqh",
          display: "flex",
          gap: "0.6cqw",
          opacity: life,
          transform: `translateY(${(1 - life) * -2}cqh)`,
        }}
      >
        {STAGE_ORDER.map((s, n) => {
          const on = n === i;
          const lit = on ? outCubic(seg(t, 0.35, 0.9)) : 0;
          return (
            <div
              key={s}
              style={{
                width: "3.1cqw",
                height: "3.58cqw",
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                background: on
                  ? `color-mix(in oklab, var(--color-command-gold) ${30 + lit * 70}%, var(--color-bg-3))`
                  : "var(--color-bg-3)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.86cqw",
                  color: on ? "var(--color-deep-space)" : "var(--color-muted)",
                  fontWeight: on ? 700 : 400,
                }}
              >
                {combAbbr(s)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // band - sweeps the lower third, never covers the work
  const grow = outExpo(seg(t, 0, 0.5));
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: `${PLAYER_BAR_BOTTOM * 100 + 4}cqh`,
        opacity: life,
      }}
    >
      <div
        style={{
          background: "var(--color-deep-space)",
          borderLeft: "0.32cqw solid var(--color-command-gold)",
          padding: "1.6cqh 3cqw",
          width: `${grow * 62}%`,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <Eyebrow>{STAGE_LABELS[stage]}</Eyebrow>
        <div
          style={{
            marginTop: "0.6cqh",
            fontSize: "2.3cqw",
            color: "var(--color-white, #fff)",
            opacity: outCubic(seg(t, 0.3, 0.9)),
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}

// ---- LOWER THIRD ------------------------------------------------------------

function Lower({ variant, t }: FurnitureProps) {
  const s = SAMPLE_LOWER[variant] ?? SAMPLE_LOWER.rule;
  const life = inOut(t, 0, 0.6, 3.3, 4);
  // Clear of the player's scrubber, always.
  const bottom = PLAYER_BAR_BOTTOM * 100 + 5;

  if (variant === "panel") {
    return (
      <div
        style={{
          position: "absolute",
          left: "6cqw",
          bottom: `${bottom}cqh`,
          opacity: life,
          transform: `translateX(${(1 - life) * -3}cqw)`,
          background: "color-mix(in oklab, var(--color-deep-space) 88%, transparent)",
          border: "0.1cqw solid var(--color-gold-dim)",
          borderLeft: "0.34cqw solid var(--color-command-gold)",
          padding: "1.5cqh 2.4cqw",
          maxWidth: "52cqw",
        }}
      >
        <Eyebrow size={1.15}>{s.label}</Eyebrow>
        <div style={{ marginTop: "0.5cqh", fontSize: "2.1cqw", color: "var(--color-white, #fff)" }}>
          {s.value}
        </div>
      </div>
    );
  }

  if (variant === "warn") {
    // Deliberately unlike the other two. A warning that looks like a label is a
    // warning nobody reads - the polarised-part and hot-air moments are exactly
    // where a learner destroys a board.
    const pulse = 0.82 + 0.18 * Math.cos(t * Math.PI * 2.4);
    return (
      <div
        style={{
          position: "absolute",
          left: "6cqw",
          bottom: `${bottom}cqh`,
          opacity: life,
          display: "flex",
          alignItems: "stretch",
          maxWidth: "56cqw",
        }}
      >
        <div
          style={{
            width: "1cqw",
            background: "var(--color-danger-coral)",
            opacity: pulse,
          }}
        />
        <div
          style={{
            background: "color-mix(in oklab, var(--color-deep-space) 92%, var(--color-danger-coral))",
            padding: "1.5cqh 2.4cqw",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "1.15cqw",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--color-danger-coral)",
            }}
          >
            {s.label}
          </div>
          <div style={{ marginTop: "0.5cqh", fontSize: "2.1cqw", color: "var(--color-white, #fff)" }}>
            {s.value}
          </div>
        </div>
      </div>
    );
  }

  // rule - thinnest footprint
  const grow = outExpo(seg(t, 0.1, 0.9));
  return (
    <div style={{ position: "absolute", left: "6cqw", bottom: `${bottom}cqh`, opacity: life, width: "46cqw" }}>
      <Eyebrow size={1.15} o={outCubic(seg(t, 0.25, 0.9))}>
        {s.label}
      </Eyebrow>
      <div style={{ marginTop: "0.7cqh" }}>
        <Rule p={grow} thickness={0.16} />
      </div>
      <div
        style={{
          marginTop: "0.8cqh",
          fontSize: "2.1cqw",
          color: "var(--color-white, #fff)",
          opacity: outCubic(seg(t, 0.45, 1.2)),
        }}
      >
        {s.value}
      </div>
    </div>
  );
}

// ---- OUTRO ------------------------------------------------------------------

function Outro({ variant, stage, lesson, t, guides }: FurnitureProps) {
  const inP = outCubic(seg(t, 0.1, 1.1));
  const rule = outExpo(seg(t, 0.5, 1.6));

  const wells =
    variant === "split"
      ? ["video1", "video2"]
      : variant === "ladder"
        ? ["video1", "video2", "subscribe"]
        : Object.keys(WELLS_16X9);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--color-deep-space)" }}>
      {/* The reserved regions. Drawn only in the preview - they are negative
          space in the deliverable, which is the entire point. */}
      {guides
        ? wells.map((k) => {
            const w = WELLS_16X9[k];
            return (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: `${w.x * 100}%`,
                  top: `${w.y * 100}%`,
                  width: `${w.w * 100}%`,
                  height: `${w.h * 100}%`,
                  border: "0.12cqw dashed color-mix(in oklab, var(--color-command-gold) 45%, transparent)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.95cqw",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "color-mix(in oklab, var(--color-command-gold) 60%, transparent)",
                }}
              >
                {k}
              </div>
            );
          })
        : null}

      <div
        style={{
          position: "absolute",
          left: variant === "split" ? "8cqw" : "30cqw",
          right: variant === "split" ? "44cqw" : "38cqw",
          top: "50cqh",
          transform: `translateY(calc(-50% + ${(1 - inP) * 2.5}cqh))`,
          opacity: inP,
          textAlign: variant === "split" ? "left" : "center",
        }}
      >
        <Eyebrow>{variant === "ladder" ? "next in the build" : "keep going"}</Eyebrow>
        <div
          style={{
            marginTop: "1.4cqh",
            fontSize: variant === "split" ? "3.6cqw" : "3cqw",
            lineHeight: 1.12,
            color: "var(--color-white, #fff)",
          }}
        >
          {variant === "ladder" ? STAGE_LABELS[stage] : lesson}
        </div>
        <div style={{ marginTop: "1.6cqh", display: "flex", justifyContent: variant === "split" ? "flex-start" : "center" }}>
          <div style={{ width: "60%" }}>
            <Rule p={rule} />
          </div>
        </div>
        <div
          style={{
            marginTop: "1.8cqh",
            fontFamily: "var(--font-mono)",
            fontSize: "1.35cqw",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--color-command-gold)",
            opacity: outCubic(seg(t, 1.4, 2.4)),
          }}
        >
          academy.onethousanddrones.com
        </div>
      </div>
    </div>
  );
}
