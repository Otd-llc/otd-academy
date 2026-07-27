// Refresh the test-branch pool so its schema matches prod (and the Prisma client).
//
// Run this after any prod migration — or just use `pnpm db:migrate:prod`, which
// chains it automatically once the migration succeeds. (`pnpm db:migrate` does NOT:
// since 2026-07-15 it targets LOCAL, where refreshing the pool would be
// meaningless.) Without it, the persistent Neon pool branches
// (TEST_DATABASE_POOL in .env.test.local) drift behind prod and every DB test
// fails with the cryptic "column (not available)".
//
// `prisma migrate deploy` is idempotent and preserves each branch's data, so this
// only advances the schema. The Prisma 7 CLI reads its datasource URL from
// prisma.config.ts (which is `DIRECT_URL`); we set DIRECT_URL per branch in the
// child env, and dotenv's no-override default means prisma.config's .env.local
// load won't clobber it. CI is unaffected (it migrates a fresh branch each run);
// this only keeps LOCAL `pnpm test` from drifting.

import { config as loadEnv } from "dotenv";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env.test.local" });

const pool = (process.env.TEST_DATABASE_POOL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (pool.length === 0) {
  console.error(
    "[test:pool:refresh] TEST_DATABASE_POOL is empty (.env.test.local). Nothing to refresh.",
  );
  process.exit(1);
}

// Resolve Prisma's declared CLI entry and run it via node directly — no shell, so
// nothing is interpolated into a command string (and it works cross-platform
// without a pnpm/npx .cmd shim).
const require = createRequire(import.meta.url);
const prismaPkgPath = require.resolve("prisma/package.json");
const prismaPkg = require(prismaPkgPath) as { bin: string | Record<string, string> };
const binRel = typeof prismaPkg.bin === "string" ? prismaPkg.bin : prismaPkg.bin.prisma;
const prismaBin = join(dirname(prismaPkgPath), binRel);

const redact = (u: string) => u.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");

let ok = 0;
for (const [i, url] of pool.entries()) {
  // The pooled URL (-pooler) → its direct sibling, matching vitest.env.ts.
  const direct = url.replace("-pooler.", ".");
  console.log(
    `\n[test:pool:refresh] branch ${i + 1}/${pool.length}: ${redact(direct)}`,
  );
  try {
    execFileSync(process.execPath, [prismaBin, "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: direct },
    });
    ok++;
  } catch {
    console.error(
      `[test:pool:refresh] branch ${i + 1} FAILED — see the migrate output above.`,
    );
  }
}

console.log(`\n[test:pool:refresh] ${ok}/${pool.length} branch(es) now up to date.`);
process.exit(ok === pool.length ? 0 : 1);
