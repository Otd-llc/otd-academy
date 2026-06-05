"use server";

// pg_trgm-ranked search over the KiCad library index (Phase C, Task 6) — backs
// the create-form symbol/footprint pickers.
//
// Ranking is NAME-FIRST with a prefix fallback: pg_trgm trigrams need ≥3 chars,
// but the commonest symbol names are 1–2 chars (R, C, L, D, U), whose similarity
// to the searchable blob is ~0. So we OR-in a literal name-prefix match and rank
// exact → prefix → trigram-similarity → name. The `%` operand expression is
// byte-identical to the GIN index expression in the Task 1 migration so the index
// is used.
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";

const searchSchema = z.object({
  q: z.string().trim().max(128),
  lib: z.string().trim().max(128).optional(),
  // Symbol `ki_fp_filters` (space-separated globs) — narrows the footprint
  // picker to footprints whose name matches the selected symbol's filters.
  fpFilters: z.string().trim().max(512).optional(),
  take: z.coerce.number().int().positive().max(50).default(25),
});

// Convert a KiCad fp-filter glob to a SQL ILIKE pattern: `*`→`%`, `?`→`_`, with
// the LIKE metacharacters (`\ % _`) that are LITERAL in the glob escaped first
// (KiCad footprint names are underscore-heavy, so `_` must stay literal).
function globToLike(glob: string): string {
  return glob
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/\*/g, "%")
    .replace(/\?/g, "_");
}

export type KicadSymbolHit = {
  libId: string;
  lib: string;
  name: string;
  description: string | null;
};
export type KicadFootprintHit = KicadSymbolHit;

// Escape LIKE metacharacters so a name-prefix match is LITERAL — KiCad names are
// underscore-heavy and an unescaped "_" is a single-char wildcard. Postgres
// LIKE/ILIKE uses `\` as the default escape character.
function likeEscape(s: string): string {
  return s.replace(/([\\%_])/g, "\\$1");
}

export async function searchKicadSymbols(input: unknown): Promise<KicadSymbolHit[]> {
  const { q, lib, take } = searchSchema.parse(input);
  if (q.length === 0) return [];
  const prefix = likeEscape(q) + "%";
  const libParam = lib ?? null;
  return db.$queryRaw<KicadSymbolHit[]>`
    SELECT "libId", "lib", "name", "description"
    FROM "KicadLibSymbol"
    WHERE (${libParam}::text IS NULL OR "lib" = ${libParam})
      AND ("name" ILIKE ${prefix}
           OR (coalesce("name",'') || ' ' || coalesce("keywords",'') || ' ' || coalesce("description",'')) % ${q})
    ORDER BY ("name" = ${q}) DESC,
             ("name" ILIKE ${prefix}) DESC,
             similarity(coalesce("name",'') || ' ' || coalesce("keywords",'') || ' ' || coalesce("description",''), ${q}) DESC,
             "name" ASC
    LIMIT ${take};`;
}

export async function searchKicadFootprints(
  input: unknown,
): Promise<KicadFootprintHit[]> {
  const { q, lib, take, fpFilters } = searchSchema.parse(input);
  if (q.length === 0) return [];
  const prefix = likeEscape(q) + "%";
  const libParam = lib ?? null;

  // The selected symbol's fp-filter globs (if any) → an OR of literal ILIKE
  // patterns the footprint name must match.
  const patterns = (fpFilters ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(globToLike);
  const fpClause =
    patterns.length > 0
      ? Prisma.sql`AND "name" ILIKE ANY(ARRAY[${Prisma.join(patterns)}])`
      : Prisma.empty;

  return db.$queryRaw<KicadFootprintHit[]>(Prisma.sql`
    SELECT "libId", "lib", "name", "description"
    FROM "KicadLibFootprint"
    WHERE (${libParam}::text IS NULL OR "lib" = ${libParam})
      AND ("name" ILIKE ${prefix}
           OR (coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("tags",'')) % ${q})
      ${fpClause}
    ORDER BY ("name" = ${q}) DESC,
             ("name" ILIKE ${prefix}) DESC,
             similarity(coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("tags",''), ${q}) DESC,
             "name" ASC
    LIMIT ${take}`);
}

// A selected symbol's metadata for the create-form: `fpFilters` (space-separated
// globs) narrows the footprint picker; `datasheet` powers the "use the symbol's
// datasheet" offer. Both null for an unknown lib-id.
export async function getKicadSymbolMeta(
  libId: string,
): Promise<{ fpFilters: string | null; datasheet: string | null }> {
  if (!libId) return { fpFilters: null, datasheet: null };
  const s = await db.kicadLibSymbol.findUnique({
    where: { libId },
    select: { fpFilters: true, datasheet: true },
  });
  return { fpFilters: s?.fpFilters ?? null, datasheet: s?.datasheet ?? null };
}
