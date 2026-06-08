# One Thousand Drones Academy

> **License:** All rights reserved. See [LICENSE.md](LICENSE.md). This repo is public for transparency and reference; the code is **not** licensed for use, fork, or derivative work by anyone other than the copyright holder.

**Production:** https://academy.onethousanddrones.com (Google sign-in, allowlisted users only).

A personal web app for managing hardware engineering projects — primarily ESP32-based PCB designs — through a structured 9-stage workflow from requirements through revision, with an opinionated **curriculum** of teaching boards and per-project **build guides**.

Internal tool for two users. Not a product.

## What it does

Tracks PCB hardware projects through nine workflow stages with first-class state, server-enforced gates, and an append-only audit trail. Models Builds (fabrication runs), Boards (per-unit), Checklists (typed; revision-, build-, or board-scoped), and Measurements (per-board DMM/scope readings) so the bench-execution workflow is structurally tied to the design workflow.

The 9 stages: `REQUIREMENTS → SCHEMATIC → BOM_SOURCING → LAYOUT → DRC_GERBER → ORDERING → ASSEMBLY → BRINGUP → REVISION`.

Some gates are strict invariants (you literally cannot enter LAYOUT before the BOM is frozen; advancing into REVISION freezes the rev and its active Build atomically). Others are existence checks that will tighten in Phase 2 once KiCad parsing and distributor-API integration ship.

On top of the workflow engine sit two curriculum layers:

- **Curriculum DAG** — projects carry curriculum metadata (`track`, `level`, `criticalPath`, `disciplineTaught`, `requiresStripboard`, `hasMainsNet`) and are wired into a dependency graph via `ProjectDependency` edges (`DE_RISK` / `FOUNDATION` / `SHARED_BLOCK`). A per-advance dependency gate blocks a project from advancing while its prerequisites haven't reached the required stage, and an advisory-locked cycle-check keeps the graph acyclic on edge insert. The graph is visualized at `/curriculum`. The seeded ESP32 curriculum is 22 projects / 33 edges (16 boards across SENSE/ACT/POWER/COMMS tracks + 6 bench tools).
- **Learner guides** — each revision can carry a `Guide` of per-stage `GuideCard`s (one card per `REQUIREMENTS → BRINGUP` stage) that walk a learner through *building* that board: teaching content as typed JSON blocks (prose, callouts, steps, tables, glossary terms) plus a uniform "stage-gate" footer. Guides are composed from templates (per-stage skeletons + per-track overlays + per-project safety gotchas) and materialized per revision. **Authoritative-done:** a card's completion verdict is always computed from the *real* stage exit-gate — never the card's own content — so a guide can never show "done" while the underlying gate is still closed. Served at `/projects/[slug]/[revLabel]/guide`.

## Domain model (one-screen summary)

- **Project** — top-level container. Has a slug, optional `repoUrl` (the external KiCad repo, see below), and curriculum fields: `track` (SENSE/ACT/POWER/COMMS), `level` (L1/L2/L3, null for bench tools), `criticalPath`, `disciplineTaught`, `requiresStripboard`, `hasMainsNet`.
- **ProjectDependency** — a directed curriculum edge (`dependent → dependsOn`) with a `kind` (DE_RISK / FOUNDATION / SHARED_BLOCK) and the stages it gates on. Unique on `(dependentProjectId, dependsOnProjectId, dependentStageGated)`.
- **Revision** — a specific rev of a project (`v1`, `v1.1`, `rev A`). Carries `currentStage`, `bomFrozenAt`, `frozenAt`, `schematicCommit`, `layoutCommit`. Has 0..N Builds.
- **Build** — a fabrication run of N boards for a Revision (`BUILD-001`, etc.). Phase 1 enforces **at most one unfrozen Build per Revision** via a partial unique index. Carries distributor refs and lifecycle dates.
- **Board** — one physical board (`B01`..`Bn`). Has `silkscreenHash` (the git SHA printed on the PCB silkscreen) and a status enum: `BARE → SCREENED → ASSEMBLED → POWERED → BROUGHT_UP` (plus `FAILED`, `QUARANTINED`).
- **Artifact** — polymorphic (FILE / NOTE / LINK) with typed `subkind` (PCB_ORDER, BRINGUP_LOG, BRINGUP_COMPLETE, …). Scoped to a Revision XOR a Build (XOR enforced by a raw CHECK).
- **Checklist + ChecklistItem** — structured execution records with typed `subkind`. Scoped to a **Revision XOR Build XOR Board** (3-way XOR). Canonical templates (`REQUIREMENTS_REVIEW`, `LAYOUT_REVIEW`, `STRIPBOARD_VALIDATION`, `POST_ASSEMBLY_CONTINUITY`) materialize a stage's review items in one click and are consumed by the matching stage exit-gate.
- **Guide + GuideCard** — revision-scoped teaching layer (one Guide per Revision). Each `GuideCard` is stage-tagged, ordered, and holds `contentBlocks` (Zod-validated JSON) + an optional `completionRef` (which existing checklist/measurement/artifact/board state backs its gate). The guide adds no new gate logic — it reuses the stage gates and the checklist/measurement substrate.
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

