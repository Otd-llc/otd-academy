// Sanitize a post-auth return path so it can only ever point back into THIS app.
// An attacker-supplied ?callbackUrl would otherwise be an open-redirect vector:
// a protocol-relative `//evil.com`, an absolute `https://evil.com`, or a
// backslash/encoding trick a browser normalizes into a scheme-relative URL. We
// accept ONLY a same-origin, relative path (a single leading slash) and fall
// back to `fallback` for anything else.
export function safeCallbackPath(
  raw: unknown,
  fallback: string = "/start",
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();

  // Must be a root-anchored relative path...
  if (!value.startsWith("/")) return fallback;
  // ...but NOT protocol-relative (`//host`) or a backslash-smuggled variant that
  // some browsers normalize to a scheme-relative URL (`/\host`).
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Reject any backslash, or ASCII control / whitespace char that could be used
  // to slip past the checks once the browser normalizes the URL.
  if (/[\\\x00-\x1f\x7f\s]/.test(value)) return fallback;
  // Reject an encoded second slash right after the first (`/%2f…` → `//…`).
  if (/^\/%2f/i.test(value)) return fallback;

  return value;
}
