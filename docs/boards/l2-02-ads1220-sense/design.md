# ADS1220 Precision Sense (L2.02) — design doc

> Board design doc for the **SENSE-track L2** board. Built on the **L1.01
> ESP32-S3-WROOM core** (USB-C power + native-USB front end reused verbatim), it
> adds a **24-bit ADS1220 SPI ΔΣ ADC** with its own **quiet analog supply**, a
> **ratiometric, Kelvin-sensed reference**, an **on-board precision bridge** and a
> **known 824 µV step**, so a learner can resolve **sub-microvolt** signals and
> then discover that the *layout and the source*, not the converter, are what
> limit the measurement. Draft → validate (lock the math + parts) → source/freeze
> the BOM → only then author the guide.

> ⛔ **NOT part-ready** until the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`) passes: ≥ 10 recursive audit passes, a `[D]` dry pass, every
> applicable audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION`
> ticks are honest human attestations. **Do not create parts, import a BOM, or
> advance the revision until this passes.**

| | |
| --- | --- |
| **Slug** | `l2-02-ads1220-sense` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **validated to DRY**, not frozen, **parts not yet created**) |
| **Track / Level** | SENSE / L2 (critical path) |
| **Teaches** | **Precision SPI-ADC layout** — a 24-bit ΔΣ ADC only delivers its **0.41 µV<sub>pp</sub>** noise floor if you give it (a) a **differential** signal with a legal common mode, (b) a **ratiometric, Kelvin-sensed** reference, (c) a **quiet, separately-regulated analog supply**, and (d) an **analog ground you route by placement on a solid plane** — not by splitting one. Core takeaway: **at 24 bits the converter stops being the limit** |
| **Validation** | **`DRY ✓` — 14 passes, design-stage part-ready** (`[S]`/`[L]` audits owed at their stages) — see `validation-log.md` |
| **DAG role** | `FOUNDATION` on `l1-01-wroom-breakout`; **`DE_RISK` for `l3-de-ads1292r`** → `l3-01-eeg-front-end`. This board is the first rung of the locked biopotential chain **ADS1220 → ADS1292R → ADS1299**, so what must transfer is *differential-front-end discipline*, not a parts list |

**Project flags (live PROD/local DB, read 2026-07-30):** `hasMainsNet=false`,
`hasLiIon=false`, `hasThermalConcern=false`, `requiresStripboard=false` — **all four
verified correct for this design and none needs changing** (§5 proves the largest new
dissipator is 26 mW). **One conditional audit nevertheless fires: RF / regulatory.**
The protocol fires that conditional "on the board's nature", and there is no DB flag
for it: this board puts a **+20 dBm 2.4 GHz radiator a few tens of millimetres from a
0.41 µV<sub>pp</sub> front end**. It is run as Pass 10 and is the most load-bearing
conditional on the board. Two further up-front concerns are pushed into the physics +
FMEA passes: (a) **thermal EMF** — at this resolution every dissimilar-metal junction
is a thermocouple; (b) **source-limited stability** — the on-board bridge drifts far
faster than the ADC's noise floor, which reframes the whole teaching arc (§6 RK5).

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 board carrying a 24-bit precision ΔΣ ADC.** It is
  the **L1.01 WROOM breakout reused whole** — USB-C sink + native USB flash/console,
  RT9080 3V3 LDO, EN/BOOT buttons, indicator LEDs, full GPIO breakout — **plus** a
  complete precision analog instrument: a **TI ADS1220** (24-bit, PGA 1–128, 2 kSPS,
  SPI), its **own low-noise 3.3 V analog rail** from an LP5907 fed straight off VBUS,
  an **on-board 4 × 1 kΩ precision bridge** that supplies a legal common mode and a
  realistic source impedance, a **push-button 824 µV step standard**, a **ratiometric
  reference Kelvin-sensed at the excitation nodes**, matched **anti-alias / EMI
  filters** on every input pair, and a **1×4 header** for a real 4-wire load cell or
  other differential sensor.

  The lesson is **not** "call `readADC()`". It is: *the ADS1220 will hand you a
  **0.41 µV<sub>pp</sub>** noise floor at gain 128 / 20 SPS — and then everything else
  you built takes it away from you.* Feed it single-ended on a unipolar rail and the
  PGA must be bypassed, capping gain at 4 (K9). Return the Wi-Fi radio's 500 mA
  through the analog copper and you inject 950 nV of error — 2.3× the noise floor
  (K34). Put a garden-variety TVS on the input and its 5 µA leakage becomes 5 mV of
  offset (K36). Trust the on-board bridge as a *standard* and its resistor tempco
  mismatch walks 82.5 µV per °C (K15).

- **The single coherent takeaway (L2 altitude):** **at 24 bits the converter stops
  being the limit.** Reference, supply, ground, source and even the solder joints
  become first-class circuit elements. L1.05 taught *resolution ≠ accuracy* with an
  ADC that was the bottleneck; L2.02 hands the learner an ADC that is **not** the
  bottleneck and makes them find the one that is.

