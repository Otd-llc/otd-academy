// src/components/parts/CategoryTreePicker.tsx
// Category navigation for the parts list (Phase B). A SERVER component: it reads
// the seeded Category tree + a per-category part-count rollup and renders the
// tree as nested links, each setting `?cat=<path>` (via partsHref, which resets
// the page param). The active node is highlighted and a breadcrumb of its
// ancestors sits above the list.
//
// Layout mirrors the page's desktop/mobile split: the tree renders inline at
// md+ and collapses into a <details> disclosure below md (no client JS).
//
// Counts are SUBTREE totals (a parent sums itself + all descendants), computed
// in memory — the tree is tiny. They reflect the whole catalog, NOT the active
// q/lifecycle/mains filters (a stable "how big is this category" navigational
// aid).
import Link from "next/link";
import { db } from "@/lib/db";
import { partsHref } from "@/lib/parts-list-url";

type Current = Record<string, string | undefined>;

type Node = {
  id: string;
  slug: string;
  name: string;
  path: string;
  parentId: string | null;
};

export async function CategoryTreePicker({
  activePath,
  current,
}: {
  activePath?: string;
  current: Current;
}) {
  const categories = await db.category.findMany({
    orderBy: [{ depth: "asc" }, { order: "asc" }],
    select: { id: true, slug: true, name: true, path: true, parentId: true },
  });
  if (categories.length === 0) return null;

  // Per-category direct count → subtree count (sum of self + descendants by path
  // prefix). n is small; O(n²) rollup is fine.
  const grouped = await db.part.groupBy({
    by: ["categoryId"],
    where: { categoryId: { not: null } },
    _count: { _all: true },
  });
  const directCount = new Map<string, number>();
  for (const g of grouped) {
    if (g.categoryId) directCount.set(g.categoryId, g._count._all);
  }
  const subtreeCount = (node: Node): number => {
    let total = directCount.get(node.id) ?? 0;
    for (const other of categories) {
      if (other.id !== node.id && other.path.startsWith(`${node.path}/`)) {
        total += directCount.get(other.id) ?? 0;
      }
    }
    return total;
  };

  // children index + roots, in the query's (depth, order) order.
  const childrenOf = new Map<string | null, Node[]>();
  for (const c of categories) {
    const arr = childrenOf.get(c.parentId) ?? [];
    arr.push(c);
    childrenOf.set(c.parentId, arr);
  }
  const roots = childrenOf.get(null) ?? [];
  const byPath = new Map(categories.map((c) => [c.path, c]));

  // ─── breadcrumb of the active node's ancestors ──────────────────────────
  const crumbs: Node[] = [];
  if (activePath) {
    let acc = "";
    for (const seg of activePath.split("/")) {
      acc = acc ? `${acc}/${seg}` : seg;
      const n = byPath.get(acc);
      if (n) crumbs.push(n);
    }
  }

  const rowCls = (active: boolean) =>
    `flex items-center gap-2 rounded px-2 py-1 font-mono text-xs transition-colors ${
      active
        ? "bg-command-gold text-navy-dark"
        : "text-link-muted hover:bg-navy-dark hover:text-command-gold"
    }`;

  function renderNodes(nodes: Node[]) {
    return (
      <ul className="space-y-0.5">
        {nodes.map((node) => {
          const kids = childrenOf.get(node.id) ?? [];
          const active = node.path === activePath;
          return (
            <li key={node.id}>
              <Link
                href={partsHref(current, { cat: node.path })}
                aria-current={active ? "true" : undefined}
                className={rowCls(active)}
              >
                <span className="truncate">{node.name}</span>
                <span className="ml-auto tabular-nums text-muted">
                  {subtreeCount(node)}
                </span>
              </Link>
              {kids.length > 0 ? (
                <div className="ml-3 border-l border-panel-border pl-2">
                  {renderNodes(kids)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const tree = (
    <div className="space-y-0.5">
      <Link
        href={partsHref(current, { cat: undefined })}
        aria-current={!activePath ? "true" : undefined}
        className={rowCls(!activePath)}
      >
        <span className="truncate">All categories</span>
      </Link>
      {renderNodes(roots)}
    </div>
  );

  return (
    <div className="mt-6">
      {/* Breadcrumb of the active node (links each ancestor; "All" clears cat). */}
      {crumbs.length > 0 ? (
        <nav
          aria-label="Category breadcrumb"
          className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted"
        >
          <Link
            href={partsHref(current, { cat: undefined })}
            className="text-signal-blue hover:underline"
          >
            All
          </Link>
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="text-panel-border">›</span>
              <Link
                href={partsHref(current, { cat: c.path })}
                className={
                  c.path === activePath
                    ? "text-command-gold"
                    : "text-signal-blue hover:underline"
                }
              >
                {c.name}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}

      {/* Desktop: tree always visible. */}
      <div className="hidden md:block">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
          Browse by category
        </h2>
        {tree}
      </div>

      {/* Mobile: collapse into a disclosure. */}
      <details className="md:hidden rounded border border-panel-border bg-navy-dark/30 p-3">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-command-gold">
          Browse by category
        </summary>
        <div className="mt-3">{tree}</div>
      </details>
    </div>
  );
}
