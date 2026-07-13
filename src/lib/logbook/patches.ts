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
export type LogbookArt = "flight" | "fund" | "eeg" | "pcb" | "chip" | "comms" | "power" | "wings" | "shipped" | "rating";
// Hardware/build family (design 2026-07-13): 3 metal TIERS each (bronze/silver/gold),
// the scene develops + silver glow + gold star-crown. Earn events land with the build
// courses; the art + catalog are provisioned now so wiring later is a one-liner.
export type HardwareArt = "hw-solder" | "hw-powered" | "hw-tapeout" | "hw-shipped" | "hw-build";
export type PatchArt = LogbookArt | HardwareArt;

const CLUSTER_ART: Record<string, LogbookArt> = {
  fundamentals: "fund",
  "eeg-bci": "eeg",
  "pcb-design": "pcb",
  "comms-interfaces": "comms",
  "power-batteries": "power",
  microcontrollers: "chip",
};

// Hardware catalog. Badge keys are tiered: `hw:<name>:<1|2|3>` (bronze/silver/gold),
// awarded as the count threshold is crossed. `earnKey` is the event that triggers it.
export type HardwarePatch = { name: string; key: string; art: HardwareArt; label: string; howToEarn: string; thresholds: [number, number, number]; unit: string };
export const HARDWARE_PATCHES: HardwarePatch[] = [
  { name: "solder", key: "hw:solder", art: "hw-solder", label: "First Solder", howToEarn: "Solder up a build board.", thresholds: [1, 3, 6], unit: "boards" },
  { name: "powered", key: "hw:powered", art: "hw-powered", label: "Powered On", howToEarn: "Pass a board bring-up.", thresholds: [1, 3, 6], unit: "bring-ups" },
  { name: "tapeout", key: "hw:tapeout", art: "hw-tapeout", label: "Tapeout", howToEarn: "Export a fab-ready board.", thresholds: [1, 3, 6], unit: "exports" },
  { name: "shipped", key: "hw:shipped", art: "hw-shipped", label: "Shipped Hardware", howToEarn: "Order a real board.", thresholds: [1, 3, 6], unit: "orders" },
  { name: "build", key: "hw:build", art: "hw-build", label: "Full Build", howToEarn: "Complete a build course.", thresholds: [1, 3, 6], unit: "courses" },
];
const HW_ART: Record<string, HardwareArt> = Object.fromEntries(HARDWARE_PATCHES.map((h) => [h.name, h.art]));

/** Tier index 0..2 (bronze/silver/gold) for a hardware badge key `hw:<name>:<n>`. */
export function tierForBadge(badgeKey: string): number {
  const m = badgeKey.match(/^hw:[a-z]+:(\d)$/);
  return m ? Math.max(0, Math.min(2, Number(m[1]) - 1)) : 0;
}

export function artForBadge(badgeKey: string): PatchArt {
  if (badgeKey.startsWith("cluster:")) return CLUSTER_ART[badgeKey.slice("cluster:".length)] ?? "fund";
  if (badgeKey.startsWith("wings:")) return "wings";
  if (badgeKey === "skill:first-flight") return "flight";
  if (badgeKey === "skill:shipped-it") return "shipped";
  if (badgeKey.startsWith("course:")) return "rating";
  if (badgeKey.startsWith("hw:")) return HW_ART[badgeKey.split(":")[1]] ?? "hw-tapeout";
  return "fund";
}

export function patchLabel(badgeKey: string): string {
  const roadmap = ROADMAP_PATCHES.find((p) => p.key === badgeKey);
  if (roadmap) return roadmap.label;
  if (badgeKey in SKILL_PATCH_LABELS) return SKILL_PATCH_LABELS[badgeKey];
  if (badgeKey.startsWith("hw:")) {
    const hw = HARDWARE_PATCHES.find((h) => badgeKey.startsWith(h.key));
    if (hw) return hw.label;
  }
  // Course ratings are per-course (design Phase 2) — the slug can't be enumerated
  // statically, so derive a readable label from it: "course:l1-01" → "l1 01 rating".
  if (badgeKey.startsWith("course:")) {
    return `${badgeKey.slice("course:".length).replace(/-/g, " ")} rating`;
  }
  return badgeKey;
}
