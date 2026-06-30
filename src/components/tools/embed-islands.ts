import type { ComponentType } from "react";

import { LipoRuntimeCalculator } from "./LipoRuntimeCalculator";
import { Ws2812PowerCalculator } from "./Ws2812PowerCalculator";
import { LedResistorCalculator } from "./LedResistorCalculator";
import { VoltageDividerCalculator } from "./VoltageDividerCalculator";
import { LdoHeadroomCalculator } from "./LdoHeadroomCalculator";
import { RcFilterCalculator } from "./RcFilterCalculator";
import { TraceWidthCalculator } from "./TraceWidthCalculator";
import { ResistorPowerCalculator } from "./ResistorPowerCalculator";
import { BatteryEnergyCalculator } from "./BatteryEnergyCalculator";

// slug -> the bare interactive island (no prose body), for /embed/[slug].
// Mirrors the BODIES map in tools/[slug]/page.tsx but island-only, so an
// embedded widget is just the calculator. A slug in TOOLS missing here 404s.
export const EMBED_ISLANDS: Record<string, ComponentType> = {
  "lipo-battery-runtime": LipoRuntimeCalculator,
  "ws2812-power-supply": Ws2812PowerCalculator,
  "led-series-resistor": LedResistorCalculator,
  "voltage-divider": VoltageDividerCalculator,
  "ldo-headroom": LdoHeadroomCalculator,
  "rc-filter-cutoff": RcFilterCalculator,
  "pcb-trace-width": TraceWidthCalculator,
  "resistor-power": ResistorPowerCalculator,
  "battery-watt-hours": BatteryEnergyCalculator,
};
