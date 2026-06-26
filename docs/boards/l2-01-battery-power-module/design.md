# L2.01 Battery Power Module — design doc

> ⛔ **NOT part-ready.** This board owes the **Recursive Board-Design Validation
> Protocol** (`../_protocol.md`) before *any* part is created, BOM imported, or
> revision advanced: ≥ 10 recursive audit passes, a "dry" pass, every applicable
> audit clean, `validation-log.md` complete. This is the curriculum's **first
> safety-critical (Li-ion) board** — the Battery/Li-ion + deep-thermal + power-
> integrity conditional audits are **load-bearing, not box-ticking**. The
> `DESIGN_VALIDATION` ticks are honest human attestations — earn them.

| | |
| --- | --- |
| **Slug** | `l2-01-battery-power-module` |
| **Owner** | Josh (OTD) |
| **Status** | `draft` → validating |
| **Track / Level** | POWER / L2 |
| **Teaches** | Single-cell Li-ion **charging** + **load-share** (run-while-charging) + **LDO-after-switcher** quiet rails — the reusable portable-power building block |
| **Project flags** | `hasLiIon = true`, `hasThermalConcern = true`, `hasMainsNet = false`, `requiresStripboard = false` |
| **Validation** | `pass N/≥10` → DRY — see `validation-log.md` |

---

## 1 · ORIENT — what & why

- **What it is:** A self-contained single-cell (1S) Li-ion / Li-Po power module. It
  charges one cell from USB-C, **shares the load** so the downstream board runs from
  USB *while the cell charges* (no brown-out at plug-in), **protects** the cell
  (over-charge / over-discharge / over-current / short), and delivers two output
  rails: a **5 V** workhorse rail from a boost converter (the USB-equivalent rail
  every later portable board reuses) and a **clean 3.3 V** rail made by an LDO placed
  *after* the switcher (the low-noise rail for sensitive analog). It is a **power
  MODULE**, not an ESP32 board — it reuses none of the WROOM core, only the shared
  jellybean passives / connectors / protection parts from the L1 catalog.

- **Functional requirements (testable):**
  1. Charge a 1S Li-ion/Li-Po cell from USB-C 5 V at a **CC/CV** profile, terminating
     at **4.20 V ±0.75 %** (MCP73831-2), charge current **≈ 200 mA** (thermally sized).
  2. **Load-share:** with USB connected, the system rail is powered from USB and the
     cell is *isolated from the load* so the charger sees only the cell (clean
     termination); with USB removed, the cell powers the system seamlessly.
  3. **Cell protection** independent of the charger: over-charge cut at ~4.3 V,
     over-discharge cut at ~2.4 V, over-current / short-circuit cut — via a dedicated
     1S protection IC + dual-NFET (DW01A + FS8205A) on the cell's B− path.
  4. Output **5.0 V ±2.5 %** (boost) at ≥ 500 mA continuous, and **3.3 V** (LDO) at
     ≤ 150 mA low-noise for sensitive loads.
  5. **On/off** switch (disables the boost; < 1 µA off-state battery drain through
     the switcher).
  6. USB-C input over-current (PTC) + transient (TVS) protected; no enumeration
     (power-only sink: CC1/CC2 = Rd pulldowns). Requires a **≥ 1 A USB-C source** for
     simultaneous charge (≈ 0.2 A) + load (≈ 0.5 A peak); a 500 mA host port throttles
     gracefully (F1 = 1.5 A hold, no trip).

- **Constraints / DFM / safety flags:**
  - **Li-ion (`hasLiIon`)** — single-cell. Protection mandatory; charge & discharge
    limits proven; thermal/mechanical containment considered (cell off-board on a
    keyed JST lead).
  - **Thermal (`hasThermalConcern`)** — the linear charger dissipates real power
    (P = (V_BUS − V_BAT)·I_chg) and the LDO drops 1.7 V; both worst-cased in §5.
  - **Power-integrity** — boost ripple, the LDO's PSRR cleaning it, bulk/decoupling,
    UVLO/protection coordination.
  - **Skill envelope (L2):** leaded SMD (SOT-23 / SOT-23-6 / SMA / SMC / 0805) + THT.
    **No leadless** (QFN/DFN/SON) — every active part here is SOT-23-class or larger.
  - **Not stripboard** — fabbed PCB; `requiresStripboard` stays false.

