// The releases the public download route will serve. Anything else 404s BEFORE
// R2 is touched.
//
// An allow-list, not the date grammar, because uploading is not publishing: a
// new release can sit in the bucket (dry runs, staging checks, an owner upload
// that is not yet announced) and the grammar alone would serve it to anyone who
// guesses the date. Publishing a release is a one-line change here, reviewed
// like any other.
//
// The three v1 releases are the PUBLISHED RECORD (`hex-published-record.ts`,
// launch readiness 4.8): their keys are immutable and their links are live, so
// they keep being served, and their ids are spelled once, there. The v2 release
// is added HERE at launch, not before.
import { HEX_PUBLISHED_RECORD_RELEASES } from "@/lib/hex-published-record";
import { HEX_TABLES_RELEASE } from "@/lib/hex-release-tables";

/** EARLIER v2 RELEASES, still served after the tables moved on. Each is an
 *  immutable R2 segment published under CC BY 4.0, which cannot be taken back,
 *  so a link to one of its files keeps working. Until the second release this
 *  list did not exist: the set named only the tables' own release, so cutting
 *  2026-10-10 would have quietly turned every 2026-10-01 link into a 404. Packs
 *  are different: the pack route plans with the current tables only. */
export const HEX_V2_EARLIER_RELEASES = ["2026-10-01", "2026-10-10", "2026-10-12"] as const;

export const PUBLISHED_RELEASES: ReadonlySet<string> = new Set<string>([
  ...HEX_PUBLISHED_RECORD_RELEASES,
  ...HEX_V2_EARLIER_RELEASES,
  // THE CURRENT v2 RELEASE. Named through the generated tables, so the route
  // serves exactly the release the tables, the plate plan and the byte budget
  // describe. 2026-10-01 was uploaded and SHA-verified (875 objects) before it
  // was listed here (10.4, owner's go-ahead 2026-09-28); 2026-10-10 and
  // 2026-10-12 were uploaded and verified the same way before their tables
  // landed.
  HEX_TABLES_RELEASE,
]);

export function isPublishedRelease(release: string | undefined): boolean {
  return release !== undefined && PUBLISHED_RELEASES.has(release);
}
