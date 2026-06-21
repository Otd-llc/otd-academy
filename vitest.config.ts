import { defineConfig, configDefaults } from "vitest/config";
import { loadTestEnv } from "./vitest.env";

// Load .env.local (+ swap in the isolated test DB when configured) so this config
// sees the same env the tests do; vitest.setup.ts does the same for the workers.
// In CI there is no .env.local; the workflow sets the env directly (R2_ENABLED=
// false, no R2_BUCKET / PARTS_MCP_DATABASE_URL, and TEST_DATABASE_URL = ci branch).
loadTestEnv();

// Gate the live-integration tests on their service env. These exercise REAL R2
// (PUT/HEAD/presign round-trips) or the read-only MCP role, so they can't run
// without those credentials. They run locally (where .env.local supplies them)
// and are SKIPPED where the env is absent (CI), instead of failing the suite.
const R2_OFF = process.env.R2_ENABLED !== "true" || !process.env.R2_BUCKET;
const MCP_OFF = !process.env.PARTS_MCP_DATABASE_URL;

const envGatedExclude = [
  ...(R2_OFF
    ? [
        "**/artifact-render.test.ts",
        "**/kicad-export.test.ts",
        "**/m8b-checkpoint.test.ts",
        "**/part-assets-actions.test.ts",
        "**/part-assets-r2.test.ts",
        "**/uploads-actions.test.ts",
        "**/uploads-download.test.ts",
      ]
    : []),
  ...(MCP_OFF ? ["**/parts-mcp-readonly.test.ts"] : []),
];

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 30_000,
    setupFiles: ["./vitest.setup.ts"],
    // All DB-touching test files share one Neon database. Serializable
    // transactions in the action layer (design §5.3) collide under parallel
    // workers — the retry helper handles real production contention but
    // tests stamp the same Revision/Project rows at the same instant, which
    // is a synthetic level of contention SSI isn't designed for. Run files
    // sequentially; tests within a file still parallelize.
    fileParallelism: false,
    // Never glob harness worktrees: `.claude/worktrees/*` are isolated copies of
    // the repo created by background agents. A stale/orphaned one (one git no
    // longer tracks) otherwise gets its *.test.ts collected alongside the real
    // src copies, running duplicate DB-mutating tests that collide on the shared
    // Neon DB — a false-failure unrelated to the working tree.
    exclude: [...configDefaults.exclude, "**/.claude/**", ...envGatedExclude],
  },
  resolve: { alias: { "@": "/src" } },
});
