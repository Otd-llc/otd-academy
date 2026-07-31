# DRV8833 DC Motor Driver (L2.03) — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log backs the board's
> `DESIGN_VALIDATION` attestations. Adversarial stance rotated every pass;
> **every load-bearing finding was verified against the actual datasheet (web) or
> the live DigiKey/parts-library catalog before being folded in.**

| | |
| --- | --- |
| **Slug** | `l2-03-motor-driver` |
| **Status** | **`DRY ✓ (design-stage part-ready)`** |
| **Passes run** | 12 |
| **Last dry pass** | Pass 12 (2026-07-30) — zero new material findings |

**Primary sources used (all read, not recalled):** TI **DRV8833 SLVSAR1E**
(Jan 2011, rev. Jul 2015) — read in full, pp. 1–17. Espressif **ESP32-S3 datasheet
v2.2** — §5.1 abs max, §5.2 recommended operating, §5.4 DC characteristics
(Table 5-4), §5.6 current consumption (Table 5-7). Richtek **RT9080 DS9080-09**
(Dec 2024) — §7 pin config, §10 abs max, §12 recommended operating, §13 thermal,
§14 electrical characteristics. Vishay **SS32–SS36 doc 88751** (rev. 23-Apr-2020) —
maximum ratings, electrical + thermal characteristics, Figs. 1–2. Littelfuse
SMAJ6.0A and miniSMDC150F-2 figures carried from the already-validated l1-04 run of
the same two parts. Pololu 6 V micro-metal-gearmotor product specifications.
Live **DigiKey** API screen 2026-07-30 (49 MPNs across three passes) and the
read-only **parts MCP** for library membership.

## Gate (Definition of done — `[D]` design-stage)

- [x] Requirements traced (F1–F12 → topology net → K-row → BOM line → risk) · every
      pin of every part accounted for · power-up/down sequencing proven both ways
- [x] Every number worst-case-proven (K1–K24, B1–B4) · every new active part
      datasheet-verified against its **own** datasheet
- [x] Power integrity proven (rail budget, decoupling, LDO headroom under load step,
      brownout path) · every failure mode mitigated-or-accepted (RK1–RK17)
- [x] Every part hand-buildable within the L2 envelope + sourceable with exact
      `(manufacturer, mpn)` import strings, live-screened Active + in stock
- [x] Layout constraints captured (RK8/RK10/RK15, `[L]`) · footprint↔pinout intent
      captured incl. the PW-vs-WQFN pin-map trap (RK9, `[S]`) · teachable ·
      internally consistent · pipeline-conformant
- [x] **Conditional audits: deep-thermal RUN (Pass 7) → recommends
      `hasThermalConcern = true`; battery/Li-ion RUN (Pass 8) → recommends the flag
      stay `false` (the audit fires on substance; the flag would materialise a
      foreign "cell placement / venting" row). RF/regulatory RUN (Pass 5/11).
      Mains and stripboard do not apply.**
- [x] Every risk de-risked, accepted with a stated bound, or scheduled to `[S]`/`[L]`
- [x] **12 passes run AND a `[D]` dry pass achieved** (Pass 12)
- [x] `validation-log.md` complete

**Owed at later stages** (cannot honestly close pre-schematic, per protocol phasing):
`[S]` footprint↔symbol↔pinout pad-by-pad, **especially U3** (RK9) · `[L]`
layout-readiness: ground strategy + ampacity + sense-return + antenna keep-out +
motor/antenna separation (RK8, RK10, RK15) · `[L]` fab-DRU DRC · `[L]` final outline.

**Owner actions this run surfaced (outside this board):**
1. **L2.01 `design.md` F-req 4, §3 r8–r10 and §5 must be restated at ≥ 1.0 A / 1.35 A
   peak** output, not ≥ 500 mA (Pass 4, RK1). Its own numbers already support it.
2. **L2.01 should carry an output-side PTC** — its boost output has no current limit,
   so L2.03's F2 is presently the only protection on the whole path (Pass 8).
3. **L2.01 §8 specifies `CL21A106KOQNNNE`, which is stock 0 at DigiKey** (Pass 9).
4. **Set `hasThermalConcern = true` on this project** (Pass 7); leave `hasLiIon`
   false (Pass 8).

## Passes

### Pass 1 — Requirements & traceability + initial design (engineer, `[D]`)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 1.1 | — | Curriculum inputs reconciled: DAG (`scripts/populate-curriculum-dag.ts`) gives `FOUNDATION → l1-01` and `SHARED_BLOCK → l2-01 @ LAYOUT`; `disciplineTaught` = "brushed-DC H-bridge drive (DRV8833); ESP-NOW commanded actuator latency"; public tagline "Drive real DC motors over a wireless command link." Every F-req traces to one of these. | yes (repo) | Locked the scope: L1.01 core reused whole + DRV8833 + L2.01's 5 V rail + ESP-NOW. | — |
| 1.2 | **HIGH** | **L1.04's answer is unavailable.** L1.04 solves brownout-on-stall with a *second, independent supply*. F3 (untethered from one L2.01 module) forbids that, so logic and motors necessarily share a rail — and the design has no story yet for what stops a stall from collapsing it. | yes (l1-04 §3) | Re-framed the board's thesis: **bound the load instead of splitting the rail.** Made the DRV8833's PWM current regulation a *functional requirement* (F4) rather than an optional feature, and made the sense resistor the board's power contract. | drove K2/K3/K5 |
| 1.3 | MED | Initial requirement set had no stop path independent of the radio, on a board whose entire purpose is remote actuation. | yes | Added **F8** (hardware motor-disable) and **F7** (provably-off through reset/brownout). | drove SW3, R7/R8, RK12/RK13 |
| 1.4 | MED | The latency axis (`disciplineTaught`, second clause) had no hardware affordance — nothing to measure against. | yes | Added **F9** (strobe test point + adjacent ground) and the §3 timing table. | drove TP4/TP5 |
| 1.5 | — | Traceability sweep: F1→L1.01 core; F2→§2 sub-circuit 4 + K3; F3→K1/K7; F4→K2–K4; F5→sub-circuit 3 + K9; F6→sub-circuit 2 + RK2/RK5; F7→RK12; F8→SW3/RK13; F9→§3 timing table; F10→GPIO8/RK14; F11→J2/J3; F12→nFAULT/RK5. No orphan requirement, no unrequired part. | yes | — | — |

