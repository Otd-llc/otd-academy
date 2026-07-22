import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

// Pure core of the NextAuth `session` callback (src/auth.ts). Auth.js stamps
// the adapter's DB user id into `token.sub` at initial sign-in, so copying it
// here gives every server surface a session-borne id and removes the
// per-request `db.user.findUnique({ where: { email } })` lookup that used to
// be the only way to get one. Kept pure so it is testable without the auth
// wiring (same pattern as resolveSignIn / resolveRouteGate).
export function applySessionClaims(
  session: Session,
  token: { sub?: string; role?: UserRole },
): Session {
  if (!session.user) return session;
  session.user.role = token.role ?? "LEARNER";
  if (token.sub) session.user.id = token.sub;
  return session;
}
