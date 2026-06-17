# WS4 — board-readiness gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the advisory `board-readiness` check — a pure assessor that scores a revision as de-risked-before-authoring (design validated · BOM frozen · has parts · no EOL parts), a readout panel on the revision detail page, and a soft-confirm ack on the Generate-Guide button. No schema, no `materializeGuide` change, no hard gate.

**Architecture:** Mirror the existing `assessLessonReadiness`/`ReadinessPanel` pattern. A pure `board-readiness.ts` returns `{ checks, ready }`; the revision page renders a `BoardReadinessPanel`; `GenerateGuideButton` gains optional readiness props that, when not ready, gate its submit pill behind an "I've reviewed" checkbox (client-side only). The design-doc-presence requirement folds into "DESIGN_VALIDATION complete" (no repo read).

**Tech Stack:** Next.js 16 (App Router, RSC + client components), Prisma 7 + Neon, vitest, Tailwind (OTD palette).

**Design doc:** `docs/plans/2026-06-16-ws4-board-readiness-design.md`

---

## Critical constraints (read before starting)

- **`.env.local` `DATABASE_URL` is PROD.** The vitest suite mutates prod. The assessor is **pure** (no DB), so its unit tests need no DB. Run vitest **one file/suite at a time**, never concurrently (corrupts the `esp32-sensor-breakout` fixture; `pnpm db:seed` restores).
- **No schema change** in WS4. (`pnpm prisma generate` is unnecessary; don't author a migration.)
- **`materializeGuide` / server actions are UNCHANGED.** The ack is client-side only (advisory-first).
- **After UI/lib changes:** `pnpm tsc --noEmit` then the full `pnpm vitest run` (one run). `pnpm build` before the PR.
- Windows: `pnpm` is NOT on PATH in the Bash tool — use the PowerShell tool for `pnpm` (or `node_modules/.bin/tsc --noEmit` directly).
- **Branch:** `git checkout feat/ws3-bom-source-of-truth && git checkout -b feat/ws4-board-readiness` (WS4 consumes WS3's `bomLines.part.lifecycle`/`unitPriceCents`). Retarget the PR base to `main` after the stack merges.
- **Do not merge.** Open the PR (stacked on `feat/ws3-bom-source-of-truth`), verify CI `build | pass` explicitly, hand back to Josh.

---

## Task 1: Pure assessor `board-readiness.ts` + unit tests

**Files:**
- Create: `src/lib/board-readiness.ts`
- Test: `src/lib/__tests__/board-readiness.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/board-readiness.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { assessBoardReadiness, type BoardReadinessInput } from "@/lib/board-readiness";

const base: BoardReadinessInput = {
  hasDesignValidation: true,
  designValidationComplete: true,
  bomFrozenAt: new Date("2026-06-16"),
  bomLineCount: 5,
  lifecycleWarningCount: 0,
  unpricedCount: 0,
  overTarget: false,
  designDocPath: "docs/boards/x/design.md",
};

const req = (r: ReturnType<typeof assessBoardReadiness>, label: RegExp) =>
  r.checks.find((c) => label.test(c.label));

describe("assessBoardReadiness", () => {
  test("all four required checks pass → ready", () => {
    const r = assessBoardReadiness(base);
    expect(r.ready).toBe(true);
    expect(r.checks.filter((c) => c.tier === "required").every((c) => c.ok)).toBe(true);
  });

  test("no DESIGN_VALIDATION checklist → not ready", () => {
    const r = assessBoardReadiness({ ...base, hasDesignValidation: false });
    expect(r.ready).toBe(false);
    expect(req(r, /validated/i)!.ok).toBe(false);
  });

  test("DESIGN_VALIDATION incomplete → not ready", () => {
    const r = assessBoardReadiness({ ...base, designValidationComplete: false });
    expect(r.ready).toBe(false);
    expect(req(r, /validated/i)!.ok).toBe(false);
  });

  test("BOM not frozen → not ready", () => {
    const r = assessBoardReadiness({ ...base, bomFrozenAt: null });
    expect(r.ready).toBe(false);
    expect(req(r, /frozen/i)!.ok).toBe(false);
  });

  test("empty BOM → not ready", () => {
    const r = assessBoardReadiness({ ...base, bomLineCount: 0 });
    expect(r.ready).toBe(false);
    expect(req(r, /parts/i)!.ok).toBe(false);
  });

  test("an EOL part → not ready", () => {
    const r = assessBoardReadiness({ ...base, lifecycleWarningCount: 2 });
    expect(r.ready).toBe(false);
    expect(req(r, /end-of-life|EOL|lifecycle/i)!.ok).toBe(false);
  });

  test("info checks (unpriced / over-target) never affect ready", () => {
    const r = assessBoardReadiness({ ...base, unpricedCount: 3, overTarget: true });
    expect(r.ready).toBe(true);
    expect(r.checks.some((c) => c.tier === "info")).toBe(true);
  });

  test("a design-doc pointer info line is always present", () => {
    const r = assessBoardReadiness(base);
    expect(r.checks.some((c) => c.tier === "info" && /design doc/i.test(c.label))).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/__tests__/board-readiness.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the assessor**

Create `src/lib/board-readiness.ts`, mirroring `src/lib/lesson-readiness.ts`'s structure
(read that file first for the idiom). Encode exactly:

```ts
// Board "definition of done" — scores a revision as de-risked BEFORE a guide is
// authored around it (parent plan WS4, advisory-first). Pure + testable: the
// revision page and the guide hub load the DB rows and feed them in. Mirrors
// assessLessonReadiness. "Design doc present" is folded into "DESIGN_VALIDATION
// complete" (the checklist references the design.md §s) — no repo read.

export type BoardReadinessTier = "required" | "info";

export interface BoardCheck {
  label: string;
  ok: boolean;
  tier: BoardReadinessTier;
  detail?: string;
}

export interface BoardReadinessInput {
  hasDesignValidation: boolean;
  designValidationComplete: boolean;
  bomFrozenAt: Date | null;
  bomLineCount: number;
  lifecycleWarningCount: number;
  unpricedCount: number;
  overTarget: boolean;
  designDocPath: string;
}

export interface BoardReadiness {
  checks: BoardCheck[];
  ready: boolean;
}

export function assessBoardReadiness(input: BoardReadinessInput): BoardReadiness {
  const checks: BoardCheck[] = [];

  const designOk = input.hasDesignValidation && input.designValidationComplete;
  checks.push({
    label: "Design validated",
    tier: "required",
    ok: designOk,
    detail: !input.hasDesignValidation
      ? "no DESIGN_VALIDATION checklist materialized"
      : !input.designValidationComplete
        ? "DESIGN_VALIDATION items still unchecked"
        : undefined,
  });

  checks.push({
    label: "BOM frozen",
    tier: "required",
    ok: input.bomFrozenAt != null,
    detail: input.bomFrozenAt == null ? "advance past BOM_SOURCING to freeze" : undefined,
  });

  checks.push({
    label: "BOM has parts",
    tier: "required",
    ok: input.bomLineCount > 0,
    detail: input.bomLineCount === 0 ? "no BOM lines" : `${input.bomLineCount} lines`,
  });

  checks.push({
    label: "No end-of-life parts",
    tier: "required",
    ok: input.lifecycleWarningCount === 0,
    detail:
      input.lifecycleWarningCount > 0
        ? `${input.lifecycleWarningCount} NRND/EOL/obsolete`
        : undefined,
  });

  // ── Info: reported, gates nothing ──
  const costBits: string[] = [];
  if (input.unpricedCount > 0) costBits.push(`${input.unpricedCount} unpriced`);
  if (input.overTarget) costBits.push("over target");
  checks.push({
    label: "Cost",
    tier: "info",
    ok: !input.overTarget && input.unpricedCount === 0,
    detail: costBits.length ? costBits.join(", ") : "within target, fully priced",
  });

  checks.push({
    label: "Design doc",
    tier: "info",
    ok: true,
    detail: input.designDocPath,
  });

  const ready = checks.filter((c) => c.tier === "required").every((c) => c.ok);
  return { checks, ready };
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/__tests__/board-readiness.test.ts`
Expected: PASS (8 tests).

**Step 5: Commit**

```bash
git add src/lib/board-readiness.ts src/lib/__tests__/board-readiness.test.ts
git commit -m "feat(ws4): pure assessBoardReadiness — design-validated + BOM frozen/parts/lifecycle"
```

---

## Task 2: `BoardReadinessPanel` + render on the revision detail page

**Files:**
- Create: `src/components/BoardReadinessPanel.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx`

**Step 1: Build the panel (mirror `ReadinessPanel`)**

Create `src/components/BoardReadinessPanel.tsx`, mirroring
`src/components/guide/ReadinessPanel.tsx` (read it first). Presentational, takes
`{ readiness: BoardReadiness }` from `@/lib/board-readiness`. Render:
- A single "Board ready" `Bar` (green when `readiness.ready`, muted otherwise) with hint
  "De-risked before authoring — design validated · BOM sourced & frozen".
- The per-check list: `required` checks show ✓ (green) / ✗ (red); `info` checks show ·
  (muted) + a small "info" tag; render each check's `detail`.
- Header "Board readiness". Same OTD palette / class idiom as `ReadinessPanel`.

**Step 2: Compute readiness on the revision page + render the panel**

In `src/app/projects/[slug]/[revLabel]/page.tsx`:

2a. **No new data-loading is needed here** (validated): the main `revision` query already
`include`s `checklists: { include: { items: ... } }` (~line 86-89, so `subkind` + each item's
`checked`/`notApplicable` are present), `bomLines: { include: { part: true } }` (~line 71-72,
so `part.lifecycle` + `unitPriceCents`), `revision.bomFrozenAt`, and `project.targetCost` +
`project.slug` (~line 53/61). The page ALSO already computes `const cost = bomCost(...)` and
`const { warnings } = assessBomSourcing(...)` → `bomWarnings` (~line 132-148). Reuse those.

2b. After the `notFound()` guard and the existing `cost`/`bomWarnings` compute, derive the
assessor input and call it (`revision.checklists` is a non-optional `include`d array here):

```ts
import { assessBoardReadiness } from "@/lib/board-readiness";
// ...
const designValidation = revision.checklists.find(
  (c) => c.subkind === "DESIGN_VALIDATION",
);
const dvItems = designValidation?.items ?? [];
const boardReadiness = assessBoardReadiness({
  hasDesignValidation: !!designValidation,
  designValidationComplete:
    dvItems.length > 0 && dvItems.every((i) => i.checked || i.notApplicable),
  bomFrozenAt: revision.bomFrozenAt,
  bomLineCount: revision.bomLines.length,
  lifecycleWarningCount: bomWarnings.filter((w) => w.kind === "lifecycle").length,
  unpricedCount: cost.unpricedCount,
  overTarget: cost.overTarget,
  designDocPath: `docs/boards/${project.slug}/design.md`,
});
```

> `revision.checklists` is the `include`d relation (no `?.` needed here). Confirm the exact
> local variable names the page uses for the cost roll-up (`cost`) and the enriched warnings
> (`bomWarnings`) and reuse them verbatim — do NOT recompute.

2c. Render `<BoardReadinessPanel readiness={boardReadiness} />` near the BOM / checklist
area (above or beside the BOM editor — match the page's section structure).

**Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS (ignore any pre-existing gitignored `scripts/_phase1.ts` errors if they
reappear; no others).

**Step 4: Commit**

```bash
git add src/components/BoardReadinessPanel.tsx "src/app/projects/[slug]/[revLabel]/page.tsx"
git commit -m "feat(ws4): BoardReadinessPanel on the revision detail page"
```

---

## Task 3: Soft-confirm ack on `GenerateGuideButton` (guide hub + stage page)

**Files:**
- Modify: `src/components/guide/GenerateGuideButton.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/guide/page.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx`

**Step 1: Add the ack to `GenerateGuideButton`**

In `src/components/guide/GenerateGuideButton.tsx` (read it first; it's `"use client"`, uses
`useActionState(materializeGuideFormAction)` + a `SubmitPill` with `useFormStatus`):

- Add optional props: `boardReady?: boolean`, `boardIssueCount?: number`.
- Add client state `const [acked, setAcked] = useState(false);`.
- Compute `const needsAck = boardReady === false;`.
- Pass a `disabled` down to `SubmitPill` (give `SubmitPill` an optional `disabled?: boolean`
  prop and OR it with its `pending`): `disabled={needsAck && !acked}`.
- When `needsAck`, render above the form:
  - a muted/red nudge: `⚠ Board not ready — {boardIssueCount ?? 0} issue(s); see board readiness on the revision page.`
  - a checkbox labeled "I've reviewed board readiness" bound to `acked`/`setAcked`.
- When `boardReady` is `true`/`undefined`: no nudge, no checkbox — behaves exactly as today.

Keep the OTD palette (`text-alert-red`, `text-muted`, `font-mono`, `accent-command-gold`,
`border-panel-border`).

**Step 2: Add a shared row→readiness mapper (keep the pure lib pure)**

`board-readiness.ts` must stay Prisma-free (mirror `lesson-readiness.ts`, whose row→input
mapping lives in the pages, not the lib). So put the mapper in a SEPARATE module.

Create `src/lib/board-readiness-load.ts`:

```ts
// Maps loaded Prisma rows → assessBoardReadiness input. Kept OUT of the pure
// board-readiness.ts (which stays DB-free, mirroring lesson-readiness.ts).
import { assessBoardReadiness, type BoardReadiness } from "@/lib/board-readiness";
import { bomCost, assessBomSourcing } from "@/lib/bom-cost";

export interface BoardReadinessRows {
  bomFrozenAt: Date | null;
  bomLines: { quantity: number; unitPriceCents: number | null; part: { lifecycle: string } }[];
  checklists: { subkind: string; items: { checked: boolean; notApplicable: boolean }[] }[];
  projectSlug: string;
  targetCost: string | { toString(): string } | null;
}

export function boardReadinessFromRows(rows: BoardReadinessRows): BoardReadiness {
  const dv = rows.checklists.find((c) => c.subkind === "DESIGN_VALIDATION");
  const dvItems = dv?.items ?? [];
  const cost = bomCost(rows.bomLines, rows.targetCost);
  const { warnings } = assessBomSourcing(rows.bomLines, rows.targetCost);
  return assessBoardReadiness({
    hasDesignValidation: !!dv,
    designValidationComplete:
      dvItems.length > 0 && dvItems.every((i) => i.checked || i.notApplicable),
    bomFrozenAt: rows.bomFrozenAt,
    bomLineCount: rows.bomLines.length,
    lifecycleWarningCount: warnings.filter((w) => w.kind === "lifecycle").length,
    unpricedCount: cost.unpricedCount,
    overTarget: cost.overTarget,
    designDocPath: `docs/boards/${rows.projectSlug}/design.md`,
  });
}

export function failingRequiredCount(r: BoardReadiness): number {
  return r.checks.filter((c) => c.tier === "required" && !c.ok).length;
}
```

Add a small unit test `src/lib/__tests__/board-readiness-load.test.ts` feeding row-shaped
objects (a ready set; a set with an unfrozen BOM; a set with an EOL part) and asserting
`.ready` + `failingRequiredCount`.

> The revision detail page (Task 2) does NOT need this mapper — it already has `cost`/
> `bomWarnings` computed, so it calls `assessBoardReadiness(...)` directly. The two guide
> pages use `boardReadinessFromRows` because they must load the rows fresh anyway.

**Step 3: Load the rows (scoped) + pass props on the guide hub**

In `src/app/projects/[slug]/[revLabel]/guide/page.tsx`: `<GenerateGuideButton>` renders at
~line 352 **only inside the `if (!revision.guide)` branch**, and the page's `revision`/`project`
selects load NONE of the assessor inputs. So load them **scoped to that branch** (a targeted
extra query — avoids loading BOM/checklist data on every populated-guide render):

```ts
// inside the !revision.guide branch, before rendering GenerateGuideButton:
const boardRows = await db.revision.findUniqueOrThrow({
  where: { id: revision.id },
  select: {
    bomFrozenAt: true,
    bomLines: { select: { quantity: true, unitPriceCents: true, part: { select: { lifecycle: true } } } },
    checklists: { select: { subkind: true, items: { select: { checked: true, notApplicable: true } } } },
    project: { select: { slug: true, targetCost: true } },
  },
});
const readiness = boardReadinessFromRows({
  bomFrozenAt: boardRows.bomFrozenAt,
  bomLines: boardRows.bomLines,
  checklists: boardRows.checklists,
  projectSlug: boardRows.project.slug,
  targetCost: boardRows.project.targetCost,
});
```

Pass `boardReady={readiness.ready}` and `boardIssueCount={failingRequiredCount(readiness)}`
to `<GenerateGuideButton ... />`. (Confirm the page's `db` import + the exact relation/field
names against the real query before pasting.)

**Step 5: Same on the per-stage guide page**

In `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx`: `<GenerateGuideButton>` renders
at ~line 320, also **inside the `!revision.guide` branch**, with the same input-less selects.
Do the identical scoped `boardRows` query + `boardReadinessFromRows` + the two props.

**Step 6: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS.

**Step 7: Commit**

```bash
git add src/components/guide/GenerateGuideButton.tsx "src/app/projects/[slug]/[revLabel]/guide/page.tsx" "src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx" src/lib/board-readiness-load.ts src/lib/__tests__/board-readiness-load.test.ts
git commit -m "feat(ws4): board-readiness row mapper + soft-confirm ack on Generate Guide (hub + stage)"
```

---

## Task 4: Full verification + PR

**Step 1: Full typecheck** — `pnpm tsc --noEmit` → PASS.

**Step 2: Full test suite (one solo run)** — `pnpm vitest run` → all green (the new
`board-readiness` unit tests + no regressions). `pnpm db:seed` + re-run if the fixture looks
disturbed.

**Step 3: Build** — `pnpm build` → exit 0.

**Step 4: Manual smoke (local dev)**

- `Start-Process pnpm.cmd dev -WindowStyle Hidden`.
- On a revision with a complete `DESIGN_VALIDATION` checklist + a frozen, priced, all-ACTIVE
  BOM: the revision page's `BoardReadinessPanel` shows "Board ready" (all ✓); the guide hub's
  Generate button has no ack.
- On a revision missing one (e.g. BOM not frozen, or an EOL part, or no DESIGN_VALIDATION):
  the panel shows the failing check; the guide hub's Generate button shows the "not ready"
  nudge + is disabled until the ack checkbox is ticked, then enabled.

**Step 5: Push + open PR**

```bash
git push -u origin feat/ws4-board-readiness
gh pr create --base feat/ws3-bom-source-of-truth --title "feat(ws4): board-readiness advisory — design-validated + BOM-frozen gate on guide authoring" --body "<summary + verification; link docs/plans/2026-06-16-ws4-board-readiness-design.md; note: stacked on feat/ws3-bom-source-of-truth, retarget to main after the stack merges>"
```

**Step 6: Verify CI explicitly, then hand back**

- `gh pr checks` — confirm `build | pass` explicitly (a green `--watch` exit is NOT proof).
- Do **not** merge. Hand back to Josh with the PR link + smoke results.

---

## Done criteria

- `assessBoardReadiness` pure + unit-tested: `ready` iff design-validated + BOM frozen + has
  parts + no EOL parts; info checks (cost, design-doc pointer) never gate.
- `BoardReadinessPanel` renders the verdict on the revision detail page.
- `GenerateGuideButton` requires an ack when not board-ready (guide hub + stage page);
  `materializeGuide` unchanged; ready revisions behave as before.
- No schema change, no hard gate, no lesson-readiness change.
- `pnpm tsc --noEmit`, full `pnpm vitest run`, and `pnpm build` all green; PR open with
  `build | pass` confirmed.
