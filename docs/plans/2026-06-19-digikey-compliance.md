# DigiKey Compliance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring our cached DigiKey data and datasheet links into clean compliance with the DigiKey API User Agreement — add an on-demand purge of all DigiKey Data, make the public BOM degrade cleanly + attributed when no snapshot exists, switch price lookups to the real-time ProductDetails endpoint, and repoint distributor-mirror datasheet URLs to manufacturer-hosted PDFs.

**Architecture:** Four independent work items from [the design doc](./2026-06-19-digikey-compliance-design.md). Each follows the repo's split-seam pattern: a pure/testable function in `src/lib/*` (unit-tested with vitest) plus a thin wrapper (script or JSX) verified manually. No new tables; the cached footprint is `Part.dk*` + `PartAvailabilityEvent`.

**Tech Stack:** Next.js (App Router, server components), Prisma + Neon Postgres, Zod, vitest, `tsx` for scripts, the DigiKey Product Information v4 API.

**Critical environment facts (read before running anything):**
- `.env.local` `DATABASE_URL` is **PROD Neon**. Vitest and `tsx` scripts mutate production. **Never run two vitest processes at once.** DB-backed tests use **throwaway rows only** — never the shared `esp32-sensor-breakout` fixture. (@superpowers:testing-anti-patterns)
- Run commands in **PowerShell**, not the Bash tool. `pnpm` works in PowerShell; `pnpm` via the Bash tool exits 127.
- No merge without the maintainer's explicit go-ahead. Branch is already `feat/learner-live-bom`.
- TDD throughout: write the failing test, watch it fail, minimal code to pass. (@superpowers:test-driven-development)

---

## Task 1: `purgeDigikeyData` — the purge function (Work item 1)

The agreement requires deleting "all DigiKey Data in your possession or control." This is the one capability we lack. Mirror the `refresh-availability.ts` lib/wrapper split: a testable function here, a guarded script in Task 2.

**Files:**
- Create: `src/lib/purge-digikey-data.ts`
- Test: `src/lib/__tests__/purge-digikey-data.test.ts`

**Step 1: Write the failing test**

```typescript
// DB-backed (PROD Neon via .env.local) — THROWAWAY rows only, never the shared
// esp32-sensor-breakout fixture. Single vitest process. ([[test-seed-fixture]])
import { afterAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { purgeDigikeyData } from "@/lib/purge-digikey-data";

const TEST_MFR = "T-Purge-TestCo";
const createdPartIds: string[] = [];

afterAll(async () => {
  await db.partAvailabilityEvent.deleteMany({ where: { partId: { in: createdPartIds } } });
  await db.part.deleteMany({ where: { id: { in: createdPartIds } } });
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } });
});

describe("purgeDigikeyData", () => {
  test("nulls every dk* field and deletes derived availability events", async () => {
    const seedUser = await db.user.findFirstOrThrow();
    const part = await db.part.create({
      data: {
        manufacturer: TEST_MFR,
        mpn: `PURGE-${Date.now()}`,
        description: "purge throwaway",
        createdById: seedUser.id,
        dkStockQty: 100,
        dkUnitPriceCents: 150,
        dkInStock: true,
        dkLifecycle: "Active",
        dkProductUrl: "https://www.digikey.com/x",
        dkPartNumber: "311-10.0KCRCT-ND",
        dkCheckedAt: new Date(),
      },
    });
    createdPartIds.push(part.id);
    await db.partAvailabilityEvent.create({
      data: { partId: part.id, kind: "WENT_OOS", fromValue: "in stock", toValue: "out of stock" },
    });

    const result = await purgeDigikeyData(db, { partIds: [part.id] });
    expect(result.partsCleared).toBe(1);
    expect(result.eventsDeleted).toBe(1);

    const after = await db.part.findUniqueOrThrow({ where: { id: part.id } });
    expect(after.dkStockQty).toBeNull();
    expect(after.dkUnitPriceCents).toBeNull();
    expect(after.dkInStock).toBeNull();
    expect(after.dkLifecycle).toBeNull();
    expect(after.dkProductUrl).toBeNull();
    expect(after.dkPartNumber).toBeNull();
    expect(after.dkCheckedAt).toBeNull();
    const events = await db.partAvailabilityEvent.findMany({ where: { partId: part.id } });
    expect(events).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run (PowerShell): `pnpm exec vitest run src/lib/__tests__/purge-digikey-data.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/purge-digikey-data"`.

