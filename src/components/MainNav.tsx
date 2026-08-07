"use client";

// Primary app navigation, INLINE ONLY — Projects / Curriculum (admin) + Courses
// / Pricing / Library / Tools / Parts / Hex (all) + Learn (signed-in only).
//
// A tiny `"use client"` island so it can read `usePathname()` and highlight the
// active route in `text-command-gold` (the rest stay muted with a gold hover).
//
// Audience: the operator surfaces (Projects / Curriculum) are admin-only — gated
// at the route level (proxy.ts), so showing them to a learner would just bounce
// them to /learn; we hide those unless `role` is ADMIN. The Courses index and the
// Parts catalog are PUBLIC (read-only for everyone), so those links show for all,
// including anonymous visitors. Learn is each user's own dashboard, so it only
// shows once `signedIn`. The link set + the active rule live in
// `@/lib/nav-links`, shared with the collapsed menu and the account menu.
//
// SHAPE: one row, always. This component renders the inline row and NOTHING
// else — when the row does not fit it is simply absent, and the same links are
// in the header's collapsed menu (HeaderMenu) instead. It used to carry its own
// hamburger plus a one-line clipped row with a fade mask, which let the header
// wrap to a second full-width row on anything narrow.
//
// The fit threshold is a CONTAINER query keyed to the link count — see
// `inlineNavClass` for why it is neither a viewport breakpoint nor a measurement.
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

import {
  inlineNavClass,
  isNavActive,
  visibleNavLinks,
  type NavLink,
} from "@/lib/nav-links";

// Prerender-safe: no request data, so it is legal in the static shell / a Suspense
// fallback. Anonymous link set, nothing highlighted.
export function MainNavStatic({ className }: { className?: string }) {
  return (
    <MainNavView
      className={className}
      links={visibleNavLinks(null, false)}
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
      links={visibleNavLinks(role, signedIn)}
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
  links: readonly NavLink[];
  pathname: string | null;
}) {
  return (
    <nav
      aria-label="Primary"
      className={`${inlineNavClass(links.length)} items-center gap-x-5 font-mono text-xs uppercase tracking-wider${
        className ? ` ${className}` : ""
      }`}
    >
      {links.map((link) => {
        const active = isNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none ${
              active ? "text-command-gold" : "text-muted"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
