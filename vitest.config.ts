import { defineConfig, configDefaults } from "vitest/config";
import { readdirSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { loadBaseEnv, testPoolSize, LOCK_DIR } from "./vitest.env";

// Load .env.local (+ test DB env) so this config sees the same env the tests do.
// In CI there is no .env.local; the workflow sets env directly (R2_ENABLED=false,
// no R2_BUCKET / PARTS_MCP_DATABASE_URL, and TEST_DATABASE_URL/TEST_DATABASE_POOL).
loadBaseEnv();

// Clear the branch-lease lock dir once, here on the main thread before any worker
// spawns (doing it in a globalSetup would race across the two projects). Removes
// any locks left by a previously crashed run; stale ones would self-heal anyway.
rmSync(LOCK_DIR, { recursive: true, force: true });
mkdirSync(LOCK_DIR, { recursive: true });

// Gate live-integration tests on their service env. These exercise REAL R2 or the
// read-only MCP role, so they're SKIPPED where the env is absent (CI).
const R2_OFF = process.env.R2_ENABLED !== "true" || !process.env.R2_BUCKET;
const MCP_OFF = !process.env.PARTS_MCP_DATABASE_URL;
const gatedBasenames = [
  ...(R2_OFF
    ? [
        "artifact-render.test.ts",
        "kicad-export.test.ts",
        "m8b-checkpoint.test.ts",
        "part-assets-actions.test.ts",
        "part-assets-r2.test.ts",
        "uploads-actions.test.ts",
        "uploads-download.test.ts",
      ]
    : []),
  ...(MCP_OFF ? ["parts-mcp-readonly.test.ts"] : []),
];

// Partition test files into two projects by whether they touch the REAL database:
//   • "db"   — imports `@/lib/db` and does NOT mock it. Each file leases its own
//              Neon branch (vitest.setup.ts) so parallel DB files never share a
//              database (which would cause SSI 40001). Only these files lease, so
//              pool pressure stays low.
//   • "unit" — everything else (pure logic, or mocks the DB). No lease, no pool
//              slot — runs free. ~half the suite, so this halves lease pressure.
// The split is computed by scanning sources, so it stays correct as tests change
// (e.g. a CONVERT-TO-UNIT file that starts mocking the DB moves to "unit").
function allTestFiles(): string[] {
  return readdirSync("src", { recursive: true })
    .map((p) => `src/${String(p).replace(/\\/g, "/")}`)
    .filter(
      (p) =>
        /\.test\.tsx?$/.test(p) &&
        !p.includes("/.claude/") &&
        !gatedBasenames.some((g) => p.endsWith(`/${g}`)),
    );
}

const dbFiles: string[] = [];
const unitFiles: string[] = [];
for (const f of allTestFiles()) {
  const src = readFileSync(f, "utf8");
  const usesRealDb =
    /from\s+["']@\/lib\/db["']/.test(src) &&
    !/vi\.mock\(\s*["']@\/lib\/db["']/.test(src);
  (usesRealDb ? dbFiles : unitFiles).push(f);
}

// Concurrency for the DB project is bounded by the branch pool, with spare slots
// to absorb worker-respawn churn (a recycled worker's lock stays "fresh" until
// its heartbeat goes stale). The unit project needs no DB and could run wider,
// but vitest's pool is shared, so we keep one cap.
const POOL = testPoolSize();
const WORKERS = POOL <= 2 ? POOL : POOL - 2;

const sharedExclude = [...configDefaults.exclude, "**/.claude/**"];

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 30_000,
    // Backstop for rare transient flakes (lease handoff, Neon cold-start): a real
    // failure still fails all attempts; an infra blip recovers. The action layer
    // already retries SSI; this covers the test harness layer.
    retry: 3,
    pool: "forks",
    fileParallelism: WORKERS > 1,
    maxWorkers: WORKERS,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: unitFiles,
          exclude: sharedExclude,
          setupFiles: ["./vitest.setup.unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: dbFiles,
          exclude: sharedExclude,
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
  resolve: { alias: { "@": "/src" } },
});
