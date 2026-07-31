# L2.04 Constant-Current Power-LED Driver — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log is what backs this board's
> `DESIGN_VALIDATION` attestations — when a tick is made, the proof is here.

| | |
| --- | --- |
| **Slug** | `l2-04-power-led-driver` |
| **Status** | **`Pass 15 — design-stage DRY; gate MET`.** Two passes changed hardware: **Pass 3** (part-truth) found the LM3404's **±23.6 % on-time tolerance** and proved the first current loop sat **0.8 %** above the datasheet's 25 mV CS signal-to-noise floor — the inductor/on-time/sense triple was re-solved by program; **Pass 7** (power integrity) found the **input-filter negative-resistance** condition that makes C7's 85 mΩ ESR a functional requirement rather than bulk. Every `[D]` audit is clean and both `hasThermalConcern` conditionals are run. **Owed by phase (F7, not blockers):** footprint↔pinout `[S]`, fab-DRU + the V12⟂VBUS ERC `[L]`, and four bring-up measurements B1–B4. **Parts NOT created, BOM NOT imported, revision NOT advanced.** |
| **Passes run** | **15** |
| **Last dry pass** | **Pass 15** (2026-07-30) — full sweep after the Pass-14 fold, zero new material findings |

## Gate (Definition of done — all must hold before any part/BOM/revision)

- [x] Requirements traced (Pass 1) · pins accounted + sequencing proven (Pass 4)
- [x] Every number worst-case-proven (Passes 3, 5, 6, 13 — **by program, after Pass 3
      showed the hand-evaluated nominal hid a violated constraint**) · every active part
      datasheet-verified against its **own** datasheet (Passes 2, 3)
- [x] Power integrity proven (Pass 7) · every failure mode mitigated-or-accepted (Pass 8)
- [x] Every part hand-buildable (Pass 9) + sourceable with exact import strings, **live
      DigiKey screen of all 32 lines, zero OOS** (Pass 2, re-run Pass 12)
- [x] Layout constraints captured L-1…L-8 (Pass 10) · teachable (Pass 9) · consistent
      (Passes 12, 14, 15) · pipeline-conformant (Pass 11)
- [x] **Every applicable conditional audit run** — `hasThermalConcern` **fires** (Pass 8
      raised the flag error; Pass 13 ran both conditional audits clean). `hasMainsNet`,
      `hasLiIon`, `requiresStripboard` all correctly false ⇒ no other conditional fires
- [x] Every risk de-risked or explicitly scheduled — RK1–RK21 (Pass 8)
- [x] **≥ 10 passes run (15) AND a design-stage dry pass achieved at Pass 15**
- [~] *Phase-staged (F7):* footprint↔symbol↔pinout `[S]`; fab-DRU + V12⟂VBUS ERC `[L]`;
      bring-up residuals B1–B4 (§9 of `design.md`)

---

## Passes

### Pass 1 — Requirements & traceability (audit 1) · adversarial stance: *"the doc claims things the design does not deliver"*

Traced every functional requirement forward (requirement → topology net → calc row →
BOM line → risk → validation item) and every BOM line backward to a requirement.

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P1-1** | **MED** | **F2 claimed "350 mA ±6 %" while §3's own worst-case stack gave 326–369 mA (−6.9 %).** The requirement and its proof disagreed — the classic traceability failure, and it was in the *first* requirement anyone would test. | ✅ recomputed from the §3 rows | **The requirement was wrong, not the design.** The dominant term is the LM3404's own **194–206 mV** CS threshold (±3 %), which no amount of resistor precision touches. F2 restated to the band the part can actually hold; a tighter figure would have been fiction. *(Pass 3 then widened the band again — see there.)* | F2 now reads the same numbers §3 row 13 computes |
| P1-2 | LOW | **TP5 sits on the CS sense node** — a scope probe there loads a sensitive comparator input, and the doc said "10× probe only" without saying why it is safe. | ✅ topology trace | R9's 1 kΩ already isolates U3's CS **pin** from the TP5 pad; that is now stated in I7 rather than left implicit. | I7 + RK8 agree |
| P1-3 | LOW | **F5 promised an efficiency measurement but the board senses only voltages** — LED current is asserted, not measured, so the learner cannot close the loop. | ✅ | J5 is a screw terminal: breaking it *is* the DMM-in-series path. Stated in F5 and I3 so the measurement is designed, not improvised. | F5 ↔ I3 ↔ §2.5 lab agree |

**Clean:** no unrequired part (every new line maps to F2/F3/F4/F5/F6/F7); no orphan
requirement. **Residual:** none from this lens.

### Pass 2 — Sourcing / lifecycle (audit 10) · adversarial stance: *"the parts you picked are dead"*

