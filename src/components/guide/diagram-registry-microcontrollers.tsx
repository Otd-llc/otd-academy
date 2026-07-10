// Microcontrollers & ESP32 cluster diagrams (11). This window OWNS this file
// alone during the parallel diagram phase, so registering a diagram here never
// conflicts with another cluster's window. Only shared file left is the export
// manifest — use the surgical `pnpm diagrams:export --only=<name>` workflow so
// it never rewrites another cluster's rasters/hashes.
//
// As you build + export each diagram, add its component import and a map entry
// keyed by the image `src` basename from scripts/seed-microcontrollers-cluster.ts:
//   import { McuBlockDiagram } from "./diagrams/McuBlockDiagram";
//   "/guide-diagrams/mcu-block-diagram.svg": McuBlockDiagram,
//
// Worklist (11):
//   mcu-block-diagram      mcu-gpio-in-out        mcu-adc-quantize
//   mcu-pwm-duty           mcu-strapping-boot     mcu-flash-loop
//   mcu-timer-count        mcu-poll-vs-interrupt  mcu-peripheral-mux
//   mcu-sleep-current      mcu-pinout-map
import type { DiagramComponent } from "./diagram-registry";
import { McuBlockDiagram } from "./diagrams/McuBlockDiagram";
import { McuGpioInOut } from "./diagrams/McuGpioInOut";
import { McuAdcQuantize } from "./diagrams/McuAdcQuantize";
import { McuPwmDuty } from "./diagrams/McuPwmDuty";
import { McuStrappingBoot } from "./diagrams/McuStrappingBoot";
import { McuFlashLoop } from "./diagrams/McuFlashLoop";
import { McuTimerCount } from "./diagrams/McuTimerCount";
import { McuPollVsInterrupt } from "./diagrams/McuPollVsInterrupt";
import { McuPeripheralMux } from "./diagrams/McuPeripheralMux";
import { McuSleepCurrent } from "./diagrams/McuSleepCurrent";
import { McuPinoutMap } from "./diagrams/McuPinoutMap";

export const MICROCONTROLLERS_DIAGRAMS: Record<string, DiagramComponent> = {
  "/guide-diagrams/mcu-block-diagram.svg": McuBlockDiagram,
  "/guide-diagrams/mcu-gpio-in-out.svg": McuGpioInOut,
  "/guide-diagrams/mcu-adc-quantize.svg": McuAdcQuantize,
  "/guide-diagrams/mcu-pwm-duty.svg": McuPwmDuty,
  "/guide-diagrams/mcu-strapping-boot.svg": McuStrappingBoot,
  "/guide-diagrams/mcu-flash-loop.svg": McuFlashLoop,
  "/guide-diagrams/mcu-timer-count.svg": McuTimerCount,
  "/guide-diagrams/mcu-poll-vs-interrupt.svg": McuPollVsInterrupt,
  "/guide-diagrams/mcu-peripheral-mux.svg": McuPeripheralMux,
  "/guide-diagrams/mcu-sleep-current.svg": McuSleepCurrent,
  "/guide-diagrams/mcu-pinout-map.svg": McuPinoutMap,
};
