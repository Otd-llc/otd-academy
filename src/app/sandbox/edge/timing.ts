// SANDBOX timing. DEV ONLY.
//
// A PLAIN module on purpose. These used to be exported from the stage file,
// which carries "use client" — and every export of a client module reaches a
// server component as a client REFERENCE, not the value. The page read
// HANDOFF.toFixed(1) and 500'd. Anything both sides need lives outside the
// client boundary.

/** Degrees per second. One rate for the whole film, never broken. */
export const RATE = 30;

/**
 * Loop length. 12 s is not arbitrary: RATE * SECONDS = 360, so the turntable
 * completes EXACTLY one revolution and the loop point is continuous. At 8 s it
 * was 240 degrees and the clip jumped 120 degrees every wrap, which is part of
 * what read as "choppy".
 */
export const SECONDS = 12;

/** The handoff instant, a bar downbeat at 120 BPM. */
export const HANDOFF = 4.0;

/**
 * The turntable is FACE-ON at the handoff. Owner's pick, and every spin profile
 * in spin.ts pins a keyframe to it rather than passing through by luck.
 *
 * This was an edge-on lock at first, on the theory that a swap hides best where
 * the object is thinnest. The theory died with the mechanism: the trade is a
 * cross-fade between two objects of matched thickness, so there is nothing to
 * hide, and edge-on spends the moment where neither object can be read.
 */
export const HANDOFF_ANGLE = 0;

/** Beats of the stack's life, in seconds. */
export const T_EXPLODE_OUT = [0.5, 1.5] as const;
export const T_HOLD = [1.5, 2.9] as const;
/**
 * The collapse lands the stack at EXACTLY board thickness, and it FINISHES
 * BEFORE the cross-fade starts. That ordering is the whole spec: become the
 * board's thickness, THEN trade places with it. Centring the fade on HANDOFF
 * instead put the board at 22% while the stack was still 10 mm too fat, so the
 * two changes smeared into each other and neither read.
 */
export const T_COLLAPSE = [2.9, 3.85] as const;
/** A held beat at matched thickness, so the arrival registers before the trade. */
export const T_MATCHED_HOLD = [3.85, HANDOFF] as const;
/** Loop-back only. Not in the film; it exists so this page can loop cleanly. */
export const T_RETURN = [11.0, 12.0] as const;