Ran a **live DigiKey Product Information API screen** rather than trusting either the
distributor's front page or engineering folklore.

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P2-1** | **HIGH** | **The catalog actively invites putting a 6 V-rated PTC on a 12 V rail.** L1.01's `1206L050YR` is the obvious "reuse" for input protection and is **rated 6 V**. On a 12 V rail it is not a fuse, it is a component operating over 2× its voltage rating. | ✅ DigiKey parametrics + Littelfuse 1206L series | **F2 = `1812L050/30PR` (0.5 A hold, 1 A trip, 30 V).** The 30 V rating additionally covers the 24 V wrong-brick fault. Registered as **RK21** and called out in *both* BOM notes, because F1 and F2 sit one line apart. The two are in different case sizes (1206 vs 1812), so the footprints are not interchangeable either. | §3 row 31, §4, RK21, bom.csv F1+F2 notes |
| **P2-2** | **HIGH** | **Four of the five obvious buck-LED-driver ICs are unbuyable.** `AL8805W5-7` (SOT-25) — **obsolete, 0 stock**; `AL8807W5-7` — obsolete; `ZXLD1350ET5TA` — Active but **0 stock**; `CAT4201TD-GT3` — **obsolete with 81,000 units in stock.** A design that had done its math first would have proved a dead part. | ✅ live API, per-MPN | **U3 = `LM3404MAX/NOPB`**, the only Active + in-stock + non-leadless candidate with a datasheet complete enough to teach from. `AL8862SP-13` was rejected separately (SO-8 **with exposed pad** — outside the hand-solder envelope). All four rejections recorded in §8 so the next board does not re-tread them. | §8 rejection list; friction G2 |
| P2-3 | MED | **Only the *new* lines had been screened.** The reused L1.01 core lines were assumed good — exactly the assumption l1-03 Pass 19 punished when a previously-stocked 10 µF/0805 went to zero. | ✅ | Re-ran the screen over **all 32 lines**. Result: **every line Active and in stock, zero OOS.** | Pass 12 re-ran it after the fold |
| P2-4 | LOW | The `SS14-E3/61T` second source was annotated "+0.1 V V_F" — an invented number; the datasheet guarantees V_F only at each part's own rated current. | ✅ Vishay 88751 | Reworded: *expect a higher V_F at 0.357 A; re-run §3 rows 20e/20g if substituted.* Same correction applied to the C7 and L1 alternates, which are **not** like-for-like either (ESR and shielding). | §8 second-source list |

**Residual:** manufacturer strings for the four *new* manufacturers (`Susumu`,
`Same Sky`, `New Energy`, `Wakefield Thermal Solutions`) are exact-import risks; the
`Same Sky` case is explicitly flagged because DigiKey returns *"Same Sky (Formerly CUI
Devices)"* while the library convention strips suffixes (`Littelfuse` and `Bourns`
confirmed against live library rows).

### Pass 3 — Part-truth / datasheet, worst case (audit 5) · adversarial stance: *"every number you quoted is the typical one"* — **the pass that redesigned the board**

