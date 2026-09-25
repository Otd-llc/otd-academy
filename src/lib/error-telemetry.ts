// Error telemetry: the shapes both halves report, and the pure sanitizers that
// keep PII out of them. Server errors arrive via `onRequestError` in
// `src/instrumentation.ts`; client render faults arrive via the error boundaries
// and `POST /api/beacon/error`.
//
// WHAT IS NEVER SENT: request or response bodies, headers, cookies, query
// strings (a magic-link callback carries its token there), and error MESSAGES
// (they interpolate whatever the failing code held: an email, a slug, a row).
// The error NAME and the Next `digest` are enough to find the full error in the
// Vercel function log, which is where the detail belongs.
//
// PostHog is a backstop here, not the alerting path (plan 5.9): hourly, capped.
// A PLAIN module (not "use server"), and free of Node-only imports so the client
// beacon helper can share the sanitizers.

export const SERVER_ERROR_EVENT = "server_error";
export const CLIENT_ERROR_EVENT = "client_error";

/** Which boundary caught a client fault. */
export const BOUNDARIES = ["global", "chrome", "bare"] as const;
export type Boundary = (typeof BOUNDARIES)[number];

const MAX_PATH = 200;
const TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

/** A pathname only: the query and fragment dropped, length-capped. Null when the
 *  input is not a path. */
export function safePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  const path = raw.split(/[?#]/, 1)[0] ?? "";
  return path.slice(0, MAX_PATH);
}

/** A short identifier-shaped token (a digest, an error name), else null. */
export function safeToken(raw: unknown): string | null {
  return typeof raw === "string" && TOKEN.test(raw) ? raw : null;
}

function errorName(e: unknown): string | null {
  return e instanceof Error ? safeToken(e.name) : null;
}

function errorDigest(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  return safeToken((e as { digest?: unknown }).digest);
}

/** Properties for a server `onRequestError` event. */
export function serverErrorProperties(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string; routerKind: string; renderSource?: string },
): Record<string, string | null> {
  return {
    path: safePath(request.path),
    method: safeToken(request.method),
    routePath: safePath(context.routePath),
    routeType: safeToken(context.routeType),
    routerKind: context.routerKind === "App Router" ? "app" : "pages",
    renderSource: safeToken(context.renderSource),
    name: errorName(error),
    digest: errorDigest(error),
  };
}

/** Parse + sanitize a client beacon body. Null when it is not a beacon. */
export function parseClientBeacon(raw: string): Record<string, string | null> | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const boundary = (BOUNDARIES as readonly unknown[]).includes(b.boundary)
    ? (b.boundary as Boundary)
    : null;
  if (!boundary) return null;
  return {
    boundary,
    path: safePath(b.path),
    name: safeToken(b.name),
    digest: safeToken(b.digest),
  };
}
