// SANDBOX - the four tuning axes of the quiet cut. DEV ONLY.
//
// A PLAIN MODULE, so a server component can name presets and a client scene can
// apply them without either owning the vocabulary.
//
// FOUR AXES, TUNED SEPARATELY, because they fail differently. Flow is felt and
// cannot be judged from a still. Kinetics are judged on ONE word, repeated.
// Position is judged on the whole frame. The patch flip is judged on two
// seconds of itself, six ways, side by side. A page that showed all four at
// once as complete cuts would be four questions asked in one breath.
//
// EVERYTHING IS A KEYFRAME, never a transition. The stage pins every animation's
// currentTime to scene time, and a transition has no seek: under a scrubbed
// clock it lands wherever real time reached. Anything that has to move is
// either a keyframe animation or a value computed from t.
//
// THE KINETICS ARE PORTED, NOT INVENTED. cue-layer.ts already carries the four
// entrances the beta film shipped - a per-character key strike, two halves
// snapping together, a mask-up, and a release - and those were judged in a
// preview and then rendered. Reconstructing new ones from the same intent is
// how you end up shipping something adjacent to what was signed off.
//
// ASCII only.

/** How the word arrives. `rise` is what every round so far used. */
export type Kinetic = "rise" | "strike" | "snap" | "mask" | "release";
/** Where the word sits. */
export type WordPos = "lower-left" | "corners" | "centre-low";
/** How one subject hands over to the next. */
export type Transition = "crossfade" | "wipe" | "push" | "scale";
/** The shape of the beat: lead, entrance length, exit length. */
export type Flow = "even" | "snappy" | "breath";
/** The moment the patch stops being locked. */
export type Jaunty =
  | "jaunty"
  | "pop"
  | "stamp"
  | "swing"
  | "spring"
  | "flip"
  | "plate"
  | "spin"
  | "tilt"
  | "charge"
  | "clunk"
  | "unfurl";

export type Tuning = {
  kinetic: Kinetic;
  pos: WordPos;
  transition: Transition;
  flow: Flow;
  jaunty: Jaunty;
};

/**
 * What the quiet round ships with, so the bench always has a baseline that is
 * the thing being changed rather than one more option.
 *
 * OWNER PICKS: `snappy` and `corners` (2026-08-11), `plating` (2026-08-12).
 * Transition and kinetic were never called and stay at their defaults, which
 * under `snappy` matters less than it did: at a 0.1s handover the four
 * transitions are 100ms apart from each other and the cut is doing the work.
 */
export const DEFAULT_TUNING: Tuning = {
  kinetic: "rise",
  pos: "corners",
  transition: "crossfade",
  flow: "snappy",
  jaunty: "plate",
};

/** The locked patch's idle loop, seconds. Load-bearing: the idle has to be at
 *  REST on the frame the flip starts, so the flip is pinned one whole period
 *  after it. See `jauntyCss`. */
export const WAIT_PERIOD = 2.2;

// ---- flow -------------------------------------------------------------------

export type FlowSpec = {
  /** How far before the downbeat the picture arms, seconds. */
  lead: number;
  /** Entrance and exit lengths, seconds. The exit is also the crossfade. */
  inDur: number;
  outDur: number;
};

export const FLOWS: Record<Flow, FlowSpec & { label: string; note: string }> = {
  even: {
    lead: 0.35,
    inDur: 0.22,
    outDur: 0.22,
    label: "even",
    note: "The current one. The picture arms a third of a beat early so its first frames are spent by the time the word lands, and hands over in a fifth of a second.",
  },
  snappy: {
    lead: 0.1,
    inDur: 0.1,
    outDur: 0.1,
    label: "snappy",
    note: "Everything changes ON the beat and changes fast. Reads as cut rather than dissolve. Costs the lead, so the first frames of a picture are now spent under the word instead of before it.",
  },
  breath: {
    lead: 0.6,
    inDur: 0.38,
    outDur: 0.34,
    label: "breath",
    note: "Arms more than half a beat early and hands over slowly, so two subjects share the frame for a third of a second. Calmer; the risk is that the beat stops being a beat.",
  },
};

// ---- position ---------------------------------------------------------------

/** The word's box for beat `i`. Percentages of the frame.
 *
 *  `corners` is the film's own five-cell logic from cue-layer: opposite corners
 *  on consecutive cues, which reads as a handoff rather than as a caption that
 *  moved. It costs vertical room, so the subject box tightens under it. */
