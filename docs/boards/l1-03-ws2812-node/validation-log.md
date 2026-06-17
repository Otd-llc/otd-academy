# WS2812 Addressable-LED Driver (L1.03) — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log is what backs this board's
> `DESIGN_VALIDATION` attestations — when a tick is made, the proof is here.

| | |
| --- | --- |
| **Slug** | `l1-03-ws2812-node` |
| **Status** | `pass 3/≥10` — not yet dry, NOT part-ready |
| **Passes run** | 3 |
| **Last dry pass** | — |

## Gate (Definition of done — all must hold before any part/BOM/revision)

- [ ] Requirements traced · pins accounted + sequencing proven
- [ ] Every number worst-case-proven · parts datasheet- + footprint-verified
- [ ] Power integrity proven · every failure mode mitigated-or-accepted
- [ ] Every part hand-buildable + sourceable (exact import strings)
- [ ] Layout constraints captured · teachable · consistent · pipeline-conformant
- [ ] Every applicable conditional audit run · every risk de-risked or scheduled
- [ ] **≥ 10 passes AND a dry pass achieved**

---

## Passes

### Pass 1 — Electrical / first-principles (adversarial reviewer + owner notes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 1.1 | HIGH | VBUS budget used "~350 mA" LDO input — wrong: RT9080 is a **linear** LDO so Iin ≈ Iout ≈ **500 mA** at the WiFi-TX peak. Real worst case ~560 mA. | ✅ first-principles (linear LDO passes current ~1:1) + L1.01's own 500 mA figure | §3 budget rows recomputed (continuous ~220 mA; brief peak ~560 mA < 1 A trip, bulk rides it); RK4 reframed. | §3 numbers now match L1.01's regime; §5 budget paragraph updated to agree. |
| 1.2 | CRITICAL | **Data-before-power / parasitic power**: USB on + injection off → 5 V data into unpowered strip DIN → parasitic self-power through the DIN clamp diode. Owner confirmed + noted it's inevitable in class. | ✅ mechanism confirmed; **precision added** — the driver into the strip is the *onboard-pixel DOUT* (VBUS-powered), not the AHCT125 directly | Added **R8 (470 Ω)** on onboard-DOUT→J4 → limits clamp current to ~9 mA; documented power-up order; consolidated into new **RK8**. | §3 parasitic-current row = ~9 mA; §2 topology + power-up note; RK8 DE-RISKED. Exact DIN abs-max deferred to Pass 5. |
| 1.3 | MED | VOH margin "+0.9 V" overstated the *guaranteed* min (3.94 V @ 8 mA → +0.44 V). | ✅ TI datasheet VOH table | §3 states both: +0.9 V actual (µA load) / +0.44 V guaranteed; noted 0.7·VDD tracks VDD. | Both positive → RK1 still DE-RISKED, now honestly. |
| 1.4 | MED | §3 missing the required data-timing check. | ✅ AHCT125 tpd ~9–22 ns vs 1.25 µs WS2812 bit | Added a tpd-≪-bit row to §3. | Timing now backs the §7 datasheet attestation. |
| 1.5 | MED | "Board never carries strip current" was false for the J5→J4 5 V_EXT path. | ✅ topology trace | §1 E3 + §5 corrected; added a 5 V_EXT/GND trace-ampacity layout item (RK7). | §5 now states the copper is the limit (terminals ~15 A). |
| 1.6 | LOW | Data GPIO uncommitted ("e.g. IO5"). | ✅ GPIO5 is non-strapping, non-USB (USB = GPIO19/20) on the S3 | Committed **GPIO5** in §1 F2 / I2 / §2. | — |
| 1.7 | LOW | Unused-gate parking right, but the **used** gate's enable polarity must be explicit (AHCT125 OE active-low). Owner confirmed parking hygiene. | ✅ TI pinout | §2 + RK6: **gate 1 `1OE → GND` (enable)**; gates 2–4 `nOE → VCC`, `nA → GND`. | RK6 DE-RISKED with the used-gate exception pinned. |

**Residual after Pass 1:** exact WS2812 DIN abs-max input voltage (RK8) → Pass 5
datasheet audit. Layout items (RK7) scheduled to the layout stage by design.

