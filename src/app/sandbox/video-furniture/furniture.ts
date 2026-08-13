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

export const STAGE_ORDER: Stage[] = [
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
];
