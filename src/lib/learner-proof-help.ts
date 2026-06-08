// How-to guidance paired with each learner proof artifact. The learner gate
// (learner-gates.ts) decides WHICH stages require a proof; this module explains,
// in plain words a beginner can act on, WHAT to upload and HOW to produce it.
//
// Invariant (enforced by learner-proof-help.test.ts): every subkind returned by
// `learnerProofSubkind` MUST have an entry here — a proof requirement with no
// guidance is a dead end.
import type { ArtifactSubkind } from "@prisma/client";

export interface ProofHelp {
  /** Plain-words statement of what to upload at this stage. */
  requirement: string;
  /** Collapsible summary line for the step-by-step. */
  howToTitle: string;
  /** Ordered, beginner-followable steps to produce/export the artifact. */
  steps: string[];
}

const PROOF_HELP: Partial<Record<ArtifactSubkind, ProofHelp>> = {
  SCHEMATIC_FILE: {
    requirement:
      "Add your finished schematic from KiCad — the .kicad_sch file itself, or a PDF you plot from it.",
    howToTitle: "How to export your schematic from KiCad 10",
    steps: [
      "In KiCad 10, open your project and double-click the schematic to launch the Schematic Editor.",
      "Save your work with File ▸ Save (Ctrl+S). The .kicad_sch file it writes to disk is itself a valid upload.",
      "Prefer a shareable PDF? File ▸ Plot…, set Output Format to PDF, choose an output folder, then Plot All Pages.",
      "Upload the .kicad_sch file (or the plotted PDF) with the picker below.",
    ],
  },
  LAYOUT_FILE: {
    requirement:
      "Add your board layout from KiCad — the .kicad_pcb file itself, or a PDF you plot from it.",
    howToTitle: "How to export your layout from KiCad 10",
    steps: [
      "In KiCad 10, open the PCB Editor by double-clicking the board (.kicad_pcb) in your project.",
      "Save your work with File ▸ Save (Ctrl+S). The .kicad_pcb file it writes to disk is itself a valid upload.",
      "Prefer a shareable PDF? File ▸ Plot…, choose PDF, select the copper and silkscreen layers, then Plot.",
      "Upload the .kicad_pcb file (or the plotted PDF) with the picker below.",
    ],
  },
};

/** How-to guidance for a learner proof subkind, or undefined when none exists. */
export function proofHelp(subkind: ArtifactSubkind): ProofHelp | undefined {
  return PROOF_HELP[subkind];
}
