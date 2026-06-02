// Canonical checklist templates (proposal §3 #10).
//
// These are TypeScript-literal JSON shapes (not seeded into the DB at build
// time). The materialize-template action turns one of these into a real
// `Checklist` + `ChecklistItem` rows on demand for a given Revision.
//
// m16: the REQUIREMENTS_REVIEW + LAYOUT_REVIEW templates feed the
// `materializeCanonicalChecklist` server action (Task 16.7) which the
// revision detail page mounts as a one-click affordance. The exit gates
// for REQUIREMENTS and LAYOUT (Tasks 16.8/16.9) then check the resulting
// checklist's items.

import type { ChecklistSubkind, Stage } from "@prisma/client";

export interface CanonicalItem {
  label: string;
  // Hint about when the item is typically N/A — not enforced, just guidance
  // for the UI / future copy in the N/A toggle tooltip.
  notApplicableHint?: string;
}

export interface CanonicalTemplate {
  subkind: ChecklistSubkind;
  stage: Stage;
  title: string;
  items: CanonicalItem[];
}

export const CANONICAL_TEMPLATES: Record<
  | "REQUIREMENTS_REVIEW"
  | "LAYOUT_REVIEW"
  | "STRIPBOARD_VALIDATION"
  | "POST_ASSEMBLY_CONTINUITY",
  CanonicalTemplate
> = {
  REQUIREMENTS_REVIEW: {
    subkind: "REQUIREMENTS_REVIEW",
    stage: "REQUIREMENTS",
    title: "REQUIREMENTS review checklist",
    items: [
      {
        label:
          "WS2812 level-shift strategy chosen (74AHCT125 / SK6812 / 4.5V strip rail).",
        notApplicableHint: "N/A if no addressable LED.",
      },
      {
        label:
          "Servo brownout mitigation strategy chosen (bulk cap + separate supply rail).",
        notApplicableHint: "N/A if no servo.",
      },
      {
        label:
          "ADC1-only constraint recorded (ADC2 unusable while WiFi/ESP-NOW active).",
        notApplicableHint: "N/A if no internal ADC.",
      },
      {
        label:
          "Auto-shutoff prevention strategy chosen (idle current spec + USB-PD wall source vs power bank vs always-on draw).",
      },
    ],
  },
  LAYOUT_REVIEW: {
    subkind: "LAYOUT_REVIEW",
    stage: "LAYOUT",
    title: "LAYOUT review checklist",
    items: [
      {
        label:
          "Antenna keep-out present in layout (no copper/traces under WROOM antenna end).",
      },
      {
        label:
          "Isolation barrier post-regulator added on analog side.",
        notApplicableHint: "N/A if no isolation barrier.",
      },
    ],
  },
  // m5 (learner-guide): POST_ASSEMBLY screening + continuity — materialized
  // on the active Build (NOT the Revision). The ASSEMBLY exit gate
  // (`stages.ts` ~382) matches `activeBuild.checklists` by this subkind, so
  // the stage is ASSEMBLY. Items are drawn from the TB-1-POWER Step-0
  // screening / continuity sweep: power up only after a clean cold check.
  POST_ASSEMBLY_CONTINUITY: {
    subkind: "POST_ASSEMBLY_CONTINUITY",
    stage: "ASSEMBLY",
    title: "POST-ASSEMBLY continuity + screening checklist",
    items: [
      {
        label:
          "Visual + polarity pass: all polarized parts (electrolytics, diodes, connectors, IC pin-1) oriented per assembly drawing.",
      },
      {
        label:
          "No solder bridges: inspect every fine-pitch / QFN pad row under magnification; reflow any suspect joint.",
      },
      {
        label:
          "VBUS↔GND resistance reads above the short threshold (no dead short across the input rail before applying power).",
      },
      {
        label:
          "No power rail measures below 100 Ω to GND (a sub-100 Ω rail indicates a solder bridge or reversed part).",
        notApplicableHint:
          "N/A for rails intentionally terminated below 100 Ω.",
      },
      {
        label:
          "3V3 rail healthy under current-limited bring-up (rail comes up to spec, no current foldback).",
      },
      {
        label:
          "Continuity sweep TP1–TPn: every labelled test point reads continuity to its net per the bring-up procedure.",
      },
    ],
  },
  // m17: STRIPBOARD validation — only materialized when the project's
  // `requiresStripboard` flag is set. The BOM_SOURCING exit gate consumes
  // this subkind when the same flag is true (proposal §3 #4).
  STRIPBOARD_VALIDATION: {
    subkind: "STRIPBOARD_VALIDATION",
    stage: "BOM_SOURCING",
    title: "STRIPBOARD validation checklist",
    items: [
      { label: "Topology validated on stripboard prototype." },
      { label: "Shared rails identified; cut points planned." },
      { label: "Power-rail track doubled (high-current trace lead-in)." },
      {
        label:
          "Firmware bring-up complete on stripboard before PCB layout.",
      },
      {
        label:
          "Bring-up measurements captured (link to Measurement IDs).",
      },
    ],
  },
};
