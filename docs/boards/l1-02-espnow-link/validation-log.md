# ESP-NOW Wireless Link Node (L1.02) — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. Backs the board's `DESIGN_VALIDATION`
> attestations.

| | |
| --- | --- |
| **Slug** | `l1-02-espnow-link` |
| **Status** | **`DRY ✓ (design-stage part-ready)`** — all `[D]` audits clean; `[S]`/`[L]` captured + owed |
| **Passes run** | 16 (14 core + 1 RF conditional + 1 dry sweep) |
| **Last dry pass** | Pass 16 (2026-06-25) — zero new material findings |

## Gate (Definition of done — all hold before any part/BOM/revision)

- [x] Requirements traced · pins accounted + sequencing proven (audits 1, 2)
- [x] Every number worst-case-proven · parts datasheet-verified (audits 3, 4, 5)
- [x] Power integrity proven · every failure mode mitigated-or-accepted (audits 7, 8)
- [x] Every part hand-buildable + sourceable (exact import strings) (audits 9, 10)
- [x] Layout constraints **captured** · teachable · consistent · pipeline-conformant (audits 11, 12, 13, 14)
- [x] Every applicable conditional audit run (RF, pass 15) · every risk de-risked or scheduled
- [x] **≥ 10 passes AND a dry pass achieved** (16 passes; dry at pass 16)
- [x] `validation-log.md` complete
- [ ] `[S]` footprint↔symbol↔pinout pad map (audit 6) — **owed at schematic stage**
- [ ] `[L]` antenna keep-out / USB diff pair / fab-DRU DRC (audit 11) — **owed at layout stage**

**Method note:** this board re-uses the L1.01 WROOM core verbatim, but every
load-bearing number was **re-derived from the part datasheets here** (not cited from
L1.01 blindly — RK1). GPIO claims were checked against the **VERIFIED module pinout**
in the live parts catalog. Adversarial stance per pass: *assume the reuse hides a
latent error.*

## Passes

### Pass 1 — Requirements & traceability `[D]`

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 1.1 | LOW | F8 "expose ADC1 pins" did not enumerate which header pins, risking a later contention with GPIO21/47 | yes | Enumerated J2 = GPIO1,2,4,5,6 (ADC1) + GPIO7–10 spares + power; **excludes** every used/strapping/USB pin | §2 GPIO-map row + pin-accounting note |
| 1.2 | LOW | TP1/TP2 had no requirement trace | yes | Test points serve bring-up measurements (golden-set CSV) — DFM/bring-up aid, same posture as L1.01 | noted §8 |

Traced F1–F8 → topology → calc → BOM → risk → DV item; no orphan requirement, no
unrequired part (J2 ← F8; TP ← bring-up). **Residual:** none.

### Pass 2 — Topology / net integrity `[D]` (logical net; pad map re-verifies at `[S]`)

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | MED | All 41 module pins not explicitly accounted; strapping GPIO3/45/46 + unused GPIO had no stated policy → a hidden floating-strap hazard | yes (against VERIFIED 41-pin catalog pinout) | Added a **pin-accounting policy**: GND/EPAD→GND, 3V3→rail, EN/BOOT/USB/USER/LINK assigned, **strapping 3/45/46 left NC at module-internal defaults**, spares→J2 or NC, no floating input read in firmware | §2 pin-accounting note |

Current return: GND plane + EPAD→GND. Sequencing: single 3V3 rail, EN POR RC (1 ms)
gives clean start; power-down = USB removal collapses rail, no multi-rail hazard.
**Residual:** none at `[D]`; exact pad map owed at `[S]`.

### Pass 3 — Math audit `[D]` (worst-case, re-derived)

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | MED | Thermal claimed "no concern" but the LDO **junction temp was never computed** | yes (RT9080 TSOT-23-5 θJA ≈ 250 °C/W) | Computed Tj = 30 + 250·0.27 = **98 °C** at continuous worst case (0.16 A), 27 °C under 125 °C Tj,max | §3 row + §5 |

Re-derived: dropout 0.53 V @ 600 mA → Vin,min 3.83 V ≪ 4.75 V (Type-C low-line) ✓;
LED I = (3.3−Vf)/470 = 3.2 mA red / 2.8 mA yellow, both < 40 mA pin abs-max ✓;
EN RC τ = 1 ms ✓; CC Rd 5.1 kΩ ✓; PTC 0.5 A hold vs 0.16 A continuous ✓. Units
checked. **Residual:** none.

