"use server";

// Server actions for the lead-magnet modal's sends. The modal moved OFF
// `next-auth/react` (client HTTP) onto these in-process server actions
// (Auth(req)), which (a) collapses it onto the page's transport so the raw
// `POST /api/auth/signin/*` can be 404'd (design D1/D2), and (b) lets a denial
// surface as an inspectable `?error=` on the returned URL under `redirect:false`
// (design §5).
//
// These are THIN pass-throughs: they forward the fields and verify NOTHING
// themselves. Turnstile + enforce live in the ONE locus (sendVerificationRequest,
// design §4.4, P1). The Turnstile token + honeypot + dwell fields are added to the
// forwarded options in Task 4.
import { signIn } from "@/auth";
import { fieldGuideWelcomePath } from "@/lib/library/field-guide-links";
import { TURNSTILE_FIELD, HONEYPOT_FIELD, DWELL_FIELD } from "@/lib/abuse-guard";

/**
 * Send ONE magic link whose post-verification target is the field guide. Returns
 * the denial code (or null on success) by inspecting the returned URL's `?error=`.
 *
 * NEVER a truthy/ok check: server `signIn` returns HTTP 200 with the URL string
 * even on a denial (design §4.2, D3). A success returns a `/verify-request…` URL
 * with no `?error=`; a locus throw (Turnstile/limiter, once wired in Task 4/7)
 * returns `…?error=Configuration`. `redirect:false` keeps the modal mounted to
 * render the outcome (design §5).
 */
export async function sendGuideMagicLink(
  guide: string,
  email: string,
  fields: { token?: string; honeypot?: string; dwell?: string } = {},
): Promise<{ error: string | null }> {
  try {
    const result: unknown = await signIn("resend", {
      email,
      redirectTo: fieldGuideWelcomePath(guide),
      redirect: false,
      // Forward the Layer-0 fields (design §4.4 seam) so the locus reads them.
      [TURNSTILE_FIELD]: fields.token ?? "",
      [HONEYPOT_FIELD]: fields.honeypot ?? "",
      [DWELL_FIELD]: fields.dwell ?? "",
    });
    if (typeof result !== "string") return { error: null };
    // A dummy base makes this robust whether the URL is absolute or relative.
    const error = new URL(result, "https://x.invalid").searchParams.get("error");
    return { error };
  } catch {
    return { error: "unknown" };
  }
}

/**
 * OAuth from the modal. `redirect:true` (the default) transfers the browser: an
 * OAuth `signIn` under `redirect:false` returns the provider's auth URL with no
 * `?error=`, so inspecting it would dead-end and never navigate (design §5). The
 * redirect propagates to the calling client as a navigation.
 */
export async function guideOAuthSignIn(
  guide: string,
  provider: "google" | "github",
): Promise<void> {
  await signIn(provider, { redirectTo: fieldGuideWelcomePath(guide) });
}
