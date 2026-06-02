// Per-track content overlays merged onto the stage skeletons by `composeGuide`.
// Each track contributes track-specific teaching prose at the SCHEMATIC stage.
//
// A null track (no CurriculumTrack on the project) resolves to the NEUTRAL
// fallback — no overlay blocks. Note: the bench tools (curriculum level === null)
// still carry a track (POWER/ACT/SENSE), so they DO get a track overlay; only a
// genuinely track-less project falls back to neutral.
import type { ContentBlock } from "@/lib/schemas/guide";
import type { GuideStage } from "./stage-skeletons";

type Track = "SENSE" | "ACT" | "POWER" | "COMMS";

const NEUTRAL: Partial<Record<GuideStage, ContentBlock[]>> = {};

export const TRACK_OVERLAYS: Record<Track, Partial<Record<GuideStage, ContentBlock[]>>> = {
  SENSE: {
    SCHEMATIC: [
      {
        type: "prose",
        md: "Sense boards live or die on the analog front-end: low-noise reference, star ground, guard the high-impedance nodes.",
      },
    ],
  },
  ACT: {
    SCHEMATIC: [
      {
        type: "prose",
        md: "Actuator boards move current — size the driver, the gate drive, and the return path for the worst case, not the nominal.",
      },
    ],
  },
  POWER: {
    SCHEMATIC: [
      {
        type: "prose",
        md: "Power boards: define every rail's source, sequencing, and protection before layout. DC-only — no student-laid-out mains copper.",
      },
    ],
  },
  COMMS: {
    SCHEMATIC: [
      {
        type: "prose",
        md: "Comms boards: ESP-NOW channel/peer plan, and the WROOM antenna keep-out is a first-class layout constraint.",
      },
    ],
  },
};

// Null track → neutral (no overlay). Bench tools (level null) still have a track.
export function trackOverlayFor(track: Track | null, stage: GuideStage): ContentBlock[] {
  if (!track) return NEUTRAL[stage] ?? [];
  return TRACK_OVERLAYS[track][stage] ?? [];
}
