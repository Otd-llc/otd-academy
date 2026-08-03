"use client";

// Client boundary around the c15t consent stack. The root layout is a server
// component, and `@c15t/nextjs`'s ConsentManagerProvider (React context) must be
// evaluated client-side — importing it directly into the server layout ran its
// createContext during build page-data collection ("createContext is not a
// function"). Re-exporting the whole stack from one "use client" module gives
// the RSC a single client child to render.
//
// Offline mode: consent state lives in localStorage, no backend. `measurement`
// (analytics) is opt-in by default, so PostHog stays dark until consent — the
// ConsentBridge mirrors that decision into getPosthog()'s gate.
import { ConsentManagerProvider, ConsentBanner } from "@c15t/nextjs";
// The banner's stylesheet. Without it the ConsentBanner renders UNSTYLED: raw
// text in document flow and the "Secured by c15t" logo SVG explodes to its
// natural size at the page bottom (shipped that way in #344; fixed here).
import "@c15t/nextjs/styles.css";
import { ConsentBridge } from "@/components/chrome/ConsentBridge";

// The categories this site actually uses, declared explicitly.
//
// THIS IS LOAD BEARING, and its absence was a silent, total failure. c15t only
// grants categories it has been told are ACTIVE, so with none declared,
// "Accept All" stored:
//
//   {"necessary":true,"functionality":false,"measurement":false,
//    "experience":false,"marketing":false}
//
// measurement stayed FALSE. PostHog is gated on measurement, so it never
// initialised: no cookie, no events, no distinct id, for anyone, ever. The
// banner dismissed itself and the visitor reasonably believed they had
// accepted. Verified against production on 2026-08-03, and it explains why
// nobody noticed NEXT_PUBLIC_POSTHOG_KEY was unset — analytics could not have
// worked even with it.
//
// It failed CLOSED, which is the right direction for a consent bug to fail in,
// but the banner was telling people something untrue.
//
// Only `necessary` and `measurement` are listed because they are the only two
// this site has: PostHog is the sole non-essential thing, and asking for
// consent to categories we do not use would be its own kind of dishonest.
const CONSENT_CATEGORIES = ["necessary", "measurement"] as const;

export function ConsentProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: [...CONSENT_CATEGORIES],
      }}
    >
      <ConsentBridge />
      <ConsentBanner />
      {children}
    </ConsentManagerProvider>
  );
}
