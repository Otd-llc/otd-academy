import type { PrismaClient } from "@prisma/client";
import { assessPartAvailability, type AvailabilityStatus } from "@/lib/part-availability";

// "Active BOM" sourcing watch (Josh's weekly substitution dance). For every
// non-archived project's most-recent BOM-FROZEN revision — the board you'd actually
// build/sell — find the lines whose part can't be ordered right now (out of stock /
// backorder / EOL / obsolete, per assessPartAvailability). NRND, stale, and
// not-yet-checked are NOT flagged: they're still buildable. Powers the cron email
// digest AND the /admin/sourcing dashboard from one query.

export interface UnorderableLine {
  refDes: string;
  partId: string;
  mpn: string;
  manufacturer: string;
  status: AvailabilityStatus;
  dkProductUrl: string | null;
}

export interface BoardSourcingIssue {
  projectSlug: string;
  projectName: string;
  revisionLabel: string;
  lines: UnorderableLine[];
}

export async function activeBomUnorderable(
  db: PrismaClient,
  now: Date,
): Promise<BoardSourcingIssue[]> {
  const projects = await db.project.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      revisions: {
        where: { bomFrozenAt: { not: null } },
        orderBy: { bomFrozenAt: "desc" },
        take: 1, // the current active BOM
        select: {
          label: true,
          bomLines: {
            orderBy: { refDes: "asc" },
            select: {
              refDes: true,
              part: {
                select: {
                  id: true,
                  mpn: true,
                  manufacturer: true,
                  dkInStock: true,
                  dkLifecycle: true,
                  dkCheckedAt: true,
                  dkProductUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const issues: BoardSourcingIssue[] = [];
  for (const p of projects) {
    const rev = p.revisions[0];
    if (!rev) continue; // no frozen BOM yet → nothing to source
    const lines: UnorderableLine[] = [];
    for (const l of rev.bomLines) {
      const a = assessPartAvailability(
        {
          dkInStock: l.part.dkInStock,
          dkLifecycle: l.part.dkLifecycle,
          dkCheckedAt: l.part.dkCheckedAt,
        },
        now,
      );
      if (!a.buildable) {
        lines.push({
          refDes: l.refDes,
          partId: l.part.id,
          mpn: l.part.mpn,
          manufacturer: l.part.manufacturer,
          status: a.status,
          dkProductUrl: l.part.dkProductUrl,
        });
      }
    }
    if (lines.length > 0) {
      issues.push({
        projectSlug: p.slug,
        projectName: p.name,
        revisionLabel: rev.label,
        lines,
      });
    }
  }
  return issues;
}

// Did any of `partIds` newly cross into "can't order" during a run that started at
// `since`? Reads the watchdog's append-only transition log so the digest fires ONLY
// on a fresh break (no daily nagging); the digest body still carries the full standing
// list so nothing is forgotten.
export async function newlyUnorderableCount(
  db: PrismaClient,
  since: Date,
  partIds: string[],
): Promise<number> {
  if (partIds.length === 0) return 0;
  return db.partAvailabilityEvent.count({
    where: {
      createdAt: { gte: since },
      kind: { in: ["WENT_OOS", "WENT_OBSOLETE", "NO_MATCH"] },
      partId: { in: partIds },
    },
  });
}

// DigiKey jump-off for picking a replacement: the product page (which carries the
// "Substitutes" tab) when known, else a keyword search on the MPN.
export function digikeySubstitutesUrl(line: UnorderableLine): string {
  if (line.dkProductUrl) return line.dkProductUrl;
  return `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(line.mpn)}`;
}
