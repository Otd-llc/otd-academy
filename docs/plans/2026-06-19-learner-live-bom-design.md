# Learner-facing live BOM — design

> Status: design (brainstormed + validated 2026-06-19). The first deferred
> fast-follow on the DigiKey availability watchdog ([[digikey-availability-watchdog]]).

## Goal

Turn the public lesson's bill of materials from a static parts list into a
*buyable* one: show each line's live DigiKey **stock + price + extended cost**, a
caveated **"Design BOM cost ≈ $X"** total, and a one-click **"Add whole BOM to
DigiKey cart"** button. Removes the friction between "here's the BOM" and "the
parts are in my cart" — the direct payoff of the watchdog snapshot data we
already collect, and of making DigiKey the parts vendor (Newark removed, PR #157).

## Audience (locked)

**Public — everyone, including anonymous visitors.** No gating. Max reach / SEO /
lowest friction; the live cost is part of the lesson's pitch. No access-tier
logic.

## What we already have

- **Per-part DigiKey snapshot on `Part`** (watchdog): `dkUnitPriceCents`,
  `dkStockQty`, `dkInStock`, `dkLifecycle`, `dkCheckedAt`. Already loaded into the
  `bomTable` block's `BomRow` rows and rendered on public lesson cards.
- **The keyless MyLists third-party API** (verified 2026-06-19,
  forum.digikey.com): `POST https://www.digikey.com/mylists/api/thirdparty`,
  `Content-Type: application/json`, body `{ listName, tags?, parts[] }` where each
  part is `{ requestedPartNumber, manufacturerName, referenceDesignator,
  quantities: [{ quantity }] }`. Returns a **single-use URL** to add-to-cart or
  save to myLists. **No API key, no OAuth, no affiliate program.**

## Part 1 — Display (extend the public `bomTable`)

In `BomTableBlock` (`src/components/guide/GuideBlocks.tsx`):

- Add a **Unit $** column (`dkUnitPriceCents`) and an **Ext. $** column
  (`qty × dkUnitPriceCents`).
- Footer row: **"Design BOM cost ≈ $X"** summed over *priced* lines only, labelled
  *"parts only — excludes MOQ/reels & shipping"*, with a *"N lines unpriced"*
  note when any line lacks a snapshot price.
- A **"DigiKey prices as of \<relative time\>"** line from the oldest
  `dkCheckedAt` across the rows (reuse the relative-age helper from
  `DkAvailabilityCell`).
- **Graceful degrade:** when no row has snapshot data (creds absent / never
  checked), the new columns + total + button are omitted and the existing table
  renders unchanged. Cost math reuses the cents→USD formatter (`formatUsd`).

### Pricing honesty

DigiKey unit price has quantity breaks + MOQ (a 5.1 kΩ resistor is ~$0.10 but
ships on a reel of thousands). The stored `dkUnitPriceCents` is the qty-1 price,
so `Σ(qty × unit)` is a *design* estimate, never the real cart total. The caveat
label is load-bearing — keep it. The **live cart** (below) is where the true,
current total comes from.

## Part 2 — "Add whole BOM to DigiKey cart" button

- Rendered under the `bomTable` when the BOM has lines.
- **Server-proxied** (avoids browser CORS; robust): a small client button
  (`AddBomToCartButton`) calls a **server action** with only the **`revisionId`**.
  The action builds the parts payload **server-side from the DB BOM** (never from
  client input — the endpoint can't be coerced into minting arbitrary carts),
  POSTs to the MyLists endpoint with:
  - `listName`: `"OTD Academy — <project title> (<revLabel>)"`
  - `parts[]`: each BOM line → `{ requestedPartNumber: part.mpn,
    manufacturerName: part.manufacturer, referenceDesignator: refDes,
    quantities: [{ quantity }] }`
  - `tags`: `[project.slug]`
- On success the action returns the **single-use URL**; the client opens it in a
  new tab (`rel="noopener"`). Generated fresh per click (URLs are single-use);
  nothing cached.
- **Resilience:** on a failed POST / missing URL the action returns an error and
  the button shows a brief *"couldn't build the cart — open DigiKey"* fallback
  link to `digikey.com`. No DigiKey creds involved (keyless) → works regardless
  of the watchdog API-key state.
- **Public-safe:** the action is unauthenticated (public lessons) but only emits a
  cart from an existing revision's already-public BOM — no data exposure.

## Out of scope (v1 — YAGNI)

Per-line "add to cart" buttons · cart-URL caching · DigiKey affiliate attribution
(none needed; add later if OTD joins the program) · live-at-view repricing (we
use the nightly snapshot for display; the live cart is accurate on click) ·
second-source/altMpn substitution in the cart.

## Testing

- **Pure:** the cost roll-up (sum priced lines, unpriced count, caveat) as a small
  tested helper (mirrors `bom-cost`).
- **Server action:** build the MyLists payload from a throwaway revision's BOM and
  assert the request body shape; mock `fetch` for the DigiKey POST (success → URL
  returned; non-OK → error result). Never hits the network in tests; single
  vitest process; throwaway rows only ([[test-seed-fixture]]).
- **Render:** verify the public lesson BOM page shows the new columns + total +
  button (load the PAGE, not just the DB — [[guide-content-render-verify]]).

## Rollout (incremental)

1. Cost roll-up helper + unit tests.
2. Extend `BomTableBlock` display (columns + total + freshness) + render-verify.
3. `addBomToDigikeyCart` server action (build payload, POST, parse URL) + mocked
   tests.
4. `AddBomToCartButton` client component + fallback; wire under the table.
5. Verify on a real public lesson (l1-01) end-to-end: cart opens with the lines.
