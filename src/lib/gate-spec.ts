// Single source of truth for what each pipeline stage requires of a LEARNER to
// advance, and how the gate UI presents + collects it. One place so the gate
// LOGIC (learner-gates.ts), the gate WIDGET (requirement rows), and the upload
// MODAL (accept filter + how-to) can't drift apart — that drift, across three
// separate label maps, is exactly what silently hid the SCHEMATIC ERC upload
// (the page knew SCHEMATIC_FILE/LAYOUT_FILE but not ERC_REPORT). PURE: no DB,
// React, env, or network.
import type { Stage, ArtifactSubkind } from "@prisma/client";
import { proofHelp, type ProofHelp } from "@/lib/learner-proof-help";

/** Content-validation id for an uploaded proof; null = accept on presence.
 *  (Validators are declared here now; enforcement lands in the content-validation
 *  workstream — see docs/plans/2026-06-10-stage-gate-redesign-design.md §2.4.) */
export type GateValidator = "erc" | "drc";

export interface GateArtifactSpec {
  subkind: ArtifactSubkind;
  /** Short label in gate rows + reasons, e.g. "clean ERC report". */
  label: string;
  /** The file-input `accept` filter the upload modal preloads, e.g. ".rpt,.txt". */
  accept: string;
  /** Validator run on the uploaded file; null = accept on presence (for now). */
  validate: GateValidator | null;
}

export interface GateSpec {
  /** A passed comprehension quiz is required (when the stage's card has one). */
  quiz: boolean;
  /** The proof artifact a learner must upload, or null for quiz-only stages. */
  artifact: GateArtifactSpec | null;
}

// A proof artifact is required only where a learner produces a checkable output:
// a clean ERC report at SCHEMATIC, a clean DRC report at DRC_GERBER — each
// verified to zero errors/violations. The DRC upload lives on the DRC / GERBER
// card (the one named for it), matching the author gate; LAYOUT is quiz-only.
// Everything else is comprehension (quiz-only); the deep fab chain after stays
// the shared reference.
const ARTIFACT: Partial<Record<Stage, GateArtifactSpec>> = {
  SCHEMATIC: {
    subkind: "ERC_REPORT",
    label: "clean ERC report",
    accept: ".rpt,.txt",
    validate: "erc",
  },
  DRC_GERBER: {
    subkind: "DRC_REPORT",
    label: "clean DRC report",
    accept: ".rpt,.txt",
    validate: "drc",
  },
};

export interface GateSpecOpts {
  /**
   * Whether the stage's card actually carries a (renderable) quiz block. The
   * doc comment on GateSpec.quiz always promised "when the stage's card has
   * one" — this implements it. Omitted = quiz required (back-compat; callers
   * that can see the card should pass it, or a quiz-less card strands the
   * learner behind an unproducible QuizPass while the UI says "coming soon".
   */
  cardHasQuiz?: boolean;
  /**
   * Whether the course's build produces fab artifacts (ERC/DRC reports). Every
   * catalog course today does; the seam exists so the first module-integration
   * or firmware-only course can flip it instead of stranding learners at
   * SCHEMATIC / DRC_GERBER with an un-uploadable proof. Omitted = true.
   */
  hasFabOutputs?: boolean;
}

/** What a learner must satisfy to clear a stage, plus how to present it. */
export function gateSpec(stage: Stage, opts?: GateSpecOpts): GateSpec {
  const hasFab = opts?.hasFabOutputs ?? true;
  return {
    quiz: opts?.cardHasQuiz !== false,
    artifact: hasFab ? (ARTIFACT[stage] ?? null) : null,
  };
}

/** How-to help for a stage's proof artifact, or undefined for quiz-only stages. */
export function gateArtifactHelp(stage: Stage): ProofHelp | undefined {
  const a = ARTIFACT[stage];
  return a ? proofHelp(a.subkind) : undefined;
}
