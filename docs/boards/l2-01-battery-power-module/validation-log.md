# L2.01 Battery Power Module — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. Backs the board's `DESIGN_VALIDATION`
> attestations. First **safety-critical (Li-ion)** board — the Battery/Li-ion +
> deep-thermal + power-integrity conditionals are load-bearing.

| | |
| --- | --- |
| **Slug** | `l2-01-battery-power-module` |
| **Status** | **DRY ✓ (design-stage, part-ready)** — `[S]`/`[L]` audits owed at their phase |
| **Passes run** | 13 |
| **Last dry pass** | Pass 13 (2026-06-26) — zero new material findings |

## Gate (Definition of done — all must hold before any part/BOM/revision)

- [x] Requirements traced · pins accounted + sequencing proven (Pass 1–2)
- [x] Every number worst-case-proven · parts datasheet-verified (Pass 3–5); footprint `[S]` captured
- [x] Power integrity proven · every failure mode mitigated-or-accepted (Pass 7–8)
- [x] Every part hand-buildable + sourceable (exact import strings) (Pass 9–10)
- [x] Layout constraints captured `[L]` · teachable · consistent · pipeline-conformant (Pass 6,11,12)
- [x] **Li-ion + deep-thermal conditional audits run + clean (not waived)** (Pass 11)
- [x] Every applicable conditional audit run · every risk de-risked or scheduled (Pass 8,11)
- [x] **≥ 10 passes AND a dry pass achieved** (13 passes; Pass 13 dry)

**Owed at later phases (by nature, not skipped):** Audit 6 footprint↔symbol↔pinout
pad-by-pad `[S]` (verify once symbols chosen); Audit 11 fab-DRU DRC + keep-outs/ampacity
+ copper-pour-under-U1 `[L]`.

## Passes

<!-- one block per pass; severity CRITICAL/HIGH/MED/LOW; stop only on a dry pass, never before 10 -->

### Pass 1 — Requirements & traceability `[D]` (adversarial: hunt orphan reqs / unrequired parts)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 1-1 | LOW | Req 6 (USB input) didn't state the source-current need; a 500 mA host can't charge+load simultaneously | yes | Added "requires ≥1 A USB-C source; 500 mA throttles gracefully (F1 1.5 A no-trip)" to §1 req 6 | §1 updated |

Traceability holds: every req → topology net → calc (§3) → BOM line → risk (§6) → validation
item. No orphan requirement; no unrequired part (D1 TVS→req6, C9 bulk→power-integrity,
TP1/2→DFM test access). **Residual:** none material.

### Pass 2 — Topology / net integrity + sequencing `[D]` (every pin driven/pulled/NC)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2-1 | LOW | refDes labels diverged: §2 used `D_in`/`D_sys`, bom.csv uses `D1`/`D2` | yes | Renamed §2 + §8 to D1 (TVS) / D2 (load-share Schottky); D3 = boost rectifier | §2/§8 consistent w/ bom |
| 2-2 | MED | DW01A GND (pin6 = cell−) vs board GND/P− (after FETs) — distinct nodes; grounding could be mis-joined in layout | yes (DW01A app note) | Captured grounding rule as a `[L]` item in §2: cell− and P− star-joined only at Q1 | §2 grounding note added |

Pin accounting: U1 (5/5 used), U2 DW01A (OD/CS/OC/TD-NC/VDD/GND), Q1 FS8205A (common-drain
+ 2×S + 2×G to OD/OC), Q2 (G/S=VSYS/D=VBAT), U3 (SW/GND/FB/EN/VIN/FREQ-float), U4 (in/out/EN/GND/NC).
TD (DW01A pin4) parked NC per datasheet; FREQ floating = 600 kHz. Sequencing (plug / unplug /
cell-empty) proven in §2; hand-over via Q2 body diode + C9. **Residual:** none material.

