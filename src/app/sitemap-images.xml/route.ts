// Image sitemap: associates each exported guide-diagram image with the public
// guide page(s) that embed it, so Google Images / multimodal surfaces can
// discover them (the on-page diagram is a DOM component with no <img>, invisible
// to image crawlers otherwise). Reachable signed-out: the proxy.ts matcher
// excludes any path with a file extension (".*\\..*"), so /sitemap-images.xml is
// never auth-gated — same as /sitemap.xml.
//
// CACHED, for the same reason /sitemap.xml is. This route reads `contentBlocks`
// for every published guide card AND every published mini-lesson -- the two
// largest JSON columns in the schema -- purely to regex diagram basenames out of
// them. It was the last public content route with no `use cache` and no tag, so
// every crawler hit paid the full price, uncached, forever. `/sitemap.xml`
// carries exactly these two tags for exactly this reason; this route embeds the
// same lessons and the same guides and had simply never been given them.
//
// The tags are the ones the admin write paths already fire: editing a lesson
// through /admin/library invalidates TAG_MINI_LESSONS, and the guide-card writers
// invalidate TAG_PROJECTS -- so a diagram added to a lesson shows up here on the
// next request rather than waiting out the window.
import { db } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { ONE_HOUR, TAG_MINI_LESSONS, TAG_PROJECTS } from "@/lib/cache-profile";
import { siteUrl } from "@/lib/seo/jsonld";
import { buildImageSitemapXml } from "./build";
import {
  mapDiagramsToPages,
  mapLessonDiagramsToPages,
  type UsageProject,
  type UsageCard,
} from "@/lib/diagram-usage";
import manifest from "@/components/guide/diagram-export-manifest.json";

type ManifestEntry = { basename: string; image: string; alt: string; hash: string };

/**
 * The cached half: everything that touches the database, returning the finished
 * XML STRING.
 *
 * Split out rather than putting `"use cache"` on GET itself, which is what the
 * first attempt did. A cached function's return value has to be serializable,
 * and a route handler returns a `Response` — a class instance, not a plain
 * object. The build fails on it, and the message names neither the directive nor
 * the route's real problem:
 *
 *   Only plain objects, and a few built-ins, can be passed to Client Components
 *   from Server Components. Classes or null prototypes are not supported.
 *   Error occurred prerendering page "/sitemap-images.xml"
 *
 * `sitemap.ts` can cache its default export directly because it returns a plain
 * array. Anything under `app/**\/route.ts` cannot, and has to cache the value and
 * construct the Response outside.
 */
async function imageSitemapXml(base: string): Promise<string> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_MINI_LESSONS, TAG_PROJECTS);


  const projects = await db.project.findMany({
    where: {
      accessTier: { in: ["PUBLIC", "PREMIUM"] },
      publishedRevisionId: { not: null },
      archivedAt: null,
    },
    select: {
      slug: true,
      accessTier: true,
      publishedRevisionId: true,
      publishedRevision: { select: { label: true } },
    },
  });

  const ups: UsageProject[] = projects
    .filter((p) => p.publishedRevisionId && p.publishedRevision?.label)
    .map((p) => ({
      slug: p.slug,
      accessTier: String(p.accessTier),
      label: p.publishedRevision!.label,
      publishedRevisionId: p.publishedRevisionId!,
    }));

  let usage: Record<string, string[]> = {};
  if (ups.length) {
    const cards = await db.guideCard.findMany({
      where: { guide: { revisionId: { in: ups.map((p) => p.publishedRevisionId) } } },
      select: { stage: true, contentBlocks: true, guide: { select: { revisionId: true } } },
    });
    const ucards: UsageCard[] = cards.map((c) => ({
      revisionId: c.guide.revisionId,
      stage: String(c.stage),
      blocks: c.contentBlocks,
    }));
    usage = mapDiagramsToPages(ups, ucards, base);
  }

  // Public Library mini-lessons embed the same registry diagrams; surface their
  // images too (the on-page diagram is a DOM component with no <img>).
  const lessons = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    select: { slug: true, contentBlocks: true },
  });
  const lessonUsage = mapLessonDiagramsToPages(
    lessons.map((l) => ({ slug: l.slug, blocks: l.contentBlocks })),
    base,
  );
  for (const [basename, urls] of Object.entries(lessonUsage)) {
    usage[basename] = [...(usage[basename] ?? []), ...urls];
  }

  const byBasename = new Map((manifest as ManifestEntry[]).map((m) => [m.basename, m]));
  const byPage = new Map<string, { loc: string; caption: string }[]>();
  for (const [basename, urls] of Object.entries(usage)) {
    const entry = byBasename.get(basename);
    if (!entry) continue;
    for (const pageUrl of urls) {
      const arr = byPage.get(pageUrl) ?? [];
      arr.push({ loc: base + entry.image, caption: entry.alt });
      byPage.set(pageUrl, arr);
    }
  }

  return buildImageSitemapXml(
    [...byPage].map(([pageUrl, images]) => ({ pageUrl, images })),
  );
}

export async function GET() {
  const xml = await imageSitemapXml(siteUrl());
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
