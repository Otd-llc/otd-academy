# Learner-facing live BOM — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Also @superpowers:test-driven-development for the pure-logic + action tasks.

**Goal:** Make the public lesson BOM *buyable* — show per-line DigiKey price/stock + a caveated "Design BOM cost ≈ $X" total, and a one-click "Add whole BOM to DigiKey cart" button (keyless MyLists API).

**Architecture:** Display reuses the watchdog snapshot already on each `BomRow` (`dkUnitPriceCents` etc.) — pure cost helper + extended `BomTableBlock`. The cart button is a client component calling a public server action that builds the parts payload **from the DB BOM** (never client input) and POSTs to DigiKey's keyless `mylists/api/thirdparty`, returning a single-use cart URL the client opens.

**Tech Stack:** Next.js (App Router, RSC + server actions) · Prisma/Neon · vitest · DigiKey MyLists Third-Party API (keyless). Design: `docs/plans/2026-06-19-learner-live-bom-design.md`.

**Hard constraints (read first):**
- `.env.local` `DATABASE_URL` is **PROD**; DB-backed tests use **throwaway rows**, never the shared fixture; **never two vitest at once** ([[test-seed-fixture]]).
- `"use server"` files export **ONLY async functions** — no `export type`/`export const` (runtime crash uncaught by tsc) ([[use-server-export-rule]]).
- After changes: full `tsc` **and** vitest ([[schema-change-tsc-check]]). `pnpm` via PowerShell.
- Guide render fails **safe to blank** on any contentBlocks safeParse error — verify edits by loading the PAGE ([[guide-content-render-verify]]).
- Branch `feat/learner-live-bom` (off main). No merge without Josh's go-ahead + local verify ([[no-merge-verify-local-first]]).

---

## Task 1: Pure live-cost helper (TDD)

**Files:**
- Create: `src/lib/live-bom-cost.ts`
- Test: `src/lib/__tests__/live-bom-cost.test.ts`

Mirrors `src/lib/bom-cost.ts` but sums the **DigiKey snapshot** price (`dkUnitPriceCents`), not the BOM line's quoted `unitPriceCents`.

**Step 1: Write the failing test.**
```ts
import { describe, expect, test } from "vitest";
import { liveBomCost } from "@/lib/live-bom-cost";

describe("liveBomCost", () => {
  test("sums qty × dkUnitPriceCents over priced lines", () => {
    const r = liveBomCost([
      { quantity: 2, dkUnitPriceCents: 150 },
      { quantity: 5, dkUnitPriceCents: 10 },
    ]);
    expect(r.totalCents).toBe(350);
    expect(r.pricedCount).toBe(2);
    expect(r.unpricedCount).toBe(0);
    expect(r.anyPriced).toBe(true);
  });
  test("counts unpriced (null) lines and excludes them from the total", () => {
    const r = liveBomCost([
      { quantity: 2, dkUnitPriceCents: 150 },
      { quantity: 1, dkUnitPriceCents: null },
    ]);
    expect(r.totalCents).toBe(300);
    expect(r.unpricedCount).toBe(1);
  });
  test("no priced lines → anyPriced false (caller hides the total)", () => {
    const r = liveBomCost([{ quantity: 1, dkUnitPriceCents: null }]);
    expect(r.anyPriced).toBe(false);
    expect(r.totalCents).toBe(0);
  });
});
```

**Step 2: Run → FAIL.** `pnpm exec vitest run src/lib/__tests__/live-bom-cost.test.ts`

**Step 3: Implement `src/lib/live-bom-cost.ts`.**
```ts
// Live-BOM cost roll-up from the DigiKey watchdog snapshot price
// (`dkUnitPriceCents`), distinct from bom-cost.ts (the operator's quoted
// `unitPriceCents`). The total is a DESIGN estimate — qty × unit, excluding
// DigiKey MOQ/price-breaks & shipping — so the UI must caveat it; the live
// DigiKey cart is the source of the real total.
export interface LiveCostLine {
  quantity: number;
  dkUnitPriceCents: number | null;
}

export interface LiveBomCost {
  totalCents: number;
  pricedCount: number;
  unpricedCount: number;
  anyPriced: boolean;
}

export function liveBomCost(lines: LiveCostLine[]): LiveBomCost {
  let totalCents = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  for (const l of lines) {
    if (l.dkUnitPriceCents == null) unpricedCount++;
    else {
      totalCents += l.quantity * l.dkUnitPriceCents;
      pricedCount++;
    }
  }
  return { totalCents, pricedCount, unpricedCount, anyPriced: pricedCount > 0 };
}
```

**Step 4: Run → PASS.**
**Step 5: Commit.** `git add -A && git commit -m "feat(live-bom): DigiKey live-cost roll-up helper"`

