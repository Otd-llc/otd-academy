# DRV8833 DC Motor Driver (L2.03) — design doc

> Board design doc for the **ACT-track L2** board. It is the **L1.01
> ESP32-S3-WROOM core reused whole**, plus a **dual brushed-DC H-bridge**
> (DRV8833) commanded over the **ESP-NOW link from L1.02** and powered from the
> **L2.01 battery module's 5 V output**. Draft → validate (lock the math + parts)
> → source/freeze the BOM → only then author the guide.

> ⛔ **NOT part-ready** until the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`) passes: ≥ 10 recursive audit passes, a `[D]` dry pass, every
> applicable audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION`
> ticks are honest human attestations. **Do not add parts until this passes.**

| | |
| --- | --- |
| **Slug** | `l2-03-motor-driver` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **validated to DRY**, not frozen, **parts not created**) |
| **Track / Level** | ACT / L2 |
| **Teaches** | **Brushed-DC H-bridge drive + hardware current limiting as a power-budget contract** — a motor is a load your battery cannot afford at stall, so the driver's own current regulation, not the motor, decides what the rail pays. Second axis: **ESP-NOW-commanded actuator latency** (the H-bridge contributes ~1.5 µs; everything else you measure is radio + software). |
| **Validation** | **`DRY ✓` — 12 passes, design-stage part-ready** (`[S]`/`[L]` audits owed at their stages) — see `validation-log.md` |

**Project flags — as they read in PROD today:** `hasMainsNet=false`,
`hasLiIon=false`, `hasThermalConcern=false`, `requiresStripboard=false`.

**Flag findings from this run (owner action required):**

- **`hasThermalConcern` → should be `true`.** The board's headline part is
  thermally *rating*-limited at its normal worst-case operating point: the
  DRV8833 in the **PW (plain TSSOP-16, no PowerPAD)** package is rated **500 mA
  RMS per bridge**, and the entire current architecture — sense-resistor value,
  chop threshold, motor class supported — is set by that thermal limit, not by
  anything else. A stalled, remotely-commanded motor is an **indefinite** operating
  condition, not a fault. Both conditional items materialised by the flag
  ("Thermal budget verified…", "Derating applied…") are genuinely attestable here:
  §5 carries the worst-case junction temperature, and I_CHOP is *deliberately
  derated* 20 % below the package rating. Deep-thermal audit run in **Pass 7**.
- **`hasLiIon` → leave `false`.** The **battery/Li-ion conditional audit fires on
  substance and was run (Pass 8)** — this board is a Li-ion-powered high-current
  actuator, its draw must be bounded to what the cell can safely deliver, and its
  PTC is the *only* protection between a fault and a cell that can source many
  amps. But the flag materialises two checklist rows, and the second — *"Pack
  thermal/mechanical containment reviewed — cell placement, venting…"* — has no
  honest referent on a board with **no cell, no charger and no pack**. Ticking it
  would plant exactly the kind of foreign checklist item that rots the attestations
  next to it. The cell attestation belongs to **L2.01** (already `hasLiIon=true`);
  the *discharge-budget* and *fault-energy* evidence for this board lives in §5/§6
  and `validation-log.md` Pass 8. **Audit ≠ flag** — run the audit, leave the flag.
- `hasMainsNet=false` and `requiresStripboard=false` are correct. **No OTD board
  uses stripboard**; this one is a fabbed 4-layer PCB.

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 board that drives two brushed-DC motors over a
  wireless link.** It is the **L1.01 WROOM breakout reused whole** (USB-C power +
  native USB, RT9080 3V3 LDO, EN/BOOT buttons, indicator LEDs, full GPIO breakout),
  plus a **TI DRV8833 dual H-bridge**, its protection, and a two-source power path.
  L1.04 taught that a stalling actuator must not share a rail with the MCU, and
  solved it by adding a *second supply*. **L2.03 cannot use that answer** — the whole
  point is untethered operation from **one** L2.01 battery module, so logic and
  motors share a single 5 V rail. The lesson is therefore the harder one:
  **when you cannot separate the rails, you have to bound the load.** The DRV8833's
  own PWM current regulation is that bound, and a pair of 1.2 Ω resistors is where
  the board's entire power budget is written down.

- **Functional requirements (testable):**
  - **F1** — Run the full **L1.01 WROOM core** from one USB-C cable (power + native
    USB flash/console). *Inherited verbatim from L1.01 — same parts, same nets.*
  - **F2** — Drive **two** brushed-DC motors independently: forward, reverse, brake
    (slow decay), coast (fast decay), and PWM speed control, from 3.3 V GPIO.
  - **F3** — Accept motor power from an external **5.0 V ±5 % (4.75–5.5 V)** source at
    a screw terminal — specifically the **L2.01 battery module's `5V0` output** — and
    run the **entire board** (logic + motors) from it, untethered.
  - **F4** — **Bound the motor current in hardware**, independent of which motor is
    fitted, to a value the L2.01 module can supply, using the driver's own
    fixed-frequency PWM current regulation.
  - **F5** — Power the logic rail from **either** USB **or** the motor supply,
    whichever is present, with **no user action** and with **no path** by which
    motor current can be drawn from the USB host.
  - **F6** — **Protect the motor rail**: reverse polarity at the screw terminal,
    resettable overcurrent, and a transient / regenerative over-voltage clamp.
  - **F7** — **Motors are provably off until firmware commands them** — at power-on,
    while the MCU is in reset, and after an MCU crash or brownout.
  - **F8** — Provide a **stop path that depends on neither the wireless link nor
    application firmware** (a hardware motor-disable the learner can reach).
  - **F9** — Provide a **measurable ESP-NOW → actuator latency path**: a scope-able
    strobe test point with an adjacent ground return, usable alongside a firmware
    round-trip measurement.
  - **F10** — Report **motor-rail presence and voltage** to firmware on an **ADC1**
    channel (ADC2 is unusable while the radio is active) and to the user on a
    dedicated indicator.
  - **F11** — Break out the unused GPIO plus **5 V / 3V3 / GND** to 2.54 mm headers.
    *L1.01 F5.*
  - **F12** — Report driver faults (over-current, over-temperature) to firmware.

- **Electrical / power budget:**
  - **E1** — Logic rail: **3.3 V** from the RT9080, fed by a Schottky OR of USB-C
    **VBUS** and the motor rail **VMOT**. ESP32-S3 with the radio up: **88 mA RX /
    340 mA TX peak** (ESP32-S3 datasheet Table 5-7, 3.3 V, 25 °C); budgeted at
    L1.01's more conservative **160 mA continuous / 500 mA brief peak**.
  - **E2** — Motor rail **VMOT = 5.0 V nominal, 4.75–5.5 V**. Two H-bridges, each
    hardware-limited to **I_CHOP = 333 mA typ (264–404 mA over V_TRIP and resistor
    tolerance)**. Worst-case *continuous* board draw **0.98 A**; worst-case *peak*
    (double stall coincident with a Wi-Fi TX burst) **1.32 A for ≤ ms**.
  - **E3** — **Interface requirement placed on L2.01: ≥ 1.0 A continuous and ≥ 1.35 A
    peak at 5.0 V ±2.5 %.** L2.01's design.md currently specifies **≥ 500 mA
    continuous** (its F-req 4) — see §6 **RK1**; this is a *spec uplift*, not a
    redesign, and L2.01's own §3 rows 9–10 already prove 1.7 A capability at a
    3.0 V cell with the inductor peak inside saturation.
  - **E4** — There is **no path** from VMOT into VBUS: the OR diodes' cathodes both
    sit on the LDO input, so motor current can never be drawn from the USB host.
    **USB alone therefore powers the logic but cannot move the motors** — the
    documented, safe default for flashing (RK6).

- **Interfaces:**
  - **I1** — USB-C (sink, 5.1 kΩ Rd ×2), native USB Serial/JTAG. *L1.01, verbatim.*
  - **I2** — **Motor power input** J4: 2-pos 5.08 mm screw terminal (`VMOT`, `GND`).
    Wire to L2.01's `J3` **`5V0`** and **`GND`**. **Leave L2.01's `3V3` output
    unconnected** — this board makes its own 3.3 V so it still runs on USB alone.
  - **I3** — **Motor A** J5 and **Motor B** J6: 2-pos 5.08 mm screw terminals.
  - **I4** — 2× 1×22 GPIO breakout headers (incl. 5 V/3V3/GND). *L1.01, verbatim.*
  - **I5** — **Latency strobe** TP4 (white loop) with **TP5 (black, GND)** adjacent
    for a scope probe's ground clip.

