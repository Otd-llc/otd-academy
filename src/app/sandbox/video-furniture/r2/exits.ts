// How a piece LEAVES.
//
// Every treatment so far arrived with intent and left with a fade, which is the
// default you get when nobody decides. The film already solved this once: its
// exits are a real vocabulary, and crucially they are COMPUTED STYLE rather than
// keyframes, because an exit has no mount to hang an animation on and a keyframe
// would have to be started by the very state change that removes the element.
// That form is also the only one that seeks, which this pipeline requires.
//
// So the film's seven come in by import rather than being rewritten, and the
// four below are the ones furniture wants and a word does not.
//
// ASCII only.

import type React from "react";
import { outStyle, KINETIC_OUTS, type KineticOut } from "@/app/(bare)/film-render/[cut]/tuning";

/**
 * THE PERMITTED VOCABULARY (research 2.5), which this file now enforces rather
 * than merely offering.
 *
 *   allowed    cut, wipe along an axis, register (a short single-axis
 *              translation with opacity), dissolve, state change on a
 *              stationary element.
 *   forbidden  scale, rotate, 3D, bounce, overshoot, elastic, anticipation,
 *              morph, blur, parallax, full-frame movement, particle, glow,
 *              gradient sweep, animated lattice, per-character reveal,
 *              counting numerals, whoosh.
 *
 * Three exits were removed against that list, not softened:
 *
 *   `blur` / "defocus"  - from the film's seven. Guarantees illegibility for
 *     the whole transition, which is a straight transient-information tax
 *     (2.2): motion still resolving while the viewer reads costs working
 *     memory. It is filtered out of the import below rather than deleted from
 *     the film, whose own cut may still want it over a word.
 *   `swipe off`  - full-frame movement, which is a vestibular trigger, and it
 *     reads as slide-deck software.
 *   `settle out` - contracts as it fades. Scale and overshoot are the playful
 *     register the identity explicitly rejects, and this was the DEFAULT, so
 *     the banned gesture was on every piece nobody had configured.
 *
 * What survives is `cut` (2.6 wants the chapter boundary to be exactly this),
 * `fade` (dissolve), `lift` / `sink` (register), `wipe` and `collapse`, plus
 * the two clip-based furniture exits, which are wipes along an axis.
 */
const BANNED_KINETIC: KineticOut[] = ["blur"];

/** Exits that only make sense for a whole assembly rather than a word. */
export type FurnitureOut =
  | KineticOut
  | "shutter"
  | "drain";

export const EXITS: { id: FurnitureOut; label: string; note: string }[] = [
  ...KINETIC_OUTS.filter((k) => !BANNED_KINETIC.includes(k.id)),
  {
    id: "shutter",
    label: "shutter",
    note: "A hard clip edge closes across it. The same gesture the quiz verdict types on with, run backwards.",
  },
  {
    id: "drain",
    label: "drain",
    note: "Clips from the bottom up, so the type drains out of its own baseline. Pairs with anything that grew upward.",
  },
];

/**
 * The default exit, named rather than assumed.
 *
 * It used to be `settle`, which scales. The replacement is a dissolve, and the
 * distinction that matters is that this is a CHOSEN fade and not the fade you
 * get when nobody decides: of the permitted vocabulary it is the only member
 * that finishes without moving anything, so it is the one that costs a reader
 * nothing while they are still reading (2.2). A piece that wants a gesture
 * should say so.
 */
export const DEFAULT_EXIT: FurnitureOut = "fade";

/**
 * IBM Carbon PRODUCTIVE easing (research 2.4) - the register that matches
 * "console, not corporate", as opposed to the expressive set.
 *
 * Stored as control points rather than as a name, because the mixer's whole
 * premise is that a curve is DATA the owner can drag. A named easing list is
 * where a mixing table stops being one.
 */
export const CURVES = {
  entrance: [0, 0, 0.38, 0.9],
  exit: [0.2, 0, 1, 0.9],
  standard: [0.2, 0, 0.38, 0.9],
} as const;

