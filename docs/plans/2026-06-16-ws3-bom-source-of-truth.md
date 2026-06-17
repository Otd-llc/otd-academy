# WS3 — BOM as single source of truth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the revision's `BomLine` set the trustworthy single source of truth for the board — per-line price (design-to-cost), a frictionless CSV import, and a lifecycle/cost advisory surfaced (soft-confirm) at BOM freeze.

**Architecture:** Add one nullable `BomLine.unitPriceCents` column threaded through schema → action → editor. Add a pure, testable `bom-csv.ts` parser + a `bom-cost.ts` roll-up/assessor, and an `importBomCsv` server action that strict-matches parts by `(manufacturer, mpn)` and upserts on `[revisionId, partId]` inside a Serializable retry tx. Surface the cost roll-up + lifecycle advisory in the admin BOM editor and a client-side "I've reviewed" ack on the `StageActions` advance control (which freezes the BOM on entry to LAYOUT). No public `bomTable` change, no live stock API, no `advanceStage` change.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 + Neon Postgres, Zod 4, vitest (live Neon DB), Tailwind (OTD palette).

**Design doc:** `docs/plans/2026-06-16-ws3-bom-source-of-truth-design.md`

---

## Critical constraints (read before starting)

- **`.env.local` `DATABASE_URL` is PROD.** Migrations + vitest mutate prod. Migrations: hand-author SQL + `pnpm prisma migrate deploy`. **Never `migrate dev`.**
- **Never run vitest concurrently.** Corrupts the `esp32-sensor-breakout` fixture (`pnpm db:seed` restores). One suite at a time.
- **New DB-backed tests use throwaway revisions** (fresh rev on `esp32-sensor-breakout` or a throwaway project) and clean up in `afterAll`. Never assert on a real curriculum row's mutable state.
- **`"use server"` files export only async functions** (`bom-lines.ts`). Keep the pure parser/cost helpers in `bom-csv.ts` / `bom-cost.ts` (plain modules) — only `async importBomCsv` (+ a form wrapper) goes in the action file. No new non-async export, no `export type { X }` re-export there.
- **The "frozen BOM" guard is `assertBomNotFrozen` (checks `bomFrozenAt`), NOT `assertNotFrozen` (checks revision `frozenAt`).** `createBomLine` calls both — the importer must too.
- **`Part.lifecycle` enum is `ACTIVE | NRND | EOL | OBSOLETE`.** Warn on `!== "ACTIVE"`, never an `NRND`/`EOL` allowlist (misses `OBSOLETE`).
- **WS3 touches `BomLine` (which WS1 also touched) + the BOM editor.** Branch off `feat/ws1-foundations`: `git checkout feat/ws1-foundations && git checkout -b feat/ws3-bom-source-of-truth`. Retarget the PR base to `main` after WS1 merges.
- **Do not merge.** Open the PR, verify CI `build | pass` explicitly, hand back.

---

## Task 1: Schema + migration (`BomLine.unitPriceCents`)

**Files:**
- Modify: `prisma/schema.prisma` (model `BomLine`, after `altManufacturer` ~line 718)
- Create: `prisma/migrations/20260616170000_bomline_unit_price/migration.sql`

**Step 1: Add the column in the schema**

In `model BomLine`, after `altManufacturer String?`:

```prisma
  altManufacturer String?
  unitPriceCents  Int?    // WS3: quoted unit price (cents) for design-to-cost. NOT priceCents (that's Project's course price).
```

**Step 2: Write the migration SQL**

Create `prisma/migrations/20260616170000_bomline_unit_price/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "BomLine" ADD COLUMN IF NOT EXISTS "unitPriceCents" INTEGER;
```

**Step 3: Apply + regenerate**

Run: `pnpm prisma migrate deploy` → `1 migration found ... applied`.
Run: `pnpm prisma generate` → client now has `BomLine.unitPriceCents`.

**Step 4: Sanity tsc**

