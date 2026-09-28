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

export const PUBLISHED_RELEASES: ReadonlySet<string> = new Set<string>([
  ...HEX_PUBLISHED_RECORD_RELEASES,
]);

export function isPublishedRelease(release: string | undefined): boolean {
  return release !== undefined && PUBLISHED_RELEASES.has(release);
}