export function wordBox(pos: WordPos, i: number): React.CSSProperties {
  // EVERY SIDE IS STATED, including the ones being given up. `.lt-term` carries
  // a `left` and a `bottom` from the arrangement's slot rule, and an inline
  // style that only sets `right` does not remove them: the box then spans both
  // edges, gets clamped by max-width, and the word lands NEAR the middle with
  // its text right-aligned inside a box that is not where it looks. Two of the
  // four corners came out centred that way, which reads as a taste problem and
  // is a specificity one.
  if (pos === "centre-low") {
    return {
      left: 0,
      right: 0,
      top: "auto",
      bottom: "11%",
      maxWidth: "none",
      textAlign: "center",
    };
  }
  if (pos === "corners") {
    const corner = [
      { left: "7%", right: "auto", top: "8%", bottom: "auto" },
      { left: "auto", right: "7%", top: "auto", bottom: "11%", textAlign: "right" as const },
      { left: "auto", right: "7%", top: "8%", bottom: "auto", textAlign: "right" as const },
      { left: "7%", right: "auto", top: "auto", bottom: "11%" },
    ][i % 4];
    return { maxWidth: "46%", ...corner };
  }
  return { left: "7%", right: "auto", top: "auto", bottom: "11%", maxWidth: "60%" };
}

/** The subject's box has to give the word somewhere to be. Corners take the top
 *  AND the bottom, so the picture loses a band at each end. */
export function subjectBox(pos: WordPos): React.CSSProperties {
  return pos === "corners"
    ? { top: "21%", bottom: "27%" }
    : { top: "10%", bottom: "27%" };
}

/**
 * And the subjects have to FIT that box.
 *
 * Corners leaves 286px of a 549px frame. The ring is 190px at 1.85 (352) and
 * the carousel is five 52px rows at 1.35 (351); both overflowed into the very
 * bands the word had just been given, which is a layout that looks like a
 * position choice and is actually a size one. 0.8 brings both to 281.
 */
export const subjectScale = (pos: WordPos): number => (pos === "corners" ? 0.8 : 1);

export const POSITIONS: { id: WordPos; label: string; note: string }[] = [
  {
    id: "lower-left",
    label: "lower left, held",
    note: "The word never moves. Quietest, and the one that reads as a caption rather than as part of the picture.",
  },
  {
    id: "corners",
    label: "opposite corners",
    note: "The film's own cue grid: consecutive words land in opposite corners, which reads as a handoff. Costs a band at the top and bottom of the picture.",
  },
  {
    id: "centre-low",
    label: "centred, low",
    note: "Under the subject, on its axis. Strongest as a title card; weakest when the subject is also centred, because the two share one column.",
  },
];

// ---- kinetics ---------------------------------------------------------------

export const KINETICS: { id: Kinetic; label: string; note: string }[] = [
  { id: "rise", label: "rise", note: "Fade and lift. What every round so far used. Neutral, and the only one that says nothing about the word." },
  { id: "strike", label: "key strike", note: "Per character, struck down onto the line with a slight vertical squash. The film's DESIGN cue. Reads as typing, so it suits a word that is a verb." },
  { id: "snap", label: "snap", note: "Two halves arriving from opposite sides and meeting on the beat. The film's BUILD cue, and the only one that lands ON the downbeat rather than after it." },
  { id: "mask", label: "mask up", note: "Rises out of its own baseline. The film's LEARN cue. Cleanest of the four and the most typographic." },
  { id: "release", label: "release", note: "Comes forward from slightly small and behind. The film's EARN cue, which is the one it uses for the payoff." },
];

/** CSS for every kinetic, scoped to one type layer's id. The stage pins these,
 *  and `Animation.currentTime` includes the delay, so the per-character stagger
 *  in `strike` comes out right under a scrub for free. */
