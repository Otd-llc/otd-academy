"use client";

// Primary app navigation — Projects / Curriculum (admin) + Courses / Library /
// Parts (all) + Learn (signed-in only).
//
// A tiny `"use client"` island so it can read `usePathname()` and highlight the
// active route in `text-command-gold` (the rest stay muted with a gold hover).
//
// Audience: the operator surfaces (Projects / Curriculum) are admin-only — gated
// at the route level (proxy.ts), so showing them to a learner would just bounce
// them to /learn; we hide those unless `role` is ADMIN. The Courses index and the
// Parts catalog are PUBLIC (read-only for everyone), so those links show for all,
// including anonymous visitors. Learn is each user's own dashboard, so it only
// shows once `signedIn`.
//
// Active matching: the projects dashboard ("/") is the home for the whole
// `/projects/*` tree as well, so it stays active on any project detail route;
// "/curriculum" and "/parts" match their own prefixes.
//
// Mobile shape: the row is clipped to ONE line (a right fade hints at more) and a
// hamburger reveals the full nav in a dropdown card; from `sm` up the whole nav
// sits inline with no toggle. Keeps the mobile header a single tidy line instead
// of an unpredictable multi-row wrap.
//
// TWO ENTRY POINTS, because of what each one is allowed to read:
//
//   • MainNavStatic — no `usePathname()`, so it renders in the PRERENDERED shell.
//     The header uses it as the Suspense fallback, which means the nav LINKS are
//     in the first flush of every page (they are internal links; a crawler and a
//     first paint both want them there). It shows the anonymous link set with
//     nothing highlighted.
//   • MainNav — calls `usePathname()` to highlight the active route, and takes the
//     session-derived `role`/`signedIn`. Both are request data, so it may only
//     render inside a dynamic island.
//
// They share MainNavView, so the two render the same box and the fallback→island
// swap moves nothing. Do NOT put `usePathname()` back into the fallback path:
// under cacheComponents the build FAILS with "Uncached data was accessed outside
// of <Suspense>" — a Suspense fallback is part of the static shell, and the shell
// has no URL (one prerendered shell is shared across every [slug]).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Projects", adminOnly: true },
  { href: "/curriculum", label: "Curriculum", adminOnly: true },
  { href: "/courses", label: "Courses", adminOnly: false },
  { href: "/pricing", label: "Pricing", adminOnly: false },
  { href: "/library", label: "Library", adminOnly: false },
  { href: "/tools", label: "Tools", adminOnly: false },
  { href: "/learn", label: "Learn", adminOnly: false },
  { href: "/parts", label: "Parts", adminOnly: false },
] as const;

// `pathname` is null in the static shell, where the URL is not knowable — then
// nothing is highlighted, which is the correct answer rather than a guess.
function isActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  if (href === "/") {
    // The dashboard owns "/" and the whole project tree.
    return pathname === "/" || pathname.startsWith("/projects");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleLinks(role?: string | null, signedIn?: boolean) {
  const isAdmin = role === "ADMIN";
  return LINKS.filter((link) => {
    // Admin-only links (Projects / Curriculum) show only for ADMINs.
    if (link.adminOnly && !isAdmin) return false;
    // Learn is the personal dashboard — hide it from anonymous visitors.
    if (link.href === "/learn" && !signedIn) return false;
    return true;
  });
}

// Prerender-safe: no request data, so it is legal in the static shell / a Suspense
// fallback. Anonymous link set, nothing highlighted.
export function MainNavStatic({ className }: { className?: string }) {
  return (
    <MainNavView
      className={className}
      links={visibleLinks(null, false)}
      pathname={null}
    />
  );
}

export function MainNav({
  className,
  role,
  signedIn,
}: {
  className?: string;
  role?: string | null;
  signedIn?: boolean;
}) {
  return (
    <MainNavView
      className={className}
      links={visibleLinks(role, signedIn)}
      pathname={usePathname()}
    />
  );
}

function MainNavView({
  className,
  links,
  pathname,
}: {
  className?: string;
  links: readonly { href: string; label: string }[];
  pathname: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the mobile dropdown on Escape or an outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const tone = (active: boolean) => (active ? "text-command-gold" : "text-muted");

  return (
    <div ref={ref} className={`relative${className ? ` ${className}` : ""}`}>
      <nav
        aria-label="Primary"
        className="flex max-h-5 flex-wrap items-center gap-x-5 gap-y-1 overflow-hidden pr-9 font-mono text-xs uppercase tracking-wider [mask-image:linear-gradient(90deg,#000_84%,transparent)] sm:max-h-none sm:overflow-visible sm:pr-0 sm:[mask-image:none]"
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`transition-colors hover:text-command-gold ${tone(active)}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile-only toggle. Hidden from sm up, where the nav sits inline. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "More navigation"}
        className="absolute right-0 top-1/2 -translate-y-1/2 px-1 text-lg leading-none text-command-gold hover:text-gold-light focus-visible:outline-none sm:hidden"
      >
        {open ? "✕" : "≡"}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 min-w-44 overflow-hidden rounded-lg border border-panel-border bg-navy-dark shadow-[var(--elev-raise)] sm:hidden">
          {links.map((link, i) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-command-gold/[0.06] ${i === 0 ? "" : "border-t border-panel-border"} ${tone(active)}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
