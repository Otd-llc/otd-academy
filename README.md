# Project Foundry

> **License:** All rights reserved. See [LICENSE.md](LICENSE.md). This repo is public for transparency and reference; the code is **not** licensed for use, fork, or derivative work by anyone other than the copyright holder.

**Production:** https://foundry.onethousanddrones.com (Google sign-in, allowlisted users only).

A personal web app for managing hardware engineering projects — primarily ESP32-based PCB designs — through a structured 9-stage workflow from requirements through revision.

Internal tool for two users. Not a product.

## What it does

Tracks PCB hardware projects through nine workflow stages with first-class state, server-enforced gates, and an append-only audit trail. Models Builds (fabrication runs), Boards (per-unit), Checklists (typed, build- or board-scoped), and Measurements (per-board DMM/scope readings) so the bench-execution workflow is structurally tied to the design workflow.

The 9 stages: `REQUIREMENTS → SCHEMATIC → BOM_SOURCING → LAYOUT → DRC_GERBER → ORDERING → ASSEMBLY → BRINGUP → REVISION`.

Some gates are strict invariants (you literally cannot enter LAYOUT before the BOM is frozen; advancing into REVISION freezes the rev and its active Build atomically). Others are existence checks that will tighten in Phase 2 once KiCad parsing and distributor-API integration ship.

## Domain model (one-screen summary)

- **Project** — top-level container. Has a slug, optional `repoUrl` (the external KiCad repo, see below).
- **Revision** — a specific rev of a project (`v1`, `v1.1`, `rev A`). Carries `currentStage`, `bomFrozenAt`, `frozenAt`, `schematicCommit`, `layoutCommit`. Has 0..N Builds.
- **Build** — a fabrication run of N boards for a Revision (`BUILD-001`, etc.). Phase 1 enforces **at most one unfrozen Build per Revision** via a partial unique index. Carries distributor refs and lifecycle dates.
- **Board** — one physical board (`B01`..`Bn`). Has `silkscreenHash` (the git SHA printed on the PCB silkscreen) and a status enum: `BARE → SCREENED → ASSEMBLED → POWERED → BROUGHT_UP` (plus `FAILED`, `QUARANTINED`).
- **Artifact** — polymorphic (FILE / NOTE / LINK) with typed `subkind` (PCB_ORDER, BRINGUP_LOG, BRINGUP_COMPLETE, …). Scoped to a Revision XOR a Build (XOR enforced by a raw CHECK).
- **Checklist + ChecklistItem** — structured execution records with typed `subkind` (EQUIPMENT_PREFLIGHT, SCREENING_STEP_0, POST_ASSEMBLY_CONTINUITY, …). Scoped to a Build XOR a Board.
- **Measurement** — per-Board DMM/scope reading (step, expected, actual, unit, result).
- **Part** — global parts library, keyed by `(manufacturer, mpn)`. Shared across projects — the same MCP73831 entry serves every project that uses it.
- **BomLine** — per-Revision link Revision → Part with refdes + quantity.
- **Erratum** — defect captured against a Revision; optional forward link to the Revision that addresses it. Errata are the only post-freeze write path.

## Relationship to external KiCad repos

The foundry **does not** hold KiCad project files. Each hardware project lives in its own external git repo (one repo per Project) — schematics, layouts, Gerbers, BOMs, bench docs all live there. The foundry stores:

- `Project.repoUrl` — pointer to the external KiCad repo.
- `Revision.schematicCommit` — git SHA of the commit where the schematic was pinned.
- `Revision.layoutCommit` — git SHA of the commit where the layout was pinned.
- `Board.silkscreenHash` — the git SHA printed on the physical PCB silkscreen, captured at screening.

So the foundry tracks **workflow, state, and audit**; the external repo tracks **design files and version history**. There is no enforced structure for the external repos. The `TB-1-POWER` bench docs that motivated v4 of the design doc are a reasonable convention (a `docs/bench/` folder with per-phase checklists, an `ASSEMBLY-NOTES.md`, a `BOM.csv`, an `ECN.md`), but the foundry doesn't read or parse any of that in Phase 1.

## For collaborators (including AI agents)

If you are reading this repo to understand the system rather than to operate it:

1. **Source of truth for design decisions** lives in [docs/plans/](docs/plans/), specifically:
   - [2026-05-27-design-foundry-phase1-design.md](docs/plans/2026-05-27-design-foundry-phase1-design.md) — v6 Phase 1 design doc (~30K words; four validation passes baked in).
   - [2026-05-28-design-foundry-phase1-implementation.md](docs/plans/2026-05-28-design-foundry-phase1-implementation.md) — bite-sized implementation plan, one task per commit.
