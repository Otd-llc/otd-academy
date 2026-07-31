# L2.05 Isolated SPI Bridge — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. Backs the board's `DESIGN_VALIDATION`
> attestations.

| | |
| --- | --- |
| **Slug** | `l2-05-isolated-spi-bridge` |
| **Status** | **`DRY ✓ (design-stage part-ready)`** — all `[D]` audits clean; `[S]`/`[L]` captured + owed |
| **Passes run** | 17 (14 core + 2 conditional + 1 dry sweep) |
| **Last dry pass** | Pass 17 (2026-07-30) — zero new material findings |

## Gate (Definition of done — all hold before any part/BOM/revision)

- [x] Requirements traced · pins accounted + sequencing proven (audits 1, 2)
- [x] Every number worst-case-proven · parts datasheet-verified (audits 3, 4, 5)
- [x] Power integrity proven · every failure mode mitigated-or-accepted (audits 7, 8)
- [x] Every part hand-buildable + sourceable (exact import strings) (audits 9, 10)
- [x] Layout constraints **captured** · teachable · consistent · pipeline-conformant (audits 11–14)
- [x] Every applicable conditional audit run (**isolation/safety, pass 15**; RF/regulatory, pass 16) · every risk de-risked or scheduled
- [x] **≥ 10 passes AND a dry pass achieved** (17 passes; dry at pass 17)
- [x] `validation-log.md` complete
- [ ] `[S]` footprint ↔ symbol ↔ pinout pad map, incl. **RK14's three pad-level questions** (audit 6) — **owed at schematic stage**
- [ ] `[L]` barrier keep-out all-layers + split planes + net-class ERC invariant + USB pair + antenna keep-out + fab-DRU DRC (audit 11) — **owed at layout stage**

**Method note.** Adversarial stance, rotated per pass, stated at the head of each entry.
The standing hostile question for this board was: ***"show me the DC path across the
barrier, or show me the place where the isolation is real but the design is wrong about
what it bought."*** Every load-bearing number was taken from the manufacturer's own
datasheet PDF (read directly, not from a distributor summary or from memory); every part
was screened live against DigiKey with the project's own client. Where a figure could
not be verified at source, that is stated as a residual rather than papered over.

