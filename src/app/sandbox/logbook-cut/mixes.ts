// SANDBOX - thirty cuts. DEV ONLY.
//
// ONE LIST, NO TABS, NO AXES. Scroll and pick.
//
// WHAT WAS WRONG WITH EVERY ROUND BEFORE THIS ONE: each cut applied one idea to
// all four beats, and the rounds themselves varied one thing at a time. That is
// a filter and a spreadsheet, not thirty films. These use the whole toolbox at
// once - ten moves, thirteen motions, eleven word entrances, seven word exits,
// five cameras, four parallax depths, three flows, and per-beat pacing - and
// they differ in HOW MANY of each they spend as much as in which.
//
// FIXED ACROSS ALL THIRTY, because they are settled:
//   * the patch flip is `plate`, picked in the flip round
//   * the picture runs 0.1s (three frames) ahead of the bed
//   * every part is FIT to the frame rather than hand-scaled, so `size` below
//     is an emphasis multiplier on top of a fit, not a pixel guess
//
// THE READ AREA IS ON THE GRID NOW. The click is at 1.0 or 1.5 - beat three or
// beat four of bar one - and the XP tick clears before the bar line so the
// downbeat belongs to the word. It used to pop on the click and hold to 2.6,
// which meant its float was still running while READ landed, and the two events
// smeared into each other. That was the disjointedness.
//
// THE THREE HANDOVERS ARE THE REAL SUBJECT. read->gain, gain->rank and
// rank->patch are three separate edits and there is no reason they should be
// the same edit. A cut where the quiz wipes off and the ring grows in, and then
// the ring lifts and the wheel drops, has three distinct joins; a cut where
// everything crossfades has none. Each row below states its three.
//
// ASCII only.

import { DEFAULT_TUNING, type Tuning } from "./tuning";
import { PARTS, type Motion, type Move, type Place, type PartSpec, type Scheme } from "./motion";
import type { Kinetic, KineticOut, WordPos } from "./tuning";
import type { Candidate } from "./candidates";

/** [place, size, enter, exit, motion, inDur?, outDur?] */
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

const SLIDES: Move[] = ["push-l", "push-r", "push-u", "push-d"];

/** The recipe is COUNTED off the scheme, not typed alongside it. A label that
 *  is asserted drifts from the thing it labels the first time a value changes;
 *  one that is derived cannot. */
