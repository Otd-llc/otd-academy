// The parts that need SUPPORT, a BRIM, or both, and which of the two each one
// needs. They are separate questions: a brim answers "will it stick to the bed"
// and is decided by the first layer; support answers "is anything printing into
// thin air" and is decided by every layer above it. No part here needs both for
// the same reason, and bundling them put a pointless brim on a corner with
// 417 sq mm of bed contact.
//
// ONE LIST, because as of the plated-download work this set no longer decides
// only prose -- it decides the SHAPE of the response. A build that fits one plate
// ships as a bare `.3mf` with no README, which is the commonest download there
// is; a build carrying one of these ships inside an archive instead, so the
// warning has somewhere to live. See the design's section 5.
//
// It used to exist twice: once here as slugs (what a request and a `Placement`
// carry) and once inside `orientationNote` in `scripts/upload-printables.ts` as
// published names (what the manifest carries), each with a comment asking the
// other to be kept in sync. That was survivable while both only wrote sentences.
// It stopped being survivable when one of them started choosing whether a README
// exists at all: a re-cut that added a third line-resting part would update the
// uploader, which sits beside the manifest and is the obvious place to look, and
// miss this one -- and the failure would be a bare file, silently missing the one
// sentence standing between someone and a failed print.
//
// So both spellings live here, and `hex-support.test.ts` pins them to each other
// through the real `slug()` the R2 uploader mints keys with. A rename that
// touches one and not the other fails that test rather than a stranger's print.
//
// WHY THE FIRST TWO. A spike carries its load along its axis; printed upright,
// the layers stack along that axis and peel apart. So both are laid on their
// side to run the layers ACROSS the load, and the cost of that choice is that
// they touch the bed along a line. Owner decision 2026-08-03: keep the
// orientation, say it plainly.
//
// ===========================================================================
// ===========================================================================
// THIS LIST IS NOW THE SLICER'S ANSWER, NOT A MEASUREMENT OF OURS.
// ===========================================================================
// Two homemade metrics have been wrong about this set, both in the direction
// that reads as a clean result:
//
//   A FACET-NORMAL FOOTPRINT scored curved contacts at ZERO, because a ball
//   rests on a point and nothing there is level. It reported 0.0 sq mm for the
//   two spikes -- the two parts everybody already knew were the worst here --
//   and five badly seated parts sat unflagged behind that for a fortnight.
//
//   A FLOATING-REGION DETECTOR (slice every layer, label the components, flag
//   any that do not touch the layer below) called the corner poses CLEAN while
//   Creality was flagging one of them. Softening it to a supported-FRACTION
//   gave a number that still does not predict anything: against the real list
//   below, the parts the slicer warns about span 0.0% to 72.3% and the parts it
//   ignores span 0.0% to 98.7%. The two ranges overlap end to end. It was
//   deleted rather than kept as a plausible-looking pre-flight check.
//
// So the list was collected by ASKING THE SLICER. A calibration plate carrying
// every published part once, with NO settings of any kind -- the warning only
// fires when support is off, so a plate carrying our own `enable_support` would
// have silenced the thing it was built to measure -- was opened in Creality
// Print 7.2.1 on 2026-08-17 and the warnings written down. 24 of 53 parts.
//
// REGENERATE THAT PLATE AND RE-RUN IT AFTER ANY RE-CUT. The script is small and
// the alternative is guessing. A part's warning depends on its POSE, so a
// re-orientation can add parts to this list as easily as remove them.
//
// WHAT THE SWEEP CORRECTED IN MY OWN GUESSES, both directions in one pass:
// `Hex-TB-Corner-F-Solid` warns (I had added it on inference, then briefly
// removed it on inference), and the LEFT and RIGHT tray lids do NOT warn even
// though the plain, TOP and BOT lids all do. Neither is a rule anyone would
// have derived; both came from opening the file.
//
// Measured first layer, release 2026-08-17, for the parts that need a BRIM --
// a different question, decided by the first layer alone:
//
//     0.10 mm2   Hex-TB-Spike-Solid                 (7.8 mm tall)
//     0.33 mm2   Hex-TB-Spike-Ball-Joint            (7.8)
//     6.74 mm2   Hex-TB-Spike-Ball-Zip-Single       (11.6)
//    -------- 25 mm2 threshold ------------------------------------
//    39.17 mm2   the sixteen Hex-TB-Half-* parts    (35.0)
//   111.45 mm2   Hex-TB-Main                        (33.0)
//
// Nothing sits between 6.74 and 39.17, so that line runs through empty space
// rather than through a judgement call about a part near the edge.
//
// `Hex-TB-Spike-Ball-Zip-Single` is the only part here needing a brim and NOT
// support, and it was deliberately not re-oriented: every pose was swept and
// the best alternative is 13.40 sq mm standing 17.3 mm tall, a worse aspect
// than 6.74 at 11.6. There is no better face.

