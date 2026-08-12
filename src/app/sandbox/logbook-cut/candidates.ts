// SANDBOX - ten whole cuts, to be judged as cuts. DEV ONLY.
//
// WHY THIS REPLACES THE AXIS BENCH. The bench asked ten questions separately -
// pick a flow, then a composition, then a word entrance - and a film is not the
// sum of ten independent answers. `plating` is the quietest flip on the page and
// it is the RIGHT one next to a still frame and the wrong one next to a whip
// pan; `snappy` is right when nothing else is moving and unreadable under a
// travelling layout. Judging them one at a time makes every choice out of
// context, which is exactly the complaint. Each entry below is a complete cut
// with a thesis, and they lose or win whole.
//
// ---------------------------------------------------------------------------
// WHAT THE RESEARCH ACTUALLY CHANGED, as opposed to confirmed
//
// 1. THE PICTURE LANDS BEFORE THE BED. Standard practice in animation and in
//    scoring: a visual hit reads as simultaneous with a beat when it arrives two
//    to four frames EARLY and never a frame late. At the 30fps this renders at
//    that is 0.067-0.133s. Every round so far landed exactly on the downbeat,
//    which is measurably correct and feels late. Hence `preRoll`, and hence it
//    being a whole-cut constant: what is offset is the picture against the bed.
//
// 2. THE LANDING IS THE EVENT, NOT THE LAUNCH. "Think about where the motion
//    ends, not where it starts." An entrance therefore starts at
//    `beat - its own duration - preRoll`, which is what `kineticLead` already
//    encoded for four of eleven kinetics and now has to encode for all of them.
//
// 3. ONLY A FEW THINGS DESERVE MOTION. If everything animates, nothing reads as
//    important. Half the candidates below move exactly one thing per beat, and
//    the ones that move more are on the page to lose that argument visibly.
//
// 4. READABLE FOR HALF A SECOND AFTER IT SETTLES. That is a hard constraint on
//    `snappy` (0.1s handover) plus a long entrance: `track` needs 0.45s to
//    arrive and would then hold for 1.35s, which passes - but `track` under
//    snappy with a 1.4s bar would not.
//
// ---------------------------------------------------------------------------
// WHAT THE BED ALREADY DECIDED, which no round has yet honoured
//
// `tools/academy-bed.py` is not four identical hits. Its landings weigh
// 0.55 / 0.78 / 0.70 / 1.00, and the DIP at the third is deliberate: the third
// escalates by changing COLOUR - a dry mechanical click against three struck
// hits - because the picture there is a small precise event, not an impact. It
// also approaches each landing with a riser, and there is a hard rule that the
// approach to the last one may not start a full bar early or it buries the
// third.
//
// A picture that escalates only by getting bigger contradicts its own
// soundtrack on beat three. Several candidates below quote that curve directly:
// sizes that dip, or a word texture that changes rather than grows.
//
// ASCII only.

import { DEFAULT_TUNING, type Tuning } from "./tuning";

export type Candidate = {
  id: string;
  name: string;
  /** One line. What this cut believes. */
  thesis: string;
  /** What it is betting, and what it gives up to bet it. */
  note: string;
  tuning: Tuning;
};

/** Three frames at 30fps. The middle of the 2-4 frame window. */
const PRE = 0.1;

const base = (t: Partial<Tuning>): Tuning => ({
  ...DEFAULT_TUNING,
  preRoll: PRE,
  ...t,
});

