# DigiKey data & datasheet compliance — design

> Status: design (2026-06-19). Follows two rounds of research validating what we
> cache from DigiKey and what their agreement actually governs. A compliance
> fast-follow on the DigiKey availability watchdog ([[digikey-availability-watchdog]])
> and the learner live BOM ([[learner-live-bom]]).
>
> **Posture: defensible-today + ready-to-purge.** Current use sits inside the API
> agreement's license grant (cache-for-display on our own approved site); this doc
> makes that defensibility explicit and adds the one capability the agreement
> demands but we lack — on-demand deletion of all DigiKey Data.

## Why this doc exists

The triggering concern was "we may be violating DigiKey's ToS by caching
datasheets." Research showed that framing is **off-target but pointed at a real
soft spot**:

- We **never fetch datasheets from DigiKey's API.** [`src/lib/digikey.ts`](../../src/lib/digikey.ts)
  returns only `stockQty, unitPrice, inStock, lifecycle, productUrl, partNumber`.
  Datasheets are admin-uploaded PDFs (`PartDatasheet`) or hand-entered links
  (`Part.datasheetUrl`) — provenance is the **manufacturer**, whose copyright (not
  DigiKey's) governs them. The [API User Agreement](https://developer.digikey.com/api-user-agreement)
  contains **no datasheet clause**.
- What we **do** cache from the API is **price/stock/lifecycle**, persisted into
  `Part.dk*` by [`refresh-availability.ts`](../../src/lib/refresh-availability.ts)
  and shown on the **public** lesson BOM. That is the activity the agreement
  governs — and where we have one genuine gap (no deletion path).

This doc converts those findings into scoped work.

## Verified facts (primary source)

From the [DigiKey API User Agreement](https://developer.digikey.com/api-user-agreement)
(verbatim clauses) and the [Developer FAQ](https://developer.digikey.com/faq):

| Clause | Verbatim | Our standing |
| --- | --- | --- |
| License grant | "limited, revocable, non-exclusive… license to **access the API and display DigiKey Data on Your Site**" / "present it within … **your public website ('Your Site')**" | ✅ Public lesson BOM is "Your Site". |
| Own-database ban | "use the API, DigiKey Data… to **update or create your own database of information**" | ⚠️ We persist `dk*` to our DB. Defensible as cache-for-display, but the closest line. |
| Bulk-download ban | "**bulk download** DigiKey Data…" | ✅ Watchdog is per-MPN, batched, throttled — not a bulk pull. |
| Deletion on termination | "**delete all DigiKey Data in your possession or control**" | ❌ **No mechanism exists.** This doc's primary deliverable. |
| Datasheets | *(no clause)* | ✅ Not governed by this agreement. |
| Data currency | "Keyword search data is **cached and may be up to 24 hours stale**. Please use **ProductDetails** for real time pricing and availability." | ⚠️ We read the cached `keyword` endpoint, then re-cache it. Accuracy + posture both improve by switching. |

**Datasheet copyright** is the manufacturer's; redistribution is technically
permissioned but, per industry consensus, datasheets are published as sales
collateral and redistribution "is unlikely to be refused." Low practical risk.

**Unverified (honest gap):** DigiKey's **Web Site Terms of Use** and the **API
Solutions FAQ** both 403'd the fetcher; the agreement text came via a summarizing
fetch. Before any legal reliance, **a human should read the full agreement +
website terms directly** — the "create your own database" vs. "present on Your
Site" wording is the whole question. This doc assumes the pragmatic-but-defensible
reading and minimizes exposure regardless.

## Scope of DigiKey Data in our system

The cached DigiKey-derived footprint to govern (everything else is ours or the
manufacturer's):

- **`Part.dk*`** — `dkStockQty`, `dkUnitPriceCents`, `dkInStock`, `dkLifecycle`,
  `dkProductUrl`, `dkPartNumber`, `dkCheckedAt`
  ([schema.prisma:581-587](../../prisma/schema.prisma#L581-L587)).
- **`PartAvailabilityEvent`** — append-only change log *derived from* DigiKey
  snapshots ([schema.prisma:609](../../prisma/schema.prisma#L609)); "data derived
  from DigiKey Data" is DigiKey Data under the agreement, so it's in scope for
  purge.

**Out of scope:** `Part.datasheetUrl`, `PartDatasheet`, `PartAsset`, every other
column — none are DigiKey-sourced.

## Work item 1 — DigiKey-data purge path (primary)

Satisfy the "delete all DigiKey Data in your possession or control" clause with a
deliberate, scripted, idempotent purge.

- **`scripts/purge-digikey-data.ts`** — a direct-Prisma script (server actions
  can't be scripted here; [[foundry-headless-scripting]]). In one transaction:
  null every `Part.dk*` column and `deleteMany` on `PartAvailabilityEvent`. Prints
  a before/after count. `--dry-run` default; `--confirm` to execute.
- **Guard:** because `.env.local` `DATABASE_URL` is **PROD**, the script prints the
  target host and requires `--confirm` plus a typed project name. No accidental
  prod wipes ([[prisma-migrate-prod]]).
- **Docs:** a short "DigiKey offboarding" section in the watchdog design doc (or a
  `docs/compliance/` note) stating: on API-relationship termination, run this
  script, then redeploy so the public BOM degrades to its no-snapshot rendering.
- **Graceful aftermath (PARTIAL — needs a small display fix):** validation found
  that [`GuideBlocks.tsx`](../../src/components/guide/GuideBlocks.tsx) gates only the
  **total + "prices as of" line** on `cost.anyPriced` (L358-372). The **Unit $ /
  Ext. $ column headers (L292-293) and the stock cell are always rendered** — so a
  purged BOM shows empty "—" price columns, not a plain parts list. The purge is
  therefore **not** display-clean by itself. Add a sub-task: gate the price columns
  and the `DkAvailabilityCell` on "any row has a `dk*` snapshot" (a `tableHasDkData`
  flag) so a snapshot-less revision renders the bare parts list. Small, and it makes
  the post-purge state correct + tested.

## Work item 2 — Public-display caveats + attribution

Keep the cached display squarely inside "present DigiKey Data on Your Site."

- **Freshness caveat** — already present ("DigiKey prices as of …" from oldest
  `dkCheckedAt`, plus the "design estimate — excludes MOQ/reels & shipping" label
  in [[learner-live-bom]]). **Codify it as load-bearing**: a comment + a render
  test so it can't be silently dropped.
- **Attribution** — add an explicit "Pricing & stock data via DigiKey" line near
  the BOM total, linking to the part's `dkProductUrl` where present. Source of
  truth + good-faith display posture in one. Lives in `BomTableBlock`
  ([`GuideBlocks.tsx`](../../src/components/guide/GuideBlocks.tsx)); reuse the
  existing `vendorCta`/affiliate styling ([`affiliates.ts`](../../src/lib/affiliates.ts)).
- **No new data exposed** — attribution renders only fields we already display.

## Work item 3 — keyword → ProductDetails switch

Align with DigiKey's own "use ProductDetails for real time pricing" guidance —
accuracy *and* a cleaner "we display current data, not a stale mirror" posture.

- In [`digikey.ts`](../../src/lib/digikey.ts), add a **ProductDetails** lookup by
  DigiKey part number / MPN and use it for the **price + stock** fields; keep
  `keyword` only for the initial **MPN→DigiKey-part-number resolution** (its
  documented job). `normalizeDkProduct` stays the shared mapper.
- **MOQ/variation logic preserved** — `pickDkPartNumber` already chooses the
  lowest-MOQ variation; ProductDetails returns the same variation shape.
- **Rate budget** — ProductDetails is one extra call per part. The watchdog runs
  nightly in batches of 5 over ~200 parts; well under the 1000/day standard cap.
  If resolution + details doubles calls, keep the batch throttle and confirm the
  daily total stays under cap (log it).
- **Fallback** — on a ProductDetails miss, fall back to the `keyword` snapshot
  rather than dropping the part (no regression vs. today).

## Work item 4 — Datasheet-URL repoint (manufacturer-copyright tidy-up)

Not a DigiKey-ToS item — removes the *appearance* of leaning on a distributor's
mirror and improves link durability.

- Repoint datasheet URLs that point at `media.digikey.com` / `mm.digikey.com` /
  `mouser.com` to the **manufacturer-hosted** PDF where one exists. From the
  L1.01 BOM: Samsung MLCC (`media.digikey.com` → samsungsem.com), the Sullins
  header (`mm.digikey.com` → sullinscorp.com), and the Yageo resistors
  (`mouser.com` → yageo.com).
- Mechanism: update `Part.datasheetUrl` via the existing admin editor /
  `updatePartDatasheetUrl` action, or a one-off seed-style script for the batch.
  Verify each replacement URL resolves before saving.
- **Admin-uploaded `PartDatasheet` PDFs** stay as-is (manufacturer copyright, low
  risk, auth-gated short-TTL serving) — no action.

## Out of scope (YAGNI)

DMCA/agent registration · a datasheet-redistribution permission audit per
manufacturer · automatic dk-data TTL/expiry on the public page (the nightly
refresh + freshness caveat suffice) · scraping digikey.com (we use only the API) ·
affiliate-program enrollment · purging `PartDatasheet`/`PartAsset` (not DigiKey
data).

## Testing

- **Purge script** — unit-test the purge against **throwaway** Part +
  `PartAvailabilityEvent` rows (never the shared `esp32-sensor-breakout` fixture;
  single vitest process; [[test-seed-fixture]]): assert all `dk*` null + events
  gone, and that a no-`dk*` Part renders the BOM without price columns/total/cart
  (the post-purge state).
- **ProductDetails** — mock `fetch`: ProductDetails success → price/stock from it;
  miss → `keyword` fallback. No network in tests.
- **Display** — render the public lesson BOM page (load the PAGE, not just the DB —
  [[guide-content-render-verify]]) and assert the freshness caveat + DigiKey
  attribution are present; and that a purged/snapshot-less revision degrades
  cleanly.

## Rollout (incremental, each independently shippable)

1. **Purge script + guard + tests** + offboarding doc. (Closes the one real gap;
   ship first.)
2. **Caveat-hardening + attribution line + price-column/stock-cell gating** in
   `BomTableBlock` (the `tableHasDkData` gate from item 1) + render-verify the
   snapshot-less revision shows the bare parts list.
3. **ProductDetails switch** in `digikey.ts` + mocked tests; confirm daily call
   budget under cap on a real nightly run.
4. **Datasheet-URL repoint** for the L1.01 distributor-mirror links; verify each
   resolves.

Each step is reviewable on its own; none blocks the others. Per repo policy, no
merge without the maintainer's explicit go-ahead ([[no-merge-verify-local-first]]).
