// The patch catalog (design §8). Roadmap patches are shown as LOCKED teasers
// until earned (the visible ladder); skill / easter-egg patches stay HIDDEN until
// earned. Pure data — drives the Logbook patch wall + any label lookup. Full
// mission-patch art is its own later sandbox round; v1 renders a square hex tile.
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