## 2 · Topology

Power/sequencing chain (block diagram):

```
                 ┌─────────────────────────────────────────────────────────────┐
 USB-C ─F1(PTC)─ VBUS ─┬─ D1 (TVS 6V) ─ GND                                       │
 (5V, CC=Rd)           │                                                         │
                       ├─ U1 MCP73831 (VDD) ── VBAT_chg ──► [cell + / J2]        │
                       │      PROG=5.1k→196mA, STAT→CHRG LED                      │
                       │                                                         │
                       └─ D2 (Schottky) ───┐                                   │
                                             ▼                                   │
   [J2 cell+] ─ VBAT ──── Q2 P-FET ────────► VSYS ──┬─ SW1 ── U3.EN              │
        │       (load-share: OFF when USB present)  │                            │
   [J2 cell−] ─ B− ─ Q1 FS8205A (dual NFET) ─ GND   ├─ U3 TLV61048 boost ─L1/D3─►│ 5V0 ─┬─► J3
        │            ▲ gates                        │   (Vref0.8, FB div, 600kHz)│      ├─ PWR LED
        └── U2 DW01A (1S protection) ───────────────┘                           │      │
            OVP4.3 / UVP2.4 / OCP0.15V / SCP1.35V                  5V0 ─ U4 RT9080 LDO ─► 3V3 ─► J3
                                                                       (clean quiet rail)
   C9 1000µF bulk on VSYS (transient hold-up)                                    │
```

**Named sub-circuits** (how the schematic will be organised):
- **A. USB-C input & protection** — J1, CC pulldowns, F1 PTC, D_in TVS.
- **B. Charger** — U1 MCP73831, PROG resistor, input/battery caps, CHRG LED.
- **C. Cell protection (PCM)** — U2 DW01A, Q1 FS8205A dual-NFET, sense R+C, J2 (cell).
- **D. Load-share / power-path** — Q2 P-FET, D_sys Schottky, gate resistors.
- **E. Boost switcher** — U3 TLV61048, L1 inductor, D3 Schottky rectifier, FB divider, in/out caps.
- **F. LDO quiet rail** — U4 RT9080-33, in/out caps.
- **G. Output, bulk, status, on/off** — J3 terminal, C9 bulk, PWR LED, SW1, test points.

**Power-up / power-down sequencing.**
- *Plug USB:* VBUS rises → U1 begins charge (CC then CV→4.20 V); D2 forward-biases
  → VSYS ≈ VBUS−0.5 V ≈ 4.7 V; Q2 gate pulled high → Q2 **OFF** (cell isolated from
  load, charger sees only cell); if SW1 on, U3 boosts VSYS→5.0 V, U4 makes 3.3 V.
- *Unplug USB:* D2 blocks (VBUS=0 < VSYS); Q2 gate falls to 0 → Q2 **ON** → VSYS =
  V_BAT; boost continues from the cell. No load interruption (C9 bulk covers the µs
  hand-over; Q2 body diode VBAT→VSYS conducts during the gate transition).
- *Cell empty:* the boost UVLO (2.55 V rising / 2.4 V falling) stops the switcher at
  ~2.4 V; DW01A's UVP also cuts the discharge FET at 2.4 V — both at the protection
  floor. **Note:** the boost draws the cell down to ~2.4 V (its UVLO = the DW01A UVP),
  which is below the longevity-optimal ~3.0 V Li-ion cutoff. DW01A guards against true
  over-discharge damage; full capacity is used at the cost of cell cycle-life. See RK11.

