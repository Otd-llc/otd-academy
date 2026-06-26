# Internal-ADC Analog Sensing (L1.05) — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log backs the board's
> `DESIGN_VALIDATION` attestations. The adversarial passes (4–10) were delegated to
> fresh, independent reviewers (one per audit lens) via a multi-agent workflow;
> **every load-bearing finding was verified against the actual datasheet (Espressif
> ESP32-S3 v2.2) or the live catalog/DigiKey before being folded in** — a skeptic
> agent re-checked each HIGH/CRITICAL and several were correctly downgraded.

| | |
| --- | --- |
| **Slug** | `l1-05-internal-adc` |
| **Status** | **`DRY ✓ (design-stage part-ready)`** |
| **Passes run** | 12 |
| **Last dry pass** | Pass 12 (2026-06-26) — zero new material findings |

## Gate (Definition of done — `[D]` design-stage)

- [x] Requirements traced · pins accounted + sequencing proven (ADC1-only constraint recorded; final pin → `[S]`)
- [x] Every number worst-case-proven · parts datasheet-verified (ADC numbers from datasheet v2.2 §4.2.2.1/§5; RV1/D2 web-verified)
- [x] Power integrity proven (passive front-end; ~1 mW worst dissipation) · every failure mode mitigated-or-accepted (RK1–RK9)
- [x] Every part hand-buildable + sourceable (exact import strings; 18/19 lines strict-match the live catalog; 1 new part RV1 DigiKey-screened in stock)
- [x] Layout constraints captured (RK11/RK12, `[L]`) · footprint↔pinout intent captured (RK10, `[S]`) · teachable · consistent · pipeline-conformant
- [x] Conditional audits: no mains/Li-ion/RF/stripboard flags fire; thermal sanity-checked (largest dissipator ~1.1 mW) → `hasThermalConcern=false` holds
- [x] Every risk de-risked or scheduled to `[S]`/`[L]`
- [x] **12 passes run AND a `[D]` dry pass achieved** (Pass 12)
- [x] `validation-log.md` complete

**Owed at later stages** (cannot honestly close pre-schematic, per protocol phasing):
`[S]` footprint↔symbol↔pinout pad-by-pad + final ADC1 pin assignment (RK10) · `[L]`
layout-readiness: analog routing/ground, antenna keep-out, trimpot screwdriver
keep-out (RK11/RK12) · `[L]` fab-DRU DRC.

**Owner items flagged for the REQUIREMENTS gate (not design defects, surfaced by Pass 10):**
the live `REQUIREMENTS_REVIEW` checklist for this board has a stray `Servo brownout
mitigation` item checked=true (copy-paste artifact, N/A here) and the applicable
`ADC1-only constraint recorded` item still unchecked — the owner should N/A the
servo/WS2812/auto-shutoff items and tick ADC1-only at the REQUIREMENTS gate.

## Passes

### Pass 1 — Requirements & traceability + initial design (engineer)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| — | — | Read the live `l1-05-internal-adc` project row + REQUIREMENTS_REVIEW checklist: SENSE/L1, criticalPath, FREE, all flags false; locked materialized requirement "ADC1-only constraint recorded (ADC2 unusable while WiFi/ESP-NOW active)". disciplineTaught = "internal ADC limitations (noise, nonlinearity); ADC1-vs-ADC2 with WiFi". | yes (DB) | Locked the board scope from the DB (not invented): L1.01 WROOM core (100% reuse) + analog front-end teaching the internal ADC's limits + the ADC1-only rule. Drafted F1–F6, topology, calc trail, BOM. Every F-req traces requirement → net → calc(K) → BOM → risk. | — |

**Residual:** none in this lens; numbers/sourcing/FMEA not yet adversarially attacked.

