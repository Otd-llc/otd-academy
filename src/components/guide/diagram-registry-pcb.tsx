// PCB Design & Fabrication cluster diagrams (12). This window OWNS this file
// alone during the parallel diagram phase, so registering a diagram here never
// conflicts with another cluster's window. Only shared file left is the export
// manifest — use the surgical `pnpm diagrams:export --only=<name>` workflow so
// it never rewrites another cluster's rasters/hashes.
//
// As you build + export each diagram, add its component import and a map entry
// keyed by the image `src` basename from scripts/seed-pcb-design-cluster.ts:
//   import { PcbLayoutWorkflow } from "./diagrams/PcbLayoutWorkflow";
//   "/guide-diagrams/pcb-layout-workflow.svg": PcbLayoutWorkflow,
//
// Worklist (12):
//   pcb-layout-workflow   pcb-land-pattern      pcb-placement
//   pcb-routing           pcb-ground-plane      pcb-stackup
//   pcb-drc               pcb-silkscreen        pcb-gerber-package
//   pcb-dfm               pcb-reflow-profile    pcb-bringup
import type { DiagramComponent } from "./diagram-registry";
import { PcbLayoutWorkflow } from "./diagrams/PcbLayoutWorkflow";

export const PCB_DIAGRAMS: Record<string, DiagramComponent> = {
  "/guide-diagrams/pcb-layout-workflow.svg": PcbLayoutWorkflow,
};
