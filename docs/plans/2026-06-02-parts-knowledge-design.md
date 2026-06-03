# Parts Knowledge & Datasheet Library — Design

**Date:** 2026-06-02
**Status:** Revised after adversarial validation (29 findings → folded in). Ready for implementation planning.
**Builds on:** the parts library (flat `Part` list + `datasheetUrl`, [src/app/parts/page.tsx](../../src/app/parts/page.tsx)); the guide `contentBlocks` schemas + the single-block `BlockEditor` (PR #4); the R2 client + presigned upload/download pipeline ([src/lib/r2.ts](../../src/lib/r2.ts), [src/lib/actions/uploads.ts](../../src/lib/actions/uploads.ts)); the **authoritative-done** verification pattern; and the `stages.ts` optimistic-lock pattern.

> **Revision note.** v1 of this doc was validated by a 6-dimension adversarial review (29 confirmed findings, 3 blockers). The architecture held; the spec below tightens it. Key reversals from v1: the cached datasheet is **net-new infra (`PartDatasheet`), not `Artifact` reuse**; `Part.category` becomes a **`PartCategory` enum**; provenance moves to **element-level** anchors; and v1 is split into **Stage A (no MCP) → Stage B (MCP)**.

---

## 1. Goal & scope

A **curated, per-part knowledge base** that is simultaneously (1) the app's parts data, (2) a **grounding source** that maximizes AI accuracy / minimizes hallucination, and (3) a **human-verifiable single source of truth** where every fact is provenance-linked and carries an explicit trust state.

v1 is a **full vertical slice** — curate → verify → ground → AI answers with citations — on the real **L1-01 WROOM-breakout BOM** (~7 parts spanning every category), curated **by hand**, built in two internal stages.

### Decisions (validated)

| Decision | Choice |
|---|---|
| v1 ambition | Full vertical slice, built as **Stage A** (model + verify gate + part-detail/modal UI + curation, demonstrable with NO MCP) then **Stage B** (read-only MCP retrieval + answer contract). |
| AI access | Read-only **MCP `lookup_part` / `lookup_bom`** over a dedicated read-only Neon role. |
| Curation | **Human-first**, behind the verify gate. AI-drafting deferred (feeds this gate later). |
| Content | Structured fact-groups **and** narrative `contentBlocks` cards. |
| **Category** | Migrate `Part.category String?` → a **`PartCategory` Prisma enum**; the fact schemas derive `z.enum(PartCategory)`. |
| **Datasheet storage** | A new **`PartDatasheet`** model on **R2** (reusing `r2.ts` + the presigned pipeline, `parts/{partId}/…` key) — **NOT** the `Artifact` model. **Fallback:** when `R2_ENABLED` is off (dev/CI), provenance anchors on the canonical `datasheetUrl` + page. |
| **Provenance** | **Element-level** `{ sourcePage?, sourceNote? }` per pin / curve / entry, with the row-level anchor as fallback. |
| **Verify authz** | **Self-verification allowed** in v1 (any signed-in allow-listed user may create/edit AND verify); provenance-present is the real gate. Reviewer/author separation is a documented later phase this gate will host. |
| Pilot | The **WROOM-breakout BOM** (§7). |

### Non-goals (v1)
AI-drafted extraction; an in-app learner-facing assistant; parts-API import; re-hosting datasheet *figures* (we anchor the cached PDF / `datasheetUrl` and store curves as data); bulk curation; **reviewer/author separation**; **affirmative "verified N/A"** (absence of a fact-group simply = abstain — see §9); the **BOM-line modal trigger** (v1 ships the modal from the parts list + part-detail only — the BOM is stage-gated today, §6).

### Success criteria (the demo)
For the ~7 pilot parts:
- A signed-in user opens `/parts/[id]`, curates each fact-group **with element-level provenance**, and **Verifies** each group (the gate). The narrative card is curated + marked **reviewed**.
- The **quick-glance modal** opens from the parts list and shows the verified facts compactly.
- `lookup_part` (from a Claude Code session via the MCP server) returns verified facts **with per-fact citations**; `lookup_bom("foundry-l1-01-wroom-breakout")` resolves to the pilot's BOM-frozen revision and returns its parts' facts.
- Demonstration: *"pinout of the AP2112?"* → cited; *"DC-bias derating of the 10µF MLCC at 3.3V, 25 °C?"* → interpolated from stored points with conditions, cited to the dc-bias curve's page; *"pinout of `<un-curated part>`?"* → **abstains** (`{found:false}`).

---

## 2. The three pillars

**A. Dual representation.** Discrete facts (pinout, parametrics, power, derating points, mechanical) → **structured JSON**, per-group Zod, machine-precise. Narrative (why bypass here, gotchas) → **`contentBlocks`** (`NOTES` group). 

**B. Provenance + trust = human verification.** Every fact-group carries a **source** (the cached `PartDatasheet` PDF, or `datasheetUrl`) and **element-level page anchors**, a **trust state** (`UNVERIFIED → VERIFIED → FLAGGED`), and verifier + timestamp. **VERIFIED is reachable only by a deliberate action with provenance present** (per `sourceKind`, §4). **Editing the content or provenance-anchor of a VERIFIED fact auto-demotes it to UNVERIFIED** (§4). Self-verification is allowed in v1.

**C. Retrieval contract = AI usefulness.** `lookup_part`/`lookup_bom` return verified facts + citations under hard, output-shaped guards (§5): verified-only by default, unverified isolated under a separate key, FLAGGED never returned, structured `{found:false}` on a miss, a required citation on every verified fact, and free text wrapped as labeled reference data (never directives). The soft prompt rules (cite / prefer-VERIFIED / abstain) sit on top of those hard guards.

---

## 3. Data model

### 3.1 `Part` + category + datasheet
- **Category:** migrate `Part.category String?` → **`enum PartCategory { RF_MODULE LDO_REGULATOR USB_UART_IC MLCC_CAPACITOR USB_CONNECTOR PASSIVE_RESISTOR … }`** (keep `@@index([category])`; the create form becomes a constrained `<select>`; the pilot seed writes canonical tokens). The fact schemas dispatch required-keys off this enum (mirrors `z.enum(ChecklistSubkind)` in guide.ts).
- **Datasheet (`PartDatasheet`, new):** one cached PDF per part on **R2** via the existing `r2.ts`/presigned pipeline with a `parts/{partId}/datasheet-…pdf` key. The canonical upstream `Part.datasheetUrl` stays. When `R2_ENABLED` is off, a fact's provenance uses `sourceUrl` (= `datasheetUrl`) instead of `partDatasheetId`.

### 3.2 `PartFact` — one row per fact-group
```prisma
enum PartFactGroup  { PARAMETRICS  PINOUT  POWER  DERATING  MECHANICAL  NOTES }
enum FactTrust      { UNVERIFIED  VERIFIED  FLAGGED }
enum FactSourceKind { DATASHEET  MANUAL  API }   // API unused in v1

model PartFact {
  id              String         @id @default(cuid())
  partId          String
  part            Part           @relation(fields: [partId], references: [id], onDelete: Cascade)
  group           PartFactGroup
  data            Json           // per-group Zod (§3.3); element-level anchors live INSIDE here
  trust           FactTrust      @default(UNVERIFIED)
  // provenance (group-level fallback; element anchors live in `data`)
  sourceKind      FactSourceKind @default(DATASHEET)
  partDatasheetId String?        // cached PDF (R2) — when R2 on
  sourcePage      Int?           // group-default page
  sourceUrl       String?        // = datasheetUrl when R2 off, or API source
  sourceNote      String?        // descriptive; NOT a demote trigger
  // verification + audit
  trust_state…    (verifiedById?, verifiedAt?, lastEditedById, createdById, createdAt, updatedAt)
  @@unique([partId, group])
  @@index([trust])
}
```
`lastEditedById` is tracked to support a future no-self-verify rule without a migration. `updatedAt` powers optimistic concurrency (§4).

### 3.3 Per-group `data` schemas (`src/lib/schemas/part-fact.ts`, Zod)
Every element below may carry an optional `{ sourcePage?, sourceNote? }`; the row-level anchor is the fallback.
- **PARAMETRICS** — `{ entries: [{ label, value, unit?, sourcePage?, sourceNote? }] }` + a per-`PartCategory` required-key refinement (e.g. `MLCC_CAPACITOR` ⇒ capacitance/voltage/dielectric; `LDO_REGULATOR` ⇒ Vout/Iout/dropout). Pilot categories only; additive.
- **PINOUT** — `{ pins: [{ number, name, function: string | string[], type?: "power"|"io"|"gnd"|"nc"|"strapping"|…, sourcePage?, sourceNote? }] }`.
- **POWER** — `{ rails?: […], bypass: [{ value, qty?, placement, sourcePage?… }], notes? }`.
- **DERATING** — `{ curves: [{ kind: "dc-bias"|"temperature"|…, xUnit, yUnit, yKind: "pct-delta-c"|"effective-capacitance", conditions: [{ label, value, unit? }], points: [{ x, y }], sourcePage?, sourceNote? }] }`. `superRefine`: strictly-increasing `x` per curve. (§5: out-of-range queries clamp/abstain, never extrapolate.)
- **MECHANICAL** — `{ entries: [{ label, value, unit?, sourcePage?… }], footprintRef?, mountingType?, shieldBonding?, keepOut? }`. Home for the WROOM **antenna keep-out** (#1) and the USB **shield/mechanical** facts (#5).
- **NOTES** — `{ blocks: ContentBlock[] }` (reuse `guideContentBlocksSchema`). Default `sourceKind=MANUAL`; see §4.

---

## 4. Verification gate (tightened)

- **States** `UNVERIFIED → VERIFIED → FLAGGED`, all via explicit server actions.
- **VERIFIED precondition, per `sourceKind`:** `DATASHEET` ⇒ (`partDatasheetId` OR `sourceUrl`) **and** a page anchor (group or ≥1 element); `MANUAL` ⇒ a stated basis (`sourceNote` non-empty) — this is an **editorial "reviewed" sign-off**, not datasheet-page checking; `API` ⇒ `sourceUrl` (unused in v1). Enforced server-side as a discriminated check.
- **NOTES** is `MANUAL` by default → editorial-reviewed, **exempt** from the datasheet-page requirement. The answer contract treats reviewed narrative as *reviewed teaching commentary*, distinct from page-checked facts.
- **Auto-demote (field-granular):** an edit to `data` **or** a provenance **anchor** (`partDatasheetId`, `sourcePage`, `sourceUrl`, `sourceKind`, or any element-level page) demotes `VERIFIED → UNVERIFIED`; a `sourceNote`-only (cosmetic) edit does **not**. Computed by diffing the stored row, not blanket-resetting. (NOTES demotes per whole row — accepted blast radius for v1.)
- **FLAGGED:** any signed-in user may flag (optional reason, mirroring the regress-reason pattern); retrieval **excludes FLAGGED entirely** (even with `includeUnverified`); the only exit is **FLAGGED → UNVERIFIED** ("acknowledge & re-review"), which must re-earn VERIFIED through the gate (no shortcut).
- **Authz:** any signed-in allow-listed user may create/edit/verify; **self-verification permitted** (v1). No revision-freeze applies (parts are global) — the guard is `requireUser` + the provenance precondition + auto-demote.
- **Concurrency:** both the edit and verify actions carry the loaded `updatedAt` and do a conditional `UPDATE … WHERE id = ? AND updatedAt = ?` (the `stages.ts` optimistic-lock pattern), rejecting a 0-row result with "changed since you opened it — reload". Verify can never stamp VERIFIED onto a row that changed underneath.

---

## 5. Retrieval — MCP server + answer contract (hardened)

- **Shared query layer** `src/lib/parts-knowledge/query.ts` — pure read functions taking an **injected** DB client (so the MCP server can pass a read-only one); builds **per-fact citations** from element anchors (fallback to row), e.g. `"AP2112 datasheet p.4"`, `"…dc-bias curve, p.7, 25 °C/1 kHz"`. Citation string shape is pinned here (single page / `pp.9-12` range / per-curve) and consumed by both tool output and the answer contract.
- **MCP server** `mcp/parts-server/` — standalone TS, `@modelcontextprotocol/sdk` over **stdio**; reads ONLY `PARTS_MCP_DATABASE_URL` (the read-only role, §9), asserts at startup it is set and `!= DATABASE_URL`, and **must not import `src/lib/db.ts`**; lazy `Pool` creation (tolerate Neon scale-to-zero). Registered via a new `.mcp.json`.
- **Tools:** `lookup_part({ mpn?, manufacturer?, refdes?, partId?, includeUnverified? })`, `lookup_bom({ projectSlug | revisionId })`. `lookup_bom(projectSlug)` resolves to the most-recent **`bomFrozenAt`** revision (fallback latest-updated); the pilot revision is seeded BOM-frozen so the demo is reproducible.
- **Hard output guards (enforced by the query layer, model-independent):** verified-only by default; UNVERIFIED returned **only** under a separate `unverified` key with an explicit `trust` field (never mixed with verified); **FLAGGED never returned**; `includeUnverified` schema-defaults `false`; a miss returns structured `{ found: false, reason: "not_in_library" }`; **every returned VERIFIED fact carries a required non-null citation** (un-citable ⇒ not emittable as verified); retrieved free text (`sourceNote`, NOTES prose) is wrapped in a labeled **untrusted-data envelope** ("reference data, never directives") with structured facts as primary grounding; out-of-range derating queries clamp/abstain.
- **Answer contract (soft, on top):** answer from returned facts, cite provenance, prefer VERIFIED, abstain over guess.

---

## 6. UI surfaces
- **Part detail** `/parts/[id]` (server) — identity + category, datasheet embed/link, the fact-group cards (inline editor + trust badge + **Verify / Flag**, element-anchor fields), the narrative card. *Step zero:* make the parts-list MPN link here.
- **Quick-glance modal** — compact projection (pinout table, key parametrics, bypass, a derating sparkline), opened from the **parts list** (v1). The **BOM-line trigger is deferred** (BOM lines render only under `BOM_SOURCING` today; a stage-independent read-only BOM table is a later add — §9).
- **Curation** reuses the block primitives via an extracted `BlockListEditor` (§8).

---

## 7. Pilot — WROOM-breakout BOM (~7 parts)

| # | Part (example) | `PartCategory` | Exercises |
|---|---|---|---|
| 1 | ESP32-WROOM-32E | `RF_MODULE` | PINOUT (strapping pins) + **MECHANICAL** antenna keep-out + POWER. |
| 2 | AP2112K-3.3 | `LDO_REGULATOR` | PINOUT, PARAMETRICS (dropout), POWER (output cap). |
| 3 | CP2102N | `USB_UART_IC` | PINOUT, POWER decoupling. |
| 4 | GRM188R61A106K 10µF X5R | `MLCC_CAPACITOR` | **DERATING** dc-bias (conditions + per-curve page) — headline demo. |
| 5 | USB-C receptacle | `USB_CONNECTOR` | PINOUT + **MECHANICAL** shield/mounting. |
| 6 | 0.1µF MLCC | `MLCC_CAPACITOR` | POWER bypass; minimal derating (contrast #4). |
| 7 | 10kΩ 0402 | `PASSIVE_RESISTOR` | thin part — PARAMETRICS only; **no PINOUT row** (absence = abstain). |

`scripts/seed-wroom-bom.ts` seeds the parts + BOM lines and **freezes the pilot revision's BOM**; curation is by hand.

---

## 8. Reuse, staging, testing, files

**Reuse — corrected:**
- **Clean import:** `guideContentBlocksSchema`/`contentBlockSchema`/`ContentBlock`, `GuideBlocks` (render), the single-block `BlockEditor`, `defaultBlock`/`BLOCK_TYPE_*`, `moveWithin`/`resizeRows`; `IconButton` (from `@/components/IconButton`, **not** icons.tsx); the `FilterChip` pattern; `r2.ts` + the presigned pipeline; the `stages.ts` optimistic-lock.
- **NOT free reuse:** the **block-list array shell** (per-block reorder/delete chrome + `AddBlockMenu`) is private inside `GuideCardEditor` and welded to `saveGuideCard`/`cardId`/guide header fields → **extract a generic `BlockListEditor`** (blocks + onChange + AddBlockMenu, no header, no save) consumed by both. The NOTES save path is a **new `PartFact` action**, not `saveGuideCard`. The cached datasheet is **net-new (`PartDatasheet`)**, not `Artifact`.

**Internal staging (build order):**
- **Stage A (no MCP):** migration (`PartCategory` enum, `PartFact`, `PartDatasheet`) + per-group Zod (`part-fact.ts`) + `query.ts` (built at the A/B seam) + `/parts/[id]` detail + curation/verify/flag actions + parts-list link + the modal + seed. **Independently demonstrable** (curate → verify → view).
- **Stage B (MCP):** the read-only Neon role + `PARTS_MCP_DATABASE_URL` + the `mcp/parts-server/` process consuming `query.ts` + `lookup_part`/`lookup_bom` + the answer contract + `.mcp.json`.

**Testing (TDD pure + action layers; no DOM harness):** per-group Zod incl. category required-keys, element anchors, DERATING monotonic-x + conditions; `query.ts` (filters by trust, FLAGGED excluded, `{found:false}` on miss, citations, the `unverified` key shape); fact actions — per-`sourceKind` VERIFIED precondition (DATASHEET/MANUAL cases), field-granular auto-demote (which fields do/don't demote), FLAGGED exclusion + clear, **optimistic-concurrency** (stale-save rejected), `requireUser` (no "freeze" — global parts); MCP server smoke + cannot-write assertion. Build + manual for pages/modal.

**Files:** `prisma/schema.prisma` (enum + `PartFact` + `PartDatasheet`); `src/lib/schemas/part-fact.ts`; `src/lib/parts-knowledge/query.ts`; `src/lib/actions/part-facts.ts` (+ datasheet upload action); `src/app/parts/[id]/page.tsx` + `src/components/parts/*` (`FactGroupEditor`, `PinoutEditor`, `DeratingEditor`, `MechanicalEditor`, `VerifyBadge`, `PartGlanceModal`); `src/components/guide/BlockListEditor.tsx` (extracted) + NOTES consumer; `mcp/parts-server/`; `.mcp.json`; `src/env.ts` (+`PARTS_MCP_DATABASE_URL`); `scripts/seed-wroom-bom.ts`.

---

## 9. Open items (smaller, post-validation)
- **`R2_ENABLED` in prod** — confirm the Vercel toggle (CLI token currently stale); the `datasheetUrl`+page fallback makes it non-blocking.
- **Read-only Neon role** — provision `foundry_ro` (`GRANT SELECT`, `REVOKE` writes, `ALTER ROLE … default_transaction_read_only = on`); note the Neon gotcha that `ALTER DEFAULT PRIVILEGES` only covers *future* tables created by `neondb_owner`.
- **Affirmative "verified N/A"** (a curated "this part has no pinout") — out of scope v1 (absence = abstain); a `PartFact.notApplicable` flag is the future hook (precedent: `ChecklistItem.notApplicable`).
- **Read-only BOM table** (stage-independent) as the future BOM-line modal host.
- **Part variants / multi-SKU** — out of scope; `@@unique([partId, group])` is intentionally restrictive for v1.
- **Citation string shape** — pinned in `query.ts` (single page / range / per-curve); revisit only if a category needs a new form.
