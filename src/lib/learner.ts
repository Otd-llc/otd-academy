// Server-only helpers for the learner-facing (/learn) pages. There is no auth
// middleware in this app, so each learner page resolves the signed-in user here
// and redirects to /sign-in when there is no session. (Imports @/auth, so this
// only ever runs server-side.)
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { safeCallbackPath } from "@/lib/safe-callback";

// `callbackPath` (a same-origin relative path, e.g. `/learn/l1-01-wroom-breakout`)
// carries the learner back to where they were after signing in, instead of the
// generic first-run page. Sanitized so it can never become an open redirect.
export async function currentUserOrRedirect(callbackPath?: string) {
  const session = await auth();
  if (!session?.user?.email) {
    if (callbackPath) {
      const dest = safeCallbackPath(callbackPath);
      redirect(`/sign-in?callbackUrl=${encodeURIComponent(dest)}`);
    }
    redirect("/sign-in");
  }
  return db.user.findUniqueOrThrow({
    where: { email: session.user.email },
  });
}
