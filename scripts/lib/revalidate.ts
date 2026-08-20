// Client for POST /api/cron/revalidate — the way a script tells a DEPLOYMENT to
// drop the cache entries its write just made stale.
//
// A script runs outside any request context, so `updateTag`/`revalidateTag` are
// simply unavailable to it: grepping all 476 files under scripts/ finds zero
// calls, and that is a property of where they run, not an oversight. 156 script
// files write GuideCard and 11 write MiniLesson, feeding public sitemapped
// surfaces whose cache holds for an hour and expires after a day.
//
// USAGE, at the end of a seed that wrote to PROD:
//
//   import { revalidate } from "./lib/revalidate";
//   await revalidate({ lessons: ["ohms-law"], tags: ["mini-lessons"] });
//
// It reads REVALIDATE_URL (the deployment's origin, e.g.
// https://academy.onethousanddrones.com) and CRON_SECRET. With either unset it
// NO-OPS and says so — that is the normal case for a local run against
// foundry_dev, where there is no deployment holding a cache and failing would be
// noise. It never throws: a seed that wrote successfully must not report failure
// because a cache ping did not land, and the fallback is only ever "the change
// appears within the hour".
export type RevalidateRequest = {
  /** Broad tags: "mini-lessons" | "projects" | "parts". */
  tags?: string[];
  /** Mini-lesson slugs — scoped, so one lesson does not evict the library. */
  lessons?: string[];
  /** Project slugs whose guide content changed. */
  guides?: string[];
};

export async function revalidate(req: RevalidateRequest): Promise<void> {
  const base = process.env.REVALIDATE_URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.log(
      "[revalidate] REVALIDATE_URL or CRON_SECRET unset — skipping." +
        " (Expected for a local run; a PROD seed should set both.)",
    );
    return;
  }

  const url = new URL("/api/cron/revalidate", base).toString();
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
      // than 401 so an unauthenticated caller learns nothing.
      console.warn(
        `[revalidate] ${new URL(url).host} answered ${res.status}.` +
          " Cache NOT invalidated; the change will appear within the hour.",
      );
      return;
    }
    console.log(`[revalidate] ok → ${JSON.stringify(req)}`);
  } catch (err) {
    console.warn(
      "[revalidate] request failed; cache NOT invalidated, the change will" +
        " appear within the hour:",
      err instanceof Error ? err.message : err,
    );
  }
}
