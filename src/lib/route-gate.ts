// Pure decision for the route auth gate in src/proxy.ts, extracted so the
// fail-CLOSED behaviour can be unit-tested without the edge runtime — the same
// shape as resolveSignIn in @/lib/auth-link-guard.
import { isAdminOnlyPath, isPublicPath } from "@/lib/admin-routes";

// The gate reads only the authenticated user. The type is deliberately
// permissive because at runtime `req.auth` is NOT always a Session: Auth.js
// assigns a truthy ERROR OBJECT — `{ message: "There was a problem with the
// server configuration." }`, no `user` — when it refuses to run (an untrusted
// host, a bad secret). That object must be treated as signed-OUT.
export type GateSession =
  | { user?: { role?: string | null } | null }
  | null
  | undefined;

/**
 * Where a request should be redirected, or `null` to let it through.
 *
 * The gate keys on the authenticated USER, never on the session object. A
 * `!session` check is a fail-OPEN bug: the rejected-config error object above is
 * truthy, so `!session` is false and a non-public route would serve to an
 * unauthenticated request. Gating on `.user` makes every non-authenticated
 * shape — `null`, `undefined`, or the error object — fail CLOSED.
 */
export function resolveRouteGate(
  session: GateSession,
  pathname: string,
): "/sign-in" | "/learn" | null {
  const user = session?.user ?? null;

  // No authenticated user → require sign-in for anything non-public.
  if (!user && !isPublicPath(pathname)) return "/sign-in";

  // Operator / authoring surfaces are admin-only. Deny only an EXPLICIT LEARNER
  // (not "anyone != ADMIN"): an absent role degrades to a harmless no-op so a
  // role hiccup in the edge runtime never locks an admin out. Writes are
  // separately `requireAdmin`; this is the matching VIEW gate.
  if (user?.role === "LEARNER" && isAdminOnlyPath(pathname)) return "/learn";

  return null;
}