---

## Task 2: Shared relative-age util (TDD, tiny refactor)

`DkAvailabilityCell.tsx` has a private `relativeAge`; the BOM freshness line needs it too. Extract to one tested util (DRY).

**Files:**
- Create: `src/lib/relative-time.ts`
- Test: `src/lib/__tests__/relative-time.test.ts`
- Modify: `src/components/parts/DkAvailabilityCell.tsx` (import it; delete the local copy)

**Step 1: Failing test.**
```ts
import { describe, expect, test } from "vitest";
import { relativeAge } from "@/lib/relative-time";

const now = new Date("2026-06-19T12:00:00Z");
describe("relativeAge", () => {
  test("seconds → just now", () => {
    expect(relativeAge(new Date("2026-06-19T11:59:30Z"), now)).toBe("just now");
  });
  test("minutes / hours / days", () => {
    expect(relativeAge(new Date("2026-06-19T11:30:00Z"), now)).toBe("30m ago");
    expect(relativeAge(new Date("2026-06-19T09:00:00Z"), now)).toBe("3h ago");
    expect(relativeAge(new Date("2026-06-16T12:00:00Z"), now)).toBe("3d ago");
  });
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement `src/lib/relative-time.ts`** (lift the exact body from `DkAvailabilityCell.tsx`):
```ts
/** Short "x ago" label. Pure; `now` is injected so it's deterministic in tests. */
export function relativeAge(from: Date, now: Date): string {
  const secs = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
```

**Step 4:** In `DkAvailabilityCell.tsx`, delete the local `relativeAge` function and add `import { relativeAge } from "@/lib/relative-time";`.

**Step 5: Run → PASS** + `pnpm exec tsc --noEmit`.
**Step 6: Commit.** `git commit -am "refactor(parts): extract relativeAge to a shared tested util"`

---

## Task 3: Extend the public BOM display (TDD-lite + render-verify)

Add Unit $ / Ext. $ columns, the caveated total footer, and the freshness line to `BomTableBlock`.

**Files:** Modify `src/components/guide/GuideBlocks.tsx` (`BomTableBlock` ~235-333).

**Step 1: Imports** (top of file, with the other `@/lib` imports):
```ts
import { liveBomCost } from "@/lib/live-bom-cost";
import { relativeAge } from "@/lib/relative-time";
import { formatUsd } from "@/lib/format-money";
```

**Step 2:** Inside `BomTableBlock`, after the existing `health` computation, derive cost + freshness:
```ts
  const cost = liveBomCost(rows.map((r) => ({ quantity: r.qty, dkUnitPriceCents: r.dkUnitPriceCents })));
  const checkedDates = rows.map((r) => r.dkCheckedAt).filter((d): d is Date => d != null);
  const oldestChecked = checkedDates.length
    ? checkedDates.reduce((a, b) => (a < b ? a : b))
    : null;
```

**Step 3:** Add two header cells after `<th>Description</th>` (before `<th>Datasheet</th>`):
```tsx
            <th>Unit $</th>
            <th>Ext. $</th>
```

**Step 4:** Add two body cells in the row map, after the Description `<td>` (before the Datasheet `<td>`):
```tsx
              <td data-label="Unit $" className="text-muted">
                {r.dkUnitPriceCents != null ? formatUsd(r.dkUnitPriceCents) : "—"}
              </td>
              <td data-label="Ext. $" className="text-muted">
                {r.dkUnitPriceCents != null ? formatUsd(r.qty * r.dkUnitPriceCents) : "—"}
              </td>
```

**Step 5:** Add the total + freshness block between `</table>` and the `<figcaption>`:
```tsx
      {cost.anyPriced ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-panel-border pt-2 font-mono text-xs">
          <span className="text-link-muted">
            Design BOM cost ≈ <span className="text-command-gold">{formatUsd(cost.totalCents)}</span>
            <span className="ml-1 text-muted normal-case">
              parts only — excludes MOQ/reels &amp; shipping
              {cost.unpricedCount > 0 ? ` · ${cost.unpricedCount} line${cost.unpricedCount === 1 ? "" : "s"} unpriced` : ""}
            </span>
          </span>
          {oldestChecked ? (
            <span className="text-muted">DigiKey prices as of {relativeAge(oldestChecked, new Date())}</span>
          ) : null}
        </div>
      ) : null}
