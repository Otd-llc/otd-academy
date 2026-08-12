// SANDBOX - the cut assembled from the picks, and the one join still open.
// DEV ONLY.
//
// PICKED, 2026-08-12, out of the thirty:
//
//   the long read        27  the quiz gets a 0.6s arrival, the slowest in the
//                            film, because it is the only part that has to be
//                            READ rather than looked at. Breath flow, and the
//                            word tracks in over it.
//   learn -> gain        02  the quiz leaves LEFT and the ring GROWS in. The
//                            film's one lateral move, spent on its one real
//                            scene change: a page handing over to an emblem.
//   gain -> rank         08  the ring IRISES out and the wheel IRISES in, so
//                            the wheel appears to come out of the middle of the
//                            ring it replaces. The only join that is a match
//                            rather than a cut.
//   rank -> patches      14  the wheel FADES and the patch PUSHES DOWN into
//                            place. The wheel is the bed's dip; the patch is
//                            its heaviest landing, and dropping in is the only
//                            arrival in the film with weight behind it.
//
// STILL OPEN: patches -> learn, the LOOP SEAM. It is a real edit and nobody has
// ever seen it, because the patch's window used to run to the last frame and
// the quiz's began on the first - so the clip cut hard from a gold badge to a
// question with nothing in between, once every ten seconds, forever. In a feed
// that seam is the most-watched frame in the film.
//
// Five ways to close it below. All of them give the patch a real exit inside
// the clip rather than at its edge.
//
// ASCII only.

import { DEFAULT_TUNING, type Tuning } from "./tuning";
import type { Motion, Move, PartSpec, Place, Scheme } from "./motion";
import type { Candidate } from "./candidates";

type Row = [Place, number, Move, Move, Motion, number?, number?];
const row = (r: Row): PartSpec => ({
  place: r[0],
  size: r[1],
  enter: r[2],
  exit: r[3],
  motion: r[4],
  ...(r[5] !== undefined ? { inDur: r[5] } : null),
  ...(r[6] !== undefined ? { outDur: r[6] } : null),
});

/** The three settled joins. Only the quiz's ENTER and the patch's EXIT - the
 *  two halves of the loop seam - are left for the variants to fill in. */
function assembled(quizEnter: Move, patchExit: Move, seamDur: number): Scheme {
  return {
    // 27's long arrival, 02's exit.
    quiz: row(["centre", 1, quizEnter, "push-l", "ken-in-r", seamDur, 0.34]),
    // 02's entrance, 08's exit.
    ring: row(["centre", 1.02, "grow", "iris", "hold"]),
    // 08's entrance, 14's exit.
    ladder: row(["centre", 1, "iris", "fade", "hold", 0.18]),
    // 14's entrance, and the seam.
    patch: row(["centre", 1.16, "push-d", patchExit, "settle", 0.3, seamDur]),
  };
}

const make = (
  id: string,
  name: string,
  thesis: string,
  note: string,
  quizEnter: Move,
  patchExit: Move,
  seamDur = 0.34,
): Candidate => ({
  id,
  name,
  thesis,
  note,
  tuning: {
    ...DEFAULT_TUNING,
    preRoll: 0.1,
    jaunty: "plate",
    motionAll: "auto",
    quizClick: 1.5,
    flow: "breath",
    // 27's type: the word tracks in over the long read and closes as it leaves.
    kinetic: "track",
    kineticPerBeat: ["track", "release", "flap", "drop"],
    kineticOut: "collapse",
    scheme: assembled(quizEnter, patchExit, seamDur),
  } satisfies Tuning,
});

export const ASSEMBLY: Candidate[] = [
  make(
    "seam-swing",
    "A / swing both ways",
    "The patch swings out and the question swings in. One hinge, twice.",
    "The literal reading: both halves of the seam are the same gesture, so the loop reads as one object turning over rather than as two shots meeting. The risk is that a hinge is a strong move to spend on a moment nobody is supposed to notice - and at a tenth of the clip it is on screen every ten seconds.",
    "swing",
    "swing",
  ),
  make(
    "seam-swing-out",
    "B / swing out, arrive quiet",
    "The badge swings away. The question is simply there.",
    "Asymmetric on purpose. The swing belongs to the thing LEAVING, which is the thing the viewer has been looking at for two seconds, and the question gets no entrance at all because bar one already has an entrance - the type. Least busy of the five at the moment the loop restarts.",
    "fade",
    "swing",
  ),
  make(
    "seam-swing-in",
    "C / leave quiet, swing in",
    "The badge fades. The question swings on.",
    "The reverse bet: the payoff frame is allowed to hold and dissolve, and the energy goes into the arrival instead. Reads as the film starting again rather than as the film ending, which on a loop is the more useful of the two readings.",
    "swing",
    "fade",
  ),
  make(
    "seam-slow",
    "D / a slower hinge",
    "The same swing, given half again as long.",
    "Identical to A except the seam runs 0.5s instead of 0.34. Worth looking at because a swing is a rotation, and rotation reads slow - at 0.34s the badge appears to snap rather than to turn, which is the difference between a hinge and a glitch.",
    "swing",
    "swing",
    0.5,
  ),
  make(
    "seam-drop",
    "E / swing out, drop in",
    "The badge swings away and the question falls into its place.",
    "Rhymes the seam with the join before it: the patch arrived by pushing DOWN, so the quiz arriving the same way makes the loop point echo the beat that preceded it. The most continuous of the five and the one that most hides the fact that a loop happened.",
    "push-d",
    "swing",
  ),
];
