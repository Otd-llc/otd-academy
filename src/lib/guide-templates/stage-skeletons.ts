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

// The per-stage "process" skeletons. The exported STAGE_CARD_SKELETONS (below)
// is these PLUS a uniform authoring scaffold appended to every stage.
const BASE_SKELETONS: Record<GuideStage, StageSkeleton> = {
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
      // Live bill of materials, rendered from this revision's BomLine data — the
      // table fills in as the BOM is locked, so authors never hand-transcribe it.
      { type: "bomTable" },
    ],
    isGate: false,
    completionRef: { kind: "revisionChecklist", subkind: "STRIPBOARD_VALIDATION" },
  },
  SCHEMATIC: {
    eyebrow: "PHASE 03",
    title: "SCHEMATIC",
    lead: "Capture your already-sourced circuit, then pass ERC.",
    baseBlocks: [
      {
        type: "prose",
        md: "Your parts are locked and sourced, so this is capture, not design: open the provided KiCad files (symbols, footprints, and 3D models are pre-loaded), wire up your sourced parts, then run ERC until it's clean and attach the ERC report to advance.",
      },
      // Every project's SCHEMATIC card hands the learner the generated KiCad
      // starter (BOM parts placed, with footprints/3D/datasheets). The button
      // resolves the project's published-revision BOM_EXPORT artifact at click
      // time; anonymous visitors are funnelled to sign-up (GuideActionButton).
      {
        type: "action",
        action: "downloadKicadStarter",
        label: "Download the KiCad starter (placed parts)",
      },
    ],
    isGate: false,
    completionRef: { kind: "artifact", subkinds: ["ERC_REPORT"] },
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

// What screenshot the scaffold's image placeholder stakes out per stage — shown
// to the admin in the in-app capture tool (the learner sees nothing until it's
// filled). Keeps the "where's the visual?" decision made up front.
const CAPTURE_HINTS: Record<GuideStage, string> = {
  REQUIREMENTS: "Your requirements doc / block diagram",
  BOM_SOURCING: "The locked BOM (your spreadsheet or Digikey cart)",
  SCHEMATIC: "KiCad ▸ the finished schematic (or a key sub-circuit)",
  LAYOUT: "KiCad ▸ PCB editor ▸ the routed board",
  DRC_GERBER: "KiCad ▸ DRC report (0 errors) + the Gerber/3D preview",
  ORDERING: "Your PCB + parts order confirmation",
  ASSEMBLY: "The assembled board, top side",
  BRINGUP: "The board powered up + your bring-up readings",
};

// Authoring scaffold appended to EVERY stage so a freshly-materialized guide
// arrives pre-structured (fill-in-the-blank), not a near-blank card:
//   • a "check" mode-band ribbon — introduces L1.01's verify phase,
//   • a screenshot placeholder (admin-only; the capture tool fills it), and
//   • a quiz stub — every stage gates on a quiz, and a new guide otherwise has
//     NONE, so the gating checkpoint is pre-wired for the author to write.
// All three are schema-valid stubs the author edits; the Scaffold-D readiness
// check flags any left as TODO before publish.
function authoringScaffold(stage: GuideStage): ContentBlock[] {
  const title = BASE_SKELETONS[stage].title;
  return [
    {
      type: "callout",
      severity: "info",
      label: "Mode · check · Verify your work",
      body: "Confirm this stage is actually done before moving on — then take the quick check.",
    },
    {
      type: "image",
      src: "",
      alt: `${title} — screenshot`,
      captureHint: CAPTURE_HINTS[stage],
    },
    {
      type: "quiz",
      prompt: "Quick check",
      questions: [
        {
          q: `TODO — write a one-question comprehension check for the ${title} stage.`,
          options: ["TODO — the correct answer", "TODO — a plausible wrong answer"],
          answer: 0,
          explain: "TODO — explain why the correct answer is right.",
        },
      ],
    },
  ];
}

// The exported skeletons: each stage's process blocks + the uniform scaffold.
export const STAGE_CARD_SKELETONS: Record<GuideStage, StageSkeleton> =
  Object.fromEntries(
    GUIDE_STAGES.map((s) => [
      s,
      {
        ...BASE_SKELETONS[s],
        baseBlocks: [...BASE_SKELETONS[s].baseBlocks, ...authoringScaffold(s)],
      },
    ]),
  ) as Record<GuideStage, StageSkeleton>;
