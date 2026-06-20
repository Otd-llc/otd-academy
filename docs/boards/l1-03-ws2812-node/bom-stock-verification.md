# l1-03 — BOM stock-verification worklist

> The BOM_SOURCING stock check we initially skipped (we'd done *orderability* +
> lifecycle=ACTIVE, not a current line-by-line stock pass). DESIGN_VALIDATION item
> **#5 "BOM availability confirmed — in stock"** is **UN-CHECKED** until this is done.
> Friction **F12**.
>
> **Screen** (automated, 2026-06-18, 4 research agents): lifecycle + Western-distributor
> availability + best-effort stock/price. **Buy-confirm** (manual, Josh): tick the ☐ per
> line after confirming live stock/qty/price in-cart, then re-check DV#5.
>
> ⚠ Distributor pages 403 automated fetch — lifecycle + availability are well-corroborated;
> **live stock/qty/price are approximate** and must be confirmed at order time.

## Action items (decisions, before re-attesting #5)

1. ✅ **DONE (2026-06-19) — U3 `SN74AHCT125D` → `SN74AHCT125DR`.** Confirmed obsolete (TI's own
   page: "no longer in production"; P13-4). Library Part MPN updated D→DR + bom.csv patched
   (`SN74AHCT125N` PDIP kept as 2nd source). Strict-match now resolves to the active T&R part.