### Pass 2 — ADC part-truth / datasheet lock (engineer; web-verified)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | — | Pulled the authoritative ESP32-S3 ADC characteristics from the datasheet v2.2 + ESP-IDF: 2×12-bit SAR / 20 ch; ADC2 cannot be used with Wi-Fi (§4.2.2.1 Note); DNL ±4 / INL ±8 LSB, ≤100 kSPS, **characterized with an external 100 nF cap on the input, Wi-Fi disabled** (§5.5); total error after cal 12 dB = **±50 mV** on 0–2900 mV (§5.6); Vref 1100 mV (1000–1200); IO abs-max −0.3…3.6 V, I_leak ≤50 nA, C_IN 2 pF (§5.4); ESD HBM ±2 kV, latch-up ±200 mA (§5.8); GPIO3 floating JTAG strapping pin (§3); ADC1=GPIO1–10, ADC2=GPIO11–20. | **yes (datasheet + esp-idf, web)** | Locked every ADC number worst-case into the calc trail (K1–K14). Chose 12 dB attenuation + GPIO1/ADC1_CH0 (clean non-strapping ADC1) + 100 nF at the pin (matches the datasheet condition). | — |

**Residual:** numbers stated; not yet independently re-derived/attacked (Pass 4).

### Pass 3 — Sourcing / lifecycle + RV1 part-truth (engineer; live DigiKey + catalog)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | — | Live DigiKey screen (2026-06-26): RV1 Bourns 3362P-1-103LF 2,996 @ $0.96 Active; D2 CDSOD323-T05C 3,394 Active; R7/R8 RC0805FR-0710KL 3.96M; C8 CL21B104KBCNNNC 8.53M; J4 PRPC040SAAN-RC 68,482; core U1/U2/J1 Active. | yes (live API) | Recorded snapshots in §8. | — |
| 3.2 | — | RV1 part-truth (Bourns 3362 datasheet + distributors): 10 kΩ ±10 %, 0.5 W, single-turn, top-adjust, THT cermet, terminal 2 = wiper. Worst dissipation 1.1 mW ≪ 0.5 W; ±10 % tolerance irrelevant (ratiometric divider). | yes (web) | Confirmed RV1 §4 facts; noted the ratiometric-tolerance point. | — |
| 3.3 | — | Strict `(manufacturer, mpn)` catalog check via the project's own `parseBomCsv` + `findUnique`: 18/19 lines match the live catalog byte-for-byte; the 1 new part (RV1) is the only non-match. CSV parses clean (19 rows, 0 errors, refDes-count = qty on every line). | yes (Prisma read + parser) | RV1 to be created as `Bourns`/`3362P-1-103LF` (catalog convention, not DigiKey "Bourns Inc."). | — |

**Residual:** design now goes to the adversarial fan-out (Passes 4–10).

### Pass 4 — Math audit (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 4.1 | MED | K10 settling "~6 ms to 0.1 %" is wrong — 0.1 % needs 6.9τ = ~8.6 ms; 6 ms ≈ 5τ ≈ 1 %. | yes (re-derived) | Corrected K10 to "~8.6 ms to 0.1 % (6.9τ); ~6 ms to ~1 % (5τ)". Conclusion (invisible for a hand-turned pot) unchanged. | K10 |
| 4.2 | LOW | K5 "±68 LSB" inconsistent with K6's 1 LSB ≈ 0.76 mV → 50/0.76 = ±66 LSB. | yes | Corrected to ±66 LSB in K5 + the accuracy argument. | K5 |
| 4.3 | LOW | K11 0.36 mA understates worst-case injection (uses the 3.6 V abs-max, not the J4 injection bound). | yes | Re-derived K11 against the real injection bound (R8-limited at J4; D2-clamped AIN ≈ 18 V → (18−3.6)/10 k ≈ 1.5 mA into the GPIO). Still ~130× below the 200 mA latch-up trigger. | K11 (folds with Pass 7 R8) |

**Residual:** physics first-principles not yet attacked (Pass 5).

