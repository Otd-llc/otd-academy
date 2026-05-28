# Project Foundry — Phase 1 Design (v6)

**Date:** 2026-05-27
**Status:** Draft v6 — incorporates four validation passes
**Authors:** Raven + Claude

A diff summary against v5 is in the appendix.

## 1. Overview

Project Foundry is a personal web app for managing hardware engineering projects — primarily ESP32-based PCB designs — through a structured **9-stage** workflow from requirements through revision. Internal tool for two users (Raven and a partner learning EE), not a product.

**Organizing principle:** stages are first-class state; gate logic is evaluated server-side. Some gates are strict invariants — most notably, **once the BOM_SOURCING gate passes, the BOM is frozen and cannot be edited without an explicit regress** — and others are existence checks that will tighten as Phase 2 ships KiCad parsing and distributor-API integration. §2 marks which is which. `STRICT*` gates are confirmation-required: the system enforces the existence of a user-asserted artifact or structured-data condition, but does not (in Phase 1) verify the underlying physical work.

**Builds and Boards are first-class, but multi-Build-per-Revision is Phase 2.** A Revision has 0-N Builds in the schema; Phase 1 enforces **at most one unfrozen Build per Revision** via a partial unique index and a Zod refinement on `createBuild`. The active Build is therefore the single unfrozen Build, if any (zero or one).

The goal is to make the EE workflow safer (frozen BOM before layout; explicit confirmation before irreversible freeze; per-board pass/fail tracking before power-on) and faster (a global parts library; structured per-board measurements; cross-build comparison later).

This document describes the **Phase 1 spine**. Deferred features are listed in §11.

## 2. The 9-stage workflow

Each stage's gate is the condition required to **leave** that stage. Gates are marked STRICT (system-verified invariant), STRICT* (confirmation-required: structured presence enforced, underlying truth not verified), or EXISTENCE (file/note presence; will tighten in Phase 2). Side-effects fire on successful advance.

| # | Stage           | Purpose                                                                              | Exit gate                                                                                            | Type        | Side-effect on advance        |
|---|-----------------|--------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|-------------|-------------------------------|
| 1 | `REQUIREMENTS`  | Interfaces, power budget, mechanical constraints, target cost.                       | Requirements artifact present.                                                                       | EXISTENCE   | —                             |
| 2 | `SCHEMATIC`     | KiCad schematic capture.                                                             | Schematic artifact present; `schematicCommit` pinned.                                                | EXISTENCE   | —                             |
| 3 | `BOM_SOURCING`  | Parts picked from distributors with stock + lifecycle verified.                      | BOM non-empty; every part has datasheet URL; no `EOL`/`OBSOLETE` parts.                              | STRICT      | **`bomFrozenAt` set.**        |
| 4 | `LAYOUT`        | Placement, routing, ground pour, decoupling, controlled traces.                      | Layout artifact present; `layoutCommit` pinned.                                                      | EXISTENCE   | —                             |
| 5 | `DRC_GERBER`    | DRC report; Gerbers + 3D inspected.                                                  | `DRC_REPORT` + `GERBER_ZIP` artifacts present.                                                       | EXISTENCE   | —                             |
| 6 | `ORDERING`      | PCB fab + parts orders placed for the active Build.                                  | The active Build has `PCB_ORDER` and `PARTS_ORDER` artifact subkinds present.                        | STRICT*     | —                             |
| 7 | `ASSEMBLY`      | Screening, hand-build, post-assembly continuity check.                               | Active Build has ≥ 1 Board; every Board has `status ∈ {ASSEMBLED, POWERED, BROUGHT_UP, QUARANTINED}`; a Checklist with `subkind = POST_ASSEMBLY_CONTINUITY` exists on the Build with all items checked. | STRICT*     | —                             |
| 8 | `BRINGUP`       | Power rails, clocks, comms, features.                                                | Active Build has ≥ 1 `BRINGUP_LOG` artifact AND a `BRINGUP_COMPLETE` artifact (explicit user confirmation); every Board has `status ∈ {BROUGHT_UP, QUARANTINED}`. | STRICT*     | **`frozenAt` set on Revision AND on the active Build; revision is now immutable except for errata.** |
| 9 | `REVISION`      | Errata captured; linked to changes for next rev.                                     | Terminal — no advance.                                                                               | —           | —                             |

**Notes:**

- "Frozen BOM before layout" (§1) is realized by (a) the STRICT BOM_SOURCING gate, (b) the `bomFrozenAt` side-effect, and (c) `assertBomNotFrozen()` rejecting BomLine writes when set. To change parts, regress to BOM_SOURCING (clears `bomFrozenAt`). Re-advancing sets a new timestamp. Regressing INTO LAYOUT preserves `bomFrozenAt` (clear is keyed on `fromStage = LAYOUT`, not `toStage = LAYOUT`).
- STRICT* gates enforce *structured-data presence*, not work truth. ASSEMBLY enforces that every Board has reached at least ASSEMBLED AND that a typed post-assembly continuity Checklist is all-ticked; it does not verify the user actually ran the meter. The PCB_ORDER / PARTS_ORDER / BRINGUP_COMPLETE artifacts are similarly user-asserted.
- A `FAILED` Board status is **not** an exit condition. A FAILED board blocks ASSEMBLY and BRINGUP gates with the canonical action-oriented message: **"N board(s) FAILED — investigate and either return to ASSEMBLED (repaired) or set QUARANTINED (removed from build)."** Both gates emit this verbatim. Only QUARANTINED takes a board out of the gate's "must be done" count.
- Stages 2 and 4 each pin their own commit on the Revision (`schematicCommit`, `layoutCommit`); they don't overwrite each other. Edited via the revision-detail header strip (§9.1).
- The bench-execution Build is created inside ORDERING (see §5.3 `createBuild`), not as a DRC_GERBER side-effect.
- Errata captured in stage 9 of rev N can be linked forward to address-by-rev N+1.

## 3. Stack

| Concern        | Choice                                                                                                  |
|----------------|---------------------------------------------------------------------------------------------------------|
| Framework      | Next.js 15 (App Router) + TypeScript                                                                    |
| ORM            | Prisma 5                                                                                                |
| Database       | Neon Postgres — pooled `DATABASE_URL` (runtime) + `DIRECT_URL` (migrations)                             |
| Auth           | **Auth.js v5** (`next-auth@5`) + `@auth/prisma-adapter`; Google provider; **JWT** session strategy      |
| UI             | Tailwind CSS + shadcn/ui (`shadcn` CLI, generated to `components/ui/`)                                  |
| Hosting        | Vercel                                                                                                  |
| File storage   | Cloudflare R2 via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (region `auto`)                |
| Design files   | External per-project git repos; foundry stores URL + per-stage commit SHAs only                         |
| Server I/O     | Next.js Server Actions; **Zod** validation at every action entry                                        |

Explicitly avoided: microservices, custom auth, NoSQL, GraphQL, custom component libraries, tRPC.

### 3.1 Tooling and ops

- **Env management:** `@t3-oss/env-nextjs` + Zod; a single `env.ts` validates env vars at boot. Local: `.env.local` (gitignored). Prod: Vercel project envs. Required: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`. R2 vars (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) optional in `env.ts` until M8b; `R2_ENABLED` toggle gates FILE-kind code paths. Build detail (§9.2) and Board detail (§9.3) render fully without R2 in M5b–M8a.
- **CI:** GitHub Actions on every push runs `pnpm tsc --noEmit`, `pnpm prisma validate`, `pnpm next build`, and a Vitest job that exercises gate functions + **every raw-migration CHECK constraint AND every raw-migration unique index listed in §4.3** (one negative-insert test per CHECK; one duplicate-insert test per unique index; one concurrent-insert test for the partial unique index). PRs get Vercel previews + Neon database branches.
- **Logging / errors:** Vercel platform logs for Phase 1. Sentry/Axiom deferred.
- **Migration workflow:** `prisma migrate dev` locally; `prisma migrate deploy` in Vercel build. Raw SQL files under `prisma/migrations/<timestamp>_<name>/migration.sql`.
- **R2 SDK:** S3-compatible v3 SDK. Region `auto`. Presigned URLs enforce TTLs ≤ 900s (PUT) / ≤ 300s (GET). The server `HEAD`s every successfully PUT object and rejects (deleting + refusing to record the Artifact row) if actual size exceeds declared size. The presigned `Content-Length` condition is defense-in-depth; the HEAD check is load-bearing.
- **`next.config.js`:** `serverActions.allowedOrigins` (not under `experimental.*`) set to deployment URL(s) only.

## 4. Data model

### 4.1 Entity overview

- **User** — Auth.js v5-managed; allowlist via `ALLOWED_EMAILS`.
- **Project** — Top-level container. `slug`, `name`, `description`, `targetCost`, optional `repoUrl` (display-only), `archivedAt`, `createdBy`.
- **Revision** — A specific rev of a project. `currentStage`, `currentStageEnteredAt`, `bomFrozenAt`, `frozenAt`/`frozenBy`, `schematicCommit`, `layoutCommit`. Has 0+ Builds (Phase 1: ≤ 1 unfrozen at any time).
- **Build** — A fabrication+assembly run of N boards for a Revision. Label (e.g., `BUILD-001`), `boardCount`, distributor refs, dates, optional `frozenAt`. Has N Boards.
- **Board** — One physical board. `serial` (e.g., `B01`), optional `silkscreenHash` (git hash printed on PCB), `status` enum.
- **StageTransition** — Append-only history of stage moves on a Revision.
- **Artifact** — Polymorphic (FILE / NOTE / LINK) with typed `subkind`. Scoped to a Revision XOR a Build.
- **Checklist + ChecklistItem** — Structured execution records with typed `subkind`. Scoped to a Build XOR a Board.
- **Measurement** — Per-Board DMM/scope readings.
- **Part** — Global parts library, `(manufacturer, mpn)` composite key.
- **BomLine** — Per-revision link Revision → Part with refdes + quantity.
- **Erratum** — Defect captured against a Revision; optional forward link to the Revision that addresses it.

### 4.2 Prisma schema

```prisma
// schema.prisma — Phase 1 v6

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client { provider = "prisma-client-js" }