Read TI **SNVS465G** end to end rather than skimming the application section.

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P3-1** | **HIGH** | **§6.6 specifies the on-time as `2.1 / 2.75 / 3.4 µs` at V_IN 10 V and `515 / 675 / 835 ns` at 40 V — a ±23.6 % tolerance on t_ON.** The design equation `t_ON = 1.34×10⁻¹⁰·R_ON/V_IN` reproduces the *typical* to 3 %, so nothing looked wrong. But t_ON sets the inductor ripple, the ripple sets the CS signal amplitude, and the datasheet requires **≥ 25 mV of CS ripple for signal-to-noise** (§8.1.3). Stacking t_ON −23.6 % with L +10 %, V_IN −10 % and V_F max, the first design (L 100 µH, R_ON 68 kΩ, R8 0.62 Ω) gives **25.2 mV — 0.8 % of margin.** That is not a margin, it is a coincidence. | ✅ read directly from the EC/switching tables; the formula was checked against both specified points | **Re-solved the current loop by program** rather than by hand (Pass 5). The CS window turned out to be bounded on *both* sides: the comparator regulates the **valley** to V_CS, so the peak is `V_CS + Δi·R8` and the **300 mV OVP comparator** caps the ripple at `300 − 206 = 94 mV`. The design must fit **25 mV ≤ Δi·R8 ≤ 94 mV** at every corner, against a worst-case ripple spread of 2.5:1 in a window only 3.8:1 wide. | Pass 5's search; §3 row 10 now states the window and the two margins (1.20× / 1.25×) |
| **P3-2** | **MED** | **The forward-voltage band was taken from the star vendor's "typ 2.75 V"** — a single number at one temperature. Lumileds DS41 Table 2 gives **2.80 / 2.95 / 3.57 V** at 350 mA with the pad at 25 °C, plus a **−3.0 mV/°C** coefficient. The real band across a bounded 0–90 °C junction is **2.605 – 3.645 V** — a 1.04 V spread the ripple and duty math must survive. | ✅ Lumileds DS41 Table 2 read directly | Built the V_F band from the datasheet's min/max **and** the tempco over an explicitly bounded T_j range, and made the two sources cross-check (`2.95 − 3.0 mV/°C × 60 = 2.77 V` vs the star sheet's 2.75 V at T_j 85 °C — **they agree to 20 mV**, the only number in this design corroborated twice). | §3 rows 1–3, 7; every corner in Pass 5's solver |
| **P3-3** | **MED** | **`V_F(D) = 0.5 V` for the recirculating Schottky is guaranteed at 3 A, not at our 0.357 A.** Using it as "the" drop overstates the largest single loss; reading the typical off the curve understates the guarantee. Either way the efficiency claim was unsourced. | ✅ Vishay 88751 (the EC table guarantees V_F only at 3 A) | **Report both, bound with the guarantee.** §3 rows 20e/20g use 0.5 V (conservative); §2.5 quotes the resulting **71.0–72.7 %** alongside the **75.9 %** the curve suggests, and **B2** owes the measurement at bring-up. | §2.5, §3 rows 20e/20g/23, §9 B2 |
| P3-4 | MED | **The LED module's own two datasheets contradict each other** — the New Energy star sheet rates **1.23 A DC / T_sp 105 °C**, the underlying Lumileds LUXEON C DS41 rates **500 mA DC / case 85 °C at 350 mA**. l1-03's F8 (the WS2812 clone) in a different costume. | ✅ both PDFs read | **Design to the intersection** (500 mA, case ≤ 85 °C) and name both sources in §4 so nobody later "discovers" the looser rating and relaxes the thermal budget. Receiving inspection confirms the delivered die generation. | §3 rows 32, 41; §4 LED3 row; friction G3 |
| P3-5 | LOW | `I_DIM-PU` is **80 µA** in the EC table and **75 µA** in the prose (§7.3.7). | ✅ | Used the larger (80 µA) for the pull-down margin. | §3 row 14 |

**Verdict: NOT DRY — the design point is unsound.** Nothing was folded until Pass 5
produced a triple that satisfies every datasheet inequality at every corner.

### Pass 4 — Topology / net integrity + sequencing (audit 2) · adversarial stance: *"something floats, or is sensed through the wrong copper"*

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P4-1** | **HIGH** | **No Kelvin requirement on the sense resistor.** The CS signal is 51 mV of ripple riding on a 200 mV DC level, and R8's low side shares the switching return path. A few millivolts of IR drop in shared ground copper is a several-percent current error — on the one resistor the entire spec rides on. | ✅ topology + §3 row 12 sensitivity | Added **L-4**: R8-high feeds R9 on a dedicated trace, R8-low returns to **U3 pin 4** on a dedicated trace, star point at R8-low / C8-return / D4-anode. Neither may share copper with the switching return. | §5 L-4; §2 pin table for pin 4 |
| P4-2 | MED | **U3's 8 pins had never been tabulated**, so "every pin accounted for" was an assertion. | ✅ SNVS465G §5 | Full 8-pin table with what drives or terminates each, including that **VCC (7) is an output** that nothing may load and **RON (6) doubles as the shutdown pin** (nothing on this board pulls it low). Same treatment for U1's 41 pins. | §2 tables |
| P4-3 | MED | **The LED-anode ADC tap sat on an unfiltered inductor output.** Before the output capacitor existed the node carried the full 23 % ripple; the divider + C13 would have averaged it, but the reading would have been noise-limited. | ✅ | Resolved as a side effect of Pass 5's C11 — the tap now sits on a node with 7 % ripple. Recorded because it is a real dependency, not luck. | §3 rows 15, 25 |
| P4-4 | MED | **Nothing terminated `LED+` with J5 open.** | ✅ | It is terminated by R14+R15 (15.1 kΩ) and, through L1, by R11 to GND — stated explicitly rather than left to be discovered. | §2 "Nothing floats" |
| P4-5 | LOW | **Power-down with 12 V still applied was unanalysed.** | ✅ SNVS465G §6.1 | DIM's abs-max is **−0.3…+7 V referenced to GND**, not to VIN, so 3.3 V on DIM with V12 absent is in-spec; and R10 pulls DIM low the instant the GPIO stops driving. Both directions now in the sequencing block. | §2 sequencing; §3 row 14 |
| P4-6 | LOW | The V_IN ramp passes through the LM3404's internal-regulator start-up region on every plug-in. | ✅ §6.5 | Benign — the part simply does not switch until its UVLO releases, far below the 10.8 V rail minimum. Noted. | §2 sequencing |

### Pass 5 — Math, re-derived **by program** (audit 3) · adversarial stance: *"you cannot evaluate a six-way tolerance stack in your head"*

Pass 3 proved the hand-evaluated nominal hid a violated inequality, so the whole
worst-case model was written as code and the component space *searched* against the
datasheet's own constraints (`25 mV ≤ Δi·R8 ≤ 94 mV`, `t_ON ≥ 300 ns`,
`t_OFF ≥ 300 ns`, CCM, `I_peak <` OVP cap `<` LED rating), with all six tolerances
(V_CS 194/206 mV · R8 ±1 % + TCR · L ±10 % · **t_ON ±23.6 %** · V_IN ±10 % · V_F
2.605–3.645 V) stacked independently.

