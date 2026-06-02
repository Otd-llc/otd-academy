# In-App Guide-Card Editor — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm complete; ready for implementation planning)
**Builds on:** the learner-guide system (`docs/plans/2026-06-02-learner-guide-system-*.md`, shipped via PR #2). Guides are currently *materialized from templates* and editable only through the `editGuideCard` / `reorderGuideCards` server actions — there is no authoring UI. This adds one.

---

## 1. Goal & scope

Let a signed-in user **author/curate a guide card's teaching content in-app** — edit the header text and add/edit/reorder/delete its content blocks — instead of only re-running the template composer. This is the "doc-erratum / richer guide authoring" Phase 2 item.

### Decisions (validated in brainstorm)

| Decision | Choice |
|---|---|
| Editing surface | **Inline edit-in-place** on the guide card route (`/projects/[slug]/[revLabel]/guide/[stage]`) — an Edit toggle swaps the rendered card for editor forms. Matches the app's `ChecklistEditor` inline-edit pattern. |
| Field scope | **Teaching content only** — `eyebrow`, `title`, `lead`, and `contentBlocks`. **`completionRef` and `isGate` stay locked** (read-only): they drive the authoritative-done mapping and are set by the per-stage skeleton; editing them risks desyncing a card from its real stage gate. |
| Block coverage | **All 6 block types** incl. the table editor (prose, callout, steps, table, termRef, sourceRef). |
| Save model | **Edit mode + atomic Save/Cancel** — all fields/blocks live in React state; one `editGuideCard` call on Save; Cancel discards. Fits the single `contentBlocks` JSON column. |

### Non-goals (v1)
- Editing `completionRef` / `isGate` (gate wiring) — locked.
- Adding/deleting/reordering whole **cards** (the guide has one card per stage; `reorderGuideCards` exists but cards follow stage order). Edit existing cards' content only.
- A live rendered **preview** in edit mode — deferred (view mode already shows the rendered card; toggle between them).
- Markdown rendering of `prose` — it stays sanitized plain text on render, as today.

### Success criteria
- On a curriculum guide card, a signed-in user can toggle Edit, change the header + blocks (all 6 types), Save, and see the card re-render with the changes — without a manual reload.
- Frozen revisions show no Edit affordance; the server action rejects edits regardless (defense-in-depth).
- Invalid content (e.g. a `javascript:` `sourceRef` href) is rejected with an inline error.

---

## 2. Architecture & data flow

A client island **`GuideCardEditor`** wraps the card body on the guide card route.

- The card route (RSC) stays as-is: it renders `PageHeader` + `GuideBlocks` + `StageGate`. It passes the **server-rendered card body as `children`** into `GuideCardEditor`, plus the card's raw fields (`id`, `eyebrow`, `title`, `lead`, `contentBlocks`) and `canEdit = (session present) && !revision.frozenAt`.
- **View mode:** render `children` (the server card) + an "Edit" (pencil `IconButton`) when `canEdit`.
- **Edit mode:** seed `{ eyebrow, title, lead, blocks }` into React state from props; render the header inputs + the block-list editor (§3) + Save/Cancel.
- **Save:** call the structured server wrapper `saveGuideCard({ id, eyebrow, title, lead, contentBlocks })` (§4) via `useTransition`. On `ok` → exit edit mode + `router.refresh()` (re-renders the server children + `StageGate`). On error → show inline errors, stay in edit mode.
- **Cancel:** discard React state, return to view.

`GuideBlocks` remains a server component (server-side `sanitize-html`); the editor never re-implements rendering — view mode shows the server output, edit mode shows forms.

---

## 3. Block-list editor + per-type editors

The editor holds `blocks: ContentBlock[]` in state. The list renders each block as a row: a **type-specific mini-editor** + reorder **chevron up/down** + **trash** delete (all the shared `IconButton` + `icons.tsx`). An **"Add block"** control (Plus) opens a small type menu; choosing a type appends `defaultBlock(type)` (a valid, schema-passing default).

Per-type editors (each mutates the in-memory array; no per-block server calls):
- **prose** — `<textarea>` bound to `md`.
- **callout** — `severity` select (critical / warn / info) + `label` input + `body` textarea.
- **steps** — `ordered` checkbox + an editable list of step strings (add / remove / reorder).
- **table** — editable `columns` (string list) + a `rows` grid; each cell = text input + optional `decoration` select (none / ref / mpn / badge) + `tone` select (gold / blue / critical / dim) when `badge`. Add/remove column, add/remove row. (Heaviest editor; in scope per the decision.)
- **termRef** — single `term` input.
- **sourceRef** — `label` input + `href` input (the schema's refined regex rejects non-http(s)/relative hrefs).

`defaultBlock(type)` and the block-array shape are **pure helpers** (testable). Reorder is index swap within the array; delete is array splice; add is append.

---

## 4. Save, validation, freeze, a11y

- **Server wrapper:** add `saveGuideCard(input): Promise<GuideFormState>` to `src/lib/actions/guides-form.ts` — calls the existing `editGuideCard(input)`, returns `{ ok: true }` on success, `{ errors }` on `ZodError` (field-keyed), `{ message }` otherwise (freeze guard etc.). Cleaner than FormData for the nested block array; the client dispatches it with `useTransition`. (`editGuideCard` already: Zod-validates via `editGuideCardSchema`, freeze-guards via `assertNotFrozen`, patches only supplied fields, and `revalidatePath`s the guide route.)
- **Client validation:** before dispatch, validate the assembled `contentBlocks` against `guideContentBlocksSchema` for immediate inline errors; the server re-validates regardless (defense-in-depth).
- **Freeze:** `canEdit` hides the Edit button on frozen revisions; `editGuideCard` rejects server-side too.
- **Refresh:** on success, `router.refresh()` re-renders the server card + the `StageGate` footer (a content edit can change which stage-gate items show, etc.).
- **a11y:** every input has a label; reorder/delete/add are `IconButton`s (aria-label + tooltip); Save/Cancel are real buttons; edit mode is keyboard-operable. Styled bench-flat with existing tokens (inputs match the app's form styling).

---

## 5. Reuse, testing, files

**Reuse:** shared `IconButton`, `Tooltip`, `icons.tsx` (Plus / Trash / ChevronUp / ChevronDown / Pencil / Close); the `ContentBlock` / `CompletionRef` types + `guideContentBlocksSchema` from `src/lib/schemas/guide.ts`; the existing `editGuideCard` action.

**Files:**
- Create: `src/components/guide/GuideCardEditor.tsx` (the client wrapper + edit state), `src/components/guide/block-editors/*` (per-type editors) or one `BlockEditor.tsx` switch, `src/lib/guide-block-defaults.ts` (`defaultBlock(type)` + helpers).
- Modify: `src/lib/actions/guides-form.ts` (add `saveGuideCard`), `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` (wrap the card body in `GuideCardEditor`, pass card fields + `canEdit`).

**Testing:** TDD the pure helpers — `defaultBlock(type)` returns a value that passes `contentBlockSchema` for every type; a block-array round-trips `guideContentBlocksSchema`. Unit-test `saveGuideCard`'s error mapping (ZodError→errors, success→ok, other→message). The React editor has no DOM harness → verify via `pnpm run build` + a manual pass on the running app; keep the testable logic in the pure helpers.

---

## 6. Open items for planning
- Exact bench-flat styling of the inputs (match existing form inputs).
- Whether the table editor warrants its own sub-component file vs inline (likely its own, given size).
- Defer: live preview toggle; whole-card add/delete/reorder; gate-wiring editing.
