// src/lib/parts-list.ts
// Parts-library list query: filter (q / lifecycle / mains) + sort + pagination,
// returning the page slice plus totals for the pager. Injected client for testability
// (mirrors parts-knowledge/query.ts). NOTE: `q` uses Prisma `contains` (ILIKE '%q%') —
// a sequential scan; fine to thousands. The pre-planned scale-up is a pg_trgm GIN index
// (see the Phase-A design), a migration-only change behind this same signature.
import type { Prisma } from "@prisma/client";
import type { db as Db } from "@/lib/db";
import type { PartsListParams } from "@/lib/schemas/part";

export const PARTS_PAGE_SIZE = 50;

const LIST_SELECT = {
  id: true,
  mpn: true,
  manufacturer: true,
  description: true,
  category: true,
  lifecycle: true,
  isCertifiedModule: true,
} satisfies Prisma.PartSelect;

export type PartsListRow = Prisma.PartGetPayload<{ select: typeof LIST_SELECT }>;

export type PartsListResult = {
  parts: PartsListRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
};

export async function listParts(
  client: typeof Db,
  params: PartsListParams,
  pageSize: number = PARTS_PAGE_SIZE,
): Promise<PartsListResult> {
  const where: Prisma.PartWhereInput = {
    ...(params.q
      ? {
          OR: [
            { mpn: { contains: params.q, mode: "insensitive" } },
            { manufacturer: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.lifecycle ? { lifecycle: params.lifecycle } : {}),
    ...(params.mains ? { isCertifiedModule: true } : {}),
  };

  const orderBy: Prisma.PartOrderByWithRelationInput[] =
    params.sort === "mpn"
      ? [{ mpn: "asc" }]
      : params.sort === "recent"
        ? [{ updatedAt: "desc" }]
        : [{ manufacturer: "asc" }, { mpn: "asc" }];

  const total = await client.part.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(params.page, 1), totalPages);

  const parts = await client.part.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: LIST_SELECT,
  });

  return { parts, total, page, totalPages, pageSize };
}
