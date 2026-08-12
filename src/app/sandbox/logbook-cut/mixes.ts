// SANDBOX - ten MIXED cuts. DEV ONLY.
//
// WHAT WAS WRONG WITH THE FIRST TEN. Each of them applied one verb to all four
// beats: everything climbed, or everything slid, or everything held. That is
// not a cut, it is a filter - and "I like climb, but not all shots should be
// climbing" is the correct read of it. The machinery could always express a
// different treatment per beat; the candidates just never used it, because they
// set `motionAll`, which overrides the whole scheme by design.
//
// ---------------------------------------------------------------------------
// THE FOUR BEATS HAVE FOUR DIFFERENT JOBS, and that is what a mix is for.
//
//   READ    the quiz     Text. It has to be READ, so its arrival must not
//                        compete with reading it and it must sit still while it
//                        is up. It is also the only beat that hands from a page
//                        to an emblem, so its exit is the one real scene change.
//
//   GAIN    the ring     A disc whose INTERNAL animation is the event - the
//                        band draws itself. An entrance with any energy of its
//                        own steps on that. It wants to be placed and then left
//                        alone. Bed weight 0.78.
//
//   RANK    the wheel    THE DIP. Bed weight 0.70, and it escalates by changing
//                        colour to a dry mechanical click rather than by
//                        getting louder, because the event is small and precise.
//                        The picture should get SMALLER and more mechanical
//                        here, not bigger. Every mix below honours this.
//
//   PATCH   the patch    Bed weight 1.00, the biggest thing in the piece. It is
//                        the only beat that has earned an overshoot, and in
//                        most of these it is the only one that gets one.
//
// So the useful question is not "which verb" but "which verb WHERE", and each
// mix below is a different rule for deciding that.
//
// ASCII only.

import { DEFAULT_TUNING, type Tuning } from "./tuning";
import type { PartSpec, Scheme } from "./motion";
import type { Candidate } from "./candidates";

/** Three frames at 30fps: the picture runs that far ahead of the bed. */
const PRE = 0.1;

const p = (
  place: PartSpec["place"],
  size: number,
  enter: PartSpec["enter"],
  exit: PartSpec["exit"],
  motion: PartSpec["motion"],
  dur?: { in?: number; out?: number },
): PartSpec => ({
  place,
  size,
  enter,
  exit,
  motion,
  ...(dur?.in !== undefined ? { inDur: dur.in } : null),
  ...(dur?.out !== undefined ? { outDur: dur.out } : null),
});

const mix = (
  id: string,
  name: string,
  thesis: string,
  note: string,
  scheme: Scheme,
  t: Partial<Tuning>,
): Candidate => ({
  id,
  name,
  thesis,
  note,
  tuning: {
    ...DEFAULT_TUNING,
    preRoll: PRE,
    motionAll: "auto", // NEVER set on a mix; it would flatten the whole point
    scheme,
    ...t,
  },
});

