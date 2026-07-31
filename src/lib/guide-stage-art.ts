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

export function stageArt(stage: Stage): string | null {
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
export function stageArtGhost(stage: Stage): string | null {
  return STAGE_ART[stage] ? `/guide-stages/ghost/${stage}.png` : null;
}