export function kineticCss(id: string): string {
  return `
#${id} .k-rise .k-line{animation:ltRise .42s cubic-bezier(.16,.9,.24,1) both}
@keyframes ltRise{from{opacity:0;transform:translateY(11%)}to{opacity:1;transform:none}}

#${id} .k-strike .ch{opacity:0;display:inline-block;
  animation:ltStrike .13s cubic-bezier(.3,1.5,.5,1) both}
@keyframes ltStrike{from{opacity:0;transform:translateY(-28%) scaleY(1.25)}
  to{opacity:1;transform:none}}

#${id} .k-snap{position:relative;display:inline-block}
#${id} .k-snap .half{display:block}
#${id} .k-snap .half.r{position:absolute;inset:0}
#${id} .k-snap .half.l{clip-path:inset(0 50% 0 0)}
#${id} .k-snap .half.r{clip-path:inset(0 0 0 50%)}
#${id} .k-snap .half.l{animation:ltSnapL .42s cubic-bezier(.16,.9,.24,1) both}
#${id} .k-snap .half.r{animation:ltSnapR .42s cubic-bezier(.16,.9,.24,1) both}
@keyframes ltSnapL{from{transform:translateX(-42%);opacity:0}to{transform:none;opacity:1}}
@keyframes ltSnapR{from{transform:translateX(42%);opacity:0}to{transform:none;opacity:1}}

#${id} .k-mask{display:block;overflow:hidden}
#${id} .k-mask .k-line{animation:ltMaskUp .5s cubic-bezier(.16,.84,.28,1) both}
@keyframes ltMaskUp{from{transform:translateY(105%)}to{transform:none}}

#${id} .k-release .k-line{animation:ltRelease .66s cubic-bezier(.16,1.1,.3,1) both}
@keyframes ltRelease{from{opacity:0;transform:translateY(14%) scale(.86)}
  to{opacity:1;transform:none}}
`;
}

/** `snap` needs the word twice and `strike` needs it per character, so the lead
 *  a kinetic wants differs. SNAP is the one that has to MEET on the beat. */
export const kineticLead = (k: Kinetic): number =>
  k === "snap" ? 0.3 : k === "mask" ? 0.5 : k === "release" ? 0.25 : 0;

// ---- the patch flip ---------------------------------------------------------

export type JauntySpec = {
  id: Jaunty;
  label: string;
  note: string;
  /** Seconds. */
  dur: number;
  /** Where in the animation the gold face takes over, 0..1. */
  goldAt: number;
  keyframes: string;
  timing: string;
  /**
   * HOW the gold arrives, which is a different question from how the badge
   * MOVES and the reason twelve candidates are not twelve easings.
   *
   * `fade` swaps the two renders in 80ms, hidden by whatever the movement is
   * doing at `goldAt` - an impact, an edge-on frame, or nothing at all.
   * `wipe` plates the gold across the locked patch on a diagonal, so the badge
   * can stay perfectly still and still visibly become yours. Defaults to fade.
   */
  reveal?: "fade" | "wipe";
};

