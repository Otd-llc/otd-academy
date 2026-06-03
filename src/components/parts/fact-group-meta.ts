// Shared per-group metadata for the part detail UI (Task 7a): human labels, the
// ordered group list, the union of per-group `data` shapes, and the empty
// `data` seed used when curating a brand-new fact group.

import type { PartFactGroup } from "@prisma/client";
import type {
  Parametrics,
  Pinout,
  Power,
  Derating,
  Mechanical,
  Notes,
} from "@/lib/schemas/part-fact";

// The union of every group's validated `data` shape. A FactGroupCard holds one
// of these in its edit draft, narrowed by `group`.
export type FactData =
  | Parametrics
  | Pinout
  | Power
  | Derating
  | Mechanical
  | Notes;

// Display order on the detail page (matches the PartFactGroup enum / design §3).
export const GROUP_ORDER: PartFactGroup[] = [
  "PARAMETRICS",
  "PINOUT",
  "POWER",
  "DERATING",
  "MECHANICAL",
  "NOTES",
];

export const GROUP_LABELS: Record<PartFactGroup, string> = {
  PARAMETRICS: "PARAMETRICS",
  PINOUT: "PINOUT",
  POWER: "POWER",
  DERATING: "DERATING",
  MECHANICAL: "MECHANICAL",
  NOTES: "NOTES",
};

// Empty `data` seed per group — the starting draft when adding a not-yet-curated
// group. Each mirrors the minimum its schema admits (arrays start empty; the
// schema's `.min(1)` constraints — e.g. PINOUT pins, DERATING curves — are
// satisfied as the curator adds rows / on the server re-validate at Save).
export function defaultFactData(group: PartFactGroup): FactData {
  switch (group) {
    case "PARAMETRICS":
      return { entries: [] };
    case "PINOUT":
      return { pins: [] };
    case "POWER":
      return { rails: [], bypass: [], notes: undefined };
    case "DERATING":
      return { curves: [] };
    case "MECHANICAL":
      return { entries: [] };
    case "NOTES":
      return { blocks: [] };
    default: {
      const _exhaustive: never = group;
      throw new Error(`unhandled PartFactGroup: ${String(_exhaustive)}`);
    }
  }
}