2. ✅ **DONE (2026-06-19) — D1 `UMW USBLC6-2SC6` → `STMicroelectronics USBLC6-2SC6`.** UMW = Youtai
   (Chinese house-brand clone), DigiKey-sole-source; ST is multi-distributor (P13-5). Shared
   library Part swapped UMW→ST (UMW kept as alt); **also repointed l1-01-wroom-breakout's BOM +
   reference BOM.csv** (Josh's "swap everywhere"). ⚠ ST 17 V/5 A ≠ some UMW 15 V/6 A — confirm at buy.
3. **D3 `PESD5V0S1BA,115`** — DigiKey currently **backorder**; in stock at Farnell/Arrow.
   Order the **`,115`** variant (NOT `-QF` factory-not-accepting / `-Q` automotive).
4. **LED3 XINGLIGHT** — only Western path is DigiKey **Marketplace** (3rd-party from XINGLIGHT);
   true supply is LCSC/JLCPCB. Sole-source + WS2812B clone. **Accept** (no Western-stocked
   WS2812B exists at this price/footprint) or reconsider sourcing. Confirm the exact C-number
   (`C2843785`) to avoid the `-S`/`RGBWC` variant collisions.

## Worklist (tick after manual buy-confirm)

| ☐ | refDes | Manufacturer | MPN | Lifecycle | Western dist | Stock (approx) | ~Unit price | Flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ☐ | U1 | Espressif Systems | ESP32-S3-WROOM-1-N16R2 | Active | DK, Mouser | in stock | ~$6.13–6.32 | — |
| ☐ | U2 | Richtek | RT9080-33GJ5 | Active | DK, Mouser, Newark | in stock (verify) | ~$0.30–0.50 (est) | verify live stock/price; can run thin |
| ☐ | U3 | Texas Instruments | SN74AHCT125DR | Active (T&R, deep) | DK, Mouser, Newark | in stock (deep) | ~$0.46 | ✅ fixed D→DR (item 1) |
| ☐ | D1 | STMicroelectronics | USBLC6-2SC6 | Active | DK, Mouser, Newark | multi-distributor | ~$0.08–0.15 | ✅ swapped UMW→ST (item 2); UMW = alt |
| ☐ | D2 | Littelfuse | SMAJ5.0A | Active | DK, Mouser, Newark | deep | ~$0.25–0.50 | — (widely 2nd-sourced) |
| ☐ | D3 | Nexperia | PESD5V0S1BA | Active | DK, Mouser, Newark, Arrow | **DK backorder**; Farnell/Arrow in stock | ~$0.30–0.45 | **DK backorder; use `,115`** (item 3) |
| ☐ | F1 | Littelfuse | 1206L050YR | Active | DK, Mouser, Newark | in stock | ~$0.40–0.48 | — |
| ☐ | LED1 | Würth Elektronik | 150080RS75000 | Active | DK, Mouser | in stock | ~$0.19 | — |
| ☐ | LED2 | Würth Elektronik | 150080YS75000 | Active | DK, Mouser | in stock | ~$0.19 | — |
| ☐ | LED3 | XINGLIGHT | XL-5050RGBC-WS2812B | Active (no EOL found) | **DK Marketplace only** + LCSC | DK Mktpl / LCSC deep | ~$0.11 (DK Mktpl) | **sole-source clone, not true Western stock** (item 4) |
| ☐ | C1 | Samsung Electro-Mechanics | CL21A106KOQNNNE | Active | DK, Newark, Arrow (+Mouser) | in stock (verify depth) | ~$0.05–0.10 | long *factory* lead (buy distributor stock) |
| ☐ | C11 | Samsung Electro-Mechanics | CL21A475KAQNNNE | Active | DK, Mouser, Newark, Arrow | deep | ~$0.11 | — (NOT LCSC-only ✓) |
| ☐ | C2–C9 | Samsung Electro-Mechanics | CL21B104KBCNNNC | Active | DK, Mouser, Newark | very deep | ~$0.08 (qty1) | — (jellybean) |
| ☐ | C5–C6 | Würth Elektronik | 885012207103 | Active (mfr) | DK, Mouser | in stock (verify) | ~$0.30 | Rapid lists "discontinued" = Rapid only, NOT mfr EOL |
| ☐ | C10 | Panasonic | EEU-FR1C102 | Active | DK, Mouser, Newark | in stock (~4.5k DK) | ~$0.80–0.95 | target plain `EEU-FR1C102` (not …102B/…102L) |
| ☐ | J1 | GCT | USB4110-GF-A | Active | DK, Mouser | in stock | ~$1.24 | — |
| ☐ | J2–J3 | Sullins Connector Solutions | PRPC040SAAN-RC | Active | DK, Mouser, Arrow, TTI | deep (~44k DK) | ~$0.95–1.15 | — |
| ☐ | J4 | TE Connectivity | 282837-3 | Active | DK, Mouser, Newark | DK in stock; **Mouser backorder** | ~$1.26–1.63 | DK reliable; Mouser not a current 2nd source |
| ☐ | J5 | TE Connectivity | 282837-2 | Active | DK, Mouser, Newark, +more | in stock | ~$1.04 | order bare `282837-2` (not reeled 1-/2-/3- prefix) |
| ☐ | R1–R2 | Yageo | RC0805FR-0710KL | Active | DK, Mouser, Newark, Arrow | deep | ~$0.10 | — |
| ☐ | R3–R4 | Yageo | RC0805FR-075K1L | Active | DK, Mouser, Newark | deep | ~$0.10 | — |
| ☐ | R5–R8 | Yageo | RC0805FR-07470RL | Active | DK, Mouser, Newark, Arrow | deep | ~$0.10 | — |
| ☐ | SW1–SW2 | Omron | B3F-1000 | Active | DK, Mouser, Newark | in stock | ~$0.35 | — |
| ☐ | TP1 | Keystone Electronics | 5010 | Active | DK, Mouser, Newark | deep (~87k DK) | ~$0.34 | — |
| ☐ | TP2 | Keystone Electronics | 5011 | Active | DK, Mouser, Newark | deep (~125k DK) | ~$0.33 | — |

## After the manual buy-confirm

- Resolve the 4 action items (apply any MPN changes via the parts library + bom.csv).
- Tick every line above.
- Re-check **DESIGN_VALIDATION #5** (the honest attestation, now earned).

## Live DigiKey screen — 2026-06-20 (`scripts/digikey-stock.ts`, read-only)

All 25 lines **Active**. Fixes confirmed live: **U3 = `SN74AHCT125DR`** (2005 in stock),
**D1 = `STMicroelectronics USBLC6-2SC6`** (3661). **22/25 lines DK-in-stock.**

**3 lines DK-OUT-OF-STOCK (Active + sourceable elsewhere — not blockers):**
- **C1** Samsung `CL21A106KOQNNNE` (10 µF MLCC) — DK 0. Commodity; deep stock at Mouser/Newark/Arrow (F12 noted DK's long *factory* lead — buy distributor stock).
- **C10** Panasonic `EEU-FR1C102` (1000 µF elec) — DK 0 (was ~4.5k last week). Commodity electrolytic; alt distributors / drop-in equivalents.
- **D3** Nexperia `PESD5V0S1BA,115` — DK backorder (known, F12 item 3); in stock at Farnell/Arrow.

**DV#5 disposition (owner):** the BOM is buildable — every line Active + Western-sourceable —
so #5 is honestly attestable as *available*, with the note that **C1/C10/D3 currently buy from
an alternate distributor (DigiKey out), not DigiKey**. No BOM change required unless you want
DK-single-cart sourcing, in which case sub an in-stock-at-DK equivalent for C1/C10/D3.

## RESOLVED — DK-stock subs applied 2026-06-20 (Pass 16)

Owner chose to sub the 3 DK-OOS lines for DK-in-stock equivalents (one-cart sourcing):
- **C1** → Murata `GRM21BR61E106KA73L` (3874 in stock) — originals kept as alt.
- **C10** → Panasonic `EEU-FM1C102` (2827) — same FM/FR family, drop-in.
- **D3** → Bourns `CDSOD323-T05C` (4083) — SOD-323, ~3 pF (better SI), clamp ~18.3 V (transient-ESD OK).

Parts created (`seed-l103-subs.ts`), bom.csv + design.md updated, BOM lines rewritten, strict-match
25/25 clean. **Live re-screen: all 25 lines Active + DK-in-stock — DV#5 "BOM availability (in stock)" earned.**
