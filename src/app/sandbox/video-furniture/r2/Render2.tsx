"use client";

// The three follow-up sets: ghost, comb walk, hairline.
//
// Split from Render.tsx rather than appended to it, and importing that file's
// easing and type helpers rather than restating them. A second copy of `seg` or
// a second `GOLD` is how two renderers drift into two visual systems.
//
// ASCII only.

import type React from "react";
import { STAGE_LABELS } from "@/lib/stages";
import { stageArt, stageArtGhost } from "@/lib/guide-stage-art";
import { STAGE_ORDER } from "../furniture";
import { PLAYER_BAR_BOTTOM } from "../youtube";
import { CombCell } from "./RealComb";
import { ts, hw } from "./units";
import {
  seg, outCubic, outExpo, inOut,
  GOLD, TITLE, TEXT, MUTED, HAIR,
  Eyebrow, Title, Num, Desig, Hair,
  type VProps,
} from "./Render";

// ---- GHOST (10) -------------------------------------------------------------
//
// The ghost map is `coverage x ink` derived from LUMINANCE, not from the
// artifact's alpha - which is why it can be painted as one flat colour and still
// read as the drawing rather than a silhouette. That is the whole reason it can
// carry a frame on its own.

export function Ghost({ variant, stage, title, lesson, t }: VProps) {
  const g = stageArtGhost(stage);
  const art = stageArt(stage);
  const fade = outCubic(seg(t, 0, 1.2));
  const push = seg(t, 0, 3.5);
  const rule = outExpo(seg(t, 0.5, 1.5));
  const words = outCubic(seg(t, 0.75, 1.9));
  const eye = outCubic(seg(t, 0.3, 1));
  const dy = (1 - words) * 2;

  const ghostBox = (style: React.CSSProperties, op: number, color = GOLD): React.ReactNode =>
    g ? (
      <div
        data-backdrop
        style={{
          position: "absolute",
          background: color,
          opacity: op,
          WebkitMaskImage: `url(${g})`,
          maskImage: `url(${g})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          ...style,
        }}
      />
    ) : null;

  const copy = (style: React.CSSProperties, size = 3.4, align: "left" | "center" = "left") => (
    <div style={{ position: "absolute", textAlign: align, ...style }}>
      <Eyebrow o={eye}>
        {lesson} &middot; {STAGE_LABELS[stage]}
      </Eyebrow>
      <div style={{ marginTop: "1.5cqh", display: "flex", justifyContent: align === "center" ? "center" : "flex-start" }}>
        <div style={{ width: align === "center" ? "38%" : "100%" }}>
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

  const full: React.CSSProperties = {
    left: "50cqw",
    top: "50cqh",
    width: "62cqw",
    height: "92cqh",
    transform: `translate(-50%,-50%) scale(${1 + push * 0.03})`,
  };

  switch (variant) {
    case "offset":
      return (
        <>
          {ghostBox({ right: "2cqw", top: "50cqh", width: "44cqw", height: "84cqh", transform: `translateY(-50%) scale(${1 + push * 0.03})` }, 0.3 * fade)}
          {copy({ left: "8cqw", top: "50cqh", width: "42cqw", transform: "translateY(-50%)" })}
        </>
      );
    case "bleed":
      return (
        <>
          {ghostBox({ left: "34cqw", top: "50cqh", width: "96cqw", height: "150cqh", transform: `translateY(-50%) scale(${1 + push * 0.04})` }, 0.2 * fade)}
          {copy({ left: "7cqw", bottom: "13cqh", width: "42cqw" }, 3.4)}
        </>
      );
    case "duo":
      return (
        <>
          {ghostBox(full, 0.16 * fade)}
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              alt=""
              data-backdrop
              style={{
                position: "absolute",
                right: "8cqw",
                top: "50cqh",
                width: "26cqw",
                height: "40cqh",
                objectFit: "contain",
                transform: `translateY(-50%) scale(${1 + push * 0.03})`,
                opacity: 0.95 * fade,
              }}
            />
          ) : null}
          {copy({ left: "8cqw", top: "50cqh", width: "38cqw", transform: "translateY(-50%)" })}
        </>
      );
    case "sweep": {
      const x = outExpo(seg(t, 0.2, 1.7)) * 130 - 15;
      return (
        <>
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${Math.max(0, 100 - x)}% 0 0)` }}>
            {ghostBox(full, 0.22)}
          </div>
          {/* The survey line crosses the frame, and crossing the type is the
              gesture. Declared so the checker reports it rather than calling it
              a collision - it still has to be looked at. */}
          <div
            data-backdrop
            style={{
              position: "absolute",
              left: `${x}cqw`,
              top: 0,
              bottom: 0,
              width: "0.16cqw",
              background: GOLD,
              opacity: x > 0 && x < 110 ? 0.85 : 0,
            }}
          />
          {copy({ left: "17cqw", right: "17cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.3, "center")}
        </>
      );
    }
    case "outline":
      return (
        <>
          <div data-backdrop style={{ position: "absolute", left: "8cqw", right: "8cqw", top: "10cqh", bottom: "10cqh", border: `0.1cqw solid ${HAIR}`, opacity: fade }} />
          {ghostBox({ left: "50cqw", top: "50cqh", width: "52cqw", height: "70cqh", transform: "translate(-50%,-50%)" }, 0.12 * fade)}
          {copy({ left: "15cqw", right: "15cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.1, "center")}
        </>
      );
    case "fill": {
      const lvl = outCubic(seg(t, 0.4, 2.4)) * 100;
      return (
        <>
          {ghostBox(full, 0.1 * fade, MUTED)}
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(${100 - lvl}% 0 0 0)` }}>{ghostBox(full, 0.34)}</div>
          {copy({ left: "17cqw", right: "17cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.3, "center")}
        </>
      );
    }
    case "grid":
      return (
        <>
          <div
            data-backdrop
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.45 * fade,
              backgroundImage: `linear-gradient(to right, ${HAIR} 0.04cqw, transparent 0.04cqw), linear-gradient(to bottom, ${HAIR} 0.04cqw, transparent 0.04cqw)`,
              backgroundSize: "3cqw 3cqw",
            }}
          />
          {ghostBox(full, 0.18 * fade)}
          {copy({ left: "17cqw", right: "17cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.3, "center")}
        </>
      );
    case "hex":
      return (
        <>
          <div
            data-backdrop
            style={{
              position: "absolute",
              left: "50cqw",
              top: "50cqh",
              width: "48cqw",
              height: "55.4cqw",
              transform: "translate(-50%,-50%)",
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              border: `0.1cqw solid ${HAIR}`,
              opacity: fade,
            }}
          >
            {ghostBox({ inset: "8%" }, 0.22)}
          </div>
          {copy({ left: "15cqw", right: "15cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.1, "center")}
        </>
      );
    case "strata": {
      const BANDS = 7;
      return (
        <>
          {Array.from({ length: BANDS }, (_, n) => {
            const p = outCubic(seg(t, 0.15 + n * 0.09, 0.85 + n * 0.09));
            const top = (n / BANDS) * 100;
            const h = 100 / BANDS;
            return (
              <div
                key={n}
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath: `inset(${top}% 0 ${100 - top - h}% 0)`,
                  opacity: p,
                  transform: `translateX(${(1 - p) * 3}cqw)`,
                }}
              >
                {ghostBox(full, 0.2)}
              </div>
            );
          })}
          {copy({ left: "17cqw", right: "17cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.3, "center")}
        </>
      );
    }
    case "centre":
    default:
      return (
        <>
          {ghostBox(full, 0.16 * fade)}
          {copy({ left: "17cqw", right: "17cqw", top: "50cqh", transform: "translateY(-50%)" }, 3.5, "center")}
        </>
      );
  }
}

// ---- COMB WALK (10) ---------------------------------------------------------
//
// Every cell is `CombCell`, which is the product's own `.gh-node` markup with the
// real `HexPrism`. Nothing here styles a hexagon; it only decides which cell is
// lit and how the light gets there.

export function CombWalk({ variant, stage, t, aspect = 16 / 9 }: VProps) {
  const i = STAGE_ORDER.indexOf(stage);
  const prev = Math.max(0, i - 1);
  const life = inOut(t, 0, 0.5, 1.8, 2.2);
  const walk = outCubic(seg(t, 0.35, 1.15));

  // Every distance here is cqmin - a share of the frame's SHORT edge. The comb
  // is laid out as a centred flex row rather than by absolute-left arithmetic,
  // which is what previously let a cqw width sit next to a cqh top and land the
  // whole comb off centre. A flex row needs no aspect and no arithmetic.
  const W = variant === "zoom" ? 18 + walk * 7 : 18;
  // Pointy-top hexes tessellate at 3/4 of their width. The negative margin is
  // what makes it a honeycomb rather than hexagons in a line.
  const OVERLAP = -W * 0.25;

  // A COMB OF EIGHT IS A LAYOUT, NOT A TYPE ELEMENT - and the two want opposite
  // things here. Sizing the cells against the short edge is what keeps the
  // numeral inside them legible at any aspect, but eight of them then need
  // ~1212 px of width and a portrait frame has 1080. The first version simply
  // ran off both edges.
  //
  // Shrinking the comb to fit would undo the whole unit fix. So the cells keep
  // their physical size and the COMB is windowed instead: show as many as fit,
  // centred on the current stage. A viewer sees where they are and what is
  // adjacent, which is what the card is for; seeing all eight is not.
  const frameWidthCqmin = aspect >= 1 ? 100 * aspect : 100;
  const step = W * 0.75;
  const fits = Math.max(3, Math.floor((frameWidthCqmin * 0.92 - W) / step) + 1);
  const total = STAGE_ORDER.length;
  const span = Math.min(total, fits);
  // Keep the current cell inside the window, and the window inside the comb.
  const from = Math.max(0, Math.min(total - span, i - Math.floor((span - 1) / 2)));
  const shown = STAGE_ORDER.slice(from, from + span);

  const kindOf = (n: number): "done" | "current" | "blocked" | "pending" => {
    switch (variant) {
      case "trail": {
        const reached = walk * (i + 1);
        return n < reached ? (n === i ? "current" : "done") : "pending";
      }
      case "step":
        if (n === i) return walk > 0.5 ? "current" : "pending";
        if (n === prev) return walk > 0.5 ? "done" : "current";
        return n < i ? "done" : "pending";
      case "sweep": {
        const front = walk * STAGE_ORDER.length;
        return n < front ? (n === i ? "current" : "done") : "pending";
      }
      default:
        return n < i ? "done" : n === i ? "current" : "pending";
    }
  };

  const cellStyle = (n: number): React.CSSProperties => {
    if (variant === "drop" && n === i) return { transform: `translateY(${(1 - walk) * -16}cqmin)`, opacity: walk };
    if (variant === "pulse" && n === i) {
      const active = t > 0.5 && t < 1.5 ? 1 : 0;
      return { transform: `scale(${1 + 0.08 * active * Math.max(0, Math.cos((t - 0.65) * Math.PI * 2.4))})` };
    }
    if (variant === "focus" && n !== i) return { opacity: 0.3, filter: "blur(0.1cqmin)" };
    return {};
  };

  // `zoom` slides the row so the current cell ends centred.
  const shift = variant === "zoom" ? -(i - from - (span - 1) / 2) * step * walk : 0;

  return (
    <div
      className="gh"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: life,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", transform: `translateX(${shift}cqmin)` }}>
        {shown.map((s, k) => {
          const n = from + k;
          return (
          <div
            key={s}
            style={{
              marginLeft: k === 0 ? 0 : `${OVERLAP}cqmin`,
              display: "flex",
              ...cellStyle(n),
            }}
          >
            <CombCell
              stage={s}
              num={String(n + 1).padStart(2, "0")}
              kind={kindOf(n)}
              w={W}
              showArt={variant === "unmask" && n === i && walk > 0.35}
              chip={n === i ? "current" : undefined}
            />
          </div>
          );
        })}
      </div>

      {variant === "arrow" ? (
        <div
          style={{
            marginTop: `${W * 0.18}cqmin`,
            width: `${W * 0.5 * outExpo(seg(t, 0.25, 0.9))}cqmin`,
            height: "0.2cqmin",
            background: GOLD,
          }}
        />
      ) : null}

      {/* The `count` treatment lived here: a Saira watermark counting up to the
          stage ordinal as the fill arrived. Removed against the ban list - a
          counting numeral is the motion-graphics-template default, and it is
          transient information, so the value is unreadable until it stops and
          the only frame that carries meaning is the last one. Note this is NOT
          the same device as `outro/count`, which is a STATIC `04 / 09` readout
          and is the one thing research 2.6 actively asks for. */}
    </div>
  );
}

// ---- HAIRLINE (10) ----------------------------------------------------------
//
// The rule is the subject. Each variant changes how it arrives and what it does
// to the type around it.

export function Hairline({ variant, t }: VProps) {
  const life = inOut(t, 0, 0.6, 3.4, 4);
  const grow = outExpo(seg(t, 0.1, 0.95));
  const late = outCubic(seg(t, 0.45, 1.3));
  const bottom = PLAYER_BAR_BOTTOM * 100 + 5;
  const LABEL = "U2 / regulator";
  const VALUE = "AP2112K-3.3";

  const label = (o = 1) => (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: ts(1.1), letterSpacing: "0.24em", textTransform: "uppercase", color: GOLD, opacity: o }}>
      {LABEL}
    </div>
  );
  // A part number, so Saira rather than Bebas: in Bebas `0` and `O` are the
  // same drawing, and `AP2112K-3.3` carries no lexical context to recover a
  // misread from. Measurements are on `Desig` in Render.tsx.
  const value = (o = 1) => (
    <div style={{ lineHeight: 1.1 }}>
      <Desig size={2} color={TEXT} o={o}>
        {VALUE}
      </Desig>
    </div>
  );
  const base: React.CSSProperties = { position: "absolute", left: "6cqw", bottom: `${bottom}cqh`, opacity: life, width: "42cqw" };

  switch (variant) {
    case "split":
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh", display: "flex", justifyContent: "center" }}>
            <div style={{ width: `${grow * 100}%`, height: "0.12cqw", background: GOLD }} />
          </div>
          <div style={{ marginTop: "0.7cqh" }}>{value(late)}</div>
        </div>
      );
    case "under":
      return (
        <div style={base}>
          {label(outCubic(seg(t, 0, 0.5)))}
          <div style={{ marginTop: "0.5cqh" }}>{value(outCubic(seg(t, 0.15, 0.7)))}</div>
          <div style={{ marginTop: "0.7cqh" }}>
            <Hair p={outExpo(seg(t, 0.7, 1.5))} w={0.12} />
          </div>
        </div>
      );
    case "between":
      return (
        <div style={base}>
          {label()}
          <div style={{ height: `${0.4 + grow * 1.1}cqh` }} />
          <Hair p={grow} w={0.12} />
          <div style={{ height: `${0.4 + grow * 1.1}cqh` }} />
          {value()}
        </div>
      );
    case "tick":
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh", display: "flex", alignItems: "center" }}>
            <div style={{ width: "0.16cqw", height: "1.1cqh", background: GOLD }} />
            <div style={{ width: `${grow * 100}%`, height: "0.12cqw", background: GOLD }} />
          </div>
          <div style={{ marginTop: "0.7cqh" }}>{value(late)}</div>
        </div>
      );
    case "double":
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh" }}>
            <Hair p={grow} w={0.12} />
            <div style={{ marginTop: "0.35cqh", marginLeft: "1.2cqw" }}>
              <Hair p={grow * 0.72} w={0.08} color="var(--color-gold-dim)" />
            </div>
          </div>
          <div style={{ marginTop: "0.8cqh" }}>{value(late)}</div>
        </div>
      );
    case "bracket":
      return (
        <div style={{ ...base, display: "flex", gap: "1.2cqw" }}>
          <div style={{ width: "0.12cqw", height: `${grow * 7}cqh`, background: GOLD, alignSelf: "flex-end" }} />
          <div style={{ flex: 1 }}>
            {label(late)}
            <div style={{ marginTop: "0.7cqh" }}>
              <Hair p={grow} w={0.12} />
            </div>
            <div style={{ marginTop: "0.7cqh" }}>{value(late)}</div>
          </div>
        </div>
      );
    case "scale":
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh", width: `${grow * 100}%` }}>
            <div style={{ height: "0.12cqw", background: GOLD }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {Array.from({ length: 11 }, (_, n) => (
                <div key={n} style={{ width: "0.08cqw", height: n % 5 === 0 ? "0.9cqh" : "0.5cqh", background: GOLD, opacity: 0.75 }} />
              ))}
            </div>
          </div>
          <div style={{ marginTop: "0.7cqh" }}>{value(late)}</div>
        </div>
      );
    case "trace":
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh", height: "2.2cqh", position: "relative", overflow: "hidden" }}>
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: `${grow * 100}%`, height: "100%" }}>
              <polyline points="0,6 34,6 40,1 100,1" fill="none" stroke={GOLD} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div style={{ marginTop: "0.3cqh" }}>{value(late)}</div>
        </div>
      );
    case "weight":
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh" }}>
            <Hair p={1} w={0.04 + grow * 0.16} />
          </div>
          <div style={{ marginTop: "0.7cqh" }}>{value(late)}</div>
        </div>
      );
    case "grow":
    default:
      return (
        <div style={base}>
          {label(late)}
          <div style={{ marginTop: "0.7cqh" }}>
            <Hair p={grow} w={0.12} />
          </div>
          <div style={{ marginTop: "0.7cqh" }}>{value(late)}</div>
        </div>
      );
  }
}
