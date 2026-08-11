// SANDBOX — spin profiles driven by a damped spring. DEV ONLY.
//
// WHY THE KEYFRAME VERSION WAS NEVER GOING TO WORK. The first attempt shaped the
// angle with monotone cubic Hermite and a Fritsch-Carlson limiter, which
// GUARANTEES the rotation never reverses. That is the opposite of what dynamic
// rotation is made of. Motion design gets its snap from exactly the two things
// monotonicity forbids:
//
//   ANTICIPATION — move a little the WRONG way before committing. In easing
//   terms this is a cubic-bezier with a negative Y control point; in animation
//   terms it is the oldest trick there is.
//
//   OVERSHOOT AND SETTLE — pass the target, then relax back in decaying
//   oscillations, each shorter and slower than the last.
//
// So the angle is not a curve to be drawn any more. It is a SPRING CHASING A
// TARGET, which is also the literal owl: the head does not follow a path, it
// chases where the bird wants to be looking. Give the target a small negative
// step then a large positive one and anticipation, whip, overshoot and settle
// all fall out of the physics instead of being drawn in by hand.
//
// Solved in closed form per segment, not integrated, so there is no timestep
// error and scrubbing to an instant gives exactly what playback gives.
// Underdamped case, from the standard damped-spring solution:
//
//   x(t) = T + e^(-wzt) [ d cos(at) + ((v0 + wz d) / a) sin(at) ]     a = w sqrt(1 - z^2)
//
// with w the natural frequency, z the damping ratio and d the displacement from
// the target. Overshoot fraction is exp(-pi z / sqrt(1 - z^2)), so z is the one
// knob that decides how much the head bounces past.

import { HANDOFF, HANDOFF_ANGLE, SECONDS } from "./timing";

export type SpinProfile = "constant" | "snap" | "crack" | "doubletake" | "hero";

/** A jump in where the owl WANTS to be looking. Position and velocity stay continuous. */
type Step = { t: number; delta: number };

type ProfileDef = {
  /** Constant tracking rate underneath the spring, deg/sec. */
  drift: number;
  /** Natural frequency, rad/sec. Higher is snappier. */
  omega: number;
  /** Damping ratio, 0..1. Lower overshoots further. */
  zeta: number;
  steps: Step[];
  note: string;
};

const TURN = 360;

/**
 * Every profile must satisfy drift * SECONDS + sum(steps) === 360, so the loop
 * closes on exactly one revolution. check-spin asserts it rather than trusting
 * the arithmetic below.
 */
const DEFS: Record<SpinProfile, ProfileDef> = {
  // The old fixed rate, kept as the thing to judge the rest against.
  constant: { drift: 30, omega: 1, zeta: 1, steps: [], note: "30 deg/s flat" },

  // NOTE ON OMEGA. The first pass used 9 to 14 rad/sec, borrowed from UI spring
  // intuition where a "displacement" is a few hundred pixels. Peak velocity of a
  // step response scales with omega TIMES the step, and these steps are three
  // hundred degrees, so those values produced 1350 and 2582 deg/sec: seven
  // revolutions a second, a strobe rather than a whip. Around 2 to 3 puts the
  // peak near 400 to 500 deg/sec, which is a fast turn you can still read.

  // Owl head snap. Slow track, a flinch backwards, then most of a turn in about
  // a second, overshooting and settling.
  snap: {
    drift: 6,
    omega: 2.2,
    zeta: 0.62,
    steps: [
      { t: 7.0, delta: -26 },
      { t: 7.9, delta: 314 },
    ],
    note: "track, flinch, snap, settle",
  },

  // Harder, with a deliberately loose damping ratio so the settle reads as a
  // bounce rather than a stop.
  crack: {
    drift: 4,
    omega: 2.3,
    zeta: 0.5,
    steps: [
      { t: 7.0, delta: -30 },
      { t: 7.7, delta: 342 },
    ],
    note: "violent, 16% overshoot",
  },

  // Two goes at it, the way a bird checks, commits, then corrects.
  doubletake: {
    drift: 5,
    omega: 3.0,
    zeta: 0.6,
    steps: [
      { t: 4.8, delta: -12 },
      { t: 5.3, delta: 156 },
      { t: 8.4, delta: -14 },
      { t: 8.9, delta: 170 },
    ],
    note: "two snaps, one correction",
  },

  // The product-film structure: LOCKED, not drifting. The turntable is still
  // through the whole explode and the handoff, so all the motion in DESIGN
  // belongs to the sheets, then the board takes a full turn and locks face-on
  // again. Stationary at both ends of the loop and at the same angle, so it
  // still loops seamlessly, and it ends on a held hero rather than a spin that
  // never resolves.
  hero: {
    drift: 0,
    omega: 2.0,
    zeta: 0.72,
    steps: [
      { t: 4.9, delta: -24 },
      { t: 5.4, delta: 384 },
    ],
    note: "locked hero, one full turn",
  },
};