- **Supported motor class (a kit item, deliberately NOT a board BOM line):**
  **micro metal gearmotor class, 6 V rated** — Pololu 6 V LP (0.36 A stall / 40 mA
  free-run), MP (**0.67 A stall / 70 mA free-run**), or HP (1.6 A stall / 100 mA
  free-run), all quoted at their 6 V rating. Driven at 5 V their stall currents
  scale to ~0.30 / 0.56 / 1.33 A. **All three are safe on this board** because the
  chop limit — not the motor — sets the rail's bill: an LP motor never reaches the
  chop, an MP motor is limited only at stall, an HP motor is limited hard and simply
  makes less stall torque. Pololu's own guidance ("a general recommendation for
  brushed DC motor operation is 25 % or less of the stall current") puts continuous
  running for an MP motor at ~168 mA, comfortably under the chop. Larger motors
  (TT/130-size and up) will run but at chop-limited torque; **that is the lesson,
  not a defect.**

- **Constraints / DFM / safety flags:**
  - **Skill envelope (L2) and the finest pitch so far.** No leadless packages;
    passives ≥ 0805; leaded SMD + THT. The **DRV8833PWR is TSSOP-16, 0.65 mm pitch,
    16 gull-wing leads, no exposed pad** — the finest-pitch *IC* in the curriculum to
    date, drag-soldered with flux and wick, and **every joint visible and reworkable
    with an iron.** The alternative packages were rejected on exactly this ground
    (§4, RK9). L1.01 already records the USB-C receptacle as the hardest joint on the
    board; the DRV8833 does not displace it.
  - **Thermal (flagged, see header).** Worst-case DRV8833 dissipation **0.271 W** →
    **T_J ≈ 68 °C at 40 °C ambient** with 82 °C of margin to thermal shutdown (§5).
    No pour or heatsink is *required* — the PW package has no thermal pad and TI's
    instruction is to "adhere to the power dissipation limits", which is precisely
    what the chop threshold does.
  - **Li-ion-derived rail (audited, flag stays false, see header).** The board draws
    from a protected 1S cell through L2.01's boost. **L2.01's 5 V output has no
    output-side current limit** — its PTC guards the USB input, not the boost output —
    so **F2 on this board is the sole overcurrent protection between a fault here and
    a cell that can source several amps.** That makes F2 safety-critical, not a
    nicety (§5, RK5, RK2).
  - **RF / regulatory.** ESP32-S3-WROOM-1 is a pre-certified module; no board-level
    radiator cert provided the **antenna keep-out** is honoured — and on a 4-layer
    board the keep-out must exclude **all four** copper layers including both inner
    ground planes (L1.01 M5/R4). New here: a **brushed motor arcs at the commutator
    and is a broadband noise source sitting ~cm from a 2.4 GHz antenna** (RK10).
  - **Stackup: 4-layer**, as L1.01 (`F.Cu` signal · `In1.Cu` GND · `In2.Cu` GND ·
    `B.Cu` signal). Driven by the same forced native-USB diagonal, and now also by
    wanting a continuous reference under the switching motor outputs.
  - **Mechanical.** The outline necessarily grows beyond L1.01's 30 × 62 mm (three
    5.08 mm screw terminals, a 1000 µF radial can, a slide switch and the driver).
    Final geometry, like L1.01's, closes at **`[L]`** (RK8).

## 2 · Topology

The L1.01 core is unchanged. Everything new hangs off a single motor rail that the
logic also feeds from, through a diode OR.

```
 ── LOGIC (L1.01 core, reused whole) ────────────────────────────────────────────
  USB-C J1 ─F1 PTC(0.5A)─ VBUS ─ D1 USBLC6 ESD ─┬──────────────► J2/J3 headers
   (CC1/CC2 = 5.1k Rd; D+/D- → GPIO19/20)       └──► D2 ▶──┐
                                                            ├─ LDO_IN ─ U2 RT9080 ─► 3V3
 ── MOTOR RAIL ──────────────────────────────────────────── │                     │
  J4 screw ─ F2 PTC(1.5A) ─┬── VMOT ──────────────► D3 ▶────┘                     │
   5.0V ±5% from L2.01 5V0 │    │      │       │                                  │
       +                   │    │      │       └─ R19/R20 (100k+100k) → GPIO8 ADC1 │
       │      D4 ⤓ crowbar ┘    │      └─ LED3(green)+R11  "MOTOR PWR"            │
      GND ──(reverse-poly)      │                                                 │
                        D5 SMAJ6.0A TVS   C12 1000µF/16V + C13 100nF              │
                                │                │                                │
                               GND              GND                    C1 10µF ────┤
                                                                                  ├─ U1 ESP32-S3-
  VMOT ─ C7,C8 (2×10µF/25V) + C9 100nF ─► U3 pin12 VM                              │  WROOM-1-N16R2
                                          pin11 VCP ─ C11 10nF ─► VM               │  EN/BOOT, LEDs,
                                          pin14 VINT ─ C10 2.2µF ─ GND             │  GPIO → headers
                                          pin13 GND ─ GND                          │
   GPIO4 ─┬─► AIN1 (pin16)    GPIO6 ─┬─► BIN1 (pin9)      each with a 10k pulldown │
   GPIO5 ─┼─► AIN2 (pin15)    GPIO7 ─┼─► BIN2 (pin10)     (R14…R17)                │
          │                          │                                             │
   GPIO15 ─R7 470Ω─┬──► nSLEEP (pin1)          GPIO16 ◄── nFAULT (pin8) + R18 10k ↑3V3
                   ├── R8 100k ↓ GND
                   └── SW3 EG1218 slide "MOTOR SAFE" ── GND      (hardware kill, F8)

   AOUT1(2)/AOUT2(4) ─► J5 Motor A       AISEN(3) ─ R1‖R2 (2×1.2Ω) ─ GND
   BOUT1(7)/BOUT2(5) ─► J6 Motor B       BISEN(6) ─ R3‖R4 (2×1.2Ω) ─ GND

   GPIO17 ─► TP4 "STROBE" (white), TP5 GND (black) placed adjacent   (F9)
 ── COMMON GROUND: motor return star-tied at C12, single point to logic GND ──────
```

**Sub-circuits the schematic is organised into:**

1. **(L1.01 core, reused whole)** USB-C input + CC sink, protection (F1 PTC + D1
   USBLC6 ESD), 3V3 power (U2 RT9080 + C1/C5/C6), U1 ESP32-S3-WROOM-1 with EN/BOOT
   strap+button RCs, power/status LEDs, GPIO breakout + test points.
2. **Motor-power input & protection** — J4 → F2 PTC → **VMOT**; D4 shunt Schottky
   (reverse-polarity crowbar); D5 SMAJ6.0A TVS (transient / regenerative clamp);
   C12 1000 µF bulk + C13 100 nF.
3. **Logic power OR** — D2 (VBUS → LDO_IN), D3 (VMOT → LDO_IN), into U2.
4. **H-bridge driver** — U3 DRV8833PWR with its three mandated bypasses (C7/C8/C9 at
   VM, C11 across VM↔VCP, C10 at VINT), input pulldowns R14–R17, nFAULT pull-up R18.
5. **Current-limit network** — R1‖R2 on AISEN, R3‖R4 on BISEN. *This is the power
   budget.*
6. **Motor-disable** — R7 series, R8 pulldown, SW3 slide switch to GND on nSLEEP.
7. **Rail telemetry & indication** — R19/R20 divider + C14 into GPIO8 (ADC1_CH7);
   LED3 + R11 "MOTOR PWR"; TP3 (VMOT), TP4 (STROBE), TP5 (GND).
8. **Motor outputs** — J5, J6 screw terminals.