### Pass 3 — Math audit `[D]` (re-derive every number, worst case, datasheet-checked)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3-1 | — | I_chg = 1000/5.1k = 196 mA; DS table 2.0k→505mA, 10k→100mA confirm 1000/R | yes (DS20001984H) | calc r1 holds | — |
| 3-2 | — | Boost V_OUT = 0.80·(1+52.3/10) = **4.98 V**; V_REF 0.78/0.80/0.82 (PWM) verified in DS EC table | yes (SLVSEX0A) | calc r4 holds (earlier WebFetch summary's 0.6 V was wrong) | — |
| 3-3 | LOW | Inductor min-L corner (±20% → 3.76 µH): ΔI_L = 3.0·0.4/(3.76µH·600k) = 0.53 A → I_peak 1.2 A (0.5A out) | yes | still ≪ I_sat; noted L-tolerance in calc | calc r7/r9 hold worst-case |
| 3-4 | — | SRN6045TA-4R7M **I_sat 6.8 A**, I_rms 4.5 A, DCR 26 mΩ — I_peak 2.06 A (1 A out) far under | yes (Bourns DS) | better than the ~3.7 A assumed; r9 margin larger | — |
| 3-5 | MED | FS8205A OCP trip = V_OC/(2·Rds) = 0.15/(2·0.028) ≈ **2.7–3 A** discharge (Rds 25mΩ@4.5V) | yes (FS8205A DS) | r16 quantified; feeds RK8 (fault-cut, not a fuse) | RK8 de-risked |

Every margin re-derived positive at worst case. **Residual:** none material.

### Pass 4 — Physics / first-principles `[D]` (what the equations assume away)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 4-1 | MED | **Boost runs the cell down to ~2.4 V** (boost UVLO falling 2.4 V = DW01A UVP) — below the ~3.0 V longevity cutoff | yes (both DS) | Added **RK11** (accept: DW01A guards damage; production gates EN at 3.0 V) + §2 note | RK11 logged |
| 4-2 | LOW | Cold-plug inrush into C9 (1000 µF) through D2+F1 | yes | Transient (ms) ≪ PTC I²t; SS34 I_FSM 100 A; VSYS usually pre-charged by cell → ΔV small. Bounded, accepted | note |
| 4-3 | — | D2 Schottky drop keeps VSYS ≤ 4.85 V < V_OUT 4.98 V → boost **always** has V_IN<V_OUT (never the degenerate Vin≈Vout case) | yes | confirms RK7 de-risk; happy side-effect of D2 | RK7 holds |
| 4-4 | — | Hand-over at unplug: Q2 gate τ = R7·Ciss ≈ 1M·500p ≈ 0.5 ms; body diode (VBAT→VSYS) conducts instantly + C9 holds | yes (DMG3415U) | no load interruption | RK4 holds |

**Residual:** none material (RK11 accepted+documented).

### Pass 5 — Part-truth (datasheet) `[D]` (per active part: abs-max, app circuit, pinout, levels)

| Part | Verified facts (primary DS) | OK? |
| --- | --- | --- |
| U1 MCP73831-2 | SOT-23-5 1=STAT 2=VSS 3=VBAT 4=VDD 5=PROG; V_REG 4.20 V (−2); I_REG=1000/R_PROG; V_DD 3.75–6 V (abs 7); θJA 230/130 °C/W; thermal foldback 125–135 °C; reverse-leak 2 µA; STAT tri-state (sink 25 mA / V_OL 0.4 V@4 mA → CHRG LED VBUS→470Ω→LED→STAT, on during charge) | ✓ |
| U2 DW01A | SOT-23-6 1=OD 2=CS 3=OC 4=TD(NC) 5=VDD(via R5) 6=GND; OVP 4.3/rel 4.1, UVP 2.4/rel 3.0, OCP 0.15 V, SCP 1.35 V; internal delay (no ext cap); needs dual-FET on B− | ✓ |
| Q1 FS8205A | SOT-23-6 dual common-drain N; V_DS 20 V; Rds 25 mΩ@4.5 V / 32 mΩ@2.5 V; pin1 D1/D2 common drain, S1/G1, S2/G2 | ✓ |
| Q2 DMG3415U-7 | P-ch SOT-23; V_DS −20 V; Rds 42.5 mΩ@−4.5 V, 71 mΩ@−1.8 V (low-Vth logic-level); body diode D→S = VBAT→VSYS; off-state V_gs=+0.2 V → off regardless of V_th | ✓ |
| U3 TLV61048 | SOT-23-6 1=SW 2=GND 3=FB 4=EN 5=VIN 6=FREQ; non-sync (ext Schottky D3); V_IN 2.65–5.5; UVLO 2.55/2.4; V_REF 0.80; I_lim 2.9 A min/3.7 typ; EN high ≤1.2 V (abs 6 V); FREQ float=600 kHz; L 2.2–10 µH, C_OUT ≥3 µF eff; soft-start 2 ms | ✓ |
| U4 RT9080-33 | TSOT-23-5; 3.3 V/600 mA; V_DO 0.53 V@600 mA; I_q 4 µA; stable w/ 1 µF in/out; EN | ✓ (catalog) |

All abs-max respected (FB 3.6 V > V_REF node; EN ≤ V_SYS 4.85 < 6 V; SW 18 V > 5 V).
**Residual:** none material.

### Pass 6 — Footprint ↔ symbol ↔ pinout `[S]` (CAPTURE at design; verify at schematic)

Intended footprints captured in §8. **No exact std-lib symbol** for DW01A / FS8205A /
TLV61048 / MCP73831 in the indexed KiCad-10 lib → use generic 6-pin / dual-NFET / boost /
charger symbols and **verify pad-by-pad once symbols are assigned (`[S]`)**. Reused parts
(USB-C, RT9080, SS34, passives, terminal, TP) carry catalog symbols/footprints already.
This audit **cannot close pre-schematic** — owed at `[S]`. **Residual:** `[S]` owed (expected).

### Pass 7 — Power integrity `[D]` (budgets, decoupling, brownout, regulator stability, OVP)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 7-1 | HIGH | **FB-divider open → boost V_OUT runs to 14 V ceiling** → over-volts 5V0, RT9080 (V_IN abs ~6 V) + downstream | yes | Added **RK10** (accept: 1 % film low-fail; production 6.2 V zener/OVP on 5V0; downstream has own input prot) | RK10 logged |
| 7-2 | — | Boost C_OUT: 2×10 µF X5R 0805 → ~10–12 µF effective after 5 V bias derating ≫ 3 µF min | yes | calc r19 holds | — |
| 7-3 | — | LDO stability: RT9080 stable with 1 µF in/out (C7/C8); boost output ripple cleaned by LDO PSRR | yes (catalog) | quiet-rail intent met | — |
| 7-4 | — | UVLO/protection coordination: boost UVLO 2.55/2.4 ≈ DW01A UVP 2.4; charger 4.20 < DW01A OVP 4.3 (backup) | yes | defense-in-depth ordering correct | — |

Decoupling: C1/C2 4.7 µF (charger), C3 0.1 µF (DW01A), C4 10 µF (boost Vin), C7 1 µF (LDO in),
C9 1000 µF bulk. **Residual:** none material (RK10 accepted+documented).

### Pass 8 — Failure modes (FMEA) `[D]`

| Mode | Effect | Mitigation | Status |
| --- | --- | --- | --- |
| Cell reverse-polarity (J2) | fire/destruction | keyed JST + silk +/− + guide + JST-PH convention (industry practice); series-block FET = production upgrade (traded vs efficiency) | RK1 de-risked (accepted) |
| Output short (5V0/3V3) | over-current | boost I_lim 2.9 A + thermal shutdown; LDO RT9080 OC/OT; DW01A SCP 1.35 V on cell side | de-risked |
| Charger fault (won't terminate) | cell over-charge | DW01A OVP 4.3 V cuts charge FET (backup to 4.20 V CV) | de-risked |
| Sustained over-current (discharge) | overheat | DW01A OCP ~2.7–3 A + boost I_lim; F1 only on input | RK8 de-risked (documented) |
| FB-divider open | boost OVP 14 V | RK10 (zener/OVP for production) | accepted/documented |
| Hot-plug USB | inrush | bounded by D2/F1 ESR + soft-start (4-2) | de-risked |
| Cell hot-swap / ESD | transient | D1 TVS on VBUS; DW01A delays; ceramics | de-risked |

**Residual:** none material — every mode mitigated-or-accepted-with-statement.

### Pass 9 — DFM / solderability `[D]` (against L2 envelope: leaded SMD + THT, no leadless)

All active parts SOT-23 / SOT-23-5 / SOT-23-6 / TSOT-23-5 — **no leadless** ✓. Passives 0805.
L1 SRN6045 = 6×6 mm (easy). D2/D3 SS34 = SMC (large but easy; RK9 notes SOD-123 alt). THT: J2
JST, J3 terminal, C9 electrolytic, SW1 slide, TP. Pin-1/polarity marks needed on U1–U4, Q1/Q2,
D1/D2/D3, C9, LED1/2 (silk `[L]`). Assembly order: SMD reflow/drag → THT hand. **Residual:** none.

### Pass 10 — Sourcing / lifecycle `[D]` (live DigiKey, exact import strings)

All 25 lines **Active**, live-stock-screened 2026-06-25 (§8 table). New parts: TLV61048DBVR
13 180 · SRN6045TA-4R7M 24 578 · DW01A 20 950 · DMG3415U-7 57 534 · S2B-PH-K-S 737 474 ·
EG1218 34 061 · 52.3k 2 836 · 1M 264 611. **FS8205A = 459 (thin)** → flagged 2nd source (two
discrete N-FETs / LSP8205S / BQ29700-class). Reused parts in the live catalog (byte-exact
`(manufacturer,mpn)` per the dump). **Residual:** FS8205A stock to re-screen at build (watchdog
PR #156 covers it) — non-blocking.

### Pass 11 — Conditional audits: **Li-ion safety** + **Deep thermal** `[D]` (load-bearing — NOT waived)

**Li-ion (`hasLiIon`):**
- Protection present + independent of charger: DW01A+FS8205A — OVP 4.3 V (cut charge FET),
  UVP 2.4 V (cut discharge FET), OCP ~2.7–3 A, SCP 1.35 V. ✓
- Charge limits: CC 196 mA, CV 4.20 V ±0.75 % (well below 4.3 V backup OVP); auto-recharge
  3.95 V; term ~15 mA. ✓ Hierarchy correct (charger controls; DW01A backstops).
- Discharge limits: UVP 2.4 V (+ boost UVLO). RK11 notes the 2.4 V vs 3.0 V longevity trade. ✓
- Mechanical/thermal containment: cell off-board on a keyed JST lead (not under the PCB); silk
  +/−; reverse handled per RK1. ✓
- **Verdict: clean.** No single point lets the cell over-charge, over-discharge, or short
  without a protection action.

**Deep thermal (`hasThermalConcern`):**
- Charger worst-case P = (5.25−3.0)·0.196 = **0.44 W**; θJA 130 °C/W (pour) → TJ ≈ 82 °C @25 °C
  / 97 °C @40 °C; θJA 230 (min Cu) → TJ ≈ 126/141 °C → thermal-regulation foldback guards.
  **Charge current was sized BY thermal** (196 mA via 5.1k) — copper pour under U1 = `[L]`.
- LDO P = 1.7·0.15 = **0.26 W** (3V3 bounded ≤150 mA by design); 5 V boost is the workhorse.
- Boost FET 85 mΩ, θJA 177.7 °C/W — negligible rise at ≤1 A.
- **Verdict: clean.** Worst-case junction temps bounded; foldback + thermal-shutdown backstops.

**Residual:** copper-pour-under-U1 verified at `[L]`.

### Pass 12 — Learnability + internal consistency + pipeline conformance `[D]`

- **Learnability:** the four discipline points each map to a visible sub-circuit — charging (B),
  load-share (D), switching regulation (E), LDO-after-switcher quiet rail (F) + protection (C).
  Coherent "one thing": *the reusable portable-power block.* L2-appropriate complexity. ✓
- **Consistency sweep:** refDes/values/quantities identical across §2/§3/§4/§6/§8 ↔ bom.csv
  after the D1/D2 fix (2-1). 5.1k = R1,R2,R3; 470 = R4,R5,R10; 10k = R6,R9; SS34 = D2,D3. No
  naming collision (risks RK#, refDes R#/D#/Q# distinct). ✓
- **Pipeline conformance:** flags `hasLiIon=true`+`hasThermalConcern=true` (set in PROD) → the
  two conditional DV items will materialize; `hasMainsNet`/`requiresStripboard` false. `[S]`/`[L]`
  items honestly owed; freeze = entering LAYOUT (HOLD). ✓
- Note for owner: the seeded REQUIREMENTS_REVIEW checklist is generic boilerplate (WS2812/servo/
  ADC1/antenna) — N/A for this board; tick/N-A at the REQUIREMENTS gate. DAG self-edges are seed
  noise (non-blocking). ✓

**Residual:** none material.

### Pass 13 — DRY sweep (fresh full re-read after all folds)

Re-read §1–§8 + bom.csv + every Pass-1–12 fix in place. Re-proved: traceability (P1), pin/seq
(P2), all calc margins worst-case (P3 — 196 mA charge, 4.98 V boost, I_peak 2.06 A ≪ 6.8 A I_sat,
OCP 2.7–3 A), part-truth (P5), power integrity incl. RK10 (P7), FMEA incl. RK1 (P8), Li-ion +
thermal clean (P11), consistency (P12). **Zero new material findings.**

**Residual after Pass 13: none — DRY.** Design-stage `[D]` gate **MET**. `[S]` (footprint↔pinout
pad-by-pad) and `[L]` (fab-DRU, keep-outs/ampacity, copper-pour-under-U1) explicitly owed at their
phases. Parts may now be created + BOM imported (pending owner go-ahead).
