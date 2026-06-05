// src/lib/categories.ts
// The category tree definition + pure path/subtree helpers (Phase B).
//
// `CATEGORY_TREE` is the SINGLE SOURCE of the seeded taxonomy: the seed
// (scripts/seed-category-tree.ts) walks it to upsert `Category` rows, and the
// list filter resolves a `?cat=<path>` against the materialized `path` it
// produces. The 6 leaves carry slug = the old `PartCategory` enum token (the
// enum→tree bridge); interior nodes get kebab slugs. Slugs are GLOBALLY unique
// (matching `Category.slug @unique`); `path` is the hierarchical identity.
import type { Prisma } from "@prisma/client";

// ─── Tree definition ────────────────────────────────────────────────────────
export type CategoryNode = {
  /** Globally-unique slug. Leaves: the old enum token; interior: kebab. */
  slug: string;
  /** Human label shown in the picker / breadcrumb / list cell. */
  name: string;
  children?: CategoryNode[];
};

// Passives/ICs leaves sit at depth 2; Modules/Connectors at depth 1 (those
// branches have a single subtype so far — intentional, honest asymmetry).
export const CATEGORY_TREE: CategoryNode[] = [
  {
    slug: "passives",
    name: "Passives",
    children: [
      {
        slug: "resistors",
        name: "Resistors",
        children: [{ slug: "PASSIVE_RESISTOR", name: "SMD Resistors" }],
      },
      {
        slug: "capacitors",
        name: "Capacitors",
        children: [{ slug: "MLCC_CAPACITOR", name: "MLCC Capacitors" }],
      },
    ],
  },
  {
    slug: "ics",
    name: "ICs",
    children: [
      {
        slug: "power",
        name: "Power",
        children: [{ slug: "LDO_REGULATOR", name: "LDO Regulators" }],
      },
      {
        slug: "interface",
        name: "Interface",
        children: [{ slug: "USB_UART_IC", name: "USB-UART Bridges" }],
      },
    ],
  },
  {
    slug: "modules",
    name: "Modules",
    children: [{ slug: "RF_MODULE", name: "RF Modules" }],
  },
  {
    slug: "connectors",
    name: "Connectors",
    children: [{ slug: "USB_CONNECTOR", name: "USB Connectors" }],
  },
];

// ─── path helper ────────────────────────────────────────────────────────────
/**
 * The materialized path for a node: `parent ? `${parent}/${slug}` : slug`. The
 * root is its own slug; every descendant prefixes its parent's path. Used by the
 * seed when computing `Category.path` and asserted by the tests.
 */
export function categoryPath(parentPath: string | null, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug;
}

// ─── flatten (pre-order) ────────────────────────────────────────────────────
export type FlatCategory = {
  slug: string;
  name: string;
  path: string;
  parentSlug: string | null;
  depth: number;
  /** 0-based index among this node's siblings (declaration order). */
  order: number;
};

/**
 * Pre-order DFS over `CATEGORY_TREE`, computing `path`/`depth`/`parentSlug`/`order`
 * for every node. Parents precede their children, so the seed can upsert in this
 * order and resolve each node's `parentId` from the already-upserted parent.
 */
export function flattenCategoryTree(
  nodes: CategoryNode[] = CATEGORY_TREE,
): FlatCategory[] {
  const out: FlatCategory[] = [];
  const walk = (
    siblings: CategoryNode[],
    parentPath: string | null,
    parentSlug: string | null,
    depth: number,
  ): void => {
    siblings.forEach((node, order) => {
      const path = categoryPath(parentPath, node.slug);
      out.push({ slug: node.slug, name: node.name, path, parentSlug, depth, order });
      if (node.children && node.children.length > 0) {
        walk(node.children, path, node.slug, depth + 1);
      }
    });
  };
  walk(nodes, null, null, 0);
  return out;
}

// ─── ancestry + display helpers ─────────────────────────────────────────────
/**
 * The ancestor chain for a node, ROOT-first and including the node itself,
 * resolved by walking `parentId` through `byId`. Single source for both the
 * list picker's breadcrumb label and the tree picker's active-node breadcrumb.
 */
export function categoryAncestry<T extends { id: string; parentId: string | null }>(
  node: T,
  byId: Map<string, T>,
): T[] {
  const chain: T[] = [];
  let cur: T | undefined = node;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

/**
 * The human display label for a part's category: the linked category's name
 * wins (the enum→tree bridge), falling back to the legacy enum token, then "—".
 * Single source for the list cell, the mobile card, and the detail header.
 */
export function categoryLabel(part: {
  categoryRef?: { name: string } | null;
  category?: string | null;
}): string {
  return part.categoryRef?.name ?? part.category ?? "—";
}

// ─── subtree filter ─────────────────────────────────────────────────────────
/**
 * A `Part` where-clause matching every part in `node`'s subtree: the node
 * itself (`categoryId`) OR any descendant by materialized-path prefix. The
 * trailing slash on the prefix prevents a sibling whose path is a string-prefix
 * (e.g. `power` vs a hypothetical `power-foo`) from leaking in; direct-node
 * parts are caught by the `categoryId` arm.
 */
export function subtreeWhere(node: {
  id: string;
  path: string;
}): Prisma.PartWhereInput {
  return {
    OR: [
      { categoryId: node.id },
      { categoryRef: { path: { startsWith: `${node.path}/` } } },
    ],
  };
}
