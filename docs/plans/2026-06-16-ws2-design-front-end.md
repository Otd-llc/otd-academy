# WS2 — Design front-end Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the design-discipline half of the board-design process real: two new project flags (`hasLiIon`, `hasThermalConcern`) that inject DESIGN_VALIDATION conditional items, a 6th core "risks de-risked" attestation, and the first fully-worked example design doc (WROOM L1.01).

**Architecture:** Extend WS1's already-shipped `conditionalItems` mechanism — no new machinery. Add two `Project` booleans (mirroring `hasMainsNet`), widen the `conditionalItems` flag union + the materialize-time flag `select`, add two conditional blocks + one core item to `CANONICAL_TEMPLATES.DESIGN_VALIDATION`, and port the existing rich-but-stale WROOM design doc into the new template structure at the correct slug.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 + Neon Postgres, Zod 4, vitest (runs against the live Neon DB), Tailwind (OTD palette).

**Design doc:** `docs/plans/2026-06-16-ws2-design-front-end-design.md`

---

## Critical constraints (read before starting)

- **`.env.local` `DATABASE_URL` is PROD.** Migrations and the vitest suite mutate prod. Migrations: hand-author SQL + `pnpm prisma migrate deploy` (resolves `prisma.config.ts` → `.env.local` → `DIRECT_URL`). **Never `migrate dev`.**
- **Never run vitest concurrently.** It corrupts the shared `esp32-sensor-breakout` fixture (`pnpm db:seed` restores). Run one file (or the full suite) at a time, sequentially.
- **`"use server"` files export only async functions** (`projects.ts`). It already has an inline `export type ProjectFormState` (compiler-elided, pre-existing) — do not add any new non-async export, and never a `export type { X }` re-export.
- **After any schema change:** `pnpm prisma generate`, then `pnpm tsc --noEmit`, then the full `pnpm vitest run`. If a `next dev` is running, restart it (Turbopack caches the old client).
- **WS2 depends on WS1 (PR #142, open/unmerged).** It extends `conditionalItems`, the `DESIGN_VALIDATION` template, and the materialize flag-read — all introduced in WS1. **Branch off `feat/ws1-foundations`:** `git checkout feat/ws1-foundations && git checkout -b feat/ws2-design-front-end`. Retarget the PR base to `main` after WS1 merges.
- **Do not merge.** Open the PR, verify CI `build | pass` explicitly, hand back to Josh.

---

## Task 1: Schema + migration (two Project booleans)

**Files:**
- Modify: `prisma/schema.prisma` (model `Project`, after `hasMainsNet` ~line 107)
- Create: `prisma/migrations/20260616160000_project_liion_thermal_flags/migration.sql`

**Step 1: Add the columns in the schema**

In `model Project`, after `hasMainsNet        Boolean              @default(false)`:

```prisma
  hasMainsNet        Boolean              @default(false)
  hasLiIon           Boolean              @default(false) // WS2: triggers DESIGN_VALIDATION Li-ion safety conditional
  hasThermalConcern  Boolean              @default(false) // WS2: triggers DESIGN_VALIDATION thermal conditional
```

**Step 2: Write the migration SQL**

Create `prisma/migrations/20260616160000_project_liion_thermal_flags/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "hasLiIon" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hasThermalConcern" BOOLEAN NOT NULL DEFAULT false;
```

**Step 3: Apply + regenerate**

Run: `pnpm prisma migrate deploy`
Expected: `1 migration found ... applied`, no error.

Run: `pnpm prisma generate`
Expected: `Generated Prisma Client` — `Project.hasLiIon` / `hasThermalConcern` now on the client types.

**Step 4: Sanity tsc**

Run: `pnpm tsc --noEmit`
Expected: PASS (the new columns are additive; nothing references them yet).

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260616160000_project_liion_thermal_flags
git commit -m "feat(ws2): add Project hasLiIon + hasThermalConcern flags (schema + migration)"
```

---

## Task 2: Canonical template — 6th core item + Li-ion/thermal conditional blocks

**Files:**
- Modify: `src/lib/canonical-checklist-templates.ts` (interface `conditionalItems` union ~line 31; `DESIGN_VALIDATION` entry ~line 151)
- Test: `src/lib/__tests__/canonical-checklist-templates.test.ts` (the WS1 DESIGN_VALIDATION test ~line 65-84)

**Step 1: Update the failing test**

In `src/lib/__tests__/canonical-checklist-templates.test.ts`, the WS1 test currently asserts 5 core items + the `hasMainsNet` conditional. Replace its body so it expects **6** core items (the new risks-de-risked item last) and **three** conditional blocks:

```ts
  test("DESIGN_VALIDATION template has 6 core items + mains/Li-ion/thermal conditionals", () => {
    const t = CANONICAL_TEMPLATES.DESIGN_VALIDATION;
    expect(t.subkind).toBe("DESIGN_VALIDATION");
    expect(t.stage).toBe("BOM_SOURCING");
    expect(t.items.length).toBe(6);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Calc trail/i),
      expect.stringMatching(/datasheet-verified/i),
      expect.stringMatching(/Footprint/i),
      expect.stringMatching(/Fab-DRU/i),
      expect.stringMatching(/BOM availability/i),
      expect.stringMatching(/risks de-risked/i),
    ]);

    const mains = t.conditionalItems?.find((c) => c.flag === "hasMainsNet");
    expect(mains?.items.length).toBe(2);

    const liion = t.conditionalItems?.find((c) => c.flag === "hasLiIon");
    expect(liion).toBeDefined();
    expect(liion!.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Li-ion protection/i),
      expect.stringMatching(/containment/i),
    ]);

    const thermal = t.conditionalItems?.find((c) => c.flag === "hasThermalConcern");
    expect(thermal).toBeDefined();
    expect(thermal!.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Thermal budget/i),
      expect.stringMatching(/Derating/i),
    ]);
  });
