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

- **`.env.local` `DATABASE_URL` is PROD.** Seed scripts and `pnpm db:seed` mutate the
  production Neon DB — be careful with those.
- **Tests run against an isolated Neon branch pool, NOT prod** (since 2026-06-21).
  `.env.test.local` (gitignored) supplies `TEST_DATABASE_POOL`; `pnpm test` parallelizes
  by leasing a branch per DB-test file (`vitest.env.ts`), so concurrent runs are safe and
  the suite is ~80s (was ~13 min). **If `.env.test.local` is absent, tests fall back to
  PROD** — so keep it present. Refresh the pool branches from prod after schema migrations.
  New DB-backed tests can use throwaway rows or freely mutate the seed fixture (each file
  has its own branch clone).
- **`pnpm` runs via PowerShell, not the Bash tool.** Migrations are hand-authored;
  apply with `pnpm exec prisma migrate deploy` (never `migrate dev`). Restart
  `next dev` after `prisma generate`.
- **BOM CSV import is strict-match** on `(manufacturer, mpn)` against the curated
  parts library — unmatched rows are reported, never auto-created. Create new parts
  *before* importing. One CSV row per part (merge shared refDes; `refDes` count must
  equal `quantity`).
- **Branch off `main`.** Don't merge without the maintainer's explicit go-ahead.
