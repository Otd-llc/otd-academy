// Cache-tag invalidators. One home, so a writer cannot forget which surfaces its
// write feeds — the reader that SETS a tag and the writer that CLEARS it live in
// different files, and a miss is silent: the content just goes stale for an hour
// with nothing to grep for and no error anywhere.
//
// This is a PLAIN module, not "use server" — it exports sync functions, which a
// "use server" file may not do (see the repo rule in src/lib/actions/*). Server
// actions import and call these.
//
// updateTag, not revalidateTag: revalidateTag takes a grace window and is
// stale-while-revalidate, so the change lands a request later than you would expect.
// updateTag expires immediately. See src/lib/cache-profile.ts.
import { updateTag } from "next/cache";

import { TAG_PARTS, TAG_PROJECTS, guideContentTag } from "@/lib/cache-profile";

/**
 * Call after ANY write to Project or ProjectDependency.
 *
 * The cached project graph (src/lib/skill-tree.ts, `cacheTag("projects")`) feeds the
 * /courses honeycomb, and /sitemap.xml carries the same tag. Neither is reached by
 * the `revalidatePath` calls these writers already make: revalidatePath("/") mints
 * the implicit tag `_N_T_/`, which is not in /courses' or /sitemap.xml's implicit tag
 * set. Without this, publishing a course leaves /courses showing "coming soon" and
 * the sitemap missing the guide + its stage URLs for up to an hour.
 *
 * setProjectAccessTier appeared to work only because it happens to name
 * revalidatePath("/courses") — coincidence, not design, and it would break the moment
 * a second surface read the graph.
 */
export function invalidateProjectGraph(): void {
  updateTag(TAG_PROJECTS);
}

/**
 * Call after ANY write to Part (or its facts/assets that the public catalog renders).
 *
 * The parts catalog and every /parts/[id] detail page are public, crawlable, and in
 * the sitemap.
 */
export function invalidateParts(): void {
  updateTag(TAG_PARTS);
}

/**
 * Call after ANY write that changes what a project's public guide renders: a
 * guide-card edit/reorder/materialize (src/lib/actions/guides.ts) or a capture
 * media write (src/lib/guide-block-write.ts).
 *
 * The anonymous halves of the guide hub + stage pages are cached under this tag
 * (src/lib/guide/cached-guide-read.ts) because they are sitemapped and crawled;
 * without this, an author's edit stays invisible on the public page for up to
 * an hour.
 */
export function invalidateGuideContent(slug: string): void {
  updateTag(guideContentTag(slug));
}
