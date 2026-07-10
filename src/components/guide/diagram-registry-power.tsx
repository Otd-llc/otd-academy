// Power & Batteries cluster diagrams (11). This window OWNS this file alone
// during the parallel diagram phase, so registering a diagram here never
// conflicts with another cluster's window. Only shared file left is the export
// manifest — use the surgical `pnpm diagrams:export --only=<name>` workflow so
// it never rewrites another cluster's rasters/hashes.
//
// As you build + export each diagram, add its component import and a map entry
// keyed by the image `src` basename from scripts/seed-power-cluster.ts:
//   import { PowerBudget } from "./diagrams/PowerBudget";
//   "/guide-diagrams/power-power-budget.svg": PowerBudget,
//
// Worklist (11):
//   power-power-budget     power-discharge-curve   power-safe-window
//   power-cc-cv            power-ldo-dissipation   power-buck-topology
//   power-boost-topology   power-regulator-choice  power-input-protection
//   power-sequencing       power-runtime
import type { DiagramComponent } from "./diagram-registry";
import { PowerBudget } from "./diagrams/PowerBudget";
import { DischargeCurve } from "./diagrams/DischargeCurve";
import { SafeWindow } from "./diagrams/SafeWindow";
import { CcCvCurve } from "./diagrams/CcCvCurve";
import { LdoDissipation } from "./diagrams/LdoDissipation";
import { BuckTopology } from "./diagrams/BuckTopology";
import { BoostTopology } from "./diagrams/BoostTopology";

export const POWER_DIAGRAMS: Record<string, DiagramComponent> = {
  "/guide-diagrams/power-power-budget.svg": PowerBudget,
  "/guide-diagrams/power-discharge-curve.svg": DischargeCurve,
  "/guide-diagrams/power-safe-window.svg": SafeWindow,
  "/guide-diagrams/power-cc-cv.svg": CcCvCurve,
  "/guide-diagrams/power-ldo-dissipation.svg": LdoDissipation,
  "/guide-diagrams/power-buck-topology.svg": BuckTopology,
  "/guide-diagrams/power-boost-topology.svg": BoostTopology,
};
