# CLAUDE.md — repo instructions for AI agents

Instructions for any AI agent (Claude Code or otherwise) working in this repo.

## Board design — validation gate (MANDATORY)

This repo's curriculum boards live in `docs/boards/<slug>/design.md`. Their lifecycle
`DESIGN_VALIDATION` checklist items are **honest human attestations**, not machine
proofs — so the design must be *proven* before any hardware commitment.

**Before you create a board's parts in the library, import/edit its BOM, or create or
advance its revision — or when you start or substantially edit any
`docs/boards/*/design.md` — you MUST:**

1. Read **`docs/boards/_protocol.md`** (the Recursive Board-Design Validation Protocol).
2. Run it, or at minimum **surface it to the user and get their go-ahead** before
   proceeding.

**A board is NOT part-ready** until its design has passed the protocol: **≥ 10
recursive audit passes, a "dry" pass (zero new material findings), every applicable
audit clean, and the board's `validation-log.md` complete.** Do not create parts, BOM
lines, or revisions before then. New boards start from `docs/boards/_template/`
(which carries the gate banner + a `validation-log.md` scaffold).

## A few load-bearing facts (verify before relying on them)

- **`.env.local` `DATABASE_URL` is LOCAL** (Postgres 17 Windows service
  `postgresql-x64-17`, database `foundry_dev`) — **since 2026-07-15; it used to be PROD.**
  `next dev`, `pnpm db:seed`, and every `scripts/*.ts` hit local, so they are **safe by
  default**. **PROD is `PROD_DATABASE_URL` / `PROD_DIRECT_URL`**, reachable only via:
  - `pnpm db:prod <script.ts>` — swaps the env, prints the host, makes you type `prod`
  - `pnpm db:migrate:prod` — needs the PROD env set inline (see the migration bullet)
  - `pnpm db:pull-prod` — dumps PROD read-only, restores into local (refuses to run
    unless `DATABASE_URL` is localhost). **Hydrate/refresh local with this.**

  The adapter is chosen by URL (`src/lib/db-adapter.ts`): a localhost URL uses
  node-postgres, a Neon URL uses `@neondatabase/serverless`. The Neon driver speaks
  WebSocket to Neon's proxy and **cannot** reach a local Postgres, so never assume a
  bare URL swap is enough. Note the drivers differ subtly — e.g. `$queryRaw` on a
  Postgres `name` column deserializes under node-postgres but **fails** under Neon
  (cast to `::text`).

  *Why:* dev traffic against prod Neon burned 4.73 GB of the 5 GB account egress and
  70% of the 100 CU-h/project compute by mid-July 2026, while the deployed site served
  4 requests/day. See `docs/plans/2026-07-15-dev-off-prod-local-postgres.md`.
- **Tests run against an isolated Neon branch pool, NOT prod** (since 2026-06-21).
  `.env.test.local` (gitignored) supplies `TEST_DATABASE_POOL`; `pnpm test` parallelizes
  by leasing a branch per DB-test file (`vitest.env.ts`), so concurrent runs are safe and
  the suite is ~80s (was ~13 min). **If `.env.test.local` is absent, tests fall back to
  PROD** — so keep it present. The pool branches are persistent clones and drift behind
  prod after a migration; `pnpm test:pool:refresh` re-applies migrations to each (and
  `pnpm db:migrate:prod` does it for you — **`pnpm db:migrate` no longer does**, since it
  now targets local, where a pool refresh would be meaningless). The pool stays on **Neon**
  deliberately: it is ~16 CU-h and 0.44 GB, and the per-file branch isolation is worth
  keeping. A vitest guardrail (`vitest.global-setup.ts`)
  fast-fails with one clear message if the pool is behind, instead of hundreds of
  cryptic "column (not available)" errors. New DB-backed tests can use throwaway rows or
  freely mutate the seed fixture (each file has its own branch clone).
- **`pnpm` runs via PowerShell, not the Bash tool.** Migrations are hand-authored and run
  `prisma migrate deploy` (**never** `migrate dev`). Since 2026-07-15 the command is split:
  - **`pnpm db:migrate`** → applies to **LOCAL** `foundry_dev`. Test it here first.
  - **`pnpm db:migrate:prod`** → applies to **PROD** *and* refreshes the test pool (the
    pool branches clone prod, so they drift after a prod migration). It inherits `.env.local`
    like any pnpm script, so it needs the PROD env set inline:
    ```powershell
    $env:DATABASE_URL=$PROD_DATABASE_URL; $env:DIRECT_URL=$PROD_DIRECT_URL; pnpm db:migrate:prod
    ```
    **Verify it actually reached prod** — a migration silently applied to local while you
    believe it hit prod is the worst failure mode here.

  Restart `next dev` after `prisma generate`.
- **BOM CSV import is strict-match** on `(manufacturer, mpn)` against the curated
  parts library — unmatched rows are reported, never auto-created. Create new parts
  *before* importing. One CSV row per part (merge shared refDes; `refDes` count must
  equal `quantity`).
- **Branch off `main`.** Don't merge without the maintainer's explicit go-ahead.
