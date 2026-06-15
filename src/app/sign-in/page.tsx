import { signIn, signOut } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { InlineBanner } from "@/components/InlineBanner";

// Sign-in screen — composed to match the bioscale-viz hex-visualizer boot
// screen (c:/zzz/otd/bioscale-viz/src/styles/loading.css): a single airy,
// centered column on the pure deep-space field — breathing brand mark → Bebas
// wordmark → dim Space-Mono subtitle → Lora-italic tagline → the signature thin
// gold hairline that draws in on load — then the providers, kept minimal (no
// panels, frames, or grids).
//
// Three providers: Google, GitHub, and an email magic-link (Resend). Each posts
// to a server action that calls signIn(). After a magic link is sent, Auth.js
// routes here (pages.verifyRequest) appending `type=email` → a "check your inbox"
// state. Rejected sign-ins land on `?error=AccessDenied`; the link guard bounces
// a different-account attempt to `?error=session_conflict`.

// Provider marks — inline so they need no external assets. Google keeps its
// official 4-color G (on a small white chip); GitHub is monochrome and inherits
// currentColor (gold → dark on the button's hover fill).
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

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
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center gap-9 overflow-hidden bg-deep-space px-6 py-16 text-center sm:gap-10">
      {/* A single soft gold bloom behind the mark — no grid, no frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_55%_45%_at_center_36%,rgba(200,150,62,0.09)_0%,transparent_60%)]"
      />

      {(conflict || denied) && (
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
              SIGN-IN NEEDS A VERIFIED ACCOUNT — try again.
            </InlineBanner>
          )}
        </div>
      )}

      {/* Brand mark */}
      <BrandMark className="signin-rise animate-pulse-brand z-10 h-16 w-16 text-gray-1 sm:h-[72px] sm:w-[72px]" />

      {/* Wordmark → dim mono subtitle → Lora tagline (loading-screen order) */}
      <div
        className="signin-rise z-10 flex flex-col items-center"
        style={{ animationDelay: "90ms" }}
      >
        <h1
          className="font-display leading-[1.02] text-gray-1"
          style={{
            fontSize: "clamp(2rem, 8vw, 3.4rem)",
            letterSpacing: "clamp(0.12rem, 0.5vw, 0.34rem)",
          }}
        >
          OTD <span className="text-command-gold">Academy</span>
        </h1>
        <span
          className="mt-3.5 font-mono text-[11px] uppercase text-gray-3"
          style={{ letterSpacing: "0.32em" }}
        >
          Secure Access
        </span>
        <p className="mt-5 font-serif text-base italic text-gold-dim sm:text-lg">
          Build real hardware.
        </p>
      </div>

      {/* Signature hairline — draws in on load, echoing the viz loading bar. */}
      <div
        aria-hidden
        className="signin-rise z-10 h-px w-[120px] overflow-hidden bg-bg-3"
        style={{ animationDelay: "150ms" }}
      >
        <div className="signin-bar-fill h-full bg-command-gold" />
      </div>

      {checkEmail ? (
        <div
          className="signin-rise z-10 flex w-full max-w-sm flex-col items-center gap-4"
          style={{ animationDelay: "210ms" }}
        >
          {/* kicker — matches the Design-Stages "// LINK SENT" status motif */}
          <div className="flex w-full items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-command-gold/30" />
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.28em] text-command-gold">
              // Link sent
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-command-gold/30" />
          </div>
          <h2 className="font-display text-3xl leading-none tracking-[0.12em] text-gray-1 sm:text-4xl">
            Check your inbox
          </h2>
          <p className="font-serif text-base italic leading-relaxed text-gold-dim">
            We sent a single-use sign-in link to your email.
            <br />
            It expires in 24&nbsp;hours.
          </p>
          <a
            href="/sign-in"
            className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-gray-3 transition-colors hover:text-command-gold"
          >
            &larr; Use another method
          </a>
        </div>
      ) : (
        <div
          className="signin-rise z-10 flex w-full max-w-xs flex-col gap-4"
          style={{ animationDelay: "210ms" }}
        >
          {/* section kicker — the Design-Stages kicker + hairline motif */}
          <div className="flex items-center gap-3" aria-hidden>
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-gold-dim">
              // Select access
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-command-gold/30 to-transparent" />
          </div>

          {/* Primary — Google */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="glass-button glass-button-cta flex w-full items-center gap-3 px-4 py-3 font-mono text-sm uppercase tracking-[0.16em]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                <GoogleMark className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 text-center">Continue with Google</span>
              <span className="w-5" aria-hidden />
            </button>
          </form>

          {/* Secondary — GitHub */}
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="glass-button group flex w-full items-center gap-3 px-4 py-3 font-mono text-sm uppercase tracking-[0.16em]"
            >
              <GitHubMark className="h-4 w-4 shrink-0 transition-colors group-hover:text-deep-space" />
              <span className="flex-1 text-center">Continue with GitHub</span>
              <span className="w-4" aria-hidden />
            </button>
          </form>

          {/* divider */}
          <div className="flex items-center gap-3 py-0.5" aria-hidden>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-command-gold/25" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
              or email a link
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-command-gold/25" />
          </div>

          {/* Magic-link */}
          <form
            className="flex flex-col gap-2.5"
            action={async (formData: FormData) => {
              "use server";
              const email = formData.get("email");
              if (typeof email === "string" && email.length > 0) {
                await signIn("resend", { email, redirectTo: "/" });
              }
            }}
          >
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-gray-3"
              >
                @
              </span>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded border border-command-gold/20 bg-deep-space/40 py-3 pl-9 pr-3 font-mono text-sm text-gray-1 placeholder:text-gray-3 focus:border-command-gold/70 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="glass-button w-full px-7 py-3 font-mono text-sm uppercase tracking-[0.18em]"
            >
              Email me a link
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