**Residual:** topology drafted but nothing yet proven against the DRV8833's own
datasheet — package, ratings and pinout all assumed. → Pass 2.

### Pass 2 — Part-truth: the DRV8833 datasheet, cover to cover (adversarial: "the part you think you're using isn't the part you can buy or build")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | **CRITICAL** | **Both "obvious" DRV8833 packages are outside the L2 hand-solder envelope.** PWP (HTSSOP-16) and RTY (WQFN-16) each carry a **PowerPAD**, and Pin Functions states "**Both the GND pin and device PowerPAD must be connected to ground**" — an underside pad no iron can reach, inspect or rework. The curriculum's envelope is "no leadless". | **yes (SLVSAR1E pp. 3–4, 15)** | **Chose the third package: `PW` = plain TSSOP-16, 16 gull-wing leads, no thermal pad.** MPN **DRV8833PWR**. | forced K4, K18–K20, RK9, RK17 |
| 2.2 | **CRITICAL** | The PW package is **not** electrically identical: Features gives **500 mA RMS per bridge (PW)** vs 1.5 A RMS (PWP/RTY), and §10.1.1 adds "The PW package option is not thermally enhanced and TI recommends adhering to the power dissipation limits." A design sized at 1.5 A/bridge would silently exceed the part. | **yes (SLVSAR1E p. 1, p. 15)** | Made **500 mA RMS/bridge the governing constraint on the whole board**, and set I_CHOP to sit **19 % under it** (K4). Turned the constraint into the lesson. | K3–K5 |
| 2.3 | **HIGH** | Sourcing check on the package decision: **`DRV8833PW` (tube) is Obsolete** (202 units); `DRV8833PWPR` has only **295** in stock at $3.02; **`DRV8833PWR` has 12,895, Active, $2.71.** The DFM-correct choice is also the best-stocked and cheapest. | **yes (live DigiKey 2026-07-30)** | Locked **DRV8833PWR**. Recorded PWPR and TB6612FNG as non-drop-in fallbacks (RK16). | §8 |
| 2.4 | **HIGH** | **The pin map differs between package families.** PW/HTSSOP pin 1 = nSLEEP; **WQFN pin 1 = AISEN**. Copying a WQFN pinout (or a KiCad symbol drawn for it) would scramble every net. | **yes (SLVSAR1E p. 3)** | Transcribed the **PW column** of Pin Functions into §4's 16-row pin-accounting table and wrote the trap into **RK9** for the `[S]` audit. | §4 |
| 2.5 | **HIGH** | Three bypass capacitors are **mandated with explicit values**, and one of them is easy to get wrong: VM ≥ 10 µF; **VCP = 0.01 µF, 16 V min, X7R, connected _to VM_** (not to GND); VINT = 2.2 µF, 6.3 V. | **yes (SLVSAR1E p. 3, §10.1)** | Added **B1/B2/B3** rows to §3 with the wiring called out; C11 explicitly wired VCP↔VM and captured in §6's `[S]` polarity note. | B1–B3 |
| 2.6 | OK | Integrated body diodes on all four FETs of each bridge (Figs. 5–6) ⇒ **no external flyback diodes**; internal dead time 450 ns ⇒ **no shoot-through timing to design**; §9.2 explicitly permits digital inputs before V_M. | **yes** | Confirmed; recorded in §2 theory of operation and the sequencing proof. | — |
| 2.7 | OK | Internal pulldowns confirmed by spec, not folklore: **R_PD = 150 kΩ on AIN/BIN, 500 kΩ on nSLEEP** (EC table). nSLEEP additionally has a 6.5 V clamp Zener and TI's 20–75 kΩ pull-up guidance if pulled to VM. | **yes** | Recorded; drove the Pass 6 decision to add *external* pulldowns anyway. | RK12 |

**Residual:** the current budget is now bounded by a package rating rather than a
guess, but no number has been derived. → Pass 3.

### Pass 3 — Math audit: the current-limit network (adversarial: "prove every number at min/max, not typical")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | **HIGH** | **V_TRIP is not 200 mV — it is 160/200/240 mV (min/typ/max), a ±20 % spread.** Sizing R_ISENSE against the typ value understates the worst-case rail draw by 20 % and overstates the guaranteed drive current by 20 %. | **yes (SLVSAR1E EC, Current Control)** | Rewrote K3 to carry **all three** corners plus the resistor's ±1 %: **264 / 333 / 404 mA**. Every downstream budget uses **404 mA**; every "will it actually turn the motor" claim uses **264 mA**. | K3, K5, K18 |
| 3.2 | MED | Chosen R_ISENSE of 0.62 Ω (a clean E24 value) **does not exist in stock** — `RC1206FR-070R62L` and `ERJ-8ENF1R20V` both return NOMATCH at DigiKey. | **yes (live DigiKey)** | Adopted the datasheet's own remedy (§8.2.2.3: "common practice is to use multiple standard resistors in parallel… distributes the current and heat"): **2 × 1.2 Ω in parallel = 0.60 Ω per bridge**. One BOM line, qty 4, 156,783 in stock. Rounder numbers as a bonus. | K2 |
| 3.3 | MED | Sense-resistor power initially computed at `I²R` with the full chop current through a single part — which would have put an 0805 at 0.10 W against a 0.125 W rating (20 % margin, before temperature derating). | yes | Two consequences folded in: **1206** (250 mW) not 0805, and the parallel pair halves the per-part current. Result **49 mW each, 5.1× margin** (K20). | K20 |
| 3.4 | MED | The dissipation model needed the *right* worst case. In slow decay the winding current recirculates between the two low-side FETs and **bypasses the external resistor**, so the resistor conducts only during the drive phase — meaning the bounding case is **duty → 1** (a motor whose natural current only just exceeds the chop), not a nominal duty. | **yes (SLVSAR1E Fig. 6, §7.3.3)** | Stated duty → 1 explicitly as the bound in K20 and K18, and explained why. | K18, K20 |
| 3.5 | LOW | "I_CHOP = 200 mV / R" needed its formula source, not a recollection. | **yes (SLVSAR1E Eq. 1 and Eq. 2)** | Cited both forms in K2/K3. | — |

