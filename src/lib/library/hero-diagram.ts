// The first guide-diagram image src in a lesson's contentBlocks (its "hero"
// diagram), or null. PURE + DEFENSIVE over Prisma `Json` (unknown at runtime).
//
// Used to render a FEATURED lesson's own diagram on the /library index: the src
// resolves against the small HERO_DIAGRAMS map in the library page (static
// imports of only the hero-eligible diagrams, so the landing doesn't ship the
// whole diagram registry).
export function firstDiagramSrc(contentBlocks: unknown): string | null {
  if (!Array.isArray(contentBlocks)) return null;
  for (const block of contentBlocks) {
    if (block && typeof block === "object") {
      const b = block as Record<string, unknown>;
      if (
        b.type === "image" &&
        typeof b.src === "string" &&
        b.src.startsWith("/guide-diagrams/")
      ) {
        return b.src;
      }
    }
  }
  return null;
}
