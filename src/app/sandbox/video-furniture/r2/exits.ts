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

/** Exits that only make sense for a whole assembly rather than a word. */
export type FurnitureOut =
  | KineticOut
  | "swipe"
  | "shutter"
  | "drain"
  | "settle";

export const EXITS: { id: FurnitureOut; label: string; note: string }[] = [
  ...KINETIC_OUTS,
  {
    id: "swipe",
    label: "swipe off",
    note: "The whole assembly leaves sideways as one object. Reads as a card being taken away rather than a word ending.",
  },
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
  {
    id: "settle",
    label: "settle out",
    note: "Contracts slightly and fades, as though the frame is releasing it. The quietest of the four and the safest under a cut.",
  },
];

/**
 * Exit style at progress `p`, where 0 is "just started leaving" and 1 is gone.
 *
 * The film's kinds delegate; the furniture kinds are here. Every one is a pure
 * function of `p` - a transition or a spring would be a conversation with the
 * wall clock, and a frame at p=0.4 has to be the same picture every time it is
 * asked for.
 */
export function furnitureOut(kind: FurnitureOut, p: number): React.CSSProperties {
  const e = p * p * (3 - 2 * p);
  switch (kind) {
    case "swipe":
      return { opacity: 1 - e * 0.85, transform: `translateX(${-e * 14}%)` };
    case "shutter": {
      const edge = 100 - 100 * e;
      return { clipPath: `inset(0 ${100 - edge}% 0 0)` };
    }
    case "drain": {
      const edge = 100 * e;
      return { clipPath: `inset(${edge}% 0 0 0)`, opacity: 1 - e * 0.25 };
    }
    case "settle":
      return { opacity: 1 - e, transform: `scale(${1 - e * 0.035})` };
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
 * unconditionally and get an identity transform for most of the shot.
 */
export function exitP(t: number, seconds: number, dur = 0.55) {
  const start = seconds - dur;
  if (t <= start) return 0;
  return Math.min(1, (t - start) / dur);
}
