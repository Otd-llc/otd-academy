import Image from "next/image";
import { signIn } from "@/auth";
import { InlineBanner } from "@/components/InlineBanner";

// Sign-in screen — full-viewport "boot" treatment matching the hex-viz
// loading screen at c:/zzz/otd/bioscale-viz/src/styles/loading.css.
// Centered brand mark over deep-space, pulse-glow gold accent, Bebas Neue
// title with clamp-sized type so it scales fluidly from phone portrait
// through desktop. Lora italic tagline below.
//
// Auth.js redirects rejected signIn attempts to `/sign-in?error=AccessDenied`.
// We render an alert-red Space Mono banner above the brand mark when that
// param is present — design §6 "clear reject screen" requirement for M3.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const denied = params.error === "AccessDenied";

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-deep-space px-4 py-10">
      {/* Subtle radial gold-glow behind the brand — emulates the inspector's
          inner highlight without needing a separate canvas. Pointer-events
          disabled so the form stays the focal target. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,rgba(200,150,62,0.08)_0%,transparent_55%)]"
      />

      {denied && (
        <div className="z-10 mb-8 w-full max-w-md">
          <InlineBanner variant="error">
            ACCESS DENIED — this email is not on the allowlist.
          </InlineBanner>
        </div>
      )}

      <div className="z-10 flex flex-col items-center text-center">
        {/* Brand mark — pulses opacity 0.35 ↔ 0.8 every 2.8s. Sized to
            match the hex viz loading screen (72px desktop / 60px mobile)
            so the foundry boot screen reads as a sibling experience. */}
        <Image
          src="/brand/1kd-icon.svg"
          alt="One Thousand Drones"
          width={72}
          height={72}
          priority
          className="animate-pulse-brand h-[60px] w-[60px] sm:h-[72px] sm:w-[72px]"
        />

        <h1
          className="mt-7 font-display text-gray-1"
          style={{
            fontSize: "clamp(2.25rem, 6.4vw, 4rem)",
            letterSpacing: "clamp(0.25rem, 0.9vw, 0.45rem)",
          }}
        >
          PROJECT <span className="text-command-gold">FOUNDRY</span>
        </h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.4em] text-gray-3">
          Hardware engineering · 9-stage workflow
        </p>
        <p className="mt-5 font-serif text-base italic text-gold-dim sm:text-lg">
          Where prototypes become production.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-10"
        >
          <button
            type="submit"
            className="glass-button glass-button-cta px-6 py-3 font-mono text-sm uppercase tracking-[0.2em]"
          >
            Sign in with Google
          </button>
        </form>

        {/* Hairline divider with gold fill — mirrors the loading-bar in the
            hex viz, here as a static accent rather than an animated progress
            bar. Width is small so it reads as a decorative seam. */}
        <div className="mt-12 h-px w-24 bg-gradient-to-r from-transparent via-command-gold to-transparent" />
      </div>
    </main>
  );
}