**Residual:** the motor current is bounded — but nothing has yet checked that
number against the thing that has to supply it. → Pass 4.

### Pass 4 — Power integrity + the cross-board interface (adversarial: "the upstream board can't do what you're assuming")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 4.1 | **CRITICAL** | **The board's worst-case draw exceeds L2.01's published output rating by ~2×.** K5 totals **0.977 A continuous**; L2.01's F-req 4 states "**Output 5.0 V ±2.5 % (boost) at ≥ 500 mA continuous**". Designing to an upstream spec you silently exceed is the classic system-integration failure. | **yes (l2-01 design.md F-req 4)** | Two-part resolution. (a) Kept the draw *finite and provable* via the chop, and wrote the requirement down as **E3/K7: ≥ 1.0 A continuous, ≥ 1.35 A peak**. (b) **Proved L2.01's hardware already meets it** from its own numbers: §3 r10 gives I_OUT,max ≈ 1.7 A at a 3.0 V cell; at 1.0 A out, I_L = 1.85 A and I_peak = 2.07 A against I_sat 3.7 A and switch limit 2.9 A. It is a **spec uplift, not a redesign** — escalated as an owner action, and logged as **RK1**. | K5, K7, RK1 |
| 4.2 | MED | Was a smaller chop viable instead, so the board fits inside 500 mA? Tested: motors would have to share ≤ 337 mA, i.e. ≤ 168 mA/bridge ⇒ R_ISENSE ≥ 1.43 Ω ⇒ **I_CHOP min 107 mA** — *below the 100 mA free-run current of a 6 V HP micro gearmotor.* The board would not reliably turn a motor. | **yes (Pololu 6 V HP spec, arithmetic)** | Rejected; the uplift is the correct answer, and the rejected alternative is recorded so the choice is not re-litigated. | — |
| 4.3 | **HIGH** | LDO headroom through the OR diode was not proven and nearly failed. With the input floor at 4.5 V: 4.5 − 0.5 (V_F) = 4.0 V against 3.3 + 0.53 (RT9080 V_DROP max at 600 mA) = 3.83 V ⇒ only **+0.17 V**, before any motor-step sag. | **yes (RT9080 §14; SS34 EC)** | **Tightened the input spec from 4.5–5.5 V to 4.75–5.5 V** (K1), justified by what actually feeds it (L2.01 at 5.0 V ±2.5 % = 4.875–5.125 V). New margin **+0.42 V** (K9), and **+0.26 V** after the worst load-step sag (K10/K11). | K1, K9, K10 |
| 4.4 | MED | Bulk sizing was asserted, not derived. | yes | K11: `ΔV = I·Δt/C` = 0.808 A × 100 µs / 1000 µF = **81 mV**, plus an ESR term bounded pessimistically at 0.1 Ω ⇒ **≤ 0.16 V**. The 100 µs upstream loop-response time is flagged in-line **as an assumption**, not a datasheet value. | K10, K11 |
| 4.5 | MED | Peak case not separated from continuous. A Wi-Fi TX burst coincident with a double stall is a different (and larger) number than steady state. | **yes (ESP32-S3 Table 5-7: TX 340 mA peak, RX 88 mA)** | Split K5 (continuous, 0.98 A) from K6 (peak, 1.32 A for ≤ ms), and kept L1.01's more conservative 160/500 mA logic budget rather than the datasheet's measured figures. | K5, K6 |
| 4.6 | OK | Confirmed **no path exists for motor current to reach the USB host**: D2 and D3 both have their cathodes on LDO_IN, so VMOT cannot back-feed VBUS. USB-only operation therefore powers logic and cannot move motors — by construction, not by convention. | yes | Recorded as **E4** and RK6 (benign, instrumented). | E4 |

**Residual:** the electrical budget closes; the physics it assumes away has not been
attacked. → Pass 5.

