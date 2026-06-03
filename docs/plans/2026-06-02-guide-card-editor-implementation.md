# Guide-Card Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an in-app, inline edit-in-place editor for a guide card's teaching content (header text + all 6 content-block types), saving atomically through the existing `editGuideCard` action.

**Architecture:** A client island `GuideCardEditor` wraps the server-rendered card body on the guide card route. View mode shows the server card + an Edit button; edit mode seeds `{eyebrow,title,lead,blocks}` into React state, renders header inputs + a block-list editor (per-type mini-editors + reorder/delete/add via the shared `IconButton`/`icons.tsx`), and on Save dispatches a new structured `saveGuideCard` wrapper → `editGuideCard` → `router.refresh()`. Gate-wiring (`completionRef`/`isGate`) is locked. Atomic Save/Cancel.

**Tech Stack:** Next 16 App Router (RSC + client islands), React 19, TypeScript, Zod 4, Tailwind v4, vitest (node env, real Neon DB, `pnpm exec vitest run <path>`).

**Design:** `docs/plans/2026-06-02-guide-card-editor-design.md`.

**Conventions to reuse (verified):**
- `editGuideCard(input)` — `src/lib/actions/guides.ts:148` (Zod via `editGuideCardSchema`, `assertNotFrozen`, patches only supplied fields, `revalidatePath`s the guide route).
- `materializeGuideFormAction` + `GuideFormState` + `zodErrors` helper — `src/lib/actions/guides-form.ts` (mirror its shape for `saveGuideCard`).
- Content-block schema + types — `src/lib/schemas/guide.ts` (`contentBlockSchema`, `guideContentBlocksSchema`, `ContentBlock`, `editGuideCardSchema`).
- Shared UI — `src/components/IconButton.tsx`, `src/components/Tooltip.tsx`, `src/components/icons.tsx` (`PlusIcon`, `TrashIcon`, `ChevronUpIcon`, `ChevronDownIcon`, `PencilIcon`, `CloseIcon`).
- The card route — `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` (renders `PageHeader` + `GuideBlocks` + `StageGate`; loads the guide card + revision).
- The guide checklist refresh pattern — `src/components/guide/GuideChecklistEditor.tsx` (`router.refresh()` on success).

**Test command:** `pnpm exec vitest run <path>` · typecheck `pnpm exec tsc --noEmit` · UI gate `pnpm run build`. Windows: prepend `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path` in PowerShell. There is no component-DOM harness — unit-test pure helpers; verify React/UI via `build` + the running app.

**Skills:** @superpowers:test-driven-development per coded task · @superpowers:executing-plans to drive batches.

---

## Task 1: Block defaults + type metadata (pure helpers)

**Files:**
- Create: `src/lib/guide-block-defaults.ts`
- Test: `src/lib/__tests__/guide-block-defaults.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { BLOCK_TYPES, BLOCK_TYPE_LABELS, defaultBlock } from "@/lib/guide-block-defaults";
import { contentBlockSchema } from "@/lib/schemas/guide";

describe("guide block defaults", () => {
  it("lists all six block types", () => {
    expect([...BLOCK_TYPES].sort()).toEqual(
      ["callout", "prose", "sourceRef", "steps", "table", "termRef"],
    );
  });
  it("has a human label for every type", () => {
    for (const t of BLOCK_TYPES) expect(BLOCK_TYPE_LABELS[t]).toBeTruthy();
  });
  it("defaultBlock(type) passes contentBlockSchema for every type", () => {
    for (const t of BLOCK_TYPES) {
      const r = contentBlockSchema.safeParse(defaultBlock(t));
      expect(r.success, `${t} default should be valid: ${JSON.stringify(r)}`).toBe(true);
    }
  });
  it("defaultBlock returns the requested type", () => {
    expect(defaultBlock("callout").type).toBe("callout");
    expect(defaultBlock("table").type).toBe("table");
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-block-defaults.test.ts`
Expected: FAIL (module missing).

**Step 3: Implement**

```ts
// src/lib/guide-block-defaults.ts
import type { ContentBlock } from "@/lib/schemas/guide";

export const BLOCK_TYPES = [
  "prose", "callout", "steps", "table", "termRef", "sourceRef",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  prose: "Prose",
  callout: "Callout",
  steps: "Steps",
  table: "Table",
  termRef: "Glossary term",
  sourceRef: "Source link",
};

// A valid, schema-passing starting block for each type. Where the schema
// requires non-empty fields (callout.label, steps.items, table.columns), the
// default supplies a sensible placeholder the author then edits.
export function defaultBlock(type: BlockType): ContentBlock {
  switch (type) {
    case "prose":
      return { type: "prose", md: "" };
    case "callout":
      return { type: "callout", severity: "info", label: "Note", body: "" };
    case "steps":
      return { type: "steps", ordered: true, items: ["Step 1"] };
    case "table":
      return { type: "table", columns: ["Column 1"], rows: [[{ text: "" }]] };
    case "termRef":
      return { type: "termRef", term: "" };
    case "sourceRef":
      return { type: "sourceRef", label: "", href: "https://" };
  }
}
```