**Step 3: Write minimal implementation**

```typescript
// src/lib/purge-digikey-data.ts
import type { PrismaClient } from "@prisma/client";

export interface PurgeArgs {
  // Optional scope: restrict to these part ids (tests / targeted purge). Omitted
  // → the whole library (the offboarding case).
  partIds?: string[];
}

export interface PurgeResult {
  partsCleared: number;
  eventsDeleted: number;
}

// Delete all DigiKey Data: null every cached dk* snapshot column on Part and
// remove the derived PartAvailabilityEvent log. Satisfies the API User
// Agreement's "delete all DigiKey Data in your possession or control" clause.
// One transaction so a partial purge can't leave events orphaned from a cleared
// Part. Idempotent — a second run clears 0/0.
export async function purgeDigikeyData(
  db: PrismaClient,
  args: PurgeArgs = {},
): Promise<PurgeResult> {
  const partWhere = args.partIds ? { id: { in: args.partIds } } : {};
  const eventWhere = args.partIds ? { partId: { in: args.partIds } } : {};

  return db.$transaction(async (tx) => {
    const events = await tx.partAvailabilityEvent.deleteMany({ where: eventWhere });
    const parts = await tx.part.updateMany({
      where: partWhere,
      data: {
        dkStockQty: null,
        dkUnitPriceCents: null,
        dkInStock: null,
        dkLifecycle: null,
        dkProductUrl: null,
        dkPartNumber: null,
        dkCheckedAt: null,
      },
    });
    return { partsCleared: parts.count, eventsDeleted: events.count };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/purge-digikey-data.test.ts`
Expected: PASS (1 test).

**Step 5: Commit**

```powershell
git add src/lib/purge-digikey-data.ts src/lib/__tests__/purge-digikey-data.test.ts
git commit -m "feat(compliance): purgeDigikeyData — clear all cached DigiKey Data"
```

---

## Task 2: `scripts/purge-digikey-data.ts` — guarded CLI wrapper (Work item 1)

Thin script around Task 1's function, with a prod-safety guard (the DB is PROD). Dry-run by default; requires `--confirm` to execute.

**Files:**
- Create: `scripts/purge-digikey-data.ts`

**Step 1: Write the script**

