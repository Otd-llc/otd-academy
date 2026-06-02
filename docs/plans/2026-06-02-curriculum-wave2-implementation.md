# Curriculum Wave 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `superpowers:subagent-driven-development` for same-session execution) to implement this plan task-by-task.

> **For the user:** Commit gating — every task ends with a commit step per standard TDD discipline. The user controls when commits are actually executed (per their explicit directive earlier in the session). Subagents should produce the diff and the proposed commit message in their report; the user reviews and runs the commit when ready. **Every subagent dispatch must include the literal string `DO NOT COMMIT` in its instructions** — the constraint is enforced at the orchestrator layer, not by trust.

**Goal:** Build Wave 2 of the curriculum-driven foundry updates — six additive changes layered on top of Wave 1 (`m11-curriculum-metadata` + `m12-dependency-dag`, both already on `main` and tagged). Wave 2 is split into six milestone-sized clusters: `m13-repo-conventions` (docs only), `m14-r2-subkinds` (artifact subkinds + GERBER_ZIP ownership widening), `m15-revision-checklist` (Checklist owner widened to Revision XOR Build XOR Board), `m16-canonical-checklists` (canonical REQUIREMENTS_REVIEW + LAYOUT_REVIEW templates + `notApplicable` column + ASSEMBLY gate predicate fix), `m17-stripboard-gate` (STRIPBOARD_VALIDATION gate + LAYOUT→BOM_SOURCING regress hook), and `m18-certified-module` (mains-net + certified-module safety flags).

