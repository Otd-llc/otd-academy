# DigiKey Availability Watchdog — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Also: @superpowers:test-driven-development for the pure-logic tasks.

**Goal:** Continuously verify every library part is in stock + not EOL/Obsolete at DigiKey, and flag any that aren't — so a published board never sends a student to a dead BOM line.

**Architecture:** A nightly Vercel Cron hits a `CRON_SECRET`-guarded route that calls the DigiKey Product Information API per part and upserts a snapshot onto `Part` (+ an append-only `PartAvailabilityEvent` on material change). Pure assessors classify part/board buildability; the watchdog surfaces advisory (info-tier) in board-readiness, the dashboard, BOM chips, and the parts catalog. Storage = Neon Postgres (not Redis — see the design doc). Design: `docs/plans/2026-06-18-digikey-availability-watchdog-design.md`.

**Tech Stack:** Next.js (App Router) · Prisma + Neon Postgres · `@t3-oss/env-nextjs` · vitest · DigiKey Product Information API v4 (OAuth2 client-credentials).

**Hard constraints (read before starting):**
- `.env.local` `DATABASE_URL` is **PROD**. Migrations are hand-authored, applied with `pnpm exec prisma migrate deploy` (never `migrate dev`). Restart `next dev` after `prisma generate`. ([[prisma-migrate-prod]])
- After any schema change, run full `tsc` **and** the vitest suite. ([[schema-change-tsc-check]])
- **Never run two vitest processes at once** (corrupts the shared `esp32-sensor-breakout` fixture). DB-backed tests use **throwaway rows**. ([[test-seed-fixture]])
- `pnpm` runs via **PowerShell**, not the Bash tool.
- Branch is `feat/digikey-availability-watchdog` (off main). No merge without Josh's explicit go-ahead + local verification.

---

## Task 1: Schema — Part snapshot columns + `PartAvailabilityEvent`

**Files:**
- Modify: `prisma/schema.prisma` (Part model ~line 561; add a new model)
- Create: `prisma/migrations/20260618120000_digikey_availability/migration.sql`

**Step 1: Edit `prisma/schema.prisma` — add to `model Part` (after `notes`):**
```prisma
  // DigiKey availability snapshot (watchdog). DigiKey's OBSERVED status is kept
  // separate from the curated `lifecycle` so a divergence is itself a signal.
  dkStockQty        Int?
  dkUnitPriceCents  Int?
  dkInStock         Boolean?
  dkLifecycle       String?   // DigiKey ProductStatus.Status (Active/Obsolete/NRND/…)
  dkProductUrl      String?
  dkCheckedAt       DateTime?
  availabilityEvents PartAvailabilityEvent[]
```

**Step 2: Add the new model (after the `Part` model):**
```prisma
// Append-only watchdog feed — one row only when a part's availability changes
// materially (not every nightly check). `kind` is a free string (no enum mirror).
model PartAvailabilityEvent {
  id        String   @id @default(cuid())
  partId    String
  part      Part     @relation(fields: [partId], references: [id], onDelete: Cascade)
  kind      String   // WENT_OBSOLETE | WENT_OOS | BACK_IN_STOCK | LIFECYCLE_CHANGED | NO_MATCH
  fromValue String?
  toValue   String?
  createdAt DateTime @default(now())

  @@index([partId, createdAt])
  @@index([createdAt])
}
```

