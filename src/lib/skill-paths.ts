// Learning paths — the public organising model for /courses.
//
// A "path" is a build GOAL plus its prerequisite chain, auto-derived from the
// curriculum DAG (no hand-curated course lists to drift). "Least courses to
// build & understand the 8-channel EEG" = the transitive prerequisites of
// l3-01, topologically ordered — the motor driver isn't in it because the EEG
// doesn't depend on it. Each path is a single clean linear list (mobile-first);
// switching paths is the organising choice, not a 2D graph.
//
// Pure: operates on an already-built `SkillTree` (slugs + states + edges).

import { topoOrder } from "@/lib/skill-tree-core";
import type { SkillNode, SkillTree } from "@/lib/skill-tree-core";

export type PathKind = "primary" | "mastery" | "bench";

export interface PathDef {
  key: string;
  kind: PathKind;
  label: string;
  blurb: string;
  goalSlug?: string; // present for primary/mastery; absent for the bench category
}

// The lineup: 1 primary + 3 mastery + bench. Each goal path resolves to its
// prerequisite closure; bench is a flat category of the instrument builds.
export const SKILL_PATHS: PathDef[] = [
  {
    key: "eeg",
    kind: "primary",
    label: "The 8-Channel EEG",
    blurb:
      "The flagship — the analog board that reads real brainwaves. The brain-computer interface, and the shortest path to it.",
    goalSlug: "l3-01-eeg-front-end",
  },
  {
    key: "swarm",
    kind: "mastery",
    label: "Command the Swarm",
    blurb:
      "The wireless fleet hub — many devices, one command link. The other half of the brain-to-swarm build.",
    goalSlug: "l3-05-wireless-hub",
  },
  {
    key: "motion",
    kind: "mastery",
    label: "Motion & Actuation",
    blurb:
      "Make things move — up to a brushless motor driven with back-EMF commutation.",
    goalSlug: "l3-02-brushless-motor",
  },
  {
    key: "power",
    kind: "mastery",
    label: "Power Systems",
    blurb:
      "Portable power done right — up to a multi-cell battery management system.",
    goalSlug: "l3-04-bms",
  },
  {
    key: "bench",
    kind: "bench",
    label: "Bench Tools",
    blurb:
      "Your bench — standalone instruments to measure, drive, and test your work.",
  },
];

export const DEFAULT_PATH_KEY = "eeg";

export function pathByKey(key: string | undefined): PathDef {
  return SKILL_PATHS.find((p) => p.key === key) ?? SKILL_PATHS[0];
}

// Transitive prerequisite closure of a goal (backward over the DAG): the goal
// plus every node it depends on, directly or indirectly. Edges are
// fromSlug=prerequisite → toSlug=dependent.
export function prereqClosure(
  goalSlug: string,
  edges: SkillTree["edges"],
): Set<string> {
  const closure = new Set<string>([goalSlug]);
  const stack = [goalSlug];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const e of edges) {
      if (e.toSlug === cur && !closure.has(e.fromSlug)) {
        closure.add(e.fromSlug);
        stack.push(e.fromSlug);
      }
    }
  }
  return closure;
}

export interface ResolvedPath {
  def: PathDef;
  nodes: SkillNode[]; // topologically ordered
  goalSlug?: string;
  done: number;
  total: number;
}

// Resolve a path key to its ordered nodes + progress, against a built tree.
export function resolvePath(key: string | undefined, tree: SkillTree): ResolvedPath {
  const def = pathByKey(key);

  let nodes: SkillNode[];
  if (def.kind === "bench") {
    // The bench category: the standalone instrument builds (bn-*), ordered.
    nodes = topoOrder(
      tree.nodes.filter((n) => n.slug.startsWith("bn-")),
      tree.edges,
    );
  } else {
    const closure = prereqClosure(def.goalSlug!, tree.edges);
    nodes = topoOrder(
      tree.nodes.filter((n) => closure.has(n.slug)),
      tree.edges,
    );
  }

  const done = nodes.filter((n) => n.state === "done").length;
  return { def, nodes, goalSlug: def.goalSlug, done, total: nodes.length };
}