### Pass 5 — Physics / first principles (adversarial: "what does the arithmetic quietly assume is impossible?")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 5.1 | **HIGH** | **Regenerative pumping was un-analysed.** §9.1 warns "The voltage rating for bulk capacitors should be higher than the operating voltage, to provide margin for cases when the motor transfers energy to the supply." A naive energy balance (two micro-gearmotor rotors, J ≈ 2.4 × 10⁻⁸ kg·m², ω ≈ 1400 rad/s ⇒ ~47 mJ) dumped into 1000 µF from 5 V computes to **≈ 10.9 V** — over the DRV8833's 10.8 V recommended max and near its 11.8 V abs max. | **yes (SLVSAR1E §9.1; abs max table)** | Two answers. (a) **Bounded in hardware:** SMAJ6.0A's clamp at its own *rated maximum* is **10.3 V — below** the 10.8 V recommended max, below the 11.8 V abs max, and far below C12's 16 V (K14). (b) **Bounded in physics:** K16 shows a self-driven brushed motor's back-EMF is `K_e·ω ≈ V_M − I·R_w < V_M`, so it can never force charge back through the body diodes; slow decay dissipates in the winding; the switch-off kick is 82 µJ ⇒ **16 mV** (K17). **The only real path is mechanical back-driving above no-load speed.** | K14, K16, K17, RK4 |
| 5.2 | **HIGH** | **Chasing 5.1 exposed a genuine abs-max hole.** If VMOT *is* pushed up, D3 carries it to the LDO: a worst-case-high SMAJ6.0A breaks down at V_BR ≈ 7.37 V ⇒ LDO_IN ≈ 7.0 V against the **RT9080's 6.5 V abs max**. And **no TVS can fix it** — clamping a node that must tolerate 5.5 V down to below 6.5 V needs a clamping factor ~1.2, which TVS diodes do not have. | **yes (RT9080 §10 abs max: VIN −0.3 to 6.5 V; SMAJ6.0A V_BR)** | Four candidate fixes were worked and **rejected with reasons** (5.3), leaving a disclosed, bounded acceptance: **RK4**, with K16's proof that normal operation cannot reach it, a lesson-level de-risk (wheels off the bench; SW3 to SAFE when handling), and a **named production upgrade** (wide-V_IN LDO, or a 6.2 V clamp behind a series element). Consistent with L2.01's own accepted RK10, which parks the identical hazard on the identical LDO. | RK4, K15, K16 |
| 5.3 | — | Rejected fixes, recorded so they are not re-tried: **(i)** series resistor in the logic branch — the 500 mA TX burst genuinely comes from the input, so any R big enough to matter kills K9's headroom; **(ii)** zener on LDO_IN — during a clamp the source impedance is the TVS's ~0.1 Ω, so the zener would have to sink amps; **(iii)** lower-standoff TVS — V_wm 5.0 V sits on the leakage knee of a 5.5 V rail (the l1-04 Pass-2 finding); **(iv)** take L2.01's 3V3 output instead — ORing at 3.3 V costs 0.3–0.5 V and lands under the ESP32's 3.0 V floor. | yes | Documented in RK4's rationale. | — |
| 5.4 | **MED** | **A "helpful" EMI capacitor would trip the driver.** The reflex fix for brush noise is 100 nF across each motor output. `I = C·dV/dt = 100 nF × 5 V / 180 ns ≈ **2.8 A**` at every switching edge — **above the 2 A typ OCP trip.** | **yes (SLVSAR1E EC: t_R 180 ns, I_OCP 2 A typ)** | Added **B4** to §3 as an explicit *negative* design rule ("no capacitor across the outputs, and here is the number"), with brush caps relocated to the motor as an assembly step. | B4, RK10 |
| 5.5 | MED | **RF/regulatory conditional (run here).** The WROOM's pre-certification survives via the antenna keep-out (inherited), but this is the first curriculum board to put a **broadband commutator arc source centimetres from that antenna**. A degraded link would show up *as latency* — corrupting the very measurement the lesson is built on. | yes | **RK10**: no output caps (B4); brush caps at the motor; twisted, short leads; `[L]` constraint that J5/J6 sit on the edge **furthest from the keep-out** with minimised loop area. Converted into lesson content (measure latency idle vs under load). | RK10, RK15 |
| 5.6 | MED | Sense-blanking has a consequence nobody had costed: `t_BLANK = 3.75 µs` "also sets the minimum on time of the PWM when operating in current chopping mode." At a 20 kHz carrier that is **7.5 % duty**. | **yes (SLVSAR1E §7.3.3)** | Added the speed-PWM constraint to §3: duty below ~8 % is not faithfully reproduced while chopping; keep the commanded carrier below the device's own 50 kHz. | §3 |
| 5.7 | OK | Chop ripple on VMOT: 0.404 A × 10 µs / 1000 µF ≈ **4 mV** (K12); fast edges handled at the VM pin by C7/C8/C9. | yes | — | K12 |

**Residual:** physics attacked; user error and part faults not yet enumerated. → Pass 6.

