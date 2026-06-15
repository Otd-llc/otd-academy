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
// Three providers: Google, GitHub, and an email magic-link (Resend). The OAuth
// buttons and the email field each post to a server action that calls signIn().
//
// Auth.js redirects rejected signIn attempts to `/sign-in?error=AccessDenied`.
// The link guard (auth-link-guard.ts) redirects a different-account sign-in
// attempted while already signed in to `?error=session_conflict`. Either way an
// alert-red banner mounts at the top — design §6 "clear reject screen". The
// conflict banner also offers an inline Sign-out so the user can switch
// accounts in one click instead of hunting for the menu. After a magic link is
// sent, Auth.js routes here (pages.verifyRequest) appending `type=email` → a
// "check your inbox" success banner.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string }>;
}) {
  const params = await searchParams;
  const denied = params.error === "AccessDenied";
  const conflict = params.error === "session_conflict";
  const checkEmail = params.type === "email";

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
            SIGN-IN NEEDS A VERIFIED ACCOUNT — try again.
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

      {/* After a magic link is sent, swap the providers for an on-brand
          confirmation — command-console language, not a green success bar. */}
      {checkEmail ? (
        <div className="z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-command-gold">
            // Link sent
          </span>
          <h2 className="font-display text-3xl leading-none tracking-[0.12em] text-gray-1 sm:text-4xl">
            Check your inbox
          </h2>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-command-gold to-transparent" />
          <p className="font-serif text-base italic leading-relaxed text-gold-dim">
            We sent a single-use sign-in link to your email.
            <br />
            It expires in 24&nbsp;hours.
          </p>
          <a
            href="/sign-in"
            className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-gray-1/60 transition-colors hover:text-command-gold"
          >
            &larr; Use another method
          </a>
        </div>
      ) : (
        <div className="z-10 flex w-full max-w-xs flex-col items-center gap-5">
        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="glass-button glass-button-cta w-full px-7 py-3.5 font-mono text-sm uppercase tracking-[0.2em]"
          >
            Continue with Google
          </button>
        </form>

        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="glass-button w-full px-7 py-3.5 font-mono text-sm uppercase tracking-[0.2em]"
          >
            Continue with GitHub
          </button>
        </form>

        {/* Divider between OAuth and the email magic-link */}
        <div className="flex w-full items-center gap-3" aria-hidden>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-command-gold/40" />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-gold-dim">
            or
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-command-gold/40" />
        </div>

        {/* Email magic-link — posts the address to signIn("resend", …), which
            emails a one-time link and routes to ?check=email. */}
        <form
          className="flex w-full flex-col gap-3"
          action={async (formData: FormData) => {
            "use server";
            const email = formData.get("email");
            if (typeof email === "string" && email.length > 0) {
              await signIn("resend", { email, redirectTo: "/" });
            }
          }}
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            aria-label="Email address"
            className="w-full rounded border border-command-gold/30 bg-navy-dark/60 px-4 py-3 text-center font-mono text-sm text-gray-1 placeholder:text-gold-dim/60 focus:border-command-gold focus:outline-none"
          />
          <button
            type="submit"
            className="glass-button w-full px-7 py-3 font-mono text-sm uppercase tracking-[0.2em]"
          >
            Email me a link
          </button>
        </form>
        </div>
      )}
    </main>
  );
}