```

> **Do not touch** the `STRIPBOARD_VALIDATION` template test in the same file — it also asserts `toBe(5)` for its own items; only the DESIGN_VALIDATION count changes.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/canonical-checklist-templates.test.ts`
Expected: FAIL — 5 core items (not 6); `hasLiIon`/`hasThermalConcern` conditionals undefined.

**Step 3: Widen the `conditionalItems` flag union**

In `src/lib/canonical-checklist-templates.ts`, the `CanonicalTemplate` interface:

```ts
  conditionalItems?: {
    flag: "hasMainsNet" | "requiresStripboard" | "hasLiIon" | "hasThermalConcern";
    items: CanonicalItem[];
  }[];
```

**Step 4: Add the 6th core item**

In `CANONICAL_TEMPLATES.DESIGN_VALIDATION.items`, after the `BOM availability confirmed …` item:

```ts
      {
        label:
          "All top risks de-risked — every risk in the design doc's risk register (§6) has a completed de-risk pass.",
      },
```

**Step 5: Add the two conditional blocks**

In `CANONICAL_TEMPLATES.DESIGN_VALIDATION.conditionalItems`, after the existing `hasMainsNet` block:

```ts
      {
        flag: "hasLiIon",
        items: [
          {
            label:
              "Li-ion protection verified — OVP/OCP/short protection, charge & discharge current limits, and cell balancing if multi-cell.",
          },
          {
            label:
              "Pack thermal/mechanical containment reviewed — cell placement, venting, and worst-case fault behavior per the design doc.",
          },
        ],
      },
      {
        flag: "hasThermalConcern",
        items: [
          {
            label:
              "Thermal budget verified — worst-case dissipation, copper-pour/heatsink, and junction temperature within the part's abs-max.",
          },
          {
            label:
              "Derating applied — thermally-stressed parts run within a margin of their rated limits per the design doc.",
          },
        ],
      },
```

**Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/canonical-checklist-templates.test.ts`
Expected: PASS (all template tests).

**Step 7: Commit**

```bash
git add src/lib/canonical-checklist-templates.ts src/lib/__tests__/canonical-checklist-templates.test.ts
git commit -m "feat(ws2): DESIGN_VALIDATION risks-de-risked core item + Li-ion/thermal conditional blocks"
```

---

## Task 3: Materialize-time flag injection (the one wiring change + tests)

**Files:**
- Modify: `src/lib/actions/checklists.ts` (revision-branch flag `select` ~line 678-692)
- Test: `src/lib/__tests__/checklists-actions.test.ts` (WS1 DESIGN_VALIDATION injection block + the helper `makeProjectWithFlags`)

**Step 1: Update the WS1 injection tests + add Li-ion/thermal cases**

In `src/lib/__tests__/checklists-actions.test.ts`:

1a. The helper `makeProjectWithFlags` (added in WS1) takes `{ hasMainsNet?, requiresStripboard? }`. Extend its type + create-data to also accept `hasLiIon?` and `hasThermalConcern?`:

```ts
async function makeProjectWithFlags(flags: {
  hasMainsNet?: boolean;
  requiresStripboard?: boolean;
  hasLiIon?: boolean;
  hasThermalConcern?: boolean;
}): Promise<{ id: string }> {
  const user = await seedUser();
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const project = await db.project.create({
    data: {
      slug: `t-ws1-dv-${stamp}`,
      name: "WS1 DESIGN_VALIDATION test",
      createdById: user.id,
      hasMainsNet: flags.hasMainsNet ?? false,
      requiresStripboard: flags.requiresStripboard ?? false,
      hasLiIon: flags.hasLiIon ?? false,
      hasThermalConcern: flags.hasThermalConcern ?? false,
    },
  });
  createdProjectIds.push(project.id);
  return project;
}
```

1b. The WS1 test "hasMainsNet=false → only the core items" asserted `items.length).toBe(5)`. Core is now **6**, so update it to `toBe(6)`.

1c. The WS1 test "hasMainsNet=true → core + 2 appended safety items" asserted `toBe(7)` and indexed `items[5]`/`items[6]`. Core is now 6, so a `hasMainsNet` project yields **8**; update to `toBe(8)` and assert the safety items are at `items[6]`/`items[7]`:

```ts
    expect(items.length).toBe(8);
    expect(items[6]!.label).toMatch(/Mains-safety/i);
    expect(items[7]!.label).toMatch(/Isolation barrier/i);
```

1d. Add two new tests (after the WS1 block):

```ts
  test("hasLiIon=true → 6 core + 2 Li-ion items appended", async () => {
    const project = await makeProjectWithFlags({ hasLiIon: true });
    const rev = await makeRevOnProject(
      project.id,
      "BOM_SOURCING",
      `ws2-dv-liion-${Date.now()}`,
    );
    const checklist = await materializeCanonicalChecklist({
      revisionId: rev.id,
      templateKey: "DESIGN_VALIDATION",
    });
    createdChecklistIds.push(checklist.id);
    const items = await db.checklistItem.findMany({
      where: { checklistId: checklist.id },
      orderBy: { ordinal: "asc" },
    });
    expect(items.length).toBe(8);
    expect(items[6]!.label).toMatch(/Li-ion protection/i);
    expect(items[7]!.label).toMatch(/containment/i);
  });

  test("hasMainsNet + hasThermalConcern → 6 core + 2 mains + 2 thermal, in declaration order", async () => {
    const project = await makeProjectWithFlags({
      hasMainsNet: true,
      hasThermalConcern: true,
    });
    const rev = await makeRevOnProject(
      project.id,
      "BOM_SOURCING",
      `ws2-dv-mains-thermal-${Date.now()}`,
    );
    const checklist = await materializeCanonicalChecklist({
      revisionId: rev.id,
      templateKey: "DESIGN_VALIDATION",
    });
    createdChecklistIds.push(checklist.id);
    const items = await db.checklistItem.findMany({
      where: { checklistId: checklist.id },
      orderBy: { ordinal: "asc" },
    });
    // 6 core + mains(2) + thermal(2). Order follows conditionalItems declaration:
    // hasMainsNet block precedes hasThermalConcern block.
    expect(items.length).toBe(10);
    expect(items[6]!.label).toMatch(/Mains-safety/i);
    expect(items[8]!.label).toMatch(/Thermal budget/i);
  });
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/__tests__/checklists-actions.test.ts -t "DESIGN_VALIDATION"`
Expected: FAIL — Li-ion/thermal items not injected (the `select` doesn't load those flags yet, so they read `undefined`/falsy).

**Step 3: Add the two flags to the revision-branch `select`**

In `src/lib/actions/checklists.ts`, the revision-scoped branch reads the project flags. Change the single-line select:

```ts
        const rev = await tx.revision.findUniqueOrThrow({
          where: { id: revisionId },
          select: {
            project: {
              select: {
                hasMainsNet: true,
                requiresStripboard: true,
                hasLiIon: true,
                hasThermalConcern: true,
              },
            },
          },
        });
