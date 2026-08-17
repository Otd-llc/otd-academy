// The parts that rest on a LINE by design, and therefore need supports or a brim.
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
// WHY THESE TWO. A spike carries its load along its axis; printed upright, the
// layers stack along that axis and peel apart. So both are laid on their side to
// run the layers ACROSS the load, and the cost of that choice is that they touch
// the bed along a line. Owner decision 2026-08-03: keep the orientation, say it
// plainly. Every other part in the set stands on a flat face.

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
const NEEDS_SUPPORT = [
  {
    name: "Hex-TB-Spike-Solid",
    slug: "hex-tb-spike-solid",
    note:
      "rests on a thin line, about 1 sq mm of first layer along its length. A " +
      "brim is the useful thing here, and supports are optional.",
  },
  {
    name: "Hex-TB-Spike-Ball-Joint",
    slug: "hex-tb-spike-ball-joint",
    note:
      "rests on the BALL, not the shaft. Its first layer is about 0.9 sq mm, " +
      "and the 28 mm shaft hangs in the air until roughly 1 mm up. It needs " +
      "supports. A brim will not help it: there is almost no perimeter for one " +
      "to hold on to.",
  },
] as const;

/** As PUBLISHED names -- the spelling `manifest.json` and the mesh filenames use. */
export const NEEDS_SUPPORT_NAMES = NEEDS_SUPPORT.map((p) => p.name);

/** As SLUGS -- the spelling an R2 key, a pack request and a `Placement` use. */
export const NEEDS_SUPPORT_SLUGS: ReadonlySet<string> = new Set(
  NEEDS_SUPPORT.map((p) => p.slug),
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