```typescript
// One-shot DigiKey offboarding: clears all cached DigiKey Data (Part.dk* +
// PartAvailabilityEvent) per the API User Agreement deletion clause. Direct-Prisma
// (server actions can't be scripted — [[foundry-headless-scripting]]).
//
// ⚠️ `.env.local` DATABASE_URL is PROD. This script wipes production dk* data.
// Dry-run by default; pass --confirm to execute.
//
//   Dry run:  pnpm exec tsx scripts/purge-digikey-data.ts
//   Execute:  pnpm exec tsx scripts/purge-digikey-data.ts --confirm
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { purgeDigikeyData } from "../src/lib/purge-digikey-data";

async function main() {
  const confirm = process.argv.includes("--confirm");
  const db = new PrismaClient();
  try {
    const host = (process.env.DATABASE_URL ?? "").replace(/.*@/, "").replace(/\/.*/, "");
    const [parts, events] = await Promise.all([
      db.part.count({ where: { dkCheckedAt: { not: null } } }),
      db.partAvailabilityEvent.count(),
    ]);
    console.log(`Target DB host: ${host}`);
    console.log(`Would clear ${parts} checked part(s) + delete ${events} availability event(s).`);

    if (!confirm) {
      console.log("\nDRY RUN — no changes. Re-run with --confirm to execute.");
      return;
    }

    const result = await purgeDigikeyData(db);
    console.log(`\nPurged: ${result.partsCleared} parts cleared, ${result.eventsDeleted} events deleted.`);
    console.log("Now redeploy so the public BOM re-renders without snapshot data.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Step 2: Verify the dry run (no changes)**

Run: `pnpm exec tsx scripts/purge-digikey-data.ts`
Expected: prints the prod host + a "Would clear N … DRY RUN" summary. **Do not pass `--confirm`** — we are not actually purging prod now; this is a capability, run only at offboarding.

**Step 3: Commit**

```powershell
git add scripts/purge-digikey-data.ts
git commit -m "feat(compliance): guarded purge-digikey-data offboarding script"
```

---

## Task 3: Gate the price columns + cart on snapshot presence (Work item 2 / validation fix)

Validation found the Unit $ / Ext. $ columns render empty "—" cells even with zero snapshots, so a purged BOM isn't display-clean. Add a tested helper and gate the price columns (and the add-to-cart button) on "any row has a snapshot."

**Files:**
- Modify: `src/lib/live-bom-cost.ts` (add helper)
- Test: `src/lib/__tests__/live-bom-cost.test.ts` (add cases)
- Modify: `src/components/guide/GuideBlocks.tsx:286-332` (gate headers + cells), and the add-to-cart button below the table

**Step 1: Write the failing test** (append to `live-bom-cost.test.ts`)

```typescript
import { bomTableHasDkData } from "@/lib/live-bom-cost";