```

> The injection loop (`(template.conditionalItems ?? []).filter((c) => flags[c.flag]).flatMap((c) => c.items)`) is already generic — it picks up the new flags with no further change.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/checklists-actions.test.ts`
Expected: PASS (full file — existing materialize/gate tests + the updated/new WS2 tests).

**Step 5: Commit**

```bash
git add src/lib/actions/checklists.ts src/lib/__tests__/checklists-actions.test.ts
git commit -m "feat(ws2): inject Li-ion/thermal DESIGN_VALIDATION items from project flags"
```

---

## Task 4: Project flag plumbing — schema, actions, edit + create UI

**Files:**
- Modify: `src/lib/schemas/project.ts` (`createProjectSchema` ~line 16-32)
- Modify: `src/lib/actions/projects.ts` (`editProjectBooleanField` union ~line 285; `createProject` spreads ~line 121-130; add two actions near `editProjectHasMainsNetAction` ~line 375)
- Modify: `src/app/projects/[slug]/_edit-fields.tsx` (imports ~line 18-30; add two forms near `EditHasMainsNetForm` ~line 341)
- Modify: `src/app/projects/[slug]/page.tsx` (imports ~line 20; render near `EditHasMainsNetForm` ~line 215-222)
- Modify: `src/app/projects/new/_form.tsx` (flag checkboxes ~line 210-234)
- Test: `src/lib/__tests__/projects-actions.test.ts`

**Step 1: Write the failing action test**

In `src/lib/__tests__/projects-actions.test.ts`, find the existing `editProjectHasMainsNetAction` (or `editProjectRequiresStripboard`) test and add a sibling for the new actions. Example:

```ts
  test("editProjectHasLiIonAction toggles the flag", async () => {
    const { id } = await makeProject({ hasLiIon: false });
    const fd = new FormData();
    fd.set("id", id);
    fd.set("hasLiIon", "on");
    await editProjectHasLiIonAction({}, fd);
    const p = await db.project.findUniqueOrThrow({ where: { id } });
    expect(p.hasLiIon).toBe(true);
  });

  test("editProjectHasThermalConcernAction toggles the flag", async () => {
    const { id } = await makeProject({ hasThermalConcern: true });
    const fd = new FormData();
    fd.set("id", id);
    // unchecked checkbox sends no field → action sets false
    await editProjectHasThermalConcernAction({}, fd);
    const p = await db.project.findUniqueOrThrow({ where: { id } });
    expect(p.hasThermalConcern).toBe(false);
  });
```

> Match the exact existing helper names in this file (`makeProject` / how it seeds flags, how the action is imported). If the file's `makeProject` doesn't accept these flags, pass them through the same way it already passes `hasMainsNet` (or set them via `db.project.update` before the action call).

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/projects-actions.test.ts -t "LiIon|ThermalConcern"`
Expected: FAIL — actions don't exist (tsc/compile error).

**Step 3: Add the schema fields**

In `src/lib/schemas/project.ts`, `createProjectSchema`, after `hasMainsNet`:

```ts
  hasMainsNet: z.boolean().optional(),
  hasLiIon: z.boolean().optional(),
  hasThermalConcern: z.boolean().optional(),
```

(`editProjectSchema = createProjectSchema.partial()` inherits them.)

**Step 4: Widen the boolean-field helper union + add the two actions**

In `src/lib/actions/projects.ts`, the private `editProjectBooleanField(fieldName, ...)` helper's `fieldName` parameter is a closed union. Widen it:

```ts
  fieldName: "criticalPath" | "requiresStripboard" | "hasMainsNet" | "hasLiIon" | "hasThermalConcern",
```

Add the two actions next to `editProjectHasMainsNetAction` (copy its exact shape):

```ts
export async function editProjectHasLiIonAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  return editProjectBooleanField("hasLiIon", formData);
}

export async function editProjectHasThermalConcernAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  return editProjectBooleanField("hasThermalConcern", formData);
}
```

> Confirm the real signature of `editProjectHasMainsNetAction` and mirror it exactly (arg names, return type). The file stays `"use server"`, only async exports.

**Step 5: Make the flags settable at create time**

In `createProject` (`projects.ts` ~line 121-130), where each boolean is conditionally spread, add:

```ts
      ...(data.hasLiIon !== undefined ? { hasLiIon: data.hasLiIon } : {}),
      ...(data.hasThermalConcern !== undefined
        ? { hasThermalConcern: data.hasThermalConcern }
        : {}),
```

**Step 6: Run action test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/projects-actions.test.ts -t "LiIon|ThermalConcern"`
Expected: PASS.

**Step 7: Add the edit-in-place forms**

In `src/app/projects/[slug]/_edit-fields.tsx`:

7a. Add imports (in the existing `@/lib/actions/projects` import block):

```ts
  editProjectHasLiIonAction,
  editProjectHasThermalConcernAction,
```

7b. After `EditHasMainsNetForm`, add (copy it exactly, swap the action/name/label/tooltip):

```tsx
export function EditHasLiIonForm({ id, value }: { id: string; value: boolean }) {
  const [state, action] = useActionState(editProjectHasLiIonAction, initialState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <Tooltip content="When checked, the DESIGN_VALIDATION checklist injects 2 Li-ion safety items at materialize time.">
        <label className="inline-flex items-center gap-2">
          <input
            name="hasLiIon"
            type="checkbox"
            defaultChecked={value}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            Has Li-ion (adds battery-safety validation items)
          </span>
        </label>
      </Tooltip>
      <FieldError messages={state.errors?.hasLiIon} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditHasThermalConcernForm({ id, value }: { id: string; value: boolean }) {
  const [state, action] = useActionState(editProjectHasThermalConcernAction, initialState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <Tooltip content="When checked, the DESIGN_VALIDATION checklist injects 2 thermal validation items at materialize time.">
        <label className="inline-flex items-center gap-2">
          <input
            name="hasThermalConcern"
            type="checkbox"
            defaultChecked={value}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            Has thermal concern (adds thermal validation items)
          </span>
        </label>
      </Tooltip>
      <FieldError messages={state.errors?.hasThermalConcern} />
      <ActionMessage state={state} />
    </form>
  );
}
```

**Step 8: Render the two toggles on the project detail page**

In `src/app/projects/[slug]/page.tsx`, add the imports and render `EditHasLiIonForm` / `EditHasThermalConcernForm` next to `EditHasMainsNetForm` (~line 215-222), passing `project.hasLiIon` / `project.hasThermalConcern`. Confirm the project query backing the page returns the full project (not a narrow `select`) so the new columns are present.

**Step 9: Add the create-form checkboxes (parity)**

In `src/app/projects/new/_form.tsx` (~line 210-234, where `requiresStripboard`/`hasMainsNet` checkboxes live), add two more checkboxes named `hasLiIon` and `hasThermalConcern`, mirroring the existing markup.

**Step 10: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS (schema, helper union, actions, forms, pages, create form all align).

**Step 11: Commit**

```bash
git add src/lib/schemas/project.ts src/lib/actions/projects.ts "src/app/projects/[slug]/_edit-fields.tsx" "src/app/projects/[slug]/page.tsx" src/app/projects/new/_form.tsx src/lib/__tests__/projects-actions.test.ts
git commit -m "feat(ws2): hasLiIon + hasThermalConcern project flags through schema, actions, and admin UI"
```

---

## Task 5: Worked-example design doc (port WROOM into the template)

**Files:**
- Create: `docs/boards/l1-01-wroom-breakout/design.md`
- Modify/replace: `docs/boards/wroom-breakout/design.md`
- Reference: `docs/boards/_template/design.md` (structure), existing `docs/boards/wroom-breakout/design.md` (content)

**Step 1: Read both source files**

Read `docs/boards/_template/design.md` (target structure) and the full existing `docs/boards/wroom-breakout/design.md` (rich Pass-2 content: ESP32-S3-WROOM-1, the WROOM-32E→S3 bridge-sourcing pivot, calc trail, the R1 risk).

**Step 2: Write the ported doc**

