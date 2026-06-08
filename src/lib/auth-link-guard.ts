// Pure decision for the NextAuth `signIn` callback, extracted so it can be
// unit-tested without standing up the whole auth flow.
//
// Why this exists: Auth.js (@auth/core handle-login.js) will SILENTLY link a
// never-before-seen OAuth account onto whoever is currently signed in — there
// is no callback veto at the point it calls `linkAccount`. That once attached
// a learner's Google login to an admin's user permanently. We never offer a
// "connect another account" feature, so the only way an active session shows
// up here with a *different* email is someone signing in as another person
// without signing out first. Refuse it and send them to sign out, rather than
// absorbing the new identity into the current account.

export type GoogleSignInInput = {
  provider: string | undefined;
  emailVerified: boolean | undefined;
  profileEmail: string | undefined;
  /** Email of the already-signed-in user, if any (read via `auth()`). */
  activeUserEmail: string | undefined;
};

/** Where to bounce a sign-in that would link onto a different active session. */
export const SESSION_CONFLICT_REDIRECT = "/sign-in?error=session_conflict";

/**
 * Returns `true` to allow the sign-in, `false` to reject it outright, or a
 * redirect path to bounce the user with a friendly "sign out first" message.
 */
export function resolveGoogleSignIn(input: GoogleSignInInput): true | false | string {
  if (input.provider !== "google") return false;
  if (!input.profileEmail) return false;
  if (input.emailVerified !== true) return false;

  // Block silent account-linking onto a *different* active session.
  if (
    input.activeUserEmail &&
    input.activeUserEmail.toLowerCase() !== input.profileEmail.toLowerCase()
  ) {
    return SESSION_CONFLICT_REDIRECT;
  }

  return true;
}
