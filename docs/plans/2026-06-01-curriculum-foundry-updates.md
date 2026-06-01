# Curriculum-Driven Foundry Updates

**Date:** 2026-06-01
**Status:** Proposal — not yet implemented
**Authors:** Raven + Claude
**Motivation:** Handoff prompt from the curriculum-planning instance describing an ESP32 PCB teaching ladder (~15 projects) that will live in the foundry. The handoff lists 6 foundry improvements; this doc captures those + 4 additional gaps surfaced during review, with concrete schema deltas, effort estimates, and a recommended sequence.

This doc supplements (does not replace) the v6 [2026-05-27-design-foundry-phase1-design.md](2026-05-27-design-foundry-phase1-design.md). Section numbers below reference the v6 design doc unless otherwise stated.

## 1. Context

Phase 1 is shipped, deployed to production at `https://foundry.onethousanddrones.com`, 251 tests passing, all 16 milestones tagged. The foundry now needs to receive a curriculum of ~15 ESP32-WROOM PCB projects organized as a deliberate teaching ladder across four tracks (sense / act / power / comms) and three levels, with explicit de-risk dependencies converging on a Cyton-class EEG board.

The handoff is explicit that **planning is done; nothing has been created in the foundry yet** — the other instance's immediate task is to map every project onto foundry metadata (track, level, dependsOn) before any Project records exist. That mapping requires foundry features that aren't in Phase 1.

This doc proposes the minimum changes to unblock that work plus the follow-on work the handoff implies.

## 2. Summary of proposed changes