```
(Degrade: when no line has a DigiKey price, `anyPriced` is false → the whole block is omitted and the Unit/Ext cells all show "—". The table is otherwise unchanged.)

**Step 6:** `pnpm exec tsc --noEmit`. Then **render-verify**: with the dev server up (`Start-Process pnpm.cmd dev -WindowStyle Hidden` — [[dev-server-detached-launch]]) load a public lesson BOM card, e.g. `/projects/l1-01-wroom-breakout/v1/guide/bom_sourcing`, and confirm the Unit/Ext columns + "Design BOM cost ≈ $… · DigiKey prices as of …" render (l1-01's parts were snapshotted by the watchdog). Confirm the card is NOT blank.

**Step 7: Commit.** `git commit -am "feat(live-bom): price columns + caveated total + freshness on the public BOM"`

---

## Task 4: Cart server action (TDD, injectable fetch)

**Files:**
- Create: `src/lib/digikey-cart.ts` (pure payload builder + poster — testable, NOT "use server")
- Create: `src/lib/actions/digikey-cart.ts` (`"use server"` thin wrapper)
- Test: `src/lib/__tests__/digikey-cart.test.ts`

> Split so the logic is unit-testable: the `"use server"` file may export only async fns ([[use-server-export-rule]]), so the types + pure builder live in `src/lib/digikey-cart.ts`.

**Step 1: Failing test** (DB-backed throwaway rev for the loader; mocked `fetch` for the POST):
```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildMyListsPayload, postMyLists } from "@/lib/digikey-cart";

afterEach(() => vi.restoreAllMocks());

describe("buildMyListsPayload", () => {
  test("maps BOM lines to the MyLists parts shape", () => {
    const body = buildMyListsPayload("OTD Academy — WROOM (v1)", "l1-01", [
      { refDes: "R1,R2", quantity: 2, part: { mpn: "RC0805FR-0710KL", manufacturer: "YAGEO" } },
    ]);
    expect(body.listName).toBe("OTD Academy — WROOM (v1)");
    expect(body.tags).toEqual(["l1-01"]);
    expect(body.parts).toEqual([
      { requestedPartNumber: "RC0805FR-0710KL", manufacturerName: "YAGEO", referenceDesignator: "R1,R2", quantities: [{ quantity: 2 }] },
    ]);
  });
});

describe("postMyLists", () => {
  test("returns the cart URL from a 2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: "https://www.digikey.com/mylists/x" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const r = await postMyLists({ listName: "x", parts: [] });
    expect(r).toEqual({ ok: true, url: "https://www.digikey.com/mylists/x" });
  });
  test("returns an error result on a non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const r = await postMyLists({ listName: "x", parts: [] });
    expect(r.ok).toBe(false);
  });
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement `src/lib/digikey-cart.ts`.**
```ts
const MYLISTS_URL = "https://www.digikey.com/mylists/api/thirdparty";

export interface MyListsPart {
  requestedPartNumber: string;
  manufacturerName: string;
  referenceDesignator: string;
  quantities: { quantity: number }[];
}
export interface MyListsBody {
  listName: string;
  tags?: string[];
  parts: MyListsPart[];
}
export type CartResult = { ok: true; url: string } | { ok: false };

export function buildMyListsPayload(
  listName: string,
  tag: string,
  lines: { refDes: string; quantity: number; part: { mpn: string; manufacturer: string } }[],
): MyListsBody {
  return {
    listName,
    tags: [tag],
    parts: lines.map((l) => ({
      requestedPartNumber: l.part.mpn,
      manufacturerName: l.part.manufacturer,
      referenceDesignator: l.refDes,
      quantities: [{ quantity: l.quantity }],
    })),
  };
}

export async function postMyLists(body: MyListsBody): Promise<CartResult> {
  try {
    const res = await fetch(MYLISTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false };
    // The MyLists third-party endpoint returns a single-use URL. Response shape
    // is small; accept either a JSON {url}/{listUrl} or a bare URL string body.
    const text = await res.text();
    let url: string | null = null;
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      url = (j.url ?? j.listUrl ?? j.shareUrl ?? null) as string | null;
    } catch {
      url = text.trim().startsWith("http") ? text.trim() : null;
    }
    return url ? { ok: true, url } : { ok: false };
  } catch {
    return { ok: false };
  }
}
```
> NOTE: the exact JSON field is confirmed against a real call in Task 5; if it differs, adjust the `j.url ?? …` line (and the test).

**Step 4: Implement `src/lib/actions/digikey-cart.ts`.**
```ts
"use server";

// Public action (no auth — runs on public lessons). Builds the DigiKey MyLists
// cart payload from the revision's OWN BOM rows (never client input), so it can
// only ever emit a cart for an existing, already-public BOM. Returns a single-
// use cart URL the client opens. Keyless API — no DigiKey creds involved.
import { db } from "@/lib/db";
import { buildMyListsPayload, postMyLists, type CartResult } from "@/lib/digikey-cart";

export async function addBomToDigikeyCart(revisionId: string): Promise<CartResult> {
  const rev = await db.revision.findUnique({
    where: { id: revisionId },
    select: {
      label: true,
      project: { select: { name: true, slug: true } },
      bomLines: {
        orderBy: { refDes: "asc" },
        select: { refDes: true, quantity: true, part: { select: { mpn: true, manufacturer: true } } },
      },
    },
  });
  if (!rev || rev.bomLines.length === 0) return { ok: false };
  const body = buildMyListsPayload(
    `OTD Academy — ${rev.project.name} (${rev.label})`,
    rev.project.slug,
    rev.bomLines,
  );
  return postMyLists(body);
}
```

