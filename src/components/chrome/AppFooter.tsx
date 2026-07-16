// App-shell footer. Split out of the root layout for Cache Components: its CONTENT
// is fully static, but whether it renders at all depends on the session + the route
// (shouldRenderChrome), so the gate is request-time and the whole thing streams in
// behind a <Suspense> boundary. Keeping it here lets the root layout stay a static,
// prerenderable shell.
import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { shouldRenderChrome } from "@/lib/chrome";
import { BrandMark } from "@/components/BrandMark";
import { SOCIAL_LINKS } from "@/lib/seo/jsonld";
import { XIcon, YouTubeIcon, GitHubIcon, LinkedInIcon } from "@/components/icons";

export async function AppFooter() {
  // Only the signed-in flag is needed here (no name/avatar), and auth() decodes the
  // JWT session cookie rather than hitting the DB, so this second call is cheap.
  const session = await auth();
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!shouldRenderChrome({ pathname, signedIn: !!session?.user?.email })) return null;

  return (
    <footer className="relative overflow-hidden border-t border-panel-border/60 bg-deep-space print:hidden">
      <div className="relative z-0 mx-auto max-w-6xl px-6 py-10">
        {/* Brand-icon watermark: gradient-alpha (135deg from top-left, fades
            to the resting 0.10), behind the colophon. On desktop it bleeds off
            the right edge, vertically centered; on mobile it tucks down into
            the empty bottom-right space so it never sits behind the columns. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[14%] right-[2%] w-[60%] max-w-[440px] sm:bottom-auto sm:right-[-8%] sm:top-1/2 sm:w-[46%] sm:max-w-[640px] sm:-translate-y-1/2"
          style={{
            zIndex: -1,
            opacity: 0.25,
            color: "var(--color-command-gold)",
            WebkitMaskImage: "linear-gradient(135deg, #000 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.4) 100%)",
            maskImage: "linear-gradient(135deg, #000 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.4) 100%)",
          }}
        >
          <BrandMark className="h-auto w-full" />
        </div>

        <Link href="/" aria-label="One Thousand Drones home" className="inline-flex items-center gap-2.5">
          <BrandMark className="h-6 w-6 text-command-gold" />
          <span className="font-display text-2xl tracking-[0.2em] text-title">ONE THOUSAND DRONES</span>
        </Link>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">One mind, many machines.</p>

        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
          {[
            { label: "Learn", links: [["Courses", "/courses"], ["Library", "/library"], ["Glossary", "/glossary"], ["Tools", "/tools"]] },
            { label: "Catalog", links: [["Parts", "/parts"], ["Briefs", "/briefs"]] },
            { label: "Account", links: [["Sign in", "/sign-in"], ["Pricing", "/pricing"], ["Verify", "/verify"], ["License", "/license"]] },
          ].map((g) => (
            <nav key={g.label} className="flex flex-col items-start gap-2" aria-label={g.label}>
              <span className="font-display text-sm tracking-[0.1em] text-command-gold">{g.label}</span>
              {g.links.map(([label, href]) => (
                <Link key={label} href={href} className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none">
                  {label}
                </Link>
              ))}
            </nav>
          ))}
          <nav className="flex flex-col items-start gap-2" aria-label="One Thousand Drones">
            <span className="font-display text-sm tracking-[0.1em] text-command-gold">Company</span>
            {[
              ["Main site", "https://onethousanddrones.com"],
              ["About", "https://onethousanddrones.com/about"],
              ["Contact", "https://onethousanddrones.com/contact"],
            ].map(([label, href]) => (
              <a key={label} href={href} rel="noopener" className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none">
                {label} <span className="text-signal-blue">↗</span>
              </a>
            ))}
          </nav>
          <div className="flex flex-col items-start gap-2">
            <span className="font-display text-sm tracking-[0.1em] text-command-gold">Registry</span>
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-gray-3">
              Broken Arrow, OK · USA
              <br />
              SAM.gov Registered · CAGE 1ZYS4
              <br />
              UEI WDQXD9L9UFH3
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-panel-border/60 pt-4 sm:relative sm:flex-row sm:justify-center">
          <ul className="flex items-center gap-5 sm:absolute sm:left-0" aria-label="One Thousand Drones on social media">
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
                  className="inline-flex text-command-gold transition-colors hover:text-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                >
                  <Icon className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-3">© 2026 One Thousand Drones, LLC</p>
        </div>
      </div>
    </footer>
  );
}