// ─── Auth.js v5 adapter models ─────────────────────────
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  createdAt     DateTime  @default(now())

  accounts Account[]
  sessions Session[]

  transitions             StageTransition[]
  artifacts               Artifact[]
  partsCreated            Part[]
  bomLinesCreated         BomLine[]
  projectsCreated         Project[]
  errataCreated           Erratum[]
  revisionsFrozen         Revision[]      @relation("FrozenBy")
  buildsCreated           Build[]
  checklistsCreated       Checklist[]
  checklistItemsCompleted ChecklistItem[] @relation("CompletedBy")
  measurementsTaken       Measurement[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Project + Revision ────────────────────────────────
model Project {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String?
  targetCost  Decimal?  @db.Decimal(10, 2)
  repoUrl     String?
  archivedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id], onDelete: Restrict)

  revisions Revision[]

  @@index([archivedAt])
}

model Revision {
  id                    String    @id @default(cuid())
  projectId             String
  project               Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  label                 String    // case-preserving; case-insensitive uniqueness via functional index (§4.3)
  currentStage          Stage     @default(REQUIREMENTS)
  currentStageEnteredAt DateTime  @default(now())
  bomFrozenAt           DateTime?
  frozenAt              DateTime?
  frozenById            String?
  frozenBy              User?     @relation("FrozenBy", fields: [frozenById], references: [id], onDelete: Restrict)
  schematicCommit       String?
  layoutCommit          String?
  notes                 String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  transitions     StageTransition[]
  artifacts       Artifact[]
  bomLines        BomLine[]
  builds          Build[]
  errata          Erratum[] @relation("RevisionErrata")
  addressedErrata Erratum[] @relation("AddressedByRevision")

  @@index([projectId, currentStage])
  // Raw migration: CREATE UNIQUE INDEX revision_project_label_ci ON "Revision"(projectId, lower(label));
}

// ─── Stage state machine ───────────────────────────────
enum Stage {
  REQUIREMENTS
  SCHEMATIC
  BOM_SOURCING
  LAYOUT
  DRC_GERBER
  ORDERING
  ASSEMBLY
  BRINGUP
  REVISION
}

enum TransitionDirection { INIT  ADVANCE  REGRESS }

model StageTransition {
  id             String              @id @default(cuid())
  revisionId     String
  revision       Revision            @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  fromStage      Stage?              // null for INIT
  toStage        Stage               // may skip intermediates on createBuild regress (§5.3)
  direction      TransitionDirection
  gateSnapshot   Json                // see §5.2
  notes          String?             // required when direction = REGRESS
  transitionedBy String
  user           User                @relation(fields: [transitionedBy], references: [id], onDelete: Restrict)
  transitionedAt DateTime            @default(now())

  @@index([revisionId, transitionedAt])
}

// ─── Artifacts (Revision-scoped XOR Build-scoped) ──────
enum ArtifactKind { FILE  NOTE  LINK }

enum ArtifactSubkind {
  GENERIC              // owner-agnostic (either Revision or Build)
  REQUIREMENTS_DOC     // Revision-scoped
  SCHEMATIC_FILE       // Revision-scoped
  BOM_EXPORT           // Revision-scoped
  LAYOUT_FILE          // Revision-scoped
  DRC_REPORT           // Revision-scoped
  GERBER_ZIP           // Revision-scoped
  PCB_ORDER            // Build-scoped; ORDERING gate
  PARTS_ORDER          // Build-scoped; ORDERING gate
  ASSEMBLY_PROCEDURE   // Revision-scoped template
  BENCH_PROCEDURE      // Revision-scoped template
  BRINGUP_LOG          // Build-scoped; BRINGUP gate
  BRINGUP_COMPLETE     // Build-scoped; BRINGUP gate; created via "Mark bring-up complete" button only
}

model Artifact {
  id         String          @id @default(cuid())
  revisionId String?
  revision   Revision?       @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  buildId    String?
  build      Build?          @relation(fields: [buildId], references: [id], onDelete: Cascade)
  stage      Stage           // workflow stage this artifact belongs to
  kind       ArtifactKind
  subkind    ArtifactSubkind @default(GENERIC)
  title      String
  fileKey    String?
  fileMime   String?
  fileBytes  Int?            // server-enforced ≤ 100 MB; HEAD-verified
  noteBody   String?         // markdown
  linkUrl    String?
  createdBy  String
  user       User            @relation(fields: [createdBy], references: [id], onDelete: Restrict)
  createdAt  DateTime        @default(now())

  @@index([revisionId, stage])
  @@index([buildId, stage])
  @@index([buildId, subkind])
}

// Raw migration CHECKs:
//   artifact_owner_xor: exactly one of (revisionId, buildId) is non-null.
//   artifact_kind_payload_xor: exactly one of (fileKey, noteBody, linkUrl) is non-null per kind.

// ─── Builds + Boards ───────────────────────────────────
model Build {
  id                String    @id @default(cuid())
  revisionId        String
  revision          Revision  @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  label             String    // case-preserving (e.g. "BUILD-001"); case-insensitive uniqueness via functional index
  boardCount        Int
  pcbOrderRef       String?
  partsOrderRef     String?
  orderedAt         DateTime?
  receivedAt        DateTime?
  assemblyStartedAt DateTime?
  frozenAt          DateTime? // set when parent revision freezes; freeze actor lives on Revision.frozenById
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       String
  createdBy         User      @relation(fields: [createdById], references: [id], onDelete: Restrict)

  boards     Board[]
  checklists Checklist[]
  artifacts  Artifact[]

  // Covers (a) the §9.1 Builds-pane sort `ORDER BY frozenAt NULLS FIRST, createdAt DESC`
  // and (b) the active-Build lookup `WHERE frozenAt IS NULL` (Phase 1: 0 or 1 row).
  @@index([revisionId, frozenAt, createdAt])
  // Raw migration: CREATE UNIQUE INDEX build_revision_label_ci ON "Build"(revisionId, lower(label));
  // Phase 1 invariant via raw migration:
  //   CREATE UNIQUE INDEX build_one_unfrozen_per_revision ON "Build"(revisionId) WHERE "frozenAt" IS NULL;
}

enum BoardStatus {
  BARE
  SCREENED
  ASSEMBLED
  POWERED
  BROUGHT_UP
  FAILED        // blocks gates; must be repaired (→ASSEMBLED) or QUARANTINED
  QUARANTINED   // permanently removed; passes gates as "done"
}

model Board {
  id              String      @id @default(cuid())
  buildId         String
  build           Build       @relation(fields: [buildId], references: [id], onDelete: Cascade)
  serial          String      // case-preserving (e.g. "B01"); case-insensitive uniqueness via functional index
  silkscreenHash  String?     // git hash printed on PCB; raw migration CHECK validates format if non-null
  status          BoardStatus @default(BARE)
  notes           String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  checklists   Checklist[]
  measurements Measurement[]

  @@index([buildId, status])
  // Raw migration: CREATE UNIQUE INDEX board_build_serial_ci ON "Board"(buildId, lower(serial));
}

// ─── Checklists + Items ────────────────────────────────
enum ChecklistSubkind {
  GENERIC
  EQUIPMENT_PREFLIGHT
  SCREENING_STEP_0
  ASSEMBLY_STEPS
  POST_ASSEMBLY_CONTINUITY   // ASSEMBLY gate matches on this subkind
  POLARITY_VERIFICATION
}