| #  | Change                                                                 | Schema delta             | Blocks other-instance work? | Effort | Priority |
|----|------------------------------------------------------------------------|--------------------------|-----------------------------|--------|----------|
| 1  | Project dependency DAG (`ProjectDependency` model + gate hook)         | +1 model, +1 enum, raw migration | **Yes**                | ~3-4 h | P0 |
| 2  | Curriculum metadata on Project (track, level, criticalPath, …)         | +1 enum, +4 columns      | **Yes**                     | ~30 m  | P0 |
| 3  | Revision-scoped Checklist (extend owner XOR to three)                  | CHECK constraint update  | No (enables #4)             | ~30 m  | P1 |
| 4  | Stripboard-validation checklist subkind + gate                         | +1 enum value, +1 column on Project, gate hook | No        | ~1 h   | P1 |
| 5  | Certified-module safety flag                                           | +2 boolean columns, gate hook | No                     | ~45 m  | P1 |
| 6  | Shared-block model + erratum fan-out                                   | +2 models, +Erratum extension | No (defer until foundry-lib exists) | ~5-6 h | P2 |
| 7  | Cross-board / cross-build measurement views                            | None (query + UI)        | No                          | ~2-3 h | P2 |
| 8  | Canonical-vs-overflow policy doc (CONVENTIONS.md)                      | None                     | No                          | ~30 m  | P1 |
| 9  | New `ArtifactSubkind` values for R2 build snapshots                    | +4 enum values           | No                          | ~15 m  | P1 |
| 10 | Canonical `REQUIREMENTS_REVIEW` checklist with cross-cutting gotchas   | +1 enum value, canonical items doc | No                | ~1 h   | P1 |

**P0** = blocks the other instance's first task (DAG mapping). Land before they create any records.
**P1** = land before the affected stage is exercised on a real project.
**P2** = defer until first need arises.

---

## 3. Detailed changes

### #1 — Project dependency DAG (P0)

**Handoff motivation:** *"Project dependency DAG (dependsOn edges) — enforce/visualize the ladder (e.g. ADS1299 board can't leave REQUIREMENTS until the ADS1292R board hits BRINGUP)."*

Each edge has two stage anchors: which stage the dependent is trying to leave, and which stage the dependency must have reached.

**Schema:**

```prisma
enum ProjectDepKind {
  DE_RISK       // dependent uses dependency as a smaller-scale precursor
  FOUNDATION    // dependent requires dependency's design pattern as proven
  SHARED_BLOCK  // dependent consumes a foundry-lib block that lives in dependency's repo
}

model ProjectDependency {
  id                     String         @id @default(cuid())
  dependentProjectId     String
  dependentProject       Project        @relation("Dependent",  fields: [dependentProjectId], references: [id], onDelete: Cascade)
  dependsOnProjectId     String
  dependsOnProject       Project        @relation("DependsOn",  fields: [dependsOnProjectId], references: [id], onDelete: Restrict)
  kind                   ProjectDepKind @default(DE_RISK)
  dependentStageGated    Stage          // dependent can't LEAVE this stage until...
  dependsOnStageRequired Stage          // ...the dependency has REACHED this stage (>= in STAGE_ORDER)
  notes                  String?
  createdAt              DateTime       @default(now())
  createdById            String
  createdBy              User           @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([dependentProjectId, dependsOnProjectId, dependentStageGated])
  @@index([dependentProjectId])
  @@index([dependsOnProjectId])
}
```

Plus a raw-migration CHECK preventing self-edges (`dependentProjectId != dependsOnProjectId`). Cycle prevention beyond that lives at the action layer (a recursive CTE during `createProjectDependency` to detect cycles before insert — cheaper than a DB constraint).

**Gate extension:** `advanceStage` (per §5.3 of the v6 design doc) extends step 4 — after running `STAGES[currentStage].exitGate?.(ctx)`, additionally query `ProjectDependency` rows for `dependentProjectId = currentProject.id AND dependentStageGated = revision.currentStage`, and reject with a reasons line per blocking edge whose dependency hasn't reached the required stage.

**UI:**
- New route `/curriculum` rendering the DAG. Nodes are Projects (clickable to project detail), edges are `ProjectDependency` rows. Initial implementation uses CSS grid keyed on `level` (1-3 rows) and `track` (4 columns) plus arrows; `@xyflow/react` or similar can come later if hand-rolling gets painful.
- "Dependencies" pane on project detail showing inbound + outbound edges.
- New form `/projects/[slug]/dependencies/new`.

**Effort:** ~3-4 h. New model + migration + 3 server actions (`createProjectDependency`, `editProjectDependency`, `deleteProjectDependency`) + gate-hook integration into `advanceStage` + `/curriculum` route + dependencies pane on project detail + tests.

---

### #2 — Curriculum metadata on Project (P0)

**Handoff motivation:** *"Curriculum metadata on REQUIREMENTS — track (sense/act/power/comms), level (1–3), critical-path vs bench-tool, discipline taught. Drives the DAG view."*

**Schema:**

```prisma
enum CurriculumTrack {
  SENSE
  ACT
  POWER
  COMMS
}

model Project {
  // ...existing fields...
  track             CurriculumTrack?    // null = not a curriculum project (e.g. one-off internal tool)
  level             Int?                // 1-3; null = not curriculum
  criticalPath      Boolean             @default(true)   // false = optional bench tool
  disciplineTaught  String?             // free text e.g. "precision SPI ADC layout"
  requiresStripboard Boolean            @default(false)  // see #4
}
```

Raw migration CHECK: `level IS NULL OR level BETWEEN 1 AND 3`.

**UI:**
- Project header strip: track badge (Space Mono, color per track) + level pill + `BENCH TOOL` chip if `!criticalPath`.
- Dashboard (`/`): new sort/filter chips for track and level. Default view groups projects by level.
- Project create form gets the four new fields (all optional).

**Effort:** ~30 m. Schema migration + form updates + header strip + dashboard chips + Zod schema update.

---

### #3 — Revision-scoped Checklist (P1, enables #4)

**Why needed:** The stripboard-validation checklist (#4) needs to exist BEFORE a Build does (it gates the BOM_SOURCING → LAYOUT transition, and Builds are created at ORDERING per §5.3). Current Checklist owner is `Build XOR Board`. Extend to `Revision XOR Build XOR Board`.

**Schema:**

```prisma
model Checklist {
  id          String           @id @default(cuid())
  revisionId  String?
  revision    Revision?        @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  buildId     String?
  build       Build?           @relation(fields: [buildId], references: [id], onDelete: Cascade)
  boardId     String?
  board       Board?           @relation(fields: [boardId], references: [id], onDelete: Cascade)
  // ...rest unchanged
}
```

Raw migration CHECK update (replacing the existing `checklist_owner_xor`):

```sql
ALTER TABLE "Checklist" DROP CONSTRAINT checklist_owner_xor;
ALTER TABLE "Checklist" ADD CONSTRAINT checklist_owner_xor CHECK (
  (CASE WHEN "revisionId" IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "buildId" IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "boardId" IS NULL THEN 0 ELSE 1 END) = 1
);
```

Plus new `assertNotFrozen` wiring: Revision-scoped checklist mutations check the parent revision's `frozenAt`.

**UI:** Add a Checklists pane to the revision detail page (currently checklists only render on build + board pages). Visibility scoped to stages where revision-scoped checklists make sense (REQUIREMENTS through BOM_SOURCING).

**Effort:** ~30 m. CHECK migration + Vitest negative-insert test + Checklist schema + Revision-scoped action paths + revision-pane mount.

**Risk:** Existing Checklist data isn't affected (no existing row has `revisionId`). New CHECK is strictly more permissive than the old one, so no migration of data needed.

---

### #4 — Stripboard-validation checklist + gate (P1)

**Handoff motivation:** *"Stripboard-validation checklist template gating LAYOUT entry on the 4 flagged L1 boards (uses existing build/board-scoped checklist model — no new stage)."* Note: the handoff said "no new stage" — this proposal stays in line with that. The only schema add is a new enum value and the flag column added in #2.

**Schema (depends on #2 + #3 landing first):**

```prisma
enum ChecklistSubkind {
  // ...existing values...
  STRIPBOARD_VALIDATION
}
```

**Gate hook on `BOM_SOURCING → LAYOUT`:** if `project.requiresStripboard`, additionally require a Revision-scoped Checklist on the current revision with `subkind = STRIPBOARD_VALIDATION` and all items checked.

Canonical items in the template (handoff says "specify stripboard, not perfboard"; this gives the teaching meta-lesson):

1. Topology validated on stripboard prototype.
2. Shared rails identified; cut points planned.
3. Power-rail track doubled (high-current trace lead-in).
4. Firmware bring-up complete on stripboard before PCB layout.
5. Bring-up measurements captured (link to Measurement IDs).

Items 4 and 5 can be checked off referencing other foundry entities — keeps the audit trail tight.

**Effort:** ~1 h after #2 + #3 land. Adds an enum value + a 3-line gate extension in `STAGES[BOM_SOURCING].exitGate` + Vitest coverage + a "create stripboard validation checklist" convenience action on the revision page when `project.requiresStripboard` is true.

---

### #5 — Certified-module safety flag (P1)

**Handoff motivation:** *"Certified-module safety flag in BOM_SOURCING — block any mains-voltage net lacking a certified-module line item."* The handoff also locks: *"Mains: certified module only. No student-laid-out mains copper anywhere in the curriculum."*

This gate may never fire on the curriculum (every mains-handling project uses a pre-certified module by policy). Worth landing anyway as a structural enforcement of the policy.

**Schema:**

```prisma
model Project {
  // ...existing fields...
  hasMainsNet Boolean @default(false)
}

model Part {
  // ...existing fields...
  isCertifiedModule Boolean @default(false)
}
```

**Gate hook on `BOM_SOURCING → LAYOUT`:** if `project.hasMainsNet`, additionally require at least one BomLine on the revision whose `part.isCertifiedModule = true`.

UI: `Project.hasMainsNet` toggle on project create/edit form (with a tooltip explaining the implication). `Part.isCertifiedModule` checkbox on part create/edit form. New "Mains parts" filter chip on `/parts`.

**Effort:** ~45 m. Schema + gate hook + form updates + Vitest coverage.

---

### #6 — Shared-block model + erratum fan-out (P2 — defer)

**Handoff motivation:** *"Shared-block erratum fan-out — track which foundry-lib block + version each Project consumes; an erratum on a shared block surfaces every affected board."*

The handoff also describes the `foundry-lib` repo as the shared library of KiCad symbols/footprints + reusable hierarchical sheets / design blocks (e.g. `wroom-power-program`, `isolated-spi-barrier`, `single-cell-charger`). Versioned + tagged; board repos pin via submodule.

**Schema:**

```prisma
model SharedBlock {
  id          String   @id @default(cuid())
  slug        String   @unique             // "wroom-power-program"
  name        String                       // "WROOM + USB-C + LDO + UART bridge + auto-program"
  description String?
  createdAt   DateTime @default(now())
  versions    SharedBlockVersion[]
}

model SharedBlockVersion {
  id              String   @id @default(cuid())
  sharedBlockId   String
  sharedBlock     SharedBlock @relation(fields: [sharedBlockId], references: [id], onDelete: Cascade)
  versionTag      String                   // "v1.0", "v1.1.0"
  commitSha       String?                  // pinned SHA in foundry-lib repo
  notes           String?
  publishedAt     DateTime @default(now())
  usages          ProjectSharedBlockUsage[]
  errata          Erratum[] @relation("SharedBlockErratum")

  @@unique([sharedBlockId, versionTag])
}

model ProjectSharedBlockUsage {
  id                     String   @id @default(cuid())
  projectId              String
  project                Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sharedBlockVersionId   String
  sharedBlockVersion     SharedBlockVersion @relation(fields: [sharedBlockVersionId], references: [id], onDelete: Restrict)
  notes                  String?
  createdAt              DateTime @default(now())

  @@unique([projectId, sharedBlockVersionId])
}

model Erratum {
  // ...existing fields...
  sharedBlockVersionId String?
  sharedBlockVersion   SharedBlockVersion? @relation("SharedBlockErratum", fields: [sharedBlockVersionId], references: [id], onDelete: Restrict)
  // existing CHECK: an erratum has exactly one of (revisionId, sharedBlockVersionId)
}
```

Plus a raw-migration CHECK on Erratum: exactly one of `revisionId` or `sharedBlockVersionId` is non-null.

**UI:**
- `/shared-blocks` — list of blocks with version count + projects-consuming count.
- `/shared-blocks/[slug]` — block detail with versions, per-version usage list, per-version errata.
- "Shared block usages" pane on project detail.
- Erratum form gets a tab: "Affects" → Revision OR Shared block.

**Effort:** ~5-6 h. Two new models + Erratum extension + raw migration + 6 server actions + 2 new routes + pane updates.

**Defer rationale:** Provides value only once the `foundry-lib` repo exists and projects actually consume blocks from it. The curriculum's first 2-3 boards will create the `wroom-power-program` block experientially; defer this work until that block is published. The current `Project.repoUrl` field handles per-project repo tracking adequately in the interim.

---

### #7 — Cross-board / cross-build measurement views (P2)

**Handoff motivation:** *"(Already Phase 2 — prioritize) cross-board measurement views — compare noise floor across the ADS1220 → ADS1292R → ADS1299 chain as de-risk evidence."*

Already in the [README](../../README.md) Phase 2 candidates and the v6 design §11. The handoff names a concrete first use case (ADS1220 → ADS1292R → ADS1299 noise floor comparison) which sharpens the spec.

**No schema changes.** Implementation:
- New route `/measurements/compare?step=<step>&boards=<ids>` (or similar).
- Aggregation query: same `step` string across multiple `Board` rows; group by `boardId`.
- Render as table + optional histogram per board.

**Defer until:** the first board with measurements at a comparable step exists (ADS1220 + ADS1292R will share `noise floor 1Hz-100Hz @ Vref / 0V input` step naming convention by the time both reach BRINGUP).

**Effort:** ~2-3 h.

---

### #8 — Canonical-vs-overflow policy (P1)

**Why needed:** The handoff says each board repo has `/docs (notes / bringup log / errata)`. The foundry already has structured Erratum, BRINGUP_LOG artifacts, Measurements, Checklists. Without an explicit policy, errata will get logged in both places (or worse, only in the board repo `/docs/`) and drift over time.

**Proposal:** Add `docs/CONVENTIONS.md` to the foundry repo (this repo) stating:

- **Foundry is canonical for any data that has a structured field.** Errata, measurements, checklists, BRINGUP_LOG entries, stage transitions, BOM lines, parts, build/board status, artifacts — these live in the foundry and the foundry is source of truth.
- **Board-repo `/docs/` is freeform overflow for unstructured material:** sketches, photos of scope traces, datasheet scans, bring-up scratch notes too rough to translate into Measurements yet, draft text that becomes a structured note later. Anything that doesn't fit a foundry field.
- **Crossing the boundary:** when a `/docs/` note becomes structured (e.g. a scratch measurement table gets formalized), the note in the board repo gets a `Replaced by foundry measurement <id>` header pointing into the foundry. The structured data lives in the foundry from then on.

Same effort as writing this paragraph in CONVENTIONS.md. ~30 m including a "first board repo layout template" section.

---

### #9 — R2 build-snapshot subkinds (P1)

**Handoff motivation:** *"R2 = immutable build snapshots tied to a Build: the exact gerber zip as sent to fab, assembly photos, bringup measurement exports, the BOM CSV as ordered."*

Some of these already have subkinds (`GERBER_ZIP`); others don't (assembly photos, BOM CSV, measurement exports).

**Schema:**

```prisma
enum ArtifactSubkind {
  // ...existing values...
  BOM_CSV_AS_ORDERED       // Build-scoped; the BOM as actually sent to the distributor
  ASSEMBLY_PHOTO           // Build-scoped; photos taken during assembly / bring-up
  BRINGUP_MEASUREMENTS_CSV // Build-scoped; export of Measurement rows for this build
  FAB_SUBMISSION_PACKAGE   // Build-scoped; the exact zip sent to fab (Gerbers + drill + ...) — superset of GERBER_ZIP for cases where you want one snapshot file
}
```

Update `ARTIFACT_SUBKIND_OWNER` in [src/lib/artifacts.ts](../../src/lib/artifacts.ts):

```ts
BOM_CSV_AS_ORDERED:       "build",
ASSEMBLY_PHOTO:           "build",
BRINGUP_MEASUREMENTS_CSV: "build",
FAB_SUBMISSION_PACKAGE:   "build",
```

Update `STAGES[ORDERING].buildAllowedArtifactSubkinds` to include `BOM_CSV_AS_ORDERED` and `FAB_SUBMISSION_PACKAGE`. Update `STAGES[ASSEMBLY].buildAllowedArtifactSubkinds` to include `ASSEMBLY_PHOTO`. Update `STAGES[BRINGUP].buildAllowedArtifactSubkinds` to include `BRINGUP_MEASUREMENTS_CSV`.

**Effort:** ~15 m. Enum + map + STAGES config + a snapshot generation script (optional Phase 2: write a server action that exports a board's measurements to CSV and records it as a BRINGUP_MEASUREMENTS_CSV artifact in one shot).

---

### #10 — `REQUIREMENTS_REVIEW` checklist with canonical items (P1)

**Why needed:** The handoff lists 6 cross-cutting engineering gotchas that should "bake into REQUIREMENTS / checklists." Without a structured place, these become tribal knowledge that gets forgotten by the third board.

**Schema (depends on #3):**

```prisma
enum ChecklistSubkind {
  // ...existing values...
  REQUIREMENTS_REVIEW
}
```

Canonical items in the template (per the handoff's gotcha list, generated by a server action when a Revision-scoped REQUIREMENTS_REVIEW checklist is created):

1. WS2812 level-shift confirmed (74AHCT125 / SK6812 / 4.5V strip rail) — N/A if no addressable LED.
2. Servo brownout mitigation confirmed (bulk cap + separate supply rail) — N/A if no servo.
3. ADC1 pins used for any internal-ADC reads (ADC2 unusable while WiFi/ESP-NOW active) — N/A if no internal ADC.
4. Antenna keep-out present in layout area (no copper/traces under WROOM antenna end).
5. Auto-shutoff prevention strategy chosen (idle current spec + USB-PD wall source vs power bank vs always-on draw).
6. Isolation barrier post-regulator added on analog side — N/A if no isolation barrier.
7. Certified mains module sourced — N/A if no mains net.
8. Stripboard de-risk rung complete — N/A unless `project.requiresStripboard`.

Each item has an `N/A` answer in addition to checked/unchecked, so the checklist is universal but doesn't false-positive on irrelevant items. (This requires adding an `notApplicable: Boolean @default(false)` column to `ChecklistItem` — small change.)

Gate hook: extend `REQUIREMENTS` exit gate to require a `REQUIREMENTS_REVIEW` Checklist (Revision-scoped) with every item either checked OR marked N/A.

**Effort:** ~1 h after #3 lands. Enum value + `notApplicable` column + REQUIREMENTS gate extension + canonical-items seed action.

---

## 4. Recommended sequence

### Wave 1 (before the other instance proposes the DAG) — ~1 day total

1. **#2 — Curriculum metadata** (~30 m). Trivial schema add. Other instance fills the four fields per project when proposing the DAG.
2. **#1 — Dependency DAG** (~3-4 h). The other instance proposes edges, this is how they get persisted + enforced.

After Wave 1 lands and the other instance proposes the DAG, you can verify their proposal by entering edges via the new dependency form and watching the `/curriculum` view populate.

### Wave 2 (as the curriculum first touches the relevant stages) — pick up as needed

3. **#8 — CONVENTIONS.md** (~30 m). Do this before the first board repo gets created.
4. **#9 — R2 snapshot subkinds** (~15 m). Quick, low-risk; do it whenever convenient.
5. **#3 — Revision-scoped Checklist** (~30 m). Enables #4 and #10.
6. **#10 — REQUIREMENTS_REVIEW canonical checklist** (~1 h). Useful from the very first project's REQUIREMENTS stage.
7. **#5 — Certified-module flag** (~45 m). Low effort; policy enforcement.
8. **#4 — Stripboard-validation gate** (~1 h). Useful when first L1 board approaches LAYOUT.

### Wave 3 (defer)

9. **#6 — Shared-block model + erratum fan-out** (~5-6 h). Defer until the `foundry-lib` repo exists and the first shared block is published.
10. **#7 — Cross-board measurement views** (~2-3 h). Defer until the ADS1220 + ADS1292R chain has matching-step measurements ready to compare.

## 5. Open questions

- **Cycle prevention for #1:** raw-migration CHECK or action-layer recursive CTE? Action layer is more flexible (better error messages) but raw CHECK is more authoritative. Default: action layer, with a comment pointing at where a CHECK would go if Phase 2 wants to harden.
- **DAG enforcement granularity:** the handoff's example ("ADS1299 can't leave REQUIREMENTS until ADS1292R hits BRINGUP") suggests `dependentStageGated` is parameterized per edge — the proposal honors that. But a simpler model (dependencies always gate the same stage transition, e.g. always "can't leave REQUIREMENTS") may be sufficient and would simplify the UI. Pick the flexible model unless we hit a UI complexity wall.
- **Bench-tool project filtering:** the dashboard currently shows all unarchived projects. With `criticalPath` added, default view probably should show critical-path only with a "Show bench tools" toggle. Confirm.
- **`foundry-lib` repo creation:** out of scope for this doc (handoff describes the convention, but creating the repo is hardware-engineering work, not foundry-feature work). Worth noting: no foundry change is needed to start using `foundry-lib`; per-project pinning is done via git submodule, and the foundry only needs the changes in #6 once the fan-out feature is wanted.
- **Cyton protocol compliance test:** does it warrant its own `ChecklistSubkind` (`CYTON_PROTOCOL_CONFORMANCE`) for the EEG board, or is it adequately captured by a BRINGUP_LOG artifact entry with a structured note? Defer the decision until the EEG board approaches BRINGUP.

## 6. Not proposed (called out for completeness)

The handoff mentions or implies several things that don't warrant foundry changes:

- **Stripboard-vs-perfboard distinction** — handoff specifies stripboard; this is a process discipline, not a foundry feature. The canonical REQUIREMENTS_REVIEW checklist item 8 captures the discipline; no model change needed.
- **Cyton serial protocol target** — firmware concern. Foundry doesn't model firmware specifics.
- **OpenBCI GUI / BrainFlow compatibility** — same; ecosystem concern.
- **De-risk chain ADS1220 → ADS1292R → ADS1299** — already representable as three ProjectDependency edges (kind=DE_RISK, dependentStageGated=REQUIREMENTS, dependsOnStageRequired=BRINGUP).
- **Per-board firmware co-location in `/firmware`** — repo convention, captured in CONVENTIONS.md (#8); no schema change.
- **Real Cyton purchase as known-good reference** — equipment, not foundry data.

## 7. Migration safety

All schema additions in this doc are additive: new tables, new columns with defaults, new enum values, more-permissive CHECK constraints. No existing data is invalidated. No down-migration required. Each wave lands as its own commit + migration + tag (suggested tags: `m11-curriculum-metadata`, `m12-dependency-dag`, etc.).

---

*Once this proposal is approved, the corresponding implementation tasks will be drafted in a follow-on `2026-06-01-curriculum-foundry-updates-implementation.md` (or folded into Phase 2 milestones M11/M12/…).*
