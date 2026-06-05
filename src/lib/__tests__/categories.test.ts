// Pure tests for the category tree definition + path/subtree helpers
// (`src/lib/categories.ts`, Phase B). No DB — these exercise the pure functions
// and the single-source `CATEGORY_TREE` that the seed (scripts/seed-category-tree.ts)
// and the list filter both consume.
import { describe, it, expect } from "vitest";

import {
  categoryPath,
  subtreeWhere,
  flattenCategoryTree,
  categoryAncestry,
  categoryLabel,
  CATEGORY_TREE,
  type CategoryNode,
} from "@/lib/categories";

// The 6 leaves that carry the old PartCategory enum token as their slug — the
// enum→tree bridge. CATEGORY_TREE's leaves MUST be exactly this set so the
// string-keyed CATEGORY_REQUIRED map and every existing seed/test literal keep
// resolving once a part links to a category.
const ENUM_LEAF_SLUGS = [
  "RF_MODULE",
  "LDO_REGULATOR",
  "USB_UART_IC",
  "MLCC_CAPACITOR",
  "USB_CONNECTOR",
  "PASSIVE_RESISTOR",
] as const;

function collectLeafSlugs(nodes: CategoryNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (!n.children || n.children.length === 0) out.push(n.slug);
    else out.push(...collectLeafSlugs(n.children));
  }
  return out;
}

describe("categoryPath", () => {
  it("returns the bare slug for a root (null parent path)", () => {
    expect(categoryPath(null, "passives")).toBe("passives");
  });

  it("joins parent path and slug with a slash for a nested node", () => {
    expect(categoryPath("passives/capacitors", "MLCC_CAPACITOR")).toBe(
      "passives/capacitors/MLCC_CAPACITOR",
    );
  });
});

describe("CATEGORY_TREE", () => {
  it("has exactly the 6 enum-token leaf slugs", () => {
    const leaves = collectLeafSlugs(CATEGORY_TREE);
    expect(leaves.slice().sort()).toEqual([...ENUM_LEAF_SLUGS].sort());
  });

  it("every leaf slug is unique", () => {
    const leaves = collectLeafSlugs(CATEGORY_TREE);
    expect(new Set(leaves).size).toBe(leaves.length);
  });

  it("every slug (interior + leaf) is globally unique", () => {
    const all = flattenCategoryTree().map((n) => n.slug);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("flattenCategoryTree", () => {
  it("emits parents before children (pre-order) with computed path/depth/parent", () => {
    const flat = flattenCategoryTree();
    const bySlug = new Map(flat.map((n) => [n.slug, n]));

    const mlcc = bySlug.get("MLCC_CAPACITOR");
    expect(mlcc).toBeDefined();
    expect(mlcc!.path).toBe("passives/capacitors/MLCC_CAPACITOR");
    expect(mlcc!.depth).toBe(2);
    expect(mlcc!.parentSlug).toBe("capacitors");

    const idxParent = flat.findIndex((n) => n.slug === "capacitors");
    const idxChild = flat.findIndex((n) => n.slug === "MLCC_CAPACITOR");
    expect(idxParent).toBeGreaterThanOrEqual(0);
    expect(idxParent).toBeLessThan(idxChild);
  });

  it("roots have null parentSlug, depth 0, and path == slug", () => {
    const flat = flattenCategoryTree();
    const passives = flat.find((n) => n.slug === "passives");
    expect(passives).toBeDefined();
    expect(passives!.parentSlug).toBeNull();
    expect(passives!.depth).toBe(0);
    expect(passives!.path).toBe("passives");
  });

  it("assigns a sibling order index under each parent", () => {
    const flat = flattenCategoryTree();
    // Top-level roots get order 0..n in declaration order.
    const roots = flat.filter((n) => n.parentSlug === null);
    expect(roots.map((r) => r.order)).toEqual(roots.map((_, i) => i));
  });
});

describe("subtreeWhere", () => {
  it("matches the node directly OR any descendant by path prefix", () => {
    const where = subtreeWhere({ id: "cat-1", path: "passives" });
    expect(where).toEqual({
      OR: [
        { categoryId: "cat-1" },
        { categoryRef: { path: { startsWith: "passives/" } } },
      ],
    });
  });
});

describe("categoryAncestry", () => {
  const byId = new Map([
    ["a", { id: "a", parentId: null, name: "Passives" }],
    ["b", { id: "b", parentId: "a", name: "Capacitors" }],
    ["c", { id: "c", parentId: "b", name: "MLCC" }],
  ]);

  it("returns the root-first chain including the node", () => {
    expect(categoryAncestry(byId.get("c")!, byId).map((n) => n.name)).toEqual([
      "Passives",
      "Capacitors",
      "MLCC",
    ]);
  });

  it("a root resolves to just itself", () => {
    expect(categoryAncestry(byId.get("a")!, byId).map((n) => n.id)).toEqual(["a"]);
  });

  it("stops gracefully when a parent is missing from the map", () => {
    const orphan = new Map([["b", { id: "b", parentId: "missing", name: "Child" }]]);
    expect(categoryAncestry(orphan.get("b")!, orphan).map((n) => n.id)).toEqual(["b"]);
  });
});

describe("categoryLabel", () => {
  it("prefers the linked category name (the bridge)", () => {
    expect(
      categoryLabel({ categoryRef: { name: "MLCC Capacitors" }, category: "MLCC_CAPACITOR" }),
    ).toBe("MLCC Capacitors");
  });

  it("falls back to the legacy enum, then to a dash", () => {
    expect(categoryLabel({ categoryRef: null, category: "MLCC_CAPACITOR" })).toBe("MLCC_CAPACITOR");
    expect(categoryLabel({ categoryRef: null, category: null })).toBe("—");
    expect(categoryLabel({})).toBe("—");
  });
});
