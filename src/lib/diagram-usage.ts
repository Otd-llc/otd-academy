// Maps exported guide diagrams to the public guide pages that embed them, for
// the image sitemap. Pure (no DB import) so it stays unit-testable; the route
// (src/app/sitemap-images.xml/route.ts) does the Prisma fetch and calls in here.
//
// A diagram is a plain `image` content block whose `src` is a registry key
// ("/guide-diagrams/<basename>.svg") — see diagram-registry.tsx. We only surface
// cards from each project's PUBLISHED revision, and for PREMIUM projects only the
// REQUIREMENTS preview stage (cards 1+ are paywalled/noindex), mirroring sitemap.ts.

const KEY_RE = /^\/guide-diagrams\/(.+)\.svg$/;

export type UsageProject = {
  slug: string;
  accessTier: string;
  label: string;
  publishedRevisionId: string;
};
export type UsageCard = { revisionId: string; stage: string; blocks: unknown };

export function basenamesInBlocks(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  const out: string[] = [];
  for (const b of blocks) {
    const src = b && typeof b === "object" ? (b as Record<string, unknown>).src : undefined;
    if (typeof src === "string") {
      const m = KEY_RE.exec(src);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

export function mapDiagramsToPages(
  projects: UsageProject[],
  cards: UsageCard[],
  base: string,
): Record<string, string[]> {
  const byRev = new Map(projects.map((p) => [p.publishedRevisionId, p]));
  const map = new Map<string, Set<string>>();
  for (const card of cards) {
    const proj = byRev.get(card.revisionId);
    if (!proj) continue; // not the published revision → not crawlable
    if (proj.accessTier === "PREMIUM" && card.stage !== "REQUIREMENTS") continue; // paywalled
    const names = basenamesInBlocks(card.blocks);
    if (!names.length) continue;
    const url = `${base}/projects/${proj.slug}/${encodeURIComponent(proj.label)}/guide/${card.stage}`;
    for (const n of names) {
      const set = map.get(n) ?? new Set<string>();
      set.add(url);
      map.set(n, set);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [n, set] of map) out[n] = [...set];
  return out;
}

export type UsageLesson = { slug: string; blocks: unknown };

// Same mapping for public Library mini-lessons: each published+PUBLIC lesson is a
// `/library/<slug>` page, and a diagram is an `image` block with a registry-key
// src. Returned shape matches mapDiagramsToPages (basename → page urls) so the
// route can merge the two before emitting the image sitemap.
export function mapLessonDiagramsToPages(
  lessons: UsageLesson[],
  base: string,
): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const l of lessons) {
    const names = basenamesInBlocks(l.blocks);
    if (!names.length) continue;
    const url = `${base}/library/${l.slug}`;
    for (const n of names) {
      const set = map.get(n) ?? new Set<string>();
      set.add(url);
      map.set(n, set);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [n, set] of map) out[n] = [...set];
  return out;
}