### Pass 5 — Physics / first-principles (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 5.1 | MED | K7/RK4 "rejects mains hum" is false — a 159 Hz corner barely attenuates 50/60 Hz (gain ≈ 0.95). | yes | Dropped "rejects mains hum"; K7/RK4 now state honestly: anti-alias bandlimit + RF shunt only; 50/60 Hz + sub-159 Hz shared-supply noise pass → the residual the averaging/teardown lesson addresses. | K7, RK4 |
| 5.2 | MED | K8 "the series-R value is non-critical" is unqualified but R7 IS load-bearing for f_c (K7), settle (K10), fault-limit (K11). | yes | Scoped to "non-critical *for the S&H sample only*"; cross-referenced where R7 is decisive (RK8 notes the 1 kΩ tradeoff costs 10× fault current). | K8, RK8 |
| 5.3 | MED | K7/K14 lean on "100 nF matches the datasheet condition" while the board runs Wi-Fi ON (the lesson) — datasheet figures are Wi-Fi-DISABLED, so they are a best-case floor. | yes | Added the Wi-Fi-disabled caveat to K7/K14: observed noise ≥ datasheet figures → reinforces the "isn't enough" arc. | K7, K14 |
| 5.4 | LOW | K8 "C_sh ≈ pin C_IN 2 pF" is a category error — 2 pF is the pin loading spec, not the internal S&H cap. | yes | Relabelled: C_IN 2 pF is the pin cap; S&H cap unpublished (~few pF); charge-share droop ≲ 1 LSB even at a generous 25 pF. Conclusion (100 nF makes source-Z irrelevant) survives. | K8 |
| 5.5 | LOW | K14 averaging presented without the decorrelation caveat (a fast burst within 1τ is correlated). | yes | Added: effective averaging needs samples spaced ≫ 1 ms (the RC τ); a fast burst mainly cuts HF. Strengthens the lesson (±50 mV floor survives). | K14 |
| 5.6 | OK | Core charge-sharing / aliasing / ESD-cap physics (K8 stiffness, K12 3 pF, K13 159 Hz « 50 kHz Nyquist, SAR kickback) check out. | yes | confirmed | — |

**Residual:** part-truth datasheet re-check pending (Pass 6).

### Pass 6 — Part-truth (datasheet) (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 6.1 | MED | K12/D2 "zero leakage / zero reading skew" is not datasheet-honest — CDSOD323-T05C I_leak ≤ 5 µA @ V_WM 5 V (the only non-worst-cased number in the trail). | yes (datasheet) | Reworded K12/§4: leakage ≤ 5 µA @ 5 V; through the ≤ 2.5 kΩ wiper → ≤ ~12 mV worst-case skew (5 V point), far less at 3.3 V — ≪ the ±50 mV K5 error. Budgeted alongside K9. | K12 |
| 6.2 | MED | K12/RK5 frame D2 as "the clamp that protects the pin", but D2 clamps at V_C 9.8 V @1 A / 18.3 V @17 A — *above* the 3.6 V GPIO abs-max. | yes (datasheet) | Split the roles in K12/RK5: **D2 shunts the bulk ESD/surge energy to GND at the exposed node; R7 (+R8) hold the residual current into the GPIO below latch-up** — the GPIO is not protected by D2's clamp level. Stated V_C explicitly. | K12, RK5 |
| 6.3 | LOW | RV1 "~270°" is the mechanical angle; electrical adjustment angle is 240° nom. | yes | Changed to "240° electrical / 270° mechanical". | §4 |
| 6.4 | LOW | K12 cites only the 5 V standoff, not the breakdown margin. | yes | Added V_BR(min) 6.0 V @1 mA → 3.3 V max sits below breakdown with >2.7 V margin → guaranteed off. | K12 |
| 6.5 | OK | RV1 lead order (terminal 2 = wiper) and GPIO1/ADC1_CH0 (valid non-strapping ADC1) both correct vs ground truth. | yes | confirmed | — |

