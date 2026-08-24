import { defineConfig, configDefaults } from "vitest/config";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { loadBaseEnv, testPoolSize, LOCK_DIR } from "./vitest.env";

// Load .env.local (+ test DB env) so this config sees the same env the tests do.
// In CI there is no .env.local; the workflow sets env directly (R2_ENABLED=false,
// no R2_BUCKET / PARTS_MCP_DATABASE_URL, and TEST_DATABASE_URL/TEST_DATABASE_POOL).
loadBaseEnv();

// Ensure the branch-lease lock dir exists, here on the main thread before any
// worker spawns (doing it in a globalSetup would race across the two projects).
//
// This used to rmSync the directory first, to clear locks left by a crashed run.
// That wipe was unnecessary AND harmful. Unnecessary because leaseTestBranch()
// already reclaims any lock whose mtime is older than STALE_MS (20s, against a
// 2s heartbeat) -- the old comment conceded as much with "stale ones would
// self-heal anyway". Harmful because it ran unconditionally at config load, so a
// SECOND vitest process (a `test:watch` already running, another terminal, an
// agent worktree) deleted the FIRST run's live locks. The victim never noticed:
// its heartbeat swallows a vanished lock and its release swallows "already
// gone". Both runs then hand the same branch URL to different files -- exactly
// the concurrent-writer collision the lease mechanism exists to prevent.
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

// SAY SO. These files are EXCLUDED, not skipped -- vitest never sees them, so
// they contribute nothing to the run summary: no skip count, no "todo", nothing.
// This used to remove 59 test declarations from EVERY CI run -- ci.yml set
// R2_ENABLED: "false" on every step and never set PARTS_MCP_DATABASE_URL -- while
// the summary reported a clean sweep of what remained. The only way to notice was
// to read this file.
//
// SEVEN OF THE EIGHT NOW RUN. ci.yml starts an S3-compatible server just before
// `pnpm vitest run` and points the client at it with R2_ENDPOINT
// (src/lib/r2-target.ts), so R2_ENABLED is "true" there and the R2-gated files
// are no longer dropped. The credential problem is what forced the old
// exclusion: this repo is PUBLIC, so a real Cloudflare key in its Actions secrets
// is reachable from any merged workflow edit, and a fork PR gets no secrets at
// all. A container needs no key, so a fork PR gets identical coverage.
//
// Cost was never the reason, incidentally -- measured at ~371 CI runs/30d the
// whole thing fits inside R2's free tier, about $0.30/month at list price.
//
// THE EIGHTH still waits on infrastructure. parts-mcp-readonly.test.ts needs a
// read-only role on the SEEDED ci-test branch, and it cannot be faked with an
// empty container: it asserts that an `UPDATE "Part"` REJECTS, and against a
// database with no schema that rejects with `relation "Part" does not exist` --
// passing for the wrong reason, with the read-only guarantee unverified. ci.yml
// carries the passthrough and the provisioning SQL; it arms itself when the
// secret exists.
//
// The banner stays either way. A banner is not the same as running them, but it
// does mean the number is on screen, so a 9th file joining the list is visible
// instead of arriving unannounced.
// Printed once, not once per project: this config is evaluated for each of the
// two projects, and again in each worker. `VITEST_POOL_ID` is set only in
// workers; the globalThis flag covers the repeat evaluations inside the main
// process.
const BANNER_ONCE = Symbol.for("otd.vitest.gatedBanner");
const g = globalThis as unknown as Record<symbol, boolean>;
if (gatedBasenames.length > 0 && !process.env.VITEST_POOL_ID && !g[BANNER_ONCE]) {
  g[BANNER_ONCE] = true;
  const why = [
    R2_OFF ? "R2_ENABLED!=true or R2_BUCKET unset" : null,
    MCP_OFF ? "PARTS_MCP_DATABASE_URL unset" : null,
  ].filter(Boolean);
  console.warn(
    `\n[vitest] ${gatedBasenames.length} live-integration test file(s) EXCLUDED from this run` +
      ` (${why.join("; ")}):\n` +
      gatedBasenames.map((b) => `  - ${b}`).join("\n") +
      `\n[vitest] They are excluded, not skipped -- they will NOT appear in the summary below.\n`,
  );
}

// Partition test files into two projects by whether they touch the REAL database:
//   • "db"   — imports `@/lib/db` and does NOT mock it. Each file leases its own
//              Neon branch (vitest.setup.ts) so parallel DB files never share a
//              database (which would cause SSI 40001). Only these files lease, so
//              pool pressure stays low.
//   • "unit" — everything else (pure logic, or mocks the DB). No lease, no pool
//              slot — runs free. ~half the suite, so this halves lease pressure.
// The split is computed by scanning sources, so it stays correct as tests change
// (e.g. a CONVERT-TO-UNIT file that starts mocking the DB moves to "unit").
// Scan `mcp` as well as `src`. The MCP server keeps its own suites under
// mcp/parts-server/__tests__/ (env resolver, answer-contract formatter, source
// guards) and a src-only scan never discovered them — so the guards asserting
// that the server cannot reach the read-write DB client and never writes to
// stdout (a stray console.log corrupts the MCP protocol stream) were dead files
// that nothing executed. Any new top-level directory with tests needs adding here.
const TEST_ROOTS = ["src", "mcp"];

function allTestFiles(): string[] {
  return TEST_ROOTS.flatMap((root) =>
    readdirSync(root, { recursive: true })
      .map((p) => `${root}/${String(p).replace(/\\/g, "/")}`)
      .filter(
        (p) =>
          /\.test\.tsx?$/.test(p) &&
          !p.includes("/.claude/") &&
          !p.includes("/node_modules/") &&
          !gatedBasenames.some((g) => p.endsWith(`/${g}`)),
      ),
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
    // Fast-fail if the test-branch pool is behind the schema (stale-pool drift)
    // with one clear message instead of hundreds of "column (not available)".
    // No-op when no pool is configured (CI). See vitest.global-setup.ts.
    globalSetup: ["./vitest.global-setup.ts"],
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