Run: `pnpm tsc --noEmit` → PASS (additive column).

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260616170000_bomline_unit_price
git commit -m "feat(ws3): add BomLine.unitPriceCents (schema + migration)"
```

---

## Task 2: Price through schema + action + editor

**Files:**
- Modify: `src/lib/schemas/bom-line.ts` (both schemas)
- Modify: `src/lib/actions/bom-lines.ts` (`createBomLine` create data; `createBomLineFormAction` raw reads)
- Modify: `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx` (row type, form input, row display)
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (`revision.bomLines.map(...)`)
- Test: `src/lib/__tests__/bom-lines-actions.test.ts`

**Step 1: Write the failing test**

Append to `src/lib/__tests__/bom-lines-actions.test.ts`:

```ts
describe("BomLine unitPriceCents (WS3)", () => {
  test("create carries unitPriceCents; edit updates it; omitted → null", async () => {
    const rev = await makeFreshRevision(`t-ws3-price-${Date.now()}`);
    const part = await aPart();

    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "U11",
      quantity: 1,
      unitPriceCents: 123,
    });
    createdBomLineIds.push(line.id);
    expect(line.unitPriceCents).toBe(123);

    const edited = await editBomLine({ id: line.id, unitPriceCents: 456 });
    expect(edited.unitPriceCents).toBe(456);

    const rev2 = await makeFreshRevision(`t-ws3-price-null-${Date.now()}`);
    const line2 = await createBomLine({
      revisionId: rev2.id,
      partId: part.id,
      refDes: "U12",
      quantity: 1,
    });
    createdBomLineIds.push(line2.id);
    expect(line2.unitPriceCents).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/bom-lines-actions.test.ts -t "unitPriceCents"`
Expected: FAIL — `createBomLine` ignores the unknown key.

**Step 3: Extend the zod schemas**

In `src/lib/schemas/bom-line.ts`, add to **both** `createBomLineSchema` and `editBomLineSchema` (alongside `notes`/`altMpn`):

```ts
    unitPriceCents: z.number().int().nonnegative().max(100_000_000).optional().nullable(),
```

> Place it before the object's `.refine()` (the refDes-count refine) — it doesn't interact with that refinement.

**Step 4: Thread through the action + form wrapper**

In `src/lib/actions/bom-lines.ts`:

4a. `createBomLine` — add to the create `data` (after `altManufacturer`):

```ts
            unitPriceCents: data.unitPriceCents ?? null,
```

> `editBomLine` needs no change — it forwards any defined key that survives `editBomLineSchema.parse` (now including `unitPriceCents`).

4b. `createBomLineFormAction` — the form sends **dollars**. Read it and convert to cents before validation. Add to the `raw` object build (after the alt fields):

```ts
    unitPriceCents: dollarsToCents(pickString(formData, "unitPrice")),
```

Add a tiny local helper above the action (pure, not exported):

```ts
// Dollars string from a form field → integer cents, or null when blank/invalid.
function dollarsToCents(v: string | null | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/bom-lines-actions.test.ts`
Expected: PASS (full file).

**Step 6: Editor — row type, price input, row display**

In `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx`:

6a. Extend `BomLineRow` (the local type ~line 19) — add `unitPriceCents: number | null;` and `part.lifecycle` (used by Task 5):

```ts
type BomLineRow = {
  id: string;
  refDes: string;
  quantity: number;
  notes: string | null;
  altMpn: string | null;
  altManufacturer: string | null;
  unitPriceCents: number | null;
  part: PartOption & { lifecycle: PartLifecycle };
};
```

(Import `PartLifecycle` from `@prisma/client`.)

6b. Add a "Unit price (USD)" input to the add-line form (mirror the alt-field inputs, OTD palette):

```tsx
          <div className="md:col-span-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Unit price (USD)
            </label>
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              disabled={disabled}
              placeholder="0.00"
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.unitPriceCents} />
          </div>
```

6c. Show the price in each line row (muted, beside qty), using `formatUsd` from `@/lib/format-money`:

```tsx
                {line.unitPriceCents != null ? (
                  <span className="ml-2 text-muted">· {formatUsd(line.unitPriceCents)}</span>
                ) : null}
```

**Step 7: Pass price + lifecycle from the page into the editor**

In `src/app/projects/[slug]/[revLabel]/page.tsx`, the `lines={revision.bomLines.map((l) => ({ ... }))}` block — add `unitPriceCents: l.unitPriceCents,` and `lifecycle: l.part.lifecycle` into the mapped `part`. The query already `include: { part: true }`, so both are available.

**Step 8: Typecheck**

Run: `pnpm tsc --noEmit` → PASS.

**Step 9: Commit**

```bash
git add src/lib/schemas/bom-line.ts src/lib/actions/bom-lines.ts "src/app/projects/[slug]/[revLabel]/_bom-editor.tsx" "src/app/projects/[slug]/[revLabel]/page.tsx" src/lib/__tests__/bom-lines-actions.test.ts
git commit -m "feat(ws3): per-line unitPriceCents through schema, action, and BOM editor"
```

---

## Task 3: Pure CSV parser (`bom-csv.ts`)

**Files:**
- Create: `src/lib/bom-csv.ts`
- Test: `src/lib/__tests__/bom-csv.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/bom-csv.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseBomCsv } from "@/lib/bom-csv";

describe("parseBomCsv", () => {
  test("maps header columns and converts dollars → cents", () => {
    const csv =
      "refDes,manufacturer,mpn,quantity,unitPrice\n" +
      "R1,Yageo,RC0805,1,0.02";
    const { rows, errors } = parseBomCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      refDes: "R1",
      manufacturer: "Yageo",
      mpn: "RC0805",
      quantity: 1,
      unitPriceCents: 2,
    });
  });

  test("blank unitPrice → null", () => {
    const { rows } = parseBomCsv("refDes,manufacturer,mpn,quantity,unitPrice\nC1,KEMET,C0805,1,");
    expect(rows[0]!.unitPriceCents).toBeNull();
  });

  test("multi-refDes normalizes to comma-joined and must match quantity", () => {
    const ok = parseBomCsv("refDes,manufacturer,mpn,quantity\n\"R1, R2\",Yageo,RC0805,2");
    expect(ok.errors).toEqual([]);
    expect(ok.rows[0]!.refDes).toBe("R1,R2");

    const bad = parseBomCsv("refDes,manufacturer,mpn,quantity\n\"R1, R2\",Yageo,RC0805,3");
    expect(bad.rows).toEqual([]);
    expect(bad.errors[0]).toMatchObject({ row: 2 });
  });

  test("trailing comma in refDes is rejected (count mismatch)", () => {
    const { errors } = parseBomCsv("refDes,manufacturer,mpn,quantity\n\"R1,\",Yageo,RC0805,1");
    expect(errors.length).toBe(1);
  });

  test("missing required column → top-level error, no rows", () => {
    const { rows, errors } = parseBomCsv("manufacturer,mpn,quantity\nYageo,RC0805,1");
    expect(rows).toEqual([]);
    expect(errors[0]!.message).toMatch(/refDes/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/__tests__/bom-csv.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the parser**

Create `src/lib/bom-csv.ts`. Pure, no DB, no React. Contract: header row required (`refDes, manufacturer, mpn, quantity` mandatory; `unitPrice, altMpn, altManufacturer, notes` optional), extra columns ignored, rows 1-indexed in errors (header is row 1, first data row is row 2). Minimal CSV with quoted-field support (handle `"R1, R2"`):

```ts
export interface ParsedBomRow {
  refDes: string;          // normalized comma-joined, no spaces
  manufacturer: string;
  mpn: string;
  quantity: number;
  unitPriceCents: number | null;
  altMpn: string | null;
  altManufacturer: string | null;
  notes: string | null;
}

export interface RowError {
  row: number;             // 1-indexed source line
  message: string;
}

export interface ParseResult {
  rows: ParsedBomRow[];
  errors: RowError[];
}

const REQUIRED = ["refDes", "manufacturer", "mpn", "quantity"] as const;

export function parseBomCsv(text: string): ParseResult { /* implement per below */ }
```

Implementation notes (encode exactly):
- Split into lines (handle `\r\n` and `\n`); drop a trailing empty line; the first non-empty line is the header.
- Parse each line into fields with a small quoted-CSV splitter (a field may be wrapped in `"`; commas inside quotes are literal; `""` is an escaped quote).
- Lower-case-insensitively map header names to indices; if any `REQUIRED` header is missing, return `{ rows: [], errors: [{ row: 1, message: "missing required column(s): …" }] }`.
- Per data row (1-indexed = line number): trim each cell; `quantity` must parse to a positive integer (else row error); `unitPrice` blank → null, else `Math.round(parseFloat * 100)` (negative/NaN → row error); `refDes` split on commas **and** whitespace, trim each segment, drop blanks, re-join with commas — the segment count must equal `quantity` (else row error: "refDes count N ≠ quantity M"); optional fields blank → null.
- Collect per-row errors; a row with any error is excluded from `rows`.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/bom-csv.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/bom-csv.ts src/lib/__tests__/bom-csv.test.ts
git commit -m "feat(ws3): pure BOM CSV parser with refDes-count + dollars→cents validation"
```

---

## Task 4: Cost roll-up + sourcing assessor (`bom-cost.ts`)

**Files:**
- Create: `src/lib/bom-cost.ts`
- Test: `src/lib/__tests__/bom-cost.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/bom-cost.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { bomCost, assessBomSourcing } from "@/lib/bom-cost";

const line = (over: Partial<{ quantity: number; unitPriceCents: number | null; lifecycle: string }>) => ({
  quantity: 1,
  unitPriceCents: 100,
  part: { lifecycle: (over.lifecycle ?? "ACTIVE") as never },
  ...over,
});

describe("bomCost", () => {
  test("sums qty × price; counts unpriced; compares to Decimal-dollar target", () => {
    const lines = [line({ quantity: 2, unitPriceCents: 150 }), line({ unitPriceCents: null })];
    const r = bomCost(lines, "2.50"); // targetCost is a Decimal serialized as dollars
    expect(r.totalCents).toBe(300);
    expect(r.unpricedCount).toBe(1);
    expect(r.targetCents).toBe(250);
    expect(r.overTarget).toBe(true);
  });

  test("null target → no overTarget", () => {
    const r = bomCost([line({})], null);
    expect(r.targetCents).toBeNull();
    expect(r.overTarget).toBe(false);
  });
});

describe("assessBomSourcing", () => {
  test("flags non-ACTIVE lifecycle (incl OBSOLETE), unpriced, over-target", () => {
    const { warnings } = assessBomSourcing(
      [line({ lifecycle: "OBSOLETE" }), line({ unitPriceCents: null })],
      "0.50",
    );
    const kinds = warnings.map((w) => w.kind).sort();
    expect(kinds).toContain("lifecycle");
    expect(kinds).toContain("unpriced");
    expect(kinds).toContain("over-target");
  });

  test("clean BOM → no warnings", () => {
    expect(assessBomSourcing([line({})], "10.00").warnings).toEqual([]);
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/bom-cost.test.ts` → FAIL (module not found).

**Step 3: Implement**

Create `src/lib/bom-cost.ts`. Pure; accepts a minimal line shape so both server (Prisma rows) and tests can call it. `targetCost` comes in as `string | Decimal | null` (Prisma `Decimal` stringifies to dollars):

```ts
export interface BomCostLine {
  quantity: number;
  unitPriceCents: number | null;
  part: { lifecycle: string };
}

export interface BomCost {
  totalCents: number;
  unpricedCount: number;
  targetCents: number | null;
  overTarget: boolean;
}

export function bomCost(
  lines: BomCostLine[],
  targetCost: string | { toString(): string } | null,
): BomCost {
  const totalCents = lines.reduce((s, l) => s + l.quantity * (l.unitPriceCents ?? 0), 0);
  const unpricedCount = lines.filter((l) => l.unitPriceCents == null).length;
  const targetCents =
    targetCost == null ? null : Math.round(Number(targetCost.toString()) * 100);
  const overTarget = targetCents != null && totalCents > targetCents;
  return { totalCents, unpricedCount, targetCents, overTarget };
}

export type BomWarning =
  | { kind: "lifecycle"; refDesOrMpn: string; lifecycle: string }
  | { kind: "unpriced"; count: number }
  | { kind: "over-target"; totalCents: number; targetCents: number };

export function assessBomSourcing(
  lines: BomCostLine[],
  targetCost: string | { toString(): string } | null,
): { warnings: BomWarning[] } {
  const warnings: BomWarning[] = [];
  for (const l of lines) {
    if (l.part.lifecycle !== "ACTIVE") {
      warnings.push({ kind: "lifecycle", refDesOrMpn: "", lifecycle: l.part.lifecycle });
    }
  }
  const cost = bomCost(lines, targetCost);
  if (cost.unpricedCount > 0) warnings.push({ kind: "unpriced", count: cost.unpricedCount });
  if (cost.overTarget && cost.targetCents != null)
    warnings.push({ kind: "over-target", totalCents: cost.totalCents, targetCents: cost.targetCents });
  return { warnings };
}
```

> Lifecycle warnings carry an identifier — pass `refDes`/`mpn` from the caller if the line shape includes it; the test only checks `kind`, so keep the field but populate it server-side.

**Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/bom-cost.test.ts` → PASS.

**Step 5: Commit**

```bash
git add src/lib/bom-cost.ts src/lib/__tests__/bom-cost.test.ts
git commit -m "feat(ws3): pure BOM cost roll-up + lifecycle/cost sourcing assessor"
```

---

## Task 5: `importBomCsv` server action + import UI

**Files:**
- Modify: `src/lib/actions/bom-lines.ts` (add `importBomCsv` + `importBomCsvFormAction`)
- Modify: `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx` (import panel + report)
- Test: `src/lib/__tests__/bom-lines-actions.test.ts`

**Step 1: Write the failing test**

Append to `src/lib/__tests__/bom-lines-actions.test.ts`:

```ts
describe("importBomCsv (WS3)", () => {
  test("matched rows create, re-import updates; unmatched reported; frozen rejected", async () => {
    const rev = await makeFreshRevision(`t-ws3-import-${Date.now()}`);
    const part = await aPart(); // existing curated part with known manufacturer+mpn

    const csv =
      "refDes,manufacturer,mpn,quantity,unitPrice\n" +
      `R1,${part.manufacturer},${part.mpn},1,0.05\n` +
      "U1,NoSuch,NS-404,1,9.99";

    const r1 = await importBomCsv({ revisionId: rev.id, csv });
    expect(r1.created).toBe(1);
    expect(r1.updated).toBe(0);
    expect(r1.unmatched).toHaveLength(1);
    expect(r1.unmatched[0]!.mpn).toBe("NS-404");

    // re-import the matched row with a new price → update, not duplicate
    const r2 = await importBomCsv({
      revisionId: rev.id,
      csv: `refDes,manufacturer,mpn,quantity,unitPrice\nR1,${part.manufacturer},${part.mpn},1,0.07`,
    });
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);
    const line = await db.bomLine.findFirstOrThrow({ where: { revisionId: rev.id, partId: part.id } });
    expect(line.unitPriceCents).toBe(7);

    // freeze the BOM → import rejected
    await db.revision.update({ where: { id: rev.id }, data: { bomFrozenAt: new Date() } });
    await expect(
      importBomCsv({ revisionId: rev.id, csv: `refDes,manufacturer,mpn,quantity\nR2,${part.manufacturer},${part.mpn},1` }),
    ).rejects.toThrow(/frozen/i);
  });
});
```

> Use the file's existing fixture helpers (`makeFreshRevision`, `aPart`). Track created line/revision ids for `afterAll` cleanup as the rest of the file does. The frozen-revision row is a throwaway, so mutating its `bomFrozenAt` is safe.

**Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/bom-lines-actions.test.ts -t "importBomCsv"`
Expected: FAIL — `importBomCsv` not exported.

**Step 3: Implement `importBomCsv`**

In `src/lib/actions/bom-lines.ts` (study how `createBomLine` does auth, `withTxRetry`, `assertBomNotFrozen` + `assertNotFrozen`, Serializable isolation, and `revalidatePath` — mirror it):

```ts
export async function importBomCsv(input: {
  revisionId: string;
  csv: string;
}): Promise<{
  created: number;
  updated: number;
  unmatched: { manufacturer: string; mpn: string; row: number }[];
  rowErrors: { row: number; message: string }[];
}> {
  const user = await requireUser(); // match the file's auth helper
  const { revisionId, csv } = input;

  const { rows, errors } = parseBomCsv(csv);

  const result = await withTxRetry((tx) =>
    tx.$transaction(async (tx2) => {
      await assertNotFrozen(tx2, revisionId);
      await assertBomNotFrozen(tx2, revisionId);

      let created = 0;
      let updated = 0;
      const unmatched: { manufacturer: string; mpn: string; row: number }[] = [];

      for (const [i, r] of rows.entries()) {
        const part = await tx2.part.findUnique({
          where: { manufacturer_mpn: { manufacturer: r.manufacturer, mpn: r.mpn } },
          select: { id: true },
        });
        if (!part) {
          unmatched.push({ manufacturer: r.manufacturer, mpn: r.mpn, row: i + 2 });
          continue;
        }
        const data = {
          refDes: r.refDes,
          quantity: r.quantity,
          unitPriceCents: r.unitPriceCents,
          altMpn: r.altMpn,
          altManufacturer: r.altManufacturer,
          notes: r.notes,
        };
        const existing = await tx2.bomLine.findUnique({
          where: { revisionId_partId: { revisionId, partId: part.id } },
          select: { id: true },
        });
        await tx2.bomLine.upsert({
          where: { revisionId_partId: { revisionId, partId: part.id } },
          create: { revisionId, partId: part.id, createdById: user.id, ...data },
          update: data,
        });
        if (existing) updated++;
        else created++;
      }
      return { created, updated, unmatched };
    }),
  );

  revalidatePath(`/projects`); // match the path the single-line actions revalidate
  return { ...result, rowErrors: errors };
}
```

> Confirm the exact names: the auth helper (`requireUser` vs the file's), the `withTxRetry` wrapper signature, the composite unique input name (`manufacturer_mpn`, `revisionId_partId` — Prisma derives these from `@@unique`), and the `revalidatePath` argument the existing actions use. `assertBomNotFrozen` + `assertNotFrozen` are in `src/lib/assertions.ts`.

**Step 4: Add the form wrapper** (for the editor's `<form action>`)

```ts
export async function importBomCsvFormAction(
  _prev: ImportBomState,
  formData: FormData,
): Promise<ImportBomState> {
  const revisionId = pickString(formData, "revisionId");
  const csv = pickString(formData, "csv");
  if (!revisionId || !csv) return { message: "Provide a revision and CSV." };
  try {
    const r = await importBomCsv({ revisionId, csv });
    return { report: r };
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Import failed." };
  }
}
```

Define `ImportBomState` as an **inline** `export type` is disallowed here (`"use server"`); instead put `ImportBomState` in a small non-server module or co-locate it as a non-exported type and have the editor define its own. Simplest: keep `ImportBomState` shape in the editor file and type the action's return structurally. (Mirror how `BomLineFormState` is handled — it's an inline elided `export type`; if that pattern is in use, follow it consistently, otherwise avoid adding a new exported type to the `"use server"` file.)

**Step 5: Run to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/bom-lines-actions.test.ts`
Expected: PASS (full file).

**Step 6: Import UI in the editor**

In `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx`, add a collapsible "Import CSV" panel: a `<form action={importAction}>` (its own `useActionState(importBomCsvFormAction, …)`) with a `<textarea name="csv">` (paste) and a hidden `revisionId`. On result, render "N created · M updated · K skipped" + list the unmatched MPNs and any `rowErrors`. Disable when the revision is frozen (the editor already receives a frozen/`disabled` flag).

**Step 7: Typecheck + commit**

Run: `pnpm tsc --noEmit` → PASS.

```bash
git add src/lib/actions/bom-lines.ts "src/app/projects/[slug]/[revLabel]/_bom-editor.tsx" src/lib/__tests__/bom-lines-actions.test.ts
git commit -m "feat(ws3): importBomCsv strict-match upsert action + editor import panel"
```

---

## Task 6: Cost roll-up badge + sourcing advisory panel

**Files:**
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (compute cost/warnings server-side; pass to editor or render near BOM)
- Modify: `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx` (cost badge + advisory list + a small admin lifecycle chip)

**Step 1: Compute server-side**

In `page.tsx`, after loading `revision` (with `bomLines: { include: { part: true } }`), call `bomCost(revision.bomLines, revision.project.targetCost)` and `assessBomSourcing(...)`. Pass the results into the editor (or a sibling panel). `targetCost` is a Prisma `Decimal` — `bomCost` accepts its `.toString()` (dollars).

**Step 2: Render the cost badge**

In the editor header area: "BOM total {formatUsd(totalCents)} / target {formatUsd(targetCents)}" with gold text under target, `text-alert-red` over; append "(N lines unpriced)" when `unpricedCount > 0`.

**Step 3: Render the advisory list + lifecycle chip**

A panel listing `warnings` (lifecycle parts with a small **admin** lifecycle chip — duplicate ~15 lines from `LifecycleBadge` semantics: `EOL`/`OBSOLETE` = danger red, `NRND` = caution amber; do **not** export the private guide badge), unpriced count, over-target. When `warnings` is empty, a green "No sourcing warnings."

**Step 4: Typecheck + manual check + commit**

Run: `pnpm tsc --noEmit` → PASS.

```bash
git add "src/app/projects/[slug]/[revLabel]/page.tsx" "src/app/projects/[slug]/[revLabel]/_bom-editor.tsx"
git commit -m "feat(ws3): BOM cost roll-up badge + lifecycle/cost sourcing advisory panel"
```

---

## Task 7: Soft-confirm ack on the freeze (StageActions)

**Files:**
- Modify: `src/components/StageActions.tsx` (props + ack checkbox gating `AdvanceSubmit`)
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (thread warnings into `StageActions`)

**Step 1: Thread the advisory into `StageActions`**

`StageActions` (`"use client"`, rendered on the revision page) currently takes `{ revisionId, currentStage, isFrozen }`. Add a prop `bomWarningsCount?: number` (or a short summary) computed from `assessBomSourcing` on the page. Only meaningful when `currentStage === "BOM_SOURCING"` (the advance that freezes the BOM on entry to LAYOUT).

**Step 2: Gate the advance button**

When `currentStage === "BOM_SOURCING"` **and** `bomWarningsCount > 0`: render a warning summary + an "I've reviewed the BOM sourcing advisory" checkbox whose client state (`useState`) disables `AdvanceSubmit` until ticked. All other stages and the warning-free case are unaffected. `advanceStage` is **not** changed — this is a pure client speed-bump (advisory-first).

**Step 3: Typecheck + manual check**

Run: `pnpm tsc --noEmit` → PASS. Manually: on a `BOM_SOURCING` revision with an EOL or unpriced line, the advance button is disabled until the checkbox is ticked; with no warnings, it's enabled normally.

**Step 4: Commit**

```bash
git add src/components/StageActions.tsx "src/app/projects/[slug]/[revLabel]/page.tsx"
git commit -m "feat(ws3): soft-confirm BOM-sourcing ack on the advance-to-LAYOUT control"
```

---

## Task 8: Full verification + PR

**Step 1: Full typecheck** — `pnpm tsc --noEmit` → PASS.

**Step 2: Full test suite (one run, never concurrent)** — `pnpm vitest run` → all green (modulo the known WS1-fixed guide-completion case). `pnpm db:seed` + re-run if the fixture looks disturbed.

**Step 3: Build** — `pnpm build` → succeeds.

**Step 4: Manual smoke (local dev)**

- `Start-Process pnpm.cmd dev -WindowStyle Hidden`.
- On a `BOM_SOURCING` revision: add a line with a unit price → row shows the price; the cost badge updates vs target. Paste a CSV (one matching part, one unknown MPN) into Import CSV → "1 created … 1 skipped" with the unknown MPN listed; re-paste with a changed price → "1 updated". Set a part EOL → advisory panel flags it; the advance button is disabled until the ack checkbox is ticked.

**Step 5: Push + open PR**

```bash
git push -u origin feat/ws3-bom-source-of-truth
gh pr create --base feat/ws1-foundations --title "feat(ws3): BOM as single source of truth — per-line price, CSV import, sourcing advisory" --body "<summary + verification; link docs/plans/2026-06-16-ws3-bom-source-of-truth-design.md; note: stacked on feat/ws1-foundations, retarget to main after #142 merges>"
```

**Step 6: Verify CI explicitly, then hand back**

- `gh pr checks` — confirm `build | pass` explicitly. Do **not** merge. Hand back to Josh with the PR link + smoke results.

---

## Done criteria

- `BomLine.unitPriceCents` migrated to prod; threaded through create/edit + the editor (dollars in UI → cents stored).
- `parseBomCsv` + `bomCost`/`assessBomSourcing` pure modules, unit-tested (refDes-count guard, dollars→cents, lifecycle incl. OBSOLETE, Decimal target).
- `importBomCsv`: strict `(manufacturer, mpn)` match, upsert on `[revisionId, partId]`, unmatched reported, frozen rejected (both freeze guards), Serializable retry tx — integration-tested on throwaway revisions.
- Cost badge + lifecycle/cost advisory render in the admin BOM editor; no public `bomTable` change.
- Soft-confirm ack gates the advance-to-LAYOUT button when BOM_SOURCING warnings exist; `advanceStage` unchanged.
- `pnpm tsc --noEmit`, full `pnpm vitest run`, and `pnpm build` all green; PR open with `build | pass` confirmed.
