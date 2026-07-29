// Registry: guide-diagram content blocks whose `src` matches a key here render
// as a responsive React component instead of the (mobile-illegible) scaled SVG.
// The DB stays a plain `image` block; ImageBlock (GuideBlocks.tsx) looks up the
// src here. See docs/diagrams/diagram-standards.md for the frame + type system.
import type { FC } from "react";
import { MpnAnatomyDiagram } from "./MpnAnatomyDiagram";
import { PackageSizeDiagram } from "./PackageSizeDiagram";
import { CurrentBudget } from "./diagrams/CurrentBudget";
import { HaslVsEnig } from "./diagrams/HaslVsEnig";
import { TwoLayerCrossSection } from "./diagrams/TwoLayerCrossSection";
import { FourLayerCrossSection } from "./diagrams/FourLayerCrossSection";
import { GerberLayerStack } from "./diagrams/GerberLayerStack";
import { L101GerberStack } from "./diagrams/L101GerberStack";
import { ContinuityVbusGnd } from "./diagrams/ContinuityVbusGnd";
import { Adc1PinMap } from "./diagrams/Adc1PinMap";
import { AntennaKeepout } from "./diagrams/AntennaKeepout";
import { DecouplingPlacement } from "./diagrams/DecouplingPlacement";
import { SchematicConventions } from "./diagrams/SchematicConventions";
import { BringupLadder } from "./diagrams/BringupLadder";
import { BringupProbePoints } from "./diagrams/BringupProbePoints";
import { WroomPowerFlow } from "./diagrams/WroomPowerFlow";
import { MuRhythmErd } from "./diagrams/MuRhythmErd";
import { EegBciPipeline } from "./diagrams/EegBciPipeline";
import { Ads1299Channel } from "./diagrams/Ads1299Channel";
import { DroneSharedAutonomy } from "./diagrams/DroneSharedAutonomy";
import { IsolationBarrier } from "./diagrams/IsolationBarrier";
import { RightLegDrive } from "./diagrams/RightLegDrive";
import { LeadShielding } from "./diagrams/LeadShielding";
import { InstrumentationAmp } from "./diagrams/InstrumentationAmp";
import { TenTwentyMidline } from "./diagrams/TenTwentyMidline";
import { FrequencyBands } from "./diagrams/FrequencyBands";
import { ClassificationPipeline } from "./diagrams/ClassificationPipeline";
import { SourceToScalp } from "./diagrams/SourceToScalp";
import { BciLoop } from "./diagrams/BciLoop";
import { FundPrefixLadder } from "./diagrams/FundPrefixLadder";
import { FundVirRelationship } from "./diagrams/FundVirRelationship";
import { FundOhmsWheel } from "./diagrams/FundOhmsWheel";
import { FundPowerHeat } from "./diagrams/FundPowerHeat";
import { FundResistorEseries } from "./diagrams/FundResistorEseries";
import { FundVoltageDivider } from "./diagrams/FundVoltageDivider";
import { FundDecouplingCap } from "./diagrams/FundDecouplingCap";
import { FundDiodeLed } from "./diagrams/FundDiodeLed";
import { FundRcFilter } from "./diagrams/FundRcFilter";
import { FundGroundsRails } from "./diagrams/FundGroundsRails";
import { FundSchematicAnatomy } from "./diagrams/FundSchematicAnatomy";
import { FundDatasheetAnatomy } from "./diagrams/FundDatasheetAnatomy";
// Per-cluster diagram registries. Each is owned by ONE window during the parallel
// diagram-sandbox phase, so registering a diagram only touches that cluster's own
// file, never this shared index. Each stays `{}` until its window builds + exports
// its diagrams. Keys match the image `src` basenames in the cluster's seed script.
import { PCB_DIAGRAMS } from "./diagram-registry-pcb";
import { COMMS_DIAGRAMS } from "./diagram-registry-comms";
import { POWER_DIAGRAMS } from "./diagram-registry-power";
import { MICROCONTROLLERS_DIAGRAMS } from "./diagram-registry-microcontrollers";

export type DiagramComponent = FC<{ caption?: string }>;

