# Parts Knowledge & Datasheet Library — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm complete; ready for implementation planning)
**Builds on:** the parts library (flat `Part` list + `datasheetUrl`, [src/app/parts/page.tsx](../../src/app/parts/page.tsx)), the guide `contentBlocks` system + inline editor (PR #4), R2 artifact storage (`Artifact` model), and the **authoritative-done** verification pattern (an explicit human gate, never software inference).

---

## 1. Goal & scope

Build a **curated, per-part knowledge base** that is simultaneously:

1. the app's parts data (what a `Part` *is*),
2. a **grounding source** that maximizes AI accuracy and minimizes hallucination, and
3. a **human-verifiable single source of truth** where every fact is provenance-linked and carries an explicit trust state.

v1 is a **full vertical slice** proving the entire pipeline — curate → verify → ground → AI answers with citations — end-to-end on the real **L1-01 WROOM-breakout BOM** (~7 parts spanning every category), curated **by hand**.

### Decisions (validated in brainstorm)

| Decision | Choice |
|---|---|
| v1 ambition | **Full vertical slice** — data model + verify gate + part detail UI + quick-glance modal + MCP retrieval + answer contract, demonstrated end-to-end on the pilot BOM. |
| AI access | **MCP `lookup_part` tool** — a read-only Model Context Protocol server over the same Neon DB. Works in Claude Code sessions *today*; a future in-app assistant reuses the same query layer. |
| Curation source | **Human-curated first** — facts hand-entered with datasheet-page provenance, behind the verify gate. AI-drafted-then-verified is a later phase that feeds *this* gate. |
| Content depth | **Full product** — structured fact-groups **and** narrative `contentBlocks` cards per part. |
| Pilot | The **WROOM-breakout BOM** — the foundation set; every motivating case (pinout, bypass, DC-bias curve) shows up naturally. |

### Non-goals (v1)
- **AI-drafted extraction** of facts from the PDF — deferred; the verify gate it feeds is built here so it can slot in cleanly later.
- **In-app learner-facing AI assistant** — deferred; v1 grounding is proven via the MCP tool in dev/Claude sessions. The query layer is built reusably so the assistant is a later consumer, not a rewrite.
- **Parts-API import** (Nexar/Octopart) — deferred; pilot parametrics are hand-entered.
- **Re-hosting datasheet figures** — we anchor/deep-link the cached PDF and store curves as *data*, never re-host copyrighted images.
- **Bulk curation tooling** — v1 curates ~7 parts by hand through the normal UI.

### Success criteria (the demo that proves it)
For the ~7 pilot parts:
- A signed-in user opens `/parts/[id]`, curates each fact-group (parametrics, pinout, power/bypass, derating, narrative) **with datasheet-page provenance**, and clicks **Verify** per group (the gate).
- The **quick-glance modal** opens from the parts list / a BOM line and shows the verified facts compactly.
- `lookup_part` (called from a Claude Code session via the MCP server) returns the verified facts **with citations**; `lookup_bom("foundry-l1-01-wroom-breakout")` returns the whole circuit's set.
- Demonstration prompts close the loop:
  - *"Pinout of the AP2112?"* → answered from the library, cited.
  - *"DC-bias derating of the 10µF MLCC at 3.3V?"* → interpolated from the stored points, cited.
  - *"Pinout of `<un-curated part>`?"* → **abstains** ("not in the library") rather than guessing.

---

## 2. The core idea — three pillars

Everything below serves three pillars; two map directly onto the two goals.

**A. Dual representation.** A part's knowledge has two natures, and conflating them breaks both grounding and verifiability:
- **Discrete / parametric facts** (pinout, package, abs-max, bypass, derating *points*) → **structured JSON**, shape varying by category, validated by per-group Zod schemas (the same discriminated-union discipline as the guide blocks). Machine-precise so the AI looks them up *exactly* and the UI renders tables.
- **Narrative / teaching** (why bypass here, placement gotchas) → the existing **`contentBlocks`** model + inline editor. Human prose, reused not reinvented.

**B. Provenance + trust = human verification.** Every fact carries a **source anchor** (cached datasheet PDF in R2 + page/figure ref) and a **trust state** (`UNVERIFIED → VERIFIED → FLAGGED`) with verifier + timestamp. Verification is an explicit human gate — nothing is `VERIFIED` because software guessed, only because a person checked it against the datasheet. **Editing a `VERIFIED` fact auto-demotes it to `UNVERIFIED`** (forces re-review). This is what makes errors *detectable*.

**C. Retrieval contract = AI usefulness.** The grounding pays off only if the data reaches the model at answer time, under discipline: *answer from retrieved facts, cite the provenance, prefer `VERIFIED`, and say "not in the library / unverified" rather than guess.* That abstain-over-confabulate rule converts the library into low-hallucination behavior.

---

## 3. Data model

### 3.1 `Part` (existing) + cached datasheet
- Keep `Part` as the identity row (`mpn`, `manufacturer`, `category`, `footprint`, `lifecycle`, `datasheetUrl`, …).
- Add a **cached datasheet** as an `Artifact` (R2) referenced by the part, so provenance anchors point at a stable copy, not a rot-prone vendor URL. (`datasheetUrl` stays as the canonical upstream link.)
- Add relation `Part.factGroups: PartFact[]`.

### 3.2 `PartFact` — one row per fact-group
Fact-**group** granularity is the sweet spot: per-pin is too fine to verify, whole-part too coarse to trust selectively.

```prisma
enum PartFactGroup { PARAMETRICS  PINOUT  POWER  DERATING  NOTES }
enum FactTrust     { UNVERIFIED  VERIFIED  FLAGGED }
enum FactSourceKind { DATASHEET  MANUAL  API }

model PartFact {
  id                  String         @id @default(cuid())
  partId              String
  part                Part           @relation(fields: [partId], references: [id], onDelete: Cascade)
  group               PartFactGroup
  data                Json           // validated by the per-group Zod schema (§3.3)
  trust               FactTrust      @default(UNVERIFIED)
  // provenance
  sourceKind          FactSourceKind @default(DATASHEET)
  datasheetArtifactId String?        // cached PDF (R2) this fact was read from
  sourcePage          Int?           // datasheet page anchor
  sourceUrl           String?        // external source if not the cached PDF
  sourceNote          String?        // figure/table ref, free text
  // verification
  verifiedById        String?
  verifiedBy          User?          @relation(fields: [verifiedById], references: [id])
  verifiedAt          DateTime?
  createdById         String
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  @@unique([partId, group]) // one group row per part in v1
  @@index([trust])
}
```

### 3.3 Per-group `data` schemas (Zod, in `src/lib/schemas/part-fact.ts`)
- **PARAMETRICS** — `{ entries: [{ label, value, unit? }] }` plus a per-**category** required-key refinement (e.g. `MLCC_CAPACITOR` requires capacitance/voltage/dielectric; `LDO_REGULATOR` requires Vout/Iout/dropout). Pragmatic + queryable; category coverage limited to the pilot's categories in v1.
- **PINOUT** — `{ pins: [{ number, name, function, type?: "power"|"io"|"gnd"|"nc"|… }] }`.
- **POWER** — `{ rails?: [{ name, voltage? }], bypass: [{ value, qty?, placement }], notes? }`.
- **DERATING** — `{ curves: [{ kind: "dc-bias"|"temperature"|…, xUnit, yUnit, points: [{ x, y }] }] }` — **curves as data**, never images. One row holds N curves.
- **NOTES** — `{ blocks: ContentBlock[] }` — reuse `guideContentBlocksSchema` verbatim.

---

## 4. Verification workflow (the gate)

- **States:** `UNVERIFIED` (created/edited, not yet checked) → `VERIFIED` (a human checked it against the cited datasheet page) → `FLAGGED` (someone disputes it). 
- **Transitions** are explicit server actions; `VERIFIED` is only reachable via a deliberate **Verify** action that requires provenance present (a `DATASHEET` fact must have `datasheetArtifactId` + `sourcePage`). `verifiedBy`/`verifiedAt` recorded.
- **Auto-demote:** any edit to a `VERIFIED` fact resets it to `UNVERIFIED` (re-review). Mirrors the "don't trust stale" rule.
- **UI:** on the part detail page, each fact-group is a card with an inline editor (reusing the guide editor's field-styles / `IconButton` / block patterns) and a trust **badge** + **Verify / Flag** controls. Provenance (page #, figure ref, "view datasheet") is part of each group's editor.

---

## 5. Retrieval — the MCP server + answer contract

- **Query layer:** `src/lib/parts-knowledge/query.ts` — pure, read-only functions (`lookupPart`, `lookupBom`) returning identity + fact-groups + trust + **citation strings** (e.g. `"AP2112 datasheet p.4, Fig. 2"`). Reused by both the MCP server and (later) the in-app assistant.
- **MCP server:** `mcp/parts-server/` — a small standalone TS process speaking MCP stdio over a **read-only** Neon connection. Tools:
  - `lookup_part({ mpn?, manufacturer?, refdes?, partId?, includeUnverified? })` → the part + its fact-groups (VERIFIED by default; UNVERIFIED only when asked, and flagged as such) + citations.
  - `lookup_bom({ projectSlug | revisionId })` → every part on that circuit + their facts (so circuit-function questions reason from real specs).
- **Registration:** added to the project's MCP config so Claude Code sessions can call it. (Connection uses a read-only credential — the server must be incapable of writes.)
- **Answer contract** (baked into the tool descriptions + a usage note now; the in-app assistant's system prompt later): *answer from returned facts; cite the provenance; prefer `VERIFIED`; if a fact is absent or only `UNVERIFIED`, say so rather than guess.*

---

## 6. UI surfaces

- **Part detail page** `/parts/[id]` (server component) — identity header, datasheet embed/link, the fact-group cards (§4), and the narrative `NOTES` card. This is the source of truth. *(Step zero: make the parts-list MPN link here — today nothing is clickable.)*
- **Quick-glance modal** — a compact projection of the same data, openable from the parts list and from a BOM line; shows verified facts (pinout table, key parametrics, bypass, a small derating sparkline) + "open full part". The page is canonical; the modal is presentation.
- **Curation** — inline edit + per-group Verify/Flag, reusing the editor primitives from PR #4.

---

## 7. The pilot — WROOM-breakout BOM (~7 parts)

Chosen because it spans every category and every motivating case. (Exact MPNs finalized against the real BOM during planning.)

| # | Part (example MPN) | Category | Why it's in the slice |
|---|---|---|---|
| 1 | ESP32-WROOM-32E (Espressif) | `RF_MODULE` | Module pinout + **antenna keep-out** (ties to the L1-01 LAYOUT guide) + power rails. The certified-module case. |
| 2 | AP2112K-3.3 (Diodes) | `LDO_REGULATOR` | Pinout, dropout, **output-cap / bypass** requirement, thermal. |
| 3 | CP2102N (Silicon Labs) | `USB_UART_IC` | Pinout, VBUS/3V3 rails, decoupling. |
| 4 | GRM188R61A106K 10µF 0805 X5R (Murata) | `MLCC_CAPACITOR` | The **DC-bias derating curve** case — the headline motivating example. |
| 5 | USB micro-B / USB-C receptacle | `USB_CONNECTOR` | Pinout + mechanical/footprint + shield. |
| 6 | 0.1µF MLCC | `MLCC_CAPACITOR` | Bypass workhorse; minimal derating — contrast with #4. |
| 7 | 10kΩ 0402 resistor | `PASSIVE_RESISTOR` | The "thin part" case — minimal parametrics, no pinout. |

A `scripts/seed-wroom-bom.ts` seeds the part rows + the BOM lines (data only); **curation is done by hand** through the UI (that's the point of human-curated-first).

---

## 8. Reuse, testing, files

**Reuse:** `contentBlocks` + `guideContentBlocksSchema` and the inline-editor primitives (field-styles, `IconButton`, block list) from PR #4; R2 `Artifact` for the cached PDF; the authoritative-done verify-gate pattern; the `FilterChip` parts-list pattern; the Zod discriminated-union convention from [src/lib/schemas/guide.ts](../../src/lib/schemas/guide.ts).

**Testing (TDD the pure + action layers; no DOM harness):**
- Per-group Zod schemas — valid/invalid `data` round-trips for each group + the category required-key refinements.
- `src/lib/parts-knowledge/query.ts` — `lookupPart`/`lookupBom` return the right facts, filter by trust, and build correct citation strings (real Neon, throwaway part, torn down).
- Fact server actions — create/edit/verify/flag: trust transitions, **provenance required for `VERIFIED`**, **edit auto-demotes `VERIFIED`→`UNVERIFIED`**, freeze/authz.
- MCP server — smoke-test the tool wiring over the shared query layer; assert it cannot write.
- Pages/modal — `pnpm run build` + manual pass.

**Files (high-level):**
- `prisma/schema.prisma` — `PartFact` + enums + `Part.factGroups`/cached-datasheet relations.
- `src/lib/schemas/part-fact.ts` — per-group schemas + the category refinements.
- `src/lib/parts-knowledge/query.ts` — shared read layer (citations).
- `src/lib/actions/part-facts.ts` (+ a form wrapper) — create/edit/verify/flag.
- `src/app/parts/[id]/page.tsx` — part detail; `src/components/parts/*` — `FactGroupEditor`, `PinoutEditor`, `DeratingEditor`, `VerifyBadge`, `PartGlanceModal`.
- `mcp/parts-server/` — the MCP server.
- `scripts/seed-wroom-bom.ts` — pilot part + BOM seed.

---

## 9. Open items / risks (for planning)
- **Per-category parametrics scope** — implement only the pilot's categories; design the schema so adding a category is additive.
- **MCP read-only guarantee** — the server's DB credential must be physically read-only; tools never expose writes.
- **Datasheet figure copyright** — anchor/deep-link the cached PDF; store curves as data; never re-host figures.
- **Auto-demote on edit** — confirm the re-review-on-edit rule feels right in use (it's the safe default).
- **Modal vs page** — build the page as source of truth first; the modal is a thin projection.
- **Citation format** — settle a single citation string shape early (used by tool output + the answer contract).
- **Pilot MPNs** — finalize against the actual WROOM-breakout BOM at plan time.
