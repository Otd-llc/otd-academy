# L2.04 Constant-Current Power-LED Driver — design doc

> ✅ **Design-stage gate MET (2026-07-30).** The **Recursive Board-Design Validation
> Protocol** (`../_protocol.md`) ran **19 passes, with the design-stage DRY pass at
> Pass 19** (`validation-log.md` is the evidence). DRY was first reached at Pass 15 and
> reopened twice, each time by re-checking something nobody had re-checked: **Pass 16**
> proved the flag problem below is systemic rather than per-board, and **Pass 18** found
> the cross-domain injection row used the wrong circuit model. Every `[D]` audit is clean, both
> `hasThermalConcern` conditional audits are run and clean, and the **13 new parts**
> may now be created and the BOM imported **by the owner** (the other 19 lines,
> including `SS34-E3/57T`, are already in the library — §8). Two passes changed real
> hardware: **Pass 3** found the LM3404's **±23.6 % on-time tolerance** and proved the
> first inductor/sense choice sat 0.8 % above the datasheet's CS signal-to-noise floor
> (HIGH — the current loop was redesigned); **Pass 7** found the **input-filter
> negative-resistance** condition that makes C7 load-bearing rather than decorative.
> **Still owed by phase-staging (F7, not blockers to part creation):**
> footprint↔symbol↔pinout `[S]` at schematic; fab-DRU DRC + the VBUS ⟂ V12 isolation
> ERC `[L]` at layout; and four bring-up measurements (B1–B4, §9). The
> `DESIGN_VALIDATION` ticks remain **Josh's honest human attestations** — the log
> earns them, he signs them.
>
> 🚩 **PROJECT-FLAG CHANGE REQUIRED BEFORE PART CREATION.** This board's record carries
> `hasThermalConcern = false`. **That is wrong for this board and must be set `true`**
> (§1 constraints, §5, Pass 8) — it is the one flag that changes the materialized
> `DESIGN_VALIDATION` checklist, adding the two conditional rows this doc already
> evidences (§7).
>
> **And it is not a per-board typo — it is systemic (Pass 16).**
> `scripts/populate-curriculum-dag.ts` sets `criticalPath`, `hasMainsNet` and
> `requiresStripboard` on **all 27 boards** and sets **`hasLiIon` and
> `hasThermalConcern` on none of them**; both default `false`
> (`prisma/schema.prisma:181-182`). So the two conditional audits that exist to catch
> the two most dangerous board classes — battery and thermal — **can never fire from
> the seed.** The read-across is immediate: **`l2-01-battery-power-module`**, the
> curriculum's first safety-critical Li-ion board, asserts `hasLiIon = true,
> hasThermalConcern = true` in its own design doc, and the seed would have left both
> false. Worth a fix in the seed script rather than a manual flip per board.

| | |
| --- | --- |
| **Slug** | `l2-04-power-led-driver` |
| **Owner** | Josh Tollette |
| **Status** | `draft` (design-stage DRY; parts NOT created, BOM NOT imported, revision NOT advanced) |
| **Track / Level** | POWER / L2 |
| **Teaches** | **Constant-current LED drive** (the graded concept) — and the *reasoned* choice between a **linear** and a **switching** constant-current topology, decided on heat, efficiency and complexity with real numbers, and then **measured on the bench** (§2.5) |
| **Project flags** | `hasMainsNet = false`, `hasLiIon = false`, **`hasThermalConcern = true` (CHANGE REQUIRED — seeded false)**, `requiresStripboard = false` |
| **Validation** | `passes 1–19, Pass 19 DRY` (design-stage) → `[S]`/`[L]` owed — see `validation-log.md` |

> **Headline:** the **L1.01 WROOM core reused verbatim** (USB-C → PTC → USBLC6 →
> RT9080 → 3V3 → ESP32-S3) plus a **second, independent 12 V rail** feeding an
> **LM3404 constant-on-time buck constant-current driver** that delivers **357 mA
> (350 mA class) into one off-board 1 W power LED on a 20 mm star**. The MCU does not
> power the LED; it **PWM-dims** it and **watches two voltages** — the 12 V rail and
> the LED anode — so the learner can compute efficiency, catch a mis-wired LED in
> milliseconds, and see forward voltage droop as the junction heats.
> **VBUS and V12 are separate nets, never joined** — only GND is common.

> **Priority (carried from L1.01/L1.03):** (1) the learner — first success must be
> frictionless; (2) the finished board's capability. **When they conflict,
> beginner-success wins.** Here that decided four things: the power LED lives
> **off-board on a star** (no leadless emitter to hand-solder, no 1 W of heat in the
> learner's FR4); the 12 V rail arrives on a **barrel jack**, not a second screw
> terminal that could be mis-inserted; the driver is a **SOIC-8 with no exposed pad**;
> and the design **refused an output-overvoltage Zener** it could not prove (Pass 7)
> rather than adding a part that looks protective and introduces an unbounded error
> term.

> **Risk-ID note:** the §6 register uses IDs **`RK1`–`RK20`** — these are *risks*, not
> reference designators (resistors are `R1`–`R16`). Unrelated namespaces (l1-03 F6).

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 board that drives one high-power LED at a
  regulated 357 mA** from a separate 12 V supply (curriculum **L2.04**, POWER track).
  **The one graded thing it teaches: a power LED is a current load, not a voltage
  load** — you set its *current*, and the topology you choose to set that current is
  an engineering decision made against a thermal budget, not a reflex. The board
  implements the **switching (buck)** answer; §2.5 carries the **linear** answer
  worked to the same depth, names the operating region where linear wins, and hands
  the learner a three-part breadboard build so the comparison is **measured, not
  asserted**.

- **Functional requirements (testable):**
  - **F1** — Run an ESP32-S3-WROOM-1 from one USB-C cable (power + native-USB
    flash/console) — **inherited verbatim from L1.01**.
  - **F2** — Deliver a regulated **357 mA typical, held within 324–388 mA
    (−9.4 %/+8.6 %)** into one series power LED (V_F 2.6–3.65 V) from a **12 V ±10 %**
    supply, across the full component-tolerance and temperature range. *Test: DMM in
    series at J5, supply swept 10.8 → 13.2 V.* **The band is set by the LM3404, not by
    sloppiness:** its CS threshold is specified **194–206 mV (±3 %)** and its on-time
    carries a **±23.6 %** tolerance (§3 row 4) that lands on the ripple term. A tighter
    number would be fiction (§3 row 13).
  - **F3** — **PWM-dim** that current from an ESP32 GPIO: **monotonic from ~5 % to
    100 % duty at 1 kHz, plus a true off at 0 %**. The 5 % floor is physics, not
    firmware — the inductor needs 4.0 µs to reach full current and the output
    capacitor another 1.3 µs (§3 row 16). *Test: duty sweep vs measured average
    current.*
  - **F4** — **Default OFF.** With the 12 V rail present and the MCU unprogrammed,
    unpowered, or in reset, the LED must be dark **and not glowing** (a single-LED
    LM3404 will visibly glow in shutdown unless bled — §3 row 17). *Test: apply 12 V
    with USB absent, observe in a dark room.*
  - **F5** — Let the learner **measure the efficiency argument**: the 12 V rail and
    the LED anode are both readable on **ADC1** channels, LED current is broken out at
    J5 for a series DMM, and every current-carrying node has a labelled probe pad.
    *Test: computed input power vs LED power vs bench-meter readings.*
  - **F6** — Survive what a learner will actually do: hot-plug and unplug the LED,
    connect the LED backwards, use a reversed-polarity supply, use a 24 V brick, and
    short the LED leads. *Test: FMEA §6, bring-up procedure §9.*
  - **F7** — Keep the LED's junction inside its rating with a **specified, sourced
    heatsink**, and make that requirement provable rather than asserted (§5).

- **Electrical / power budget:**
  - **E1** — **VBUS 5 V** (USB-C sink) powers the MCU domain only: RT9080 → 3V3 →
    ESP32-S3. Budget unchanged from L1.01 (~220 mA continuous, ~560 mA brief WiFi-TX
    peak, 0.5 A-hold / 1 A-trip PTC). **This board adds no new VBUS load** (§3 row 26).
  - **E2** — **V12** = external **regulated 12 V DC, 10.8–13.2 V, ≥ 300 mA**,
    centre-positive 2.1 mm barrel. The board draws **113 mA** worst case (§3 row 22).
  - **E3** — **VBUS and V12 are separate nets and are NEVER joined.** Only **GND** is
    common — an isolation invariant, checked by an ERC/DRC rule at `[L]` (§7). The
    only deliberate crossings are (a) the DIM logic line 3V3→U3 and (b) the two sense
    dividers V12/VLED→ADC1; both are current-limited and both are analysed (§3 rows
    14, 23–25; RK14).
  - **E4** — The LED current is set by **one resistor** (R8) against the LM3404's
    200 mV valley threshold; nothing else in the loop sets it (§3 rows 5–13).

- **Interfaces:**
  - **I1** — USB-C (power + native USB) — **inherited from L1.01**.
  - **I2** — **J4**: 2.1 × 5.5 mm DC barrel jack, **centre-positive**, 12 V in.
  - **I3** — **J5**: TE **282837-2** 2-pos 5.08 mm screw terminal — **LED+ / LED−**
    to the off-board star. The **only** screw terminal on the board, so the 12 V
    supply physically cannot be plugged into it (RK5). Breaking this connection is
    also how the learner puts a DMM in series with the LED (F5).
  - **I4** — **LED_DIM**: **GPIO6** → U3.DIM (3.3 V logic, 1 kHz PWM).
  - **I5** — **V12_SENSE**: **GPIO4 (ADC1_CH3)** ← 82 k/10 k divider on V12.
  - **I6** — **VLED_SENSE**: **GPIO5 (ADC1_CH4)** ← 10 k/5.1 k divider on the LED
    anode, through a 10 k series resistor. This is the board's **fault sensor**: it
    distinguishes normal (2.6–3.9 V), open or reversed LED (rails high), and shorted
    LED (≈ 0.2 V) — see RK6/RK20.
  - **I7** — Labelled probe pads (no BOM line): **TP3** V12 · **TP4** LED+ · **TP5**
    the R8-high node (the current waveform — the scope shot this lesson is built
    around; **R9's 1 kΩ isolates U3's CS pin from this pad**) · **TP6** SW.
    **TP1/TP2** (3V3 / GND, Keystone) are inherited from L1.01.

- **Constraints / DFM / safety flags:**
  - **`hasMainsNet = false`** — the board never touches mains. 12 V arrives from a
    finished, listed external adapter through a barrel jack. Matches the seeded intent
    ("DC-only — no student-laid-out mains copper").
  - **`hasLiIon = false`** — no cell on this board.
  - **`hasThermalConcern = true` — CHANGE REQUIRED (seeded `false`).** Three thermal
    budgets are load-bearing here and none is a formality: (a) the **LED junction**,
    which is why a heatsink is a BOM line and not advice (§5, RK1); (b) the **driver's
    own dissipation**, which is the number that decides the topology (§2.5); (c) the
    **derating** of the sense resistor, inductor, diodes and PTC (§5 table). A board
    whose entire lesson is "drive them wrong and they cook" cannot honestly carry
    `hasThermalConcern=false`. Setting it true adds exactly two conditional
    `DESIGN_VALIDATION` rows (`canonical-checklist-templates.ts:209-219`), both
    evidenced in §5 and §7.
  - **`requiresStripboard = false`** — fabbed PCB, as every OTD board.
  - **Antenna keep-out (M1):** inherited — module on a board edge, antenna over an
    all-layer keep-out (Espressif rules). **The switching cluster and the 12 V input
    cluster sit at the opposite board end from the antenna** (L-1, §5).
  - **Solderability (L2 envelope, first-class):** leaded SMD + THT only, **no
    leadless**. **U3 is the SOIC-8 `MA` variant — no exposed pad; the `MRX` PowerPAD
    variant is explicitly rejected** (RK17). D2/D4 SMC, D3 SMA, L1 a two-pad shielded
    drum, F2 1812, R8 1206, everything else 0805 or through-hole. **The power LED is
    never soldered by the learner** — it ships pre-mounted on a star and lands in a
    screw terminal.
  - **Regulatory:** unchanged — pre-certified module, no board-level radiator cert.
    The buck's switching node is the only new emitter; bounded by a shielded inductor,
    a small SW loop, a damped input filter and a 208–460 kHz fundamental (§5, L-2).

## 2 · Topology

L1.01 core untouched + an independent 12 V rail, its protection chain, the buck
driver, the LED interface, and two sense dividers.

```
  ┌────────────────── L1.01 CORE (reused verbatim, validated) ───────────────────┐
  │ USB-C(sink) → F1 PTC → D1 USBLC6 ESD → U2 RT9080 LDO → 3V3 → U1 ESP32-S3     │
  └──────────────────────────────────────────────────────────────────────────────┘
                              GPIO4 (ADC1_CH3) ▲    ▲ GPIO5 (ADC1_CH4)
                                               │    │      │ GPIO6 (1 kHz PWM out)
                                 [R12 82k]     │    │ [R16 10k]        │
                                       │       │    │      │           │
                                 ┌─────┴─────┐ │ ┌──┴──────┴────┐      │
                                 │[R13 10k]  │ │ │[R14 10k]     │      │
                                 │[C12 0.1µ] │ │ │[R15 5.1k]    │      │
                                 └─────┬─────┘ │ │[C13 0.1µ]    │      │
                                       │       │ └──────┬───────┘      │
  ═════════════════════════════════════╪═════════════════╪═════════════╪════════
   V12 DOMAIN (never joined to VBUS — GND common only)    │             │
                                       │                 │             │
  J4 ──F2 PTC──D2 SS34──┬────── V12 ───┘                 │             │
 (barrel  0.5A/30V  (reverse           │                 │             │
  12V in)             block)   [D3 SMAJ15A TVS]          │             │
                                       │ [C7 100µ/35V ESR 85mΩ]        │
                                       │ [C8 2.2µ/50V]  │             │
                           ┌───────────┴──────────┐      │             │
                           │  8 VIN               │      │             │
              [R7 82k]─────┤  6 RON          SW 1 ├──┬───┴──[L1 100µH]─┬──► J5.LED+
                           │                      │  │                 │
             [C10 0.1µ]────┤  7 VCC               │  │  [D4 SS34]      │ [C11 2.2µ]
                           │                      │  │   ▲(recirc)     │
             [C9 10n]──────┤  2 BOOT              │  │   │             ▼
               (to SW)     │                      │[R11 10k]         ★ LED3 on a
        GPIO6 ──┬──────────┤  3 DIM               │  │   │             20 mm star
                 │         │                      │  │   │             + HS1 heatsink
             [R10 1k]      │  4 GND   5 CS        │  │   │             (both off-board)
                 │         └──────────┬───────────┘  │   │             │
                GND          [R9 1k]──┤              │   │             ▼ J5.LED−
                                      │              │   │             │
                                   ───┴──────────────┴───┴──[R8 0.62Ω]─┘
                                                             │
                                                            GND  (Kelvin star at R8/C8/D4)
