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

export const PUBLISHED_RELEASES: ReadonlySet<string> = new Set<string>([
  ...HEX_PUBLISHED_RECORD_RELEASES,
  // THE v2 RELEASE, published at launch (10.4, owner's go-ahead 2026-09-28).
  // Named through the generated tables, so the route serves exactly the
  // release the tables, the plate plan and the byte budget describe. It was
  // uploaded and SHA-verified (875 objects) before this line was added.
  HEX_TABLES_RELEASE,
]);

export function isPublishedRelease(release: string | undefined): boolean {
  return release !== undefined && PUBLISHED_RELEASES.has(release);
}
