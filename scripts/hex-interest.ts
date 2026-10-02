/**
 * Molded-line interest ranking, read from PRODUCTION as the read-only role.
 *
 *     pnpm tsx scripts/hex-interest.ts
 *
 * NOT under `pnpm db:prod`: that wrapper swaps the OWNER url into DATABASE_URL,
 * and this script refuses to start when it sees that (src/lib/prod-ro.ts). It
 * opens its own connection as `foundry_report`, sets the session read-only, and
 * proves the role cannot write before it reads a row (hex-v2 next plan P.6,
 * owner R3-8). Counts only, never an address.
 *
 * Until the interest tables land (plan 1.2: confirmed waitlist rows per stem,
 * distinct IP-day taps with the degraded-drop count), the ranking section says
 * so and the script reports the capture tables that exist today, so a run is
 * never a silent success with nothing behind it.
 */

// No top-level import/export of VALUES: see hex-prod-payload-dump.ts. The type
// imports below are erased, and `export {}` keeps this a module.
export {};

async function main() {
  const { config: loadEnv } = await import("dotenv");
  loadEnv({ path: ".env.local", quiet: true });
  const { openReadOnly } = await import("@/lib/prod-ro");

  const client = await openReadOnly(process.env);
  try {
    const who = await client.query<{ role: string; ro: string; host: string }>(
      "SELECT current_user AS role, current_setting('transaction_read_only') AS ro, inet_server_addr()::text AS host",
    );
    console.log(
      `=== Hex interest (PROD, ${who.rows[0].role}, read-only=${who.rows[0].ro}) ===`,
    );
    console.log(
      "write proof: a no-op UPDATE was refused before this line printed",
    );
    console.log("");

    const exists = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('HexPartWaitlist', 'HexPartInterest')`,
    );
    const have = new Set(exists.rows.map((r) => r.table_name));

    console.log("--- molded parts: ranking ---");
    if (have.has("HexPartWaitlist") || have.has("HexPartInterest")) {
      if (have.has("HexPartWaitlist")) {
        const w = await client.query<{
          stem: string;
          confirmed: string;
          pending: string;
        }>(
          `SELECT stem,
                  count(*) FILTER (WHERE "confirmedAt" IS NOT NULL) AS confirmed,
                  count(*) FILTER (WHERE "confirmedAt" IS NULL) AS pending
             FROM "HexPartWaitlist", unnest(stems) AS stem
            GROUP BY stem ORDER BY confirmed DESC, stem`,
        );
        console.table(w.rows);
      }
      if (have.has("HexPartInterest")) {
        const t = await client.query<{
          stem: string;
          ip_days: string;
          degraded: string;
        }>(
          `SELECT stem, "ipDays" AS ip_days, "degradedDrops" AS degraded
             FROM "HexPartInterest" ORDER BY "ipDays" DESC, stem`,
        );
        console.table(t.rows);
      }
    } else {
      console.log(
        "(no interest tables yet: HexPartWaitlist / HexPartInterest land with plan 5.4;",
      );
      console.log(
        " until then the only signal is mail to the support address)",
      );
    }
    console.log("");

    console.log("--- capture tables that exist today (counts only) ---");
    const counts = await client.query<{
      what: string;
      rows: string;
      notified: string | null;
    }>(
      `SELECT 'HexReleaseNotify' AS what, count(*)::text AS rows,
              count(*) FILTER (WHERE "notifiedAt" IS NOT NULL)::text AS notified FROM "HexReleaseNotify"
       UNION ALL
       SELECT 'PassWaitlist', count(*)::text, NULL FROM "PassWaitlist"
       UNION ALL
       SELECT 'WaitlistSignup', count(*)::text,
              count(*) FILTER (WHERE "notifiedAt" IS NOT NULL)::text FROM "WaitlistSignup"`,
    );
    console.table(counts.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
