"use client";

// The collapsed navigation menu — the header's rightmost control when the inline
// row does not fit, and ONLY then.
//
// It carries the WHOLE link set, not an overflow remainder. A menu that holds
// "the rest" makes the visitor learn which links live where at which width;
// holding all of them means the menu answers "where can I go" the same way every
// time.
//
// IT SITS BESIDE THE ACCOUNT MENU when signed in, and that is deliberate: this
// one answers "where can I go", the account menu answers "what about me". Two
// short lists beat one long one, and the account menu keeps the shape it has on
// every wide screen.
//
// NO usePathname(). The fallback view renders in the prerendered app shell,
// which is shared across every route and therefore has no URL; calling it there
// fails the build under cacheComponents (the same trap documented in MainNav).
// The active route is instead read from `window.location` when the panel OPENS,
// which is both always-fresh and impossible to evaluate at prerender time.
//
// TWO ENTRY POINTS, mirroring MainNav: HeaderMenuStatic is the Suspense fallback
// (anonymous link set, no request data), HeaderMenu is the island that knows the
// visitor's role. The button is identical either way, so the swap moves nothing.
//
// The panel's links are mounted only while it is open. The static shell already
// ships every one of them in the inline row (MainNavStatic), so rendering them
// here as well would duplicate the header's internal links in the markup for no
// reader and no crawler.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  collapsedMenuClass,
  isNavActive,
  visibleNavLinks,
  type NavLink,
} from "@/lib/nav-links";

/** Panel shape. `card` is a hairline dropdown pinned to the button; `sheet`
 *  spans the header's full width and drops from its bottom edge. */
export type MenuPanel = "card" | "sheet";

const BARS = (
  <svg
    viewBox="0 0 24 24"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    aria-hidden
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const CLOSE = (
  <svg
    viewBox="0 0 24 24"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    aria-hidden
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** Prerender-safe: no request data, so it is legal in the static shell / a
 *  Suspense fallback. Anonymous link set. */
export function HeaderMenuStatic({ panel = "card" }: { panel?: MenuPanel }) {
  return <HeaderMenuView links={visibleNavLinks(null, false)} panel={panel} />;
}

export function HeaderMenu({
  role,
  signedIn,
  panel = "card",
}: {
  role?: string | null;
  signedIn?: boolean;
  panel?: MenuPanel;
}) {
  return (
    <HeaderMenuView links={visibleNavLinks(role, signedIn)} panel={panel} />
  );
}

function HeaderMenuView({
  links,
  panel,
}: {
  links: readonly NavLink[];
  panel: MenuPanel;
}) {
  const [open, setOpen] = useState(false);
  const [pathname, setPathname] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  const toggle = () => {
    setPathname(window.location.pathname);
    setOpen((o) => !o);
  };

  return (
    // `relative` for the card variant only: the sheet's panel is meant to escape
    // to the header (the nearest positioned ancestor, since the header is
    // sticky) and span its full width.
    <div
      ref={ref}
      className={`${panel === "card" ? "relative " : ""}${collapsedMenuClass(links.length)}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Menu"}
        className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70 ${
          open
            ? "border-command-gold bg-command-gold/[0.06] text-command-gold"
            : "border-panel-border text-command-gold hover:border-command-gold/60 hover:text-gold-light"
        }`}
      >
        {open ? CLOSE : BARS}
      </button>

      {open ? (
        <nav
          aria-label="Primary"
          className={
            panel === "card"
              ? "absolute right-0 top-full z-40 mt-2 w-52 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-panel-border bg-deep-space shadow-[var(--elev-card)]"
              : "absolute inset-x-0 top-full z-40 border-b border-panel-border bg-deep-space shadow-[var(--elev-card)]"
          }
        >
          {links.map((link, i) => {
            const active = isNavActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-command-gold/[0.06] hover:text-gold-light focus-visible:bg-command-gold/[0.08] focus-visible:text-gold-light focus-visible:outline-none ${
                  i === 0 ? "" : "border-t border-panel-border/40"
                } ${active ? "text-command-gold" : "text-text"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
