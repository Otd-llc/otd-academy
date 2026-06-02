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
  "SCHEMATIC",
  "BOM_SOURCING",
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
        md: "Capture the functional requirements, the discipline this board teaches, and every safety/DFM constraint. Complete the REQUIREMENTS review checklist to exit.",
      },
    ],
    isGate: true,
    completionRef: { kind: "revisionChecklist", subkind: "REQUIREMENTS_REVIEW" },
  },
  SCHEMATIC: {
    eyebrow: "PHASE 02",
    title: "SCHEMATIC",
    lead: "Draw the schematic and pin the commit.",
    baseBlocks: [
      {
        type: "prose",
        md: "Draft the schematic, then attach the schematic file artifact and record the schematic commit.",
      },
    ],
    isGate: false,
    completionRef: { kind: "artifact", subkinds: ["SCHEMATIC_FILE"] },
  },
  BOM_SOURCING: {
    eyebrow: "PHASE 03",
    title: "BOM SOURCING",
    lead: "Source every part; validate on stripboard where required.",
    baseBlocks: [
      {
        type: "prose",
        md: "Build the BOM and source parts. Stripboard-de-risk boards must pass the stripboard validation checklist.",
      },
    ],
    isGate: false,
    completionRef: { kind: "revisionChecklist", subkind: "STRIPBOARD_VALIDATION" },
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
