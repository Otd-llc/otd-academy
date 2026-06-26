# Single-Servo Driver (L1.04) — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log backs the board's
> `DESIGN_VALIDATION` attestations. Adversarial passes were delegated to fresh
> reviewers; **every load-bearing finding was verified against the actual
> datasheet (web) or the live catalog/DigiKey before being folded in.**

| | |
| --- | --- |
| **Slug** | `l1-04-single-servo` |
| **Status** | **`DRY ✓ (design-stage part-ready)`** |
| **Passes run** | 10 |
| **Last dry pass** | Pass 10 (2026-06-25) — zero new material findings |

## Gate (Definition of done — `[D]` design-stage)

- [x] Requirements traced · pins accounted + sequencing proven (incl. both-rail sequencing, RK12)
- [x] Every number worst-case-proven · parts datasheet-verified (F2/D2/D3 web-verified)
- [x] Power integrity proven · every failure mode mitigated-or-accepted (RK1–RK7, RK11–RK13)
- [x] Every part hand-buildable + sourceable (exact import strings, 20/22 lines strict-match the live catalog; 3 new parts DigiKey-screened in stock)
- [x] Layout constraints captured (RK8/RK9, `[L]`) · footprint↔pinout intent captured (RK10, `[S]`) · teachable · consistent · pipeline-conformant
- [x] Conditional audits: no mains/Li-ion/RF/stripboard flags fire; thermal sanity-checked (largest dissipator ~0.089 W, worst single-fault ~0.75 W in D2, both in-rating) → `hasThermalConcern=false` holds
- [x] Every risk de-risked or scheduled to `[S]`/`[L]`
- [x] **10 passes run AND a `[D]` dry pass achieved** (Pass 10)
- [x] `validation-log.md` complete

**Owed at later stages** (cannot honestly close pre-schematic, per protocol phasing):
`[S]` footprint↔symbol↔pinout pad-by-pad (RK10) · `[L]` layout-readiness keep-outs +
ampacity + ground strategy (RK8/RK9) · `[L]` fab-DRU DRC.

## Passes

### Pass 1 — Requirements & traceability + initial design (engineer)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| — | — | Every F-req (F1–F6) traces requirement → topology net → calc (K-row) → BOM line → risk. Servo-power decision (separate external rail) is mandated by the materialized REQUIREMENTS item "Servo brownout mitigation strategy chosen (bulk cap + separate supply rail)." | yes (DB checklist) | Locked the separate-external-rail topology; built the calc trail + BOM (22 lines, 33 placements). | — |

**Residual:** none in this lens; sourcing/math not yet adversarially attacked.

### Pass 2 — Math & power integrity (adversarial, fresh eyes; web datasheets)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | CRITICAL | Stall current "≤0.7 A" not honest worst case — "SG90-class" includes MG90S (750 mA ±10% @4.8 V → ~0.9 A @5.5 V). | yes (TowerPro MG90S datasheet) | Re-baselined K2 stall to **≈0.9 A (0.95 A computed)** worst case; bounded the supported class (≤ MG90S micro; MG996R-class explicitly out of rating). | re-proved K3–K6, K14 at 0.9 A |
| 2.2 | HIGH | PTC drop/dissipation used an invented R 0.2–0.3 Ω; datasheet R_typ 0.04 Ω. | yes | Replaced with datasheet R; recomputed (see Pass 8 final R1max). | K5/K6 |
| 2.3 | HIGH | I_hold 1.1 A vs ~0.9 A hot-derated stall = ~0 margin → could nuisance-trip on a legit stall mid-demo. | yes | **Bumped F2 → miniSMDC150F-2 (I_hold 1.5 A)**; DigiKey-screened in stock. | re-proved K4 |
| 2.4 | MED | SMAJ5.0A V_wm 5.0 V on a 5.5 V-max rail sits on the leakage knee. | yes (Littelfuse SMAJ ds) | **Switched D3 → SMAJ6.0A (V_wm 6.0 V)**; DigiKey-screened in stock. | re-proved K7/K8 |
| 2.5 | MED | Brownout "0 A on logic rail, any servo size" overreaches — shared GND has residual bounce. | yes | Softened §3 to "cannot brown out *from rail sag*"; named shared-ground bounce as the residual (→ RK8). | §3 |
| 2.6 | LOW | RT9080 dropout "0.53 V" is max not typ (310 mV typ). | yes (Richtek ds) | Clarified §3 as "310 mV typ / ~0.5 V max." | §3 |
| 2.7 | LOW | C12 GPIO-injection "within tolerance" — Espressif publishes no hard injection limit. | yes (ESP32-S3 ds) | Reframed K12: ~3 mA effective into clamp; abs-max flagged **unverified**. | K12 |
| 2.8 | LOW | Servo V_IH "2.5 V" uncited. | yes | Reframed K13 as empirical (not a datasheet number). | K13 |

