// Drift guardrail — runs once before the whole vitest suite.
//
// If the test-branch pool is behind the schema (someone ran a prod migration
// without refreshing the pool), the DB project otherwise fails with hundreds of
// cryptic "column (not available)" errors. This turns that into ONE clear message
// pointing at the fix, before any worker spawns.
//
// Scope: only when TEST_DATABASE_POOL is set. CI leaves it unset (it migrates a
// fresh branch each run), so this is a no-op there. A mere connectivity failure
// does NOT block the run (offline unit-only runs still work) — only a confirmed
// drift stops it. `_prisma_migrations` is a stable Prisma-managed table, so the
// query works even while the app columns are drifting.

import { config as loadEnv } from "dotenv";
import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

export default async function globalSetup() {
  loadEnv({ path: ".env.local" });
  loadEnv({ path: ".env.test.local" });

  const pool = (process.env.TEST_DATABASE_POOL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (pool.length === 0) return; // CI / no pool → nothing to guard

  const onDisk = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const adapter = new PrismaNeon({ connectionString: pool[0] });
  const prisma = new PrismaClient({ adapter });

  let applied: Set<string>;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`;
    applied = new Set(rows.map((r) => r.migration_name));
  } catch (e) {
    // Can't reach the pool → warn and let the tests themselves surface any real
    // problem; don't block an offline unit run over the guard.
    console.warn(
      `[vitest] pool drift guard could not verify the pool (continuing): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return;
  } finally {
    await prisma.$disconnect();
  }

  const missing = onDisk.filter((m) => !applied.has(m));
  if (missing.length > 0) {
    throw new Error(
      `\n\n  Test branch pool is ${missing.length} migration(s) behind the schema ` +
        `(oldest missing: ${missing[0]}).\n` +
        `  DB tests would fail with "column (not available)".\n` +
        `  Fix: pnpm test:pool:refresh\n`,
    );
  }
}
