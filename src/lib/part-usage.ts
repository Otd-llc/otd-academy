// Pure "where-used" roll-up for the public parts catalog: maps the BOM lines that
// reference a part (on PUBLIC/PREMIUM published projects — the resolver filters
// visibility) into one entry per project, with a deduped/sorted refDes list and
// the project's public guide-hub href. Kept pure (no Prisma) so it's unit-
// testable; the `/parts/[id]` RSC resolves the rows and hands them in.

export interface PartUsageRow {
  slug: string;
  label: string;
  title: string;
  refDes: string;
}

export interface PartUsageEntry {
  title: string;
  href: string;
  refDes: string;
}

export function summarizePartUsage(rows: PartUsageRow[]): PartUsageEntry[] {
  const byProject = new Map<
    string,
    { title: string; slug: string; label: string; refDes: Set<string> }
  >();
  for (const r of rows) {
    const key = `${r.slug}@@${r.label}`;
    let entry = byProject.get(key);
    if (!entry) {
      entry = { title: r.title, slug: r.slug, label: r.label, refDes: new Set() };
      byProject.set(key, entry);
    }
    for (const ref of r.refDes.split(",").map((s) => s.trim()).filter(Boolean)) {
      entry.refDes.add(ref);
    }
  }
  return [...byProject.values()]
    .map((e) => ({
      title: e.title,
      href: `/projects/${e.slug}/${encodeURIComponent(e.label)}/guide`,
      refDes: [...e.refDes].sort().join(", "),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
