# WS1 — Foundations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the two schema-level foundations for the board-design process run — a `DESIGN_VALIDATION` checklist subkind (record + UI, no gate) with flag-driven conditional items injected at materialize time, and a second-source `altMpn`/`altManufacturer` field on `BomLine`.

**Architecture:** Add `DESIGN_VALIDATION` to the `ChecklistSubkind` enum and a canonical template pinned to `BOM_SOURCING`. Extend the `CanonicalTemplate` shape with declarative `conditionalItems` keyed on project flags; `materializeCanonicalChecklist`'s revision branch reads the parent project's flags and appends matching items. WS1 ships one real conditional (`hasMainsNet`). Separately, add two nullable free-text columns to `BomLine` threaded through schema → action → form → editor UI. No stage gate, no `bomTable` change, no price field.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 + Neon Postgres, Zod 4, vitest (runs against the live Neon DB), Tailwind (OTD palette).

**Design doc:** `docs/plans/2026-06-16-ws1-foundations-design.md`

---

## Critical constraints (read before starting)

- **`.env.local` `DATABASE_URL` is PROD.** Migrations and the vitest suite mutate prod. Migrations: hand-author SQL + `pnpm prisma migrate deploy` (resolves `prisma.config.ts` → `.env.local` → `DIRECT_URL`).
- **Never run vitest concurrently.** It corrupts the shared `esp32-sensor-breakout` fixture (`pnpm db:seed` restores). Run one file (or the full suite) at a time, sequentially.
- **`"use server"` files export only async functions** (`bom-lines.ts`, `checklists-form.ts`).
- **After any schema change:** `pnpm prisma generate`, then `pnpm tsc --noEmit`, then the full `pnpm vitest run`. Enum-mirror surfaces to update: the `CANONICAL_TEMPLATES` Record key-union, `canonicalTemplateKeySchema`, the form-action whitelist, the button prop union, the pane subkind list.
- **Do not merge.** Open the PR, verify CI `build | pass` explicitly, hand back to Josh.
- Branch is already created: `feat/ws1-foundations`.

---

## Task 1: Schema + migrations (enum value + BomLine columns)

**Files:**
- Modify: `prisma/schema.prisma` (enum `ChecklistSubkind` ~line 405; model `BomLine` ~line 704)
- Create: `prisma/migrations/20260616130000_design_validation_subkind/migration.sql`
- Create: `prisma/migrations/20260616130100_bomline_alt_mpn/migration.sql`

**Step 1: Add the enum value in the schema**

In `prisma/schema.prisma`, add `DESIGN_VALIDATION` as the last entry of `enum ChecklistSubkind`:

```prisma
enum ChecklistSubkind {
  GENERIC
  EQUIPMENT_PREFLIGHT
  SCREENING_STEP_0
  ASSEMBLY_STEPS
  POST_ASSEMBLY_CONTINUITY // ASSEMBLY gate matches on this subkind
  POLARITY_VERIFICATION
  REQUIREMENTS_REVIEW      // m16: gated at REQUIREMENTS exit
  LAYOUT_REVIEW            // m16: gated at LAYOUT exit
  STRIPBOARD_VALIDATION    // m17: gated at BOM_SOURCING exit when project.requiresStripboard
  DESIGN_VALIDATION        // WS1: design-validation record (no gate yet; WS4 board-readiness consumes it)
}
```

**Step 2: Add the two columns to `BomLine`**

In `model BomLine`, after the `notes String?` line:

```prisma
  notes       String?
  // WS1: second-source / alternate part. Informational sourcing hint — NOT a
  // FK to Part; either field may be present alone. Price is deliberately
  // out of scope here (cost roll-up is WS3; never reuse the name priceCents).
  altMpn          String?
  altManufacturer String?
```

**Step 3: Write the enum migration SQL**

Create `prisma/migrations/20260616130000_design_validation_subkind/migration.sql` (mirrors `20260602030000_stripboard_validation_subkind`):

```sql
-- AlterEnum
ALTER TYPE "ChecklistSubkind" ADD VALUE 'DESIGN_VALIDATION';
```

**Step 4: Write the column migration SQL**

Create `prisma/migrations/20260616130100_bomline_alt_mpn/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "BomLine" ADD COLUMN     "altMpn" TEXT,
ADD COLUMN     "altManufacturer" TEXT;
```

