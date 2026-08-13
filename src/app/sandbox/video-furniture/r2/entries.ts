// HOW A PIECE ARRIVES, as a dimension rather than as sixty private decisions.
//
// Exits were pulled out of the treatments once already, and the reason given
// then was that a dimension hidden inside ten variants is a dimension nobody
// can dial. Entrances had exactly the same problem and nobody had looked: an
// inventory of all sixty round-2 treatments found the whole set arriving on
// just NINE underlying gestures, expressed sixty times, with two hardcoded
// curves and twenty-four hand-tuned time windows of which three landed on a
// beat at both ends.
//
// It also found seven FORBIDDEN entrances. The ban-list pass audited exits and
// stopped there, so `scale`, `blur` and a permanently-running `glow` survived
// on the entry side. Those are recorded against each primitive below and in the
// mixer plan; the comb-borne ones are inside the owner's deferral.
//
// EVERY EFFECT IS A PURE FUNCTION OF `p`. The stack composes by multiplying
// opacities and merging styles at a given `t`, with no state and no clock, so a
// frame at t=1.4 is the same picture every time it is requested. The curve is
// DATA - cubic bezier control points, evaluated by the same `bezier()` the exit
// side already uses - because a named easing list is where a mixing table stops
// being one.
//
// ASCII only.

import type React from "react";
import { bezier, CURVES } from "./exits";
import { beats, cueSeconds, type AccentClass } from "./meter";

/**
 * The nine gestures round 2 actually uses, six of which are legal.
 *
 * `weight` and `push` are single-variant primitives kept because they are the
 * two that argue for the stack: they are real gestures that only one treatment
 * ever got, which is what happens when a dimension lives inside variants.
 */
export type EntryKind =
  | "cut"
  | "fade"
  | "register"
  | "rule"
  | "rule-centre"
  | "wipe-x"
  | "wipe-y"
  | "weight"
  | "push";

export const ENTRIES: { id: EntryKind; label: string; note: string }[] = [
  { id: "cut", label: "cut", note: "Simply present on the first frame. The chapter indicator's entrance, and the only one that costs a reader nothing." },
  { id: "fade", label: "fade in", note: "A dissolve. What almost every treatment in the set does, usually because nobody chose anything else." },
  { id: "register", label: "register up", note: "A short single-axis translation with opacity. The permitted vocabulary's one legal move; keep the travel small or it stops being a register." },
  { id: "rule", label: "rule grows", note: "A hairline draws left to right. The house gesture, and the one the identity is actually built on." },
  { id: "rule-centre", label: "rule opens", note: "The same rule, drawn from the centre outward, so the type lands in the gap it makes." },
  { id: "wipe-x", label: "wipe across", note: "A clip edge travels horizontally and the piece exists only where it has passed. Arrival by survey rather than by fade." },
  { id: "wipe-y", label: "wipe up", note: "The same, vertically. Borrows the film's plating language." },
  { id: "weight", label: "thicken", note: "Full length from the first frame, arriving by getting heavier. Quietest arrival, strongest final state." },
  { id: "push", label: "push apart", note: "The rule grows and drives the type away from it, so the typography is spaced BY the gesture." },
];

/**
 * The named parts a treatment exposes for an effect to drive.
 *
 * WITHOUT THIS the stack can only animate the piece as one object, and every
 * treatment's internal choreography - the rule arriving before the label, the
 * label before the value - collapses into a single fade. That choreography is
 * the thing worth dialling, so it has to be addressable.
 *
 * `piece` is the whole assembly and is the default, so an effect that does not
 * care still works.
 */
export type EntryTarget = "piece" | "rule" | "label" | "value";

/** The addressable parts, for a picker. Derived nowhere else so the union and
 *  the list cannot drift apart. */
export const TARGETS = ["piece", "rule", "label", "value"] as const satisfies readonly EntryTarget[];

/** One effect in a stack. Durations and offsets are in BEATS, never seconds. */
export type EntryEffect = {
  kind: EntryKind;
  /** Which named part this effect drives. */
  target: EntryTarget;
  /** Cubic bezier control points, `[x1, y1, x2, y2]`. Data, not a name. */
  curve: readonly number[];
  /** How long it takes, in beats. */
  durationBeats: number;
  /** When it starts relative to the stack, in beats. */
  offsetBeats: number;
  /** Which accent class it lands on, which sets its pre-roll. */
  accent: AccentClass;
};

/** A sensible effect, so adding one to a stack does not require six decisions. */
export function defaultEffect(kind: EntryKind, target: EntryTarget = "piece"): EntryEffect {
  return {
    kind,
    target,
    curve: CURVES.entrance,
    durationBeats: kind === "cut" ? 0 : 2,
    offsetBeats: 0,
    accent: "transient",
  };
}

