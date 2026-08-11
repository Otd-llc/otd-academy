// SANDBOX - transitions at the two remaining junctions. DEV ONLY.
//
// A PLAIN MODULE: the table carries functions, and a function cannot be handed
// from a server component to a client one as a prop.
//
// ASCII ONLY. This file was once rewritten through a PowerShell pipe, which
// re-encoded every em dash and box-drawing rule into mojibake; the repair pass
// was lossy enough that tsc then read the file as binary. There was no git copy
// to fall back on, because the sandbox is untracked.
//
// THE TWO JUNCTIONS ARE NOT THE SAME PROBLEM, which is why they get separate
// rounds rather than one shared answer:
//
//   BUILD -> LEARN jumps from a turning 3D object to a flat UI panel. Nothing
//   about the two shots rhymes, so the transition has to do the work of
//   changing subject.
//
//   LEARN -> EARN goes from one document to another. The exam panel and the
//   certificate are both pale rectangles in roughly the same part of frame, so
//   a match-style transition is available here and is not at the other.

export type Side = "a" | "b";

/** Per-side CSS at a given progress through the transition. */
export type Style = {
  opacity: number;
  transform: string;
  filter: string;
  clipPath: string;
};

/**
 * Where the transition sits relative to the downbeat.
 *
 * THIS IS WHAT "TOO EARLY" WAS. Everything was `centre`, so a 360 ms wipe began
 * 180 ms BEFORE the beat and the picture had already started changing by the
 * time the drum landed. On a cut edited to music the new shot should arrive ON
 * the beat, which is `end`, or be driven off it, which is `start`. Centre is
 * kept because it is right for a long dissolve, where the 50/50 point is what
 * the eye reads as the join.
 */
export type Align = "centre" | "start" | "end";

export type GlitchSpec = {
  /** Horizontal bands the frame is torn into. */
  bands: number;
  /** Peak band displacement, as a fraction of width. */
  slip: number;
  /** Peak red/blue separation, in low-res pixels. 0 disables the pass. */
  rgb: number;
  /** Speckle density, 0..1. */
  noise: number;
  /** Full-width dropout bars per frame at peak. */
  bars: number;
  /** Snap the whole frame to a coarse grid at peak, for a blocky mosh. */
  blocky?: boolean;
};

export type Transition = {
  id: string;
  label: string;
  note: string;
  /** Half-width in seconds. Total duration is twice this. */
  half: number;
  /** Overlay colour flashed at the join, if any. */
  flash?: string;
  /** Rendered on a canvas rather than with CSS, for real artefacts. */
  glitch?: GlitchSpec;
  style: (side: Side, u: number) => Style;
};