> Two separate migrations on purpose: `ALTER TYPE ... ADD VALUE` is kept alone (matches the stripboard precedent and sidesteps any "new enum value used in same transaction" edge case).

**Step 5: Apply migrations + regenerate client**

Run: `pnpm prisma migrate deploy`
Expected: `2 migrations found ... applied` (the two new folders), no error.

Run: `pnpm prisma generate`
Expected: `Generated Prisma Client` — `BomLine.altMpn`/`altManufacturer` and the new enum value now exist on the client types.

> If a `next dev` server is running, restart it (per the prisma-migrate-prod memory the running server holds the old generated client).

**Step 6: Sanity-check tsc (will surface the enum-mirror gaps Tasks 2–5 fix)**

Run: `pnpm tsc --noEmit`
Expected: PASS, OR errors only in the files Tasks 2–5 will edit (e.g. `CANONICAL_TEMPLATES` Record not yet listing the key is fine — it's a Record, tsc won't force the new member). Do not chase unrelated errors.

**Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260616130000_design_validation_subkind prisma/migrations/20260616130100_bomline_alt_mpn
git commit -m "feat(ws1): add DESIGN_VALIDATION subkind + BomLine alt-MPN columns (schema + migrations)"
```

---

## Task 2: `DESIGN_VALIDATION` canonical template + `conditionalItems` shape

**Files:**
- Modify: `src/lib/canonical-checklist-templates.ts`
- Modify: `src/lib/schemas/canonical-checklist.ts:17-22`
- Test: `src/lib/__tests__/canonical-checklist-templates.test.ts`

**Step 1: Write the failing test**

Append to `src/lib/__tests__/canonical-checklist-templates.test.ts` inside the `describe("canonical checklist templates", ...)` block:

```ts
  // WS1: DESIGN_VALIDATION — core mandatory items + a hasMainsNet conditional
  // block. Pinned to BOM_SOURCING (the validate → source-BOM handoff).
  test("DESIGN_VALIDATION template has 5 core items + a hasMainsNet conditional", () => {
    const t = CANONICAL_TEMPLATES.DESIGN_VALIDATION;
    expect(t.subkind).toBe("DESIGN_VALIDATION");
    expect(t.stage).toBe("BOM_SOURCING");
    expect(t.items.length).toBe(5);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Calc trail/i),
      expect.stringMatching(/datasheet-verified/i),
      expect.stringMatching(/Footprint/i),
      expect.stringMatching(/Fab-DRU/i),
      expect.stringMatching(/BOM availability/i),
    ]);
    const mains = t.conditionalItems?.find((c) => c.flag === "hasMainsNet");
    expect(mains).toBeDefined();
    expect(mains!.items.length).toBe(2);
    expect(mains!.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Mains-safety/i),
      expect.stringMatching(/Isolation barrier/i),
    ]);
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/canonical-checklist-templates.test.ts`
Expected: FAIL — `CANONICAL_TEMPLATES.DESIGN_VALIDATION` is `undefined` (and tsc/compile error on `conditionalItems`).

**Step 3: Extend the `CanonicalTemplate` interface**

In `src/lib/canonical-checklist-templates.ts`, add the conditional shape to the interface (after `items`):

```ts
export interface CanonicalTemplate {
  subkind: ChecklistSubkind;
  stage: Stage;
  title: string;
  items: CanonicalItem[];
  // WS1: declarative flag-driven items. At materialize time (revision-scoped
  // only) the parent project's boolean flag is read; if true, this block's
  // items are appended after the core `items`. Keys are Project boolean flags.
  conditionalItems?: {
    flag: "hasMainsNet" | "requiresStripboard";
    items: CanonicalItem[];
  }[];
}
```

**Step 4: Add `DESIGN_VALIDATION` to the Record (key-union + entry)**

Add `"DESIGN_VALIDATION"` to the `Record<...>` key union and add the entry. The union becomes:

```ts
export const CANONICAL_TEMPLATES: Record<
  | "REQUIREMENTS_REVIEW"
  | "LAYOUT_REVIEW"
  | "STRIPBOARD_VALIDATION"
  | "POST_ASSEMBLY_CONTINUITY"
  | "DESIGN_VALIDATION",
  CanonicalTemplate
