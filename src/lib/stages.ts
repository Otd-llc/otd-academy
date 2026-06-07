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
  Project,
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
  /** Preferred subkind the revision artifact picker pre-selects — the artifact
   *  this stage exists to produce (e.g. SCHEMATIC ⇒ SCHEMATIC_FILE). MUST be one
   *  of `revisionAllowedArtifactSubkinds`; absent ⇒ the picker falls back to the
   *  first allowed subkind. Decouples the default from list order so it can't
   *  silently drift if the allowed-list is reordered. */
  defaultRevisionArtifactSubkind?: ArtifactSubkind;
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
  // m17 / m18: surface project-level flags consumed by gate predicates.
  // `requiresStripboard` (m17) drives the STRIPBOARD_VALIDATION branch of
  // the BOM_SOURCING gate; `hasMainsNet` (m18) drives the certified-module
  // branch of the same gate (proposal §3 #5).
  // `level` lets the REQUIREMENTS gate drop the formal REQUIREMENTS_REVIEW
  // design-review checklist for true-beginner (L1) guided builds — those have no
  // open design decisions to "review", so the requirements artifact + the
  // comprehension quiz carry the gate. L2/L3 (and level-less projects, e.g. the
  // seed fixture) keep the review checklist.
  project: Pick<Project, "id" | "requiresStripboard" | "hasMainsNet" | "level">;
  bomLines: (BomLine & { part: Part })[];
  artifacts: Artifact[];
  // m15: revision-scoped checklists across ALL stages. Each gate that
  // consumes them filters by `subkind` (see m16 — REQUIREMENTS_REVIEW,
  // LAYOUT_REVIEW). Loading all of them keeps the loader simple and lets
  // each gate predicate own its subkind→stage policy.
  revisionChecklists: (Checklist & { items: ChecklistItem[] })[];
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

