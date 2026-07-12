// The patch catalog (design §8). Roadmap patches are shown as LOCKED teasers
// until earned (the visible ladder); skill / easter-egg patches stay HIDDEN until
// earned. Pure data — drives the Logbook patch wall + any label lookup. Each key's
// locked mission-patch art is resolved by artForBadge() → PatchBadge.
import { LIBRARY_CLUSTERS } from "@/lib/library/clusters";

export type RoadmapPatch = { key: string; label: string; howToEarn: string };

export const ROADMAP_PATCHES: RoadmapPatch[] = [
  ...LIBRARY_CLUSTERS.map((c) => ({
    key: `cluster:${c.key}`,
    label: c.label,
    howToEarn: `Finish every ${c.label} lesson`,
  })),
  {
    key: "wings:all-library",
    label: "Wings",
    howToEarn: "Finish every lesson in the Library",
  },
];

// Hidden until earned (design §8): the label to show once the badge exists.
export const SKILL_PATCH_LABELS: Record<string, string> = {
  "skill:first-flight": "First Flight",
  "skill:shipped-it": "Shipped It",
};

// The locked badge-art id for a badge key (design finalized 2026-07-12). Drives the
// mission-patch SVG in PatchBadge. Clusters map by their stable cluster key.
export type PatchArt = "flight" | "fund" | "eeg" | "pcb" | "chip" | "comms" | "power" | "wings" | "shipped" | "rating";
const CLUSTER_ART: Record<string, PatchArt> = {
  fundamentals: "fund",
  "eeg-bci": "eeg",
  "pcb-design": "pcb",
  "comms-interfaces": "comms",
  "power-batteries": "power",
  microcontrollers: "chip",
};
export function artForBadge(badgeKey: string): PatchArt {
  if (badgeKey.startsWith("cluster:")) return CLUSTER_ART[badgeKey.slice("cluster:".length)] ?? "fund";
  if (badgeKey.startsWith("wings:")) return "wings";
  if (badgeKey === "skill:first-flight") return "flight";
  if (badgeKey === "skill:shipped-it") return "shipped";
  if (badgeKey.startsWith("course:")) return "rating";
  return "fund";
}

export function patchLabel(badgeKey: string): string {
  const roadmap = ROADMAP_PATCHES.find((p) => p.key === badgeKey);
  if (roadmap) return roadmap.label;
  if (badgeKey in SKILL_PATCH_LABELS) return SKILL_PATCH_LABELS[badgeKey];
  // Course ratings are per-course (design Phase 2) — the slug can't be enumerated
  // statically, so derive a readable label from it: "course:l1-01" → "l1 01 rating".
  if (badgeKey.startsWith("course:")) {
    return `${badgeKey.slice("course:".length).replace(/-/g, " ")} rating`;
  }
  return badgeKey;
}