**Residual:** part swaps (F2, D3) need re-verification of package + ratings (Pass 3).

### Pass 3 — Part-truth (datasheet) + protection topology (adversarial)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | CRITICAL | D2 SS34-E3/57T package is **SMC/DO-214AB, not SMA** (the "-E3/57T" suffix is the SMC variant; SMA variant SS34A-E3/61T is **not stocked** at DigiKey). | yes (Vishay ds 88751 + DigiKey + re-screen) | Corrected package to **SMC/DO-214AB** in §1/§4/§5/§6/§8; kept SS34-E3/57T (SMC is larger → easier to hand-solder + better crowbar-surge body). | RK10 note added |
| 3.2 | OK | Reverse-polarity shunt-Schottky + PTC crowbar mechanism correct; SS34 I_FSM 100 A carries the fault until F2 trips; −0.4 V clamp protects C8 electrolytic + servo. | yes | confirmed | — |
| 3.3 | OK | D3 SMAJ6.0A is unidirectional, correct orientation (cathode→VSERVO) for a positive rail; clamp 10.3 V < C8 16 V. | yes | confirmed | — |
| 3.4 | OK | Servo connector order GND/V+/SIG (V+ center) is the genuine safe convention. | yes | confirmed | — |

**Residual:** package-corrected; full FMEA/physics re-proof pending (Pass 4).

### Pass 4 — FMEA + physics + net-integrity (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 4.1 | HIGH | **SIG back-feed into an unpowered MCU** (VSERVO live, USB absent) analyzed only in the wrong direction; servo SIG-pull can source back through R7 → GPIO4 ESD clamp. | yes (bounded analysis) | Added **K15 + RK12**: R7 bounds worst case to ~9.5 mA; mitigation = power USB first; accepted residual (no series blocking diode — would drop the PWM). | K15/RK12 |
| 4.2 | HIGH | **Reverse-polarity from a current-limited supply** that never reaches I_trip → D2 conducts steady-state; §5 "D2 = 0 W transient-only" was dishonest. | yes | Added **RK13**; qualified §5: D2 ~0.75 W continuous worst case, within SS34's 3 A / ~1.5 W rating on DO-214AB copper. | §5/RK13 |
| 4.3 | MED | Back-EMF physics incomplete — servo's internal H-bridge recirculates most energy; D2(neg)+D3(pos) bound both rails. | yes | Added to K8/RK3. | K8 |
| 4.4 | MED | Ground-bounce characterization incomplete (di/dt term + SIG-referenced-to-bouncing-ground). | yes | Expanded RK8 (IR + L·di/dt + SIG-return jitter). | RK8 |
| 4.5 | HIGH | Stale "D3 SMAJ5.0A" in §2 sub-circuit list contradicts SMAJ6.0A everywhere else. | yes | Fixed §2 line. | grep-clean |

**Residual:** consistency/DFM/pedagogy sweep pending (Pass 5).

### Pass 5 — DFM/solderability + learnability + internal consistency + sourcing + pipeline (adversarial)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 5.1 | MED | §3 calc-row IDs C1…C14 **alias component refDes** (C1/C5/C6/C8/C9) — a cross-reference trap. | yes | Renamed calc rows **K1…K15**; added a namespace note; updated all prose refs. | grep-clean |
| 5.2 | LOW | §1 "PTC ~0.12 W" vs §3/§5 "0.065 W" numeric drift. | yes | Reconciled (see Pass 8 final 0.089 W). | §1/§5 |
| 5.3 | MED | Protection-stack density vs true-beginner altitude. | n/a (design ok) | Recorded a **pedagogy-framing decision** in §7: guide foregrounds rail-separation + bulk cap; frames D2/D3/F2 as "guard rails." No design change. | §7 |
| 5.4 | LOW | Confirm F2 second source (Bel Fuse 0ZCG0150FF2C) clears I_trip/V_max. | yes | Noted in §8 (1.5 A, 3 A trip). | §8 |
| 5.5 | OK | refDes/MPN/qty fully reconcile design.md ↔ bom.csv; folded lines (C2,C3,C7,C9=4; J2,J3,J5=3; R5,R6,R7=3) correct; all packages in L1 hand-solder envelope. | yes | confirmed | — |

