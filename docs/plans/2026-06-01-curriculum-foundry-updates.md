# Curriculum-Driven Foundry Updates (v4)

**Date:** 2026-06-01
**Status:** Draft v4 — incorporates three validation passes
**Authors:** Raven + Claude
**Motivation:** Handoff prompt from the curriculum-planning instance describing an ESP32 PCB teaching ladder (~15 projects) that will live in the foundry. The handoff lists 6 foundry improvements; this doc captures those + 4 additional gaps surfaced during review, with concrete schema deltas, effort estimates, and a recommended sequence.

A diff summary against v3 is in the appendix.

This doc supplements (does not replace) the v6 [2026-05-27-design-foundry-phase1-design.md](2026-05-27-design-foundry-phase1-design.md). Section numbers below reference the v6 design doc unless otherwise stated.

## 1. Context

Phase 1 is shipped, deployed to production at `https://foundry.onethousanddrones.com`, 251 tests passing, all 16 milestones tagged. The foundry now needs to receive a curriculum of ~15 ESP32-WROOM PCB projects organized as a deliberate teaching ladder across four tracks (sense / act / power / comms) and three levels, with explicit de-risk dependencies converging on a Cyton-class EEG board.

The handoff is explicit that **planning is done; nothing has been created in the foundry yet** — the other instance's immediate task is to map every project onto foundry metadata (track, level, dependsOn) before any Project records exist. That mapping requires foundry features that aren't in Phase 1.

This doc proposes the minimum changes to unblock that work plus the follow-on work the handoff implies.

## 2. Summary of proposed changes

| #  | Change                                                                 | Schema delta             | Blocks other-instance work? | Effort | Priority |
|----|------------------------------------------------------------------------|--------------------------|-----------------------------|--------|----------|
| 1  | Project dependency DAG (`ProjectDependency` model + gate hook)         | +1 model, +1 enum, raw migration, back-refs on User/Project | **Yes** | ~4-5 h | P0 |
| 2  | Curriculum metadata on Project (track, level, criticalPath, …)         | +1 enum, +5 columns      | **Yes**                     | ~30 m  | P0 |
| 3  | Revision-scoped Checklist (extend owner XOR to three)                  | CHECK constraint update + §5.3 helper-table delta | No (enables #4, #10) | ~45 m | P1 |
| 4  | Stripboard-validation checklist subkind + gate + regress hook          | +1 enum value, gate hook, regress side-effect | No        | ~1.5 h | P1 |
| 5  | Certified-module safety flag                                           | +2 boolean columns, gate hook | No                     | ~45 m  | P1 |
| 6  | Shared-block model + erratum fan-out                                   | +2 models, +Erratum extension (Erratum.revisionId becomes nullable — see §7 caveat) | No (defer until foundry-lib exists) | ~6-7 h | P2 |
| 7  | Cross-board / cross-build measurement views                            | None (query + UI)        | No                          | ~2-3 h | P2 |
| 8  | Canonical-vs-overflow policy doc (CONVENTIONS.md)                      | None                     | No                          | ~1 h   | P1 |
| 9  | R2 build-snapshot subkinds + `GERBER_ZIP` ownership widening           | +3 enum values, owner-map updates, DRC_GERBER gate scan extension | No | ~30 m  | P1 |
| 10 | Canonical `REQUIREMENTS_REVIEW` + `LAYOUT_REVIEW` checklists + `notApplicable` + ASSEMBLY gate predicate fix | +2 enum values, +1 column on ChecklistItem, ASSEMBLY gate update | No | ~1.5 h | P1 |

**P0** = blocks the other instance's first task (DAG mapping). Land before they create any records.
**P1** = land before the affected stage is exercised on a real project.
**P2** = defer until first need arises.

---

## 3. Detailed changes

### #1 — Project dependency DAG (P0)

**Handoff motivation:** *"Project dependency DAG (dependsOn edges) — enforce/visualize the ladder (e.g. ADS1299 board can't leave REQUIREMENTS until the ADS1292R board hits BRINGUP)."*

Each edge has two stage anchors: which stage the dependent is at when the gate fires, and which stage the dependency must have reached.

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
  dependentProject       Project        @relation("DependentProject",  fields: [dependentProjectId], references: [id], onDelete: Cascade)
  dependsOnProjectId     String
  dependsOnProject       Project        @relation("DependsOnProject",  fields: [dependsOnProjectId], references: [id], onDelete: Restrict)
  kind                   ProjectDepKind @default(DE_RISK)
  dependentStageGated    Stage          // gate is active while dependent's revision.currentStage >= this stage (per STAGE_ORDER index)
  dependsOnStageRequired Stage          // gate passes only when dependency's most-recent revision has reached >= this stage
  notes                  String?
  createdAt              DateTime       @default(now())
  createdById            String
  createdBy              User           @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([dependentProjectId, dependsOnProjectId, dependentStageGated])
  @@index([dependentProjectId])
  @@index([dependsOnProjectId])
}
```

**Required back-refs** (do NOT skip — `prisma generate` fails without these):

```prisma
model Project {
  // ...existing fields...
  dependentEdges   ProjectDependency[] @relation("DependentProject")
  dependsOnEdges   ProjectDependency[] @relation("DependsOnProject")
}