model Checklist {
  id          String           @id @default(cuid())
  buildId     String?
  build       Build?           @relation(fields: [buildId], references: [id], onDelete: Cascade)
  boardId     String?
  board       Board?           @relation(fields: [boardId], references: [id], onDelete: Cascade)
  stage       Stage
  subkind     ChecklistSubkind @default(GENERIC)
  title       String           // user-facing label; subkind drives gate matching
  createdAt   DateTime         @default(now())
  createdById String
  createdBy   User             @relation(fields: [createdById], references: [id], onDelete: Restrict)

  items ChecklistItem[]

  @@index([buildId, stage])
  @@index([boardId, stage])
  @@index([stage])
  @@index([buildId, subkind])
}

// Raw migration CHECK:
//   checklist_owner_xor:
//     (buildId IS NOT NULL AND boardId IS NULL) OR (buildId IS NULL AND boardId IS NOT NULL)

model ChecklistItem {
  id            String     @id @default(cuid())
  checklistId   String
  checklist     Checklist  @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  ordinal       Int
  label         String
  expectedValue String?
  actualValue   String?
  checked       Boolean    @default(false)
  completedAt   DateTime?
  completedById String?
  completedBy   User?      @relation("CompletedBy", fields: [completedById], references: [id], onDelete: Restrict)

  @@unique([checklistId, ordinal])
}

// ─── Measurements ──────────────────────────────────────
enum MeasurementResult {
  PASS
  FAIL
  OBSERVED   // recorded reading without pass/fail adjudication (e.g., "OL", "3.7 V baseline")
  PEND       // not yet measured
}

model Measurement {
  id            String            @id @default(cuid())
  boardId       String
  board         Board             @relation(fields: [boardId], references: [id], onDelete: Cascade)
  stage         Stage
  step          String
  expectedValue String?
  actualValue   String
  unit          String?
  result        MeasurementResult @default(PEND)
  notes         String?
  measuredAt    DateTime          @default(now())
  measuredById  String
  measuredBy    User              @relation(fields: [measuredById], references: [id], onDelete: Restrict)

  @@index([boardId, stage])
  @@index([boardId, step])
}

// ─── Parts library (GLOBAL) ────────────────────────────
enum PartLifecycle { ACTIVE  NRND  EOL  OBSOLETE }

model Part {
  id           String        @id @default(cuid())
  mpn          String
  manufacturer String
  description  String
  category     String?
  footprint    String?
  datasheetUrl String?
  lifecycle    PartLifecycle @default(ACTIVE)
  notes        String?       // ECN/sourcing swaps recorded here (free text)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  createdById  String
  createdBy    User          @relation(fields: [createdById], references: [id], onDelete: Restrict)

  bomLines BomLine[]

  @@unique([manufacturer, mpn])
  @@index([mpn])
  @@index([category])
  @@index([lifecycle])
}

model BomLine {
  id          String   @id @default(cuid())
  revisionId  String
  revision    Revision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  partId      String
  part        Part     @relation(fields: [partId], references: [id], onDelete: Restrict)
  refDes      String   // raw migration CHECK: array_length(string_to_array(refDes, ','), 1) = quantity
  quantity    Int
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([revisionId, partId])
  @@index([partId])
}

// ─── Errata ────────────────────────────────────────────
enum ErratumSeverity { BLOCKER  MAJOR  MINOR }
enum ErratumStatus   { OPEN  FIXED_NEXT_REV  WONT_FIX }

model Erratum {
  id                    String          @id @default(cuid())
  revisionId            String
  revision              Revision        @relation("RevisionErrata", fields: [revisionId], references: [id], onDelete: Cascade)
  title                 String
  description           String
  severity              ErratumSeverity
  status                ErratumStatus   @default(OPEN)
  addressedByRevisionId String?
  addressedBy           Revision?       @relation("AddressedByRevision", fields: [addressedByRevisionId], references: [id], onDelete: Restrict)
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  createdById           String
  createdBy             User            @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@index([revisionId, status])
  @@index([addressedByRevisionId])
}
```

### 4.3 Design decisions

- **Parts library is global**, `(manufacturer, mpn)` composite key. ECN-style sourcing swaps live in `Part.notes` (free text, Phase 1; the bench-doc example "Panasonic ERJ-2RKF2211X for BUILD-001 sourcing swap" is the prototype).
- **BOM is per-revision**, copied forward on new rev (row-clone). `assertBomNotFrozen` rejects writes when `bomFrozenAt` is non-null.
- **Case-preserving labels with case-insensitive uniqueness.** `Revision.label`, `Build.label`, `Board.serial` keep user-entered case (`v1.1`, `BUILD-001`, `B01`, `rev A`). Uniqueness enforced by **functional unique indexes** on `lower(...)` in raw migrations (Prisma can't model them directly).
- **Subkind → owner is a typed const, not prose.** Declared in `lib/artifacts.ts`:
  ```ts
  export type ArtifactOwnerKind = "revision" | "build" | "either";
  export const ARTIFACT_SUBKIND_OWNER: Readonly<Record<ArtifactSubkind, ArtifactOwnerKind>> = {
    GENERIC: "either",
    REQUIREMENTS_DOC:  "revision",
    SCHEMATIC_FILE:    "revision",
    BOM_EXPORT:        "revision",
    LAYOUT_FILE:       "revision",
    DRC_REPORT:        "revision",
    GERBER_ZIP:        "revision",
    ASSEMBLY_PROCEDURE:"revision",
    BENCH_PROCEDURE:   "revision",
    PCB_ORDER:         "build",
    PARTS_ORDER:       "build",
    BRINGUP_LOG:       "build",
    BRINGUP_COMPLETE:  "build",
  };
  ```
  Both `createUploadUrl` and `recordArtifact` consume this map. Cross-check rejects a typed subkind paired with the wrong `owner.kind`; GENERIC accepts either. The DB CHECK enforces only XOR (it can't know about subkind-owner alignment).
- **Builds and Boards are first-class. Multi-Build-per-Revision is Phase 2.** Schema permits 0-N Builds. Phase 1 enforces ≤ 1 unfrozen Build per Revision via a **partial unique index** (`CREATE UNIQUE INDEX build_one_unfrozen_per_revision ON Build(revisionId) WHERE frozenAt IS NULL`) backed by a Zod refinement in `createBuild`. This is the rare case where code intent and DB constraint agree: raw SQL attempting to insert a second unfrozen Build is rejected at the index level — not bypassable from outside the app.
- **Checklists are typed.** `ChecklistSubkind` enum carries the semantic role. ASSEMBLY gate matches on `POST_ASSEMBLY_CONTINUITY` subkind (not fuzzy title). Per-battery LiPo polarity verification is a Build-scoped Checklist with `subkind = POLARITY_VERIFICATION`, one ChecklistItem per battery.
- **Measurements are per-Board.** `MeasurementResult.OBSERVED` covers recorded-reading-without-pass/fail ("OL", "12.4 V baseline"). PEND is "row created, not yet measured."
- **Silkscreen-hash regex is a shared constant.** `SILKSCREEN_HASH_RE = /^g?[0-9a-f]{7,40}$/i` (case-insensitive). Lives in `lib/constants.ts`; consumed by the Zod schema (§9.3) and mirrored in the raw-migration CHECK on `Board.silkscreenHash`.
- **Transitions are append-only.** `gateSnapshot` versioned discriminated union (`{ v: 1, kind: "gate" | "regress" | "init", ... }`). A `StageTransition` row may span multiple stages: the `createBuild` skip-stage regress writes ONE row with `fromStage = current, toStage = ORDERING` (§5.3). UI rendering surfaces both `fromStage` and `toStage` (§9.1).
- **Audit trail:** `createdBy` on Project, Part, BomLine, Erratum, Artifact, Build, Checklist; `completedBy` on ChecklistItem; `measuredBy` on Measurement; `transitionedBy` on StageTransition; `frozenBy` on Revision. **`Build` has no `frozenById`** — the freeze actor lives on the parent Revision (joinable when needed).
- **DB-level invariants beyond what Prisma models** — **five raw-migration CHECKs + four raw-migration unique indexes** (three functional + one partial). All in versioned raw migrations; all CI-tested per §3.1.

  **CHECKs (5):**
  1. `Artifact.artifact_owner_xor` — exactly one of `(revisionId, buildId)` non-null.
  2. `Artifact.artifact_kind_payload_xor` — exactly one payload field non-null per kind.
  3. `Checklist.checklist_owner_xor` — exactly one of `(buildId, boardId)` non-null.
  4. `BomLine.bomline_refdes_count` — `array_length(string_to_array(refDes, ','), 1) = quantity`.
  5. `Board.board_silkscreen_format` — `silkscreenHash IS NULL OR silkscreenHash ~* '^g?[0-9a-f]{7,40}$'` (mirrors `SILKSCREEN_HASH_RE`).

  **Unique indexes (4):**
  1. `revision_project_label_ci` — `UNIQUE(projectId, lower(label))` on Revision.
  2. `build_revision_label_ci` — `UNIQUE(revisionId, lower(label))` on Build.
  3. `board_build_serial_ci` — `UNIQUE(buildId, lower(serial))` on Board.
  4. `build_one_unfrozen_per_revision` — `UNIQUE(revisionId) WHERE frozenAt IS NULL` on Build (Phase 1 one-unfrozen-Build invariant).

  Replacing `@@unique([projectId, label])` (etc.) at the Prisma level is intentional — the functional indexes are case-insensitive equivalents and Prisma-declared `@@unique` would create a redundant case-sensitive constraint that conflicts.
- **`Erratum.addressedByRevisionId` uses `onDelete: Restrict`** — prevents silent audit loss.
- **`Session` and `VerificationToken` tables kept but unused** under JWT + OAuth-only — reserved for future provider/strategy changes.

## 5. Stage state machine and gates

### 5.1 Approach

Stages are a **Prisma enum + a TypeScript config module**, not a database table. Rationale unchanged from v1.

### 5.2 Code shape

```ts
// lib/stages.ts
import { Stage, Artifact, ArtifactSubkind, BomLine, Part, Revision, Build, Board, Checklist, ChecklistItem, ChecklistSubkind } from "@prisma/client";