/**
 * ONE ROW PER PART, carrying both spellings and the sentence that belongs to it.
 *
 * Both spellings, because the two readers speak different languages: the
 * uploader works from `manifest.json` and knows PUBLISHED names, while a pack
 * request, an R2 key and a `Placement` all carry SLUGS. Written out by hand
 * rather than derived, so `hex-support.test.ts` can check the pairing through
 * the real `slug()` instead of a transform agreeing with itself.
 *
 * One row rather than three parallel structures, because parallel arrays are how
 * a name ends up beside the wrong part's note -- and the note is the half a
 * reader acts on.
 */
/** The sixteen hex halves. One shared sentence because they share one cause and
 *  one remedy; sixteen hand-written variations would be sixteen chances to say
 *  it slightly differently. */
const HALF_NOTE =
  "needs support switched on. It prints regions that begin with nothing " +
  "beneath them. It does not need a brim: it stands on about 39 sq mm.";

/** The carrier trays and the three lids the slicer flagged. Note that the LEFT
 *  and RIGHT lids were on the same calibration plate and were NOT flagged, so
 *  this is four specific parts rather than the tray family. */
const TRAY_NOTE =
  "needs support switched on. Parts of it print over open space. Adhesion is " +
  "not the problem, so it takes no brim.";

const NEEDS_SUPPORT = [
  {
    name: "Hex-TB-Spike-Solid",
    slug: "hex-tb-spike-solid",
    support: true,
    brim: true,
    note:
      "rests on a thin line, about 1 sq mm of first layer along its length. A " +
      "brim is the useful thing here, and supports are optional.",
  },
  {
    name: "Hex-TB-Spike-Ball-Joint",
    slug: "hex-tb-spike-ball-joint",
    support: true,
    // A brim needs a perimeter to hold on to and this part has almost none.
    brim: false,
    note:
      "rests on the BALL, not the shaft. Its first layer is about 0.9 sq mm, " +
      "and the 28 mm shaft hangs in the air until roughly 1 mm up. It needs " +
      "supports. A brim will not help it: there is almost no perimeter for one " +
      "to hold on to.",
  },
  {
    name: "Hex-TB-Spike-Ball-Zip-Single",
    slug: "hex-tb-spike-ball-zip-single",
    support: false,
    brim: true,
    note:
      "stands on about 7 sq mm and is 11.6 mm tall. That is enough to print " +
      "and not enough to survive being nudged, so give it a brim.",
  },
  {
    name: "Hex-TB-Corner-M-Solid",
    slug: "hex-tb-corner-m-solid",
    support: true,
    // 416.8 sq mm on the bed. It does not need help sticking; it needs help
    // holding up the regions that start in mid-air.
    brim: false,
    note:
      "has regions that begin with nothing beneath them, so it needs support " +
      "switched on. It does not need a brim: it stands on about 417 sq mm.",
  },
  {
    name: "Hex-TB-Corner-F-Solid",
    slug: "hex-tb-corner-f-solid",
    support: true,
    brim: false,
    note:
      "has regions that begin with nothing beneath them, so it needs support " +
      "switched on. It does not need a brim: it stands on about 655 sq mm.",
  },
  {
    name: "Hex-TB-Half-Bot-1H",
    slug: "hex-tb-half-bot-1h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Bot-2H",
    slug: "hex-tb-half-bot-2h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Bot-3H",
    slug: "hex-tb-half-bot-3h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Bot-Solid",
    slug: "hex-tb-half-bot-solid",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Left-1H",
    slug: "hex-tb-half-left-1h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Left-2H",
    slug: "hex-tb-half-left-2h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Left-3H",
    slug: "hex-tb-half-left-3h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Left-Solid",
    slug: "hex-tb-half-left-solid",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Right-1H",
    slug: "hex-tb-half-right-1h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Right-2H",
    slug: "hex-tb-half-right-2h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Right-3H",
    slug: "hex-tb-half-right-3h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Right-Solid",
    slug: "hex-tb-half-right-solid",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Top-1H",
    slug: "hex-tb-half-top-1h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Top-2H",
    slug: "hex-tb-half-top-2h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Top-3H",
    slug: "hex-tb-half-top-3h",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Half-Top-Solid",
    slug: "hex-tb-half-top-solid",
    support: true,
    brim: false,
    note: HALF_NOTE,
  },
  {
    name: "Hex-TB-Carrier-Parts-Tray",
    slug: "hex-tb-carrier-parts-tray",
    support: true,
    brim: false,
    note: TRAY_NOTE,
  },
  {
    name: "Hex-TB-Carrier-Parts-Tray-Lid",
    slug: "hex-tb-carrier-parts-tray-lid",
    support: true,
    brim: false,
    note: TRAY_NOTE,
  },
  {
    name: "Hex-TB-Carrier-Top-Parts-Tray-Lid",
    slug: "hex-tb-carrier-top-parts-tray-lid",
    support: true,
    brim: false,
    note: TRAY_NOTE,
  },
  {
    name: "Hex-TB-Carrier-Bot-Parts-Tray-Lid",
    slug: "hex-tb-carrier-bot-parts-tray-lid",
    support: true,
    brim: false,
    note: TRAY_NOTE,
  },
] as const;

