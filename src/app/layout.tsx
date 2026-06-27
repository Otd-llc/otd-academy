import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";
import { auth, signOut } from "@/auth";
import { env } from "@/env";
import { shouldRenderChrome } from "@/lib/chrome";
import { BrandMark } from "@/components/BrandMark";
import { MainNav } from "@/components/MainNav";
import { PostHogProvider } from "@/components/PostHogProvider";
import { SignUpCta } from "@/components/SignUpCta";
import { TooltipProvider } from "@/components/TooltipProvider";
import { UserMenu } from "@/components/UserMenu";

export const metadata: Metadata = {
  // Absolute base for canonical / OG / Twitter URLs. OPTIONAL env var with a
  // prod-origin fallback so builds without NEXT_PUBLIC_SITE_URL set (local, CI)
  // never break — Next resolves all relative metadata URLs against this.
  metadataBase: new URL(
    env.NEXT_PUBLIC_SITE_URL ?? "https://academy.onethousanddrones.com",
  ),
  title: "One Thousand Drones Academy",
  description: "Hardware design lifecycle tracker",
  // Google Search Console site verification (URL-prefix property). Emits
  // <meta name="google-site-verification" …> into <head>. Public token, safe to
  // commit; used instead of a DNS TXT record because academy.* already has a
  // CNAME → Vercel that a TXT cannot coexist with.
  verification: { google: "x_gLJh5sMNZPNLRweQ3vZ7A9kbm77IFOcQgmWbA92RU" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the session server-side so the UserMenu only renders for
  // signed-in users. `/sign-in` and `/api/auth/*` are excluded from the
  // middleware matcher (src/proxy.ts), so on those routes auth()
  // returns null and the menu stays hidden. `role` also drives MainNav: the
  // operator links (Projects / Curriculum) show for ADMINs only.
  const session = await auth();
  const email = session?.user?.email ?? null;
  const role = session?.user?.role ?? null;

  // The middleware forwards the request path as `x-pathname` (src/proxy.ts) so
  // this Server Component can decide whether to render the app-shell chrome:
  // always for signed-in users, plus anonymous visitors on PUBLIC routes (the
  // SEO funnel), never on /sign-in. Anonymous chrome swaps the UserMenu for a
  // sign-up CTA.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const renderChrome = shouldRenderChrome({ pathname, signedIn: !!email });

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
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
          {renderChrome ? (
            // App-shell chrome renders for signed-in users plus anonymous
            // visitors on PUBLIC routes (the SEO funnel); `/sign-in` stays a
            // clean full-bleed boot screen (shouldRenderChrome returns false).
            // Header is `z-20` so the sticky bar stays below the `z-50` tooltips
            // that portal above it.
            <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-panel-border bg-deep-space px-4 py-2 print:hidden sm:px-6">
              <Link
                href="/"
                aria-label="One Thousand Drones Academy home"
                className="group flex items-center gap-2"
              >
                <BrandMark className="h-6 w-6 shrink-0 text-command-gold transition-colors group-hover:text-gold-light" />
                <span className="font-display text-sm tracking-wider text-gray-1 sm:text-lg">
                  OTD <span className="text-command-gold">ACADEMY</span>
                </span>
              </Link>

              {/* On mobile the nav drops to its own full-width row below the
                  brand/user cluster (order-last + w-full); from sm up it sits
                  inline between them again. Keeps the top row cleanly
                  brand-left / avatar-right instead of wrapping unpredictably. */}
              <MainNav
                role={role}
                signedIn={!!email}
                className="order-last w-full sm:order-none sm:w-auto"
              />

              {/* Right cluster. Signed in: the explicit header sign-out (hidden
                  on mobile to declutter — the same action stays reachable inside
                  the UserMenu dropdown) + the email menu. Anonymous (public
                  routes): a sign-up CTA in place of the menu, and no sign-out. */}
              <div className="ml-auto flex items-center gap-3">
                {email ? (
                  <>
                    <form action={signOutAction} className="hidden sm:block">
                      <button
                        type="submit"
                        className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-command-gold"
                      >
                        Sign out
                      </button>
                    </form>
                    <UserMenu
                      email={email}
                      role={role}
                      signOutAction={signOutAction}
                    />
                  </>
                ) : (
                  <SignUpCta />
                )}
              </div>
            </header>
          ) : null}

          {/* `flex-1` lets the footer settle at the bottom on short pages. */}
          <div className="flex-1">{children}</div>

          {renderChrome ? (
            <footer className="app-footer print:hidden">
              <div className="foot-inner">
                <Link
                  href="/"
                  aria-label="One Thousand Drones home"
                  className="foot-brand"
                >
                  <BrandMark className="foot-bee" />
                  <span className="foot-wm">ONE THOUSAND DRONES</span>
                </Link>
                <p className="foot-tag">One mind, many machines.</p>

                <div className="foot-cols">
                  <nav className="foot-group" aria-label="Learn">
                    <span className="foot-gh">Learn</span>
                    <Link href="/courses">Courses</Link>
                    <Link href="/library">Library</Link>
                    <Link href="/glossary">Glossary</Link>
                  </nav>
                  <nav className="foot-group" aria-label="Catalog">
                    <span className="foot-gh">Catalog</span>
                    <Link href="/parts">Parts</Link>
                    <Link href="/briefs">Briefs</Link>
                  </nav>
                  <nav className="foot-group" aria-label="Account">
                    <span className="foot-gh">Account</span>
                    <Link href="/sign-in">Sign in</Link>
                    <Link href="/pricing">Pricing</Link>
                    <Link href="/verify">Verify</Link>
                    <Link href="/license">License</Link>
                  </nav>
                  <nav className="foot-group" aria-label="One Thousand Drones">
                    <span className="foot-gh">Company</span>
                    <a href="https://onethousanddrones.com" rel="noopener">
                      Main site <span className="ext">↗</span>
                    </a>
                    <a href="https://onethousanddrones.com/about" rel="noopener">
                      About <span className="ext">↗</span>
                    </a>
                    <a href="https://onethousanddrones.com/contact" rel="noopener">
                      Contact <span className="ext">↗</span>
                    </a>
                  </nav>
                  <div className="foot-group">
                    <span className="foot-gh">Registry</span>
                    <p className="foot-reg">
                      Broken Arrow, OK · USA
                      <br />
                      SAM.gov Registered · CAGE 1ZYS4
                      <br />
                      UEI WDQXD9L9UFH3
                    </p>
                  </div>
                </div>

                <div className="foot-end">
                  <p className="foot-copy">© 2026 One Thousand Drones, LLC</p>
                </div>
              </div>
            </footer>
          ) : null}
        </TooltipProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
