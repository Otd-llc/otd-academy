import { Suspense } from "react";

import { AppHeader } from "@/components/chrome/AppHeader";
import { AppFooter } from "@/components/chrome/AppFooter";

// Every route that wears the app-shell chrome. The group name is parenthesised,
// so it adds NOTHING to any URL — `(chrome)/library/page.tsx` still serves
// /library. It exists purely to give these routes a shared layout.
//
// This is what fixed the CLS the Cache Components migration shipped with. Chrome
// used to be decided at request time (an `x-pathname` header set by the
// middleware, read by the header/footer), which meant the prerendered shell
// could not know whether chrome applied to the route — so it rendered
// `<Suspense fallback={null}>` and the header swapped in ABOVE the content after
// it had already painted. Membership in this directory is known at BUILD time,
// so the header is in the first flush and nothing moves.
//
// Keep this component SYNCHRONOUS. Awaiting anything here — a session, a cookie,
// a DB row — would block prerendering for all ~50 routes underneath it, which is
// exactly the bug the migration found in the root layout. Request-time data goes
// in an island behind a <Suspense> boundary, never up here.
export default function ChromeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppHeader />

      {/* `flex-1` lets the footer settle at the bottom on short pages. */}
      <div className="flex-1">
        {/* The page-level dynamic boundary. It sits HERE rather than around
            {children} in the root layout, and that move is the entire fix: a
            boundary in the root layout would wrap this whole layout, chrome
            included, so the header would go on streaming in behind the page and
            the route groups would have bought nothing.

            Nearly every page reads the session, so few can prerender their own
            content; this boundary is what lets the shell (chrome + backdrop)
            prerender while the page streams. The Neon-egress win does NOT come
            from here — it comes from `use cache` on the user-independent loaders.
            A page wanting a real static shell of its own adds an inner <Suspense>
            around just its dynamic parts; this is the floor, not the ceiling.

            fallback={null} preserves the existing behaviour (the page appears
            when ready) rather than flashing a skeleton on every navigation. */}
        <Suspense fallback={null}>{children}</Suspense>
      </div>

      <AppFooter />
    </>
  );
}