**Theory of operation.** USB powers and programs the WROOM core exactly as L1.01.
With the L2.01 module wired to J4, VMOT feeds both the DRV8833's VM pin and — through
D3 — the LDO, so the board runs untethered; with USB also plugged in, D2 shares the
logic load and nothing changes. Firmware drives **AIN1/AIN2** and **BIN1/BIN2** per
the DRV8833's logic table (0,0 = coast/fast decay; 1,0 = forward; 0,1 = reverse;
1,1 = brake/slow decay), PWM-ing one input against a held level for speed. Winding
current develops a voltage across the AISEN/BISEN resistors; when it reaches the
device's internal **200 mV** reference the bridge drops into slow decay until the
next 50 kHz cycle. That fixes the winding current at **I_CHOP = 200 mV / 0.60 Ω ≈
333 mA** regardless of the motor's own resistance — **which is how a battery module
specified at ~1 A survives two stalled motors.** nSLEEP is low unless firmware drives
it *and* SW3 is in ENABLE, so the bridges are dead through reset, brownout and crash.
An ESP-NOW packet arriving at U1 toggles GPIO17 (TP4) and then updates the LEDC duty;
the DRV8833 adds only its 450 ns input deglitch plus 1.1 µs propagation, so the
latency the learner measures is **radio + software, essentially none of it hardware**.

**Power-up / power-down sequencing (proven in Pass 10):**

- *USB only:* VBUS → F1 → D1 → D2 → LDO_IN ≈ 4.6 V → 3V3. U1 boots. U3's VM = 0, so
  the DRV8833 sits **below its 2.6 V UVLO** with every FET off. Motors cannot move.
- *VMOT only:* VMOT → F2 → D3 → LDO_IN ≥ 4.25 V → 3V3. While U1 is in reset its GPIO
  are high-Z, so R14–R17 hold AIN/BIN low (**coast**) and R8 holds nSLEEP low
  (**sleep**). **The bridges are off before firmware exists.** After nSLEEP is
  driven high, TI specifies up to **t_WAKE = 1 ms** before the outputs respond —
  firmware must wait.
- *Both:* both OR diodes conduct; the higher source carries more. No fault.
- *USB removed while running on battery:* D2 blocks, D3 continues, no interruption.
- *VMOT removed while on USB:* C12 holds VM for ≈ 3 ms at 0.8 A, then UVLO stops the
  bridges. Logic is unaffected (D2 still feeds it).
- *MCU brownout / crash / reset:* GPIO → high-Z → pulldowns → **coast + sleep**. The
  failure is fail-safe by construction (F7).
- *Digital inputs present before VM:* explicitly permitted — "There is no specific
  sequence for powering up the DRV8833. The presence of digital input signals is
  acceptable before VM is applied." (DRV8833 §9.2.)

## 3 · Calc trail (DO — lock the math)

Logic-rail rows (3V3, LDO caps, CC pull-downs, EN/BOOT RC, LED series, USB PTC) are
**inherited unchanged from L1.01** (`../l1-01-wroom-breakout/design.md` §3) and are
not re-derived. Everything below is derived worst case. Sources: **DRV8833
SLVSAR1E** (Jan 2011, rev. Jul 2015), **ESP32-S3 datasheet v2.2**, **RT9080
DS9080-09** (Dec 2024), **Vishay SS3x doc 88751** (rev. 23-Apr-2020), Littelfuse
SMAJ / miniSMD, Pololu micro-metal-gearmotor specs.

*(Calc-row IDs are `K1…K24`, a separate namespace from component refDes.)*

| # | Value | Formula / source | Result | Notes (worst case) |
| --- | --- | --- | --- | --- |
| K1 | Motor-rail spec | matched to L2.01 `5V0` (5.0 V ±2.5 % = 4.875–5.125 V) plus bench-supply tolerance; ceiling set by the LDO path (K6) and the TVS standoff (K13) | **5.0 V nom, 4.75–5.5 V** | Tightened from an initial 4.5 V floor by K6. Do **not** feed a 6 V pack: F2 V_max is 6 V and D5 V_wm is 6.0 V |
| K2 | Sense resistor | TI Eq. 2, `R_ISENSE = 0.2 V / I_CHOP`; implemented as **two 1.2 Ω 1 % in parallel** per bridge, which is the datasheet's own recommendation ("common practice is to use multiple standard resistors in parallel… distributes the current and heat") | **0.60 Ω per bridge** | 1.2 Ω is a stocked E24 value; 0.62 Ω single-resistor equivalents are not stocked at DigiKey in RC1206 |
| K3 | Chop current | `I_CHOP = V_TRIP / R_ISENSE`; **V_TRIP = 160 / 200 / 240 mV** (DRV8833 EC, min/typ/max) over R = 0.594 / 0.600 / 0.606 Ω (±1 %) | **264 mA min · 333 mA typ · 404 mA max** | The ±20 % V_TRIP spread dominates. **264 mA is the *guaranteed* drive current** — above an MP gearmotor's 70 mA free-run with 3.8× headroom |
| K4 | Package current headroom | DRV8833 **PW package: 500 mA RMS per bridge** (features, VM = 5 V, 25 °C) vs I_CHOP max 404 mA | **19 % derating** | This is the derating the `hasThermalConcern` conditional attests. PWP/RTY would allow 1.5 A but are rejected on DFM (§4) |
| K5 | Board draw, continuous worst | 2 × I_CHOP(max) + logic + U3 I_VM(max) + LED3 + divider = 0.808 + 0.160 + 0.003 + 0.006 + 0.00003 | **0.977 A ≈ 0.98 A** | Both motors stalled indefinitely, logic at L1.01's conservative 160 mA continuous |
| K6 | Board draw, peak | K5 with the logic term at L1.01's 500 mA Wi-Fi-TX budget instead of 160 mA | **1.32 A for ≤ ms** | ESP32-S3 Table 5-7 measures TX peak at **340 mA**; 500 mA is L1.01's conservative budget |
| K7 | Upstream requirement on L2.01 | K5/K6 rounded up | **≥ 1.0 A cont., ≥ 1.35 A peak @ 5.0 V** | vs L2.01's stated **≥ 500 mA**. Proven achievable: L2.01 §3 r10 gives I_OUT,max ≈ 1.7 A at a 3.0 V cell; at 1.0 A out its inductor sees I_L 1.85 A, I_peak 2.07 A < I_sat 3.7 A and < switch limit 2.9 A. **RK1** |
| K8 | Cell discharge implied | 5 V × 1.0 A / (0.9 × 3.0 V) at a depleted cell | **1.85 A from the cell** (2.4 A at the K6 peak) | Kit must specify a 1S cell rated ≥ 2 A continuous discharge (≥ 4C on a 500 mAh pack). **RK3**, Pass 8 |
| K9 | LDO headroom | `LDO_IN(min) = VMOT(min) − V_F(D3,max) = 4.75 − 0.50`; required = 3.3 + V_DROP(max) = 3.3 + 0.53 | **4.25 V vs 3.83 V → +0.42 V** | V_F ≤ 0.5 V is the SS34 datasheet **max at 3 A**, hence an upper bound at any current ≤ 3 A; V_DROP 0.53 V is RT9080 max at 600 mA for 3 V ≤ V_OUT |
| K10 | LDO headroom under a motor step | K9 minus the C12 sag (K11) | **≥ 4.09 V vs 3.83 V → +0.26 V** | Still in regulation through a worst-case double-motor turn-on |
| K11 | VMOT sag on a motor step | `ΔV = I·Δt/C = 0.808 A × 100 µs / 1000 µF`, plus an ESR term bounded pessimistically at 0.1 Ω | **81 mV + ≤ 81 mV = ≤ 0.16 V** | 100 µs is the assumed upstream boost loop-response time (TLV61048, 600 kHz, internal comp) — stated as an assumption, not a datasheet number |
| K12 | VMOT chop ripple | `ΔV = 0.404 A × 10 µs / 1000 µF` (50 kHz internal chop, worst on-time) | **≈ 4 mV + ESR** | Fast edges handled by C7/C8/C9 at the VM pin |
| K13 | TVS standoff vs rail | **SMAJ6.0A** V_wm 6.0 V > VMOT max 5.5 V; V_BR(min) 6.67 V | **non-conducting through 5.5 V** | Standoff chosen **above** the 5.5 V ceiling; an SMAJ5.0A would sit on the leakage knee (the l1-04 Pass-2 finding, re-applied) |
| K14 | TVS clamp vs the parts on the rail | SMAJ6.0A V_C = **10.3 V** at I_PP 38.8 A (400 W) | **10.3 V < 10.8 V** (U3 V_M recommended max) **< 11.8 V** (U3 abs max); **< 16 V** (C12) | **Even the TVS's maximum rated clamp cannot exceed the driver's supply rating.** The RT9080 is the exception — K15 |
| K15 | RT9080 exposure during a clamp | `LDO_IN = VMOT − V_F(D3)`; a worst-case-high SMAJ6.0A breaks down at V_BR ≈ 7.37 V → LDO_IN ≈ 7.0 V vs RT9080 abs max **6.5 V** | **exposed above VMOT ≈ 6.85 V** | No TVS can clamp a 5.5 V-tolerant node below 6.5 V (clamping factor ~1.2 is unobtainable). Proven unreachable in normal operation by K16; residual accepted, **RK4** |
| K16 | Can a motor pump the rail? | A brushed motor driven from V_M spins to where `K_e·ω ≈ V_M − I·R_w < V_M`. To force charge back through the body diodes it needs `EMF > V_M + 2·V_F` | **No — not in any decay mode** | Slow decay (brake/chop) shorts the winding: energy goes into R_w and the FETs, none to VM. Fast decay/coast can only return charge if EMF > V_M, which a self-driven motor never reaches. **The only path is mechanical back-driving above no-load speed** (pushing the robot, a downhill run, hand-spinning a wheel) |
| K17 | Inductive switch-off kick | `E = ½L I² = ½ × 1 mH × 0.404²` into C12; `ΔV = √(V² + 2E/C) − V` | **82 µJ → ΔV ≈ 16 mV** | Negligible. Winding inductance 1 mH is a class estimate for a micro gearmotor, flagged as such; the result is 3 orders below the K14 clamp so the estimate is not load-bearing |
| K18 | U3 worst-case dissipation | TI Eq. 3, `P = (R_HS + R_LS)·I_RMS²` per bridge with the **85 °C max** values at V_M = 5 V (325 + 275 = 600 mΩ), I = I_CHOP max 404 mA, ×2 bridges, ×1.3 for TI's "10–30 %" switching adder, + I_VM 3 mA × 5.5 V | **0.271 W** | Bounding case is duty → 1 (a motor whose natural current only just exceeds the chop) |
| K19 | U3 junction temperature | `T_J = T_A + R_θJA·P`, **R_θJA(PW) = 103.1 °C/W** | **T_J ≈ 53 °C @ 25 °C** ambient, **68 °C @ 40 °C** | vs T_TSD(min) **150 °C** → **82 °C margin**; vs T_J abs max 150 °C → 82 °C. Self-consistent: R_DS(on) was taken at 85 °C, above the computed T_J |
| K20 | Sense-resistor dissipation | Each 1.2 Ω carries I_CHOP/2 = 202 mA at duty → 1: `P = 0.202² × 1.2` | **49 mW each** vs 1206 rating 250 mW | **5.1× margin.** Pair total per bridge 98 mW. Current only flows in R during the *drive* phase — in slow decay it recirculates between the two low-side FETs and bypasses the resistor — so duty → 1 is the true bound |
| K21 | xISEN pin voltage | steady state = V_TRIP max **240 mV** vs abs max **+0.5 V** | **52 % margin (steady)** | **Transient exception:** during a hard output short the OCP analog limit (2 A typ / 3.3 A max) puts 1.2–2.0 V on xISEN for at most the **3.75 µs sense-blanking window**, then OCP disables the bridge for t_OCP = 1.35 ms → **≤ 0.3 % duty**. TI's own reference design has the same property (0.2 Ω × 4 A parallel mode = 0.8 V). Bounded, accepted — **RK7** |
| K22 | F2 PTC coordination | need I_hold(derated) > K5 = 0.98 A; **miniSMDC150F-2: I_hold 1.5 A, I_trip 3.0 A, V_max 6 VDC, R1max 0.11 Ω** | **~1.2 A hot vs 0.98 A → +22 %** | Derating ~0.8× at 60 °C carried from the l1-04 F2 analysis of the same part. Drop = 0.98 × 0.11 = **0.108 V**; dissipation **0.106 W** in an 1812. V_max 6 V > the 5.5 V ceiling (K1) |
| K23 | nSLEEP logic-high margin | `V_OH(min) = 0.8 × VDD` (ESP32-S3 Table 5-4, **measured into a high-impedance load**) with VDD worst case 3.3 × (1 − 2 % acc − 1 % load-reg − 0.35 % line-reg) = **3.190 V** → 2.552 V, × R8/(R7+R8) = 100/100.47 | **2.540 V vs V_IH(nSLEEP) 2.5 V → +40 mV** | Thin, and both numbers are 25 °C floors. **Accepted because the failure is fail-safe** — a marginal nSLEEP high leaves the driver *asleep*, i.e. motors do not move. R8 = **100 kΩ, not 10 kΩ**, precisely for this: a 10 kΩ pulldown gives 2.44 V, **below** V_IH. **RK11** |
| K24 | AIN/BIN logic-high margin | same V_OH floor 2.552 V vs V_IH(all except nSLEEP) **2.0 V** | **+552 mV** | Comfortable. Drive current into a 10 kΩ pulldown = 0.33 mA, far inside the 40 mA pad rating |

