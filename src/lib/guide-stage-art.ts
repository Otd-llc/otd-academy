// The artifact each build-guide stage produces, as an ortho tile for the hub comb.
//
// Every tile is a render of a REAL artifact of that phase, not an icon: the module
// you design around, the printed BOM, the answer-key schematic sheet, the layer
// art, the gerber set exploded into its layers, the bare fab board, the
// half-populated board, and the finished one. Keeping them all objects is what
// stops the comb reading half instrument, half clip-art.
//
// Provenance (so they can be regenerated): four are `kicad-cli pcb render` off the
// L1.01 project at the comb camera (`--rotate "-45,0,25"`, 1500px, `--zoom 0.78`);
// four are composed from `sch export svg` / `pcb export svg` layer plots. All are
// normalised to a square by ALPHA AREA rather than bounding box, so a tile covers
// the same visual mass whatever its silhouette — without that, a board turned 45°
// swamps a flat sheet at the same nominal size.
//
// The set is L1.01's. Every board's guide shows it today, because the stages teach
// the same shape of work whatever the board; a per-board set can key off the slug
// later without changing the callers.
import type { Stage } from "@prisma/client";
import { optimized } from "./optimized-asset";

const STAGE_ART: Partial<Record<Stage, string>> = {
  REQUIREMENTS: "/guide-stages/REQUIREMENTS.png",
  BOM_SOURCING: "/guide-stages/BOM_SOURCING.png",
  SCHEMATIC: "/guide-stages/SCHEMATIC.png",
  LAYOUT: "/guide-stages/LAYOUT.png",
  DRC_GERBER: "/guide-stages/DRC_GERBER.png",
  ORDERING: "/guide-stages/ORDERING.png",
  ASSEMBLY: "/guide-stages/ASSEMBLY.png",
  BRINGUP: "/guide-stages/BRINGUP.png",
};

/**
 * THROUGH THE OPTIMIZER. These are 1113px and 1782px squares painted into a box
 * that measures at most 437 CSS px, so most of every tile's weight is
 * resolution nobody asked for: REQUIREMENTS goes 133,721 -> 34,960 bytes at
 * w=1080, and it content-negotiates WebP on top. The source PNGs stay exactly
 * as they are; only the URL the browser fetches changes.
 */
export function stageArt(stage: Stage): string | null {
  const src = STAGE_ART[stage];
  return src ? optimized(src) : null;
}

/** The unoptimized path, for a server-side reader that needs the file itself. */
export function stageArtSource(stage: Stage): string | null {
  return STAGE_ART[stage] ?? null;
}

// The GHOST of the same artifact, for a stage the learner has not reached.
//
// A locked cell masks a flat gold fill, so the mask has to describe the DRAWING.
// The source PNG's alpha does not: on the four svg plots it is a solid sheet
// rectangle (the structure is in luminance), and on the four kicad renders it
// includes a baked contact shadow that masked into a smear below the board. These
// maps are `coverage x ink`, normalised per tile so a dense render and a mostly
// white BOM sheet read at the same weight in one comb.
//
// Regenerate with `pnpm tsx scripts/make-stage-ghosts.ts` whenever a stage tile is
// re-rendered; that script carries the measurements the treatment rests on.
//
// NOT THROUGH THE OPTIMIZER, unlike stageArt above.
//
// An earlier version of this comment said resampling raises a sparse mask's
// mean alpha by up to 175% and that shrinking one was therefore unsafe. That
// number is real but it describes SHARP'S RESAMPLER ACTING ON THE FILE, and it
// is not what anyone sees: the browser was already downsampling these to the
// cell on every view. Painting both variants through this comb's own CSS at the
// largest box they ever fill, the difference in painted density is at most
// 0.22%. The masks are not fragile in the way that comment claimed.
//
// They are still not routed through the optimizer, for a plainer reason: they
// are already AT display size. make-stage-ghosts.ts now caps every ghost at 896
// device px (the 437 CSS px box on a 2x screen) and keeps the smaller file, so
// there is nothing left for a resize to reclaim. On four of the nine a resize
// makes the file BIGGER — replacing hard edges with intermediate values costs
// more than the pixels save — and the script discards those.
//
// Regenerate with `pnpm tsx scripts/make-stage-ghosts.ts`; the cap runs after
// the density normalisation, never before.
export function stageArtGhost(stage: Stage): string | null {
  return STAGE_ART[stage] ? `/guide-stages/ghost/${stage}.png` : null;
}
