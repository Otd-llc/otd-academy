// Slugs with a baked ortho poster in /public/board-posters/<slug>.png. The
// /learn ladder and the board hero show the finished-board graphic ONLY for
// these — the ladder's layout (the selected board breaks the frame) depends on
// the poster existing, so it is gated server-side rather than probed with an
// onError fallback. Add a slug here when its <slug>.png poster lands.
export const BOARD_POSTER_SLUGS = new Set<string>(["l1-01-wroom-breakout"]);

export function boardPoster(slug: string): string | null {
  return BOARD_POSTER_SLUGS.has(slug) ? `/board-posters/${slug}.png` : null;
}