**Datasheets read at source during this run:** RECOM **R1SE** REV 4/2024 (pp. 1–5) · TI
**ISO7740/41/42** SLLSEP4J rev. Oct 2024 (pp. 1–10, 15–16, 20, 29–30, 34–35) · Microchip
**MCP1703A** DS20005122C (pp. 1–5, 7–10) · Microchip **MCP3204/3208** DS21298E (pp. 1–4)
· Espressif **ESP32-S3-WROOM-1** v1.8 Table 3-1 (via the parts MCP's VERIFIED record) ·
Littelfuse **miniSMDC150F-2** and **1206L050YR** parametrics (Littelfuse data via
DigiKey) · Bourns **SRN6045TA-101M** and Panasonic **EEU-FR1C221B** parametrics ·
ESP-IDF SPI Master driver documentation.

## Passes

### Pass 1 — Requirements & traceability `[D]`

*Adversarial stance: assume a requirement is missing that a learner will discover the
hard way.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 1.1 | MED | The board was specified as "a bridge," but nothing said what happens when a learner attaches their own SPI device to the isolated side **while the on-board ADC is still on the bus**. With a single CS# channel, that is guaranteed MISO contention — an un-designed failure hiding inside a stated goal ("re-usable"). | yes | Added **F9** (isolated bus + rails on a header, ADC removable) and the hardware to honour it: **JP1** shunt gating U5's CS# with **R8 10 kΩ** holding it deasserted when open. | §1 F9, §2 sub-circuit J, §6 RK11 |
| 1.2 | MED | The tagline promises "clean measurements" but no requirement stated **how clean**. Without a number, "post-regulation" is a gesture, not a spec, and pass 4 would have had nothing to test against. | yes | Added **F4** with a hard target: supply-borne ripple at the ADC's V<sub>REF</sub> **≤ 1 LSB = 0.806 mV p-p**. Expressed in LSBs, not millivolts, because the ADC is what cares. | §1 F4, §3 rows 8–9 |
| 1.3 | LOW | Test points had no requirement trace (the same orphan L1.02 pass 1 found). Here they are not a bring-up aid — they are the lesson's evidence. | yes | Added **F10**: scope `V_ISO_RAW` and `3V3_ISO` against `GND_ISO` and *see* the post-regulation. TP3/TP4/TP5 trace to F10; TP1/TP2 to bring-up. | §1 F10, §8 |
| 1.4 | LOW | No requirement covered "how do I know the far side is alive?", yet a dead isolated rail is this board's characteristic failure. | yes | Added **F8** (one power LED per domain) and **F11** (controller activity LED). Also recorded the firmware-visible signature: an unpowered isolated side reads **0xFF** because OUTD defaults HIGH. | §1 F8/F11, §2 sequencing |

Traced **F1–F11 → topology sub-circuit → calc row → BOM line → risk → DV item.** No
orphan requirement. Checked the reverse direction too — every part maps to a
requirement: JP1/R8 ← F9; TP3–TP5 ← F10; LED3 ← F8; LED2/R6 ← F11; R7 ← E3/F4; L1/C11 ←
F4; R13–R16 ← I4; R9–R12 ← I5/F9. **Residual:** none.

### Pass 2 — Topology / net integrity `[D]` (logical net; pad map re-verifies at `[S]`)

*Adversarial stance: find a floating node, or a pin nobody thought about.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | **HIGH** | **MCP3208 CH4–CH7 were unassigned.** Four floating analog inputs on a SAR ADC: they charge to arbitrary potentials, the input mux couples them into the sample capacitor, and readings on the *used* channels wander. A classic mixed-signal defect that produces "flaky ADC" bug reports for months. | yes (DS21298E analog-input spec; sample cap 20 pF, switch 1 kΩ) | **CH4–CH7 tied to `GND_ISO`.** No floating analog input anywhere on the board. | §2 U5 pin table |
| 2.2 | MED | **U3's EN1/EN2 were going to be left open**, relying on the internal 2 MΩ pull-up ("enabled when high **or open**"). Correct per the datasheet, but it is an *unstated dependency on an internal resistor* sitting next to a 76 pF barrier and a switching converter. | yes (ISO774x Table 4-1; §7.4.1 shows a 2 MΩ pull-up, I<sub>IL</sub> −30 µA) | **EN1 tied to `3V3_A`, EN2 tied to `3V3_ISO`.** Zero cost, removes the assumption. | §2 U3 pin table |
| 2.3 | MED | All 41 WROOM pins were not explicitly accounted for; strapping pins GPIO3/45/46 had no stated policy — the same latent floating-strap hazard L1.02 pass 2 caught. | yes (catalog VERIFIED pinout) | Added the full **pin-accounting policy**: GND/EPAD → `GND_A`, 3V3 → rail, EN/BOOT/USB/SPI/LED assigned, **strapping 3/45/46 left NC at module-internal defaults**, all remaining IO explicitly NC and **not exposed on any header**. | §2 U1 pin table |
| 2.4 | MED | `GND_ISO` is a **floating node with no defined potential** — obvious in hindsight, but the topology section did not say so, and a reader could assume a hidden tie. | yes | Stated explicitly, including that its only coupling to `GND_A` is the ~76 pF of barrier capacitance and the transformer's magnetic path. | §2 "Current return paths" |
| 2.5 | LOW | The ISO7741 has **two** GND1 pins (2, 8) and **two** GND2 pins (9, 15). Connecting only one of each is a common and easy schematic error. | yes (Table 4-1) | Both of each called out in the pin table as required. | §2 U3 pin table |

**Sequencing** proven in both directions against ISO774x **Table 7-2**, including the
~26 ms window on power-down where VCC1 is dead and VCC2 alive (§3 row 31). **Current
returns:** two independent returns, one per domain, each with its own split pour.
**Residual:** none at `[D]`; exact pad map owed at `[S]`.

### Pass 3 — Math audit `[D]` (worst-case, re-derived)

*Adversarial stance: assume every reused number is stale and every unregulated part
misbehaves at the corner nobody plots.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | **CRITICAL** | **The isolated LDO was going to be the RT9080** — the catalog part, the reuse-friendly choice, the one already on the controller side. Its **absolute maximum V<sub>IN</sub> is 6 V.** Working the R1SE's light-load behaviour properly (deviation-vs-load graph: **+16 % at no load**, stacked with **±5 % max output accuracy** and a ratiometric high line of 5.48 V) puts `V_ISO_RAW` at **6.00 V normally, 6.33 V with the preload open, 6.68 V at true no load.** That is **at or over absolute maximum** — a part destroyed by its own supply, on a board that would have passed a casual review because "the rail is nominally 5 V." | yes — RECOM R1SE regulations table + deviation-vs-load graph; RT9080 abs max | **Part chosen against the datasheet instead of the catalog: MCP1703AT-3302E/DB, abs max V<sub>IN</sub> = 18 V** → ≥ 11.3 V margin at the absolute worst case. | §3 rows 4–5, §4 U4, §6 RK5 |
| 3.2 | **HIGH** | With only the on-board load (7.9 mA), PS1 runs at **~4 % of rated load** — below the datasheet's Note 5 threshold, where "specifications may not be met." Every voltage number on the isolated side would have been an extrapolation off a graph rather than a spec. | yes — R1SE Note 5 | **R7 preload added**, sized to hold PS1 at **≥ 11.6 %** load, bringing the design back inside the datasheet's specified window. | §3 rows 12–13, §6 RK7 |
| 3.3 | MED | The preload was first sized in 0805. At the worst normal rail (6.00 V) it dissipates **109 mW** — **87 %** of an 0805's 125 mW rating, at the hottest spot on a board a beginner will touch. | yes | **1206 (250 mW)**, `RC1206FR-07330RL` → **44 %** of rating. | §3 row 13 |
| 3.4 | MED | The USB-VBUS worst case had been carried over from L1.01 without re-deriving it for a board that also feeds a 1 W converter. PS1's input floor (4.5 V) is only **250 mV** below USB's 4.75 V minimum — a budget L1.01 never had to spend. | yes | Full drop budget derived (row 2) and driven into pass 7's PTC change. | §3 rows 1–3 |
| 3.5 | LOW | Units and dimensional check on every row: V·A = W, H·F = s², Ω·F = s, (f/f₀)² dimensionless. LSB conversions checked against V<sub>REF</sub>/4096, not V<sub>DD</sub>/4096 (they are the same net here, but the distinction matters if V<sub>REF</sub> is ever separated). | yes | no change | §3 |

Re-derived independently: LDO dropout headroom **+435 mV** at the pessimistic 250 mA
dropout figure; π-filter corner and attenuation at −20 %/−20 % tolerance; LED currents;
EN RC; CC pull-downs; every junction temperature. **Residual:** none.

### Pass 4 — Physics / first-principles `[D]`

*Adversarial stance: what do the equations assume away? Where does a datasheet headline
number stop being true?*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 4.1 | **CRITICAL** | **The board's central premise — "noisy isolated rail → LDO → clean rail" — is false with this LDO at this converter's frequency.** MCP1703A PSRR is quoted as 35 dB, but that is **at 100 Hz**. The PSRR-vs-frequency curves (Figures 2-25 and 2-27) show rejection collapsing to **≈ 0 to −8 dB between roughly 15 kHz and 30 kHz** — and PS1's internal operating frequency is **20–70 kHz**, i.e. the notch sits exactly on the ripple. The LDO would have passed PS1's **100 mV p-p** straight through onto a 12-bit reference: **124 LSB**, the bottom seven bits destroyed. The design would have "worked" and been quietly, badly wrong — and the lesson would have taught a falsehood. | yes — MCP1703A Figs 2-25/2-27 read directly; R1SE basic-characteristics table | **π filter added and sized to do the whole job on its own**: C10 – **L1 100 µH** – **C11 220 µF**, corner 1.07 kHz nominal / 1.34 kHz at −20 %/−20 %, giving **46.9 dB at 20 kHz worst case**. **The LDO is credited 0 dB in this band.** Result **0.45 mV p-p = 0.56 LSB**, inside F4. The LDO's job is redefined and stated: DC regulation and surviving the light-load overshoot — *not* HF rejection. | §2 "Post-regulation", §3 rows 8–9, §6 RK6 |
| 4.2 | MED | Adding an LC in front of a linear regulator creates an input filter that can ring: an LDO is close to a constant-current load, so it contributes no damping. An undamped filter would peak at its corner. | yes — computed | Q = Z₀/R = √(L/C) ÷ (DCR + ESR) = 0.674 ÷ (0.456 + 0.130) = **1.15**, ≈ +1.2 dB. Recorded that **C11 must be an electrolytic, not a ceramic** — its ESR is load-bearing, and its lack of DC-bias derating is what makes the filter math hold. A low-ESR ceramic bank would both raise Q *and* lose half its capacitance at 5 V bias. | §3 row 10, §4 C11 |
| 4.3 | **HIGH** | **The SPI round trip through the barrier had never been budgeted.** Isolation costs time in both directions, and MISO is sampled a half-period after the clock edge that produced it. Nobody had computed whether the loop closes. | yes — ISO774x §5.16 (t<sub>PD</sub> max 18.5 ns @3.3 V, PWD 5.9 ns, t<sub>sk(o)</sub> 4.4 ns) + MCP3208 timing table (t<sub>DO</sub> max 200 ns) + ESP-IDF frequency-limit formula | Full budget derived: **237.0 ns** round trip vs a **494.1 ns** window at 1 MHz → **52 % margin**. Cross-checked against ESP-IDF's `80/(⌊delay/12.5⌋+1)` = **4.21 MHz** ceiling. **f<sub>SCLK</sub> locked at 1.0 MHz.** Also derived the teaching number: the barrier alone would cap SPI at ~13–27 MHz vs a direct connection — **the ADC, not the isolator, is what actually limits this board**, which is worth saying out loud. | §3 rows 14–16, §1 I3 |
| 4.4 | MED | Using arbitrary GPIO for SPI would route through the ESP32-S3's GPIO matrix, adding two APB cycles (25 ns) to the MISO path and lowering the frequency ceiling. Free to avoid, easy to get wrong. | yes — catalog VERIFIED pinout confirms IO10 = FSPICS0, IO11 = FSPID, IO12 = FSPICLK, IO13 = FSPIQ; ESP-IDF docs confirm the IO_MUX penalty | **SPI2/FSPI IO_MUX pins GPIO10–13 specified.** Proven that even *with* the matrix penalty the design passes (3.6 MHz ceiling), so this is margin, not a dependency. | §3 row 15, §2 U1 pin table |
| 4.5 | MED | "Galvanic isolation" was being treated as an open circuit. It is not: the barrier has **capacitance**, and the DC-DC dominates it. | yes — ISO774x C<sub>IO</sub> ≈ 1 pF; R1SE isolation capacitance 75 pF max | Quantified: **≈ 76 pF**, giving **76 mA** of displacement current at a 1 kV/µs common-mode slew. Recorded as a first-class fact, not a footnote — the isolator contributes 1.3 % of it and the *power* crossing contributes the rest. | §3 row 17, §9.3 |
| 4.6 | LOW | Inrush: C11's 220 µF is charged by PS1, not by the host, and PS1's max capacitive load is **1000 µF**. C8/C9's 20 µF on VBUS is charged through F1 with the host's own limiter behind it. | yes — R1SE selection guide "max Capacitive Load 1000 µF" | accept (no change) | §3 row 35 |

**Residual:** none material.

### Pass 5 — Part-truth (datasheet) `[D]`

*Adversarial stance: the part is not what the marketing page says. Read the tables.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 5.1 | **HIGH** | **ISO7741 vs ISO7741F is not a cosmetic suffix.** The non-F part defaults its outputs **HIGH** when the input-side supply is lost; the F suffix defaults **LOW**. On this board CS# is active-low and — per §3 row 31 — `3V3_ISO` outlives `3V3_A` by **~26 ms** on every unplug. With the F variant, CS# would be **asserted** for 26 ms with a static clock and a dying master. | yes — ISO774x Features + §3 Description + **Table 7-2** | **ISO7741 (non-F) locked**, with the reasoning written into §2's sequencing table, §4, §6 RK8, and a `bom.csv` note, so no future "compatible part" swap can undo it silently. | §2, §4 U3, §6 RK8 |
| 5.2 | MED | **The isolator's outputs are weak.** Recommended-operating I<sub>OH</sub>/I<sub>OL</sub> at 3.3 V is only **∓2 mA** (abs max ±15 mA). A designer reaching for "put an LED on the isolated clock to show activity" would be outside the recommended window by 50 %. | yes — ISO774x §5.3, §5.11 | No isolator output drives an LED anywhere on this board; **LED3 is driven by the rail, not by a channel.** J3's series resistors sized so that even a hard short is 3.3 mA — outside the 2 mA recommendation (V<sub>OL</sub> not guaranteed) but **4.5× inside abs max**, i.e. survivable rather than destructive. Stated honestly as such. | §3 row 26, §4 U3 |
| 5.3 | MED | **MCP3208 publishes no f<sub>CLK</sub> figure at 3.3 V** — only 2.0 MHz at 5 V and 1.0 MHz at 2.7 V. Interpolating to ~1.3 MHz would be inventing a guarantee. | yes — DS21298E timing table | **Take the guaranteed 2.7 V number: f<sub>SCLK</sub> = 1.0 MHz.** Independently bounded by t<sub>HI</sub>/t<sub>LO</sub> ≥ 250 ns → 2 MHz hard ceiling. | §3 row 14 |
| 5.4 | MED | The ISO7741's supply current was about to be taken from the "DC signal" column. This board switches all four channels at 1 Mbps, which is a **different row**: I<sub>CC1</sub> 4.7 mA max and I<sub>CC2</sub> 4.5 mA max, versus 2.8/3.7 mA DC. Under-counting the isolated side's own draw would have under-sized the preload and the LDO headroom. | yes — ISO774x §5.12, "Supply current – AC signal, 1 Mbps" row | Budget uses the **1 Mbps AC maxima**. | §3 rows 19–20 |
| 5.5 | LOW | MCP3208's **V<sub>REF</sub> current drain** (100 µA typ / **150 µA max**) is a separate line from I<sub>DD</sub> and is easy to miss when V<sub>REF</sub> is tied to V<sub>DD</sub>. | yes — DS21298E reference-input spec | Counted separately in the load budget. | §3 row 19 |
| 5.6 | LOW | The RECOM converter's headline "1 W / 200 mA" is at **full load**; its efficiency at our 12–26 % operating point is **45–62 %**, not the 75 % on the front page. Using 75 % would have under-stated the VBUS current by ~30 %. | yes — R1SE efficiency-vs-load graph | Input current computed from the graph's actual efficiency at the operating point. | §3 row 21 |

U1's pinout re-confirmed against the catalog's **VERIFIED** record (pin 18 = IO10/
FSPICS0, 19 = IO11/FSPID, 20 = IO12/FSPICLK, 21 = IO13/FSPIQ; strapping set 0/3/45/46;
USB 19/20). U2/D1/J1 datasheet facts inherited from L1.01's verification (identical
parts, identical use). **Residual:** none.