**Result — the design point moved:**

| | before (Pass 1–3) | **after (locked)** |
| --- | --- | --- |
| L1 | 100 µH | **100 µH** (unchanged — the sourced part survived) |
| R7 (R_ON) | 68 kΩ | **82 kΩ** |
| R8 | 0.62 Ω | **0.62 Ω** (unchanged) |
| output capacitor | none (10 nF ring damper) | **C11 = 2.2 µF/50 V X7R — the same part as C8** |
| CS ripple, worst corners | **25.2 mV** / 62 mV | **30.1 / 51.2 / 75.0 mV** |
| margin to the 25 mV floor | **1.008×** | **1.20×** |
| margin to the 94 mV OVP ceiling | 1.51× | **1.25×** |
| I_F typical | 350.3 mA | **357.3 mA** |
| I_F worst-case band | 320–379 mA | **323.6 – 388.0 mA** |
| f_SW | 326 kHz | **272 kHz** (corners 208–460 kHz) |
| LED ripple | 19.6 % (= inductor ripple) | **7.0 % typ / 12.1 % worst** (split by C11) |

**The output capacitor is what makes the design feasible at all.** Without it the
inductor ripple must simultaneously be *large enough* for the CS comparator and *small
enough* for the LED — two constraints that do not both fit once the ±23.6 % on-time
tolerance is honoured. TI's own design example uses the same resolution, and the
datasheet is explicit that it costs nothing on the sense side: *"the entire inductor
ripple current flows through R_SNS."* **C11 also supersedes the 10 nF ring damper** the
open-circuit section calls for, and satisfies the datasheet's extra condition for that
case (*"as long as C_O is rated to handle V_IN"* — 50 V against a 13.2 V rail).

**Two honest consequences, both stated in the doc rather than buried:**
- **I_F is 357 mA, not 350.0 mA.** With E24 values that is the nearest achievable, and
  the LM3404's own ±3 % threshold makes a 350.0 figure fiction. 357 mA is 2 % above the
  LED's characterisation current, inside its ±10 % flux bin, and 78 % of its
  conservative 500 mA rating.
- **C11 costs dimming bandwidth.** `C·r_D = 1.3 µs` on top of the inductor's 4.0 µs
  rise sets a usable duty floor of ~5 % at 1 kHz. **F3 was restated** from "0–100 %" to
  "monotonic 5–100 %, plus a true off at 0 %" (Pass 6 finding P6-2).

**Re-proof:** every §3 row recomputed from the locked triple; `t_ON ≥ 636 ns` (2.1×
the floor), `t_OFF ≥ 1396 ns` (4.7×), CCM valley 299 mA, I_peak 447 mA vs a 489 mA OVP
cap vs a 500 mA LED rating.

### Pass 6 — Physics / first principles (audit 4) · adversarial stance: *"what do the equations assume away?"*

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| P6-1 | MED | **The CCM requirement was never checked.** §7.3.1 says the part *"must be operated in continuous conduction mode"*; nothing in the calc trail proved the inductor valley stays positive. | ✅ | Added §3 row 18: worst valley `I_F − Δi/2 = 299 mA > 0` at both the low-current/high-ripple and high-current corners. | §3 row 18 |
| **P6-2** | **MED** | **F3 promised "0–100 %" PWM dimming, which is physically unavailable.** The inductor needs `L·I_F/(V_IN−V_O) = 4.0 µs` to reach full current and C11 another 1.3 µs; at 1 kHz a 1 % duty is only 10 µs long. | ✅ first principles + §7.3.7 | F3 restated to **monotonic 5–100 % at 1 kHz plus a true off**, with the reason (not the workaround) in §3 row 16. The trade — an output capacitor buys ripple and spends dimming bandwidth — is now a teaching point instead of a defect. | F3, §3 row 16, §2.5 |
| P6-3 | LOW | **The thermal measurement everyone takes is wrong.** `θ_sink × m·c = 13.4 K/W × 67 g × 900 J/kg·K ≈ **13 minutes**` — a learner who touches the heatsink after ten seconds concludes the design is fine. | ✅ arithmetic from the Wakefield mass | Added §3 row 35, and the bring-up procedure now specifies a **13-minute dwell** before the temperature is read (B1, RK1). | §3 row 35; §9 B1 |
| P6-4 | LOW | The 12 V brick lead is an antenna carrying a switched current; there is no common-mode choke. | ✅ | Accepted and documented for a DC-brick-fed teaching board; RK13 extended to name the lead, with the `[L]` confirm. | RK13 |