**Residual:** FMEA on the exposed node pending (Pass 7) — the one with a real design change.

### Pass 7 — FMEA / failure-modes (adversarial, fresh eyes) — **design change**

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 7.1 | MED (claimed HIGH; skeptic-downgraded) | **Pot-vs-external contention / short through J4 was UNMITIGATED.** R7 is downstream of node AIN, so it only protects the GPIO; an external source or probe-slip short at J4-AIN drives the RV1 wiper directly (100s of mA, can burn the $0.96 pot) and back-feeds 3V3. Verified against the Bourns 3362 ratings; skeptic confirmed real but sized it MED (deliberate-misuse path, cheap sacrificial part, no safety issue — flags all false). | **yes (datasheet + skeptic)** | **DESIGN CHANGE: added R8 (10 kΩ, reuse RC0805FR-0710KL) between node AIN and the J4 header pin.** R8 current-limits ANY J4 fault/drive to ≤ V/10 kΩ (≈ 0.5 mA at 5 V, ≈ 0.33 mA on a rail short) → pot wiper ≪ rating, 3V3 back-feed sub-mA, GPIO doubly limited (R8+R7). Added **K15** + **RK9**; re-framed J4 as a high-Z probe + *current-limited* 0–3.3 V inject; raw AIN node is now internal (reachable only through R8). Silk "J4 0–3.3 V only". | K11, K15, RK9; bom.csv R8 (qty 3→4) re-verified import-ready |
| 7.2 | LOW (claimed HIGH; skeptic = false) | "3.6–5 V dead-zone": D2 doesn't clamp below ~5 V, so a 3.6–5 V sensor exceeds the GPIO abs-max. Skeptic: **false alarm** — the design already credits R7 (not D2) for DC over-voltage and current-limits to sub-mA (safe); only a wording polish is warranted. | yes (skeptic) | Tightened RK5 wording (D2 = ESD-only; R7/R8 = over-voltage current limit) + silk "0–3.3 V only". No hard clamp added (a 3.3 V-class TVS would leak on the legitimate sweep and corrupt the lesson). | RK5 |
| 7.3 | MED | "AIN short to a rail" (probe slip / bridge across J4) not enumerated; wiper-at-far-end short overstresses the pot. | yes | Now covered by the R8 fix (J4 access is through R8; the raw AIN node is internal) — added to RK9. | RK9 |
| 7.4 | OK | ADC2-by-mistake, GPIO3-strapping, ESD (HBM ±2 kV + D2), GPIO latch-up (R7) branches all correctly handled. | yes | confirmed | — |

**Residual:** R8 change must re-prove math/sourcing/consistency (Pass 11); DFM/pedagogy/consistency lenses pending (Passes 8–10).

### Pass 8 — DFM / solderability + sourcing (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 8.1 | OK | Package-by-package vs the L1 envelope: RV1 (THT 6 mm trimpot) + D2 (SOD-323 leaded, proven on L1.03) + R7/R8/C8 (0805) + J4 (THT 1×3) — no leadless, nothing < 0805, nothing harder than the L1.01 USB-C connector. | yes (web) | confirmed; optional `[L]` polish: trimpot screwdriver-access keep-out (added to RK12), SMD-first-then-THT assembly order (guide). | RK12 |
| 8.2 | OK | RV1 orderable/Active/multi-distributor with valid second sources (3386P / Vishay T7/TS53); **RV1 import string = `Bourns` (catalog) not "Bourns Inc." (DigiKey)** — explicitly handled in §8; refDes-count == qty on every merged line; all reused `(manufacturer, mpn)` match the catalog byte-for-byte (incl. `Würth Elektronik` ü). | yes (parts MCP + parser) | confirmed import-ready. | — |
| 8.3 | LOW | D1 provenance: l1-05 imports `STMicroelectronics`/USBLC6-2SC6 (matches catalog), but L1.01's design.md prose says "UMW USBLC6-2SC6". l1-05 correctly follows the catalog. | yes | Out of scope for this board (l1-05 import is correct); flagged for an L1.01-doc reconciliation. | — |

