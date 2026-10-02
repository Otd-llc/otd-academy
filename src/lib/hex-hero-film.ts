// The /hex hero film: which clips, which posters, what they show.
//
// The clips come from the configurator repo's build film
// (bioscale-viz tools/hex-build-film.mjs), exported under its gates: every
// part placed, physics settled, plants clearing their pockets, the loop
// closing on the field, under 1,500,000 B per theme, High@4.0 avc1. The poster
// is the film's own first-build-finished frame, so the reduced-motion hero is
// a frame of the thing it stands in for. hex-hero-film.test.ts pins the files
// to the budget and the encode.
import type { LoopClip } from "@/components/hex/ThemedLoop";

export const HEX_HERO_FILM: { dark: LoopClip; light: LoopClip; label: string } =
  {
    dark: { src: "/hex/build-film.mp4", poster: "/hex/build-film-poster.jpg" },
    light: {
      src: "/hex/build-film-light.mp4",
      poster: "/hex/build-film-light-poster.jpg",
    },
    label:
      "Hex Cluster builds assembling themselves on a bench: printed bases drop into a " +
      "lattice, bins and covers snap on, and everyday things settle into them, one build " +
      "after another",
  };

/** The budget the clips must fit, per theme (owner R3-11). */
export const HEX_HERO_CLIP_BUDGET_BYTES = 1_500_000;