**Step 5: Run → PASS** (single vitest process). **Step 6:** `pnpm exec tsc --noEmit`.
**Step 7: Commit.** `git commit -m "feat(live-bom): keyless DigiKey MyLists cart action"`

---

## Task 5: Cart button + thread context + live verify

**Files:**
- Create: `src/components/guide/AddBomToCartButton.tsx` (client)
- Modify: `src/components/guide/GuideBlocks.tsx` (thread `cart` ctx → `BomTableBlock`; render the button)
- Modify: `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` (pass `cart` at the `GuideBlocks` call site ~641)

**Step 1: Client button `AddBomToCartButton.tsx`.**
```tsx
"use client";
import { useState, useTransition } from "react";
import { addBomToDigikeyCart } from "@/lib/actions/digikey-cart";

export function AddBomToCartButton({ revisionId }: { revisionId: string }) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            const r = await addBomToDigikeyCart(revisionId);
            if (r.ok) window.open(r.url, "_blank", "noopener,noreferrer");
            else setFailed(true);
          })
        }
        className="glass-button inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em]"
      >
        {pending ? "Building cart…" : "Add whole BOM to DigiKey cart"}
        <span className="text-[10px] text-gold-dim">DigiKey</span>
      </button>
      {failed ? (
        <p className="mt-1 font-mono text-[11px] text-muted">
          Couldn&apos;t build the cart —{" "}
          <a href="https://www.digikey.com/" target="_blank" rel="noopener noreferrer nofollow" className="text-signal-blue underline">open DigiKey</a> and add by MPN.
        </p>
      ) : null}
    </div>
  );
}
```

**Step 2:** In `GuideBlocks.tsx`, add an optional `cart` prop and thread it (mirror how `bomRows` flows): add `cart?: { revisionId: string }` to BOTH `GuideBlocks` and `GuideBlock` param types, pass `cart={cart}` in the `GuideBlock` map, and pass it into the `bomTable` case:
```tsx
    case "bomTable":
      return <BomTableBlock caption={block.caption} rows={bomRows} cart={cart} />;
```

**Step 3:** Give `BomTableBlock` the prop + render the button after the total block (only when there are rows):
```tsx
function BomTableBlock({ caption, rows, cart }: { caption?: string; rows?: BomRow[]; cart?: { revisionId: string } }) {
```
…and before the closing `</figure>` (after the total/freshness block):
```tsx
      {cart && rows.length > 0 ? <AddBomToCartButton revisionId={cart.revisionId} /> : null}
```
Add the import: `import { AddBomToCartButton } from "@/components/guide/AddBomToCartButton";`

**Step 4:** At the `GuideBlocks` call site in `[stage]/page.tsx` (~641), add the prop:
```tsx
          cart={{ revisionId: revision.id }}
```

**Step 5:** `pnpm exec tsc --noEmit`.

**Step 6: Live end-to-end verify** (dev server up). On `/projects/l1-01-wroom-breakout/v1/guide/bom_sourcing`:
- Columns + total + freshness render (Task 3).
- Click **Add whole BOM to DigiKey cart** → a new tab opens a DigiKey MyLists/cart page populated with the WROOM lines. Confirm the real response field matched `postMyLists` (adjust the `j.url ?? …` parse + its test if DigiKey uses a different key) — this is the one spot the live call confirms.

**Step 7:** Full `pnpm exec tsc --noEmit` + full `pnpm exec vitest run` (single process) green.

**Step 8: Commit + push + PR** (do NOT merge):
```
git commit -am "feat(live-bom): add-whole-BOM-to-DigiKey-cart button + wiring"
git push -u origin feat/learner-live-bom
gh pr create --base main ...
```

---

## Verification checklist (definition of done)
- [ ] `liveBomCost` + `relativeAge` + `digikey-cart` unit-tested; full vitest green (single process).
- [ ] Public BOM shows Unit/Ext columns + caveated "Design BOM cost ≈ $X" + "prices as of …"; degrades cleanly with no snapshot.
- [ ] Cart button opens a populated DigiKey cart from a real lesson; fallback shows on failure.
- [ ] `tsc` clean. Branch pushed, PR opened, NOT merged.