### Pass 2 — BOM / sourcing / DFM / solderability (adversarial reviewer + owner notes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | CRITICAL | **Pixel not Western-orderable**: bare "Worldsemi / WS2812B" isn't stocked at Digikey/Mouser/Newark → fails the §8 sourcing bar (the L1.01-bridge trap). | ✅ distributor search | Switched LED3 to **XINGLIGHT `XL-5050RGBC-WS2812B`** (Digikey-orderable). §4/§8/BOM updated. | §8 sourcing bar now satisfiable; exact string to confirm at part creation. |
| 2.2 | HIGH | SK6812 / "Opsco" alt is **LCSC-only** — not a valid Western second source. | ✅ distributor search | Kept SK6812 as a *noted* electrical drop-in, explicitly LCSC-only (not relied on). | §8 second-source note honest. |
| 2.3 | HIGH | 5050 solderability under-rated; owner added the fix: **mandatory flux pen**. | ✅ WS2812B datasheet ("solder once", lens heat-sensitive) | RK5 raised to Med; de-risk = mandatory flux-pen guide step + temp-controlled iron ~315 °C / quick dwell + close-up; THT-pixel fallback noted. | RK5 has a concrete build-stage plan. |
| 2.4 | — | Connector family: reuse the **TB-1-POWER** vetted part. | ✅ found in `c:\zzz\otd\hardware\...\TB-1-POWER\docs\BOM.csv` (`282837-2`) + TE confirms `282837-3` 3-pos | J4 → **TE 282837-3**, J5 → **TE 282837-2** (replaced On-Shore ED120). §1/§2/§4/§8/BOM updated. | TE 282837-2/-3 verified real, in stock, 5.08 mm, 15 A, THT. |
| 2.5 | MED | SN74AHCT125D/N, EEU-FR1C102 — confirm real/stocked. | ✅ Digikey | Kept; in-stock confirmed. | — |
| 2.6 | LOW | Reused L1.01 `(mfr, mpn)` strings must match the library exactly (incl. "Würth" ü). | ✅ library lookup (all match) | No change; noted in §8. | Reused lines won't miss the strict import. |

**Residual after Pass 2:** confirm the XINGLIGHT exact `(manufacturer, mpn)` string at
part-creation time (sourcing audit closes then).

### Pass 3 — Process / pipeline / internal consistency (adversarial reviewer)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | HIGH | F1's stripboard rationale was wrong: `requiresStripboard` doesn't add a DESIGN_VALIDATION conditional — it materializes a **separate `STRIPBOARD_VALIDATION` checklist + BOM_SOURCING exit gate**. | ✅ `canonical-checklist-templates.ts:148-149` (DV conditionals = mains/Li-ion/thermal only) | Corrected Friction F1; flag stays false (custom PCB). | §7 confirmed exactly the 6 core items, no conditionals. |
| 3.2 | HIGH | §7 "all risks de-risked" can't be literally true while layout/build risks are open. | ✅ wording trace | §7 item 6 redefined to **design-stage** risks; RK5/RK7 explicitly close at build/layout. | §7 honestly checkable. |
| 3.3 | MED | Risk IDs `R#` **collided** with resistor refDes (acute with R7/R8 + RK7/RK8). | ✅ inspection | Renamed all risks to **`RK#`**; added a risk-ID note up top; logged as Friction F6. | No remaining `R#`-as-risk usage; §3↔§6 refs consistent. |
| 3.4 | LOW | Handoff doc referenced by the design is absent on main/this branch (only on PR #149). | ✅ `git`/`ls` | Logged as Friction F5; softened reliance. | — |
| 3.5 | LOW | "Reuses L1.01 part" undersold that R7/R8/C8/C9 are **new placements**. | ✅ | Wording clarified ("new placement of an existing part") in §3/§4. | — |
| 3.6 | — | Cross-section consistency re-check after all edits (refDes/values/qty across §1–§8 + BOM). | ✅ | Verified: 470 Ω = `R5,R6,R7,R8` qty 4 everywhere; 0.1 µF = `C2,C3,C7,C8,C9` qty 5; J4/J5/LED3/U3/C10 agree across §2/§3/§4/§8/BOM. | Consistency audit clean as of Pass 3. |

**Residual after Pass 3:** none from this lens. Note: this pass *re-proved* the
consistency lens against Passes 1–2 edits (the RK rename + connector swap + R8
addition all cross-checked).

---

## Remaining passes (the run is NOT done — 3/≥10, no dry pass yet)

Still owed, with fresh adversarial eyes each:
- **Pass 4 — Requirements & traceability + net integrity:** every F/E/I requirement
  → net → calc → BOM → risk → validation item; every pin of U3/LED3/J4/J5 accounted.
- **Pass 5 — Part-truth (datasheet), worst-case:** pad/number-level read of the
  74AHCT125 + XL-5050RGBC-WS2812B datasheets — incl. the **WS2812 DIN abs-max** that
  RK8 depends on, VDD range, data-timing windows, abs-max.
- **Pass 6 — Footprint ↔ symbol ↔ pinout:** pad-by-pad once symbols/footprints chosen.
- **Pass 7 — Power integrity (deep):** decoupling placement, C10 ESR/inrush, regulator
  stability margins.
- **Pass 8 — FMEA (deep):** beyond RK8/RK9 — ESD on exposed J4/J5, hot-plug, short
  across the strip output, brown-out recovery.
- **Pass 9 — Layout-readiness + learnability:** keep-outs, ampacity, data routing;
  and the L1 teachability of every new concept.
- **Pass 10+ — dry-pass attempts:** re-sweep all lenses until a pass yields zero new
  material findings. Only then is the board part-ready.
