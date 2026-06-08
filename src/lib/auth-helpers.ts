// Action-layer auth helper. `requireUser` resolves the current Auth.js v5
// session to the corresponding User row in our DB, throwing if no session is
// active. The allowlist check happens upstream in Auth.js callbacks (§6);
// here we only assert "signed in" and load the audit-relevant User row.
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }
  return db.user.findUniqueOrThrow({
    where: { email: session.user.email },
  });
}

// Authz guard for curriculum-authoring mutations: requires a signed-in user
// whose DB `role` mirror is ADMIN. The mirror is synced from the admin roster
// (`ALLOWED_EMAILS`) on sign-in (src/auth.ts). Known limitation: admin
// *revocation* takes effect on the user's next sign-in — acceptable for the
// small operator set; hardening deferred.
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: admin only");
  }
  return user;
}
