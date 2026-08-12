// SANDBOX - the motion system for the quiet cut. DEV ONLY.
//
// A PLAIN MODULE. Everything here is a pure function of scene time, and that is
// not a style preference: the render pass SEEKS, so a value that depends on the
// previous frame - a spring, an integrator, a CSS transition - cannot exist in
// this film. Springs are faked with damped sines of t, which look the same and
// are seekable.
//
// WHY ONE COMPOSED TRANSFORM PER PART. A part's position is the sum of four
// unrelated things: where it is placed, what its entrance is doing, what it is
// doing while it sits there, and how far the camera and its parallax depth have
// moved it. Expressed as four CSS rules they fight over `transform` and the last
// one wins; expressed as four nested elements they multiply in the wrong order
// and the entrance ends up scaled by the camera. So they are accumulated as
// NUMBERS and emitted once.
//
// THE FOUR PARTS ARE NOT INTERCHANGEABLE and the presets know it. The quiz is
// wide, text-shaped and read left to right. The ring is a centred disc. The
// ladder is a tall column. The patch is a small dense object. A layout that
// treats them as four rectangles produces a cut where the quiz is cropped and
// the patch is lost.
//
// ASCII only.

export type PartId = "quiz" | "ring" | "ladder" | "patch";
export const PARTS: PartId[] = ["quiz", "ring", "ladder", "patch"];
export const PART_LABEL: Record<PartId, string> = {
  quiz: "the question",
  ring: "the XP ring",
  ladder: "the rank wheel",
  patch: "the patch",
};

/** Percent of the frame. `x`/`y` are offsets from the centre of the part's
 *  band, `s` a scale multiplier, `r` degrees, `o` an opacity multiplier. */
