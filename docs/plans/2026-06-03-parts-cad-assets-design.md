# Parts CAD Assets (KiCad) — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm complete). Queued as **Stage C** — after the Stage A merge and Stage B (MCP).
**Builds on:** `PartDatasheet` + the R2 presigned upload pipeline + the bucket CORS (Stage A); the `PartFact` trust/provenance **verify gate**; and the per-project KiCad library workflow observed in `C:\zzz\otd\hardware\schematic\test-boards\TB-1-POWER`.

---

## 1. Goal & scope

Turn the parts library into a **design-ready component library**: each part carries its full KiCad asset bundle — **symbol + footprint + 3D model** (the **datasheet** already landed in Stage A) — curated **once**, **verified**, and reusable across boards, so a new board pulls vetted assets instead of re-collecting them from SnapEDA / SamacSys / Ultra Librarian per project.

**Observed workflow (TB-1-POWER) — the thing we're optimizing.** A *per-project local library*:
- `fp-lib-table` → one pooled project footprint lib `${KIPRJMOD}/libs/<project>.pretty` (a `.pretty` dir of `.kicad_mod`s).
- `sym-lib-table` → one `.kicad_sym` **per part** under `libs/`, each `descr` noting **mfr / MPN / package / source** (e.g. "SamacSys").
- `libs/<MPN>.step` 3D models; `datasheets/*.pdf`; all `${KIPRJMOD}`-relative (portable).
Today this `libs/` is **re-assembled for every board** — the pain this removes.

So the per-part bundle is concretely: **`.kicad_sym` + `.kicad_mod` + `.step` + `.pdf` + metadata (mfr/MPN/package/source/license)**.

### Decisions (validated in brainstorm)
| Decision | Choice |
|---|---|
| v1 ambition | **Store + verify** per-part assets, with per-file download. The **BOM → KiCad-library export is the explicit next phase**. |
| Model | New **`PartAsset { kind: SYMBOL \| FOOTPRINT \| MODEL_3D }`**. **Datasheet stays `PartDatasheet`** (it doubles as fact provenance via `PartFact.partDatasheetId`) — they share upload/verify *helpers*, not one table. |
| Gate | Reuse the Stage A trust/provenance **verify gate** + **self-verify**. |
| Metadata | Capture **`source` + `license` + `ref`/name** per asset (the `sym-lib-table` `descr` data). |
| EDA tool | **KiCad-first** (matches the stack). |

### Non-goals (v1)
- The **BOM → library export** (next phase — §7).
- **Auto cross-checks** (symbol pin map vs the `PINOUT` fact-group; footprint pad count vs pin count) — deferred enhancement.
- **SnapEDA/Ultra Librarian API import** — hand-upload first (consistent with the datasheet flow).
- Non-KiCad EDA tools.
- **Unifying `PartDatasheet` into `PartAsset`** — a future cleanup, not v1 (avoids churning the just-verified Stage A FK).

### Success criteria
On a pilot part: a signed-in user uploads its `.kicad_sym` / `.kicad_mod` / `.step` (with source + license), marks each **VERIFIED**, downloads each, and the **Assets** section reflects verified state — over the same R2 + CORS path that Stage A's datasheet upload uses.

---

## 2. Data model
```prisma
enum PartAssetKind { SYMBOL FOOTPRINT MODEL_3D }

model PartAsset {
  id              String        @id @default(cuid())
  partId          String
  part            Part          @relation(fields: [partId], references: [id], onDelete: Cascade)
  kind            PartAssetKind
  r2Key           String        // parts/{partId}/{kind}-{cuid}.{ext}
  filename        String
  byteSize        Int
  contentType     String
  ref             String?       // symbol/footprint name, e.g. "SOP65P640X120-8N" (sym-lib-table descr data)
  source          String?       // SnapEDA | SamacSys | Ultra Librarian | manufacturer | hand-made
  license         String?
  trust           FactTrust     @default(UNVERIFIED)
  verifiedById    String?
  verifiedAt      DateTime?
  lastEditedById  String?
  createdById     String
  createdBy       User          @relation(fields: [createdById], references: [id], onDelete: Restrict)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  @@unique([partId, kind])      // one asset per kind per part; replace = upsert
  @@index([trust])
}
```
`Part` gains `assets PartAsset[]`. `PartDatasheet` is unchanged. Mirrors the `PartDatasheet` provenance/verify columns + the `createdBy` relation (per the Stage A review fix).

