// The ONE definition of the app's cache window, shared by every `use cache` reader
// and every `revalidateTag` writer. It exists so the two can never drift: Next 16
// requires revalidateTag(tag, profile), so the write side must name the same profile
// the read side was cached under, and a copy-pasted literal in four files would
// eventually disagree with itself.
//
// The owner specified a 1-HOUR window (2026-07-15).
//
// Written inline rather than as the named profile cacheLife("hours") on purpose: the
// built-in profiles' real numbers are documented only for "default" (5m stale / 15m
// revalidate), so "hours" could silently resolve to a window nobody chose. Inline
// keeps the intent on the page and the value auditable.
//
//   stale      3600  — serve stale for up to an hour while revalidating
//   revalidate 3600  — refresh in the background hourly
//   expire    86400  — hard ceiling; a tag-less entry can never outlive a day
//
// Consumers: src/lib/library/load.ts, src/lib/skill-tree.ts, src/app/sitemap.ts,
// src/lib/actions/mini-lesson.ts.
export const ONE_HOUR = {
  stale: 3600,
  revalidate: 3600,
  expire: 86_400,
} as const;