### Pass 6 — Footprint ↔ symbol ↔ pinout `[S]` (captured; verifies at schematic)

Per protocol this audit **cannot honestly close pre-schematic**. Captured, with three
board-specific questions that are more than the usual pad check because two of them are
*isolation* questions:

1. **PS1 land pattern (RK14).** Measure the recommended footprint's **input-to-output
   pad-edge separation** and confirm the chosen KiCad footprint does not reduce it.
   Confirm which side of the barrier **pad 8 (NC)** sits on — a pad landing inside the
   keep-out channel would violate M1 even with nothing connected to it. The board gap is
   then set to the **larger** of U3's > 8 mm and PS1's own separation.
2. **U3 package variant.** Confirm the footprint is **DW-16 (wide body, 10.30 mm)** and
   not the narrow SOIC or the DBQ QSOP — the QSOP's creepage/clearance is **> 3.7 mm**,
   less than half, and would silently halve the board's spacing budget.
3. **U4 SOT-223 tab net.** Confirm the tab is electrically common with **pin 2 (GND)**
   and that the symbol/footprint agree; and re-check pin order (1 = V<sub>IN</sub>, 2 = GND,
   3 = V<sub>OUT</sub>) against RK13's warning that other SOT-223 LDO families reverse it.

Plus the routine pad-by-pad check on U1 (castellations + EPAD pin 41), U5 (SOIC-16),
D1, F1 (1812), L1 (6045), C11 (radial 5.0 mm lead spacing, polarity), J1, and the
headers. **Residual:** the `[S]` audit itself (gate item, tracked).

