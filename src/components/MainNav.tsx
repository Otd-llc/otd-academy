"use client";

// Primary app navigation — Projects / Curriculum / Parts (admin) + Learn (all).
//
// A tiny `"use client"` island so it can read `usePathname()` and highlight the
// active route in `text-command-gold` (the rest stay muted with a gold hover).
//
// Audience: the operator surfaces (Projects / Curriculum) are admin-only — gated
// at the route level (proxy.ts), so showing them to a learner would just bounce
// them to /learn; we hide those unless `role` is ADMIN. The Parts catalog is
// PUBLIC (read-only for everyone, edit is admin-only), so its link shows for all.
//
// Active matching: the projects dashboard ("/") is the home for the whole
// `/projects/*` tree as well, so it stays active on any project detail route;
// "/curriculum" and "/parts" match their own prefixes. The header keeps this
// visible at every breakpoint (it wraps rather than collapsing) so navigation
// is always reachable on small screens.

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Projects", adminOnly: true },
  { href: "/curriculum", label: "Curriculum", adminOnly: true },
  { href: "/learn", label: "Learn", adminOnly: false },
  { href: "/parts", label: "Parts", adminOnly: false },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    // The dashboard owns "/" and the whole project tree.
    return pathname === "/" || pathname.startsWith("/projects");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({
  className,
  role,
}: {
  className?: string;
  role?: string | null;
}) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";
  const links = LINKS.filter((link) => isAdmin || !link.adminOnly);

  return (
    <nav
      className={`flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-wider${
        className ? ` ${className}` : ""
      }`}
    >
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors hover:text-command-gold ${
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
