import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/env";
import { shouldRenderChrome } from "@/lib/chrome";
import { avatarSrc } from "@/lib/effective-avatar";
import { BrandMark } from "@/components/BrandMark";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd, SOCIAL_LINKS } from "@/lib/seo/jsonld";
import { XIcon, YouTubeIcon, GitHubIcon, LinkedInIcon } from "@/components/icons";
import { MainNav } from "@/components/MainNav";
import { PostHogProvider } from "@/components/PostHogProvider";
import { RememberLastUser } from "@/components/auth/RememberLastUser";
import { SignUpCta } from "@/components/SignUpCta";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TooltipProvider } from "@/components/TooltipProvider";
import { UserMenu } from "@/components/UserMenu";

// No-flash theme bootstrap — a parser-blocking inline <head> script that runs
// before first paint so the token override is applied immediately (no dark
// flash for a light visitor). Precedence: explicit choice (the `theme` cookie,
// which SSR already read; then localStorage) → `prefers-color-scheme`. SSR
// defaults <html data-theme> to "dark" when no cookie is set; this flips it
// pre-paint for a no-cookie visitor who prefers light, and `suppressHydration
// Warning` on <html> absorbs that one-attribute difference. See ThemeToggle.
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
  const name = session?.user?.name ?? null;
  const providerImage = session?.user?.image ?? null;

  // The middleware forwards the request path as `x-pathname` (src/proxy.ts) so
  // this Server Component can decide whether to render the app-shell chrome:
  // always for signed-in users, plus anonymous visitors on PUBLIC routes (the
  // SEO funnel), never on /sign-in. Anonymous chrome swaps the UserMenu for a
  // sign-up CTA.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const renderChrome = shouldRenderChrome({ pathname, signedIn: !!email });

  // Resolve the theme server-side so the SSR HTML matches the client (no
  // hydration mismatch). The device `theme` cookie wins (most recent choice on
  // THIS device, and it keeps the no-flash script in sync). For a signed-in
  // visitor with no cookie yet (a new device / after a cookie reset) fall back
  // to their stored account preference, so the choice follows the account. Dark
  // is the final default; the no-flash inline script then applies
  // `prefers-color-scheme` for a brand-new anonymous visitor before first paint.
  const cookieTheme = (await cookies()).get("theme")?.value;
  // One lookup for a signed-in visitor: the theme fallback + the avatar (user id +
  // custom-avatar flag). The effective avatar is the custom upload when set, else
  // the sign-in provider image, else null (the menu then shows the initial).
  const account = email
    ? await db.user
        .findUnique({
          where: { email },
          select: { id: true, theme: true, avatarUpdatedAt: true },
        })
        .catch(() => null)
    : null;
  let theme: "light" | "dark" =
    cookieTheme === "light" ? "light" : cookieTheme === "dark" ? "dark" : "dark";
  if (!cookieTheme && (account?.theme === "light" || account?.theme === "dark")) {
    theme = account.theme;
  }
  const image = account
    ? avatarSrc(account.id, account.avatarUpdatedAt, providerImage)
    : providerImage;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  // Persist the theme choice to the signed-in user's account (a no-op for
  // anonymous visitors — the cookie/localStorage already carry the device
  // choice). Passed to ThemeToggle only when signed in.
  async function saveThemeAction(next: "light" | "dark") {
    "use server";
    if (next !== "light" && next !== "dark") return;
    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) return;
    await db.user
      .update({ where: { email: userEmail }, data: { theme: next } })
      .catch(() => {});
  }

  return (
    <html
      lang="en"
      data-theme={theme}
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
          {/* Remember the signed-in identity on-device so a later signed-OUT
              visit can offer the C1 "welcome back" fast-path. Renders nothing. */}
          {email ? (
            <RememberLastUser email={email} name={name} image={image} />
          ) : null}
          {/* Site-wide Organization node (name + url + sameAs social profiles).
              Unconditional (every page, chrome or not) so the entity signal is
              consistent across the whole site. */}
          <JsonLd data={organizationJsonLd()} />
          {renderChrome ? (
            // App-shell chrome renders for signed-in users plus anonymous
            // visitors on PUBLIC routes (the SEO funnel); `/sign-in` stays a
            // clean full-bleed boot screen (shouldRenderChrome returns false).
            // Header is `z-40` so it (and its account / hamburger dropdowns) sits
            // ABOVE the guide layer (rail / meter / resume pill at `z-30`), while
            // staying below the `z-50` tooltips that portal above it. The two
            // dropdowns order among themselves inside this context (account >
            // hamburger).
            <header className="app-shell-header sticky top-0 z-40 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-panel-border bg-deep-space px-4 py-2 print:hidden sm:px-6">
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

              {/* Right cluster. Signed in: the email menu (sign-out lives inside
                  it now — no redundant standalone header sign-out). Anonymous
                  (public routes): a sign-up CTA in place of the menu. */}
              <div className="ml-auto flex items-center gap-3">
                {/* Theme toggle lives in the right cluster — always visible at
                    every breakpoint (the cluster never collapses), so it's the
                    one always-reachable home on mobile too. Signed-in visitors
                    persist the choice to their account. */}
                <ThemeToggle onPersist={email ? saveThemeAction : undefined} />
                {email ? (
                  <UserMenu
                    email={email}
                    name={name}
                    image={image}
                    role={role}
                    signOutAction={signOutAction}
                  />
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
                {/* Large brand-icon watermark (the field-guide idea): bleeds off
                    the right edge on desktop, tucks bottom-right on mobile. Sits
                    behind the content (z-index below the colophon). */}
                <div className="foot-wm-bee" aria-hidden="true">
                  <BrandMark />
                </div>
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
                    <Link href="/tools">Tools</Link>
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
                  <div className="foot-group foot-group-reg">
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
                  <ul className="foot-social" aria-label="One Thousand Drones on social media">
                    {[
                      { href: SOCIAL_LINKS[0], label: "X", Icon: XIcon },
                      { href: SOCIAL_LINKS[1], label: "YouTube", Icon: YouTubeIcon },
                      { href: SOCIAL_LINKS[2], label: "GitHub", Icon: GitHubIcon },
                      { href: SOCIAL_LINKS[3], label: "LinkedIn", Icon: LinkedInIcon },
                    ].map(({ href, label, Icon }) => (
                      <li key={label}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`One Thousand Drones on ${label}`}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </a>
                      </li>
                    ))}
                  </ul>
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
