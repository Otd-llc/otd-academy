// The avatar URL to show for a user, in precedence order:
//   1. their custom uploaded avatar (User.avatarUpdatedAt set) → the public
//      /api/avatar/{id} proxy, with a ?v cache-bust from the timestamp
//   2. the sign-in provider image (Google / GitHub) → its URL as-is
//   3. none → the caller falls back to the initial
// Pure (no DOM, no db) so it unit-tests in the fast "unit" project and can be
// used from the server layout, the account page, and RememberLastUser alike.
export function avatarSrc(
  userId: string,
  avatarUpdatedAt: Date | null | undefined,
  providerImage: string | null | undefined,
): string | null {
  if (avatarUpdatedAt) {
    return `/api/avatar/${userId}?v=${avatarUpdatedAt.getTime()}`;
  }
  return providerImage ?? null;
}
