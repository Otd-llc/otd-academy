// The reusable §6 gotcha callout catalog for the learner-guide teaching layer.
//
// SINGLE SOURCE OF TRUTH for which boards each gotcha attaches to. The seed
// script (`scripts/populate-curriculum-dag.ts`) currently encodes the same
// board sets when it appends §6 items to each board's REQUIREMENTS_REVIEW
// checklist; a later cleanup will have the seed import these predicates so the
// two never drift. The callout *text* here teaches (longer, prose); the seed's
// checklist *items* are terse gate rows — they may differ in wording, but the
// SET OF BOARDS each gotcha targets MUST match the seed.
//
// Reconciliation vs. the seed (verified against scripts/populate-curriculum-dag.ts):
//   - antenna-keepout: seed appends to EVERY board (`appliesTo: () => true`),
//     because every curriculum board carries a WROOM. ✓ matches.
//   - isolation-postreg: seed `ISOLATION_BOARDS` = exactly
//     {l2-05-isolated-spi-bridge, l3-01-eeg-front-end}. ✓ matches.
//   - ws2812 / servo / adc1 / auto-shutoff: the seed bakes the *checklist items*
//     for these into the canonical REQUIREMENTS_REVIEW template applied to all
//     boards (not as targeted per-board appends). As *teaching callouts*, though,
//     they only make sense on the boards that actually teach that discipline, so
//     these predicates target the real curriculum slugs:
//       ws2812  → l1-03-ws2812-node + l3-03-lighting-array
//                 (lighting-array DE_RISKs off the ws2812 node — both teach the
//                  5V level-shift), via /ws2812|lighting/.
//       servo   → l1-04-single-servo + l3-02-brushless-motor,
//                 via /servo|brushless/.
//       adc1    → l1-05-internal-adc, via /internal-adc/.
//       auto-shutoff → the 6 bench tools bn-*, via /^bn-/.
import type { ContentBlock } from "@/lib/schemas/guide";

export interface GuideProjectFacts {
  slug: string;
  track: "SENSE" | "ACT" | "POWER" | "COMMS" | null;
  requiresStripboard: boolean;
}

type Stage =
  | "REQUIREMENTS"
  | "SCHEMATIC"
  | "BOM_SOURCING"
  | "LAYOUT"
  | "DRC_GERBER"
  | "ORDERING"
  | "ASSEMBLY"
  | "BRINGUP";

interface Gotcha {
  id: string;
  block: ContentBlock;
  appliesAt: Stage[];
  appliesTo: (p: GuideProjectFacts) => boolean;
}

// Boards whose analog front-end sits behind an isolation barrier. Kept in
// lockstep with the seed's ISOLATION_BOARDS set.
const ISOLATION_SLUGS = new Set([
  "l2-05-isolated-spi-bridge",
  "l3-01-eeg-front-end",
]);

const GOTCHAS: Gotcha[] = [
  {
    id: "antenna-keepout",
    appliesAt: ["LAYOUT"],
    appliesTo: () => true, // every curriculum board carries a WROOM
    block: {
      type: "callout",
      severity: "warn",
      label: "WROOM antenna keep-out",
      body: "Confirm the keep-out against the module datasheet — no copper / no ground pour under the antenna. Violating it detunes the radio and kills range.",
    },
  },
  {
    id: "isolation-postreg",
    appliesAt: ["LAYOUT", "SCHEMATIC"],
    appliesTo: (p) => ISOLATION_SLUGS.has(p.slug),
    block: {
      type: "callout",
      severity: "warn",
      label: "Isolated rail post-regulator",
      body: "Isolated DC-DC converters are noisy — post-regulate + filter the isolated secondary before it feeds the analog front-end.",
    },
  },
  {
    id: "ws2812-levelshift",
    appliesAt: ["SCHEMATIC", "REQUIREMENTS"],
    appliesTo: (p) => /ws2812|lighting/.test(p.slug),
    block: {
      type: "callout",
      severity: "warn",
      label: "WS2812 level-shift",
      body: "3.3V logic is out of spec for 5V WS2812 — level-shift via 74AHCT125, run the strip ~4.5V, or substitute SK6812.",
    },
  },
  {
    id: "servo-brownout",
    appliesAt: ["SCHEMATIC", "LAYOUT"],
    appliesTo: (p) => /servo|brushless/.test(p.slug),
    block: {
      type: "callout",
      severity: "warn",
      label: "Servo/motor brownout",
      body: "Separate supply rail, bulk cap sized for stall current, wide/short high-current traces (double-track on stripboard).",
    },
  },
  {
    id: "adc1-only",
    appliesAt: ["SCHEMATIC", "REQUIREMENTS"],
    appliesTo: (p) => /internal-adc/.test(p.slug),
    block: {
      type: "callout",
      severity: "warn",
      label: "ADC1-only",
      body: "ADC2 pins are unusable while WiFi/ESP-NOW is active — route all sampled inputs to ADC1.",
    },
  },
  {
    id: "auto-shutoff",
    appliesAt: ["REQUIREMENTS"],
    appliesTo: (p) => /^bn-/.test(p.slug),
    block: {
      type: "callout",
      severity: "info",
      label: "Power-bank auto-shutoff",
      body: "USB power banks auto-shutoff under low/steady draw — source from a USB-C wall PD supply or add a periodic-pulse load.",
    },
  },
];

export function gotchaBlocksFor(p: GuideProjectFacts, stage: Stage): ContentBlock[] {
  return GOTCHAS.filter((g) => g.appliesAt.includes(stage) && g.appliesTo(p)).map((g) => g.block);
}
