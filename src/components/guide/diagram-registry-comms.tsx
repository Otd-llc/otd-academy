// Communication & Interfaces cluster diagrams (11). This window OWNS this file
// alone during the parallel diagram phase, so registering a diagram here never
// conflicts with another cluster's window. Only shared file left is the export
// manifest — use the surgical `pnpm diagrams:export --only=<name>` workflow so
// it never rewrites another cluster's rasters/hashes.
//
// As you build + export each diagram, add its component import and a map entry
// keyed by the image `src` basename from scripts/seed-comms-cluster.ts:
//   import { CommsUartFrame } from "./diagrams/CommsUartFrame";
//   "/guide-diagrams/comms-uart-frame.svg": CommsUartFrame,
//
// Worklist (11):
//   comms-serial-vs-parallel   comms-bus-compare      comms-uart-frame
//   comms-spi-bus              comms-i2c-bus          comms-usb-enumerate
//   comms-usb-c-cc             comms-level-shift      comms-pull-up-down
//   comms-isolation-barrier    comms-bus-trace
import type { DiagramComponent } from "./diagram-registry";
import { CommsSerialVsParallel } from "./diagrams/CommsSerialVsParallel";

export const COMMS_DIAGRAMS: Record<string, DiagramComponent> = {
  "/guide-diagrams/comms-serial-vs-parallel.svg": CommsSerialVsParallel,
};