model User {
  // ...existing back-refs...
  projectDependenciesCreated ProjectDependency[]
}
```

Plus a raw-migration CHECK preventing self-edges: `CHECK ("dependentProjectId" <> "dependsOnProjectId")`.

**Gate enforcement** (revised from v1):

Cycle race for v1 was: two concurrent Serializable txns inserting opposing edges (A→B and B→A) can both pass a recursive-CTE cycle check because their read sets don't overlap on the cycle path. SSI may or may not catch it.

Fix: `createProjectDependency` takes a Postgres advisory lock keyed on the sorted pair of endpoint project IDs BEFORE running the cycle CTE. Pattern:

```ts
// inside the Serializable tx
const [low, high] = [dependentProjectId, dependsOnProjectId].sort();
await tx.$executeRawUnsafe(
  `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
  low, high,
);
// now run the recursive-CTE cycle check; safe to insert
```

The advisory lock auto-releases at transaction end. Any concurrent tx adding an edge between the same pair queues on the lock.

**Gate firing semantics (revised from v1):**

`exitGate` only runs on forward advance, so a dependency regressing AFTER the dependent has already advanced past `dependentStageGated` would silently leave the dependent in an invalid state. To address this, the gate **fires on every forward advance from the dependent while `revision.currentStage >= dependentStageGated`** — not just once at `dependentStageGated` itself.

Concretely: a separate `checkProjectDependencies(ctx)` helper runs *in addition to* `STAGES[currentStage].exitGate(ctx)` inside `advanceStage`. The helper queries `ProjectDependency` rows for `dependentProjectId = currentProject.id` where `STAGE_ORDER.indexOf(currentStage) >= STAGE_ORDER.indexOf(dependentStageGated)`, and for each, checks the dependency's most-recent revision's `currentStage` is `>= dependsOnStageRequired`.

**Invocation order and result merging (clarified per round-2 review):** the existing `advanceStage` ([src/lib/actions/stages.ts:148-161](../../src/lib/actions/stages.ts#L148-L161)) returns immediately on the first `exitGate` failure. v3 spec: **both** `exitGate` and `checkProjectDependencies` MUST run unconditionally; their `reasons[]` arrays are unioned; only then does `advanceStage` decide. Otherwise users hit one set of failures, fix them, then discover dep failures on the next try.

The helper's signature is `checkProjectDependencies: (tx: PrismaTx, projectId: string, currentStage: Stage) => Promise<GateResult>`. The existing `advanceStage` already loads `rev` from `tx.revision.findUniqueOrThrow` ([src/lib/actions/stages.ts:114-123](../../src/lib/actions/stages.ts#L114-L123)) with a select that includes `project: { select: { slug: true } }`. v4 implementation needs to extend that nested select to include `id` as well (i.e. `project: { select: { slug: true, id: true } }`), then pass `rev.project.id` to the helper. Trivial change; called out so the implementing engineer doesn't have to derive it.

Implementation skeleton:

```ts
const ctx = await loadGateContext(tx, rev.id);
const gateResult: GateResult = STAGES[currentStage].exitGate
  ? await STAGES[currentStage].exitGate(ctx)
  : { ok: true };
const depResult: GateResult = await checkProjectDependencies(tx, rev.projectId, currentStage);
const mergedReasons = [
  ...(gateResult.ok ? [] : gateResult.reasons),
  ...(depResult.ok ? [] : depResult.reasons),
];
if (mergedReasons.length > 0) {
  return { result: { ok: false as const, reasons: mergedReasons }, /* ... */ };
}
```

**Transitive dependencies (one-hop policy, added in v4):** `checkProjectDependencies` walks **only the direct edges** from the current project to its immediate dependencies. It does NOT recurse to verify each dependency's own dependencies. Rationale: the lattice catches deep regressions one level at a time. If A→B→C and C regresses, B's own gate fires on B's next forward advance and catches the C edge; then A's gate fires on A's next advance and catches the (now-stale) B edge. The system converges on a valid state without expensive transitive walks at every advance.

Acknowledged consequence: between the moment C regresses and the moment B next attempts to advance, A's gate sees B at its prior valid stage and may permit A to advance. The window is bounded by B's next advance attempt; in a teaching curriculum where the user is actively progressing each project, the window is short. If a curriculum scenario surfaces where the window matters, the helper can be extended to walk transitively at gate-eval time (extra cost: O(depth × fanout) Prisma queries per advance attempt). Defer.

**Regress side policy (added in v3, advisory warning added in v4):** `regressStage` does **NOT** consult the DAG for blocking purposes. A dependency is free to regress even when downstream dependents are at/past their `dependentStageGated`. The dependent's silent-invalid window is bounded by its next forward advance, at which point the gate (now fires-on-every-advance per the policy above) catches it. Rationale: blocking a dependency's regress when downstream dependents exist would create perverse incentives (delete the dependency edge to unblock yourself).

However, the regress UI surfaces a **non-blocking advisory** when downstream dependents would be invalidated. The regress form's confirm step queries `ProjectDependency` rows where `dependsOnProjectId = currentProject.id AND dependsOnStageRequired > regress.toStage`, and renders a banner: `"Regressing past N downstream dependents who will need to re-validate: <list of project labels>. Continue?"` Implementation: a `dependentsAtRisk(tx, projectId, fromStage, toStage)` helper called by `regressStage` to populate the confirmation form; the action itself does not block. Critical for curriculum use where invisible downstream invalidation is exactly the failure mode the DAG is meant to prevent.

**`gateSnapshot` shape:** the `v: 1` `result.reasons` array accommodates DAG-blocker strings. If/when we want to distinguish structurally between "BOM empty" and "dep BUILD-001 not at BRINGUP yet," bump `GATE_SNAPSHOT_VERSION` and use a typed shape; deferred.

**UI:**
- New route `/curriculum` rendering the DAG. Initial implementation uses CSS grid keyed on `level` (rows) and `track` (columns) plus arrows; `@xyflow/react` or similar can come later if hand-rolling gets painful.
- "Dependencies" pane on project detail showing inbound + outbound edges.
- New form `/projects/[slug]/dependencies/new`.

**Effort:** ~4-5 h. Model + back-refs + raw migration (self-edge CHECK + advisory-lock recipe) + 3 server actions + gate-hook helper + `/curriculum` route + dependencies pane + tests (including a concurrent-insert race test analogous to the partial unique index test in Phase 1).

---

### #2 — Curriculum metadata on Project (P0)

**Handoff motivation:** *"Curriculum metadata on REQUIREMENTS — track (sense/act/power/comms), level (1–3), critical-path vs bench-tool, discipline taught. Drives the DAG view."*

**Schema:**

```prisma
enum CurriculumTrack { SENSE  ACT  POWER  COMMS }
enum CurriculumLevel { L1  L2  L3 }

model Project {
  // ...existing fields...
  track              CurriculumTrack?
  level              CurriculumLevel?
  criticalPath       Boolean              @default(true)
  disciplineTaught   String?
  requiresStripboard Boolean              @default(false)
}
```

`level` is an enum (not `Int?` with CHECK) for symmetry with `CurriculumTrack` and cleaner display in `gateSnapshot` if ever serialized.

**UI:**
- Project header strip: track badge (Space Mono, color per track) + level pill + `BENCH TOOL` chip when `!criticalPath`.
- Dashboard (`/`): new sort/filter chips for track + level. Default view shows critical-path-only with a "Show bench tools" toggle.
- Project create/edit forms get the five new fields (all optional).

**Effort:** ~30 m. Two enums + 5 columns on Project + form updates + header strip + dashboard chips + Zod schema update.

---

### #3 — Revision-scoped Checklist (P1, enables #4 + #10)

**Why needed:** Multiple downstream items (#4 stripboard, #10 REQUIREMENTS_REVIEW + LAYOUT_REVIEW) need checklists that exist before a Build exists. Current Checklist owner is `Build XOR Board`. Extend to `Revision XOR Build XOR Board`.

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
  @@index([revisionId, stage])
  @@index([buildId, stage])
  @@index([boardId, stage])
}
```

Raw migration CHECK update (replacing the existing `checklist_owner_xor`):

```sql
ALTER TABLE "Checklist" DROP CONSTRAINT checklist_owner_xor;
ALTER TABLE "Checklist" ADD CONSTRAINT checklist_owner_xor CHECK (
  (CASE WHEN "revisionId" IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "buildId"    IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "boardId"    IS NULL THEN 0 ELSE 1 END) = 1
);
```

Migration safety: no existing Checklist row has `revisionId` set today, so the new (more permissive) CHECK never invalidates existing data. Strictly additive.

**§5.3 helper-table delta** (revised from v1 — v1 said only "assertNotFrozen wiring" without enumerating):

| Action | New Revision-scoped path |
|---|---|
| `createChecklist({ owner: { kind: "revision", id } })` | `assertNotFrozen(tx, owner.id)` only — no Build to assert against. |
| `editChecklist(checklistId)` | If `checklist.revisionId !== null` → `assertNotFrozen(tx, checklist.revisionId)`. Else fall back to existing Build/Board paths. |
| `editChecklistItem(itemId)` | Resolve `item.checklist.revisionId`/`buildId`/`boardId` and dispatch accordingly. |
| `deleteChecklist`, `deleteChecklistItem` | Same dispatch pattern. |
| `reorderChecklistItems` | Same dispatch pattern. |

**Open question (added per validation pass):** the alternative model — polymorphic `ownerKind: ChecklistOwnerKind` enum + single `ownerId` column with no XOR — eliminates the CHECK arithmetic and is more extensible to future owners (Project, Erratum, …). Cost: loses Prisma's typed relations on `Checklist.revision`/`build`/`board`. Recommendation: stick with 3-way XOR for Phase 1 (parallels the existing 2-way Artifact owner XOR, keeps typed relations); revisit if a 4th owner emerges.

**UI:** Add a Checklists pane to the revision detail page (currently checklists only render on build + board pages). Visibility scoped to stages where revision-scoped checklists make sense (REQUIREMENTS through LAYOUT).

**Effort:** ~45 m (was 30m in v1; +15m for the helper-table dispatch wiring across 5 actions).

---

### #4 — Stripboard-validation checklist + gate + regress hook (P1)

**Handoff motivation:** *"Stripboard-validation checklist template gating LAYOUT entry on the 4 flagged L1 boards (uses existing build/board-scoped checklist model — no new stage)."*

**Schema (depends on #2 + #3 landing first):**

```prisma
enum ChecklistSubkind {
  // ...existing values...
  STRIPBOARD_VALIDATION
}
```

`Project.requiresStripboard` is added in #2 (one migration covers all Project metadata).

**Gate hook on `BOM_SOURCING → LAYOUT`:** if `project.requiresStripboard`, additionally require a Revision-scoped Checklist on the current revision with `subkind = STRIPBOARD_VALIDATION`, all items either `checked = true` OR `notApplicable = true` (per #10's `notApplicable` column).

**Regress side-effect (new in v2 — addresses validation finding):** Regressing `LAYOUT → BOM_SOURCING` clears `Checklist.items.checked` for any `STRIPBOARD_VALIDATION` checklist on the revision (sets all items back to unchecked). `completedAt` / `completedById` are PRESERVED on each item — the audit trail of who originally validated and when stays intact; what changes is the "currently valid" state. This forces re-validation if you regress past stripboard. Implementation: extend the existing `LAYOUT → BOM_SOURCING` regress side-effect (which already clears `bomFrozenAt`) to also `UPDATE "ChecklistItem" SET "checked" = false WHERE "checklistId" IN (SELECT id FROM "Checklist" WHERE "revisionId" = $rev AND "subkind" = 'STRIPBOARD_VALIDATION')`.

Canonical items in the template:
1. Topology validated on stripboard prototype.
2. Shared rails identified; cut points planned.
3. Power-rail track doubled (high-current trace lead-in).
4. Firmware bring-up complete on stripboard before PCB layout.
5. Bring-up measurements captured (link to Measurement IDs).

**Effort:** ~1.5 h (was 1h in v1; +30m for the regress side-effect + tests).

---

### #5 — Certified-module safety flag (P1)

**Handoff motivation:** *"Certified-module safety flag in BOM_SOURCING — block any mains-voltage net lacking a certified-module line item."* Handoff also locks: *"Mains: certified module only. No student-laid-out mains copper anywhere in the curriculum."*

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

**Known limitations (documented per validation pass):**
- `isCertifiedModule` is a global engineer-asserted boolean — does not distinguish UL vs CE vs PSE vs other jurisdictional standards. Single boolean is sufficient for v1; jurisdictional precision can be added if needed (likely as a `String[]` of certification codes).
- The gate verifies a certified module **exists in the BOM**, not that it's on the mains-touching net. False-pass risk: an unrelated certified module satisfies the gate. Net-aware gating requires schematic-side data the foundry doesn't model. Documented as accepted limitation.

UI: `Project.hasMainsNet` toggle on project create/edit form (with a tooltip explaining the implication). `Part.isCertifiedModule` checkbox on part create/edit form. New "Mains parts" filter chip on `/parts`.

**Effort:** ~45 m.

---

### #6 — Shared-block model + erratum fan-out (P2 — defer; doc fix today)

**Handoff motivation:** *"Shared-block erratum fan-out — track which foundry-lib block + version each Project consumes; an erratum on a shared block surfaces every affected board."*

**Schema:** (unchanged from v1 — see v1 for full Prisma)

**Migration safety (revised — addresses validation finding):**

The v1 claim "All schema additions in this doc are additive" overstated. This item specifically requires `Erratum.revisionId` to become nullable to accommodate the XOR with `sharedBlockVersionId` (currently `String` non-null at [prisma/schema.prisma:407](../../prisma/schema.prisma#L407)). That change is **not strictly additive**:

- DB-level: column-level alteration (`ALTER COLUMN ... DROP NOT NULL`), FK relation becomes optional. No existing data invalidated (all existing rows have `revisionId` set), but the column type changes.
- Application code: every read of `erratum.revisionId` in the live action layer must add null guards. Existing Erratum action paths (createErratum, editErratum, linkErratumToRevision, etc.) need to dispatch on which owner is set.
- Migration order: ALTER must run before the XOR CHECK is added; reverse order is invalid.

Defer to P2 per v1; this caveat is logged so the eventual implementation doesn't claim "additive" when scoped.

**Defer rationale:** Provides value only once the `foundry-lib` repo exists and projects actually consume blocks from it. Defer until the first 2-3 boards exit LAYOUT and the foundry-lib content has stabilized.

**Effort:** ~6-7 h when it lands (was 5-6h in v1; +1h for the Erratum migration + action code updates).

---

### #7 — Cross-board / cross-build measurement views (P2)

(Unchanged from v1.)

**No schema changes.** Implementation: new route `/measurements/compare?step=<step>&boards=<ids>`. Aggregation query: same `step` string across multiple `Board` rows; group by `boardId`. Render as table + optional histogram per board.

**Defer until:** the first board with measurements at a comparable step exists.

**Effort:** ~2-3 h.

---

### #8 — Canonical-vs-overflow policy (P1)

**Why needed:** The handoff says each board repo has `/docs (notes / bringup log / errata)`. The foundry already has structured Erratum, BRINGUP_LOG artifacts, Measurements, Checklists. Without an explicit policy, errata will get logged in both places (or worse, only in the board repo `/docs/`) and drift over time.

**Proposal:** Add `docs/CONVENTIONS.md` to the foundry repo (this repo) stating:

- **Foundry is canonical for any data that has a structured field.** Errata, measurements, checklists, BRINGUP_LOG entries, stage transitions, BOM lines, parts, build/board status, artifacts — these live in the foundry and the foundry is source of truth.
- **Board-repo `/docs/` is freeform overflow for unstructured material:** sketches, photos of scope traces, datasheet scans, bring-up scratch notes too rough to translate into Measurements yet, draft text that becomes a structured note later.
- **Crossing the boundary:** when a `/docs/` note becomes structured (e.g. a scratch measurement table gets formalized), the note in the board repo gets a `Replaced by foundry measurement <id>` header pointing into the foundry. The structured data lives in the foundry from then on.

Includes a "first board repo layout template" section showing the canonical directory structure (`/hardware`, `/firmware`, `/cad`, `/docs`, root files).

**Effort:** ~1 h (was 30m in v1; realistic with the template section).

---

### #9 — R2 build-snapshot subkinds + `GERBER_ZIP` ownership widening (P1)

**Handoff motivation:** *"R2 = immutable build snapshots tied to a Build: the exact gerber zip as sent to fab, assembly photos, bringup measurement exports, the BOM CSV as ordered."*

Some of these already have subkinds (`GERBER_ZIP`); others don't. The v1 proposal added a fourth subkind `FAB_SUBMISSION_PACKAGE` to capture the "snapshot of what got sent to fab"; per validation, this fragments the story across two subkinds in different ownership.

**Revised approach:** Drop `FAB_SUBMISSION_PACKAGE`. Widen `GERBER_ZIP` ownership to `"either"` (Revision OR Build) so the same subkind covers both "the Gerbers we designed" (Revision-scoped) and "the snapshot we sent to fab" (Build-scoped). Three new subkinds capture the remaining build snapshots:

```prisma
enum ArtifactSubkind {
  // ...existing values...
  BOM_CSV_AS_ORDERED       // Build-scoped; the BOM as actually sent to the distributor
  ASSEMBLY_PHOTO           // Build-scoped; photos taken during assembly / bring-up
  BRINGUP_MEASUREMENTS_CSV // Build-scoped; export of Measurement rows for this build
}
```

Update `ARTIFACT_SUBKIND_OWNER` in [src/lib/artifacts.ts](../../src/lib/artifacts.ts):

```ts
GERBER_ZIP:               "either",   // CHANGED from "revision"
BOM_CSV_AS_ORDERED:       "build",
ASSEMBLY_PHOTO:           "build",
BRINGUP_MEASUREMENTS_CSV: "build",
```

Update `STAGES[ORDERING].buildAllowedArtifactSubkinds` to include `BOM_CSV_AS_ORDERED` + `GERBER_ZIP`. Update `STAGES[ASSEMBLY].buildAllowedArtifactSubkinds` to include `ASSEMBLY_PHOTO`. Update `STAGES[BRINGUP].buildAllowedArtifactSubkinds` to include `BRINGUP_MEASUREMENTS_CSV`.

**DRC_GERBER gate update** (required since `GERBER_ZIP` now lives in two ownership scopes): extend the gate's scan to check both revision-scoped artifacts AND any Build-scoped `GERBER_ZIP` on the active Build:

```ts
exitGate: ({ artifacts, activeBuild }) => {
  const hasDrc = artifacts.some((a) => a.subkind === "DRC_REPORT");
  const hasGerber =
    artifacts.some((a) => a.subkind === "GERBER_ZIP") ||
    (activeBuild?.artifacts ?? []).some((a) => a.subkind === "GERBER_ZIP");
  // ...
};
```

(Note: at DRC_GERBER stage, an active Build typically doesn't exist yet — Builds are created at ORDERING entry. So in practice the revision-scoped branch fires. The Build-scoped scan is defensive in case a Build was created early or the workflow allows attaching a Gerber to a Build after-the-fact.)

**Copy-forward behavior (clarified per round-2 review):** Phase 1's copy-forward on new-revision creation clones revision-scoped artifacts to the new revision. Build-scoped `GERBER_ZIP` (the snapshot of what got sent to a specific fab order) is NOT copied — it's correctly tied to its originating Build and a new revision starts with no Builds. The revision-scoped `GERBER_ZIP` (the "designed Gerbers" for the current revision) IS copied, matching existing behavior.

**Effort:** ~30 m (was 15m in v1; +15m for the gate scan extension + a test verifying GERBER_ZIP on either owner satisfies the gate).

---

### #10 — Canonical review checklists + `notApplicable` + ASSEMBLY gate predicate fix (P1)

**Why needed:** The handoff lists 6 cross-cutting engineering gotchas that should "bake into REQUIREMENTS / checklists." Without a structured place, these become tribal knowledge that gets forgotten by the third board.

V1 put all items in a single `REQUIREMENTS_REVIEW` checklist gated at REQUIREMENTS exit. Per validation: timing mismatch — items 7 (certified mains) and 8 (stripboard) depend on fields (`hasMainsNet`, `requiresStripboard`) that can change between REQUIREMENTS exit and the BOM_SOURCING→LAYOUT gates. v2 splits the canonical checklist into stage-specific subkinds so each item is gated at the stage where its field's value is locked.

**Schema (depends on #3):**

```prisma
enum ChecklistSubkind {
  // ...existing values...
  REQUIREMENTS_REVIEW   // gate at REQUIREMENTS exit
  LAYOUT_REVIEW         // gate at LAYOUT exit (evaluated against the as-laid-out PCB)
}

model ChecklistItem {
  // ...existing fields...
  notApplicable Boolean @default(false)
}
```

Raw-migration CHECK enforcing the `checked` / `notApplicable` semantics are mutually exclusive (added per round-2 review — otherwise UI bugs can produce contradictory rows and gate predicates would silently treat "checked AND N/A" as satisfied):

```sql
ALTER TABLE "ChecklistItem"
ADD CONSTRAINT checklist_item_checked_xor_napplicable
CHECK (NOT ("checked" AND "notApplicable"));
```

(Certified mains and stripboard items are already covered by #5's gate and #4's gate respectively — no need for a third review checklist subkind.)

**ASSEMBLY gate predicate fix (CRITICAL — must land in same migration as `notApplicable`):**

The existing ASSEMBLY exit gate at [src/lib/stages.ts:291](../../src/lib/stages.ts#L291) reads:

```ts
else if (continuity.items.some((i) => !i.checked))
  reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.");
```

Without modification, an N/A item (`checked = false`, `notApplicable = true`) blocks ASSEMBLY forever. Update predicate to:

```ts
if (continuity.items.length === 0)
  reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has no items.");
else if (continuity.items.some((i) => !i.checked && !i.notApplicable))
  reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.");
```

**Zero-item edge case (added in v4):** the original predicate `items.some(...)` returns `false` on an empty array, so a checklist with zero items would silently pass the gate — a loophole where a user (or buggy seeder) creates an empty REQUIREMENTS_REVIEW / LAYOUT_REVIEW / etc. checklist and bypasses the requirement. The `items.length === 0` branch above explicitly fails the gate when no items exist; this protects all four review-checklist gates. Apply the same `items.length === 0 || items.some(...)` structure to REQUIREMENTS_REVIEW, LAYOUT_REVIEW, STRIPBOARD_VALIDATION, and POST_ASSEMBLY_CONTINUITY predicates.

The `notApplicable` migration MUST ship in the same commit as this gate update. Regression test required: pin behavior on a POST_ASSEMBLY_CONTINUITY checklist with one N/A item — gate should pass.

**Action-layer Zod guard (added in v4, complements the DB CHECK):**

```ts
export const editChecklistItemSchema = z.object({
  id: z.cuid(),
  checked: z.boolean().optional(),
  notApplicable: z.boolean().optional(),
  // ...other fields
}).refine(
  (d) => !(d.checked === true && d.notApplicable === true),
  { message: "An item cannot be both checked and N/A simultaneously.", path: ["notApplicable"] }
);
```

Without this, UI bugs producing the invalid combination surface as raw Postgres `23514` constraint violations rather than clean Zod field errors. Same refinement on `createChecklistItemSchema` for defense-in-depth (creation defaults `checked: false, notApplicable: false`, but explicit forms could still post both true).

**Apply the same predicate update everywhere `notApplicable` matters:**
- `REQUIREMENTS_REVIEW` gate at REQUIREMENTS exit.
- `LAYOUT_REVIEW` gate at LAYOUT exit.
- `STRIPBOARD_VALIDATION` gate (#4) at BOM_SOURCING exit.
- `POST_ASSEMBLY_CONTINUITY` gate at ASSEMBLY exit (the one in stages.ts:291).

Canonical items per checklist:

**REQUIREMENTS_REVIEW** — items whose *requirement-level decisions* are locked at REQUIREMENTS exit (gated at REQUIREMENTS exit):
1. WS2812 level-shift strategy chosen (74AHCT125 / SK6812 / 4.5V strip rail) — N/A if no addressable LED.
2. Servo brownout mitigation strategy chosen (bulk cap + separate supply rail) — N/A if no servo.
3. **ADC1-only constraint recorded** (ADC2 unusable while WiFi/ESP-NOW active) — N/A if no internal ADC. (Pin assignment is a SCHEMATIC-stage activity; the *constraint* "must use ADC1" is what's locked here.) **"Recorded"** = item checked in this checklist; no separate Project field. The canonical-items pattern is "checked-off as the team agreeing to a thing"; no structured payload beyond the ChecklistItem itself.
4. Auto-shutoff prevention strategy chosen (idle current spec + USB-PD wall source vs power bank vs always-on draw). (Note: strategy is locked at REQUIREMENTS; specific idle-current budget may flex into BOM_SOURCING as parts are chosen — accepted.)

**LAYOUT_REVIEW** — items *evaluated against the as-laid-out PCB* at LAYOUT exit (the gate runs after layout is done; these are checked against what was actually drawn):
1. Antenna keep-out present in layout (no copper/traces under WROOM antenna end).
2. Isolation barrier post-regulator added on analog side — N/A if no isolation barrier.

Certified mains module sourcing is enforced by #5's gate. Stripboard de-risk rung is enforced by #4's gate.

**Test coverage** (added per round-2 review — v2 only pinned one test; expanded in v4 for zero-item edge case and the STRIPBOARD_VALIDATION regress hook):
- **REQUIREMENTS_REVIEW gate:** Vitest test that creates a Revision-scoped REQUIREMENTS_REVIEW checklist with one item `notApplicable = true`, others `checked = true`; gate must pass. Also: one item `checked = false, notApplicable = false`; gate must fail. Also: zero items present; gate must fail with the "no items" reason.
- **LAYOUT_REVIEW gate:** Same three cases, gated at LAYOUT exit.
- **STRIPBOARD_VALIDATION gate** (from #4): Same three cases, gated at BOM_SOURCING exit on a Project with `requiresStripboard = true`.
- **STRIPBOARD_VALIDATION regress hook** (from #4): Verify that regressing `LAYOUT → BOM_SOURCING` flips `checked` back to `false` on all items in any STRIPBOARD_VALIDATION checklist on the revision while preserving `completedAt` and `completedById`. This test belongs with #4's implementation but is enumerated here to keep the test inventory complete.
- **POST_ASSEMBLY_CONTINUITY gate** (the existing one at `src/lib/stages.ts:291`): the regression test pinning the predicate change. Verifies one N/A item doesn't block ASSEMBLY; verifies zero-items now fails (was vacuous-pass before v4).
- **CHECK constraint:** Vitest negative-insert test attempting `INSERT ... checked=true, notApplicable=true` — must be rejected by the new `checklist_item_checked_xor_napplicable` constraint.
- **Zod refinement:** unit test that `editChecklistItemSchema.parse({ id, checked: true, notApplicable: true })` throws with the canonical error message.

**Effort:** ~1.5 h (was 1h in v1; +30m for the ASSEMBLY gate predicate update + the four regression tests + the LAYOUT_REVIEW addition + the new CHECK constraint test + canonical-items seeding action).

---

## 4. Recommended sequence

### Wave 1 (before the other instance proposes the DAG) — ~5-6 h total

1. **#2 — Curriculum metadata** (~30 m). Trivial schema add (2 enums + 5 columns). Other instance fills the five fields per project when proposing the DAG.
2. **#1 — Dependency DAG** (~4-5 h). The other instance proposes edges; this is how they get persisted + enforced. Includes the advisory-lock cycle prevention and the gate-fires-on-every-advance-past-dependentStageGated logic.

After Wave 1 lands and the other instance proposes the DAG, you can verify the proposal by entering edges via the new dependency form and watching the `/curriculum` view populate.

### Wave 2 (as the curriculum first touches the relevant stages) — pick up as needed

3. **#8 — CONVENTIONS.md** (~1 h). Do this before the first board repo gets created.
4. **#9 — R2 snapshot subkinds + GERBER_ZIP widening** (~30 m).
5. **#3 — Revision-scoped Checklist** (~45 m). Enables #4 and #10.
6. **#10 — Canonical review checklists + `notApplicable` + ASSEMBLY gate fix** (~1.5 h). Useful from the very first project's REQUIREMENTS stage. Includes the load-bearing predicate update.
7. **#5 — Certified-module flag** (~45 m). Low effort; policy enforcement.
8. **#4 — Stripboard-validation gate + regress hook** (~1.5 h). Useful when first L1 board approaches LAYOUT.

### Wave 3 (defer)

9. **#6 — Shared-block model + erratum fan-out** (~6-7 h). Defer until the `foundry-lib` repo exists. Includes Erratum.revisionId nullability migration (see §7 caveat).
10. **#7 — Cross-board measurement views** (~2-3 h). Defer until the ADS1220 + ADS1292R chain has matching-step measurements ready to compare.

## 5. Open questions

- **DAG cycle prevention** — the v2 proposal uses a Postgres advisory lock keyed on the sorted pair of endpoint project IDs. Raw-migration CHECK is an alternative for hard guarantee but loses error-message flexibility. Stick with the advisory lock; revisit if production-scale concurrency proves it insufficient.
- **DAG gate re-evaluation** — v2 fires the dependency check on every forward advance while `currentStage >= dependentStageGated`. Alternative: one-shot at `dependentStageGated` only, documented as known limitation. v2 picks the safer "every advance" path; revisit if it proves too noisy.
- **`gateSnapshot.result.reasons` shape extension** — currently `string[]`. Future-proof for DAG-blocker structured data by bumping `GATE_SNAPSHOT_VERSION` to 2 with a typed variant. Defer until first need.
- **Bench-tool default in dashboard** — v2 picks "critical-path only by default with a Show bench tools toggle." Confirm preference.
- **`disciplineTaught` as `String?`** vs `String[]` vs lookup table — fine for v1; revisit after 15 projects exist if duplication becomes painful.
- **3-way XOR vs polymorphic `ownerKind` for Checklist** — v2 sticks with 3-way XOR to parallel Artifact owner XOR. Revisit if a 4th owner type emerges (e.g. Project-scoped checklists).
- **Stripboard regress hook** — v2 clears `checked` on regress but preserves `completedAt`/`completedById`. Alternative: full audit-trail preservation via a separate `staleAfter` field. Defer; current approach is simpler and the historical audit lives in `completedAt`.
- **Cyton serial protocol compliance** — does the EEG board's protocol-conformance test warrant its own `ChecklistSubkind` (`CYTON_PROTOCOL_CONFORMANCE`), or is a BRINGUP_LOG artifact entry adequate? Defer until the EEG board approaches BRINGUP.
- **`foundry-lib` repo creation** — out of scope for this doc.

## 6. Not proposed (called out for completeness)

The handoff mentions or implies several things that don't warrant foundry changes:

- **Stripboard-vs-perfboard distinction** — captured via canonical REQUIREMENTS_REVIEW + STRIPBOARD_VALIDATION items; no schema change.
- **Cyton serial protocol target** — firmware concern.
- **OpenBCI GUI / BrainFlow compatibility** — ecosystem concern.
- **De-risk chain ADS1220 → ADS1292R → ADS1299** — three `ProjectDependency` edges (kind=DE_RISK).
- **Per-board firmware co-location in `/firmware`** — repo convention, captured in CONVENTIONS.md (#8).
- **Real Cyton purchase as known-good reference** — equipment, not foundry data.

## 7. Migration safety (revised)

Most schema additions are strictly additive: new tables, new columns with defaults, new enum values, more-permissive CHECK constraints. No existing data is invalidated for items #1-#5, #7-#10. No down-migration required.

**Caveat for #6 (when it eventually lands):** `Erratum.revisionId` must become nullable to accommodate the XOR with `sharedBlockVersionId`. That is a column-level alteration (`ALTER COLUMN ... DROP NOT NULL`) and the application's existing reads of `erratum.revisionId` need null guards added. Not data-destructive but not strictly additive either. The `Erratum`-related raw migration must run AFTER the `SharedBlock` + `SharedBlockVersion` tables are in place; XOR CHECK runs last.

Each wave lands as its own commit + migration + tag (suggested tags: `m11-curriculum-metadata`, `m12-dependency-dag`, `m13-revision-checklists`, etc.).

---

## Appendix A: Changes from v3 (round-3 review)

**Major:**
- **#1 helper signature corrected.** v3 pseudocode used `currentProject.id`; the live `advanceStage` loads `rev`, not a `currentProject`. v4 pseudocode uses `rev.projectId` and the helper signature is declared as `(tx: PrismaTx, projectId: string, currentStage: Stage) => Promise<GateResult>`.
- **#1 transitive-dependency policy made explicit.** v4 documents one-hop only: each project's gate guards its own dependencies; the lattice catches deep regressions one level at a time as each affected project attempts its next advance. Acknowledged consequence: a transient window where A's gate sees B at its prior valid stage while B is silently invalid. Bounded by B's next advance. Transitive walk option is deferred.
- **#1 regress UI advisory.** v3 chose lazy catch but left `regressStage` silent on downstream invalidation. v4 adds a non-blocking advisory to the regress form: query `dependentsAtRisk(tx, projectId, fromStage, toStage)` to populate "Regressing past N downstream dependents: [list]. Continue?" Critical for the teaching curriculum's visibility-of-impact.
- **#10 zero-item edge case closed.** Original predicate `items.some(...)` returns `false` on empty array, silently passing the gate. v4 adds an `items.length === 0` branch that fails the gate explicitly. Applied to all four review-checklist gates (REQUIREMENTS_REVIEW, LAYOUT_REVIEW, STRIPBOARD_VALIDATION, POST_ASSEMBLY_CONTINUITY).
- **#10 action-layer Zod guard.** v3 added the DB CHECK but no Zod refinement; UI bugs would surface as raw Postgres `23514` violations. v4 adds `.refine(...)` to `editChecklistItemSchema` and `createChecklistItemSchema`. DB CHECK remains as defense-in-depth.

**Minor:**
- **#10 item 3 "recorded" disambiguated.** v4 adds: `"Recorded" = item checked in this checklist; no separate Project field. The canonical-items pattern is "checked-off as the team agreeing to a thing"; no structured payload beyond the ChecklistItem itself.`
- **#10 test coverage expanded.** v4 adds zero-item test cases per gate, an explicit STRIPBOARD_VALIDATION regress-hook test cross-referenced from #4, and a Zod refinement unit test.
- **#3.1 `checkProjectDependencies` return shape declared** as `Promise<GateResult>`.

## Appendix B: Changes from v2 (round-2 review)

**Major (spec tightenings — v2 left these implicit):**
- #1: gate invocation order pinned. v2 said `checkProjectDependencies` runs "in addition to" `exitGate`; v3 specifies **both run unconditionally**, their `reasons[]` arrays are unioned, and `advanceStage` decides on the merged set. Otherwise users hit one set of failures, fix them, then discover dep failures on the next try.
- #1: regress side policy made explicit. v3 documents that `regressStage` does NOT consult the DAG; the dependent's silent-invalid window is bounded by its next forward advance (which the v2 "fires on every advance" policy catches). Rationale: blocking dependency regress would create perverse incentives.
- #10: CHECK constraint added — `checklist_item_checked_xor_napplicable` enforces `NOT (checked AND notApplicable)`. Without it, UI bugs can produce contradictory rows that gate predicates silently treat as satisfied.
- #10: REQUIREMENTS_REVIEW item 3 reworded — "ADC1-only constraint recorded" instead of "ADC1 pin selection." Pin assignment is a SCHEMATIC-stage activity; only the constraint is REQUIREMENTS-locked.
- #10: LAYOUT_REVIEW intro reworded — "evaluated against the as-laid-out PCB at LAYOUT exit" instead of "decisions locked." Antenna keep-out and isolation post-regulator aren't pre-LAYOUT decisions; they're checked against what was actually drawn at exit.
- #10: per-gate test coverage spelled out — five Vitest tests (one per affected gate plus the CHECK constraint negative-insert). v2 only pinned POST_ASSEMBLY_CONTINUITY.

**Minor:**
- #3.4 — added note that auto-shutoff strategy is REQUIREMENTS-locked but idle-current budget may flex into BOM_SOURCING.
- #9 — added explicit copy-forward sentence: build-scoped `GERBER_ZIP` does not copy forward (correct — snapshot is fab-order-specific); revision-scoped does (matches existing behavior).

## Appendix C: Changes from v1 (round-1 review)

**Critical (won't run / breaks existing system):**
- #1: added `User.projectDependenciesCreated` back-ref + `Project.dependentEdges` / `Project.dependsOnEdges` back-refs (without these, `prisma generate` fails).
- #10: added the ASSEMBLY gate predicate fix `(i) => !i.checked && !i.notApplicable` as load-bearing; flagged that the `notApplicable` migration and the gate update MUST ship in the same commit.
- #10: ditto for `REQUIREMENTS_REVIEW`, `LAYOUT_REVIEW`, and `STRIPBOARD_VALIDATION` gates — same predicate everywhere.

**Major (logic bugs in v1):**
- #1: cycle race resolved via Postgres advisory lock keyed on sorted endpoint pair, taken inside the Serializable tx before the recursive-CTE cycle check.
- #1: gate re-evaluation policy — fires on every forward advance while `currentStage >= dependentStageGated`, not just once at `dependentStageGated`. Catches dependency regressions after dependent has already advanced past the original gate point.
- #4: regress hook added — `LAYOUT → BOM_SOURCING` clears `checked` on STRIPBOARD_VALIDATION items while preserving `completedAt`/`completedById` for audit.
- #6: §7 migration safety claim amended — Erratum.revisionId nullability change is column-level alteration, not strictly additive. Application code needs null guards.
- #9: dropped `FAB_SUBMISSION_PACKAGE`; widened `GERBER_ZIP` ownership to `"either"`; DRC_GERBER gate extended to scan both Revision-scoped artifacts AND active-Build-scoped `GERBER_ZIP`.
- #10: split canonical-items into stage-specific subkinds (`REQUIREMENTS_REVIEW` + `LAYOUT_REVIEW`) so each item is gated at the stage where its decision is locked. Certified mains + stripboard items removed from REQUIREMENTS_REVIEW since they're covered by #5 + #4 gates respectively.

**Schema deltas adjusted:**
- #2: `level Int?` with CHECK 1-3 → `level CurriculumLevel?` enum (`L1` / `L2` / `L3`) for symmetry with `CurriculumTrack`.
- #2: column count corrected to "+5" (was "+4"; `requiresStripboard` was missing from v1's count).
- #3: added explicit §5.3 helper-table delta enumerating each Checklist action's owner-dispatch logic.

**Documentation:**
- §5 open questions expanded: gate re-evaluation policy explicitly noted; `gateSnapshot.result.reasons` shape extension noted; 3-way-XOR-vs-polymorphic flagged.
- §3.5: documented `isCertifiedModule` as global engineer-asserted (jurisdiction not encoded); `hasMainsNet` gate documented as net-blind (false-pass risk on unrelated certified modules).
- §3.8 effort estimate corrected to ~1h with the board-repo template section.
- §7 migration safety amended for #6 caveat.

**Effort estimate adjustments:**
| # | v1 | v2 | Delta |
|---|---|---|---|
| 1 | 3-4 h | 4-5 h | +1h (advisory lock + regress re-eval + back-refs + concurrent-insert test) |
| 3 | 30 m | 45 m | +15m (helper-table dispatch wiring) |
| 4 | 1 h | 1.5 h | +30m (regress hook) |
| 6 | 5-6 h | 6-7 h | +1h (Erratum nullability migration) |
| 8 | 30 m | 1 h | +30m (board-repo template section) |
| 9 | 15 m | 30 m | +15m (DRC_GERBER gate scan extension) |
| 10 | 1 h | 1.5 h | +30m (ASSEMBLY gate fix + LAYOUT_REVIEW) |

Total v1 effort (P0+P1): ~7h. Total v2 effort (P0+P1): ~10h. Most of the extra time is the load-bearing fixes that the v1 missed.
