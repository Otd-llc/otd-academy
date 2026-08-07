/**
 * READ-ONLY census of saved hex clusters.
 *
 * Exists because a scope decision (whether to build a shorter share-URL
 * encoding at all) was resting on two rows in the LOCAL dev database — and
 * local has never held a production hex row: the last `db:pull-prod` was
 * 2026-07-15, and the hex tables were created by the 2026-08-02 migration.
 * So the local sample against prod is zero, not two.
 *
 * Opens a READ ONLY transaction and only ever SELECTs. Throwaway: delete once
 * the encoding question is settled.
 */

// See the note in hex-prod-payload-dump.ts: with no top-level import or export
// this file is a SCRIPT, so `main` is global and collides with any sibling that
// declares one. It did, and it broke a Vercel build on a docs-only PR.
export {};

async function main() {
  // The repo's own client: Prisma 7 requires an adapter, chosen by URL in
  // src/lib/db-adapter.ts (node-postgres for localhost, Neon serverless for a
  // Neon URL). Constructing a bare PrismaClient here fails.
  const { db: prisma } = await import("@/lib/db");

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      revs: bigint;
      clusters: bigint;
      max_chars: number | null;
      p95_chars: number | null;
      median_chars: number | null;
      max_cells: number | null;
      p95_cells: number | null;
      big: bigint;
      uncompressed: bigint;
    }>
  >(`
    SELECT
      count(*)                                              AS revs,
      count(DISTINCT "clusterId")                        AS clusters,
      max(char_length(payload))                             AS max_chars,
      percentile_disc(0.95) WITHIN GROUP (ORDER BY char_length(payload)) AS p95_chars,
      percentile_disc(0.50) WITHIN GROUP (ORDER BY char_length(payload)) AS median_chars,
      max((summary->>'cells')::int)                         AS max_cells,
      percentile_disc(0.95) WITHIN GROUP (ORDER BY (summary->>'cells')::int) AS p95_cells,
      count(*) FILTER (WHERE (summary->>'cells')::int >= 19) AS big,
      count(*) FILTER (WHERE payload LIKE 'u=%')            AS uncompressed
    FROM "HexClusterRevision"
  `);

  console.log("=== HexClusterRevision census (PROD, read-only) ===");
  console.table(
    rows.map((r) => ({
      revisions: Number(r.revs),
      clusters: Number(r.clusters),
      median_payload_chars: r.median_chars,
      p95_payload_chars: r.p95_chars,
      max_payload_chars: r.max_chars,
      p95_cells: r.p95_cells,
      max_cells: r.max_cells,
      "revs_>=19_cells": Number(r.big),
      "uncompressed_u=": Number(r.uncompressed),
    })),
  );

  // The distribution matters more than the max: the QR ceiling is a threshold,
  // so what counts is how many real builds sit near it.
  const dist = await prisma.$queryRawUnsafe<
    Array<{ bucket: string; n: bigint }>
  >(`
    SELECT
      CASE
        WHEN char_length(payload) <  200 THEN 'a <200'
        WHEN char_length(payload) <  400 THEN 'b 200-399'
        WHEN char_length(payload) <  700 THEN 'c 400-699'
        WHEN char_length(payload) < 1200 THEN 'd 700-1199'
        ELSE                                  'e 1200+'
      END AS bucket,
      count(*) AS n
    FROM "HexClusterRevision"
    GROUP BY 1 ORDER BY 1
  `);
  console.log("payload length distribution:");
  console.table(dist.map((d) => ({ bucket: d.bucket, revisions: Number(d.n) })));

  // A build too large to store never becomes a row, so the table is blind to
  // the exact population this census is about. Name that rather than imply
  // the counts above are the whole truth.
  console.log(
    "NOTE: rejected saves (payload-too-large / uncompressed) never insert a row,\n" +
      "so this census cannot see builds that failed to save. Pair with PostHog\n" +
      "hex_save_started vs hex_save_completed for the full picture.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
