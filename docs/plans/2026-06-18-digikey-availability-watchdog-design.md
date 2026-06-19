# DigiKey Availability Watchdog — design

> Status: design (brainstormed + validated 2026-06-18). v1 = the watchdog;
> learner-facing display + alerts are deferred fast-follows on the same foundation.

## Goal

Keep every published board **buildable**: continuously verify that each part in the
library is in stock and not EOL/Obsolete at **DigiKey** (the chosen parts distributor),
and surface any part that goes out-of-stock / NRND / EOL / Obsolete to operators before a
student hits a dead BOM line. This upgrades us from "we *authored* a BOM" to "we
*continuously guarantee* a buildable BOM" — the direct enforcement of the student-UX-first
decision. It replaces the 403-prone web scrape with the real DigiKey Product Information
API (proven in `scripts/digikey-stock.ts`).

## Locked decisions (from brainstorming)

- **Storage = Postgres** (Neon). Small, durable, relational, slowly-changing data that
  joins with `Part`/`BomLine`. **Not Redis** — no per-request live calls to cache; the
  only Redis-worthy case (a shared rate-limit token-bucket for high-concurrency *live*
  lookups) is designed out by the scheduled-refresh model.
- **v1 scope = the watchdog** (admin-facing). Learner-facing live BOM display is a
  fast-follow on the same cached data.
- **Refresh = Vercel Cron → guarded API route**, native to the app's host (no cron infra
  exists yet). Daily; chunked to respect the serverless timeout + the ~1k/day API quota.

## Schema (Postgres)

**Snapshot columns on `Part`** (current state, for fast joins/reads):
- `dkStockQty Int?`, `dkUnitPriceCents Int?`, `dkInStock Boolean?`
- `dkLifecycle String?` — DigiKey's *observed* status (Active / Obsolete / NRND /
  Discontinued / Last-Time-Buy). **Kept separate from the human-curated `Part.lifecycle`**
  so a divergence ("we say ACTIVE, DigiKey says Obsolete") is itself a watchdog signal.
- `dkProductUrl String?`, `dkCheckedAt DateTime?`

**`PartAvailabilityEvent`** (append-only; written **only on a material change**, not every
check):
- `id`, `partId` (FK), `kind` (e.g. `WENT_OBSOLETE`, `WENT_OOS`, `BACK_IN_STOCK`,
  `LIFECYCLE_CHANGED`, `NO_MATCH`), `fromValue String?`, `toValue String?`, `createdAt`.
- This is the watchdog feed + audit trail without storing every nightly snapshot.

Hand-authored migration, `prisma migrate deploy` (`.env.local` `DIRECT_URL` = PROD).

## DigiKey client (`src/lib/digikey.ts`)

Extracted from the proven script:
- OAuth2 **client-credentials** token fetch (token ~30 min; cache in-memory per run).
- `searchByMpn(mpn)` → normalized `{ stockQty, unitPriceCents, lifecycle, inStock,
  productUrl, matched }` from `Products[0]` (`QuantityAvailable` / `UnitPrice` /
  `ProductStatus.Status` / `ManufacturerProductNumber`).
- Reads `DIGIKEY_CLIENT_ID/SECRET` from `env.ts` (optional-with-skip).
- Surfaces the response rate-limit headers so the caller can budget.

## Refresh job

- **`vercel.json`** daily cron (e.g. `0 7 * * *` UTC) → `GET /api/cron/refresh-availability`.
- **Guard:** `CRON_SECRET` (Bearer header / Vercel cron header); 401 otherwise.
- **Work:** select parts oldest-`dkCheckedAt` first, up to a per-run `limit` (chunk for
  the serverless timeout); for each → `searchByMpn` → upsert snapshot on `Part`; if the
  classification changed materially, write a `PartAvailabilityEvent`.
- **Quota:** log remaining rate-limit; stop early + resume next run if near the cap. At
  ~dozens of parts this is one trivial run; the chunking is what scales it.
- No-ops cleanly (logs + 200) if DigiKey creds are absent.

## Watchdog assessor (pure, DB-free)

Mirrors `assessBomSourcing` / `assessBoardReadiness`.
- `assessPartAvailability(snapshot, curatedLifecycle, now)` → one of `OK` /
  `OUT_OF_STOCK` / `EOL_NRND` / `OBSOLETE` / `DIVERGENT` / `STALE` (no check in N days) /
  `UNKNOWN` (no DigiKey match).
- Board-level **"buildable now"** = every BomLine's part is in-stock AND not EOL/Obsolete.

## Surfacing (admin-facing, v1)

- **Board-readiness (WS4):** new **info-tier** "Parts buildable now" check in
  `assessBoardReadiness` (advisory in v1, not a hard gate; upgradeable later).
- **Operator dashboard:** a "⚠ N boards have unbuildable parts" pill (reuse the existing
  pipeline-pills pattern).
- **BOM editor / `bomTable`:** extend the #140 NRND/EOL chips to show live DK stock + the
  availability flag per line (inline U3/C1/C10/D3-type visibility).
- **Parts catalog:** a DK stock / lifecycle / last-checked column.

## Config

- `env.ts`: `DIGIKEY_CLIENT_ID`, `DIGIKEY_CLIENT_SECRET`, `CRON_SECRET` (all optional; the
  job + UI degrade gracefully when absent). Creds already in `.env.local`.

## Testing

- Pure **assessor** unit tests (snapshot → classification; no DB/API).
- DigiKey client with **mocked `fetch`** (token + search; rate-limit-header handling).
- Cron route with a **mocked client** + **throwaway parts** — never the shared
  `esp32-sensor-breakout` fixture; single vitest process ([[test-seed-fixture]]).
- Full `tsc` + suite after the schema change ([[schema-change-tsc-check]]).

## Out of scope (v1) — fast-follows on the same foundation

Learner-facing live BOM display (price/stock/total + the keyless MyLists "add whole BOM to
cart" button) · email/push alerts · part-creation auto-enrich (description / datasheet /
category / lifecycle from MPN) · second-source / `altMpn` suggestions · datasheet
auto-fill · full per-check history.

## Rollout (incremental tasks)

1. Migration (Part snapshot cols + `PartAvailabilityEvent`) + `env.ts` vars.
2. `src/lib/digikey.ts` client (+ mocked tests).
3. `assessPartAvailability` + board "buildable now" (+ unit tests).
4. `/api/cron/refresh-availability` route + `vercel.json` (+ route test).
5. Surfacing: board-readiness check → dashboard pill → BOM chips → catalog column.
6. Backfill run + verify against l1-03's known U3/C1/C10/D3 results.
