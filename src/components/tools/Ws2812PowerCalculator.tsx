"use client";

import { useState } from "react";

import {
  ws2812SupplyMilliamps,
  ws2812RecommendedSupplyAmps,
  WS2812_FULL_WHITE_MA,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Interactive island for the WS2812 supply page. Math goes through the
// unit-tested ws2812 helpers; the per-pixel default is the datasheet full-white
// figure (WS2812_FULL_WHITE_MA = 60 mA).
export function Ws2812PowerCalculator() {
  const [pixelCount, setPixelCount] = useState(30);
  const [perPixelMa, setPerPixelMa] = useState(WS2812_FULL_WHITE_MA);
  const [controllerMa, setControllerMa] = useState(220);
  const [headroomPct, setHeadroomPct] = useState(20);

  const valid = pixelCount >= 0 && perPixelMa >= 0 && controllerMa >= 0;
  const totalMa = valid
    ? ws2812SupplyMilliamps({ pixelCount, perPixelMa, controllerMa })
    : null;
  const recommendedA = valid
    ? ws2812RecommendedSupplyAmps({ pixelCount, perPixelMa, controllerMa }, headroomPct)
    : null;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Pixel count"
            value={pixelCount}
            onChange={setPixelCount}
            min={0}
            step={1}
            suffix="px"
          />
          <NumberField
            label="Per-pixel draw (full white)"
            value={perPixelMa}
            onChange={setPerPixelMa}
            min={0}
            step={5}
            suffix="mA"
            hint="WS2812B full white is ~60 mA (three ~20 mA channels). Lower it if you cap brightness in firmware."
          />
          <NumberField
            label="Controller overhead"
            value={controllerMa}
            onChange={setControllerMa}
            min={0}
            step={10}
            suffix="mA"
            hint="The ESP32 / driver board's own draw on the 5 V rail."
          />
          <NumberField
            label="Headroom"
            value={headroomPct}
            onChange={setHeadroomPct}
            min={0}
            step={5}
            suffix="%"
            hint="Margin so the supply never runs at 100%. 20% is a sane default."
          />
        </>
      }
      readout={
        <>
          <Readout
            value={recommendedA !== null ? `${recommendedA.toFixed(2)} A` : "·"}
            unit={`recommended supply (+${headroomPct}%) at 5 V`}
            note="Inject power at both ends for long strings."
          />
          <div className="mt-5">
            <SubReadout
              label="Worst-case draw, full white"
              value={totalMa !== null ? `${totalMa} mA · ${(totalMa / 1000).toFixed(2)} A` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