export type Vec = { x: number; y: number; s: number; r: number; o: number };
const ZERO: Vec = { x: 0, y: 0, s: 1, r: 0, o: 1 };
const add = (a: Vec, b: Vec): Vec => ({
  x: a.x + b.x,
  y: a.y + b.y,
  s: a.s * b.s,
  r: a.r + b.r,
  o: a.o * b.o,
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** Smoothstep. The default easing for anything that is not a named curve. */
const ease = (p: number) => {
  const x = clamp01(p);
  return x * x * (3 - 2 * x);
};
/** Decaying oscillation - a spring's LOOK without a spring's state. */
const wobble = (p: number, freq: number, damp: number) =>
  p <= 0 ? 0 : Math.exp(-damp * p) * Math.sin(freq * p);

// ---- placement --------------------------------------------------------------

export type Place = "centre" | "left" | "right" | "high" | "low" | "high-left" | "low-right";
export const PLACES: Place[] = ["centre", "left", "right", "high", "low", "high-left", "low-right"];

/** Offsets from the centre of the part's band, in percent of the frame. Kept as
 *  offsets rather than boxes so a part can be nudged without re-deriving the
 *  band the word already claimed. */
export function placeOffset(p: Place): { x: number; y: number } {
  switch (p) {
    case "left":
      return { x: -19, y: 0 };
    case "right":
      return { x: 19, y: 0 };
    // The vertical offsets are bigger than they look because they are a
    // percentage of the part's BAND, and under `corners` that band is half the
    // frame. At 9 the high and low tiles were indistinguishable from centre.
    case "high":
      return { x: 0, y: -17 };
    case "low":
      return { x: 0, y: 17 };
    case "high-left":
      return { x: -16, y: -13 };
    case "low-right":
      return { x: 16, y: 13 };
    default:
      return { x: 0, y: 0 };
  }
}

// ---- entrances and exits ----------------------------------------------------

export type Move =
  | "fade"
  | "push-l"
  | "push-r"
  | "push-u"
  | "push-d"
  | "grow"
  | "shrink"
  | "wipe-r"
  | "iris"
  | "swing";

export const MOVES: { id: Move; label: string }[] = [
  { id: "fade", label: "fade" },
  { id: "push-l", label: "push left" },
  { id: "push-r", label: "push right" },
  { id: "push-u", label: "push up" },
  { id: "push-d", label: "push down" },
  { id: "grow", label: "grow in" },
  { id: "shrink", label: "shrink away" },
  { id: "wipe-r", label: "alpha wipe" },
  { id: "iris", label: "iris" },
  { id: "swing", label: "swing" },
];

/** `p` is 0 at the far edge of the move and 1 at rest. `dir` is +1 entering,
 *  -1 leaving, which flips the side a push comes from so an entrance and an
 *  exit read as one continuous direction rather than a bounce. */
function moveVec(m: Move, p: number, dir: 1 | -1): Vec {
  const k = 1 - ease(p);
  switch (m) {
    case "push-l":
      return { ...ZERO, x: -k * 11 * dir, o: p };
    case "push-r":
      return { ...ZERO, x: k * 11 * dir, o: p };
    case "push-u":
      return { ...ZERO, y: -k * 11 * dir, o: p };
    case "push-d":
      return { ...ZERO, y: k * 11 * dir, o: p };
    case "grow":
      return { ...ZERO, s: 1 - k * 0.16, o: p };
    case "shrink":
      return { ...ZERO, s: 1 + k * 0.16, o: p };
    case "swing":
      return { ...ZERO, r: -k * 7 * dir, y: k * 4, o: p };
    case "iris":
      return { ...ZERO, s: 1 - k * 0.5, o: p };
    case "wipe-r":
      // Handled as a mask, not a transform; opacity stays at 1 so the mask is
      // the only thing removing pixels.
      return ZERO;
    default:
      return { ...ZERO, o: p };
  }
}

/** The mask a `wipe-r` needs, or nothing. Split from the vector because a mask
 *  is a string and cannot be summed. */
function moveMask(m: Move, p: number, entering: boolean): string | null {
  if (m !== "wipe-r") return null;
  // Entering: the opaque edge sweeps in from the left. Leaving: it keeps going,
  // so the two halves of a wipe read as ONE gesture crossing the frame rather
  // than as an arrival and a separate departure.
  const q = entering ? ease(p) : 1 - ease(p);
  const edge = -32 + 132 * q;
  return `linear-gradient(94deg,#000 ${edge}%,transparent ${edge + 30}%)`;
}

// ---- what a part does while it is on screen ---------------------------------

export type Motion =
  | "hold"
  | "push-in"
  | "pull-back"
  | "drift-l"
  | "drift-r"
  | "rise"
  | "sway"
  | "settle"
  | "breathe";

export const MOTIONS: { id: Motion; label: string; note: string }[] = [
  { id: "hold", label: "hold", note: "Dead still once it arrives. The only one that makes the WORD the moving thing." },
  { id: "push-in", label: "push in", note: "Grows a few percent across its whole beat. A held shot that is never quite still, which is what stops a static frame reading as a stall." },
  { id: "pull-back", label: "pull back", note: "The reverse. Reads as the subject receding into the film rather than the camera approaching it." },
  { id: "drift-l", label: "drift left", note: "Travels a few percent against the cut direction. Cheap parallax when there is only one layer." },
  { id: "drift-r", label: "drift right", note: "With the cut instead of against it. Calmer, and it makes consecutive beats feel like one move." },
  { id: "rise", label: "rise", note: "Lifts as it plays. Suits the ring and the ladder, which are both about going up." },
  { id: "sway", label: "sway", note: "A slow lateral oscillation. Alive rather than directional; too much of it on a small object looks like a loading spinner." },
  { id: "settle", label: "settle", note: "Arrives still moving and decelerates into place over half a second, then holds. The one that makes an entrance feel like weight." },
  { id: "breathe", label: "breathe", note: "A scale oscillation slower than the bar, so no two beats catch it at the same phase. Reads as alive without reading as animated." },
];

/** `p` is 0 at the start of the part's window and 1 at the end; `dt` is seconds
 *  since it armed, for the motions that care about real duration. */
function motionVec(m: Motion, p: number, dt: number): Vec {
  switch (m) {
    case "push-in":
      return { ...ZERO, s: 1 + 0.07 * p };
    case "pull-back":
      return { ...ZERO, s: 1.07 - 0.07 * p };
    case "drift-l":
      return { ...ZERO, x: -3.5 * p };
    case "drift-r":
      return { ...ZERO, x: 3.5 * p };
    case "rise":
      return { ...ZERO, y: -4 * p };
    case "sway":
      return { ...ZERO, x: Math.sin(dt * 1.1) * 1.6 };
    case "settle":
      return { ...ZERO, y: wobble(dt, 11, 5) * 3.5, s: 1 + wobble(dt, 11, 5) * 0.03 };
    case "breathe":
      return { ...ZERO, s: 1 + Math.sin(dt * 0.9) * 0.018 };
    default:
      return ZERO;
  }
}

// ---- camera and parallax ----------------------------------------------------

export type Camera = "locked" | "creep-in" | "creep-out" | "pan" | "tilt";
export const CAMERAS: { id: Camera; label: string; note: string }[] = [
  { id: "locked", label: "locked off", note: "No camera at all. Everything that moves is a subject moving." },
  { id: "creep-in", label: "creep in", note: "Four percent of scale across the whole ten seconds. Below the threshold of noticing and above the threshold of feeling; the standard trick for stopping a montage reading as slides." },
  { id: "creep-out", label: "creep out", note: "The same, backwards. Ends wider than it began, which leaves the last frame - the URL frame - the most open." },
  { id: "pan", label: "slow pan", note: "A lateral drift across the clip. Gives parallax something to separate against, and it is the only camera that makes the depth layers legible." },
  { id: "tilt", label: "slow tilt", note: "Vertical instead. Suits the ladder beat and fights the ring, which is round and has no up." },
];

/** The camera's own vector at time t over a clip of `secs`. */
export function cameraVec(c: Camera, t: number, secs: number): Vec {
  const p = clamp01(t / secs);
  switch (c) {
    case "creep-in":
      return { ...ZERO, s: 1 + 0.04 * p };
    case "creep-out":
      return { ...ZERO, s: 1.04 - 0.04 * p };
    case "pan":
      return { ...ZERO, x: -2.6 + 5.2 * p };
    case "tilt":
      return { ...ZERO, y: 2.2 - 4.4 * p };
    default:
      return ZERO;
  }
}

export type Parallax = "off" | "subtle" | "deep" | "extreme";
export const PARALLAXES: { id: Parallax; label: string; note: string; k: number }[] = [
  { id: "off", label: "flat", note: "One plane. Everything moves with the camera or not at all.", k: 0 },
  { id: "subtle", label: "subtle", note: "The field behind lags the subject slightly and the word leads it. Enough that the frame has a front and a back; not enough to be a thing you notice.", k: 1 },
  { id: "deep", label: "deep", note: "Three clearly separated planes. The backdrop becomes a place rather than a texture, which suits the emblem beats and crowds the quiz.", k: 2.2 },
  { id: "extreme", label: "extreme", note: "Past taste, and on the page so the middle settings have something to be a compromise between. Also the only setting where the parallax reads at all on a phone-sized crop.", k: 4 },
];

/**
 * DEPTH PER LAYER. Negative is behind the subject and moves LESS; positive is
 * in front and moves more. The word leads because type in front of a picture is
 * the convention every title sequence uses, and reversing it makes the word
 * look stuck to the backdrop.
 */
export const DEPTH = { backdrop: -1, subject: 0, word: 0.55 } as const;

export function parallaxVec(level: Parallax, depth: number, cam: Vec): Vec {
  const k = PARALLAXES.find((p) => p.id === level)?.k ?? 0;
  if (!k || !depth) return ZERO;
  // Relative to the camera, so a locked-off camera produces no parallax at all.
  // Parallax is not motion of its own; it is the SAME motion at different rates.
  return { ...ZERO, x: cam.x * depth * k, y: cam.y * depth * k };
}

// ---- composing a part -------------------------------------------------------

export type PartSpec = {
  place: Place;
  /** Multiplier on the part's own base size. */
  size: number;
  enter: Move;
  exit: Move;
  motion: Motion;
  /**
   * Per-beat pacing, overriding the flow.
   *
   * The flow sets one entrance length for the whole cut, which is the same
   * mistake as one motion for the whole cut: a quiz has to be READ and wants a
   * slow arrival, and the patch is the loudest event in the film and wants a
   * fast one. A cut whose four beats are paced identically is set to music
   * rather than cut to it.
   */
  inDur?: number;
  outDur?: number;
};

export type PartStyle = {
  style: React.CSSProperties;
  /** True when the part contributes nothing and can be skipped entirely. */
  hidden: boolean;
};

/**
 * One part, at one instant, as one style.
 *
 * `from`/`to` are the part's window; `inDur`/`outDur` come from the flow. The
 * order of accumulation is deliberate: place, then the move, then the motion,
 * then parallax - so the entrance travels to the placed position rather than to
 * the frame centre, and the camera never scales the entrance.
 */
export function partStyle(
  spec: PartSpec,
  t: number,
  from: number,
  to: number,
  inDur: number,
  outDur: number,
  cam: Vec,
  parallax: Parallax,
): PartStyle {
  if (t < from || t >= to) return { style: { opacity: 0 }, hidden: true };
  const din = spec.inDur ?? inDur;
  const dout = spec.outDur ?? outDur;
  const inP = clamp01((t - from) / din);
  const outP = clamp01((t - (to - dout)) / dout);
  const p = clamp01((t - from) / Math.max(0.001, to - from));

  const off = placeOffset(spec.place);
  let v: Vec = { ...ZERO, x: off.x, y: off.y, s: spec.size };
  v = add(v, moveVec(spec.enter, inP, 1));
  if (outP > 0) v = add(v, moveVec(spec.exit, 1 - outP, -1));
  v = add(v, motionVec(spec.motion, p, t - from));
  v = add(v, parallaxVec(parallax, DEPTH.subject, cam));
  v = add(v, { ...ZERO, s: cam.s, x: cam.x, y: cam.y });

  const mask =
    moveMask(spec.enter, inP, true) ?? (outP > 0 ? moveMask(spec.exit, 1 - outP, false) : null);

  return {
    hidden: v.o <= 0.001,
    style: {
      opacity: v.o,
      transform: `translate(${v.x.toFixed(3)}%, ${v.y.toFixed(3)}%) scale(${v.s.toFixed(4)}) rotate(${v.r.toFixed(2)}deg)`,
      ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : null),
    },
  };
}

// ---- presets ----------------------------------------------------------------
//
// A preset is a WHOLE COMPOSITION, not a value applied four times. Judging one
// part at a time is what the bench's `part` axis is for; these are the four
// answers to "what does the cut do".

export type Scheme = Record<PartId, PartSpec>;

/** Argument order is place, size, ENTER, EXIT, motion - the order a part is
 *  read in: where it is, how big, how it gets there, how it goes, what it does
 *  in between. */
const spec = (
  place: Place,
  size: number,
  enter: Move,
  exit: Move,
  motion: Motion,
): PartSpec => ({ place, size, enter, exit, motion });

export const LAYOUTS: { id: string; label: string; note: string; scheme: Scheme }[] = [
  {
    id: "centred",
    label: "centred, equal",
    note: "Every part on the same axis at the same weight. What the cut does today. Reads as a slideshow the moment two beats in a row hold still, which is why it needs a motion preset doing something.",
    scheme: {
      quiz: spec("centre", 1, "fade", "wipe-r", "hold"),
      ring: spec("centre", 1, "fade", "fade", "hold"),
      ladder: spec("centre", 1, "fade", "fade", "hold"),
      patch: spec("centre", 1, "fade", "fade", "hold"),
    },
  },
  {
    id: "weighted",
    label: "weighted by density",
    note: "Sized by how much there is to look at rather than uniformly: the question is wide and gets room, the ring is a disc and holds the middle, the wheel is tall and sits back, the patch is one dense object and comes forward biggest. The composition argues about importance.",
    scheme: {
      quiz: spec("centre", 1.02, "push-r", "wipe-r", "push-in"),
      ring: spec("centre", 1.06, "grow", "shrink", "push-in"),
      ladder: spec("centre", 0.92, "push-u", "push-u", "rise"),
      patch: spec("centre", 1.18, "grow", "fade", "breathe"),
    },
  },
  {
    id: "travel",
    label: "travelling",
    note: "Each part sits somewhere different and enters from the edge nearest it, so the eye crosses the frame four times in ten seconds. The most kinetic and the most likely to fight the corner words, which are already using those edges.",
    scheme: {
      quiz: spec("left", 0.96, "push-r", "push-l", "drift-r"),
      ring: spec("right", 1.02, "push-l", "push-r", "drift-l"),
      ladder: spec("left", 0.94, "push-r", "push-l", "rise"),
      patch: spec("right", 1.12, "grow", "shrink", "settle"),
    },
  },
  {
    id: "vertical",
    label: "vertical stack",
    note: "High, low, high, low. Uses the axis the corner words are NOT using on any given beat, so the word and the picture never occupy the same corner. Quietest of the four and the one that survives the tightest crop.",
    scheme: {
      quiz: spec("low", 0.96, "push-u", "push-u", "hold"),
      ring: spec("high", 1.04, "push-d", "push-d", "rise"),
      ladder: spec("low", 0.94, "push-u", "push-u", "hold"),
      patch: spec("high", 1.14, "iris", "fade", "settle"),
    },
  },
];

export const layoutById = (id: string) =>
  LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

/** Overriding one part without abandoning a whole layout. The bench's `part`
 *  axis writes these; everything else leaves them empty. */
export function applyOverride(s: Scheme, part: PartId, over: Partial<PartSpec>): Scheme {
  return { ...s, [part]: { ...s[part], ...over } };
}

