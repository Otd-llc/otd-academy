# Move Dev off PROD → Local Postgres 17 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop local development from reading and writing the production Neon database, cutting both Neon meters (5 GB egress, 100 CU-h compute) to near-zero for dev — and making seed scripts safe by default.

**Architecture:** Install Postgres 17 as a native Windows service. Repoint `.env.local` `DATABASE_URL` at it and rename the Neon URL to `PROD_DATABASE_URL`. Because `src/lib/db.ts` uses the Neon-only `PrismaNeon` adapter (WebSocket to Neon's proxy — it *cannot* reach a local Postgres), add `@prisma/adapter-pg` and pick the adapter by URL. Hydrate local from a `pg_dump` of PROD. Prod writes become explicit and opt-in via a `pnpm db:prod <script>` wrapper.

**Tech Stack:** PostgreSQL 17 (matches Neon `pg_version: 17`), Prisma 7.8, `@prisma/adapter-pg` + `pg`, PowerShell.

---

## Why: the measured case

Measured 2026-07-15 (Neon API + Vercel logs + `pg_stat_user_tables`):

| Meter | Free-plan limit | Used by day 15 | Projected month |
| --- | --- | --- | --- |
| Data transfer (**account-wide**) | 5 GB | **5.18 GB** | ~10 GB — **already over** |
| Compute (**per project**) | **100 CU-h** | **69.6 CU-h** (70%) | **~144 CU-h — 44% over** |
| Storage (per project) | 0.5 GB | 0.32 GB | fine |

- Vercel production serves **4 requests / 24h**. The load is **not** visitor traffic.
- The `production` branch's compute was **awake 209 h in 15 days (~14 h/day)** — that's the dev loop, not the site.
- `.env.local` `DATABASE_URL` is PROD (CLAUDE.md's first bullet). So `next dev`, every `scripts/_*.ts`, and `pnpm db:seed` all hit production.

**Why only this fixes it.** Compute bills on *time awake*, not bytes — so the derived-columns work (`docs/plans/2026-07-15-library-derived-columns.md`) cuts egress 34× but does **nothing** for compute. And Neon's free tier scopes compute **per project** and egress **account-wide**, so a dev *branch* helps neither, and a separate dev *project* helps only compute:

| | Egress (account-wide) | Compute (per project) |
| --- | --- | --- |
| Derived columns | fixed | **no effect** |
| Neon dev branch | no effect | **no effect** |
| Separate Neon project | no effect | fixed |
| **Local Postgres** | **fixed** | **fixed** |

Free-plan limits verified against https://neon.com/docs/introduction/plans on 2026-07-15 — **not** from memory. An earlier draft of this work asserted a 191.9 CU-h limit from recall; the real figure is 100 CU-h/project, which is what turns compute from "comfortable" into "44% over".

**The safety dividend (the real reason to do this).** CLAUDE.md warns that seed scripts mutate PROD. Today the safe path is vigilance. After this, `DATABASE_URL` is local, so *the default is safe* and reaching prod takes a deliberate `pnpm db:prod`. Content authoring becomes: seed local → verify → promote.

**Non-goals:**
- The test pool stays on Neon branches. It's ~16 CU-h and 0.44 GB — not the problem, and the per-file branch isolation is worth keeping.
- ISR/`unstable_cache` on public routes: still wanted before launch. Separate plan.

---

## Validation already done (2026-07-15)

Checked before this plan was written:

1. **The adapter blocker is real.** `@prisma/adapter-pg` and `pg` are **not** installed — the repo has only `@prisma/adapter-neon@^7.8.0` + `@neondatabase/serverless@^1.1.0`. `PrismaNeon` is constructed in `src/lib/db.ts`, `mcp/parts-server/client.ts`, and `vitest.global-setup.ts`. Repointing `DATABASE_URL` at localhost **without Task 2 would simply fail to connect** — the Neon driver reaches Neon's WebSocket proxy, not a TCP Postgres.
2. **`@prisma/adapter-pg@7.8.0` exists** — an exact version match for the installed `adapter-neon@^7.8.0`. No version skew.
3. **`PostgreSQL.PostgreSQL.17` is in winget at `17.10-2`**, matching Neon's `pg_version: 17`. (`pg_dump` must be ≥ the server's major version.)
4. **`db:migrate` is verified** as `prisma migrate deploy && pnpm test:pool:refresh`.
5. **The MCP guard survives.** `mcp/parts-server/env.ts` asserts `PARTS_MCP_DATABASE_URL !== DATABASE_URL` by **string equality**; the distinct local `foundry_ro` URL satisfies it.
6. **`src/env.ts`** declares `DATABASE_URL: z.url()` / `DIRECT_URL: z.url()` and already has an `.optional()` precedent (`PARTS_MCP_DATABASE_URL`) to copy for the `PROD_*` pair.
7. **Free-plan limits web-verified** against https://neon.com/docs/introduction/plans (100 CU-h/project; 5 GB egress, account-wide) — the number that makes compute the deciding factor.

**Not yet validated — verify during execution:**
- `new PrismaPg({ connectionString })` takes the same options shape as `PrismaNeon`. Assumed by symmetry; Task 2's unit test only covers `isLocalDbUrl`, so `makeAdapter` is first proven end-to-end by Task 7 Step 2 (the app rendering against local).
- `pg_dump` against Neon: standard libpq over `PROD_DIRECT_URL` (unpooled — it cannot run through PgBouncer). Neon-specific objects may produce benign `pg_restore` notices; `--no-owner --no-privileges` covers the role mismatches. Untestable until Task 1 puts `pg_dump` on PATH.

---

## Preconditions

- Branch off `main`. Do not merge without the maintainer's explicit go-ahead (CLAUDE.md).
- `pnpm` runs via **PowerShell**, not the Bash tool.
- **This plan edits `.env.local`** (gitignored). Back it up first — Task 3 Step 1.
- Docker is installed but its daemon is not running; we are deliberately **not** using it (a Windows service auto-starts at boot, so a detached `next dev` never breaks).

---

### Task 1: Install Postgres 17 + create the dev database

**Step 1: Install**

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --accept-package-agreements --accept-source-agreements
```

**Step 2: Verify the service and the tools**

Open a **new** shell (PATH changed):

```powershell
Get-Service postgresql* | Select-Object Name, Status, StartType
(Get-Command psql).Source; (Get-Command pg_dump).Source
psql --version
```
Expected: service `Running` + `Automatic`; `psql`/`pg_dump` resolve; version reports **17.x**. Version must match Neon's `pg_version: 17` — a `pg_dump` from a newer server into an older client fails.

**Step 3: Create the database**

```powershell
$env:PGPASSWORD = "<the postgres superuser password set during install>"
psql -U postgres -h localhost -c "CREATE DATABASE foundry_dev;"
psql -U postgres -h localhost -lqt
```
Expected: `foundry_dev` listed.

**Step 4: Confirm the contrib extensions this repo needs exist**

`pg_trgm` backs the KiCad pickers; `pg_stat_statements` was added to PROD on 2026-07-15 and will be in the dump.

```powershell
psql -U postgres -h localhost -d foundry_dev -c "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
psql -U postgres -h localhost -d foundry_dev -c "\dx"
```
Expected: both listed. If either is missing, the Windows installer's contrib component wasn't selected — re-run the installer and add it.

**Step 5: Commit**

Nothing to commit (machine setup). Record the outcome in the PR description.

---

### Task 2: Teach `db.ts` to pick its adapter

**This is the blocker.** `PrismaNeon` wraps `@neondatabase/serverless`, which reaches Neon over a WebSocket proxy — it **cannot** talk to a local Postgres on `:5432`. Pointing `DATABASE_URL` at localhost without this task simply fails to connect.

**Files:**
- Create: `src/lib/db-adapter.ts`
- Modify: `src/lib/db.ts`
- Modify: `mcp/parts-server/client.ts`
- Test: `src/lib/__tests__/db-adapter.test.ts`

**Step 1: Add the deps**

```powershell
pnpm add @prisma/adapter-pg pg
pnpm add -D @types/pg
```

**Step 2: Write the failing test**

Pure URL-classification — no DB connection, so it runs anywhere.

```ts
import { describe, it, expect } from "vitest";
import { isLocalDbUrl } from "@/lib/db-adapter";

describe("isLocalDbUrl", () => {
  it("recognises a local Postgres URL", () => {
    expect(isLocalDbUrl("postgresql://postgres:pw@localhost:5432/foundry_dev")).toBe(true);
    expect(isLocalDbUrl("postgresql://postgres:pw@127.0.0.1:5432/foundry_dev")).toBe(true);
  });

  it("recognises a Neon URL as NOT local", () => {
    expect(
      isLocalDbUrl("postgresql://u:p@ep-lucky-dust-aqsl7sb8-pooler.c-8.us-east-1.aws.neon.tech/neondb"),
    ).toBe(false);
  });

  it("treats an unparseable URL as NOT local (fail safe: assume remote)", () => {
    expect(isLocalDbUrl("not a url")).toBe(false);
  });
});
```

**Step 3: Run it, verify it fails**

```powershell
pnpm vitest run src/lib/__tests__/db-adapter.test.ts
```
Expected: FAIL — cannot resolve `@/lib/db-adapter`.

**Step 4: Implement**

```ts
// src/lib/db-adapter.ts
//
// Picks the Prisma driver adapter from the connection URL.
//
// WHY: PrismaNeon wraps @neondatabase/serverless, which reaches Neon over a
// WebSocket proxy derived from the hostname — it CANNOT talk to a plain local
// Postgres. Dev runs against a local Postgres 17 service (see
// docs/plans/2026-07-15-dev-off-prod-local-postgres.md), so a local URL needs
// node-postgres instead. Neon URLs keep the Neon adapter, unchanged.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

/** True for a Postgres on this machine. Unparseable → false: assume REMOTE, so a
 *  malformed URL can never silently pick the local-only driver. */
export function isLocalDbUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function makeAdapter(url: string) {
  return isLocalDbUrl(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaNeon({ connectionString: url });
}
```

**Step 5: Use it in `db.ts`**

Replace the `PrismaNeon` construction only — leave the Task 3 derived-columns extension from the other plan intact if it has already landed:

```ts
import { makeAdapter } from "@/lib/db-adapter";
// …
const adapter = makeAdapter(url);
```

And the same in `mcp/parts-server/client.ts`, so the parts MCP server can point at local too:

```ts
import { makeAdapter } from "../../src/lib/db-adapter";
// …
const adapter = makeAdapter(url);
```

**Step 6: Run the tests**

```powershell
pnpm vitest run src/lib/__tests__/db-adapter.test.ts
```
Expected: PASS (3 tests). `vitest.global-setup.ts` keeps its own `PrismaNeon` — the test pool stays on Neon deliberately. Leave it alone.

**Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/db-adapter.ts src/lib/db.ts mcp/parts-server/client.ts src/lib/__tests__/db-adapter.test.ts
git commit -m "feat(db): pick prisma adapter by URL so dev can use local postgres"
```

---

### Task 3: Flip `.env.local`

**Files:**
- Modify: `.env.local` (gitignored — **back it up**)
- Modify: `.env.local.example`
- Modify: `src/env.ts`

**Step 1: Back up first**

```powershell
Copy-Item .env.local ".env.local.bak-2026-07-15"
```
This is the only copy of several secrets. Do not skip.

**Step 2: Rewrite the DB block**

```ini
# Local Postgres 17 (Windows service). Dev + scripts + `pnpm db:seed` hit THIS.
# Hydrate/refresh from prod with: pnpm db:pull-prod
DATABASE_URL="postgresql://postgres:<pw>@localhost:5432/foundry_dev"
DIRECT_URL="postgresql://postgres:<pw>@localhost:5432/foundry_dev"

# PROD Neon. Reached ONLY via `pnpm db:prod <script>` / `pnpm db:migrate:prod`
# / `pnpm db:pull-prod`. Never the default target. Handle with care.
PROD_DATABASE_URL="postgresql://…-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
PROD_DIRECT_URL="postgresql://…c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

Local needs no pooler, so `DATABASE_URL` == `DIRECT_URL`.

Point the parts MCP at local too:

```ini
PARTS_MCP_DATABASE_URL="postgresql://foundry_ro:<pw>@localhost:5432/foundry_dev"
```

Create that read-only role locally so the MCP keeps its least-privilege shape:

```powershell
psql -U postgres -h localhost -d foundry_dev -c "CREATE ROLE foundry_ro LOGIN PASSWORD '<pw>'; GRANT CONNECT ON DATABASE foundry_dev TO foundry_ro; GRANT USAGE ON SCHEMA public TO foundry_ro; GRANT SELECT ON ALL TABLES IN SCHEMA public TO foundry_ro; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO foundry_ro;"
```

> `mcp/parts-server/env.ts` asserts `PARTS_MCP_DATABASE_URL !== DATABASE_URL`. The distinct role keeps that guard satisfied. Verify it still passes.

**Step 3: Add the PROD vars to `src/env.ts`**

Optional (`.optional()`) — CI and Vercel must not be forced to define them.

**Step 4: Mirror the shape in `.env.local.example`**

Same keys, placeholder values, with the comments explaining which is which.

**Step 5: Verify Vercel is untouched**

Production reads `DATABASE_URL` from **Vercel's** env, not this file. Confirm the Vercel project still has its Neon `DATABASE_URL`/`DIRECT_URL` — this task must not touch them.

**Step 6: Commit**

```bash
git add .env.local.example src/env.ts
git commit -m "chore(env): local DATABASE_URL by default, prod behind PROD_*"
```

---

### Task 4: `pnpm db:pull-prod` — hydrate local from PROD

**Files:**
- Create: `scripts/db-pull-prod.ps1`
- Modify: `package.json`

**Step 1: Write the script**

```powershell
# scripts/db-pull-prod.ps1
# Dump PROD (read-only) and restore into the LOCAL dev database.
# ~66 MB of egress per run — versus the ~4.7 GB/month the old prod-connected
# dev loop was burning. Re-run whenever local drifts from prod.
#
# Run:  pnpm db:pull-prod
$ErrorActionPreference = "Stop"

Get-Content .env.local | Where-Object { $_ -match '^\s*(PROD_DIRECT_URL|DATABASE_URL)\s*=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  Set-Variable -Name $k.Trim() -Value $v.Trim().Trim('"')
}
if (-not $PROD_DIRECT_URL) { throw "PROD_DIRECT_URL not set in .env.local" }
if (-not $DATABASE_URL)    { throw "DATABASE_URL not set in .env.local" }
if ($DATABASE_URL -notmatch 'localhost|127\.0\.0\.1') {
  throw "REFUSING: DATABASE_URL is not local ($DATABASE_URL). This script overwrites its target."
}

$dump = Join-Path $env:TEMP "foundry-prod-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
Write-Host "dumping PROD -> $dump"
# Fc = custom format; --no-owner/--no-privileges so it restores under the local
# superuser without Neon's roles existing here.
pg_dump --format=custom --no-owner --no-privileges --file=$dump $PROD_DIRECT_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

Write-Host "restoring -> $DATABASE_URL"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname=$DATABASE_URL $dump
# pg_restore exits non-zero on benign notices; surface them but do not abort.
if ($LASTEXITCODE -ne 0) { Write-Warning "pg_restore reported issues (often benign) - review output above" }

Remove-Item $dump -Force
Write-Host "done. local hydrated from prod."
```

Uses `PROD_DIRECT_URL` (unpooled) — `pg_dump` cannot run through PgBouncer.

**Step 2: Wire the pnpm script**

```json
"db:pull-prod": "powershell -ExecutionPolicy Bypass -File scripts/db-pull-prod.ps1"
```

**Step 3: Run it**

```powershell
pnpm db:pull-prod
```
Expected: dump, restore, `done.` Roughly a 66 MB transfer.

**Step 4: Verify local matches prod**

```powershell
psql -U postgres -h localhost -d foundry_dev -c "SELECT count(*) FROM \"MiniLesson\" WHERE published AND \"accessTier\"='PUBLIC';"
psql -U postgres -h localhost -d foundry_dev -c "SELECT count(*) FROM \"Project\";"
psql -U postgres -h localhost -d foundry_dev -c "SELECT count(*) FROM \"Part\";"
```
Expected: **69** lessons, **24** projects, **53** parts — the PROD counts measured 2026-07-15.

Confirm the shared test fixture survived (~23 tests need it):

```powershell
psql -U postgres -h localhost -d foundry_dev -c "SELECT slug FROM \"Project\" WHERE slug='esp32-sensor-breakout';"
```
Expected: 1 row.

**Step 5: Commit**

```bash
git add scripts/db-pull-prod.ps1 package.json
git commit -m "feat(db): pnpm db:pull-prod to hydrate local from prod"
```

---

### Task 5: Make prod writes explicit

Every `scripts/*.ts` resolves `DATABASE_URL` via `await import("@/lib/db")` (164 call sites), so after Task 3 they all target **local** — which is the point. This gives back a deliberate route to prod.

**Files:**
- Create: `scripts/with-prod-db.ts`
- Modify: `package.json`

**Step 1: Write the wrapper**

```ts
// Run any script against PROD instead of local, deliberately and loudly.
//
//   pnpm db:prod scripts/seed-comms-cluster.ts
//
// Swaps DATABASE_URL/DIRECT_URL to the PROD_* pair BEFORE the target module is
// imported (so its `await import("@/lib/db")` picks prod up), prints the target
// host, and requires an explicit confirmation unless --yes is passed.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const target = args.find((a) => a.endsWith(".ts"));
  if (!target) throw new Error("usage: pnpm db:prod <script.ts> [--yes] [-- <script args>]");

  const prod = process.env.PROD_DATABASE_URL;
  const prodDirect = process.env.PROD_DIRECT_URL;
  if (!prod || !prodDirect) throw new Error("PROD_DATABASE_URL / PROD_DIRECT_URL not set in .env.local");

  const host = new URL(prod).hostname;
  console.log(`\n  *** TARGET: PROD ***  ${host}`);
  console.log(`  script: ${target}\n`);

  if (!yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('  type "prod" to proceed: ');
    rl.close();
    if (answer.trim() !== "prod") {
      console.log("  aborted.");
      process.exit(1);
    }
  }

  process.env.DATABASE_URL = prod;
  process.env.DIRECT_URL = prodDirect;
  // Forward any args after `--` to the target script.
  const sep = process.argv.indexOf("--");
  process.argv = [process.argv[0], resolve(target), ...(sep === -1 ? [] : process.argv.slice(sep + 1))];
  await import(pathToFileURL(resolve(target)).href);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> **Ordering matters:** the env swap must happen before the dynamic `import(target)`, because `src/lib/db.ts` reads `process.env.DATABASE_URL` when the module first evaluates. A static import at the top of this file would evaluate too early and silently target local.

**Step 2: Split the migrate scripts**

`db:migrate` currently runs `prisma migrate deploy` against prod and then refreshes the test pool. Make local the default and prod explicit:

Today's script is verified to be `"db:migrate": "prisma migrate deploy && pnpm test:pool:refresh"`. Split it:

```json
"db:migrate": "prisma migrate deploy",
"db:migrate:prod": "prisma migrate deploy && pnpm test:pool:refresh",
"db:prod": "tsx scripts/with-prod-db.ts"
```

`db:migrate` now inherits local `DATABASE_URL`/`DIRECT_URL` from `.env.local` — and drops the pool refresh, which only makes sense after a **prod** migration (the pool branches clone prod). `db:migrate:prod` is byte-identical to today's `db:migrate`, so the prod path is unchanged.

> `db:migrate:prod` inherits *local* env from `.env.local` like any pnpm script — it needs the PROD pair. Either run it as `pnpm db:prod` cannot help here (that wrapper imports a `.ts`, not a CLI), so set the vars inline for this one command:
> ```powershell
> $env:DATABASE_URL=$PROD_DATABASE_URL; $env:DIRECT_URL=$PROD_DIRECT_URL; pnpm db:migrate:prod
> ```
> Verify this actually reaches prod before trusting it — a migration silently applied to local while you believe it hit prod is the worst failure mode in this plan.

**Step 3: Verify both directions**

```powershell
# hits local — no prompt
pnpm exec tsx scripts/_validate-derived-plan.ts

# hits prod — must PROMPT, and must print the neon host
pnpm db:prod scripts/_validate-derived-plan.ts
```
Expected: the first reports 69 lessons from local; the second prints `*** TARGET: PROD *** ep-…neon.tech` and waits for the word `prod`.

**Step 4: Commit**

```bash
git add scripts/with-prod-db.ts package.json
git commit -m "feat(db): pnpm db:prod wrapper for explicit prod-targeted runs"
```

---

### Task 6: Update the docs that now assert something false

**This task is not optional.** CLAUDE.md's first load-bearing bullet becomes wrong the moment Task 3 lands, and every future AI agent in this repo reads it as truth.

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Rewrite the DB bullet**

Replace:

> **`.env.local` `DATABASE_URL` is PROD.** Seed scripts and `pnpm db:seed` mutate the production Neon DB — be careful with those.

With:

> - **`.env.local` `DATABASE_URL` is LOCAL** (Postgres 17 Windows service, `foundry_dev`) since 2026-07-15. `next dev`, `pnpm db:seed`, and every `scripts/*.ts` hit local — safe by default. **PROD is `PROD_DATABASE_URL`**, reachable only via `pnpm db:prod <script>` (prompts for confirmation), `pnpm db:migrate:prod`, or `pnpm db:pull-prod` (dump prod → restore local). Hydrate/refresh local with `pnpm db:pull-prod`. Why: dev traffic against prod Neon burned 4.73 GB of the 5 GB account egress and 70% of the 100 CU-h/project compute by mid-July 2026 — see `docs/plans/2026-07-15-dev-off-prod-local-postgres.md`.

**Step 2: Fix the migrate bullet**

The existing text says migrations are applied with `pnpm db:migrate` against prod. That is now `pnpm db:migrate:prod`. Update it, and keep the "never `migrate dev`" rule.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: DATABASE_URL is local; prod is explicit via db:prod"
```

---

### Task 7: Prove it

**Step 1: Full suite + typecheck**

```powershell
pnpm exec tsc --noEmit
pnpm test
```
Expected: tsc clean; vitest green (~1610, ~80s). Tests still lease **Neon** branches via `.env.test.local` — unchanged and intended. **If `.env.test.local` is absent, tests fall back to PROD.** Confirm it exists before running.

**Step 2: Drive the app against local**

Launch detached (a harness-backgrounded server dies):

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','pnpm dev' -WindowStyle Hidden
```

Open **`http://localhost:3000/library`** — localhost, *not* 127.0.0.1, or `/_next` chunks 404 and nothing hydrates. Verify: 69 lessons across 6 clusters, hero diagrams render, read-times present, sign-in works, a lesson page renders its content.

**Step 3: Prove prod is now idle**

Work locally for a while, then re-read the meters:

```
mcp__Neon__describe_project → branch "production" → data_transfer_bytes, active_time_seconds
```

Expected: `active_time_seconds` for `production` roughly flat across a dev session, instead of climbing ~14 h/day. This is the actual proof the plan worked — everything else is a proxy.

**Step 4: Confirm nothing points at prod by accident**

```powershell
Select-String -Path .env.local -Pattern "neon\.tech" | ForEach-Object { $_.Line -replace '://[^@]*@', '://USER:PASS@' }
```
Expected: **only** `PROD_DATABASE_URL` and `PROD_DIRECT_URL` mention `neon.tech`. If `DATABASE_URL` or `PARTS_MCP_DATABASE_URL` still do, stop and fix.

---

## Rollback

Restore `.env.local` from `.env.local.bak-2026-07-15` and revert the branch. The code changes are additive (`db-adapter.ts` picks Neon for any non-local URL, exactly today's behaviour), so a revert restores the current setup with no data change. **PROD is never written by this plan** — only read, once, by `pg_dump`.

## Definition of done

- [ ] Postgres 17 service running + `Automatic`; `psql`/`pg_dump` on PATH
- [ ] `pnpm exec tsc --noEmit` clean; `pnpm test` fully green
- [ ] `pnpm db:pull-prod` hydrates local: 69 lessons / 24 projects / 53 parts, `esp32-sensor-breakout` present
- [ ] `/library` renders correctly against local, signed-out and signed-in
- [ ] `pnpm db:prod <script>` prompts and reports the Neon host; a bare script run does not
- [ ] `.env.local`: only `PROD_*` mention `neon.tech`
- [ ] CLAUDE.md no longer claims `DATABASE_URL` is PROD
- [ ] Neon `production` `active_time_seconds` stays flat across a dev session
- [ ] Maintainer's explicit go-ahead before merge
