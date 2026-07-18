import { signIn, signOut } from "@/auth";
import { InlineBanner } from "@/components/InlineBanner";
import { SignInForms } from "@/components/auth/SignInForms";
import { safeCallbackPath } from "@/lib/safe-callback";

// Sign-in screen (design R11 + C1 + B1). A clean deep-space full-bleed field
// with a soft gold bloom; the centered card is the client `SignInForms`, which
// renders the two-up provider grid (R11), a returning-user fast-path (C1), or the
// "check your email" state (B1 — reached via Auth.js pages.verifyRequest →
// /sign-in?type=email).
//
// Three providers: Google, GitHub, and an email magic-link (Resend). Each posts
// to a server action defined here (so the client island never imports @/auth).
// Rejected sign-ins land on ?error=AccessDenied; the link guard bounces a
// different-account attempt to ?error=session_conflict.

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const denied = params.error === "AccessDenied";
  const conflict = params.error === "session_conflict";
  // Abuse denials surface here (design §5, §6): the locus throws → ?error=Configuration
  // (Turnstile / rate limit / degradation); the IP pre-check returns ?error=rate_limited.
  // Both map to ONE generic banner (no enumeration). Configuration is overloaded with
  // genuine config faults, but generic copy is correct either way.
  const rateLimited = params.error === "Configuration" || params.error === "rate_limited";
  const checkEmail = params.type === "email";
  // Where to land after auth. Sanitized to a same-origin relative path so a
  // crafted ?callbackUrl can't open-redirect; defaults to the first-run router.
  const dest = safeCallbackPath(params.callbackUrl, "/start");

  async function googleAction() {
    "use server";
    await signIn("google", { redirectTo: dest });
  }
  async function githubAction() {
    "use server";
    await signIn("github", { redirectTo: dest });
  }
  async function resendAction(formData: FormData) {
    "use server";
    const email = formData.get("email");
    if (typeof email === "string" && email.length > 0) {
      await signIn("resend", { email, redirectTo: dest });
    }
  }

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-deep-space px-6 py-16">
      {/* A single soft gold bloom behind the card — no grid, no frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_55%_45%_at_center_38%,rgba(200,150,62,0.09)_0%,transparent_60%)]"
      />

      {(conflict || denied || rateLimited) && (
        <div className="absolute inset-x-4 top-4 z-20 mx-auto max-w-md sm:top-6">
          {conflict ? (
            <>
              <InlineBanner variant="error">
                You&apos;re still signed in to another account. Sign out first,
                then sign in to switch.
              </InlineBanner>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/sign-in" });
                }}
                className="mt-3 flex justify-center"
              >
                <button
                  type="submit"
                  className="glass-button px-5 py-2.5 font-mono text-xs uppercase tracking-[0.2em]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <InlineBanner variant="error">
              {rateLimited
                ? "Too many sign-in requests. Wait a few minutes, or use Google or GitHub."
                : "Sign-in needs a verified account. Try again."}
            </InlineBanner>
          )}
        </div>
      )}

      <div className="signin-rise z-10 flex w-full justify-center">
        <SignInForms
          googleAction={googleAction}
          githubAction={githubAction}
          resendAction={resendAction}
          checkEmail={checkEmail}
        />
      </div>

      {/* Disclosure: this screen runs Cloudflare Turnstile (a pre-consent third
          party), so a Privacy link is required here. See /privacy §3. */}
      <p className="z-10 mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
        <a
          href="/privacy"
          className="transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
        >
          Privacy
        </a>
      </p>
    </main>
  );
}