> = {
```

Add this entry (place it after `STRIPBOARD_VALIDATION`, before the closing `}`):

```ts
  // WS1: DESIGN_VALIDATION — the gateable design-validation record. Core items
  // are attestations (a process gate, not machine proof — plan decision 6).
  // Conditional items are injected at materialize time from project flags;
  // WS1 ships only the hasMainsNet block (requiresStripboard already owns its
  // own STRIPBOARD_VALIDATION checklist; Li-ion/thermal have no flag yet).
  // No exitGate consumes this in WS1 — WS4's advisory board-readiness will.
  DESIGN_VALIDATION: {
    subkind: "DESIGN_VALIDATION",
    stage: "BOM_SOURCING",
    title: "DESIGN_VALIDATION checklist",
    items: [
      {
        label:
          "Calc trail recorded — every derived value (rails, currents, divider/timing) traces to a source.",
      },
      {
        label:
          "Each IC datasheet-verified — the chosen part's datasheet matches the schematic symbol and intended use.",
      },
      {
        label:
          "Footprint ↔ pinout cross-checked — each part's footprint pad map matches the datasheet pinout.",
      },
      {
        label:
          "Fab-DRU DRC accounted for — the fab's design rules (.kicad_dru) will be applied before gerber export.",
      },
      {
        label:
          "BOM availability confirmed — every part is in stock and not EOL/NRND at a real distributor.",
      },
    ],
    conditionalItems: [
      {
        flag: "hasMainsNet",
        items: [
          {
            label:
              "Mains-safety review completed — clearance/creepage, fusing, and earthing per the design doc.",
          },
          {
            label:
              "Isolation barrier verified — isolation gap on the layout plan and the certified module's isolation rating.",
          },
        ],
      },
    ],
  },
```

**Step 5: Add the key to the zod template-key enum**

In `src/lib/schemas/canonical-checklist.ts`, add `"DESIGN_VALIDATION"` to `canonicalTemplateKeySchema`:

```ts
export const canonicalTemplateKeySchema = z.enum([
  "REQUIREMENTS_REVIEW",
  "LAYOUT_REVIEW",
  "STRIPBOARD_VALIDATION",
  "POST_ASSEMBLY_CONTINUITY",
  "DESIGN_VALIDATION",
]);
```

**Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/canonical-checklist-templates.test.ts`
Expected: PASS (all template tests including the new one).

**Step 7: Commit**

```bash
git add src/lib/canonical-checklist-templates.ts src/lib/schemas/canonical-checklist.ts src/lib/__tests__/canonical-checklist-templates.test.ts
git commit -m "feat(ws1): DESIGN_VALIDATION canonical template + conditionalItems shape"
```

---

## Task 3: Conditional-item injection in `materializeCanonicalChecklist`

**Files:**
- Modify: `src/lib/actions/checklists.ts` (revision branch ~line 655-682)
- Test: `src/lib/__tests__/checklists-actions.test.ts`

**Step 1: Write the failing tests**

In `src/lib/__tests__/checklists-actions.test.ts`:

1a. Add a tracked-project array near the other `created*Ids` arrays (~line 69):

```ts
const createdProjectIds: string[] = [];
```

1b. In `afterAll` (after the `createdRevisionIds` delete block, ~line 95), add — projects deleted last so their revision cascade is harmless:

```ts
  if (createdProjectIds.length > 0) {
    await db.project.deleteMany({
      where: { id: { in: createdProjectIds } },
    });
  }
```

1c. Add two helpers (near `makeRevAtStage`, ~line 133):

```ts
async function makeProjectWithFlags(flags: {
  hasMainsNet?: boolean;
  requiresStripboard?: boolean;
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
    },
  });
  createdProjectIds.push(project.id);
  return project;
}

async function makeRevOnProject(
  projectId: string,
  stage: Stage,
  label: string,
): Promise<{ id: string }> {
  const rev = await db.revision.create({
    data: { projectId, label, currentStage: stage },
  });
  createdRevisionIds.push(rev.id);
  return rev;
}
```

1d. Add the describe block (after the existing `materializeCanonicalChecklist — build-scoped (m5)` block, near end of file):

