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
  ERC_REPORT: {
    requirement:
      "Run KiCad's Electrical Rules Check (ERC) on your schematic and upload the report once it's clean — zero errors.",
    howToTitle: "How to run ERC and export the report in KiCad 10",
    steps: [
      "In KiCad 10, open the Schematic Editor for your project.",
      "Run Inspect ▸ Electrical Rules Checker, then press Run ERC.",
      "Fix every error: unconnected pins (wire them or add a no-connect ✕), power pins not driven (add a PWR_FLAG to each supply net), and any pin-conflict warnings.",
      "Re-run until it reports zero errors, then use Save… in the ERC dialog to write the report file.",
      "Upload that ERC report with the picker below.",
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
  DRC_REPORT: {
    requirement:
      "Run KiCad's Design Rules Check (DRC) on your board and upload the report once it's clean — zero violations.",
    howToTitle: "How to run DRC and export the report in KiCad 10",
    steps: [
      "In KiCad 10, open the PCB Editor for your project.",
      "Run Inspect ▸ Design Rules Checker, then press Run DRC.",
      "Fix every violation: clearance and track-width errors (nudge a trace apart or widen it), unconnected items (finish the route, or add a no-connect), and courtyard overlaps (move a part).",
      "Re-run until it reports zero violations, then use Save… in the DRC dialog to write the report file.",
      "Upload that DRC report with the picker below.",
    ],
  },
};

/** How-to guidance for a learner proof subkind, or undefined when none exists. */
export function proofHelp(subkind: ArtifactSubkind): ProofHelp | undefined {
  return PROOF_HELP[subkind];
}
