// Which S3 endpoint the client dials, and whether it must use path-style
// addressing. Split out of src/lib/r2.ts and importing NOTHING, on the same
// principle as @/lib/static-param-404 and @/lib/dev-only-routes: the decision is
// pure, so it should be testable without constructing an S3 client or booting
// `@/env` -- importing r2.ts drags in the whole AWS SDK graph for a function that
// is three lines of string handling.

/**
 * Where the S3 client points, and whether it must use path-style addressing.
 *
 * Pure, and exported, so the CI override is unit-testable -- the client itself is
 * constructed once at module scope against the real `env`, which makes the choice
 * itself untestable in place. (The lesson behind that: a green unit test about a
 * client says nothing about which host it dials.)
 *
 * `R2_ENDPOINT` is UNSET everywhere real. It exists so CI can aim the same code
 * at an S3-compatible server in a service container instead of Cloudflare. That
 * is not a convenience: this repo is PUBLIC, so an R2 credential in its Actions
 * secrets is reachable from any merged workflow edit, and fork PRs get no secrets
 * at all -- so credential-gated tests would stay green-by-absence for exactly the
 * contributors worth guarding against.
 *
 * PATH STYLE IS NOT OPTIONAL WHEN OVERRIDDEN. The SDK defaults to virtual-host
 * addressing (`https://<bucket>.<host>/<key>`), which needs wildcard DNS. A
 * container reachable at `http://localhost:9000` has none, so every request would
 * resolve `bucket.localhost` and fail in a way that looks like a bucket problem.
 * R2 itself is fine either way; the flag is tied to the override, not to a
 * separate switch, so the two can never be set inconsistently.
 */
export function s3Target(e: {
  R2_ENDPOINT?: string | undefined;
  R2_ACCOUNT_ID?: string | undefined;
}): { endpoint: string; forcePathStyle: boolean } {
  if (e.R2_ENDPOINT) return { endpoint: e.R2_ENDPOINT, forcePathStyle: true };
  return {
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: false,
  };
}