type State = { x: number; v: number };

/** Advance an underdamped spring toward a constant target for `dt` seconds. */
function advance(s: State, target: number, dt: number, omega: number, zeta: number): State {
  if (dt <= 0) return s;
  const d = s.x - target;
  if (zeta >= 1) {
    // Critically damped. Only reachable via the `constant` profile, which has
    // no steps, so this never actually oscillates; it is here so the type is
    // total rather than throwing on a config nobody uses yet.
    const e = Math.exp(-omega * dt);
    const c = s.v + omega * d;
    return { x: target + (d + c * dt) * e, v: (s.v - c * omega * dt) * e };
  }
  const alpha = omega * Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-omega * zeta * dt);
  const A = d;
  const B = (s.v + omega * zeta * d) / alpha;
  const cos = Math.cos(alpha * dt);
  const sin = Math.sin(alpha * dt);
  return {
    x: target + e * (A * cos + B * sin),
    v: e * ((B * alpha - omega * zeta * A) * cos - (omega * zeta * B + A * alpha) * sin),
  };
}

/** Spring position and velocity at `t`, walking the target steps in order. */
function springFrom(def: ProfileDef, start: State, t: number): State {
  let s = start;
  let target = 0;
  let clock = 0;
  for (const step of def.steps) {
    if (step.t >= t) break;
    s = advance(s, target, step.t - clock, def.omega, def.zeta);
    clock = step.t;
    target += step.delta;
  }
  return advance(s, target, t - clock, def.omega, def.zeta);
}

/**
 * THE SPRING DOES NOT START AT REST. Starting it at rest means it is still
 * ringing when the loop wraps, and the numbers say so: the snap profile closed
 * on 358.5 degrees instead of 360 and arrived at the wrap doing 8.28 deg/sec
 * against 6.00 at the start. Buying settle time by moving the whips earlier
 * would work and would also let the tail of the spring dictate the edit.
 *
 * Instead, solve for the state that REPEATS. The system is linear, so propagate
 * the two unit initial conditions over one period with the target held at zero
 * to get the monodromy matrix M, propagate the target steps from rest to get
 * the particular response p, and require
 *
 *     M s0 + p = s0 + (sum of steps, 0)
 *
 * which is a 2x2 solve. The spring is then in steady state for every loop
 * including the first, the turn closes on exactly 360, and the whips can sit
 * wherever the edit wants them.
 */
function periodicStart(def: ProfileDef): State {
  const sum = def.steps.reduce((a, s) => a + s.delta, 0);
  const p = springFrom(def, { x: 0, v: 0 }, SECONDS);
  const c1 = advance({ x: 1, v: 0 }, 0, SECONDS, def.omega, def.zeta);
  const c2 = advance({ x: 0, v: 1 }, 0, SECONDS, def.omega, def.zeta);
  // (M - I), column-major from the two propagated unit states.
  const a = c1.x - 1;
  const b = c2.x;
  const c = c1.v;
  const d = c2.v - 1;
  const r0 = sum - p.x;
  const r1 = -p.v;
  const det = a * d - b * c;
  return { x: (r0 * d - b * r1) / det, v: (a * r1 - r0 * c) / det };
}

const START: Record<SpinProfile, State> = Object.fromEntries(
  (Object.keys(DEFS) as SpinProfile[]).map((p) => [p, periodicStart(DEFS[p])]),
) as Record<SpinProfile, State>;