### Pass 7 — Power integrity (audit 7) · adversarial stance: *"the front end will oscillate and you have not looked"* — **the second pass that changed hardware**

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P7-1** | **HIGH** | **The input filter was never checked against the converter's negative input impedance.** §8.1.5 warns that a switching converter presents `−V_IN²/P_IN` at its input and *"can cause oscillations if the magnitude of the negative input impedance is greater than the input filter impedance."* Here `Z_in = 144/1.36 = **106 Ω**`. With a ~1.5 µH brick lead and **only** the 2.2 µF ceramic, the filter's peak output impedance is `L/(R·C) = 1.5 µH/(0.002 × 2.2 µF) = **341 Ω** > 106 Ω` — **the front end oscillates.** C7 had been specified as "hot-plug bulk", i.e. for the wrong reason, and was one ECN away from being swapped for a low-ESR part that would have broken the board. | ✅ SNVS465G §8.1.5 + Middlebrook, with C7's **85 mΩ ESR at 100 kHz** taken from the KEMET datasheet | **C7's ESR is now a specified, functional parameter.** With it the peak is `1.5 µH/(0.085 × 102 µF) = **0.17 Ω`** — a **600×** margin. §4 gives C7 a full row explaining why, `bom.csv` says *"a low-ESR polymer substitute BREAKS the front end"*, and the second-source note requires re-running §3 row 21 before any C7 ECN. | §3 row 21; §4 C7 row; §8 second sources |
| P7-2 | MED | Does adding C11 weaken the CS signal the whole design was just re-solved around? | ✅ SNVS465G §8.1.4, explicitly | **No** — *"the entire inductor ripple current flows through R_SNS to provide the required 25 mV."* C11 sits across the LED, in parallel with r_D, upstream of R8. Verified rather than assumed, because Pass 5's entire result depends on it. | §3 rows 10, 15 |
| P7-3 | LOW | Decoupling adequacy: C8 2.2 µF at VIN, C10 0.1 µF at VCC, C9 10 nF BOOT→SW. | ✅ §8.1.5, §8.2.1.2.7 | All three meet or exceed the datasheet's stated requirements (C_IN ≥ 2 × 0.55 µF and 2 × V_IN rating; C_B and C_F are *mandated* values, not choices). | §3 row 28; §4 passives |