> Verify each default against `src/lib/schemas/guide.ts` — esp. the `.min(1)` fields (`callout.label`, `steps.items`, `table.columns`). If the schema rejects a default, adjust the placeholder, not the schema.

**Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-block-defaults.test.ts`
Expected: PASS (4).

**Step 5: Commit**

```bash
git add src/lib/guide-block-defaults.ts src/lib/__tests__/guide-block-defaults.test.ts
git commit -m "feat(guide-editor): block defaults + type metadata"
```

---

## Task 2: `saveGuideCard` server wrapper

**Files:**
- Modify: `src/lib/actions/guides-form.ts`
- Test: `src/lib/__tests__/guide-save-card.test.ts`

**Step 1: Write the failing test** (real DB; mirror the auth/revalidate mocks in `src/lib/__tests__/guides-actions.test.ts` — copy that file's `vi.mock("@/auth", …)` + `vi.mock("next/cache", …)` setup). Use a throwaway revision + a materialized guide so edits don't touch curriculum data; clean up in `afterAll`.

```ts
// imports + the SAME auth/next-cache mocks as guides-actions.test.ts
describe("saveGuideCard", () => {
  // beforeAll: create a throwaway revision on a foundry project, materialize a guide,
  //            grab its first card id (firstCardId).
  it("saves edited header + blocks and returns ok", async () => {
    const { saveGuideCard } = await import("@/lib/actions/guides-form");
    const r = await saveGuideCard({
      id: firstCardId,
      title: "EDITED TITLE",
      contentBlocks: [{ type: "prose", md: "edited body" }],
    });
    expect(r.ok).toBe(true);
  });
  it("returns field errors for an invalid block (bad sourceRef href)", async () => {
    const { saveGuideCard } = await import("@/lib/actions/guides-form");
    const r = await saveGuideCard({
      id: firstCardId,
      contentBlocks: [{ type: "sourceRef", label: "x", href: "javascript:alert(1)" }],
    });
    expect(r.ok).toBeUndefined();
    expect(r.errors).toBeTruthy();
  });
});
```

**Step 2: Run** → FAIL (`saveGuideCard` not exported).

**Step 3: Implement** — add to `src/lib/actions/guides-form.ts`:

```ts
import { editGuideCard, materializeGuide } from "@/lib/actions/guides";

