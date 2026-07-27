// Apply migrations to PRODUCTION, deliberately and loudly, then refresh the test pool.
//
//   pnpm db:migrate:prod
//   pnpm db:migrate:prod --yes     (skip the confirmation prompt)
//
// WHY THIS EXISTS. `db:migrate:prod` used to be
// `prisma migrate deploy && pnpm test:pool:refresh`. That inherits .env.local like
// any pnpm script, and .env.local's DIRECT_URL has been LOCAL since 2026-07-15 — so
// forgetting the inline `$env:DATABASE_URL=…` swap migrated the LOCAL database,
// exited 0, and then successfully refreshed the (separately-configured, Neon) test
// pool: a fully green run against the wrong database. CLAUDE.md called that "the
// worst failure mode here" while shipping only a sentence of documentation against
// it. Its two sibling prod paths both had real guards — with-prod-db.ts prompts,
// db-pull-prod.ps1 hard-refuses — and this one had none.
//
// So the env swap now happens HERE rather than in the caller's shell: there is no
// longer an inline step to forget, and the target is asserted, printed and
// confirmed before a single migration runs.
//
// See docs/plans/2026-07-15-dev-off-prod-local-postgres.md.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { createInterface } from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/** Resolve a package's declared CLI entry so we can run it via node directly — no
 *  shell, so nothing is interpolated into a command string (and it works
 *  cross-platform without a pnpm/npx .cmd shim). Mirrors refresh-test-pool.ts. */
function binOf(pkg: string): string {
  const pkgPath = require.resolve(`${pkg}/package.json`);
  const meta = require(pkgPath) as { bin: string | Record<string, string> };
  const rel = typeof meta.bin === "string" ? meta.bin : meta.bin[pkg]!;
  return join(dirname(pkgPath), rel);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

function isLocal(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

const redact = (u: string) => u.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");

async function main() {
  // Only this script's own flags are ever parsed — nothing is forwarded here, so
  // a `--yes` can't arrive from somewhere else and skip the prompt.
  const yes = process.argv.slice(2).includes("--yes");

  const prod = process.env.PROD_DATABASE_URL;
  const prodDirect = process.env.PROD_DIRECT_URL;
  if (!prod || !prodDirect) {
    console.error(
      "PROD_DATABASE_URL / PROD_DIRECT_URL are not set in .env.local.\n" +
        "For a LOCAL migration use `pnpm db:migrate` instead.",
    );
    process.exit(1);
  }

  // Prisma Migrate uses the DIRECT url (prisma.config.ts), so that is the one
  // whose target actually decides where migrations land — assert on it.
  let host: string;
  try {
    host = new URL(prodDirect).hostname;
  } catch {
    console.error("PROD_DIRECT_URL is not a valid URL.");
    process.exit(1);
  }

  // The guard db-pull-prod.ps1 has in the opposite direction: refuse rather than
  // ask, because a local host here means the env is misconfigured, and no answer
  // to a prompt would make migrating "prod" into localhost the right move.
  if (isLocal(host)) {
    console.error(
      `REFUSING: PROD_DIRECT_URL host is '${host}', which is LOCAL.\n` +
        "This command applies migrations to production; it will not run against a\n" +
        "local database. Use `pnpm db:migrate` for local.",
    );
    process.exit(1);
  }

  console.log("");
  console.log("  *** TARGET: PRODUCTION ***");
  console.log(`  host    : ${host}`);
  console.log(`  command : prisma migrate deploy`);
  console.log(`  then    : pnpm test:pool:refresh (pool branches clone prod)`);
  console.log("");

  if (!yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('  type "prod" to proceed: ');
    rl.close();
    if (answer.trim() !== "prod") {
      console.log("  aborted.");
      process.exit(1);
    }
    console.log("");
  }

  // The swap is scoped to the CHILD env, so nothing later in this process (or a
  // crashed run's shell) is left pointed at prod.
  console.log(`[db:migrate:prod] migrating ${redact(prodDirect)}`);
  execFileSync(process.execPath, [binOf("prisma"), "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: prod, DIRECT_URL: prodDirect },
  });

  // Only after a SUCCESSFUL migration — execFileSync throws otherwise, so a failed
  // migrate never leaves the pool refreshed as if it had worked.
  console.log("\n[db:migrate:prod] migration applied. Refreshing the test pool…");
  execFileSync(process.execPath, [binOf("tsx"), "scripts/refresh-test-pool.ts"], {
    stdio: "inherit",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