## 3. Asset kinds + files
| kind | ext | nature | content-type | cap |
|---|---|---|---|---|
| `SYMBOL` | `.kicad_sym` | text, small | `text/plain` | default |
| `FOOTPRINT` | `.kicad_mod` | text, small | `text/plain` | default |
| `MODEL_3D` | `.step` / `.STEP` / `.wrl` | **binary, large** | `model/step` / `application/octet-stream` | **raised (e.g. 50 MB)** |

Per-kind **extension + content-type allowlist + size cap** (the cap goes per-kind — 3D is tens of MB). One asset per `(part, kind)`; replace upserts in place, prior R2 object orphaned (same no-inline-delete policy as `PartDatasheet`).

## 4. Verify gate (high value here)
Reuse `UNVERIFIED → VERIFIED → FLAGGED`, **self-verify**, optimistic concurrency, `requireUser`. **VERIFIED = a human checked the asset against the datasheet** — footprint land pattern matches the recommended, symbol pins match, 3D model is the right package. Editing the file (`r2Key`) or `ref`/`source` **auto-demotes**. Provenance precondition for VERIFIED: at minimum **`source` present** (a stated basis). **A wrong footprint is a board respin**, so vetting once centrally — vs re-vetting per board — is the core payoff. *Deferred enhancement:* auto cross-check symbol pin count vs the `PINOUT` fact-group and footprint pad count → auto-`FLAG` mismatches.

## 5. UI
The part detail page gains an **"Assets"** section: one row per kind (**Symbol / Footprint / 3D Model**) alongside the existing **Datasheet**, each with an upload/replace control (generalize `DatasheetUpload` → `AssetUpload(kind, acceptedExts, cap)`), a trust badge + **Verify / Flag**, a download link (presigned GET), and inline **source / license / ref** fields. Reuse the `FactGroupCard` / `VerifyBadge` patterns.

## 6. Reuse / files
Generalize the `PartDatasheet` R2 actions into **shared helpers** (`createUploadUrl` / `record` / `getDownloadUrl` parameterized by kind + key prefix); reuse `r2.ts`, the CORS, the verify-gate action shape, the trust badge. **New:** a prisma migration (`PartAssetKind` + `PartAsset`), `src/lib/schemas/part-asset.ts`, `src/lib/actions/part-assets.ts`, `src/components/parts/{AssetUpload,AssetRow}.tsx`, the detail-page Assets section, and a pilot-part seed extension.

## 7. Deferred — the export (next phase) + MCP tie-in
**BOM → KiCad library export:** a generator that, given a project's BOM (the `bomFrozenAt` revision resolution from Stage A), reads each part's **VERIFIED** assets and emits the TB-1-POWER layout — a `<project>.pretty` (pooled `.kicad_mod`), per-part `.kicad_sym`, `.step`, **generated `fp-lib-table` + `sym-lib-table`** (`descr` from `ref`/`source`), `datasheets/`, zipped for download; warns/skips unverified. This is the headline payoff — sized as its own phase (the S-expression lib-table generation + bundling).
**MCP (Stage B):** `lookup_part` reports asset availability + verified state ("footprint: verified") for grounding.

## 8. Open items
- Per-kind size caps + content-type allowlist (esp. 3D); the larger PUT rides the CORS already set.
- `license` as free-text vs an enum of common licenses.
- `Part.footprint` (exists) vs `PartAsset.ref` for the footprint name — keep in sync, or treat `ref` as canonical.
- The export's handling of **stock-KiCad-lib parts** (no custom asset) — reference by lib id rather than bundling.
- Future: unify `PartDatasheet` into `PartAsset`; the auto cross-checks; SnapEDA/UL API import.