**Residual:** learnability + consistency lenses pending (Passes 9–10).

### Pass 9 — Learnability / pedagogy + altitude (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 9.1 | MED (claimed HIGH; skeptic-downgraded) | "**Bottom ~75 mV reads ≈ 0 / both ends clip**" is half-wrong: only the **top** hard-clips to 4095 (visible); the bottom ~75 mV is an *accuracy* floor — small **nonzero, still-changing** codes — not a flat shelf. A learner watching counts near 0 V would think the board is broken. Skeptic verified real, sized MED (prose-only, hardware fine). | **yes (re-derived + skeptic)** | Rewrote K4/RK2/§2: top = hard, watchable clip; bottom = accuracy degradation (nonzero codes), measured-and-named not seen. Re-scoped the visible lesson to the top clip + noise band + ±50 mV floor. | K4, RK2, §2 |
| 9.2 | MED | "**See nonlinearity**" overstated — INL/DNL (±8 LSB) is swamped by the ±50 mV (±66 LSB) band + the pot's own mechanical nonlinearity, so a beginner can't isolate code-level INL. | yes | Reframed RK3 + the "Teaches" cell + §1: the SEEN phenomenon is the **aggregate ±50 mV error band** + clip + noise; INL/DNL is named/bounded but **sub-dominant**, not a headline. | "Teaches", §1, RK3, K6 |
| 9.3 | MED | Altitude: five bundled concepts + heavy vocabulary (attenuation, eFuse cal, LSB, anti-alias, S&H, Nyquist) on a true-beginner board after "blink an LED". | yes | Added a concept-tiering block to §7: ONE takeaway = **"resolution ≠ accuracy"**; must-land = top clip / ±50 mV band / averaging / ADC1-only; demote Nyquist/S&H/anti-alias/INL-DNL to optional teardown asides the guide does not test. | §7, "Teaches" |
| 9.4 | LOW | "Learns the ADC1-only rule the hard way" contradicts "the failure is designed out at the pin". | yes | Reframed RK1/§2: the board **prevents** the trap; the guide **teaches** the rule narratively (TOLD, not experienced). | RK1, §2 |

**Residual:** internal-consistency + pipeline sweep pending (Pass 10).

### Pass 10 — Internal consistency + pipeline conformance (adversarial, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 10.1 | HIGH | **validation-log.md did not exist**, yet the design header claimed "DRY ✓ — 10 passes" and §8 cited "Pass 6". Hard gate violation per `_protocol.md` (the log must be complete before part-ready). | yes (file absent) | **Created this `validation-log.md`** recording the actual 12 passes; the header now matches a genuine DRY state. (This was a pre-written-optimistic-header error, now corrected.) | header, this log |
| 10.2 | MED | Live `REQUIREMENTS_REVIEW` checklist has a stray `Servo brownout` item checked=true (N/A here) and `ADC1-only constraint recorded` unchecked, contradicting K2/RK1's "recorded". | yes (DB) | Softened K2/RK1: the ADC1-only constraint is *captured in this design* and *to be ticked on the REQUIREMENTS_REVIEW checklist by the owner*. Flagged the stray servo-true + the owed N/A's for the owner at the REQUIREMENTS gate (see header note). | K2, RK1, §2, §7 |
| 10.3 | HIGH (skeptic = false/LOW) | `scripts/populate-curriculum-dag.ts:102` seeds `requiresStripboard: true` for l1-05 — contradicts the design's "false". Skeptic: **non-material** — `pnpm db:seed` only touches the `esp32-sensor-breakout` fixture, NOT l1-05; the script is a dead one-off; the **live PROD DB reads false** (matches the design). Known latent cross-board cleanup. | yes (skeptic + DB) | No design change (design matches the live DB). Flagged as the known latent fix (flip the 4 stale `true`s on a dedicated branch); out of scope for this board. | — |
| 10.4 | LOW | "ADC1-only" called a "materialized item" near §7 could read as a DESIGN_VALIDATION row; it's a REQUIREMENTS_REVIEW item. | yes | Clarified in K2 + §7 that it lives on REQUIREMENTS_REVIEW, distinct from the §7 DESIGN_VALIDATION rows. | K2, §7 |
| 10.5 | LOW | §8 cost addend "analog front-end ~$0.7" < RV1's own $0.96. | yes | Corrected to ~$1.0 (RV1 the only added line). | §8 |
| 10.6 | OK | refDes/values/quantities identical across §2/§3/§4/§6/§8 + bom.csv; K# vs RK# vs refDes namespaces disjoint; bomFrozenAt held null (matches live DB); §7 6 rows map 1:1 to the canonical template, no conditionals (flags all false). | yes (DB + grep) | confirmed | — |

