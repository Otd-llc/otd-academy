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
import { GerberLayerStack } from "./diagrams/GerberLayerStack";
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

export type DiagramComponent = FC<{ caption?: string }>;

export const DIAGRAM_COMPONENTS: Record<string, DiagramComponent> = {
  "/guide-diagrams/mpn-anatomy.svg": MpnAnatomyDiagram,
  "/guide-diagrams/0805-vs-0402.svg": PackageSizeDiagram,
  "/guide-diagrams/current-budget.svg": CurrentBudget,
  "/guide-diagrams/hasl-vs-enig.svg": HaslVsEnig,
  "/guide-diagrams/two-layer-cross-section.svg": TwoLayerCrossSection,
  "/guide-diagrams/gerber-layer-stack.svg": GerberLayerStack,
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
};
