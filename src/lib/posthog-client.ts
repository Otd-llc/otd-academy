// Lazy posthog-js loader + init, shared by every client-side capture path.
//
// posthog-js is ~55 KB gzip and used to sit in the shared first-load JS of
// EVERY route (PostHogProvider imported it top-level from the root layout).
// Loading it behind a dynamic import keeps it off the critical bundle — the
// SEO-facing pages (library, guide, tools) ship without it and the import
// resolves after hydration.
//
// Init lives INSIDE the loader so any capture chained on getPosthog() is
// guaranteed to run post-init (the old top-level pattern silently dropped
// captures that fired before PostHogProvider's effect ran). `autocapture` is
// OFF: the funnel events we chart are all explicit (analytics-client.ts /
// analytics.ts), and default autocapture on a content-heavy site is pure
// ingest volume.
//
// Resolves null when analytics is disabled (no key) — callers optional-chain.
import { env } from "@/env";
import type { PostHog } from "posthog-js";

let loader: Promise<PostHog | null> | null = null;

export function getPosthog(): Promise<PostHog | null> {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return Promise.resolve(null);
  loader ??= import("posthog-js").then((m) => {
    const ph = m.default;
    if (!ph.__loaded) {
      ph.init(key, {
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
        // We emit $pageview ourselves on route change (PostHogProvider) — the
        // automatic one misses App Router client navigations.
        capture_pageview: false,
        // $pageleave is still useful for bounce/dwell.
        capture_pageleave: true,
        autocapture: false,
      });
    }
    return ph;
  });
  return loader;
}