- **Functional requirements (testable):**
  - **F1** — Run the full **L1.01 WROOM core** from one USB-C cable (power + native
    USB flash/console). *Inherited verbatim from L1.01 — same parts, same nets.*
  - **F2** — Carry an **ADS1220 in the PW (TSSOP-16) package**, powered from a
    **separate low-noise 3.3 V analog rail (AVDD)** and the shared 3V3 digital rail
    (DVDD), and talk to it over **SPI mode 1** at **≤ 4 MHz** with a dedicated
    **DRDY** interrupt. *Test: read back all four configuration registers (RREG) and
    match what was written (§9.1.6).*
  - **F3** — Resolve **sub-microvolt** signals: with the inputs internally shorted to
    mid-supply (`MUX[3:0] = 1110b`) at **gain 128, DR = 20 SPS**, the measured
    peak-to-peak spread must be **≤ ~1 µV** (datasheet Table 7-1 gives 0.41 µV<sub>pp</sub>).
    *This — not the bridge — is the board's µV proof (RK5).*
  - **F4** — Present a **differential source with a legal PGA common mode**: an
    on-board **4 × 1 kΩ 0.1 % thin-film bridge** across the excitation rails, wiper
    nodes at **V<sub>CM</sub> = AVDD/2 = 1.65 V**, dead centre of the **0.825–2.678 V**
    window (K8).
  - **F5** — Inject a **known, computable step**: a button (SW3) shunts a **1 MΩ 0.1 %**
    resistor across one bridge leg, producing **−824.3 µV ± 1.3 µV** (K16). *Test: the
    measured step matches the computed one to within the resistors' tolerance — and the
    learner discovers the **standard** is 3× coarser than the ADC's resolution.*
  - **F6** — Offer **three reference sources selectable in firmware with zero switching
    hardware** (the chip's own `VREF[1:0]` MUX): **internal 2.048 V**, **external
    REFP0/REFN0** (= the excitation, Kelvin-sensed → **ratiometric**), and
    **AVDD−AVSS** (the naive one). *Test: excitation drift changes the reading in
    internal-reference mode and does not in ratiometric mode.*
  - **F7** — Accept an **external differential sensor** (4-wire load cell, strain
    bridge, thermocouple) on a **1×4 header** (EXC+ / IN+ / IN− / EXC−) on **AIN2/AIN3**,
    with series limiting, a matched RC filter, and a **DC bias path for a floating
    source** that doubles as **open-sensor detection** (K23).
  - **F8** — **Sequence the analog rail after the digital rail** in hardware: AVDD's
    LDO enable is driven by an ESP32 GPIO and defaults **off** (K32). *Test: AVDD reads
    0 V at TP3 before firmware asserts it.*
  - **F9** — Break out **TP3 (AVDD)** and **TP4 (AGND)** so the analog rail and the
    analog-to-digital ground offset are directly measurable — the instrument for the
    layout lesson.

- **Electrical / signal budget:**
  - **E1** — **Two independent 3.3 V rails, both fed from USB VBUS.** *Digital:* VBUS →
    F1 PTC → D1 ESD → **U2 RT9080-33GJ5** → 3V3 → WROOM + (via R7) ADS1220 **DVDD**.
    *Analog:* VBUS → **U4 LP5907MFX-3.3** → **AVDD** → ADS1220 AVDD + the bridge
    excitation. The ADS1220 explicitly permits independent analog and digital supplies
    (datasheet §9.3); DVDD alone sets the digital I/O levels.
  - **E2** — Analog signal: **differential, ±22.66 mV usable at gain 128** (K7 — the
    PGA output-swing limit, *not* the ±25.8 mV nominal FSR), at
    **V<sub>CM</sub> = 1.65 V**. Noise floor **0.09 µV<sub>RMS</sub> / 0.41 µV<sub>pp</sub>**
    at 20 SPS (K10).
  - **E3** — Analog current: on-board bridge **3.3 mA** + a 350 Ω external cell
    **9.4 mA** + I<sub>AVDD</sub> **0.58 mA** = **13.3 mA** worst case, against the
    LP5907's 250 mA (19× headroom, K29).
  - **E4** — Digital current on the ADS1220: **I<sub>DVDD</sub> ≤ 110 µA** (normal
    mode, max) — negligible against the RT9080's 600 mA; the L1.01 rail budget is
    unchanged.

- **Interfaces:**
  - **I1** — USB-C (sink, 5.1 kΩ Rd ×2), native USB Serial/JTAG — *L1.01, verbatim.*
  - **I2** — **SPI to the ADS1220** on the ESP32-S3's native **FSPI IO_MUX** pins
    (intended SCLK=GPIO12, DIN=GPIO11, DOUT=GPIO13, CS=GPIO10, DRDY=GPIO14,
    AVDD_EN=GPIO4), each of the five SPI/DRDY lines through a **47 Ω** series resistor
    per the datasheet's own §9.1.1. *Final pin assignment verified at `[S]` (RK12).*
  - **I3** — **Sensor header `J4`**: 1×4 0.1″, order **EXC+ / IN+ / IN− / EXC−**
    (matching a 4-wire load cell's red / green / white / black convention).
  - **I4** — 2× GPIO breakout headers (incl. 5 V/3V3/GND) — *L1.01.*
  - **I5** — **TP1** 3V3, **TP2** GND (L1.01) + **TP3** AVDD, **TP4** AGND (new).

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, no stripboard.** All four
    project flags **false** and all four verified against this design (§5): the largest
    *new* dissipator is the LP5907 at **26 mW** worst case (ΔT = 5 °C), and the largest
    dissipator on the board is still L1.01's RT9080. `hasThermalConcern=false` holds.
  - **RF / regulatory (conditional — FIRES, no DB flag exists):** the WROOM-1 is a
    pre-certified module, so no board-level radiator cert is needed *provided the
    antenna keep-out is honoured* — but this board additionally has to keep a +20 dBm
    2.4 GHz source from corrupting a sub-microvolt front end. See §3 K18/K35, §6 RK9,
    and `validation-log.md` Pass 10. **Acceptance is empirical at bring-up**, not
    provable at design stage.
  - **Solderability (the L2 envelope, first-class):** no leadless packages; passives
    ≥ 0805; leaded SMD + THT only. **This makes the ADS1220's PW (TSSOP-16) package
    mandatory and the RVA (VQFN-16) package forbidden** — and it is a real win, not a
    compromise: the PW variant has **no thermal pad at all** (datasheet Table 5-1), so
    there is no hidden joint under the body. The 0.65 mm gull-wing pitch is the hardest
    joint on the board — harder than L1.01's USB-C — and is drag-solderable and
    visually inspectable. Every other new part is SOT-23-5 or 0805.
  - **Thermal EMF (flagged for physics/FMEA):** at 0.41 µV<sub>pp</sub>, each
    dissimilar-metal junction in the signal path is a thermocouple. This is why the
    signal-path resistors are **thin film** (Vishay specifies thin-film chip resistors
    at **< 0.1 µV/°C** thermal EMF; thick-film datasheets do not specify it at all) and
    why thermal *symmetry* across the differential pair is an `[L]` design rule
    (§6 RK6) — the ADS1220's own §9.4.1 asks for the same discipline.
  - **Antenna keep-out (M1):** inherited from the WROOM core — module on a board edge,
    no copper/parts under the PCB antenna **on any of the four layers** (closes at
    layout, RK13).
  - **Stackup (M5) — 4-layer**, inherited from L1.01: `F.Cu` (signal) · **`In1.Cu`
    (GND)** · **`In2.Cu` (GND)** · `B.Cu` (signal). **The ground plane is solid and is
    NOT split.** That is the ADS1220 datasheet's explicit instruction (§9.4.1: "The use
    of split analog and digital ground planes is not necessary… the use of a solid
    ground plane or ground fill… is essential for optimum performance"), and it
    contradicts the folk rule this board exists to correct. Analog and digital are
    partitioned **by placement and by where the return currents flow**, not by a moat.
  - **Mechanical (M6, `[L]`):** target outline **~50 × 90 mm**, 4-layer. **Placement
    rule, not coordinates:** the WROOM antenna overhangs one short edge; the **analog
    island** (U3, U4, the bridge, all filters, J4, TP3/TP4) sits at the **diagonally
    opposite corner**, target module-to-ADC centre distance **≥ 60 mm**; J4 on the
    analog end edge. Geometry is fixed at `[L]`, as L1.01's was.

## 2 · Topology

The L1.01 core is unchanged. Everything below the dashed line is new: a separately
regulated, separately returned analog island.

```
  ── L1.01 CORE (unchanged) ────────────────────────────────────────────────────
   USB-C(sink) → F1 PTC(0.5A) → D1 USBLC6 ESD → VBUS ──┬─► U2 RT9080 → 3V3 ──► U1 ESP32-S3-WROOM-1
                                                        │                        │ D+/D- native USB
                                                        │                        │ EN/BOOT, LEDs
                                                        │                        └─ GPIO ─► J2/J3
                                                        │                                     │
  ═══════════════════════════════════════════════════════│═════════════════════════════════════│═══
  ── ANALOG ISLAND (new) ────────────────────────────────│─────────────────────────────────────│───
                                                          │                    3V3 ─[R7 10Ω]─┐  │ SPI
   VBUS ─► U4 LP5907MFX-3.3  ──────► AVDD (quiet 3.3V)    │                    C11 1µF ┐     │  │ +DRDY
          C8 1µF │ C9 1µF + C10 100nF                     │                    C12 100nF     │  │
                 │  EN ◄──────────────────────────────────┴── GPIO4 (AVDD_EN, default OFF)   │  │
                 │                                                                   DVDD◄───┘  │
        EXC+ ────┴──┬───────────┬───────────────► J4.1                                          │
                    │           │                                    ┌───────────────┐          │
              R13 1k│     R15 1k│                        REFP0 ◄R20──┤               │          │
                    ├─ BR_A     ├─ BR_B                  REFN0 ◄R21──┤   U3          │  47Ω×5   │
              R14 1k│     R16 1k│                          (Kelvin)  │   ADS1220     ├──[R8..R12]┘
                    │           ├──[R17 1M]──[SW3]                   │   PW TSSOP-16 │  SCLK CS DIN
        EXC− ────┬──┴───────────┴──────────► J4.4        AIN0 ◄R18───┤   PGA 1..128  │  DOUT DRDY
                 │      (824 µV step)                    AIN1 ◄R19───┤   24-bit ΔΣ   │
                AGND                                                 │               │
                                            J4.2 ─R22──► AIN2 ───────┤  CLK ─► DGND  │
        R24 1M: J4.2→AVDD                   J4.3 ─R23──► AIN3 ───────┤  AVSS  DGND   │
        R25 1M: J4.3→AGND  (floating-source bias                     └───┬───────┬───┘
                            + open-sensor detect)                      AGND    DGND
   Matched RC on all three pairs:  R=1k 0.1% · C_DIF=10nF C0G · C_CM=1nF C0G ×2
   ── ONE SOLID GROUND PLANE.  Analog/digital partitioned by PLACEMENT, never by a split ──
```

**Sub-circuits the schematic is organised into:**
1. **(L1.01 core, reused whole)** USB-C input + CC sink, protection (PTC + USBLC6 ESD),
   3V3 digital power (RT9080 + decoupling), the S3-WROOM-1 module with EN/BOOT strap +
   button RCs, indicators, GPIO breakout + test points.
2. **Analog supply** — U4 LP5907MFX-3.3 from VBUS; C8 (in), C9 + C10 (out); **EN driven
   by GPIO4**, default off via the LP5907's internal 1 MΩ pulldown. TP3 (AVDD), TP4 (AGND).
3. **Digital-supply filter for the ADC** — R7 (10 Ω) from 3V3 to DVDD, with C11 (1 µF)
   + C12 (100 nF) local. *A ferrite was considered and rejected (K24).*
4. **Excitation + on-board bridge** — EXC+ from AVDD, EXC− to AGND; R13/R14 (arm A →
   node BR_A) and R15/R16 (arm B → node BR_B), all 1 kΩ 0.1 % 25 ppm/°C thin film.
5. **Known-step standard** — R17 (1 MΩ 0.1 %) + SW3 shunting R16: **−824.3 µV**.
6. **Signal RC filter (bridge pair)** — R18/R19 (1 kΩ) into AIN0/AIN1; C13 (10 nF C0G)
   differential at the pins; C14/C15 (1 nF C0G) common-mode.
7. **Reference RC filter (deliberately identical to §6)** — R20/R21 (1 kΩ) from the
   EXC+/EXC− **sense** nodes into REFP0/REFN0; C16 (10 nF C0G) differential; C17/C18
   (1 nF C0G) common-mode. Matching the two networks is what keeps ratiometric
   cancellation valid across frequency (K21).
8. **Aux sensor channel** — J4 (1×4) → R22/R23 (1 kΩ) into AIN2/AIN3; C19 (10 nF C0G)
   differential; C20/C21 (1 nF C0G) common-mode; R24 (1 MΩ, J4.2→AVDD) and R25 (1 MΩ,
   J4.3→AGND) bias a floating source and give open-sensor detection.
9. **Digital interface** — R8–R12 (47 Ω each) on SCLK, CS, DIN, DOUT/DRDY and DRDY,
   per datasheet §9.1.1; **CLK tied directly to DGND** (internal oscillator, §8.3.4).

**Theory of operation.** USB powers and programs the WROOM core exactly as L1.01, and
brings up the 3V3 digital rail. The ADS1220's **DVDD** comes from that rail through a
10 Ω/1 µF low-pass so the converter's own digital switching current stays local and the
ESP32's rail activity does not walk into it. **AVDD is still off** — the LP5907's enable
is held low by its internal 1 MΩ pulldown until firmware drives GPIO4 high. That is not
a convenience: the datasheet (§9.3.1) warns that if AVDD ramps *before* DVDD the
internal low-side switch on AIN3/REFN1 sits in an unknown state and can short that input
to AVSS. Driving EN from a GPIO makes "DVDD first" a hardware guarantee (K32) and hands
firmware a power-cycle recovery path.

Once AVDD is up, it does two jobs: it powers the converter, and it **is the bridge
excitation**. The four 1 kΩ resistors form a balanced bridge whose two wiper nodes sit
at AVDD/2 = 1.65 V — the middle of the PGA's legal common-mode window (K8) — and present
a 500 Ω source per input, the same order as a real load cell. Firmware selects
`AINP = AIN0`, `AINN = AIN1`, **gain 128**, **DR = 20 SPS normal mode**, simultaneous
50/60 Hz rejection, and — critically — the **external reference REFP0/REFN0**, which is
wired to *sense* the excitation at the bridge itself rather than at the regulator. That
makes the measurement **ratiometric**: the output code is the ratio of the bridge output
to the bridge excitation, so excitation drift, LDO tolerance, and the IR drop in the
excitation copper all cancel in the transfer function (K22).

Now the learner runs the three experiments the board exists for.

*One — where is the floor?* Set `MUX[3:0] = 1110b` and the ADS1220 shorts its own PGA
inputs to mid-supply (§9.1.6). At gain 128 / 20 SPS the reading wanders over about
**0.41 µV peak-to-peak** (datasheet Table 7-1), i.e. ~134 LSB of a 3.07 nV LSB (K11).
That is the instrument's true floor, measured with **no external source at all** — which
is the only honest way to measure it.

*Two — how good is your standard?* Press SW3 and the reading steps by **824 µV**, a
number the learner computes from two resistor values before measuring it. It matches —
to about **±1.3 µV**, because that is what ±0.1 % resistors know. The ADC resolved the
step 3× more finely than the standard defines it. *L1.05's lesson, one altitude up: the
converter is no longer the thing you doubt.*

*Three — what actually limits you?* Leave the board alone and watch the bridge reading
for ten minutes. It walks — tens of microvolts — because four discrete thin-film
resistors track each other only to ~50 ppm/°C worst case, which is **±82.5 µV per °C**
of differential drift (K15), two hundred times the noise floor per degree. Then switch
the reference from ratiometric to internal 2.048 V and watch the drift get worse.
Then turn the Wi-Fi radio on and watch the noise band open up — and go read the layout
rules that were followed to keep that from being far worse (K34: a solid plane keeps the
Wi-Fi ground bounce at ~40 nV input-referred; a 0.25 mm return trace would have made it
**950 nV**, 2.3× the entire noise floor).

*The board's payoff:* the learner leaves knowing that a precision front end is a **system
property** — supply, reference, ground, source, package, and even solder joints — which
is exactly the knowledge the ADS1292R and ADS1299 boards downstream will demand.

**Power-up / power-down sequencing.**
- *Plug USB:* VBUS rises → F1/D1 → U2 RT9080 brings up 3V3 → WROOM boots. **AVDD stays
  at 0 V** (U4 EN held low by its 1 MΩ internal pulldown). ADS1220 DVDD is live, AVDD is
  not; all analog inputs sit at 0 V because the bridge is unpowered, so nothing violates
  the AVSS−0.3 … AVDD+0.3 input rule (K36 covers the one case where an *external* sensor
  is attached).
- *Firmware bring-up:* assert GPIO4 → AVDD ramps (t<sub>ON</sub> 80 µs typ / 150 µs max)
  → wait ≥ 50 µs after settling (§9.1.6) → **send RESET (06h)** → write the four config
  registers → **read them back (RREG 23h)** → START/SYNC (08h) → service DRDY.
- *Failure path:* if the read-back mismatches, drive GPIO4 low (the LP5907 actively
  discharges its output through an internal 230 Ω), wait, and retry. This is the
  designed mitigation for the ramp-rate item (K33).
- *Power-down:* POWERDOWN (02h), then GPIO4 low. Analog draw falls to the LP5907's
  ~12 µA quiescent.

**Grounding (`[L]`).** AVSS and DGND are the **same net** (unipolar supply) on **one
solid plane**, joined under the device as the datasheet requires ("Connect analog and
digital ground together as close to the device as possible", §9.3.3). The discipline is
*placement*: the analog island's return currents (13.3 mA DC of excitation, plus the
converter's own µA) must flow within the analog region's copper, and the digital return
currents — above all the WROOM's Wi-Fi TX transient — must have no reason to cross it,
because at high frequency return current follows its own signal trace. K34 puts numbers
on both outcomes.

## 3 · Calc trail (DO — lock the math)

Logic-rail rows (3V3, RT9080, CC, EN/BOOT, LED, USB PTC) are **inherited unchanged from
L1.01** (`../l1-01-wroom-breakout/design.md` §3) and not re-derived here. Everything
below is derived worst case. *(Calc-row IDs are `K1…K37` — a separate namespace from
component refDes like R13/C16 and from risk IDs `RK1…RK14`.)*

**Sources.** ADS1220 figures are from the **TI ADS1220 datasheet SBAS501D (rev. May
2026)**, read directly (not from a summary): §5 pinout, §6.1 abs-max, §6.2 ESD, §6.3
recommended operating conditions, §6.4 thermal, §6.5 electrical characteristics, §6.6/6.7
SPI timing, §6.9 typical characteristics (Figs 6-12…6-37), §7.1 noise, §8.3.2 PGA,
§8.3.3 reference, §8.3.4 clock, §8.3.6 digital filter, §9.1–9.4 application/layout.
LP5907 = **SNVS798Q (rev. July 2025)**. RT9080 = **DS9080-09 (Dec 2024)**. ESP32-S3
logic levels = **ESP32-S3 series datasheet**. Thin-film thermal EMF = **Vishay thin-film
chip-resistor documentation**.

| # | Value | Formula / source | Result | Notes (worst case) |
| --- | --- | --- | --- | --- |
| K1 | Converter | datasheet §1/§6.5: 24-bit ΔΣ, no missing codes; 2 differential / 4 single-ended; PGA 1–128; DR 20/45/90/175/330/600/1000 SPS normal, 40…2000 turbo, 5…250 duty-cycle | **24-bit, gain ≤ 128, DR 20 SPS chosen** | 20 SPS is the only rate (with 5 SPS) that offers the 50/60 Hz notch (§8.3.6) *and* the lowest noise (Table 7-1). Single-cycle settling ⇒ every conversion is fully settled, so channel/gain switching costs one conversion, not five |
| K2 | **Package (the DFM gate)** | datasheet Table 5-1 + Package Information: **RVA = VQFN-16 (leadless, thermal pad)**, **PW = TSSOP-16, 5.0 × 6.4 mm, thermal pad "—"** | **PW mandatory; RVA forbidden** | The L2 envelope bans leadless. PW additionally has **no thermal pad**, so there is no hidden joint. 0.65 mm gull-wing = the hardest joint on the board (harder than L1.01's USB-C), drag-solderable, 100 % visually inspectable (RK10) |
| K3 | Supplies | §6.3: AVDD−AVSS **2.3–5.5 V** unipolar (AVSS−DGND −0.1…+0.1); DVDD−DGND **2.3–5.5 V**; §9.3 "analog … independent of the digital power supply. The digital supply sets the digital I/O levels" | **AVDD = 3.3 V (U4), DVDD = 3.3 V (U2 via R7)** | Two independent rails is not a flourish — it is what lets the analog return be separate while the logic levels still match the ESP32 |
| K4 | Device current | §6.5: I<sub>AVDD</sub> normal mode gain 64/128 = **510 µA typ** (max specified only for gain 1–16: 490 µA); "+70 µA typ when selecting an external reference"; I<sub>DVDD</sub> normal = 75 µA typ / **110 µA max** | **I<sub>AVDD</sub> ≈ 0.58 mA; I<sub>DVDD</sub> ≤ 0.11 mA** | External reference is our normal mode, so the +70 µA adder always applies. Both are noise on the budget vs the bridge (K29) |
| K5 | Reference options | §8.3.3 + §6.3: internal **2.048 V** (initial **2.045/2.048/2.051 V**, drift **5 typ / 30 max ppm/°C**, long-term **110 ppm/1000 h**); REFP0/REFN0 and REFP1/REFN1 (**V<sub>REF</sub> 0.75 min … AVDD−AVSS max**; V<sub>REFPx</sub> ≤ AVDD+0.1, V<sub>REFNx</sub> ≥ AVSS−0.1); or AVDD−AVSS | **3 sources wired, 0 switching parts** | Reference inputs are **internally buffered** (§8.3.3) so they do not load the sense nodes. Board wires REFP0/REFN0 to the excitation **sense** nodes → ratiometric. REFP1/REFN1 are deliberately NOT used (they are AIN0/AIN3 — see K20) |
| K6 | Nominal full scale | §8.3.2 Eq 5: FSR = ±V<sub>REF</sub>/Gain | **±25.8 mV** (V<sub>REF</sub>=3.3 V, G=128); ±16.0 mV on the internal 2.048 V | Table 8-2 gives ±0.016 V at gain 128 on the internal reference — matches |
| K7 | **Usable full scale (the binding limit)** | §6.3 note 2 + §9.2.3 Eq 40: V<sub>IN(MAX)</sub> ≤ ±[(AVDD−AVSS) − 0.4 V]/Gain, because each PGA output must stay 200 mV off both rails (§8.3.2.1 Eq 6) | **±22.66 mV at gain 128** | **12 % *below* the K6 FSR.** Quoting FSR alone would overstate the usable window. This is the number every input budget below is checked against |
| K8 | **Common-mode window** | §8.3.2.1 Eqs 12–14: V<sub>CMMIN</sub> ≥ AVSS + ¼(AVDD−AVSS); V<sub>CMMIN</sub> ≥ AVSS + 0.2 + ½·G·V<sub>INMAX</sub>; V<sub>CMMAX</sub> ≤ AVDD − 0.2 − ½·G·V<sub>INMAX</sub>. With G=128, V<sub>INMAX</sub>=6.6 mV (a 2 mV/V cell at 3.3 V) | **0.825 V … 2.678 V**; board sits at **1.65 V** | The ¼·AVDD floor (0.825 V) binds, not the 0.622 V swing term. A symmetric bridge on the supply lands **dead centre with 825 mV of margin each way** — which is exactly why the source is a bridge and not a divider to ground |
| K9 | **Why the board is differential-only** | §9.1.4: a signal referenced to AVSS on a **unipolar** supply requires `PGA_BYPASS`, and "the PGA is always enabled for gain settings greater than 4"; "If gains larger than 4 are needed to measure a single-ended signal … a bipolar supply is required" | **single-ended ⇒ gain ≤ 4 ⇒ ≥ 3.89 µV<sub>RMS</sub> floor** | Table 7-3 (PGA disabled, 20 SPS, gain 4) gives **1.26 µV<sub>RMS</sub> / 3.91 µV<sub>pp</sub>** — **9.5× worse** than gain 128. A single-ended board cannot make the "microvolt" claim on 3.3 V. **This one datasheet paragraph sets the entire architecture** |
| K10 | **Noise floor** | Table 7-1 (AVDD 3.3 V, normal mode, internal 2.048 V ref, PGA enabled), gain 128 @ 20 SPS | **0.09 µV<sub>RMS</sub> (0.41 µV<sub>pp</sub>)**; 18.49 bits effective / 16.26 noise-free (Table 7-2) | §7.1 states the input-referred noise "only changes marginally" with an external reference, so this holds ratiometrically. Rescaled to V<sub>REF</sub>=3.3 V by Eqs 1–2: **19.13 bits effective / 16.94 noise-free** |
| K11 | LSB size | 2·V<sub>REF</sub>/(Gain·2²⁴) = 2·3.3/(128·16 777 216) | **3.07 nV** | The 0.41 µV<sub>pp</sub> floor is **≈ 134 LSB**. Twenty-four bits buys 3 nV of *resolution* and 410 nV of *reality* |
| K12 | On-board bridge current & dissipation | 4 × 1 kΩ ⇒ two 2 kΩ arms in parallel = 1 kΩ across AVDD; I = 3.3/1000; P per resistor = (1.65 mA)²·1 kΩ | **3.3 mA total; 2.72 mW per resistor** ≪ 125 mW (0805) | Self-heating ≈ 0.7 °C (0805 ≈ 250 °C/W). Feeds straight into K15 — self-heating asymmetry *is* drift |
| K13 | Bridge source impedance | R/2 per node (two 1 kΩ in parallel) | **500 Ω per input; 1 kΩ differential** | Same order as a 350 Ω–1 kΩ load cell, so the noise demo is representative, not optimistic |
| K14 | Bridge initial imbalance | worst case four independent ±0.1 % parts: ΔV ≈ (AVDD/2)·2×10⁻³ | **±3.3 mV** | At gain 128 that drives the PGA outputs to 1.65 ± 0.21 V — inside the 0.2 … 3.1 V limit (K8/§8.3.2.1) with 1.4 V to spare. Removed by an offset calibration (§9.1.6). **It is 145× the usable window fraction you'd guess** — check it, don't assume it |
| K15 | **Bridge tempco mismatch — the real stability limit** | four parts at ±25 ppm/°C (Yageo RT series) ⇒ worst-case tracking mismatch 50 ppm/°C; ΔV/ΔT = (AVDD/2)·50×10⁻⁶ | **±82.5 µV/°C differential** | **201× the 0.41 µV<sub>pp</sub> noise floor per degree.** Discrete resistors, however good, cannot track like a monolithic network. **The source, not the ADC, sets the board's stability** — which is why F3's µV proof is the *shorted-input* measurement, not the bridge (RK5). Teaching this honestly is worth more than hiding it behind a resistor array |
| K16 | **Known step (the standard)** | R17 = 1 MΩ ‖ R16 = 1 kΩ → 999.001 Ω. ΔV = 3.3·[999.001/1999.001 − 1000/2000] | **−824.3 µV**, uncertainty **±1.3 µV** (±0.16 % from two ±0.1 % parts) | The ADC resolves the step to 0.41 µV; the *standard* only defines it to ±1.3 µV — **3× coarser**. SW3's contact resistance (~0.1 Ω) sits in series with 1 MΩ → 0.1 ppm error, irrelevant. Settling after the press: τ = (500+1000)·10.5 nF = **15.8 µs**, ≪ the 50 ms conversion |
| K17 | Anti-alias / EMI filter (identical on all three pairs) | R<sub>F</sub> = 1 kΩ, C<sub>DIF</sub> = 10 nF C0G, C<sub>CM</sub> = 1 nF C0G. f<sub>DIFF</sub> = 1/(2π·2R<sub>F</sub>·(C<sub>DIF</sub>+C<sub>CM</sub>/2)); f<sub>CM</sub> = 1/(2π·R<sub>F</sub>·C<sub>CM</sub>) | **f<sub>DIFF</sub> = 7.58 kHz; f<sub>CM</sub> = 159 kHz; −30.6 dB at f<sub>MOD</sub> 256 kHz** | The differential capacitance is C<sub>DIF</sub> + C<sub>CM</sub>/2 (the two CM caps appear in series across the pair) — ignoring the /2 term understates it by 5 %. C<sub>DIF</sub>:C<sub>CM</sub> = 10:1 per §9.4.1 so CM-cap mismatch converts weakly to differential. **C0G is mandatory** (§9.4.1: "The differential capacitors must be of high quality. The best ceramic chip capacitors are C0G (NP0)") — which caps C<sub>DIF</sub> at what C0G offers in 0805 and is why f<sub>DIFF</sub> is 7.6 kHz rather than TI's "data rate × 10" ideal of 200 Hz (K17a) |
| K17a | Why not the datasheet's 200 Hz corner | §9.1.2 suggests f<sub>c</sub> at the data rate or 10× higher (⇒ 200 Hz). Reaching it needs ~400 nF differential at R<sub>F</sub> = 1 kΩ — **not available in C0G**; X7R is excluded by §9.4.1 | **bounded, accepted, stated** | Raising R<sub>F</sub> instead costs Johnson noise (K19): R<sub>F</sub> = 1.8 kΩ + 22 nF C0G reaches 1.9 kHz for +10 % noise, thinner stock and +$2.20. **Aliasing is a narrow-band threat** — the digital filter attenuates everything between the notches, so only energy within a few Hz of n·f<sub>MOD</sub> folds in, and this board has **no switching regulator** to produce it. −30.6 dB accepted; a lower corner needs film caps or an active filter, both outside the L2 envelope |
| K18 | **2.4 GHz rejection — the ESL correction** | ideal-cap maths says −117 dB at 2.4 GHz. Real 0805 MLCC ESL ≈ 0.9 nH ⇒ \|Z\| = 2π·2.4 GHz·0.9 nH = **13.6 Ω**, so the external RC gives 13.6/(1000+13.6) = **−37.4 dB**. The ADS1220's internal EMI filter (§8.3.2: 200 Ω + 25 pF ⇒ f = 1/(2π·200·25 p) = **31.8 MHz**, matching §9.1.2's stated figure) adds \|Z<sub>C</sub>\| = 2.65 Ω ⇒ **−37.6 dB** | **≈ −75 dB total, not −117 dB** | Above its self-resonance a capacitor is an inductor. Claiming the ideal number would have overstated the rejection by 42 dB. **−75 dB + separation + keep-out is the mitigation stack; acceptance is empirical (K35)** |
| K19 | Johnson noise added by the front end | total series R in the differential loop = 1 kΩ (bridge source, K13) + 2 × 1 kΩ (R18/R19) = 3 kΩ. e<sub>n</sub> = √(4kTR) = 7.05 nV/√Hz; ENBW taken **conservatively as DR = 20 Hz** (a sinc¹'s true ENBW is DR/2 = 10 Hz, so this over-states by √2) | **31.5 nV<sub>RMS</sub>** → total √(90² + 31.5²) = **95.4 nV** (**+6.0 %**) | This is the budget that caps R<sub>F</sub> at ~1 kΩ and hence caps f<sub>DIFF</sub> (K17a). 10 kΩ series resistors would have added 81 nV and **doubled the noise power** |
| K20 | **Input-pair choice (rejecting TI's own example)** | §9.4.1: "Best input combinations for differential measurements are AIN0, AIN1 and AIN2, AIN3." Figs 6-16…6-19: AIN0/AIN1 have the **lowest absolute current (≈ ±4 nA @25 °C)** and the **lowest differential current (≈ 0 nA @25 °C, ≤5 nA @85 °C)**; AIN3 is the worst (−25 nA @85 °C, **−250 nA @125 °C** — the low-side switch). PW pinout: AIN0=11, AIN1=10 (**adjacent**), REFP0=9, REFN0=8 (**adjacent**) | **AIN0/AIN1 = signal; REFP0/REFN0 = reference; AIN2/AIN3 = aux** | TI's bridge example (§9.2.3, reg 00h=3Eh) uses **AIN1/AIN2** because it wants REFP1/REFN1's low-side switch to power-gate the bridge — but AIN1 (pin 10) and AIN2 (pin 7) sit on **opposite sides of the TSSOP**, forcing an asymmetric µV differential route past AVDD. **We trade the bridge power-down feature for the best-matched pair, adjacent-pin routing, and four bridge wires arriving on four adjacent pins (11-10-9-8).** For a board whose subject *is* layout, that is the right trade (RK4) |
| K21 | Reference-path filter, **matched to the signal path** | R20/R21 = 1 kΩ, C16 = 10 nF C0G, C17/C18 = 1 nF C0G — byte-identical to K17. Reference input current **±10 nA** (§6.5) | **10 µV on a 3.3 V reference = 3 ppm; ≤20 µV / 6 ppm if fully mismatched** | §9.2.3 warns "Care must be taken to maintain a limited amount of filtering or the measurement is no longer ratiometric." **Matching the two networks' bandwidths is what makes ratiometric cancellation hold across frequency**, not minimising the reference filter. The 3 ppm offset is a ratio of two matched resistors and largely cancels; the remainder is calibrated out |
| K22 | **Kelvin sense** | REFP0/REFN0 sense at the excitation nodes and carry only ±10 nA, so the excitation IR drop lives *inside* the reference. Board trace: 12.7 mA × ~20 mΩ = **0.25 mV — cancelled**. A 4-wire cell's cable: 0.3 m of 28 AWG (0.2126 Ω/m × 2 = 0.128 Ω) × 9.4 mA = **1.2 mV** | **board drop cancelled; cable drop = 364 ppm gain error, tempco 1.4 ppm/°C** | Copper's +3900 ppm/°C on a 364 ppm term is **1.4 ppm/°C** — below the measurement's ~30 ppm resolution over any plausible room swing. Calibrated out at first use. **6-wire (remote-sense) cabling is the production fix, and this is where the learner meets the reason it exists** |
| K23 | Floating-source bias (aux channel) | R24 = 1 MΩ AIN2→AVDD, R25 = 1 MΩ AIN3→AGND. Source current = AVDD/(2 MΩ + Z<sub>s</sub>); offset = AVDD·Z<sub>s</sub>/2 MΩ | **1.65 µA; 0.58 mV offset for a 350 Ω source; V<sub>CM</sub> = AVDD/2 by symmetry** | A thermocouple has **no DC path** — without this the PGA's common mode drifts out of the K8 window and the channel reads garbage (RK7). Free bonus: with nothing plugged in, AIN2 rails to AVDD and AIN3 to AGND ⇒ **full-scale reading = open-sensor detection**, both within the AVSS−0.1…AVDD+0.1 legal range (§6.3), so nothing is over-driven (§8.3.1). Loading a 350 Ω cell: 1 MΩ ‖ 350 Ω ≈ 350 Ω; the 1 MΩ's own noise is divided by 5700 → 0.02 nV/√Hz |
| K24 | Digital-rail filter — **and why not a ferrite** | R7 = 10 Ω + C11 1 µF ⇒ f<sub>c</sub> = 1/(2π·10·1 µ) = **15.9 kHz**; DC drop at I<sub>DVDD(max)</sub> 110 µA = **1.1 mV**; DOUT sourcing 3 mA for one 250 ns bit droops C11 by I·t/C = **0.75 mV** | **10 Ω chosen; ferrite rejected** | A BLM-class bead (~1 µH low-frequency, DCR 0.38 Ω) with 1 µF resonates at 1/(2π√(LC)) = **159 kHz** with Q = (1/R)√(L/C) ≈ **2.6 → ~8 dB of gain** right where you wanted attenuation. **A resistor cannot peak.** Classic trap, designed out |
| K25 | Logic-level margins (both directions, worst case) | ESP32-S3: V<sub>OH</sub> = 0.8·VDD = **2.64 V**, V<sub>OL</sub> = 0.1·VDD = **0.33 V**, V<sub>IH</sub> = 0.75·VDD = **2.475 V**, V<sub>IL</sub> = 0.25·VDD = **0.825 V**, I<sub>IH/IL</sub> ≤ 50 nA. ADS1220 (§6.5): V<sub>IH</sub> = 0.7·DVDD = **2.31 V**, V<sub>IL</sub> = 0.3·DVDD = **0.99 V**, V<sub>OH</sub> = 0.8·DVDD = **2.64 V** @3 mA, V<sub>OL</sub> = 0.2·DVDD = **0.66 V** @3 mA | **ESP32→ADC: 330 mV / 660 mV. ADC→ESP32: 165 mV / 165 mV** | Worst case includes R7's 1.1 mV DVDD drop (thresholds scale with DVDD) and the 47 Ω drop into a 50 nA input (2.4 µV) — both lost in the rounding. The ADC→ESP32 direction is the tighter one at 165 mV; it is specified at I<sub>OH</sub> = 3 mA while the real load is 50 nA, so the true margin is larger |
| K26 | SPI speed | §6.6: t<sub>c(SC)</sub> min **150 ns** ⇒ f<sub>SCLK(max)</sub> = **6.67 MHz**; t<sub>w(SCH)</sub>/t<sub>w(SCL)</sub> 60 ns; t<sub>su(DI)</sub> 50 ns; t<sub>h(DI)</sub> 25 ns. §6.7: t<sub>pd(SCDO)</sub> ≤ **50 ns**. R8–R12 47 Ω into ~30 pF ⇒ **1.4 ns** | **design limit 4 MHz** (half-period 125 ns) ⇒ **≥ 70 ns margin (2.4×)** on the read path | Mode **1** (CPOL=0, CPHA=1) per §9.1.1. The 47 Ω resistors are TI's own recommendation ("smooths sharp transitions, suppresses overshoot, and offers some overvoltage protection") *with* their own warning that they interact with bus capacitance — hence the explicit budget rather than "it'll be fine" |
| K27 | SPI timeout | §6.6 note: **14000 × t<sub>MOD</sub>** (normal/duty-cycle), f<sub>MOD</sub> = 256 kHz (§8.3.5 Table 8-3) | **54.7 ms** | Only bites if CS is tied low permanently and a transfer stalls. The board uses a real GPIO CS, so it cannot. Captured because a learner who ties CS low will meet it |
| K28 | **50/60 Hz notch vs the internal oscillator** | §6.5 NMRR is specified **with an external CLK**: 105 dB at 50 Hz ±3 % (50/60=10b) or 60 Hz ±3 % (11b), **90 dB for 50 *or* 60 Hz ±3 % (01b, simultaneous)**. Internal oscillator accuracy **±2 %** (§6.5; Fig 6-13 shows +0.25…+0.55 % typical over −40…120 °C). §8.3.6: "the data rate … and filter notches consequently vary by the same amount" | **2 % clock error + ~0.5 % grid deviation = 2.5 % < the ±3 % spec band ⇒ ≥90 dB still guaranteed, margin 0.5 pp** | A clock 2 % fast moves the notch 2 %, which is indistinguishable from a mains tone 2 % off an exact notch — so the ±3 % rejection band absorbs it. **Margin is real but thin (0.5 percentage points).** CLK is therefore tied to DGND (internal oscillator, §8.3.4/§9.1.5) and an **external 4.096 MHz clock is named as the production upgrade** rather than fitted — routing a 4 MHz square wave into the analog island to buy 0.5 pp is a bad trade (RK8) |
| K29 | AVDD power budget & thermal | on-board bridge 3.3 mA (K12) + 350 Ω external cell 3.3/350 = 9.4 mA + I<sub>AVDD</sub> 0.58 mA (K4) = **13.3 mA**; LP5907 rated **250 mA**. P = (V<sub>BUS,max</sub> 5.25 − 3.3) × 13.3 mA; θ<sub>JA</sub>(SOT-23) = **193.4 °C/W** | **19× current headroom; 25.9 mW; ΔT = 5.0 °C ⇒ T<sub>J</sub> ≈ 30 °C @25 °C ambient** | Dropout at 13 mA is far below the 250 mV @250 mA spec, so regulation holds down to V<sub>BUS</sub> ≈ 3.6 V. Under a dead short the LP5907 limits at I<sub>SC</sub> 250–500 mA → ≤ 2.6 W → its own 160 °C thermal shutdown is the backstop. **`hasThermalConcern=false` holds: 26 mW is the largest *new* dissipator on the board** |
| K30 | VBUS budget | L1.01 core (ESP32-S3 Wi-Fi TX peak ~500 mA brief, typ 80–160 mA) + **13.3 mA** analog. F1 PTC = 0.5 A hold / 1 A trip (L1.01 F7, unchanged) | **+13.3 mA on an already-accepted budget** | The LP5907 is fed from **VBUS, not 3V3** — from 3V3 there is no dropout headroom, and feeding it from VBUS is also what keeps the analog return separate from the digital rail's return. It sits downstream of F1 and D1, so it inherits L1.01's over-current and ESD protection |
| K31 | **LP5907 output-capacitance limit** | §5.6: C<sub>OUT</sub> **min 0.7 µF, typ 1 µF, MAX 10 µF**; ESR 5–500 mΩ. Board AVDD net = C9 (1 µF 50 V X7R) + C10 (100 nF) = **1.1 µF nominal** | **within 0.7–10 µF at every corner** | Worst case: −10 % tolerance and X7R's ±15 % at the −55/+125 °C extremes ⇒ 0.9 × 0.85 + 0.085 = **0.85 µF (21 % over the 0.7 µF floor)**; over the real 0–50 °C range ⇒ **0.95 µF (36 % over)**. A 50 V X7R at 3.3 V has negligible DC-bias derating. **The trap is the ceiling, not the floor** — the reflex "add 10 µF of bulk" would put the net at 11.1 µF and break the loop |
| K32 | **Power-supply sequencing — designed out** | §9.3.1: "Ramping DVDD together with or before AVDD minimizes any leakage current through AIN3/REFN1 … If AVDD ramps before DVDD, then the low-side switch is in an unknown state and can short the AIN3/REFN1 input to AVSS until DVDD has ramped." LP5907 EN has an internal **1 MΩ pulldown** (§4 Table 4-2) | **AVDD is OFF at power-up; only firmware (GPIO4) can raise it ⇒ DVDD is always first** | Not a convention — a hardware guarantee. It also gives firmware a **power-cycle recovery path** (drive EN low; the LP5907 actively discharges V<sub>OUT</sub> through an internal 230 Ω), and start-up overshoot drops from 5 % (V<sub>IN</sub>-tracking) to **1 %** (EN-controlled), §5.5 |
| K33 | **Ramp rate — accepted with a proven mitigation** | §9.3.2: the supply ramp "must be monotonic and slower than 1 V per 50 µs" (**20 V/ms**). LP5907 t<sub>ON</sub> = 80 µs typ / 150 µs max to 95 % of 3.3 V ⇒ **≈ 39 V/ms typ**; the RT9080 DVDD rail (VBUS-tracking) is faster still | **not met by any LDO-fed rail; mitigated in firmware** | Slowing AVDD is impractical (13 mA load; C<sub>OUT</sub> is capped at 10 µF by K31). The mitigation is TI's own §9.1.6 sequence, which mandates it **regardless of ramp rate**: wait ≥50 µs after the rails settle → **RESET (06h)** → write config → **read back all registers (RREG 23h)** → on mismatch, cycle AVDD via GPIO4 and retry. **The dangerous half of the sequencing problem (K32) is designed out; this half is detected and recovered** (RK3) |
| K34 | **Ground-return budget — the layout lesson, in volts** | ESP32-S3 Wi-Fi TX peak **500 mA** (L1.01 §1 E2). CMRR at dc, gain 1 = **90 dB min** (§6.5) ⇒ input-referred error = ΔV<sub>ground</sub>/31 623. 1 oz copper = **0.5 mΩ/square** | **solid plane (3–5 squares ⇒ 1.5–2.5 mΩ): 0.75–1.25 mV ⇒ 24–40 nV input-referred — under the 90 nV<sub>RMS</sub> floor ✓** <br> **0.25 mm × 30 mm return trace (120 squares ⇒ 60 mΩ): 30 mV ⇒ 950 nV — 2.3× the 0.41 µV<sub>pp</sub> floor ✗** | **A factor of ~24 between a plane and a trace.** This single row is why the board is 4-layer with a *solid, unsplit* plane (§9.4.1) and why the analog island is placed, not fenced. CMRR is quoted at gain 1 (its specified condition) — the conservative choice |
| K35 | 2.4 GHz coupling — **empirical acceptance** | mitigation stack = K18's **−75 dB** + the antenna keep-out + ≥60 mm separation (§1 M6). No credible closed-form bound exists for near-field coupling into a specific trace geometry | **acceptance test, not a proof:** at gain 128 / 20 SPS, the shorted-input (MUX 1110b) peak-to-peak spread with **Wi-Fi TX forced on** must not exceed the radio-off spread by more than the 0.41 µV<sub>pp</sub> band | **Stated as owed, not closed.** Pretending to an analytic proof here would be the dishonest move; the design captures the constraints and the test, and the test runs at `[L]`/BRINGUP (RK9) |
| K36 | Analog-input fault & **why there is no TVS** | §6.1: analog input abs-max AVSS−0.3 … AVDD+0.3; **input current, continuous, any pin except supplies: ±10 mA**. R22/R23 = 1 kΩ. A CDSOD323-T05C (the part L1.03/L1.05 use) leaks **≤ 5 µA at its 5 V spec point** | **1 kΩ limits a 5.25 V short to 1.85 mA and a 10 V injection to 6.6 mA — both under ±10 mA ✓. TVS deliberately OMITTED: 5 µA × 1 kΩ = 5 mV of offset = 12 000× the noise floor** | With AVDD off (K32) and 3.3 V applied externally, the internal ESD diode conducts (3.3−0.7)/1 kΩ = **2.6 mA ✓**, back-feeding AVDD through the LP5907's 230 Ω discharge pulldown to **0.6 V** — harmless. **A protection part that ruins the measurement is not protection.** Silk: "J4 0–3.3 V differential only" (RK7) |
| K37 | Board-level ESD | §6.2: HBM **±2000 V**, CDM ±500 V. HBM model = 100 pF / 1.5 kΩ; adding 1 kΩ in series raises the effective pin rating by (1.5 k + 1 k)/1.5 k | **≈ 1.7× ⇒ ~3.4 kV HBM-equivalent at the J4 pins** | The residual mitigation is **handling discipline** (the guide teaches it), not a component. This is normal practice for precision instrumentation inputs and is stated as such rather than papered over |

**The precision argument (the core teaching numbers), worst case:**
- **What the converter gives you:** 24 bits, a **3.07 nV LSB** (K11), and a measured
  **0.41 µV<sub>pp</sub>** floor at gain 128 / 20 SPS (K10) — **16.94 noise-free bits**
  ratiometrically. The converter is not the problem.
- **What the architecture can take away:** feed it single-ended on 3.3 V and the PGA
  must be bypassed, capping gain at 4 and the floor at **3.91 µV<sub>pp</sub>** — 9.5×
  worse (K9). Miss the PGA output-swing rule and you overstate your usable range by
  12 % (K7). Put the common mode outside 0.825–2.678 V and the amplifiers saturate (K8).
- **What the layout can take away:** return the Wi-Fi radio's 500 mA through a thin
  analog ground and you inject **950 nV** — 2.3× the whole noise floor (K34). Trust an
  ideal-capacitor calculation at 2.4 GHz and you overstate your RF rejection by **42 dB**
  (K18). Reach for a ferrite instead of a resistor and you build an 8 dB *gain* at
  159 kHz (K24).
- **What the parts can take away:** a 5 µA TVS leak becomes **5 mV** of offset (K36).
  Four ±25 ppm/°C resistors that don't track become **±82.5 µV/°C** (K15). Your ±0.1 %
  step standard is only known to **±1.3 µV** while the ADC resolves 0.41 µV (K16).
- **The one rule that bites silently:** **ratiometric beats accurate.** Sense the
  reference where the excitation actually lands (K22) and the LDO's tolerance, its drift,
  and the IR drop in your own copper all cancel. Reach for a "better reference chip"
  instead and you have solved the wrong problem (§4, and RK14).

## 4 · IC / active-part selection (DO — lock the parts)

Core actives (U1 ESP32-S3-WROOM-1-N16R2, U2 RT9080-33GJ5, D1 USBLC6-2SC6, J1
USB4110-GF-A, F1 1206L050YR) are **inherited unchanged from L1.01** and already
datasheet-verified in that board's run. New actives:

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U3 | **Texas Instruments ADS1220IPWR** (TSSOP-16, PW) | The board's subject. 24-bit ΔΣ, chopper-stabilised PGA **1–128**, 2 differential / 4 single-ended inputs, internal 2.048 V reference **and** two external reference pairs (so three reference sources are firmware-selectable with **zero switching hardware**, F6), internal oscillator, **single-cycle-settling** FIR filter with 50/60 Hz notches, SPI mode 1, and **0.09 µV<sub>RMS</sub> / 0.41 µV<sub>pp</sub>** at gain 128 / 20 SPS. **The PW package is the design gate:** TSSOP-16 is leaded gull-wing with **no thermal pad** (Table 5-1), so it is inside the L2 hand-solder envelope; the RVA VQFN-16 is leadless and is **forbidden** (K2). 2.3–5.5 V supplies, independent analog/digital (K3) | §5 pinout + Table 5-1 pin functions; §6.1 abs-max; §6.2 ESD; §6.3 recommended operating; §6.4 thermal; §6.5 full EC table; §6.6/6.7 SPI timing; §6.9 Figs 6-12…6-37 (reference drift, oscillator accuracy, PSRR, input current vs temperature, low-side switch R<sub>ON</sub>); §7.1 + Tables 7-1…7-8 noise; §8.3.1 MUX + ESD structure; §8.3.2 PGA incl. common-mode Eqs 6–14 and PGA-bypass rules; §8.3.3 reference; §8.3.4 clock; §8.3.5 modulator; §8.3.6 digital filter; §9.1.1–9.1.6 application; §9.2.3 bridge worked example; §9.3 power supply; §9.4 layout |
| U4 | **Texas Instruments LP5907MFX-3.3/NOPB** (SOT-23-5, DBV) | The quiet analog rail. **6.5 µV<sub>RMS</sub>** output noise (10 Hz–100 kHz) and **82 dB PSRR at 1 kHz**, against the RT9080's **42 µV<sub>RMS</sub> / 75 dB** — a **6.5×** noise improvement on the node that *is* the bridge excitation. 250 mA (19× our 13.3 mA), 2.2–5.5 V in (VBUS ✓), stable on 1 µF with **no noise-bypass cap**, ±2 % accuracy, 12 µA I<sub>Q</sub>. Decisively: **EN has an internal 1 MΩ pulldown**, so the analog rail defaults **off** and the ADS1220's DVDD-before-AVDD rule becomes a hardware guarantee (K32). SOT-23-5, hand-solderable | §1 features; §4 Table 4-2 pin functions (SOT-23 pinout, EN pulldown, 230 Ω discharge); §5.1 abs-max (V<sub>IN</sub> 6 V); §5.3 recommended operating; §5.4 thermal (θ<sub>JA</sub> 193.4 °C/W); §5.5 EC (noise, PSRR, dropout, I<sub>Q</sub>, t<sub>ON</sub>, overshoot, I<sub>SC</sub>, thermal shutdown); **§5.6 output/input capacitors (the 10 µF ceiling, K31)** |

**Two decisions recorded here because their *absence* is a design choice, not an oversight:**

> **No external precision voltage reference IC is fitted — deliberately.** The board's
> subject line says "low-noise voltage reference", and the reflex is to buy one. Three
> facts say otherwise. **(1)** For a bridge, **ratiometric referencing strictly beats any
> reference**: excitation drift, reference drift and reference noise all cancel in the
> transfer function (K22), so bolting a 3 ppm/°C part onto a ratiometric measurement buys
> nothing. **(2)** The ADS1220's *internal* reference is already **30 ppm/°C max** with
> ±0.15 % initial accuracy (K5) — better than the hand-solderable cheap references
> (REF3025 ≈ 50 ppm/°C, LM4040 ≈ 100 ppm/°C), so a budget external reference would be a
> **downgrade** that teaches the wrong lesson. **(3)** A *good* one (REF5025A, 3 ppm/°C)
> costs more than the ADC and cannot be wired without moving the reference to
> REFP1/REFN1 — which are AIN0 and AIN3 — forcing the signal onto the split, worse-matched
> AIN1/AIN2 pair (K20). **We would pay $9 to make the measurement worse.** What the board
> teaches instead is the *discipline*: ratiometric referencing, **Kelvin sensing at the
> excitation** (K22), a **reference filter matched to the signal filter** (K21), a quiet
> analog rail (U4), and the internal reference kept as the **measured** contrast. That
> discipline is what transfers to the ADS1292R/ADS1299 boards downstream; a reference
> part number does not.

> **No TVS/ESD diode is fitted on any analog input — deliberately.** The
> CDSOD323-T05C used on L1.03/L1.05 leaks ≤ 5 µA at its spec point; across the 1 kΩ
> series resistor that is **5 mV of offset — 12 000× the noise floor** (K36). Protection
> comes from the 1 kΩ series limiters (which hold every plausible fault under the ±10 mA
> abs-max and raise the effective HBM rating ~1.7×, K37), the chip's own ±2 kV HBM
> structures, silk, and handling discipline. **This is the first OTD board where adding
> the standard protection part would have been the error.**

**Supporting passives & connectors (new or extended), all 0805 or THT:**
- **R7 = Yageo RC0805FR-0710RL** — 10 Ω, DVDD series filter (K24). *New value.*
- **R8–R12 = Yageo RC0805FR-0747RL** — 47 Ω ×5 on SCLK/CS/DIN/DOUT/DRDY, per datasheet
  §9.1.1. *New value.*
- **R13–R16, R18–R23 = Yageo RT0805BRD071KL** — 1 kΩ **±0.1 %, ±25 ppm/°C thin film**,
  ×10: the four bridge arms plus all six signal/reference series resistors. Thin film is
  chosen for three reasons, not one: tolerance (K14/K16), tempco (K15), and **thermal EMF
  — Vishay specifies thin-film chip resistors at < 0.1 µV/°C, a figure thick-film
  datasheets simply do not carry** (§1, RK6). *New line.*
- **R17 = Yageo RT0805BRD071ML** — 1 MΩ ±0.1 % ±25 ppm/°C, the step standard (K16).
  *New line; thinnest-stocked line on the board (§8).*
- **R24, R25 = Yageo RC0805FR-071ML** — 1 MΩ ±1 %, the floating-source bias (K23). **1 %
  is correct here** — these set a bias path, not a ratio — and it moves 2 of the 3 million-ohm
  placements onto a 130 k-stocked line that the catalog **already carries** (created for
  L2.01's load-share gate pulldown) — so it costs no new part. *Reuse line.*
- **C13, C16, C19 = Samsung Electro-Mechanics CL21C103JBFNNNE** — 10 nF **C0G/NP0**
  differential filter caps ×3 (§9.4.1 requires C0G). *New line, existing manufacturer.*
- **C14, C15, C17, C18, C20, C21 = KEMET C0805C102J5GACTU** — 1 nF C0G common-mode caps
  ×6. *New line, existing manufacturer.*
- **C8, C9, C11 = Würth Elektronik 885012207103** — 1 µF (U4 in, U4 out, DVDD local).
  *Same MPN as C5/C6.*
- **C10, C12 = Samsung Electro-Mechanics CL21B104KBCNNNC** — 100 nF at the AVDD and DVDD
  pins, exactly as the pin table demands ("Connect a 100nF (or larger) capacitor"). *Same
  MPN as C2/C3/C7.*
- **SW3 = Omron B3F-1000** — the step button. *Same MPN as SW1/SW2.*
- **J4 = Sullins PRPC040SAAN-RC** — breakaway 0.1″ header snapped to **1×4**. *Same MPN
  as J2/J3.*
- **TP3 = Keystone 5010 (red, AVDD), TP4 = Keystone 5011 (black, AGND).** *Same MPNs as
  TP1/TP2.*

> **Silkscreen rules (part of the lesson):** label J4 **EXC+ / IN+ / IN− / EXC−** with the
> load-cell colour convention (red / green / white / black) and mark it **"0–3.3 V
> differential only · ESD"**; mark SW3 **"+824 µV"**; mark TP3 **AVDD** and TP4 **AGND**
> distinctly from TP1/TP2 (a learner who probes the wrong pair learns nothing); mark U3
> pin 1 and U4 pin 1; and outline the **analog island** on the silk so the placement rule
> is visible on the finished board. Note **there is no ground-plane split to draw** — that
> is the point (§9.4.1).

## 5 · Power & thermal

- **Rails.** Two independent 3.3 V rails, both from USB VBUS:
  - **3V3 (digital)** — VBUS → F1 PTC → D1 ESD → **U2 RT9080-33GJ5** (600 mA). Powers the
    WROOM and, through **R7 (10 Ω) + C11/C12**, the ADS1220's **DVDD**. Unchanged from
    L1.01 except for the ≤110 µA the converter adds.
  - **AVDD (analog)** — VBUS → **U4 LP5907MFX-3.3** (250 mA, 6.5 µV<sub>RMS</sub>).
    Powers the ADS1220's AVDD **and is the bridge excitation**. Enabled only by GPIO4
    (K32).
  - VBUS 5 V still passes (PTC + ESD) to the GPIO headers for *peripheral power* only,
    never into a GPIO (L1.01 rule).
- **Analog budget (K29).** Bridge 3.3 mA + a 350 Ω external cell 9.4 mA + I<sub>AVDD</sub>
  0.58 mA = **13.3 mA** worst case → **19× headroom** on the LP5907. Dissipation at
  V<sub>BUS</sub> = 5.25 V: **25.9 mW**, θ<sub>JA</sub> 193.4 °C/W → **ΔT = 5.0 °C**,
  T<sub>J</sub> ≈ 30 °C at 25 °C ambient (≈ 45 °C at 40 °C ambient). Under a short,
  I<sub>SC</sub> 250–500 mA → ≤ 2.6 W → the LP5907's 160 °C thermal shutdown is the
  backstop.
- **Bridge dissipation (K12).** 2.72 mW per 0805 resistor (2 % of the 125 mW rating);
  ~0.7 °C self-heating. This is not a thermal problem — it is a **drift** problem, and it
  is the reason §6 RK6 makes thermal symmetry a layout rule.
- **Digital budget.** I<sub>DVDD</sub> ≤ 110 µA on a 600 mA rail. L1.01's rail budget
  (ESP32-S3 typ 80–160 mA, Wi-Fi TX peak ~500 mA brief, 10 µF bulk to ride it) is
  **unchanged**.
- **VBUS budget (K30).** +13.3 mA on top of L1.01's already-accepted load. F1 remains the
  0.5 A hold / 1 A trip PTC.
- **Thermal: not a flagged concern — proven, not assumed.** The largest **new** dissipator
  on the board is the LP5907 at **26 mW**. The largest dissipator overall is still
  L1.01's RT9080 (~1 W transient worst case, per L1.01 §5). No heatsink, no copper-pour
  thermal design, no derating analysis required → **`hasThermalConcern=false` holds and
  the deep-thermal conditional audit does not fire.**
- **A note on supply noise, recorded honestly.** The LP5907's advantage is **not** mainly
  about the converter's own supply rejection: the ADS1220's AVDD PSRR is 80 dB min /
  105 dB typ at dc and Fig 6-14 shows 120–140 dB at gain 128 across 0.1–1000 kHz, so
  *via PSRR* even the RT9080's 42 µV<sub>RMS</sub> lands at ~4 nV input-referred —
  irrelevant. The LDO earns its place on two other paths: **(a)** AVDD **is** the bridge
  excitation, and a bridge with 0.1 % imbalance converts supply noise to differential
  signal at that ratio — 42 µV<sub>RMS</sub> × 0.001 = **42 nV**, ~47 % of the ADC's own
  90 nV<sub>RMS</sub> floor, versus 6.5 nV for the LP5907 (this cancels in *ratiometric*
  mode and does **not** in internal-reference mode); and **(b)** a separate regulator
  means the analog rail's **return current** is generated and consumed inside the analog
  island rather than sharing the digital rail's path (K34). *The RT9080 is therefore a
  genuine drop-in second source — identical SOT-23-5 pinout (K/§8) — at a stated,
  quantified cost.*

## 6 · Risk register

| # | Risk | L × I | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **Single-ended input on a unipolar supply silently caps gain at 4** — §9.1.4 forces `PGA_BYPASS` for an AVSS-referenced signal, and "the PGA is always enabled for gain settings greater than 4". A board built the obvious way cannot reach its own headline claim: the floor becomes **3.91 µV<sub>pp</sub>** instead of 0.41 (K9). | High × **High** | **The board is differential-only, by construction.** The on-board bridge exists precisely to supply a differential signal at a legal common mode (K8); there is no single-ended input path to get this wrong on. The guide teaches the rule narratively (the board **prevents** the trap). | **DE-RISKED** (by topology) |
| **RK2** | **Common-mode outside the PGA window** — Eqs 12–14 give 0.825–2.678 V at gain 128; a source outside it saturates A1/A2 and the reading goes nonlinear with no error flag. | Med × High | On-board bridge sits at **AVDD/2 = 1.65 V, dead centre, 825 mV margin each way** (K8). The aux channel is biased to the same midpoint by R24/R25 (K23). Guide teaches the three inequalities and how to check them with the system monitor `(AVDD+AVSS)/2`. | **DE-RISKED** (by design) |
| **RK3** | **Power-up in an undefined state** — §9.3.2 wants < 20 V/ms and no LDO-fed rail delivers it (LP5907 ≈ 39 V/ms, K33); a bad POR leaves the converter mis-configured with no outward symptom. | Med × High | Two layers. **(a)** The *dangerous* half — AVDD before DVDD leaving the AIN3/REFN1 low-side switch undefined (§9.3.1) — is **designed out**: U4's EN is GPIO-driven with a 1 MΩ internal pulldown, so AVDD cannot precede DVDD (K32). **(b)** The ramp itself is **detected and recovered**: TI's own §9.1.6 sequence (≥50 µs settle → RESET 06h → write config → **read back RREG 23h**) is made mandatory, with a GPIO4 power-cycle retry on mismatch. | **DE-RISKED** (a) / **ACCEPTED + detected** (b) |
| **RK4** | **Wrong input pair** — TI's own bridge example (§9.2.3) uses AIN1/AIN2, which straddle the TSSOP (pins 10 and 7) and force an asymmetric µV differential route; AIN3 additionally carries the low-side switch's leakage (−250 nA @125 °C, Fig 6-18). | Med × Med | **Signal on AIN0/AIN1** (pins 11/10, adjacent), **reference on REFP0/REFN0** (pins 9/8, adjacent) — the pairs §9.4.1 names as best and that Figs 6-16…6-19 measure as lowest/best-matched. Four bridge wires land on four adjacent pins. Cost, accepted and stated: **no PSW bridge power-down** (K20). | **DE-RISKED** (by pinout choice) |
| **RK5** | **Source-limited stability mistaken for ADC error** — the on-board bridge drifts **±82.5 µV/°C** worst case from resistor tempco mismatch (K15), 201× the noise floor per degree. A learner watching the bridge would conclude the ADC is bad. | **High** × Med | **Reframed, not hidden.** F3's µV proof is the **shorted-input measurement** (`MUX = 1110b`, §9.1.6), which is immune to the source. The bridge is then presented as *a real measurement with a real source*, and its drift is **the lesson**: at 24 bits your source becomes the limit. Guide teaches the number and names monolithic resistor networks (≈5 ppm/°C tracking) as the production fix. | **DE-RISKED** (by pedagogy + the MUX demo) |
| **RK6** | **Thermal EMF** — every dissimilar-metal junction in the signal path is a thermocouple; a fraction of a °C of gradient across the differential pair is comparable to the 0.41 µV<sub>pp</sub> floor. | Med × Med | **Parts:** thin film throughout the signal path (Vishay specifies **< 0.1 µV/°C**; thick-film datasheets do not specify it). **Layout `[L]`:** identical junction counts on both legs, R18/R19 (and R20/R21, R22/R23) placed adjacent and thermally coupled, the analog island kept away from U2/U4 and the WROOM, no airflow path across one input only — the same discipline §9.4.1 asks for around a thermocouple's cold junction. | **DE-RISKED** (parts) → verify at **[L]** |
| **RK7** | **Aux channel: floating source and/or fault at J4** — a thermocouple has no DC path (common mode drifts out of range → garbage); an exposed precision input invites over-voltage, shorts and ESD. | Med × Med | **R24/R25 (1 MΩ) bias both inputs**, setting V<sub>CM</sub> = AVDD/2 and giving **open-sensor detection** for free (K23). **R22/R23 (1 kΩ)** hold any fault under the ±10 mA abs-max (5.25 V short → 1.85 mA; 10 V injection → 6.6 mA) and raise the effective HBM rating ~1.7× (K36/K37). **No TVS** — 5 µA of leakage would be 5 mV of offset. Silk: "0–3.3 V differential only · ESD". | **DE-RISKED** (bias + limiting; TVS consciously omitted) |
| **RK8** | **50/60 Hz notch mis-placed by the internal oscillator** — NMRR is specified with an *external* clock; the internal one is ±2 % and moves the notch (§8.3.6). | Low × Med | Worst case **2 % (oscillator) + ~0.5 % (grid) = 2.5 %**, inside the **±3 %** band over which ≥90 dB simultaneous rejection is guaranteed — **margin 0.5 percentage points** (K28). CLK tied to DGND (§9.1.5). An external 4.096 MHz clock is named as the production upgrade and **deliberately not fitted**: routing a 4 MHz square wave into the analog island to buy 0.5 pp is a bad trade. | **DE-RISKED** (thin but proven margin; alternative documented) |
| **RK9** | **2.4 GHz from the WROOM antenna corrupting a µV front end** — the RF/regulatory conditional. A +20 dBm radiator sits tens of mm from the inputs; any rectification in the front end appears as a DC offset shift. | Med × High | Mitigation stack: external RC **−37 dB** (ESL-limited, K18) + the ADS1220's internal 31.8 MHz EMI filter **−37.6 dB** = **≈ −75 dB**; analog island at the diagonally opposite corner (≥60 mm, §1 M6); antenna keep-out on all four layers. **Acceptance is empirical** (K35): shorted-input spread with Wi-Fi TX on vs radio off, delta < the 0.41 µV<sub>pp</sub> band. Honest position: **cannot be closed analytically at `[D]`.** | mitigations captured → **verify at [L]/BRINGUP** |
| **RK10** | **TSSOP-16 at 0.65 mm pitch is the hardest joint in the curriculum so far** — bridges and tombstoning on a 16-lead fine-pitch part. | Med × Med | The package is **forced** (VQFN is leadless and banned, K2) but it is the *good* forced choice: gull-wing leads are visible and reworkable, and the PW variant has **no thermal pad**, so there is no hidden joint. Guide teaches drag-soldering with flux + wick, assembly order SMD→THT, and a continuity/short check on all 16 pins before power. | **DE-RISKED** (package choice + technique) |
| **RK11** | **LP5907 output-capacitance ceiling** — C<sub>OUT</sub> **max 10 µF** (§5.6); the reflex "add bulk to the analog rail" destabilises the loop. | Low × High | Board AVDD net = C9 1 µF + C10 100 nF = **1.1 µF**, inside 0.7–10 µF at every corner (0.85 µF at the −55/+125 °C X7R extreme, K31). Recorded as a **design rule on the schematic and in the guide: do not add bulk to AVDD.** | **DE-RISKED** (by budget + explicit rule) |
| **RK12** | **Footprint ↔ symbol ↔ pinout** for the new parts not yet pad-verified: U3 TSSOP-16 (PW) — note the pin map differs entirely from the RVA package in the same table; U4 SOT-23-5 (1 IN, 2 GND, 3 EN, 4 NC, 5 OUT); the 0805 precision resistors and C0G caps; J4 1×4. Plus the **final ESP32-S3 GPIO assignment** (intended GPIO10–14 FSPI + GPIO4), which must not collide with L1.01's user-LED GPIO or any strapping pin (GPIO0/3/45/46). | Med × Med | Captured at `[D]` (intended pinout below); **verified at `[S]`** once KiCad symbols/footprints are chosen and the schematic is drawn — it cannot honestly close pre-schematic. | open → close at **[S]** |
| **RK13** | **WROOM antenna keep-out** (inherited from the core) — and on 4 layers the keep-out must exclude **all four** copper layers, inner ground planes included. | Low × High | Module on a board edge, no copper/parts under the PCB antenna on any layer (Espressif integration rules; L1.01 M1/R4). | open → close at **[L]** |
| **RK14** | **Analog layout** — the whole point of the board, and the one thing a schematic cannot enforce: solid unsplit plane, analog island placement, matched differential routing, Kelvin sense traces carrying no excitation current, decoupling at the pins without vias, SPI kept out of the analog region. | **High** × **High** | **`[L]` rules, all captured now:** (1) **one solid ground plane, never split** (§9.4.1) — partition by placement; (2) analog island at the far corner, ≥60 mm from the antenna; (3) AIN0/AIN1 routed as a tight symmetric pair on adjacent pins, equal length, equal junctions, over unbroken plane; (4) C13/C16/C19 placed *at* the pins, C14/C15/C17/C18/C20/C21 with equal return paths; (5) **REFP0/REFN0 sense traces tapped at the bridge/J4 excitation nodes, carrying no excitation current** (K22); (6) C10/C12 at pins 12/13 with low-impedance, via-light connections (§9.3.3); (7) SCLK/DIN/DOUT/DRDY/CS routed on the digital side, never under or beside the analog filters; (8) the 13.3 mA excitation return kept inside the analog copper; (9) thermal symmetry per RK6. Acceptance = K34's budget and K35's empirical test. | open → close at **[L]** |

**Intended pinout / connectivity captured for the `[S]` audit** (ADS1220 **PW/TSSOP-16**
numbering — *note this differs completely from the RVA package in the same pin table*):

| Pin | Name | Net | Via |
| --- | --- | --- | --- |
| 1 | SCLK | ESP32-S3 GPIO12 (FSPICLK) | R8 47 Ω |
| 2 | CS | ESP32-S3 GPIO10 (FSPICS0) | R9 47 Ω |
| 3 | CLK | **DGND** (selects the internal oscillator, §8.3.4/§9.1.5) | direct |
| 4 | DGND | ground plane | direct |
| 5 | AVSS | ground plane (unipolar) | direct |
| 6 | AIN3/REFN1 | J4.3 (aux IN−) | R23 1 kΩ; R25 1 MΩ to AGND |
| 7 | AIN2 | J4.2 (aux IN+) | R22 1 kΩ; R24 1 MΩ to AVDD |
| 8 | REFN0 | EXC− **sense** node | R21 1 kΩ |
| 9 | REFP0 | EXC+ **sense** node | R20 1 kΩ |
| 10 | AIN1 | bridge node BR_B | R19 1 kΩ |
| 11 | AIN0/REFP1 | bridge node BR_A | R18 1 kΩ |
| 12 | AVDD | AVDD rail | C10 100 nF at the pin, C9 1 µF |
| 13 | DVDD | DVDD rail | C12 100 nF at the pin, C11 1 µF, R7 10 Ω to 3V3 |
| 14 | DRDY | ESP32-S3 GPIO14, falling-edge IRQ | R12 47 Ω |
| 15 | DOUT/DRDY | ESP32-S3 GPIO13 (FSPIQ) | R11 47 Ω |
| 16 | DIN | ESP32-S3 GPIO11 (FSPID) | R10 47 Ω |

Also captured: **U4 LP5907 (SOT-23-5)** 1 = IN (VBUS, C8), 2 = GND, 3 = **EN ← GPIO4**,
4 = NC, 5 = OUT (AVDD, C9/C10) — *identical pin order to the RT9080-33GJ5 already on the
board, which is what makes the RT9080 a drop-in second source.* **Bridge:** R13 AVDD→BR_A,
R14 BR_A→AGND, R15 AVDD→BR_B, R16 BR_B→AGND; **R17 (1 MΩ) BR_B→SW3→EXC−**. **J4** 1×4:
pin1 EXC+, pin2 IN+, pin3 IN−, pin4 EXC−. **Register set for the primary demo** (from
§9.2.3 adapted to this pinout): `00h = 2Eh`-class (AIN<sub>P</sub>=AIN0, AIN<sub>N</sub>=AIN1,
gain 128, PGA enabled), `01h = 04h` (20 SPS, normal, continuous), `02h = 58h`-class
(external reference **REFP0/REFN0**, simultaneous 50/60 Hz rejection, PSW = 0), `03h = 00h`
(no IDACs) — **exact MUX/VREF bit values verified at `[S]` against §8.6.2**.

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board**. *(The live `REQUIREMENTS_REVIEW` checklist is a
separate gate; see the note below — it currently carries another board's items.)*

- [ ] **Calc trail recorded** — every ADC, filter, supply, noise, ground and fault value
  worst-case-sourced (§3 K1–K37) from ADS1220 SBAS501D, LP5907 SNVS798Q, RT9080 DS9080-09
  and the ESP32-S3 datasheet; logic-rail values inherited from L1.01. `[D]`
- [ ] **Each IC datasheet-verified** — U3 ADS1220 and U4 LP5907 read at source across the
  sections listed in §4 (not a summary page); U2/D1/F1/J1/U1 inherited from L1.01. `[D]`
- [ ] **Footprint ↔ pinout cross-checked** — U3 PW/TSSOP-16 (**not** RVA), U4 SOT-23-5,
  the 0805 precision passives and J4 1×4, plus the final ESP32-S3 GPIO map
  (**`[S]`** — verified at schematic capture; intended pinout captured in §6, RK12).
- [ ] **Fab-DRU DRC accounted for** — 4-layer PCBWay rules (`.kicad_dru`) applied before
  gerber export (**`[L]`**).
- [ ] **BOM availability confirmed** — every line in stock, Active, not EOL/NRND, exact
  strict-import strings (§8 — live DigiKey screen 2026-07-30). `[D]`
- [ ] **All top risks de-risked** — §6: RK1–RK8, RK10, RK11 de-risked or explicitly
  accepted with a detection path at `[D]`; RK12 closes at `[S]`; RK6 (layout half), RK9,
  RK13, RK14 close at `[L]`/BRINGUP.

Conditional — **flags `hasMainsNet` / `hasLiIon` / `hasThermalConcern` /
`requiresStripboard` are all false and all four were re-checked against this design, so
no *flag-driven* conditional row fires.** One conditional fires on the board's **nature**:

- [ ] **RF / regulatory review** — pre-certified-module integration (antenna keep-out on
  all four layers) **and** 2.4 GHz immunity of a 0.41 µV<sub>pp</sub> front end.
  Mitigation stack quantified at `[D]` (K18/K35, RK9); **acceptance is the empirical
  Wi-Fi-on/off test at `[L]`/BRINGUP.** *(No DB flag exists for RF; see the pipeline note.)*

> These are *attestations* (a human checked), not machine proofs — except BOM
> availability (DigiKey/parts MCP) and DRU presence, which are verifiable.

> **Owner items surfaced at the REQUIREMENTS gate (not design defects).** The live
> `REQUIREMENTS_REVIEW` checklist on revision `v1` is **boilerplate copied from another
> board**: `WS2812 level-shift strategy`, `Servo brownout mitigation`, `ADC1-only
> constraint`, and `Auto-shutoff prevention` are all **N/A here**; only `WROOM antenna
> keep-out zone confirmed` applies. Recommended replacements, each of which this design
> now evidences: **(1)** "Differential-only architecture recorded (single-ended on a
> unipolar rail caps gain at 4)"; **(2)** "Reference strategy chosen — ratiometric,
> Kelvin-sensed at the excitation; no external reference IC"; **(3)** "AVDD/DVDD split +
> AVDD-after-DVDD sequencing recorded"; **(4)** "Solid unsplit ground plane; analog
> partitioned by placement"; **(5)** "PW (TSSOP-16) package required — VQFN excluded by
> the L2 hand-solder envelope"; **(6)** "WROOM antenna keep-out zone confirmed" *(keep)*.
> Also: **`Project.targetCost` is null** in the live DB — §8 proposes **$30**.

> **Pedagogy framing (guide-authoring decision, recorded).** The ONE L2 takeaway is
> **"at 24 bits the converter stops being the limit."** The **must-land** set is: the
> **shorted-input noise floor** (0.41 µV<sub>pp</sub>, measured); the **824 µV step** and
> the discovery that the *standard* is coarser than the resolution; **differential +
> common mode** (why single-ended caps you at gain 4); **ratiometric + Kelvin sensing**;
> and the **ground/placement** rules with K34's two numbers. **Demote to
> optional/teardown asides** (the guide does not test these): capacitor ESL at 2.4 GHz
> (K18), ferrite-vs-resistor LC peaking (K24), the ±3 % notch-band argument (K28),
> Johnson-noise budgeting (K19), thermal EMF arithmetic (RK6). The arc: (1) short the
> inputs and find the floor; (2) press the button and check a known step; (3) walk the
> reference from AVDD → internal → ratiometric and watch the drift change; (4) turn the
> radio on; (5) read the layout you were given and find out what it cost to get here.
> **Prerequisite check:** the learner should arrive from **L1.05** already owning
> "resolution ≠ accuracy", LSB, and attenuation — confirm when the L1.05 guide ships.

## 8 · BOM sourcing & freeze

**Live DigiKey screen — 2026-07-30 (every line Active).** The whole file was run through
the project's own `parseBomCsv` and then strict-matched line-by-line against the live
`Part` table: **26 lines, 64 placements, 0 parse errors, 0 refDes/quantity mismatches,
18 lines matching the catalog byte-for-byte (including `Würth Elektronik` with the ü),
and exactly 8 unmatched — the 8 genuinely new parts.**

| Ref(s) | (manufacturer, mpn) | Pkg | DK stock | $ ea | Source |
| --- | --- | ---: | ---: | ---: | --- |
| U3 | `Texas Instruments` / `ADS1220IPWR` | TSSOP-16 (PW) | 4,107 | 9.26 | **NEW** |
| U4 | `Texas Instruments` / `LP5907MFX-3.3/NOPB` | SOT-23-5 | 210,924 | 0.66 | **NEW** |
| R13–R16, R18–R23 | `Yageo` / `RT0805BRD071KL` (1 kΩ 0.1 % 25 ppm thin film) | 0805 | 11,443 | 0.10 | **NEW** ×10 |
| R17 | `Yageo` / `RT0805BRD071ML` (1 MΩ 0.1 % 25 ppm thin film) | 0805 | **1,073** ⚠ | 0.10 | **NEW** ×1 |
| R24, R25 | `Yageo` / `RC0805FR-071ML` (1 MΩ 1 %) | 0805 | 130,175 | 0.10 | **reuse** ×2 (already in catalog) |
| R8–R12 | `Yageo` / `RC0805FR-0747RL` (47 Ω 1 %) | 0805 | 207,979 | 0.10 | **NEW** ×5 |
| R7 | `Yageo` / `RC0805FR-0710RL` (10 Ω 1 %) | 0805 | 159,538 | 0.11 | **NEW** ×1 |
| C13, C16, C19 | `Samsung Electro-Mechanics` / `CL21C103JBFNNNE` (10 nF C0G) | 0805 | 66,126 | 0.41 | **NEW** ×3 |
| C14/15/17/18/20/21 | `KEMET` / `C0805C102J5GACTU` (1 nF C0G) | 0805 | 489,212 | 0.16 | **NEW** ×6 |
| C5,C6,C8,C9,C11 | `Würth Elektronik` / `885012207103` (1 µF) | 0805 | (catalog) | — | reuse, qty 2→5 |
| C2,C3,C7,C10,C12 | `Samsung Electro-Mechanics` / `CL21B104KBCNNNC` (100 nF) | 0805 | (catalog) | — | reuse, qty 3→5 |
| SW1–SW3 | `Omron` / `B3F-1000` | THT | (catalog) | — | reuse, qty 2→3 |
| J2–J4 | `Sullins Connector Solutions` / `PRPC040SAAN-RC` | THT breakaway | (catalog) | — | reuse, qty 2→3 |
| TP1, TP3 | `Keystone Electronics` / `5010` (red) | THT | (catalog) | — | reuse, qty 1→2 |
| TP2, TP4 | `Keystone Electronics` / `5011` (black) | THT | (catalog) | — | reuse, qty 1→2 |
| U1, U2, D1, F1, J1, C1, R1–R6, LED1, LED2 | — | — | (catalog) | — | L1.01 core, unchanged |

Core spot-checks are inherited from L1.05's 2026-06-26 screen and L1.01's live watchdog;
the **eight new lines above (plus `RC0805FR-071ML`) were screened live on 2026-07-30**
(`validation-log.md` Pass 3).

> **Import-string notes (the strict `(manufacturer, mpn)` key), machine-checked 2026-07-30.**
> - **Zero new manufacturer strings.** Every one of the 8 new parts uses a manufacturer
>   string the catalog already carries: `Texas Instruments` (already present via
>   `SN74AHCT125DR` and `TLV61048DBVR`), `Yageo`, `Samsung Electro-Mechanics`, `KEMET`.
>   *This was asserted the other way round in an earlier draft and the strict-match check
>   falsified it — see `validation-log.md` Pass 12.* It is also **why** the C0G caps were
>   taken from Samsung and KEMET rather than the marginally cheaper Murata equivalent.
> - `Yageo` (not "YAGEO", as DigiKey renders it) matches the existing `RC0805FR-*` rows;
>   `Texas Instruments` (not "TI") matches the existing rows.
> - **`Yageo` / `RC0805FR-071ML` (R24/R25) is already in the catalog** — created during
>   the L2.01 design work as its load-share gate pulldown — so it imports as a reuse, not
>   a new part.

- **Design-to-cost target: ~$30** (live DB `targetCost` is **null** — this is the proposed
  value). L1.01 core ≈ $11 + new content ≈ **$17.3**, of which the ADS1220 alone is
  **$9.26**. That is expensive for a curriculum board and it is the right call: this is a
  PREMIUM ($49) L2 lesson whose subject *is* the precision converter, and the design
  actively **removed** ~$9 of unnecessary cost by proving an external reference IC would
  make the measurement worse (§4).
- **Second sources.**
  - **U3 ADS1220IPWR** — the ADS1120 (16-bit) is pin-compatible in the same PW package
    and would keep the board buildable at reduced resolution; there is no true 24-bit
    drop-in. **Single-source risk accepted and stated** (4,107 in stock, Active).
  - **U4 LP5907MFX-3.3/NOPB** — **`Texas Instruments` / `TPS7A2033PDBVR`** (Active,
    31,923, $0.35), TI's own named successor ("For a more updated portfolio device, see
    the TPS7A20"), same SOT-23-5 (DBV) package. **And**, at a stated cost, the
    `Richtek` / `RT9080-33GJ5` already on this board: identical SOT-23-5 pin order, 42 vs
    6.5 µV<sub>RMS</sub> output noise (§5).
  - **R17 (1 MΩ 0.1 %) is the thinnest line at 1,073** — but only **one piece per board**
    is needed, because the two bias resistors were deliberately moved to the 1 %
    `RC0805FR-071ML` line (130,175). Alternates: Vishay `TNPW08051M00BEEA`, Panasonic
    `ERA-6AEB105V`.
  - **R13–R23 (1 kΩ 0.1 %)** — Vishay `TNPW08051K00BEEA` (Active, 12,824, $0.41) is a
    drop-in at 4× the price. *(Panasonic `ERA-6AEB102V` was screened and is at **0 stock**
    — rejected.)*
  - C0G caps, 47 Ω/10 Ω/1 MΩ thick films, and every L1.01 line are commodity jellybeans
    with many alternates.
- **Accessory (deliberately NOT a BOM line):** a **4-wire strain-gauge load cell** for
  F7 — e.g. Adafruit 4540 (1 kg), DigiKey `1528-4540-ND`, Active, 575, $3.95; or SparkFun
  TAL221. It is a kit accessory, not a board component, and its MPN does not resolve
  cleanly under strict `(manufacturer, mpn)` matching (a bare "4540" collides with an
  unrelated TDK part), so it stays out of `bom.csv`. **The board is fully demonstrable
  with nothing attached** — that is what the on-board bridge and the 824 µV step are for.
- **BOM totals:** **26 lines, 64 placements**, of which **8 lines / 28 placements are
  new parts** the owner must create before import; the other 18 lines strict-match today.
- **BOM frozen: not yet.** Freeze (`bomFrozenAt`) is held until after this design passes
  validation **and** the owner authorises advancing into schematic/layout (RK12 closes at
  `[S]`; RK6-layout, RK9, RK13, RK14 close at `[L]`). `bomFrozenAt` stays **null**, the
  revision stays at `REQUIREMENTS`, and **no parts have been created.**