// The core, EEG, and Fundamentals diagrams (already built). New clusters live in
// their own per-cluster module (imported above) and compose in below.
const CORE_DIAGRAMS: Record<string, DiagramComponent> = {
  "/guide-diagrams/mpn-anatomy.svg": MpnAnatomyDiagram,
  "/guide-diagrams/0805-vs-0402.svg": PackageSizeDiagram,
  "/guide-diagrams/current-budget.svg": CurrentBudget,
  "/guide-diagrams/hasl-vs-enig.svg": HaslVsEnig,
  "/guide-diagrams/two-layer-cross-section.svg": TwoLayerCrossSection,
  "/guide-diagrams/four-layer-cross-section.svg": FourLayerCrossSection,
  "/guide-diagrams/gerber-layer-stack.svg": GerberLayerStack,
  "/guide-diagrams/l101-gerber-stack.svg": L101GerberStack,
  "/guide-diagrams/continuity-vbus-gnd.svg": ContinuityVbusGnd,
  "/guide-diagrams/adc1-pin-map.svg": Adc1PinMap,
  "/guide-diagrams/antenna-keepout.svg": AntennaKeepout,
  "/guide-diagrams/decoupling-placement.svg": DecouplingPlacement,
  "/guide-diagrams/schematic-conventions.svg": SchematicConventions,
  "/guide-diagrams/bringup-ladder.svg": BringupLadder,
  "/guide-diagrams/bringup-probe-points.svg": BringupProbePoints,
  "/guide-diagrams/wroom-power-flow.svg": WroomPowerFlow,
  "/guide-diagrams/mu-rhythm-erd.svg": MuRhythmErd,
  "/guide-diagrams/eeg-bci-pipeline.svg": EegBciPipeline,
  "/guide-diagrams/ads1299-channel.svg": Ads1299Channel,
  "/guide-diagrams/drone-shared-autonomy.svg": DroneSharedAutonomy,
  "/guide-diagrams/isolation-barrier.svg": IsolationBarrier,
  "/guide-diagrams/right-leg-drive.svg": RightLegDrive,
  "/guide-diagrams/lead-shielding.svg": LeadShielding,
  "/guide-diagrams/instrumentation-amp.svg": InstrumentationAmp,
  "/guide-diagrams/ten-twenty-midline.svg": TenTwentyMidline,
  "/guide-diagrams/frequency-bands.svg": FrequencyBands,
  "/guide-diagrams/classification-pipeline.svg": ClassificationPipeline,
  "/guide-diagrams/source-to-scalp.svg": SourceToScalp,
  "/guide-diagrams/bci-loop.svg": BciLoop,
  // Fundamentals cluster
  "/guide-diagrams/fund-prefix-ladder.svg": FundPrefixLadder,
  "/guide-diagrams/fund-vir-relationship.svg": FundVirRelationship,
  "/guide-diagrams/fund-ohms-wheel.svg": FundOhmsWheel,
  "/guide-diagrams/fund-power-heat.svg": FundPowerHeat,
  "/guide-diagrams/fund-resistor-eseries.svg": FundResistorEseries,
  "/guide-diagrams/fund-voltage-divider.svg": FundVoltageDivider,
  "/guide-diagrams/fund-decoupling-cap.svg": FundDecouplingCap,
  "/guide-diagrams/fund-diode-led.svg": FundDiodeLed,
  "/guide-diagrams/fund-rc-filter.svg": FundRcFilter,
  "/guide-diagrams/fund-grounds-rails.svg": FundGroundsRails,
  "/guide-diagrams/fund-schematic-anatomy.svg": FundSchematicAnatomy,
  "/guide-diagrams/fund-datasheet-anatomy.svg": FundDatasheetAnatomy,
};

// The full lookup GuideBlocks resolves an image `src` against: the core set above
// plus each cluster's own registry. Spread-compose so no two windows edit the same
// object. A cluster with no diagrams yet contributes an empty spread (a no-op).
export const DIAGRAM_COMPONENTS: Record<string, DiagramComponent> = {
  ...CORE_DIAGRAMS,
  ...PCB_DIAGRAMS,
  ...COMMS_DIAGRAMS,
  ...POWER_DIAGRAMS,
  ...MICROCONTROLLERS_DIAGRAMS,
};
