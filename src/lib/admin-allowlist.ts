// The admin roster. `ALLOWED_EMAILS` no longer gates sign-in (registration is
// open — see src/auth.ts); it now designates which signed-in users are ADMINs.
// The DB `User.role` mirror is synced from this set on sign-in and is the
// authority `requireAdmin` reads.
import { env } from "@/env";

const ADMIN_EMAILS = new Set(
  env.ALLOWED_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}
