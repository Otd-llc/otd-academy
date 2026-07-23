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

export function ConsentProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConsentManagerProvider options={{ mode: "offline" }}>
      <ConsentBridge />
      <ConsentBanner />
      {children}
    </ConsentManagerProvider>
  );
}