**Bypass and decoupling (all three values are datasheet-mandated, not chosen):**

| # | Net | Datasheet instruction | Implementation | Proof |
| --- | --- | --- | --- | --- |
| B1 | **VM** | "A 10-µF (minimum) ceramic bypass capacitor to GND is recommended" (Pin Functions), placed as close as possible with a thick trace (§10.1) | **C7 + C8 = 2 × 10 µF / 25 V X5R 0805** (KEMET C0805C106K3PACTU) + C9 100 nF | A **16 V** X5R 0805 10 µF retains only ~5–6 µF at 5 V DC bias — one part would miss the minimum. The **25 V** part retains ~7–8 µF, so two give **≈ 14–16 µF effective ≥ 10 µF**. Derating figures are class-typical manufacturer-curve values; exact-curve confirmation is owed at `[S]` |
| B2 | **VCP** | "Connect a 0.01-µF, 16-V (minimum) X7R ceramic capacitor **to VM**" | **C11 = 10 nF / 50 V X7R 0805**, wired VCP↔VM (**not** to GND) | Charge-pump reservoir. Wiring it to GND is the classic misread; captured for `[S]` in §6 |
| B3 | **VINT** | "Bypass to GND with 2.2-µF, 6.3-V capacitor" | **C10 = 2.2 µF / 16 V X7R 0805** (Samsung CL21B225KOFNNNE) | 16 V X7R at the ~3 V VINT bias retains ~1.8–2.0 µF; a nominal 2.2 µF **6.3 V** X5R would retain ~1.3 µF, i.e. *worse* than the part specified. Deliberately not doubled — extra bulk here would stretch t_WAKE beyond its 1 ms spec |
| B4 | **Motor outputs** | *(no capacitor)* | **none — deliberately** | Fitting the instinctive 100 nF brush-suppression cap across AOUT1/AOUT2 would inject `I = C·dV/dt = 100 nF × 5 V / 180 ns ≈ **2.8 A**` at every switching edge, **above the 2 A typ OCP trip**. Brush caps belong at the motor. **RK10** |

**Timing budget for the latency lesson (F9) — why the hardware is not the answer:**

| Contributor | Value | Source |
| --- | --- | --- |
| DRV8833 input deglitch `t_DEG` | 450 ns typ | DRV8833 EC |
| DRV8833 propagation `t_PROP` (INx → OUTx) | 1.1 µs typ @ V_M = 5 V | DRV8833 EC |
| DRV8833 internal dead time `t_DEAD` | 450 ns typ (no external implementation needed) | DRV8833 EC |
| DRV8833 output rise / fall | 180 ns / 160 ns (16 Ω load, 10–90 %) | DRV8833 EC |
| **Total H-bridge contribution** | **≈ 1.5 µs** | — |
| ESP-NOW packet + stack + scheduler | **~1–10 ms**, the thing being measured | — |
| `t_WAKE` (nSLEEP high → bridge live) | ≤ 1 ms — a **one-off** cost at enable, not per command | DRV8833 EC |

**Speed-PWM constraint (a real, datasheet-derived limit worth teaching):** the
current-sense blanking time is fixed at **3.75 µs** and "sets the minimum on time of
the PWM when operating in current chopping mode." At a recommended **20 kHz** LEDC
carrier (50 µs period) that is **7.5 % duty**, so duty commands below ~8 % are not
faithfully reproduced while the chop is active. The device's own current-control PWM
runs at **50 kHz**; keep the commanded carrier below it.

## 4 · IC / active-part selection (DO — lock the parts)

