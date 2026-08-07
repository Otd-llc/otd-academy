// The primary link set, and the rule for when it fits inline.
//
// Extracted from MainNav because THREE surfaces now render the same links: the
// inline header nav, the collapsed hamburger panel, and (when signed in) the
// account menu. A second copy in any of them is a link that silently goes stale.
//
// WHY A CONTAINER QUERY AND NOT A VIEWPORT BREAKPOINT. The set is not a fixed
// width: an anonymous visitor sees 6 links, a learner 7, an admin 9. One
// viewport breakpoint tuned for the longest set would strip the inline nav off
// every anonymous visitor's 1024px laptop for links they do not have; one tuned
// for the shortest would wrap an admin's header onto a second row, which is the
// exact waste this pass removes. So the threshold is chosen PER COUNT, and it is
// a container query so the sandbox can render the real header at a real width
// inside a narrow box and get the real behaviour.
//
// The classes are whole literal strings on purpose. Tailwind scans source text,
// so a composed `@min-[${n}rem]:flex` would never be generated.

export type NavLink = { href: string; label: string; adminOnly: boolean };

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Projects", adminOnly: true },
  { href: "/curriculum", label: "Curriculum", adminOnly: true },
  { href: "/courses", label: "Courses", adminOnly: false },
  { href: "/pricing", label: "Pricing", adminOnly: false },
  { href: "/library", label: "Library", adminOnly: false },
  { href: "/tools", label: "Tools", adminOnly: false },
  { href: "/learn", label: "Learn", adminOnly: false },
  { href: "/parts", label: "Parts", adminOnly: false },
  // Points at the academy's own /hex page, NOT straight out to the
  // configurator. The whole strategy is maker -> academy, and a nav item that
  // fires a visitor to another domain is a leak in the one place every page
  // carries. /hex explains the standard, serves the downloads and carries the
  // configurator CTA, so the click still gets there, one step later and
  // measurable (the CTA is instrumented; a raw external nav link would not be).
  { href: "/hex", label: "Hex", adminOnly: false },
] as const;

export function visibleNavLinks(
  role?: string | null,
  signedIn?: boolean,
): NavLink[] {
  const isAdmin = role === "ADMIN";
  return NAV_LINKS.filter((link) => {
    // Admin-only links (Projects / Curriculum) show only for ADMINs.
    if (link.adminOnly && !isAdmin) return false;
    // Learn is the personal dashboard -- hide it from anonymous visitors.
    if (link.href === "/learn" && !signedIn) return false;
    return true;
  });
}

// `pathname` is null in the static shell, where the URL is not knowable -- then
// nothing is highlighted, which is the correct answer rather than a guess.
export function isNavActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  if (href === "/") {
    // The dashboard owns "/" and the whole project tree.
    return pathname === "/" || pathname.startsWith("/projects");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Where the inline nav starts fitting, per link count.
 *
 * Measured against the real faces (Space Mono 12px at 0.05em tracking is about
 * 7.8px a character), plus the brand lockup, the right cluster and the header's
 * own padding, then rounded up a notch for slack. Anything not in the table
 * falls back to the widest threshold, which fails safe: the links are still one
 * tap away in the menu.
 */
const NAV_FIT: Record<number, { inline: string; collapsed: string }> = {
  6: { inline: "hidden @min-[52rem]:flex", collapsed: "@min-[52rem]:hidden" },
  7: { inline: "hidden @min-[56rem]:flex", collapsed: "@min-[56rem]:hidden" },
  8: { inline: "hidden @min-[62rem]:flex", collapsed: "@min-[62rem]:hidden" },
  9: { inline: "hidden @min-[68rem]:flex", collapsed: "@min-[68rem]:hidden" },
};

const NAV_FIT_FALLBACK = {
  inline: "hidden @min-[68rem]:flex",
  collapsed: "@min-[68rem]:hidden",
};

/** The counts with a measured threshold. Exported so a test can assert the
 *  table still covers every set `visibleNavLinks` can return -- an uncovered
 *  count falls back silently, and the only symptom is a whole class of viewport
 *  losing its inline nav for no reason. */
export const NAV_FIT_COUNTS: number[] = Object.keys(NAV_FIT).map(Number);

/** The class that reveals the inline nav once it fits. */
export function inlineNavClass(count: number): string {
  return (NAV_FIT[count] ?? NAV_FIT_FALLBACK).inline;
}

/** The mirror: the class that hides the collapsed menu once the nav fits. */
export function collapsedMenuClass(count: number): string {
  return (NAV_FIT[count] ?? NAV_FIT_FALLBACK).collapsed;
}
