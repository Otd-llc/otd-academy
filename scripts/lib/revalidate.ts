// Client for POST /api/cron/revalidate — how a script tells the DEPLOYMENT to
// drop the cache entries its write just made stale.
//
// WHY THIS EXISTS. `revalidateTag` only works inside a request context. A
// `scripts/*.ts` run has none, so a script physically cannot invalidate what it
// just changed. The surfaces those scripts feed are public and sitemapped (the
// guide hub, every stage page, /library, both sitemaps) and hold for an hour,
// expiring after a day. The sharpest case was the repo's own instructions:
// migration 20260715200000 tells you to run backfill-lesson-derived.ts, and
// following that exactly left /library showing `readingMinutes = 1` with nothing
// to grep for.
//
// CALLED AUTOMATICALLY by the live content writers (the authoring helper, the
// cluster seeds, the backfill, the archive import) rather than left to each
// author to remember — forgetting the line is precisely how the staleness
// existed in the first place.
//
// IT FIRES ONLY WHEN THE WRITE WENT TO PROD, decided by the same
// `isLocalDbUrl` the driver selection uses (src/lib/db-adapter.ts), so there is
// one definition of "is this local" in the repo. A run against foundry_dev has
// no deployment holding a cache, so pinging would be noise on every local seed.
//
// IT NEVER THROWS. A seed that wrote successfully must not report failure
// because a cache ping did not land; the fallback is only ever "the change
// appears within the hour", which is exactly the old behaviour.
import { isLocalDbUrl } from "@/lib/db-adapter";

/** Same default as `siteUrl()` in src/lib/seo/jsonld.ts. Override with
 *  REVALIDATE_URL to target a preview deployment. */
const DEFAULT_ORIGIN = "https://academy.onethousanddrones.com";

export type RevalidateRequest = {
  /** Broad tags: "mini-lessons" | "projects" | "parts". */
  tags?: string[];
  /** Mini-lesson slugs — scoped, so one lesson does not evict the library. */
  lessons?: string[];
  /** Project slugs whose guide content changed. */
  guides?: string[];
};

export async function revalidate(req: RevalidateRequest): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;

  // No DATABASE_URL, or a local one: nothing deployed is caching this write.
  if (!dbUrl || isLocalDbUrl(dbUrl)) return;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn(
      "[revalidate] wrote to a REMOTE database but CRON_SECRET is unset —" +
        " cache NOT invalidated. The change will appear within the hour.",
    );
    return;
  }

  const origin = process.env.REVALIDATE_URL ?? DEFAULT_ORIGIN;
  const url = new URL("/api/cron/revalidate", origin).toString();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      // 404 here means the secret did not match — the route answers 404 rather
      // than 401 so an unauthenticated caller learns nothing about it.
      console.warn(
        `[revalidate] ${new URL(url).host} answered ${res.status}.` +
          " Cache NOT invalidated; the change will appear within the hour.",
      );
      return;
    }
    console.log(`[revalidate] ${new URL(url).host} ok -> ${JSON.stringify(req)}`);
  } catch (err) {
    console.warn(
      "[revalidate] request failed; cache NOT invalidated, the change will" +
        " appear within the hour:",
      err instanceof Error ? err.message : err,
    );
  }
}