// Quizzes are LEARNER-only now (gated per-Enrollment via learnerExitGate); the
// author/reference build is NOT quiz-gated. So STAGES holds the raw work-gates.
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
    // m16: in addition to a stage-tagged artifact, REQUIREMENTS now also
    // requires a REQUIREMENTS_REVIEW Checklist with every item checked or
    // flagged N/A. Mirrors the ASSEMBLY 3-branch predicate
    // (missing / zero items / unchecked non-N/A) so the failure copy stays
    // diagnostic.
    exitGate: ({ project, artifacts, revisionChecklists }) => {
      const reasons: string[] = [];
      const present = artifacts.some((a) => a.stage === "REQUIREMENTS");
      if (!present)
        reasons.push("No requirements artifact at this stage.");

      // True-beginner (L1) guided builds skip the formal REQUIREMENTS_REVIEW
      // design-review checklist — there are no open design decisions to review,
      // and the comprehension quiz already gates understanding. L2/L3 and
      // level-less projects still require the review.
      if (project.level !== "L1") {
        const review = revisionChecklists.find(
          (c) => c.subkind === "REQUIREMENTS_REVIEW",
        );
        if (!review) {
          reasons.push("No REQUIREMENTS_REVIEW Checklist on the revision.");
        } else if (review.items.length === 0) {
          reasons.push("REQUIREMENTS_REVIEW Checklist has no items.");
        } else if (
          review.items.some((i) => !i.checked && !i.notApplicable)
        ) {
          reasons.push("REQUIREMENTS_REVIEW Checklist has unchecked items.");
        }
      }

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
    defaultRevisionArtifactSubkind: "SCHEMATIC_FILE",
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
    // m17: when `project.requiresStripboard === true`, the gate additionally
    // requires a STRIPBOARD_VALIDATION Checklist on the revision with every
    // item checked-or-N/A. Mirrors the 3-branch ASSEMBLY / REQUIREMENTS /
    // LAYOUT predicate (missing / zero items / unchecked non-N/A) for
    // diagnostic copy parity (proposal §3 #4).
    //
    // m18: when `project.hasMainsNet === true`, the gate additionally
    // requires at least one BomLine whose part.isCertifiedModule is true
    // (proposal §3 #5). Independent from the stripboard branch — a project
    // can have neither, either, or both flags.
    exitGate: ({ project, bomLines, revisionChecklists }) => {
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

      if (project.requiresStripboard) {
        const sv = revisionChecklists.find(
          (c) => c.subkind === "STRIPBOARD_VALIDATION",
        );
        if (!sv) {
          reasons.push("No STRIPBOARD_VALIDATION Checklist on the revision.");
        } else if (sv.items.length === 0) {
          reasons.push("STRIPBOARD_VALIDATION Checklist has no items.");
        } else if (
          sv.items.some((i) => !i.checked && !i.notApplicable)
        ) {
          reasons.push(
            "STRIPBOARD_VALIDATION Checklist has unchecked items.",
          );
        }
      }

      if (project.hasMainsNet) {
        const hasCertified = bomLines.some((l) => l.part.isCertifiedModule);
        if (!hasCertified) {
          reasons.push(
            "Project has mains net but no certified-module part on the BOM.",
          );
        }
      }

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
    // MODEL_3D (board stub): the board's physical 3D form is a LAYOUT-stage
    // output (KiCad's 3D export of the routed PCB), so the design-side picker
    // offers it here alongside the layout file.
    revisionAllowedArtifactSubkinds: ["LAYOUT_FILE", "MODEL_3D", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    // m16: LAYOUT additionally requires a LAYOUT_REVIEW Checklist with every
    // item checked or N/A — same 3-branch predicate as REQUIREMENTS /
    // ASSEMBLY for diagnostic copy parity.
    exitGate: ({ revision, artifacts, revisionChecklists }) => {
      const reasons: string[] = [];
      const present = artifacts.some((a) => a.stage === "LAYOUT");
      if (!present) reasons.push("No layout artifact at this stage.");
      if (!revision.layoutCommit)
        reasons.push("layoutCommit not pinned on the revision.");

      const review = revisionChecklists.find(
        (c) => c.subkind === "LAYOUT_REVIEW",
      );
      if (!review) {
        reasons.push("No LAYOUT_REVIEW Checklist on the revision.");
      } else if (review.items.length === 0) {
        reasons.push("LAYOUT_REVIEW Checklist has no items.");
      } else if (
        review.items.some((i) => !i.checked && !i.notApplicable)
      ) {
        reasons.push("LAYOUT_REVIEW Checklist has unchecked items.");
      }

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
    // m14: GERBER_ZIP is now either-scoped (proposal §3 #9). The DRC_GERBER
    // exit gate accepts a GERBER_ZIP that lives on the revision OR on the
    // active Build (the fab-submission snapshot).
    exitGate: ({ artifacts, activeBuild }) => {
      const reasons: string[] = [];
      const hasDrc = artifacts.some((a) => a.subkind === "DRC_REPORT");
      const hasGerber =
        artifacts.some((a) => a.subkind === "GERBER_ZIP") ||
        (activeBuild?.artifacts ?? []).some((a) => a.subkind === "GERBER_ZIP");
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
    // m14: ORDERING build pane accepts the BOM_CSV_AS_ORDERED snapshot + the
    // GERBER_ZIP fab-submission snapshot alongside the order receipts.
    buildAllowedArtifactSubkinds: [
      "PCB_ORDER",
      "PARTS_ORDER",
      "BOM_CSV_AS_ORDERED",
      "GERBER_ZIP",
      "GENERIC",
    ],
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
    // m14: ASSEMBLY build pane accepts ASSEMBLY_PHOTO snapshots.
    buildAllowedArtifactSubkinds: ["ASSEMBLY_PHOTO", "GENERIC"],
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
      // m16: 3-branch predicate. Zero-item checklists previously slipped
      // through because `Array.prototype.some` on an empty array is `false`
      // (vacuous pass). The new branch explicitly fails on length === 0, and
      // the unchecked-items branch now ignores items flagged
      // `notApplicable: true` so the optional / "skip this step" workflow
      // (Task 16.10) does not block the gate. Mirrors the raw CHECK
      // `checklist_item_checked_xor_napplicable` (Task 16.3).
      if (!continuity) {
        reasons.push(
          "No POST_ASSEMBLY_CONTINUITY Checklist on the active Build.",
        );
      } else if (continuity.items.length === 0) {
        reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has no items.");
      } else if (
        continuity.items.some((i) => !i.checked && !i.notApplicable)
      ) {
        reasons.push(
          "POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.",
        );
      }
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
    // m14: BRINGUP build pane accepts BRINGUP_MEASUREMENTS_CSV exports.
    // BRINGUP_COMPLETE remains intentionally OUT of this list — only the
    // dedicated `markBringupComplete` server action creates that sentinel
    // (design §9.2; pinned by artifacts-actions test).
    // MODEL_3D (board stub): a physical assembled-board / sub-assembly 3D model
    // is captured against the Build during bring-up, so the build-side picker
    // offers it here. Consistent with ARTIFACT_SUBKIND_OWNER's MODEL_3D: "either".
    buildAllowedArtifactSubkinds: [
      "BRINGUP_LOG",
      "BRINGUP_MEASUREMENTS_CSV",
      "MODEL_3D",
      "GENERIC",
    ],
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