2. **Source of truth for current behaviour** is the code under `src/` and `prisma/`. The design doc describes intent; if the code disagrees with the doc, the code wins until the doc is updated.
3. **Don't fork or derive.** Per LICENSE.md you may read and cite the code; you may not copy any portion into another project.
4. **Don't train models on this repo.** The license explicitly prohibits use as ML training data.
5. **You cannot run live tests against the production database.** Tests run against a Neon test branch keyed by `NEON_TEST_DATABASE_URL` in CI; local dev points at the user's dev Neon branch via `.env.local`.

If you are creating a new hardware project to be tracked by the foundry: spin up a fresh git repo for the KiCad files, then register it in the foundry by visiting `/projects/new` and pasting the repo URL. No CLI / API hook for project registration exists in Phase 1 — the web UI is the only entry point.

## Tech stack

- Next.js 16 (App Router) + TypeScript 5 + React 19
- Prisma 7 + Neon Postgres (pooled `DATABASE_URL` runtime + direct `DIRECT_URL` for migrations) via `@prisma/adapter-neon`
- Auth.js v5 + Google OIDC + JWT sessions + email allowlist
- Tailwind v4 + shadcn/ui (One Thousand Drones brand — dark, command-gold accent, Bebas Neue + Space Mono + Lora type stack)
- `sanitize-html` for note-body sanitization
- Vitest for tests (228 tests across 36 files at `phase-1-complete`)
- Vercel for hosting; auto-deploy on push to `main`
- Cloudflare R2 for file artifacts (deferred — see Phase 2 below)

## Production deployment

- **Host:** Vercel (auto-deploys on push to `main`).
- **DB:** Neon Postgres (single project; one branch is prod, PR previews can spin per-branch databases).
- **Domain:** `foundry.onethousanddrones.com` (CNAME → `cname.vercel-dns.com` at Porkbun; specific record overrides the wildcard parking redirect).
- **Auth:** Google OAuth client (web type); redirect URIs registered for both localhost and the prod host.
- **Build:** `prisma generate && next build` (the `prisma generate` step is load-bearing — Vercel's clean install needs it to populate `@prisma/client` types before the TypeScript pass).

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

The seed produces a demoable fixture: `ESP32 sensor breakout` at v1 / BRINGUP, BUILD-001 with 5 ASSEMBLED boards (B01..B05), 6 sample measurements on B01, a `BRINGUP_LOG` and seed-injected `BRINGUP_COMPLETE` artifact (so the BRINGUP → REVISION advance demo works end-to-end before the user creates real data).

## Tests

```bash
pnpm vitest run
```

Tests hit a real Postgres (the same Neon DB referenced by `.env.local` in dev). Negative-insert tests for the five raw-migration CHECK constraints + four raw-migration unique indexes are part of the suite — if `prisma migrate deploy` drops a constraint, the corresponding test fails.

## Phase 1 milestones

All tagged in this repo:

`M2a` schema + CHECKs + indexes · `M2b` seed · `M3-deferred` auth code (live sign-in verified in production) · `M4` projects · `M5a` revisions + BOM + parts · `M5b` builds · `M6` stage tracker (read-only) · `M7` advance/regress with enforcement · `M8a` artifacts (note + link) + mark-bringup-complete · `M8c` errata · `M9a` boards · `M9b` checklists · `M9c` measurements · `M10` polish · `phase-1-complete`

`M8b` (file artifacts via R2) is deferred to Phase 2.

## Phase 2 candidates

- **M8b — File artifacts via R2.** Presigned PUT/GET, server `HEAD`-after-PUT for size verification, no inline R2 deletion (orphan-sweep deferred).
- **Distributor API integration.** Digi-Key / Mouser / LCSC stock + lifecycle lookups, price snapshots on the BOM page.
- **KiCad ERC/DRC parsing.** Tighten the SCHEMATIC and LAYOUT existence gates into strict-verified gates by ingesting the actual ERC/DRC outputs.
- **Checklist templates.** Wire to stage transitions so e.g. registering a new Board auto-creates a `SCREENING_STEP_0` checklist with the canonical items.
- **Cross-board / cross-build measurement views.** "All VBUS-GND readings across BUILD-001 boards" or across builds.
- **Doc-erratum model.** Structured corrections to bench procedures (the TB-1-POWER bench docs already contain inline corrections — that pattern is the canonical motivator).
- **Multi-Build per Revision UX.** Schema permits 0..N Builds per Revision; Phase 1 enforces ≤1 unfrozen Build via a partial unique index. The UX for managing multiple Builds simultaneously is deferred.
- **Static-site export.** Bench-console-style HTML export for offline use during bring-up where lab WiFi is unreliable.
