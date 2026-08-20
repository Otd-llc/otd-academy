// CRON_SECRET-guarded cache invalidation, for writers that cannot invalidate.
//
// THE PROBLEM THIS EXISTS FOR. `revalidateTag`/`updateTag` are only available
// inside a request context. Admin edits go through server actions and invalidate
// correctly (src/lib/cache-invalidate.ts). Scripts cannot: a `scripts/*.ts` run
// executes outside any request, so it has no way to reach the tag. Grepping all
// 476 files under scripts/ finds ZERO calls to updateTag or revalidateTag -- not
// an oversight, an impossibility.
//
// That silence has a size. 156 script files write GuideCard and 11 write
// MiniLesson, and the surfaces they feed are public and sitemapped: the guide
// hub, every stage page, /library, /sitemap.xml and /sitemap-images.xml. Their
// cache window is `stale`/`revalidate` 3600 with `expire` 86_400 -- so a seeded
// change can sit unseen for an hour, and up to a DAY if nothing touches it.
//
// The sharpest case is the repo's own instructions: migration
// 20260715200000_minilesson_derived_columns tells you to run
// scripts/backfill-lesson-derived.ts afterwards, and that script rewrites
// readingMinutes/questionCount/diagramSrc on every lesson. Following the
// documented procedure exactly left /library serving the placeholder defaults
// (readingMinutes = 1, questionCount = 0) with nothing to grep for.
//
// WHY IT LIVES UNDER /api/cron. Not because it is a cron -- nothing schedules
// it -- but because that prefix is already exempt from the middleware auth gate
// (see the matcher in src/proxy.ts) and already carries the CRON_SECRET
// convention and its constant-time check. Putting it anywhere else would mean
// widening the middleware matcher, which is a change with its own blast radius
// for a route that needs exactly the treatment /api/cron/* already gets.
//
// Deliberately NOT wired into the 156 writers here. Which scripts should call it,
// against which deployment, and whether a seed run should fail when the call
// fails are decisions with real consequences; this lands the endpoint they can
// call. `scripts/lib/revalidate.ts` is the client.
import { NextResponse } from "next/server";
import { updateTag } from "next/cache";
import { env } from "@/env";
import { cronAuthorized } from "@/lib/cron-auth";
import {
  TAG_MINI_LESSONS,
  TAG_PROJECTS,
  TAG_PARTS,
  miniLessonTag,
  guideContentTag,
} from "@/lib/cache-profile";

// Never prerendered: reads `authorization` off the request, which forces
// request-time execution on its own. Under cacheComponents dynamic is the
// default and a route-segment config is rejected outright.
export const maxDuration = 30;

/** The tags a caller may ask for, and how each maps onto the cache. */
const TARGETS = {
  "mini-lessons": () => updateTag(TAG_MINI_LESSONS),
  projects: () => updateTag(TAG_PROJECTS),
  parts: () => updateTag(TAG_PARTS),
} as const;

type Target = keyof typeof TARGETS;

function isTarget(v: string): v is Target {
  return Object.hasOwn(TARGETS, v);
}

/**
 * POST /api/cron/revalidate
 *
 *   Authorization: Bearer $CRON_SECRET
 *   { "tags": ["mini-lessons", "projects"], "lessons": ["ohms-law"], "guides": ["l1-01-wroom-breakout"] }
 *
 * `tags` are the broad ones; `lessons` and `guides` are slug-scoped so a seed
 * that touched one lesson does not evict the whole library. All three are
 * optional; an empty request is a no-op rather than an error, so a caller that
 * computed nothing to invalidate does not have to special-case the call.
 */
export async function POST(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization"), env.CRON_SECRET)) {
    // 404, not 401: an unauthenticated caller learns nothing about whether this
    // route exists. Same posture as the other guarded surfaces.
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be a JSON object" }, { status: 400 });
  }

  const { tags, lessons, guides } = body as Record<string, unknown>;

  const strings = (v: unknown, field: string): string[] | { error: string } => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some((s) => typeof s !== "string" || !s.trim())) {
      return { error: `${field} must be an array of non-empty strings` };
    }
    return v as string[];
  };

  const tagList = strings(tags, "tags");
  if ("error" in tagList) return NextResponse.json(tagList, { status: 400 });
  const lessonList = strings(lessons, "lessons");
  if ("error" in lessonList) return NextResponse.json(lessonList, { status: 400 });
  const guideList = strings(guides, "guides");
  if ("error" in guideList) return NextResponse.json(guideList, { status: 400 });

  const unknown = tagList.filter((t) => !isTarget(t));
  if (unknown.length) {
    return NextResponse.json(
      {
        error: `unknown tag(s): ${unknown.join(", ")}`,
        allowed: Object.keys(TARGETS),
      },
      { status: 400 },
    );
  }

  // Fixed allowlist above, so a caller cannot ask for an arbitrary tag string.
  for (const t of tagList) TARGETS[t as Target]();
  for (const slug of lessonList) updateTag(miniLessonTag(slug));
  for (const slug of guideList) updateTag(guideContentTag(slug));

  return NextResponse.json({
    ok: true,
    invalidated: {
      tags: tagList,
      lessons: lessonList,
      guides: guideList,
    },
  });
}