export const CANDIDATES: Candidate[] = [
  {
    id: "landing",
    name: "01 / Landing",
    thesis: "Everything arrives three frames early and nothing overshoots.",
    note:
      "The disciplined reading of the research and the one to beat. One thing moves per beat, every entrance completes just before its downbeat, the ease is out-only so nothing bounces, and the flip is the plating - the badge does not move at all. Bets that precision reads as expensive. Gives up every chance to be memorable.",
    tuning: base({
      flow: "even",
      kinetic: "mask",
      kineticOut: "fade",
      layout: "weighted",
      motionAll: "hold",
      jaunty: "plate",
    }),
  },
  {
    id: "approach",
    name: "02 / Approach",
    thesis: "The bed approaches every landing with a riser. So does the picture.",
    note:
      "Each part enters early and decelerates into its beat rather than appearing on it, which is the visual of the reverse swell already in the audio. Word tracks in over 0.45s, parts settle. Breath flow, because an approach needs somewhere to come from. Bets that matching the bed's gesture is worth more than matching its hit. Gives up snap.",
    tuning: base({
      flow: "breath",
      kinetic: "track",
      kineticOut: "collapse",
      layout: "weighted",
      motionAll: "settle",
      camera: "creep-in",
      jaunty: "charge",
    }),
  },
  {
    id: "four-strikes",
    name: "03 / Four strikes",
    thesis: "The bed's weight curve, drawn: 0.55, 0.78, 0.70, 1.00.",
    note:
      "The one that quotes the soundtrack literally. Beat three does NOT get bigger - it changes texture, swapping the word's strike for a split flap, exactly as the bed swaps a struck hit for a dry click. Beat four is the biggest thing in the cut by a wide margin. Bets that a picture agreeing with its own arrangement is the whole difference between cut-to-music and set-to-music.",
    tuning: base({
      flow: "snappy",
      kinetic: "strike",
      kineticPerBeat: ["strike", "drop", "flap", "release"],
      kineticOut: "fade",
      layout: "weighted",
      motionAll: "hold",
      jaunty: "stamp",
    }),
  },
  {
    id: "rhyme",
    name: "04 / Rhyme",
    thesis: "Circle, roundel, wheel, pentagon. Every handover is a shape match.",
    note:
      "A graphic match cut, four times: the quiz's hex option chips hand to the XP ring, the ring's centre is the wing's roundel, the wheel is a column of those same wings, and the patch is the last one solid. Everything centred, everything the same size, iris in and out so each shape grows out of where the last one stood. Bets the transition can be free. Gives up all directional energy.",
    tuning: base({
      flow: "even",
      kinetic: "release",
      kineticOut: "fade",
      layout: "centred",
      motionAll: "breathe",
      jaunty: "plate",
    }),
  },
  {
    id: "whip",
    name: "05 / Whip",
    thesis: "Direction carries. Every cut goes the same way.",
    note:
      "The most kinetic of the ten. Parts alternate in from opposite edges, the camera pans with them, the word snaps together from two halves on the beat. The pan gives the parallax something to separate against, so this is also the candidate where depth actually reads. Bets on energy. Risks looking like a template, and at 0.1s handovers it is close to unreadable on a phone.",
    tuning: base({
      flow: "snappy",
      kinetic: "snap",
      kineticOut: "wipe",
      layout: "travel",
      motionAll: "drift-l",
      camera: "pan",
      parallax: "deep",
      jaunty: "clunk",
    }),
  },
  {
    id: "depth",
    name: "06 / Depth",
    thesis: "If the frame has a front and a back, nothing has to move much.",
    note:
      "A slow push in, three separated planes, and parts that only breathe. The whole argument is that a static composition with real depth outperforms a busy one that is flat. Bets that the backdrop lattice earns its keep. Gives up the hard cut entirely, and is the candidate most likely to read as slow in a feed.",
    tuning: base({
      flow: "breath",
      kinetic: "blur",
      kineticOut: "blur",
      layout: "weighted",
      motionAll: "breathe",
      camera: "creep-in",
      parallax: "deep",
      jaunty: "plate",
    }),
  },
  {
    id: "feed",
    name: "07 / Feed",
    thesis: "Sound off, thumb moving, and probably cropped to a square.",
    note:
      "Built for the surface it will actually be watched on. Type centred and large so it survives a 9:16 crop of a 16:9 frame, everything centred so nothing is lost at the edges, hard cuts because a scroll does not wait for a dissolve, and a stretch entrance that is legible at 90 pixels wide. Bets that the crop is the real constraint. Ugly at full size, on purpose.",
    tuning: base({
      flow: "snappy",
      pos: "centre-low",
      kinetic: "stretch",
      kineticOut: "none",
      layout: "centred",
      motionAll: "push-in",
      jaunty: "pop",
    }),
  },
  {
    id: "board",
    name: "08 / Departure board",
    thesis: "One mechanism, four times: everything flips.",
    note:
      "The aviation ladder taken at its word. The word is a split-flap board, the rank wheel is the same mechanism at another scale, and the patch tilt-flips rather than being plated. Deliberately breaks the plating pick, because a house language that appears once is decoration and one that appears four times is a language. Bets on coherence. Risks being twee.",
    tuning: base({
      flow: "even",
      kinetic: "flap",
      kineticOut: "sink",
      layout: "vertical",
      motionAll: "hold",
      jaunty: "tilt",
    }),
  },
  {
    id: "held",
    name: "09 / Held",
    thesis: "The only things that move are the three things that mean something.",
    note:
      "Maximum restraint. No camera, no parallax, no part motion, hard cuts, and the word simply appears and is gone. The entire motion budget goes to the ring drawing itself, the wheel spinning up, and the gold plating on. Bets the research line that if everything moves nothing is important. The risk is honest: five seconds of this could read as a broken loop.",
    tuning: base({
      flow: "snappy",
      kinetic: "wipe",
      kineticOut: "none",
      layout: "centred",
      motionAll: "hold",
      jaunty: "plate",
    }),
  },
  {
    id: "climb",
    name: "10 / Climb",
    thesis: "It is a ladder. Everything in the frame goes up.",
    note:
      "The metaphor made literal in the motion rather than stated in the copy: parts stack high and low and all of them rise as they play, the camera tilts up across the ten seconds, the word masks up out of its own baseline, and the patch unfurls upward. Bets that a film about rank should move in the direction of rank. Gives up the down-beat impact that a struck landing wants.",
    tuning: base({
      flow: "even",
      kinetic: "mask",
      kineticOut: "lift",
      layout: "vertical",
      motionAll: "rise",
      camera: "tilt",
      parallax: "subtle",
      jaunty: "unfurl",
    }),
  },
];

export const candidateById = (id?: string) =>
  CANDIDATES.find((c) => c.id === id) ?? null;