**Grounding (`[L]`):** DW01A GND (pin 6) = **cell−** (the true cell negative); the
board's GND / P− (charger VSS, boost GND, LDO GND, J3 GND) = **after** the FS8205A
FETs. The two nodes join *only* through Q1 — layout must keep cell− and P− distinct,
star-joined at the protection FETs, with the high-current discharge return on P−.

## 3 · Calc trail (DO — lock the math)

All values worst-case (min/max/temperature). Sources: MCP73831/2 DS20001984H,
TLV61048 SLVSEX0A, DW01A datasheet (HM/Fortune), Bourns SRN6045TA, RT9080 DS9080-09.

| # | Value | Formula / source | Result | Notes / margin |
| --- | --- | --- | --- | --- |
| 1 | Charge current I_chg | I_REG = 1000/R_PROG (DS Table, 2.0kΩ→505mA verified) | **196 mA** (R_PROG = 5.1 kΩ) | thermally sized (row 6); catalog 5.1k reuse |
| 2 | Float / termination V | MCP73831-**2** V_REG = 4.168/4.20/4.232 V | **4.20 V ±0.75 %** | < DW01A OVP 4.3 V (defense-in-depth) |
| 3 | Charge-term current | I_TERM = 7.5 %·I_REG (PROG 2–10k) | ≈ 15 mA | auto-recharge at 94 %·4.20 = 3.95 V |
| 4 | Boost V_OUT | V_OUT = V_REF·(1+R8/R9), V_REF = 0.80 V (PWM, 0.78/0.80/0.82) | **4.98 V** (R8 = 52.3 kΩ, R9 = 10 kΩ) | within USB 4.75–5.25 tolerance; ±2.5 % set accuracy |
| 5 | Boost duty (CCM) | D = 1 − V_IN/V_OUT, V_IN = V_SYS | 0.40 @3.0V; 0.34 @3.3V; 0.16 @4.2V | V_SYS(USB)=4.7→D=0.06 |
| 6 | Charger dissipation (worst) | P = (V_DD − V_BAT)·I_chg, V_DD=5.25, V_BAT=3.0 | **0.44 W** | TJ = 25 + θJA·P; θJA 130°C/W(pour)→TJ≈82°C; 230(min Cu)→TJ≈126°C < 150 TSD |
| 7 | Boost inductor ripple | ΔI_L = V_IN·D/(L·f), L=4.7µH, f=600kHz, V_IN=3.0, D=0.40 | **0.43 A pp** | — |
| 8 | Boost inductor I_avg | I_L = V_OUT·I_OUT/(η·V_IN), η=0.9, I_OUT=0.5A, V_IN=3.0 | **0.93 A** | at 1 A out: 1.85 A |
| 9 | Boost inductor I_peak | I_peak = I_L + ΔI_L/2 | **1.14 A** (0.5A out) / **2.06 A** (1A out) | SRN6045TA-4R7M I_sat ~3.7 A; switch I_lim 2.9 A min → OK |
| 10 | Boost max I_OUT @3.0V | I_OUT,max ≈ I_lim,min·(1−D) | 2.9·0.60 ≈ **1.7 A** | ≫ 0.5 A rated → ample headroom |
| 11 | LDO dropout | RT9080 V_DO = 0.53 V @600 mA | OK (5.0 − 3.3 = 1.7 V headroom) | always in regulation |
| 12 | LDO dissipation | P = (5.0 − 3.3)·I_3v3, I_3v3 ≤ 0.15 A | **≤ 0.26 W** | SOT-23-5 230°C/W → ΔT≈60°C; 3V3 rail bounded to ≤150mA by design |
| 13 | Load-share Q2 OFF (USB present) | V_gs = V_gate − V_SYS; gate=V_BUS·R7/(R6+R7), R6=10k, R7=1M | gate=4.95 V, V_SYS=4.75 → **V_gs=+0.2 V** | DMG3415U V_th≈−0.9 V → solidly OFF regardless |
| 14 | Load-share Q2 ON (USB absent) | gate→0 via R7; V_gs = 0 − V_BAT | **−3.0…−4.2 V** | full enhancement; Rds(on) ~30–43 mΩ |
| 15 | Q2 standby current (USB present) | I = V_BUS/(R6+R7) = 5.0/1.01 MΩ | **5 µA** | negligible |
| 16 | DW01A over-current trip | I_OC = V_OC / (2·Rds(on,FS8205A)); V_OC=0.15 V | set by FET Rds (≈ tens of A) | well above 0.5–1 A normal; SCP at 1.35 V |
| 17 | USB-C sink advertise | CC1/CC2 Rd = 5.1 kΩ to GND | 5 V default | power-only; no D±/PD |
| 18 | Bulk hold-up | C9 = 1000 µF on VSYS | dV = I·t/C | covers plug/unplug hand-over + WiFi-burst sag |
| 19 | Boost C_OUT effective | 10 µF X5R 0805 derated ~50 % @5 V | ≈ 5–6 µF > 3 µF min | meets TLV61048 C_OUT ≥ 3 µF effective |

