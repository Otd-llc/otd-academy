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
// WHY IT IS MONO AND NOT THE NUMERAL FACE.
//
// The decisive reason is the design system's own scoping, which is one citation
// and settles it. `globals.css` defines Saira as "the dedicated DISPLAY NUMERAL
// face (big hex/stat number-heroes + instrument readouts)" and says in the same
// breath that "codes/labels still Space Mono", with the token itself commented
// "Display numerals ONLY (hex number-heroes)". A ~25 px persistent corner chrome
// is a label, not a number-hero. That is the argument.
//
// THIS DOES NOT CONTRADICT `outro/count`, which sets the same `NN / NN` glyphs
// in Saira. That one is a hero-scale readout at `ts(7)` and lands squarely in
// "number-hero"; this one is chrome at `ts(1.3)`. Same string, different job,
// and the system already draws the line by SIZE and ROLE rather than by glyph.
//
// Two supporting facts, ranked honestly BELOW the citation because neither is
// sufficient on its own:
//   - Bebas cannot render it at all: its `0` and `O` are the same drawing, so
//     `08` and `O8` are one picture. (True, but Bebas was never a candidate.)
//   - Space Mono measured designator-safe on `0`/`O`, `1`/`I` and `1`/`l` at
//     both weights, which a face carrying a chapter number has to be.
//
// AND ONE ARGUMENT DELIBERATELY WITHDRAWN. An earlier version of this comment
// led with "Saira's digits are proportional, so a changing readout would
// reflow". That is true of the font and irrelevant here: the change is a CUT,
// so there is no in-between frame in which anything is seen to move, and in the
// one variant where a digit-width change would displace neighbouring ink
// (`labelled`) the stage name changes at the same instant and re-lays the line
// out regardless. The reflow argument buys zero pixels in all six variants. It
// is recorded as withdrawn rather than deleted, because it is the kind of
// plausible reason that gets re-invented by the next person to read this file.
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

/** The widest label the indicator can ever be asked to show. Used as a layout
 *  strut so the line cannot change width at a cut. */
const LONGEST_LABEL = STAGE_ORDER.map((s) => STAGE_LABELS[s]).reduce(
  (a, b) => (b.length > a.length ? b : a),
  "",
);

/**
 * ONE COMPONENT, TWO SCOPES.
 *
 * `stage` counts build stages: where this video sits in the eight-stage build.
 * `step` counts videos: where this video sits in its lesson's playlist.
 *
 * They were nearly built as two components, and that would have been the error.
 * A lesson is a PLAYLIST of short videos, so a video IS a step - "step 3 of 9"
 * and "stage 04 / 08" are the same readout at two scopes, and two components
 * drift until they disagree about where the viewer is. One component cannot.
 */
export type ChapterScope = "stage" | "step";