**Architecture:** Six additive milestones layered on the live Phase 1 + Wave 1 schema. m13 is documentation only (a `docs/CONVENTIONS.md` + a "first board repo" template). m14 adds three new `ArtifactSubkind` enum values, widens `GERBER_ZIP` ownership from `"revision"` to `"either"` in `ARTIFACT_SUBKIND_OWNER`, and extends the DRC_GERBER gate to scan both revision-scoped artifacts and any Build-scoped `GERBER_ZIP`. m15 widens the `Checklist` owner XOR from 2-way (Build XOR Board) to 3-way (Revision XOR Build XOR Board), threads `revisionId` through the action-layer dispatch, and adds a Checklists pane to the revision detail page. m16 adds two `ChecklistSubkind` enum values (REQUIREMENTS_REVIEW + LAYOUT_REVIEW), adds a `ChecklistItem.notApplicable` column + raw-migration CHECK (`checklist_item_checked_xor_napplicable`), seeds canonical templates as code-literal JSON, wires REQUIREMENTS_REVIEW + LAYOUT_REVIEW gates into `STAGES`, and **fixes the load-bearing ASSEMBLY predicate at `src/lib/stages.ts:291`** to handle empty checklists and N/A items correctly. m17 adds the `STRIPBOARD_VALIDATION` subkind, a BOM_SOURCING→LAYOUT gate fed by `project.requiresStripboard`, and a LAYOUT→BOM_SOURCING regress side-effect that flips `checked = false` on every item in the relevant checklist while preserving `completedAt` / `completedById`. m18 adds `Project.hasMainsNet` + `Part.isCertifiedModule`, a BOM_SOURCING→LAYOUT gate predicate, and form fields. Source-of-truth design lives in [docs/plans/2026-06-01-curriculum-foundry-updates.md](2026-06-01-curriculum-foundry-updates.md) §3 (subsections #3, #4, #5, #8, #9, #10).

**Tech Stack:** Same as Phase 1 + Wave 1 — Next.js 16, TypeScript 5, React 19, Prisma 7 + Neon Postgres + `@prisma/adapter-neon`, Auth.js v5, Tailwind v4 + shadcn/ui, Vitest, Vercel. No new runtime dependencies.

---

## Conventions (carry forward from Phase 1 + Wave 1)

- **Package manager:** `pnpm` throughout.
- **PATH:** `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path` before any `pnpm` call (Windows PowerShell).
- **Commits:** Conventional Commits (`feat(scope): …`, `test(scope): …`, `chore(scope): …`, `docs: …`). One commit per task unless explicitly bundled. **User-gated** — see note at top.
- **Tests:** Vitest. Negative-insert tests against live Neon for CHECK constraints + unique indexes. Render tests walk the React element tree directly (no `react-dom/server`).
- **Tx isolation:** `Serializable` for any tx that writes to multiple rows + reads/writes that could race. `withTxRetry` wrapper from `src/lib/tx-retry.ts`.
- **Action layer:** `requireUser()` at the top of every server action; Zod-validate input; `revalidatePath` after mutations.
- **Mocking pattern in tests:** mock `next/cache` and `@/auth` to use the seeded `seed@example.com` user.
- **Imports:** `@/` alias → `src/`.
- **Don't break the existing 271 tests** (Phase 1 baseline 251 + Wave 1 additions). The number to beat each milestone is updated in the per-milestone checkpoint task.
- **Wave 1 status:** `m11-curriculum-metadata` and `m12-dependency-dag` are already on `main` and tagged. The schema columns `Project.requiresStripboard` (referenced by m17), `Project.track`, `Project.level`, and the `ProjectDependency` table all exist already.
- **User-gated commit constraint:** every subagent dispatch must include the literal string `DO NOT COMMIT` in its instructions. The subagent's job is to produce the diff and propose the commit message; the user runs the commit.
- **Source-of-truth doc reference:** [docs/plans/2026-06-01-curriculum-foundry-updates.md](2026-06-01-curriculum-foundry-updates.md). When this plan says "per §3.#X of the proposal," go read §3.#X.

---

# Milestone m13 — Canonical-vs-overflow policy (docs)

Goal: ship `docs/CONVENTIONS.md` stating that the foundry is canonical for structured data (errata, measurements, checklists, BRINGUP_LOG entries, stage transitions, BOM lines, parts, build/board status, artifacts) and that each board repo's `/docs/` is freeform overflow only. Includes a "first board repo layout template" section. Per proposal §3 #8. No code change, no schema, no tests — the "test" is a `git diff` review + a GitHub render check.

### Task 13.1: Author `docs/CONVENTIONS.md`

**Files:**
- Create: `docs/CONVENTIONS.md`

**Step 1: Author the document.** Sections required (in order):

1. **Title + 1-paragraph framing** — "This document defines what data lives in the foundry vs. what lives in each board's own repository under `/docs/`."

2. **Canonical-data policy (foundry is source of truth).** Bullet list naming every structured concept the foundry owns:
   - Errata (`Erratum` model)
   - Measurements (`Measurement` model)
   - Checklists + items (`Checklist` / `ChecklistItem`)
   - BRINGUP_LOG entries (Artifact with `subkind = BRINGUP_LOG`)
   - Stage transitions (`StageTransition`)
   - BOM lines (`BomLine`) and the parts library (`Part`)
   - Build status, Board status (`Build.frozenAt`, `Board.status`)
   - Every artifact (revision-scoped or build-scoped, including the R2 build-snapshot subkinds added in m14)

3. **Board-repo `/docs/` policy (freeform overflow).** Bullet list of what belongs there:
   - Hand-drawn sketches / photos of scope traces.
   - Datasheet scans that aren't yet linked from a `Part.datasheetUrl`.
   - Bring-up scratch notes too rough to translate into a `Measurement` row yet.
   - Draft narrative text that may later become a structured note (Erratum / BRINGUP_LOG artifact).

4. **Crossing the boundary.** Rule: when a `/docs/` note becomes structured (e.g. a scratch table is formalized into Measurements, or a draft narrative becomes an Erratum), edit the original `/docs/` file to start with a `> Replaced by foundry measurement <id>` (or `<erratum id>`, etc.) blockquote linking into the foundry. The structured data lives in the foundry from then on; the original `/docs/` note is preserved for provenance but is no longer canonical.

5. **First board repo layout template.** Show the canonical directory tree:

   ```
   <board-slug>/
   ├── README.md               # Project name, link back to foundry project page, 1-2 paragraph overview
   ├── LICENSE                 # OSS license — match foundry top-level
   ├── hardware/
   │   ├── <board>.kicad_pro
   │   ├── <board>.kicad_sch
   │   ├── <board>.kicad_pcb
   │   └── gerbers/            # generated artifacts; foundry holds the canonical GERBER_ZIP
   ├── firmware/
   │   └── …                   # source tree per project
   ├── cad/
   │   └── <enclosure>.step    # mechanical models if applicable
   └── docs/
       └── <freeform>.md       # see "Board-repo /docs/ policy" above
   ```

6. **README rules for board repos.** README must:
   - Open with one sentence describing what the board does.
   - Link to the foundry project page (e.g. `https://<foundry-host>/projects/<slug>`).
   - State the curriculum track + level if applicable.
   - **Never** duplicate the canonical BOM, errata, or measurements — link to the foundry instead.

7. **License section.** Board repos use the same license as the foundry top-level (set explicitly in repo root `LICENSE`). The foundry license decision is itself out of scope for this doc but referenced.

**Step 2: Render check.**

```
pnpm tsc --noEmit
```

Expected: clean (no code change so this is a smoke check).

Manually preview the markdown in VSCode or push to a draft branch and view on GitHub to confirm headings, the directory-tree code block, and bullet lists render correctly.

**Step 3: Commit (user-gated):**

```
git add docs/CONVENTIONS.md
git commit -m "docs: canonical-vs-overflow policy + first board repo layout template"
```

### Task 13.2: m13 checkpoint

**Step 1: Verify:**
- `pnpm tsc --noEmit` clean (sanity — no code changed).
- `pnpm vitest run` — 271 tests pass (unchanged from baseline).
- Render check: open `docs/CONVENTIONS.md` in a GitHub preview or VSCode preview pane; confirm all 7 sections render with correct headings + the directory-tree code block.

**Step 2: Tag (user-gated):**

```
git tag m13-repo-conventions
```

---

# Milestone m14 — R2 build-snapshot subkinds + GERBER_ZIP ownership widening

Goal: add three new `ArtifactSubkind` values (`BOM_CSV_AS_ORDERED`, `ASSEMBLY_PHOTO`, `BRINGUP_MEASUREMENTS_CSV`) all Build-scoped; widen `GERBER_ZIP` ownership from `"revision"` to `"either"`; update `STAGES[ORDERING|ASSEMBLY|BRINGUP].buildAllowedArtifactSubkinds`; extend the DRC_GERBER gate to scan both revision-scoped artifacts and Build-scoped `GERBER_ZIP`. Per proposal §3 #9.

### Task 14.1: Add three `ArtifactSubkind` enum values

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_r2_build_snapshot_subkinds/migration.sql` (generated)

**Step 1: Edit `prisma/schema.prisma`.** Append three values to the `ArtifactSubkind` enum (after `BRINGUP_COMPLETE`):

```prisma
enum ArtifactSubkind {
  GENERIC
  REQUIREMENTS_DOC
  SCHEMATIC_FILE
  BOM_EXPORT
  LAYOUT_FILE
  DRC_REPORT
  GERBER_ZIP
  PCB_ORDER
  PARTS_ORDER
  ASSEMBLY_PROCEDURE
  BENCH_PROCEDURE
  BRINGUP_LOG
  BRINGUP_COMPLETE
  BOM_CSV_AS_ORDERED        // Build-scoped; the BOM as actually sent to the distributor
  ASSEMBLY_PHOTO            // Build-scoped; photos taken during assembly / bring-up
  BRINGUP_MEASUREMENTS_CSV  // Build-scoped; export of Measurement rows for this build
}
```

**Step 2: Generate the migration:**

```
pnpm prisma migrate dev --name r2_build_snapshot_subkinds
```

Expected: new directory `prisma/migrations/<ts>_r2_build_snapshot_subkinds/` with `migration.sql` containing `ALTER TYPE "ArtifactSubkind" ADD VALUE 'BOM_CSV_AS_ORDERED';` (and the other two). Note that PostgreSQL `ALTER TYPE … ADD VALUE` is non-transactional in pre-12 but Neon runs 15+, so the generated migration should be a single transaction. Existing rows are unaffected.

**Step 3: Verify schema:**

```
pnpm prisma validate
pnpm tsc --noEmit
```

Expected: both clean. (`pnpm tsc` may need to re-run prisma generate first — `pnpm prisma generate` if it complains about types.)

**Step 4: Commit (user-gated):**

```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add R2 build-snapshot ArtifactSubkinds"
```

### Task 14.2: Widen `GERBER_ZIP` ownership + add three new owner entries in `ARTIFACT_SUBKIND_OWNER`

**Files:**
- Modify: `src/lib/artifacts.ts`
- Test: `src/lib/__tests__/artifacts.test.ts` (extend)

**Step 1: Write the failing test.** Append to `src/lib/__tests__/artifacts.test.ts`:

```ts
import { ARTIFACT_SUBKIND_OWNER, ownerMatches } from "@/lib/artifacts";

test("ARTIFACT_SUBKIND_OWNER: GERBER_ZIP is 'either' (covers revision-scoped designed gerbers AND build-scoped fab-submission snapshot)", () => {
  expect(ARTIFACT_SUBKIND_OWNER.GERBER_ZIP).toBe("either");
  expect(ownerMatches("GERBER_ZIP", "revision")).toBe(true);
  expect(ownerMatches("GERBER_ZIP", "build")).toBe(true);
});

test("ARTIFACT_SUBKIND_OWNER: BOM_CSV_AS_ORDERED + ASSEMBLY_PHOTO + BRINGUP_MEASUREMENTS_CSV are Build-scoped", () => {
  expect(ARTIFACT_SUBKIND_OWNER.BOM_CSV_AS_ORDERED).toBe("build");
  expect(ARTIFACT_SUBKIND_OWNER.ASSEMBLY_PHOTO).toBe("build");
  expect(ARTIFACT_SUBKIND_OWNER.BRINGUP_MEASUREMENTS_CSV).toBe("build");
  expect(ownerMatches("BOM_CSV_AS_ORDERED", "revision")).toBe(false);
  expect(ownerMatches("ASSEMBLY_PHOTO", "revision")).toBe(false);
});
```

**Step 2: Run the test, watch fail:**

```
pnpm vitest run artifacts.test
```

Expected: FAIL — GERBER_ZIP is currently `"revision"`; the three new subkinds aren't in the map yet so `ARTIFACT_SUBKIND_OWNER.BOM_CSV_AS_ORDERED` is `undefined`.

**Step 3: Implement.** Edit `src/lib/artifacts.ts`:

```ts
export const ARTIFACT_SUBKIND_OWNER: Readonly<
  Record<ArtifactSubkind, ArtifactOwnerKind>
> = {
  GENERIC: "either",
  REQUIREMENTS_DOC: "revision",
  SCHEMATIC_FILE: "revision",
  BOM_EXPORT: "revision",
  LAYOUT_FILE: "revision",
  DRC_REPORT: "revision",
  GERBER_ZIP: "either",                   // CHANGED from "revision" (proposal §3 #9)
  ASSEMBLY_PROCEDURE: "revision",
  BENCH_PROCEDURE: "revision",
  PCB_ORDER: "build",
  PARTS_ORDER: "build",
  BRINGUP_LOG: "build",
  BRINGUP_COMPLETE: "build",
  BOM_CSV_AS_ORDERED: "build",            // NEW
  ASSEMBLY_PHOTO: "build",                // NEW
  BRINGUP_MEASUREMENTS_CSV: "build",      // NEW
};
```

**Step 4: Run, watch pass:**

```
pnpm vitest run artifacts.test
```

Expected: both new tests pass + every existing artifacts test stays green.

**Step 5: Commit (user-gated):**

```
git add src/lib/artifacts.ts src/lib/__tests__/artifacts.test.ts
git commit -m "feat(artifacts): widen GERBER_ZIP to either-scoped + add R2 build-snapshot owners"
```

### Task 14.3: Update `STAGES[ORDERING|ASSEMBLY|BRINGUP].buildAllowedArtifactSubkinds`

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/stages.test.ts` (extend)

**Step 1: Write the failing test.** Append to `src/lib/__tests__/stages.test.ts`:

```ts
import { STAGES } from "@/lib/stages";

test("STAGES[ORDERING].buildAllowedArtifactSubkinds includes BOM_CSV_AS_ORDERED + GERBER_ZIP", () => {
  expect(STAGES.ORDERING.buildAllowedArtifactSubkinds).toContain("BOM_CSV_AS_ORDERED");
  expect(STAGES.ORDERING.buildAllowedArtifactSubkinds).toContain("GERBER_ZIP");
});

test("STAGES[ASSEMBLY].buildAllowedArtifactSubkinds includes ASSEMBLY_PHOTO", () => {
  expect(STAGES.ASSEMBLY.buildAllowedArtifactSubkinds).toContain("ASSEMBLY_PHOTO");
});

test("STAGES[BRINGUP].buildAllowedArtifactSubkinds includes BRINGUP_MEASUREMENTS_CSV", () => {
  expect(STAGES.BRINGUP.buildAllowedArtifactSubkinds).toContain("BRINGUP_MEASUREMENTS_CSV");
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/stages.ts`:

In `STAGES.ORDERING`, update:

```ts
buildAllowedArtifactSubkinds: ["PCB_ORDER", "PARTS_ORDER", "BOM_CSV_AS_ORDERED", "GERBER_ZIP", "GENERIC"],
```

In `STAGES.ASSEMBLY`, update:

```ts
buildAllowedArtifactSubkinds: ["ASSEMBLY_PHOTO", "GENERIC"],
```

In `STAGES.BRINGUP`, update:

```ts
buildAllowedArtifactSubkinds: ["BRINGUP_LOG", "BRINGUP_COMPLETE", "BRINGUP_MEASUREMENTS_CSV", "GENERIC"],
```

(Confirm `BRINGUP_COMPLETE` is already in the existing array — adjust only the diff.)

**Step 4: Run, watch pass:**

```
pnpm vitest run stages.test
```

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/stages.test.ts
git commit -m "feat(stages): allow R2 build-snapshot subkinds at ORDERING/ASSEMBLY/BRINGUP"
```

### Task 14.4: Extend DRC_GERBER exit gate to scan Build-scoped `GERBER_ZIP`

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/stages.test.ts` (extend)

**Step 1: Write the failing test.** Append:

```ts
import type { GateContext } from "@/lib/stages";

function ctx(over: Partial<GateContext> = {}): GateContext {
  return {
    revision: { id: "r1", currentStage: "DRC_GERBER", schematicCommit: null, layoutCommit: null },
    bomLines: [],
    artifacts: [],
    activeBuild: null,
    ...over,
  };
}

test("DRC_GERBER gate: passes when GERBER_ZIP lives on the active Build (not the revision)", async () => {
  const res = await STAGES.DRC_GERBER.exitGate!(ctx({
    artifacts: [
      { id: "a1", subkind: "DRC_REPORT", stage: "DRC_GERBER" } as any,
    ],
    activeBuild: {
      id: "b1",
      boards: [],
      artifacts: [{ id: "a2", subkind: "GERBER_ZIP", stage: "DRC_GERBER" } as any],
      checklists: [],
    } as any,
  }));
  expect(res).toEqual({ ok: true });
});

test("DRC_GERBER gate: still passes when GERBER_ZIP is revision-scoped (existing behavior)", async () => {
  const res = await STAGES.DRC_GERBER.exitGate!(ctx({
    artifacts: [
      { id: "a1", subkind: "DRC_REPORT", stage: "DRC_GERBER" } as any,
      { id: "a2", subkind: "GERBER_ZIP", stage: "DRC_GERBER" } as any,
    ],
  }));
  expect(res).toEqual({ ok: true });
});

test("DRC_GERBER gate: fails with reason when no GERBER_ZIP anywhere", async () => {
  const res = await STAGES.DRC_GERBER.exitGate!(ctx({
    artifacts: [{ id: "a1", subkind: "DRC_REPORT", stage: "DRC_GERBER" } as any],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("No GERBER_ZIP artifact.");
});
```

**Step 2: Run, watch fail** — the first test will fail because the current gate only scans `artifacts`, not `activeBuild.artifacts`.

**Step 3: Implement.** Edit `src/lib/stages.ts` `STAGES.DRC_GERBER.exitGate`:

```ts
exitGate: ({ artifacts, activeBuild }) => {
  const reasons: string[] = [];
  const hasDrc = artifacts.some((a) => a.subkind === "DRC_REPORT");
  const hasGerber =
    artifacts.some((a) => a.subkind === "GERBER_ZIP") ||
    (activeBuild?.artifacts ?? []).some((a) => a.subkind === "GERBER_ZIP");
  if (!hasDrc) reasons.push("No DRC_REPORT artifact.");
  if (!hasGerber) reasons.push("No GERBER_ZIP artifact.");
  return reasons.length ? { ok: false, reasons } : { ok: true };
},
```

**Step 4: Run, watch all three new tests pass + existing gate tests stay green:**

```
pnpm vitest run stages.test
```

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/stages.test.ts
git commit -m "feat(stages): DRC_GERBER gate scans Build-scoped GERBER_ZIP as fallback"
```

### Task 14.5: Verify Phase 1 copy-forward behavior is unchanged (regression smoke)

**Files:**
- Modify: `src/lib/__tests__/revisions-actions.test.ts` (extend)

**Step 1: Write the regression test.** Per proposal §3 #9, "Build-scoped `GERBER_ZIP` is NOT copied — it's correctly tied to its originating Build and a new revision starts with no Builds. The revision-scoped `GERBER_ZIP` IS copied." Pin this:

```ts
test("createRevision copy-forward: revision-scoped GERBER_ZIP IS copied; Build-scoped is not (new rev has no Builds)", async () => {
  // 1. Set up: project + r1 with one revision-scoped GERBER_ZIP artifact + one Build with a Build-scoped GERBER_ZIP.
  // 2. Call createRevision({ projectId, fromRevisionId: r1.id, label: 'r2' }).
  // 3. Assert r2 has exactly one Artifact with subkind=GERBER_ZIP (the revision-scoped one).
  // 4. Assert r2 has zero Builds.
});
```

(Subagent: flesh out the setup using the existing `getSeedUser()` + `db.project.create()` / `db.artifact.create()` / `db.build.create()` patterns from neighboring tests.)

**Step 2: Run, expect pass with no code change** — this is purely pinning existing behavior. If it fails, the copy-forward is incorrectly copying Build-scoped artifacts; halt and investigate before continuing.

**Step 3: Commit (user-gated):**

```
git add src/lib/__tests__/revisions-actions.test.ts
git commit -m "test(revisions): pin copy-forward behavior for GERBER_ZIP (either-scoped)"
```

### Task 14.6: m14 checkpoint

**Step 1: Verify:**
- `pnpm tsc --noEmit` clean.
- `pnpm next build` succeeds.
- `pnpm vitest run` — target ~277 tests pass (271 baseline + 6 new from m14).

**Step 2: Tag (user-gated):**

```
git tag m14-r2-subkinds
```

---

# Milestone m15 — Revision-scoped Checklist

Goal: widen `Checklist` owner XOR from 2-way (Build XOR Board) to 3-way (Revision XOR Build XOR Board); add `revisionId` column + relation + index; update `checklist_owner_xor` CHECK; extend `createChecklistSchema` discriminated union with a `revision` arm; thread `revisionId` through action-layer freeze guards; add a Checklists pane to the revision detail page. Per proposal §3 #3.

### Task 15.1: Add `Checklist.revisionId` column + relation + index

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_checklist_revision_owner/migration.sql` (generated; will need raw-SQL augmentation for the CHECK update)

**Step 1: Edit `prisma/schema.prisma`.** Modify `model Checklist`:

```prisma
model Checklist {
  id          String           @id @default(cuid())
  revisionId  String?
  revision    Revision?        @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  buildId     String?
  build       Build?           @relation(fields: [buildId], references: [id], onDelete: Cascade)
  boardId     String?
  board       Board?           @relation(fields: [boardId], references: [id], onDelete: Cascade)
  stage       Stage
  subkind     ChecklistSubkind @default(GENERIC)
  title       String
  createdAt   DateTime         @default(now())
  createdById String
  createdBy   User             @relation(fields: [createdById], references: [id], onDelete: Restrict)

  items ChecklistItem[]

  @@index([revisionId, stage])
  @@index([buildId, stage])
  @@index([boardId, stage])
  @@index([stage])
  @@index([buildId, subkind])
  @@index([revisionId, subkind])
}
```

Add back-ref to `model Revision`:

```prisma
  checklists      Checklist[]
```

**Step 2: Generate migration:**

```
pnpm prisma migrate dev --name checklist_revision_owner
```

Expected: new migration with `ALTER TABLE "Checklist" ADD COLUMN "revisionId" TEXT;`, an `ALTER TABLE ... ADD CONSTRAINT "Checklist_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE`, and the two new indexes.

**Step 3: Verify:**

```
pnpm prisma validate
pnpm tsc --noEmit
```

**Step 4: Commit (user-gated):**

```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add Checklist.revisionId column + indexes"
```

### Task 15.2: Update `checklist_owner_xor` CHECK constraint to 3-way

**Files:**
- Create: `prisma/migrations/<ts>_checklist_owner_xor_3way/migration.sql`
- Test: `src/lib/__tests__/check-checklist-owner-xor.test.ts` (extend)

**Step 1: Write the failing test.** Extend the existing `check-checklist-owner-xor.test.ts`:

```ts
test("CHECK checklist_owner_xor: revision-only is now valid (3-way XOR)", async () => {
  // Set up: seed user + project + revision; ATTEMPT to insert a Checklist with only revisionId set.
  // Expect: insert succeeds (was rejected before this migration).
  const u = await getSeedUser();
  const p = await db.project.create({ data: { slug: `xor3-${Date.now()}`, name: "x", createdById: u.id } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });
  const c = await db.checklist.create({
    data: {
      revisionId: r.id,
      stage: "REQUIREMENTS",
      subkind: "GENERIC",
      title: "rev-scoped",
      createdById: u.id,
    },
  });
  expect(c.revisionId).toBe(r.id);
  expect(c.buildId).toBeNull();
  expect(c.boardId).toBeNull();
  // cleanup
  await db.checklist.delete({ where: { id: c.id } });
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});

test("CHECK checklist_owner_xor: two owners set is still rejected (revision + build)", async () => {
  // Build + Revision both set → reject.
  const u = await getSeedUser();
  const p = await db.project.create({ data: { slug: `xor3-fail-${Date.now()}`, name: "x", createdById: u.id } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });
  const b = await db.build.create({ data: { revisionId: r.id, label: "BUILD-001", boardCount: 1, createdById: u.id } });
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Checklist" (id, "revisionId", "buildId", stage, subkind, title, "createdById", "createdAt")
      VALUES ('xor3-bad', '${r.id}', '${b.id}', 'REQUIREMENTS', 'GENERIC', 'two-owner', '${u.id}', NOW())
    `),
  ).rejects.toThrow(/checklist_owner_xor/i);
  await db.build.delete({ where: { id: b.id } });
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});
```

**Step 2: Run, watch fail** — the first test fails because the existing CHECK requires exactly one of `(buildId, boardId)` — revision-only inserts are rejected.

**Step 3: Create the migration** at `prisma/migrations/<ts>_checklist_owner_xor_3way/migration.sql`:

```sql
ALTER TABLE "Checklist" DROP CONSTRAINT checklist_owner_xor;
ALTER TABLE "Checklist" ADD CONSTRAINT checklist_owner_xor CHECK (
  (CASE WHEN "revisionId" IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "buildId"    IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "boardId"    IS NULL THEN 0 ELSE 1 END) = 1
);
```

Apply with:

```
pnpm prisma migrate dev
```

**Step 4: Run, watch both tests pass:**

```
pnpm vitest run check-checklist-owner-xor
```

**Step 5: Commit (user-gated):**

```
git add prisma/migrations src/lib/__tests__/check-checklist-owner-xor.test.ts
git commit -m "feat(schema): widen checklist_owner_xor CHECK to 3-way (Revision XOR Build XOR Board)"
```

### Task 15.3: Extend `createChecklistSchema` discriminated union with a `revision` arm

**Files:**
- Modify: `src/lib/schemas/checklist.ts`
- Test: `src/lib/__tests__/checklists-actions.test.ts` (extend)

**Step 1: Write the failing test:**

```ts
test("createChecklist: accepts revision ownerKind", async () => {
  const user = await getSeedUser();
  vi.mocked(authModule.auth).mockResolvedValue({ user: { email: user.email } } as any);
  const p = await db.project.create({ data: { slug: `rev-cl-${Date.now()}`, name: "x", createdById: user.id } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });
  const c = await createChecklist({
    ownerKind: "revision",
    revisionId: r.id,
    stage: "REQUIREMENTS",
    subkind: "GENERIC",
    title: "revision-scoped checklist",
  });
  expect(c.revisionId).toBe(r.id);
  expect(c.buildId).toBeNull();
  await db.checklist.delete({ where: { id: c.id } });
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});
```

**Step 2: Run, watch fail** — Zod schema rejects `ownerKind: "revision"`.

**Step 3: Implement.** Edit `src/lib/schemas/checklist.ts`:

```ts
export const createChecklistSchema = z.discriminatedUnion("ownerKind", [
  z.object({
    ...baseCreateFields,
    ownerKind: z.literal("revision"),
    revisionId: z.cuid(),
  }),
  z.object({
    ...baseCreateFields,
    ownerKind: z.literal("build"),
    buildId: z.cuid(),
  }),
  z.object({
    ...baseCreateFields,
    ownerKind: z.literal("board"),
    boardId: z.cuid(),
  }),
]);
```

**Step 4: Run, watch fail again** — now the test compiles but the action layer still doesn't know how to dispatch on `ownerKind === "revision"`. Continue in Task 15.4.

**Step 5: Don't commit yet — wait until 15.4 lands the action-layer dispatch and both tests are green together.**

### Task 15.4: Wire `revisionId` through `createChecklist` action + freeze-guard dispatch

**Files:**
- Modify: `src/lib/actions/checklists.ts`
- Test: `src/lib/__tests__/checklists-actions.test.ts` (the test from 15.3 should now pass)

**Step 1:** Edit `src/lib/actions/checklists.ts`. Locate the `createChecklist` action body. The current code branches on `ownerKind in ('build', 'board')`. Add the `revision` arm:

```ts
export async function createChecklist(input: unknown) {
  const data = createChecklistSchema.parse(input);
  const user = await requireUser();
  return withTxRetry(() => db.$transaction(async (tx) => {
    if (data.ownerKind === "revision") {
      await assertNotFrozen(tx, data.revisionId);
      const c = await tx.checklist.create({
        data: {
          revisionId: data.revisionId,
          stage: data.stage,
          subkind: data.subkind,
          title: data.title,
          createdById: user.id,
        },
      });
      // Revalidate the revision detail page.
      const rev = await tx.revision.findUniqueOrThrow({
        where: { id: data.revisionId },
        select: { label: true, project: { select: { slug: true } } },
      });
      revalidatePath(`/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}`);
      return c;
    }
    // ...existing build / board arms unchanged...
  }, { isolationLevel: "Serializable" }));
}
```

**Step 2:** Update `resolveChecklistFreezeRefs` (and any other helper that dispatches on owner) so that when `checklist.revisionId !== null`, the freeze guard calls `assertNotFrozen(tx, checklist.revisionId)` directly. Follow the §5.3 helper-table dispatch in proposal §3 #3:

| Action | Revision-scoped dispatch |
|---|---|
| `createChecklist({ ownerKind: "revision", revisionId })` | `assertNotFrozen(tx, revisionId)` |
| `editChecklist(id)` | If `checklist.revisionId !== null` → `assertNotFrozen(tx, checklist.revisionId)` |
| `editChecklistItem(id)` | Resolve item's checklist; dispatch on its owner |
| `deleteChecklist(id)` / `deleteChecklistItem(id)` | Same dispatch |
| `reorderChecklistItems(checklistId)` | Same dispatch |

**Step 3: Run all checklist tests:**

```
pnpm vitest run checklists
```

Expected: the new test from 15.3 passes; all existing Build/Board-scoped tests stay green.

**Step 4: Commit (user-gated)** — bundle Tasks 15.3 + 15.4 commit since they're co-dependent:

```
git add src/lib/schemas/checklist.ts src/lib/actions/checklists.ts src/lib/__tests__/checklists-actions.test.ts
git commit -m "feat(checklists): revision ownerKind in createChecklist + freeze-guard dispatch"
```

### Task 15.5: Update `loadGateContext` to surface revision-scoped checklists

**Files:**
- Modify: `src/lib/load-gate-context.ts`
- Modify: `src/lib/stages.ts` (extend `GateContext` interface)
- Test: `src/lib/__tests__/load-gate-context.test.ts` (extend)

**Step 1: Write the failing test:**

```ts
test("loadGateContext: includes revision-scoped checklists at the current stage", async () => {
  const user = await getSeedUser();
  const p = await db.project.create({ data: { slug: `lgc-${Date.now()}`, name: "x", createdById: user.id } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });
  const c = await db.checklist.create({
    data: {
      revisionId: r.id,
      stage: "REQUIREMENTS",
      subkind: "GENERIC",
      title: "rev-scoped",
      createdById: user.id,
    },
  });
  const ctx = await loadGateContext(db, r.id);
  expect(ctx.revisionChecklists.map((cl) => cl.id)).toContain(c.id);
  // cleanup
  await db.checklist.delete({ where: { id: c.id } });
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});
```

**Step 2: Run, watch fail** — `revisionChecklists` doesn't exist on the context yet.

**Step 3: Implement.** Extend `GateContext` in `src/lib/stages.ts`:

```ts
export interface GateContext {
  revision: Pick<Revision, "id" | "currentStage" | "schematicCommit" | "layoutCommit">;
  bomLines: (BomLine & { part: Part })[];
  artifacts: Artifact[];
  revisionChecklists: (Checklist & { items: ChecklistItem[] })[];  // NEW
  activeBuild:
    | (Build & {
        boards: Board[];
        artifacts: Artifact[];
        checklists: (Checklist & { items: ChecklistItem[] })[];
      })
    | null;
}
```

In `src/lib/load-gate-context.ts`, add the loader:

```ts
const revisionChecklists = await tx.checklist.findMany({
  where: { revisionId },
  include: { items: true },
});