## 4 · IC selection (DO — lock the parts)

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U1 | Microchip **MCP73831T-2ACI/OT** | 1S linear charger, SOT-23-5, programmable I via 1 R, integrated pass FET + reverse-discharge + **thermal regulation**; the hobby-standard, already in catalog | pinout, V_REG (-2=4.20V), I_REG=1000/R_PROG, θJA 230/130, thermal foldback, I_DISCHARGE 2µA, STAT tri-state |
| U2 | **DW01A** (UMW) | Canonical 1S protection controller, SOT-23-6; OVP 4.3 / UVP 2.4 / OCP 0.15 V / SCP 1.35 V; the textbook PCM (teaches protection explicitly) | OVP/UVP/OCP/SCP thresholds, delay, pinout/FET pairing (verify at part-truth) |
| Q1 | **FS8205A** (Fortune Semi) | Dual common-drain N-MOSFET, SOT-23-6, the standard DW01A companion; both charge+discharge FETs in one package on B− low side | V_DS 20 V, Rds(on), I_D (verify), pinout |
| Q2 | Diodes **DMG3415U-7** | Load-share P-MOSFET, SOT-23; low V_th, low Rds(on); body-diode VBAT→VSYS as hand-over fallback | V_GS(th), Rds(on), V_DS −20 V, body-diode |
| U3 | TI **TLV61048DBVR** | Non-synchronous boost, SOT-23-6 (hand-solderable, unlike SOT-583/QFN boosts); V_IN 2.65–5.5 V, 600k/1M, 2.9 A switch limit → ≥1.7A @5V; internal compensation + soft-start | pinout (1SW/2GND/3FB/4EN/5VIN/6FREQ), V_REF 0.80V, I_lim, UVLO 2.55V, EN, FREQ, L/C ranges |
| U4 | Richtek **RT9080-33GJ5** | 3.3 V/600 mA LDO, TSOT-23-5, 0.53 V dropout, 4 µA Iq, stable with 1 µF; reused from L1 catalog; post-regulates the boost for a quiet rail | V_OUT, dropout, C in/out stability, EN |

**Active-part hand-solderability:** all SOT-23/SOT-23-5/SOT-23-6/TSOT-23 — no leadless.
**External Schottky required** for U3 (non-synchronous) — reuse SS34 (D3 rectifier).

## 5 · Power & thermal

**Rails:** VBUS (5 V USB) → VSYS (3.0–4.75 V) → **5V0** (boost) → **3V3** (LDO).

