"use client";

import { useState } from "react";

import {
  packWh,
  packVoltage,
  packCapacityMah,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Interactive island for the battery watt-hours / pack-sizing page. A pack is S
// cells in series (voltage) by P in parallel (capacity); energy is the product.
export function BatteryEnergyCalculator() {
  const [capacityMah, setCapacityMah] = useState(3000);
  const [nominalV, setNominalV] = useState(3.7);
  const [series, setSeries] = useState(3);
  const [parallel, setParallel] = useState(2);

  const valid =
    capacityMah > 0 && nominalV > 0 && series >= 1 && parallel >= 1;
  const wh = valid ? packWh({ capacityMah, nominalV, series, parallel }) : null;
  const packV = valid ? packVoltage({ nominalV, series }) : null;
  const packMah = valid ? packCapacityMah({ capacityMah, parallel }) : null;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Cell capacity"
            value={capacityMah}
            onChange={setCapacityMah}
            min={1}
            step={100}
            suffix="mAh"
            hint="One cell's rated capacity (e.g. a 3000 mAh 18650)."
          />
          <NumberField
            label="Cell nominal voltage"
            value={nominalV}
            onChange={setNominalV}
            min={0.1}
            step={0.1}
            suffix="V"
            hint="~3.7 V for a Li-ion/LiPo cell; 3.2 V for LiFePO4."
          />
          <NumberField
            label="Series (S)"
            value={series}
            onChange={setSeries}
            min={1}
            step={1}
            suffix="cells"
            hint="Cells in series add voltage."
          />
          <NumberField
            label="Parallel (P)"
            value={parallel}
            onChange={setParallel}
            min={1}
            step={1}
            suffix="cells"
            hint="Cells in parallel add capacity."
          />
        </>
      }
      readout={
        <>
          <Readout
            value={wh !== null ? `${wh.toFixed(1)} Wh` : "·"}
            unit={`pack energy (${series}S${parallel}P)`}
            note="Watt-hours, not mAh, is what compares packs of different voltages and what shipping rules go by."
          />
          <div className="mt-5">
            <SubReadout
              label="Pack voltage"
              value={packV !== null ? `${packV.toFixed(1)} V nominal` : "·"}
            />
          </div>
          <div className="mt-4">
            <SubReadout
              label="Pack capacity"
              value={packMah !== null ? `${packMah} mAh` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
