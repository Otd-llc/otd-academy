# Project Foundry

> **License:** All rights reserved. See [LICENSE.md](LICENSE.md). This repo is public for transparency; the code is **not** licensed for use, fork, or derivative work by anyone other than the copyright holder.

A personal web app for managing hardware engineering projects — primarily ESP32-based PCB designs — through a structured 9-stage workflow from requirements through revision.

Internal tool for two users. Not a product.

## What it does

Tracks PCB hardware projects through nine workflow stages with first-class state, server-enforced gates, and append-only audit. Models Builds (fabrication runs), Boards (per-unit), Checklists (typed, build- or board-scoped), and Measurements (per-board DMM/scope readings) so the bench-execution workflow is structurally tied to the design workflow.

The 9 stages: `REQUIREMENTS → SCHEMATIC → BOM_SOURCING → LAYOUT → DRC_GERBER → ORDERING → ASSEMBLY → BRINGUP → REVISION`.

Some gates are strict invariants (you literally cannot enter LAYOUT before the BOM is frozen). Some are existence checks that will tighten in Phase 2 as KiCad parsing and distributor-API integration ship.

## Design + plan

The whole design lives in [docs/plans/](docs/plans/):

- [2026-05-27-design-foundry-phase1-design.md](docs/plans/2026-05-27-design-foundry-phase1-design.md) — the v6 Phase 1 design doc (~30K words; refined across four validation passes).
- [2026-05-28-design-foundry-phase1-implementation.md](docs/plans/2026-05-28-design-foundry-phase1-implementation.md) — the bite-sized implementation plan.

## Tech stack

- Next.js 16 (App Router) + TypeScript + React 19
- Prisma 7 + Neon Postgres (pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations) via `@prisma/adapter-neon`
- Auth.js v5 + Google OIDC + JWT sessions + email allowlist
- Tailwind v4 + shadcn/ui
- Cloudflare R2 for file artifacts (presigned PUT/GET, no proxy)
- Vitest for tests
- Vercel for hosting

## Local development

Requires Node 20+ and pnpm 11+.

```bash
pnpm install
cp .env.local.example .env.local   # then fill in real values
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev
```

Open http://localhost:3000.

## Tests

```bash
pnpm vitest run
```

228 tests across 36 files at the time of `phase-1-complete` tag.

## Phase 1 milestones

All tagged in this repo:

`M2a` schema · `M2b` seed · `M3-deferred` auth code · `M4` projects · `M5a` revisions · `M5b` builds · `M6` tracker · `M7` advance/regress · `M8a` artifacts (note+link) · `M8c` errata · `M9a` boards · `M9b` checklists · `M9c` measurements · `M10` polish · `phase-1-complete`

Phase 2 candidates: file artifacts via R2 (M8b), Digi-Key / Mouser API integration, KiCad ERC/DRC parsing, checklist templates, cross-board measurement views, doc-erratum model.
