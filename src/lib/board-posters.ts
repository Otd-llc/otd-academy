// Slugs with a baked ortho poster in /public/board-posters/<slug>.png. The
// /learn ladder and the board hero show the finished-board graphic ONLY for
// these — the ladder's layout (the selected board breaks the frame) depends on
// the poster existing, so it is gated server-side rather than probed with an
// onError fallback. Add a slug here when its <slug>.png poster lands.
export const BOARD_POSTER_SLUGS = new Set<string>(["l1-01-wroom-breakout"]);

export function boardPoster(slug: string): string | null {
  return BOARD_POSTER_SLUGS.has(slug) ? `/board-posters/${slug}.png` : null;
}

// The COMB camera. /courses sits its boards on hex faces, and the owner picked a
// shallower spin for that surface (sandbox round 7, "H5"): rendered with
// `kicad-cli pcb render --rotate "-45,0,25"` at 1500px / --zoom 0.78, then
// normalised so every board covers the same alpha area. The /learn poster above
// is still the original tilt 45 / spin 45 camera; unifying the two means
// re-rendering the ladder + hero art and eyeballing that composition, which is a
// separate change, so the two live side by side deliberately rather than by
// oversight.
//
// The comb art doubles as the STAND-IN: a course with no poster of its own shows
// L1.01's silhouette, masked and gold-ghosted, until its own board is rendered.
export const COMB_POSTER_SLUGS = new Set<string>(["l1-01-wroom-breakout"]);

/**
 * The stand-in for any board without a comb render of its own: L1.01 as a GHOST,
 * an alpha map that carries the board's structure rather than just its outline.
 *
 * There is no plain-render stand-in export any more. A cell that has its own
 * poster draws it through `combPoster`; a cell that does not is by definition
 * locked or undiscovered, so the only thing the stand-in was ever used for is
 * this ghost.
 *
 * The render's own alpha cannot be used for this. It includes the baked contact
 * shadow as a clean band at alpha ~0.2, so masking a fill with it produced a smear
 * offset below the board rather than the board. Regenerate with
 * `pnpm tsx scripts/make-stage-ghosts.ts`.
 */
export const COMB_STANDIN_GHOST =
  "/board-posters/comb/ghost/l1-01-wroom-breakout.png";

export function combPoster(slug: string): string | null {
  return COMB_POSTER_SLUGS.has(slug) ? `/board-posters/comb/${slug}.png` : null;
}
