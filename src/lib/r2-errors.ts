// Classifying R2/S3 SDK errors. Dependency-free on purpose (no client, no env),
// so a route can import it and a test can use the real thing while mocking R2.

/** True when an R2/S3 SDK error means "that object does not exist". A GET says
 *  `NoSuchKey`; a HEAD has no body to carry a code, so the SDK names it
 *  `NotFound`. The HTTP status is the backstop for either. */
export function isR2NotFound(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    err.name === "NoSuchKey" ||
    err.name === "NotFound" ||
    err.$metadata?.httpStatusCode === 404
  );
}