### Pass 7 — Power integrity `[D]`

*Adversarial stance: find the rail that quietly leaves its specified range under load.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 7.1 | **HIGH** | **The reused PTC starves the isolated converter.** L1.01's `1206L050YR` has **R<sub>1max</sub> = 700 mΩ** (post-trip/post-reflow maximum). This board draws 157 mA continuously and up to **597 mA** if a learner enables the radio. At 597 mA that is a **418 mV** drop, putting PS1's input at **4.33 V — below its 4.5 V minimum.** Worse, 0.5 A hold is itself below the board's burst draw, so the part could nuisance-trip. Copying L1.01's front end "verbatim" was the wrong instinct on a board that added a 1 W converter. | yes — Littelfuse parametrics for both parts (1206L050YR: I<sub>hold</sub> 0.5 A, I<sub>trip</sub> 1 A, R<sub>i,min</sub> 150 mΩ, **R<sub>1,max</sub> 700 mΩ**; miniSMDC150F-2: I<sub>hold</sub> 1.5 A, I<sub>trip</sub> 3 A, R<sub>i,min</sub> 40 mΩ, **R<sub>1,max</sub> 110 mΩ**) | **F1 changed to `miniSMDC150F-2`** — an existing L2.01 catalog part, so no new part is created. Drop falls to **66 mV** at 597 mA → PS1 input **4.68 V**, in spec with **184 mV** margin *with the radio on*. **The looser 1.5 A/3 A protection is an explicitly accepted trade** (RK4), justified by 3× the current draw, a 500 ms trip on a hard short, and the host's own limiter. | §3 rows 2–3, §4 F1, §6 RK4 |
| 7.2 | MED | The MCP1703A's dropout is specified **only at 250 mA** for our output-voltage band, while the actual load is 37.9 mA. Using the 250 mA figure is conservative but risks looking like a failure if the margin were thin. | yes — MCP1703A DC table + Figs 2-14/2-15 | Proven both ways: **+435 mV** at the pessimistic 725 mV max dropout; **≈ +1.05 V** at the load-scaled ~110 mV. Both stated so the margin is not overclaimed *or* underclaimed. | §3 row 7 |
| 7.3 | MED | Decoupling had not been checked against each part's own recommendation. | yes — ISO774x §8.3 (0.1 µF at **both** VCC1 and VCC2, as close as possible); MCP1703A typical app (1 µF in, 1 µF out, stable 1–22 µF ceramic); MCP3208 V<sub>DD</sub>/V<sub>REF</sub> | C7/C14 (0.1 µF) at U3's two supplies; C12/C13 (1 µF) at U4; C15 (0.1 µF) at U5 V<sub>DD</sub> and C16 (1 µF) at V<sub>REF</sub>; C1/C2/C3 as L1.01. | §2, §4 |
| 7.4 | LOW | PS1's short-circuit protection and the absence of an isolated-side fuse needed an explicit rationale rather than an omission. | yes — R1SE protections table (SCP below 100 mΩ, 1 s) | Recorded: **the converter is the current limit.** 1 W source, 38 mA budget, U4's own 400 mA short-circuit current behind it. No isolated-side fuse, by design and stated. | §9.5 |

Budget: `3V3_A` 71 mA of 600 mA ✓; `3V3_ISO` 37.9 mA of 250 mA ✓; `V_ISO_RAW` 51.5 mA
of 200 mA ✓. Brownout: no radio-driven transient on the isolated side at all — the two
domains' transients are independent, which is a genuine (if incidental) power-integrity
benefit of isolation. **Residual:** none.

### Pass 8 — Failure modes (FMEA) `[D]`

