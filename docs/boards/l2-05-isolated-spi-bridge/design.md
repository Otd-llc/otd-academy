# L2.05 Isolated SPI Bridge — design doc

> Curriculum board `l2-05-isolated-spi-bridge` (COMMS / L2). Builds on the **L1.01
> WROOM breakout** power/USB front end (a `FOUNDATION` dependency) and re-uses it
> verbatim; the isolated half is the new design surface. Draft → validate (lock the
> math + ICs) → source/freeze the BOM → only then author the guide.

> ⛔ **NOT part-ready until the log says so.** This board owes the **Recursive
> Board-Design Validation Protocol** (`../_protocol.md`) before *any* part is created,
> BOM imported, or revision advanced: ≥ 10 recursive audit passes, a "dry" pass, every
> applicable audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION` ticks
> are honest human attestations — earn them. **Design-stage status is recorded in
> `validation-log.md`; parts are still the owner's step.**

| | |
| --- | --- |
| **Slug** | `l2-05-isolated-spi-bridge` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **draft, design-stage validated**) |
| **Track / Level** | COMMS / L2 |
| **Teaches** | Galvanic isolation of a digital bus — a 4-channel digital SPI isolator, an isolated DC-DC to power the far side, and **post-regulating the noisy rail that isolated DC-DC gives you** |
| **Tagline** | Galvanic isolation for clean, safe measurements. |
| **Project flags** | `hasMainsNet=false`, `hasLiIon=false`, `hasThermalConcern=false`, `requiresStripboard=false` — **all four stay as-is; see §7 and §9** |
| **Validation** | see `validation-log.md` |

> ## ⚠ What this board's isolation IS and IS NOT — read this first
>
> **IS:** **functional isolation** — a galvanic break that stops a ground loop and
> gives common-mode noise immunity between the USB-referenced controller half and the
> "field" half. Both halves are SELV, USB-powered, low voltage.
>
> **IS NOT:** this board is **not rated, tested, or approved for mains-adjacent use.**
> It carries no basic-insulation, no reinforced-insulation, and no safety-agency
> approval as an assembly. Its barrier is only as strong as its **weakest crossing
> element**, and that is the **isolated DC-DC (PS1), whose datasheet states
> `Insulation Grade: functional`, `1 kVDC tested for 1 second`, `500 VAC/60 Hz rated
> for 1 minute`** (RECOM R1SE datasheet REV 4/2024). The digital isolator U3 is far
> stronger (5000 V<sub>RMS</sub> UL 1577, V<sub>IOWM</sub> 1500 V<sub>RMS</sub>) — **that does not raise the
> board's rating.**
>
> **Design working voltage across the barrier: 0 V nominal.** Never connect the
> isolated side to anything that can sit at a hazardous potential. Treat ~50 V DC /
> 30 V AC as the hard ceiling and keep well below it.
>
> See **§9 · Isolation review** for the full statement and **RK1 / RK2 / RK3**.

---

## 1 · ORIENT — what & why

- **What it is:** A **two-domain board with a galvanic barrier down the middle.** The
  left half is the proven L1.01 controller core — USB-C in, PTC, ESD, LDO, an
  ESP32-S3-WROOM-1. The right half is a **completely separate electrical island**: it
  has its own ground (`GND_ISO`), its own rails, and there is **no DC path of any kind
  between the two halves.** Four SPI signals cross the barrier through a **digital
  isolator (U3)**, and the island's power crosses through an **isolated DC-DC
  converter (PS1)** — a transformer in a plastic box. Because that converter is
  *unregulated*, the rail it produces is noisy and load-dependent, so the island
  **post-regulates** it: a π filter, then an LDO. A 12-bit SPI ADC (U5) on the island
  is the thing being talked to — the measurement that "demanded" isolation in the
  first place — with its analog inputs on a header so a learner can measure something
  that floats.

- **The one thing it teaches:** *a bus can cross a galvanic break, but everything you
  take for granted stops at that break* — power, ground, timing, and clean supply.
  Each of those becomes a thing you must design.

- **Functional requirements (testable):**
  - **F1** — Run an ESP32-S3-WROOM-1 from a single USB-C cable (power + flash +
    console) via native USB Serial/JTAG, identical to L1.01. No bridge IC, no driver.
  - **F2** — Bridge a **4-wire SPI master interface** (SCLK, MOSI, MISO, CS#) across a
    galvanic barrier with **no DC path** between the two sides.
  - **F3** — Power the isolated side from the controller side **through the barrier**,
    with no shared conductor: an isolated DC-DC converter, VBUS-fed.
  - **F4** — **Post-regulate** the isolated rail to a clean 3.3 V. Target: supply-borne
    ripple at the isolated ADC's V<sub>REF</sub> **≤ 1 LSB (0.806 mV p-p)** at 12 bits.
  - **F5** — Prove the link works: an on-board **12-bit SPI ADC (MCP3208)** on the
    isolated side, read over the barrier, streaming to the USB console.
  - **F6** — Manual **EN (reset)** and **BOOT (GPIO0)** buttons (download fallback),
    exactly as L1.01.
  - **F7** — **Resettable overcurrent protection** (PTC polyfuse) on VBUS.
  - **F8** — **Two power LEDs, one per domain** (controller `3V3_A`, isolated
    `3V3_ISO`) — the learner must be able to see *both* islands are alive, because
    "one side is dead" is the failure this board fails at.
  - **F9** — The isolated side is **re-usable**: bring the isolated SPI bus and the
    isolated rails out to a header (J3) so a learner can attach their own isolated SPI
    peripheral, with the on-board ADC removable from the bus (JP1).
  - **F10** — **Scope both isolated rails.** Test points on `V_ISO_RAW` (before
    regulation) and `3V3_ISO` (after) so the learner can *measure* the post-regulation
    working, plus a `GND_ISO` reference. This is the lesson's money shot.
  - **F11** — A **controller-side activity LED** so bridge liveness is visible without
    a console.

- **Electrical / power budget:**
  - **E1** — Input: USB-C **VBUS 5 V** (sink role), Rd = 5.1 kΩ on CC1 **and** CC2.
    Requires a source rated **≥ 500 mA**.
  - **E2** — Controller rail **`3V3_A`**: RT9080 LDO, 600 mA (L1.01 verbatim).
  - **E3** — Isolated raw rail **`V_ISO_RAW`**: R1SE-0505-R, nominal 5 V, **unregulated
    — 4.48 V to 6.33 V across the operating envelope** (§3 rows 4–6). Everything on the
    island must survive the top of that range.
  - **E4** — Isolated clean rail **`3V3_ISO`**: MCP1703A LDO, 250 mA capability;
    **on-board load 7.9 mA max, header allowance 30 mA, total budget 37.9 mA.**
  - **E5** — **ESP32-S3 GPIO is not 5 V-tolerant**, and nothing on this board exposes
    5 V to a GPIO. The isolated headers carry **3V3_ISO only** — the 5 V raw rail is
    reachable only at test point TP3.
  - **E6** — **The radio is not used.** ESP-NOW/Wi-Fi/BLE are out of scope for this
    lesson; the current budget assumes the radio is off, and §3 row 2 proves the design
    still holds if a learner turns it on anyway.

- **Interfaces:**
  - **I1** — USB-C, USB 2.0 full-speed, **sink**. D+/D− → USBLC6 ESD → GPIO19/20.
  - **I2** — Native USB Serial/JTAG (CDC) for flash + console.
  - **I3** — **SPI master, mode 0,0, f<sub>SCLK</sub> = 1.0 MHz** on the ESP32-S3's
    **SPI2/FSPI IO_MUX pins** (GPIO10/11/12/13). IO_MUX, not the GPIO matrix — see §3
    row 15.
  - **I4** — **J2**, isolated analog header (1×6): `3V3_ISO`, `GND_ISO`, CH0–CH3, each
    channel through a 1 kΩ series resistor. **Inputs are 0 – 3.3 V only.**
  - **I5** — **J3**, isolated SPI header (1×6): `3V3_ISO`, `GND_ISO`, ISO_SCLK,
    ISO_MOSI, ISO_MISO, ISO_CS#, each signal through a 1 kΩ series resistor.
  - **I6** — **JP1**, 2-pin jumper with shunt **SH1**: fitted = the on-board ADC is on
    the bus; removed = the ADC is deselected (R8 holds its CS# high) so an external
    device on J3 owns the bus alone.

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, no stripboard.** All four
    project flags stay **false** and none needs changing (§9, §11). Note that
    `requiresStripboard=false` is not merely a preference here: **this board is
    physically impossible on stripboard**, because stripboard's continuous copper
    strips would bridge the barrier.
  - **The isolation/creepage conditional audit fires on the board's *nature*, not on a
    flag** (the protocol lists conditional audits as firing on "the board's nature /
    project flags"). It was run in full — see `validation-log.md` pass 15 and §9 — and
    §7 carries an explicit conditional checklist row for it.
  - **Barrier keep-out (M1) — the defining layout constraint:** a straight, continuous
    channel of **≥ 8.0 mm** across the whole board, **free of copper on all four
    layers**, free of vias, free of components, free of silkscreen conductor. Driven by
    the ISO7741 DW-16's own external creepage and clearance (**> 8 mm each**) and the
    datasheet's warning that "the mounting pads of the isolator on the printed-circuit
    board do not reduce this distance." Only U3 and PS1 cross it.
  - **Stackup (M2) — 4-layer with SPLIT planes:** `F.Cu` · `In1.Cu` · `In2.Cu` · `B.Cu`
    on 1.6 mm FR-4, as L1.01. TI's ISO774x layout guidance (§8.4) asks for ≥ 4 layers.
    **Every plane is split at the barrier** — `GND_A` pour on the controller side,
    `GND_ISO` pour on the isolated side, on *all four* layers. A continuous inner
    ground plane crossing the barrier would silently destroy the isolation while the
    board still worked.
  - **Antenna keep-out (M3):** the WROOM-1 sits on a board **edge** with its PCB
    antenna over a keep-out excluding all four copper layers, per Espressif integration
    rules — required to preserve the module's pre-certification even though the radio
    is unused (§10).
  - **Mechanical (M4):** target outline **≈ 60 × 80 mm**, 4-layer, **ENIG** finish (flat
    pads for the WROOM's castellations, as L1.01 M7). The barrier channel runs the full
    board width and the board is deliberately wide enough that the two domains are
    visibly, physically separate. Exact geometry closes at `[L]`.
  - **Solderability (L2 envelope):** **no leadless packages.** Everything is
    SOIC-16-WB, SOT-23-6, TSOT-23-5, SOT-223-3, 0805/1206 passives, a 6 × 6 mm
    semi-shielded inductor, a 5-pad SMD DC-DC module, radial-THT electrolytic, THT
    buttons/headers/test points, and the L1.01 USB-C receptacle (SMT contacts with THT
    solder-retention posts). **The two new SOIC-16 wide-body parts are the easiest ICs
    on the board** — 1.27 mm pitch, gull-wing, fully visible joints.
  - **Regulatory:** the ESP32-S3-WROOM-1 is a pre-certified module; the barrier
    keep-out is honored (M3). **No EMC claim is made for this board** — see §9's note
    on the RECOM EN 55032 filter suggestion, which is deliberately only partly adopted.

## 2 · Topology

```
 ══ CONTROLLER DOMAIN (GND_A) ══════════════╗ BARRIER ╔══ ISOLATED DOMAIN (GND_ISO) ═══
                                            ║ ≥8.0mm  ║
   ┌───────── USB-C J1 (sink) ─────────┐    ║ no Cu   ║
   │ CC1/CC2 → R3,R4 5.1k → GND_A      │    ║ any     ║
   │ D+/D− ─────────────┐              │    ║ layer   ║
   └── VBUS ──┬─────────│──────────────┘    ║         ║
              │         │                   ║         ║
        [F1 PTC 1.5A]  [D1 USBLC6-2SC6]     ║         ║
              │         │ ESD               ║         ║
      VBUS_F ─┼─────────┼──────┐            ║         ║
              │         ▼ GPIO19/20         ║         ║
              │   ┌──────────────────────┐  ║         ║
              │   │ U1 ESP32-S3-WROOM-1  │  ║         ║
   ┌──────────┤   │  EN: R1 10k↑,C4,SW1  │  ║         ║
   │          │   │  IO0: R2 10k↑,SW2    │  ║         ║
   │  ┌───────▼─┐ │  IO47 → R6 → LED2    │  ║         ║
   │  │ U2      │ │                      │  ║         ║
   │  │ RT9080  │ │  IO12 SCLK ──────────┼──╫─► INA   ║
   │  │ 3.3V    │ │  IO11 MOSI ──────────┼──╫─► INB   ║   3 forward
   │  │ 600mA   │ │  IO10 CS#  ──────────┼──╫─► INC   ║   1 reverse
   │  └────┬────┘ │  IO13 MISO ◄─────────┼──╫── OUTD  ║
   │       │3V3_A └──────────────────────┘  ║         ║
   │       ├─► C1 10µF, C2/C3 0.1µF         ║  ┌──────────────┐
   │       ├─► R5→LED1 (red, PWR A)         ║  │ U3 ISO7741DWR │ SOIC-16 WB
   │       ├─► TP1 / TP2 (GND_A)            ╠══╡ 3F/1R digital ╞══╗
   │       └─► U3 VCC1 (C7 0.1µF), EN1      ║  │   isolator    │  ║ OUTA→ISO_SCLK
   │                                        ║  └──────────────┘  ║ OUTB→ISO_MOSI
   │  C8,C9 2×10µF                          ║                    ║ OUTC→ISO_CS#
   └──► +Vin ┌────────────────────┐         ║                    ║ IND ←ISO_MISO
        GND_A│ PS1 R1SE-0505-R    │         ║                    ▼
        ─────┤ 1W isolated DC-DC  ╞═════════╬═══► V_ISO_RAW  ┌─────────────────┐
             │ UNREGULATED, 20–70k│         ║      │         │ U5 MCP3208      │
             └────────────────────┘         ║      │         │ 12-bit 8ch ADC  │
                                            ║   ┌──┴──┐      │ CS# ←JP1←R8 10k↑│
   ══ π FILTER + POST-REGULATION ═══════════╣   │ R7  │      │ CH0..CH3 → J2   │
                                            ║   │330Ω │      │ CH4..CH7 → GND  │
   V_ISO_RAW ─┬─ C10 10µF ─┬─ L1 100µH ─┬───╫───┘preload     │ VREF=VDD=3V3_ISO│
              │            │            │   ║                └─────────────────┘
             TP3          R7           C11 220µF (elec)              ▲
                                        + C12 1µF                    │
                                            │                        │
                                       ┌────▼─────┐                  │
                                       │ U4       │  3V3_ISO ────────┴─► U3 VCC2, EN2
                                       │ MCP1703A │      ├─► C13 1µF, C14/C15 0.1µF
                                       │ 3.3V     ├──────┼─► C16 1µF (VREF)
                                       │ 18V absmax│     ├─► R17 → LED3 (yellow, PWR B)
                                       └──────────┘      ├─► TP4 / TP5 (GND_ISO)
                                                         └─► J2 pin1, J3 pin1