const springAt = (def: ProfileDef, profile: SpinProfile, t: number) =>
  springFrom(def, START[profile], t);

/**
 * Pin so the turntable is EXACTLY face-on at the handoff. Subtracting a
 * constant shifts the curve without touching its dynamics, and it keeps the one
 * moment that has to be legible legible, whatever the spring is doing.
 */
const PIN: Record<SpinProfile, number> = Object.fromEntries(
  (Object.keys(DEFS) as SpinProfile[]).map((p) => {
    const def = DEFS[p];
    return [p, def.drift * HANDOFF + springAt(def, p, HANDOFF).x - HANDOFF_ANGLE];
  }),
) as Record<SpinProfile, number>;

/** Angle in degrees and the instantaneous rate in degrees per second. */
export function spinAt(profile: SpinProfile, t: number): { deg: number; rate: number } {
  const def = DEFS[profile];
  const s = springAt(def, profile, t);
  return { deg: def.drift * t + s.x - PIN[profile], rate: def.drift + s.v };
}

/** Total rotation over one loop. Must be 360; check-spin asserts it. */
export function turnOf(profile: SpinProfile): number {
  return spinAt(profile, SECONDS).deg - spinAt(profile, 0).deg;
}

export const PROFILE_LABELS: Record<SpinProfile, string> = {
  constant: "Constant",
  snap: "Snap",
  crack: "Crack",
  doubletake: "Double-take",
  hero: "Hero lock",
};

export const PROFILE_NOTES: Record<SpinProfile, string> = Object.fromEntries(
  (Object.keys(DEFS) as SpinProfile[]).map((p) => [p, DEFS[p].note]),
) as Record<SpinProfile, string>;

/** Overshoot fraction implied by the damping ratio, for the readout. */
export const PROFILE_OVERSHOOT: Record<SpinProfile, number> = Object.fromEntries(
  (Object.keys(DEFS) as SpinProfile[]).map((p) => {
    const z = DEFS[p].zeta;
    return [p, z >= 1 ? 0 : Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z))];
  }),
) as Record<SpinProfile, number>;

export const EXPECTED_TURN = TURN;

/**
 * Camera angles for the handoff.
 *
 * The rig tilts the OBJECT and points a fixed orthographic camera down -Z, so
 * an "angle" here is a pivot tilt plus a lens choice. Framing is recomputed per
 * angle from the union of a whole turn, which is why they can be switched
 * without anything clipping at any rotation.
 *
 * `tilt` is in units of PI radians, negative meaning the far edge lifts away.
 */
export type Angle = {
  id: string;
  label: string;
  tilt: number;
  /** Perspective instead of orthographic. Foreshortening reads as "filmed". */
  persp?: boolean;
  note: string;
};

// TILT 0 IS FACE-ON, NOT PLAN. The board geometry lies in XY with its thickness
// on Z and the camera looks down -Z, so rotating the pivot about X swings the
// face AWAY: 0 shows the artwork flat to camera, -90 degrees shows the slab
// edge-on. The first version of this table had those backwards, labelling -85
// degrees "plan" and -9 degrees "edge" when they are the exact opposite. The
// renders showed it immediately, which is the argument for rendering them.
export const ANGLES: Angle[] = [
  { id: "bench", label: "Bench", tilt: -0.34, note: "The current one. Three-quarter, reads as a board on a desk" },
  { id: "face", label: "Face on", tilt: -0.05, note: "Flat to camera. The artwork reads best, but the collapse hides: you only ever see the top sheet" },
  { id: "near-face", label: "Near face", tilt: -0.13, note: "Barely tilted. Keeps most of the artwork and admits just enough edge to show the stack closing" },
  { id: "iso", label: "Iso", tilt: -0.26, note: "Shallower three-quarter. More face, less edge, than the bench angle" },
  { id: "edge", label: "Edge on", tilt: -0.47, note: "Nearly edge-on. The eight layers separate as distinct planes and the collapse IS the shot" },
  { id: "hero", label: "Hero lens", tilt: -0.30, persp: true, note: "Perspective rather than orthographic. Foreshortening reads as filmed, not diagrammed" },
];
