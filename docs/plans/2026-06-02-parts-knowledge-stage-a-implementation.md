# Parts Knowledge — Stage A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** Ship the demonstrable core of the parts-knowledge system — curate → verify → view per-part facts on `/parts/[id]` — with NO MCP/infra. After Stage A, a signed-in user can curate the WROOM-breakout BOM's facts, verify each group with element-level provenance, and see them on the detail page + quick-glance modal.

**Architecture:** New `PartFact` (one row per fact-group) + `PartDatasheet` (R2-cached PDF) hung off `Part`, with `Part.category` constrained to a `PartCategory` enum. Per-group Zod schemas validate the JSON `data` (with element-level page anchors). A pure, client-injected `query.ts` (built now at the Stage A/B seam) reads facts with trust filtering + citations. Server actions create/edit/verify/flag facts behind a tightened gate (per-`sourceKind` precondition, field-granular auto-demote, optimistic concurrency). UI reuses the guide block primitives via an extracted `BlockListEditor`.

**Tech Stack:** Next.js 16 (RSC + client islands), React 19, Prisma 7 + Neon, Zod 4, Tailwind v4, Vitest (node env, real Neon, sequential). See the design doc: [docs/plans/2026-06-02-parts-knowledge-design.md](2026-06-02-parts-knowledge-design.md). Windows/pnpm: `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path`.

**Conventions:** every server action `requireUser()`s; tests follow `src/lib/__tests__/guide-save-card.test.ts` (throwaway rows seeded in `beforeAll`, torn down in `afterAll`, real Neon, never touch curriculum data); commit after each green step with trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1 — Migration: `PartCategory` enum + `PartFact` + `PartDatasheet`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_parts_knowledge_stage_a/migration.sql` (via `prisma migrate dev`)
- Test: `src/lib/__tests__/part-fact-model.test.ts`

**Step 1 — schema.** Add to `prisma/schema.prisma`:
```prisma
enum PartCategory { RF_MODULE LDO_REGULATOR USB_UART_IC MLCC_CAPACITOR USB_CONNECTOR PASSIVE_RESISTOR }
enum PartFactGroup  { PARAMETRICS PINOUT POWER DERATING MECHANICAL NOTES }
enum FactTrust      { UNVERIFIED VERIFIED FLAGGED }
enum FactSourceKind { DATASHEET MANUAL API }

model PartDatasheet {
  id        String   @id @default(cuid())
  partId    String   @unique
  part      Part     @relation(fields: [partId], references: [id], onDelete: Cascade)
  r2Key     String   // parts/{partId}/datasheet-...pdf
  filename  String
  byteSize  Int
  createdById String
  createdAt DateTime @default(now())
}

model PartFact {
  id              String         @id @default(cuid())
  partId          String
  part            Part           @relation(fields: [partId], references: [id], onDelete: Cascade)
  group           PartFactGroup
  data            Json
  trust           FactTrust      @default(UNVERIFIED)
  sourceKind      FactSourceKind @default(DATASHEET)
  partDatasheetId String?
  sourcePage      Int?
  sourceUrl       String?
  sourceNote      String?
  verifiedById    String?
  verifiedAt      DateTime?
  lastEditedById  String?
  createdById     String
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  @@unique([partId, group])
  @@index([trust])
}
```
Change `Part.category String?` → `category PartCategory?` and add relations `factGroups PartFact[]` and `datasheet PartDatasheet?`.

**Step 2 — migration.** `pnpm prisma migrate dev --name parts_knowledge_stage_a`. ⚠️ The existing `Part.category` is free-text; in the generated SQL, cast non-conforming values to NULL (the parts library is sparse/pilot-seeded; the seed in Task 10 writes canonical tokens). Hand-edit the migration to: create the enum, `ALTER TABLE "Part" ALTER COLUMN "category" TYPE "PartCategory" USING (CASE WHEN "category" IN (...) THEN "category"::"PartCategory" ELSE NULL END)`.

**Step 3 — failing test.** `part-fact-model.test.ts`: create a throwaway Part with `category: "MLCC_CAPACITOR"`, a `PartFact` row (group PARAMETRICS, `data: {entries:[]}`), read it back, assert fields + defaults (`trust: "UNVERIFIED"`, `sourceKind: "DATASHEET"`); assert the `@@unique([partId,group])` rejects a duplicate group. Tear down in `afterAll`.

**Step 4.** Run: `pnpm exec vitest run src/lib/__tests__/part-fact-model.test.ts` → PASS. Then `pnpm exec tsc --noEmit`.

**Step 5 — commit.** `feat(parts): migration — PartCategory enum, PartFact, PartDatasheet`.

---

## Task 2 — Per-group Zod schemas (`part-fact.ts`)

**Files:**
- Create: `src/lib/schemas/part-fact.ts`
- Test: `src/lib/__tests__/part-fact-schema.test.ts`

**Step 1 — failing tests** covering, per group: a valid `data` round-trips; element-level `{sourcePage?, sourceNote?}` is accepted on pins/curves/entries; category required-keys (e.g. `parametricsSchema("MLCC_CAPACITOR")` rejects missing `capacitance`); `DERATING` rejects non-increasing `x` (superRefine) and requires `conditions` + `yKind`; `PINOUT` accepts `type: "strapping"` and `function: string | string[]`.

**Step 2 — implement.** Mirror the guide discriminated-union style. Sketch:
```ts
import { z } from "zod";
import { PartCategory } from "@prisma/client";
import { guideContentBlocksSchema } from "./guide";