```

**Sub-circuits the schematic is organised into:**

| # | Sub-circuit | Domain | Parts |
| --- | --- | --- | --- |
| A | USB-C input + CC sink pull-downs | A | J1, R3, R4 |
| B | Protection (PTC + ESD) | A | F1, D1 |
| C | Controller 3V3 rail | A | U2, C5, C6, C1, C2, C3 |
| D | ESP32-S3 module + straps/buttons | A | U1, R1, R2, C4, SW1, SW2 |
| E | Controller indicators + test points | A | LED1/R5, LED2/R6, TP1, TP2 |
| **F** | **Digital isolation barrier** | **crosses** | **U3, C7, C14** |
| **G** | **Isolated power crossing** | **crosses** | **PS1, C8, C9** |
| H | Isolated raw rail + π filter + preload | B | C10, R7, L1, C11, TP3 |
| I | Isolated post-regulation | B | U4, C12, C13 |
| J | Isolated SPI target (ADC) | B | U5, C15, C16, R8, JP1, SH1 |
| K | Isolated I/O + indicators + test points | B | J2, J3, R9–R16, R17, LED3, TP4, TP5 |

### Theory of operation

**Controller domain.** L1.01 verbatim: VBUS → PTC (F1) → ESD (D1) → RT9080 (U2) →
`3V3_A` → the WROOM. D+/D− pass through the ESD array straight to the module's native
USB pins. The console and firmware live here.

**Crossing the barrier — signals.** The ESP32-S3's SPI2 peripheral drives U3's three
forward channels (SCLK on INA, MOSI on INB, CS# on INC) and receives MISO back on the
single reverse channel (IND → OUTD). **The ISO7741's 3-forward/1-reverse split is
exactly a 4-wire SPI master port** — that is the reason this part rather than the
all-forward ISO7740 or the 2/2 ISO7742. Inside, each channel is a logic input, a pair
of series SiO₂ capacitors, and an output buffer; there is no conductive path. U3's two
halves are powered from *different* rails (`3V3_A` on VCC1, `3V3_ISO` on VCC2), which is
what makes it an isolator rather than a buffer.

**Crossing the barrier — power.** PS1 is a 1 W transformer-isolated DC-DC: VBUS in on
the controller side, a floating 5 V out on the isolated side. It is **unregulated** —
there is no feedback loop, no error amplifier, and no optocoupler; it is a fixed-duty
push-pull driving a transformer at **20–70 kHz**. Consequences, all of which the design
must absorb:
1. **Its output tracks its input** (roughly 1:1), so USB line variation appears on the
   isolated rail.
2. **Its output rises sharply at light load** — up to **+16 % at no load** — because
   there is nothing regulating it.
3. **Its output carries up to 100 mV p-p of switching ripple** at 20–70 kHz.

**Post-regulation — the part that is genuinely designed, not copied.** The naive answer
is "put an LDO on it." That answer is *wrong here*, and proving it wrong is the lesson.
The MCP1703A's power-supply rejection is **≈ 0 dB between roughly 15 kHz and 30 kHz**
(datasheet Figures 2-25 and 2-27) — precisely the band PS1 switches in. An LDO alone
would pass the ripple through essentially untouched. So the island uses **two stages
with two different jobs**:

- **A π filter (C10 – L1 – C11) does the ripple rejection.** 100 µH into 220 µF puts
  the corner at ~1.07 kHz, giving **≥ 46.9 dB at 20 kHz worst case** (§3 row 8). The
  LDO is credited **0 dB** in this band — the filter is proven on its own.
- **The LDO (U4) does the DC job**: it holds 3.3 V against the raw rail's 4.48–6.33 V
  swing, and it is the reason the light-load overshoot is harmless. Its **18 V absolute
  maximum input** is what makes that safe; a 6 V-rated LDO (the RT9080 used on the
  controller side) would be **over its absolute maximum** on this rail.
- **A preload (R7)** keeps PS1 at ≥ 10 % load so its datasheet load-regulation numbers
  actually apply, instead of the design living off the tail of a graph.

**Isolated target.** U5, an MCP3208 12-bit SPI ADC, runs on `3V3_ISO` with V<sub>REF</sub> tied to
the same rail. Its four exposed channels come out on J2 through 1 kΩ series resistors.
CH4–CH7 are tied to `GND_ISO` — no floating analog inputs. Because V<sub>REF</sub> is the
regulated rail, **any residual supply ripple is directly a conversion error**, which is
why F4 sets the ripple target in LSBs rather than millivolts.

### Power-up and power-down sequencing across the barrier

This matters more than on a single-rail board, because the two domains come up and go
down independently and the isolator's behaviour with one side dead is a datasheet fact,
not an assumption. From ISO774x datasheet **Table 7-2 (Function Table)**:

| condition | side-1 outputs (OUTD/MISO) | side-2 outputs (SCLK/MOSI/CS#) |
| --- | --- | --- |
| both powered | follow inputs | follow inputs |
| VCC2 unpowered (`3V3_ISO` down) | **default HIGH** (input side dead) | **undetermined** |
| VCC1 unpowered (`3V3_A` down) | undetermined | **default HIGH** |

- **Plug USB.** `3V3_A` comes up first (RT9080, 10 µF). PS1 starts, the π filter and
  C11 charge, then U4 releases `3V3_ISO` after its ~600 µs output delay. During that
  window VCC2 < 2.25 V, so U3's side-2 outputs are **undetermined** — but U5 is on the
  same dead rail, so nothing is being driven into a powered chip. As `3V3_ISO` crosses
  the 2.25 V UVLO, side-2 outputs snap to their input states, which is CS# idle-high
  because firmware has not started a transaction. **Firmware must idle CS# high before
  enabling the bus and discard the first conversion** — RK9.
- **Unplug USB.** `3V3_A` collapses in well under a millisecond (10 µF at ~70 mA), but
  `3V3_ISO` is held up for roughly **26 ms** by C11's 220 µF at ~8 mA. So there is a
  long window with **VCC1 dead and VCC2 alive**. In that window U3's side-2 outputs go
  to their **default state**, and because this is the **non-F** ISO7741, that default is
  **HIGH** — which on an active-low chip select means **the ADC is cleanly deselected.**
  Choosing ISO7741 over ISO7741F (default LOW) is therefore not a preference; it is the
  only variant whose failure state is safe for this pinout. See RK8.
- **`3V3_ISO` reads as 0xFF.** If the isolated side is dead while the controller runs,
  OUTD defaults HIGH and the master reads all-ones. That is a **deliberate diagnostic
  signature** the lesson uses: *all-ones means the far side has no power.*

### Pin accounting

**Policy (logical net, pre-schematic — the exact pad map re-verifies at `[S]`):** every
pin of every part is driven, pulled, tied, or explicitly parked. No input is left
floating and read. No analog input is left floating at all.

**U1 — ESP32-S3-WROOM-1-N16R2 (41 pins, catalog pinout VERIFIED):**

| pin(s) | name | net / policy |
| --- | --- | --- |
| 1, 40, 41 | GND, GND, EPAD | `GND_A` |
| 2 | 3V3 | `3V3_A` |
| 3 | EN | R1 10 kΩ ↑ `3V3_A`, C4 0.1 µF ↓ `GND_A`, SW1 ↓ `GND_A` |
| 13 | IO19 | USB **D−** via D1 |
| 14 | IO20 | USB **D+** via D1 |
| 18 | IO10 | **SPI_CS#** → U3 pin 5 (INC) — FSPICS0, IO_MUX |
| 19 | IO11 | **SPI_MOSI** → U3 pin 4 (INB) — FSPID, IO_MUX |
| 20 | IO12 | **SPI_SCLK** → U3 pin 3 (INA) — FSPICLK, IO_MUX |
| 21 | IO13 | **SPI_MISO** ← U3 pin 6 (OUTD) — FSPIQ, IO_MUX |
| 24 | IO47 | **SCAN LED** → R6 470 Ω → LED2 → `GND_A` |
| 27 | IO0 | R2 10 kΩ ↑ `3V3_A`, SW2 ↓ `GND_A` (BOOT strap, by design) |
| 15, 16, 26 | IO3, IO46, IO45 | **NC — strapping pins left at module-internal defaults.** Not used, not exposed, no boot hazard. |
| 4–12, 17, 22, 23, 25, 28–39 | IO4–IO8, IO14–IO18, IO21, IO35–IO44, IO48 | **NC.** Not exposed on any header; this board deliberately breaks out no controller-side GPIO (L1.01 is the dev board). |

**U3 — ISO7741DWR (SOIC-16 wide body):**

| pin | name | net |
| --- | --- | --- |
| 1 | VCC1 | `3V3_A` (C7 0.1 µF, per datasheet §8.3) |
| 2, 8 | GND1 | `GND_A` (**both** required) |
| 3 | INA | SPI_SCLK ← U1 IO12 |
| 4 | INB | SPI_MOSI ← U1 IO11 |
| 5 | INC | SPI_CS# ← U1 IO10 |
| 6 | OUTD | SPI_MISO → U1 IO13 |
| 7 | EN1 | **tied to `3V3_A`** — the internal 2 MΩ pull-up would do it, but an explicit tie is not an assumption |
| 9, 15 | GND2 | `GND_ISO` (**both** required) |
| 10 | EN2 | **tied to `3V3_ISO`** |
| 11 | IND | ISO_MISO ← U5 pin 12 (DOUT) |
| 12 | OUTC | ISO_CS# → JP1 → U5 pin 10; and → R11 → J3-6 |
| 13 | OUTB | ISO_MOSI → U5 pin 11 (DIN); and → R10 → J3-4 |
| 14 | OUTA | ISO_SCLK → U5 pin 13 (CLK); and → R9 → J3-3 |
| 16 | VCC2 | `3V3_ISO` (C14 0.1 µF) |

**U5 — MCP3208-CI/SL (SOIC-16):**

| pin | name | net |
| --- | --- | --- |
| 1–4 | CH0–CH3 | R13–R16 (1 kΩ) → J2-3 … J2-6 |
| 5–8 | CH4–CH7 | **tied to `GND_ISO`** — unused analog inputs are never left floating |
| 9 | DGND | `GND_ISO` |
| 10 | CS/SHDN | JP1 (from ISO_CS#) + R8 10 kΩ ↑ `3V3_ISO` |
| 11 | DIN | ISO_MOSI |
| 12 | DOUT | ISO_MISO |
| 13 | CLK | ISO_SCLK |
| 14 | AGND | `GND_ISO` |
| 15 | V<sub>REF</sub> | `3V3_ISO` (C16 1 µF) |
| 16 | V<sub>DD</sub> | `3V3_ISO` (C15 0.1 µF) |

**PS1 — R1SE-0505-R (5-pad SMD):** pin 1 = −V<sub>in</sub> (`GND_A`), pin 2 = +V<sub>in</sub> (`VBUS_F`),
pin 4 = −V<sub>out</sub> (`GND_ISO`), pin 5 = +V<sub>out</sub> (`V_ISO_RAW`), pin 8 = **NC, no copper
attached** (its position relative to the barrier is an `[S]` item — see §6 RK14).

**U2 (RT9080-33GJ5), D1 (USBLC6-2SC6), J1 (USB4110-GF-A):** wired exactly as L1.01.
**U4 — MCP1703AT-3302E/DB (SOT-223-3):** pin 1 V<sub>IN</sub>, pin 2 GND, pin 3 V<sub>OUT</sub>; the tab
is electrically common with pin 2 (GND) — **confirm at `[S]`** (RK14).

**Current return paths.** Each domain has its own return. `GND_A` returns through the
USB-C shell/ground to the host. `GND_ISO` returns only within the island — its only
"connection" to anything is the 76 pF of barrier capacitance (§3 row 17) and the
transformer's magnetic coupling. **`GND_ISO` is a floating node.** It has no defined
potential relative to `GND_A`, and that is the entire point.

## 3 · Calc trail (DO — lock the math)

Every number worst-case (min/max/temperature), re-derived from the cited datasheet.
Sources: RECOM **R1SE** REV 4/2024 · TI **ISO7740/41/42** SLLSEP4J (rev. Oct 2024) ·
Microchip **MCP1703A** DS20005122C · Microchip **MCP3204/3208** DS21298E · Richtek
**RT9080** · Littelfuse **miniSMDC150F-2** (parametrics) · Bourns **SRN6045TA** ·
Panasonic **EEU-FR1C221B** · Espressif **ESP32-S3-WROOM-1** v1.8 (catalog VERIFIED) ·
ESP-IDF SPI Master driver documentation.

| # | Value | Formula / source | Result | Margin / notes |
| --- | --- | --- | --- | --- |
| 1 | **VBUS at the board** | USB-C source minimum at the receptacle | **4.75 V** | the standard worst-case start point (L1.01/L1.02 convention) |
| 2 | **VBUS drop across F1** | I<sub>total</sub> × R<sub>1max</sub>. miniSMDC150F-2: **R<sub>1max</sub> = 110 mΩ** (post-trip max, Littelfuse). I<sub>total</sub> = ESP32 60 mA + PS1 input 91 mA + LEDs/misc 6 mA = **157 mA**; radio-on burst = 597 mA | **17.3 mV** typ · **65.7 mV** at 597 mA | → PS1 input **4.73 V** typ / **4.68 V** at burst. **Both ≥ 4.5 V** (PS1 minimum), margin **≥ 184 mV** *with the radio on*. The L1.01 part (1206L050YR, **R<sub>1max</sub> = 700 mΩ**) would drop **418 mV** at burst → 4.33 V, **below spec** → part changed, see RK4 |
| 3 | **PS1 input range check** | R1SE input range = nominal 5 V **±10 % → 4.5–5.5 V** | 4.68–5.48 V | ✓ in range at both extremes |
| 4 | **`V_ISO_RAW` — max, normal** | Ratiometric: V<sub>out</sub> = V<sub>in</sub> × (1 + accuracy) × (1 + deviation(load)). Accuracy **±5.0 % max**; deviation-vs-load graph. High line 5.48 V; load = 7.9 mA board + R7 preload → 26.1 mA = **13.1 %** → deviation ≈ **+4.3 %** | **6.00 V** | vs MCP1703A **abs max 18 V** → **12 V margin**. vs C11 (16 V) ✓. **vs RT9080 abs max 6 V → FAIL** — this is why the LDO is not the L1.01 part (RK5) |
| 5 | **`V_ISO_RAW` — max, R7 open (fault)** | load = 7.9 mA = **4.0 %** → deviation ≈ **+10 %** | **6.33 V** | still ≪ 18 V ✓. True 0 % load (+16 %) gives **6.68 V**, also ✓. Defence in depth: even if the preload fails open, nothing on the island is over-stressed |
| 6 | **`V_ISO_RAW` — min** | Low line 4.666 V (after F1 + connector); load 51.5 mA = **25.8 %** → deviation ≈ +2 % (take **+1 %**); accuracy **−5 %** | **4.477 V** | the floor everything downstream must live on |
| 7 | **U4 dropout headroom** | V<sub>ISO_RAW,min</sub> − I<sub>L1</sub>·DCR − 3.3 V vs V<sub>DROPOUT</sub>. L1 DCR **0.456 Ω max** × 37.9 mA = 17.3 mV → U4 V<sub>IN</sub> = **4.460 V**. Required = 3.3 + **0.725 V** (MCP1703A max dropout **at 250 mA**, the only spec'd point for 3.3 V ≤ V<sub>R</sub> < 5.0 V) = 4.025 V | **+435 mV** | deliberately pessimistic: dropout is spec'd at 250 mA but the actual load is 37.9 mA (~15 %), where Fig 2-14/2-15 put it near 110 mV → **real margin ≈ 1.05 V** |
| 8 | **π filter attenuation** | Two-pole L1–C11. f₀ = 1/(2π√(LC)). Worst case L −20 % = **80 µH**, C −20 % = **176 µF** → √(LC) = 1.187 × 10⁻⁴ s → f₀ = **1341 Hz**. Attenuation at the **lowest** switching frequency 20 kHz = (20 000/1341)² | **222× = 46.9 dB** | at 70 kHz it is 65 dB. Worst case is the *low* end of PS1's frequency range — the filter is sized there |
| 9 | **Ripple at `3V3_ISO`** | PS1 output ripple **100 mV p-p max** (20 MHz BW) ÷ 222, then × LDO PSRR. **MCP1703A PSRR is credited 0 dB** at 15–30 kHz (Fig 2-25/2-27 show the rejection notch reaching ≈ 0 to −8 dB there) | **≤ 0.45 mV p-p** | MCP3208 LSB at V<sub>REF</sub> = 3.3 V is 3.3/4096 = **0.806 mV** → ripple = **0.56 LSB**, inside F4's ≤ 1 LSB and inside the ADC's own ±1 LSB INL. **Without the filter: 100 mV = 124 LSB**, i.e. the bottom 7 bits are noise |
| 10 | **π filter damping** | Q = Z₀/R<sub>series</sub>; Z₀ = √(L/C) = √(100 µH/220 µF) = **0.674 Ω**; R = DCR **0.456 Ω** + C11 impedance **0.130 Ω** @100 kHz | **Q = 1.15** | ≈ +1.2 dB peak at 1.07 kHz. Nothing on the board excites 1 kHz. The electrolytic's ESR is a **feature** here — an all-ceramic C11 would raise Q |
| 11 | **L1 current rating** | I<sub>L1</sub> = U4 input current ≤ **37.9 mA** vs SRN6045TA-101M I<sub>rms</sub> **920 mA**, I<sub>sat</sub> **1.33 A** | **24× margin** | no saturation, negligible self-heating |
| 12 | **Preload R7** | Need ≥ 10 % of 200 mA = 20 mA total. Board 7.9 mA + 5.0 V/330 Ω = 15.2 mA → **23.1 mA = 11.6 %** | **330 Ω** | R1SE Note 5: below 10 % load "specifications may not be met." R7 buys back the datasheet |
| 13 | **R7 dissipation** | V²/R at the worst normal rail 6.00 V → 36.0/330 | **109 mW** | vs **250 mW** (RC1206FR-07330RL, 1/4 W) = **44 %**. An 0805 (125 mW) would be at **87 %** → 1206 chosen |
| 14 | **SPI clock ceiling** | MCP3208 f<sub>CLK</sub>: **2.0 MHz at V<sub>DD</sub> = 5 V**, **1.0 MHz at V<sub>DD</sub> = 2.7 V**; **no 3.3 V figure is given.** Also t<sub>HI</sub>/t<sub>LO</sub> ≥ 250 ns each ⇒ 2 MHz hard ceiling | **f<sub>SCLK</sub> = 1.0 MHz** | take the *guaranteed* 2.7 V number rather than interpolate. Full 24-clock transaction ⇒ ~40 ksps |
| 15 | **MISO round trip through the barrier** | t<sub>PD,max</sub>(fwd) + t<sub>DO,max</sub>(slave) + t<sub>PD,max</sub>(rev) = 18.5 + 200 + 18.5 (ISO7741 @3.3 V max prop delay; MCP3208 CLK-fall-to-data-valid max) | **237.0 ns** | window = T/2 − PWD = 500 − **5.9** = **494.1 ns** → **margin 257.1 ns (52 %)**. Cross-check with ESP-IDF's limit f = 80/(⌊delay/12.5⌋+1) = 80/19 = **4.21 MHz** ≥ 1.0 MHz ✓. Using **IO_MUX** pins avoids the GPIO-matrix penalty (2 APB cycles = 25 ns); even with it, 3.6 MHz ✓ |
| 16 | **MOSI setup/hold at the slave** | Both SCLK and MOSI are **same-direction** channels → bounded by t<sub>sk(o)</sub> **4.4 ns** + PWD **5.9 ns**. Available = 500 − 10.3 = **489.7 ns** vs MCP3208 t<sub>SU</sub>/t<sub>HD</sub> min **50 ns** | **+439.7 ns** | also t<sub>HI</sub>/t<sub>LO</sub> at the slave = 500 ± 5.9 ns vs 250 ns min → **+244 ns** |
| 17 | **Barrier capacitance** | ISO7741 C<sub>IO</sub> ≈ **1 pF**; R1SE isolation capacitance **75 pF max** | **≈ 76 pF** | the barrier is **not** an open circuit. At a 1 kV/µs common-mode slew, I = C·dV/dt = **76 mA** of displacement current. The DC-DC, not the isolator, dominates the coupling |
| 18 | **Common-mode transient immunity** | ISO7741 CMTI **85 kV/µs min** (100 typ) | 85 kV/µs | far beyond anything a USB-powered bench setup produces |
| 19 | **Isolated-side load budget** | U3 I<sub>CC2</sub> **4.5 mA max** (3.3 V, 1 Mbps AC) + U5 I<sub>DD</sub> **0.4 mA max** + U5 V<sub>REF</sub> drain **0.15 mA max** + U4 I<sub>q</sub> **5 µA** + LED3 2.8 mA | **7.9 mA** on-board; **37.9 mA** with the 30 mA header allowance | vs U4's **250 mA** capability → the LDO is not the constraint; the header allowance is a *documented* budget, not a limit the hardware enforces |
| 20 | **Controller-side load** | ESP32-S3 (radio off) ~60 mA + U3 I<sub>CC1</sub> **4.7 mA max** + LED1 3.2 mA + LED2 2.8 mA | **~71 mA** (160 mA radio-on continuous, 500 mA burst) | vs RT9080 **600 mA** ✓ |
| 21 | **PS1 input current** | P<sub>out</sub> = 5.0 × 51.5 mA = 258 mW; η ≈ **62 %** at 26 % load (efficiency-vs-load graph) → P<sub>in</sub> = 415 mW ÷ 4.75 V | **91 mA** | at the light-load operating point (23 mA out, ~12 % load, η ≈ 45 %) it is **55 mA** |
| 22 | **RT9080 junction temp** | T<sub>j</sub> = T<sub>amb</sub> + θ<sub>JA</sub>·P; θ<sub>JA</sub> ≈ 250 °C/W (TSOT-23-5). Radio-off: P = (4.73 − 3.3)·0.071 = **0.102 W** | **T<sub>j</sub> = 55.5 °C** | at 30 °C ambient; **70 °C margin** to 125 °C. Radio-on continuous 160 mA: P = 0.229 W → **87 °C**, still 38 °C margin |
| 23 | **MCP1703A junction temp** | θ<sub>JA</sub> = **62 °C/W** (SOT-223-3, JESD51-7, 4-layer FR-4 — matches this board's stackup). Worst P = (5.81 − 3.3) × 37.9 mA = **95 mW** | **T<sub>j</sub> = 35.9 °C** | at 30 °C ambient; **89 °C margin** to the 125 °C steady-state limit |
| 24 | **PS1 self-dissipation** | P<sub>in</sub> − P<sub>out</sub> = 415 − 258 mW | **157 mW** | the module is rated 100 % load (≈ 333 mW dissipation) to **85 °C ambient** → we are at **47 %** of its full-load dissipation |
| 25 | **ISO7741 dissipation** | (I<sub>CC1</sub> 4.7 + I<sub>CC2</sub> 4.5) mA × 3.3 V; θ<sub>JA</sub> **83.4 °C/W** (DW-16) | **30 mW → ΔT 2.5 °C** | vs P<sub>D</sub> max **210 mW** ✓ |
| 26 | **Isolator output drive** | Recommended operating I<sub>OH</sub>/I<sub>OL</sub> at 3.3 V = **∓2 mA**; abs max I<sub>O</sub> = **±15 mA** | see R9–R12 | an isolator output **cannot drive an LED**. A hard short of a J3 pin through 1 kΩ = **3.3 mA** — above the 2 mA recommended figure (V<sub>OL</sub> not guaranteed) but **4.5× inside abs max**, so a learner's short is survivable, not destructive |
| 27 | **J2/J3 series resistor value** | Settling: MCP3208 t<sub>SAMPLE</sub> = 1.5 clocks = **1.5 µs** at 1 MHz; sample cap **20 pF**, internal switch **1 kΩ**. 12-bit settling needs ≈ 9τ ≤ 1.5 µs → τ ≤ 167 ns → **R<sub>total</sub> ≤ 8.3 kΩ** | **1 kΩ** | τ = (1000 + 1000)·20 pF = **40 ns**, 9τ = 360 ns ≪ 1.5 µs ✓. Leaves a learner ~7 kΩ of their own source impedance. **A 10 kΩ series resistor would break 12-bit settling** — hence a new value rather than reusing the catalog 10 kΩ |
| 28 | **J3 back-feed limit** | If an externally-powered device drives ISO_MISO while `3V3_ISO` is dead, it can weakly power VCC2 through U3's protection diode (datasheet Table 7-2, note 2). Through R11: (5.0 − 0.7)/1 kΩ | **4.3 mA** | inside the ±15 mA abs-max I<sub>O</sub>. RK10 |
| 29 | **ADC CS pull-up** | R8 10 kΩ from `3V3_ISO`. When JP1 is fitted and OUTC drives low, the pull-up injects 3.3 V/10 kΩ into the isolator output | **0.33 mA** | ≪ the 2 mA recommended I<sub>OL</sub> ✓; V<sub>OL</sub> stays inside 0.3 V |
| 30 | **LED currents** | (3.3 − V<sub>f</sub>)/470 Ω. Red V<sub>f</sub> ≈ 1.8 V → **3.2 mA**; yellow V<sub>f</sub> ≈ 2.0 V → **2.8 mA** | 2.8–3.2 mA | clearly visible; ≪ the ESP32-S3's 40 mA/pin abs max. Red for the 3.3 V power rails — **green (V<sub>f</sub> ≈ 3.2 V) would not light**, the L1.01 D20 finding |
| 31 | **PS1 hold-up on power-down** | t = C·ΔV/I = 220 µF × 1 V ÷ 7.9 mA | **≈ 26 ms** | the window in which VCC1 is dead and VCC2 is alive — the case that forces the **non-F** ISO7741 (RK8) |
| 32 | **EN power-on-reset RC** | R1 10 kΩ × C4 0.1 µF | **τ = 1 ms** | L1.01 verbatim |
| 33 | **CC sink pull-downs** | USB-C sink advertise: 5.1 kΩ on **both** CC1 and CC2 | 5.1 kΩ ×2 | required for the host to source VBUS |
| 34 | **F1 coordination** | miniSMDC150F-2: I<sub>hold</sub> **1.5 A**, I<sub>trip</sub> **3.0 A**, t<sub>trip</sub> 500 ms, V<sub>max</sub> **6 V**, I<sub>max</sub> 100 A | 1.5 A vs 0.6 A worst | **2.5× headroom** → no nuisance trip on an ESP32 radio burst. Protection is looser than L1.01's 0.5 A part; that trade is accepted deliberately (RK4) |
| 35 | **C8/C9 input decoupling** | RECOM's EN 55032 **Class A** suggestion is C = 6.8 µF at +V<sub>in</sub>. 2× 10 µF/25 V X5R 0805 in parallel retains ≥ 10 µF effective at 5 V DC bias | **2 × 10 µF** | **no EMC claim is made** (§9); the functional requirement is input decoupling for a 1 W converter, which this exceeds |

## 4 · IC selection (DO — lock the parts)

"Datasheet-verified" = the cited sections were read from the manufacturer's own
document, not a distributor summary or recall.

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| **U3** | **Texas Instruments ISO7741DWR** (SOIC-16 wide body, DW) | **The 3-forward/1-reverse channel split is literally a 4-wire SPI master port** — ISO7740 (4F/0R) cannot return MISO, ISO7742 (2F/2R) wastes a channel. 2.25–5.5 V on each side independently (so `3V3_A` and `3V3_ISO` need no matching). 100 Mbps, 18.5 ns max prop delay at 3.3 V — two orders of margin over our 1 MHz. **Non-F variant chosen deliberately: default output HIGH is the safe state for an active-low CS# when one side loses power** (§2, RK8). DW-16 body gives **> 8 mm creepage and clearance**, which sets the board's barrier gap. Gull-wing 1.27 mm pitch — the easiest IC on the board to hand-solder. **LOCKED.** | Features; §4 pin configuration + Table 4-1; §5.1 abs max; §5.3 recommended operating (I<sub>OH</sub>/I<sub>OL</sub> = ∓2 mA at 3.3 V); §5.4 thermal; §5.6 **insulation specifications** (CLR/CPG/CTI/V<sub>IORM</sub>/V<sub>IOWM</sub>/V<sub>ISO</sub>/C<sub>IO</sub>); §5.11 electrical @3.3 V; §5.12 supply current @3.3 V; §5.16 switching @3.3 V; §7.4 **Table 7-2 function table** + §7.4.1 I/O schematics; §8.3 power supply; §8.4 layout |
| **PS1** | **Recom Power R1SE-0505-R** (5-pad SMD, 1 W) | The **unregulated** 1:1 isolated converter is the right teaching part precisely *because* it is unregulated — its noisy, load-dependent output is the problem F4 exists to solve. 5 V in / 5 V out at 200 mA, UL 60950-1 certified, functional insulation grade. Its rating is the **binding constraint on the whole board's isolation claim** (§9). SMD plastic body, five large pads — hand-solderable. **LOCKED.** | Selection guide; basic characteristics (input ±10 %, **20–70 kHz**, ripple **68 mV typ / 100 mV max**); regulations (accuracy **±5 % max**, load reg **15 % max**, **Note 5 min-load**); deviation-vs-load graph; efficiency-vs-load graph; **protections (isolation 1 kVDC/1 s, 500 VAC/1 min, 75 pF, `Insulation Grade: functional`)**; environmental; derating; **EN 55032 filter suggestion**; dimensions + pinning |
| **U4** | **Microchip MCP1703AT-3302E/DB** (SOT-223-3) | Chosen for **absolute maximum V<sub>IN</sub> = 18 V**, which is what makes PS1's light-load overshoot (up to 6.68 V, §3 rows 4–5) a non-event. 250 mA, 2 µA I<sub>q</sub>, stable with 1 µF ceramic, no minimum-load requirement, short-circuit + over-temperature protection, θ<sub>JA</sub> 62 °C/W. **Its PSRR notch at 15–30 kHz is a known, designed-around limitation, not an oversight** — the π filter carries the ripple rejection. SOT-223 is a large, forgiving 3-pin package. **LOCKED.** | Features; abs max (**18 V**); DC characteristics (I<sub>q</sub>, I<sub>OUT</sub>, dropout table, line/load reg); **PSRR 35 dB @ 100 Hz** + **Figures 2-25/2-27 PSRR vs frequency**; Figs 2-13/2-14/2-15 dropout vs load; temperature specifications (**θ<sub>JA</sub> = 62 °C/W SOT-223**, T<sub>J</sub> 125 °C steady / 150 °C transient); typical application circuit; package types |
| **U5** | **Microchip MCP3208-CI/SL** (SOIC-16) | 12-bit SAR, 8 channels, 2.7–5.5 V single supply, SPI mode 0,0 — the simplest credible "measurement that needed isolating." Its **200 ns max CLK-fall-to-data-valid dominates the barrier round trip** (§3 row 15), which is itself a teaching point: the isolator is not always the slow part. SOIC-16, 1.27 mm pitch. **LOCKED.** | Features; abs max (V<sub>DD</sub> 7.0 V, I/O −0.6 V…V<sub>DD</sub>+0.6 V); electrical specs (V<sub>REF</sub> range + **150 µA max drain**, analog input range, leakage, **switch R 1 kΩ / sample cap 20 pF**); digital I/O (V<sub>IH</sub>/V<sub>IL</sub>/V<sub>OH</sub>/V<sub>OL</sub>); **timing parameters (f<sub>CLK</sub>, t<sub>HI</sub>/t<sub>LO</sub>, t<sub>SUCS</sub>, t<sub>SU</sub>/t<sub>HD</sub>, t<sub>DO</sub>, t<sub>CSH</sub>)**; power requirements; temperature/thermal; Figure 1-1 serial interface timing; package types |
| **U1** | **Espressif ESP32-S3-WROOM-1-N16R2** | L1.01 core, re-used verbatim. Native USB (no bridge, no driver); **SPI2/FSPI IO_MUX pins GPIO10–13 are all exposed on the module** and are none of the strapping pins (0/3/45/46), none of the USB pins (19/20), and free on a quad-PSRAM part. Castellated edge pads. **Re-used, LOCKED.** | Pinout **VERIFIED in the Foundry catalog** (Table 3-1, pp. 11–12) — pin 18 = IO10/FSPICS0, 19 = IO11/FSPID, 20 = IO12/FSPICLK, 21 = IO13/FSPIQ; power domains; native-USB pins; antenna keep-out integration rules |
| **U2** | **Richtek RT9080-33GJ5** (TSOT-23-5) | 3.3 V / 600 mA, 0.53 V dropout at 600 mA, OC/OT protection, stable with 1 µF. **Re-used from L1.01, LOCKED — and deliberately NOT used on the isolated side** (6 V abs max vs a rail that reaches 6.33 V; §3 row 4, RK5). | pinout, dropout vs current, abs max, minimum output cap |
| **D1** | **STMicroelectronics USBLC6-2SC6** (SOT-23-6) | ESD/TVS array on VBUS + D±. **Re-used from L1.01, LOCKED.** | pin map (VBUS / D+ / D− channels), clamp voltage |
| **F1** | **Littelfuse miniSMDC150F-2** (1812) | PTC polyfuse, **I<sub>hold</sub> 1.5 A / I<sub>trip</sub> 3.0 A / R<sub>1max</sub> 110 mΩ / V<sub>max</sub> 6 V**. Replaces L1.01's 1206L050YR **because that part's 700 mΩ post-trip resistance drops PS1's input below its 4.5 V minimum** at the burst current (§3 row 2, RK4). Existing L2.01 catalog part. **LOCKED.** | I<sub>hold</sub>, I<sub>trip</sub>, I<sub>max</sub>, V<sub>max</sub>, **R<sub>i,min</sub> 40 mΩ / R<sub>1,max</sub> 110 mΩ**, time-to-trip, package |
| **L1** | **Bourns SRN6045TA-101M** (6 × 6 × 4.2 mm semi-shielded) | 100 µH ±20 %, **DCR 456 mΩ max**, I<sub>rms</sub> 920 mA, I<sub>sat</sub> 1.33 A. The π filter's inductor. Its DCR is small enough not to eat the LDO's headroom (17 mV at full load) and large enough to help damp the LC (Q = 1.15 with C11's ESR). Same family as L2.01's SRN6045TA-4R7M. **LOCKED.** | inductance/tolerance, **DCR max**, I<sub>rms</sub>, I<sub>sat</sub>, dimensions |
| **C11** | **Panasonic EEU-FR1C221B** (radial THT, 6.3 × 12.7 mm) | 220 µF ±20 % / 16 V aluminium electrolytic, **impedance 130 mΩ @ 100 kHz**, 455 mA ripple @ 100 kHz, 105 °C/5000 h. An **electrolytic, not ceramic, on purpose**: no DC-bias derating (so the filter math holds) and its ESR damps the LC. THT and physically obvious. **LOCKED.** | capacitance/tolerance/voltage, **impedance**, ripple current, lifetime, dimensions, lead spacing |

**Supporting passives & parts.** Re-used L1.01/L1.02 catalog parts unless marked NEW:
C1, C8, C9, C10 = 10 µF 25 V X5R 0805 (KEMET `C0805C106K3PACTU`, ×4); C5, C6, C12, C13,
C16 = 1 µF (Würth `885012207103`, ×5); C2, C3, C4, C7, C14, C15 = 0.1 µF (Samsung
`CL21B104KBCNNNC`, ×6); R1, R2, R8 = 10 kΩ (Yageo `RC0805FR-0710KL`, ×3); R3, R4 =
5.1 kΩ (Yageo `RC0805FR-075K1L`, ×2); R5, R6, R17 = 470 Ω (Yageo `RC0805FR-07470RL`,
×3); **R9–R16 = 1 kΩ (Yageo `RC0805FR-071KL`, ×8) — NEW**; **R7 = 330 Ω 1206 (Yageo
`RC1206FR-07330RL`) — NEW**; LED1 = red (Würth `150080RS75000`); LED2, LED3 = yellow
(Würth `150080YS75000`, ×2); SW1, SW2 = Omron `B3F-1000` (×2); J1 = GCT `USB4110-GF-A`;
J2, J3, JP1 = Sullins `PRPC040SAAN-RC` breakaway header (**one** 1×40 strip snapped to
1×6 + 1×6 + 1×2 — 14 of 40 pins, so the BOM quantity 3 is a placement count, not three
strips to buy); **SH1 = JP1's shunt jumper, Sullins `SPC02SYAN` — NEW**; TP1, TP3, TP4 =
Keystone `5010` (red, ×3); TP2, TP5 = Keystone `5011` (black, ×2).

**Delta vs L1.01 (the new design surface).** Added: the whole isolated domain (U3, PS1,
U4, U5, L1, C10–C16, R7–R17, LED3, J2, J3, JP1, TP3–TP5) and the PTC change (F1).
Removed: L1.01's two 1×22 GPIO breakout headers (this board commits its GPIO to the
bridge; L1.01 remains the general dev board). Unchanged: the entire USB-C → PTC → ESD →
RT9080 → WROOM chain and its EN/BOOT/power-LED circuitry.

> **Silkscreen rules (part of the lesson):** a solid line the full width of the board
> down the barrier channel, on **both** silk layers, labelled **"ISOLATION BARRIER —
> DO NOT BRIDGE"**. Domain labels `GND_A` / `GND_ISO` beside every test point. J2 and J3
> pin-labelled. LED and electrolytic polarity marked. Pin 1 marked on U3 and U5.

## 5 · Power & thermal

**Rails.**

| rail | domain | source | nominal | worst-case envelope | budget |
| --- | --- | --- | --- | --- | --- |
| `VBUS_F` | A | USB-C via F1 | 5.0 V | 4.68 – 5.48 V | 157 mA typ / 597 mA burst |
| `3V3_A` | A | U2 RT9080 | 3.3 V ±2 % | — | 71 mA typ (600 mA capability) |
| `V_ISO_RAW` | **B** | PS1 (unregulated) | 5.0 V | **4.48 – 6.33 V** (6.68 V at true no-load) | 51.5 mA max of 200 mA |
| `3V3_ISO` | **B** | U4 MCP1703A | 3.3 V ±3 % | — | 37.9 mA max (250 mA capability) |

**Worst-case dissipation.** Every device is far from its limit; the board has **no
thermal design problem and `hasThermalConcern` stays false — now proven, not assumed:**

| device | worst-case P | θ<sub>JA</sub> | T<sub>j</sub> at 30 °C ambient | limit | margin |
| --- | --- | --- | --- | --- | --- |
| U2 RT9080 (radio off) | 0.102 W | ~250 °C/W | **55.5 °C** | 125 °C | 70 °C |
| U2 RT9080 (radio on, continuous 160 mA) | 0.229 W | ~250 °C/W | **87.3 °C** | 125 °C | 38 °C |
| U4 MCP1703A | 0.095 W | **62 °C/W** | **35.9 °C** | 125 °C | 89 °C |
| U3 ISO7741 | 0.030 W | 83.4 °C/W | **32.5 °C** | 150 °C | 118 °C |
| U5 MCP3208 | 0.0013 W | 86.1 °C/W | ≈ 30 °C | 125 °C | — |
| PS1 R1SE | 0.157 W (47 % of its full-load figure) | — | — | rated 100 % load to **85 °C ambient** | ✓ |
| R7 preload 1206 | 0.109 W | — | — | 0.250 W | 56 % |

**Why the linear regulator on the isolated side is acceptable.** U4 burns 95 mW turning
5.8 V into 3.3 V. On a battery board that would be indefensible; here the rail carries
≤ 38 mA and the whole point is a *quiet* supply, which is exactly what a linear
regulator gives you and a switcher does not. The efficiency cost is paid once, at the
one place in the design where noise is the currency.

**Total board input power.** 5 V × 157 mA ≈ **0.79 W** steady state. A USB source rated
**≥ 500 mA** is required (any USB 2.0 host port or USB-C charger). The board draws
continuously — there is no sleep mode — which also keeps most USB power banks from
auto-powering-off, though a wall adapter or PC port is what the lesson recommends.

## 6 · Risk register

Risk IDs are **`RK#`** so they cannot collide with resistor refDes `R1–R17` (protocol
internal-consistency rule).

