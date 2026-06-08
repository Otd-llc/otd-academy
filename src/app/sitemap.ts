// Dynamic sitemap.xml for the public SEO surface.
//
// Next App Router serves this at `/sitemap.xml`. It is server-evaluated (no
// "use client") and queries the DB at request/build time. We emit only the
// publicly crawlable URLs:
//   - the static public indexes `/courses` and `/parts`
//   - every part detail `/parts/{id}`
//   - for each PUBLIC, published, non-archived project: the guide hub
//     `/projects/{slug}/{label}/guide` plus one URL per guide stage
//     `/projects/{slug}/{label}/guide/{STAGE}` (the 8 GUIDE_STAGES).
//
// `/` is intentionally NOT public (no PUBLIC marketing home yet), so it is
// skipped. All URLs are ABSOLUTE — prefixed with `siteUrl()` (the same origin as
// layout's metadataBase, no trailing slash). Revision labels are encoded with
// `encodeURIComponent` to match the canonical guide URLs.
import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo/jsonld";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const lastModified = new Date();

  const [projects, parts] = await Promise.all([
    db.project.findMany({
      where: {
        accessTier: "PUBLIC",
        publishedRevisionId: { not: null },
        archivedAt: null,
      },
      select: {
        slug: true,
        publishedRevision: { select: { label: true } },
      },
    }),
    db.part.findMany({ select: { id: true } }),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/courses`, lastModified },
    { url: `${base}/parts`, lastModified },
  ];

  for (const part of parts) {
    entries.push({ url: `${base}/parts/${part.id}`, lastModified });
  }

  for (const project of projects) {
    // PUBLIC projects are always published (the query filters on
    // publishedRevisionId), so publishedRevision is non-null here; guard the
    // type and skip any anomalous row defensively.
    const label = project.publishedRevision?.label;
    if (!label) continue;
    const guideBase = `${base}/projects/${project.slug}/${encodeURIComponent(
      label,
    )}/guide`;
    entries.push({ url: guideBase, lastModified });
    for (const stage of GUIDE_STAGES) {
      entries.push({ url: `${guideBase}/${stage}`, lastModified });
    }
  }

  return entries;
}
