"use client";

// Client-side PostHog bootstrap + SPA pageview capture.
//
// This is a thin "use client" island mounted once in the root layout (a server
// component, so it cannot init posthog-js directly). It is a NO-OP whenever
// NEXT_PUBLIC_POSTHOG_KEY is unset: posthog is never loaded and no pageviews
// are captured — so an unconfigured local/CI build never phones home.
//
// posthog-js itself loads LAZILY via getPosthog() (src/lib/posthog-client.ts),
// which also owns init — keeping ~55 KB gzip out of the shared first-load JS
// and guaranteeing captures chained on it run post-init.
//
// App Router note: posthog-js' automatic `$pageview` does not fire on
// client-side route changes (there's no full navigation), so autocapture of
// pageviews is disabled and we emit `$pageview` ourselves on every
// pathname/search change. `children` pass straight through — this provider
// adds no DOM wrapper.

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getPosthog } from "@/lib/posthog-client";

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    void getPosthog().then((ph) => ph?.capture("$pageview", { $current_url: url }));
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Kick the lazy load + init off the critical path (post-hydration).
    void getPosthog();
  }, []);

  return (
    <>
      {/* ====================================================================
          THE BUILD LOG PRINTS 31 SCARY ERRORS BECAUSE OF THIS. THEY ARE FINE.
          ====================================================================
          Every deploy logs ~31 of:

            Error: Bail out to client-side rendering: useSearchParams()
              at f (src/components/PostHogProvider.tsx:26:24)
              digest: 'BAILOUT_TO_CLIENT_SIDE_RENDERING'
            [Error: An error occurred in the Server Components render...]

          MEASURED 2026-08-18, so nobody has to spend an afternoon on it again:

          - The build EXITS 0 and no route fails to prerender.
          - There are exactly 31, all from THIS line, and there are exactly 31
            page routes under `src/app/sandbox/`. Not a coincidence:
            `(chrome)/layout.tsx` and `(bare)/layout.tsx` both wrap `{children}`
            in `<Suspense>`, and the root layout deliberately does not -- so
            `/sandbox/*` are the ONLY pages with no boundary above the page.
          - All 31 of those routes are DEV-ONLY (`notFound()` in production,
            see `src/lib/dev-only-routes.ts`). The noise comes entirely from
            pages that never serve to a user.

          WHY ONLY THOSE 31. Next has two prerender modes for this read, and
          they behave differently: under `prerender-client` (what a route group's
          boundary gives you) `useSearchParams` HANGS, producing a PPR hole and
          no error at all; under `prerender-ppr` / `prerender-legacy` it THROWS
          this sentinel instead (`dynamic-rendering.js`, the `BailoutToCSRError`
          branch). The boundary below catches the throw, the route still
          completes -- it is one of the 34 reported `(Static)` -- and the line
          gets printed on the way past. Which handler prints it was not chased
          down; the measured facts are that all 31 carry the `useSearchParams()`
          reason and this file's frame, and that the build is green.

          Zero of these lines is the FAILURE state, not the healthy one -- see
          below.

          ====================================================================
          THE <Suspense> BELOW IS LOAD-BEARING. MEASURED, NOT ASSUMED.
          ====================================================================
          Removing it does not merely add log noise: `next build` FAILS.

            Error: Route "/c/[shareCode]": Uncached data was accessed outside
            of <Suspense>. This delays the entire...
            Export encountered an error on /(bare)/c/[shareCode]/page

          `{children}` is a SIBLING of the boundary, not inside it, and that is
          the whole reason this app has a static shell. Move `{children}` in and
          the hanging read resolves every route's shell to `fallback={null}`,
          which flips them from partial-prerender to fully dynamic and deletes
          the caching programme in `docs/caching.md` in one edit. Wrapping this
          provider from the layout does the same thing, since the provider
          renders `{children}`.

          Do NOT "fix" it by hoisting a boundary above <body> either: that trips
          Next's `hasSuspenseAboveBody` escape hatch, which suppresses the
          "uncached data outside <Suspense>" validator for the WHOLE route. The
          lines would vanish and the condition would become unfindable.

          ====================================================================
          AND DO NOT DROP useSearchParams FOR window.location.search.
          ====================================================================
          It is tempting -- the effect only runs client-side, so the hook looks
          redundant, and `HexConfiguratorFrame` deliberately does exactly that.
          It does not work HERE, and the difference is worth stating because the
          two comments otherwise read as contradicting each other.

          That one is a MOUNT-ONLY read: it answers "was I deep-linked" once.
          This one has to re-fire on every navigation. `usePathname()` returns
          the same primitive string across a query-only navigation, and React
          compares effect deps with `Object.is`, so the effect would simply not
          run. `useSearchParams()` is the only thing here reacting to a query
          change -- it yields a fresh object identity per navigation.

          What that would actually cost: the whole `/parts` faceted browse
          (`?cat=`, `?q=`, `?page=`, `?mains=`), the home filter chips
          (`?track=`, `?level=`), `?board=` on guide stage cards, and
          `?show=archived` on the saved-clusters tabs. NOT `/hex` -- its
          `?open=`/`?build=` links arrive as cold loads or path changes, which
          is precisely why the mount-only read is correct over there.

          posthog-js' own `capture_pageview: 'history_change'` is not a
          substitute: it dedupes on `location.pathname` alone, so it has the
          identical blind spot. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
