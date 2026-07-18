// Pure decision for the NextAuth `signIn` callback, extracted so it can be
// unit-tested without standing up the whole auth flow.
//
// Why this exists: Auth.js (@auth/core handle-login.js) will SILENTLY link a
// never-before-seen account onto whoever is currently signed in — there is no
// callback veto at the point it calls `linkAccount`. That once attached a
// learner's Google login to an admin's user permanently. We never offer a
// "connect another account" feature, so the only way an active session shows up
// here with a *different* email is someone signing in as another person without
// signing out first. Refuse it and send them to sign out, rather than absorbing
// the new identity into the current account.
//
// Provider-aware, but PURE: the caller (src/auth.ts) computes `emailVerified`
// per provider and hands it in — Google's `profile.email_verified`, the GitHub
// verified-primary email, magic-link verified-by-construction. The guard only
// knows the rules. Linking same-email accounts across providers is intentional
// (one identity per verified email; see the multi-provider sign-in design doc),
// and is only safe BECAUSE this guard rejects any sign-in whose email isn't
// provider-verified before Auth.js ever links it.

/** Providers we accept. Anything else is rejected defensively. */
const KNOWN_PROVIDERS = new Set(["google", "github", "resend"]);

export type SignInInput = {
  provider: string | undefined;
  /**
   * Whether the caller has confirmed the email is provider-verified. Undefined
   * on the magic-link SEND step (nothing to verify yet — see below).
   */
  emailVerified: boolean | undefined;
  profileEmail: string | undefined;
  /** Email of the already-signed-in user, if any (read via `auth()`). */
  activeUserEmail: string | undefined;
  /**
   * True on the magic-link (Resend) SEND step, where Auth.js invokes the signIn
   * callback with `email.verificationRequest === true` and no verified email —
   * it is only emailing a token. The verified check happens on the click.
   */
  isVerificationRequest: boolean | undefined;
};

/** Where to bounce a sign-in that would link onto a different active session. */
export const SESSION_CONFLICT_REDIRECT = "/sign-in?error=session_conflict";

/** Where the abuse IP pre-check bounces a rate-limited magic-link send (design
 *  §4.3). The signIn callback RETURNS this string — it never throws (a callback
 *  throw becomes AccessDenied → a 500 under the server-action `raw` path). It
 *  surfaces as an inspectable ?error= URL on both the page and the modal, and the
 *  page maps it (with Configuration) to one generic banner (§6). */
export const RATE_LIMITED_REDIRECT = "/sign-in?error=rate_limited";

/** True when an active session belongs to a *different* identity than the one signing in. */
function isSessionConflict(activeUserEmail: string | undefined, profileEmail: string): boolean {
  return (
    !!activeUserEmail && activeUserEmail.toLowerCase() !== profileEmail.toLowerCase()
  );
}

/**
 * Returns `true` to allow the sign-in, `false` to reject it outright, or a
 * redirect path to bounce the user with a friendly "sign out first" message.
 */
export function resolveSignIn(input: SignInInput): true | false | string {
  if (!input.provider || !KNOWN_PROVIDERS.has(input.provider)) return false;
  if (!input.profileEmail) return false;

  // Magic-link SEND step: nothing is verified or linked yet, Auth.js is just
  // emailing a token. Allow it — but still refuse to email a sign-in link for a
  // *different* identity while signed in as someone else (the click would be
  // bounced anyway, and this avoids the send entirely).
  if (input.isVerificationRequest) {
    return isSessionConflict(input.activeUserEmail, input.profileEmail)
      ? SESSION_CONFLICT_REDIRECT
      : true;
  }

  // Every real sign-in (OAuth callback or magic-link click) must be verified.
  if (input.emailVerified !== true) return false;

  // Block silent account-linking onto a *different* active session.
  if (isSessionConflict(input.activeUserEmail, input.profileEmail)) {
    return SESSION_CONFLICT_REDIRECT;
  }

  return true;
}
