// The 8 design→bringup stage-card skeletons (REVISION excluded). Each skeleton
// carries the stage's eyebrow/title/lead, a base set of process content blocks,
// its gate flag, and the `completionRef` adapter that ties the card to the
// existing checklist / artifact / build / board-status substrate (per design §3).
//
// GUIDE_STAGES is deliberately REQUIREMENTS..BRINGUP only — the REVISION stage
// of the Prisma `Stage` enum is not a guide card.
import type { ContentBlock, CompletionRef } from "@/lib/schemas/guide";

export const GUIDE_STAGES = [
  "REQUIREMENTS",
  "BOM_SOURCING",
  "SCHEMATIC",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
] as const;
export type GuideStage = (typeof GUIDE_STAGES)[number];

export interface StageSkeleton {
  eyebrow: string;
  title: string;
  lead: string;
  baseBlocks: ContentBlock[];
  isGate: boolean;
  completionRef: CompletionRef;
}

export const STAGE_CARD_SKELETONS: Record<GuideStage, StageSkeleton> = {
  REQUIREMENTS: {
    eyebrow: "PHASE 01",
    title: "REQUIREMENTS",
    lead: "Pin down what the board must do and the constraints it must honor before any schematic work.",
    baseBlocks: [
      {
        type: "prose",
        md: "Capture the functional requirements, the discipline this board teaches, and every safety/DFM constraint, then attach your requirements artifact to exit.",
      },
    ],
    isGate: true,
    completionRef: { kind: "revisionChecklist", subkind: "REQUIREMENTS_REVIEW" },
  },
  BOM_SOURCING: {
    eyebrow: "PHASE 02",
    title: "BOM SOURCING",
    lead: "Lock and source every part before you draw a single net.",
    baseBlocks: [
      {
        type: "prose",
        md: "Lock down every part and do the math up front (keep a calc trail so a reviewer can see where each value came from), then source each part on Digikey — real MPN + datasheet, and check stock, lifecycle stage, and lead time. Design around parts you can actually buy. Stripboard-de-risk boards must also pass the stripboard validation checklist.",
      },
    ],
    isGate: false,
    completionRef: { kind: "revisionChecklist", subkind: "STRIPBOARD_VALIDATION" },
  },
  SCHEMATIC: {
    eyebrow: "PHASE 03",
    title: "SCHEMATIC",
    lead: "Capture your already-sourced circuit and pin the commit.",
    baseBlocks: [
      {
        type: "prose",
        md: "Your parts are locked and sourced, so this is capture, not design: open the provided KiCad files (symbols, footprints, and 3D models are pre-loaded), wire up your sourced parts, then attach the schematic file artifact and record the schematic commit.",
      },
    ],
    isGate: false,
    completionRef: { kind: "artifact", subkinds: ["SCHEMATIC_FILE"] },
  },
  LAYOUT: {
    eyebrow: "PHASE 04",
    title: "LAYOUT",
    lead: "Place and route; honor the keep-outs.",
    baseBlocks: [
      {
        type: "prose",
        md: "Lay out the board and complete the LAYOUT review checklist (antenna keep-out, isolation, etc.).",
      },
    ],
    isGate: true,
    completionRef: { kind: "revisionChecklist", subkind: "LAYOUT_REVIEW" },
  },
  DRC_GERBER: {
    eyebrow: "PHASE 05",
    title: "DRC / GERBER",
    lead: "Pass DRC and export fabrication outputs.",
    baseBlocks: [
      {
        type: "prose",
        md: "Run DRC clean and export Gerbers; attach the DRC report and Gerber zip.",
      },
    ],
    isGate: false,
    completionRef: { kind: "artifact", subkinds: ["DRC_REPORT", "GERBER_ZIP"] },
  },
  ORDERING: {
    eyebrow: "PHASE 06",
    title: "ORDERING",
    lead: "Order boards and parts.",
    baseBlocks: [
      {
        type: "prose",
        md: "Place the PCB and parts orders; attach both order records to the build.",
      },
    ],
    isGate: false,
    completionRef: { kind: "artifact", subkinds: ["PCB_ORDER", "PARTS_ORDER"] },
  },
  ASSEMBLY: {
    eyebrow: "PHASE 07",
    title: "ASSEMBLY",
    lead: "Hand-build the boards; screen before paste.",
    baseBlocks: [
      {
        type: "callout",
        severity: "critical",
        label: "Sequence discipline",
        body: "Hot-air work first on the bare board, iron-solder passives/discretes after. Reverse order lifts placed parts.",
      },
      {
        type: "steps",
        ordered: true,
        items: [
          "Flood the footprint with liquid flux.",
          "Load the iron tip with fresh solder.",
          "Drag along one pad row at ~3 mm/sec.",
        ],
      },
    ],
    isGate: true,
    completionRef: { kind: "buildChecklist", subkind: "POST_ASSEMBLY_CONTINUITY" },
  },
  BRINGUP: {
    eyebrow: "PHASE 08",
    title: "BRINGUP",
    lead: "Power on safely; record measurements.",
    baseBlocks: [
      {
        type: "prose",
        md: "Bring each board up, capture the bring-up measurements, and mark boards BROUGHT_UP.",
      },
    ],
    isGate: true,
    completionRef: { kind: "boardStatus", statuses: ["BROUGHT_UP", "QUARANTINED"] },
  },
};
