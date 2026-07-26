---
name: adding-parts
description: >-
  How to add parts to the OTD Academy parts library and wire a board's BOM, the
  proven way. Use when creating a Part, adding/sourcing parts for a board, importing
  a bom.csv, materializing a DESIGN_VALIDATION checklist, writing BOM lines, or when
  the user asks to "add a part", "create parts", "source the BOM", "import the BOM",
  "create the revision", or work a board toward part-ready / BOM-frozen. Codified from
  the l1-03-ws2812-node pipeline run (2026-06-18). Pairs with the Recursive Board-Design
  Validation Protocol at docs/boards/_protocol.md (which gates part creation) — read that
  FIRST.
---

# Adding parts + wiring a board BOM

The library is global, but **`.env.local` `DATABASE_URL` is LOCAL** (`foundry_dev`) — it
has been since 2026-07-15, and it used to be PROD. So a bare `pnpm exec tsx` run of any
script here writes **local**, not the live library. To write the real PROD library, run
the script through **`pnpm db:prod <script.ts>`**, which swaps the env, prints the target
host, and makes you type `prod` to continue.

Adding parts and BOM lines is a **direct-Prisma seed-script** job, not a UI job — the
server actions can't be driven headlessly. This skill is the proven sequence; the three
committed scripts under `scripts/` are working templates — copy them, don't reinvent.

## Gate first (do not skip)

A board is **not part-ready** until its `design.md` passes the Recursive Board-Design
Validation Protocol — **`docs/boards/_protocol.md`**, in this repo (≥10 passes + a
design-stage DRY pass). **Read that file and confirm the gate before creating any part.**
Creating parts/BOM/revision before the gate is the one thing this whole system exists to
prevent.

There is also a `board-design-validation` skill, but it ships in the **`otd-skills`
plugin** (`Otd-llc/otd-skills`), not in this repo — so it is absent unless that plugin is
installed. Its own first instruction is to read `docs/boards/_protocol.md`, which is the
source of truth either way. **Cite the path, not the skill**: an agent told to read a
skill it cannot find will most naturally proceed without the gate.

## Why a script, not the admin UI (friction F9)

`createPart` / `importBomCsv` / `materializeCanonicalChecklist` / `advanceStage` are
**`"use server"` actions guarded by `requireAdmin()` + `revalidatePath()`** — they need a
real session + Next request context, so they **cannot be called from a `tsx` script**.
Bulk writes therefore use **direct-Prisma seed scripts** (see [[foundry-headless-scripting]]).
Faithfully replicate the action's logic; don't bypass its *guards' intent* (freeze, gates).

## The contract (`createPart`, from `src/lib/schemas/part.ts` + `actions/parts.ts`)

- **Required:** `manufacturer`, `mpn`, `description` (each ≥ 1 char). All else optional.
- **Strict-match key = `(manufacturer, mpn)`, EXACT + case-sensitive** (DB `@@unique` +
  pre-check). **This is the same key the BOM CSV import matches on** — so the strings you
  create MUST equal the `bom.csv` rows **byte-for-byte** (mind `Würth Elektronik` ü,
  `Samsung Electro-Mechanics` not "Samsung", `TE Connectivity`). A stray space / wrong case
  = a silent BOM-import miss later. **This is the #1 gotcha.**
- `createdById` is **required** (FK to User, `onDelete: Restrict`) — there's no system user;
  **borrow an existing part's creator**: `db.part.findFirst({ select: { createdById: true } })`.
- `lifecycle` defaults **ACTIVE** (WS3/WS4 EOL checks key off it — leave it ACTIVE).
- `category` (legacy enum) / `categoryId` (tree) / `footprint` / `kicadSymbol` / `kicadFootprint`
  / `datasheetUrl` / `notes` — **optional.** Defer KiCad symbol/footprint: the pad-by-pad
  footprint↔pinout cross-check is the **schematic-stage `[S]` audit**, not part creation.

### Category-tree gap (friction F10)

The category tree currently has **only the 6 migrated legacy-enum leaves** (`USB_CONNECTOR`,
`USB_UART_IC`, `LDO_REGULATOR`, `RF_MODULE`, `MLCC_CAPACITOR`, `PASSIVE_RESISTOR`). Most real
parts (LEDs, diodes/TVS/ESD, terminal blocks, electrolytics, logic buffers) have **no leaf**
→ they land **uncategorized**. Don't fake a category; set the legacy enum only where a token
genuinely fits (e.g. an MLCC), leave the rest null, and **flag it** as a follow-up. Doesn't
block BOM import (category is optional).