const anchor = { sourcePage: z.number().int().positive().optional(), sourceNote: z.string().trim().optional() };
export const parametricEntry = z.object({ label: z.string().trim().min(1), value: z.string().trim().min(1), unit: z.string().trim().optional(), ...anchor });
export const parametricsSchema = z.object({ entries: z.array(parametricEntry) });
const CATEGORY_REQUIRED: Partial<Record<PartCategory, string[]>> = {
  MLCC_CAPACITOR: ["capacitance", "voltage", "dielectric"],
  LDO_REGULATOR: ["vout", "iout", "dropout"],
  // ...pilot categories
};
export function parametricsFor(category: PartCategory | null) {
  const req = (category && CATEGORY_REQUIRED[category]) ?? [];
  return parametricsSchema.superRefine((v, ctx) => {
    const labels = new Set(v.entries.map((e) => e.label.toLowerCase()));
    for (const k of req) if (!labels.has(k)) ctx.addIssue({ code: "custom", message: `missing required parametric: ${k}` });
  });
}
export const pinSchema = z.object({ number: z.string().trim().min(1), name: z.string().trim().min(1), function: z.union([z.string(), z.array(z.string())]), type: z.enum(["power","io","gnd","nc","strapping","analog","clock"]).optional(), ...anchor });
export const pinoutSchema = z.object({ pins: z.array(pinSchema).min(1) });
export const curveSchema = z.object({ kind: z.enum(["dc-bias","temperature","frequency","ac-level"]), xUnit: z.string(), yUnit: z.string(), yKind: z.enum(["pct-delta-c","effective-capacitance"]), conditions: z.array(z.object({ label: z.string(), value: z.string(), unit: z.string().optional() })), points: z.array(z.object({ x: z.number(), y: z.number() })).min(2), ...anchor })
  .superRefine((c, ctx) => { for (let i=1;i<c.points.length;i++) if (c.points[i].x <= c.points[i-1].x) ctx.addIssue({ code:"custom", message:"points.x must be strictly increasing" }); });