return { revision, bomLines, artifacts, revisionChecklists, activeBuild };
```

Note: load ALL revision-scoped checklists, not just current-stage — gates (REQUIREMENTS_REVIEW, LAYOUT_REVIEW, STRIPBOARD_VALIDATION) each match by `subkind` not by stage, and the subkind→stage mapping is encoded inside each gate predicate (m16, m17).

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/load-gate-context.ts src/lib/stages.ts src/lib/__tests__/load-gate-context.test.ts
git commit -m "feat(gate-ctx): surface revisionChecklists in GateContext"
```

### Task 15.6: Checklists pane on revision detail page

**Files:**
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (or wherever revision detail is)
- Create: `src/components/RevisionChecklistsPane.tsx`

**Step 1:** Discover the revision detail route — it's `src/app/projects/[slug]/[revLabel]/page.tsx` based on `src/app/projects/[slug]/` layout. Confirm by reading.

**Step 2:** Server component fetches `db.checklist.findMany({ where: { revisionId: rev.id }, include: { items: true } })` and passes to `RevisionChecklistsPane`. Render list of checklists (one row per checklist with subkind + title + completion ratio) + a "New revision-scoped checklist" button that links to a create form. Visibility: render the pane on REQUIREMENTS, SCHEMATIC, BOM_SOURCING, LAYOUT (not later stages — per proposal §3 #3, "Visibility scoped to stages where revision-scoped checklists make sense (REQUIREMENTS through LAYOUT)").

**Step 3:** Render-walk test verifying the pane includes a row for a seeded revision-scoped checklist. Match the existing Build/Board checklist-pane render-test pattern (`src/lib/__tests__/` already has similar fixtures).

**Step 4: Verify build:**

```
pnpm next build
```

**Step 5: Commit (user-gated):**

```
git add src/app/projects src/components/RevisionChecklistsPane.tsx
git commit -m "feat(revisions): revision-scoped checklists pane on detail page"
```

### Task 15.7: m15 checkpoint

**Step 1: Verify:**
- `pnpm tsc --noEmit` clean.
- `pnpm next build` succeeds.
- `pnpm vitest run` — target ~283 tests pass (277 from m14 + 6 new from m15).

**Step 2: Smoke check (manual):**
Start `pnpm dev`, navigate to a revision detail page, create a revision-scoped checklist via the new pane, add a couple of items, mark some checked — observe the pane updates.

**Step 3: Tag (user-gated):**

```
git tag m15-revision-checklist
```

---

# Milestone m16 — Canonical review checklists + `notApplicable` + ASSEMBLY gate predicate fix

Goal: add `REQUIREMENTS_REVIEW` + `LAYOUT_REVIEW` to `ChecklistSubkind`; add `ChecklistItem.notApplicable` column with `checklist_item_checked_xor_napplicable` CHECK; seed canonical templates as TypeScript-literal JSON; add REQUIREMENTS exit + LAYOUT exit gate predicates that consume the canonical checklists; **fix the load-bearing ASSEMBLY gate predicate at `src/lib/stages.ts:291`** to handle empty checklists (now fails the gate explicitly with "no items" reason) and N/A items (no longer block ASSEMBLY); add Zod refinement preventing `checked === true && notApplicable === true`. Per proposal §3 #10.

### Task 16.1: Add `REQUIREMENTS_REVIEW` + `LAYOUT_REVIEW` to `ChecklistSubkind` enum

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_checklist_review_subkinds/migration.sql` (generated)

**Step 1: Edit `prisma/schema.prisma`.** Extend the enum:

```prisma
enum ChecklistSubkind {
  GENERIC
  EQUIPMENT_PREFLIGHT
  SCREENING_STEP_0
  ASSEMBLY_STEPS
  POST_ASSEMBLY_CONTINUITY
  POLARITY_VERIFICATION
  REQUIREMENTS_REVIEW       // NEW — gated at REQUIREMENTS exit
  LAYOUT_REVIEW             // NEW — gated at LAYOUT exit
}
```

**Step 2: Generate migration:**

```
pnpm prisma migrate dev --name checklist_review_subkinds
```

**Step 3: Verify schema + types:**

```
pnpm prisma validate
pnpm tsc --noEmit
```

**Step 4: Commit (user-gated):**

```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add REQUIREMENTS_REVIEW + LAYOUT_REVIEW ChecklistSubkinds"
```

### Task 16.2: Add `ChecklistItem.notApplicable` column

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_checklist_item_napplicable/migration.sql` (generated)

**Step 1: Edit `prisma/schema.prisma`.** Add `notApplicable` to `ChecklistItem`:

```prisma
model ChecklistItem {
  id            String    @id @default(cuid())
  checklistId   String
  checklist     Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  ordinal       Int
  label         String
  expectedValue String?
  actualValue   String?
  checked       Boolean   @default(false)
  notApplicable Boolean   @default(false)
  completedAt   DateTime?
  completedById String?
  completedBy   User?     @relation("CompletedBy", fields: [completedById], references: [id], onDelete: Restrict)

  @@unique([checklistId, ordinal])
}
```

**Step 2: Generate migration:**

```
pnpm prisma migrate dev --name checklist_item_napplicable
```

Expected: `ALTER TABLE "ChecklistItem" ADD COLUMN "notApplicable" BOOLEAN NOT NULL DEFAULT false;`. Existing rows backfill `false`.

**Step 3: Verify:**

```
pnpm prisma validate
pnpm tsc --noEmit
```

**Step 4: Commit (user-gated):**

```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add ChecklistItem.notApplicable column"
```

### Task 16.3: Raw-migration CHECK `checklist_item_checked_xor_napplicable` + negative-insert test

**Files:**
- Create: `prisma/migrations/<ts>_checklist_item_checked_xor_napplicable/migration.sql`
- Create: `src/lib/__tests__/check-checklist-item-checked-xor-napplicable.test.ts`

**Step 1: Write the failing test:**

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";

describe("CHECK checklist_item_checked_xor_napplicable", () => {
  let userId: string;
  let projectId: string;
  let revisionId: string;
  let checklistId: string;

  beforeAll(async () => {
    const u = await db.user.upsert({ where: { email: "test-cxn@example.com" }, update: {}, create: { email: "test-cxn@example.com" } });
    userId = u.id;
    const p = await db.project.create({ data: { slug: `test-cxn-${Date.now()}`, name: "cxn", createdById: userId } });
    projectId = p.id;
    const r = await db.revision.create({ data: { projectId, label: "v1" } });
    revisionId = r.id;
    const c = await db.checklist.create({
      data: { revisionId, stage: "REQUIREMENTS", subkind: "GENERIC", title: "x", createdById: userId },
    });
    checklistId = c.id;
  });

  afterAll(async () => {
    await db.project.delete({ where: { id: projectId } });
  });

  test("rejects an item with checked=true AND notApplicable=true", async () => {
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "ChecklistItem" (id, "checklistId", ordinal, label, checked, "notApplicable")
        VALUES ('cxn-bad-1', '${checklistId}', 99, 'bad', true, true)
      `),
    ).rejects.toThrow(/checklist_item_checked_xor_napplicable/i);
  });

  test("allows checked=true, notApplicable=false", async () => {
    const id = `cxn-ok-c-${Date.now()}`;
    await db.$executeRawUnsafe(`
      INSERT INTO "ChecklistItem" (id, "checklistId", ordinal, label, checked, "notApplicable")
      VALUES ('${id}', '${checklistId}', 100, 'ok-c', true, false)
    `);
    await db.checklistItem.delete({ where: { id } });
  });

  test("allows checked=false, notApplicable=true", async () => {
    const id = `cxn-ok-na-${Date.now()}`;
    await db.$executeRawUnsafe(`
      INSERT INTO "ChecklistItem" (id, "checklistId", ordinal, label, checked, "notApplicable")
      VALUES ('${id}', '${checklistId}', 101, 'ok-na', false, true)
    `);
    await db.checklistItem.delete({ where: { id } });
  });
});
```

**Step 2: Run, watch first test fail (the bad insert succeeds today, no CHECK in place):**

```
pnpm vitest run check-checklist-item-checked-xor-napplicable
```

**Step 3: Create the migration** at `prisma/migrations/<ts>_checklist_item_checked_xor_napplicable/migration.sql`:

```sql
ALTER TABLE "ChecklistItem"
ADD CONSTRAINT checklist_item_checked_xor_napplicable
CHECK (NOT ("checked" AND "notApplicable"));
```

Apply:

```
pnpm prisma migrate dev
```

**Step 4: Re-run, watch all three tests pass.**

**Step 5: Commit (user-gated):**

```
git add prisma/migrations src/lib/__tests__/check-checklist-item-checked-xor-napplicable.test.ts
git commit -m "feat(schema): CHECK checklist_item_checked_xor_napplicable + negative-insert test"
```

### Task 16.4: Zod refinement preventing `checked === true && notApplicable === true`

**Files:**
- Modify: `src/lib/schemas/checklist.ts`
- Test: `src/lib/__tests__/checklists-actions.test.ts` (extend, OR a dedicated unit test file)

**Step 1: Write the failing test.** Append to `src/lib/__tests__/checklists-actions.test.ts`:

```ts
import { editChecklistItemSchema } from "@/lib/schemas/checklist";

test("editChecklistItemSchema: rejects checked=true AND notApplicable=true with canonical message", () => {
  expect(() =>
    editChecklistItemSchema.parse({
      id: "cltest" + "x".repeat(20),
      checked: true,
      notApplicable: true,
    }),
  ).toThrow(/cannot be both checked and N\/A/i);
});

test("editChecklistItemSchema: accepts checked=true alone", () => {
  expect(() =>
    editChecklistItemSchema.parse({
      id: "cltest" + "x".repeat(20),
      checked: true,
    }),
  ).not.toThrow();
});

test("editChecklistItemSchema: accepts notApplicable=true alone", () => {
  expect(() =>
    editChecklistItemSchema.parse({
      id: "cltest" + "x".repeat(20),
      notApplicable: true,
    }),
  ).not.toThrow();
});
```

(Note: cuid validation will reject the dummy id. Use a real cuid pattern — generate via `import { createId } from "@paralleldrive/cuid2"` if available, or use a known-valid hardcoded cuid string like `"cl9z0jjg100007bsh4d9c4n3h"` for the test fixture.)

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/schemas/checklist.ts`:

```ts
export const editChecklistItemSchema = z
  .object({
    id: z.cuid(),
    label: z.string().trim().min(1).max(500).optional(),
    expectedValue: z.union([z.string().max(500), z.null()]).optional(),
    actualValue: z.union([z.string().max(500), z.null()]).optional(),
    checked: z.boolean().optional(),
    notApplicable: z.boolean().optional(),
  })
  .refine(
    (d) => !(d.checked === true && d.notApplicable === true),
    { message: "An item cannot be both checked and N/A simultaneously.", path: ["notApplicable"] },
  );

export type EditChecklistItemInput = z.infer<typeof editChecklistItemSchema>;
```

Apply the same refinement to `addChecklistItemSchema` for defense-in-depth (per proposal §3 #10):

```ts
export const addChecklistItemSchema = z
  .object({
    checklistId: z.cuid(),
    label: z.string().trim().min(1).max(500),
    expectedValue: z.string().trim().max(500).optional(),
    ordinal: z.int().nonnegative().optional(),
    notApplicable: z.boolean().optional().default(false),
  })
  .refine(
    (d) => !(d.notApplicable === true),  // checked defaults to false on insert; only N/A is settable at create
    // Actually — allow notApplicable on create (creation defaults checked: false), so the refinement is trivially satisfied.
    // The real refinement is the same as editChecklistItemSchema's: refuse if both true. createChecklistItem doesn't accept `checked` on the wire today, so we'll just trust the default.
    () => true,
    { message: "An item cannot be both checked and N/A simultaneously.", path: ["notApplicable"] },
  );
```

Re-verify: the `addChecklistItem` action doesn't expose `checked` on the input — confirm by reading the schema. If `checked` is never settable on create, the refinement collapses; skip the `addChecklistItemSchema` refine and leave only `editChecklistItemSchema`'s.

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/schemas/checklist.ts src/lib/__tests__/checklists-actions.test.ts
git commit -m "feat(checklists): Zod refinement prevents checked+notApplicable simultaneously"
```

### Task 16.5: ASSEMBLY gate predicate fix at `src/lib/stages.ts:291`

**CRITICAL** — this is the load-bearing change in m16. Must ship in the same commit pair as 16.3 (the CHECK constraint) so `notApplicable` is enforced at both the DB and the gate.

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/gate-assembly-e2e.test.ts` (extend)

**Step 1: Write the failing tests.** Append to `src/lib/__tests__/gate-assembly-e2e.test.ts`:

```ts
test("ASSEMBLY gate: passes when continuity checklist has N/A items + checked items only", async () => {
  // Setup: build with one ASSEMBLED board + a POST_ASSEMBLY_CONTINUITY checklist
  // with items: { checked: true }, { checked: true }, { notApplicable: true, checked: false }
  // → expect gate ok: true.
});

test("ASSEMBLY gate: FAILS when continuity checklist has zero items (was vacuous-pass before predicate fix)", async () => {
  // Setup: build with one ASSEMBLED board + a POST_ASSEMBLY_CONTINUITY checklist with NO items.
  // → expect reasons to include "POST_ASSEMBLY_CONTINUITY Checklist has no items."
});

test("ASSEMBLY gate: FAILS when continuity checklist has one unchecked, non-N/A item", async () => {
  // Setup: as above but one item with checked=false, notApplicable=false.
  // → expect reasons to include "POST_ASSEMBLY_CONTINUITY Checklist has unchecked items."
});
```

**Step 2: Run, watch fail.** The empty-checklist case currently silently passes (the existing `items.some()` returns `false` on empty array, so no reason is pushed). The N/A case currently fails because `!i.checked` is true for the N/A item.

**Step 3: Implement.** Edit `src/lib/stages.ts` `STAGES.ASSEMBLY.exitGate` — replace the predicate block at line ~287–294:

```ts
const continuity = activeBuild.checklists.find(
  (c) => c.subkind === "POST_ASSEMBLY_CONTINUITY",
);
if (!continuity) {
  reasons.push("No POST_ASSEMBLY_CONTINUITY Checklist on the active Build.");
} else if (continuity.items.length === 0) {
  reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has no items.");
} else if (continuity.items.some((i) => !i.checked && !i.notApplicable)) {
  reasons.push("POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.");
}
```

Note the structure: `items.length === 0 || items.some(...)` — apply this pattern to every review-checklist gate (REQUIREMENTS_REVIEW, LAYOUT_REVIEW, STRIPBOARD_VALIDATION) when they're added in subsequent tasks.

**Step 4: Run, watch all three new tests pass + the existing ASSEMBLY gate tests stay green:**

```
pnpm vitest run gate-assembly-e2e
pnpm vitest run stages
```

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/gate-assembly-e2e.test.ts
git commit -m "fix(stages): ASSEMBLY gate handles empty checklists + notApplicable items"
```

### Task 16.6: Seed canonical templates as TypeScript-literal JSON

**Files:**
- Create: `src/lib/canonical-checklist-templates.ts`
- Test: `src/lib/__tests__/canonical-checklist-templates.test.ts`

**Step 1: Write the failing test:**

```ts
import { describe, test, expect } from "vitest";
import { CANONICAL_TEMPLATES, type CanonicalTemplate } from "@/lib/canonical-checklist-templates";

describe("canonical checklist templates", () => {
  test("REQUIREMENTS_REVIEW template has 4 canonical items", () => {
    const t = CANONICAL_TEMPLATES.REQUIREMENTS_REVIEW;
    expect(t.subkind).toBe("REQUIREMENTS_REVIEW");
    expect(t.stage).toBe("REQUIREMENTS");
    expect(t.items.length).toBe(4);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/WS2812 level-shift/i),
      expect.stringMatching(/Servo brownout/i),
      expect.stringMatching(/ADC1-only/i),
      expect.stringMatching(/Auto-shutoff/i),
    ]);
  });

  test("LAYOUT_REVIEW template has 2 canonical items", () => {
    const t = CANONICAL_TEMPLATES.LAYOUT_REVIEW;
    expect(t.subkind).toBe("LAYOUT_REVIEW");
    expect(t.stage).toBe("LAYOUT");
    expect(t.items.length).toBe(2);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Antenna keep-out/i),
      expect.stringMatching(/Isolation barrier/i),
    ]);
  });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement** `src/lib/canonical-checklist-templates.ts`:

```ts
// Canonical checklist templates (proposal §3 #10).
//
// These are TypeScript-literal JSON shapes (not seeded into the DB at build
// time). The materialize-template action turns one of these into a real
// `Checklist` + `ChecklistItem` rows on demand for a given Revision.

import type { ChecklistSubkind, Stage } from "@prisma/client";

export interface CanonicalItem {
  label: string;
  // hint about when the item is typically N/A — not enforced, just guidance for UI
  notApplicableHint?: string;
}

export interface CanonicalTemplate {
  subkind: ChecklistSubkind;
  stage: Stage;
  title: string;
  items: CanonicalItem[];
}

export const CANONICAL_TEMPLATES: Record<"REQUIREMENTS_REVIEW" | "LAYOUT_REVIEW", CanonicalTemplate> = {
  REQUIREMENTS_REVIEW: {
    subkind: "REQUIREMENTS_REVIEW",
    stage: "REQUIREMENTS",
    title: "REQUIREMENTS review checklist",
    items: [
      { label: "WS2812 level-shift strategy chosen (74AHCT125 / SK6812 / 4.5V strip rail).", notApplicableHint: "N/A if no addressable LED." },
      { label: "Servo brownout mitigation strategy chosen (bulk cap + separate supply rail).", notApplicableHint: "N/A if no servo." },
      { label: "ADC1-only constraint recorded (ADC2 unusable while WiFi/ESP-NOW active).", notApplicableHint: "N/A if no internal ADC." },
      { label: "Auto-shutoff prevention strategy chosen (idle current spec + USB-PD wall source vs power bank vs always-on draw)." },
    ],
  },
  LAYOUT_REVIEW: {
    subkind: "LAYOUT_REVIEW",
    stage: "LAYOUT",
    title: "LAYOUT review checklist",
    items: [
      { label: "Antenna keep-out present in layout (no copper/traces under WROOM antenna end)." },
      { label: "Isolation barrier post-regulator added on analog side.", notApplicableHint: "N/A if no isolation barrier." },
    ],
  },
};
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/canonical-checklist-templates.ts src/lib/__tests__/canonical-checklist-templates.test.ts
git commit -m "feat(checklists): canonical REQUIREMENTS_REVIEW + LAYOUT_REVIEW templates"
```

### Task 16.7: `materializeCanonicalChecklist` server action

**Files:**
- Create: `src/lib/schemas/canonical-checklist.ts`
- Modify: `src/lib/actions/checklists.ts` (append new export)
- Test: `src/lib/__tests__/checklists-actions.test.ts` (extend)

**Step 1: Write the failing test:**

```ts
test("materializeCanonicalChecklist: REQUIREMENTS_REVIEW creates a revision-scoped checklist + 4 items", async () => {
  const user = await getSeedUser();
  vi.mocked(authModule.auth).mockResolvedValue({ user: { email: user.email } } as any);
  const p = await db.project.create({ data: { slug: `mat-rr-${Date.now()}`, name: "x", createdById: user.id } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });

  const c = await materializeCanonicalChecklist({ revisionId: r.id, templateKey: "REQUIREMENTS_REVIEW" });

  expect(c.revisionId).toBe(r.id);
  expect(c.subkind).toBe("REQUIREMENTS_REVIEW");
  expect(c.stage).toBe("REQUIREMENTS");
  const items = await db.checklistItem.findMany({ where: { checklistId: c.id }, orderBy: { ordinal: "asc" } });
  expect(items.length).toBe(4);
  expect(items[0].label).toMatch(/WS2812 level-shift/i);

  // cleanup
  await db.checklist.delete({ where: { id: c.id } });
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});

test("materializeCanonicalChecklist: refuses to materialize twice for the same (revisionId, templateKey)", async () => {
  // ... call once, expect ok; call again, expect "already materialized" error.
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** Create `src/lib/schemas/canonical-checklist.ts`:

```ts
import { z } from "zod";

export const materializeCanonicalChecklistSchema = z.object({
  revisionId: z.cuid(),
  templateKey: z.enum(["REQUIREMENTS_REVIEW", "LAYOUT_REVIEW"]),
});

export type MaterializeCanonicalChecklistInput = z.infer<typeof materializeCanonicalChecklistSchema>;
```

In `src/lib/actions/checklists.ts`, append:

```ts
import { CANONICAL_TEMPLATES } from "@/lib/canonical-checklist-templates";
import { materializeCanonicalChecklistSchema } from "@/lib/schemas/canonical-checklist";

export async function materializeCanonicalChecklist(input: unknown) {
  const data = materializeCanonicalChecklistSchema.parse(input);
  const user = await requireUser();
  const template = CANONICAL_TEMPLATES[data.templateKey];

  return withTxRetry(() => db.$transaction(async (tx) => {
    await assertNotFrozen(tx, data.revisionId);

    // Guard: refuse to materialize twice.
    const existing = await tx.checklist.findFirst({
      where: { revisionId: data.revisionId, subkind: template.subkind },
    });
    if (existing) {
      throw new Error(`A ${template.subkind} checklist already exists for this revision.`);
    }

    const c = await tx.checklist.create({
      data: {
        revisionId: data.revisionId,
        stage: template.stage,
        subkind: template.subkind,
        title: template.title,
        createdById: user.id,
        items: {
          create: template.items.map((it, idx) => ({
            ordinal: idx,
            label: it.label,
          })),
        },
      },
    });

    const rev = await tx.revision.findUniqueOrThrow({
      where: { id: data.revisionId },
      select: { label: true, project: { select: { slug: true } } },
    });
    revalidatePath(`/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}`);
    return c;
  }, { isolationLevel: "Serializable" }));
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/schemas/canonical-checklist.ts src/lib/actions/checklists.ts src/lib/__tests__/checklists-actions.test.ts
git commit -m "feat(checklists): materializeCanonicalChecklist action"
```

### Task 16.8: REQUIREMENTS gate predicate consuming REQUIREMENTS_REVIEW checklist

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/stages.test.ts` (extend) + a new e2e test pinning advanceStage behavior

**Step 1: Write the failing tests.** Append to `src/lib/__tests__/stages.test.ts`:

```ts
test("REQUIREMENTS gate: passes when REQUIREMENTS_REVIEW checklist exists with all items checked or N/A", async () => {
  const res = await STAGES.REQUIREMENTS.exitGate!(ctx({
    artifacts: [{ id: "a1", stage: "REQUIREMENTS", subkind: "REQUIREMENTS_DOC" } as any],
    revisionChecklists: [{
      id: "cl1", subkind: "REQUIREMENTS_REVIEW", stage: "REQUIREMENTS",
      items: [
        { id: "i1", checked: true,  notApplicable: false } as any,
        { id: "i2", checked: false, notApplicable: true  } as any,
      ],
    } as any],
  }));
  expect(res).toEqual({ ok: true });
});

test("REQUIREMENTS gate: fails when REQUIREMENTS_REVIEW checklist is missing entirely", async () => {
  const res = await STAGES.REQUIREMENTS.exitGate!(ctx({
    artifacts: [{ id: "a1", stage: "REQUIREMENTS", subkind: "REQUIREMENTS_DOC" } as any],
    revisionChecklists: [],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("No REQUIREMENTS_REVIEW Checklist on the revision.");
});

test("REQUIREMENTS gate: fails with 'no items' when REQUIREMENTS_REVIEW checklist is empty", async () => {
  const res = await STAGES.REQUIREMENTS.exitGate!(ctx({
    artifacts: [{ id: "a1", stage: "REQUIREMENTS", subkind: "REQUIREMENTS_DOC" } as any],
    revisionChecklists: [{ id: "cl1", subkind: "REQUIREMENTS_REVIEW", stage: "REQUIREMENTS", items: [] } as any],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("REQUIREMENTS_REVIEW Checklist has no items.");
});

test("REQUIREMENTS gate: fails with 'unchecked' when one item is checked=false, notApplicable=false", async () => {
  const res = await STAGES.REQUIREMENTS.exitGate!(ctx({
    artifacts: [{ id: "a1", stage: "REQUIREMENTS", subkind: "REQUIREMENTS_DOC" } as any],
    revisionChecklists: [{
      id: "cl1", subkind: "REQUIREMENTS_REVIEW", stage: "REQUIREMENTS",
      items: [{ id: "i1", checked: false, notApplicable: false } as any],
    } as any],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("REQUIREMENTS_REVIEW Checklist has unchecked items.");
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/stages.ts` `STAGES.REQUIREMENTS.exitGate`. Update the existing predicate to also consume the REQUIREMENTS_REVIEW checklist:

```ts
exitGate: ({ artifacts, revisionChecklists }) => {
  const reasons: string[] = [];
  const present = artifacts.some((a) => a.stage === "REQUIREMENTS");
  if (!present) reasons.push("No requirements artifact at this stage.");

  const review = revisionChecklists.find((c) => c.subkind === "REQUIREMENTS_REVIEW");
  if (!review) {
    reasons.push("No REQUIREMENTS_REVIEW Checklist on the revision.");
  } else if (review.items.length === 0) {
    reasons.push("REQUIREMENTS_REVIEW Checklist has no items.");
  } else if (review.items.some((i) => !i.checked && !i.notApplicable)) {
    reasons.push("REQUIREMENTS_REVIEW Checklist has unchecked items.");
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
},
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/stages.test.ts
git commit -m "feat(stages): REQUIREMENTS gate consumes REQUIREMENTS_REVIEW checklist"
```

### Task 16.9: LAYOUT gate predicate consuming LAYOUT_REVIEW checklist

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/stages.test.ts` (extend)

**Step 1: Write the failing tests.** Mirror Task 16.8's 4 tests, swapping REQUIREMENTS_REVIEW for LAYOUT_REVIEW and REQUIREMENTS for LAYOUT, with `revision.layoutCommit` set + a `LAYOUT_FILE` artifact in the setup so the rest of the LAYOUT gate passes.

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/stages.ts` `STAGES.LAYOUT.exitGate`:

```ts
exitGate: ({ revision, artifacts, revisionChecklists }) => {
  const reasons: string[] = [];
  const present = artifacts.some((a) => a.stage === "LAYOUT");
  if (!present) reasons.push("No layout artifact at this stage.");
  if (!revision.layoutCommit) reasons.push("layoutCommit not pinned on the revision.");

  const review = revisionChecklists.find((c) => c.subkind === "LAYOUT_REVIEW");
  if (!review) {
    reasons.push("No LAYOUT_REVIEW Checklist on the revision.");
  } else if (review.items.length === 0) {
    reasons.push("LAYOUT_REVIEW Checklist has no items.");
  } else if (review.items.some((i) => !i.checked && !i.notApplicable)) {
    reasons.push("LAYOUT_REVIEW Checklist has unchecked items.");
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
},
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/stages.test.ts
git commit -m "feat(stages): LAYOUT gate consumes LAYOUT_REVIEW checklist"
```

### Task 16.10: UI — N/A toggle on checklist item rows

**Files:**
- Modify: wherever ChecklistItem rows render (likely `src/components/ChecklistItem*.tsx` — discover via Grep)
- Modify: the action that backs the "edit item" UI

**Step 1:** Grep for `ChecklistItem` rendering — likely `src/components/ChecklistItemRow.tsx` or similar. Add an N/A toggle next to the checked checkbox.

**Step 2:** The toggle posts to `editChecklistItem({ id, notApplicable: true })` (the Zod refinement from Task 16.4 prevents accidentally also passing `checked: true`).

**Step 3:** When `notApplicable === true`, render the item with a strikethrough + an `N/A` badge instead of the checkbox.

**Step 4:** Render-walk test verifying the strikethrough + badge appear when `notApplicable === true`.

**Step 5: Commit (user-gated):**

```
git add src/components/ChecklistItem<whichever>.tsx
git commit -m "feat(checklists): N/A toggle on checklist item rows"
```

### Task 16.11: m16 checkpoint

**Step 1: Verify:**
- `pnpm tsc --noEmit` clean.
- `pnpm next build` succeeds.
- `pnpm vitest run` — target ~301 tests pass (283 from m15 + ~18 from m16 tasks).

**Step 2: Smoke check (manual):**
Start `pnpm dev`, on a fresh revision: materialize the REQUIREMENTS_REVIEW canonical checklist; check items; mark one as N/A; observe the strikethrough + badge; attempt to advance from REQUIREMENTS → gate passes only when every item is checked OR N/A.

**Step 3: Tag (user-gated):**

```
git tag m16-canonical-checklists
```

---

# Milestone m17 — Stripboard-validation checklist + gate + regress hook

Goal: add `STRIPBOARD_VALIDATION` to `ChecklistSubkind`; add a canonical template; add a BOM_SOURCING→LAYOUT gate that, when `project.requiresStripboard === true`, requires a STRIPBOARD_VALIDATION checklist with all items checked-or-N/A; add a LAYOUT→BOM_SOURCING regress side-effect that flips `checked = false` on every item in any STRIPBOARD_VALIDATION checklist on the revision while preserving `completedAt` / `completedById`. Per proposal §3 #4.

### Task 17.1: Add `STRIPBOARD_VALIDATION` to `ChecklistSubkind` + canonical template

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/canonical-checklist-templates.ts`
- Create: `prisma/migrations/<ts>_stripboard_validation_subkind/migration.sql` (generated)
- Test: `src/lib/__tests__/canonical-checklist-templates.test.ts` (extend)

**Step 1: Edit `prisma/schema.prisma`:**

```prisma
enum ChecklistSubkind {
  GENERIC
  EQUIPMENT_PREFLIGHT
  SCREENING_STEP_0
  ASSEMBLY_STEPS
  POST_ASSEMBLY_CONTINUITY
  POLARITY_VERIFICATION
  REQUIREMENTS_REVIEW
  LAYOUT_REVIEW
  STRIPBOARD_VALIDATION       // NEW — gated at BOM_SOURCING exit when project.requiresStripboard
}
```

**Step 2: Generate migration:**

```
pnpm prisma migrate dev --name stripboard_validation_subkind
```

**Step 3: Write the failing test** for the canonical template. Append to `src/lib/__tests__/canonical-checklist-templates.test.ts`:

```ts
test("STRIPBOARD_VALIDATION template has 5 canonical items", () => {
  const t = CANONICAL_TEMPLATES.STRIPBOARD_VALIDATION;
  expect(t.subkind).toBe("STRIPBOARD_VALIDATION");
  expect(t.stage).toBe("BOM_SOURCING");
  expect(t.items.length).toBe(5);
  expect(t.items.map((i) => i.label)).toEqual([
    expect.stringMatching(/Topology validated/i),
    expect.stringMatching(/Shared rails identified/i),
    expect.stringMatching(/Power-rail track doubled/i),
    expect.stringMatching(/Firmware bring-up complete on stripboard/i),
    expect.stringMatching(/Bring-up measurements captured/i),
  ]);
});
```

**Step 4: Implement.** Edit `src/lib/canonical-checklist-templates.ts`:

```ts
export const CANONICAL_TEMPLATES: Record<
  "REQUIREMENTS_REVIEW" | "LAYOUT_REVIEW" | "STRIPBOARD_VALIDATION",
  CanonicalTemplate
> = {
  REQUIREMENTS_REVIEW: { /* …unchanged… */ },
  LAYOUT_REVIEW:       { /* …unchanged… */ },
  STRIPBOARD_VALIDATION: {
    subkind: "STRIPBOARD_VALIDATION",
    stage: "BOM_SOURCING",
    title: "STRIPBOARD validation checklist",
    items: [
      { label: "Topology validated on stripboard prototype." },
      { label: "Shared rails identified; cut points planned." },
      { label: "Power-rail track doubled (high-current trace lead-in)." },
      { label: "Firmware bring-up complete on stripboard before PCB layout." },
      { label: "Bring-up measurements captured (link to Measurement IDs)." },
    ],
  },
};
```

Also extend `materializeCanonicalChecklistSchema` in `src/lib/schemas/canonical-checklist.ts`:

```ts
templateKey: z.enum(["REQUIREMENTS_REVIEW", "LAYOUT_REVIEW", "STRIPBOARD_VALIDATION"]),
```

**Step 5: Run, watch pass.**

**Step 6: Commit (user-gated):**

```
git add prisma/schema.prisma prisma/migrations src/lib/canonical-checklist-templates.ts src/lib/schemas/canonical-checklist.ts src/lib/__tests__/canonical-checklist-templates.test.ts
git commit -m "feat(checklists): STRIPBOARD_VALIDATION subkind + canonical template"
```

### Task 17.2: Extend `loadGateContext` to surface `project.requiresStripboard`

**Files:**
- Modify: `src/lib/load-gate-context.ts`
- Modify: `src/lib/stages.ts` (extend `GateContext`)
- Test: `src/lib/__tests__/load-gate-context.test.ts` (extend)

**Step 1: Write the failing test:**

```ts
test("loadGateContext: includes project.requiresStripboard", async () => {
  const user = await getSeedUser();
  const p = await db.project.create({ data: { slug: `lgc-strip-${Date.now()}`, name: "x", createdById: user.id, requiresStripboard: true } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });
  const ctx = await loadGateContext(db, r.id);
  expect(ctx.project.requiresStripboard).toBe(true);
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});
```

**Step 2: Run, watch fail** (`ctx.project` doesn't exist).

**Step 3: Implement.** In `src/lib/stages.ts`, extend `GateContext`:

```ts
export interface GateContext {
  revision: Pick<Revision, "id" | "currentStage" | "schematicCommit" | "layoutCommit">;
  project: Pick<Project, "id" | "requiresStripboard" | "hasMainsNet">;  // NEW (hasMainsNet anticipates m18)
  bomLines: (BomLine & { part: Part })[];
  artifacts: Artifact[];
  revisionChecklists: (Checklist & { items: ChecklistItem[] })[];
  activeBuild: /* …unchanged… */ | null;
}
```

(Note: `hasMainsNet` doesn't exist yet — it lands in m18. Either add a fallback in the loader or split the GateContext extension into two parts. Pragmatic approach: surface only `requiresStripboard` now; m18 Task 18.2 will widen the Pick to include `hasMainsNet`.)

Update load-gate-context.ts:

```ts
const project = await tx.project.findFirstOrThrow({
  where: { revisions: { some: { id: revisionId } } },
  select: { id: true, requiresStripboard: true },
});
return { revision, project, bomLines, artifacts, revisionChecklists, activeBuild };
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/load-gate-context.ts src/lib/stages.ts src/lib/__tests__/load-gate-context.test.ts
git commit -m "feat(gate-ctx): surface project.requiresStripboard in GateContext"
```

### Task 17.3: BOM_SOURCING exit gate hook for STRIPBOARD_VALIDATION

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/stages.test.ts` (extend)

**Step 1: Write the failing tests:**

```ts
test("BOM_SOURCING gate: when requiresStripboard=false, STRIPBOARD_VALIDATION is not consulted", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: false } as any,
    bomLines: [{ part: { datasheetUrl: "https://x", lifecycle: "ACTIVE" } } as any],
    revisionChecklists: [],
  }));
  expect(res).toEqual({ ok: true });
});

test("BOM_SOURCING gate: when requiresStripboard=true, missing STRIPBOARD_VALIDATION fails the gate", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: true } as any,
    bomLines: [{ part: { datasheetUrl: "https://x", lifecycle: "ACTIVE" } } as any],
    revisionChecklists: [],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("No STRIPBOARD_VALIDATION Checklist on the revision.");
});

test("BOM_SOURCING gate: when requiresStripboard=true, STRIPBOARD_VALIDATION with empty items fails", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: true } as any,
    bomLines: [{ part: { datasheetUrl: "https://x", lifecycle: "ACTIVE" } } as any],
    revisionChecklists: [{ id: "cl1", subkind: "STRIPBOARD_VALIDATION", stage: "BOM_SOURCING", items: [] } as any],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("STRIPBOARD_VALIDATION Checklist has no items.");
});

test("BOM_SOURCING gate: when requiresStripboard=true, all-checked-or-N/A STRIPBOARD_VALIDATION passes", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: true } as any,
    bomLines: [{ part: { datasheetUrl: "https://x", lifecycle: "ACTIVE" } } as any],
    revisionChecklists: [{
      id: "cl1", subkind: "STRIPBOARD_VALIDATION", stage: "BOM_SOURCING",
      items: [
        { id: "i1", checked: true,  notApplicable: false } as any,
        { id: "i2", checked: false, notApplicable: true  } as any,
      ],
    } as any],
  }));
  expect(res).toEqual({ ok: true });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/stages.ts` `STAGES.BOM_SOURCING.exitGate`. Extend the existing predicate:

```ts
exitGate: ({ project, bomLines, revisionChecklists }) => {
  const reasons: string[] = [];
  if (bomLines.length === 0) reasons.push("BOM is empty.");
  const noDatasheet = bomLines.filter((l) => !l.part.datasheetUrl);
  if (noDatasheet.length) reasons.push(`${noDatasheet.length} part(s) missing datasheet URL.`);
  const eol = bomLines.filter((l) => l.part.lifecycle === "EOL" || l.part.lifecycle === "OBSOLETE");
  if (eol.length) reasons.push(`${eol.length} part(s) are EOL or OBSOLETE.`);

  if (project.requiresStripboard) {
    const sv = revisionChecklists.find((c) => c.subkind === "STRIPBOARD_VALIDATION");
    if (!sv) {
      reasons.push("No STRIPBOARD_VALIDATION Checklist on the revision.");
    } else if (sv.items.length === 0) {
      reasons.push("STRIPBOARD_VALIDATION Checklist has no items.");
    } else if (sv.items.some((i) => !i.checked && !i.notApplicable)) {
      reasons.push("STRIPBOARD_VALIDATION Checklist has unchecked items.");
    }
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
},
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/stages.test.ts
git commit -m "feat(stages): BOM_SOURCING gate consumes STRIPBOARD_VALIDATION when requiresStripboard"
```

### Task 17.4: LAYOUT→BOM_SOURCING regress side-effect clears STRIPBOARD_VALIDATION `checked` flags

**Files:**
- Modify: `src/lib/actions/stages.ts` (extend the existing `LAYOUT → BOM_SOURCING` regress branch)
- Test: `src/lib/__tests__/stages-actions.test.ts` (extend)

**Step 1: Write the failing test:**

```ts
test("regress LAYOUT → BOM_SOURCING: clears checked on STRIPBOARD_VALIDATION items but preserves completedAt/completedById", async () => {
  const user = await getSeedUser();
  vi.mocked(authModule.auth).mockResolvedValue({ user: { email: user.email } } as any);
  const p = await db.project.create({ data: { slug: `regress-sv-${Date.now()}`, name: "x", createdById: user.id, requiresStripboard: true } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1", currentStage: "LAYOUT", bomFrozenAt: new Date() } });
  const c = await db.checklist.create({
    data: {
      revisionId: r.id,
      stage: "BOM_SOURCING",
      subkind: "STRIPBOARD_VALIDATION",
      title: "sv",
      createdById: user.id,
      items: {
        create: [
          { ordinal: 0, label: "topology", checked: true, completedAt: new Date(), completedById: user.id },
          { ordinal: 1, label: "rails",    checked: true, completedAt: new Date(), completedById: user.id },
        ],
      },
    },
    include: { items: true },
  });
  const item0Before = c.items[0];

  const result = await regressStage({ revisionId: r.id, reason: "redo stripboard" });
  expect(result.ok).toBe(true);

  const items = await db.checklistItem.findMany({ where: { checklistId: c.id }, orderBy: { ordinal: "asc" } });
  expect(items[0].checked).toBe(false);
  expect(items[1].checked).toBe(false);
  // Audit fields preserved.
  expect(items[0].completedAt?.toISOString()).toBe(item0Before.completedAt?.toISOString());
  expect(items[0].completedById).toBe(item0Before.completedById);

  // cleanup
  await db.checklist.delete({ where: { id: c.id } });
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** In `src/lib/actions/stages.ts`, find the `regressStage` block where `currentStage === "LAYOUT" && toStage === "BOM_SOURCING"` (lines ~330–340). Extend the branch to also clear STRIPBOARD_VALIDATION items:

```ts
if (currentStage === "LAYOUT" && toStage === "BOM_SOURCING") {
  rowCount = await tx.$executeRaw`
    UPDATE "Revision"
    SET "currentStage" = ${toStage}::"Stage",
        "currentStageEnteredAt" = ${now},
        "bomFrozenAt" = NULL
    WHERE "id" = ${rev.id}
      AND "currentStage" = ${currentStage}::"Stage"
  `;
  // Per proposal §3 #4: clear `checked` on every STRIPBOARD_VALIDATION item
  // on the revision, but preserve `completedAt` and `completedById` (audit
  // trail of who originally validated and when is kept).
  await tx.$executeRaw`
    UPDATE "ChecklistItem"
    SET "checked" = false
    WHERE "checklistId" IN (
      SELECT id FROM "Checklist"
      WHERE "revisionId" = ${rev.id}
        AND "subkind" = 'STRIPBOARD_VALIDATION'
    )
  `;
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/actions/stages.ts src/lib/__tests__/stages-actions.test.ts
git commit -m "feat(stages): regress LAYOUT→BOM_SOURCING clears STRIPBOARD_VALIDATION checked flags"
```

### Task 17.5: UI — "Materialize STRIPBOARD_VALIDATION" button on revision detail when requiresStripboard

**Files:**
- Modify: revision detail page (RevisionChecklistsPane or page.tsx)
- Modify: project detail page to surface the `requiresStripboard` badge

**Step 1:** Add a "Materialize STRIPBOARD validation checklist" button to the RevisionChecklistsPane. Visibility condition: only render the button when `project.requiresStripboard === true` AND no STRIPBOARD_VALIDATION checklist exists yet on the revision.

**Step 2:** Button posts to `materializeCanonicalChecklist({ revisionId, templateKey: "STRIPBOARD_VALIDATION" })`.

**Step 3:** On the project detail page, add a `STRIPBOARD` badge when `project.requiresStripboard === true` (similar styling to the curriculum badges from m11).

**Step 4:** Verify build + render-walk test.

**Step 5: Commit (user-gated):**

```
git add src/app/projects src/components
git commit -m "feat(stripboard): materialize button + project badge for requiresStripboard"
```

### Task 17.6: m17 checkpoint

**Step 1: Verify:**
- `pnpm tsc --noEmit` clean.
- `pnpm next build` succeeds.
- `pnpm vitest run` — target ~315 tests pass (301 from m16 + ~14 from m17 tasks).

**Step 2: Smoke check (manual):**
- Toggle `requiresStripboard = true` on a seeded project; materialize the STRIPBOARD_VALIDATION checklist on its revision; check all items; advance through SCHEMATIC → BOM_SOURCING → LAYOUT (gate passes); regress LAYOUT → BOM_SOURCING; observe items are un-checked but `completedAt` strings still visible in the audit fields.

**Step 3: Tag (user-gated):**

```
git tag m17-stripboard-gate
```

---

# Milestone m18 — Certified-module safety flag

Goal: add `Project.hasMainsNet` (default false) and `Part.isCertifiedModule` (default false); extend `loadGateContext` to surface `project.hasMainsNet`; add a BOM_SOURCING gate predicate that, when `hasMainsNet === true`, requires at least one BomLine whose `part.isCertifiedModule === true`; add UI fields on project create/edit + part create/edit; add a "Mains parts" filter chip on `/parts`. Per proposal §3 #5.

### Task 18.1: Add `Project.hasMainsNet` + `Part.isCertifiedModule` columns

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_mains_certified_flags/migration.sql` (generated)

**Step 1: Edit `prisma/schema.prisma`.** On `model Project`, add (next to `requiresStripboard`):

```prisma
  hasMainsNet        Boolean              @default(false)
```

On `model Part`, add:

```prisma
  isCertifiedModule  Boolean              @default(false)
```

**Step 2: Generate migration:**

```
pnpm prisma migrate dev --name mains_certified_flags
```

Expected: `ALTER TABLE "Project" ADD COLUMN "hasMainsNet" BOOLEAN NOT NULL DEFAULT false;` + same for `Part."isCertifiedModule"`.

**Step 3: Verify:**

```
pnpm prisma validate
pnpm tsc --noEmit
```

**Step 4: Commit (user-gated):**

```
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): Project.hasMainsNet + Part.isCertifiedModule columns"
```

### Task 18.2: Surface `project.hasMainsNet` in `loadGateContext`

**Files:**
- Modify: `src/lib/load-gate-context.ts`
- Modify: `src/lib/stages.ts` (already partially extended in m17 — widen the Pick now)
- Test: `src/lib/__tests__/load-gate-context.test.ts` (extend)

**Step 1: Write the failing test:**

```ts
test("loadGateContext: includes project.hasMainsNet", async () => {
  const user = await getSeedUser();
  const p = await db.project.create({ data: { slug: `lgc-mains-${Date.now()}`, name: "x", createdById: user.id, hasMainsNet: true } });
  const r = await db.revision.create({ data: { projectId: p.id, label: "v1" } });
  const ctx = await loadGateContext(db, r.id);
  expect(ctx.project.hasMainsNet).toBe(true);
  await db.revision.delete({ where: { id: r.id } });
  await db.project.delete({ where: { id: p.id } });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** In `src/lib/stages.ts`, widen the `project` Pick:

```ts
project: Pick<Project, "id" | "requiresStripboard" | "hasMainsNet">;
```

In `src/lib/load-gate-context.ts`, widen the `select`:

```ts
const project = await tx.project.findFirstOrThrow({
  where: { revisions: { some: { id: revisionId } } },
  select: { id: true, requiresStripboard: true, hasMainsNet: true },
});
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/load-gate-context.ts src/lib/stages.ts src/lib/__tests__/load-gate-context.test.ts
git commit -m "feat(gate-ctx): surface project.hasMainsNet in GateContext"
```

### Task 18.3: BOM_SOURCING gate predicate for certified module

**Files:**
- Modify: `src/lib/stages.ts`
- Test: `src/lib/__tests__/stages.test.ts` (extend)

**Step 1: Write the failing tests:**

```ts
test("BOM_SOURCING gate: when hasMainsNet=false, certified-module check is skipped", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: false, hasMainsNet: false } as any,
    bomLines: [{ part: { datasheetUrl: "https://x", lifecycle: "ACTIVE", isCertifiedModule: false } } as any],
    revisionChecklists: [],
  }));
  expect(res).toEqual({ ok: true });
});

test("BOM_SOURCING gate: when hasMainsNet=true, no certified module fails the gate", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: false, hasMainsNet: true } as any,
    bomLines: [{ part: { datasheetUrl: "https://x", lifecycle: "ACTIVE", isCertifiedModule: false } } as any],
    revisionChecklists: [],
  }));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reasons).toContain("Project has mains net but no certified-module part on the BOM.");
});

test("BOM_SOURCING gate: when hasMainsNet=true, at least one certified module passes", async () => {
  const res = await STAGES.BOM_SOURCING.exitGate!(ctx({
    project: { id: "p1", requiresStripboard: false, hasMainsNet: true } as any,
    bomLines: [
      { part: { datasheetUrl: "https://x", lifecycle: "ACTIVE", isCertifiedModule: false } } as any,
      { part: { datasheetUrl: "https://y", lifecycle: "ACTIVE", isCertifiedModule: true  } } as any,
    ],
    revisionChecklists: [],
  }));
  expect(res).toEqual({ ok: true });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/stages.ts` `STAGES.BOM_SOURCING.exitGate`. Append to the existing predicate:

```ts
if (project.hasMainsNet) {
  const hasCertified = bomLines.some((l) => l.part.isCertifiedModule);
  if (!hasCertified) {
    reasons.push("Project has mains net but no certified-module part on the BOM.");
  }
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/stages.ts src/lib/__tests__/stages.test.ts
git commit -m "feat(stages): BOM_SOURCING gate requires certified module when hasMainsNet"
```

### Task 18.4: Zod schemas + actions accept `hasMainsNet` and `isCertifiedModule`

**Files:**
- Modify: `src/lib/schemas/project.ts`
- Modify: `src/lib/schemas/part.ts`
- Test: `src/lib/__tests__/projects-actions.test.ts` + `parts-actions.test.ts` (extend)

**Step 1: Write the failing tests:**

```ts
// projects-actions.test.ts
test("createProject: accepts hasMainsNet", async () => {
  // create + assert hasMainsNet === true
});

// parts-actions.test.ts
test("createPart: accepts isCertifiedModule", async () => {
  // create + assert isCertifiedModule === true
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.** Edit `src/lib/schemas/project.ts`:

```ts
export const createProjectSchema = z.object({
  // …existing fields…
  requiresStripboard: z.boolean().optional(),
  hasMainsNet: z.boolean().optional(),
});
```

Edit `src/lib/schemas/part.ts`:

```ts
export const createPartSchema = z.object({
  // …existing fields…
  isCertifiedModule: z.boolean().optional(),
});
```

If the actions explicitly enumerate fields rather than spreading, add the new fields. Otherwise they should flow through automatically.

**Step 4: Run, watch pass.**

**Step 5: Commit (user-gated):**

```
git add src/lib/schemas src/lib/__tests__/projects-actions.test.ts src/lib/__tests__/parts-actions.test.ts
git commit -m "feat(schemas): hasMainsNet + isCertifiedModule pass through actions"
```

### Task 18.5: UI — project create/edit form `hasMainsNet` toggle + part form `isCertifiedModule` toggle

**Files:**
- Modify: `src/app/projects/new/_form.tsx`
- Modify: `src/app/projects/[slug]/_edit-fields.tsx`
- Modify: wherever the Part create/edit form lives (likely `src/app/parts/new/_form.tsx`)

**Step 1:** On the project create form, add a checkbox inside the curriculum-metadata fieldset (per the m11 pattern):

```tsx
<label className="inline-flex items-center gap-2">
  <input type="checkbox" name="hasMainsNet" />
  <span className="font-mono text-xs uppercase tracking-wider text-muted">
    Has mains net (requires certified-module BOM line)
  </span>
</label>
```

Add tooltip explaining the gate implication (e.g. `<span title="When checked, BOM_SOURCING gate requires at least one BomLine.part.isCertifiedModule === true">`).

**Step 2:** Update the form action adapter to `hasMainsNet: formData.get("hasMainsNet") === "on"` (matching the m11 pattern for `requiresStripboard`).

**Step 3:** On the edit-in-place fields component, add an inline toggle for `hasMainsNet`.

**Step 4:** On the part form, add the `isCertifiedModule` checkbox with similar styling + tooltip ("Marks this part as fulfilling the mains-net certified-module gate").

**Step 5:** Verify `pnpm next build`.

**Step 6: Commit (user-gated):**

```
git add src/app/projects src/app/parts
git commit -m "feat(ui): hasMainsNet + isCertifiedModule toggles on project and part forms"
```

### Task 18.6: `/parts` filter chip — "Mains parts"

**Files:**
- Modify: `src/app/parts/page.tsx`

**Step 1:** Extend `searchParams` to accept `?mains=1`. When set, filter the query: `where: { isCertifiedModule: true }`.

**Step 2:** Add a `<FilterChip label="MAINS PARTS" active={params.mains === "1"} href={params.mains === "1" ? "/parts" : "/parts?mains=1"} />` chip (reuse the `FilterChip` component from m11 Task 11.6).

**Step 3:** Verify `pnpm next build` + manual smoke: navigate to `/parts?mains=1` and confirm only certified-module parts appear.

**Step 4: Commit (user-gated):**

```
git add src/app/parts/page.tsx
git commit -m "feat(parts): MAINS PARTS filter chip on /parts"
```

### Task 18.7: m18 checkpoint

**Step 1: Verify:**
- `pnpm tsc --noEmit` clean.
- `pnpm next build` succeeds.
- `pnpm vitest run` — target ~325 tests pass (315 from m17 + ~10 from m18 tasks).

**Step 2: Smoke check (manual):**
- Mark a seeded project `hasMainsNet = true` and ensure none of its BomLines reference a certified-module part; attempt to advance from BOM_SOURCING to LAYOUT — gate fails with the certified-module reason.
- Mark one BomLine's part `isCertifiedModule = true`; re-advance — gate passes.
- Confirm `/parts?mains=1` filters down to only the certified-module parts.

**Step 3: Tag (user-gated):**

```
git tag m18-certified-module
```

---

## Cross-cutting reminders

- **No commit without explicit authorization.** Every task's Step 5 (or final) commit is gated by the user. Every subagent dispatch must include the literal string `DO NOT COMMIT` in its instructions.
- **Always run `pnpm tsc --noEmit` after each task.** Type errors compound, especially across the migrations in m14/m15/m16/m17/m18 (`pnpm prisma generate` is implicit but worth re-running if types feel stale).
- **Always run the relevant Vitest file before committing.** Don't rely on CI.
- **The full test suite (`pnpm vitest run`) runs against live Neon.** A single flake means a real race or cleanup leak; investigate, don't retry.
- **Migrations must run in order.** Each milestone may stack 2–3 migrations; if you reorder them locally, `prisma migrate dev` will complain. If you need to redo a migration: `pnpm prisma migrate reset` (destructive — only on dev DB).
- **Read the proposal doc when in doubt.** [docs/plans/2026-06-01-curriculum-foundry-updates.md](2026-06-01-curriculum-foundry-updates.md) — §3 #3 (Checklist), #4 (Stripboard), #5 (Certified module), #8 (CONVENTIONS), #9 (R2 subkinds), #10 (Canonical templates + ASSEMBLY predicate).
- **The ASSEMBLY predicate fix (Task 16.5) is load-bearing.** Without it, an N/A item in `POST_ASSEMBLY_CONTINUITY` blocks ASSEMBLY exit forever, and a zero-item checklist silently passes the gate. The fix and the `notApplicable` migration (Tasks 16.2 + 16.3) MUST land in close succession so neither side is unenforced alone.
- **The `revisionChecklists` GateContext extension (Task 15.5) is also load-bearing.** m16 and m17 gate predicates all consume it. If 15.5 is skipped or partially implemented, every downstream gate test will fail with a `Cannot read property 'find' of undefined` style error.
- **Don't push to remote.** User pushes when ready.

---

## Plan complete — execution options

Plan saved to [docs/plans/2026-06-02-curriculum-wave2-implementation.md](2026-06-02-curriculum-wave2-implementation.md).

**1. Subagent-Driven (this session)** — dispatch a fresh subagent per task and review between tasks. Every dispatch must include `DO NOT COMMIT`. Same cadence that worked through Phase 1 + Wave 1.

**2. Parallel Session (separate)** — open a new session in `c:/zzz/project-foundry`, point it at this plan, run `superpowers:executing-plans`. Batch execution with checkpoints between tasks.

Which approach?