/**
 * Evaluate a CSS-form cubic bezier as a pure function of `p`.
 *
 * `cubic-bezier(x1,y1,x2,y2)` is a parametric curve, so getting `y` for a given
 * `x` means solving for the parameter first. Newton with a bisection fallback,
 * both deterministic: the same `p` returns the same number on every call, which
 * is what keeps a seek reproducible. No wall clock, no state, no `transition`.
 */
export function bezier([x1, y1, x2, y2]: readonly number[], p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const fx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dfx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  let t = p;
  for (let i = 0; i < 8; i += 1) {
    const err = fx(t) - p;
    if (Math.abs(err) < 1e-7) break;
    const d = dfx(t);
    if (Math.abs(d) < 1e-7) break;
    t -= err / d;
  }
  if (t < 0 || t > 1) {
    // Newton left the interval; bisect, which cannot.
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 24; i += 1) {
      t = (lo + hi) / 2;
      if (fx(t) < p) lo = t;
      else hi = t;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

/**
 * Exit style at progress `p`, where 0 is "just started leaving" and 1 is gone.
 *
 * The film's kinds delegate; the furniture kinds are here. Every one is a pure
 * function of `p` - a transition or a spring would be a conversation with the
 * wall clock, and a frame at p=0.4 has to be the same picture every time it is
 * asked for.
 */
export function furnitureOut(kind: FurnitureOut, p: number): React.CSSProperties {
  // IDENTITY BEFORE THE WINDOW OPENS, and this guard is load-bearing rather
  // than defensive. The film's `none` ("cut") returns `{ display: "none" }`
  // WITHOUT consulting `p`, so applying it unconditionally - which is exactly
  // what this module's own contract promises callers they may do - blanked the
  // piece from t=0 for the entire scrub. The exit the research names for a
  // chapter boundary was the one exit that made the piece invisible.
  if (p <= 0) return {};
  // Was a smoothstep, which is symmetrical and therefore leaves as slowly as it
  // arrives. Carbon's productive EXIT curve starts faster and finishes flat,
  // which is what "get out of the reader's way" looks like as a number, and it
  // is the same data the mixer will hand around.
  const e = bezier(CURVES.exit, p);
  switch (kind) {
    case "shutter": {
      const edge = 100 - 100 * e;
      return { clipPath: `inset(0 ${100 - edge}% 0 0)` };
    }
    case "drain": {
      const edge = 100 * e;
      return { clipPath: `inset(${edge}% 0 0 0)`, opacity: 1 - e * 0.25 };
    }
    default:
      return outStyle(kind as KineticOut, p);
  }
}

/**
 * STACKING. Two exits cannot merge into one style object - `clipPath` does not
 * compose with `clipPath`, `transform` would have to be concatenated in the
 * right order, and `maskImage` overwrites. Nesting a wrapper per exit composes
 * all three for free and in a defined order: the browser applies the outer
 * clip, then the inner transform, and opacities multiply because that is what
 * nested opacity does.
 *
 * So this returns a LIST of style objects, outermost first, and the caller
 * renders one div each. `shutter + fade` is a hard edge closing over something
 * that is also going: two gestures, one ending.
 */
export function furnitureOutStack(kinds: FurnitureOut[], p: number): React.CSSProperties[] {
  if (!kinds.length) return [];
  return kinds.map((k) => furnitureOut(k, p));
}

/**
 * Progress through the exit window at scene time `t`.
 *
 * Returns 0 while the piece is still on screen, so a caller can apply the style
 * unconditionally and get an identity transform for most of the shot - a
 * promise `furnitureOut` now actually keeps at p=0; see the guard there.
 */
export function exitP(t: number, seconds: number, dur = 0.55) {
  const start = seconds - dur;
  if (t <= start) return 0;
  return Math.min(1, (t - start) / dur);
}
