// Run any script against PROD instead of the local dev database, deliberately
// and loudly.
//
//   pnpm db:prod scripts/seed-comms-cluster.ts
//   pnpm db:prod scripts/seed-comms-cluster.ts --yes        (skip the prompt)
//   pnpm db:prod scripts/some-script.ts -- --flag value      (args after -- are forwarded)
//
// Since 2026-07-15 DATABASE_URL is LOCAL, so every scripts/*.ts is safe by
// default (they all resolve the DB through `await import("@/lib/db")`). This is
// the deliberate route back to production.
//
// See docs/plans/2026-07-15-dev-off-prod-local-postgres.md.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const argv = process.argv.slice(2);
  const yes = argv.includes("--yes");
  const target = argv.find((a) => a.endsWith(".ts") || a.endsWith(".tsx"));

  if (!target) {
    console.error("usage: pnpm db:prod <script.ts> [--yes] [-- <script args>]");
    process.exit(1);
  }
  const abs = resolve(target);
  if (!existsSync(abs)) {
    console.error(`no such script: ${target}`);
    process.exit(1);
  }

  const prod = process.env.PROD_DATABASE_URL;
  const prodDirect = process.env.PROD_DIRECT_URL;
  if (!prod || !prodDirect) {
    console.error("PROD_DATABASE_URL / PROD_DIRECT_URL are not set in .env.local");
    process.exit(1);
  }

  console.log("");
  console.log("  *** TARGET: PRODUCTION ***");
  console.log(`  host   : ${new URL(prod).hostname}`);
  console.log(`  script : ${target}`);
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

  // ORDER IS LOAD-BEARING: swap the env BEFORE importing the target, because
  // src/lib/db.ts reads process.env.DATABASE_URL when its module first
  // evaluates. A static import of the target at the top of this file would
  // evaluate too early and silently run against LOCAL while reporting PROD.
  process.env.DATABASE_URL = prod;
  process.env.DIRECT_URL = prodDirect;

  // Rebuild argv so the target sees itself at [1] and gets any args after `--`.
  const sep = process.argv.indexOf("--");
  const forwarded = sep === -1 ? [] : process.argv.slice(sep + 1);
  process.argv = [process.argv[0], abs, ...forwarded];

  await import(pathToFileURL(abs).href);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