So the foundry tracks **workflow, state, audit, curriculum, and guides**; the external repo tracks **design files and version history**. There is no enforced structure for the external repos. The `TB-1-POWER` bench docs that motivated v4 of the design doc are a reasonable convention (a `docs/bench/` folder with per-phase checklists, an `ASSEMBLY-NOTES.md`, a `BOM.csv`, an `ECN.md`), and they are the reference aesthetic the in-app learner guides were modeled on — but the foundry doesn't read or parse any of that.

## For collaborators (including AI agents)

If you are reading this repo to understand the system rather than to operate it:

1. **Source of truth for design decisions** lives in [docs/plans/](docs/plans/), specifically:
   - [2026-05-27-design-foundry-phase1-design.md](docs/plans/2026-05-27-design-foundry-phase1-design.md) — Phase 1 design doc (~30K words; four validation passes baked in).
   - [2026-05-28-design-foundry-phase1-implementation.md](docs/plans/2026-05-28-design-foundry-phase1-implementation.md) — Phase 1 bite-sized implementation plan, one task per commit.
   - [2026-06-01-curriculum-foundry-updates.md](docs/plans/2026-06-01-curriculum-foundry-updates.md) + [2026-06-02-curriculum-wave2-implementation.md](docs/plans/2026-06-02-curriculum-wave2-implementation.md) — the curriculum metadata, `ProjectDependency` DAG, cycle-check, and canonical checklist templates.
   - [2026-06-02-learner-guide-system-design.md](docs/plans/2026-06-02-learner-guide-system-design.md) + [2026-06-02-learner-guide-system-implementation.md](docs/plans/2026-06-02-learner-guide-system-implementation.md) — the learner-guide system (validated against the codebase before build).
2. **Source of truth for current behaviour** is the code under `src/` and `prisma/`. The design doc describes intent; if the code disagrees with the doc, the code wins until the doc is updated.
3. **Don't fork or derive.** Per LICENSE.md you may read and cite the code; you may not copy any portion into another project.
4. **Don't train models on this repo.** The license explicitly prohibits use as ML training data.
5. **You cannot run live tests against the production database.** Tests run against a Neon test branch in CI; local dev points at the user's dev Neon branch via `.env.local`.

If you are creating a new hardware project to be tracked by the foundry: spin up a fresh git repo for the KiCad files, then register it in the foundry by visiting `/projects/new` and pasting the repo URL. The web UI is the only entry point for project registration.

## Tech stack

- Next.js 16 (App Router) + TypeScript 5 + React 19
- Prisma 7 + Neon Postgres (pooled `DATABASE_URL` runtime + direct `DIRECT_URL` for migrations) via `@prisma/adapter-neon`
- Auth.js v5 + Google OIDC + JWT sessions + email allowlist
- Tailwind v4 (CSS-first `@theme`, no JS config) — hand-rolled components, **no** component framework; Radix UI primitives (`react-tooltip`, `react-popover`) for the accessible tooltip/glossary. One Thousand Drones brand: dark + command-gold accent, Bebas Neue + Space Mono + Lora type stack, inline SVG icon set in `src/components/icons.tsx`.
- `sanitize-html` for note-body / guide-prose sanitization
- Vitest for tests (399 tests across 58 files on `main`)
- Vercel for hosting; auto-deploy on push to `main`
- Cloudflare R2 for file artifacts (deferred — see Phase 2 below)

## Production deployment

