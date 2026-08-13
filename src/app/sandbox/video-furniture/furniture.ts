// Shared data for the video-furniture rounds.
//
// This file used to carry ROUND 1 in full - its four pieces, their three
// treatments each, and a lower-third sample. Round 1 has been deleted (see
// page.tsx), so what remains is only what round 2 still imports: the longest
// real titles as sample copy, and the stage order.
//
// WHY THE SAMPLES MATTER. The 127 empty youtube slots in the guides are not
// 127 films; they are 127 SCREENCASTS that each need the same small set of
// wrappers. Furniture is generated 127 times and must never need a decision,
// so every treatment has to survive the LONGEST real title in the shot list,
// never a placeholder:
//   "Solder the board: heavy parts, passives, and a drag-solder pass (plus the
//    hot-air option)"                                                  (94 ch)
//   "Assembly: build order, the hardest joint in the curriculum, and two
//    continuity gates"                                                 (81 ch)
//   "Run the final DRC, export the Gerbers, and look at what the fab will
//    build"                                                            (71 ch)
//
// ASCII only.

import type { Stage } from "@prisma/client";
import { STAGE_ORDER as CANONICAL_STAGE_ORDER } from "@/lib/stages";

/** A real title from the shot list, per stage, for honest measurement. */
export const SAMPLE_TITLE: Partial<Record<Stage, string>> = {
  REQUIREMENTS: "Requirements: what the ESP-NOW pair has to do",
  BOM_SOURCING: "BOM sourcing: locking real parts before the schematic",
  SCHEMATIC: "Wire the regulator with me",
  LAYOUT: "Route the copper: important nets and the USB pair",
  DRC_GERBER:
    "Run the final DRC, export the Gerbers, and look at what the fab will build",
  ORDERING: "Place both orders: the PCB at PCBWay, the parts at DigiKey",
  ASSEMBLY:
    "Solder the board: heavy parts, passives, and a drag-solder pass (plus the hot-air option)",
  BRINGUP: "Flash the board and watch it come alive",
};

/**
 * The build stages, in order, as the FURNITURE numbers them.
 *
 * DERIVED, not retyped. This used to be a hand-maintained copy and it had
 * drifted: it listed SCHEMATIC at index 1 and BOM_SOURCING at 2, while the
 * canonical order in `@/lib/stages` has them the other way round. Nothing
 * noticed while the sandbox only ever LIT a cell - the comb looks fine in any
 * order. The chapter indicator is the first piece to render an ORDINAL from
 * this list, which is what turned a dormant divergence into a video that
 * numbers two of eight stages differently from the app teaching them.
 *
 * REVISION is filtered out the same way and for the same reason the product
 * does it (`GUIDE_STAGES` in the guide blocks): counting it would make every
 * card read `/ 9` for a curriculum a learner experiences as eight.
 */
export const STAGE_ORDER: Stage[] = CANONICAL_STAGE_ORDER.filter(
  (s): s is Stage => s !== "REVISION",
);