### Pass 8 — FMEA (audit 8) · adversarial stance: *"a beginner will do the one thing you did not think of"* — **and the pass that caught the project-flag error**

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P8-1** | **HIGH** | **`hasThermalConcern` is seeded `false`** on a board whose entire lesson is thermal. It is the one flag that changes the materialized `DESIGN_VALIDATION` checklist, and it was wrong in the direction that *removes* scrutiny — the mirror image of l1-03's F1. | ✅ `scripts/populate-curriculum-dag.ts:149` + `canonical-checklist-templates.ts:209-219` | **Flag change required before part creation**, banner at the top of `design.md`. The two conditional rows it adds are evidenced by §5 and audited in Pass 13. | §1, §7 conditionals, Pass 13 |
| **P8-2** | **MED** | **The LED can be connected backwards** — a 2-wire screw terminal, no key, on the single most expensive part after the module. With the LED blocking, V_O runs to `V_O(max) = 9.6 V` of reverse bias, and **Lumileds publishes no reverse rating** (only *"not designed to be driven in reverse bias"*). | ✅ SNVS465G Eq. 5; DS41 Table 3 note 4 | Two candidate hardware mitigations were **generated and then killed by their own analysis** — see P8-3. Settled on **prevention + millisecond detection + a bounded, documented residual** (**RK20**): polarity on silk, on the star and in a checked guide step with a colour-coded lead; firmware reads GPIO5 within 1 ms of asserting DIM and drops DIM outside 2.4–4.2 V, bounding exposure to ~2 ms of reverse voltage *at leakage current*; and **B4** measures the real reversed-case V_O. Same posture l2-01 took on cell reversal. | RK20; §3 row 25 (three distinguishable ADC states); §9 B4 |
| **P8-3** | **MED** | **Two proposed mitigations were wrong, and re-deriving the fault current path is what caught them.** (a) An **anti-parallel Schottky** across J5 *cannot conduct* — the converter defines the polarity, so the diode is reverse-biased in exactly the fault it was meant to fix. (b) TI's own **Zener output clamp** (Fig. 18) would bound V_O to ~5.5 V, but the LED has no published reverse rating so **neither 9.6 V nor 5.5 V is provable**, while the Zener's sub-knee leakage injects an unbounded error straight into the CS node through R9. | ✅ mechanism re-derived for (a); SNVS465G §7.3.9 + §8.1.8.2 for (b) | **Both rejected, and the rejection recorded in §4** so a later reviewer does not "helpfully" add them back. *"The datasheet shows this circuit"* is not the same as *"this circuit helps here."* | §4 rejected-parts rows; friction G7 |
| P8-4 | MED | **C11 makes TI's documented CS hot-swap failure real.** §8.1.8.1: *"any residual charge on the load will be immediately transferred through the output capacitor to the CS pin."* Our LED is on a screw terminal — hot-swap is routine, not exceptional. | ✅ §8.1.8.1 | R9 (1 kΩ) was already present from Pass 1; it is **TI's own prescribed fix**, and its role is now load-bearing rather than precautionary. RK8 upgraded to say so. | RK8; §2 pin 5 |
| P8-5 | LOW | **C11 sits charged to ~9.6 V after an open-LED event** and dumps into the LED when it is re-plugged. | ✅ `½CV² = 101 µJ` | ~30× below the LUXEON C's 8 kV-HBM ESD energy, and firmware's open-LED cut discharges it through R14+R15 with τ = 33 ms. Registered as **RK19**, de-risked with the arithmetic shown. | RK19 |
| P8-6 | — | Re-attacked: reversed supply (D2 **blocks**, and a TVS-only mitigation would have clamped to −0.7 V and violated U3's −0.3 V VIN abs-max); 24 V brick (D3 avalanches, F2 clears, U3 survives at 42 V so the failure is loud); shorted LED (the part regulates into a short — §3 row 39); silent protection-part failure (RK18 symptom set, diagnosable only because GPIO4 exists). | ✅ | No change beyond wording. | RK3, RK4, RK7, RK18 |

### Pass 9 — DFM / solderability + learnability (audits 9, 12) · adversarial stance: *"a beginner cannot build this, and cannot learn from it"*

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| **P9-1** | **HIGH** | **An earlier draft put an NTC on a third 2-pin screw terminal.** Three identical 5.08 mm terminals in a row is a mis-insertion hazard where one of the wrong choices puts 12 V across the ADC divider and another puts 12 V through the inductor into the SW pin. | ✅ topology trace of each mis-insertion | **Designed out rather than labelled around:** the NTC and its terminal were **cut**, the 12 V input moved to a **barrel jack**, and J5 is now the board's only screw terminal — the two connectors are physically non-interchangeable (**RK5**). Temperature is instead inferred from **V_F droop** on an ADC channel the board already needed, which costs zero connectors and teaches "the LED is its own thermometer." | RK5; §1 I2/I3; RK16 |
| **P9-2** | **MED** | **The linear-vs-switching decision existed only on paper.** The brief asks the learner to *make* a reasoned choice; a table they read is not a choice they made. | ✅ | The LED already lives on a screw terminal, so it can be unplugged and driven from an **LM317 + 3.6 Ω + TO-220 heatsink** on a breadboard off the *same* 12 V brick — then the learner measures 113 mA vs 347 mA for identical light, and touches both heatsinks. **Three parts, $1.91, all in stock, no board change.** Sourced and thermally checked (`40 + 3.61 × 21 = 116 °C`, inside the LM317's 125 °C recommended T_J) so the experiment is safe as well as vivid. | §2.5 "built, not just read"; §8 kit |
| P9-3 | MED | Package-by-package sweep against the L2 envelope. | ✅ | All clean: U3 SOIC-8 **no exposed pad** (the `MRX` PowerPAD variant explicitly rejected — **RK17**, and §3 row 36 proves the plain package has 69 °C of margin so the thermal pad is not needed); D2/D4 SMC; D3 SMA; F2 1812; R8 1206; rest 0805/THT; **the power LED is never soldered by the learner**. | §1 solderability; RK17 |
| P9-4 | LOW | SMC (DO-214AB) is a large thermal mass for an iron; and L1's ~12.5 mm body needs its courtyard allocated early. | ✅ | Guide note (the l1-03 flux-pen lesson generalised) + layout constraint L-7. | §5 L-7 |
| P9-5 | LOW | GPIO4/5/6 appear on the breakout headers as well as in the driver circuit. | ✅ | Inherited pattern from l1-03's GPIO5. Silk-marked in-use; the header pins stay electrically safe (dividers ≥ 10 kΩ; a passive wire cannot override R10). **RK12**, accept + document. | RK12; silkscreen rule |

### Pass 10 — Layout-readiness (audit 11, `[L]` capture) · adversarial stance: *"the numbers assume copper you have not promised"*

Constraints **L-1…L-8** written into §5. Two are load-bearing on numbers already
claimed rather than merely good practice:
- **L-3** — D2 and D4's `RθJA = 55 °C/W` is specified *"PCB mounted with 0.55" × 0.55"
  (14 mm × 14 mm) copper pad areas."* Without that copper, §3 row 37's junction
  temperature is not the number.
- **L-4** — the Kelvin sense from Pass 4, on which the entire current spec rests.

Also captured: the all-layer antenna keep-out with the switching cluster at the far
edge (L-1); the SW loop (L-2); the V12 ⟂ VBUS isolation ERC (L-5, a `[L]` DV item);
connector separation (L-6); C7's Z-height and L1's courtyard (L-7); ADC taps routed
away from the SW loop (L-8). **Verification is owed at `[L]` by design (protocol F7).**

### Pass 11 — Pipeline conformance (audit 14) · adversarial stance: *"the machinery will reject or mis-materialize this board"*

| # | Sev | Finding | Verified? | Fix / decision |
| --- | --- | --- | --- | --- |
| **P11-1** | **MED** | **`POST_ASSEMBLY_CONTINUITY` includes "No power rail measures below 100 Ω to GND (a sub-100 Ω rail indicates a solder bridge or reversed part)." On this board the `LED−` net reads `R8 = 0.62 Ω` to ground *by design*.** A learner following the canonical screening step will read 0.62 Ω and conclude the board is shorted. | ✅ `canonical-checklist-templates.ts` POST_ASSEMBLY items | The item carries `notApplicableHint: "N/A for rails intentionally terminated below 100 Ω."` — so the pipeline already anticipates it, but only if someone *knows*. Recorded here and in the bring-up expectations so the operator marks it N/A for `LED−` deliberately rather than being alarmed by it. |
| P11-2 | LOW | `REQUIREMENTS_REVIEW` relevance check: **"ADC1-only constraint recorded"** genuinely **applies** (this board uses two ADC1 channels — GPIO4/GPIO5 — and ADC2 dies with WiFi on). "WS2812 level-shift" and "Servo brownout" are **N/A**. "Auto-shutoff prevention strategy" applies weakly — the MCU draws ~100 mA continuously from USB, enough to keep a typical power bank awake. | ✅ | Recorded so the checklist is answered honestly rather than ticked. No foreign items found on this board's templates. |
| P11-3 | LOW | DAG gate check: `l2-04` depends on `l1-01-wroom-breakout` at **REQUIREMENTS** (FOUNDATION). l1-01's latest revision is at **LAYOUT** ≥ REQUIREMENTS. | ✅ `scripts/populate-curriculum-dag.ts:351` | **No gate problem** — unlike l1-03's F11, which demanded a prerequisite at BRINGUP. Nothing to escalate. |
| P11-4 | LOW | `Project.targetCost` is null (l1-03 F3), so the §8 cost discussion has no machine anchor. | ✅ | Set it alongside the `hasThermalConcern` change. |

### Pass 12 — Sourcing re-screen + internal consistency, first pass (audits 10, 13)

Re-ran the **live DigiKey screen over all 32 lines after** the Pass-5 component changes
(`RC0805FR-0782KL` and the second `CL32B225KBJNNNE` are new to the BOM): **32/32 Active
and in stock, zero OOS.** Recorded stock, price, lifecycle and the DigiKey part number
for every line; the BOM totals **$40.62** (L1.01 core $15.00 + driver side $25.62)
against a ~$30 target, with **LED3 + HS1 = $14.25 = 35 %** of it — named rather than
buried, with three value-engineering options.

Also verified by script that every `refDes` count equals its `quantity` (52 refDes over
32 rows, no duplicates, no gaps C1–C13 / D1–D4 / F1–F2 / HS1 / J1–J5 / L1 / LED1–LED3 /
R1–R16 / SW1–SW2 / TP1–TP2 / U1–U3) — the strict-import precondition (l1-03 F4).

### Pass 13 — Conditional audit: **deep thermal** (fires on `hasThermalConcern`) · adversarial stance: *"you asserted the heatsink; prove it"*

The conditional the seeded flag would have skipped. Run to the two attestations the
template materializes.

**(a) Thermal budget.** Worst-case dissipation computed for **every** part that
dissipates anything (§5 table), each against its own limit and through its own heat
path. The **binding** limit is not the junction — it is Lumileds' **case temperature
85 °C at 350 mA**, the conservative of the two conflicting LED sources (P3-4). At
`P = V_F,max × I_F,max = 1.41 W` that allows **31.8 °C/W** from star to ambient at
T_a 40 °C.
- **With HS1** (6.7 °C/W natural convection, **derated 2×** to 13.4 °C/W because
  natural convection is markedly worse at 1.4 W than at the 9 W it is specified at,
  plus ~1.5 °C/W of interface): `T_c = 61.1 °C` ✓ and `T_j = 72.4 °C` vs 135 °C.
- **Without HS1**: a bare 20 mm star in still air is roughly 50–80 °C/W ⇒
  `T_c ≈ 132 °C` ✗ — and it **fails even at the nominal 0.99 W (104 °C)**. The
  heatsink is therefore a **proven requirement and a BOM line**, not advice.
- The bare-star figure is **the one estimated number in the whole design**. It is
  flagged (**B1**) for measurement, and the design deliberately does not depend on it:
  the mitigation is unconditional either way.
- Also computed: U3 `T_j = 51.1 °C` at the 460 kHz frequency corner (SOIC-8, 106.8 °C/W
  — and 56.1 °C even on the design example's conservative 155 °C/W), D4 `T_j = 47.4 °C`
  on its specified 14 × 14 mm pads (L-3), D2 `T_j = 43.0 °C`.

**(b) Derating.** Every thermally-stressed part at **≤ 32 %** of rating (R8 15.8 % of
0.5 W, L1 21 % of I_sat and 24 % of I_rms, F2 23 % of I_hold before the 60 °C derate
and 32 % after, D2/D4 far below); three junction temperatures **≥ 63 °C** below their
maxima; and the two internal current caps correctly bracket the operating point —
OVP 489 mA and I_LIM ≥ 1.2 A both **above** the 447 mA worst-case peak and the OVP
**below** the LED's conservative 500 mA rating, so a control fault clamps before the
load is stressed.

**Verdict: both conditional attestations earned.** No other conditional fires —
`hasMainsNet`, `hasLiIon` and `requiresStripboard` are all correctly false (no mains
copper anywhere, no cell, and no OTD board is ever stripboard).

### Pass 14 — Fold of Passes 1–13, then an **automated** consistency sweep (audit 13) — **NOT DRY**

All findings folded into `design.md` and `bom.csv`, then cross-checked by script rather
than by eye — because the fold is exactly where l1-03 was bitten twice (F10, F11).

| # | Sev | Finding (NEW / fold-induced) | Disposition |
| --- | --- | --- | --- |
| P14-1 | MED | **The new-part count disagreed three ways**: `design.md` said "14 new parts" (twice), `bom.csv` tagged 12 lines `(NEW)`, and the truth is **13** — `ESL107M035AE3AA` had lost its tag in the Pass-7 rewrite, and `SS34-E3/57T` is a **reuse** (confirmed present in the live library via the parts MCP, manufacturer `Vishay General Semiconductor`). A part-creation step reading either number would have got it wrong. | FOLD: **13** everywhere, plus an explicit numbered list of the 13 exact `(manufacturer, mpn)` strings in §8 so the count is checkable rather than asserted. |
| P14-2 | LOW | Two reused Yageo MPNs (`RC0805FR-075K1L`, `RC0805FR-07470RL`) appeared in `bom.csv` but only in shorthand in §8's table, so a strict `bom.csv → design.md` cross-check failed on them. | FOLD: §8 row split into three, each with its full MPN, value and live stock figure. |

**Clean under attack (no regression):** refDes ↔ quantity on every row (52/32, no
duplicates or gaps); every MPN and every refDes in `bom.csv` present in `design.md`;
`RK1`–`RK21` all defined in the register and every in-text reference resolving; UTF-8
`Würth Elektronik` byte-identical to l1-03's (`W\xc3\xbcrth`); **no stale pre-Pass-3
assertions** — `326 kHz`, `C11 = 10 nF`, `350.3 mA`, `±6 %`, the `9.2 V` open-LED
figure, `1.32 W`, `111 mA`, `190 µA` and the rejected `D5` are gone entirely, and the
only surviving mentions of `68 kΩ` and `25.2 mV` are the **citations that document the
Pass-3 correction** (§3 row 10, friction G4, the R7 BOM note) — the same convention
l1-03 Pass 15 used; §7's tick list matching §6's statuses one for one.

### Pass 15 — Design-stage DRY sweep (fresh adversarial: electrical + consistency) — **DRY**

Re-ran the full sweep against the folded documents, re-attacking the two lenses most
likely to have been disturbed by the Pass-14 edits (sourcing/consistency) plus the two
that changed hardware (part-truth, power integrity).

- **Electrical:** every §3 row re-evaluated from the locked triple (L 100 µH / R_ON
  82 kΩ / R8 0.62 Ω / C11 2.2 µF) by the same program; the CS window still holds at
  **1.20× / 1.25×**; `t_ON` and `t_OFF` floors still clear by 2.1× and 4.7×; CCM still
  holds; I_peak 447 mA still sits under the 489 mA OVP cap and the 500 mA LED rating;
  the three junction temperatures unchanged.
- **Consistency:** the P14-1/P14-2 fixes verified by re-running the script — zero
  missing MPNs, zero missing refDes, 13 `(NEW)` tags matching the §8 list of 13.
- **Sourcing:** the live screen is same-day; all 32 lines Active and in stock.
- **Pedagogy:** §2.5 states both topologies with their own numbers, names the operating
  region where **linear wins**, gives the rule the learner can carry away, and hands
  them a $1.91 breadboard build that makes the comparison a measurement.

**Verdict: DRY (design-stage), zero new material findings.** With **15 passes run** and
a design-stage dry pass achieved, **every `[D]` audit is clean and both conditional
audits are earned — the gate is met.** The board is **part-ready pending the owner's
actions**: set `hasThermalConcern = true` (and `targetCost`), create the 13 new parts,
import `bom.csv`, and sign the `DESIGN_VALIDATION` attestations. **Nothing in the
library, the BOM or the revision was touched by this design pass.**

Still owed, by phase and by design (protocol F7): footprint ↔ symbol ↔ pinout `[S]`;
fab-DRU DRC + the V12 ⟂ VBUS isolation ERC `[L]`; and the four bring-up measurements
**B1** (bare-star θ), **B2** (SS34 V_F at 0.357 A), **B3** (partial-3V3 rail),
**B4** (off-state glow and the reversed-LED V_O).