export const JAUNTIES: JauntySpec[] = [
  {
    id: "jaunty",
    label: "jaunty",
    note: "The current one. Overshoots in scale AND rotation, which is what makes it jaunty rather than merely large. Settles in two diminishing swings.",
    dur: 0.62,
    goldAt: 0,
    timing: "cubic-bezier(.2,.9,.25,1)",
    keyframes: `0%{transform:scale(.84) rotate(-6deg)}
      40%{transform:scale(1.17) rotate(5deg)}
      62%{transform:scale(.95) rotate(-2.5deg)}
      80%{transform:scale(1.05) rotate(1deg)}
      100%{transform:scale(1) rotate(0)}`,
  },
  {
    id: "pop",
    label: "pop",
    note: "Scale only, no rotation. The quietest of the six and the one that survives being seen twenty times in a feed - which is the argument that won the hex CTA its swell.",
    dur: 0.44,
    goldAt: 0,
    timing: "cubic-bezier(.18,1.05,.32,1)",
    keyframes: `0%{transform:scale(.88)}
      45%{transform:scale(1.12)}
      72%{transform:scale(.98)}
      100%{transform:scale(1)}`,
  },
  {
    id: "stamp",
    label: "stamp",
    note: "Arrives big and slams down onto the frame, then a single small rebound. Reads as being awarded rather than as appearing. Heaviest of the six.",
    dur: 0.4,
    goldAt: 0.34,
    timing: "cubic-bezier(.4,0,.2,1)",
    keyframes: `0%{transform:scale(1.55);opacity:.15}
      34%{transform:scale(.93);opacity:1}
      58%{transform:scale(1.05)}
      100%{transform:scale(1)}`,
  },
  {
    id: "swing",
    label: "pin swing",
    note: "Hangs from its top corner and swings down like something being pinned on, settling in three decreasing arcs. The most literal reading of a patch.",
    dur: 0.86,
    goldAt: 0,
    timing: "cubic-bezier(.2,.8,.3,1)",
    keyframes: `0%{transform:rotate(-17deg)}
      38%{transform:rotate(9deg)}
      62%{transform:rotate(-4.5deg)}
      82%{transform:rotate(2deg)}
      100%{transform:rotate(0)}`,
  },
  {
    id: "spring",
    label: "drop and bounce",
    note: "Falls in and bounces twice on the baseline, squashing on each landing. The most cartoon of the six; the squash is what sells it and also what dates it.",
    dur: 0.78,
    goldAt: 0.26,
    timing: "linear",
    keyframes: `0%{transform:translateY(-38%) scale(1)}
      26%{transform:translateY(0) scale(1.1,.9)}
      40%{transform:translateY(-16%) scale(.96,1.05)}
      58%{transform:translateY(0) scale(1.06,.95)}
      72%{transform:translateY(-6%) scale(.99,1.02)}
      100%{transform:translateY(0) scale(1)}`,
  },
  {
    id: "flip",
    label: "card flip",
    note: "Turns edge-on and comes back gold, so the swap happens at the one frame where neither face is visible. Locked and earned are the same object rather than a crossfade.",
    dur: 0.56,
    goldAt: 0.5,
    timing: "cubic-bezier(.45,0,.25,1)",
    keyframes: `0%{transform:perspective(700px) rotateY(0deg)}
      50%{transform:perspective(700px) rotateY(90deg)}
      78%{transform:perspective(700px) rotateY(-12deg)}
      100%{transform:perspective(700px) rotateY(0deg)}`,
  },

  // ---- six more, 2026-08-11. Not six easings: four of these move the badge a
  // way none of the first six do, and two change HOW THE GOLD ARRIVES, which is
  // the axis inside the axis.
  {
    id: "plate",
    label: "plating",
    note: "The badge does not move at all. The gold sweeps across it on a diagonal, the way plating goes on, and only then does it take one small breath. The quietest possible reading of earning something, and the only candidate that would survive next to a busy frame.",
    dur: 0.8,
    goldAt: 0,
    reveal: "wipe",
    timing: "cubic-bezier(.3,.8,.3,1)",
    keyframes: `0%,62%{transform:scale(1)}
      78%{transform:scale(1.06)}
      100%{transform:scale(1)}`,
  },
  {
    id: "spin",
    label: "spin",
    note: "A full turn in the plane of the frame while it grows. Reads as a medal being flipped up and caught. The most celebratory of the twelve and the one most likely to look cheap on the twentieth viewing.",
    dur: 0.66,
    goldAt: 0.42,
    timing: "cubic-bezier(.22,.85,.28,1)",
    keyframes: `0%{transform:rotate(0deg) scale(.72)}
      70%{transform:rotate(342deg) scale(1.08)}
      88%{transform:rotate(356deg) scale(.98)}
      100%{transform:rotate(360deg) scale(1)}`,
  },
  {
    id: "tilt",
    label: "tilt flip",
    note: "The card flip turned ninety degrees: top over bottom rather than side to side. Same trick, and it reads heavier because the badge appears to fall forward rather than to rotate.",
    dur: 0.58,
    goldAt: 0.5,
    timing: "cubic-bezier(.45,0,.25,1)",
    keyframes: `0%{transform:perspective(700px) rotateX(0deg)}
      50%{transform:perspective(700px) rotateX(88deg)}
      78%{transform:perspective(700px) rotateX(-11deg)}
      100%{transform:perspective(700px) rotateX(0deg)}`,
  },
  {
    id: "charge",
    label: "charge",
    note: "Two small pulses that do not land, then a third that does, with the gold arriving on the hit. Anticipation is the only thing on this page that makes the moment feel EARNED rather than granted, and the cost is that it needs the longest window.",
    dur: 0.94,
    goldAt: 0.6,
    timing: "linear",
    keyframes: `0%{transform:scale(1)}
      12%{transform:scale(1.05)} 22%{transform:scale(1)}
      36%{transform:scale(1.08)} 48%{transform:scale(.97)}
      60%{transform:scale(1.22)} 74%{transform:scale(.98)}
      86%{transform:scale(1.03)} 100%{transform:scale(1)}`,
  },
  {
    id: "clunk",
    label: "clunk",
    note: "Arrives from below at an angle and stops dead. No overshoot anywhere, which is the point: everything else on this page bounces, and a thing that simply ARRIVES reads as heavier than a thing that wobbles.",
    dur: 0.34,
    goldAt: 0.55,
    timing: "cubic-bezier(.16,.9,.3,1)",
    keyframes: `0%{transform:translate(-14%,26%) rotate(-11deg) scale(.9);opacity:.4}
      100%{transform:translate(0,0) rotate(0) scale(1);opacity:1}`,
  },
  {
    id: "unfurl",
    label: "unfurl",
    note: "Opens vertically from a closed line, like a pennant dropping. Suits the pennant and shield silhouettes and fights the pentagon a little. The gold is already there as it opens, so nothing is hidden.",
    dur: 0.62,
    goldAt: 0,
    timing: "cubic-bezier(.2,.95,.3,1)",
    keyframes: `0%{transform:scaleY(.04) scaleX(.9)}
      58%{transform:scaleY(1.12) scaleX(1.02)}
      80%{transform:scaleY(.96) scaleX(.99)}
      100%{transform:scaleY(1) scaleX(1)}`,
  },
];