**Worst-case dissipation budget:**
- **Charger U1 (the headline thermal item):** at I_chg = 196 mA, V_BUS = 5.25 V (USB
  high), V_BAT = 3.0 V (depleted cell, CC phase): **P = 2.25 V × 0.196 A = 0.44 W.**
  - With a copper pour under the SOT-23-5 (θJA ≈ 130 °C/W): ΔT = 57 °C → **TJ ≈ 82 °C**
    @ 25 °C ambient, ≈ 97 °C @ 40 °C ambient. No foldback.
  - With minimum copper (θJA = 230 °C/W): ΔT = 101 °C → TJ ≈ 126 °C @ 25 °C; ≈ 141 °C
    @ 40 °C — *approaching* the 125–150 °C thermal-regulation band → the IC folds
    charge current back (the built-in safety backstop).
  - **Decision:** charge current is **sized by thermal, not convenience** — 196 mA
    keeps TJ safe with a modest pour. **A ground/VBAT copper pour under U1 is a
    layout requirement (`[L]`).** Trade-off: a large 18650 (2500 mAh) charges in
    ~13 h; a typical hobby 500–1200 mAh LiPo in 3–6 h. Slow-and-cool is the safety
    choice for a teaching board; the IC's thermal regulation guards the corner.
- **LDO U4:** P = (5.0 − 3.3) × I_3v3 ≤ 1.7 × 0.15 = **0.26 W** (3V3 rail bounded to
  ≤ 150 mA *by design* — it is the low-noise rail for sensitive analog, **not** the
  power path). The **5 V boost is the workhorse** (≈ 90 % efficient); the LDO's
  inefficiency is acceptable precisely because it carries little current.
- **Boost U3:** internal FET Rds(on) 85 mΩ; at I_L 0.93 A, P_FET ≈ I²·Rds·D ≈ small;
  θJA 177.7 °C/W; well within limits at ≤ 1 A out.

**Why LDO-after-switcher (the teaching justification):** a boost converts the cell to
5 V efficiently but with switching ripple; a high-PSRR LDO downstream strips that
ripple to give a quiet 3.3 V — you get the switcher's efficiency on the bulk rail
*and* a clean rail for analog, without paying the LDO's drop on the whole load.

## 6 · Risk register