**Residual:** numeric reconciliation of PTC dissipation pending final R value (Pass 8).

### Pass 6 — Sourcing / lifecycle re-proof (engineer; live DigiKey + catalog)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 6.1 | — | Live DigiKey screen (2026-06-25): all servo lines + core spot-checks **Active, in stock** (F2 miniSMDC150F-2 8.6 k; D2 SS34-E3/57T 15.8 k; D3 SMAJ6.0A 65.7 k; C8 EEU-FM1C102 1.8 k; J4 282837-2 162 k; etc.). | yes (live API) | Recorded snapshots in §8. | — |
| 6.2 | — | Strict `(manufacturer, mpn)` catalog check: **20/22 lines match the live catalog byte-for-byte; the 3 new parts (F2/D2/D3) are the only non-matches** (to be created at commit). CSV parses clean (22 rows, 0 errors, refDes-count = qty). | yes (Prisma read + parser) | — | — |

**Residual:** holistic dry-pass attempt (Pass 7).

### Pass 7 — Holistic all-lens sweep (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 7.1 | HIGH | F2 V_max stated **8 V**; miniSMDC150F-2 is **6 VDC** (the 8 V member is the 1.1 A 110F; the old rating was carried across the part swap). | yes (Pass 8) | see Pass 8. | — |
| 7.2 | MED | validation-log.md still empty scaffold. | yes | This log (completed). | — |
| 7.3 | OK | Confirmed all Pass 2–5 fixes genuinely resolved (stall, PTC, TVS, SS34 package, K-rename, RK12/RK13, RK8, §2 typo). | yes | — | — |

**Residual:** V_max correction (7.1) → Pass 8.

### Pass 8 — V_max correction + re-proof (engineer; web-verified)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 8.1 | HIGH | miniSMDC150F-2 V_max = **6 VDC** (Farnell/element14 "RESET 6V 1.5A 1812"; `/16-2`,`/24-2` are the higher-V variants). 6 V still > 5.5 V rail max but margin is 0.5 V, not "≫". | **yes (web)** | Corrected to 6 V in K4/§4/RK5; stated 0.5 V margin honestly; made the **rail ceiling 5.5 V explicit** (K1/E2: "not a 6 V supply"); confirmed F2 (6 V) + D3 (6.0 V) are co-consistent at that ceiling. | re-proved K1/K4/RK5 |
| 8.2 | LOW | R1max is 0.11 Ω (datasheet), not 0.08 Ω. | yes (web) | K5 drop ≤0.10 V; K6 dissipation 0.9²×0.11 ≈ **0.089 W**; reconciled §1/§5. | K5/K6 |

**Residual:** confirm no straggler / new contradiction (Pass 9–10).

### Pass 9 — Internal-consistency re-sweep (engineer)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 9.1 | — | Whole-doc grep: zero remaining "8 V"/"≫"/old-MPN/old-dissipation stragglers; corrected values present everywhere; refDes/MPN/qty reconcile design.md ↔ bom.csv. | yes | — | — |

**Residual:** none found — proceed to confirming dry pass.

### Pass 10 — DRY PASS — confirming all-lens sweep (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 10.1 | — | V_max fix fully + consistently applied (K4/§4/RK5/K1/E2/§1/§5 all agree: 6 V, 0.089 W, 5.5 V ceiling). F2 (6 V) + D3 (V_wm 6.0 V) mutually consistent on a 5.0 V-nom/5.5 V-max rail; no place claims a 6 V supply. Datasheet facts (F2/D2/D3) re-verified by web. | **yes** | — | — |
| 10.2 | LOW | K2 carries 0.9 A while the scaled compute is ~0.95 A (conservative; margins hold at 0.95 A). | yes | Added the 0.95 A computed value + margin note to K2. Non-blocking. | K2 |
| 10.3 | LOW | ESP32-S3 per-pin injection abs-max self-flagged unverified (R7 few-mA bound stands regardless). | yes | Accepted residual (already disclosed in K12/K15). | — |

**Residual after this pass: NONE — DRY.** A full all-lens sweep yielded zero new
material (CRITICAL/HIGH/MED) findings; only two pure-LOW nitpicks, both addressed or
accepted. **Design-stage part-ready.** `[S]`/`[L]` audits remain owed at their stages.