```ts
// ─── WS1: DESIGN_VALIDATION conditional injection ──────────────────────────
//
// The revision branch reads the parent project's boolean flags and appends
// any conditionalItems block whose flag is true. WS1 ships the hasMainsNet
// block (2 items) on top of the 5 core items.

describe("materializeCanonicalChecklist — DESIGN_VALIDATION conditional injection (WS1)", () => {
  test("hasMainsNet=false → only the 5 core items", async () => {
    const project = await makeProjectWithFlags({ hasMainsNet: false });
    const rev = await makeRevOnProject(
      project.id,
      "BOM_SOURCING",
      `ws1-dv-nomains-${Date.now()}`,
    );

    const checklist = await materializeCanonicalChecklist({
      revisionId: rev.id,
      templateKey: "DESIGN_VALIDATION",
    });
    createdChecklistIds.push(checklist.id);

    expect(checklist.subkind).toBe("DESIGN_VALIDATION");
    expect(checklist.stage).toBe("BOM_SOURCING");

    const items = await db.checklistItem.findMany({
      where: { checklistId: checklist.id },
      orderBy: { ordinal: "asc" },
    });
    expect(items.length).toBe(5);
    expect(
      items.every((i) => !/Mains-safety|Isolation barrier/i.test(i.label)),
    ).toBe(true);
  });

  test("hasMainsNet=true → 5 core items + 2 appended safety items, in order", async () => {
    const project = await makeProjectWithFlags({ hasMainsNet: true });
    const rev = await makeRevOnProject(
      project.id,
      "BOM_SOURCING",
      `ws1-dv-mains-${Date.now()}`,
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
    expect(items.length).toBe(7);
    expect(items[5]!.label).toMatch(/Mains-safety/i);
    expect(items[6]!.label).toMatch(/Isolation barrier/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/__tests__/checklists-actions.test.ts -t "DESIGN_VALIDATION conditional injection"`
Expected: FAIL — second test gets 5 items (no injection yet), not 7.

**Step 3: Implement the injection in the revision branch**

In `src/lib/actions/checklists.ts`, the revision-scoped branch (currently ~line 655-682) is:

```ts
        // Revision-scoped owner (default, unchanged from m16).
        const revisionId = data.revisionId!;
        await assertNotFrozen(tx, revisionId);

        const existing = await tx.checklist.findFirst({
          where: { revisionId, subkind: template.subkind },
        });
        if (existing) {
          throw new Error(
            `A ${template.subkind} checklist already exists for this revision.`,
          );
        }

        return tx.checklist.create({
          data: {
            revisionId,
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
```

Replace it with (adds the flag read + merged item list):

```ts
        // Revision-scoped owner (default, unchanged from m16).
        const revisionId = data.revisionId!;
        await assertNotFrozen(tx, revisionId);

        const existing = await tx.checklist.findFirst({
          where: { revisionId, subkind: template.subkind },
        });
        if (existing) {
          throw new Error(
            `A ${template.subkind} checklist already exists for this revision.`,
          );
        }

        // WS1: flag-driven conditional items. Read the parent project's
        // boolean flags and append any conditionalItems block whose flag is
        // true (DESIGN_VALIDATION uses this; other templates declare none, so
        // `items` collapses to `template.items`). Core items keep their
        // ordinals first; conditional items follow in declaration order.
        const rev = await tx.revision.findUniqueOrThrow({
          where: { id: revisionId },
          select: {
            project: {
              select: { hasMainsNet: true, requiresStripboard: true },
            },
          },
        });
        const flags = rev.project;
        const items = [
          ...template.items,
          ...(template.conditionalItems ?? [])
            .filter((c) => flags[c.flag])
            .flatMap((c) => c.items),
        ];

        return tx.checklist.create({
          data: {
            revisionId,
            stage: template.stage,
            subkind: template.subkind,
            title: template.title,
            createdById: user.id,
            items: {
              create: items.map((it, idx) => ({
                ordinal: idx,
                label: it.label,
              })),
            },
          },
        });
```

