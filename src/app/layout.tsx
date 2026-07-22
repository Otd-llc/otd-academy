import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { env } from "@/env";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd } from "@/lib/seo/jsonld";
import { IdentityMemo } from "@/components/chrome/IdentityMemo";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ConsentProviders } from "@/components/chrome/ConsentProviders";
import { TooltipProvider } from "@/components/TooltipProvider";
import { FanfareProvider } from "@/components/logbook/Fanfare";

// No-flash theme bootstrap — a parser-blocking inline <head> script that runs
// before first paint so the token override is applied immediately (no dark
// flash for a light visitor). Precedence: explicit choice (the `theme` cookie,
// then localStorage) → `prefers-color-scheme`.
//
// Under Cache Components this script is the ONLY theme resolver. The shell is
// prerendered, so `<html data-theme>` cannot read a cookie or the session — it ships
// as the "dark" default below and this script flips it pre-paint.
//
// That covers the device paths (cookie, localStorage, OS preference) but NOT the
// signed-in ACCOUNT preference, which used to be a server-side DB read here and which
// no client script can replicate. `User.theme` is therefore stamped onto the device as
// a `theme` cookie at sign-in (see the signIn event in src/auth.ts) — that is what
// keeps the preference following the account to a new device.
//
// Do not mistake ThemeToggle's `getServerSnapshot()` returning "dark" for a licence to
// drop that: it exists to avoid a HYDRATION MISMATCH and says nothing about which
// theme is correct. It returned "dark" before this refactor too, while SSR was
// shipping data-theme="light" and delivering the right palette.
const THEME_BOOTSTRAP = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);var s=m?m[1]:localStorage.getItem('otd-theme');var t=s||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  // Absolute base for canonical / OG / Twitter URLs. OPTIONAL env var with a
  // prod-origin fallback so builds without NEXT_PUBLIC_SITE_URL set (local, CI)
  // never break — Next resolves all relative metadata URLs against this.
  metadataBase: new URL(
    env.NEXT_PUBLIC_SITE_URL ?? "https://academy.onethousanddrones.com",
  ),
  title: "One Thousand Drones Academy",
  description:
    "Learn electronics by designing and building real circuit boards, from schematic to first blink. Hands-on guides for KiCad, PCB layout, soldering, and bring-up.",
  // OG/Twitter defaults every page inherits. The root opengraph-image.tsx is
  // auto-wired as the default og:image (Next merges the file convention into
  // openGraph.images), so these just add the shared siteName + card type; a
  // route with its own opengraph-image overrides only the image.
  openGraph: {
    siteName: "One Thousand Drones Academy",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  // Google Search Console site verification (URL-prefix property). Emits
  // <meta name="google-site-verification" …> into <head>. Public token, safe to
  // commit; used instead of a DNS TXT record because academy.* already has a
  // CNAME → Vercel that a TXT cannot coexist with.
  verification: { google: "x_gLJh5sMNZPNLRweQ3vZ7A9kbm77IFOcQgmWbA92RU" },
};

// The static shell. Deliberately NOT async and free of top-level awaits: under
// cacheComponents anything this component reads (session, cookies, headers, DB)
// would block EVERY route from prerendering, since every page renders inside it.
//
// It is now ONLY the shell — <html>/<body>, the backdrop, the client providers,
// and the site-wide Organization node. The chrome moved down into the (chrome)
// route group, and so did the page-level <Suspense> boundary that used to wrap
// {children} here. That boundary could not stay: it wrapped whatever the groups
// render, chrome included, so the header streamed in behind the page content and
// shoved it down on every route. Each group now carries its own boundary.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        {/* Runs before the stylesheet applies — reconciles the resolved theme
            onto <html data-theme> so the light token override is in place
            before first paint. Inline + parser-blocking on purpose. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Global engineering-paper backdrop — a fixed isometric graph-paper
            field behind every page (CSS in globals.css, .app-backdrop). Purely
            decorative; pointer-events-none, hidden in print. */}
        <div className="app-backdrop" aria-hidden="true" />
        {/* One app-wide tooltip provider — hoisted here so every `<Tooltip>`
            renders only a `<Root>` beneath this shared context (hydration fix;
            see TooltipProvider / Tooltip). The provider is a client island; its
            server-rendered children pass straight through, and it adds no DOM
            wrapper so the body's flex column is preserved. */}
        {/* PostHog bootstrap + SPA pageview capture. A "use client" island
            sibling to TooltipProvider; a hard no-op when NEXT_PUBLIC_POSTHOG_KEY
            is unset (no init, no network), so unconfigured builds are unaffected.
            Adds no DOM wrapper, so the body's flex column is preserved. */}
        {/* Consent management (c15t, offline mode — localStorage, no backend).
            Wraps PostHogProvider so getPosthog() reads the analytics
            ("measurement") decision via ConsentBridge before it ever inits: an
            EU visitor is not tracked until they consent. One "use client"
            boundary (ConsentProviders) so the provider's React context is never
            evaluated server-side. */}
        <ConsentProviders>
        <PostHogProvider>
        <TooltipProvider>
        {/* Milestone fanfare. A pure client provider (no server data), so it sits
            in the static shell beside the other providers rather than inside a
            boundary. It adds no DOM wrapper, so the body's flex column survives. */}
        <FanfareProvider>
          {/* Site-wide Organization node (name + url + sameAs social profiles).
              Unconditional (every page, chrome or not) so the entity signal is
              consistent across the whole site. Static -- part of the shell. */}
          <JsonLd data={organizationJsonLd()} />
          {/* Refreshes the on-device "welcome back" identity. Session-scoped, so
              it streams behind its own boundary; it renders NO DOM, so a boundary
              here costs no layout shift. It stays in the root layout on purpose —
              it must keep firing on the chrome-free routes (/sign-in, /embed/*)
              too, which is why it did not follow the header into (chrome). */}
          <Suspense fallback={null}>
            <IdentityMemo />
          </Suspense>

          {/* The route groups render here: (chrome) supplies the header, footer,
              and the page-level dynamic boundary; (bare) supplies just the
              boundary. Deliberately NOT wrapped in a <Suspense> at this level —
              see the note above the component. */}
          {children}
        </FanfareProvider>
        </TooltipProvider>
        </PostHogProvider>
        </ConsentProviders>
      </body>
    </html>
  );
}
