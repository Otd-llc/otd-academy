// Shared test-env helpers for vitest.config.ts (main thread) and vitest.setup.ts
// (workers). Points DATABASE_URL/DIRECT_URL at an ISOLATED Neon test branch so
// the suite never mutates prod, and gives each concurrently-running test FILE its
// own branch so full file parallelism is safe despite the action layer's
// Serializable transactions (concurrent writers on one DB hit SSI 40001).
//
// Lease mechanism. TEST_DATABASE_POOL is a comma-separated list of branch URLs,
// one slot per O_EXCL lock file in LOCK_DIR. Each test file leases the first free
// slot in vitest.setup.ts and RELEASES it in an afterAll hook, so a worker holds
// at most one branch at a time (vitest runs a file's tests sequentially) and at
// most WORKERS branches are held at once — well under the pool size, so claiming
// never waits. Crash safety: while held, a lock is heartbeated (mtime touched);
// a claimer steals any lock whose mtime is stale (holder died before afterAll).
// Heartbeat staleness — not pid liveness — is the freedom signal, so it survives
// non-graceful worker death and OS pid reuse.
//
// vitest's worker ids are NOT stable small indices (the pool churns processes and
// ids climb unbounded) and module state resets per file under isolate:true, so a
// lock-file lease is the only reliable way to hand each file a distinct branch.
//
// Fallbacks: no pool but TEST_DATABASE_URL set → single test DB (e.g. CI; run
// single-worker). No test env at all → .env.local (legacy).
import { config as loadEnv } from "dotenv";
import {
  openSync,
  closeSync,
  writeSync,
  unlinkSync,
  statSync,
  utimesSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";

export const LOCK_DIR = ".vitest-branch-locks";
const HEARTBEAT_MS = 2000;
// A live holder heartbeats every 2s, so 20s of silence (10 missed beats) means
// it died. Set well above any single file's run time so a busy-but-live worker is
// never falsely stolen (graceful exits release immediately via the handlers
// below; this only reclaims hard SIGKILLs).
const STALE_MS = 20_000;
const MAX_WAIT_ATTEMPTS = 2400; // × 25ms ≈ 60s patience before giving up

// Release the currently-held lock on graceful process termination (vitest sends
// SIGTERM when recycling workers) so locks don't leak between the heartbeat
// going stale. Registered once per process; the active lock path lives in env so
// it survives isolate:true module resets.
function registerProcessCleanupOnce(): void {
  if (process.env.__LEASE_CLEANUP === "1") return;
  process.env.__LEASE_CLEANUP = "1";
  const cleanup = () => {
    const l = process.env.__CURRENT_LOCK;
    if (l) {
      try {
        unlinkSync(l);
      } catch {
        /* already gone */
      }
    }
  };
  process.on("exit", cleanup);
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.on(sig, () => {
      cleanup();
      process.exit(0);
    });
  }
}

function poolUrls(): string[] {
  return (process.env.TEST_DATABASE_POOL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function setDbUrls(url: string): void {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url.replace("-pooler.", ".");
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Load .env.local (+ .env.test.local). On the main/config thread, point the DB at
// pool[0] (or the single test DB) just so env gating sees a value — the main
// thread runs no tests and must NOT hold a lease. Workers call leaseTestBranch().
export function loadBaseEnv(): void {
  loadEnv({ path: ".env.local" });
  loadEnv({ path: ".env.test.local" });
  const fallback = poolUrls()[0] ?? process.env.TEST_DATABASE_URL;
  if (fallback) setDbUrls(fallback);
}

// Claim a branch for the current test file; returns a release fn for afterAll.
export function leaseTestBranch(): () => void {
  const pool = poolUrls();
  if (pool.length === 0) {
    if (process.env.TEST_DATABASE_URL) setDbUrls(process.env.TEST_DATABASE_URL);
    // No pool and no explicit single test DB. In CI that is CORRECT and
    // deliberate: the workflow passes DATABASE_URL/DIRECT_URL for the shared
    // ci-test branch directly, and tests run serially against it.
    //
    // Anywhere else it means `.env.test.local` is missing -- the default state
    // of a fresh clone, since it is gitignored. dotenv does not override an
    // already-set variable, so DATABASE_URL keeps whatever `.env.local` gave it:
    // the developer's own dev database. Every DB test file would then run its
    // INSERT/UPDATE/DELETE against it, destroying the local seed, and this
    // function would return a no-op release having leased nothing -- silently.
    // Fail loudly instead; a wrong database is not something to discover from
    // confusing test failures an hour later.
    else if (!process.env.CI) {
      const current = process.env.DATABASE_URL;
      let where = "(DATABASE_URL unset)";
      try {
        if (current) {
          const u = new URL(current);
          where = `${u.hostname}${u.pathname}`;
        }
      } catch {
        where = "(DATABASE_URL unparseable)";
      }
      throw new Error(
        [
          "[vitest.env] Refusing to run DB tests without an isolated test database.",
          "",
          `  DB tests would run against: ${where}`,
          "",
          "  Neither TEST_DATABASE_POOL nor TEST_DATABASE_URL is set, which means",
          "  .env.test.local is missing (it is gitignored, so a fresh clone has none).",
          "  Without it these tests mutate whatever .env.local points at -- normally",
          "  your local dev database -- and lease no branch.",
          "",
          "  Fix: create .env.test.local with TEST_DATABASE_POOL (see CLAUDE.md).",
          "  To run the tests that need no database instead: pnpm vitest run --project unit",
        ].join("\n"),
      );
    }
    return () => {};
  }

  mkdirSync(LOCK_DIR, { recursive: true });
  registerProcessCleanupOnce();
  for (let attempt = 0; attempt < MAX_WAIT_ATTEMPTS; attempt++) {
    for (let i = 0; i < pool.length; i++) {
      const lock = join(LOCK_DIR, `branch-${i}.lock`);
      try {
        const fd = openSync(lock, "wx"); // O_EXCL: atomic create-or-fail
        writeSync(fd, String(process.pid));
        closeSync(fd);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        try {
          if (Date.now() - statSync(lock).mtimeMs > STALE_MS) unlinkSync(lock);
        } catch {
          /* released mid-check — retry */
        }
        continue;
      }

      setDbUrls(pool[i]);
      process.env.__CURRENT_LOCK = lock;
      const beat = setInterval(() => {
        try {
          const now = new Date();
          utimesSync(lock, now, now);
        } catch {
          /* lock vanished */
        }
      }, HEARTBEAT_MS);
      beat.unref?.();

      let released = false;
      return () => {
        if (released) return;
        released = true;
        clearInterval(beat);
        if (process.env.__CURRENT_LOCK === lock) delete process.env.__CURRENT_LOCK;
        try {
          unlinkSync(lock);
        } catch {
          /* already gone */
        }
      };
    }
    sleepMs(25); // every slot momentarily held — wait for one to free
  }
  throw new Error(
    `[vitest.env] could not lease a test branch from a pool of ${pool.length}`,
  );
}

// Number of branches in the lease pool.
export function testPoolSize(): number {
  return Math.max(1, poolUrls().length);
}