> The build-scoped branch (~line 638-652) is unchanged — it still uses `template.items` directly (build-scoped templates declare no `conditionalItems`).

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/checklists-actions.test.ts`
Expected: PASS — the full file (existing materialize/gate tests + the two new WS1 tests). Run the whole file (not just `-t`) to confirm no regression.

**Step 5: Commit**

```bash
git add src/lib/actions/checklists.ts src/lib/__tests__/checklists-actions.test.ts
git commit -m "feat(ws1): inject DESIGN_VALIDATION conditional items from project flags at materialize time"
```

---

## Task 4: `BomLine` alt-MPN through schema + action + form wrapper

**Files:**
- Modify: `src/lib/schemas/bom-line.ts`
- Modify: `src/lib/actions/bom-lines.ts` (`createBomLine` ~line 46-54; `createBomLineFormAction` ~line 142-148)
- Test: `src/lib/__tests__/bom-lines-actions.test.ts`

**Step 1: Write the failing test**

Append to `src/lib/__tests__/bom-lines-actions.test.ts` (a new `describe` at end of file):

```ts
// ─── WS1: second-source alt-MPN fields ─────────────────────────────────────

describe("BomLine alt-MPN (WS1)", () => {
  test("create carries altMpn + altManufacturer; edit updates altMpn alone", async () => {
    const rev = await makeFreshRevision(`t-ws1-alt-${Date.now()}`);
    const part = await aPart();

    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "U9",
      quantity: 1,
      altMpn: "ALT-123",
      altManufacturer: "AltCorp",
    });
    createdBomLineIds.push(line.id);
    expect(line.altMpn).toBe("ALT-123");
    expect(line.altManufacturer).toBe("AltCorp");

    const edited = await editBomLine({ id: line.id, altMpn: "ALT-456" });
    expect(edited.altMpn).toBe("ALT-456");
    // untouched field preserved
    expect(edited.altManufacturer).toBe("AltCorp");
  });

  test("alt fields default to null when omitted", async () => {
    const rev = await makeFreshRevision(`t-ws1-alt-null-${Date.now()}`);
    const part = await aPart();
    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "U10",
      quantity: 1,
    });
    createdBomLineIds.push(line.id);
    expect(line.altMpn).toBeNull();
    expect(line.altManufacturer).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/bom-lines-actions.test.ts -t "alt-MPN"`
Expected: FAIL — `createBomLine` ignores the unknown keys, `line.altMpn` is `undefined`/missing.

**Step 3: Extend the zod schemas**

In `src/lib/schemas/bom-line.ts`, add a shared field above `createBomLineSchema` (after `refDesField`, ~line 17):

```ts
// WS1: second-source identity. Optional + nullable so a line may carry an
// alternate MPN, an alternate manufacturer, both, or neither. Not coupled —
// it's an informational sourcing hint, not a Part FK.
const altSourceField = z.string().trim().max(200).optional().nullable();
```

Add the two fields to the `createBomLineSchema` object (alongside `notes`):

```ts
    notes: z.string().max(1000).optional().nullable(),
    altMpn: altSourceField,
    altManufacturer: altSourceField,
```

Add the same two fields to the `editBomLineSchema` object (alongside `notes`):

```ts
    notes: z.string().max(1000).optional().nullable(),
    altMpn: altSourceField,
    altManufacturer: altSourceField,
```

**Step 4: Thread through the create action + form wrapper**

In `src/lib/actions/bom-lines.ts`, `createBomLine` — add the two fields to the create `data` (after `notes`):

```ts
            notes: data.notes ?? null,
            altMpn: data.altMpn ?? null,
            altManufacturer: data.altManufacturer ?? null,
            createdById: user.id,
```

> `editBomLine` needs no change — its `Object.entries(rest)` loop already forwards any defined key (including `altMpn`/`altManufacturer`), and `null` clears, `undefined` is skipped.

In `createBomLineFormAction`, add the two fields to `raw` (after `notes`):

```ts
    notes: pickString(formData, "notes"),
    altMpn: pickString(formData, "altMpn"),
    altManufacturer: pickString(formData, "altManufacturer"),
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/bom-lines-actions.test.ts`
Expected: PASS (full file — existing freeze/refdes tests + the two new WS1 tests).

**Step 6: Commit**

```bash
git add src/lib/schemas/bom-line.ts src/lib/actions/bom-lines.ts src/lib/__tests__/bom-lines-actions.test.ts
git commit -m "feat(ws1): thread BomLine altMpn/altManufacturer through schema + actions"
```

---

## Task 5: UI — DESIGN_VALIDATION generate button + BOM editor alt fields

**Files:**
- Modify: `src/lib/actions/checklists-form.ts` (`materializeCanonicalChecklistFormAction` ~line 314-320)
- Modify: `src/components/MaterializeReviewButton.tsx` (templateKey union ~line 50-54)
- Modify: `src/components/RevisionChecklistsPane.tsx` (subkind list ~line 35-40; show-logic ~line 87-104; render ~line 129-149)
- Modify: `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (BomEditor `lines.map` ~line 336-346)

