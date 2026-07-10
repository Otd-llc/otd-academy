// src/lib/library/clusters.ts
//
// The public Library is grouped into CLUSTERS. Each cluster is a themed set of
// mini-lessons that also downloads as its own Field Guide PDF. A MiniLesson's
// `cluster` column (String?) points at one of these keys; `clusterOrdinal` is the
// lesson's order WITHIN its cluster. Cross-cluster order comes from `order` here
// (registry rank), NOT the alphabetical `cluster` string — so a DB sort on the
// string is wrong for the flat/combined surfaces (see load.ts byClusterThenOrdinal).
//
// PURE DATA — no React, no client imports — so the landing, load helpers, the
// per-cluster PDF route, and the ItemList JSON-LD can all import it freely.
export interface LibraryCluster {
  /** Stable key stored in MiniLesson.cluster and used in /library/field-guide/[cluster]/pdf. */
  key: string;
  /** Human label: the landing section header and the Field Guide cover label. */
  label: string;
  /** One-line description under the section header. */
  blurb: string;
  /** Cross-cluster sort rank (ascending). Registry order, NOT alphabetical. */
  order: number;
}

export const LIBRARY_CLUSTERS: LibraryCluster[] = [
  {
    key: "fundamentals",
    label: "Fundamentals",
    blurb:
      "The electronics behind every build: voltage, current, Ohm's law, the passives.",
    order: 0,
  },
  {
    key: "eeg-bci",
    label: "EEG & BCI",
    blurb: "How EEG and brain-computer interfaces actually work.",
    order: 1,
  },
  {
    key: "pcb-design",
    label: "PCB Design & Fabrication",
    blurb:
      "Turn a schematic into a real, fab-ready board: layout, routing, planes, and the files a factory needs.",
    order: 2,
  },
  {
    key: "power-batteries",
    label: "Power & Batteries",
    blurb:
      "Powering a board that runs: batteries, regulators, and how to size a supply.",
    order: 4,
  },
];

/**
 * Resolve a cluster key to its registry entry. Returns undefined for a null,
 * empty, or unknown key — callers that sort by `order` MUST treat undefined as a
 * trailing rank (`?? Number.POSITIVE_INFINITY`), never dereference `.order`
 * directly, or a null-cluster row throws / poisons the sort with NaN.
 */
export function clusterByKey(key: string | null | undefined): LibraryCluster | undefined {
  if (!key) return undefined;
  return LIBRARY_CLUSTERS.find((c) => c.key === key);
}