export const GATE_SNAPSHOT_VERSION = 1;

export type GateResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type GateSnapshot =
  | { v: 1; kind: "gate";    result: GateResult; ts: string }
  | { v: 1; kind: "regress"; reason: string;     ts: string }
  | { v: 1; kind: "init";                        ts: string };

export interface StageDef {
  stage: Stage;
  order: number;
  name: string;
  description: string;
  entryHints: string[];
  exitGate?: (ctx: GateContext) => GateResult | Promise<GateResult>;  // absent ⇒ terminal
  revisionAllowedArtifactSubkinds: ArtifactSubkind[];
  buildAllowedArtifactSubkinds: ArtifactSubkind[];
}

export interface GateContext {
  revision: Pick<Revision, "id" | "currentStage" | "schematicCommit" | "layoutCommit">;
  bomLines: (BomLine & { part: Part })[];
  artifacts: Artifact[];
  activeBuild: (Build & {
    boards: Board[];
    artifacts: Artifact[];
    checklists: (Checklist & { items: ChecklistItem[] })[];
  }) | null;
}

// Canonical action-oriented message used by both ASSEMBLY and BRINGUP gates when boards are FAILED.
const FAILED_BOARD_MSG = (n: number) =>
  `${n} board(s) FAILED — investigate and either return to ASSEMBLED (repaired) or set QUARANTINED (removed from build).`;

export const STAGE_ORDER: Stage[] = [
  Stage.REQUIREMENTS, Stage.SCHEMATIC, Stage.BOM_SOURCING,
  Stage.LAYOUT,       Stage.DRC_GERBER, Stage.ORDERING,
  Stage.ASSEMBLY,     Stage.BRINGUP,    Stage.REVISION,
];

