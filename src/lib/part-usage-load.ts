// DB resolver for the public "where-used" section (keeps `part-usage.ts` pure).
// Returns the BOM-line rows that reference a part on PUBLIC/PREMIUM, published,
// non-archived projects — i.e. only projects a visitor can actually open — taken
// from each project's PUBLISHED revision. `summarizePartUsage` groups + formats.
import { db } from "@/lib/db";
import type { PartUsageRow } from "@/lib/part-usage";

export async function getPartUsageRows(partId: string): Promise<PartUsageRow[]> {
  const projects = await db.project.findMany({
    where: {
      accessTier: { in: ["PUBLIC", "PREMIUM"] },
      archivedAt: null,
      publishedRevision: { is: { bomLines: { some: { partId } } } },
    },
    select: {
      slug: true,
      name: true,
      publicTitle: true,
      publishedRevision: {
        select: {
          label: true,
          bomLines: { where: { partId }, select: { refDes: true } },
        },
      },
    },
  });

  const rows: PartUsageRow[] = [];
  for (const p of projects) {
    const rev = p.publishedRevision;
    if (!rev) continue;
    for (const line of rev.bomLines) {
      rows.push({
        slug: p.slug,
        label: rev.label,
        title: p.publicTitle ?? p.name,
        refDes: line.refDes,
      });
    }
  }
  return rows;
}