## The proven sequence (templates in `scripts/`)

1. **Create the parts** — `scripts/seed-l103-parts.ts`. Idempotent `upsert` on
   `manufacturer_mpn`, `update: {}` (never clobber). One object per part with the exact
   strings. Run: `pnpm exec tsx scripts/seed-l103-parts.ts` (PowerShell, not Bash — `pnpm`
   is PS-only).
2. **Verify import-readiness BEFORE importing** — `scripts/_verify-l103-bom-match.ts`
   (gitignored scratch). Parse `bom.csv` with the project's **own** `parseBomCsv` (so you get
   the real importer's parsing + intra-file-dup guard), then `findUnique` each
   `(manufacturer, mpn)` and assert `refDes.split(",").length === quantity`. Expect
   `0 unmatched, 0 refDes/qty mismatch, 0 parse errors`.
3. **Materialize DESIGN_VALIDATION + write BOM lines** — `scripts/build-l103-revision-bom.ts`.
   Replicates `materializeCanonicalChecklist` (revision branch: `CANONICAL_TEMPLATES.DESIGN_VALIDATION`,
   `items = template.items + conditionalItems filtered by project flags`) and the BOM write
   (`deleteMany` then `createMany` from parsed rows, incl. `unitPriceCents`/alt fields).
   **Freeze-guarded + idempotent.**
4. **Record attestations** (only if the owner authorizes, and only the evidenced items) —
   `scripts/attest-l103-dv.ts`. The DV items are **honest human attestations**; check only
   those the `validation-log.md` evidences, and leave footprint↔pinout + fab-DRU **owed**
   (they're `[S]`/`[L]`-stage — F7). `completedById` = the owner.
5. **Report board-readiness** — `boardReadinessFromRows` (WS4). `ready` needs Design-validated
   (ALL DV items checked/N-A) + BOM-frozen + parts + no-EOL. Until schematic/layout, it's
   correctly `false`.

## Freeze + stage advance — handle with care

- **The BOM freeze is a side-effect of advancing INTO `LAYOUT`** (`advanceStage` raw-SQL sets
  `bomFrozenAt = NOW()`). `STAGE_ORDER = REQUIREMENTS → BOM_SOURCING → SCHEMATIC → LAYOUT → …`.
  **Hold before freeze unless explicitly told to freeze.** Every script here guards on
  `bomFrozenAt` and refuses to touch a frozen BOM.
- **Advancing a stage runs REAL gates** — don't bypass them. The REQUIREMENTS exit gate needs a
  **stage-tagged requirements artifact** (L1 skips the REQUIREMENTS_REVIEW checklist but still
  needs the artifact), AND a **cross-project DAG check** (`checkProjectDependencies`). Evaluate
  them read-only (reuse `loadGateContext` + `STAGES[stage].exitGate` + `checkProjectDependencies`,
  passing `db`); if blocked, **report the reasons — don't force the raw UPDATE** (friction F11:
  l1-03 parked at REQUIREMENTS because its prereq l1-01 hadn't reached BRINGUP).

## Script boilerplate (every seed script)

```ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });          // LOCAL foundry_dev — order matters: env BEFORE the db import
async function main() {
  const { db } = await import("@/lib/db"); // dynamic import AFTER env load
  // ... reads/writes; upsert on manufacturer_mpn; idempotent ...
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
// Run via PowerShell (Bash `pnpm` = command not found):
//   LOCAL: pnpm exec tsx scripts/<name>.ts
//   PROD:  pnpm db:prod scripts/<name>.ts
```

## Guardrails

- **Know which database you are writing.** A bare `pnpm exec tsx` run writes **LOCAL**
  `foundry_dev`; only `pnpm db:prod <script.ts>` writes the production library. Parts
  seeded to local while you believe they went to prod fail silently — the scripts are
  idempotent and exit 0, and the gap surfaces only when the public catalog or a
  learner-facing BOM turns up empty. When you *do* write prod, never run the vitest suite
  concurrently (it corrupts the `esp32-sensor-breakout` fixture; `pnpm db:seed` restores).
  See [[test-seed-fixture]].
- Commit the create/build/attest scripts (idempotent, reproducible, audit trail); keep
  throwaway probes as `scripts/_*.ts` (gitignored).
- Datasheet URLs must be real `http(s)` — leave null rather than guess a wrong URL.
