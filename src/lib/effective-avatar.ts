// The avatar URL to show for a user, in precedence order:
//   1. their custom uploaded avatar (User.avatarUpdatedAt set) → the direct R2
//      URL when NEXT_PUBLIC_R2_PUBLIC_BASE_URL is configured (audit Phase 9:
//      zero-egress, no fn invocation), else the public /api/avatar/{id} proxy —
//      both with a ?v cache-bust from the timestamp
//   2. the sign-in provider image (Google / GitHub) → its URL as-is
//   3. none → the caller falls back to the initial
// Pure (no DOM, no db) so it unit-tests in the fast "unit" project and can be
// used from the server layout, the account page, and RememberLastUser alike.
// The key mirrors r2.ts userAvatarKey (avatars/{id}.webp) — keep in lockstep.
import { env } from "@/env";

export function avatarSrc(
  userId: string,
  avatarUpdatedAt: Date | null | undefined,
  providerImage: string | null | undefined,
): string | null {
  if (avatarUpdatedAt) {
    const v = avatarUpdatedAt.getTime();
    const base = env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
    if (base) {
      return `${base.replace(/\/$/, "")}/avatars/${userId}.webp?v=${v}`;
    }
    return `/api/avatar/${userId}?v=${v}`;
  }
  return providerImage ?? null;
}