**Step 3: Write the migration SQL** (matches the repo's hand-authored style):
```sql
-- AlterTable
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "dkStockQty" INTEGER,
ADD COLUMN IF NOT EXISTS "dkUnitPriceCents" INTEGER,
ADD COLUMN IF NOT EXISTS "dkInStock" BOOLEAN,
ADD COLUMN IF NOT EXISTS "dkLifecycle" TEXT,
ADD COLUMN IF NOT EXISTS "dkProductUrl" TEXT,
ADD COLUMN IF NOT EXISTS "dkCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartAvailabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartAvailabilityEvent_partId_createdAt_idx" ON "PartAvailabilityEvent"("partId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartAvailabilityEvent_createdAt_idx" ON "PartAvailabilityEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PartAvailabilityEvent" ADD CONSTRAINT "PartAvailabilityEvent_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Step 4: Apply to prod + regenerate.**
Run (PowerShell): `pnpm exec prisma migrate deploy`
Expected: `Applying migration 20260618120000_digikey_availability` → success.
Run: `pnpm exec prisma generate`
Expected: client regenerated.

**Step 5: Typecheck.** Run: `pnpm exec tsc --noEmit` → exit 0.

**Step 6: Commit.**
```
git add prisma/schema.prisma prisma/migrations/20260618120000_digikey_availability/
git commit -m "feat(watchdog): Part DigiKey snapshot cols + PartAvailabilityEvent"
```

---

## Task 2: Env vars

**Files:** Modify `src/env.ts` (server block + runtimeEnv map)

**Step 1: Add to the `server: {}` block (near the affiliate vars; OPTIONAL so build/CI without keys still passes):**
```ts
    // DigiKey Product Information API v4 (parts availability watchdog). OPTIONAL:
    // the refresh job + watchdog UI degrade gracefully (no-op / "unknown") when unset.
    DIGIKEY_CLIENT_ID: z.string().optional(),
    DIGIKEY_CLIENT_SECRET: z.string().optional(),
    DIGIKEY_API_BASE: z.url().optional(), // default api.digikey.com; set to sandbox to test
    // Shared secret the Vercel cron sends as `Authorization: Bearer` to the refresh route.
    CRON_SECRET: z.string().optional(),
```

**Step 2: Add the same five keys to `runtimeEnv: {}`** (e.g. `DIGIKEY_CLIENT_ID: process.env.DIGIKEY_CLIENT_ID,` …).

**Step 3:** `pnpm exec tsc --noEmit` → exit 0.

**Step 4: Commit.** `git commit -am "feat(watchdog): env vars (DigiKey creds + CRON_SECRET)"`

---

## Task 3: DigiKey client — `src/lib/digikey.ts` (TDD)

**Files:** Create `src/lib/digikey.ts`; Test `src/lib/__tests__/digikey.test.ts`

The normalized shape:
```ts
export interface DkSnapshot {
  matched: boolean;
  stockQty: number | null;
  unitPriceCents: number | null;
  inStock: boolean | null;
  lifecycle: string | null;   // ProductStatus.Status
  productUrl: string | null;
}
```

**Step 1: Write the failing test** (mock `fetch`):
```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { normalizeDkProduct } from "@/lib/digikey";

afterEach(() => vi.restoreAllMocks());

describe("normalizeDkProduct", () => {
  test("maps the v4 product fields", () => {
    const snap = normalizeDkProduct({
      ManufacturerProductNumber: "SN74AHCT125DR",
      QuantityAvailable: 11173,
      UnitPrice: 0.9,
      ProductStatus: { Status: "Active" },
      ProductUrl: "https://www.digikey.com/x",
    }, "SN74AHCT125DR");
    expect(snap).toEqual({
      matched: true, stockQty: 11173, unitPriceCents: 90, inStock: true,
      lifecycle: "Active", productUrl: "https://www.digikey.com/x",
    });
  });
  test("zero stock → inStock false", () => {
    const snap = normalizeDkProduct({ ManufacturerProductNumber: "X", QuantityAvailable: 0, UnitPrice: 1 }, "X");
    expect(snap.inStock).toBe(false);
  });
});
```

**Step 2: Run → FAIL** (`normalizeDkProduct` not exported).
Run: `pnpm exec vitest run src/lib/__tests__/digikey.test.ts`

**Step 3: Implement `src/lib/digikey.ts`:**
```ts
import { env } from "@/env";

const BASE = env.DIGIKEY_API_BASE || "https://api.digikey.com";

export interface DkSnapshot {
  matched: boolean; stockQty: number | null; unitPriceCents: number | null;
  inStock: boolean | null; lifecycle: string | null; productUrl: string | null;
}

export function digikeyConfigured(): boolean {
  return Boolean(env.DIGIKEY_CLIENT_ID && env.DIGIKEY_CLIENT_SECRET);
}

export function normalizeDkProduct(p: any, mpn: string): DkSnapshot {
  if (!p) return { matched: false, stockQty: null, unitPriceCents: null, inStock: null, lifecycle: null, productUrl: null };
  const qty = typeof p.QuantityAvailable === "number" ? p.QuantityAvailable : null;
  const price = typeof p.UnitPrice === "number" ? Math.round(p.UnitPrice * 100) : null;
  return {
    matched: true,
    stockQty: qty,
    unitPriceCents: price,
    inStock: qty == null ? null : qty > 0,
    lifecycle: p.ProductStatus?.Status ?? (typeof p.ProductStatus === "string" ? p.ProductStatus : null),
    productUrl: p.ProductUrl ?? null,
  };
}

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DIGIKEY_CLIENT_ID!, client_secret: env.DIGIKEY_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`DigiKey OAuth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface DkClient { searchByMpn(mpn: string): Promise<DkSnapshot>; }

export async function makeDigikeyClient(): Promise<DkClient> {
  const token = await getToken();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  return {
    async searchByMpn(mpn: string): Promise<DkSnapshot> {
      const res = await fetch(`${BASE}/products/v4/search/keyword`, {
        method: "POST",
        headers: {
          "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID!, authorization: `Bearer ${token}`,
          "content-type": "application/json", accept: "application/json",
          "X-DIGIKEY-Locale-Site": "US", "X-DIGIKEY-Locale-Language": "en", "X-DIGIKEY-Locale-Currency": "USD",
        },
        body: JSON.stringify({ Keywords: mpn, RecordCount: 5 }),
      });
      if (!res.ok) throw new Error(`DigiKey search ${res.status}`);
      const json = (await res.json()) as { Products?: any[] };
      const products = json.Products ?? [];
      const match = products.find((p) => norm(p?.ManufacturerProductNumber ?? "") === norm(mpn)) ?? products[0];
      return normalizeDkProduct(match, mpn);
    },
  };
}
```

**Step 4: Run → PASS.** **Step 5: Commit.** `git add -A && git commit -m "feat(watchdog): DigiKey API client + normalizer"`

> Note: `scripts/digikey-stock.ts` already proved this exact request/response mapping against a live key — keep them consistent.

---

## Task 4: Pure assessor — `src/lib/part-availability.ts` (TDD)

**Files:** Create `src/lib/part-availability.ts`; Test `src/lib/__tests__/part-availability.test.ts`

**Step 1: Failing test:**
```ts
import { describe, expect, test } from "vitest";
import { assessPartAvailability, countUnbuildable } from "@/lib/part-availability";

const base = { dkInStock: true, dkLifecycle: "Active", dkCheckedAt: new Date(), curatedLifecycle: "ACTIVE" };
const NOW = new Date("2026-06-18T00:00:00Z");

describe("assessPartAvailability", () => {
  test("in stock + active → OK", () => {
    expect(assessPartAvailability({ ...base, dkCheckedAt: NOW }, NOW).status).toBe("OK");
  });
  test("zero stock → OUT_OF_STOCK", () => {
    expect(assessPartAvailability({ ...base, dkInStock: false, dkCheckedAt: NOW }, NOW).status).toBe("OUT_OF_STOCK");
  });
  test("obsolete DK status → OBSOLETE", () => {
    expect(assessPartAvailability({ ...base, dkLifecycle: "Obsolete", dkCheckedAt: NOW }, NOW).status).toBe("OBSOLETE");
  });
  test("curated ACTIVE but DK Obsolete still flags OBSOLETE (divergent is unbuildable)", () => {
    const r = assessPartAvailability({ ...base, dkLifecycle: "Obsolete", dkCheckedAt: NOW }, NOW);
    expect(r.buildable).toBe(false);
  });
  test("never checked → UNKNOWN, not buildable-blocking", () => {
    expect(assessPartAvailability({ ...base, dkCheckedAt: null }, NOW).status).toBe("UNKNOWN");
  });
  test("countUnbuildable counts OOS/EOL/Obsolete", () => {
    const lines = [
      { dkInStock: true, dkLifecycle: "Active", dkCheckedAt: NOW, curatedLifecycle: "ACTIVE" },
      { dkInStock: false, dkLifecycle: "Active", dkCheckedAt: NOW, curatedLifecycle: "ACTIVE" },
    ];
    expect(countUnbuildable(lines, NOW)).toBe(1);
  });
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement `src/lib/part-availability.ts`:**
```ts
export type AvailabilityStatus =
  | "OK" | "OUT_OF_STOCK" | "EOL_NRND" | "OBSOLETE" | "DIVERGENT" | "STALE" | "UNKNOWN";

export interface AvailabilityInput {
  dkInStock: boolean | null;
  dkLifecycle: string | null;
  dkCheckedAt: Date | null;
  curatedLifecycle: string; // Part.lifecycle enum value
}
const STALE_DAYS = 7;
function isDead(dk: string | null): boolean {
  if (!dk) return false;
  const s = dk.toLowerCase();
  return s.includes("obsolete") || s.includes("discontinued") || s.includes("not recommended") || s.includes("last time buy") || s.includes("end of life");
}

export function assessPartAvailability(i: AvailabilityInput, now: Date): { status: AvailabilityStatus; buildable: boolean } {
  if (i.dkCheckedAt == null) return { status: "UNKNOWN", buildable: true }; // not yet checked → don't block
  const ageDays = (now.getTime() - i.dkCheckedAt.getTime()) / 86_400_000;
  if (ageDays > STALE_DAYS) return { status: "STALE", buildable: true };
  const dk = (i.dkLifecycle ?? "").toLowerCase();
  if (dk.includes("obsolete")) return { status: "OBSOLETE", buildable: false };
  if (isDead(i.dkLifecycle)) return { status: "EOL_NRND", buildable: false };
  if (i.dkInStock === false) return { status: "OUT_OF_STOCK", buildable: false };
  if (i.curatedLifecycle === "ACTIVE" && isDead(i.dkLifecycle)) return { status: "DIVERGENT", buildable: false };
  return { status: "OK", buildable: true };
}

export function countUnbuildable(lines: AvailabilityInput[], now: Date): number {
  return lines.filter((l) => !assessPartAvailability(l, now).buildable).length;
}
```

**Step 4: Run → PASS.** **Step 5: Commit.** `git commit -am "feat(watchdog): part-availability assessor"`

---

## Task 5: Wire into board-readiness (TDD)

**Files:** Modify `src/lib/board-readiness.ts`, `src/lib/board-readiness-load.ts`; Test `src/lib/__tests__/board-readiness.test.ts` (extend)

**Step 1: Test the new info check:**
```ts
test("unbuildable parts → info check fails, does NOT gate ready", () => {
  const r = assessBoardReadiness({ ...readyInput, unbuildablePartCount: 2 });
  const chk = r.checks.find((c) => c.label === "Parts buildable now");
  expect(chk?.tier).toBe("info");
  expect(chk?.ok).toBe(false);
  expect(r.ready).toBe(true); // info-tier doesn't gate in v1
});
```
(`readyInput` = an all-required-pass input; add `unbuildablePartCount: 0` to the existing fixtures so they still compile.)

**Step 2:** Add `unbuildablePartCount: number;` to `BoardReadinessInput`, and after the "Cost" info check in `assessBoardReadiness`:
```ts
  checks.push({
    label: "Parts buildable now",
    tier: "info",
    ok: input.unbuildablePartCount === 0,
    detail: input.unbuildablePartCount > 0 ? `${input.unbuildablePartCount} part(s) out-of-stock/EOL at DigiKey` : "all parts in stock at DigiKey",
  });
```

**Step 3:** In `board-readiness-load.ts`: extend `BoardReadinessRows.bomLines[].part` to include the dk snapshot fields + `lifecycle`, import `countUnbuildable`, and pass `unbuildablePartCount: countUnbuildable(rows.bomLines.map(l => ({ dkInStock: l.part.dkInStock, dkLifecycle: l.part.dkLifecycle, dkCheckedAt: l.part.dkCheckedAt, curatedLifecycle: l.part.lifecycle })), new Date())`. Update every caller's Prisma `select` to fetch the four dk fields + `lifecycle`.

**Step 4:** `pnpm exec vitest run src/lib/__tests__/board-readiness.test.ts` → PASS. Then `pnpm exec tsc --noEmit` (catches every caller needing `unbuildablePartCount`).

**Step 5: Commit.** `git commit -am "feat(watchdog): board-readiness 'Parts buildable now' info check"`

---

## Task 6: Refresh logic — `src/lib/refresh-availability.ts` (TDD, injectable client)

**Files:** Create `src/lib/refresh-availability.ts`; Test `src/lib/__tests__/refresh-availability.test.ts` (DB-backed; throwaway parts)

`refreshAvailability({ db, client, limit, now })` — selects up to `limit` parts (oldest `dkCheckedAt` first, nulls first), calls `client.searchByMpn`, upserts the snapshot, and writes a `PartAvailabilityEvent` when the buildable classification flips (compare prior snapshot vs new via `assessPartAvailability`). Returns `{ checked, changed }`.

**Step 1: Test** (create 1 throwaway part with a borrowed `createdById`; inject a stub client returning OOS; assert snapshot written + a `WENT_OOS` event; cleanup in `afterAll`). Mirror the throwaway-row + cleanup pattern in `stages-actions.test.ts`. Single vitest process.

**Step 2: Run → FAIL. Step 3: Implement** (loop, `db.part.update` the dk fields + `dkCheckedAt: now`; if prior `buildable` !== new `buildable` or lifecycle changed, `db.partAvailabilityEvent.create`). Keep it client-injectable so tests never hit the network.

**Step 4: Run → PASS** (single process). **Step 5: Commit.** `git commit -am "feat(watchdog): refreshAvailability job body"`

---

## Task 7: Cron route + `vercel.json`

**Files:** Create `src/app/api/cron/refresh-availability/route.ts`, `vercel.json`; Test `src/lib/__tests__/refresh-route.test.ts` (or a route test mocking the lib)

**Step 1: Route** (model: `src/app/api/stripe/webhook/route.ts`):
```ts
import { env } from "@/env";
import { db } from "@/lib/db";
import { digikeyConfigured, makeDigikeyClient } from "@/lib/digikey";
import { refreshAvailability } from "@/lib/refresh-availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!digikeyConfigured()) {
    return Response.json({ ok: true, skipped: "digikey not configured" });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const client = await makeDigikeyClient();
  const result = await refreshAvailability({ db, client, limit, now: new Date() });
  return Response.json({ ok: true, ...result });
}
```

**Step 2: `vercel.json`** (daily 07:00 UTC):
```json
{ "crons": [{ "path": "/api/cron/refresh-availability", "schedule": "0 7 * * *" }] }
```
(Note: Vercel automatically sends the `Authorization: Bearer $CRON_SECRET` header for cron invocations when `CRON_SECRET` is set in project env — confirm this in the Vercel dashboard during deploy.)

**Step 3: Test** the guard — 401 without/with-wrong secret, `skipped` when creds absent (mock `digikeyConfigured`→false). **Step 4:** `pnpm exec tsc --noEmit`. **Step 5: Commit.** `git commit -am "feat(watchdog): cron route + vercel.json"`

---

## Task 8: Surfacing — BOM chips (admin + public)

**Files:** Modify `src/components/guide/GuideBlocks.tsx` (`BomRow` ~47-60, after `LifecycleBadge` ~248) and `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx` (~487). Update the routes that build `BomRow`/load BomLines to `select` the dk fields.

**Step:** Add a small `DkAvailabilityBadge({ inStock, lifecycle, checkedAt })` (green "in stock", amber "low/—", red "OOS"/"obsolete", grey "unchecked") rendered next to the existing lifecycle chip in both. Reuse `assessPartAvailability` for the label. tsc. Manual verify in the BOM editor + a guide page. Commit.

---

## Task 9: Surfacing — parts catalog column

**Files:** Modify `src/app/parts/page.tsx` (column after Lifecycle ~213), `src/lib/parts-list.ts` (`listParts` select + return type), `src/components/parts/PartCard.tsx` (mobile).

**Step:** Add a "DigiKey" column: stock qty + status badge + relative `dkCheckedAt` ("2h ago"/"never"). tsc. Manual verify `/parts`. Commit.

---

## Task 10: Surfacing — dashboard "unbuildable parts" pill

**Files:** Modify `src/app/page.tsx` (`PipelineBadges` ~90; per-project compute ~211-243).

**Step:** In the dashboard's per-project load, count unbuildable parts across the published revision's BOM (reuse `countUnbuildable`); render a red `⚠ N unbuildable` chip in `PipelineBadges` when > 0. tsc. Manual verify the dashboard. Commit.

---

## Task 11: Backfill + verify against known truth

**Step 1:** With the real key in `.env.local`, run the refresh once locally against prod:
`pnpm exec tsx -e "..."` (or temporarily call `refreshAvailability` from a tiny `scripts/_refresh-once.ts`, gitignored).
**Step 2:** Confirm the l1-03 parts got snapshots and the watchdog flags match the known truth: **U3 → Obsolete, C1 / C10 / D3 → out-of-stock**; the rest OK. Confirm board-readiness for l1-03 shows the info-tier "Parts buildable now" failing with the right count, and the dashboard pill appears.
**Step 3:** Full `tsc` + full vitest suite (single process) green.
**Step 4: Final commit + push the branch.** Open a PR for Josh's local verification (do NOT merge).

---

## Verification checklist (definition of done)
- [ ] Migration applied to prod; `tsc` + full vitest green.
- [ ] `digikey.ts` + `part-availability.ts` + `refresh-availability.ts` unit-tested.
- [ ] Cron route 401-guards + no-ops without creds; `vercel.json` cron present.
- [ ] board-readiness info check + dashboard pill + BOM chips + catalog column render.
- [ ] Backfill reproduces the known U3/C1/C10/D3 verdicts.
- [ ] Branch pushed, PR opened, NOT merged.
