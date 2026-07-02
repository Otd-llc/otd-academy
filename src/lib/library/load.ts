// Public read path for Library mini-lessons. Anonymous callers only ever see
// published + PUBLIC rows; keeping the query here (one place) means the route
// and the index can't drift on the gating. Returns null when missing/unpublished
// so the route 404s.
import { db } from "@/lib/db";
import { byNarrativeOrder } from "@/lib/library/narrative-order";

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

// The published, PUBLIC mini-lessons linked to a project (either role) — the
// "concepts behind this build" reading list rendered on the course page. The
// inbound half of the internal-linking spine. Deduped by slug (a lesson may hold
// more than one role for the same project) and title-sorted for a stable order.
export async function loadProjectMiniLessons(projectId: string) {
  const rows = await db.projectMiniLesson.findMany({
    where: { projectId, miniLesson: { published: true, accessTier: "PUBLIC" } },
    select: { miniLesson: { select: { slug: true, title: true, summary: true } } },
  });
  const seen = new Set<string>();
  const lessons: { slug: string; title: string; summary: string | null }[] = [];
  for (const r of rows) {
    if (seen.has(r.miniLesson.slug)) continue;
    seen.add(r.miniLesson.slug);
    lessons.push(r.miniLesson);
  }
  return lessons.sort((a, b) => a.title.localeCompare(b.title));
}

export async function listPublishedMiniLessons() {
  // Query newest-first so any lesson not yet placed in the narrative arc falls to
  // the end freshest-first; byNarrativeOrder then lifts the curated arc to the top.
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, title: true, summary: true, updatedAt: true },
  });
  return byNarrativeOrder(rows);
}

// Every published, PUBLIC lesson WITH its content blocks, in curated narrative
// order (see narrative-order.ts), for the combined "Field Guide" PDF. Distinct
// from the index loader (which omits content) — both share the same arc order.
export async function loadPublicLibraryForBook() {
  // createdAt asc is the fallback for any lesson not yet placed in the narrative
  // arc (authoring order at the back of the book); byNarrativeOrder lifts the
  // curated arc to the front so the field guide reads as one coherent progression.
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      title: true,
      summary: true,
      byline: true,
      updatedAt: true,
      contentBlocks: true,
    },
  });
  return byNarrativeOrder(rows);
}
