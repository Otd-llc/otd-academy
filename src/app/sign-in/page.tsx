import { signIn, signOut } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { InlineBanner } from "@/components/InlineBanner";

// Sign-in screen — full-viewport "boot" treatment matching the hex-viz
// loading screen at c:/zzz/otd/bioscale-viz/src/styles/loading.css.
//
// Composition: a single vertically-centered cluster — brand mark → title +
// subtitle → CTA — with even breathing room between the three groups, over a
// dark field with a soft gold glow behind the mark.
//
// Auth.js redirects rejected signIn attempts to `/sign-in?error=AccessDenied`.
// The link guard (auth-link-guard.ts) redirects a different-account sign-in
// attempted while already signed in to `?error=session_conflict`. Either way an
// alert-red banner mounts at the top — design §6 "clear reject screen". The
// conflict banner also offers an inline Sign-out so the user can switch
// accounts in one click instead of hunting for the menu.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const denied = params.error === "AccessDenied";
  const conflict = params.error === "session_conflict";

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center gap-y-10 overflow-hidden bg-deep-space px-6 py-12 text-center sm:gap-y-12">
      {/* Subtle radial gold-glow behind the brand — pointer-events disabled so
          the form stays the focal target. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,rgba(200,150,62,0.08)_0%,transparent_55%)]"
      />

      {conflict ? (
        <div className="absolute inset-x-4 top-4 z-10 mx-auto max-w-md sm:top-6">
          <InlineBanner variant="error">
            You&apos;re still signed in to another account. Sign out first, then
            sign in to switch.
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
        </div>
      ) : denied ? (
        <div className="absolute inset-x-4 top-4 z-10 mx-auto max-w-md sm:top-6">
          <InlineBanner variant="error">
            SIGN-IN NEEDS A VERIFIED GOOGLE ACCOUNT — try again.
          </InlineBanner>
        </div>
      ) : null}

      {/* Brand mark */}
      <BrandMark className="animate-pulse-brand h-20 w-20 text-gray-1 sm:h-24 sm:w-24" />

      {/* Title + subtitle */}
      <div className="z-10 flex flex-col items-center">
        <h1
          className="font-display leading-[1.02] text-gray-1"
          style={{
            fontSize: "clamp(2rem, 8vw, 3.25rem)",
            letterSpacing: "clamp(0.12rem, 0.5vw, 0.3rem)",
          }}
        >
          OTD <span className="text-command-gold">Academy</span>
        </h1>
        <p className="mt-5 font-serif text-base italic text-gold-dim sm:text-lg">
          Build real hardware.
        </p>
      </div>

      {/* CTA */}
      <div className="z-10 flex flex-col items-center gap-8">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="glass-button glass-button-cta px-7 py-3.5 font-mono text-sm uppercase tracking-[0.2em]"
          >
            Continue with Google
          </button>
        </form>

        <div className="h-px w-24 bg-gradient-to-r from-transparent via-command-gold to-transparent" />
      </div>
    </main>
  );
}