function recipe(s: Scheme, tn: Tuning): string {
  const moves = PARTS.flatMap((p) => [s[p].enter, s[p].exit]);
  const n = (f: (m: Move) => boolean) => moves.filter(f).length;
  const kens = PARTS.filter((p) => s[p].motion.startsWith("ken-")).length;
  const bits = [
    n((m) => SLIDES.includes(m)) ? `${n((m) => SLIDES.includes(m))} slide` : null,
    n((m) => m === "fade") ? `${n((m) => m === "fade")} fade` : null,
    n((m) => m === "wipe-r") ? `${n((m) => m === "wipe-r")} wipe` : null,
    n((m) => m === "iris") ? `${n((m) => m === "iris")} iris` : null,
    n((m) => m === "grow" || m === "shrink") ? `${n((m) => m === "grow" || m === "shrink")} scale` : null,
    n((m) => m === "swing") ? `${n((m) => m === "swing")} swing` : null,
    kens ? `${kens} ken burns` : null,
    tn.camera !== "locked" ? tn.camera : null,
    tn.parallax !== "off" ? `plx ${tn.parallax}` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

/** The three joins, named, because they are three separate edits. */
function joins(s: Scheme): string {
  const j = (a: (typeof PARTS)[number], b: (typeof PARTS)[number]) =>
    `${s[a].exit}->${s[b].enter}`;
  return `${j("quiz", "ring")}  ${j("ring", "ladder")}  ${j("ladder", "patch")}`;
}

let n = 0;
const cut = (
  name: string,
  thesis: string,
  rows: [Row, Row, Row, Row],
  tn: Partial<Tuning> & { words: Kinetic[]; out: KineticOut },
): Candidate => {
  n += 1;
  const scheme: Scheme = {
    quiz: row(rows[0]),
    ring: row(rows[1]),
    ladder: row(rows[2]),
    patch: row(rows[3]),
  };
  const { words, out, ...rest } = tn;
  const tuning: Tuning = {
    ...DEFAULT_TUNING,
    preRoll: 0.1,
    jaunty: "plate",
    motionAll: "auto",
    quizClick: 1.5,
    kinetic: words[0],
    kineticPerBeat: words,
    kineticOut: out,
    scheme,
    ...rest,
  };
  return {
    id: `c${String(n).padStart(2, "0")}`,
    name: `${String(n).padStart(2, "0")} / ${name}`,
    thesis,
    note: `${recipe(scheme, tuning)}    |    ${joins(scheme)}`,
    tuning,
  };
};

const P = (pos: WordPos) => ({ pos });

export const MIXES: Candidate[] = [
  cut(
    "Still water",
    "No slides at all. Four fades, one slow push on the quiz.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.4],
      ["centre", 1, "fade", "fade", "hold"],
      ["centre", 1, "fade", "fade", "hold", 0.2],
      ["centre", 1.1, "fade", "fade", "breathe", 0.3],
    ],
    { words: ["mask", "rise", "flap", "release"], out: "fade", flow: "even" },
  ),
  cut(
    "One slide",
    "The film's only lateral move is the quiz leaving.",
    [
      ["centre", 1, "fade", "push-l", "ken-in-r", 0.38, 0.34],
      ["centre", 1, "grow", "fade", "hold"],
      ["centre", 1, "fade", "fade", "hold", 0.18],
      ["centre", 1.12, "fade", "fade", "settle", 0.28],
    ],
    { words: ["wipe", "release", "flap", "stretch"], out: "fade", flow: "even" },
  ),
  cut(
    "Two slides",
    "The quiz leaves left and the wheel arrives from below.",
    [
      ["centre", 1, "fade", "push-l", "ken-in-l", 0.36, 0.3],
      ["centre", 1.02, "grow", "fade", "push-in"],
      ["centre", 1, "push-u", "fade", "hold", 0.16],
      ["centre", 1.12, "grow", "fade", "settle", 0.28],
    ],
    { words: ["mask", "release", "flap", "drop"], out: "fade", flow: "snappy" },
  ),
  cut(
    "Three slides",
    "Every join but the last one travels.",
    [
      ["centre", 1, "fade", "push-l", "ken-in-r", 0.34, 0.28],
      ["centre", 1.02, "push-r", "push-u", "hold"],
      ["centre", 1, "push-u", "fade", "rise", 0.16],
      ["centre", 1.14, "grow", "fade", "settle", 0.26],
    ],
    { words: ["snap", "mask", "flap", "release"], out: "sink", flow: "snappy" },
  ),
  cut(
    "All slide",
    "Eight slides. On the page to lose the argument visibly.",
    [
      ["centre", 1, "push-r", "push-l", "drift-l", 0.3, 0.26],
      ["centre", 1.02, "push-r", "push-u", "drift-r"],
      ["centre", 1, "push-d", "push-d", "hold", 0.14],
      ["centre", 1.12, "push-u", "push-l", "settle", 0.24],
    ],
    { words: ["snap", "snap", "flap", "drop"], out: "sink", flow: "snappy", camera: "pan" },
  ),
  cut(
    "Fade and slide",
    "Half the joins dissolve, half of them move.",
    [
      ["centre", 1, "fade", "push-l", "ken-in-l", 0.4, 0.3],
      ["centre", 1.04, "push-r", "fade", "hold"],
      ["centre", 1, "fade", "push-u", "hold", 0.18],
      ["centre", 1.12, "push-d", "fade", "settle", 0.26],
    ],
    { words: ["mask", "rise", "flap", "release"], out: "fade", flow: "even" },
  ),
  cut(
    "Wipe language",
    "The plating is a wipe, so everything else is too.",
    [
      ["centre", 1, "wipe-r", "wipe-r", "ken-in-r", 0.42, 0.32],
      ["centre", 1.02, "wipe-r", "wipe-r", "hold"],
      ["centre", 1, "wipe-r", "wipe-r", "hold", 0.2],
      ["centre", 1.12, "wipe-r", "fade", "breathe", 0.3],
    ],
    { words: ["wipe", "wipe", "wipe", "wipe"], out: "wipe", flow: "even" },
  ),
  cut(
    "Iris",
    "Everything grows out of the centre of what preceded it.",
    [
      ["centre", 1, "fade", "iris", "ken-out-l", 0.38, 0.3],
      ["centre", 1.02, "iris", "iris", "hold"],
      ["centre", 1, "iris", "iris", "hold", 0.2],
      ["centre", 1.14, "iris", "fade", "settle", 0.3],
    ],
    { words: ["release", "release", "flap", "release"], out: "fade", flow: "even" },
  ),
  cut(
    "Scale only",
    "Nothing translates. Depth is the only axis.",
    [
      ["centre", 1, "grow", "shrink", "ken-in-l", 0.4, 0.3],
      ["centre", 1.04, "grow", "shrink", "push-in"],
      ["centre", 0.98, "grow", "shrink", "hold", 0.2],
      ["centre", 1.16, "grow", "fade", "settle", 0.28],
    ],
    { words: ["stretch", "release", "flap", "stretch"], out: "fade", camera: "creep-in" },
  ),
  cut(
    "Ken Burns throughout",
    "Every beat is a camera move. No two go the same way.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.4],
      ["centre", 1.02, "fade", "fade", "ken-out-r"],
      ["centre", 1, "fade", "fade", "ken-in-r", 0.2],
      ["centre", 1.12, "fade", "fade", "ken-out-l", 0.3],
    ],
    { words: ["mask", "mask", "flap", "release"], out: "fade", flow: "breath" },
  ),
  cut(
    "Ken Burns once",
    "One camera move, on the only beat that is a photograph.",
    [
      ["centre", 1, "fade", "wipe-r", "ken-in-l", 0.42, 0.32],
      ["centre", 1.02, "grow", "fade", "hold"],
      ["centre", 1, "push-u", "fade", "hold", 0.16],
      ["centre", 1.12, "grow", "fade", "hold", 0.26],
    ],
    { words: ["mask", "release", "flap", "drop"], out: "fade", flow: "snappy" },
  ),
  cut(
    "Weight",
    "The bed's 0.55 / 0.78 / 0.70 / 1.00 in size and in energy.",
    [
      ["centre", 0.92, "fade", "fade", "ken-in-r", 0.44],
      ["centre", 1.04, "grow", "fade", "push-in"],
      ["centre", 0.88, "push-d", "fade", "hold", 0.15, 0.12],
      ["centre", 1.22, "grow", "fade", "settle", 0.26],
    ],
    { words: ["rise", "release", "flap", "stretch"], out: "fade", flow: "snappy" },
  ),
  cut(
    "Climb, twice",
    "Only the two things that mean climbing actually climb.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.38],
      ["low", 1.02, "push-u", "push-u", "rise"],
      ["high", 1, "push-u", "fade", "rise", 0.2],
      ["centre", 1.14, "iris", "fade", "settle"],
    ],
    { words: ["mask", "mask", "flap", "release"], out: "lift", camera: "tilt" },
  ),
  cut(
    "Rest, hit, rest, hit",
    "Alternate. Motion means nothing unless something is still.",
    [
      ["centre", 1, "fade", "fade", "hold", 0.3],
      ["centre", 1.04, "grow", "shrink", "push-in"],
      ["centre", 0.96, "fade", "fade", "hold", 0.14],
      ["centre", 1.16, "push-d", "fade", "settle", 0.3],
    ],
    { words: ["strike", "release", "wipe", "drop"], out: "none", flow: "snappy" },
  ),
  cut(
    "Two languages",
    "Product half soft, insignia half mechanical.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.4],
      ["centre", 1.02, "grow", "fade", "breathe"],
      ["centre", 1, "push-u", "push-u", "hold", 0.14],
      ["centre", 1.14, "iris", "fade", "hold", 0.28],
    ],
    { words: ["blur", "blur", "flap", "flap"], out: "fade" },
  ),
  cut(
    "Setup and payoff",
    "Three beats underplayed to buy the fourth.",
    [
      ["centre", 0.88, "fade", "fade", "ken-in-r", 0.28],
      ["centre", 0.92, "fade", "fade", "hold", 0.24],
      ["centre", 0.86, "fade", "fade", "hold", 0.18],
      ["centre", 1.3, "grow", "fade", "settle", 0.36],
    ],
    { words: ["wipe", "wipe", "wipe", "drop"], out: "none", flow: "snappy" },
  ),
  cut(
    "Zigzag",
    "Four places, four entrances, and the eye traces a Z.",
    [
      ["low", 1, "push-u", "push-d", "drift-r", 0.36],
      ["high", 1.02, "push-d", "push-u", "hold"],
      ["low", 1, "push-u", "fade", "rise", 0.16],
      ["centre", 1.14, "grow", "fade", "settle", 0.3],
    ],
    { words: ["snap", "mask", "flap", "release"], out: "sink", camera: "pan", parallax: "subtle" },
  ),
  cut(
    "Pace",
    "Same verbs, four tempos. Pacing over choreography.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.45, 0.3],
      ["centre", 1.02, "grow", "fade", "push-in", 0.3],
      ["centre", 1, "grow", "fade", "hold", 0.12, 0.1],
      ["centre", 1.14, "grow", "fade", "hold", 0.2],
    ],
    { words: ["mask", "release", "flap", "drop"], out: "fade" },
  ),
  cut(
    "Rhyme, then break it",
    "Three circles on an iris, then a pentagon that arrives differently.",
    [
      ["centre", 1, "wipe-r", "wipe-r", "ken-out-r", 0.4],
      ["centre", 1.02, "iris", "fade", "hold"],
      ["centre", 1, "iris", "fade", "hold", 0.18],
      ["centre", 1.16, "fade", "fade", "breathe", 0.2],
    ],
    { words: ["wipe", "release", "release", "stretch"], out: "fade" },
  ),
  cut(
    "Handoff",
    "Each beat enters from wherever the last one left.",
    [
      ["centre", 1, "fade", "wipe-r", "ken-in-r", 0.4],
      ["centre", 1.02, "push-r", "push-u", "hold"],
      ["centre", 1, "push-u", "push-d", "hold", 0.16],
      ["centre", 1.14, "grow", "fade", "settle", 0.34],
    ],
    { words: ["mask", "rise", "flap", "release"], out: "fade" },
  ),
  cut(
    "Deep",
    "Three planes and a slow push. Nothing else has to move.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.42],
      ["centre", 1.02, "grow", "fade", "breathe"],
      ["centre", 1, "fade", "fade", "breathe", 0.2],
      ["centre", 1.14, "grow", "fade", "breathe", 0.3],
    ],
    { words: ["blur", "blur", "blur", "release"], out: "blur", flow: "breath", camera: "creep-in", parallax: "deep" },
  ),
  cut(
    "Wide open",
    "Every beat pulls back, so the last frame is the most open.",
    [
      ["centre", 1, "grow", "fade", "ken-out-l", 0.4],
      ["centre", 1.02, "grow", "fade", "ken-out-r"],
      ["centre", 1, "grow", "fade", "pull-back", 0.2],
      ["centre", 1.12, "grow", "fade", "ken-out-l", 0.3],
    ],
    { words: ["release", "release", "flap", "release"], out: "fade", camera: "creep-out" },
  ),
  cut(
    "Feed",
    "Sound off, thumb moving, probably cropped square.",
    [
      ["centre", 1.02, "fade", "fade", "ken-in-l", 0.3],
      ["centre", 1.06, "grow", "fade", "push-in"],
      ["centre", 1.02, "grow", "fade", "hold", 0.14],
      ["centre", 1.2, "grow", "fade", "push-in", 0.24],
    ],
    { words: ["stretch", "stretch", "stretch", "stretch"], out: "none", flow: "snappy", ...P("centre-low") },
  ),
  cut(
    "Departure board",
    "One mechanism, four times: everything flips.",
    [
      ["centre", 1, "fade", "push-u", "ken-in-r", 0.36],
      ["centre", 1.02, "push-d", "push-u", "hold"],
      ["centre", 1, "push-d", "push-u", "hold", 0.16],
      ["centre", 1.14, "push-d", "fade", "hold", 0.26],
    ],
    { words: ["flap", "flap", "flap", "flap"], out: "sink" },
  ),
  cut(
    "Swing",
    "Things arrive on a hinge rather than on a rail.",
    [
      ["centre", 1, "fade", "swing", "ken-in-l", 0.4, 0.32],
      ["centre", 1.02, "swing", "fade", "hold"],
      ["centre", 1, "swing", "swing", "hold", 0.2],
      ["centre", 1.14, "swing", "fade", "settle", 0.3],
    ],
    { words: ["drop", "release", "flap", "drop"], out: "fade", flow: "even" },
  ),
  cut(
    "Early call",
    "The answer lands two beats before the word instead of one.",
    [
      ["centre", 1, "fade", "wipe-r", "ken-in-l", 0.4, 0.3],
      ["centre", 1.02, "grow", "fade", "hold"],
      ["centre", 1, "push-u", "fade", "hold", 0.16],
      ["centre", 1.14, "grow", "fade", "settle", 0.28],
    ],
    { words: ["mask", "release", "flap", "release"], out: "fade", quizClick: 1.0 },
  ),
  cut(
    "Long read",
    "The quiz gets the slowest arrival in the film, because it is text.",
    [
      ["centre", 1, "fade", "fade", "ken-in-r", 0.6, 0.34],
      ["centre", 1.02, "grow", "fade", "hold", 0.26],
      ["centre", 1, "grow", "fade", "hold", 0.14],
      ["centre", 1.14, "grow", "fade", "settle", 0.22],
    ],
    { words: ["track", "release", "flap", "drop"], out: "collapse", flow: "breath" },
  ),
  cut(
    "Corner to corner",
    "The word crosses the frame, the pictures stay put.",
    [
      ["centre", 1, "fade", "fade", "ken-in-l", 0.4],
      ["centre", 1.02, "grow", "fade", "hold"],
      ["centre", 1, "grow", "fade", "hold", 0.18],
      ["centre", 1.14, "grow", "fade", "settle", 0.28],
    ],
    { words: ["snap", "mask", "flap", "drop"], out: "lift", ...P("corners"), parallax: "subtle", camera: "pan" },
  ),
  cut(
    "Drift",
    "Everything is slowly going somewhere, nothing arrives hard.",
    [
      ["centre", 1, "fade", "fade", "drift-l", 0.42],
      ["centre", 1.02, "fade", "fade", "drift-r"],
      ["centre", 1, "fade", "fade", "sway", 0.2],
      ["centre", 1.12, "fade", "fade", "drift-l", 0.3],
    ],
    { words: ["blur", "rise", "flap", "release"], out: "blur", flow: "breath", parallax: "subtle", camera: "pan" },
  ),
  cut(
    "Everything",
    "One of each. The maximalist control.",
    [
      ["low", 1, "wipe-r", "push-l", "ken-in-l", 0.36, 0.28],
      ["high", 1.04, "iris", "shrink", "push-in"],
      ["centre", 1, "push-u", "swing", "rise", 0.16],
      ["centre", 1.18, "grow", "fade", "settle", 0.3],
    ],
    {
      words: ["wipe", "release", "flap", "drop"],
      out: "sink",
      flow: "snappy",
      camera: "tilt",
      parallax: "deep",
    },
  ),
];

export const mixById = (id?: string) => MIXES.find((m) => m.id === id) ?? null;
