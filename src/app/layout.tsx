import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import "katex/dist/katex.min.css";
import { env } from "@/env";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd } from "@/lib/seo/jsonld";
import { AppHeader } from "@/components/chrome/AppHeader";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PostHogProvider } from "@/components/PostHogProvider";
import { TooltipProvider } from "@/components/TooltipProvider";
import { FanfareProvider } from "@/components/logbook/Fanfare";

// No-flash theme bootstrap — a parser-blocking inline <head> script that runs
// before first paint so the token override is applied immediately (no dark
// flash for a light visitor). Precedence: explicit choice (the `theme` cookie,
// then localStorage) → `prefers-color-scheme`.
//
// Under Cache Components this script is now the ONLY theme resolver. The shell is
// prerendered, so `<html data-theme>` cannot read a cookie — it ships as the "dark"
// default and this script flips it pre-paint. That is exactly what the client
// already assumed: ThemeToggle's `getServerSnapshot()` returns "dark" and
// `suppressHydrationWarning` on <html> absorbs the one-attribute difference.
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
// The request-time chrome lives in AppHeader/AppFooter behind <Suspense>.
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
        <PostHogProvider>
        <TooltipProvider>
          {/* Site-wide Organization node (name + url + sameAs social profiles).
              Unconditional (every page, chrome or not) so the entity signal is
              consistent across the whole site. Static -- part of the shell. */}
          <JsonLd data={organizationJsonLd()} />
          {/* App-shell chrome. Both halves gate on the session + route
              (shouldRenderChrome), so they are request-time and stream in behind
              their own boundaries -- keeping the shell above prerenderable.
              fallback={null}: the shell cannot know whether chrome applies to this
              route, and /sign-in + /embed/* are chrome-free, so a skeleton here
              would flash chrome onto the pages that must never show it. */}
          <Suspense fallback={null}>
            <AppHeader />
          </Suspense>

          {/* `flex-1` lets the footer settle at the bottom on short pages. */}
          <div className="flex-1">
            <FanfareProvider>{children}</FanfareProvider>
          </div>

          <Suspense fallback={null}>
            <AppFooter />
          </Suspense>
        </TooltipProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
