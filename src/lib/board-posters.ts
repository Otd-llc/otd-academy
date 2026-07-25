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

/** The L1.01 comb render, used as the stand-in for any board without its own. */
export const COMB_STANDIN = "/board-posters/comb/l1-01-wroom-breakout.png";

export function combPoster(slug: string): string | null {
  return COMB_POSTER_SLUGS.has(slug) ? `/board-posters/comb/${slug}.png` : null;
}