- **Host:** Vercel (auto-deploys on push to `main`).
- **DB:** Neon Postgres (single project; one branch is prod, PR previews can spin per-branch databases).
- **Domain:** `academy.onethousanddrones.com` is the primary host (CNAME → `cname.vercel-dns.com` at Porkbun; specific record overrides the wildcard parking redirect). The legacy `foundry.onethousanddrones.com` host 301-redirects to `academy.` at the Vercel domain level.
- **Auth:** Google OAuth client (web type); redirect URIs registered for both localhost and the prod host.
- **Build:** `prisma generate && next build` (the `prisma generate` step is load-bearing — Vercel's clean install needs it to populate `@prisma/client` types before the TypeScript pass).

## Local development

Requires Node 20+ and pnpm 11+.

```bash
pnpm install
cp .env.local.example .env.local   # then fill in real values
pnpm prisma migrate deploy
pnpm db:seed                                          # demo fixture (ESP32 sensor breakout)
pnpm exec tsx scripts/populate-curriculum-dag.ts      # the 22-project curriculum + 33 edges
pnpm exec tsx scripts/materialize-curriculum-guides.ts # a guide (8 cards) per curriculum revision
pnpm dev
```

Open http://localhost:3000.

`pnpm db:seed` produces a demoable fixture: `ESP32 sensor breakout` at v1 / BRINGUP, BUILD-001 with 5 ASSEMBLED boards (B01..B05), 6 sample measurements on B01, a `BRINGUP_LOG` and seed-injected `BRINGUP_COMPLETE` artifact (so the BRINGUP → REVISION advance demo works end-to-end). The two `scripts/*.ts` populators are idempotent one-offs that add the curriculum projects/edges and their guides; they write via Prisma directly (the server-action layer can't be driven headlessly — it needs an Auth.js request context).

## Tests

```bash
pnpm exec vitest run
```

Tests hit a real Postgres (the same Neon DB referenced by `.env.local` in dev) and run files sequentially (Serializable-transaction contention in the action layer collides under parallel workers). Negative-insert tests for the raw-migration CHECK constraints + unique indexes are part of the suite — if `prisma migrate deploy` drops a constraint, the corresponding test fails.

## Milestones

Phase 1 (tagged): `M2a` schema + CHECKs + indexes · `M2b` seed · `M3` auth · `M4` projects · `M5a` revisions + BOM + parts · `M5b` builds · `M6` stage tracker · `M7` advance/regress enforcement · `M8a` artifacts + mark-bringup-complete · `M8c` errata · `M9a` boards · `M9b` checklists · `M9c` measurements · `M10` polish · `phase-1-complete`.

Since Phase 1: the **curriculum layer** (curriculum metadata, `ProjectDependency` DAG + per-advance dependency gate + cycle-check, `/curriculum` view, canonical checklist templates, stripboard-validation gate) and the **learner-guide system** (Guide/GuideCard, composer + templates, `/guide` hub + cards, authoritative-done completion), shipped alongside a UI pass (app shell header/footer, favicon, a bench-styled `PageHeader`, an accessible Radix tooltip/glossary, and an app-wide single-source icon set).

## Phase 2 candidates

- **M8b — File artifacts via R2.** Presigned PUT/GET, server `HEAD`-after-PUT for size verification, no inline R2 deletion (orphan-sweep deferred).
- **Distributor API integration.** Digi-Key / Mouser / LCSC stock + lifecycle lookups, price snapshots on the BOM page.
- **KiCad ERC/DRC parsing.** Tighten the SCHEMATIC and LAYOUT existence gates into strict-verified gates by ingesting the actual ERC/DRC outputs.
- **Doc-erratum / richer guide authoring.** Structured corrections to bench procedures and an in-app guide-card editor (the learner-guide system lays the groundwork; per-revision card editing + annotation is the next step).
- **Cross-board / cross-build measurement views.** "All VBUS-GND readings across BUILD-001 boards" or across builds.
- **Multi-Build per Revision UX.** Schema permits 0..N Builds per Revision; Phase 1 enforces ≤1 unfrozen Build via a partial unique index. The UX for managing multiple Builds simultaneously is deferred.
- **Multi-tenancy.** Currently single-tenant (one Auth.js allowlist, one shared DB, writes attributed to one user). Opening the curriculum + guides to outside learners would need per-user data isolation and org/role support.
- **Static-site export.** Bench-console-style HTML export of a guide for offline use during bring-up where lab WiFi is unreliable.