> No new prop is needed on `RevisionChecklistsPane`: DESIGN_VALIDATION is offered at `BOM_SOURCING` regardless of flags; `hasMainsNet` only changes which items are injected server-side.

**Step 1: Whitelist the template key in the form action**

In `src/lib/actions/checklists-form.ts`, extend the guard in `materializeCanonicalChecklistFormAction`:

```ts
  if (
    templateKey !== "REQUIREMENTS_REVIEW" &&
    templateKey !== "LAYOUT_REVIEW" &&
    templateKey !== "STRIPBOARD_VALIDATION" &&
    templateKey !== "DESIGN_VALIDATION"
  ) {
    return { message: "Invalid template key." };
  }
```

**Step 2: Extend the button's templateKey union**

In `src/components/MaterializeReviewButton.tsx`:

```ts
  templateKey:
    | "REQUIREMENTS_REVIEW"
    | "LAYOUT_REVIEW"
    | "STRIPBOARD_VALIDATION"
    | "DESIGN_VALIDATION";
```

**Step 3: Add DESIGN_VALIDATION to the pane's subkind list + show-logic + render**

In `src/components/RevisionChecklistsPane.tsx`:

3a. Add to `REVISION_SUBKINDS` (~line 35):

```ts
const REVISION_SUBKINDS: ChecklistSubkind[] = [
  "GENERIC",
  "REQUIREMENTS_REVIEW",
  "LAYOUT_REVIEW",
  "STRIPBOARD_VALIDATION",
  "DESIGN_VALIDATION",
];
```

3b. In the component body, alongside the other `has*`/`showMaterialize*` consts (~line 87-104), add:

```ts
  const hasDesignValidation = checklists.some(
    (c) => c.subkind === "DESIGN_VALIDATION",
  );
  // WS1: offered at BOM_SOURCING regardless of flags (hasMainsNet only changes
  // the injected item set, not button visibility).
  const showMaterializeDesignValidation =
    !disabled && stage === "BOM_SOURCING" && !hasDesignValidation;
```

3c. In the "Materialize canonical:" render group (~line 143, after the stripboard button block), add:

```tsx
          {showMaterializeDesignValidation ? (
            <MaterializeReviewButton
              revisionId={revisionId}
              templateKey="DESIGN_VALIDATION"
              label="DESIGN_VALIDATION"
            />
          ) : null}
```

**Step 4: BOM editor — alt fields in the row type, form, and list**

In `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx`:

4a. Extend `BomLineRow` (~line 19):

```ts
type BomLineRow = {
  id: string;
  refDes: string;
  quantity: number;
  notes: string | null;
  altMpn: string | null;
  altManufacturer: string | null;
  part: PartOption;
};
```

4b. Add two inputs to the form. Replace the existing notes `<div className="md:col-span-5">…</div>` block with notes + a second-source row:

```tsx
          <div className="md:col-span-5">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Notes (optional)
            </label>
            <input
              name="notes"
              disabled={disabled}
              maxLength={1000}
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.notes} />
          </div>

          {/* WS1: optional second-source (alternate MPN / manufacturer). */}
          <div className="md:col-span-3">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Alt. MPN (optional)
            </label>
            <input
              name="altMpn"
              disabled={disabled}
              maxLength={200}
              placeholder="second-source part number"
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.altMpn} />
          </div>
          <div className="md:col-span-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Alt. mfr. (optional)
            </label>
            <input
              name="altManufacturer"
              disabled={disabled}
              maxLength={200}
              placeholder="second-source maker"
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.altManufacturer} />
          </div>
```