/** Progress through the transition for a given alignment. */
export function progress(t: number, half: number, align: Align): number {
  const span = half * 2;
  const from = align === "centre" ? -half : align === "start" ? 0 : -span;
  return Math.min(Math.max((t - from) / span, 0), 1);
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const ease = (u: number) => u * u * (3 - 2 * u);
const none: Style = { opacity: 1, transform: "none", filter: "none", clipPath: "none" };
const S = (o: Partial<Style>): Style => ({ ...none, ...o });

export const TRANSITIONS: Transition[] = [
  {
    id: "cut",
    label: "Hard cut",
    note: "On the beat, nothing between. The baseline everything else has to beat",
    half: 0.017,
    style: (side, u) => S({ opacity: side === "a" ? (u < 0.5 ? 1 : 0) : u < 0.5 ? 0 : 1 }),
  },
  {
    id: "dissolve",
    label: "Dissolve",
    note: "300 ms cross-fade. Wants two shots with something in common to fade through",
    half: 0.15,
    style: (side, u) => S({ opacity: side === "a" ? 1 - ease(u) : ease(u) }),
  },
  {
    id: "dip",
    label: "Dip to black",
    note: "Out to black, then in. Reads as a scene change rather than a continuation",
    half: 0.2,
    style: (side, u) => S({ opacity: side === "a" ? clamp01(1 - u * 2) : clamp01(u * 2 - 1) }),
  },
  {
    id: "flash",
    label: "Flash",
    note: "A gold bloom on the downbeat with a cut underneath it. Lands with the drum",
    half: 0.13,
    flash: "#e8b865",
    style: (side, u) => S({ opacity: side === "a" ? (u < 0.5 ? 1 : 0) : u < 0.5 ? 0 : 1 }),
  },
  {
    id: "wipe",
    label: "Wipe",
    note: "A hard edge travelling across. Graphic, and both images stay sharp",
    half: 0.18,
    style: (side, u) =>
      S({
        clipPath:
          side === "a" ? `inset(0 0 0 ${ease(u) * 100}%)` : `inset(0 ${(1 - ease(u)) * 100}% 0 0)`,
      }),
  },
  {
    id: "push",
    label: "Push",
    note: "The new shot shoves the old one off frame. The most physical",
    half: 0.22,
    style: (side, u) =>
      S({
        transform:
          side === "a" ? `translateX(${-ease(u) * 100}%)` : `translateX(${(1 - ease(u)) * 100}%)`,
      }),
  },
  {
    id: "zoom",
    label: "Zoom through",
    note: "The old shot grows and goes, the new one settles in from slightly small",
    half: 0.2,
    style: (side, u) =>
      S({
        opacity: side === "a" ? 1 - ease(u) : ease(u),
        transform: side === "a" ? `scale(${1 + 0.14 * ease(u)})` : `scale(${0.9 + 0.1 * ease(u)})`,
      }),
  },
  {
    id: "whip",
    label: "Whip",
    note: "A blurred horizontal throw. The two shots meet at their least legible moment",
    half: 0.14,
    style: (side, u) => {
      const peak = 1 - Math.abs(u - 0.5) * 2;
      // 14 px, not 22. A CSS blur on a full-frame 1080p video is a compositor
      // pass whose cost climbs with the radius, and this is the one transition
      // that has to stay smooth to be judged at all.
      return S({
        opacity: side === "a" ? (u < 0.5 ? 1 : 0) : u < 0.5 ? 0 : 1,
        filter: `blur(${peak * 14}px)`,
        transform: `translateX(${(side === "a" ? -1 : 1) * (1 - peak) * -14}%)`,
      });
    },
  },
  {
    id: "iris",
    label: "Iris",
    note: "The new shot opens from the centre. Softest of the shaped ones, and nearly a cut ON the beat",
    half: 0.24,
    style: (side, u) =>
      S({ clipPath: side === "b" ? `circle(${ease(u) * 78}% at 50% 50%)` : "none" }),
  },

  // ---- glitches ------------------------------------------------------------
  // The first "glitch" was two shots alternating with a 0.6% nudge, which is a
  // flicker. A glitch is ARTEFACTS: bands slipping sideways, the colour channels
  // coming apart, dropped scanlines, speckle. None of that is expressible as CSS
  // on a video element, so these composite on a canvas at low resolution, which
  // is both cheap and the right look - real digital breakup is chunky.
  {
    id: "glitch",
    label: "Glitch",
    note: "Bands tearing sideways with the channels coming apart. The general-purpose one",
    half: 0.22,
    glitch: { bands: 14, slip: 0.09, rgb: 6, noise: 0.05, bars: 2 },
    style: () => S({ opacity: 0 }),
  },
  {
    id: "glitch-hard",
    label: "Glitch / hard",
    note: "Twice the tearing and heavy dropout. The signal failing rather than stuttering",
    half: 0.26,
    glitch: { bands: 26, slip: 0.2, rgb: 11, noise: 0.13, bars: 5 },
    style: () => S({ opacity: 0 }),
  },
  {
    id: "glitch-mosh",
    label: "Glitch / mosh",
    note: "Blocky, like a corrupted frame. Snaps to a coarse grid at the peak",
    half: 0.24,
    glitch: { bands: 10, slip: 0.14, rgb: 4, noise: 0.03, bars: 1, blocky: true },
    style: () => S({ opacity: 0 }),
  },
  {
    id: "glitch-rgb",
    label: "Glitch / chroma",
    note: "Almost no tearing; the colour channels separate and come back. The most restrained",
    half: 0.2,
    glitch: { bands: 4, slip: 0.02, rgb: 16, noise: 0.02, bars: 0 },
    style: () => S({ opacity: 0 }),
  },
  {
    id: "glitch-drop",
    label: "Glitch / dropout",
    note: "Mostly intact with sudden full-width dropouts. Closest to a real broken feed",
    half: 0.28,
    glitch: { bands: 8, slip: 0.05, rgb: 3, noise: 0.2, bars: 9 },
    style: () => S({ opacity: 0 }),
  },
];

const BY_ID = new Map(TRANSITIONS.map((t) => [t.id, t]));

/** Throws rather than falling back: a join naming a transition that does not
 *  exist should fail loudly, not silently render something nobody chose. */
export function byId(id: string): Transition {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`no such transition: ${id}`);
  return t;
}

