// The round: four pieces of video furniture, three treatments each.
//
// A SANDBOX ROUND, so this directory is deleted before the PR and only the
// PICKS survive - as a cut sheet in `Otd-llc/otd-promo` plus a durable render
// surface, the same route the Logbook film took. Nothing here is the spec until
// the owner names a variant.
//
// WHY FOUR PIECES AND NOT ONE FILM. The 127 empty youtube slots in the guides
// are not 127 films; they are 127 SCREENCASTS that each need the same small set
// of wrappers. A film is authored once and admired; furniture is generated 127
// times and must never need a decision. So each piece takes DATA (a stage, a
// title) and nothing else, and every treatment below has to survive the longest
// real title in the shot list, not a placeholder.
//
// The longest titles actually in the guides, which are the stress cases:
//   "Solder the board: heavy parts, passives, and a drag-solder pass (plus the
//    hot-air option)"                                                  (94 ch)
//   "Assembly: build order, the hardest joint in the curriculum, and two
//    continuity gates"                                                 (81 ch)
//   "Run the final DRC, export the Gerbers, and look at what the fab will
//    build"                                                            (71 ch)
//
// TIMINGS are in seconds and are the whole scrub range of a piece. They are
// deliberately short: furniture that outstays its welcome is the most common
// way a channel's intro becomes the thing people skip.
//
// ASCII only.

import type { Stage } from "@prisma/client";

export type PieceId = "intro" | "section" | "lower" | "outro";

export type Variant = {
  id: string;
  name: string;
  /** What this treatment is arguing for, in one line. */
  claim: string;
};

export type Piece = {
  id: PieceId;
  name: string;
  seconds: number;
  /** What the piece is for, and where it sits in a video. */
  role: string;
  variants: Variant[];
};

export const PIECES: Piece[] = [
  {
    id: "intro",
    name: "Intro / title",
    seconds: 3.5,
    role:
      "Opens every video. Carries course, stage and the lesson title. The one piece all 127 need.",
    variants: [
      {
        id: "plate",
        name: "Plate",
        claim:
          "The film's gold-plating language, reused. A stage hex strikes, the rule sweeps, the title lands on it. Most continuous with the Logbook promo.",
      },
      {
        id: "bench",
        name: "Bench",
        claim:
          "Blueprint rules draw themselves and the title sits on the datum line. Quietest of the three; reads as instrument rather than broadcast.",
      },
      {
        id: "artifact",
        name: "Artifact",
        claim:
          "The stage's REAL artifact tile behind a slow push, title plate over it. Says what you will make before it says what you will watch.",
      },
    ],
  },
  {
    id: "section",
    name: "Section / stage card",
    seconds: 1.6,
    role:
      "Marks a chapter inside a video. The stages are already a product system (REQ -> BRG) with their own order and art.",
    variants: [
      {
        id: "band",
        name: "Band",
        claim:
          "A band sweeps the lower third and leaves. Never covers the work on screen, so it can fire mid-demonstration.",
      },
      {
        id: "comb",
        name: "Comb",
        claim:
          "The phase comb lights the current cell in the corner. Teaches where you are in the whole build, not just what is next.",
      },
      {
        id: "wipe",
        name: "Wipe",
        claim:
          "Full-frame, the abbreviation big, one beat. The hardest cut of the three - use where the screencast genuinely restarts.",
      },
    ],
  },
  {
    id: "lower",
    name: "Lower third",
    seconds: 4,
    role:
      "Names a part, a value or a warning over live footage. The piece that most needs an alpha export, because it composites over a screencast.",
    variants: [
      {
        id: "rule",
        name: "Rule",
        claim:
          "A gold rule grows, label in mono above, value below. Thinnest footprint; survives a busy KiCad canvas.",
      },
      {
        id: "panel",
        name: "Panel",
        claim:
          "A dark panel with a keyline. Most legible over anything, costs the most screen.",
      },
      {
        id: "warn",
        name: "Warn",
        claim:
          "The danger treatment, for the polarised-part and hot-air moments. Deliberately unlike the other two - a warning that looks like a label is a warning nobody reads.",
      },
    ],
  },
  {
    id: "outro",
    name: "Outro / end screen",
    seconds: 8,
    role:
      "Closes the video. Must run >= 5 s inside the last 20 s, and must leave four regions clear for the elements YouTube draws on top.",
    variants: [
      {
        id: "wells",
        name: "Wells",
        claim:
          "Four reserved slots, copy in the centre gutter. The layout that assumes the end screen exists rather than fighting it.",
      },
      {
        id: "split",
        name: "Split",
        claim:
          "Copy left, both video wells right. Strongest reading order; gives up the left-hand subscribe well.",
      },
      {
        id: "ladder",
        name: "Ladder",
        claim:
          "Next lesson named explicitly, wells beneath. Turns the end screen into curriculum rather than a wall of thumbnails.",
      },
    ],
  },
];

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

/** The lower third's own sample content, per treatment. */
export const SAMPLE_LOWER: Record<string, { label: string; value: string }> = {
  rule: { label: "U2 / regulator", value: "AP2112K-3.3  600 mA LDO" },
  panel: { label: "net class", value: "USB differential pair  90 ohm" },
  warn: { label: "polarised", value: "D2 and C11 fail loudly if reversed" },
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
