// SANDBOX fixtures — the two combs' real content, frozen.
//
// The round is about SIZE, so the cells have to carry what they really carry: the
// stage titles and leads from `guide-templates/stage-skeletons.ts`, and the course
// names + tracks from `scripts/populate-curriculum-dag.ts`. A lorem cell would make
// every type-scale judgement wrong.
//
// Frozen rather than fetched on purpose: the page stays a client component with no DB
// round-trip and no session, so it renders identically for anyone opening it.

export type CellKind = "done" | "current" | "pending" | "blocked";

export interface GuideCell {
  stage: string;
  num: string;
  title: string;
  lead: string;
  /** UNUSED. A third disclosure tier rendered this under the lead; it was cut
   *  (owner, round three) because a fifth string on the face is what tipped the cell
   *  from dense to unreadable. Kept as data in case the tier returns. */
  detail: string;
  kind: CellKind;
  statusText: string;
}

/** The build-guide hub, mid-build: three stages behind, one live, one gated. */
export const GUIDE_CELLS: GuideCell[] = [
  {
    stage: "REQUIREMENTS",
    detail: "Your requirements doc / block diagram",
    num: "01",
    title: "REQUIREMENTS",
    lead: "Pin down what the board must do and the constraints it must honor before any schematic work.",
    kind: "done",
    statusText: "Done",
  },
  {
    stage: "BOM_SOURCING",
    detail: "The locked BOM (your spreadsheet or Digikey cart)",
    num: "02",
    title: "BOM SOURCING",
    lead: "Lock and source every part before you draw a single net.",
    kind: "done",
    statusText: "Done",
  },
  {
    stage: "SCHEMATIC",
    detail: "KiCad ▸ the finished schematic (or a key sub-circuit)",
    num: "03",
    title: "SCHEMATIC",
    lead: "Capture your already-sourced circuit, then pass ERC.",
    kind: "done",
    statusText: "Done",
  },
  {
    stage: "LAYOUT",
    detail: "KiCad ▸ PCB editor ▸ the routed board",
    num: "04",
    title: "LAYOUT",
    lead: "Place and route; honor the keep-outs.",
    kind: "current",
    statusText: "Continue",
  },
  {
    stage: "DRC_GERBER",
    detail: "KiCad ▸ DRC report (0 errors) + the Gerber/3D preview",
    num: "05",
    title: "DRC / GERBER",
    lead: "Pass DRC and export fabrication outputs.",
    kind: "blocked",
    statusText: "Locked",
  },
  {
    stage: "ORDERING",
    detail: "Your PCB + parts order confirmation",
    num: "06",
    title: "ORDERING",
    lead: "Order boards and parts.",
    kind: "pending",
    statusText: "Ahead",
  },
  {
    stage: "ASSEMBLY",
    detail: "The assembled board, top side",
    num: "07",
    title: "ASSEMBLY",
    lead: "Hand-build the boards; screen before paste.",
    kind: "pending",
    statusText: "Ahead",
  },
  {
    stage: "BRINGUP",
    detail: "The board powered up + your bring-up readings",
    num: "08",
    title: "BRINGUP",
    lead: "Power on safely; record measurements.",
    kind: "pending",
    statusText: "Ahead",
  },
];

export interface CourseCell {
  slug: string;
  title: string;
  /** UNUSED. See GuideCell.detail. */
  detail: string;
  track: "SENSE" | "ACT" | "POWER" | "COMMS";
  kind: CellKind;
  dim: boolean;
  starred: boolean;
  statusText: string;
}

/** The /courses critical path to the EEG build: sixteen nodes, one of them the goal.
 *  Only L1.01 has a baked comb render today, so every other cell draws the ghost
 *  stand-in, which is the real state of that page and part of what the round judges. */
