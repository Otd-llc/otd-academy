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
      {/* useSearchParams must sit under a Suspense boundary (App Router rule)
          so it doesn't opt the whole tree out of static rendering. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