Core actives (U1 ESP32-S3-WROOM-1-N16R2, U2 RT9080-33GJ5, D1 USBLC6-2SC6, J1
USB4110-GF-A, F1 1206L050YR) are **inherited unchanged from L1.01** and already
datasheet-verified in that board's run. New / motor-subsystem actives:

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U3 | **Texas Instruments DRV8833PWR** (**PW = plain TSSOP-16, 0.65 mm pitch, no PowerPAD**) | Dual H-bridge, V_M 2.7–10.8 V, integrated body diodes (no external flyback), internal dead time (no shoot-through to design around), OCP + TSD + UVLO, low-power sleep, and — the reason it is the curriculum's ACT-L2 part — **fixed-frequency PWM winding-current regulation set by one external resistor**, which is what makes a battery-powered two-motor board tractable. **Package choice is the load-bearing decision:** the PWP (HTSSOP) and RTY (WQFN) variants both carry a PowerPAD that the datasheet says "**must be connected to ground**" — an underside pad an iron cannot reach, inspect or rework, outside the L2 envelope. **PW has no pad**; the cost is a per-bridge rating of **500 mA RMS instead of 1.5 A**, which K3/K4 turn into a virtue. Sourcing agrees: **PWR = 12,895 in stock, Active**; PWPR only 295; **PW (tube) is Obsolete.** | pin config (all 3 packages), abs max, recommended operating, thermal information, full EC table, §7.3.2 bridge logic + decay modes, §7.3.3 current control, §7.3.4 nSLEEP, §7.3.5 protection, §8.2.2 design procedure, §9.1 bulk capacitance, §9.2 sequencing, §10.1 layout, §10.3–10.4 thermal + dissipation |
| D2, D3 | **Vishay General Semiconductor SS34-E3/57T** (**SMC / DO-214AB**) | 40 V / 3 A Schottky as the **logic-rail OR** (D2 from VBUS, D3 from VMOT). Oversized on current by design: V_F ≤ **0.5 V** is the datasheet **max at 3 A**, so it is a rigorous upper bound at the ≤ 0.5 A these actually carry, which is exactly the number K9's LDO-headroom proof needs. Cathodes both on LDO_IN ⇒ **structurally impossible** for motor current to reach the USB host (E4). SMC is the easiest diode package on the board to hand-solder. | V_RRM 40 V, I_F(AV) 3 A, **V_F max 0.5 V @ 3 A**, I_R (0.5 mA @ 25 °C, 20 mA @ 100 °C at *rated* V_R), I_FSM 100 A, R_θJA 55 °C/W, package DO-214AB |
| D4 | **Vishay General Semiconductor SS34-E3/57T** (**SMC / DO-214AB**) | **Shunt reverse-polarity crowbar** on VMOT: forward-conducts on a mis-wired J4, clamps VMOT to ≈ −0.4 V (protecting C12's electrolytic and the driver) and forces F2 above its trip. Verified in Pass 6 that **F2 is genuinely in the fault loop** — reversing J4 puts F2 in series with D4, so the crowbar has something to trip. I_FSM 100 A carries the fault; the Fig. 2 surge curve still allows ~20 A at 100 cycles, covering the PTC's trip time. | as above, plus Fig. 2 non-repetitive surge curve |
| D5 | **Littelfuse SMAJ6.0A** (SMA / DO-214AC) | Unidirectional **6.0 V** TVS on VMOT. **V_wm 6.0 V chosen above the 5.5 V ceiling** so it idles in µA leakage; V_BR(min) 6.67 V; **V_C 10.3 V at the full 400 W pulse, which is below the DRV8833's 10.8 V recommended max and its 11.8 V abs max** (K14) — the clamp cannot, at its own rated worst case, exceed the part it protects. | V_wm, V_BR, V_C / I_PP, P_PP, unidirectional orientation |
| F2 | **Littelfuse miniSMDC150F-2** (1812 SMD PTC) | Resettable overcurrent on VMOT, and — because **L2.01's boost output has no current limit of its own** — the sole protection between a fault here and a 1S Li-ion. I_hold 1.5 A derates to ~1.2 A hot, clearing K5's 0.98 A with 22 %; I_trip 3.0 A trips a real short; **V_max 6 VDC > the 5.5 V ceiling** with 0.5 V to spare. | I_hold / I_trip, V_max 6 V, R1max, temperature derating, package |
| SW3 | **E-Switch EG1218** (SPDT slide, THT) | **Hardware MOTOR SAFE** (F8). Grounds nSLEEP through R7 regardless of firmware, so a runaway link or a crashed sketch can be stopped by hand. A latching slide, not a momentary button, so "motors disabled" is a *mode* you can leave the board in while flashing. Carries only 7 mA (3.3 V / 470 Ω), far inside its 200 mA rating. | contact rating, SPDT configuration, THT footprint |

**Complete U3 pin accounting (all 16 pins, TSSOP/HTSSOP numbering) — captured for the `[S]` audit:**

| Pin | Name | Disposition |
| ---: | --- | --- |
| 1 | nSLEEP | GPIO15 via **R7 470 Ω**; **R8 100 kΩ** pulldown; **SW3** to GND. Internal 500 kΩ pulldown also present |
| 2 | AOUT1 | **J5-1** (Motor A) |
| 3 | AISEN | **R1 ‖ R2** (2 × 1.2 Ω) to GND |
| 4 | AOUT2 | **J5-2** (Motor A) |
| 5 | BOUT2 | **J6-2** (Motor B) |
| 6 | BISEN | **R3 ‖ R4** (2 × 1.2 Ω) to GND |
| 7 | BOUT1 | **J6-1** (Motor B) |
| 8 | nFAULT | GPIO16; **R18 10 kΩ** pull-up to 3V3 (open-drain output) |
| 9 | BIN1 | GPIO6; **R16 10 kΩ** pulldown |
| 10 | BIN2 | GPIO7; **R17 10 kΩ** pulldown |
| 11 | VCP | **C11 10 nF X7R to VM** (not to GND) |
| 12 | VM | VMOT; **C7 + C8 (2 × 10 µF)** + **C9 100 nF** |
| 13 | GND | GND (**the PW package has no PowerPAD** — pin 13 is the only ground connection) |
| 14 | VINT | **C10 2.2 µF** to GND |
| 15 | AIN2 | GPIO5; **R15 10 kΩ** pulldown |
| 16 | AIN1 | GPIO4; **R14 10 kΩ** pulldown |

**U1 GPIO allocation (ESP32-S3-WROOM-1-N16R2; module pin numbers from the
library's VERIFIED pinout):**

| Signal | GPIO | Module pin | Note |
| --- | --- | ---: | --- |
| AIN1 / AIN2 | GPIO4 / GPIO5 | 4 / 5 | LEDC-capable; ADC1 channels, unused as analog |
| BIN1 / BIN2 | GPIO6 / GPIO7 | 6 / 7 | as above |
| nSLEEP | GPIO15 | 8 | via R7/R8/SW3 |
| nFAULT | GPIO16 | 9 | input, pulled up |
| STROBE (TP4) | GPIO17 | 10 | F9 latency strobe |
| **VMOT sense** | **GPIO8 = ADC1_CH7** | 12 | **ADC1 deliberately** — ADC2 is unusable while Wi-Fi/ESP-NOW is active (L1.05's headline trap) |
| LINK LED (LED2) | GPIO47 | 24 | same pin as L1.02's LINK LED, so firmware ports across |
| USB D− / D+ | GPIO19 / GPIO20 | 13 / 14 | L1.01, verbatim |
| EN, BOOT | EN, GPIO0 | 3, 27 | L1.01, verbatim |
| **Avoided** | GPIO0, 3, 45, 46 | — | strapping pins — none carries a motor function |
| Everything else | — | — | to J2 / J3 breakout; the 8 pins above are **silkscreen-marked as claimed** |

**Supporting passives & connectors (motor subsystem):**

- **R1–R4 = Yageo RC1206FR-071R2L** — 1.2 Ω 1 % **1206** current-sense (two per bridge).
- **R7, R9–R11 = Yageo RC0805FR-07470RL** — 470 Ω (nSLEEP series + three LED series).
- **R8, R19, R20 = Yageo RC0805FR-07100KL** — 100 kΩ (nSLEEP pulldown + VMOT divider).
- **R14–R18 = Yageo RC0805FR-0710KL** — 10 kΩ (four input pulldowns + nFAULT pull-up),
  same line as the L1.01 EN/BOOT pull-ups R12/R13.
- **C7, C8 = KEMET C0805C106K3PACTU** — 10 µF / **25 V** X5R 0805 (VM bypass), the
  same line as L1.01's 3V3 bulk C1.
- **C10 = Samsung Electro-Mechanics CL21B225KOFNNNE** — 2.2 µF / 16 V X7R 0805 (VINT).
- **C11 = Samsung Electro-Mechanics CL21B103KBCNNNC** — 10 nF / 50 V X7R 0805 (VCP↔VM).
- **C12 = Panasonic EEU-FM1C102** — 1000 µF / 16 V radial THT low-ESR (VMOT bulk).
- **C9, C13, C14 = Samsung Electro-Mechanics CL21B104KBCNNNC** — 100 nF 0805.
- **J4, J5, J6 = TE Connectivity 282837-2** — 2-pos 5.08 mm THT screw terminals.
- **LED3 = Würth Elektronik 150080GS75000** — green 0805, "MOTOR PWR".
- **TP4 = Keystone Electronics 5012** — white THT loop, the latency strobe.

> **Silkscreen rules (part of the lesson):** mark J4 polarity **+ / −** explicitly and
> label it **`5V0 from L2.01`**; label J5/J6 **`MOTOR A` / `MOTOR B`**; label SW3's two
> positions **`SAFE` / `ENABLE`**; label TP4 **`STROBE`** and TP5 **`GND`** as a pair;
> mark D4/D5 cathodes and U3 pin 1; and mark the **eight GPIO claimed by the motor
> subsystem** on the breakout headers so a learner does not wire over them.

## 5 · Power & thermal

**Rails.** (1) **VMOT ≈ 5 V** from J4 — the only motor supply, and (through D3) a
source for the logic. (2) **VBUS 5 V** from USB-C — through F1/D1 to the headers and
(through D2) the other source for the logic. (3) **3V3** from U2. VBUS and VMOT meet
**only** at LDO_IN, behind two cathodes, so no motor current can reach the USB host.

**Worst-case dissipation budget:**

- **U3 DRV8833 — the headline thermal item.** 0.271 W at both bridges chopping
  (K18) → **T_J ≈ 68 °C at 40 °C ambient** (K19), **82 °C below thermal shutdown**.
  This is comfortable *because* I_CHOP was set 19 % under the PW package's 500 mA
  RMS rating, not by accident. TI's instruction for this package is explicit:
  *"The PW package option is not thermally enhanced and TI recommends adhering to
  the power dissipation limits."* No pour, heatsink or thermal via array is
  required — and none is possible, since the package has no thermal pad.
  The backstop is the device's own TSD (150 °C min, recovering 45 °C lower) with
  nFAULT asserted to firmware (F12).
- **R1–R4 sense resistors:** 49 mW each in a 250 mW 1206 (K20) — **5.1× margin**.
  Splitting each 0.60 Ω into two 1.2 Ω is TI's own recommendation and halves the
  per-part heat.
- **F2 PTC:** 0.106 W at K5's 0.98 A (K22), in an 1812. Fine.
- **D2 / D3 OR diodes:** ≤ 0.5 V × 0.16 A = **80 mW** continuous, 0.25 W at the
  Wi-Fi-TX peak; SS34 R_θJA 55 °C/W → ΔT ≈ 4 °C. Negligible.
- **U2 RT9080:** now runs from LDO_IN ≈ 4.4–4.9 V rather than a full 5 V, so its drop
  is ~1.1–1.6 V instead of 1.7 V. At 160 mA continuous that is **0.21 W**;
  R_θJA(EVB) 100.7 °C/W → ΔT ≈ 21 °C. The 500 mA TX burst is ms-scale.
- **D4 under a reverse-polarity fault:** conducts until F2 trips. With the L2.01
  module the fault current is set by the cell through the boost's inductor and
  rectifier — several amps — which is well above F2's 3 A trip, so the trip is fast
  (Littelfuse miniSMD time-to-trip falls steeply above ~2× I_hold). SS34's surge
  curve (Fig. 2) still permits ~20 A at 100 cycles, covering that window. **The
  dangerous variant is a current-limited bench supply that never reaches 3 A**: D4
  then conducts steady-state at the limit, dissipating V_F × I ≈ 0.5 × 2 = **1.0 W**
  in an SMC body rated I_F(AV) 3 A on 14 × 14 mm of copper (R_θJA 55 °C/W → ΔT
  ≈ 55 °C). Bounded and survivable; **RK2**.

**Battery-side consequences (the Li-ion conditional, Pass 8).** At K5's 1.0 A from a
5 V rail the cell delivers **1.85 A** at 3.0 V (K8), 2.4 A at the K6 peak. That sets
two kit requirements: a 1S cell **rated ≥ 2 A continuous discharge**, and L2.01's
spec uplift (K7). It also means **F2 is the only current limit on the whole path** —
L2.01's own PTC guards its USB input, and its DW01A's OCP is set by the FS8205A's
R_DS(on) at *tens* of amps, far above anything this board could draw before its
wiring failed. **Cross-board recommendation: L2.01 should carry an output-side PTC.**

**Why there is no separate motor supply (and why that is the lesson).** L1.04 solved
brownout-on-stall by adding a second rail. That answer is unavailable here: F3
demands one battery module. So the board buys the same safety with a different
instrument — it **limits what the load is allowed to take** (K3), **buffers the rail**
(C12, K11), and **keeps the logic in regulation through the worst step** (K10). The
guide should draw that line explicitly from L1.04.

## 6 · Risk register

| # | Risk | L × I | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **Upstream capability mismatch** — worst-case draw (K5 0.98 A cont / K6 1.32 A peak) is ~2× L2.01's stated **≥ 500 mA** continuous output (its F-req 4). Under-spec'd upstream means rail collapse, MCU brownout, or a boost run past its ratings. | High × High | The chop (K3) bounds the draw so the requirement is *finite and provable*: **≥ 1.0 A cont / ≥ 1.35 A peak** (K7). Verified against L2.01's own numbers — 1.7 A ceiling at a 3.0 V cell, I_peak 2.07 A vs I_sat 3.7 A and switch limit 2.9 A, boost + rectifier dissipation ≈ 0.62 W — so this is a **spec uplift, not a redesign**. **Owner action: L2.01's design.md F-req 4, §5 and §3 r8–r10 must be restated at 1.0 A.** | **DE-RISKED** (design) + **owner action on L2.01** |
| **RK2** | **Reverse polarity at J4**, now on a Li-ion-fed rail with no upstream output limit. | High × High | **D4 shunt Schottky** clamps VMOT to ≈ −0.4 V and **F2 is proven to be in the fault loop** (reversing J4 puts F2 in series with D4). Fast trip against a battery source; the bench-supply sub-trip case is bounded at ~1.0 W in D4 (§5). Silk **+ / −** on J4. | **DE-RISKED** |
| **RK3** | **Cell over-discharge** — 1.85–2.4 A drawn from a 1S pack (K8) exceeds what a small or aged cell can safely deliver. | Med × High | Kit specifies a 1S cell **rated ≥ 2 A continuous**; L2.01's DW01A guards the true over-discharge floor; the chop bounds the draw so the requirement cannot creep with a bigger motor. Documented in the guide's parts list. | **DE-RISKED** (bounded + specified) |
| **RK4** | **RT9080 abs-max exposure during a rail excursion** — no TVS can clamp a 5.5 V-tolerant node below the LDO's 6.5 V abs max (K15), so VMOT above ≈ 6.85 V over-volts U2 and, behind it, the 3V3 rail. | Low × High | **K16 proves no decay mode can produce it**: a self-driven brushed motor's back-EMF never exceeds its own supply, slow decay dissipates in the winding, and the switch-off kick is 16 mV. The single path is **mechanical back-driving above no-load speed**. Bounded in hardware for everything else on the rail (K14). De-risked in the lesson: wheels off the bench when powered, SW3 to SAFE when handling. **Named production upgrade: a wide-V_IN LDO, or a 6.2 V clamp behind a series element on the logic feed.** Consistent with L2.01's own accepted RK10 (FB-divider open → 14 V on the same LDO). | **ACCEPTED** (bounded, disclosed, upgrade named) |
| **RK5** | **Motor-rail short / seized motor beyond rating.** | Med × Med | Three independent layers: the **chop** (normal limiting), the DRV8833's **OCP** (2 A typ trip, 4 µs deglitch, 1.35 ms retry, per-bridge so the other bridge keeps working) with **nFAULT** to firmware, and **F2** (3 A trip) for anything upstream of the driver. | **DE-RISKED** |
| **RK6** | **Motor supply absent** — learner powers USB only and nothing moves. | High × Low | Benign and *designed in* (E4). Made obvious three ways: the **green MOTOR PWR LED** is dark, the **ADC1 rail sense** reads < 4.0 V, and the DRV8833 sits in UVLO. First step in the guide's debug flow. | **DE-RISKED** (accepted, instrumented) |
| **RK7** | **xISEN abs-max transient** — a hard output short drives 1.2–2.0 V onto a pin rated +0.5 V, for the 3.75 µs sense-blanking window (K21). | Low × Med | Bounded to **≤ 0.3 % duty** by OCP's 1.35 ms retry; R_ISENSE already the smallest the power budget allows; TI's own reference application carries the same property. Output shorts are a mis-wire at a screw terminal, not a normal mode. | **DE-RISKED** (bounded, accepted) |
| **RK8** | **Motor return current contaminates the logic ground; motor traces under-sized** — 0.8 A of 50 kHz-chopped current with 180 ns edges sharing a reference with USB D±, the EN strap and an ADC input. | Med × High | **`[L]`:** motor return star-tied at **C12**, single-point to logic GND; VMOT and its return **≥ 0.8 mm**, motor outputs **≥ 0.5 mm**, all short; AISEN/BISEN returned to U3 pin 13 by the shortest path (sense integrity); C7/C8/C9 within a few mm of pin 12; C11 hard against pins 11–12. Outline and placement close with this. | open → close at **`[L]`** |
| **RK9** | **Footprint ↔ pinout for the new parts** (U3 TSSOP-16, D2–D4 SMC, D5 SMA, F2 1812, R1–R4 1206, J4–J6 screw terminals, SW3 slide) not yet pad-verified. **Specific trap: the DRV8833 pin map differs between PW/HTSSOP and WQFN** — pin 1 is nSLEEP on PW but AISEN on WQFN. Assign the **TSSOP-16 (PW)** footprint and the PW column of the Pin Functions table; **do not** reuse an HTSSOP footprint (it adds a thermal pad the PW part does not have). | Med × High | Intended pinout captured in §4 pin-accounting table; **verified at `[S]`** once symbols/footprints are chosen. | open → close at **`[S]`** |
| **RK10** | **Brush noise / switching EMI desenses the 2.4 GHz link** — a brushed commutator is a broadband arc source, and the motor terminals sit ~cm from the module's PCB antenna. Degraded link shows up *as measured latency*, confounding the F9 lesson. | Med × Med | **No capacitors across the H-bridge outputs** (B4 — they would trip OCP). Brush caps belong at the motor and are specified as an assembly step; motor leads twisted and short. **`[L]`:** J5/J6 placed on the board edge **furthest from the antenna keep-out**; motor loop area minimised. Turned into lesson content: measure latency with motors idle and under load, and explain the difference. | open → close at **`[L]`** (+ guide) |
| **RK11** | **nSLEEP logic-high margin is +40 mV** at worst-case stacked specs (K23). | Med × Low | **Fail-safe by direction:** if nSLEEP fails to register high the driver stays asleep and the motors do not move. R8 = 100 kΩ (not 10 kΩ) keeps the divider loss at 0.47 %; a 10 kΩ pulldown would have put the level *below* V_IH. Realistic level is ~3.19 V (V_OH is a high-impedance-load floor). | **DE-RISKED** (accepted, direction proven safe) |
| **RK12** | **Motors move at power-on or after an MCU crash.** | Low × High | Four independent holds: DRV8833 internal pulldowns (150 kΩ on AIN/BIN, 500 kΩ on nSLEEP), **external 10 kΩ pulldowns R14–R17**, **R8 100 kΩ on nSLEEP**, and **SW3**. GPIO high-Z during reset therefore means **coast + sleep**. TI confirms inputs may be present before V_M (§9.2). | **DE-RISKED** |
| **RK13** | **Link-loss runaway** — ESP-NOW packets stop and the motors hold the last commanded duty. Hardware alone cannot fix this. | Med × High | **F8 hardware stop: SW3.** Plus firmware requirements the guide must state and test: a receive watchdog that zeroes the duty after N ms without a packet, and the S3's own task watchdog. nSLEEP is the single point that kills both bridges. | **DE-RISKED** (hardware affordance + stated firmware requirement) |
| **RK14** | **VMOT floats on OR-diode reverse leakage** with USB only — SS34 I_R rises to 20 mA at 100 °C at *rated* V_R, and at 4.6 V reverse could reach a fraction of a mA hot, lifting an unloaded VMOT. | Low × Low | The **LED3 + R11 branch clamps VMOT at the LED's forward knee (~2.3–2.7 V)**, which is at or below the DRV8833's 2.6 V UVLO, so the bridges stay disabled; the R19/R20 divider bleeds the rest. Firmware's rail-present threshold is **4.0 V**, not "non-zero". | **DE-RISKED** (accepted, threshold specified) |
| **RK15** | **Antenna keep-out** (inherited from the WROOM core). | Low × High | Module on a board edge, no copper or parts under the PCB antenna, keep-out excluding **all four** copper layers including both inner GND planes (L1.01 M5/R4). | open → close at **`[L]`** |
| **RK16** | **DRV8833 has no drop-in second source.** | Low × Med | Stated honestly rather than papered over. **DRV8833PWPR** is the same silicon in HTSSOP-16 — a *footprint* change (ECN, and it reintroduces the PowerPAD), not a drop-in; **Toshiba TB6612FNG** (SSOP-24, 29,563 in stock) is a functional alternative that would require a redesign. Mitigation is stock depth: PWR at 12,895 units, Active, plus a second distributor. | **ACCEPTED** (disclosed) |
| **RK17** | **First fine-pitch IC in the curriculum** — TSSOP-16, 0.65 mm, 16 leads. | Med × Med | Every lead is a visible, reworkable gull-wing joint; drag-solder + flux + wick is the taught technique, and the alternatives (WQFN, HTSSOP-with-pad) are strictly worse for an iron. The guide must carry a dedicated fine-pitch section and a "check with a loupe / continuity-test every adjacent pair" step before power-up. | **DE-RISKED** (design) + guide requirement |

**Intended polarity / orientation captured for the `[S]` audit:** D2, D3 cathodes →
**LDO_IN** (anodes to VBUS and VMOT respectively); D4 **cathode → VMOT, anode → GND**
(shunt crowbar, reverse-biased in normal use); D5 SMAJ6.0A **cathode → VMOT, anode →
GND** (unidirectional, band toward the rail); C12 **+ → VMOT**; F2 and R1–R4 non-polar;
U3 pin 1 = nSLEEP (**PW pin map, not WQFN**); J4 pin 1 = VMOT (+), pin 2 = GND.

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board**:

- [ ] **Calc trail recorded** — every derived value worst-case-sourced (§3, K1–K24 +
  B1–B4); logic-rail values inherited from L1.01.
- [ ] **Each IC datasheet-verified** — U3/D2–D4/D5/F2/SW3 against their own datasheets
  (§4); core actives inherited from L1.01.
- [ ] **Footprint ↔ pinout cross-checked** — **`[S]`**, verified at schematic capture;
  intended pinout captured in §4 and §6 (**note the PW-vs-WQFN pin-map trap, RK9**).
- [ ] **Fab-DRU DRC accounted for** — **`[L]`**, applied before gerber export;
  4-layer PCBWay stackup as L1.01.
- [ ] **BOM availability confirmed** — every part live-screened at DigiKey
  **2026-07-30**, all Active and in stock (§8).
- [ ] **All top risks de-risked** — §6: RK1–RK7, RK11–RK14, RK16, RK17 de-risked or
  explicitly accepted at design; RK8, RK10, RK15 close at **`[L]`**; RK9 at **`[S]`**.

Conditional — **the flags as they read in PROD fire no rows today.** This run
recommends setting **`hasThermalConcern = true`**, which would materialise:

- [ ] **Thermal budget verified** — worst-case dissipation 0.271 W, T_J ≈ 68 °C at
  40 °C ambient, 82 °C below TSD; no pour possible or needed (PW has no thermal pad).
  *Evidence: §5, K18–K20; audit run in Pass 7.*
- [ ] **Derating applied** — I_CHOP max 404 mA is **19 % under** the PW package's
  500 mA RMS per-bridge rating; sense resistors at 20 % of their 1206 rating; F2 at
  22 % margin on hot I_hold. *Evidence: K4, K20, K22.*

**`hasLiIon` stays `false` by decision, not by omission** — the battery conditional
**audit** was run (Pass 8) and its evidence is in §5 and RK2/RK3; the *flag* would
materialise a "pack thermal/mechanical containment / cell placement / venting" row
with no referent on a board that has no cell. See the header.

> These are *attestations* (a human checked), except BOM availability (live DigiKey)
> and DRU presence, which are verifiable.

> **Pedagogy framing (guide-authoring decision, recorded):** the board carries two
> lessons and they must not compete. **Foreground the current-limit story** — one
> resistor value is the whole power contract, and it is what lets a battery module
> survive two stalled motors; frame the OR diodes, crowbar, TVS and PTC as "guard
> rails". The **latency** axis is the *second* half of the lesson and is best taught
> against the timing table in §3: the H-bridge costs ~1.5 µs, so everything the
> learner measures is radio and software. The fine-pitch soldering step (RK17) needs
> its own section before either.

## 8 · BOM sourcing & freeze

**Live DigiKey screen — 2026-07-30 (every line Active and in stock).**

| Ref(s) | (manufacturer, mpn) | Pkg | DK stock | $ ea | Lifecycle | In library? |
| --- | --- | --- | ---: | ---: | --- | --- |
| U1 | Espressif Systems, ESP32-S3-WROOM-1-N16R2 | module | 8,237 | 6.32 | Active | ✅ |
| U2 | Richtek, RT9080-33GJ5 | TSOT-23-5 | 94,938 | 0.28 | Active | ✅ |
| **U3** | **Texas Instruments, DRV8833PWR** | **TSSOP-16** | **12,895** | **2.71** | Active | **NEW** |
| J1 | GCT, USB4110-GF-A | USB-C R/A | 183,944 | 1.27 | Active | ✅ |
| J2, J3 | Sullins Connector Solutions, PRPC040SAAN-RC | THT 1×40 breakaway | 52,246 | 1.23 | Active | ✅ |
| J4, J5, J6 | TE Connectivity, 282837-2 | 5.08 mm THT | 157,813 | 0.95 | Active | ✅ |
| D1 | STMicroelectronics, USBLC6-2SC6 | SOT-23-6 | 79,125 | 0.57 | Active | ✅ |
| D2, D3, D4 | Vishay General Semiconductor, SS34-E3/57T | SMC (DO-214AB) | 15,139 | 1.02 | Active | ✅ |
| D5 | Littelfuse, SMAJ6.0A | SMA (DO-214AC) | 59,278 | 0.47 | Active | ✅ |
| F1 | Littelfuse, 1206L050YR | 1206 | 19,788 | 0.64 | Active | ✅ |
| F2 | Littelfuse, miniSMDC150F-2 | 1812 | 8,408 | 0.61 | Active | ✅ |
| SW1, SW2 | Omron, B3F-1000 | THT tactile | 40,087 | 0.35 | Active | ✅ |
| SW3 | E-Switch, EG1218 | SPDT slide THT | 28,829 | 0.72 | Active | ✅ |
| LED1 | Würth Elektronik, 150080RS75000 | 0805 red | 84,821 | 0.19 | Active | ✅ |
| LED2 | Würth Elektronik, 150080YS75000 | 0805 yellow | 47,851 | 0.19 | Active | ✅ |
| **LED3** | **Würth Elektronik, 150080GS75000** | 0805 green | **117,057** | **0.19** | Active | **NEW** |
| **R1–R4** | **Yageo, RC1206FR-071R2L** | 1206 1.2 Ω 1 % | **156,783** | **0.15** | Active | **NEW** |
| R5, R6 | Yageo, RC0805FR-075K1L | 0805 5.1 kΩ | 213,955 | 0.10 | Active | ✅ |
| R7, R9–R11 | Yageo, RC0805FR-07470RL | 0805 470 Ω | 146,292 | 0.10 | Active | ✅ |
| **R8, R19, R20** | **Yageo, RC0805FR-07100KL** | 0805 100 kΩ | **598,184** | **0.10** | Active | **NEW** |
| R12–R18 | Yageo, RC0805FR-0710KL | 0805 10 kΩ | 3,149,543 | 0.10 | Active | ✅ |
| C1, C7, C8 | KEMET, C0805C106K3PACTU | 0805 10 µF 25 V X5R | 126,056 | 0.29 | Active | ✅ |
| C2–C4, C9, C13, C14 | Samsung Electro-Mechanics, CL21B104KBCNNNC | 0805 100 nF | 6,948,631 | 0.10 | Active | ✅ |
| C5, C6 | Würth Elektronik, 885012207103 | 0805 1 µF 50 V | 10,151 | 0.31 | Active | ✅ |
| **C10** | **Samsung Electro-Mechanics, CL21B225KOFNNNE** | 0805 2.2 µF 16 V X7R | **115,668** | **0.15** | Active | **NEW** |
| **C11** | **Samsung Electro-Mechanics, CL21B103KBCNNNC** | 0805 10 nF 50 V X7R | **174,996** | **0.10** | Active | **NEW** |
| C12 | Panasonic, EEU-FM1C102 | radial THT 1000 µF 16 V | 2,251 | 1.14 | Active | ✅ |
| TP1, TP3 | Keystone Electronics, 5010 | THT loop, red | 238,586 | 0.30 | Active | ✅ |
| TP2, TP5 | Keystone Electronics, 5011 | THT loop, black | 289,335 | 0.27 | Active | ✅ |
| **TP4** | **Keystone Electronics, 5012** | THT loop, white | **107,824** | **0.10** | Active | **NEW** |

**Sourcing findings from this run (both are live problems in sibling designs):**

- **`Samsung Electro-Mechanics CL21A106KOQNNNE`** — the 10 µF / 16 V X5R 0805 that
  **L2.01's design.md §8 specifies for C4/C5/C6** — screens at **stock 0**. So do the
  obvious alternates `CL21A106KAYNNNE` (0) and `GRM21BR61E106KA73L` (0). L2.03 avoids
  it entirely by using the **already-in-library KEMET C0805C106K3PACTU (10 µF / 25 V
  X5R, 126 k in stock)**, which is *also* the electrically better part here because a
  25 V dielectric loses far less capacitance at 5 V DC bias (B1). **Cross-board note
  for L2.01.**
- **`Samsung Electro-Mechanics CL21B225KAFNNNE`** — the obvious 2.2 µF 0805 for VINT —
  is **"Not For New Designs"** despite 523 k of stock; `GRM21BR71E225KA73L` is
  Obsolete with 0 stock. Chose **CL21B225KOFNNNE** (Active, 115 k).

**Line count:** **30 BOM lines, 61 placements.** **7 lines are new parts** (U3, LED3,
R1–R4, R8/R19/R20, C10, C11, TP4); the other **23 strict-match `(manufacturer, mpn)`
strings already in the library**.

- **Design-to-cost:** **≈ $30.15 at DigiKey qty-1** (L1.01 core ≈ **$15.00** incl. both
  breakout headers; motor subsystem ≈ **$15.15**, of which U3 is $2.71, three screw
  terminals $2.85 and three SMC Schottkys $3.06). Higher than L1.04's $15–17 because this is a full
  ESP32 board *plus* a driver *plus* three terminals; appropriate for an L2 PREMIUM
  lesson. The SS34's over-rating is deliberate, not waste: its datasheet-max V_F is
  what makes the LDO-headroom proof (K9) rigorous.
- **Second sources:** F2 → **Bel Fuse 0ZCG0150FF2C** (1.5 A, Active, 6,786, $0.26);
  R1–R4 → **Vishay CRCW12061R20FKEA** (Active, 14,394, $0.13); D2–D4 → any 40 V/3 A
  SMC Schottky (SS34 is multi-sourced; the generic `SS34` line screens Active with
  71,732); D5 → STMicro/onsemi SMAJ6.0A equivalents; D1 → **UMW USBLC6-2SC6** (L1.02's
  noted second source); core per L1.01. **U3 has no drop-in second source — RK16.**
- **Not on the BOM, by design:** the **motors** (a kit/consumable, exactly as L1.04
  does not BOM its servo), the **L2.01 battery module**, and the **1S cell**.
- **BOM frozen:** **not yet.** `bomFrozenAt` stays **null**. Parts have **not** been
  created and no revision exists — the design has passed the `[D]` gate only, and the
  owner's stock-verify plus attestation come first. RK8/RK10/RK15 close at `[L]`,
  RK9 at `[S]`.