4c. Show the second-source in each line row. Replace the line `<li>`'s inner markup so a muted second-source line renders when present. The current `<li>` (~line 185-210) keeps its grid; add a second-source span inside the first cell. Change the first `<span className="text-link-muted">…</span>` to:

```tsx
                <span className="text-link-muted">
                  <span className="text-command-gold">{line.refDes}</span>{" "}
                  <span className="text-muted">·</span>{" "}
                  {line.part.manufacturer} {line.part.mpn}
                  {line.altMpn || line.altManufacturer ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      alt: {line.altManufacturer ?? ""} {line.altMpn ?? ""}
                    </span>
                  ) : null}
                </span>
```

**Step 5: Pass the alt fields from the page into the editor**

In `src/app/projects/[slug]/[revLabel]/page.tsx`, the `lines={revision.bomLines.map(...)}` block (~line 336-346) — add the two fields:

```tsx
                  lines={revision.bomLines.map((l) => ({
                    id: l.id,
                    refDes: l.refDes,
                    quantity: l.quantity,
                    notes: l.notes,
                    altMpn: l.altMpn,
                    altManufacturer: l.altManufacturer,
                    part: {
                      id: l.part.id,
                      mpn: l.part.mpn,
                      manufacturer: l.part.manufacturer,
                    },
                  }))}
```

**Step 6: Typecheck the UI changes**

Run: `pnpm tsc --noEmit`
Expected: PASS (the button union, form-action whitelist, pane subkind list, editor row type, and page map all align now).

**Step 7: Commit**

```bash
git add src/lib/actions/checklists-form.ts src/components/MaterializeReviewButton.tsx src/components/RevisionChecklistsPane.tsx "src/app/projects/[slug]/[revLabel]/_bom-editor.tsx" "src/app/projects/[slug]/[revLabel]/page.tsx"
git commit -m "feat(ws1): DESIGN_VALIDATION generate button + BOM editor second-source fields"
```

---

## Task 6: Full verification + PR

**Step 1: Full typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS, no errors.

**Step 2: Full test suite (one run, never concurrent)**

Run: `pnpm vitest run`
Expected: all green. If the `esp32-sensor-breakout` fixture looks disturbed by an earlier interrupted run, restore with `pnpm db:seed` first, then re-run.

**Step 3: Build (the CI gate Josh checks)**

Run: `pnpm build`
Expected: `prisma generate` + `next build` succeed, no type/route errors.

**Step 4: Manual smoke (local dev) — optional but recommended before PR**

- `Start-Process pnpm.cmd dev -WindowStyle Hidden` (detached; a harness-backgrounded dev server dies on the next tool call per the dev-server memory).
- On a BOM_SOURCING revision of a project with `hasMainsNet = true`: the checklist pane shows a `DESIGN_VALIDATION` generate button; clicking it creates a checklist with the 5 core items **and** the 2 mains-safety items. On a non-mains project: 5 items only.
- In the BOM editor: add a line with Alt. MPN + Alt. mfr.; the row shows `alt: <mfr> <mpn>`.

**Step 5: Push + open PR**

```bash
git push -u origin feat/ws1-foundations
gh pr create --title "feat(ws1): board-design foundations — DESIGN_VALIDATION subkind + BomLine second-source" --body "<summary + verification notes; link docs/plans/2026-06-16-ws1-foundations-design.md>"
```

**Step 6: Verify CI explicitly, then hand back**

- `gh pr checks` — wait for completion. A green `--watch` exit is NOT proof; confirm the `build` check shows `build | pass` explicitly (per the ci-build-not-required-gate memory, `build` can merge red).
- Do **not** merge. Hand back to Josh with the PR link + the local smoke results for his review.

---

## Done criteria

- `DESIGN_VALIDATION` enum value + `BomLine.altMpn`/`altManufacturer` columns migrated to prod; client regenerated.
- `DESIGN_VALIDATION` canonical template (5 core items) materializes at BOM_SOURCING; `hasMainsNet` appends exactly 2 safety items (verified by tests).
- `altMpn`/`altManufacturer` create/edit/clear correctly (verified by tests) and render in the BOM editor.
- No exitGate added; no `bomTable` change; no price field.
- `pnpm tsc --noEmit`, full `pnpm vitest run`, and `pnpm build` all green; PR open with `build | pass` confirmed.