/**
 * Progress of one effect at scene time `t`, as a pure function.
 *
 * Zero before it starts, one after it finishes, the curve in between. A `cut`
 * has no duration, so it is 0 before its cue and 1 from the cue onward - which
 * is a step, which is the permitted "state change on a stationary element".
 */
export function entryProgress(e: EntryEffect, t: number, bpm?: number): number {
  const start = cueSeconds(e.offsetBeats, e.accent, bpm);
  const dur = beats(e.durationBeats, bpm);
  if (dur <= 0) return t >= start ? 1 : 0;
  const raw = (t - start) / dur;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return bezier(e.curve, raw);
}

/** The style one effect contributes at progress `p`. */
export function entryStyle(kind: EntryKind, p: number): React.CSSProperties {
  switch (kind) {
    case "cut":
      return { opacity: p >= 1 ? 1 : 0 };
    case "fade":
      return { opacity: p };
    case "register":
      // Small on purpose. The report's ceiling is 16px of travel at 1080p, and
      // 2cqh is 21.6px at that height - already at the edge. The comb's `drop`
      // used 16cqmin, about 173px, which is not a register by any reading.
      return { opacity: p, transform: `translateY(${(1 - p) * 2}cqh)` };
    case "rule":
      return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    case "rule-centre":
      return { clipPath: `inset(0 ${(1 - p) * 50}% 0 ${(1 - p) * 50}%)` };
    case "wipe-x":
      return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    case "wipe-y":
      return { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` };
    case "weight":
      // Arrives at full length and thickens. The floor matters here more than
      // anywhere: at p=0 the old hand-rolled version was 0.04cqw, well under
      // the 2px-at-1080 codec floor, so it opened sub-pixel.
      return { transform: `scaleY(${0.25 + p * 0.75})`, transformOrigin: "center" };
    case "push":
      return { opacity: p };
    default:
      return {};
  }
}

/**
 * The whole stack, as a LIST of style objects, outermost first.
 *
 * Same shape and same reason as `furnitureOutStack`: two `clipPath`s do not
 * compose on one element and two `transform`s would have to be concatenated in
 * the right order, so the caller renders one wrapper per effect and lets the
 * browser compose them. Opacities multiply because that is what nested opacity
 * does.
 */
export function entryStack(stack: EntryEffect[], t: number, bpm?: number): React.CSSProperties[] {
  return stack.filter((e) => e.target === "piece").map((e) => entryStyle(e.kind, entryProgress(e, t, bpm)));
}

/**
 * The style for one NAMED PART at `t`, merged across every effect aimed at it.
 *
 * Merging rather than nesting because a part is a single element: opacities
 * multiply the way nested opacity would, and a second `clipPath` on one element
 * would silently overwrite the first, so the last one aimed at a part wins and
 * the UI is what should prevent the collision.
 */
export function partStyle(
  stack: EntryEffect[],
  target: EntryTarget,
  t: number,
  bpm?: number,
): React.CSSProperties {
  const out: React.CSSProperties = {};
  for (const e of stack) {
    if (e.target !== target) continue;
    const s = entryStyle(e.kind, entryProgress(e, t, bpm));
    if (s.opacity !== undefined) {
      out.opacity = (out.opacity === undefined ? 1 : Number(out.opacity)) * Number(s.opacity);
    }
    if (s.clipPath) out.clipPath = s.clipPath;
    if (s.transform) out.transform = [out.transform, s.transform].filter(Boolean).join(" ");
  }
  return out;
}

/** Does this stack drive the named part at all? */
export const drives = (stack: EntryEffect[], target: EntryTarget) =>
  stack.some((e) => e.target === target);

/**
 * The default entry stack: a dissolve over two beats.
 *
 * Named, so it is a chosen arrival rather than the one that happens when nobody
 * decides - the same distinction `DEFAULT_EXIT` makes on the other side.
 */
export const DEFAULT_ENTRY: EntryEffect[] = [defaultEffect("fade", "piece")];

/**
 * The hairline set expressed as DATA rather than as ten hand-tuned windows.
 *
 * This is the conversion that proves the mixer controls anything: the rule
 * arrives on its own effect, the label and value on theirs, and every number
 * below is a beat the owner can drag. The windows it replaces were
 * (0.1, 0.95) for the rule and (0.45, 1.3) for the type - 1.7 beats starting
 * at 0.2, and 1.7 beats starting at 0.9 - neither on any legal grid.
 */
export const HAIRLINE_ENTRY: EntryEffect[] = [
  { ...defaultEffect("fade", "piece"), durationBeats: 1 },
  { ...defaultEffect("rule", "rule"), durationBeats: 2 },
  { ...defaultEffect("fade", "label"), durationBeats: 1, offsetBeats: 1 },
  { ...defaultEffect("fade", "value"), durationBeats: 1, offsetBeats: 1 },
];