// ─── saveGuideCard ─────────────────────────────────────
// Structured wrapper (NOT FormData — the nested contentBlocks array is awkward
// to serialize through FormData). The inline editor dispatches this via
// useTransition. editGuideCard Zod-validates + freeze-guards + revalidates.
export async function saveGuideCard(input: unknown): Promise<GuideFormState> {
  try {
    const card = await editGuideCard(input);
    return { ok: true, createdId: card.id };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}
```

**Step 4: Run** → PASS (2). Then `pnpm exec tsc --noEmit` → clean.

**Step 5: Commit**

```bash
git add src/lib/actions/guides-form.ts src/lib/__tests__/guide-save-card.test.ts
git commit -m "feat(guide-editor): saveGuideCard structured server wrapper"
```

---

## Task 3: Per-type block editors (`BlockEditor`)

**Files:**
- Create: `src/components/guide/BlockEditor.tsx` (a `"use client"` switch over `block.type`, plus the per-type sub-editors — the `table` editor may warrant its own component `TableBlockEditor.tsx`).

**No unit test** (DOM-less env). Verify via `tsc` + `build` (Task 6) and manual.

**Implementation notes:**
- Props: `{ block: ContentBlock; onChange: (next: ContentBlock) => void }`. Pure controlled component — calls `onChange` with the updated block; holds no server state.
- Render a labelled form per `block.type`:
  - `prose`: `<textarea>` → `onChange({ ...block, md })`.
  - `callout`: severity `<select>` (critical/warn/info) + label `<input>` + body `<textarea>`.
  - `steps`: `ordered` checkbox + a list of `<input>`s for `items` with add/remove/reorder (Plus/Trash/Chevron `IconButton`s); each input edits `items[i]`.
  - `table`: `TableBlockEditor` — column `<input>`s (add/remove column), a row grid where each cell is a text `<input>` + a small decoration `<select>` (none/ref/mpn/badge) + a tone `<select>` shown only when decoration==="badge"; add/remove row. Keep `rows` rectangular to `columns.length` (pad/truncate cells on column add/remove).
  - `termRef`: `term` `<input>`.
  - `sourceRef`: `label` `<input>` + `href` `<input>` (note inline: must be http(s)/relative).
- Style inputs to match existing forms (e.g. `rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-sm`); labels in `font-mono text-xs uppercase tracking-wider text-muted`.

**Commit** after it typechecks:
```bash
git add src/components/guide/BlockEditor.tsx src/components/guide/TableBlockEditor.tsx
git commit -m "feat(guide-editor): per-type content-block editors"
```

---

## Task 4: `GuideCardEditor` client wrapper

**Files:**
- Create: `src/components/guide/GuideCardEditor.tsx` (`"use client"`).

**No unit test** — verify via `build` + manual.

**Implementation notes:**
- Props: `{ cardId: string; eyebrow: string; title: string; lead: string | null; blocks: ContentBlock[]; canEdit: boolean; children: React.ReactNode }` (`children` = the server-rendered `PageHeader` + `GuideBlocks`).
- State: `editing` (bool), and when editing, controlled copies of `eyebrow`/`title`/`lead`/`blocks` seeded from props. `useTransition` for the save; `error`/`fieldErrors` state.
- **View mode** (`!editing`): render `children`; if `canEdit`, an Edit `IconButton` (PencilIcon) that sets `editing=true` (re-seed state from props on enter).
- **Edit mode**: header inputs (eyebrow/title/lead) + map `blocks` to `<BlockEditor>` rows (each with up/down/trash `IconButton`s that splice/swap the array) + an "Add block" Plus menu (uses `BLOCK_TYPES`/`BLOCK_TYPE_LABELS` → appends `defaultBlock(type)`) + Save/Cancel.
- **Save**: client-validate `guideContentBlocksSchema.safeParse(blocks)`; if bad, show inline errors. Else `startTransition(async () => { const r = await saveGuideCard({ id: cardId, eyebrow, title, lead, contentBlocks: blocks }); if (r.ok) { setEditing(false); router.refresh(); } else { setError(r.message); setFieldErrors(r.errors); } })`.
- **Cancel**: `setEditing(false)` (discard).
- Reuse `IconButton`/`Tooltip`/`icons`. Disable Save while `isPending`.

**Commit:**
```bash
git add src/components/guide/GuideCardEditor.tsx
git commit -m "feat(guide-editor): GuideCardEditor inline edit wrapper"
```

---

## Task 5: Wire into the guide card route

**Files:**
- Modify: `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx`

**No unit test** — verify via `build` + manual.

**Implementation notes:**
- The route already loads the guide card (`eyebrow`, `title`, `lead`, `contentBlocks`, `id`) + the revision (for `frozenAt`). Compute `canEdit = !revision.frozenAt` (the page is already auth-gated by middleware, so a session exists).
- Wrap the **`PageHeader` + `GuideBlocks`** portion in `<GuideCardEditor cardId={card.id} eyebrow={card.eyebrow} title={card.title} lead={card.lead} blocks={parsedBlocks} canEdit={canEdit}>…server PageHeader + GuideBlocks…</GuideCardEditor>`. Leave `StageGate` + the prev/next nav OUTSIDE the editor (not edited).
- `parsedBlocks`: the route should pass the card's `contentBlocks` already parsed through `guideContentBlocksSchema` (it likely already parses for `GuideBlocks`; reuse that parsed value).

**Commit:**
```bash
git add "src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx"
git commit -m "feat(guide-editor): mount editor on the guide card route"
```

---

## Task 6: Verify + manual pass

**Step 1:** `pnpm exec tsc --noEmit` → clean.
**Step 2:** `pnpm run build` → passes (gate for the client/RSC boundary).
**Step 3:** `pnpm exec vitest run` → full suite green.
**Step 4 (manual, running app):** on a curriculum guide card (`/projects/foundry-l1-01-wroom-breakout/v1/guide/REQUIREMENTS`): Edit toggles in; edit the title + a prose/callout/steps block; add a table block and a termRef; reorder + delete blocks; Save → card re-renders with changes, no reload; Cancel discards; a `javascript:` sourceRef href shows an inline error; a frozen revision shows no Edit button.

```bash
git commit --allow-empty -m "chore(guide-editor): verified build + suite green"
```

---

## Done-criteria
- [ ] `defaultBlock` valid for all 6 types (unit).
- [ ] `saveGuideCard` ok-path + error-mapping (unit, real DB).
- [ ] All 6 block editors render + edit (build + manual).
- [ ] Inline Edit/Save/Cancel works with `router.refresh()`; gate-wiring not exposed.
- [ ] Frozen revision blocks editing (UI + server).
- [ ] `tsc` clean, `build` green, `vitest run` green.

## Execution Handoff
Plan saved to `docs/plans/2026-06-02-guide-card-editor-implementation.md`. Two execution options:
1. **Subagent-Driven (this session)** — fresh subagent per task + code review between tasks (superpowers:subagent-driven-development).
2. **Parallel Session** — new session with superpowers:executing-plans.