### Pass 4 — Physics / first-principles `[D]`

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 4.1 | LOW | Does 10 µF bulk ride the WiFi-TX burst without tripping brownout? | yes (computed) | ΔV = ΔI·Δt/C ≈ 0.34 A·10 µs/10 µF ≈ **0.34 V** dip over the LDO loop-response window → 3.3 → ~2.96 V, above the ESP32-S3 brownout (~2.7–3.0 V). RT9080 fast transient + bulk adequate; identical to the **shipping** L1.01 config | accept (no change) |

SI: USB FS (12 Mbps) short length-matched D± through USBLC6 → `[L]`. RF: 2.4 GHz PCB
antenna detuning → keep-out (RK5). Inrush: 10 µF charge inrush modest, PTC + host
limit. Decoupling matches Espressif WROOM-1 reference (10 µF + 0.1 µF near 3V3).
**Residual:** none material.

### Pass 5 — Part-truth (datasheet) `[D]`

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 5.1 | — | Confirm GPIO21 + GPIO47 are real exposed, safe pins on the N16R2 module | yes | VERIFIED catalog pinout: **pin 23 = IO21**, **pin 24 = IO47** — both plain GPIO, neither strapping (0/3/45/46), neither USB (19/20), neither octal-PSRAM (35–37, and N16R2 is quad anyway) | confirms RK2/RK3 |

U1 native-USB GPIO19/20, strapping set, power domains — VERIFIED. U2/D1/F1 datasheet
facts re-used from L1.01's verification (same parts). **Residual:** none.

### Pass 6 — Footprint ↔ symbol ↔ pinout `[S]` (captured; verifies at schematic)

Re-uses L1.01's chosen KiCad symbols/footprints/3D for every part (all parts
identical). Per protocol, the pad-by-pad cross-check **cannot honestly close
pre-schematic** — captured here, **owed at `[S]`** before layout. **Residual:** the
`[S]` audit (gate item, tracked).

### Pass 7 — Power integrity `[D]`

Budget: 600 mA LDO vs 500 mA brief peak / 160 mA typ ✓. Decoupling: 10 µF bulk +
0.1 µF×2 module + 1 µF×2 LDO ✓. Brownout: pass 4.1 dip 0.34 V within margin ✓.
Regulator stability: 1 µF ceramic in/out per RT9080 ✓. Fuse coordination: PTC
0.5 A hold / 1 A trip vs draw → RK9 ✓. **Residual:** none.

### Pass 8 — Failure modes (FMEA) `[D]`

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 8.1 | MED | **Expansion header** exposes raw GPIO + 5 V/3V3/GND to jumper wires — a learner could feed 5 V into a 3.3 V GPIO or short a rail; this FMEA path was not in the register | yes | Added **RK10**: header excludes used/strapping/USB pins, silkscreen-labels each pin, lesson teaches "5 V never into a GPIO" (E3); 3V3 OC/OT-protected, VBUS PTC-fused. Accept + label | §6 RK10 |

Reverse polarity: USB-C reversible/keyed ✓. Hot-plug/ESD on USB: PTC + USBLC6 ✓.
Short on 3V3: RT9080 OC/OT ✓. Button mis-press / BOOT glitch: recoverable ✓.
Latch-up: single rail, no sequencing path ✓. **Residual:** RK10 accepted-with-label.

### Pass 9 — DFM / solderability `[D]`

Every package within the L1 envelope (identical to L1.01, which validated it): WROOM
castellated (iron-solderable edge pads), RT9080 TSOT-23-5 + USBLC6 SOT-23-6 (leaded),
USB4110 right-angle SMT + THT retention posts, passives 0805, buttons/headers/test-points THT. **No leadless, no
package ≥ risk vs L1.01.** Pin-1/polarity/courtyard → layout. **Residual:** none.

### Pass 10 — Sourcing / lifecycle `[D]`

Live DigiKey snapshot (2026-06-25) — all 17 lines **matched, lifecycle = Active,
comfortably in stock** (stock 8.5 k → 8.5 M; build qty ≤ 3). Exact `(manufacturer,
mpn)` strings recorded byte-for-byte = the curated-catalog strings the strict BOM
import matches. Second sources: ESD UMW `USBLC6-2SC6`, PTC Bel Fuse `0ZCJ0050FF2G`.
Cost ≈ $13.50/node vs ~$13–14 target ✓. **100 % reuse — zero new parts to create.**
**Residual:** none. (Owner re-confirms stock visually post-hoc per the review checklist.)

### Pass 11 — Layout-readiness `[L]` (captured; verifies at layout)