*Adversarial stance: a beginner with a scope, a jumper wire, and a bench supply.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 8.1 | **CRITICAL** (use hazard) | **An earthed oscilloscope shorts the barrier.** A mains-powered scope's ground clip is bonded to protective earth. Clip it to `GND_ISO` while the USB host is *also* earthed and the isolation is bypassed **through the scope** — and every measurement taken afterwards is wrong, including the ripple measurement F10 exists for. This is the single most likely way this board's isolation gets destroyed in practice, and it leaves no trace. | yes (first principles; standard bench-safety practice) | Cannot be fixed in hardware, so it is **designed for**: test points are **labelled by domain**, `GND_ISO` (TP5) sits **with** the isolated test points so the natural probing gesture is the correct one, the barrier is silkscreened, and **RK3 requires the guide to teach it explicitly** (probe one domain at a time; differential probe or battery scope to probe across). | §6 RK3, §1 F10 |
| 8.2 | **HIGH** | **Back-powering the isolated side through J3.** ISO774x Table 7-2 note 2: *"A strongly driven input signal can weakly power the floating V<sub>CC</sub> through an internal protection diode and cause undetermined output."* A learner's externally-powered device on J3 driving ISO_MISO into IND with `3V3_ISO` down could part-energise the isolated rail and produce garbage that looks like a software bug. | yes — ISO774x Table 7-2 note 2 + §7.4.1 I/O schematic (985 Ω series + ESD diodes to V<sub>CCI</sub>) | **R9–R12 (1 kΩ)** bound the injection to **4.3 mA**, inside the ±15 mA abs-max I<sub>O</sub>. The failure is self-limiting and detectable. J3's power pins labelled as **outputs**. | §3 row 28, §6 RK10 |
| 8.3 | **HIGH** | **Over-voltage on the isolated analog inputs.** J2 is the field side; a learner *will* connect something. MCP3208 inputs are rated only −0.6 V to V<sub>DD</sub>+0.6 V. Bare header pins into a SAR ADC is an invitation. | yes — DS21298E abs max | **R13–R16 (1 kΩ)** current-limiting, with the value proven not to cost accuracy: 12-bit settling in the 1.5 µs sample window tolerates up to **8.3 kΩ** of total source impedance, so 1 kΩ is free. **Stated honestly as current limiting, not clamping** — 12 V applied still injects ~8 mA into the ESD structure. Silkscreen and doc say **0–3.3 V only**. | §3 row 27, §6 RK12 |
| 8.4 | MED | **Bus contention on ISO_MISO** if an external J3 device shares the single CS# with the on-board ADC (surfaced by finding 1.1, resolved here at the hardware level). | yes | **JP1** + **R8 10 kΩ** pull-up: shunt fitted = on-board ADC; removed = ADC deselected and J3 owns the bus. R8's 0.33 mA injection into the isolator output is ≪ its 2 mA I<sub>OL</sub>. | §3 row 29, §6 RK11 |
| 8.5 | MED | **Power-up window with undetermined isolated outputs.** While `3V3_ISO` < 2.25 V, U3's side-2 outputs are undetermined per Table 7-2 — CS# could momentarily assert. | yes — Table 7-2 footnote 1 | U5 is on the same dead rail, so nothing is driven into a powered chip; U4's ~600 µs delay makes the ramp monotonic. **Firmware idles CS# high before enabling the bus and discards the first conversion.** | §2 sequencing, §6 RK9 |
| 8.6 | MED | **A solder bridge across the barrier is undetectable.** The board keeps working perfectly. No LED changes, no error, no failed read. | yes | Accepted as un-detectable in hardware and escalated instead: **RK2 rated Critical**, with the `[L]` gate requiring (a) an all-layers keep-out rule area, (b) fab-DRU DRC clean, and (c) an explicit **net-class isolation ERC invariant** between the `_A` and `_ISO` net groups. Machine-checked, because a human cannot see it. | §6 RK2, §9.5 |
| 8.7 | MED | **Preload resistor fails open** → PS1 runs at 4 % load and the rail rises. | yes | §3 row 5 proves nothing on the island is over-stressed even at true no load (6.68 V vs U4's 18 V, C11's 16 V, C10's 25 V). **Defence in depth, not a single point.** | §3 row 5, §6 RK7 |
| 8.8 | LOW | Reverse polarity: USB-C is reversible and keyed. Hot-plug/ESD on USB: F1 + D1 as L1.01. Short on `3V3_A`: RT9080 OC/OT. Short on `3V3_ISO`: U4 short-circuit + over-temperature, then PS1's SCP. BOOT/EN mis-press: recoverable. | yes | no change | §9.5 |
| 8.9 | LOW | **C11 fitted backwards** — a polarised THT electrolytic on a beginner-adjacent board. | yes | Silkscreen polarity marking is already a stated rule; noted for the guide's build steps. 16 V part on a ≤ 6.7 V rail, so a reversed part fails obviously rather than violently. | §4 silkscreen rules |

**Residual:** RK3 and RK12 are accepted-with-labelling (use hazards, not defects); RK2's
machine check is owed at `[L]`.

### Pass 9 — DFM / solderability `[D]`

*Adversarial stance: hand this to someone who has built exactly one board (L1.01).*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 9.1 | MED | SOT-223 (U4) has a large thermal tab and needs noticeably more heat than the SOT-23s a learner met on L1.01 — a classic cold-joint source that presents as "the isolated rail is dead." | yes | Kept (the package is otherwise ideal); flagged as a **guide build note**, not a design change. Board is ENIG, which helps. | §1 solderability, §4 |
| 9.2 | LOW | PS1 is a plastic module on 5 pads that are partly under the body — inspectable from the side but not from above. | yes | Accepted: the pads are large (1.20 × 1.80 mm) and on a 2.54 mm pitch, far more forgiving than the USB-C receptacle L1.01 already proves is hand-solderable. Guide note: inspect from the side. | §1 |
| 9.3 | LOW | Polarised/oriented parts count is up vs L1: C11 (electrolytic), three LEDs, D1, U3, U5, U4, PS1, F1. | yes | Silkscreen rules already require polarity and pin-1 marking on every one; restated as a first-class rule in §4. | §4 |

**Package census against the L2 envelope: no leadless parts.** SOIC-16-WB ×1, SOIC-16
×1, SOT-23-6 ×1, TSOT-23-5 ×1, SOT-223-3 ×1, 1812 ×1, 6045 inductor ×1, 5-pad SMD
module ×1, 0805 ×16, 1206 ×1, radial THT ×1, THT buttons/headers/test points, USB-C with
THT retention posts. **The two new SOIC-16 parts are the *easiest* ICs on the board** —
1.27 mm pitch gull-wing with fully visible fillets. Test access: five test points, both
domains. Assembly order and courtyards → `[L]`. **Residual:** none.

### Pass 10 — Sourcing / lifecycle `[D]`

*Adversarial stance: assume the part you designed around cannot be bought.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 10.1 | **HIGH** | **`ISO7741DW` — the tube-packaged part number that a datasheet ordering table leads you to — is `Obsolete` with 0 stock at DigiKey.** The design would have been frozen against an unbuyable MPN. | yes — live DigiKey screen | **`ISO7741DWR`** (tape and reel): Active, **6,330** in stock, $3.56. Same die, same DW-16 package. | §8 |
| 10.2 | MED | **`MCP1703A-3302E/DB` shows 0 stock**; the stocked orderable part is the tape-and-reel `MCP1703AT-3302E/DB`. Same trap as 10.1. | yes — live DigiKey screen | **`MCP1703AT-3302E/DB`**: Active, **5,231** in stock, $0.84. Recorded as a *pattern*: the tube number is not the stocked number. | §8 |
| 10.3 | MED | **A same-package "second source" for U4 can destroy the board.** SOT-223 3.3 V LDO pinouts are not consistent across families: MCP1703A is 1 = V<sub>IN</sub>, 2 = GND, 3 = V<sub>OUT</sub>; NCP1117/AMS1117-class parts are 1 = ADJ/GND, 2 = V<sub>OUT</sub>, 3 = V<sub>IN</sub>. Identical footprint, reversed function. Both families are cheap and well-stocked, so the substitution is *likely*. | yes — Microchip package drawing vs the NCP1117/AMS1117 convention | **RK13 raised**, and the only listed second source (`MCP1755S-3302E/DB`) is flagged **"confirm pinout before substituting."** No ECN may swap U4 without a pad-level check. | §6 RK13, §8 |
| 10.4 | MED | Three candidate parts were designed in and then found to have **0 stock**: `CL32B106KBJNNNE` / `CL31B106KAHNNNE` (10 µF 25 V 1210/1206), `EEU-FM1C221` and `ECA-1CM221` (220 µF electrolytic). A design frozen on any of them would not have been buildable. | yes — live DigiKey screen | Bulk/decoupling reworked to use the **existing catalog** `C0805C106K3PACTU` (KEMET 10 µF **25 V** X5R 0805, 126 k in stock) — verified to be a 25 V part, so 2× in parallel comfortably exceeds the 6.8 µF the converter's filter suggestion asks for. Electrolytic changed to **`EEU-FR1C221B`** (Panasonic, 8,507 in stock, impedance 130 mΩ @ 100 kHz — and that impedance is what damps the π filter, so the substitution had to be re-proven, not just swapped). | §3 rows 10, 35; §8 |
| 10.5 | MED | **The strict BOM import matches the CURATED LIBRARY, not DigiKey**, and the two disagree: DigiKey returns `YAGEO`, `Littelfuse Inc.`, and uppercases the MPN to `MINISMDC150F-2`; the library uses `Yageo`, `Littelfuse`, `miniSMDC150F-2`. Copying DigiKey's strings into `bom.csv` would have failed the import on four lines. | yes — DigiKey API `Manufacturer.Name` vs `docs/boards/l1-02-espnow-link/bom.csv` and the parts-MCP record for `miniSMDC150F-2` | `bom.csv` uses **library** strings throughout, and new parts follow the library's conventions (`Yageo`, not `YAGEO`). Called out explicitly in §8 so part creation does not reintroduce the mismatch. | §8, `bom.csv` |
| 10.6 | LOW | The 10 kΩ already in the catalog would have been the "free" choice for the analog series resistors. Pass 4's settling derivation rules it out (10 kΩ + 1 kΩ internal × 20 pF ⇒ 9τ ≈ 2 µs > the 1.5 µs sample window). | yes — DS21298E sample cap + switch resistance | **New 1 kΩ line accepted** rather than reusing a value that would have quietly broken 12-bit settling. A reuse that costs accuracy is not a reuse. | §3 row 27 |

**Full live screen: all 26 lines matched, lifecycle Active, in stock** (8.5 k → 6.9 M
units; build quantity 1). 17 of 26 lines reuse existing catalog parts; **9 new parts**.
Cost ≈ **$30.60** vs a ~$30–32 target ✓. Second sources recorded for U4, C11 and D1;
**explicitly refused for U3 and PS1**, because either substitution re-opens §9's
isolation statement. **Residual:** none. (Owner re-confirms stock visually at part
creation per the review checklist.)

### Pass 11 — Layout-readiness `[L]` (captured; verifies at layout)

Captured constraints, in priority order. The first three are unique to this board and
are the reason this audit matters more here than on any previous board:

1. **Barrier keep-out (M1, RK2).** A straight channel **≥ 8.0 mm** across the full board
   width, free of copper on **`F.Cu`, `In1.Cu`, `In2.Cu`, `B.Cu`**, free of vias, free of
   components, free of conductive silkscreen. Implemented as a KiCad **keep-out rule
   area spanning all four layers**. Only U3 and PS1 cross it.
2. **Split planes (M2).** `GND_A` pour and `GND_ISO` pour, **separately on every layer**.
   A continuous inner ground plane is the default outcome of a 4-layer stackup and would
   destroy the isolation invisibly — this must be an explicit, checked decision.
3. **Net-class isolation ERC invariant.** A machine check that no net in
   {`GND_A`, `3V3_A`, `VBUS_F`, USB D±, SPI_*} touches any net in
   {`GND_ISO`, `V_ISO_RAW`, `3V3_ISO`, ISO_*}. Because finding 8.6 proved a barrier
   bridge is undetectable by operation, this is the only real defence.
4. **Antenna keep-out (M3, RK16).** WROOM-1 on a board edge, keep-out excluding all four
   copper layers. Placed on the **opposite** side of the board from the isolated domain
   so the two keep-outs never compete.
5. **USB D± pair (RK15).** Short, length-matched, on `F.Cu` over the **controller-side**
   `In1.Cu` pour, through D1 at the connector; **never approaching the barrier.**
6. **π-filter loop area.** C10 / L1 / C11 placed as a tight loop with the return on the
   isolated pour; C11's bulk close to U4's input.
7. **Decoupling placement.** C7 and C14 hard against U3's VCC1/VCC2 pins per datasheet
   §8.3 — and on their **own** side of the barrier.
8. **Ampacity.** Trivial everywhere (≤ 0.6 A on VBUS, ≤ 52 mA isolated).
9. **Fab `.kicad_dru` DRC clean** before gerbers, plus the ENIG finish and 4-layer
   stackup in Board Setup.
10. **Optional, not required:** a milled slot in the barrier channel would raise creepage
    further; §9.4 records that it is unnecessary at these potentials.

**Owed at `[L]`** (gate item, tracked). **Residual:** the `[L]` audit.

### Pass 12 — Learnability / pedagogy `[D]`

*Adversarial stance: is this two lessons crammed into one board?*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 12.1 | MED | The board appears to teach **two** things — isolation *and* post-regulation — which would violate the "one thing it teaches" rule. | yes | Resolved by structure, not by cutting: **the second follows necessarily from the first.** You cannot power an isolated island without an isolated converter; a cheap isolated converter is unregulated; an unregulated rail must be post-regulated. The lesson is *"a bus can cross a galvanic break, but everything you take for granted stops at that break"* — and post-regulation is one of the things that stops. Recorded as the board's headline. | §1 "the one thing it teaches" |
| 12.2 | LOW | Complexity vs L2: 57 placements, 26 lines, two ICs a learner has not met. Is it too much? | yes | The **entire controller half is L1.01 verbatim** — already built once, muscle memory. The new cognitive load is one isolator, one converter, one LDO, one ADC, and a filter. The two new ICs are the easiest packages on the board. Comparable to L2.01 (~25 lines) with a lower package risk. | §1, pass 9 |
| 12.3 | LOW | The best teaching moments are the ones that were nearly missed, and they must survive into the guide. | yes | Three explicitly flagged for the guide: (a) **the LDO's PSRR notch sits on the converter's switching band** — put a scope on TP3 and TP4 and *see* it; (b) **the barrier is 76 pF, not an open circuit**; (c) **the earthed scope clip** that destroys the thing you are measuring. All three are lessons that only exist because the audit found them. | §6 RK3/RK6, §9.3 |

The board is a `FOUNDATION`-style building block for any later board needing an isolated
measurement front end. **Residual:** none.

### Pass 13 — Internal consistency `[D]`

*Adversarial stance: diff every number against every other place it appears.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 13.1 | MED | **Naming collision** the protocol calls out by name: risk IDs `R1…` versus resistor refDes `R1–R17`. | yes | All risks are **`RK1–RK16`**; every cross-reference updated. | doc-wide re-scan |
| 13.2 | MED | Connector numbering had a **gap** — an earlier draft used J1, J3, J4 with no J2 (an artefact of dropping a controller-side breakout header). | yes | Renumbered contiguous: **J1** USB-C, **J2** isolated analog, **J3** isolated SPI, **JP1** jumper. Updated in §1 I4/I5, §2, §6, §8 and `bom.csv`. | doc-wide re-scan |
| 13.3 | MED | Capacitor numbering drifted during the π-filter and decoupling changes (C10/C11 swapped roles between drafts). | yes | Renumbered contiguous **C1–C16** with a stated domain split (C1–C9 controller, C10–C16 isolated); every §2/§3/§4/§8 reference and `bom.csv` re-checked. | doc-wide re-scan |
| 13.4 | MED | **refDes count vs BOM quantity** re-checked line by line after the resistor value changes. | yes | 10 kΩ: R1,R2,R8 = **3** ✓ · 5.1 kΩ: R3,R4 = **2** ✓ · 470 Ω: R5,R6,R17 = **3** ✓ · 330 Ω 1206: R7 = **1** ✓ · 1 kΩ: R9–R16 = **8** ✓ (total 17 = R1…R17 with no gap) · 0.1 µF: C2,C3,C4,C7,C14,C15 = **6** ✓ · 1 µF: C5,C6,C12,C13,C16 = **5** ✓ · 10 µF: C1,C8,C9,C10 = **4** ✓ · 220 µF: C11 = **1** ✓ (total 16 = C1…C16) · yellow LED: LED2,LED3 = **2** ✓ · red TP: TP1,TP3,TP4 = **3** ✓ · black TP: TP2,TP5 = **2** ✓ · buttons: SW1,SW2 = **2** ✓ | §8 table vs `bom.csv` |
| 13.5 | MED | **The JP1 shunt had no refDes**, so it could not be a BOM line at all under the *one row per part, refDes count = quantity* rule — it would simply have gone missing from the build. | yes | Assigned **SH1**. Added to §1 I6, §2 sub-circuit J, §4, §8 and `bom.csv`. | §8, `bom.csv` |
| 13.6 | LOW | Header quantity conflicts with physical reality: J2 (1×6) + J3 (1×6) + JP1 (1×2) = **14 pins**, all snapped from **one** 1×40 `PRPC040SAAN-RC` strip — but the import rule forces quantity = refDes count = 3. | yes | **Quantity 3** (rule-conformant), with a `†` footnote in §8 and a note in `bom.csv` stating that one strip is what you buy and that the cost total counts one. Rule satisfied without lying about the build. | §8 † footnote |
| 13.7 | LOW | Placement and line counts appeared in three places and had to agree. | yes (**machine-checked**) | `bom.csv` parsed programmatically: **26 lines · 57 placements · refDes-count = quantity on every row · zero duplicate refDes · zero gaps in C1–C16, R1–R17, U1–U5, LED1–3, TP1–5, J1–3, SW1–2 · cost $30.60** (header strip counted once). This is the one internal-consistency check that does not have to be an attestation, so it isn't. | §8 |

**Residual:** none.

### Pass 14 — Pipeline conformance `[D]`

*Adversarial stance: will this design survive contact with the tooling?*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 14.1 | MED | The seeded `DESIGN_VALIDATION` conditional rows key off the four project flags, **all of which are correctly false here** — so the pipeline would materialize **no** isolation row on a board whose entire subject is isolation. Setting `hasMainsNet=true` to force one would be a **false statement about the design** and would demand mains-specific evidence (earthing, mains fusing, HV creepage) this board cannot honestly give. | yes — protocol §"Conditional audits" ("fire on the board's **nature** / project flags") | **No flag changed.** The audit fired on the board's *nature*, was run in full (pass 15 / §9), and §7 carries an explicit conditional row with an instruction to **add it by hand** at materialization. §11 records the assessment for all four flags and notes that a future `hasIsolationBarrier` flag would have this board as its first customer. | §7, §11 |
| 14.2 | LOW | Freeze semantics: `bomFrozenAt` is a side effect of advancing past `BOM_SOURCING`. On this board that would freeze a BOM before RK14's pad-level isolation questions are answered. | yes | **Freeze held** pending the owner's go-ahead and the `[S]` audit. Stated in §8. | §8 |
| 14.3 | LOW | The strict BOM import is `(manufacturer, mpn)` against the curated library and never auto-creates. Nine parts here do not exist yet. | yes | §8 lists the nine new parts explicitly, and `bom.csv` carries the exact strings. **Part creation remains the owner's step** — this run creates nothing. | §8 |

Friction logged below. **Residual:** none.

### Pass 15 — CONDITIONAL: Safety / isolation `[D]` + `[L]`

*Fired on the board's **nature** (a galvanic barrier is the entire subject), not on
`hasMainsNet`. Adversarial stance: assume the doc is overclaiming, and find the sentence
that implies a safety rating the board has not earned.*

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 15.1 | **CRITICAL** | **The draft implied a safety rating it has not earned.** It led with the ISO7741's **5000 V<sub>RMS</sub> / reinforced** figures, which are true of the isolator and **false of the board**. A chain is as strong as its weakest crossing element, and that element is **PS1**, whose own datasheet says **`Insulation Grade: functional`**, **1000 V<sub>DC</sub> tested for 1 second**, **500 V<sub>AC</sub>/60 Hz rated for 1 minute**, and publishes **no working-voltage rating at all**. A reader could reasonably have concluded this board is mains-safe. It is not. | yes — R1SE "Protections" table read directly; ISO774x §5.6 read directly | **Rewrote the claim from the weakest link up.** Added the **§0 IS/IS NOT box** as the first thing in the document; added **§9.2's element-by-element table** with each rating traced to its source; added **§9.3's explicit "not claimed" list** (no mains, no basic/reinforced *as an assembly*, no agency approval of the board, no continuous working voltage, no medical, no surge rating, no EMC claim); stated a practical ceiling of **50 V DC / 30 V AC** and a **0 V nominal** design working voltage. Raised **RK1** at Med × Critical. | §0, §9.2, §9.3, §6 RK1 |
| 15.2 | **HIGH** | **The 8 mm barrier gap had no derivation** — it was a number copied from the isolator's datasheet. Two things were wrong with that: it was not tied to the board's actual electrical stress, and it was not stated *why* the PCB must honour a component's spacing. | yes — ISO774x §5.6 (CLR/CPG **> 8 mm**, CTI > 600 V, material group I, PD2) + footnote 1 ("the mounting pads … do not reduce this distance"); IEC 60664-1 functional-insulation guidance at SELV potentials | Derived properly in **§9.4**: at ≤ 6.7 V the standards requirement is sub-millimetre, so **the 8 mm is set by the obligation not to reduce the components' published ratings, not by electrical stress** — and the doc now says exactly that, rather than implying the board needs 8 mm to be safe. | §9.4, §1 M1 |
| 15.3 | **HIGH** | **RECOM's own EN 55032 Class B filter suggestion puts two 330 pF safety capacitors ACROSS the barrier.** Adopting the vendor's recommended filter wholesale would have deliberately bridged the thing the board exists to demonstrate — a real trap, because it arrives with the manufacturer's authority. | yes — R1SE EMC filter suggestion, Class B component list | **Y-capacitors omitted.** Only the Class A input capacitance is adopted (C8/C9). **No EMC compliance claim is made**, and the trade is written up as a teaching point: *the barrier is only as good as what crosses it, and EMC compliance is one of the things that will ask you to cross it.* | §9.1, §3 row 35 |
| 15.4 | MED | Fusing across the barrier had not been considered at all — the conditional audit's checklist item. | yes — R1SE SCP spec; MCP1703A short-circuit current | **§9.5** added: F1 protects the controller side; **the isolated side has no fuse by design** because PS1 (1 W, SCP below 100 mΩ in 1 s) *is* the current limit and U4's 400 mA short-circuit current sits in front of it. Stated as a decision with a reason, not an omission. | §9.5 |
| 15.5 | MED | **Earthing** — the conditional audit's fourth item. Neither domain has any earth connection, which is correct here but was unstated, and "no earth" is exactly the fact that makes some of the "not claimed" list mandatory. | yes | Recorded in §9.1 ("no earth connection bridging the domains") and §9.3, where the absence of earthing is part of why no agency claim can be made. | §9.1, §9.3 |
| 15.6 | MED | **The barrier is capacitive, and the doc treated it as an open circuit.** For a safety/isolation audit this is not pedantry: 76 pF is the path a common-mode transient actually takes. | yes — ISO774x C<sub>IO</sub> ≈ 1 pF; R1SE 75 pF max | Quantified in §3 row 17 and §9.3 (**76 mA at 1 kV/µs**), with the observation that the **power** crossing dominates the coupling by 75:1, not the signal isolator. | §3 row 17, §9.3 |
| 15.7 | LOW | Whether a component's certification transfers to the assembly was left implicit. | yes | Stated: U3's UL 1577 / VDE 0884-17 and PS1's UL 60950-1 E358085 are **component-level**; an assembly is certified by testing the assembly, which has not been done. | §9.3 |

**Conditional-audit checklist, item by item:** creepage/clearance ✓ (§9.4, derived not
copied) · isolation barrier ✓ (§9.1–9.2, weakest-link rating) · fusing ✓ (§9.5) ·
earthing ✓ (§9.1, §9.3 — none, and stated). **Residual:** the PCB keep-out is verified at
`[L]` (RK2) and PS1's own land-pattern separation at `[S]` (RK14); the isolation *claim*
itself is closed at `[D]`.

### Pass 16 — CONDITIONAL: RF / regulatory `[D]`

*Fires because the WROOM-1 module is physically present, even though this board makes no
use of the radio (E6).*

The ESP32-S3-WROOM-1 is a **pre-certified module** (FCC/IC/CE). No board-level radiator
certification is required or claimed, **provided the antenna keep-out is honored** — so
it is (M3/RK16: module on a board edge, keep-out excluding all four copper layers, per
Espressif integration rules), exactly as on L1.01/L1.02, even though the radio is unused.
No external antenna, no RF connector, no matching network. Placement note captured for
`[L]`: the isolated domain sits on the **opposite** side of the board from the antenna,
so the antenna keep-out and the barrier keep-out never compete for the same copper.
Separately, **no EMC compliance claim is made for the board** and the reason is recorded
(pass 15.3). **Residual:** keep-out owed at `[L]`.

### Pass 17 — DRY sweep (re-run every `[D]` lens against the revised design)

Re-ran requirements, net integrity, math, physics, part-truth, power integrity, FMEA,
DFM, sourcing, learnability, internal consistency, pipeline conformance, and the
isolation conditional against the **revised** `design.md`, specifically re-proving
everything the fixes could have disturbed:

- **The LDO change (3.1)** disturbed the thermal budget → re-derived T<sub>j</sub> with
  θ<sub>JA</sub> = 62 °C/W ✓; disturbed the dropout headroom → re-derived at the 250 mA
  spec point ✓; disturbed the BOM/cost → re-screened ✓.
- **The π filter (4.1)** disturbed the LDO input headroom (L1's DCR) → 17 mV, re-proven
  ✓; disturbed the isolated load budget (nothing added) ✓; introduced a damping question
  → Q = 1.15 ✓; disturbed the BOM by two lines → both screened Active/in stock ✓.
- **The PTC change (7.1)** disturbed §3 rows 2–3 → re-derived with R<sub>1max</sub> = 110 mΩ
  ✓; disturbed the protection story → trade explicitly accepted in RK4 ✓; disturbed
  sourcing → part already in the catalog, screened ✓.
- **The preload (3.2)** disturbed the raw-rail maximum → re-derived at 6.00 V normal /
  6.33 V fault ✓; disturbed PS1's input current and therefore the VBUS drop → re-derived
  ✓; disturbed the dissipation of a 1206 → 44 % ✓.
- **The header series resistors (8.2/8.3)** disturbed ADC settling → derived the 8.3 kΩ
  bound and confirmed 1 kΩ is free ✓; disturbed the isolator's output loading → 3.3 mA
  short, inside abs max ✓.
- **The electrolytic substitution (10.4)** disturbed the filter damping → re-proven with
  the actual 130 mΩ impedance figure ✓.
- **The J-renumbering and C-renumbering (13.2/13.3)** disturbed every cross-reference →
  full doc re-scan and CSV diff ✓.

**Zero new material findings.** All `[D]` audits clean. `[S]` (audit 6, incl. RK14's
three pad-level isolation questions) and `[L]` (audit 11, incl. RK2's all-layer keep-out,
split planes and the net-class ERC invariant) remain explicitly **captured and owed** at
their stages.

**Residual after this pass: none — DRY.** The board is **design-stage part-ready**:
parts may be created and the BOM imported **by the owner**. It is **not yet fab-ready** —
the `[S]` pad map and the `[L]` barrier verification gate schematic → layout → gerbers.

---

## Friction log (pipeline-conformance deliverable)

1. **The conditional-audit trigger is flag-driven, but the protocol is nature-driven.**
   This board owes a full isolation/creepage review and every project flag is correctly
   `false`, so the materialized `DESIGN_VALIDATION` checklist will contain **no**
   isolation row unless one is added by hand. Forcing `hasMainsNet=true` to trigger it
   would be a lie about the design and would demand mains evidence this board cannot
   give. **Suggested fix: a `hasIsolationBarrier` project flag.** Until then §7 carries
   the row and §11 carries the instruction.
2. **Datasheet ordering tables lead to unbuyable part numbers.** Both `ISO7741DW` and
   `MCP1703A-3302E/DB` — the natural picks from a datasheet's ordering information —
   are 0-stock or Obsolete, while their tape-and-reel siblings (`…DWR`, `…AT-…`) are
   Active with thousands in stock. Screening every MPN live before writing the BOM
   caught both. **This should be a standing step, not a lucky habit.**
3. **DigiKey's manufacturer strings do not match the curated library's.** `YAGEO` vs
   `Yageo`, `Littelfuse Inc.` vs `Littelfuse`, `MINISMDC150F-2` vs `miniSMDC150F-2`. The
   strict import matches the **library**, so a `bom.csv` written straight from a DigiKey
   screen fails on those lines. Worth a note in the `adding-parts` skill.
4. **Reuse is a heuristic, not a rule, and this board is the counterexample.** Three of
   the four most serious findings came from reusing an L1.01 part without re-deriving it
   for a new context: the **RT9080** (6 V abs max on a rail that reaches 6.68 V), the
   **1206L050YR PTC** (700 mΩ starving a converter with a 4.5 V floor), and the **10 kΩ**
   resistor value (breaking 12-bit ADC settling). L1.02's RK1 warned about exactly this;
   here it bit three times. **Re-derive every reused number in the new context — the
   part is the same, the circuit around it is not.**
5. **Vendor application notes can contradict the design intent.** RECOM's own EN 55032
   Class B filter puts safety capacitors **across the isolation barrier**. Following a
   manufacturer's recommended circuit would have compromised the board's entire subject.
   Application notes optimise for the vendor's spec sheet, not for your requirements.
6. **PDF datasheets frequently do not text-extract.** Several were only readable by
   downloading the PDF and reading it as pages; two vendor sites returned 403 to
   automated fetches, and one manufacturer's own resistance figures were only reachable
   through a distributor's parametric data. Where a figure could not be confirmed at the
   manufacturer's own source it is bounded and flagged, not asserted.
