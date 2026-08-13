// The motion system for the quiet cut. DEV/EXPORT ONLY.
//
// THIS FILE HAS A TWIN, AND NOTHING KEEPS THEM IN STEP.
//
// `Otd-llc/otd-promo` carries the same system as `core/motion/*.mjs` - moves,
// motions, camera, fit, compose, frame - ported there so future films can use
// it without the academy. This copy did NOT go away, because the four scenes
// beside it render real product components (QuizBlock, StandingRail,
// RankWing, PatchBadge) and cannot move to a repo that has no Next app. So the
// academy renders the film with THIS, and the promo repo drives the page over
// HTTP.
//
// They agree today - the port was accepted on 16 sampled frames coming back
// byte-identical across four aspects - and nothing enforces that they keep
// agreeing. There is no build step, no test and no gate spanning the two
// repositories. A change made HERE is invisible over there, and a change made
// THERE is invisible here until a future film renders differently for reasons
// nobody can find.
//
// KNOWN AND ACCEPTED, deliberately, not overlooked (owner, 2026-08-13). The
// real fix is for the academy to consume otd-promo as a package, which needs a
// private-registry or workspace link that does not exist yet. Until then: if
// you change this file, change `core/motion/` too, and re-run the frame-hash
// check - it is the only thing that would catch the drift.
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
  | "breathe"
  | "ken-in-l"
  | "ken-in-r"
  | "ken-out-l"
  | "ken-out-r";

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
  // KEN BURNS. Zoom and pan together and in the same direction for the whole
  // shot, which is the entire trick: either alone reads as an effect, and the
  // two combined read as a camera. Four of them because the DIRECTION is the
  // choice - a push that drifts left and a push that drifts right feel like
  // different shots, and a pull-back ends wider than it began, which is what
  // you want on the beat that hands over to something bigger.
  { id: "ken-in-l", label: "Ken Burns, in left", note: "Pushes in and drifts left across the whole beat. On the quiz this is the difference between a screenshot and a shot." },
  { id: "ken-in-r", label: "Ken Burns, in right", note: "The same push drifting the other way, which matters when the next subject arrives from the right." },
  { id: "ken-out-l", label: "Ken Burns, out left", note: "Starts tight and opens up. Ends wider than it began, so the frame is at its most open exactly when it hands over." },
  { id: "ken-out-r", label: "Ken Burns, out right", note: "Opening while drifting right. The calmest of the four and the only one that gives ground to whatever comes next." },
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
    // Zoom AND pan, same direction, whole shot. 10% over the beat is the usual
    // documentary figure; the 2.4% lateral is small on purpose, because a pan
    // that outruns its zoom stops reading as a camera and starts reading as a
    // slide.
    case "ken-in-l":
      return { ...ZERO, s: 1 + 0.1 * p, x: -2.4 * p, y: -1.2 * p };
    case "ken-in-r":
      return { ...ZERO, s: 1 + 0.1 * p, x: 2.4 * p, y: -1.2 * p };
    case "ken-out-l":
      return { ...ZERO, s: 1.1 - 0.1 * p, x: -2.4 * p, y: 1 * p };
    case "ken-out-r":
      return { ...ZERO, s: 1.1 - 0.1 * p, x: 2.4 * p, y: 1 * p };
    default:
      return ZERO;
  }
}

// ---- fitting a part to the frame it is in -----------------------------------
//
// THE OLD WAY WAS ONE SCALE FOR EVERYTHING: `(w / 880) * 0.8`, which is correct
// only at the width it was tuned at and treats four differently-shaped subjects
// as though they were one. The wheel suffered worst - it is the only part built
// out of TEXT ROWS, so it is the first to stop being legible, and it was being
// shrunk by the same factor as a 210px badge that reads fine at any size.
//
// Each part now declares what it actually is and how much of the frame it may
// have, and the scale is derived. Widening a stage or changing the word's
// position re-fits everything instead of needing the numbers re-tuned.

/** Natural pixel size of each part at scale 1, measured off the rendered DOM. */
export const INTRINSIC: Record<PartId, { w: number; h: number }> = {
  quiz: { w: 560, h: 330 },
  ring: { w: 190, h: 205 },
  // 450, not 430. Re-measured off the rendered DOM 2026-08-12: the widest row
  // is the marker, the wing at its focused scale and a 300px no-wrap title, and
  // it comes to 450. The 20px shortfall never showed on 16:9 because the HEIGHT
  // term always wins there - 0.9/370 beats 0.68/430 at every width when h is
  // 9/16 of w - so the width figure was load-bearing nowhere and simply wrong.
  // Under aspect-adapted fill it becomes the binding constraint and the row
  // overflowed the frame on 1:1 and 4:5.
  // 480, and this one is READ OFF `offsetWidth`, which is layout and therefore
  // immune to the ancestor transform - the only measurement of the three that
  // could not be fooled. The history is worth keeping because each wrong value
  // was wrong in a different way: 430 was a guess, 450 came from a bounding
  // rect that had the text overflow baked into it, and 410 was arithmetic over
  // the box model that simply under-counted. The rows lay out at 452, and the
  // FL10 row - the longest title - at 480. The part must be fitted to its
  // WIDEST row or that row leaves the frame, which is exactly what 9:16 showed.
  ladder: { w: 480, h: 370 },
  patch: { w: 210, h: 250 },
};