describe("bomTableHasDkData", () => {
  test("true when any row has a dkCheckedAt snapshot", () => {
    expect(bomTableHasDkData([{ dkCheckedAt: null }, { dkCheckedAt: new Date() }])).toBe(true);
  });
  test("false when no row was ever checked (post-purge / creds absent)", () => {
    expect(bomTableHasDkData([{ dkCheckedAt: null }, { dkCheckedAt: null }])).toBe(false);
  });
  test("false on an empty table", () => {
    expect(bomTableHasDkData([])).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/live-bom-cost.test.ts`
Expected: FAIL — `bomTableHasDkData is not exported`.

**Step 3: Write minimal implementation** (append to `src/lib/live-bom-cost.ts`)

```typescript
// True when at least one BOM row carries a DigiKey snapshot (dkCheckedAt set).
// Drives whether the public BOM shows the price columns / cart button — so a
// purged or never-checked library renders the bare parts list. ([[digikey-availability-watchdog]])
export function bomTableHasDkData(rows: { dkCheckedAt: Date | null }[]): boolean {
  return rows.some((r) => r.dkCheckedAt != null);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/live-bom-cost.test.ts`
Expected: PASS (all cases).

**Step 5: Wire the gate in `GuideBlocks.tsx`**

After the `cost` computation (~line 272) add:

```tsx
  const tableHasDk = bomTableHasDkData(rows);
```

Import it: add `bomTableHasDkData` to the existing `import { liveBomCost } from "@/lib/live-bom-cost";` line.

Gate the two header cells (currently lines 292-293):

```tsx
            {tableHasDk ? (
              <>
                <th>Unit $</th>
                <th>Ext. $</th>
              </>
            ) : null}
```

Gate the two price `<td>`s (currently lines 325-332):

```tsx
              {tableHasDk ? (
                <>
                  <td data-label="Unit $" className="text-muted">
                    {r.dkUnitPriceCents != null ? formatUsd(r.dkUnitPriceCents) : "—"}
                  </td>
                  <td data-label="Ext. $" className="text-muted">
                    {r.dkUnitPriceCents != null ? formatUsd(r.qty * r.dkUnitPriceCents) : "—"}
                  </td>
                </>
              ) : null}
```

Find the **"Add whole BOM to DigiKey cart"** button rendered below the `<table>` (uses `fastAddUrl`) and wrap its render in `{tableHasDk ? ( … ) : null}` so a snapshot-less BOM shows no cart action. (The `cost.anyPriced` total block is already gated — leave it.)

**Step 6: Render-verify** (do NOT trust the DB write alone — @[[guide-content-render-verify]])

Start the dev server detached so it survives the next tool call (@[[dev-server-detached-launch]]):
`Start-Process pnpm.cmd -ArgumentList 'dev' -WindowStyle Hidden`
Load the public L1.01 lesson BOM stage and confirm: with snapshots present, the Unit $/Ext $ columns + cart still show. (Post-purge degradation is covered by Task 1's data + this gate; spot-check by temporarily viewing a revision with no checked parts if available.)

**Step 7: Commit**

```powershell
git add src/lib/live-bom-cost.ts src/lib/__tests__/live-bom-cost.test.ts src/components/guide/GuideBlocks.tsx
git commit -m "fix(live-bom): gate price columns + cart on snapshot presence (clean post-purge render)"
```

---

## Task 4: DigiKey attribution + load-bearing caveat (Work item 2)

Keep the cached display squarely inside "present DigiKey Data on Your Site": add an explicit attribution line and a comment marking the freshness caveat as compliance-load-bearing.

**Files:**
- Modify: `src/components/guide/GuideBlocks.tsx` (footer near the cost block, ~lines 358-376)

**Step 1: Add the attribution line + caveat comment**

Immediately above the `{cost.anyPriced ? (` block, add a comment:

```tsx
      {/* Compliance (load-bearing): the freshness "prices as of" line + this
          DigiKey attribution keep the cached snapshot display inside the API
          User Agreement's "present DigiKey Data on Your Site" grant. Do not
          remove. See docs/plans/2026-06-19-digikey-compliance-design.md. */}
```

Inside the existing `cost.anyPriced` footer `<div>`, after the "prices as of" span, add:

```tsx
          {tableHasDk ? (
            <span className="w-full text-muted normal-case">
              Pricing &amp; stock data via DigiKey.
            </span>
          ) : null}
```

**Step 2: Render-verify**

With the dev server up, reload the L1.01 BOM stage and confirm "Pricing & stock data via DigiKey." renders beneath the cost total. (Load the PAGE — @[[guide-content-render-verify]].)

**Step 3: Commit**

```powershell
git add src/components/guide/GuideBlocks.tsx
git commit -m "feat(compliance): DigiKey attribution + load-bearing freshness caveat on public BOM"
```

---

## Task 5: Switch price lookups to ProductDetails (Work item 3)

DigiKey's FAQ: "Keyword search data is cached and may be up to 24 hours stale. Please use ProductDetails for real time pricing and availability." We already harvest `dkPartNumber` from the keyword search, so we can resolve once and pull live price/stock from ProductDetails — better accuracy and a cleaner "we display current data" posture.

**Endpoint (confirmed):** `GET {BASE}/products/v4/search/{productNumber}/productdetails`, same headers as the keyword search. Response wraps a single product under `Product` (v4). **Verify the exact wrapper key against the Swagger file at developer.digikey.com before finalizing** — if it differs, adjust the one `json.Product` access; `normalizeDkProduct` maps the inner fields unchanged.

**Files:**
- Modify: `src/lib/digikey.ts`
- Test: `src/lib/__tests__/digikey.test.ts` (add a `searchByMpn` case)

**Step 1: Write the failing test** (append inside the `describe("searchByMpn")` block)

```typescript
  test("uses ProductDetails (real-time) for price/stock when a DK part number resolves", async () => {
    const keywordBody = {
      Products: [
        {
          ManufacturerProductNumber: "SN74AHCT125DR",
          QuantityAvailable: 1, // stale keyword value
          UnitPrice: 9.99,
          ProductStatus: { Status: "Active" },
          ProductVariations: [{ DigiKeyProductNumber: "296-XYZ-ND", MinimumOrderQuantity: 1 }],
        },
      ],
    };
    const detailsBody = {
      Product: {
        ManufacturerProductNumber: "SN74AHCT125DR",
        QuantityAvailable: 4242, // fresh ProductDetails value
        UnitPrice: 1.23,
        ProductStatus: { Status: "Active" },
        ProductUrl: "https://www.digikey.com/fresh",
        ProductVariations: [{ DigiKeyProductNumber: "296-XYZ-ND", MinimumOrderQuantity: 1 }],
      },
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(keywordBody), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detailsBody), { status: 200, headers: { "content-type": "application/json" } }));

    const client = await makeDigikeyClient();
    const snap = await client.searchByMpn("SN74AHCT125DR");
    expect(snap.stockQty).toBe(4242);
    expect(snap.unitPriceCents).toBe(123);
    expect(snap.productUrl).toBe("https://www.digikey.com/fresh");
  });

  test("falls back to the keyword snapshot when ProductDetails is unavailable", async () => {
    const keywordBody = {
      Products: [
        {
          ManufacturerProductNumber: "X",
          QuantityAvailable: 7,
          UnitPrice: 2,
          ProductStatus: { Status: "Active" },
          ProductVariations: [{ DigiKeyProductNumber: "296-XYZ-ND", MinimumOrderQuantity: 1 }],
        },
      ],
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(keywordBody), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));

    const client = await makeDigikeyClient();
    const snap = await client.searchByMpn("X");
    expect(snap.stockQty).toBe(7); // keyword fallback, no throw
  });
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/digikey.test.ts`
Expected: FAIL — the new tests get the keyword values (1 / 999) because ProductDetails isn't called yet.

**Step 3: Implement** in `src/lib/digikey.ts` — after the keyword match resolves a snapshot, if it has a `partNumber`, fetch ProductDetails and prefer it; on any non-OK / throw, keep the keyword snapshot. Replace the `searchByMpn` body:

```typescript
    async searchByMpn(mpn: string): Promise<DkSnapshot> {
      const res = await fetch(`${BASE}/products/v4/search/keyword`, {
        method: "POST",
        headers: dkHeaders(token),
        body: JSON.stringify({ Keywords: mpn, RecordCount: 5 }),
      });
      if (!res.ok) throw new Error(`DigiKey search ${res.status}`);
      const json = (await res.json()) as { Products?: any[] };
      const products = json.Products ?? [];
      const match =
        products.find((p) => norm(p?.ManufacturerProductNumber ?? "") === norm(mpn)) ??
        products[0];
      const keywordSnap = normalizeDkProduct(match, mpn);

      // Keyword data may be up to 24h stale; ProductDetails is real-time. Resolve
      // the DK part number from the keyword hit, then refresh price/stock from
      // ProductDetails. Any failure → keep the keyword snapshot (no regression).
      if (!keywordSnap.partNumber) return keywordSnap;
      try {
        const dres = await fetch(
          `${BASE}/products/v4/search/${encodeURIComponent(keywordSnap.partNumber)}/productdetails`,
          { method: "GET", headers: dkHeaders(token) },
        );
        if (!dres.ok) return keywordSnap;
        const djson = (await dres.json()) as { Product?: any };
        const detailed = normalizeDkProduct(djson.Product, mpn);
        return detailed.matched ? detailed : keywordSnap;
      } catch {
        return keywordSnap;
      }
    },
```

And extract the shared header object (the keyword POST and the GET use the same headers) to a helper near the top of the module:

```typescript
function dkHeaders(token: string): Record<string, string> {
  return {
    "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID!,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json",
    "X-DIGIKEY-Locale-Site": "US",
    "X-DIGIKEY-Locale-Language": "en",
    "X-DIGIKEY-Locale-Currency": "USD",
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/__tests__/digikey.test.ts`
Expected: PASS — new ProductDetails + fallback cases green, and the existing exact-match / non-OK / normalize tests still green (the exact-match test sends no `ProductVariations`, so `partNumber` is null and it short-circuits before ProductDetails — its `toHaveBeenCalledTimes(2)` still holds).

**Step 5: Commit**

```powershell
git add src/lib/digikey.ts src/lib/__tests__/digikey.test.ts
git commit -m "feat(digikey): real-time ProductDetails for price/stock, keyword fallback"
```

**Step 6: Watch the daily call budget** — the watchdog now makes up to 2 calls/part (keyword + details). Nightly over ~200 parts ≈ 400 calls, under the 1000/day standard cap. After the next nightly cron run, confirm the run completed and didn't 429. (No code change unless it does — then raise the batch interval.)

---

## Task 6: Repoint distributor-mirror datasheet URLs (Work item 4)

Not a DigiKey-ToS item — a manufacturer-copyright tidy-up that also improves link durability. Repoint `media.digikey.com` / `mm.digikey.com` / `mouser.com` datasheet URLs to manufacturer-hosted PDFs.

**Files:**
- Create: `scripts/repoint-datasheet-urls.ts`

**Step 1: Confirm each manufacturer URL resolves** before scripting. For each `(mpn → new URL)` below, verify the PDF loads (WebFetch or a browser):
- `CL21A106KOQNNNE`, `CL21B104KBCNNNC` (Samsung) → manufacturer datasheet on samsungsem.com
- `PRPC040SAAN-RC` (Sullins) → sullinscorp.com datasheet
- `RC0805FR-0710KL`, `RC0805FR-075K1L`, `RC0805FR-07470RL` (Yageo) → yageo.com RC0805 datasheet

(If a manufacturer URL can't be confirmed, leave that row's URL as-is — do not guess a URL.)

**Step 2: Write the script**

```typescript
// Repoint datasheet URLs off distributor mirrors (media.digikey.com / mouser.com)
// onto manufacturer-hosted PDFs. Idempotent updateMany per MPN; warns on a missing
// MPN. Direct-Prisma. ⚠️ .env.local DATABASE_URL is PROD.
//
//   Run: pnpm exec tsx scripts/repoint-datasheet-urls.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

// Fill in ONLY the URLs confirmed-resolving in Step 1.
const REPOINTS: Record<string, string> = {
  // "CL21A106KOQNNNE": "https://…samsungsem…",
  // "RC0805FR-0710KL": "https://www.yageo.com/…",
};

async function main() {
  const db = new PrismaClient();
  try {
    for (const [mpn, datasheetUrl] of Object.entries(REPOINTS)) {
      const res = await db.part.updateMany({ where: { mpn }, data: { datasheetUrl } });
      if (res.count === 0) console.warn(`No part with mpn=${mpn} — skipped.`);
      else console.log(`Repointed ${mpn} → ${datasheetUrl}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Step 3: Run + verify**

Run: `pnpm exec tsx scripts/repoint-datasheet-urls.ts`
Then load the L1.01 BOM page and click each repointed part's datasheet "PDF" link — confirm it opens the manufacturer PDF.

**Step 4: Commit**

```powershell
git add scripts/repoint-datasheet-urls.ts
git commit -m "chore(compliance): repoint distributor-mirror datasheet URLs to manufacturer PDFs"
```

---

## Final verification (before any merge request)

@superpowers:verification-before-completion — run and paste real output, don't assert from memory:

1. **Full suite (single process):** `pnpm exec vitest run` → all green. (One process only — shared PROD DB.)
2. **Types + build:** `pnpm exec tsc --noEmit` then `pnpm build` → both clean. ([[schema-change-tsc-check]], [[ci-build-not-required-gate]] — verify `build | pass` explicitly.)
3. **Page render:** L1.01 public BOM still shows price columns + cart + "Pricing & stock data via DigiKey" with snapshots present.
4. **Purge capability:** `pnpm exec tsx scripts/purge-digikey-data.ts` (dry run) prints a sane count against the prod host. **Do not `--confirm`.**

Then stop and present the branch for the maintainer's go-ahead — no merge without it ([[no-merge-verify-local-first]]).

## Out of scope (do not build)

DMCA registration · per-manufacturer datasheet redistribution audit · auto-TTL/expiry on the public page · scraping digikey.com · affiliate enrollment · purging `PartDatasheet`/`PartAsset` (not DigiKey data).
