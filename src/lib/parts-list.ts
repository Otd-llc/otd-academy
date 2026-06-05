// src/lib/parts-list.ts
// Parts-library list query: filter (q / lifecycle / mains) + sort + pagination,
// returning the page slice plus totals for the pager. Injected client for testability
// (mirrors parts-knowledge/query.ts). NOTE: `q` uses Prisma `contains` (ILIKE '%q%') —
// a sequential scan; fine to thousands. The pre-planned scale-up is a pg_trgm GIN index
// (see the Phase-A design), a migration-only change behind this same signature.
import type { Prisma } from "@prisma/client";
import type { db as Db } from "@/lib/db";
import type { PartsListParams } from "@/lib/schemas/part";
import { subtreeWhere } from "@/lib/categories";

export const PARTS_PAGE_SIZE = 50;

const LIST_SELECT = {
  id: true,
  mpn: true,
  manufacturer: true,
  description: true,
  category: true,
  // Linked category (Phase B). `name` is the human label shown in the list;
  // `slug`/`path` back the picker's active-node + breadcrumb. Bridge display:
  // `categoryRef?.name ?? category ?? "—"`.
  categoryRef: { select: { slug: true, name: true, path: true } },
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
  // Resolve the `cat` path to its node, then AND-in its subtree filter. An
  // unknown path resolves to null → no category constraint (degrade gracefully,
  // mirroring the params schema's `.catch`). Both the `q` filter and the subtree
  // filter use `OR`, so they MUST be combined under `AND` (a flat spread would
  // have the second `OR` clobber the first).
  const catNode = params.cat
    ? await client.category.findUnique({
        where: { path: params.cat },
        select: { id: true, path: true },
      })
    : null;

  const where: Prisma.PartWhereInput = {
    ...(params.lifecycle ? { lifecycle: params.lifecycle } : {}),
    ...(params.mains ? { isCertifiedModule: true } : {}),
    AND: [
      ...(params.q
        ? [
            {
              OR: [
                { mpn: { contains: params.q, mode: "insensitive" as const } },
                { manufacturer: { contains: params.q, mode: "insensitive" as const } },
                { description: { contains: params.q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      ...(catNode ? [subtreeWhere(catNode)] : []),
    ],
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