// Representative entries; full table includes all nine stages.
export const STAGES: Record<Stage, StageDef> = {
  [Stage.BOM_SOURCING]: {
    stage: Stage.BOM_SOURCING, order: 3, name: "BOM sourcing",
    description: "Parts picked, stock + lifecycle verified before layout.",
    entryHints: ["Every schematic part should have an MPN.", "Verify stock and lifecycle before committing."],
    revisionAllowedArtifactSubkinds: ["BOM_EXPORT", "GENERIC"],
    buildAllowedArtifactSubkinds: [],
    exitGate: ({ bomLines }) => {
      const reasons: string[] = [];
      if (bomLines.length === 0) reasons.push("BOM is empty.");
      const noDatasheet = bomLines.filter(l => !l.part.datasheetUrl);
      if (noDatasheet.length) reasons.push(`${noDatasheet.length} part(s) missing datasheet URL.`);
      const eol = bomLines.filter(l => l.part.lifecycle === "EOL" || l.part.lifecycle === "OBSOLETE");
      if (eol.length) reasons.push(`${eol.length} part(s) are EOL or OBSOLETE.`);
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  [Stage.ORDERING]: {
    stage: Stage.ORDERING, order: 6, name: "Ordering",
    description: "PCB fab + parts orders placed for the active Build.",
    entryHints: ["Create the active Build first (label + boardCount).", "Attach PCB_ORDER + PARTS_ORDER artifacts to the Build."],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: ["PCB_ORDER", "PARTS_ORDER", "GENERIC"],
    exitGate: ({ activeBuild }) => {
      const reasons: string[] = [];
      if (!activeBuild) { reasons.push("No active Build. Create one before advancing."); return { ok: false, reasons }; }
      if (!activeBuild.artifacts.some(a => a.subkind === "PCB_ORDER")) reasons.push("Active Build has no PCB_ORDER artifact.");
      if (!activeBuild.artifacts.some(a => a.subkind === "PARTS_ORDER")) reasons.push("Active Build has no PARTS_ORDER artifact.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  [Stage.ASSEMBLY]: {
    stage: Stage.ASSEMBLY, order: 7, name: "Assembly",
    description: "Screening, hand-build, post-assembly continuity check.",
    entryHints: [
      "Register each physical Board with a serial and silkscreen hash.",
      "Use Board-scoped Checklists (subkinds SCREENING_STEP_0, ASSEMBLY_STEPS) per board.",
      "Create a Build-scoped Checklist with subkind = POST_ASSEMBLY_CONTINUITY and tick all items before advancing.",
    ],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: ["GENERIC"],
    exitGate: ({ activeBuild }) => {
      const reasons: string[] = [];
      if (!activeBuild) { reasons.push("No active Build."); return { ok: false, reasons }; }
      if (activeBuild.boards.length === 0) reasons.push("Active Build has no Board rows. Register at least one physical board.");
      const failed = activeBuild.boards.filter(b => b.status === "FAILED");
      if (failed.length) reasons.push(FAILED_BOARD_MSG(failed.length));
      const unfinished = activeBuild.boards.filter(b => !["ASSEMBLED", "POWERED", "BROUGHT_UP", "QUARANTINED"].includes(b.status));
      if (unfinished.length) reasons.push(`${unfinished.length} board(s) not yet ASSEMBLED.`);
      const continuity = activeBuild.checklists.find(c => c.subkind === "POST_ASSEMBLY_CONTINUITY");
      if (!continuity) reasons.push("No POST_ASSEMBLY_CONTINUITY Checklist on the active Build.");
      else if (continuity.items.some(i => !i.checked)) reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.");
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  [Stage.BRINGUP]: {
    stage: Stage.BRINGUP, order: 8, name: "Bring-up",
    description: "Power rails, clocks, comms, features.",
    entryHints: [
      "Power rails first. Log readings as Measurements on each Board.",
      "Click 'Mark bring-up complete' on the Build page when ready — this unlocks advance to REVISION (and freezes).",
    ],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: ["BRINGUP_LOG", "GENERIC"],
    exitGate: ({ activeBuild }) => {
      const reasons: string[] = [];
      if (!activeBuild) { reasons.push("No active Build."); return { ok: false, reasons }; }
      if (!activeBuild.artifacts.some(a => a.subkind === "BRINGUP_LOG")) reasons.push("Active Build has no BRINGUP_LOG artifact.");
      if (!activeBuild.artifacts.some(a => a.subkind === "BRINGUP_COMPLETE")) reasons.push("Bring-up not marked complete (advancing to REVISION freezes the rev).");
      const failed = activeBuild.boards.filter(b => b.status === "FAILED");
      if (failed.length) reasons.push(FAILED_BOARD_MSG(failed.length));
      const unfinished = activeBuild.boards.filter(b => !["BROUGHT_UP", "QUARANTINED"].includes(b.status));
      if (unfinished.length) reasons.push(`${unfinished.length} board(s) not yet BROUGHT_UP or QUARANTINED.`);
      return reasons.length ? { ok: false, reasons } : { ok: true };
    },
  },

  [Stage.REVISION]: {
    stage: Stage.REVISION, order: 9, name: "Revision",
    description: "Errata captured; linked to next-rev changes. Terminal.",
    entryHints: ["Log errata as they surface.", "Errata can be linked forward to the rev that addresses them."],
    revisionAllowedArtifactSubkinds: ["GENERIC"],
    buildAllowedArtifactSubkinds: [],
    // No exitGate — terminal.
  },
};
```

### 5.3 Transition rules

All transitions execute inside a Postgres transaction with **`Serializable`** isolation. Every non-erratum mutation on a Revision (or its child entities) passes through `assertNotFrozen(revisionId, tx)` at the top.

**Serializable framing:** Inside one transaction, Serializable provides snapshot consistency + SSI — no intra-transaction TOCTOU window. SSI aborts conflicting concurrent transactions with a serialization failure that the action layer retries. The conditional `WHERE currentStage=$expected` is defense-in-depth against a separate request whose transaction already committed before this one started.

**`advanceStage(revisionId, notes?)`** — server action:

1. Open tx (`Serializable`).
2. Load revision + gate context (including active Build with boards / artifacts / checklists).
3. Reject if `frozenAt` is set; reject if `currentStage === REVISION`.
4. Run `await STAGES[currentStage].exitGate?.(ctx)`. Reject with `reasons` if `!ok`.
5. **Conditional UPDATE** to defeat cross-request races:
   ```sql
   UPDATE "Revision"
   SET "currentStage" = $next, "currentStageEnteredAt" = NOW(),
       /* side-effects */
   WHERE "id" = $id AND "currentStage" = $expected
   ```
   If row count is 0, reject "stale state — another user advanced this revision; refresh."
6. Side-effects on `toStage`:
   - `LAYOUT` → `bomFrozenAt = NOW()`.
   - `REVISION` → `frozenAt = NOW()`, `frozenById = actor.id`. **Also `UPDATE Build SET frozenAt = NOW() WHERE id = $activeBuildId`** (the unique unfrozen Build, if any).
7. Insert `StageTransition` row with `gateSnapshot = { v: 1, kind: "gate", result, ts }`, `direction = ADVANCE`.
8. Commit.

**`regressStage(revisionId, reason)`** — server action; `reason` required (Zod non-empty):

1. Open tx (`Serializable`).
2. Reject if `frozenAt` set, or `currentStage === REQUIREMENTS`.
3. Conditional UPDATE to `prevStage` (same optimistic-lock pattern). `currentStageEnteredAt = NOW()`.
4. Side-effects on `fromStage`:
   - Regressing **out of** LAYOUT (`fromStage === LAYOUT && toStage === BOM_SOURCING`) → `bomFrozenAt = NULL`.
   - Regressing INTO LAYOUT preserves `bomFrozenAt`.
5. Insert `StageTransition` with `direction = REGRESS`, `notes = reason`, `gateSnapshot = { v: 1, kind: "regress", reason, ts }`.
6. Commit.

**`createBuild(revisionId, label, boardCount)`** — server action; **all four steps execute in one `Serializable` tx**:

1. Assert revision not frozen.
2. Assert `currentStage ∈ {DRC_GERBER, ORDERING, ASSEMBLY, BRINGUP}`. **Assert no other unfrozen Build exists for this Revision** (Phase 1 invariant). Per the Serializable framing above, a concurrent insert of another unfrozen Build for this Revision creates write-skew that SSI aborts; the `build_one_unfrozen_per_revision` partial unique index is the defense-in-depth backstop (raw SQL bypassing the action still hits it).
3. If `currentStage > ORDERING`, regress the revision to ORDERING. Write **one** `StageTransition` row with `fromStage = current`, `toStage = ORDERING`, `direction = REGRESS`, `notes = "New Build ${label} created"`, `gateSnapshot = { v: 1, kind: "regress", reason: "New Build ${label} created", ts }`. (Single row keeps the log clean; the UI surfaces both `fromStage` and `toStage` per §9.1.)
4. Insert the Build row. Set `Revision.currentStageEnteredAt = NOW()` if step 3 fired.

**Initialization** — at revision-create time, inside the same transaction as `Revision.create`:
- Insert `StageTransition { fromStage: null, toStage: REQUIREMENTS, direction: INIT, gateSnapshot: { v: 1, kind: "init", ts } }`.
- A **new Revision always starts at REQUIREMENTS with zero Builds**, regardless of whether it was created from scratch or via copy-forward.
- M2b seed writes `StageTransition` / Build / Board / Measurement / `Revision.currentStage` rows directly — bypasses live gates because it's bootstrapping the structures the gates require.

**Freeze enforcement** is policy in code only:

| Helper                                                  | Required at the top of                                                                                                                                                                                                                              |
|---------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `assertNotFrozen(revId)`                                | `editRevisionMetadata`, `setSchematicCommit`, `setLayoutCommit`, `createArtifact` (rev-scoped), `editArtifact`, `deleteArtifact`, `createBomLine`, `editBomLine`, `deleteBomLine`, `advanceStage`, `regressStage`, `createBuild`, `editBuild`, `createBoard`, `editBoard`, `createChecklist`, `editChecklist`, `editChecklistItem`, `createMeasurement`, `editMeasurement` |
| `assertBomNotFrozen(revId)`                             | `createBomLine`, `editBomLine`, `deleteBomLine`                                                                                                                                                                                                     |
| `assertBuildNotFrozen(buildId \| { buildId })` ¹        | `editBuild`, `createBoard`, `editBoard`, `createArtifact` (build-scoped), `editArtifact` (on build-scoped), `createChecklist` (on a Build or Board), `editChecklist`, `editChecklistItem`, `createMeasurement`, `editMeasurement`, `markBringupComplete` |

¹ `assertBuildNotFrozen` accepts either a buildId or an object with a `buildId` field (e.g., a Board pre-loaded in the action). For board-scoped operations, the action resolves `board.buildId` first and passes that. The helper throws on missing buildId.

Erratum CRUD bypasses all three — stage 9 is the post-freeze write path.

**Read/write skew on gates:** the tracker UI evaluates `exitGate(ctx)` to display blockers. Between display and click, board statuses / checklist items / artifacts can change. The server re-evaluates inside the transaction and rejects with current `reasons` if the gate now fails.

### 5.4 Freezing

- `Revision.bomFrozenAt` set automatically at `BOM_SOURCING → LAYOUT`; cleared on `LAYOUT → BOM_SOURCING` regression. Re-advancing sets a new timestamp.
- `Revision.frozenAt` set automatically at `BRINGUP → REVISION`. **Never auto-cleared.** All non-erratum mutations rejected.
- `Build.frozenAt` set in the same transaction as `Revision.frozenAt`. **Under the Phase 1 one-unfrozen-Build invariant**, exactly zero or one Build needs freezing per revision. Phase 2 multi-Build would require revisiting this rule (e.g., freeze all unfrozen Builds OR keep only-active).
- Admin `unfreeze()` not built in Phase 1; first need handled via `psql` (§12.1 trapdoors).

## 6. Auth and authorization

- **Provider:** Google OIDC via Auth.js v5. **Session strategy:** JWT.
- **Allowlist:** `ALLOWED_EMAILS` env var (comma-separated). Enforced in:
  - `signIn` callback: reject if `profile.email` not in list OR `profile.email_verified !== true`.
  - `jwt` callback: re-check email against current `ALLOWED_EMAILS`; throw to invalidate.
  - **`jwt.maxAge: 3600` (1 h)** forces hourly token refresh → hourly allowlist re-check. **`session.maxAge: 86400` (24 h)** caps absolute session lifetime. Worst-case staleness for a removed user: ~1 h.
- **Authorization:** binary. Signed-in + allowlisted = full access.
- **Route protection:** Auth.js v5 middleware. Matcher: `["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"]` — covers everything except Auth.js callbacks, the sign-in page, and Next static assets. Server actions assert session + Zod-validate input.
- **CSRF:** Next.js Server Actions' built-in origin + action-ID checks. `serverActions.allowedOrigins` set to deployment URL(s).

**Operational risks (acknowledged, accepted for Phase 1):**
- Google OIDC outage = app outage.
- `ALLOWED_EMAILS` typo = both-user lockout (mitigated by Vercel env-var preview).
- **Concurrent edits on Build/Board header fields are last-write-wins.** No optimistic lock outside `advanceStage` / `regressStage` / `createBuild` (the only actions where Serializable + conditional UPDATE matter). Two-user tool; concurrent edits to the same Build header are rare in practice.

## 7. File storage

- **Bucket:** one Cloudflare R2 bucket. Object key shape:
  - Revision-scoped: `revisions/{revisionId}/{stage}/{cuid}-{slug(filename) || "file"}`.
  - Build-scoped: `builds/{buildId}/{stage}/{cuid}-{slug(filename) || "file"}`.
  - `{stage}` is `Artifact.stage` at the moment of `createUploadUrl`, matching the eventual `Artifact` row.
- **Upload:**
  1. Client calls `createUploadUrl()` with Zod-validated `{ filename, mime, sizeBytes, owner: { kind: "revision" | "build", id }, stage, subkind }`.
  2. **Action cross-checks** `ARTIFACT_SUBKIND_OWNER[subkind]` against `owner.kind`. Rules: `"revision"`-typed subkinds require `owner.kind === "revision"`; `"build"`-typed subkinds require `owner.kind === "build"`; `"either"` (GENERIC) accepts both. Mismatch → rejected before any R2 call.
  3. Server rejects if `sizeBytes > 100 * 1024 * 1024`.
  4. Returns presigned PUT URL with `expiresIn: 900` and `Content-Length` condition.
  5. Client PUTs bytes direct to R2.
  6. Client calls `recordArtifact(uploadToken)`.
  7. **Server `HEAD`s the R2 object** to verify size. If oversize, server deletes the R2 object and rejects.
  8. Server re-runs the `ARTIFACT_SUBKIND_OWNER` check (defense-in-depth against forged tokens), then inserts the `Artifact` row.
- **Download:** `getDownloadUrl(artifactId)` returns presigned GET URL with `expiresIn: 300`.
- **Delete (Phase 1: no R2 cleanup).** Artifact-row delete and Build / Revision / Project cascade do NOT delete R2 objects. Build delete (direct or cascaded) leaves all `builds/{buildId}/...` keys as orphans. Sweep deferred to Phase 2.
- **Copy-forward on new revision:** Artifact rows row-cloned, sharing `fileKey`. R2 objects not duplicated. Build-scoped artifacts NOT copied forward.
- **In-flight upload during freeze:** PUT succeeds but `recordArtifact()` rejects via `assertNotFrozen` / `assertBuildNotFrozen`. R2 object orphaned. Accepted.
- **No proxying, no virus scanning, no MIME enforcement.**

## 8. Design system

Aesthetic anchor: One Thousand Drones brand. Technical / command-center / aerospace mood. Dark default; no light mode. Visual verification against the TB-1-POWER bench-doc HTML console at M10.

### 8.1 Color tokens (Tailwind theme extension)

Contrast computed against `deep-space` unless noted. AA target ≥ 4.5:1 for normal text, ≥ 3:1 for large/UI text.

| Token            | Hex       | Use                                                                                                  | Contrast |
|------------------|-----------|------------------------------------------------------------------------------------------------------|----------|
| `deep-space`     | `#08090D` | Page background                                                                                      | —        |
| `navy-dark`      | `#1F2438` | Cards, panels, surfaces; status-pill chip background                                                 | ~1.30:1  |
| `panel-border`   | `#3A3F50` | 1px panel border — load-bearing for surface separation                                               | ~2.0:1   |
| `command-gold`   | `#C8963E` | Active stage, primary CTAs, project / revision / build / board names, key data                       | ~7.5:1 ✓ AAA |
| `signal-blue`    | `#4A8FFF` | Free-floating links, secondary accents, data viz                                                     | ~6.3:1 ✓ AA  |
| `link-muted`     | `#C8C8C8` | Links inside gold-accented panels; always underlined                                                 | ~10.8:1 ✓ AAA |
| `white`          | `#FFFFFF` | Primary headlines                                                                                    | ~18.6:1 ✓ AAA |
| `muted`          | `#AAAAAA` | Body text on dark; future-stage outlines; BARE / SCREENED / PEND / OBSERVED / QUARANTINED pill text  | ~8.6:1 ✓ AA  |
| `alert-red`      | `#EF5350` | Gate-blocker reason text on `deep-space`; FAILED board pill text; banner backgrounds on `navy-dark` (≥14px bold required); QUARANTINED pill border (not text) | ~5.7:1 ✓ AA on `deep-space`; ~4.4:1 on `navy-dark` (large/UI only) |
| `status-green`   | `#66BB6A` | PASS measurement pill text, BROUGHT_UP board pill text                                               | ~8.4:1 ✓ AAA |

### 8.2 Typography (Google Fonts)

| Family       | Role                                                                       |
|--------------|----------------------------------------------------------------------------|
| Bebas Neue   | Page titles, project / revision / build / board names on active panels     |
| Space Mono   | UI chrome metadata: stage numbers, MPNs, refdes, costs, voltages, timestamps, gate reasons, board serials, silkscreen hashes, measurement values, pill text, banner text |
| Lora         | Note bodies, descriptions, prose                                           |

**Number rule:** UI chrome and metadata use Space Mono. Numerals in Lora prose stay Lora.

### 8.3 Layout primitives

- **4px Command Gold accent bar** on the **left edge** of active/primary panels (current stage card, current revision summary, active Build card, currently-blocked gate reason block). Other panels: 1px `panel-border`. Pills and inline content sit in the panel body and never overlap the bar.
- **Link color rule:** inside gold-accented panels, links use `link-muted` underlined. Elsewhere, `signal-blue`.
- **Status pills** sit on a `navy-dark` chip background **regardless of the parent panel's accent** — this defeats the `status-green` vs `command-gold` ~1.12:1 invisibility problem inside gold-accented panels. Pill anatomy: filled `navy-dark` chip, 1px border (color per status row below), 4px horizontal padding, Space Mono caps.

| Status                | Pill text color | Pill border        | Notes                                                                |
|-----------------------|-----------------|--------------------|----------------------------------------------------------------------|
| `BARE`                | `muted`         | `panel-border`     | Pre-screening                                                        |
| `SCREENED`            | `muted`         | `panel-border`     | Bare-board passed; not yet soldered                                  |
| `ASSEMBLED`           | `command-gold`  | `panel-border`     | In-flight                                                            |
| `POWERED`             | `command-gold`  | `panel-border`     | In-flight                                                            |
| `BROUGHT_UP`          | `status-green`  | `panel-border`     | Terminal pass                                                        |
| `FAILED`              | `alert-red`     | `panel-border`     | Filled-red text; blocks gates                                        |
| `QUARANTINED`         | `muted`         | `alert-red`        | Outlined-red border + muted text — visually distinct from FAILED's red text; semantically "removed, not actively a problem" |
| `PASS` (measurement)  | `status-green`  | `panel-border`     |                                                                      |
| `FAIL` (measurement)  | `alert-red`     | `panel-border`     |                                                                      |
| `OBSERVED`            | `muted`         | `panel-border`     | Recorded reading, no adjudication                                    |
| `PEND` (measurement)  | `muted`         | `panel-border`     | Row created, not yet measured                                        |

- **Stage tracker:** horizontal command bar, nine slots labeled `01 / REQUIREMENTS` … `09 / REVISION` in Space Mono caps.
  - **Viewport ≥ 1100px:** full labels visible.
  - **Viewport 700-1099px:** slots truncate to stage number only (`01`, `02`, …); full label appears on hover tooltip.
  - **Viewport < 700px:** the tracker band itself gets `overflow-x: auto` (band-internal horizontal scroll). The outer page does not horizontal-scroll. The tracker never wraps.
  - **Slot states:** Active = filled `command-gold` with Bebas Neue name (if width permits); Completed (`order < active`) = outlined `command-gold`; Blocked (= active with `exitGate` failure) = outlined `alert-red` with first reason inline in Space Mono; Future (`order > active`) = outlined `muted`.
- **Project / build list:** manifest-style tables; Space Mono columns; Lora descriptions; Command Gold names.

## 9. UI surfaces (Phase 1 page inventory)

| Route                                                                            | Purpose                                                                                                  |
|----------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `/sign-in`                                                                       | Google sign-in. Reject non-allowlisted / unverified.                                                     |
| `/`                                                                              | Project list. `?archived=1` shows archived.                                                              |
| `/projects/new`                                                                  | Create project form.                                                                                     |
| `/projects/[slug]`                                                               | Project detail; lists revisions; shows `repoUrl`.                                                        |
| `/projects/[slug]/revisions/new`                                                 | Create revision (copy-forward BOM + revision-scoped artifacts; no builds copied).                        |
| `/projects/[slug]/[revLabel]`                                                    | Revision detail — see §9.1.                                                                              |
| `/projects/[slug]/[revLabel]/errata/new`                                         | Create erratum.                                                                                          |
| `/projects/[slug]/[revLabel]/builds/new`                                         | Create Build (label + boardCount); regresses revision to ORDERING if past it (single transition row).    |
| `/projects/[slug]/[revLabel]/builds/[buildLabel]`                                | Build detail — see §9.2.                                                                                 |
| `/projects/[slug]/[revLabel]/builds/[buildLabel]/boards/new`                     | Register physical board (serial, optional silkscreenHash).                                               |
| `/projects/[slug]/[revLabel]/builds/[buildLabel]/boards/[serial]`                | Board detail — see §9.3.                                                                                 |
| `/parts`                                                                         | Parts library list + search.                                                                             |
| `/parts/new`                                                                     | Create part. Also reachable as modal from BOM editor.                                                    |
| `/parts/[id]`                                                                    | Part detail; lists every Revision using this part. Archived projects filtered by default; `?includeArchived=1`. |

Sign-out: server action from user-menu dropdown on every authenticated page.

### 9.1 Revision detail layout

1. **Header strip** (full-width; gold-accented if unfrozen):
   - Revision label, current stage badge.
   - Editable `schematicCommit` / `layoutCommit` (Space Mono inputs); inline-save; subject to `assertNotFrozen`.
   - Read-only `bomFrozenAt`, `frozenAt`, `frozenBy`.
2. **Stage tracker** (full-width band; nine slots per §8.3).
3. **Two-column grid:**
   - **Left (2/3), top-to-bottom in this order, equal default height, independently scrollable:**
     1. **Builds** pane: list of builds for this revision (the unfrozen Build at top if any — Phase 1: at most one — followed by frozen builds dimmed, most-recent-frozen first). Each row links to Build detail. "Create new Build" button — visible when revision is in DRC_GERBER/ORDERING/ASSEMBLY/BRINGUP, unfrozen, AND no unfrozen Build exists (matches §5.3 `createBuild` assertions).
     2. **Artifacts** pane: per-stage list of revision-scoped artifacts only, with stage selector. Add-artifact picker scoped to `STAGES[stage].revisionAllowedArtifactSubkinds`. Inline "Create new Part" modal reachable from the BomLine editor when stage is BOM_SOURCING.
   - **Right (1/3), stacked, independently scrollable:**
     - **Transitions log** (top): reverse-chrono `StageTransition` rows. Init: `"Revision created"`. Advance: `"Advanced: {fromStage} → {toStage}"`. Regress: `"{fromStage} → {toStage}: {reason}"` — explicitly renders the from→to spread so multi-stage skips (e.g., `BRINGUP → ORDERING: New Build BUILD-002 created` from `createBuild`) read naturally rather than looking like a single-step regress. Gate-pass details live in the row's gateSnapshot blob (click-to-expand for Phase 2).
     - **Errata list** (bottom): create / edit / delete; allowed post-freeze.

### 9.2 Build detail layout

1. **Header strip** (gold-accented if the Build is the active one and unfrozen):
   - Build label, boardCount, parent revision link.
   - Editable `pcbOrderRef`, `partsOrderRef`, `orderedAt`, `receivedAt`, `assemblyStartedAt`.
   - Read-only `frozenAt`.
   - **"Mark bring-up complete" button.** Visibility: parent revision at BRINGUP, this Build is active, and no `BRINGUP_COMPLETE` exists for this Build. Enabled when every Board on this Build has `status ∈ {BROUGHT_UP, QUARANTINED}`; otherwise **disabled** with a tooltip listing **up to five** blocking boards by serial, then `"…and N more"` if more exist (full list reachable via the Boards table below).
2. **Two-column grid:**
   - **Left (2/3): Boards table.** Columns: serial · silkscreenHash (Space Mono) · status pill · last-touched. Row links to board detail. "Register board" button.
   - **Right (1/3), stacked:**
     - **Build artifacts** (top): list filtered by subkind picker scoped to `STAGES[currentStage].buildAllowedArtifactSubkinds`. `BRINGUP_COMPLETE` is never in the picker.
     - **Build checklists** (bottom): list of Build-scoped Checklists with subkind tags. "New checklist" button (subkind selector in the form).

### 9.3 Board detail layout

1. **Header strip:**
   - Build label + board serial.
   - Editable `silkscreenHash` (Space Mono input; Zod-validated against `SILKSCREEN_HASH_RE` — the same shared constant the migration CHECK mirrors); status dropdown (subject to `assertBuildNotFrozen`); notes textarea.
2. **Two-column grid:**
   - **Left (2/3): Measurements log.** Grouped by stage → step. Each row: step · expected · actual · unit · result pill · when · who. "Add measurement" form supports bulk row entry (paste-and-tab from a meter): each tab-separated line becomes a row.
   - **Right (1/3): Board checklists.** List of Board-scoped Checklists with subkind tags (SCREENING_STEP_0, ASSEMBLY_STEPS, GENERIC).

### 9.4 Empty / loading / error states

- **Empty:** all list views render a one-line Space-Mono empty placeholder (`NO MEASUREMENTS AT THIS STAGE.`).
- **Loading:** server-rendered pages don't show spinners. Server actions disable the submit button and show "WORKING…" inline.
- **Error:** server-action failures surface as inline banners under the form/control. Banner text uses `alert-red` on the parent panel's `navy-dark` surface (gold accent bar does not interpose). Banner text is **Space Mono ≥14px bold** — qualifies as "large/UI" under WCAG AA (≥3:1), so the 4.4:1 contrast of `alert-red` on `navy-dark` is sufficient. Toasts only for non-blocking notifications.

## 10. Phase 1 milestones

| #    | Milestone                                  | Demoable outcome                                                                                                                          |
|------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| M1   | Repo + deploy spine + infra                | Next.js 15 + TS + Tailwind + shadcn init; Vercel; Neon DB (pooled + direct URLs); `env.ts` validates (R2 optional via `R2_ENABLED` until M8b); CI runs tsc/prisma-validate/next-build; placeholder page deploys. |
| M2a  | Schema + CHECKs + indexes + CI tests       | Prisma schema migrates clean against a fresh Neon branch, including all five raw-migration CHECKs (Artifact owner XOR, Artifact payload XOR, Checklist owner XOR, BomLine refDes count, Board silkscreen format) AND all four raw-migration unique indexes (three functional case-insensitive + the `build_one_unfrozen_per_revision` partial). Vitest negative-insert test per CHECK + duplicate-insert test per unique index + concurrent-insert test for the partial unique index — all pass. No seed yet. |
| M2b  | Seed fixture                               | Seed creates "ESP32 sensor breakout" v1 landing at BRINGUP with: full BOM, BUILD-001 (5 Boards all ASSEMBLED, B01 with sample Measurements), revision artifacts, BRINGUP_LOG on the Build, INIT + ADVANCE×7 StageTransitions, and `Revision.currentStage = BRINGUP` set directly. Seed-injected `BRINGUP_COMPLETE` artifact present so M7 can demo `BRINGUP → REVISION` end-to-end before M8a's button ships. `prisma studio` renders the data. |
| M3   | Auth wired                                 | Google OAuth + allowlist + `email_verified`; JWT with `jwt.maxAge: 3600`; `jwt` callback re-checks allowlist; route protection with the exact matcher from §6; non-allowlisted user sees clear reject screen. |
| M4   | Project CRUD                               | Create, list (default + `?archived=1`), view, edit, archive projects via server actions; Zod errors surface; `createdBy` written. |
| M5a  | Revision CRUD                              | Create revision (copy-forward BOM + revision-scoped artifacts; INIT transition + `currentStage = REQUIREMENTS` in same tx; no builds copied). View rev page (header strip + empty Builds/Artifacts panes). Inline "Create new Part" modal from BomLine editor. |
| M5b  | Build CRUD                                 | Create Build under a Revision (rejects when another unfrozen Build exists; partial unique index is the safety net). Past-ORDERING creation regresses with one StageTransition row (`fromStage = current, toStage = ORDERING`). View Build page (header strip + empty panes). |
| M6   | Stage tracker + gate display (read-only)   | The 9-stage tracker renders all four treatments (active / completed / blocked with `alert-red` + first reason / future `muted`). Overflow rule (§8.3) implemented and tested at three viewport widths. Build-aware gate reasons display correctly, including the canonical FAILED message. |
| M7   | Advance / regress with enforcement         | `advanceStage` + `regressStage` server actions with `Serializable` tx + conditional UPDATE + INIT/REGRESS transition writes. `assertNotFrozen` / `assertBomNotFrozen` / `assertBuildNotFrozen` helpers at every action listed in §5.3. `bomFrozenAt` lifecycle visible. Build freeze cascades from revision freeze. Transitions log renders `from → to` spread per §9.1. **Demo:** walk seeded rev through BRINGUP → REVISION (works because M2b seed includes `BRINGUP_COMPLETE`) and watch both Revision and active Build freeze. Manual concurrency test demonstrates conditional UPDATE rejects stale advances. |
| M8a  | Artifacts (note + link) + subkind picker + commit pinning + "Mark bring-up complete" | Per-stage artifacts; markdown notes + URL links; subkind picker scoped per stage; revision-header inline edit for commits; "Mark bring-up complete" button on Build page with disabled-when-boards-pending behavior (tooltip first 5 + "…and N more"). End-to-end flow without seed-injected BRINGUP_COMPLETE works. |
| M8b  | Artifact files (R2)                        | R2 bucket + IAM. `R2_ENABLED=true`. Presigned PUT (15 min, ≤ 100 MB, server HEAD-check after PUT) + presigned GET (5 min). `createUploadUrl` AND `recordArtifact` consume `ARTIFACT_SUBKIND_OWNER` and reject mismatches. Build/Revision-scoped key paths. No R2 cleanup on delete (orphans accepted). |
| M8c  | Errata pane                                | Errata create/list/edit/delete on revision page (allowed post-freeze); same-project constraint on `addressedByRevisionId` enforced server-side. |
| M9a  | Boards CRUD + status + silkscreen capture  | Register Board; client-side Zod validation against `SILKSCREEN_HASH_RE`; edit status + notes; status dropdown subject to `assertBuildNotFrozen`; per-build boards table renders pills per §8.3 (filled vs outlined red for FAILED vs QUARANTINED). |
| M9b  | Checklists (Build + Board, typed)          | Create Checklist with subkind selector; add / edit / reorder ChecklistItems; `completedAt`/`completedBy` stamped on tick. ASSEMBLY gate reads `POST_ASSEMBLY_CONTINUITY` Checklist by subkind. Demo creates an `EQUIPMENT_PREFLIGHT` Checklist on a Build to exercise the Build/Board XOR. |
| M9c  | Measurements (per-board)                   | Add Measurement row (step, expected, actual, unit, result — including OBSERVED); board detail renders grouped by (stage, step); bulk paste-tabbed entry supported. Cross-board/cross-build views deferred per §11. |
| M10  | Polish pass                                | Empty/loading/error states per §9.4; dashboard refinements; sign-out menu; basic responsive styling; visual verification against TB-1-POWER bench console. |

After M10, Phase 1 is complete and we re-evaluate Phase 2.

## 11. Explicitly out of scope for Phase 1

- Digi-Key / Mouser / LCSC API integration.
- KiCad file parsing.
- Background jobs / queues (including R2 orphan sweep).
- Errata cross-project propagation in the UI.
- Cost rollups / cost history.
- Photo log.
- A second auth provider (Google outage = app outage, accepted).
- Light mode.
- Mobile-first layout.
- Project-level (non-stage-scoped) artifacts.
- Multi-tenant / org concepts.
- ASSEMBLY-related KiCad-driven gates.
- An admin `unfreeze()` action.
- Inline R2 deletion on artifact / revision / build / project delete (orphans accepted).
- Dedicated error reporting service beyond Vercel platform logs.
- `PartSnapshot`-per-`BomLine`.
- **Multi-Build per Revision (UX-level).** Schema permits 0-N Builds; Phase 1 enforces ≤ 1 unfrozen Build per Revision via the partial unique index. Multi-Build flow requires a new `TransitionDirection.REBUILD` (or analogous discriminator) and UX for choosing between Builds — deferred.
- **Checklist templates** (Phase 1 creates Checklists ad-hoc).
- **Cross-board / cross-build measurement views.** A standalone `@@index([subkind])` on Checklist (for queries like "all POST_ASSEMBLY_CONTINUITY across builds") is deliberately not added in Phase 1 — that index pays off only when cross-build analytics ships.
- **Doc-erratum / procedure correction model.** Phase 1 uses freeform Checklist notes / BRINGUP_LOG markdown. **The canonical Phase 2 motivator is the kind of inline correction the TB-1-POWER bench docs already contain** (e.g., "§6.2 STEP 0d says 1 MΩ — both numbers wrong on any real meter; use 2 MΩ on the MM325").
- **Structured Build-level risk callouts** (the "Hot Plate Risks" pattern: typed callouts for no-spares warnings, safety alerts, DFM concerns, VCS gaps). Phase 1 uses `Build.notes`.
- **Per-build inventory + spares tracking.** Phase 1 uses `Build.notes`.
- **Per-Board state-transition history** (BoardTransition log).
- **Time tracking / actuals on assembly phases.**
- **Static-site export** of the foundry's bench checklists for offline use.

## 12. Open questions / known unknowns

- **Copy-forward `notes` on new rev:** default **no**.
- **Stage shortcut UX:** advance/regress one stage at a time.
- **Artifact deletion:** hard delete on non-frozen revisions/builds; DB-only.
- **Project archival vs deletion:** archive only.
- **Parts library mutability:** live edits propagate.
- **Backup / export strategy:** Neon PITR for DB. R2 has no automatic versioning. Decide nightly `pg_dump` cadence before M2b lands data we'd cry over.
- **Partner onboarding:** is per-stage `entryHints` enough? Default: ship with `entryHints`; revisit.
- **Monitoring:** Vercel platform logs only.
- **Staging vs prod:** Vercel previews + Neon DB branches per PR.
- **Seed re-runnability:** cuid IDs non-deterministic. Decide before M2b.
- **Checklist friction at real-bench scale.** BENCH-1/2/3/4 patterns × 5 boards = ~20 hand-created Checklists per Build. If first real use bites, accelerate Phase 2 templates.
- **Offline bench use during checklist execution.** Lab Wi-Fi unreliable in practice; server-backed checklists mean a dropped connection halts data entry.

### 12.1 Trapdoors and bypasses

Acceptable for two trusted users. Revisit if scope changes.

- **M2b seed** writes `StageTransition` / `Revision.currentStage` / Build / Board / Measurement fields directly — bypasses `advanceStage` and gate evaluation. Includes seed-injected `BRINGUP_COMPLETE` so M7 can demo end-to-end before M8a's button ships.
- **Future `unfreeze()`** handled via `psql` (`UPDATE Revision SET frozenAt = NULL, frozenById = NULL WHERE id = '...'` plus matching Build update). Build an admin action only on second occurrence.
- **`assertNotFrozen` / `assertBomNotFrozen` / `assertBuildNotFrozen` are policy-only.** Raw SQL can bypass.
- **Same-project errata constraint** is server-action only, not a DB CHECK.
- **`Board.status` direct field updates** have no transition log. Audit comes from `updatedAt` only. Phase 2 may add `BoardTransition` for board-level audit.
- **The one-unfrozen-Build-per-Revision invariant is NOT a trapdoor** — it's DB-backed by the `build_one_unfrozen_per_revision` partial unique index. Raw SQL attempting to insert a second unfrozen Build is rejected at the database. This is the only place in Phase 1 where code policy and DB constraint fully agree.

## Appendix: Changes from v5

**Major:**

- **Canonical subkind→owner mapping is now a typed const** (§4.3) — `ARTIFACT_SUBKIND_OWNER: Record<ArtifactSubkind, "revision" | "build" | "either">` in `lib/artifacts.ts`. GENERIC is `"either"` (owner-agnostic, accepts both Revision and Build); typed subkinds bind to one owner kind. §7 step 2 and step 8 both reference the const; M8b demo verifies the cross-check.
- **§4.3 invariant count corrected.** v5 said "six DB-level invariants" but listed five CHECKs + four indexes (9 total). v6: "**five raw-migration CHECKs + four raw-migration unique indexes** (three functional + one partial)" with the full enumeration. §3.1 CI scope updated to "every raw-migration CHECK constraint AND every raw-migration unique index listed in §4.3."
- **§8.3 QUARANTINED pill** changed from `alert-red` text + `alert-red` border (FAILED look-alike) to **`muted` text + `alert-red` border**. Visually distinct from FAILED's filled-red text; semantically "removed, not actively a problem."
- **§9.4 error banner spec.** `alert-red` text on `navy-dark` surface = 4.4:1, which fails AA normal text (4.5:1). v6 requires banner text to be **Space Mono ≥14px bold** — qualifies as large/UI under AA at 3:1 minimum. Gold accent bar does not interpose.
- **§9.2 "Mark bring-up complete" tooltip truncation.** Up to 5 blocking boards by serial, then `"…and N more"`. Full list reachable via the Boards table below the header strip.
- **§5.3 `createBuild` Serializable framing made explicit** for step 2's check-then-insert window. SSI aborts concurrent unfrozen-Build inserts; the partial unique index is the defense-in-depth backstop.
- **§9.1 Transitions log rendering spelled out.** Init / Advance / Regress lines defined; multi-stage skips (e.g., `BRINGUP → ORDERING: New Build BUILD-002 created`) render the `from → to` spread naturally rather than looking like single-step regresses.
- **§5.2 BRINGUP gate FAILED message** now uses the same `FAILED_BOARD_MSG()` helper as ASSEMBLY (verbatim match per §2's canonical wording).

**Minor:**

- §6 middleware matcher shown as exact regex: `["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"]`.
- §6 acknowledges "concurrent edits on Build/Board header fields are last-write-wins; no optimistic lock outside the gate transitions."
- §7 Build-scoped object key `{stage}` segment defined as `Artifact.stage` at upload time.
- §9.3 silkscreenHash Zod schema validates against `SILKSCREEN_HASH_RE` shared constant (the migration CHECK mirrors it; §4.3 names the constant).
- §8.3 tracker overflow rule clarified: band-internal `overflow-x: auto` below 700px; outer page does not horizontal-scroll.
- §5.4 freeze claim "exactly zero or one Build per revision" prefixed with "Under the Phase 1 one-unfrozen-Build invariant" so Phase 2 reviewers know the rule needs revisiting.
- §5.3 helper table header signature reads `assertBuildNotFrozen(buildId | { buildId })` with footnote describing the dual signature.
- §12.1 adds an explicit "this one is DB-backed, not bypassable" note for the one-unfrozen-Build-per-Revision invariant — symmetric framing alongside the policy-only freeze asserts.
- §11 explicitly defers a standalone `Checklist @@index([subkind])`; pays off only when cross-build analytics ships.
- §8.3 chip rule: "pills and inline content sit in the panel body and never overlap the gold bar" — removes the last ambiguity about pill placement vs accent bar.
- Build index `@@index([revisionId, frozenAt, createdAt])` comment updated to acknowledge both query patterns it covers (active-Build lookup + §9.1 Builds-pane sort).

---

*Once this doc is approved, the next step is to break the milestones into a concrete implementation plan via `superpowers:writing-plans`.*