### Pass 6 — FMEA (adversarial: "a beginner, a screwdriver, and a robot that drives into a wall")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 6.1 | **HIGH** | **Reverse polarity is now a Li-ion fault path, and the crowbar was unproven.** The L1.04 pattern (shunt Schottky + PTC) only works if the PTC is actually *in* the fault loop. Traced it: reversing J4 puts L2.01's `5V0` on this board's GND net and its GND on VMOT, so current runs 5V0 → board GND → D4 (anode→cathode) → VMOT → **F2** → back. **F2 is in series with the crowbar.** ✓ | yes (net trace) | Confirmed the topology works. Sized the fault: against a battery source the current is several amps ⇒ fast trip, and SS34's Fig. 2 surge curve still allows ~20 A at 100 cycles. **RK2**. | RK2, §5 |
| 6.2 | **HIGH** | The **sub-trip** reverse-polarity variant (a current-limited bench supply that never reaches F2's 3 A) leaves D4 conducting steady-state — the l1-04 RK13 failure, re-inherited. | yes | Quantified: worst ≈ V_F × I = 0.5 V × 2 A = **1.0 W** in an SMC rated I_F(AV) 3 A on 14 × 14 mm copper, R_θJA 55 °C/W ⇒ ΔT ≈ 55 °C. Bounded and survivable; stated in §5 and RK2 rather than left implicit. | §5, RK2 |
| 6.3 | **HIGH** | **Boot/crash state relied on the DRV8833's internal pulldowns alone.** 150 kΩ on AIN/BIN means only **4.7 µA** of injected current reaches V_IL max 0.7 V — thin in a motor-noise environment, and F7 claims *provably* off. | **yes (EC R_PD 150 kΩ, V_IL 0.7 V)** | Added **external 10 kΩ pulldowns R14–R17** (15× stronger; 70 µA to reach V_IL) and **R8 100 kΩ on nSLEEP**. GPIO high-Z during reset now means **coast + sleep** through four independent holds. **RK12.** | RK12, sequencing proof |
| 6.4 | **HIGH** | **Link-loss runaway.** ESP-NOW packets stop; the last commanded duty persists; the robot keeps going. No hardware measure addresses it. | yes | **SW3 EG1218 hardware MOTOR SAFE** grounds nSLEEP through R7 regardless of firmware — a *latching slide*, chosen over a momentary button so "disabled" is a mode you can leave the board in while flashing. Plus stated firmware requirements (receive watchdog + task watchdog). **RK13.** | RK13, F8 |
| 6.5 | MED | Chose the switch topology deliberately: the series R must be in the **drive** leg (GPIO → R7 → node), not the switch leg, or the GPIO simply overpowers the switch. Verified the GPIO current when SAFE is `3.3 V / 470 Ω = 7 mA`, well inside the 40 mA pad rating, and inside SW3's 200 mA contact rating. | **yes (ESP32-S3 Table 5-4 I_OH; EG1218 rating)** | Locked R7 = 470 Ω. | K23 |
| 6.6 | MED | **OR-diode reverse leakage floats VMOT with USB only.** SS34 I_R rises to 20 mA at 100 °C at *rated* V_R; at 4.6 V reverse a fraction of a mA is plausible hot, and the 200 kΩ sense divider alone would let VMOT drift upward. | **yes (SS34 EC: I_R 0.5 mA @ 25 °C, 20 mA @ 100 °C)** | Traced the clamp: the **LED3 + R11 branch pins VMOT at the LED's forward knee, ~2.3–2.7 V**, at or below the DRV8833's **2.6 V UVLO** — so the bridges stay disabled regardless. Set firmware's rail-present threshold to **4.0 V**, not "non-zero". **RK14.** | RK14 |
| 6.7 | OK | Fault coverage confirmed layered and independent: chop (normal), **OCP** (2 A typ, 4 µs deglitch, 1.35 ms retry, **per-bridge** so the other bridge keeps running) with nFAULT reported, **TSD** (150 °C min, 45 °C recovery hysteresis), **UVLO** (2.5 V disable / 2.7 V recover), and **F2** upstream. | **yes (SLVSAR1E §7.3.5, Table 3)** | Recorded in RK5 and F12. | RK5 |

**Residual:** the failure set is covered; the conditional audits have been named but
not run. → Passes 7 and 8.

### Pass 7 — CONDITIONAL: deep thermal (adversarial: "you picked the package with three times the thermal resistance — show me the junction")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 7.1 | **HIGH** | **The audit fires, and the flag is wrong.** The project reads `hasThermalConcern=false`, but the PW package's **R_θJA is 103.1 °C/W vs 40.5 (PWP) / 37.2 (RTY)** — 2.5× worse — and the board's single most important number (I_CHOP) exists *only* because of a thermal rating. A stalled, remotely-commanded motor is an **indefinite** operating condition, not a fault. | **yes (SLVSAR1E Thermal Information table)** | Ran the audit properly (below) and **recommended `hasThermalConcern = true`**, checking that *both* rows it materialises have honest referents here: "Thermal budget verified" → §5/K18–K20; "Derating applied" → K4 (19 % under the package rating), K20 (5.1×), K22 (22 %). | header, §7 |
| 7.2 | — | Worst-case junction temperature, derived not asserted: TI Eq. 3 with the **85 °C max** R_DS(on) values at V_M = 5 V (HS 325 mΩ + LS 275 mΩ = **600 mΩ**), I = I_CHOP **max** 404 mA, two bridges, ×1.3 for TI's stated 10–30 % switching adder, plus I_VM 3 mA × 5.5 V ⇒ **P = 0.271 W**. `T_J = T_A + 103.1 × 0.271` ⇒ **53 °C @ 25 °C, 68 °C @ 40 °C ambient.** Against T_TSD min **150 °C** ⇒ **82 °C margin**. | **yes (SLVSAR1E EC + Eq. 3 + Thermal Information)** | Recorded as K18/K19. | K18, K19 |
| 7.3 | MED | **Self-consistency check** (the trap in every thermal calculation): R_DS(on) was taken at T_J = 85 °C while the computed T_J is ≤ 68 °C, so the model is **conservative, not circular**. Had T_J landed above 85 °C the calculation would have needed a second iteration. | yes | Stated explicitly in K19 so a reviewer can see the direction of the error. | K19 |
| 7.4 | MED | Verified there is **nothing to heatsink**: §10.1.1's heatsinking guidance is entirely about the PowerPAD, and the PW part has none. Copper pour under the body buys almost nothing. | **yes (SLVSAR1E §10.1.1 + NOTE)** | Recorded in §1/§5 that no pour, via array or heatsink is required *or possible* — the derating **is** the thermal design. Prevents a future reviewer "fixing" a non-problem. | §5 |
| 7.5 | LOW | Every other dissipator checked against its own rating, not by eye: R1–R4 **49 mW / 250 mW**; F2 **0.106 W** in an 1812; D2/D3 **80 mW** (ΔT ≈ 4 °C at R_θJA 55 °C/W); U2 **0.21 W**, ΔT ≈ 21 °C at R_θJA(EVB) 100.7 °C/W — *lower* than L1.01's because the OR diode drops the LDO input to ~4.4–4.9 V. | **yes (RT9080 §13; SS34 thermal)** | §5. | K20, K22 |
| 7.6 | LOW | OCP fault dissipation bounded: 0.6 Ω × (2 A)² = 2.4 W for the 4 µs deglitch, retried every 1.35 ms ⇒ **~7 mW average**. Not a thermal case. | yes | Noted. | — |

**Residual:** thermal closed. The battery side has been referenced in three passes
but never audited on its own terms. → Pass 8.

### Pass 8 — CONDITIONAL: battery / Li-ion (adversarial: "this board is a load on a lithium cell — prove the whole path")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 8.1 | — | **Audit applicability decided first, on substance.** The board has no cell, charger, protection IC or balancing — so three of the conditional's four concerns are N/A. But two are load-bearing: **discharge limits** (this board decides what the cell is asked for) and **short protection** (this board's fuse is what stands between a fault and the cell). Audit **run**. | yes | Ran it; conclusions below. | — |
| 8.2 | **HIGH** | **Reflected cell current had never been computed.** K5's 1.0 A at 5 V is **5 W**; through L2.01's boost at ~90 % from a depleted 3.0 V cell that is **1.85 A from the cell** (2.4 A at the K6 peak) — 3.7C on a 500 mAh pack. | yes (arithmetic on L2.01's own efficiency figure) | Added **K8** and **RK3**: the kit must specify a 1S cell **rated ≥ 2 A continuous discharge**. The chop guarantees the requirement cannot creep when a learner fits a bigger motor. | K8, RK3 |
| 8.3 | **HIGH** | **L2.01's 5 V output has no current limit.** Its PTC (F1) guards the *USB input*; its DW01A OCP is set by the FS8205A's R_DS(on) at *tens of amps* — far above anything this board could draw before its own wiring failed. A short on VMOT is therefore bounded **only by L2.03's F2**. | **yes (l2-01 design.md §2, §3 r16, §6 RK8)** | Two outcomes: **F2 is reclassified as safety-critical** (stated in §1 and §4, not just "nice protection"), and a **cross-board recommendation** was raised that L2.01 carry an output-side PTC. | §1, §5, RK5 |
| 8.4 | MED | F2's own margin re-checked against the *new* worst case rather than a nominal: I_hold 1.5 A derated ~0.8× at 60 °C ⇒ **~1.2 A vs K5's 0.98 A = +22 %**. Thin enough to state rather than round away; V_max **6 V** > the 5.5 V ceiling with 0.5 V spare. | yes (part figures carried from the validated l1-04 F2 analysis; provenance stated in K22) | K22 written with the margin exposed, second source Bel Fuse 0ZCG0150FF2C recorded. | K22, §8 |
| 8.5 | MED | **Flag decision.** Would `hasLiIon = true` be honest? Checked the actual rows it materialises (`src/lib/canonical-checklist-templates.ts`): row 1 ("OVP/OCP/short protection, charge & discharge current limits…") is attestable; **row 2 ("Pack thermal/mechanical containment reviewed — cell placement, venting…") has no referent on a board with no pack.** The board-design-validation skill is explicit that foreign checklist items "rot trust in every real attestation next to them." | **yes (repo source read)** | **Recommend the flag stay `false`**, with the reasoning written into the design header so the decision is visible rather than looking like an oversight. The cell attestation belongs to L2.01. **Audit ≠ flag.** | header, §7 |
| 8.6 | OK | Containment/venting genuinely N/A: the cell lives on L2.01, off this board, on L2.01's keyed JST lead. | yes | — | — |

**Residual:** conditionals closed. Nothing has yet been checked against what can
actually be bought or built. → Pass 9.

### Pass 9 — DFM / solderability + sourcing / lifecycle (engineer; live DigiKey + parts MCP)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 9.1 | **HIGH** | **`Samsung CL21A106KOQNNNE` — the 10 µF/16 V X5R 0805 that L2.01's §8 specifies for its C4/C5/C6 — screens at stock 0.** So do `CL21A106KAYNNNE` (0) and `GRM21BR61E106KA73L` (0). Had L2.03 "reused" it, the board would have shipped a dead line. | **yes (live DigiKey 2026-07-30)** | Used the **already-in-library KEMET C0805C106K3PACTU** (10 µF/**25 V** X5R, 126,056 in stock) instead — which is *also* electrically better here (9.3). **Cross-board note raised for L2.01.** | §8, B1 |
| 9.2 | **HIGH** | **`Samsung CL21B225KAFNNNE` — the obvious 2.2 µF 0805 for VINT — is "Not For New Designs"** despite 523 k of stock; `GRM21BR71E225KA73L` is Obsolete at 0. Lifecycle, not stock, is the trap. | **yes (live DigiKey)** | Chose **CL21B225KOFNNNE** (2.2 µF/16 V X7R, Active, 115,668). | §8, B3 |
| 9.3 | **HIGH** | **DC-bias derating would have silently violated a datasheet minimum.** TI asks for ≥ 10 µF at VM. A **16 V** X5R 0805 10 µF retains only ~5–6 µF at 5 V bias — one part misses the minimum outright. | yes (class-typical manufacturer DC-bias behaviour; flagged as such in B1) | Specified **2 × 10 µF / 25 V** (≈ 7–8 µF each ⇒ **14–16 µF effective**). Same reasoning applied to VINT: a nominal 2.2 µF **6.3 V** X5R would retain ~1.3 µF at the VINT bias, *worse* than the 16 V X7R actually specified. **Exact-curve confirmation flagged as owed at `[S]`** rather than claimed. | B1, B3 |
| 9.4 | MED | Hand-solder envelope re-checked part by part: U3 TSSOP-16 (0.65 mm, gull-wing, **no pad**); D2–D4 SMC; D5 SMA; F2 1812; R1–R4 1206; passives 0805; J1 USB-C; J4–J6, J2/J3, SW1–SW3, C12, TP1–TP5 all THT. **Nothing leadless.** The finest-pitch *IC* is U3, and L1.01 already records the USB-C receptacle as the hardest joint on the board. | yes | **RK17** raised anyway: 0.65 mm is a real step up, so the guide owes a dedicated drag-solder section plus a loupe-and-continuity check on every adjacent pair before power-up. | RK17 |
| 9.5 | MED | Exact `(manufacturer, mpn)` strings checked against the **live library** via the parts MCP, not against a side document: `miniSMDC150F-2`/Littelfuse ✓, `SS34-E3/57T`/Vishay General Semiconductor ✓, `SMAJ6.0A`/Littelfuse ✓, `EEU-FM1C102`/Panasonic ✓, `282837-2`/TE Connectivity ✓, `EG1218`/E-Switch ✓ — all already present. **7 not present** (DRV8833PWR, 150080GS75000, RC1206FR-071R2L, RC0805FR-07100KL, CL21B225KOFNNNE, CL21B103KBCNNNC, 5012). | **yes (parts MCP)** | §8 marks each line ✅ / NEW so the owner's part-creation step is a known, finite list. | §8 |
| 9.6 | MED | **U3 has no drop-in second source** — a real single-point supply risk on the board's defining part. | yes | Stated rather than glossed: **RK16** records PWPR (same silicon, different package ⇒ ECN + reintroduces the PowerPAD) and TB6612FNG (functional alternative, redesign), and leans on stock depth (12,895, Active). | RK16 |
| 9.7 | LOW | Second sources found and screened for the parts that have them: F2 → Bel Fuse `0ZCG0150FF2C` (Active, 6,786); R1–R4 → Vishay `CRCW12061R20FKEA` (Active, 14,394); D2–D4 → generic `SS34` (Active, 71,732). | **yes (live DigiKey)** | §8. | §8 |
| 9.8 | LOW | Cost re-checked against reality: **≈ $30** qty-1, vs L1.04's $15–17. Driven by U3 ($2.71), three screw terminals ($2.85) and three SMC Schottkys ($3.06). | yes | Stated openly in §8 with the justification (full ESP32 board + driver + three terminals; L2 PREMIUM), and with the note that the SS34's over-rating is what makes K9's headroom proof rigorous. | §8 |

**Residual:** parts are real and buildable. The nets they connect have not been
walked pin by pin. → Pass 10.

### Pass 10 — Net integrity, pin accounting, sequencing, logic levels (adversarial: "walk every pin and every power-up order")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 10.1 | **HIGH** | **nSLEEP's logic-high margin is far thinner than the other inputs and nearly failed.** V_IH is **2.5 V for nSLEEP** but only 2.0 V for everything else. Against ESP32-S3 `V_OH(min) = 0.8 × VDD` with VDD worst case **3.190 V** (RT9080 −2 % accuracy, −1 % load reg, −0.35 % line reg) ⇒ 2.552 V. **With the 10 kΩ pulldown originally drawn, the divider gives 2.44 V — below V_IH.** | **yes (SLVSAR1E EC; ESP32-S3 Table 5-4; RT9080 §14)** | **Changed R8 from 10 kΩ to 100 kΩ**, cutting the divider loss to 0.47 % ⇒ **2.540 V, +40 mV**. Accepted at that margin because the failure direction is **fail-safe** — a marginal high leaves the driver asleep and the motors still. Recorded honestly as **K23 / RK11**, including that both numbers are 25 °C floors and that V_OH is specified into a high-impedance load (realistic level ~3.19 V). | K23, RK11 |
| 10.2 | MED | AIN/BIN margin then re-checked with the same worst-case VDD rather than assumed to follow: 2.552 V vs V_IH 2.0 V ⇒ **+552 mV**; drive current into 10 kΩ = 0.33 mA against a 40 mA pad. nFAULT: V_OL ≤ 0.5 V at 5 mA, but at 0.33 mA it is ~0.03 V against the ESP32's V_IL max 0.25 × VDD = 0.80 V. | **yes** | K24; both comfortable. | K24 |
| 10.3 | **HIGH** | **The rail-sense pin was about to be an ADC2 channel.** ADC2 is unusable while Wi-Fi is active — and this board runs ESP-NOW continuously. It is L1.05's headline trap, and it would have been silently re-committed here. | yes (curriculum + Espressif behaviour) | Moved the VMOT sense to **GPIO8 = ADC1_CH7** (module pin 12) and wrote the reason into §4's allocation table so it reads as a decision, not a coincidence. | §4, F10 |
| 10.4 | MED | Divider sizing checked against three constraints at once: **standby drain** (100 k + 100 k ⇒ 27.5 µA, vs 275 µA for a 10 k pair — material on a battery board), **ADC range** (5.5 V ⇒ 2.75 V, inside ATTEN3's 0–2900 mV effective range per Table 5-6), and **ADC source impedance** (50 kΩ is high, so C14 100 nF supplies the sampling charge). Bonus: the 100 kΩ line already exists for R8, so no extra BOM line. | **yes (ESP32-S3 Tables 5-4, 5-6)** | R19/R20 = 100 kΩ + C14. | §4 |
| 10.5 | MED | **Divider behaviour during a TVS clamp** checked rather than assumed: at VMOT 10.3 V the pin sees 5.15 V, above the ESP32's V_IH max of VDD + 0.3. Current into the pad's ESD clamp = (5.15 − 3.6)/100 kΩ = **15 µA**. | yes | Bounded and safe — the 100 kΩ top resistor is itself the protection. Noted alongside RK4. | RK4 |
| 10.6 | MED | **All 16 U3 pins walked** and every one given a disposition (§4 table). No floating node: AISEN/BISEN terminated, VCP/VINT/VM bypassed per B1–B3, GND on pin 13 (and **only** pin 13 — the PW package has no PowerPAD, which is exactly why the footprint must not be an HTSSOP). | **yes (SLVSAR1E Pin Functions, PW column)** | §4 table + RK9. | §4, RK9 |
| 10.7 | MED | **Strapping-pin sweep on U1**: GPIO0, 3, 45, 46 are strapping pins on the S3. Confirmed **no motor function lands on any of them** — a driver input held by a pulldown on a strapping pin would change boot mode. GPIO19/20 reserved for native USB. | **yes (library VERIFIED pinout for ESP32-S3-WROOM-1-N16R2)** | §4 allocation table, with the avoided pins listed. | §4 |
| 10.8 | MED | **Sequencing walked in both directions and in both single-source cases** (USB only; VMOT only; both; USB removed; VMOT removed; MCU brownout). The USB-only case lands the DRV8833 below its 2.6 V UVLO with every FET off; the VMOT-only case has the bridges held off by pulldowns before firmware exists; brownout returns to coast + sleep. TI's §9.2 explicitly blesses inputs-before-V_M. | **yes (SLVSAR1E Table 3, §9.2)** | Written out as the sequencing block in §2. | §2 |
| 10.9 | LOW | `t_WAKE ≤ 1 ms` from nSLEEP-high to outputs live is a real firmware constraint and was undocumented. | **yes (SLVSAR1E EC)** | Added to §2's sequencing block and the §3 timing table (a one-off enable cost, not a per-command one). | §3 |
| 10.10 | LOW | Two GND test points, not one — a strobe measurement needs a probe ground beside it or the measurement is worse than the thing being measured. | yes | TP5 (black) specified adjacent to TP4, and captured as an `[L]` placement constraint. | F9, RK8 |

**Residual:** the nets are sound. Pedagogy, consistency and pipeline conformance
have not been swept. → Pass 11.

### Pass 11 — Learnability + internal consistency + pipeline conformance (adversarial: "does this teach one thing, and does the document contradict itself?")

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 11.1 | **MED** | **The board carries two lessons that compete.** "Current limiting as a power contract" and "ESP-NOW actuator latency" are both real, both in `disciplineTaught`, and a guide that alternates between them teaches neither. Add the fine-pitch soldering step and there are three demands on the learner's attention. | yes | Recorded an explicit **pedagogy-framing decision** in §7: current-limit story foregrounded (one resistor value *is* the power contract); protection parts framed as guard rails; latency taught **second**, against the §3 timing table; fine-pitch soldering gets its own section **before** either. No design change. | §7 |
| 11.2 | **MED** | **Datasheet self-contradiction found and it matters.** §7.3.5.3 states "nFAULT is driven low in the event of an undervoltage condition", while **Table 3 lists UVLO's ERROR REPORT as "None"**. Firmware that infers "no motor power" from nFAULT would be right under one reading and wrong under the other. | **yes (SLVSAR1E §7.3.5.3 vs Table 3 — both read)** | Made the design **independent of either reading**: rail presence is determined by the **ADC1 sense** (F10, threshold 4.0 V) and shown by the **MOTOR PWR LED**; nFAULT is treated as "driver not ready", which is correct under both readings. Contradiction recorded here so a future reader does not re-derive it. | F10, RK14 |
| 11.3 | MED | The latency lesson had no defensible claim about what is actually being measured. | **yes (SLVSAR1E EC: t_DEG 450 ns, t_PROP 1.1 µs, t_DEAD 450 ns, t_R/t_F 180/160 ns)** | Built the §3 timing table: **total H-bridge contribution ≈ 1.5 µs** against ESP-NOW's ~1–10 ms. That single line is the lesson's thesis and it is now datasheet-backed. | §3 |
| 11.4 | MED | **Indicator scheme was ambiguous** — two red LEDs (3V3 and motor rail) on a board where the single most common question is "why isn't it moving?". | yes | Split by colour: LED1 red "3V3 PWR", LED2 yellow "LINK" (GPIO47, matching L1.02 so firmware ports), **LED3 green "MOTOR PWR"**. One new commodity line ($0.19, 117 k stock) bought for a real debug affordance — and per 6.6 the green branch also turns out to clamp a leakage-floated VMOT below the driver's UVLO. | §4, RK6, RK14 |
| 11.5 | MED | **Pipeline conformance / flag audit.** Read `src/lib/canonical-checklist-templates.ts` to confirm what each flag actually materialises before recommending any change, rather than assuming. Confirmed `requiresStripboard` must stay false (no OTD board uses stripboard) and `hasMainsNet` false. | **yes (repo source)** | Both flag recommendations (Pass 7, Pass 8) written into the design header **with their reasoning**, so the owner is deciding, not rubber-stamping. | header, §7 |
| 11.6 | MED | **Consistency sweep, design.md against itself.** Reconciled: refDes appear exactly once each across §2 / §4 / §6 / §8; K-row IDs (K1–K24, B1–B4) do not alias any refDes; the **30 BOM lines and 61 placements** agree between the §8 table and `bom.csv`; every `refDes` list length equals its `quantity`. Corrected in this pass: R-number allocation was renumbered so sense (R1–R4), CC (R5–R6), 470 Ω (R7, R9–R11), 100 kΩ (R8, R19–R20) and 10 kΩ (R12–R18) each occupy contiguous, non-overlapping ranges. | yes | design.md + bom.csv. | §4, §8 |
| 11.7 | LOW | The motor is not a BOM line — correct, and matching L1.04 (which does not BOM its servo) — but it was not *said*, which invites a future reader to "fix" it. | yes | §8 now lists what is deliberately **not** on the BOM: motors, the L2.01 module, the cell. | §8 |
| 11.8 | LOW | The J4 interface needed a rule, not just a pinout: L2.01's J3 has three positions (5V0 / 3V3 / GND) and this board takes two. | yes | I2 states it: wire `5V0` and `GND`, **leave L2.01's `3V3` unconnected**, because this board makes its own 3.3 V and must still run on USB alone. | I2 |

**Residual:** one numeric re-check outstanding (11.6's renumbering touched §4 and §8);
confirm no straggler. → Pass 12.

### Pass 12 — DRY PASS — confirming all-lens sweep (adversarial, fresh eyes, `[D]`)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 12.1 | — | **Requirements + traceability** re-walked: F1–F12 each still terminate in a topology net, a K-row, a BOM line and a risk. The Pass-11 renumbering did not orphan anything. | yes | — | — |
| 12.2 | — | **Math re-proved end to end after every fix.** K3 (264/333/404 mA) → K5 (0.977 A) → K7 (≥ 1.0 A / 1.35 A) → K18 (0.271 W) → K19 (68 °C @ 40 °C) → K20 (49 mW, 5.1×) → K22 (+22 %) → K23 (+40 mV) all recomputed from the same inputs and agree with the text everywhere they appear. K9/K10's headroom still holds under the tightened K1 input spec. | yes | — | — |
| 12.3 | — | **Part-truth re-verified against the actual datasheets**, not against Pass 2's notes: DRV8833 package set, ratings, EC values, V_TRIP corners, pinout column, three mandated bypasses, protection thresholds and §9.2 sequencing all re-read; RT9080 abs max 6.5 V / VIN 5.5 V / accuracy ±2 % / dropout 0.53 V; SS34 V_F max 0.5 V @ 3 A and I_FSM 100 A; ESP32-S3 Table 5-4 and Table 5-7. | **yes (re-read)** | — | — |
| 12.4 | — | **Sourcing re-confirmed**: all **30** lines Active and in stock on the 2026-07-30 screen; the two lifecycle/stock traps (9.1, 9.2) are avoided in the shipped BOM; **23 of 30** lines strict-match library strings, 7 are NEW and enumerated. | yes | — | — |
| 12.5 | LOW | The 100 µs upstream loop-response time in K11 is an **assumption**, not a datasheet figure. Re-checked its leverage: even at 300 µs the sag is 0.24 V + ESR and K10's headroom stays positive. Non-blocking. | yes | Already flagged in-line as an assumption; no change. | K11 |
| 12.6 | LOW | The rotor-inertia figure in K17 and the 1 mH winding inductance are **class estimates**. Re-checked leverage: K16's physics argument (back-EMF ≤ V_M) does the actual work, and K14's clamp bound is three orders above K17's result, so neither estimate is load-bearing. | yes | Already flagged in-line; no change. | K16, K17 |
| 12.7 | LOW | DC-bias derating percentages in B1/B3 are class-typical rather than read off the specific manufacturer curves. Leverage: B1's conclusion (two 25 V parts clear 10 µF effective; one 16 V part would not) survives a wide range of derating assumptions. | yes | Already flagged as owed at `[S]`; no change. | B1, B3 |
| 12.8 | — | **Consistency grep**: no stale "0.62 Ω", no "10 kΩ" on nSLEEP, no "4.5 V" input floor, no "500 mA" upstream figure presented as adequate, no "SMAJ5.0A", no HTSSOP/PowerPAD reference outside the rejection rationale, no ADC2 reference outside the trap note. design.md ↔ bom.csv reconcile on refDes, MPN and quantity. | yes | — | — |
| 12.9 | — | **Phasing honest**: every `[S]`/`[L]` item is captured with its constraint and left explicitly open — RK8/RK10/RK15 at `[L]`, RK9 at `[S]`, fab-DRU at `[L]`, exact DC-bias curves at `[S]`. No `[D]` item is deferred; no deferred item is ticked. | yes | — | — |

**Residual after this pass: NONE — DRY.** A full all-lens sweep produced **zero new
material (CRITICAL / HIGH / MED) findings** — only three pure-LOW re-checks of
already-disclosed assumptions (12.5–12.7), each shown to be non-load-bearing.
**Design-stage part-ready.** `[S]` and `[L]` audits remain owed at their stages, and
the four owner actions listed at the top of this log are outstanding.