| # | Risk | L × I | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **The board is mistaken for a mains-safe isolator.** Someone reads "galvanic isolation" and connects the isolated side to something mains-referenced. | Med × **Critical** | The doc leads with **§0's IS/IS NOT box** and §9 states the barrier's binding rating (**PS1: functional grade, 1 kVDC/1 s, 500 VAC/1 min**) and that **no mains, basic or reinforced claim is made**. The silkscreen carries the barrier warning. The lesson must repeat it. **The design deliberately does not add mains-capable parts**, so the board cannot be mistaken for one on the bench (no fusing for mains, no earth, no HV creepage rating claimed). | **DE-RISKED (documented; owner must carry it into the guide)** |
| **RK2** | **The PCB becomes the weakest link.** A trace, pour, via, or inner plane crossing the barrier silently destroys the isolation while the board keeps working — the worst kind of defect, because nothing fails. | Med × **Critical** | **M1 barrier keep-out ≥ 8.0 mm on all four layers**, split ground pours per domain, no vias, no components, no silkscreen conductor in the channel. Verified at `[L]` by (a) a KiCad keep-out rule area covering `F.Cu`/`In1.Cu`/`In2.Cu`/`B.Cu`, (b) DRC clean under the fab `.kicad_dru`, and (c) an explicit **net-classes-do-not-touch** ERC check between `GND_A`/`3V3_A`/`VBUS_F` and `GND_ISO`/`V_ISO_RAW`/`3V3_ISO`. | open → **close at `[L]`** |
| **RK3** | **An earthed oscilloscope shorts the barrier.** A mains-powered scope's ground clip is bonded to earth. Clip it to `GND_ISO` while the USB host is also earthed and the barrier is bypassed through the scope — and every measurement after that is a lie. | **High** × High | This is a **use** hazard, not a board defect, and the board is built to make it visible: test points are **labelled by domain** (`GND_A` on TP2, `GND_ISO` on TP5), the barrier is silkscreened, and the guide must teach it explicitly (probe one domain at a time; use a differential probe or a battery-powered scope to probe across). F10's two isolated test points sit **together on the isolated side** so the natural probing gesture is the correct one. | **DE-RISKED (accept + label + teach)** |
| **RK4** | **PTC series resistance starves the isolated converter.** PS1's 4.5 V input minimum is only 250 mV below USB's 4.75 V worst case; the L1.01 polyfuse's 700 mΩ post-trip resistance eats more than that under load. | **High** × High | **Part changed:** L1.01's `1206L050YR` (I<sub>hold</sub> 0.5 A, **R<sub>1max</sub> 700 mΩ**) → `miniSMDC150F-2` (I<sub>hold</sub> 1.5 A, **R<sub>1max</sub> 110 mΩ`**), already in the catalog from L2.01. Drop falls from 418 mV to **66 mV** at the 597 mA burst → PS1 input **4.68 V**, in spec with 184 mV to spare *even with the radio on* (§3 row 2). **Accepted trade:** 1.5 A/3 A protection is looser than L1.01's 0.5 A/1 A. Justified because this board draws ~3× L1.01's current, a hard short still trips in 500 ms, and any USB host's own limiter acts first. | **DE-RISKED (part change)** |
| **RK5** | **The isolated LDO is over-stressed by the unregulated rail.** The reuse instinct says "use the RT9080, it's already in the catalog." Its **absolute maximum V<sub>IN</sub> is 6 V**; `V_ISO_RAW` reaches **6.33 V** with the preload open and **6.68 V** at true no load. | **High** × **Critical** | **Part chosen against the datasheet, not the catalog:** MCP1703AT-3302E/DB, **abs max 18 V** → ≥ 11.3 V of margin at the worst case. Defence in depth: R7's preload keeps the normal rail at 6.00 V, so the 18 V part is not carrying the design alone. | **DE-RISKED** |
| **RK6** | **"LDO = clean rail" is false at this ripple frequency.** MCP1703A PSRR collapses to ≈ 0 dB between 15 and 30 kHz; PS1 switches at 20–70 kHz. A design that trusted the LDO would ship 100 mV p-p onto a 12-bit ADC's reference — **124 LSB of noise**. | **High** × High | **π filter added and sized on its own merit** (C10 – L1 100 µH – C11 220 µF): **46.9 dB at 20 kHz worst case**, LDO credited **0 dB**. Residual ripple **0.45 mV p-p = 0.56 LSB** (§3 rows 8–9). TP3/TP4 exist so the learner can see both sides of this with a scope. | **DE-RISKED (design change)** |
| **RK7** | **Unregulated converter runs below its specified minimum load**, so its datasheet load-regulation figures no longer apply and the rail voltage becomes an extrapolation off a graph. | Med × Med | **R7 = 330 Ω 1206 preload**, holding PS1 at **≥ 11.6 %** load (Note 5's 10 % floor). Sized in 1206 because an 0805 would run at 87 % of its rating (§3 row 13). If R7 fails open, §3 row 5 proves nothing is over-stressed. | **DE-RISKED** |
| **RK8** | **Wrong isolator default state leaves the ADC selected with a dead master.** On power-down `3V3_ISO` outlives `3V3_A` by ~26 ms; whatever the isolator's side-2 outputs default to is what CS# does. | Med × Med | **ISO7741 (non-F, default HIGH) specified explicitly**, so CS# deasserts. The F-suffix variant (default LOW) would assert CS# for 26 ms with a static clock. Recorded in §2, §4 and `bom.csv` so a "compatible" F substitution cannot be made casually. | **DE-RISKED (part variant locked)** |
| **RK9** | **Power-up glitch on the isolated bus.** While `3V3_ISO` is below the isolator's 2.25 V UVLO, U3's side-2 outputs are **undetermined** (Table 7-2). | Med × Low | U5 is on the same rail, so nothing is driven into a powered chip; U4's ~600 µs output delay makes the ramp monotonic. **Firmware idles CS# high before enabling the bus and discards the first conversion.** Firmware-owned, documented in the guide. | **DE-RISKED (firmware-owned)** |
| **RK10** | **Back-powering the isolated side through J3.** Per the ISO774x Table 7-2 note, a strongly driven input can weakly power a floating V<sub>CC</sub> through an internal protection diode — so an externally-powered device on J3 could partly energise `3V3_ISO` with PS1 off. | Low × Med | **R9–R12 (1 kΩ)** bound the injected current to **4.3 mA**, inside the ±15 mA abs-max I<sub>O</sub> (§3 row 28). The condition is detectable (the ADC returns nonsense) and self-limiting. Documented; J3's power pins are labelled as **outputs**. | **DE-RISKED (accept + limit + label)** |
| **RK11** | **Bus contention on ISO_MISO.** There is one CS# channel. An external device on J3 sharing it with the on-board ADC would fight U5's DOUT. | Med × Med | **JP1** gates U5's CS#, with **R8 10 kΩ** holding it deasserted when the shunt is removed. Fitted = on-board ADC; removed = J3 owns the bus. Silkscreened `ADC`. | **DE-RISKED** |
| **RK12** | **Over-voltage on the isolated analog inputs.** J2 is the "field side" — a learner will connect something, and the MCP3208's inputs are only rated −0.6 V to V<sub>DD</sub>+0.6 V. | **High** × Med | **R13–R16 (1 kΩ)** limit fault current; 12-bit settling proven to tolerate up to **8.3 kΩ** of total source impedance so the resistors cost nothing in accuracy (§3 row 27). **This is current limiting, not clamping** — the doc and silkscreen state **0–3.3 V only**. A learner who applies 12 V injects ~8 mA into the ESD structure: survivable in practice, not guaranteed by datasheet. Accepted, with the honest caveat stated rather than a false claim of protection. | **DE-RISKED (accept + limit + label)** |
| **RK13** | **A "compatible" LDO substitution destroys the board.** SOT-223 3.3 V LDO pinouts are **not** consistent across families: MCP1703A is 1 = V<sub>IN</sub>, 2 = GND, 3 = V<sub>OUT</sub>; NCP1117/AMS1117-class parts are 1 = ADJ/GND, 2 = V<sub>OUT</sub>, 3 = V<sub>IN</sub>. Same package, same function, reversed. | Med × High | Recorded here and in §8's second-source note. The only second source listed as **drop-in** is `MCP1755S-3302E/DB`, and even that is flagged **"confirm pinout before substituting."** No ECN may swap U4 without a pad-level check. | **DE-RISKED (documented)** |
| **RK14** | **Barrier geometry of PS1's own land pattern is not yet pad-verified.** The board's ≥ 8.0 mm gap is driven by U3's datasheet figures; PS1's input-to-output pad separation was read from a dimension drawing, not measured. Same class of gap: U4's SOT-223 tab net. | Med × Med | Captured as an **`[S]` item**: at schematic/footprint selection, measure PS1's recommended land pattern input-to-output pad-edge separation and confirm it is **not reduced** by the chosen footprint; confirm pad 8's side of the barrier; confirm the MCP1703A SOT-223 tab is common with pin 2 (GND). The board gap is then set to the **larger** of U3's requirement and PS1's own separation. | open → **close at `[S]`** |
| **RK15** | **USB D+/D− routing** — poor length match or a broken reference hurts full-speed signalling, and on this board the pair must also stay entirely within the controller domain. | Low × Med | Short, length-matched pair on `F.Cu` over the **controller-side** `In1.Cu` pour, through D1 at the connector. **The pair never approaches the barrier.** Closed in KiCad layout. | open → **close at `[L]`** |
| **RK16** | **Antenna keep-out** — copper under the WROOM's PCB antenna detunes it and voids the module's pre-certification, even though this board does not use the radio. | Low × Med | Module on a board **edge**, keep-out excluding **all four** copper layers per Espressif integration rules (M3). Closed at layout review. | open → **close at `[L]`** |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board**:

- [ ] **Calc trail recorded** — all 35 derived values in §3 trace to a cited datasheet
  section, worst-case, with units checked.
- [ ] **Each IC datasheet-verified** — §4 records the sections read for all nine active
  parts (U1–U5, D1, PS1, F1, L1) plus C11, against the manufacturers' own documents.
- [ ] **Footprint ↔ pinout cross-checked** — **`[S]`, owed at schematic capture.** Cannot
  honestly close pre-schematic (protocol audit 6). Carries RK14's three specific
  pad-level questions.
- [ ] **Fab-DRU DRC clean** — **`[L]`, owed at layout.** Plus the barrier ERC invariant
  (RK2).
- [ ] **BOM availability confirmed** — all 26 lines matched, lifecycle Active, in stock
  (live DigiKey screen, §8).
- [ ] **All top risks de-risked** — RK1, RK3–RK13 de-risked at `[D]`; RK14 closes at
  `[S]`; RK2, RK15, RK16 close at `[L]`.

Conditional — **the isolation review fires on this board's nature, not on a project
flag.** The protocol lists conditional audits as firing on "the board's nature / project
flags"; a board whose entire subject is a galvanic barrier owes the safety/isolation
audit regardless of `hasMainsNet`. **No project flag needs changing** (§11):

- [ ] **Isolation / creepage review** — barrier rating traced to its weakest crossing
  element, creepage/clearance requirement derived from the parts, PCB keep-out
  specified on all layers, and the isolation claim stated *and bounded* in §9. **Add
  this row manually when the DESIGN_VALIDATION checklist is materialized** — the seeded
  conditional rows key off `hasMainsNet`/`hasLiIon`/`hasThermalConcern`/
  `requiresStripboard`, all four of which are correctly false here.
- [ ] ~~Safety review (mains / Li-ion / thermal)~~ — **N/A.** No mains net, no cell, no
  thermal concern (§5 proves all margins ≥ 38 °C).
- [ ] ~~Stripboard validation~~ — **N/A**, and impossible by construction (§1).

> These are *attestations* (a human checked), not machine proofs — except BOM
> availability (DigiKey/parts MCP) and DRU presence, which are verifiable. `[S]`/`[L]`
> items are explicitly **owed** at their phase, not waived.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** **~$30–32** per board. Actual ≈ **$30.60** at DigiKey
  singles. The isolation costs about $8 of that (PS1 $4.37 + U3 $3.56) — worth calling
  out in the lesson, because "isolation is expensive" is a real engineering fact.
- **Reuse:** **17 of 26 lines are existing curated-catalog parts.** Nine parts are new:
  `ISO7741DWR`, `R1SE-0505-R`, `MCP3208-CI/SL`, `MCP1703AT-3302E/DB`, `SRN6045TA-101M`,
  `EEU-FR1C221B`, `RC0805FR-071KL` (1 kΩ), `RC1206FR-07330RL` (330 Ω 1206), `SPC02SYAN`
  (shunt).
- **BOM frozen:** **not yet.** Freeze (`bomFrozenAt`) is a side-effect of advancing past
  `BOM_SOURCING` into `LAYOUT` — **held** pending the owner's go-ahead, part creation,
  and the `[S]`/`[L]` audits.

### Sourcing evidence — live DigiKey screen (2026-07-30)

Screened with `scripts/digikey-stock.ts` (the project's own DigiKey client). **All 26
lines matched, lifecycle Active, in stock.** The `(manufacturer, mpn)` strings below are
byte-for-byte what the strict BOM import must match — see the note on manufacturer
strings beneath the table.

| refDes | Manufacturer | MPN | Qty | Role | Stock | Unit $ | New? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| U1 | Espressif Systems | ESP32-S3-WROOM-1-N16R2 | 1 | MCU module | 8,237 | 6.32 | reuse |
| U2 | Richtek | RT9080-33GJ5 | 1 | `3V3_A` LDO, 600 mA | 94,938 | 0.28 | reuse |
| U3 | Texas Instruments | ISO7741DWR | 1 | **4-ch digital isolator, 3F/1R** | 6,330 | 3.56 | **NEW** |
| U4 | Microchip Technology | MCP1703AT-3302E/DB | 1 | **`3V3_ISO` LDO, 18 V abs max** | 5,231 | 0.84 | **NEW** |
| U5 | Microchip Technology | MCP3208-CI/SL | 1 | **12-bit 8-ch SPI ADC (isolated)** | 5,914 | 2.78 | **NEW** |
| D1 | STMicroelectronics | USBLC6-2SC6 | 1 | VBUS + D± ESD array | 79,125 | 0.57 | reuse |
| PS1 | Recom Power | R1SE-0505-R | 1 | **1 W isolated DC-DC, unregulated** | 11,405 | 4.37 | **NEW** |
| F1 | Littelfuse | miniSMDC150F-2 | 1 | PTC 1.5 A hold / 110 mΩ | 8,408 | 0.61 | reuse (L2.01) |
| J1 | GCT | USB4110-GF-A | 1 | USB-C receptacle | 183,940 | 1.27 | reuse |
| J2,J3,JP1 | Sullins Connector Solutions | PRPC040SAAN-RC | 3 † | breakaway header → 1×6 + 1×6 + 1×2 | 52,246 | 1.23 | reuse |
| SH1 | Sullins Connector Solutions | SPC02SYAN | 1 | **JP1 shunt jumper** | 549,916 | 0.10 | **NEW** |
| L1 | Bourns Inc. | SRN6045TA-101M | 1 | **100 µH π-filter inductor** | 40,847 | 0.47 | **NEW** |
| C11 | Panasonic Industry | EEU-FR1C221B | 1 | **220 µF 16 V electrolytic (π filter)** | 8,507 | 0.48 | **NEW** |
| C1,C8,C9,C10 | KEMET | C0805C106K3PACTU | 4 | 10 µF 25 V bulk/decoupling | 126,056 | 0.29 | reuse |
| C5,C6,C12,C13,C16 | Würth Elektronik | 885012207103 | 5 | 1 µF LDO + V<sub>REF</sub> | 10,151 | 0.31 | reuse |
| C2,C3,C4,C7,C14,C15 | Samsung Electro-Mechanics | CL21B104KBCNNNC | 6 | 0.1 µF decoupling + EN | 6,948,631 | 0.10 | reuse |
| R1,R2,R8 | Yageo | RC0805FR-0710KL | 3 | 10 kΩ EN / BOOT / ADC-CS pull-ups | 3,149,543 | 0.10 | reuse |
| R3,R4 | Yageo | RC0805FR-075K1L | 2 | 5.1 kΩ USB-C CC sink | 213,955 | 0.10 | reuse |
| R9–R16 | Yageo | RC0805FR-071KL | 8 | **1 kΩ isolated-header series** | 445,287 | 0.10 | **NEW** |
| R5,R6,R17 | Yageo | RC0805FR-07470RL | 3 | 470 Ω LED series | 146,292 | 0.10 | reuse |
| R7 | Yageo | RC1206FR-07330RL | 1 | **330 Ω 1206 PS1 preload** | 133,038 | 0.10 | **NEW** |
| LED1 | Würth Elektronik | 150080RS75000 | 1 | Red — `3V3_A` power | 84,821 | 0.19 | reuse |
| LED2,LED3 | Würth Elektronik | 150080YS75000 | 2 | Yellow — SCAN + `3V3_ISO` power | 47,851 | 0.19 | reuse |
| SW1,SW2 | Omron | B3F-1000 | 2 | EN (reset) / BOOT | 40,087 | 0.35 | reuse |
| TP1,TP3,TP4 | Keystone Electronics | 5010 | 3 | red TPs: `3V3_A`, `V_ISO_RAW`, `3V3_ISO` | 238,386 | 0.30 | reuse |
| TP2,TP5 | Keystone Electronics | 5011 | 2 | black TPs: `GND_A`, `GND_ISO` | 289,335 | 0.27 | reuse |

**26 line items · 57 placements · ≈ $30.60.**

> † **Header quantity.** The strict-import rule is *refDes count = quantity*, so J2, J3
> and JP1 give quantity 3. **Physically one 1×40 breakaway strip covers all three**
> (14 of 40 pins), so the cost total counts one strip at $1.23, not three.

> **Manufacturer strings — the import matches the LIBRARY, not DigiKey.** DigiKey's
> canonical names differ from the curated catalog's for several of these (DigiKey says
> `YAGEO`, `Littelfuse Inc.`, and uppercases `MINISMDC150F-2`; the library uses `Yageo`,
> `Littelfuse`, `miniSMDC150F-2`). `bom.csv` uses the **library** strings for reused
> parts and follows the library's existing conventions for new ones. Verified against
> `docs/boards/l1-02-espnow-link/bom.csv` and the parts-MCP record for
> `miniSMDC150F-2`. **The nine new parts must be created with exactly the strings in
> `bom.csv`** — in particular `Recom Power`, `Bourns`, `Panasonic`, `Texas Instruments`
> and `Microchip Technology`, following the library's existing habit of dropping
> corporate suffixes (`Bourns`, not `Bourns Inc.`; `Panasonic`, not
> `Panasonic Industry`).

**Second sources.**

| part | second source | caveat |
| --- | --- | --- |
| U4 MCP1703AT-3302E/DB | `MCP1755S-3302E/DB` (Microchip, SOT-223-3, 16 V, 300 mA, 2,078 in stock) | **Confirm pinout before substituting — RK13.** NCP1117/AMS1117-class SOT-223 parts are *not* drop-in. |
| C11 EEU-FR1C221B | `UWT1C221MCL1GS` (Nichicon, 220 µF 16 V, **SMD** V-chip, 84,071 in stock) | different footprint; ESR must stay ≥ ~0.1 Ω for the damping in §3 row 10 |
| D1 USBLC6-2SC6 | UMW `USBLC6-2SC6` (pin/spec-compatible; used on L1.01 when ST was out) | — |
| U3 ISO7741DWR | **none accepted.** ADuM1401 (3F/1R) is functionally equivalent but has a **different pinout and different insulation figures**; ISO7741**F** is *not* a substitute (RK8) | any change re-opens §9 |
| PS1 R1SE-0505-R | **none accepted at design stage.** Any alternative changes the board's isolation rating, which §9 is written against | any change re-opens §9 |
| commodity 0805/1206 R/C, LEDs, buttons, headers, test points | any in-stock equivalent | low risk |

**Lifecycle findings recorded during sourcing:**
- **`ISO7741DW` (tube) is Obsolete with 0 stock at DigiKey.** The orderable part is
  **`ISO7741DWR`** (tape and reel), Active, 6,330 in stock. Same die, same package.
- **`MCP1703A-3302E/DB` (tube) shows 0 stock.** The orderable part is
  **`MCP1703AT-3302E/DB`** (tape and reel), Active, 5,231 in stock.
- Both are the same trap: **the tube-packaged orderable number is not the stocked one.**
  A BOM written from a datasheet's "Device Ordering Information" table alone would have
  specified two unbuyable parts.

## 9 · Isolation review (conditional audit — fired on the board's nature)

Run in full as `validation-log.md` **pass 15**. This section is the deliverable.

### 9.1 What crosses the barrier

Exactly three things, and nothing else:

1. **U3 ISO7741DWR** — four capacitively-coupled signal channels.
2. **PS1 R1SE-0505-R** — a transformer.
3. **The air and FR-4 in the ≥ 8.0 mm keep-out channel.**

There is **no** shared ground, no shared rail, no shunt/sense resistor, no Y-capacitor,
no ferrite, no mounting hardware, and no earth connection bridging the two domains.

> **A Y-capacitor was considered and deliberately rejected.** RECOM's EN 55032 **Class
> B** filter suggestion for this converter includes two **330 pF safety capacitors
> across the barrier**. Fitting them would improve conducted emissions and *reduce the
> isolation* — the exact trade this board exists to make visible. **They are omitted.**
> The board adopts only the **Class A** input capacitance (C8/C9, §3 row 35) and
> **makes no EMC compliance claim.** For a teaching board about galvanic separation,
> an intact barrier is worth more than an emissions grade.

### 9.2 The barrier's rating is the weakest link

| element | withstand | working voltage | insulation grade | source |
| --- | --- | --- | --- | --- |
| U3 ISO7741DWR | **5000 V<sub>RMS</sub>** (UL 1577, 60 s) · V<sub>IOTM</sub> 8000 V<sub>PK</sub> · V<sub>IOSM</sub> 12 800 V<sub>PK</sub> | **V<sub>IOWM</sub> 1500 V<sub>RMS</sub>** (36-yr projected lifetime) · V<sub>IORM</sub> 2121 V<sub>PK</sub> | **reinforced** per VDE/CSA/TÜV/CQC | ISO774x §5.6, Fig 8-7 |
| PS1 R1SE-0505-R | **1000 V<sub>DC</sub> tested for 1 second**; **500 V<sub>AC</sub>/60 Hz rated for 1 minute** | **not specified** | **`functional`** | R1SE "Protections" table |
| PCB keep-out | ≥ 8.0 mm creepage and clearance, pollution degree 2 | — | not the limiting element by design | M1 |

**Therefore the board's isolation is FUNCTIONAL, bounded by PS1.** A 1-second type test
is a manufacturing screen, not a continuous working-voltage rating; there is no
published V<sub>IOWM</sub> for PS1, and its own datasheet says `functional`. The ISO7741's
reinforced rating applies **to the ISO7741 only** and does not transfer to the assembly.

### 9.3 What is claimed, and what is not

**Claimed:**
- A genuine DC and low-frequency galvanic break between the two domains, sufficient to
  **break a ground loop** and to give the isolated measurement **common-mode noise
  immunity** (U3 CMTI ≥ 85 kV/µs; barrier coupling ≈ 76 pF, §3 row 17).
- Both domains are **SELV**: USB-powered, nothing on the board exceeds 6.7 V.
- The PCB does not degrade either crossing component's own rating.

**Not claimed — explicitly:**
- ❌ **Not rated for mains or any mains-adjacent circuit.** No basic insulation, no
  reinforced insulation, no double insulation *as an assembly*.
- ❌ **No safety-agency approval of the board.** Component-level certifications
  (U3's UL 1577 / VDE 0884-17; PS1's UL 60950-1 E358085) belong to the components. An
  assembly is certified by testing the assembly, which has not been done.
- ❌ **No continuous working-voltage rating.** PS1 publishes none.
- ❌ **No medical, no IEC 60601, no patient-connected use.**
- ❌ **No transient/surge rating for the assembly**, notwithstanding U3's own figures.
- ❌ **No EMC compliance claim** (§9.1).

**Practical ceiling for use:** design working voltage across the barrier is **0 V
nominal**. Keep any potential difference below **50 V DC / 30 V AC** — the conventional
touch-safe threshold — and never connect the isolated side to a mains-referenced
circuit. If a learner needs mains-adjacent isolation, they need a different board,
designed to a standard, and tested.

### 9.4 Creepage and clearance derivation

- **U3 DW-16:** external clearance **> 8 mm**, external creepage **> 8 mm**, CTI
  **> 600 V** (material group I), pollution degree 2, DTI > 17 µm. The datasheet warns
  that board pads must not reduce these distances.
- **Requirement from standards is far smaller.** At the potentials this board actually
  sees (SELV, ≤ 6.7 V), IEC 60664-1 functional-insulation creepage for pollution degree
  2 and material group I is on the order of tenths of a millimetre. **The 8 mm gap is
  therefore not set by the electrical stress — it is set by the obligation not to
  reduce the components' own published ratings.** Saying so plainly matters: the board
  is over-spaced relative to its own working voltage, and that is deliberate.
- **Board rule (M1):** keep-out channel **≥ 8.0 mm**, all four copper layers, no vias,
  no components, no conductive silkscreen, split ground pours per domain. Set to the
  **larger** of U3's requirement and PS1's own land-pattern separation once the latter
  is pad-verified (RK14).
- **Optional enhancement, not required:** the ISO774x datasheet notes that grooves or
  slots in the PCB increase creepage. A milled slot in the channel would look
  impressive and teach well; it is **not needed** at these potentials and adds fab cost.
  Recorded as a layout option, not a requirement.

### 9.5 Fusing and fault behaviour across the barrier

- **Controller side:** F1 PTC (1.5 A hold / 3.0 A trip) on VBUS protects the host port
  and the board.
- **Isolated side:** **no fuse, by design.** PS1 is a 1 W source with **short-circuit
  protection (below 100 mΩ, 1 s)** and the island's total budget is 38 mA. The
  converter *is* the current limit. A dead short on `3V3_ISO` is bounded by U4's own
  short-circuit current (400 mA typ) and then by PS1's SCP.
- **A barrier fault is not electrically detectable by this board.** If a solder bridge
  or a scope clip shorts the domains, everything keeps working — which is precisely why
  RK2 and RK3 are rated Critical/High and why the ERC net-class invariant is a gate item
  rather than a nice-to-have.

## 10 · RF / regulatory (conditional audit — module present but unused)

The ESP32-S3-WROOM-1 is a **pre-certified module** (FCC/IC/CE). This board makes no use
of the radio (E6), but the module is physically present and can be enabled in firmware,
so the antenna keep-out (M3) is honored exactly as on L1.01/L1.02: module on a board
edge, keep-out excluding all four copper layers. No external antenna, no RF connector,
no matching network. **No board-level radiator certification is required or claimed.**
The isolated domain is on the opposite side of the board from the antenna, so the
keep-out and the barrier keep-out do not compete for the same space.

## 11 · Project flags — assessment

| flag | current | change needed? | why |
| --- | --- | --- | --- |
| `hasMainsNet` | `false` | **NO** | There is no mains net. Setting it true to "force" the safety checklist would be a **false statement about the design** and would materialize mains-specific checklist items (earthing, mains fusing, HV creepage) that this board cannot honestly satisfy. The isolation audit fired on the board's *nature* instead, was run in full (§9), and §7 carries an explicit conditional row for it. |
| `hasLiIon` | `false` | **NO** | No cell, no charger, no protection circuit. |
| `hasThermalConcern` | `false` | **NO** | Proven, not assumed: every device's worst-case junction temperature has ≥ 38 °C of margin (§5). No pour, heatsink, or derating design is required. |
| `requiresStripboard` | `false` | **NO** | Fabbed 4-layer PCB. Stripboard is not merely undesirable here — its continuous copper strips would bridge the isolation barrier, so the board is **unbuildable** on it. |

**Recommendation to the owner:** leave all four flags as they are, and **add one
conditional row — "Isolation / creepage review" — to the DESIGN_VALIDATION checklist by
hand** when it is materialized. If the pipeline ever grows a dedicated
`hasIsolationBarrier` flag, this board is its first customer.
