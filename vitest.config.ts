import { defineConfig } from "vitest/config";

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
  },
  resolve: { alias: { "@": "/src" } },
});
