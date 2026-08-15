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

/** As PUBLISHED names -- the spelling `manifest.json` and the mesh filenames use.
 *  Read by the uploader, which works from the manifest. */
export const NEEDS_SUPPORT_NAMES = [
  "Hex-TB-Spike-Solid",
  "Hex-TB-Spike-Ball-Joint",
] as const;

/** As SLUGS -- the spelling an R2 key, a pack request and a `Placement` use.
 *  Derived from the names above by hand rather than at runtime, so the pairing is
 *  a fact a test can check instead of a transform that cannot be wrong. */
export const NEEDS_SUPPORT_SLUGS: ReadonlySet<string> = new Set([
  "hex-tb-spike-solid",
  "hex-tb-spike-ball-joint",
]);

/** Does anything in this pack rest on a line, and therefore need supports?
 *
 *  Takes SLUGS. The route asks it to decide whether to archive; the README asks
 *  it to decide whether to warn. Both must answer from the same set, or the box
 *  looks right and says nothing. */
export function needsSupport(slugs: readonly string[]): boolean {
  return slugs.some((s) => NEEDS_SUPPORT_SLUGS.has(s));
}