```

**Sub-circuits (how the schematic is organised):**
1. **L1.01 core (reused):** USB-C + CC pull-downs · F1 PTC + D1 USBLC6 · 3V3 (U2
   RT9080 + C5/C6/C1) · U1 S3-WROOM-1 + EN/BOOT (R1/C4/SW1, R2/SW2) · indicators
   (LED1 red on 3V3, LED2 yellow on GPIO48, R5/R6) · J2/J3 headers · TP1/TP2.
   *No new design work; no new VBUS load.*
2. **12 V input & protection (NEW):** J4 → **F2** 1812L050/30PR PTC (0.5 A hold,
   **30 V** — the L1.01 PTC's 6 V rating disqualifies it here, RK21) → **D2** SS34
   series Schottky (reverse-polarity **block**, not clamp) → **D3** SMAJ15A TVS +
   **C7** 100 µF/35 V electrolytic + **C8** 2.2 µF/50 V X7R. **C7 is not optional
   bulk:** its 85 mΩ ESR is the damping that keeps the input filter's peak output
   impedance 600× below the converter's negative input resistance (§3 row 21).
3. **Buck constant-current driver (NEW):** **U3 LM3404MAX/NOPB** (SOIC-8, no exposed
   pad). `VIN=8`, `RON=6` ← **R7 82 kΩ** to VIN, `VCC=7` → **C10 0.1 µF** to GND,
   `BOOT=2` → **C9 10 nF** to SW, `DIM=3` ← GPIO6 with **R10 1 kΩ pull-down**,
   `GND=4`, `CS=5` ← **R9 1 kΩ** series from the R8-high node, `SW=1` → **L1 100 µH**
   and **D4 SS34** cathode. **R11 10 kΩ** SW→GND kills the single-LED off-state glow.
   **R8 0.62 Ω 1 % 1206** in the LED return sets the current.
4. **LED interface (NEW):** **J5** TE 282837-2 (LED+ / LED−) with **C11 2.2 µF/50 V**
   across it. C11 does three jobs: it splits the inductor ripple so the **LED** sees
   7 % while the **sense resistor** still sees the full 23 % the CS comparator needs
   (§3 rows 10, 15); it damps the open-circuit oscillation the datasheet warns about
   (§3 row 19); and it gives the LED-anode ADC a filtered node to read.
   **LED3** = New Energy **LST1-01H06-3080-01** (LUXEON C on a 20 mm star) bolted to
   **HS1** Wakefield **882-100AB**. Both off-board.
5. **Telemetry (NEW):** **R12 82 k / R13 10 k + C12** divides V12 → GPIO4;
   **R14 10 k / R15 5.1 k + C13**, then **R16 10 k** in series, divides the LED anode
   → GPIO5. Both land on **ADC1** because **ADC2 is unusable while WiFi is on**
   (L1.05 K2; the REQUIREMENTS_REVIEW "ADC1-only constraint recorded" row).

**Theory of operation.** The core boots and enumerates exactly as L1.01. The LED side
is a **constant-on-time (COT) hysteretic buck**: the LM3404's internal high-side
MOSFET turns on for a fixed t_ON set by R7 and V_IN (`t_ON = 1.34×10⁻¹⁰ · R_ON / V_IN`,
datasheet Eq. 20), ramping current through L1 into the LED and R8. When it turns off,
the inductor current freewheels through D4. The CS pin watches the **valley** of the
voltage across R8 and turns the switch back on when it falls to **200 mV**; the
average LED current is that valley plus half the ripple (Eq. 3–4). Because t_ON is
inversely proportional to V_IN, the ripple barely moves as the supply moves, and the
regulation needs no compensation network — which is why every number in §3 is
derivable by hand and why this part teaches better than a fixed-frequency controller.

Dimming is **not** analogue: GPIO6 chops the DIM pin, gating the MOSFET while leaving
the bandgap and driver alive, so the LED sees full-amplitude 357 mA pulses at the PWM
duty. That holds the LED's *colour point* constant while its brightness changes, which
analogue current dimming does not — a point the lesson makes on the board.

**Every pin of U3 accounted for** (LM3404 D/SOIC-8, TI SNVS465G §5):

| Pin | Name | Net | Driven / terminated by |
| --- | --- | --- | --- |
| 1 | SW | `SW` | L1 (100 µH) + D4 cathode + R11 10 kΩ→GND + C9 low side |
| 2 | BOOT | `BOOT` | C9 10 nF to SW (datasheet: *"must always be a 10-nF ceramic X7R"*) |
| 3 | DIM | `LED_DIM` | GPIO6 **and** R10 1 kΩ to GND (default-OFF, §3 row 14) |
| 4 | GND | `GND` | board ground, Kelvin-returned to the R8 low side (L-4) — the only GND pin; the `MA` variant has no exposed pad |
| 5 | CS | `CS` | R9 1 kΩ series from the R8-high node (TI §8.1.8.1 hot-swap protection) |
| 6 | RON | `RON` | R7 82 kΩ to VIN (also the shutdown pin: pulling it < 0.3 V shuts the part down — nothing on this board does) |
| 7 | VCC | `VCC7` | C10 0.1 µF X7R to GND. **Output only** — the internal 7 V regulator; nothing else may load it |
| 8 | VIN | `V12` | post-D2 rail, decoupled by C8 2.2 µF/50 V X7R + C7 100 µF |

**Every pin of U1 accounted for** (ESP32-S3-WROOM-1, 40 castellations + EPAD; pin map
= the library's VERIFIED pinout, Espressif v1.8 Table 3-1):

| Pin(s) | Signal | This board |
| --- | --- | --- |
| 1, 40, 41 (EPAD) | GND | board GND (EPAD is Espressif pin 41 = GND, per the L1.01 2026-07-19 ECN) |
| 2 | 3V3 | 3V3 rail (C2/C3 decoupling) |
| 3 | EN | R1 10 kΩ↑ + C4 0.1 µF + SW1 — *L1.01* |
| 13, 14 | IO19/IO20 | native USB D−/D+ through D1 — *L1.01* |
| 27 | IO0 | R2 10 kΩ↑ + SW2 (BOOT) — *L1.01* |
| **6** | **IO6** | **LED_DIM → U3.3** (non-strapping; also on J2/J3 — RK12) |
| **4** | **IO4** | **V12_SENSE (ADC1_CH3)** ← R12/R13 (also on J2/J3 — RK12) |
| **5** | **IO5** | **VLED_SENSE (ADC1_CH4)** ← R14/R15/R16 (also on J2/J3 — RK12) |
| 25 | IO48 | LED2 user LED via R6 470 Ω — *L1.01* |
| 15, 16, 26 | IO3/IO46/IO45 | **strapping pins — module defaults, no board load**, broken out to J2/J3 only |
| all remaining IO | — | J2/J3 breakout headers, unchanged from L1.01 (which also exposes 5 V/3V3/GND) |

Two-terminal parts are netted in the block diagram above. **Nothing floats:** the only
node that could is `LED+` when J5 is open, and it is terminated by R14+R15 (15.1 kΩ)
and, through L1, by R11 to GND. The **`[S]` audit re-verifies every pin against the
chosen KiCad symbols** (audit 6, phase-staged).

**Sequencing.**
- *Power-up, normal (USB first, then 12 V):* 3V3 rises, GPIO6 is high-Z, R10 holds DIM
  at ~80 mV → **U3 off**. V12 rises; U3's internal 7 V regulator and its UVLO release
  well below the 10.8 V rail minimum; the LED stays dark until firmware drives GPIO6
  high. **F4 is satisfied by hardware, not by firmware discipline.**
- *Power-up, 12 V only (no USB):* U3 powers up; DIM is still held low by R10, which
  references common GND and does not need 3V3 → **LED off**. Only the **V12** sense
  divider injects into the unpowered 3V3 rail through the ESP32's pin clamp — the LED
  divider contributes nothing, because with DIM low the LED+ node is bled to ~0 V —
  and that injection is **≤ 63.5 µA and self-limiting: it stops once 3V3 reaches
  0.566 V** (§3 row 26). No node exceeds any abs-max, the LED cannot light, and the
  rail cannot climb high enough to part-start the MCU, which is simply **held off**.
  **RK14**, with the documented order "USB first, then 12 V" and **bring-up
  measurement B3** to confirm the real rail voltage.
- *Power-down, USB pulled while 12 V stays on:* GPIO6 collapses, R10 pulls DIM low →
  LED off within one PWM period. DIM's abs-max is **−0.3…+7 V referenced to GND** (not
  to VIN), so the reverse case — 3.3 V on DIM with V12 absent — is also inside the
  rating (§3 row 14).
- *LED unplugged while running:* CS never reaches 200 mV, duty runs to D_MAX, and the
  output rises to at most `D_MAX × V_IN ≈ 9.6 V` (§3 row 19); C11 damps the ring the
  datasheet warns of, and the OVP comparator caps peak current at 300 mV/R8. Firmware
  sees VLED_SENSE rail high and cuts DIM. **RK6, de-risked.**

### 2.5 · The topology decision — linear vs switching (the graded lesson)

Both candidates are worked at **the same operating point**: `V_IN = 12 V ±10 %`, one
LUXEON C at **357 mA**, `V_F = 2.77 V` (typ at T_j 85 °C), `T_a = 40 °C`. The board
implements **B**. The point of the lesson is that **A is not stupid** — it is the right
answer in a different corner, and the learner has to find the boundary.

**Candidate A — linear: LM317 as a two-terminal current source**

The simplest constant-current circuit that exists: one three-terminal regulator and one
resistor. `I = V_ref / R_set`, `V_ref = 1.25 V` (TI SLVS044Z: **1.2 / 1.25 / 1.3 V**
over 3 V ≤ V_I−V_O ≤ 40 V, 10 mA ≤ I_OUT ≤ 1500 mA). `R_set = 1.25/0.357 = 3.50 Ω →
3.6 Ω → 347 mA`.

| Quantity | Worked | Result |
| --- | --- | --- |
| Volts across the LM317 | `V_IN − V_F − V_ref`, nominal | 12 − 2.77 − 1.25 = **7.98 V** |
| …worst case | `13.2 − 2.605(V_F min, hot) − 1.30` | **9.30 V** |
| Heat in the pass device | nominal `7.98 × 0.357` / worst `9.30 × 0.388` | **2.85 W / 3.61 W** |
| Heat in R_set | `V_ref × I = 1.25 × 0.357` | **0.45 W** (needs a ≥ 1 W resistor) |
| **Total heat** | pass device + R_set | **3.30 W nominal / 4.06 W worst** |
| Useful LED power | `2.77 × 0.357` | **0.990 W** |
| **Efficiency** | `0.990 / (12 × 0.357)` | **23.1 %** |
| Junction temp, **no** heatsink | `40 + 3.61 × 37.9` (TI KCT TO-220 RθJA) | **177 °C — destroyed** (abs-max T_J 150 °C) |
| Heatsink actually required | `θ_total ≤ (125 − 40)/3.61 = 23.5 °C/W`, less θ_JC ≈ 5 and θ_CS ≈ 1 | **θ_SA ≤ 17.5 °C/W — a dedicated TO-220 heatsink on the driver, on top of the LED's** |
| Dropout floor | TI: `V_I − V_O ≥ 3 V` | from 5 V USB: `5 − 3.645 − 1.30 = 0.06 V` → **cannot regulate at all** |

**Candidate B — switching: LM3404 constant-on-time buck (IMPLEMENTED)**

| Quantity | Worked | Result |
| --- | --- | --- |
| Total loss in the driver chain | §3 rows 20a–20j, on the **guaranteed** diode drop | **0.371 W** (nom f) / **0.404 W** (460 kHz corner) |
| …on the typical diode drop (curve, to be measured — B2) | | **0.313 W** |
| Useful LED power | `2.77 × 0.357` | **0.990 W** |
| **Efficiency (guaranteed / typical)** | | **71.0–72.7 % / 75.9 %** |
| Hottest new part's junction | LM3404 at the 460 kHz corner, `40 + 0.104 × 106.8` | **51.1 °C** (T_J 125 °C rec.) |
| Heatsink on the driver | none | **none required** |
| Extra parts vs A | L1, D4, C7, C8, C9, C10, C11, R7, R9, R10, R11 | **11 more parts** |
| New failure surface | switching-node EMI, inductor saturation, bootstrap, input-filter interaction | real — §6 registers each |

**The decision, stated as a rule the learner can reuse.**

> The pass device in a linear driver dissipates **(V_IN − V_F) × I_F**, always. That is
> not a coefficient you can design away — it is the topology. So: **compute
> (V_IN − V_F) × I_F first, then ask what it costs to get rid of that heat.** If the
> answer is "a heatsink smaller than the part," take the linear. If it is "a heatsink
> bigger than the board," take the switcher.

At **12 V** the linear burns **3.3 W to deliver 1 W of light** and needs its own
heatsink — heavier, hotter and more expensive than the eleven parts that make the buck.
**Switching wins here, decisively.** But the same arithmetic says the opposite
elsewhere, and the doc must say so:

- At **5 V** with a low-dropout linear topology (an op-amp + MOSFET + 0.3 V sense —
  *not* an LM317, which cannot make its 3 V dropout at 5 V), the loss is
  `(5 − 2.77 − 0.3) × 0.357 = 0.69 W` at **57 % efficiency**, handled by a DPAK and a
  copper pour. Fewer parts, no inductor, no EMI, cheaper, quieter. **For a single LED
  on a supply you control, that is the better engineering answer.**
- The buck's **71–76 %** here is honestly mediocre, and the reason is instructive: a
  2.77 V load on a 12 V rail means the two fixed losses (D4's 134 mW and R8's 79 mW)
  are 21 % of a 0.99 W output. `V_O/V_IN = 0.25` is a poor duty for a buck. Put
  **three** LEDs in series (V_O ≈ 8.5 V, D ≈ 0.71) and the recirculating diode conducts
  a third as long — exactly the lever `l3-03-lighting-array` pulls, and the reason this
  board's rail is 12 V and not 5 V.

**Why the rail is 12 V and not 5 V (the choice *behind* the choice).** Three reasons,
in order: (1) it is the supply a learner already owns; (2) it leaves headroom for the
2–3 LED series string the downstream lighting-array board needs, which a 5 V rail
cannot reach at all (2 × 3.65 V = 7.3 V > 5 V); (3) it makes the difference
**measurable on a bench meter** — **113 mA vs 357 mA** of input current for identical
light. A 5 V rail would have made the headline argument nearly invisible.
**Choosing the rail voltage is the real design decision; the topology follows from
it.** That is the sentence the lesson is built around.

**The comparison is built, not just read (the lab).** The LED lives on a screw
terminal, so the learner can unplug it from this board and drive the *same* LED from an
**LM317 + 3.6 Ω + TO-220 heatsink** on a breadboard fed by the *same* 12 V brick, then
measure: input current (113 mA vs 347 mA), the two case temperatures, and the light
output (identical). Three parts, all in stock, all named in §8 — and **no change to the
board**. This is what makes §2.5 a *decision* rather than a paragraph.

## 3 · Calc trail (DO — lock the math)

Worst case (min/max/temperature), not typical. Sources: **TI SNVS465G** (LM3404/HV rev
G, Sept 2015), **TI SLVS044Z** (LM317 rev Apr 2025), **Lumileds DS41** (LUXEON C,
20140604), **New Energy StarBoard DS v1.0** (2024-01-18), **Vishay 88751** (SS32-SS36
rev 23-Apr-2020), **Littelfuse SMAJ series**, **Littelfuse 1812L**, **Bourns SRR1208**,
**Susumu RL1632**, **Wakefield 882 series**, **Espressif ESP32-S3-WROOM-1 v1.8**,
**L1.05 design.md** (the ESP32 ADC facts). Every corner in this table was evaluated by
`validation-log.md`'s solver rather than by hand, precisely because Pass 3 showed that
the hand-evaluated *nominal* hid a violated constraint.

| # | Value | Formula / source | Result | Notes / margin |
| --- | --- | --- | --- | --- |
| 1 | LED forward voltage @ 350 mA | Lumileds DS41 Table 2, thermal pad 25 °C | **2.80 / 2.95 / 3.57 V** | the **max** is what the topology math must survive, not the 2.75 V typ the star sheet quotes |
| 2 | V_F temperature coefficient | Lumileds DS41 Table 2 | **−3.0 mV/°C** | design band bounded to T_j 0…90 °C ⇒ **V_F = 2.605 … 3.645 V** |
| 3 | V_F cross-check | New Energy DS: 2.75 V typ @ 350 mA **T_j 85 °C**; DS41 2.95 V @ 25 °C − 3.0 mV/°C × 60 = 2.77 V | **agree to 20 mV** | two independent datasheets on the same die — the one number here corroborated twice |
| **4** | **On-time and its tolerance** | `t_ON = 1.34×10⁻¹⁰·R_ON/V_IN` (Eq. 20), R_ON = 82 kΩ. **§6.6 specifies t_ON as 2.1/2.75/3.4 µs at V_IN 10 V and 515/675/835 ns at 40 V ⇒ ±23.6 %** | **916 ns** typ @12 V (832 @13.2, 1017 @10.8), **±23.6 %** | **The Pass-3 finding.** The formula reproduces the *typical* to within 3 %, but the part is only guaranteed ±23.6 %, and that lands directly on the ripple, the CS SNR floor and the OVP headroom. Nothing below may be evaluated at the typical |
| 5 | Min on-time check | datasheet floor **300 ns** | **636 ns worst** (2.1×) | worst = V_IN 13.2 V and t_ON at −23.6 % |
| 6 | Min off-time check | `t_OFF = t_ON·(V_IN−V_O)/V_O`, floor **300 ns** | **1396 ns worst** (4.7×) | worst = V_O max, V_IN min |
| 7 | Output voltage seen by the converter | `V_O = V_F + I_F·R8` | **2.99 V** typ; **2.82–3.86 V** worst | Eq. 2 states it as `n·V_F + 200 mV` |
| 8 | Switching frequency | `f_SW = D/t_ON` at the corners | **272 kHz** typ; **208–460 kHz** | f tracks V_O and t_ON, not V_IN — a COT property worth the lesson. Sets the C11 sizing corner (row 15) |
| 9 | Inductor ripple | `Δi_L = (V_IN − V_O)·t_ON/L` (Eq. 9), L = 100 µH ±10 % | **82.5 mA** typ (23.1 % of I_F); **49.0 – 118.6 mA** worst | the inductor, R8 and the CS comparator all see this — only the LED does not (row 15) |
| **10** | **CS ripple window — the binding constraint** | floor: **≥ 25 mV** for SNR (§8.1.3). ceiling: the comparator regulates the *valley* to V_CS, so the peak is `V_CS + Δi·R8`; OVP fires at **300 mV** ⇒ ripple **≤ 300 − 206 = 94 mV** | **30.1 / 51.2 / 75.0 mV** — **1.20× above the floor, 1.25× below the ceiling** | **The whole design point exists to fit inside this window.** The pre-Pass-3 choice (L 100 µH, R_ON 68 kΩ) gave **25.2 mV** — 0.8 % of margin, i.e. none. The window is only 3.8:1 wide and the worst-case ripple spread is 2.5:1, so it is not a formality |
| 11 | Sense resistor | `R8 = 0.2L/(I_F·L + V_O·t_SNS − ((V_IN−V_O)/2)·t_ON)`, t_SNS = 220 ns (Eq. 34) | **0.62 Ω 1 %, 1206** | E24; a sub-1 Ω current-sense part, not a jellybean thick-film |
| 12 | Average LED current | `I_F = V_CS/R8 − V_O·t_SNS/L + Δi_L/2` (Eq. 3–4) | **357.3 mA** typical | **not 350.0 mA, and deliberately so:** with E24 values the nearest achievable is 357 mA, and the LM3404's own ±3 % threshold makes a 350.0 figure fiction. 357 mA is 2 % above the LED's characterisation current and inside its ±10 % flux bin |
| 13 | I_F worst case | 6-way stack: V_CS **194/206 mV**, R8 ±1 % + TCR ≤ +100 ppm/°C, L ±10 %, **t_ON ±23.6 %**, V_IN ±10 %, V_F 2.605–3.645 V | **323.6 – 388.0 mA** (−9.4 % / +8.6 %) | **F2 met as restated.** Peak inductor current **447 mA** |
| 14 | DIM default-off | internal pull-up **80 µA** (75 µA typ per §7.3.7) into R10 = 1 kΩ; V_IL max **0.8 V** | **80 mV → 0.72 V of margin** | survives a 5× pull-up error. Driven high the GPIO sources 3.3 mA for 3.3 V vs V_IH 2.2 V min (**+1.1 V**). DIM abs-max is **−0.3…+7 V to GND**, so 3.3 V on DIM with V12 absent is in-spec |
| **15** | **Output capacitor — splitting the ripple** | `Δi_F = Δi_L/(1 + r_D/Z_C)`, `Z_C = 1/(2πf_SW·C11)` (Eq. 11); r_D = **0.64 Ω** (DS41); C11 = 2.2 µF 50 V X7R, ~2.09 µF after DC-bias derating | **LED ripple 7.0 % typ, 12.1 % worst** (at the 208 kHz corner) | This is why the design can satisfy row 10 *and* the LED makers' ±5–20 % ripple guidance at once. TI: *"the entire inductor ripple current flows through R_SNS"* — C11 does **not** weaken the CS signal |
| 16 | PWM dimming bandwidth | inductor rise `L·I_F/(V_IN−V_O)` = **4.0 µs**; C11 charge `C·r_D` = **1.3 µs**; datasheet: f_DIM ≥ 1 decade below f_SW | **1 kHz chosen** (208× below the lowest f_SW); **usable duty ≈ 5–100 %** | F3 as restated. The output capacitor buys ripple at the price of dimming bandwidth — state the trade, do not hide it |
| 17 | Off-state glow suppression | §8.1.7 Table 1: 1 LED → **20 kΩ** SW→GND | **R11 = 10 kΩ** (catalog reuse) | lower R is *more* effective; cost `(D·V_IN² + (1−D)·V_D²)/R` = **3.6 mW**, and R11 sits outside the sense loop so it is a loss, not a current error. Needed because V_O ≈ 3 V is under the ~6 V the datasheet gives as the glow threshold |
| 18 | Continuous-conduction check | datasheet §7.3.1: the part *"must be operated in CCM"*. Valley `= I_F − Δi_L/2` | **299 mA worst** — always > 0 | checked at both the min-I_F/max-ripple and max-I_F corners |
| 19 | Open-LED output voltage | `V_O(max) = V_IN·t_ON/(t_ON + 300 ns)` (Eq. 5), at V_IN 13.2 V with t_ON at −23.6 % | **9.6 V** | ≪ V_IN; TI: *"the output stage … is capable of withstanding V_O(MAX) indefinitely"*. C11 damps the ring; row 24 shows the divider survives it |
| 20a | Loss — R8 | `I_F²·R8` | **79.1 mW** | 15.8 % of the 0.5 W part |
| 20b | Loss — U3 conduction | `I_F²·R_DS(on)·D`, **R_DS(on) max 0.75 Ω** | **23.8 mW** | typ (0.37 Ω) = 11.7 mW |
| 20c | Loss — U3 switching | `0.5·V_IN·I_F·(t_R+t_F)·f_SW`, t_R = t_F = 20 ns (§7.3.6) | **23.3 mW** @272 kHz; **39.4 mW** @460 kHz | |
| 20d | Loss — U3 gate + VCC | `(I_IN-OP + f_SW·Q_G)·V_IN`, I_IN-OP 625 µA, Q_G 6 nC | **27.1 mW** @272 kHz; **40.6 mW** @460 kHz | |
| 20e | Loss — D4 recirculating | `(1−D)·I_F·V_F(D)`, **V_F(D) = 0.5 V guaranteed max at 3 A** (Vishay 88751) | **134.2 mW** | the **largest single loss**. The guarantee is at 3 A; at 0.357 A the curve gives ≈ 0.35 V ⇒ 93.9 mW. **Measurement B2 owed** |
| 20f | Loss — L1 DCR | `I_F²·DCR`, DCR **170 mΩ max** | **21.7 mW** | |
| 20g | Loss — D2 series block | `I_IN·V_F(D)` on the guaranteed drop | **54.4 mW** | typ ≈ 36.9 mW |
| 20h | Loss — R11 glow bleed | row 17 | **3.6 mW** | |
| 20i | Loss — F2 PTC | `I_IN²·R_i`, R_i 150 mΩ min | **1.8 mW** | 23 % of I_hold (row 31), so self-heating is negligible |
| 20j | Loss — sense dividers | `V12²/92 kΩ + V_O²/15.1 kΩ` | **2.2 mW** | |
| **21** | **Input-filter stability (Middlebrook)** | converter input impedance `Z_in = V_IN²/P_IN` = 144/1.36. Filter peak output impedance at resonance `≈ L_lead/(R·C)` with a 1.5 µH brick lead | **Z_in = 106 Ω** vs **0.17 Ω with C7** — a **600×** margin | **Without C7** (2.2 µF ceramic alone, ESR ≈ 2 mΩ) the peak is `1.5 µH/(0.002·2.2 µF) =` **341 Ω > 106 Ω ⇒ the input would oscillate.** C7's **85 mΩ ESR** is therefore a *functional* requirement, not bulk. §8.1.5 |
| 22 | Board input power and current | rows 20a–j + P_LED | **1.36 W, 113 mA** (1.39 W / 116 mA at the 460 kHz corner) | vs the linear's 4.28 W / 357 mA |
| 23 | **Board efficiency** | `P_LED/P_IN` | **72.7 %** (nom f) / **71.0 %** (460 kHz corner) / **75.9 %** (typical diode drop) | §2.5; measurement B2 closes the spread |
| 24 | V12 sense divider | `R13/(R12+R13) = 10/92 = 0.1087`; ADC1 12 dB f.s. ≈ 3.1 V, GPIO abs-max 3.6 V (L1.05) | 11.65 V → **1.27 V**; 12.85 V → **1.40 V**; 24 V fault → **2.57 V** | stays under abs-max even at the wrong-brick corner ✓. Source impedance 8.9 kΩ, with C12 0.1 µF holding the sample against the SAR |
| 25 | LED-anode sense divider | `R15/(R14+R15) = 5.1/15.1 = 0.3377`, then R16 10 kΩ in series to the pin | V_O 2.99 V → **1.01 V**; open-LED 9.6 V → **3.24 V** (rails the ADC — an unambiguous fault code); shorted LED → **0.07 V** | three distinguishable states, which is what makes RK6/RK7/RK20 detectable. R16 bounds any clamp current to **≤ 90 µA** |
| **26** | **Cross-domain injection, 3V3 down — and why it self-limits** | Thevenin at each divider tap against the GPIO clamp sitting at `V(3V3) + 0.7 V`. **V12 tap:** `V_th = 1.266 V`, `R_th = R12‖R13 = 8.91 kΩ` ⇒ `I = (1.266 − V3 − 0.7)/8.91 kΩ`. **LED tap: zero** — with USB absent, R10 holds DIM low, U3 never switches, and LED+ is bled to ~0 V through R11 via L1 | **≤ 63.5 µA at V3 = 0, falling to zero at V3 = 0.566 V** | **The injection cannot hold the rail above ~0.57 V** — the clamp reverse-biases and the path shuts off. That is far below any ESP32 operating threshold, so the MCU is **held off, not left indeterminate**. **The first derivation used `(V12 − V_clamp)/R12`, which ignores R13 shunting to ground — wrong by 2.7× and, worse, it missed the self-limiting entirely (Pass 18).** **B3** confirms the real rail voltage |
| 27 | VBUS budget | unchanged from L1.01: 220 mA cont., ~560 mA WiFi-TX peak | **0 mA added** | every new part sits on V12; the dividers source *into* 3V3, they do not load it |
| 28 | C8 input capacitor | `C_IN(min) = I_F·t_ON/ΔV_IN(max)`, ΔV = 5 % of 12 V (Eq. 12); TI: use **2×** and rate for **2× V_IN** | need **0.55 → 1.09 µF**; **2.2 µF/50 V X7R 1210** chosen | ≈ 1.9 µF after DC-bias derating ✓. `I_IN(rms) = I_F√(D(1−D))` = **154 mA**, far under a 1210's rating |
| 29 | C7 bulk / hot-plug energy | `½CV²` = 0.5 × 100 µF × 12² | **7.2 mJ** at plug-in | limited by F2's R_i + D2; D2's I_FSM is **100 A / 8.3 ms** (Vishay 88751) ⇒ orders of margin |
| 30 | D3 TVS coordination | SMAJ15A: V_RWM **15 V**, V_BR min **16.7 V**, V_C max **24.4 V @ I_PP 16.4 A**, P_PP 400 W (10/1000 µs), I_D ≤ 5 µA at V_RWM | **no conduction at 13.2 V**; clamps below U3's 45 V abs-max, C7's 35 V and C8's 50 V | a sustained 24 V brick drives D3 into avalanche and F2 clears — **sacrificial by design** (RK4). Note the 24.4 V clamp transiently exceeds J4's 24 VDC rating — a microsecond event, accepted |
| 31 | F2 PTC coordination | 1812L050/30PR: I_hold **0.5 A**, I_trip **1 A**, **30 V**, R_i 150 mΩ | operating **113 mA = 23 %** of I_hold; ≈ 32 % after a 60 °C derate | the 30 V rating covers the wrong-brick fault. **The L1.01 PTC is 6 V-rated and must never be reused here** (RK21) |
| **32** | **LED thermal — the binding limit** | Lumileds DS41 Table 3: **case temp at 350 mA = −40…85 °C**; New Energy: **T_sp ≤ 105 °C**. Take the conservative **85 °C**. `P = V_F,max × I_F,max` | **P = 1.41 W** (cold-start corner) / **1.33 W** (self-consistent at T_j ≈ 72 °C) ⇒ allowed **θ(case→ambient) = 31.8 °C/W** at T_a 40 °C | all electrical input is treated as heat — conservative by ~30 %, which is the optical fraction |
| 33 | LED thermal — with HS1 | 882-100AB: **60 °C rise at 9 W = 6.7 °C/W** natural convection; **derated 2×** to 13.4 °C/W because natural convection is markedly worse at 1.4 W than at 9 W; + ~1.5 °C/W interface | `T_c = 40 + 1.41 × 14.9 =` **61.1 °C** ✓ | `T_j = T_c + 8 °C/W × 1.41 =` **72.4 °C** vs T_j max **135 °C** — **63 °C of margin**, and 24 °C on the binding case limit |
| 34 | LED thermal — **without** HS1 | bare 20 mm star in still air, θ ≈ 50–80 °C/W (**engineering estimate, not a datasheet number**) | `T_c = 40 + 1.41 × 65 =` **132 °C** ✗ | **exceeds the 85 °C case limit even at the nominal 0.99 W (104 °C)** ⇒ the heatsink is a *proven requirement*, not advice. **Measurement B1 owed** |
| 35 | LED thermal time constant | `θ_sink × (m·c)` = 13.4 K/W × (67 g × 900 J/kg·K) | **≈ 13 minutes** | the LED reaches steady state slowly — *"the temperature you measure after ten seconds is a lie"* is a lesson beat, and it sets the bring-up dwell time |
| 36 | U3 junction temperature | `P_U3 = 20b+20c+20d` at the 460 kHz corner = **104 mW**; RθJA **106.8 °C/W** (§6.4, SOIC-8) | `T_j = 40 + 11.1 =` **51.1 °C** | with the design-example's conservative 155 °C/W: **56.1 °C**. T_J 125 °C rec ⇒ **≥ 69 °C margin**. The `MRX` PowerPAD variant's 44.7 °C/W is **not needed** |
| 37 | D4 junction temperature | 20e = 134 mW; RθJA **55 °C/W on 14 × 14 mm copper pads** (Vishay 88751) | `T_j = 40 + 7.4 =` **47.4 °C** vs 150 °C | the 14 × 14 mm pad is a **layout requirement**, L-3 — without it the 55 °C/W is not the number |
| 38 | L1 derating | I_rms 357 mA vs **1.5 A** rated (24 %); I_peak 447 mA vs **I_sat 2.1 A** (21 %) | ✓✓ | I_sat also clears the LM3404's **1.8 A max** current limit — TI: *"the inductor's peak current rating must be above 1.5 A"* |
| 39 | LED-short fault | §8.2.1.2.2: output shorted ⇒ V_O falls to the 200 mV CS voltage, current stays regulated; `Δi = (V_IN−0.2)·t_ON/L` | **119 mA p-p, I_peak 417 mA** | benign — the part regulates into a short. RK7; the ADC reads 0.07 V (row 25) |
| 40 | Peak-current limit / OVP | I_LIM **1.2/1.5/1.8 A**; CS OVP at **300 mV** ⇒ `0.300/0.6138 =` **489 mA** hard cap | I_peak 447 mA is **9 %** under the OVP cap and **63 %** under I_LIM min | both fault caps sit above the operating peak and below the LED's rating |
| 41 | LED abs-max headroom | **conflicting sources**: Lumileds DS41 **500 mA DC**; New Energy StarBoard **1.23 A**. Design to the conservative 500 mA | `388/500 =` **78 %** worst case | see the part-truth note in §4. Also above DS41's *"operation below 100 mA not recommended"* at every duty the lesson uses |
| 42 | Linear alternative (rejected) | §2.5, TI SLVS044Z | **3.3 W of heat, 23.1 %, needs a 17.5 °C/W heatsink** | the number that decided the topology |

## 4 · IC selection (DO — lock the parts)

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U1 | Espressif **ESP32-S3-WROOM-1-N16R2** | Reused from L1.01 (validated). Quad PSRAM keeps GPIO35–37 free. | (verified in L1.01; pinout VERIFIED in the library) |
| U2 | Richtek **RT9080-33GJ5** | Reused from L1.01. Linear 3.3 V/600 mA LDO, MCU domain only. | (verified in L1.01) |
| D1 | STMicroelectronics **USBLC6-2SC6** | Reused. USB ESD array; ST as primary per l1-03 P13-5. | (verified in L1.01/L1.03) |
| **U3** | Texas Instruments **LM3404MAX/NOPB** (SOIC-8) | **NEW — the board.** 1 A COT hysteretic buck LED driver, V_IN **6–42 V**, integrated 1 A high-side MOSFET, cycle-by-cycle limit, **separate DIM pin**, 165 °C thermal shutdown, and *no control-loop compensation* — so every number in §3 is hand-derivable, which is why this part teaches better than a fixed-frequency controller. **The `MA` (plain SOIC-8) variant is deliberate over `MRX` (SO PowerPAD): no exposed pad ⇒ inside the L2 hand-solder envelope, and §3 row 36 proves the plain package's 106.8 °C/W is ~69 °C better than it needs to be.** | §5 pinout; §6.1 abs-max; §6.3 rec. op; **§6.4 thermal**; §6.5 EC (V_CS 194/200/206 mV, DIM V_IH 2.2/V_IL 0.8, I_DIM-PU 80 µA, R_DS(on) 0.37/0.75 Ω, I_LIM 1.2/1.5/1.8 A, T_SD 165 °C); **§6.6 switching — the ±23.6 % t_ON tolerance that drove the Pass-3 redesign**; §7.3.1–7.3.9 (COT, accuracy Eq. 3–4, V_O(max) Eq. 5, MOSFET/BOOT, PWM dimming, current limit, OVP/open-LED); §8.1.1–8.1.8 (ripple, C_O split Eq. 11, C_IN + **negative input impedance**, diode, glow Table 1, **CS hot-swap protection**); §8.2.1 worked example |
| **L1** | Bourns **SRR1208-101KL** | **NEW.** 100 µH ±10 % **shielded** SMD drum. The two numbers that matter: **I_sat 2.1 A** clears the LM3404's 1.8 A max current limit (the datasheet's own selection rule), and **DCR 170 mΩ max** holds the copper loss to 22 mW. Two large pads ⇒ trivially hand-solderable; shielded because the SW node is the board's only EMI source. The **value** is set by the §3 row 10 CS window, not by a ripple preference. | inductance/tolerance, I_rms, **I_sat**, DCR max, shielded construction |
| **D2, D4** | Vishay General Semiconductor **SS34-E3/57T** (SMC) | **REUSE — already in the library.** 40 V / 3 A Schottky, **V_F ≤ 0.5 V at 3 A** (far lower at 0.357 A), **I_FSM 100 A**, **RθJA 55 °C/W on 14 × 14 mm pads**, T_J 150 °C. One part, two jobs: **D2** *blocks* a reversed supply outright — a TVS-only mitigation would clamp at −0.7 V and violate U3's −0.3 V VIN abs-max — and **D4** freewheels the inductor. Oversized at 3 A deliberately: its low V_F is the single largest efficiency lever on the board. | Vishay 88751: V_RRM, I_F(AV), **I_FSM**, **V_F max**, I_R, **RθJA/RθJL + the pad condition**, T_J |
| **D3** | Littelfuse **SMAJ15A** (SMA) | **NEW.** 400 W uni-directional TVS across V12. **V_RWM 15 V** clears the 13.2 V rail corner (I_D ≤ 5 µA), **V_BR min 16.7 V**, and **V_C max 24.4 V @ 16.4 A** clamps below U3's 45 V, C7's 35 V and C8's 50 V. A sustained 24 V brick pushes it into avalanche and F2 clears — **sacrificial by design**, the same bargain l1-03 struck with its SMAJ5.0A. | V_RWM / V_BR / V_C @ I_PP / I_D / P_PP / T_J / package |
| **F2** | Littelfuse **1812L050/30PR** | **NEW.** PPTC, **0.5 A hold / 1 A trip, 30 V**, R_i 150 mΩ. **The L1.01 PTC (1206L050YR) is 6 V-rated and must not be reused on a 12 V rail** — the easiest mistake this board could have made, and the catalog actively invites it (RK21). The 30 V rating also covers the wrong-brick fault while D3 crowbars. | I_hold / I_trip / **V_max** / R_i / R_1 max |
| **R8** | Susumu **RL1632R-R620-F** (1206) | **NEW.** 0.62 Ω ±1 %, **1/2 W**, TCR 0/+100 ppm/°C. The entire current spec rides on this one resistor: its tolerance and TCR are two of the six terms in the §3 row 13 stack. 79 mW in a 500 mW part = **15.8 %**. | R / tol / **power** / **TCR** / package |
| **C7** | KEMET **ESL107M035AE3AA** | **NEW, and functional rather than decorative.** 100 µF/35 V radial, **ESR 85 mΩ at 100 kHz**. §3 row 21: without an ESR-bearing bulk capacitor the input filter's peak output impedance is 341 Ω against a −106 Ω converter input impedance and the front end oscillates; with C7 it is 0.17 Ω. **A low-ESR substitution is not like-for-like** — any ECN must re-run row 21. | C / V / **ESR at 100 kHz** / ripple current / temperature range |
| **LED3** | New Energy **LST1-01H06-3080-01** (LUXEON C on a 20 mm star) | **NEW.** The load. 3000 K, CRI 80, **V_F 2.75 V typ @ 350 mA, T_j 85 °C**, on an aluminium MCPCB with screw holes and solder pads — so the learner **never hand-solders a leadless emitter** and 1 W of heat never enters the FR4. **⚠ Part-truth conflict, resolved conservatively:** the star sheet rates it **1.23 A DC / T_sp 105 °C** while the underlying **Lumileds LUXEON C DS41 rates 500 mA DC / case 85 °C at 350 mA** — the two disagree because the star carries a later LUXEON C generation than DS41 (2014) documents. **Every number in §3 uses the conservative DS41 envelope**, and the design point clears *both*. Receiving inspection should confirm the delivered die generation. | New Energy StarBoard DS v1.0 (selection table, max ratings, mechanicals); **Lumileds DS41 Table 2 (V_F 2.80/2.95/3.57 V, −3.0 mV/°C, r_D 0.64 Ω, RθJ-C 8 °C/W) + Table 3 (500 mA, T_j 135 °C, case 85 °C @ 350 mA, "not designed to be driven in reverse bias")** |
| **HS1** | Wakefield Thermal Solutions **882-100AB** | **NEW, and a BOM line rather than a note** — §3 rows 32–34 prove the board does not meet its own thermal spec without it. Radial-fin sink made for star LED packages; **60 °C rise at 9 W ⇒ 6.7 °C/W** natural convection; six #4-40 holes take the 20 mm star directly. Even derated 2× for our far lower power it has 2.1× the margin required. | 882-series DS (natural/forced convection table, mounting-hole pattern, height/weight) |
| — | *(rejected)* Texas Instruments / STMicroelectronics **LM317** (TO-220) | The linear candidate, worked in §2.5, sourced in §8 as a **lab kit** so the comparison is measured. **Not a board BOM line.** | SLVS044Z §6.1/6.3/6.4/6.6: V_ref 1.2/1.25/1.3 V, min load 3.5/10 mA, **V_I−V_O 3–40 V**, T_J 0–125 °C rec / 150 abs, **RθJA 23.5 (KCS) / 37.9 (KCT) °C/W** |
| — | *(rejected)* an output-overvoltage **Zener clamp** (TI Fig. 18) | Considered in Pass 7 to bound the reverse voltage on a **backwards-connected LED** from 9.6 V to ~5.5 V. **Rejected:** the LUXEON C publishes **no reverse rating**, so neither 9.6 V nor 5.5 V can be *proven* safe, and the Zener's sub-knee leakage injects directly into the CS node through R9 — trading an unprovable benefit for a real, unbounded current error. RK20 mitigates by prevention + millisecond firmware detection instead. | SNVS465G §7.3.9 (Fig. 18) and §8.1.8.2 (Fig. 23/24) |

**Supporting passives (named by value, not brand — so a like-for-like ECN never
invalidates this doc or the lesson prose; exact MPNs are in `bom.csv` and §8):**
C8 = 2.2 µF/50 V X7R 1210 (LM3404 C_IN); **C11 = 2.2 µF/50 V X7R 1210 (output ripple
split + ring damping — same part as C8)**; C9 = 10 nF/50 V X7R (bootstrap, *the
datasheet mandates 10 nF X7R*); C10 = 0.1 µF/50 V X7R (VCC filter, *the datasheet
mandates 100 nF X7R*); C1–C6, C12, C13 = the L1.01 core values;
R7/R12 = 82 kΩ 1 %; R9/R10 = 1 kΩ 1 %; R11/R13/R14/R16 = 10 kΩ 1 %; R15 = 5.1 kΩ 1 %.

> **Silkscreen rule (part of the lesson):** mark **J4 "12 V DC ONLY — centre +"**; mark
> **J5 "LED+ / LED−"** and that it is *not* a power input; put **"HEATSINK REQUIRED"**
> next to J5, because §3 row 34 says the board is out of spec without one; mark C7 and
> every diode's polarity and U3's pin 1; label **TP3–TP6**; and mark **GPIO4/5/6 as
> in-use** on the breakout headers (RK12).

## 5 · Power & thermal

**This section carries the two `hasThermalConcern` conditional attestations (§7).**

**Rails.**
- **3V3** — RT9080 from VBUS, MCU only. Unchanged from L1.01.
- **VBUS 5 V** — USB-C through F1 (0.5 A hold) and D1. **No new load** (§3 row 27).
- **V12** — external regulated 12 V, 10.8–13.2 V, through F2 → D2 → [D3 ‖ C7 ‖ C8] →
  U3. Board draw **113 mA** worst case. **V12 and VBUS share only GND** (E3).
- **LED string** — one series LED at 357 mA, off-board, returning through R8 to the
  Kelvin star ground at R8/C8/D4.

**Worst-case dissipation, every part that dissipates anything (T_a = 40 °C):**

| Part | P (worst case) | Limit | Heat path | Margin |
| --- | --- | --- | --- | --- |
| **LED3** (off-board) | **1.41 W** | case ≤ **85 °C**, T_j ≤ 135 °C | star → HS1 (6.7 °C/W, derated to 13.4) | T_c **61.1 °C**, T_j **72.4 °C** — 24 °C / 63 °C |
| **D4** recirculating | 134 mW | T_J 150 °C | SMC on 14 × 14 mm pads, 55 °C/W | T_j **47.4 °C** — 103 °C |
| **U3** LM3404 | 104 mW | T_J 125 °C rec | SOIC-8, RθJA 106.8 °C/W | T_j **51.1 °C** — 74 °C |
| **R8** sense | 79 mW | 500 mW | 1206 | **15.8 % of rating** |
| **D2** series block | 54 mW | T_J 150 °C | SMC, same pads | T_j **43.0 °C** — 107 °C |
| **L1** | 22 mW | 1.5 A rms / 2.1 A sat | shielded drum | **24 % / 21 %** |
| **R11** glow bleed | 3.6 mW | 125 mW (0805) | 0805 | 3 % |
| **F2** PTC | 1.8 mW | 0.5 A hold (≈0.35 A at 60 °C) | 1812 | **23 % / 32 %** |
| **C8, C11** | I_rms 154 mA / ripple | ≫ | 1210 X7R | ✓ |
| **U2** LDO | ≤ 1 W transient | (L1.01) | unchanged | (proven in L1.01) |

**The heatsink is a requirement, not a recommendation.** §3 rows 32–34: the LED's
*case* limit (85 °C, the conservative of the two conflicting sources) allows
**31.8 °C/W** from star to ambient at T_a 40 °C and 1.41 W. A bare 20 mm star in still
air is roughly 50–80 °C/W and **fails even at the nominal 0.99 W**. HS1 at a 2×-derated
13.4 °C/W plus ~1.5 °C/W of interface gives 14.9 °C/W and passes with 2.1× margin. The
bare-star figure is the one number in this doc that is an **engineering estimate rather
than a datasheet value**, so it is owed a measurement (B1) — and the design does not
*depend* on it, because the mitigation is unconditional either way.

**Derating summary (the second conditional attestation).** Every thermally-stressed
part above runs at **≤ 32 % of its rated limit**; the three junction temperatures that
matter sit **≥ 63 °C below** their maxima; and the two hard current caps inside the
LM3404 (OVP at 489 mA, I_LIM ≥ 1.2 A) both sit **above** the 447 mA worst-case peak and
**below** the LED's conservative 500 mA rating — so a control fault clamps before the
load is stressed.

**Layout constraints (captured at `[D]`, verified at `[L]`):**
- **L-1** — the switching cluster (U3, L1, D4, C8, C11) and the 12 V input cluster sit
  at the **opposite board edge from the WROOM antenna**; the antenna keep-out excludes
  **all** copper layers (L1.01 M5).
- **L-2** — the **SW loop** (U3.SW → L1 → LED return → R8 → GND → C8 → U3.VIN) is the
  board's only high-di/dt loop. Keep it physically small; C8 within a few mm of pins
  8/4; the CS trace (R9 → pin 5) short and away from SW. TI §10.1.
- **L-3** — **D2 and D4 each get ~14 × 14 mm of copper**, the condition their 55 °C/W
  is specified on (§3 row 37).
- **L-4** — **Kelvin sense on R8.** The R8 high side feeds R9 on a dedicated trace, and
  the R8 low side returns to **U3 pin 4** on a dedicated trace; neither may share
  copper with the switching return. The sense signal is 51 mV of ripple on a 200 mV DC
  level — an IR drop of a few mV in shared ground copper is a several-percent current
  error. **Star point at R8-low / C8-return / D4-anode.**
- **L-5** — **V12 and VBUS copper never touch.** An ERC/DRC net-isolation rule asserts
  it (the DV item, §7).
- **L-6** — J4 (barrel) and J5 (screw terminal) on the **same edge**, physically
  separated and unambiguously silked, so the 12 V lead cannot reach J5 (RK5).
- **L-7** — C7 is a radial can; capture its Z-height in the enclosure keep-out (the
  l1-03 L9-1 lesson). L1 is a ~12.5 mm square body — allocate the courtyard early.
- **L-8** — both ADC divider taps (C12, C13) sit next to their GPIO pins, not next to
  the SW node; route them away from L-2's loop.

## 6 · Risk register

IDs `RK#` (risks ≠ reference designators).