export const jauntyById = (id: Jaunty): JauntySpec =>
  JAUNTIES.find((j) => j.id === id) ?? JAUNTIES[0];

/** Keyframes for every candidate plus the locked idle, once per stage. */
export function jauntyCss(): string {
  return (
    JAUNTIES.map(
      (j) => `@keyframes jk-${j.id}{${j.keyframes}}
.j-${j.id}{animation:jk-${j.id} ${j.dur}s ${j.timing} both}`,
    ).join("\n") +
    `
/* The locked patch, "animated" while it waits: a slow tilt, not a glow, so it
   reads as something not yet yours rather than as a button.

   IT RESTS AT 0% AND 100%, and the tilt lives at the quarters. The first
   version put the extremes on the boundary, which meant the idle handed over
   to the flip from wherever its loop happened to be - a visible snap into every
   candidate's first keyframe, and a fatal one for plating, whose whole claim is
   that the badge does not move. Resting on the boundary lets the flip be pinned
   one whole period later and start from exactly where the idle left.

   NO BACKTICKS ANYWHERE IN THIS STRING. It is a template literal, so a backtick
   in a CSS comment terminates it and the file stops parsing - the same note
   cue-layer.ts carries, earned twice now. */
@keyframes jkWait{0%,100%{transform:none}
  25%{transform:translateY(-3px) rotate(-1.5deg)}
  75%{transform:translateY(3px) rotate(1.5deg)}}
.j-wait{animation:jkWait ${WAIT_PERIOD}s ease-in-out infinite}
`
  );
}

// ---- transitions ------------------------------------------------------------

export const TRANSITIONS: { id: Transition; label: string; note: string }[] = [
  { id: "crossfade", label: "crossfade", note: "What every round so far used. Nothing moves; one picture is simply replaced. Invisible, which is either the point or the problem." },
  { id: "wipe", label: "alpha wipe", note: "Each subject dissolves rightward under a moving mask, the way the quiz already leaves. One language for every handoff instead of one exception." },
  { id: "push", label: "push", note: "The outgoing subject leaves to the left and the incoming one arrives from the right. Direction makes the cut feel like progress, at the cost of two things moving at once." },
  { id: "scale", label: "scale through", note: "Outgoing shrinks away, incoming comes forward. Reads as depth rather than as sequence; the risk is that everything looks like it is on the same z axis." },
];

/**
 * The subject's own style for a transition, given its window.
 *
 * OPACITY IS COMPUTED, never transitioned, and so is every transform here: the
 * stage seeks, and a CSS transition cannot be seeked.
 */
export function subjectStyle(
  tr: Transition,
  t: number,
  from: number,
  to: number,
  f: FlowSpec,
): React.CSSProperties {
  const inP = clamp01((t - from) / f.inDur);
  const outP = clamp01((t - (to - f.outDur)) / f.outDur);
  const vis = t < from || t >= to ? 0 : Math.min(inP, 1 - outP);
  if (vis <= 0) return { opacity: 0 };

  if (tr === "wipe") {
    // Opaque edge walks off to the left, so the RIGHT of the picture goes
    // first and the whole thing drifts that way as it leaves.
    const edge = 118 - 150 * outP;
    return {
      opacity: inP,
      WebkitMaskImage: `linear-gradient(90deg,#000 ${edge}%,transparent ${edge + 26}%)`,
      maskImage: `linear-gradient(90deg,#000 ${edge}%,transparent ${edge + 26}%)`,
      transform: `translateX(${outP * 7}%)`,
    };
  }
  if (tr === "push") {
    return {
      opacity: vis,
      transform: `translateX(${(1 - inP) * 9 - outP * 9}%)`,
    };
  }
  if (tr === "scale") {
    return {
      opacity: vis,
      transform: `scale(${0.9 + 0.1 * inP - 0.12 * outP})`,
    };
  }
  return { opacity: vis };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