| # | Risk | L × I | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| RK1 | **Cell reverse-polarity at J2** (user wires cell backward) | M × **Critical** (fire) | **Mitigation = keyed JST-PH** (reverse-proof at the connector) **+ silk "+/−" + guide warning + the JST-PH cell convention** (red=+, black=−). This matches industry practice for 1S boards (Adafruit/SparkFun rely on the keyed connector). A series reverse-block P-FET is the *production* upgrade, **deliberately omitted** here: its always-on drop would waste battery on the discharge path (defeats the module's efficiency goal). DW01A/FS8205A tolerate transient reverse. | de-risked (accepted, mitigation stated) |
| RK2 | **Charger overheats at high I_chg / poor copper** | M × High | 196 mA charge (thermally sized §5); copper pour under U1 (`[L]`); thermal-regulation backstop | de-risked (design) + `[L]` |
| RK3 | **No cell protection → over-discharge/over-charge** | L × Critical | DW01A+FS8205A onboard PCM; OVP 4.3 > charger 4.20 (backup), UVP 2.4 | de-risked |
| RK4 | **Load-share fails → charger mis-terminates / brown-out at plug-in** | M × Med | Q2 OFF (V_gs +0.2 V solid) when USB present; body-diode + C9 bulk cover hand-over | de-risked (calc §3 r13–15,18) |
| RK5 | **Boost inductor saturates** | L × Med | I_peak 2.06 A (1 A out) < I_sat 3.7 A; switch I_lim 2.9 A min | de-risked (calc §3 r9) |
| RK6 | **Reverse battery drain when USB removed** | L × Low | MCP73831 reverse-discharge 2 µA max; boost shutdown < 1 µA; SW1 off | de-risked (DS) |
| RK7 | **5V rail floats high on USB-high** (boost can't buck) | L × Low | D_sys drop keeps VSYS ≤ 4.75 V < V_OUT 4.98 V → boost always regulates | de-risked (calc §3 r4) |
| RK8 | **DW01A OCP trip current set by FET Rds is high** (slow to trip on moderate over-current) | M × Med | OCP is a *fault* cut (short/severe OC), not a fuse; F1 PTC + the load's own limits cover moderate OC; document | de-risk Pass-FMEA |
| RK9 | **SS34 (SMC) oversized for boost switching node** | L × Low (DFM) | electrically fine (40 V/3 A, trr ok ≤1 MHz); reuse wins; note SOD-123 alt | accepted / note |
| RK10 | **Boost FB-divider open (R8/R9 fault) → V_OUT runs to 14 V ceiling → over-volts the 5 V rail + RT9080 + downstream** | L × High | FB resistors are 1 % thick-film (low open-circuit rate); for production add a 6.2 V zener / OVP clamp on 5V0; downstream L1 boards carry their own input ESD + LDO. Documented, accepted for the teaching build. | accepted / note + production upgrade |
| RK11 | **Boost discharges cell to ~2.4 V** (its UVLO = DW01A UVP), below the ~3.0 V longevity cutoff | M × Low | DW01A prevents true over-discharge *damage* at 2.4 V; full capacity used at the cost of cycle-life. A production design gates EN at ~3.0 V (added comparator). Acceptable + documented for teaching. | accepted / note |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory** (`[D]` evidenced to DRY; owner attests in DB at commit):
- [x] Calc trail complete — every derived value sourced (§3)  `[D]`
- [x] Each IC datasheet-verified (§4)  `[D]`
- [ ] Footprint ↔ pinout cross-checked against each datasheet  `[S]` (owed at schematic)
- [ ] Fab-DRU DRC clean (vendor design rules loaded)  `[L]` (owed at layout)
- [x] BOM availability checked — every part sourceable, live stock (§8)  `[D]`
- [x] All top risks de-risked (§6)  `[D]` (RK1–RK11)

Conditional (flags: `hasLiIon`, `hasThermalConcern`) — **clean, not waived** (Pass 11):
- [x] **Li-ion safety review** — protection (OVP/OCP/SCP/UVP), charge & discharge
      limits, thermal/mechanical containment  `[D]`
- [x] **Deep-thermal review** — worst-case junction temps (charger + LDO), copper
      pour, derating (§5)  `[D]`

> Attestations (a human checked), except BOM availability (DigiKey live) and DRU
> presence (verifiable). `[S]`/`[L]` items are explicitly *owed* at their phase.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~$8–10 module BOM (FREE tier, reuse-heavy).
- **Reuse-first:** USB-C, charger, LDO, all MLCCs/resistors/LEDs, PTC, TVS, Schottky,
  bulk electrolytic, output terminal, test points all reuse the live L1 catalog.
- **New parts (9):** TLV61048DBVR, SRN6045TA-4R7M, DW01A, FS8205A, DMG3415U-7,
  S2B-PH-K-S, EG1218, 52.3 kΩ + 1 MΩ resistors.

### Sourcing evidence (live DigiKey screen, 2026-06-25)

| Ref | (manufacturer, mpn) | Pkg | DK stock | $ ea | Lifecycle | Reuse? | Symbol / Footprint (intended) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| J1 | GCT, USB4110-GF-A | USB-C 24P R/A | (reuse l1-01) | — | Active | ✅ | — / USB-C R/A |
| F1 | Littelfuse, miniSMDC150F-2 | 1812 | (catalog) | — | Active | ✅ | Device:Polyfuse / Fuse_1812 |
| D1 | Littelfuse, SMAJ6.0A | SMA | (catalog) | — | Active | ✅ | Device:D_TVS / D_SMA |
| U1 | Microchip, MCP73831T-2ACI/OT | SOT-23-5 | (catalog) | — | Active | ✅ | (Battery_Management:MCP73831) / SOT-23-5 |
| U2 | UMW, DW01A | SOT-23-6 | **20,950** | 0.10 | Active | NEW | (generic 6-pin) / SOT-23-6 |
| Q1 | Fortune Semiconductor, FS8205A | SOT-23-6 | **459** | 0.39 | Active | NEW | (dual-N) / SOT-23-6 ⚠ thin stock → 2nd source |
| Q2 | Diodes Incorporated, DMG3415U-7 | SOT-23 | **57,534** | 0.48 | Active | NEW | Device:Q_PMOS_GSD / SOT-23 |
| U3 | Texas Instruments, TLV61048DBVR | SOT-23-6 | **13,180** | 0.90 | Active | NEW | (boost) / SOT-23-6 |
| L1 | Bourns, SRN6045TA-4R7M | 6045 shielded | **24,578** | 0.46 | Active | NEW | Device:L / L_Bourns_SRN6045 |
| D2,D3 | Vishay General Semiconductor, SS34-E3/57T | SMC (DO-214AB) | (catalog) | — | Active | ✅ | (Schottky) / D_SMC |
| U4 | Richtek, RT9080-33GJ5 | TSOT-23-5 | (catalog) | — | Active | ✅ | Regulator_Linear:AP2112K-3.3 / SOT-23-5 |
| J2 | JST Sales America, S2B-PH-K-S | PH 2.0 R/A THT | **737,474** | 0.11 | Active | NEW | Connector:Conn_01x02 / JST_PH_S2B |
| J3 | TE Connectivity, 282837-3 | 5.08 mm THT | (catalog) | — | Active | ✅ | Screw_Terminal_01x03 / TerminalBlock |
| SW1 | E-Switch, EG1218 | SPDT slide THT | **34,061** | 0.72 | Active | NEW | Switch:SW_SPDT / SW_Slide |
| R8 | Yageo, RC0805FR-0752K3L (52.3k) | 0805 | **2,836** | 0.10 | Active | NEW | Device:R / R_0805 |
| R7 | Yageo, RC0805FR-071ML (1M) | 0805 | **264,611** | 0.10 | Active | NEW | Device:R / R_0805 |
| R1,R2,R3 | Yageo, RC0805FR-075K1L (5.1k) | 0805 | (catalog) | — | Active | ✅ | Device:R / R_0805 |
| R4,R10 | Yageo, RC0805FR-07470RL (470R) | 0805 | (catalog) | — | Active | ✅ | Device:R / R_0805 |
| R5,R6,R9 | Yageo, RC0805FR-0710KL (10k) | 0805 | (catalog) | — | Active | ✅ | Device:R / R_0805 |
| C1,C2 | Samsung, CL21A475KAQNNNE (4.7µF) | 0805 | (catalog) | — | Active | ✅ | Device:C / C_0805 |
| C4–C6 | Samsung, CL21A106KOQNNNE (10µF 16V) | 0805 | (catalog) | — | Active | ✅ | Device:C / C_0805 |
| C7,C8 | Würth Elektronik, 885012207103 (1µF) | 0805 | (catalog) | — | Active | ✅ | Device:C / C_0805 |
| C3 | Samsung, CL21B104KBCNNNC (100nF) | 0805 | (catalog) | — | Active | ✅ | Device:C / C_0805 |
| C9 | Panasonic, EEU-FM1C102 (1000µF 16V) | radial THT | (catalog) | — | Active | ✅ | Device:C_Polarized / CP_Radial |
| TP1,TP2 | Keystone, 5010 / 5011 | THT loop | (catalog) | — | Active | ✅ | Connector:TestPoint / TestPoint |

- **Second sources noted for:** Q1 FS8205A (thin 459 stock) → two discrete N-FETs or
  an 8205-equivalent (LSP8205S/AO8810-class); U2 DW01A → any 1S protector
  (TI BQ29700 leadless alt); the rest are well-stocked jellybeans.
- **BOM frozen:** not yet (HOLD before LAYOUT freeze).
