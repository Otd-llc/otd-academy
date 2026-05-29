// Stage state machine config (design §5.2).
//
// Phase 7 / M6: the read-side `STAGES` config. Each entry pins per-stage:
//   - `entryHints`: human-readable nudges for the user shown when entering
//     the stage (design §9 surfaces).
//   - `revisionAllowedArtifactSubkinds` / `buildAllowedArtifactSubkinds`:
//     subkind pickers on the per-scope artifact panes (design §9.1, §9.2).
//   - `exitGate(ctx)`: the *read-side* gate predicate evaluated by the stage
//     tracker UI and the `advanceStage` server action (Phase 8) inside a
//     Serializable transaction. Pure function over `GateContext` — no DB
//     access — so the caller controls when/where loading happens.
//
// The terminal `REVISION` stage has no `exitGate` (the field is optional).
//
// `FAILED_BOARD_MSG` is the canonical action-oriented message both ASSEMBLY
// and BRINGUP gates emit verbatim when any Board on the active Build is
// FAILED (design §2 notes — "FAILED is not an exit condition").

import type {
  Artifact,
  ArtifactSubkind,
  BomLine,
  Board,
  Build,
  Checklist,
  ChecklistItem,
  Part,
  Revision,
  Stage,
} from "@prisma/client";

// ─── Stage order ───────────────────────────────────────

export const STAGE_ORDER = [
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
  "REVISION",
] as const satisfies readonly Stage[];

export type StageName = (typeof STAGE_ORDER)[number];

// ─── Gate types (design §5.2) ──────────────────────────

/** GateSnapshot version field — bump when the shape changes. */
export const GATE_SNAPSHOT_VERSION = 1;

export type GateResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type GateSnapshot =
  | { v: 1; kind: "gate"; result: GateResult; ts: string }
  | { v: 1; kind: "regress"; reason: string; ts: string }
  | { v: 1; kind: "init"; ts: string };

export interface StageDef {
  stage: Stage;
  order: number;
  name: string;
  description: string;
  entryHints: string[];
  /** Absent ⇒ terminal stage (REVISION). */
  exitGate?: (ctx: GateContext) => GateResult | Promise<GateResult>;
  revisionAllowedArtifactSubkinds: ArtifactSubkind[];
  buildAllowedArtifactSubkinds: ArtifactSubkind[];
}

/**
 * Everything a stage gate needs to make its decision. Loaded via
 * `loadGateContext()` (src/lib/load-gate-context.ts). Gates are pure
 * functions of this context — no DB access inside.
 *
 * Note: `artifacts` are revision-scoped artifacts at the current stage only;
 * Build-scoped artifacts live on `activeBuild.artifacts` (per the
 * Artifact owner XOR — see design §4.2).
 */
export interface GateContext {
  revision: Pick<
    Revision,
    "id" | "currentStage" | "schematicCommit" | "layoutCommit"
  >;
  bomLines: (BomLine & { part: Part })[];
  artifacts: Artifact[];
  activeBuild:
    | (Build & {
        boards: Board[];
        artifacts: Artifact[];
        checklists: (Checklist & { items: ChecklistItem[] })[];
      })
    | null;
}

// ─── Canonical messages ────────────────────────────────

/**
 * Canonical action-oriented message used by both ASSEMBLY and BRINGUP gates
 * when one or more boards on the active Build are FAILED. Emitted verbatim
 * per design §2 notes — keep tests pinning the wording.
 */
export const FAILED_BOARD_MSG = (n: number) =>
  `${n} board(s) FAILED — investigate and either return to ASSEMBLED (repaired) or set QUARANTINED (removed from build).`;

// ─── STAGES record ─────────────────────────────────────

