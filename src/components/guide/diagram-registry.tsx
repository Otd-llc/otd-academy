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
};
