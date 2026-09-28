// The releases the public download route will serve. Anything else 404s BEFORE
// R2 is touched.
//
// An allow-list, not the date grammar, because uploading is not publishing: a
// new release can sit in the bucket (dry runs, staging checks, an owner upload
// that is not yet announced) and the grammar alone would serve it to anyone who
// guesses the date. Publishing a release is a one-line change here, reviewed
// like any other.
export const PUBLISHED_RELEASES: ReadonlySet<string> = new Set([
  "2026-07-31",
  "2026-08-03",
  "2026-08-17",
]);

export function isPublishedRelease(release: string | undefined): boolean {
  return release !== undefined && PUBLISHED_RELEASES.has(release);
}