| # | Risk | L × I | De-risk | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **LED cooked — no heatsink, or one too small** | **High × High** | §3 rows 32–34 turn this into arithmetic: θ(star→ambient) ≤ **31.8 °C/W**; **HS1 is a BOM line**; silk says "HEATSINK REQUIRED"; the bring-up step measures the star temperature **after a 13-minute dwell** (row 35) before the LED is left running. Firmware can additionally fold back on the V_F droop read at GPIO5. | **DE-RISKED** |
| **RK2** | **Current set wrong or drifting** (the whole point of the board) | Med × High | One resistor sets it (R8, 1 %, ≤100 ppm/°C) against a 194–206 mV threshold; the full six-term worst-case stack gives **324–388 mA** (§3 row 13), which is what F2 now claims. | **DE-RISKED** |
| **RK3** | **Reverse-polarity 12 V supply** (centre-negative brick) | Med × High | **D2 blocks** rather than clamps — nothing conducts, so U3's VIN never goes below −0.3 V, which a TVS-only mitigation *would* have violated. D2's V_RRM 40 V covers a reversed 24 V brick. Plus silk and the barrel-jack convention. | **DE-RISKED** |
| **RK4** | **24 V (or higher) brick into J4** | Med × High | **D3 SMAJ15A** avalanches above 16.7 V and **F2 (30 V, 1 A trip)** clears — a sacrificial, resettable pair. U3 itself survives 24 V (42 V rated) and would even regulate, so the failure is loud rather than silent. Silk "12 V DC ONLY". | **DE-RISKED (sacrificial)** |
| **RK5** | **12 V lead plugged into the LED terminal** | Med × High | **Designed out**: 12 V arrives on a *barrel jack* and J5 is the board's only screw terminal, so the two are not interchangeable. This is why a third terminal for a thermistor was cut in Pass 9. | **DE-RISKED (by connector choice)** |
| **RK6** | **LED unplugged / open-circuit while running** — a routine action, not a rare fault | **High** × Med | V_O rises to at most **9.6 V** (§3 row 19), which TI says the output stage withstands indefinitely; **C11** damps the ring; the OVP comparator caps peak current at 489 mA; firmware sees GPIO5 rail to 3.24 V (row 25) and drops DIM. | **DE-RISKED** |
| **RK7** | **LED leads shorted** | Med × Med | The part regulates into a short at V_O = 200 mV; ripple grows to 119 mA p-p, peak 417 mA (§3 row 39) — below every limit. GPIO5 reads 0.07 V, an unambiguous signature. | **DE-RISKED** |
| **RK8** | **CS pin destroyed by hot-swapping the LED module** — TI documents this failure explicitly, and **C11 makes the path real** (residual charge on a 2.2 µF cap couples straight to CS) | Med × High | **R9 1 kΩ in series with CS** (TI §8.1.8.1): the datasheet's own worked case shows it absorbing a 33 V / 49 A transient. Costs 0.05 % of the setpoint. | **DE-RISKED** |
| **RK9** | **LED glows faintly when "off"** — real for a single LED per TI Table 1 | Med × Low | **R11 10 kΩ** SW→GND, stronger than the 20 kΩ the table gives for n = 1 (§3 row 17). TI: *"the luminaire designer must ensure that the suggested resistor is effective"* ⇒ confirm in a dark room at bring-up (B4). | **DE-RISKED** (visual confirm owed) |
| **RK10** | **LED on at power-up before firmware runs** — DIM floats high by design | **High** × Med | **R10 1 kΩ pull-down** overrides the 80 µA internal pull-up with **0.72 V of margin** to V_IL (§3 row 14). Hardware-enforced, so it holds while unprogrammed, in reset, and with USB absent. | **DE-RISKED** |
| **RK11** | **Inductor saturation** in a fault | Low × Med | I_peak 447 mA vs **I_sat 2.1 A**; even at the LM3404's 1.8 A max current limit the core is unsaturated — the datasheet's stated selection rule (§3 row 38). | **DE-RISKED** |
| **RK12** | **GPIO4/5/6 also appear on the breakout headers** — a learner wiring to them fights the driver | Med × Med | Inherited pattern from l1-03 (GPIO5). Silk-mark the three pins as in-use; the guide names them; the header pins stay electrically safe (dividers ≥ 10 kΩ; DIM has a 1 kΩ pull-down that a GPIO can override but a passive wire cannot). | accept + document |
| **RK13** | **Switching-node EMI** into the WROOM antenna, the USB link, or the ADC readings; and the 12 V brick lead as a radiator | Med × Med | Shielded inductor; small SW loop (L-2); 208–460 kHz fundamental; switching cluster at the far edge from the antenna (L-1); both ADC taps filtered and routed away (L-8); C7+C8 as the input filter (row 21). No common-mode choke — accepted for a DC-brick-fed teaching board. Confirm at bring-up with WiFi on and the LED at 50 % duty. | de-risked (design) + `[L]` |
| **RK14** | **12 V present, USB absent → current into an unpowered 3V3 rail** through the ADC clamps | Low × Low | Quantified properly in §3 row 26 (Pass 18 corrected an earlier, wrong 172 µA figure): only the V12 divider contributes, at **≤ 63.5 µA**, and it is **self-limiting — the clamp reverse-biases at V(3V3) = 0.566 V**, far below any ESP32 threshold. So no abs-max is exceeded, **the LED cannot light** (RK10 is independent of 3V3), and the MCU is **held off rather than part-started**. **Documented power order: USB first, then 12 V**; confirmed at bring-up (B3). | **DE-RISKED** (bounded + self-limiting) |
| **RK15** | **Hot-plug inrush into C7 (7.2 mJ)** erodes the barrel-jack contacts over many cycles | Low × Low | Standard for barrel-jack DC entry; D2's I_FSM 100 A and F2's R_i bound the peak; guide rule: "switch the brick at the outlet, not at the jack." | accept + document |
| **RK16** | **V_F sensing is a coarse thermometer** — the lesson leans on it | Med × Low | Honestly scoped: the ESP32 ADC's **±50 mV** absolute band (L1.05 K5) over a 0.34 divider is **±0.15 V** on V_F — useless absolutely, fine *relatively* (offset and gain errors are per-chip constants), against a −3.0 mV/°C × 50 °C ≈ 0.15 V real swing. Firmware oversamples; the guide teaches relative droop and uses a DMM for absolute V_F. | accept + document |
| **RK17** | **The wrong LM3404 variant is bought** (`MRX`/PowerPAD instead of `MA`) | Med × Med | Both are stocked and differ by one letter. `bom.csv` carries the full `LM3404MAX/NOPB`; §4 states the reason; the library entry must record "SOIC-8, **no** exposed pad" so a future substitution cannot silently move to a package the learner cannot solder. | **DE-RISKED (documented)** |
| **RK18** | **Protection parts fail silently** — D3 fails short (dead V12, no indicator), F2 degrades, D2 fails open (board simply dark) | Low × Med | There is no rail LED on V12. **Document the symptom set:** LED dark with 12 V applied *and* GPIO4 reading ≈ 0 ⇒ suspect D3 shorted or F2 tripped; GPIO4 normal but the LED dark ⇒ suspect DIM/firmware or the LED itself (GPIO5 disambiguates). The rail sense is what makes this diagnosable at all. | accept + document (the l1-03 RK17 lesson applied) |
| **RK19** | **C11 (2.2 µF) sits charged to ~9.6 V after an open-LED event and dumps into the LED when it is re-plugged** | Low × Low | Energy = `½CV²` = **101 µJ**, ~30× below the LUXEON C's 8 kV-HBM ESD energy, and lead inductance limits di/dt. Firmware's open-LED detection (RK6) drops DIM within milliseconds, after which C11 discharges through R14+R15 with **τ = 33 ms** — so by the time a hand moves, it is flat. | **DE-RISKED** |
| **RK20** | **LED connected backwards** — 2-wire screw terminal, no key, $9.42 part | **Med × High** | **No hardware clamp** (§4: the Zener was considered and rejected — the LED has no published reverse rating, so neither 9.6 V nor 5.5 V is *provable*, and the Zener adds an unbounded CS error). Instead: **(a) prevent** — polarity on the silk, on the star, and in a checked guide step, with a colour-coded red/black lead specified in the kit; **(b) detect fast** — firmware must read GPIO5 within 1 ms of asserting DIM and drop DIM if it is outside 2.4–4.2 V, bounding the exposure to ~2 ms of *reverse voltage at essentially zero current* (a blocking LED conducts only leakage); **(c) document** the residual and measure the real V_O in the reversed case at bring-up. Same posture l2-01 took on cell reversal: connector discipline plus documentation, not a part that only looks protective. | accept + document (bounded) |
| **RK21** | **The 6 V L1.01 PTC is reused on the 12 V rail** by a future editor or an ECN | Med × High | F1 (1206L050YR, **6 V**) and F2 (1812L050/30PR, **30 V**) are both on this BOM, one line apart. Both `bom.csv` notes and §4 spell out that F1 is USB-only and must never migrate; the two parts are in different case sizes (1206 vs 1812) so the footprints are not interchangeable either. | **DE-RISKED (by package + documentation)** |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board**:

- [x] **Calc trail recorded** — every derived value (on-time and its tolerance,
      frequency band, the CS ripple window, the sense resistor, the six-term current
      stack, the ripple split, all ten loss terms, three junction temperatures, the
      input-filter stability criterion, TVS/PTC coordination, both dividers) traces to
      a source (§3). `[D]`
- [x] **Each IC datasheet-verified** — U3 LM3404 ✓ (SNVS465G §§5–8 read, including the
      §6.6 on-time tolerance that changed the design); L1 ✓; D2/D4 SS34 ✓ (Vishay
      88751); D3 SMAJ15A ✓; F2 ✓; R8 ✓; C7 ✓ (ESR is load-bearing); **LED3 ✓ with the
      500 mA-vs-1.23 A conflict documented and resolved conservatively** (§4); U1/U2/D1
      inherited from L1.01. `[D]`
- [ ] **Footprint ↔ pinout cross-checked** — **OWED `[S]`** (schematic stage): no KiCad
      symbols or footprints are assigned yet. Intended pinouts are captured in §2 (U3's
      8 pins, U1's 41) so the check has something to verify against.
- [ ] **Fab-DRU DRC accounted for** — **OWED `[L]`** (layout stage), including the
      **ERC/DRC rule that V12 and VBUS copper are never joined** (E3) and constraints
      L-1…L-8 (§5).
- [x] **BOM availability confirmed** — all 32 lines screened against the **live DigiKey
      API on 2026-07-30**: every line Active and in stock, **zero OOS, zero
      NRND/obsolete**. Four candidate driver ICs were **rejected on lifecycle** by that
      same screen (§8). `[D]` *The owner's visual re-confirm at buy time is his
      attestation, not mine.*
- [x] **All top (design-stage) risks de-risked** — RK1–RK11, RK17, RK19, RK21
      de-risked; RK13 de-risked in design with an `[L]` confirm; RK12, RK14, RK15,
      RK16, RK18, RK20 are **accept + document** with the bound, the symptom or the
      rule written down. `[D]`

Conditional — **fired by `hasThermalConcern = true`** (the flag change this doc
requires; `canonical-checklist-templates.ts:209-219`):

- [x] **Thermal budget verified** — worst-case dissipation for **every** dissipating
      part, the copper pour or heatsink each depends on, and three junction
      temperatures against their abs-max: LED T_j **72.4 °C** / 135 °C (and the binding
      case limit 61.1 °C / 85 °C), U3 T_j **51.1 °C** / 125 °C, D4 T_j **47.4 °C** /
      150 °C (§5 table; §3 rows 32–37). `[D]`
- [x] **Derating applied** — every thermally-stressed part at **≤ 32 %** of its rated
      limit (R8 15.8 %, L1 21 %/24 %, F2 23 %, D2/D4 far below), and both internal
      current caps bracket the operating point correctly (§5). `[D]`

> These are *attestations* (a human checked), except BOM availability (live DigiKey)
> and DRU presence, which are verifiable. `[S]`/`[L]` items are explicitly **owed at
> their phase**, not waived.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** **~$30**. **Actual $40.62 — over target**, and the overage
  is concentrated and honest: **LED3 $9.42 + HS1 $4.83 = $14.25, 35 % of the BOM.** A
  high-power LED on an MCPCB with a real datasheet plus a heatsink with a real θ curve
  is what this lesson costs; the alternative is an unsourceable marketplace emitter
  with no thermal data, which would gut §5. **L1.01 core = $15.00; the driver side =
  $25.62.** Value engineering at freeze, in order: (a) `LST1-01H06-4080-01` at **$5.71**
  — same star, neutral white, **currently 0 stock**; (b) a shorter 882-series sink;
  (c) drop D2 to SS14 (SMA, $0.49) at the cost of ~20 mW and a re-run of §3 row 20g.
  `Project.targetCost` is null (l1-03 F3) — set it when the flag is fixed.

### Sourcing evidence — live DigiKey screen, 2026-07-30 (all 32 lines, zero OOS)

| Ref | (manufacturer, mpn) — **exact import string** | Pkg | DK stock | $ ea | Lifecycle | New? |
| --- | --- | --- | --- | --- | --- | --- |
| U3 | `Texas Instruments` / `LM3404MAX/NOPB` | SOIC-8 (no EP) | **1,110** | 2.28 | Active | NEW |
| L1 | `Bourns` / `SRR1208-101KL` | shielded drum | **4,288** | 0.94 | Active | NEW |
| D2, D4 | `Vishay General Semiconductor` / `SS34-E3/57T` | SMC | **15,139** | 1.02 | Active | reuse (in library) |
| D3 | `Littelfuse` / `SMAJ15A` | SMA | **16,764** | 0.48 | Active | NEW |
| F2 | `Littelfuse` / `1812L050/30PR` | 1812 | **29,892** | 1.24 | Active | NEW |
| R8 | `Susumu` / `RL1632R-R620-F` | 1206 | **114,749** | 0.25 | Active | NEW |
| R7, R12 | `Yageo` / `RC0805FR-0782KL` | 0805 | **23,507** | 0.10 | Active | NEW |
| R9, R10 | `Yageo` / `RC0805FR-071KL` | 0805 | **445,287** | 0.10 | Active | NEW |
| C8, C11 | `Samsung Electro-Mechanics` / `CL32B225KBJNNNE` | 1210 | **218,134** | 0.45 | Active | NEW |
| C9 | `Samsung Electro-Mechanics` / `CL21B103KBANNNC` | 0805 | **2,321,531** | 0.10 | Active | NEW |
| C7 | `KEMET` / `ESL107M035AE3AA` | radial THT | **143,334** | 0.27 | Active | NEW |
| J4 | `Same Sky` / `PJ-102AH` | THT R/A | **74,616** | 0.72 | Active | NEW ⚠ |
| J5 | `TE Connectivity` / `282837-2` | 5.08 mm THT | **157,813** | 0.95 | Active | reuse |
| LED3 | `New Energy` / `LST1-01H06-3080-01` | 20 mm star | **540** | 9.42 | Active | NEW |
| HS1 | `Wakefield Thermal Solutions` / `882-100AB` | radial-fin sink | **1,375** | 4.83 | Active | NEW |
| C1 | `KEMET` / `C0805C106K3PACTU` | 0805 | 126,056 | 0.29 | Active | reuse |
| C2–C4, C10, C12, C13 | `Samsung Electro-Mechanics` / `CL21B104KBCNNNC` | 0805 | 6,948,631 | 0.10 | Active | reuse |
| C5, C6 | `Würth Elektronik` / `885012207103` | 0805 | 10,151 | 0.31 | Active | reuse |
| D1 | `STMicroelectronics` / `USBLC6-2SC6` | SOT-23-6 | 79,125 | 0.57 | Active | reuse |
| F1 | `Littelfuse` / `1206L050YR` | 1206 | 19,788 | 0.64 | Active | reuse (**USB only** — RK21) |
| J1 | `GCT` / `USB4110-GF-A` | USB-C R/A | 183,940 | 1.27 | Active | reuse |
| J2, J3 | `Sullins Connector Solutions` / `PRPC040SAAN-RC` | 1×40 THT | 52,246 | 1.23 | Active | reuse |
| LED1 / LED2 | `Würth Elektronik` / `150080RS75000` · `150080YS75000` | 0805 | 84,821 / 47,851 | 0.19 | Active | reuse |
| R1, R2, R11, R13, R14, R16 | `Yageo` / `RC0805FR-0710KL` (10 kΩ) | 0805 | 3,149,543 | 0.10 | Active | reuse |
| R3, R4, R15 | `Yageo` / `RC0805FR-075K1L` (5.1 kΩ) | 0805 | 213,955 | 0.10 | Active | reuse |
| R5, R6 | `Yageo` / `RC0805FR-07470RL` (470 Ω) | 0805 | 146,292 | 0.10 | Active | reuse |
| SW1, SW2 | `Omron` / `B3F-1000` | THT | 40,087 | 0.35 | Active | reuse |
| TP1 / TP2 | `Keystone Electronics` / `5010` · `5011` | THT | 238,386 / 289,335 | 0.30 / 0.27 | Active | reuse |
| U1 | `Espressif Systems` / `ESP32-S3-WROOM-1-N16R2` | module | 8,237 | 6.32 | Active | reuse |
| U2 | `Richtek` / `RT9080-33GJ5` | TSOT-23-5 | 94,938 | 0.28 | Active | reuse |

> ⚠ **Exact-string caution on J4.** DigiKey returns the manufacturer as **`Same Sky
> (Formerly CUI Devices)`**. The library's convention strips corporate suffixes
> (`Littelfuse`, not "Littelfuse Inc."; `Bourns`, not "Bourns Inc." — both confirmed
> against live library rows), so `bom.csv` uses **`Same Sky`**. **Confirm this string
> at part creation** — a mismatch is a silent BOM-import miss, the l1-03 F12/P13-5
> failure mode. The same care applies to `New Energy`, `Susumu` and `Wakefield Thermal
> Solutions`, which are new manufacturers in this catalog.

- **New parts to create BEFORE import — 13, exact strict-match `(manufacturer, mpn)`
  strings:**
  1. `Texas Instruments` / **`LM3404MAX/NOPB`** (U3 — SOIC-8, **no exposed pad**; record
     that in the part description so a future ECN cannot drift to the PowerPAD variant)
  2. `Bourns` / **`SRR1208-101KL`** (L1 — 100 µH, **shielded**)
  3. `Littelfuse` / **`SMAJ15A`** (D3)
  4. `Littelfuse` / **`1812L050/30PR`** (F2 — **30 V**, not the 6 V F1 part)
  5. `Susumu` / **`RL1632R-R620-F`** (R8 — 0.62 Ω 1 % ½ W 1206)
  6. `Yageo` / **`RC0805FR-0782KL`** (R7, R12)
  7. `Yageo` / **`RC0805FR-071KL`** (R9, R10)
  8. `Samsung Electro-Mechanics` / **`CL32B225KBJNNNE`** (C8, C11)
  9. `Samsung Electro-Mechanics` / **`CL21B103KBANNNC`** (C9)
  10. `KEMET` / **`ESL107M035AE3AA`** (C7 — record the **85 mΩ ESR**; it is functional)
  11. `Same Sky` / **`PJ-102AH`** (J4 — ⚠ string, see above)
  12. `New Energy` / **`LST1-01H06-3080-01`** (LED3)
  13. `Wakefield Thermal Solutions` / **`882-100AB`** (HS1 — a mechanical/thermal item
      with a refDes and no schematic symbol)

  **Already in the library (19 lines reused):** the whole L1.01 core, plus
  `Vishay General Semiconductor` / `SS34-E3/57T` (D2, D4) and `TE Connectivity` /
  `282837-2` (J5). Four of the thirteen introduce **new manufacturers** to the
  catalog — `Susumu`, `Same Sky`, `New Energy`, `Wakefield Thermal Solutions` — so
  their strings carry the highest import risk.

- **Rejected on lifecycle by the same screen** (recorded so the next board does not
  re-tread it): Diodes **AL8805W5-7** SOT-25 — *obsolete, 0 stock*; Diodes
  **AL8807W5-7** — obsolete; Diodes **ZXLD1350ET5TA** — Active but **0 stock**; onsemi
  **CAT4201TD-GT3** — *obsolete despite 81,000 units of stock* (stock is not lifecycle).
  The only in-stock, Active, non-leadless alternatives were **ZXLD1362ET5TA**
  (TSOT-23-5, $3.74) and **AL8862SP-13** (SO-8 **with exposed pad** — outside the
  hand-solder envelope).
- **Second sources noted for:** U3 → **LM3404HVMA/NOPB** (same SOIC-8 pinout, 75 V, 828
  stock, $3.03; a true drop-in) and **ZXLD1362ET5TA** (different pinout — a redesign,
  not a substitution); L1 → Bourns **SDR1105-101KL** (100 µH, I_sat 2.8 A, DCR 320 mΩ —
  costs ~18 mW, and it is **unshielded**, so re-check RK13); R8 → Stackpole
  **CSR1206FTR620** / Panasonic **ERJ-8BQFR62V**; D2/D4 → **SS14-E3/61T** (SMA, 1 A) —
  expect a higher V_F at 0.357 A, so **re-run §3 row 20e/20g** if substituted;
  **C7 → Würth `860040573004` only after checking its ESR** (§3 row 21 makes ESR
  functional — a low-ESR polymer substitute would *break* the input filter);
  LED3 → New Energy **XQEAWT-00-0000-00000HDE5-SB01** (Cree XQ-E star, V_F 2.9 V, 1 A
  max, $10.61, 260 stock) — spec-compatible at 357 mA; HS1 → **882-200AB**. The 0805
  R/C are commodity.
- **Not board BOM lines, but part of the kit:**
  - **The 12 V supply** — the learner's own brick, exactly as l1-03's 5 V injection
    supply is. **Requirement: regulated 12 V DC, ≥ 300 mA, centre-positive 2.1 × 5.5 mm.**
    The board draws 113 mA.
  - **A red/black 2-wire lead** for the LED star (RK20 prevention).
  - **The §2.5 comparison kit**, so the linear/switching decision is measured rather
    than read: `STMicroelectronics` **LM317T** (TO-220, 31,328 stock, $1.04),
    `YAGEO` **RSF100JB-73-3R6** (3.6 Ω 5 % 1 W axial, 1,839 stock, $0.23), and
    `Assmann WSW Components` **V5237BP-T** (TO-220 heatsink, **15.0 °C/W** natural,
    1,936 stock, $0.64) — **$1.91**, and with that sink the LM317 runs at
    `40 + 3.61 × (15 + 5 + 1) = 116 °C`, inside its 125 °C recommended T_J, so the
    experiment is safe as well as vivid. *(DigiKey returns this Yageo line as `YAGEO`
    in upper case while the 0805 lines return `Yageo` — another reason these three stay
    out of `bom.csv`.)*
- **BOM frozen:** **not yet** — and freeze is gated on the owner creating the parts,
  importing this `bom.csv`, and then advancing the revision. **No part has been
  created, no BOM imported and no revision advanced by this design pass.**

## 9 · Owed at later phases

| # | Owed | Phase | Why it cannot close now |
| --- | --- | --- | --- |
| S1 | Footprint ↔ symbol ↔ pinout, pad by pad, for all 13 new parts (and a re-confirm of the 19 reused ones) | `[S]` | No KiCad symbols/footprints assigned yet (protocol F7) |
| L1 | Fab-DRU DRC clean + the **V12 ⟂ VBUS** net-isolation ERC + L-1…L-8 | `[L]` | Needs a routed board |
| **B1** | **Bare-star θ(case→ambient)** — the one estimated number in §3 (row 34) | bring-up | No manufacturer publishes it; measure with and without HS1 after a 13-minute dwell (row 35) and fold the real value back |
| **B2** | **SS34 V_F at 0.357 A and 25/85 °C** | bring-up | §3 rows 20e/20g are bounded by the 3 A guarantee; the measurement closes the 71 %→76 % efficiency spread |
| **B3** | **3V3 rail voltage with 12 V applied and USB absent** | bring-up | §3 row 26 predicts it settles at **≤ 0.566 V** and self-limits; the arithmetic is clean but the module's own leakage is not modelled, so confirm the number rather than trust it (RK14)s on module leakage |
| **B4** | **Off-state glow, dark room**, and the reversed-LED V_O | bring-up | TI explicitly makes the glow resistor the designer's to verify (RK9); RK20's residual needs the real number |

---

## Friction log

| # | Stage | Friction | Severity | Follow-up |
| --- | --- | --- | --- | --- |
| **G1** | **Pipeline / flags** | **The seed script can never turn on the two conditional audits that matter most.** `populate-curriculum-dag.ts` sets `criticalPath`, `hasMainsNet` and `requiresStripboard` for **all 27** boards and sets **`hasLiIon` and `hasThermalConcern` for none**, both of which default `false` (`prisma/schema.prisma:181-182`). So the Li-ion and deep-thermal conditionals — the two that exist precisely because those board classes can hurt someone — are off by construction on every board, and only a human remembering to flip them turns them on. This board found it as a per-board defect (Pass 8) and Pass 16 proved it systemic. **Read-across: `l2-01-battery-power-module` asserts both flags true in its design doc and the seed would have left both false.** l1-03's F1 was the mirror image (a flag wrongly *true*), which is the benign direction. | **High** | Add the two flags to the seed script's per-board records, with `hasThermalConcern: true` on l2-04 and `hasLiIon: true, hasThermalConcern: true` on l2-01, and re-seed. Until then: **audit every flag against the topology when a board's design.md is first written** — three boards in, the seed has been wrong every time it mattered. |
| G2 | Design / sourcing | **Three of the five obvious buck-LED-driver ICs are obsolete or out of stock**, and one (CAT4201) shows 81,000 units while being marked obsolete — **stock is not lifecycle**. Picking by "what everyone uses" would have chosen a dead part. | Med | Screen lifecycle **and** stock on the first candidate list, before any math is done against a specific part. Pass 2 did; Pass 1 had not. |
| G3 | Design / parts | **A relabelled module can carry ratings its own die's datasheet contradicts** — the star says 1.23 A / 105 °C, the LUXEON C DS41 says 500 mA / 85 °C. This is l1-03's F8 (the WS2812 clone) recurring in a different costume. | Med | Design to the conservative intersection, name both sources in §4, and put the die-generation check in receiving inspection. Candidate standing rule: *when two datasheets describe the same part, the design uses the intersection and the doc names both.* |
| **G4** | **Protocol / method** | **The nominal-value calculation hid a violated constraint.** The first design (L 100 µH, R_ON 68 kΩ) looked healthy at every typical value and sat **0.8 %** above the datasheet's CS SNR floor once the LM3404's **±23.6 % on-time tolerance** was applied. A ±24 % tolerance on a *timing* parameter is not where anyone looks first — the eye goes to voltages and currents. | **High** | The fix that worked: stop hand-evaluating corners and **write the worst-case model as code** (`validation-log.md` Pass 3), then *search* the component space against the datasheet's own inequalities. Recommend `_protocol.md` add: *"where three or more independent tolerances meet in one inequality, evaluate it by program, not by hand."* |
| G5 | Design / thermal | **The one number this board could not source is the bare-star θ_JA** — nobody publishes it because nobody intends you to run a star bare. The design is structured so it does not depend on that number (the mitigation is unconditional), but the *proof that the heatsink is required* leans on an estimate. | Low | Measure it at bring-up (B1) and fold the real value into §3 row 34 — it converts a good argument into a proven one, and the lesson gains a real measurement. |
| G6 | Protocol | **A thermal board wants its calc trail phase-tagged per row.** §3 ended up carrying two kinds of row: electrical derivations that close at `[D]`, and thermal budgets that only fully close once copper area exists (rows 33/34/37 depend on pad area and heatsink fit). | Low | The current tags (`[D]`/`[S]`/`[L]`) are per-*audit*, not per-*row*. Either let `_protocol.md` phase-tag calc rows, or keep doing what §5 does here — state the copper condition inline with the number. |
| **G7** | **Design / FMEA** | **A mitigation can look protective and be unprovable.** Pass 7 proposed TI's own Zener output clamp for the reversed-LED case, and Pass 7's own re-check killed it: the LED publishes no reverse rating, so neither the clamped nor the unclamped voltage can be proven safe, while the Zener's sub-knee leakage injects an unbounded error into the CS node. An earlier idea in the same pass — an anti-parallel Schottky — was simply *wrong* (the converter defines the polarity, so it could never conduct). | Med | Both were caught by re-deriving the mechanism instead of trusting the shape of the circuit. Worth a protocol note: **a candidate mitigation must be checked against the actual fault current path before it is folded**, and *"the datasheet shows this circuit"* is not the same as *"this circuit helps here."* |
