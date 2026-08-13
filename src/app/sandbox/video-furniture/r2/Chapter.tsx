"use client";

// THE PERSISTENT CHAPTER INDICATOR.
//
// Every other piece in this set is a timed insert: it arrives, it says one
// thing, it leaves. This one does not leave. That single difference drives
// almost every decision below, so it is worth stating before the code.
//
// WHY IT EARNS ITS PLACE. It is the highest value per unit of effort in the
// whole research round: signalling (median d = 0.70) and segmenting (0.67) at
// ZERO motion budget, and almost nobody does it. It is paid for out of
// coherence (0.86, the strongest effect in the table), which is the argument
// AGAINST anything extraneous - so a persistent element is either useful 100%
// of the time or clutter 100% of the time. There is no middle.
//
// WHY IT IS MONO AND NOT THE NUMERAL FACE. The research says "a persistent MONO
// chapter indicator", and that word is load-bearing rather than stylistic:
//   - Saira Condensed's digits are PROPORTIONAL - nine distinct advances, `1`
//     is 53% narrower than `8` - and the family ships no `tnum`, so
//     `tabular-nums` on `--font-numeral` is a no-op. A readout that CHANGES
//     would reflow on every chapter boundary. Space Mono is monospaced by
//     definition, so the problem does not need solving, it does not exist.
//   - Bebas is out on sight: its `0` and `O` are the same drawing, so `08` and
//     `O8` are one picture.
//   - Condensed faces measure 11.2% SLOWER for glance reading and are a
//     liability for small alphanumerics, which is exactly what this is.
// Space Mono was measured designator-safe on `0`/`O`, `1`/`I` and `1`/`l` at
// both weights. This is the one place the house "every number is Saira" rule
// is deliberately not applied, and the reason is measurement, not taste.
//
// WHY IT DOES NOT ANIMATE. "Changing on a cut" is a state change on a
// stationary element, which the permitted vocabulary allows. Tweening, rolling
// or odometering the digits would make it a counting numeral, which is banned
// and which is also transient information - unreadable until it stops.
//
// THE ENCODE COST NOBODY ELSE IN THIS SET PAYS. This is the only furniture on
// screen 100% of the time, sitting over a moving screencast, so its macroblocks
// never go static. Any rule it draws uses `hw()`, which enforces a 2 px floor
// at a 1080 short edge, because a sub-pixel high-contrast edge is what produces
// ringing and moving ringing is mosquito noise.
//
// ASCII only.

import type React from "react";
import { STAGE_LABELS } from "@/lib/stages";
import { STAGE_ORDER } from "../furniture";
import { GRAPHICS_SAFE_INSET, NOTCH_16X9 } from "../youtube";
import { ts, hw } from "./units";
import { GOLD, MUTED, TEXT, type VProps } from "./Render";

/** The cut at which the chapter advances. One hard change, no tween. */
const CUT_AT = 2.0;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Placement, derived from the geometry constants rather than typed.
 *
 * `inset` is graphics-safe. The notch variant additionally honours the upper
 * band Google's own 16:9 template masks, which is the one measurement that
 * argues against the research's "top right" and is the reason this round exists
 * as a choice rather than a single build.
 */
const SAFE = GRAPHICS_SAFE_INSET * 100;

const topRight: React.CSSProperties = {
  position: "absolute",
  top: `${SAFE}cqh`,
  right: `${SAFE}cqw`,
  textAlign: "right",
};
const topCentre: React.CSSProperties = {
  position: "absolute",
  top: `${SAFE}cqh`,
  left: `${NOTCH_16X9.left * 100}cqw`,
  right: `${(1 - NOTCH_16X9.right) * 100}cqw`,
  display: "flex",
  justifyContent: "center",
};

/** The mono run. One face, one size, so the digits cannot disagree. */
function Run({
  children,
  size = 1.3,
  color = TEXT,
  track = "0.18em",
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  track?: string;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: ts(size),
        letterSpacing: track,
        color,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** `03 / 08` - current gold, separator and total muted, all one mono size. */
function Count({ i, n, size = 1.3 }: { i: number; n: number; size?: number }) {
  return (
    <>
      <Run size={size} color={GOLD}>
        {pad2(i + 1)}
      </Run>
      <Run size={size} color={MUTED}>
        {" / "}
        {pad2(n)}
      </Run>
    </>
  );
}

export function Chapter({ variant, stage, t }: VProps) {
  const n = STAGE_ORDER.length;
  const base = Math.max(0, STAGE_ORDER.indexOf(stage));
  // The cut. A step function of t, so a frame at t=1.9 and a frame at t=2.1 are
  // two different pictures and every frame between them is one or the other.
  const i = t >= CUT_AT ? Math.min(n - 1, base + 1) : base;
  const label = STAGE_LABELS[STAGE_ORDER[i]];

  switch (variant) {
    // The research's literal recommendation: top right, mono, nothing else.
    case "corner":
      return (
        <div data-chapter style={topRight}>
          <Count i={i} n={n} />
        </div>
      );

    // Honours the upper band Google's own 16:9 template masks, which excludes
    // both top corners. If the owner picks this one, the notch measurement wins
    // over the research's "top right" wording.
    case "notch":
      return (
        // The marker goes on the INK, not on this wrapper. The wrapper spans the
        // whole notch-safe band by construction, so measuring it would ask "is
        // the band inside the band" and answer on a rounding error.
        <div style={topCentre}>
          <div data-chapter>
            <Count i={i} n={n} />
          </div>
        </div>
      );

    // The design system's own progress recipe, single line: mono label, the
    // count, a middot, the stage. Never an em-dash.
    case "labelled":
      return (
        <div data-chapter style={topRight}>
          <Run size={1.05} color={MUTED} track="0.24em">
            STAGE{" "}
          </Run>
          <Count i={i} n={n} />
          <Run size={1.05} color={MUTED} track="0.24em">
            {" · "}
            {label}
          </Run>
        </div>
      );

    // The count sitting on a short gold rule: the masthead treatment, shrunk to
    // chrome. `hw()` keeps the rule above the codec floor.
    case "rule":
      return (
        <div data-chapter style={{ ...topRight, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ width: "12cqw", height: hw(0.12), background: GOLD }} />
          <div style={{ marginTop: "0.9cqh" }}>
            <Count i={i} n={n} />
          </div>
        </div>
      );

    // NO NUMERALS AT ALL. Eight ticks, the current one gold. Pure signalling,
    // zero transient information, and it sidesteps the changing-numeral
    // question entirely - worth seeing before assuming a number is required.
    case "segments":
      return (
        <div data-chapter style={{ ...topRight, display: "flex", alignItems: "center", gap: "0.5cqw" }}>
          {STAGE_ORDER.map((s, k) => (
            <div
              key={s}
              style={{
                width: "1.6cqw",
                height: hw(0.16),
                background: k === i ? GOLD : "var(--color-gold-dim)",
                opacity: k === i ? 1 : 0.55,
              }}
            />
          ))}
        </div>
      );

    // The square registration tag. Corner language is deliberately tight and
    // square, never a pill.
    case "badge":
    default:
      return (
        <div data-chapter style={topRight}>
          <span
            style={{
              display: "inline-block",
              border: `${hw(0.08)} solid ${GOLD}`,
              padding: "0.7cqh 1.1cqw",
            }}
          >
            <Count i={i} n={n} size={1.2} />
          </span>
        </div>
      );
  }
}
