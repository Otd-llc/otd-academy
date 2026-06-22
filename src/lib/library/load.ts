// Public read path for Library mini-lessons. Anonymous callers only ever see
// published + PUBLIC rows; keeping the query here (one place) means the route
// and the index can't drift on the gating. Returns null when missing/unpublished
// so the route 404s.
import { db } from "@/lib/db";

export async function loadPublicMiniLesson(slug: string) {
  return db.miniLesson.findFirst({
    where: { slug, published: true, accessTier: "PUBLIC" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      contentBlocks: true,
      seoTitle: true,
      seoDescription: true,
      byline: true,
      lastVerifiedAt: true,
      updatedAt: true,
      createdAt: true,
      relatedProjects: {
        orderBy: { ordinal: "asc" },
        select: {
          role: true,
          project: {
            select: {
              slug: true,
              name: true,
              publicTitle: true,
              tagline: true,
              accessTier: true,
              publishedRevisionId: true,
              publishedRevision: { select: { label: true } },
            },
          },
        },
      },
    },
  });
}

export async function listPublishedMiniLessons() {
  return db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, title: true, summary: true, updatedAt: true },
  });
}