export const deratingSchema = z.object({ curves: z.array(curveSchema).min(1) });
export const powerSchema = z.object({ rails: z.array(z.object({ name: z.string(), voltage: z.string().optional() })).optional(), bypass: z.array(z.object({ value: z.string(), qty: z.number().int().optional(), placement: z.string(), ...anchor })), notes: z.string().optional() });
export const mechanicalSchema = z.object({ entries: z.array(parametricEntry), footprintRef: z.string().optional(), mountingType: z.string().optional(), shieldBonding: z.string().optional(), keepOut: z.string().optional() });
export const notesSchema = z.object({ blocks: guideContentBlocksSchema });
export function factDataSchema(group: PartFactGroup, category: PartCategory | null) { /* switch → the right schema (parametricsFor(category) for PARAMETRICS) */ }
```

**Step 3.** Run the test → PASS; `tsc`. **Commit:** `feat(parts): per-group fact Zod schemas + category required-keys`.

---

## Task 3 — Read layer `query.ts` (built at the A/B seam)

**Files:**
- Create: `src/lib/parts-knowledge/query.ts`, `src/lib/parts-knowledge/citation.ts`
- Test: `src/lib/__tests__/parts-query.test.ts`

**Step 1 — failing tests** (real Neon, throwaway part + facts): `lookupPart` returns only VERIFIED facts by default; UNVERIFIED appears **only** under a separate `unverified` key with a `trust` field when `includeUnverified:true`; **FLAGGED is never returned** (even with the flag); a miss returns `{ found:false, reason:"not_in_library" }`; every returned VERIFIED fact has a non-null `citation`; `lookupBom` resolves a project slug to its most-recent `bomFrozenAt` revision's BomLines→Parts. The query takes an **injected client** so Stage B can pass a read-only one.

**Step 2 — implement.** Signatures: `lookupPart(client, { mpn?|manufacturer?|refdes?|partId?, includeUnverified=false })`, `lookupBom(client, { projectSlug?|revisionId? })`. Citation builder in `citation.ts`: `citationFor(fact, element?)` → prefers element `{sourcePage,sourceNote}`, falls back to row, formats `"<mpn> datasheet p.<n>[, <note>]"`. Enforce the hard guards here (verified-only default; separate `unverified` key; FLAGGED filtered out; `{found:false}`; required citation).

**Step 3.** Run → PASS; `tsc`. **Commit:** `feat(parts): query layer (trust-filtered lookups + citations)`.

---

## Task 4 — Fact server actions (the gate)

**Files:**
- Create: `src/lib/actions/part-facts.ts` (+ a `*-form.ts` wrapper if needed for the client)
- Test: `src/lib/__tests__/part-facts-actions.test.ts`

**Step 1 — failing tests** (real Neon, throwaway part):
- `createFact` requires `requireUser`, validates `data` via `factDataSchema(group, part.category)`, defaults trust UNVERIFIED.
- `verifyFact` per-`sourceKind` precondition: DATASHEET ⇒ (`partDatasheetId` OR `sourceUrl`) + a page anchor (group or ≥1 element) else reject; MANUAL ⇒ non-empty `sourceNote` else reject; sets `verifiedById/At`.
- `editFact` **field-granular auto-demote**: editing `data` OR an anchor (`partDatasheetId/sourcePage/sourceUrl/sourceKind`/any element page) demotes VERIFIED→UNVERIFIED + clears verifier; a `sourceNote`-only edit does **not** demote.
- **Optimistic concurrency**: edit/verify take the loaded `updatedAt`; a stale value → rejected ("reload") and no write (assert via `updateMany({where:{id,updatedAt}}).count===0`).
- `flagFact` sets FLAGGED (+ optional reason); `clearFlag` → UNVERIFIED only (never straight to VERIFIED).
- Self-verification is allowed (`verifiedById === createdById` succeeds).

**Step 2 — implement.** Use `prisma.partFact.updateMany({ where: { id, updatedAt }, data })` for the conditional write; compute demote by diffing stored vs incoming fields; record `lastEditedById`.

**Step 3.** Run → PASS; `tsc`. **Commit:** `feat(parts): fact actions — gate, per-kind precondition, auto-demote, optimistic lock`.

---

## Task 5 — Constrain `Part.category` in the create path

**Files:** Modify `src/lib/schemas/part.ts` (category → `z.nativeEnum(PartCategory).optional()`), `src/components/CreatePartDialog.tsx` (the category `<input>` → a constrained `<select>` of `PartCategory` values), and the create action if it echoes the type.

**Steps:** update schema + form; `tsc` + `pnpm run build`; manual: the New Part form offers the enum select. **Commit:** `feat(parts): constrain category to PartCategory in the create form`.

---

## Task 6 — Extract `BlockListEditor` from `GuideCardEditor`

**Files:** Create `src/components/guide/BlockListEditor.tsx`; modify `src/components/guide/GuideCardEditor.tsx` to consume it. Guard: existing guide tests stay green.

**Steps:** Extract the array shell (per-block reorder/delete chrome + `AddBlockMenu` + block-error keying) into `BlockListEditor({ blocks, onChange, errors? })` — **no header, no save, no `cardId`**. Rewire `GuideCardEditor` to render it. Run the full suite (`pnpm exec vitest run`) — all green (no behavior change). `tsc` + build. **Commit:** `refactor(guide): extract reusable BlockListEditor`.

---

## Task 7 — Part detail page + fact-group editors

**Files:** Create `src/app/parts/[id]/page.tsx` (server) + `src/components/parts/{FactGroupCard,ParametricsEditor,PinoutEditor,PowerEditor,DeratingEditor,MechanicalEditor,NotesEditor,VerifyBadge}.tsx`; modify `src/app/parts/page.tsx` (link the MPN to `/parts/[id]`).

**Steps:** Detail page loads the part + its `factGroups` + datasheet; renders identity/category, datasheet link, and one `FactGroupCard` per group with: the typed inline editor (element-anchor fields), a `VerifyBadge` (trust state), and **Verify / Flag** buttons wired to the Task 4 actions; NOTES uses `BlockListEditor`. Reuse `IconButton` (`@/components/IconButton`), field-styles, the optimistic-lock error surfacing. No DOM harness → `pnpm run build` + manual: curate + verify a group, confirm the badge flips and an edit re-demotes. **Commit(s):** `feat(parts): part detail page + fact-group editors + parts-list link`.

---

## Task 8 — Quick-glance modal

**Files:** Create `src/components/parts/PartGlanceModal.tsx`; wire an open trigger from `src/app/parts/page.tsx` (per-row glance button).

**Steps:** Compact projection of verified facts (pinout table, key parametrics, bypass, a small derating sparkline) + "open full part". `build` + manual. **Commit:** `feat(parts): quick-glance modal from the parts list`.

---

## Task 9 — Datasheet upload + `PartDatasheet` (R2 with fallback)

**Files:** Create `src/lib/actions/part-datasheet.ts`; a small upload control on the detail page.
**Test:** `src/lib/__tests__/part-datasheet-actions.test.ts`.

**Steps:** Reuse `r2.ts` + the presigned pipeline with a `parts/{partId}/…` key (mirroring `uploads.ts` but part-scoped, **not** the Artifact path); record a `PartDatasheet` row. When `R2_ENABLED` is off, the control is hidden/disabled and provenance falls back to `sourceUrl` (= `Part.datasheetUrl`). Test the record/lookup path; gate the R2 calls behind `env.R2_ENABLED`. **Commit:** `feat(parts): PartDatasheet upload (R2, with datasheetUrl fallback)`.

---

## Task 10 — Pilot seed + end-to-end demo

**Files:** Create `scripts/seed-wroom-bom.ts` (seed-style: dotenv + direct Prisma, like `populate-curriculum-dag.ts`).

**Steps:** Seed the 7 pilot parts (§7) with canonical `PartCategory` tokens + BomLines on a pilot revision, and **freeze that revision's BOM** (`bomFrozenAt`) so `lookupBom` resolves. Idempotent. Then a manual demo dry-run: open each part, curate + verify its groups (incl. the MLCC dc-bias DERATING with conditions + per-curve page, and the WROOM MECHANICAL keep-out), confirm the modal shows verified facts, and call `lookupPart`/`lookupBom` from a unit harness to confirm citations + the abstain (`{found:false}`) on the un-curated resistor pinout. **Commit:** `feat(parts): WROOM-BOM pilot seed`.

---

## Done-when (Stage A)
`tsc` clean · `pnpm run build` passes · `pnpm exec vitest run` green · on the running app a signed-in user can curate + verify the pilot parts' fact-groups (element-level provenance, auto-demote on edit, FLAGGED excluded) and see them on `/parts/[id]` + the modal · `query.ts` returns trust-filtered facts with citations and `{found:false}` on a miss. **Then** write the Stage B plan (read-only Neon role + `mcp/parts-server/` consuming `query.ts`).