Create `docs/boards/l1-01-wroom-breakout/design.md` following the template's §1–§8 headings. Populate:
- §1 ORIENT: WROOM's purpose + functional requirements (F1–F6) + constraints. No mains/Li-ion/thermal flags (so §7 lists the 6 core items only).
- §2 Topology: the USB-C → S3-WROOM-1 power/data chain (no bridge IC after the pivot).
- §3 Calc trail: the real decoupling / rail values.
- §4 IC selection: S3-WROOM-1 module, AP2112K LDO, USBLC6 ESD — with the datasheet sections read.
- §6 Risk register: port R1 (the bridge-sourcing dead end → S3 pivot) as the worked example of a registered + de-risked risk; add antenna keep-out, USB-DP/DN routing.
- §7 DESIGN_VALIDATION: the 6 core items, all checkable against this doc.
- §8 BOM sourcing: target cost + the sourcing notes.
- Header table: `Slug = l1-01-wroom-breakout` (the correct current slug — **not** `foundry-…`).

**Step 3: Collapse the stale file**

Replace `docs/boards/wroom-breakout/design.md` contents with a one-line pointer so the two never diverge:

```markdown
# Moved

This board's design doc now lives at
[`docs/boards/l1-01-wroom-breakout/design.md`](../l1-01-wroom-breakout/design.md)
(correct current slug). See that file.
```

> Alternatively `git mv` the old file and restructure in place, but the new file must end up at `docs/boards/l1-01-wroom-breakout/design.md` with the corrected slug.

**Step 4: Commit**

```bash
git add docs/boards/l1-01-wroom-breakout/design.md docs/boards/wroom-breakout/design.md
git commit -m "docs(ws2): worked-example design doc — port WROOM L1.01 into the template structure"
```

---

## Task 6: Full verification + PR

**Step 1: Full typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS.

**Step 2: Full test suite (one run, never concurrent)**

Run: `pnpm vitest run`
Expected: all green (modulo the known prod-coupled guide-completion case, which WS1 fixed — if it appears, confirm your diff doesn't touch guide-completion). If the fixture looks disturbed, `pnpm db:seed` then re-run.

**Step 3: Build (the CI gate Josh checks)**

Run: `pnpm build`
Expected: `prisma generate` + `next build` succeed.

**Step 4: Manual smoke (local dev) — recommended before PR**

- `Start-Process pnpm.cmd dev -WindowStyle Hidden` (detached; a harness-backgrounded dev server dies on the next tool call).
- On a project, tick **Has Li-ion** and **Has thermal concern**. On a `BOM_SOURCING` revision, generate a DESIGN_VALIDATION checklist → 6 core items + 2 Li-ion + 2 thermal (+ 2 mains if `hasMainsNet`), in declaration order. With no flags → 6 core only.
- View `docs/boards/l1-01-wroom-breakout/design.md` renders cleanly.

**Step 5: Push + open PR**

```bash
git push -u origin feat/ws2-design-front-end
gh pr create --base feat/ws1-foundations --title "feat(ws2): design front-end — Li-ion/thermal flags + risks-de-risked item + WROOM worked example" --body "<summary + verification; link docs/plans/2026-06-16-ws2-design-front-end-design.md; note: stacked on feat/ws1-foundations, retarget to main after #142 merges>"
```

**Step 6: Verify CI explicitly, then hand back**

- `gh pr checks` — wait for completion; confirm `build | pass` explicitly (a green `--watch` exit is NOT proof; `build` can merge red).
- Do **not** merge. Hand back to Josh with the PR link + local smoke results.

---

## Done criteria

- `Project.hasLiIon` / `hasThermalConcern` columns migrated to prod; client regenerated.
- DESIGN_VALIDATION materializes 6 core items; `hasLiIon`/`hasThermalConcern`/`hasMainsNet` each inject their 2 items in declaration order (verified by tests).
- Both flags settable from the project edit page **and** the create form.
- `docs/boards/l1-01-wroom-breakout/design.md` exists, ported from the real WROOM doc, correct slug; the stale file collapsed to a pointer.
- No stage gate / exitGate added (still WS4).
- `pnpm tsc --noEmit`, full `pnpm vitest run`, and `pnpm build` all green; PR open with `build | pass` confirmed.