export const STAGES: Record<Stage, StageDef> = {
  REQUIREMENTS: {
    stage: "REQUIREMENTS",
    order: 1,
    name: "Requirements",
    description:
      "Interfaces, power budget, mechanical constraints, target cost.",
    entryHints: [
      "Capture interfaces, power budget, mechanical constraints, and target cost.",
      "Attach a requirements artifact (note or doc) before advancing.",
    ],
    revisionAllowedArtifactSubkinds: ["REQUIREMENTS_DOC", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    exitGate: ({ artifacts }) => {
      const reasons: string[] = [];
      const present = artifacts.some((a) => a.stage === "REQUIREMENTS");
      if (!present)
        reasons.push("No requirements artifact at this stage.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  SCHEMATIC: {
    stage: "SCHEMATIC",
    order: 2,
    name: "Schematic",
    description: "KiCad schematic capture.",
    entryHints: [
      "Capture the schematic in KiCad and commit.",
      "Pin the schematic git commit on the revision header strip.",
      "Attach the schematic artifact (PDF or file link).",
    ],
    revisionAllowedArtifactSubkinds: ["SCHEMATIC_FILE", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    exitGate: ({ revision, artifacts }) => {
      const reasons: string[] = [];
      const present = artifacts.some((a) => a.stage === "SCHEMATIC");
      if (!present) reasons.push("No schematic artifact at this stage.");
      if (!revision.schematicCommit)
        reasons.push("schematicCommit not pinned on the revision.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  BOM_SOURCING: {
    stage: "BOM_SOURCING",
    order: 3,
    name: "BOM sourcing",
    description:
      "Parts picked, stock + lifecycle verified before layout.",
    entryHints: [
      "Every schematic part should have an MPN.",
      "Verify stock and lifecycle before committing.",
    ],
    revisionAllowedArtifactSubkinds: ["BOM_EXPORT", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    exitGate: ({ bomLines }) => {
      const reasons: string[] = [];
      if (bomLines.length === 0) reasons.push("BOM is empty.");
      const noDatasheet = bomLines.filter((l) => !l.part.datasheetUrl);
      if (noDatasheet.length)
        reasons.push(
          `${noDatasheet.length} part(s) missing datasheet URL.`,
        );
      const eol = bomLines.filter(
        (l) => l.part.lifecycle === "EOL" || l.part.lifecycle === "OBSOLETE",
      );
      if (eol.length) reasons.push(`${eol.length} part(s) are EOL or OBSOLETE.`);
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  LAYOUT: {
    stage: "LAYOUT",
    order: 4,
    name: "Layout",
    description:
      "Placement, routing, ground pour, decoupling, controlled traces.",
    entryHints: [
      "BOM is frozen at this point; changing parts requires regressing to BOM_SOURCING.",
      "Pin the layout git commit on the revision header strip.",
      "Attach the layout artifact (KiCad PCB or file link).",
    ],
    revisionAllowedArtifactSubkinds: ["LAYOUT_FILE", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    exitGate: ({ revision, artifacts }) => {
      const reasons: string[] = [];
      const present = artifacts.some((a) => a.stage === "LAYOUT");
      if (!present) reasons.push("No layout artifact at this stage.");
      if (!revision.layoutCommit)
        reasons.push("layoutCommit not pinned on the revision.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  DRC_GERBER: {
    stage: "DRC_GERBER",
    order: 5,
    name: "DRC + Gerber",
    description: "DRC report; Gerbers + 3D inspected.",
    entryHints: [
      "Run DRC; attach the report (clean or with documented exceptions).",
      "Export and inspect the Gerber set; attach the zip.",
    ],
    revisionAllowedArtifactSubkinds: ["DRC_REPORT", "GERBER_ZIP", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    exitGate: ({ artifacts }) => {
      const reasons: string[] = [];
      const hasDrc = artifacts.some((a) => a.subkind === "DRC_REPORT");
      const hasGerber = artifacts.some((a) => a.subkind === "GERBER_ZIP");
      if (!hasDrc) reasons.push("No DRC_REPORT artifact.");
      if (!hasGerber) reasons.push("No GERBER_ZIP artifact.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  ORDERING: {
    stage: "ORDERING",
    order: 6,
    name: "Ordering",
    description: "PCB fab + parts orders placed for the active Build.",
    entryHints: [
      "Create the active Build first (label + boardCount).",
      "Attach PCB_ORDER + PARTS_ORDER artifacts to the Build.",
    ],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: ["PCB_ORDER", "PARTS_ORDER", "GENERIC"],
    exitGate: ({ activeBuild }) => {
      const reasons: string[] = [];
      if (!activeBuild) {
        reasons.push("No active Build. Create one before advancing.");
        return { ok: false, reasons };
      }
      if (!activeBuild.artifacts.some((a) => a.subkind === "PCB_ORDER"))
        reasons.push("Active Build has no PCB_ORDER artifact.");
      if (!activeBuild.artifacts.some((a) => a.subkind === "PARTS_ORDER"))
        reasons.push("Active Build has no PARTS_ORDER artifact.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  ASSEMBLY: {
    stage: "ASSEMBLY",
    order: 7,
    name: "Assembly",
    description: "Screening, hand-build, post-assembly continuity check.",
    entryHints: [
      "Register each physical Board with a serial and silkscreen hash.",
      "Use Board-scoped Checklists (subkinds SCREENING_STEP_0, ASSEMBLY_STEPS) per board.",
      "Create a Build-scoped Checklist with subkind = POST_ASSEMBLY_CONTINUITY and tick all items before advancing.",
    ],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: ["GENERIC"],
    exitGate: ({ activeBuild }) => {
      const reasons: string[] = [];
      if (!activeBuild) {
        reasons.push("No active Build.");
        return { ok: false, reasons };
      }
      if (activeBuild.boards.length === 0)
        reasons.push(
          "Active Build has no Board rows. Register at least one physical board.",
        );
      const failed = activeBuild.boards.filter((b) => b.status === "FAILED");
      if (failed.length) reasons.push(FAILED_BOARD_MSG(failed.length));
      const unfinished = activeBuild.boards.filter(
        (b) =>
          !["ASSEMBLED", "POWERED", "BROUGHT_UP", "QUARANTINED"].includes(
            b.status,
          ),
      );
      if (unfinished.length)
        reasons.push(`${unfinished.length} board(s) not yet ASSEMBLED.`);
      const continuity = activeBuild.checklists.find(
        (c) => c.subkind === "POST_ASSEMBLY_CONTINUITY",
      );
      if (!continuity)
        reasons.push(
          "No POST_ASSEMBLY_CONTINUITY Checklist on the active Build.",
        );
      else if (continuity.items.some((i) => !i.checked))
        reasons.push(
          "POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.",
        );
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  BRINGUP: {
    stage: "BRINGUP",
    order: 8,
    name: "Bring-up",
    description: "Power rails, clocks, comms, features.",
    entryHints: [
      "Power rails first. Log readings as Measurements on each Board.",
      "Click 'Mark bring-up complete' on the Build page when ready — this unlocks advance to REVISION (and freezes).",
    ],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: ["BRINGUP_LOG", "GENERIC"],
    exitGate: ({ activeBuild }) => {
      const reasons: string[] = [];
      if (!activeBuild) {
        reasons.push("No active Build.");
        return { ok: false, reasons };
      }
      if (!activeBuild.artifacts.some((a) => a.subkind === "BRINGUP_LOG"))
        reasons.push("Active Build has no BRINGUP_LOG artifact.");
      if (
        !activeBuild.artifacts.some((a) => a.subkind === "BRINGUP_COMPLETE")
      )
        reasons.push(
          "Bring-up not marked complete (advancing to REVISION freezes the rev).",
        );
      const failed = activeBuild.boards.filter((b) => b.status === "FAILED");
      if (failed.length) reasons.push(FAILED_BOARD_MSG(failed.length));
      const unfinished = activeBuild.boards.filter(
        (b) => !["BROUGHT_UP", "QUARANTINED"].includes(b.status),
      );
      if (unfinished.length)
        reasons.push(
          `${unfinished.length} board(s) not yet BROUGHT_UP or QUARANTINED.`,
        );
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  REVISION: {
    stage: "REVISION",
    order: 9,
    name: "Revision",
    description: "Errata captured; linked to next-rev changes. Terminal.",
    entryHints: [
      "Log errata as they surface.",
      "Errata can be linked forward to the rev that addresses them.",
    ],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: [],
    // No exitGate — terminal.
  },
};

// ─── Tracker display labels ────────────────────────────

/**
 * Compact display labels for §8.3 stage tracker slots. The tracker renders
 * `01 / REQUIREMENTS`, `02 / SCHEMATIC`, ... — these are the strings after
 * the `NN / ` prefix. Keeping them here (rather than deriving from the Stage
 * enum) lets us spell `BRING-UP` and `DRC + GERBER` cleanly.
 */
export const STAGE_LABELS: Record<StageName, string> = {
  REQUIREMENTS: "REQUIREMENTS",
  SCHEMATIC: "SCHEMATIC",
  BOM_SOURCING: "BOM SOURCING",
  LAYOUT: "LAYOUT",
  DRC_GERBER: "DRC + GERBER",
  ORDERING: "ORDERING",
  ASSEMBLY: "ASSEMBLY",
  BRINGUP: "BRING-UP",
  REVISION: "REVISION",
};