export const MIXES: Candidate[] = [
  mix(
    "handoff",
    "11 / Handoff",
    "Each beat enters from wherever the last one left.",
    "The exits and entrances are matched into one continuous gesture: the quiz wipes off to the right and the ring arrives from the right; the ring lifts away and the wheel comes up from below it; the wheel drops out and the patch is the only thing that grows. Four different moves, one travelling logic. Beat three is small and mechanical because the bed dips there.",
    {
      quiz: p("centre", 0.98, "fade", "wipe-r", "hold", { in: 0.4 }),
      ring: p("centre", 1.04, "push-r", "push-u", "hold"),
      ladder: p("centre", 0.88, "push-u", "push-d", "hold", { in: 0.16 }),
      patch: p("centre", 1.2, "grow", "fade", "settle", { in: 0.34 }),
    },
    { kinetic: "mask", kineticPerBeat: ["mask", "rise", "flap", "release"], kineticOut: "fade" },
  ),

  mix(
    "climb-twice",
    "12 / Climb, twice",
    "Only the two things that are about going up actually go up.",
    "The note you gave, taken literally. The ring and the wheel rise, because rank is the thing they mean; the quiz sits still because it is being read, and the patch does not climb at all - it arrives and stays, because it is the destination rather than the journey. The camera tilts only while the two climbing beats are on screen.",
    {
      quiz: p("centre", 0.98, "fade", "fade", "hold", { in: 0.38 }),
      ring: p("low", 1.02, "push-u", "push-u", "rise"),
      ladder: p("high", 0.9, "push-u", "fade", "rise", { in: 0.2 }),
      patch: p("centre", 1.22, "iris", "fade", "settle"),
    },
    { camera: "tilt", kinetic: "mask", kineticOut: "lift", jaunty: "unfurl" },
  ),

  mix(
    "one-slide",
    "13 / One slide",
    "There is exactly one slide in the whole film, and it is the scene change.",
    "A slide used once is a decision; a slide used four times is a template. The only lateral move in the cut is the quiz leaving, which is the one genuine change of place - page to emblem. After that everything arrives on the spot: the ring grows, the wheel drops in, the patch is plated. Bets that scarcity is what makes a move read.",
    {
      quiz: p("centre", 0.98, "fade", "push-l", "hold", { in: 0.36, out: 0.34 }),
      ring: p("centre", 1.04, "grow", "fade", "hold"),
      ladder: p("centre", 0.88, "push-d", "fade", "hold", { in: 0.18 }),
      patch: p("centre", 1.18, "fade", "fade", "breathe"),
    },
    { kinetic: "wipe", kineticOut: "fade", jaunty: "plate" },
  ),

  mix(
    "rest-hit",
    "14 / Rest, hit, rest, hit",
    "Alternate. Motion means nothing unless something is still.",
    "Beats one and three are dead still and beats two and four move, so the rhythm comes from contrast rather than from constant activity. It also happens to match the bed: the two struck landings are the ones that move, and the dry click at beat three sits in stillness. The word alternates with it - cut in, then a soft one, then cut, then the payoff.",
    {
      quiz: p("centre", 0.98, "fade", "fade", "hold", { in: 0.3 }),
      ring: p("centre", 1.06, "grow", "shrink", "push-in"),
      ladder: p("centre", 0.86, "fade", "fade", "hold", { in: 0.14 }),
      // Arrives downward and is caught by `settle`, which is the damped sine -
      // the closest this vocabulary gets to a struck landing.
      patch: p("centre", 1.24, "push-d", "fade", "settle", { in: 0.3 }),
    },
    {
      kinetic: "strike",
      kineticPerBeat: ["strike", "release", "wipe", "drop"],
      kineticOut: "none",
      jaunty: "charge",
    },
  ),

  mix(
    "weight",
    "15 / Weight",
    "The bed's 0.55 / 0.78 / 0.70 / 1.00, in size and in energy.",
    "Not just the sizes - the ENTRANCE energy follows the same curve, and it dips at three the way the bed does. Quiz fades in quietly, ring grows, wheel arrives smaller and drier than the ring did, patch is oversized and is the only overshoot in the film. The one candidate where you could mute the audio and still read the arrangement.",
    {
      quiz: p("centre", 0.94, "fade", "fade", "hold", { in: 0.42 }),
      ring: p("centre", 1.06, "grow", "fade", "push-in"),
      ladder: p("centre", 0.84, "push-d", "fade", "hold", { in: 0.15, out: 0.12 }),
      patch: p("centre", 1.3, "grow", "fade", "settle", { in: 0.26 }),
    },
    {
      kinetic: "rise",
      kineticPerBeat: ["rise", "release", "flap", "stretch"],
      kineticOut: "fade",
      jaunty: "stamp",
    },
  ),

  mix(
    "two-tongues",
    "16 / Two languages",
    "The product half moves softly. The insignia half moves mechanically.",
    "A split that says which half of the film is UI and which is heraldry. The quiz and the ring - both real product surfaces - fade and grow, with soft type. The wheel and the patch - both emblems - flap, push and plate, with mechanical type. Two vocabularies, one per half, rather than one vocabulary or four.",
    {
      quiz: p("centre", 0.98, "fade", "fade", "hold", { in: 0.4 }),
      ring: p("centre", 1.04, "grow", "fade", "breathe"),
      ladder: p("centre", 0.88, "push-u", "push-u", "hold", { in: 0.14 }),
      patch: p("centre", 1.2, "iris", "fade", "hold", { in: 0.28 }),
    },
    {
      kinetic: "blur",
      kineticPerBeat: ["blur", "blur", "flap", "flap"],
      kineticOut: "fade",
      jaunty: "plate",
    },
  ),

  mix(
    "setup",
    "17 / Setup and payoff",
    "Three beats deliberately underplayed so the fourth is enormous.",
    "Everything before the patch is small, quiet and centred - no camera, no drift, short entrances, nothing above 1.0. Then the patch arrives at 1.35 with the only overshoot, the only motion, and the loudest word. The risk is honest: three understated beats is close to three boring ones, and this is on the page to find out where that line is.",
    {
      quiz: p("centre", 0.9, "fade", "fade", "hold", { in: 0.28 }),
      ring: p("centre", 0.94, "fade", "fade", "hold", { in: 0.24 }),
      ladder: p("centre", 0.8, "fade", "fade", "hold", { in: 0.18 }),
      patch: p("centre", 1.35, "grow", "fade", "settle", { in: 0.36 }),
    },
    {
      kinetic: "wipe",
      kineticPerBeat: ["wipe", "wipe", "wipe", "drop"],
      kineticOut: "none",
      jaunty: "charge",
    },
  ),

  mix(
    "zigzag",
    "18 / Zigzag",
    "Four places, four entrances, and the eye traces a Z.",
    "The most composed of the ten: the quiz sits low, the ring high, the wheel low again, the patch centred, and each enters along the axis it lives on. The motion differs per beat too - drift, hold, rise, settle - so no two beats share a verb anywhere. Busiest of the mixes and the one most likely to fight the corner words.",
    {
      quiz: p("low", 0.96, "push-u", "push-d", "drift-r", { in: 0.36 }),
      ring: p("high", 1.02, "push-d", "push-u", "hold"),
      ladder: p("low", 0.86, "push-u", "fade", "rise", { in: 0.16 }),
      patch: p("centre", 1.22, "grow", "fade", "settle", { in: 0.3 }),
    },
    {
      kinetic: "snap",
      kineticPerBeat: ["snap", "mask", "flap", "release"],
      kineticOut: "sink",
      parallax: "subtle",
      camera: "pan",
      jaunty: "spin",
    },
  ),

  mix(
    "pace",
    "19 / Pace",
    "The first half breathes, the second half cuts.",
    "Timing is the thing that varies rather than direction. The quiz gets a long 0.45s arrival because it has to be read; the ring gets a moderate one; the wheel snaps in at 0.12s because it is the dry mechanical beat; the patch arrives fast and then holds the longest. Same verbs throughout, four different tempos - the mix that argues pacing carries more than choreography.",
    {
      quiz: p("centre", 0.98, "fade", "fade", "hold", { in: 0.45, out: 0.3 }),
      ring: p("centre", 1.04, "grow", "fade", "push-in", { in: 0.3 }),
      ladder: p("centre", 0.86, "grow", "fade", "hold", { in: 0.12, out: 0.1 }),
      patch: p("centre", 1.22, "grow", "fade", "hold", { in: 0.2 }),
    },
    { kinetic: "mask", kineticOut: "fade", jaunty: "plate" },
  ),

  mix(
    "rhyme-mixed",
    "20 / Rhyme, then break it",
    "Three beats share a shape. The fourth deliberately does not.",
    "The circle runs through the first three - the ring, the wing's roundel, the wheel of wings - all arriving with an iris so each grows out of the last. Then the patch is a pentagon and arrives completely differently, plated rather than grown, because the whole point of a rhyme is the line that breaks it. The quiz opens on a wipe so the circles start clean.",
    {
      quiz: p("centre", 0.98, "wipe-r", "wipe-r", "hold", { in: 0.4 }),
      ring: p("centre", 1.04, "iris", "fade", "hold"),
      ladder: p("centre", 0.88, "iris", "fade", "hold", { in: 0.18 }),
      patch: p("centre", 1.24, "fade", "fade", "breathe", { in: 0.2 }),
    },
    {
      kinetic: "release",
      kineticPerBeat: ["wipe", "release", "release", "stretch"],
      kineticOut: "fade",
      jaunty: "plate",
    },
  ),
];

export const mixById = (id?: string) => MIXES.find((m) => m.id === id) ?? null;