export const hasTransition = (id: string) => BY_ID.has(id);

/**
 * The track, so the join can be nudged against the drum rather than by eye.
 * half-time groove, saw-stab bass, stutter drop, two-second reversed crash on
 * LEARN: the locked combination.
 */
export const SCORE = "/_capture/jingles/r2-rev-long.mp3";
/** Length of the jingle, and therefore of the beat grid it carries. */
export const SCORE_SECONDS = 10;

export type Junction = {
  id: string;
  label: string;
  at: number;
  a: { src: string; base: number; clampFrom?: number; clampTo?: number };
  b: { src: string; base: number; clampFrom?: number; clampTo?: number };
  /** The pick, so the rig opens on it rather than on a default nobody chose. */
  pick: string;
  /** Starting nudge, in seconds from the downbeat. */
  nudge: number;
};

export const JUNCTIONS: Junction[] = [
  {
    id: "build-learn",
    label: "BUILD -> LEARN",
    at: 6.0,
    a: { src: "/_capture/cut/handoff.mp4", base: 6.0, clampTo: 7.95 },
    b: { src: "/_capture/cut/finish.mp4", base: 1.6, clampFrom: 0.0, clampTo: 5.75 },
    pick: "glitch-rgb",
    // 0, not +1.0. The +1.0 was picked by eye before there was a track to hear.
    // rev-long is a two-second reversed crash placed by its END on this beat, so
    // it RESOLVES at 6.0; landing the cut a second later wastes the whole swell.
    nudge: 0,
  },
  {
    id: "learn-earn",
    label: "LEARN -> EARN",
    at: 8.0,
    a: { src: "/_capture/cut/finish.mp4", base: 3.6, clampTo: 5.75 },
    // base 7.0 is the card's own t=0; clampFrom 5.8 is where its pre-roll
    // starts, so the join can be pulled 1.2 s earlier onto a held card.
    b: { src: "/_capture/cut/finish.mp4", base: 7.0, clampFrom: 5.8 },
    pick: "push",
    nudge: 0,
  },
];

/**
 * How far the join can be nudged before a side runs out of footage and freezes.
 *
 * Surfaced in the UI rather than left to be discovered: a frozen outgoing shot
 * looks like a broken transition, and the difference between "this cut is bad"
 * and "there is no more film here" is not something you can see.
 */
export function nudgeRange(j: Junction): { min: number; max: number } {
  // A is the outgoing side, so pushing the join LATER consumes A's tail.
  const aTail = (j.a.clampTo ?? Infinity) - j.a.base;
  // B is incoming, so pulling the join EARLIER consumes B's head.
  const bHead = j.b.base - (j.b.clampFrom ?? 0);
  return { min: -Math.min(bHead, 2), max: Math.min(aTail, 2) };
}
