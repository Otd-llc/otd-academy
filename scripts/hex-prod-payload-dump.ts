/**
 * READ-ONLY dump of the stored hex payload strings.
 *
 * Companion to hex-prod-census.ts, which reports aggregates only. This one
 * emits the payloads themselves so the v2 wire format can be measured against
 * REAL builds rather than a synthetic cluster -- the whole point of the census
 * was that local has never held a production hex row, and a synthetic shape is
 * the same mistake one step further along.
 *
 * The payloads are opaque scene data for builds that are already publicly
 * reachable at their own /c/ pages, so this exposes nothing the share link
 * does not. It SELECTs and nothing else.
 *
 * Output is one payload per line, prefixed by its cell count, so the consumer
 * can pair a size with a shape.
 */
async function main() {
  const { db: prisma } = await import("@/lib/db");

  const rows = await prisma.$queryRawUnsafe<
    Array<{ cells: number | null; schema: number; payload: string }>
  >(`
    SELECT
      (summary->>'cells')::int AS cells,
      "schemaVersion"          AS schema,
      payload
    FROM "HexClusterRevision"
    ORDER BY char_length(payload) DESC
  `);

  console.log(`# ${rows.length} revisions, largest first`);
  for (const r of rows) {
    console.log(`${r.cells ?? "?"}\t${r.schema}\t${r.payload.length}\t${r.payload}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