Captured constraints: **antenna keep-out** (module on board edge, no copper under PCB
antenna — RK5, now load-bearing); **USB D± diff pair** short + length-matched through
USBLC6 (RK6); VBUS trace ampacity (~0.5 A, modest); ground strategy; **fab `.kicad_dru`
DRC** before gerbers. **Owed at `[L]`** (gate item, tracked). **Residual:** the `[L]` audit.

### Pass 12 — Learnability / pedagogy `[D]`

One thing it teaches — **peer-to-peer wireless (ESP-NOW pairing, TX/RX roles, channel
+ MAC addressing)** — is coherent and isolated: the proven L1.01 core is re-used so
the new cognitive load is *only* the radio, not new soldering. Complexity matched to
L1 (builds on the DAG `FOUNDATION` L1.01). Identical symmetric peers mirror real RF
eval-kit practice. **Residual:** none.

### Pass 13 — Internal consistency `[D]`

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 13.1 | MED | **Naming collision** the protocol calls out by name: risk IDs `R1–R9` vs resistor refDes `R1–R6` | yes | Renamed all risks **`RK1–RK10`**; updated every cross-ref (§1 E4, §3, §5, §7) | re-scanned doc |
| 13.2 | LOW | Cap numbering had a **gap** (C1,C2,C3,C5,C6,C7 — C4 skipped, inherited from L1.01) | yes | Renumbered contiguous: EN cap C7→**C4**; 0.1 µF group now C2,C3,C4; 1 µF C5,C6; updated §2/§3/§4/§8 + bom.csv | re-scanned doc + csv |

Re-proof: re-scanned refDes / values / quantities across §2, §3, §4, §8, and
`bom.csv` — every refDes-count equals its BOM quantity (C2,C3,C4=3; C5,C6=2; R-pairs=2;
SW1,SW2,SW3=3), values agree, no remaining collision or gap. **Residual:** none.

### Pass 14 — Pipeline conformance `[D]`

Project flags now all **false** (`requiresStripboard` was a seed-time hallucination —
**corrected in prod 2026-06-25** for l1-02/04/05). Seeded REQUIREMENTS items resolved:
WS2812/servo = N/A; **ADC1-only constraint recorded** (§1, header exposes ADC1);
**auto-shutoff strategy** = USB wall/PC source + continuous-radio draw (E4/RK8);
**antenna keep-out** confirmed (M1/RK5). DV checklist = the 6 core items, each honestly
checkable. Freeze semantics understood — **held** before LAYOUT. **Friction logged**
(below). **Residual:** none.

### Pass 15 — RF / regulatory (conditional audit — fires because the radio is load-bearing)

ESP32-S3-WROOM-1 is a **pre-certified module** (FCC/IC/CE); no board-level radiator
cert provided the **antenna keep-out** is honored (RK5, verified at `[L]`). 2.4 GHz
ESP-NOW over the **on-module PCB antenna** — no external antenna, no RF connector, no
matching network on the board. Channel selection + peer MAC are firmware (RK4/RK7);
emissions governed by the module cert. **Residual:** keep-out owed at `[L]`.

### Pass 16 — DRY sweep (re-run all `[D]` lenses after the fixes)

Re-ran requirements, net integrity, math, physics, part-truth, power, FMEA, DFM,
sourcing, learnability, internal consistency, pipeline against the **revised**
design.md (pin-accounting policy, Tj proof, RK10, RK# rename, contiguous caps,
header enumeration). **Zero new material findings.** All `[D]` audits clean; `[S]`
(audit 6) and `[L]` (audit 11) remain explicitly **captured + owed** at their stages.

**Residual after this pass: none — DRY.** Board is **design-stage part-ready**: parts
may be created and the BOM imported. It is **not yet fab-ready** — the `[S]` footprint
pad-map and `[L]` keep-out / DRU audits gate schematic→layout→gerbers.

---

## Friction log (pipeline-conformance deliverable)

1. **Hallucinated `requiresStripboard=true`** on l1-02/04/05 (l1-01/03 were false) —
   a seed-time error; corrected in prod 2026-06-25 (owner: "no stripboards, ever").
   The flag drives the conditional Stripboard audit, so a stale `true` would have
   demanded a phantom audit.
2. **Seeded REQUIREMENTS checklist is generic**, not board-specific — it still lists
   WS2812/servo items on an ESP-NOW board (correctly N/A here, but noise). The
   board-specific scope lives in `design.md`, not that checklist.
3. **Reuse-heavy boards** (100 % existing parts) make audits 6/9/10 fast but the
   protocol still demands re-deriving the numbers (audits 3/4/7) — RK1 is the guard
   against rubber-stamping a copied core.