/** As PUBLISHED names -- the spelling `manifest.json` and the mesh filenames use. */
export const NEEDS_SUPPORT_NAMES = NEEDS_SUPPORT.map((p) => p.name);

/** As SLUGS -- the spelling an R2 key, a pack request and a `Placement` use. */
export const NEEDS_SUPPORT_SLUGS: ReadonlySet<string> = new Set(
  NEEDS_SUPPORT.map((p) => p.slug),
);

/** What each listed part actually needs, keyed by slug. Two independent flags,
 *  because a brim answers "will it stick" and support answers "is anything
 *  printing into thin air", and no part in this set needs both for the same
 *  reason. */
export const PART_REMEDY: Readonly<
  Record<string, { support: boolean; brim: boolean }>
> = Object.fromEntries(
  NEEDS_SUPPORT.map((p) => [p.slug, { support: p.support, brim: p.brim }]),
);

/** Does anything in this pack rest on a line, and therefore need supports?
 *
 *  Takes SLUGS. The route asks it to decide whether to archive; the README asks
 *  it to decide whether to warn. Both must answer from the same set, or the box
 *  looks right and says nothing. */
export function needsSupport(slugs: readonly string[]): boolean {
  return slugs.some((s) => NEEDS_SUPPORT_SLUGS.has(s));
}

/**
 * What each of them actually stands on, MEASURED from the shipped mesh.
 *
 * The README used to tell everyone the same thing -- "they touch the bed along a
 * line, so give them supports or a brim" -- and for one of the two that is
 * simply wrong. Slicing the real meshes at a 0.2 mm first layer:
 *
 *   Hex-TB-Spike-Ball-Joint   0.87 mm2, and the shaft is not on the bed at all
 *   Hex-TB-Spike-Solid        1.05 mm2, a thin sliver along 23 mm
 *
 * A brim needs a perimeter to attach to. On the ball joint there is almost none,
 * so the old advice sent people to the one remedy that cannot work on that part.
 * They now get different sentences because they have different problems.
 *
 * Available by either spelling, because the uploader holds published names and
 * cannot reach `slug()` -- that function pulls in the server environment, which
 * is not a thing a script that measures a directory of meshes should validate.
 */
export const SUPPORT_NOTE: Readonly<Record<string, string>> =
  Object.fromEntries(
    NEEDS_SUPPORT.flatMap((p) => [
      [p.slug, p.note],
      [p.name, p.note],
    ]),
  );

/**
 * The one slicer-shaped sentence worth carrying, and why it is this one.
 *
 * Kept short deliberately: a print profile belongs to whoever is printing, and
 * this file otherwise refuses to assert one. It earns its place because both
 * halves are counter-intuitive and cost a wasted plate to discover.
 *
 * Tree and organic supports have nowhere to build at this scale -- a 7 mm body
 * lying down leaves well under half a millimetre of vertical room once the
 * support gap is taken off, against branches specified several times thicker.
 * And PETG supports do not snap off the way PLA does; PETG stretches and tears,
 * taking surface with it, so cutting the contact down beats opening the gap up.
 */
export const SUPPORT_SLICER_NOTE =
  "If you turn supports on, normal or snug beats tree or organic on parts " +
  "this small: a tree has under half a millimetre of height to build in here. " +
  "And PETG supports tear rather than snap, so less contact serves you better " +
  "than a wider gap.";