export function Chapter({ variant, stage, t, scope = "stage", stepIndex = 2, stepCount = 6 }: VProps & {
  scope?: ChapterScope;
  stepIndex?: number;
  stepCount?: number;
}) {
  const n = scope === "step" ? stepCount : STAGE_ORDER.length;
  const at = scope === "step" ? stepIndex : STAGE_ORDER.indexOf(stage);
  // NOT `Math.max(0, indexOf)`. That turned any stage this piece does not
  // number - REVISION is a legal `Stage` and the frame route validates nothing,
  // so `?stage=REVISION` and `?stage=banana` both reach here - into a confident
  // `01 / 08 REQUIREMENTS`. A chapter indicator that invents a chapter is worse
  // than one that is absent, because only the absence is visible.
  if (at < 0) return null;
  const base = at;
  // The cut. A step function of t, so a frame at t=1.9 and a frame at t=2.1 are
  // two different pictures and every frame between them is one or the other.
  // MODULO, not `Math.min`. Clamping meant that at the final stage the "after"
  // index equalled the "before" index, so picking BRINGUP gave an audition of a
  // cutting indicator that never cuts - and the check missed it because it ran
  // at the default stage. Wrapping is honest for an audition surface: the point
  // is to show the change, and 08 -> 01 shows it.
  const i = t >= CUT_AT ? (base + 1) % n : base;
  const label = scope === "step" ? STAGE_LABELS[stage] : STAGE_LABELS[STAGE_ORDER[i]];

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
            {" "}
            &middot;{" "}
          </Run>
          {/* THE LABEL IS RESERVED AT ITS LONGEST, and this is not tidiness.
              The block is right-anchored with `nowrap`, so a label that changes
              LENGTH at the cut drags the whole line - every glyph including the
              count - sideways. Measured across the reachable transitions that is
              up to ~102 px at 1920, against the research's own ceiling of 16 px
              travel at 1080p: 6.4x over, and the exact reflow this file's
              earlier mono argument claimed to have made impossible. Monospace
              pins DIGITS; it does nothing for a variable-length word.

              The strut reserves the widest real label in the actual font at the
              actual tracking, so no magic constant can drift out of date. Grid
              overlay, both cells in the same track, the strut hidden. */}
          <span style={{ display: "inline-grid", verticalAlign: "baseline" }}>
            <Run size={1.05} color={MUTED} track="0.24em">
              <span style={{ gridArea: "1 / 1", visibility: "hidden" }} aria-hidden>
                {LONGEST_LABEL}
              </span>
            </Run>
            <Run size={1.05} color={MUTED} track="0.24em">
              <span style={{ gridArea: "1 / 1", textAlign: "left" }}>{label}</span>
            </Run>
          </span>
        </div>
      );

    // The count sitting on a short gold rule: the masthead treatment, shrunk to
    // chrome. `hw()` keeps the rule above the codec floor.
    case "rule":
      return (
        <div data-chapter style={{ ...topRight, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          {/* Both measures are TYPOGRAPHIC - a rule bound to the type beneath it
              and the leading under that rule - so both go through `ts()`. In
              `cqw`/`cqh` the rule was 69% wider than its count at 16:9 and 5%
              narrower at 9:16, inverting the relationship, and the leading
              nearly doubled against type that had not changed size. */}
          <div style={{ width: ts(9), height: hw(0.12), background: GOLD }} />
          <div style={{ marginTop: ts(0.5) }}>
            <Count i={i} n={n} />
          </div>
        </div>
      );

    // NO NUMERALS AT ALL. Eight ticks, the current one gold. Pure signalling,
    // zero transient information, and it sidesteps the changing-numeral
    // question entirely - worth seeing before assuming a number is required.
    case "segments":
      return (
        <div data-chapter style={{ ...topRight, display: "flex", alignItems: "center", gap: ts(0.38) }}>
          {STAGE_ORDER.map((s, k) => (
            <div
              key={s}
              style={{
                // The tick's height is protected by `hw()`; its LENGTH has to
                // be protected by `ts()` or the mark's proportion distorts by
                // the same 1.78x the unit fix exists to prevent.
                width: ts(1.2),
                // THE CURRENT TICK IS TALLER, not merely a different colour.
                // Hue plus alpha were the only two channels carrying the whole
                // signal, and measured against the field the seven unlit ticks
                // sat at 1.88:1 on dark and 1.51:1 on light while lit-vs-unlit
                // fell to 2.75:1 on light - under the 3:1 non-text floor, in the
                // one theme a geometry check cannot see. When the unlit ticks
                // vanish, "the 4th of 8" degrades to "a gold dash", and position
                // out of eight is the entire information content of this
                // variant. Height is a channel that survives both a contrast
                // failure and a greyscale re-encode.
                height: k === i ? hw(0.34) : hw(0.16),
                background: k === i ? GOLD : MUTED,
                opacity: k === i ? 1 : 0.8,
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
              // Padding around type is a typographic measure. Mixing `cqh` and
              // `cqw` made the square tag a DIFFERENT SHAPE per aspect (h:v 2.8
              // at 16:9, 0.9 at 9:16) around type that had not changed size.
              padding: `${ts(0.5)} ${ts(0.8)}`,
            }}
          >
            <Count i={i} n={n} size={1.2} />
          </span>
        </div>
      );
  }
}