/**
 * The share of the frame each part may occupy.
 *
 * The wheel gets the most and the patch the least, which is the opposite of
 * their bed weights and is correct: the patch is one dense shape that reads at
 * any size, and the wheel is five rows of 10px mono that does not. Legibility
 * and emphasis are different axes, and sizing by emphasis alone is what made
 * the wheel unreadable.
 */
export const FILL: Record<PartId, { w: number; h: number }> = {
  // 0.56 tall, not 0.66. The quiz is the only part wide AND tall enough to
  // reach a corner, and at 0.66 it ran under the word: READ sat on top of the
  // "Quick check" eyebrow. Losing a tenth of the height clears the corner
  // bands, and the quiz is the part that can most afford it - it is already the
  // biggest thing in the film.
  quiz: { w: 0.66, h: 0.56 },
  ring: { w: 0.46, h: 0.62 },
  ladder: { w: 0.68, h: 0.9 },
  patch: { w: 0.38, h: 0.56 },
};

/**
 * FILL, ADAPTED TO THE FRAME'S SHAPE.
 *
 * The shares above were judged on 16:9, where the word sits in a corner and
 * therefore costs the subject WIDTH. Rotate the frame and that stops being
 * true: on 9:16 the word bands are at the top and the bottom, the sides are
 * free, and the subject should have nearly the whole width.
 *
 * Leaving them fixed is not a small error, because `fitScale` takes the MINIMUM
 * of the two constraints and on a narrow frame the width term wins by a mile: a
 * 9:16 panel 204px wide fits the ring at scale 0.49 with the vertical space
 * completely empty - a 16:9-sized subject marooned in the middle of a portrait
 * picture. That is exactly what the first format preview showed.
 */
/**
 * What a part measures once a narrow frame has taken its wide furniture off.
 *
 * The wheel drops its rank titles in portrait, which takes the row from 480px
 * to about 140. Sizing it against 480 afterwards is the same class of error as
 * the wrong intrinsic - it fits a part that is no longer there, and the wheel
 * comes out around a third smaller than the frame could carry.
 */
export const INTRINSIC_COMPACT: Partial<Record<PartId, { w: number; h: number }>> = {
  ladder: { w: 140, h: 370 },
  // The quiz reflows to 380 in a narrow frame rather than being a 560 box
  // scaled down, so it is fitted against 380 - and against a TALLER height,
  // because prose set to a narrower measure runs longer. Fitting reflowed text
  // against its wide-frame height is how you get a column that overflows the
  // bottom instead of the right.
  // 290 x 281, measured. The table this came from, for the 9:16 safe box of
  // 177 x 261 - measure, reflowed box, resulting type size, and how the longest
  // option wraps:
  //
  //     236   236x320   69% of base   option wraps to THREE lines
  //     260   260x281   64%           two
  //     290   290x281   58%           two
  //     320   320x273   52%           two
  //
  // 236 was cramped for one specific reason: the longest option needed three
  // lines. It drops to two at 260 and stays there. Past 260 the rendered box
  // always fills 94% of the width and the only thing that changes is the type
  // size, so the measure is really a type-size dial once the wrapping is fixed.
  quiz: { w: 290, h: 281 },
};

export function fillFor(id: PartId, aspect: number): { w: number; h: number } {
  const f = FILL[id];
  if (aspect >= 1.2) return f;
  // Square is partway to portrait; below 0.8 take the full adaptation.
  const k = aspect >= 0.8 ? (1.2 - aspect) / 0.4 : 1;
  // THE QUIZ GOES THE OTHER WAY ON HEIGHT, and getting this backwards is what
  // kept it tiny. Every other part is a fixed shape competing with word bands
  // that move to the top and bottom in portrait, so they give height back. The
  // quiz is REFLOWING PROSE: narrow it and it runs longer, so a portrait frame
  // is exactly where it needs MORE height, not less. Measured at 9:16 it
  // reflows to 177x463 inside a 261-tall safe box - height was binding by
  // almost 2x, and trimming its allowance made that worse.
  if (id === "quiz") {
    // 0.73 FLAT, not interpolated toward a taller share. In a narrow frame the
    // scene reserves the top ~19% for the word (QUIZ_WORD_BAND), so the quiz's
    // height allowance has to be about 0.9 of what is LEFT - 0.9 x 0.775 - and
    // that product does not depend on how narrow the frame is. Interpolating it
    // made the squarer shapes the tightest, which is backwards: 1:1 has the
    // most height to spare, not the least.
    return { w: f.w + (0.94 - f.w) * k, h: 0.7 };
  }
  return {
    // Toward the whole width, because the sides are no longer spoken for.
    w: f.w + (0.94 - f.w) * k,
    // And give a little height back, because the word is now above and below.
    h: f.h * (1 - 0.16 * k),
  };
}

/**
 * @param adapt reshape the fill for the frame's aspect. OFF by default, so
 *   every existing caller renders exactly what it rendered before - the
 *   extraction's acceptance test is pixel-identical screenshots, and changing
 *   the default here would fail it for the wrong reason.
 */
export function fitScale(
  id: PartId,
  frameW: number,
  frameH: number,
  adapt = false,
  compact = false,
): number {
  const i = (compact && INTRINSIC_COMPACT[id]) || INTRINSIC[id];
  const f = adapt ? fillFor(id, frameW / frameH) : FILL[id];
  return Math.min((frameW * f.w) / i.w, (frameH * f.h) / i.h);
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