export const COURSE_CELLS: CourseCell[] = [
  { slug: "l1-01-wroom-breakout", detail: "WROOM module, USB-C, 3.3V LDO, USB-UART bridge, auto-program circuit", title: "L1.01 WROOM breakout", track: "COMMS", kind: "done", dim: false, starred: false, statusText: "Done" },
  { slug: "l1-02-espnow-link", detail: "ESP-NOW pairing, channel and peer addressing, TX/RX role flashing", title: "L1.02 ESP-NOW link", track: "COMMS", kind: "current", dim: false, starred: false, statusText: "Next" },
  { slug: "l1-03-ws2812-node", detail: "Addressable-LED drive, 3.3V to 5V level shifting, dedicated 5V LED rail", title: "L1.03 WS2812 node", track: "ACT", kind: "pending", dim: false, starred: false, statusText: "Start" },
  { slug: "l1-04-single-servo", detail: "PWM servo drive, brownout-on-stall mitigation", title: "L1.04 single servo", track: "ACT", kind: "pending", dim: false, starred: false, statusText: "Start" },
  { slug: "l1-05-internal-adc", detail: "Internal ADC limits, and the ADC1-vs-ADC2 trap with WiFi active", title: "L1.05 internal ADC", track: "SENSE", kind: "pending", dim: false, starred: false, statusText: "Start" },
  { slug: "l2-01-battery-power-module", detail: "Single-cell charging, load-share, LDO-after-switcher quiet rails", title: "L2.01 battery power module", track: "POWER", kind: "pending", dim: true, starred: false, statusText: "Premium" },
  { slug: "l2-02-ads1220-sense", detail: "Precision 24-bit SPI ADC layout, low-noise reference, analog ground", title: "L2.02 ADS1220 sense", track: "SENSE", kind: "pending", dim: true, starred: false, statusText: "Premium" },
  { slug: "l2-03-motor-driver", detail: "Brushed-DC H-bridge drive, ESP-NOW commanded actuator latency", title: "L2.03 motor driver", track: "ACT", kind: "pending", dim: true, starred: false, statusText: "Premium" },
  { slug: "l2-04-power-led-driver", detail: "Constant-current LED driver, linear-vs-switching tradeoff", title: "L2.04 power LED driver", track: "POWER", kind: "pending", dim: true, starred: false, statusText: "Premium" },
  { slug: "l2-05-isolated-spi-bridge", detail: "Digital SPI isolator, isolated DC-DC, post-regulating a noisy rail", title: "L2.05 isolated SPI bridge", track: "COMMS", kind: "blocked", dim: false, starred: false, statusText: "Locked" },
  { slug: "l3-de-ads1292r", detail: "Biopotential AFE basics, right-leg-drive bias, lead-off detection", title: "L3 de-risk ADS1292R", track: "SENSE", kind: "pending", dim: true, starred: false, statusText: "Soon" },
  { slug: "l3-01-eeg-front-end", detail: "8-channel biopotential AFE, galvanic isolation, Cyton-protocol firmware", title: "L3.01 EEG front-end", track: "SENSE", kind: "pending", dim: true, starred: true, statusText: "Premium" },
  { slug: "l3-02-brushless-motor", detail: "Three-phase brushless drive, back-EMF sensing and commutation", title: "L3.02 brushless motor", track: "ACT", kind: "pending", dim: true, starred: false, statusText: "Soon" },
  { slug: "l3-03-lighting-array", detail: "Multi-channel power-LED scale, thermal management, DC distribution", title: "L3.03 lighting array", track: "ACT", kind: "pending", dim: true, starred: false, statusText: "Soon" },
  { slug: "l3-04-bms", detail: "Multi-cell BMS AFE, balancing CC/CV charge, fire-safety protections", title: "L3.04 BMS", track: "POWER", kind: "pending", dim: true, starred: false, statusText: "Soon" },
  { slug: "l3-05-wireless-hub", detail: "ESP-NOW many-to-one fleet scaling and latency, neural-mapping integration", title: "L3.05 wireless hub", track: "COMMS", kind: "pending", dim: true, starred: true, statusText: "Soon" },
];

/** Track accent for the small leading dot, mirroring SkillHoneycomb. */
export const TRACK_COLOR: Record<string, string> = {
  SENSE: "text-status-green",
  ACT: "text-command-gold",
  POWER: "text-alert-red",
  COMMS: "text-signal-blue",
};
