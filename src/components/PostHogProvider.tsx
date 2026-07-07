"use client";

// Client-side PostHog bootstrap + SPA pageview capture.
//
// This is a thin "use client" island mounted once in the root layout (a server
// component, so it cannot init posthog-js directly). It is a NO-OP whenever
// NEXT_PUBLIC_POSTHOG_KEY is unset: posthog is never initialized and no
// pageviews are captured — so an unconfigured local/CI build never phones home.
//
// App Router note: posthog-js' automatic `$pageview` does not fire on
// client-side route changes (there's no full navigation), so we disable its
// built-in capture and emit `$pageview` ourselves on every pathname/search
// change. `children` pass straight through — this provider adds no DOM wrapper.

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import posthog from "posthog-js";
import { env } from "@/env";

const POSTHOG_KEY = env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = env.NEXT_PUBLIC_POSTHOG_HOST;

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return; // analytics disabled → never init
    if (posthog.__loaded) return; // guard double-init (Fast Refresh / re-mount)
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // We emit $pageview ourselves on route change (see PageviewTracker), so
      // disable the automatic one — it misses App Router client navigations.
      capture_pageview: false,
      // $pageleave is still useful for bounce/dwell and needs no router hook.
      capture_pageleave: true,
    });
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
