import { signIn, signOut } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { InlineBanner } from "@/components/InlineBanner";

// Sign-in screen — full-viewport "boot" treatment matching the hex-viz
// loading screen at c:/zzz/otd/bioscale-viz/src/styles/loading.css.
//
// Layout follows the rule of thirds: a three-row grid spans the full
// viewport with the brand mark anchored at the upper-third line, the
// title cluster sitting in the middle band, and the sign-in CTA anchored
// at the lower-third line. The eye sweeps logo → title → button across
// the thirds instead of clustering everything dead-center.
//
// Auth.js redirects rejected signIn attempts to `/sign-in?error=AccessDenied`.
// The link guard (auth-link-guard.ts) redirects a different-account sign-in
// attempted while already signed in to `?error=session_conflict`. Either way an
// alert-red banner mounts above the brand mark — design §6 "clear reject
// screen". The conflict banner also offers an inline Sign-out so the user can
// switch accounts in one click instead of hunting for the menu.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const denied = params.error === "AccessDenied";
  const conflict = params.error === "session_conflict";

  return (
    <main className="relative grid min-h-[100svh] grid-rows-[1fr_1fr_1fr] overflow-hidden bg-deep-space px-4 py-6 sm:py-10">
      {/* Subtle radial gold-glow behind the brand — emulates the inspector's
          inner highlight without needing a separate canvas. Pointer-events
          disabled so the form stays the focal target. */}
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

      {/* Row 1 — upper third. The brand mark sits at the bottom of this
          row so it lands on the upper-third line of the viewport.
          BrandMark is an inlined SVG component (currentColor-tinted) so
          there's no external asset fetch — Vercel caching / MIME-type /
          public-path issues all go away. */}
      <div className="z-10 flex items-end justify-center pb-6">
        <BrandMark className="animate-pulse-brand h-[60px] w-[60px] text-gray-1 sm:h-[72px] sm:w-[72px]" />
      </div>

      {/* Row 2 — middle third. Title + subtitle + tagline centered
          vertically within the row so the title visually anchors the
          dead-centre of the viewport. */}
      <div className="z-10 flex flex-col items-center justify-center text-center">
        <h1
          className="font-display leading-[1.05] text-gray-1"
          style={{
            fontSize: "clamp(1.75rem, 5.2vw, 3.25rem)",
            letterSpacing: "clamp(0.2rem, 0.7vw, 0.4rem)",
          }}
        >
          ONE THOUSAND DRONES
          <br />
          <span className="text-command-gold">ACADEMY</span>
        </h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.4em] text-gray-3">
          Hardware engineering · 9-stage workflow
        </p>
        <p className="mt-5 font-serif text-base italic text-gold-dim sm:text-lg">
          Where prototypes become production.
        </p>
      </div>

      {/* Row 3 — lower third. The CTA button anchors at the top of this
          row so it lands on the lower-third line of the viewport. The
          hairline divider sits a generous gap below as a decorative
          base. */}
      <div className="z-10 flex flex-col items-center justify-start gap-12 pt-6">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="glass-button glass-button-cta px-6 py-3 font-mono text-sm uppercase tracking-[0.2em]"
          >
            Sign in with Google
          </button>
        </form>

        {/* Open registration: there is no separate sign-up. A first Google
            sign-in creates a learner account automatically. */}
        <p className="-mt-6 max-w-xs text-center font-mono text-[11px] uppercase leading-relaxed tracking-wider text-gray-3">
          New here? Signing in creates your free learner account.
        </p>

        <div className="h-px w-24 bg-gradient-to-r from-transparent via-command-gold to-transparent" />
      </div>
    </main>
  );
}
