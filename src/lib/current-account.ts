// The signed-in visitor's identity + effective avatar, resolved ONCE per request.
//
// Under the (chrome) route group the header is a static frame with independent
// dynamic islands inside it, and each island needs the session: the nav needs
// `role`, the account slot needs email/name/avatar, and the identity memo (which
// runs on chrome-free routes too) needs email/name/avatar. Three callers reading
// it directly would mean three `auth()` decodes and TWO avatar DB reads per
// render — a regression on the branch whose whole point was cutting DB reads.
//
// `cache()` is React's per-REQUEST memo (not the `use cache` disk cache): the
// first island to call this pays the query, the rest get the same promise. That
// is what keeps the split free. Do NOT swap this for `use cache` — the value is
// session-scoped, so caching it across requests would serve one visitor's
// identity to another.
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { avatarSrc } from "@/lib/effective-avatar";

export type CurrentAccount = {
  /** DB user id — feeds PostHog identify (IdentitySync); null if the row read failed. */
  id: string | null;
  email: string;
  name: string | null;
  // Mirrors the session's own role union so this flows straight into UserMenu.
  role: "ADMIN" | "LEARNER" | null;
  /** Custom upload when set, else the sign-in provider image, else null. */
  image: string | null;
};

export const currentAccount = cache(async (): Promise<CurrentAccount | null> => {
  // auth() decodes the JWT session cookie (strategy: "jwt"), so this is not a DB
  // round-trip; the avatar lookup below is the only query here.
  const user = (await auth())?.user;
  const email = user?.email;
  if (!email) return null;

  const providerImage = user.image ?? null;
  const account = await db.user
    .findUnique({ where: { email }, select: { id: true, avatarUpdatedAt: true } })
    .catch(() => null);

  return {
    id: account?.id ?? null,
    email,
    name: user.name ?? null,
    role: user.role ?? null,
    image: account
      ? avatarSrc(account.id, account.avatarUpdatedAt, providerImage)
      : providerImage,
  };
});