**Residual:** the R8 design change (Pass 7) + all wording fixes must be re-proven holistically (Pass 11).

### Pass 11 — Re-proof after the R8 change + all fixes (engineer)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 11.1 | — | Re-ran math/physics/FMEA on the revised front-end (R8 added as a stub off AIN to J4): the **main signal path wiper→R7→C8→pin is unchanged → f_c 159 Hz holds** (K7); R8 is not in the ADC path so K9 offset (R7·I_leak) is unchanged; R8 closes RK9 (contention/short/back-feed) and re-bounds K11 (J4 fault ≤ 0.5 mA). | yes (re-derived) | confirmed the R8 change is isolated to J4 protection; no regression to the ADC reading. | K7, K9, K11, K15, RK9 |
| 11.2 | — | Re-verified the BOM after adding R8: `parseBomCsv` → 19 lines, 31 placements, **0 parse errors, exactly 1 unmatched (Bourns/3362P-1-103LF = RV1), 0 refDes/qty mismatch**. 10 kΩ line now `R1,R2,R7,R8` qty 4. | yes (parser + Prisma) | import-ready. | bom.csv |
| 11.3 | — | Whole-doc consistency re-sweep: top-clip "~200–400 mV", floor "~75 mV (nonzero)", ±50 mV/±66 LSB, f_c 159 Hz, ±100 mV Vref, 200 mA latch-up, "1 new part", $1.0 front-end, RK1–RK12 numbering — all reconcile across §1–§8 and bom.csv; no straggler "rejects mains hum"/"±68 LSB"/"6 ms to 0.1%"/"zero leakage"/"reads ≈ 0". | yes (grep) | clean. | whole doc |

**Residual:** confirm a full all-lens sweep yields nothing new (Pass 12).

### Pass 12 — DRY PASS — confirming all-lens sweep (adversarial framing, fresh eyes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 12.1 | — | Re-attacked the revised design across all lenses (requirements, math, physics, part-truth, FMEA, DFM, sourcing, pedagogy, consistency). All Pass 4–11 fixes are present and self-consistent; the R8 change is sound and isolated; every load-bearing ADC number re-checks against datasheet v2.2; the BOM is import-ready; the pedagogy framing is honest (top clip visible, bottom/INL named-not-seen, ADC1-only told-not-experienced). | **yes** | — | — |
| 12.2 | LOW | Residual non-blocking items, all already disclosed: the owner-side REQUIREMENTS_REVIEW state (10.2), the latent stripboard-seed cleanup (10.3), the L1.01-doc D1 provenance (8.3). None are design defects. | yes | Accepted / flagged for the owner. | — |

**Residual after this pass: NONE — DRY.** A full all-lens sweep of the revised design
yielded zero new material (CRITICAL/HIGH/MED) findings; only disclosed owner/cross-board
items remain. **Design-stage part-ready.** `[S]`/`[L]` audits remain owed at their stages.
