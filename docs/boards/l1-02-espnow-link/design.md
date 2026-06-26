# ESP-NOW Wireless Link Node (L1.02) — design doc

> Curriculum board `l1-02-espnow-link` (COMMS / L1). The second board in the
> path, built directly on the **L1.01 WROOM breakout** (a `FOUNDATION` dependency).
> Draft → validate (lock the math + ICs) → source/freeze the BOM → only then author
> the guide.

> ⛔ **NOT part-ready yet.** This board owes the **Recursive Board-Design Validation
> Protocol** (`../_protocol.md`) before *any* part is created, BOM imported, or
> revision advanced: ≥ 10 recursive audit passes, a "dry" pass, every applicable
> audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION` ticks are
> honest human attestations — earn them.

| | |
| --- | --- |
| **Slug** | `l1-02-espnow-link` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **draft**, sourced, pending validation pass) |
| **Track / Level** | COMMS / L1 |
| **Teaches** | Peer-to-peer wireless linking — ESP-NOW pairing, TX/RX roles, channel + peer (MAC) addressing |
| **Validation** | `not started` → see `validation-log.md` |

> **Design headline:** this board is the **L1.01 WROOM core, re-used verbatim and
> focused into a wireless node.** The *only* new design surface vs the validated
> L1.01 breakout is a **dedicated USER/SEND button** + a **LINK/RX indicator LED**
> on safe GPIO. Every active part, the power chain, USB-C, ESD, and protection are
> the **already-validated, already-curated L1.01 parts** (`mcp__otd-parts` catalog).
> A learner builds **two identical boards** — ESP-NOW peers are symmetric, so the
> hardware is identical and the **role (transmitter / receiver) is set in firmware.**

---

## 1 · ORIENT — what & why

- **What it is:** A **purpose-built ESP-NOW node** — a USB-C ESP32-S3-WROOM-1 board
  whose I/O is reduced to exactly what a wireless-link lesson needs: **one user
  button** (press to send) and **one link LED** (lights on receive). The learner
  built the general L1.01 breakout already; **L1.02 reuses that proven core** so the
  lesson can be about the *radio*, not new soldering. **Built as a pair** (two
  identical nodes) — ESP-NOW is peer-to-peer, so both boards are the same design and
  each can act as transmitter *or* receiver depending on the firmware flashed.

- **Functional requirements:**
  - **F1** — Run an ESP32-S3-WROOM-1 from a single USB-C cable (power + flash +
    console), identical to L1.01 (native USB Serial/JTAG, no bridge IC, no driver).
  - **F2** — **Two identical boards** form a TX/RX pair; role is a firmware build
    flag, not a hardware difference. Either board can transmit or receive.
  - **F3** — A **dedicated momentary USER button** (the "send a packet" stimulus) on
    a **non-strapping, non-USB GPIO**, so it never interferes with boot or USB.
  - **F4** — A **LINK/RX indicator LED** on a safe GPIO (lights when an ESP-NOW
    packet arrives) — the visible proof the wireless link works.
  - **F5** — Manual **EN (reset)** and **BOOT (GPIO0)** buttons (manual download
    fallback), exactly as L1.01.
  - **F6** — **Power LED** (always-on, on the 3V3 rail) so the learner can see the
    board is alive.
  - **F7** — **Resettable overcurrent protection** (PTC polyfuse) on VBUS, as L1.01.
  - **F8** — A **small expansion header** breaking out 5 V / 3V3 / GND + a few free
    GPIO (incl. **ADC1** pins), so the node is a reusable building block — this board
    is itself a `FOUNDATION` dependency of `l3-05-wireless-hub`.

- **Electrical / power budget:**
  - **E1** — Input: USB-C **VBUS 5 V** (sink role), Rd = 5.1 kΩ on CC1 **and** CC2.
  - **E2** — Regulate to **3.3 V**. The **ESP-NOW radio runs on the Wi-Fi MAC/PHY**,
    so the current profile equals L1.01's Wi-Fi case: brief TX peaks ~500 mA, typical
    80–160 mA. LDO ≥ 600 mA + 10 µF bulk to ride the TX transient.
  - **E3** — MCU domain is **3.3 V**; ESP32-S3 GPIO is **not 5 V-tolerant** — 5 V is
    exposed on the header only for *powering* peripherals, never into a GPIO.
  - **E4** — **A receiving node keeps the radio awake continuously** (ESP-NOW RX must
    listen), so idle draw is ~80–100 mA, not microamps — this is the **auto-shutoff
    prevention strategy** (see §6 RK8): the continuous draw keeps most USB power banks
    from auto-powering-off; **no deep-sleep in L1.02**.

- **Interfaces:**
  - **I1** — USB-C, USB 2.0 full-speed, **sink**. D+/D- → USBLC6 ESD → module native
    USB pins (GPIO19 = D-, GPIO20 = D+).
  - **I2** — Native USB Serial/JTAG (CDC) for flash + console.
  - **I3** — **2.4 GHz ESP-NOW** over the WROOM-1's **on-module PCB antenna** (no
    external antenna, no RF connector) — connectionless Wi-Fi MAC-layer link, peers
    addressed by **MAC address**, both peers on a **common Wi-Fi channel** (firmware).
  - **I4** — 1× 2.54 mm expansion header (5 V / 3V3 / GND + free GPIO incl. ADC1).

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, no stripboard.** All project
    flags are **false** (`hasMainsNet=false`, `hasLiIon=false`,
    `hasThermalConcern=false`, `requiresStripboard=false` — the stripboard flag was a
    seed-time error, corrected 2026-06-25). So §7 lists **only the 6 core validation
    items**.
  - **ADC1-only constraint (recorded):** **ADC2 is unusable while the radio (Wi-Fi /
    ESP-NOW) is active.** This board uses no on-board analog input, but the expansion
    header (F8) deliberately exposes **ADC1** pins so any analog sensor a learner adds
    later works while ESP-NOW is running. (REQUIREMENTS checklist item.)
  - **Antenna keep-out (M1):** module on a board **edge**, PCB antenna over a keep-out
    (no copper/parts under/beside it) per Espressif S3-WROOM-1 integration rules —
    the radio is now load-bearing for the lesson, so this is mandatory, verified at
    layout.
  - **Solderability (L1 constraint, first-class):** no leadless packages; passives
    ≥ 0805; leaded SMD (SOT-23, SOIC) + through-hole; buttons + headers THT; USB-C
    (J1) is a right-angle receptacle — **SMT contacts with through-hole solder-retention
    posts** (the same part L1.01 proved hand-solderable; the posts anchor it, the
    contacts are SMT — the hardest joint on the board). Identical envelope to L1.01 —
    **no new package risk** (every part is a re-used L1.01 part).
  - **Regulatory:** ESP32-S3-WROOM-1 is a **pre-certified module** (FCC/IC/CE) — no
    board-level radiator cert, provided antenna keep-out (M1) is honored.

## 2 · Topology

Identical power/USB chain to L1.01; the I/O is reduced to a wireless node's
essentials. Block diagram for **one node** (build two):

```
            ┌───────────────── USB-C (sink) ─────────────────┐
   VBUS 5V  │  CC1/CC2 → 5.1k×2 → GND (Rd, sink advertise)    │
   ────┬────┘  D+/D- ───────────────────────┐                │
       │                                      │               │
   [PTC polyfuse F1]                 [USBLC6-2 D1: VBUS + D+/D- ESD]
       │                                      │
       ▼                                      ▼  GPIO19/20 (native USB)
  ┌──────────┐   3V3 rail           ┌────────────────────────────────┐
  │ LDO U2   │──────┬──────────────►│   ESP32-S3-WROOM-1 (U1)         │
  │ RT9080   │ 1µF  │ +10µF bulk    │   • native USB (no bridge)      │
  │ 3.3V/    │ ×2   │ +0.1µF×2 decap│   • EN: 10k↑(R1)+0.1µF(C4)+SW1  │
  │ 600mA    │      │               │   • GPIO0: 10k↑(R2)+SW2 (BOOT)  │
  └──────────┘      │               │   • GPIO21 ← USER/SEND (SW3,    │
                    │               │       internal pull-up → GND)   │
                    ├─► Power LED   │   • GPIO47 → LINK/RX LED (LED2)  │
                    │   LED1(red)+R5│       via R6 470Ω                │
                    │               │   • 2.4GHz ESP-NOW via PCB ant.  │
                    │               │   • free GPIO + 5V/3V3/GND ──► J2│
                    └─► 3V3 to J2   └────────────────────────────────┘
```

**Sub-circuits the schematic is organised into:** (1) USB-C input + CC sink
pull-downs, (2) protection (PTC polyfuse + USBLC6 ESD), (3) 3V3 power (RT9080 LDO +
decoupling), (4) the S3-WROOM-1 module with EN/BOOT strap+button RCs, (5) node I/O
(USER button on GPIO21, LINK LED on GPIO47, power LED on 3V3), (6) expansion header
+ color-coded test points.

**Theory of operation:** Power/USB are L1.01 verbatim — VBUS → PTC → ESD → LDO →
3.3 V; D+/D- straight to the module's native USB. The **new behaviour** is the
link: press the **USER button (GPIO21)** on node A → firmware sends an ESP-NOW packet
to node B's MAC on the shared channel → node B lights its **LINK LED (GPIO47)**.
Because the nodes are identical, the reverse works too; "transmitter" vs "receiver"
is purely the firmware flashed. The radio is the **on-module PCB antenna**; nothing
on the board tunes or switches RF.

**GPIO map (safety-driven — avoids every strapping / USB / flash pin):**

| Signal | GPIO | Why this pin is safe |
| --- | --- | --- |
| USER/SEND button | **GPIO21** | Plain GPIO; **not** a strapping pin (0/3/45/46), **not** USB (19/20), **not** an ADC pin → leaves all ADC1 free for the header. Internal pull-up, button to GND. |
| LINK/RX LED | **GPIO47** | Plain digital out; not strapping/USB/ADC; available on the WROOM-1 (not a flash/PSRAM pin). |
| BOOT button | GPIO0 | Strapping pin **by design** (boot-mode select), 10 kΩ pull-up + button to GND, as L1.01. |
| Native USB | GPIO19 / GPIO20 | Module's fixed USB D- / D+. |
| Expansion header (J2) | GPIO1,2,4,5,6 (ADC1) + GPIO7–10 spares + 5V/3V3/GND | ADC1 exposed so analog-over-ESP-NOW works (ADC2 is dead while the radio runs). **Excludes** every used/strapping/USB pin (GPIO0/19/20/21/47, EN). |

**Pin-accounting policy (logical net, pre-schematic — the `[S]` stage re-verifies the
exact pad map):** all 41 module pins are accounted for — GND/EPAD (pins 1, 40, 41) →
GND; 3V3 (pin 2) → rail; EN (pin 3) → RK1 RC + SW1; GPIO0 → BOOT pull-up + SW2;
GPIO19/20 → native USB; GPIO21 → USER button; GPIO47 → LINK LED; the **strapping pins
GPIO3/45/46 are left NC at their module-internal default states** (not used for any
function and not exposed on J2, so no boot-strap hazard); remaining free GPIO are
either routed to J2 or left NC. No floating inputs are read in firmware. (This is the
audit-2 net-integrity closure at the `[D]` stage.)

## 3 · Calc trail (DO — lock the math)

Worst-case (min/max), not typical. The power chain is **unchanged from L1.01**; its
numbers are re-proven here against the **same part datasheets** so this board stands
on its own.

| Value | Formula / source | Result | Notes |
| --- | --- | --- | --- |
| 3V3 rail | USB VBUS 5 V → RT9080 LDO output | 3.3 V ±2% | E2; ESP32-S3 domain is 3.3 V (E3) |
| LDO current headroom | ESP-NOW = Wi-Fi MAC/PHY: TX peak ~500 mA (brief), typ 80–160 mA → spec ≥ 600 mA | 600 mA LDO | E2; identical profile to L1.01 Wi-Fi case |
| LDO dropout @ 600 mA | RT9080 datasheet: 0.53 V typ → Vin_min = 3.3 + 0.53 = 3.83 V ≪ 5 V VBUS (worst-case USB-C VBUS 4.75 V still clears it) | 0.53 V | comfortable margin even at USB low-line 4.75 V |
| LDO in/out caps | RT9080 datasheet — stable with 1 µF ceramics | 1 µF ×2 (C5,C6) | re-used L1.01 value/part |
| Bulk on 3V3 | ride the radio-TX current transient | 10 µF (C1) | + 0.1 µF module decoupling (C2,C3) |
| EN power-on-reset RC | EN 10 kΩ pull-up + 0.1 µF cap; τ = 10k·0.1µF = 1 ms | 10 kΩ + 0.1 µF (R1,C4) | clean POR / debounce of EN/SW1 |
| GPIO0 (BOOT) strap | 10 kΩ pull-up + SW2 to GND | 10 kΩ (R2) | hold-low = bootloader; manual download fallback |
| USER button (GPIO21) | input, **internal** pull-up (~45 kΩ typ) + SW3 to GND | no external R | teaches internal pull-ups; debounced in firmware |
| CC sink pull-downs (Rd) | USB-C sink advertise: 5.1 kΩ on **both** CC1 + CC2 | 5.1 kΩ ×2 (R3,R4) | required for the host to source VBUS |
| LED series R | (3.3 − Vf) / R. Power LED red Vf≈1.8 V: (3.3−1.8)/470 = **3.2 mA**. Link LED yellow Vf≈2.0 V: (3.3−2.0)/470 = **2.8 mA** | 470 Ω (R5,R6) | clearly visible, well under LED + GPIO limits |
| LED GPIO drive | ESP32-S3 source/sink ≤ 40 mA abs-max per pin; 2.8 mA ≪ that | 2.8 mA | huge margin; LED current-limited by R6 |
| Power-LED color/Vf | red Vf ~1.8 V lights on 3V3; green Vf ~3.2 V would NOT | red LED1 | re-used L1.01 finding |
| PTC polyfuse | resettable VBUS overcurrent: 0.5 A hold / 1 A trip, 6 V | 1206L050YR (F1) | F7; hold (0.5 A) vs ~0.5 A brief TX peak — see §6 RK9 |
| Idle/RX current floor | radio kept awake for RX listen | ~80–100 mA | E4; keeps power banks from auto-off (RK8) |
| LDO worst-case junction temp | Tj = Tamb + θJA·P. Continuous worst 0.16 A: P = 1.7 V·0.16 A = 0.27 W; TSOT-23-5 θJA ≈ 250 °C/W; Tamb 30 °C → 30 + 250·0.27 = **98 °C** | 98 °C (Tj,max 125 °C) | 27 °C margin; brief 1 W TX peaks are damped by thermal mass → `hasThermalConcern=false` (§5) |

## 4 · IC selection (DO — lock the parts)

Every active part is a **re-used, already-validated L1.01 part** (same datasheet
sections apply; pinouts are VERIFIED in the Foundry catalog). "Datasheet-verified"
= the relevant sections were read, not the marketing page.

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U1 | Espressif **ESP32-S3-WROOM-1-N16R2** | Native USB; dual-core; 16 MB flash + 2 MB **quad** PSRAM (quad keeps GPIO33–37 free); **on-module PCB antenna** carries the 2.4 GHz ESP-NOW link; castellated edge pads (iron-solderable). Pinout VERIFIED in catalog. **Re-used L1.01 core. LOCKED.** | pinout (GPIO19/20 USB, strapping 0/3/45/46), power domains, antenna keep-out integration rules |
| U2 | **Richtek RT9080-33GJ5** (TSOT-23-5) | 3.3 V / 600 mA LDO w/ EN; 0.53 V dropout @ 600 mA; OC/OT protection; stable with 1 µF ceramics. **Re-used L1.01. LOCKED.** | pinout, dropout vs current, abs-max, min output cap |
| D1 | **STMicroelectronics USBLC6-2SC6** (SOT-23-6) | ESD/TVS array on VBUS + D+/D-. The genuine STMicro part is **now in stock** (10 k @ $0.03), so this board uses it directly. **Re-used L1.01. LOCKED.** | pin map (VBUS / D+/D- channels), clamp voltage |
| F1 | Littelfuse **1206L050YR** (1206) | PTC resettable fuse — 0.5 A hold / 1 A trip, 6 V (F7). **Re-used L1.01. LOCKED.** | hold/trip current, voltage rating |

**Supporting passives & parts (all re-used L1.01 catalog parts):** C5,C6 = 1 µF
(LDO in/out, `885012207103`); C1 = 10 µF bulk (`C0805C106K3PACTU`); C2,C3 = 0.1 µF
module decoupling + C4 = 0.1 µF EN cap (`CL21B104KBCNNNC`, ×3); R1,R2 = 10 kΩ
EN/GPIO0 pull-ups (`RC0805FR-0710KL`); R3,R4 = 5.1 kΩ CC pull-downs
(`RC0805FR-075K1L`); R5,R6 = 470 Ω LED series (`RC0805FR-07470RL`); LED1 = red power
LED (`150080RS75000`); LED2 = yellow LINK/RX LED (`150080YS75000`); SW1,SW2,**SW3** =
Omron `B3F-1000` (EN / BOOT / **USER**, THT); J1 = GCT `USB4110-GF-A` USB-C; J2 =
Sullins `PRPC040SAAN-RC` breakaway header (snap to size for the expansion row);
TP1/TP2 = Keystone `5010` (red, 3V3) / `5011` (black, GND) test points.

**Delta vs L1.01 (the entire new hardware surface):** +1 tactile button (SW3, USER,
GPIO21); LED2 re-purposed from "blink" to "LINK/RX" (GPIO47); the dual breakout
header rows reduced to **one** expansion header (J2). Nothing else changes.

## 5 · Power & thermal

- **Rails:** single **3.3 V** rail from the RT9080 LDO; **VBUS 5 V** passes through
  (PTC + ESD) to the expansion header for *powering* peripherals only — never into a
  GPIO (E3).
- **Budget:** ESP-NOW uses the Wi-Fi radio, so typical 80–160 mA, TX peak ~500 mA
  (brief). LDO spec ≥ 600 mA + 10 µF bulk on 3V3 rides the TX transient (E2).
- **Thermal:** **not a flagged concern, and now proven.** Worst case the RT9080 drops
  5 V → 3.3 V = 1.7 V at ≤ 600 mA ≈ **1.0 W transient**; continuous worst case is
  80–160 mA ≈ 0.14–0.27 W. Junction temp at the continuous worst case (§3): Tj =
  Tamb + θJA·P = 30 °C + 250 °C/W · 0.27 W = **98 °C**, a **27 °C margin** under the
  RT9080's 125 °C Tj,max; the brief 1 W TX peaks are damped by the package/board
  thermal mass. OC/OT is the backstop. No heatsink/pour design →
  `hasThermalConcern=false`.
- **Auto-shutoff (E4):** a receiving node holds the radio awake (~80–100 mA
  continuous), which keeps typical USB power banks from auto-powering-off; the lesson
  recommends a **USB wall adapter or PC port**. No deep-sleep used in L1.02.

## 6 · Risk register

Each risk gets one de-risk pass before the board advances. Risk IDs are **`RK#`** to
avoid colliding with resistor refDes `R1–R6` (protocol internal-consistency rule).

| # | Risk | Likelihood × Impact | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **Re-used core assumed-good without re-proof** — copying L1.01 could carry a latent error | Low × High | The L1.01 WROOM core passed its own validation + is **in the live catalog / shipping**; §3 re-proves every power number against the same datasheets rather than citing L1.01 blindly. | **DE-RISKED** |
| **RK2** | **USER button on a strapping/USB pin** would break boot or USB enumeration | Med × High | USER button assigned to **GPIO21** — not a strapping pin (0/3/45/46), not USB (19/20), not flash/PSRAM. Verified against the VERIFIED module pinout (§2 GPIO map). | **DE-RISKED** |
| **RK3** | **LINK LED on a strapping/USB/flash pin** would misbehave at boot or steal USB | Med × Med | LED on **GPIO47** — plain digital, available on WROOM-1, no strap/USB/flash conflict. | **DE-RISKED** |
| **RK4** | **ESP-NOW channel mismatch** — both peers must share a Wi-Fi channel or no link | Med × Med | Channel + peer MAC are **firmware** config; the board has no hardware channel selector (correct — keeps the board simple). Documented as a firmware/guide concern. | **DE-RISKED (firmware-owned)** |
| **RK5** | **Antenna keep-out** — copper/parts under the PCB antenna detune it + break pre-cert (now load-bearing: the radio IS the lesson) | Low × High | Module on a board **edge** with a keep-out (M1, Espressif rules); closed in KiCad layout + the LAYOUT_REVIEW antenna gate. | open → close in layout |
| **RK6** | **USB D+/D- routing** — poor length-match/impedance hurts full-speed signaling | Low × Med | Short, length-matched D+/D- pair through the USBLC6; ESD at the connector. Closed in KiCad layout. | open → close in layout |
| **RK7** | **Pairing/MAC addressing** — two boards must learn each other's MAC | Low × Low | Each WROOM has a unique factory MAC; pairing is firmware (broadcast-then-peer or hard-coded MAC). No hardware implication. | **DE-RISKED (firmware-owned)** |
| **RK8** | **Power-bank auto-shutoff** mid-lesson | Low × Med | RX node draws ~80–100 mA continuously (radio awake), above most auto-off thresholds; guide recommends a wall/PC source (E4). | **DE-RISKED** |
| **RK9** | **PTC nuisance-trip** — 0.5 A hold vs ~0.5 A peak board draw | Low × Med | TX peak (~500 mA) is *brief*; PTC hold is 0.5 A with 1 A trip and a thermal time-constant ≫ the TX burst → no trip. Same coordination as L1.01. | **DE-RISKED** |
| **RK10** | **Expansion-header mis-wire** — header exposes raw GPIO + 5 V/3V3/GND to jumper wires; a learner could feed 5 V into a 3.3 V GPIO or short a rail | Med × Med | Header **excludes** all used/strapping/USB pins (GPIO0/19/20/21/47, EN); exposes only spare GPIO + power, each **silkscreen-labeled**; the lesson teaches "5 V never into a GPIO" (E3). 3V3 rail is OC/OT-protected (RT9080) and VBUS is PTC-fused (F1) against a dead short. Accepted with labeling — same posture as L1.01's headers. | **DE-RISKED (accept + label)** |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board** (no mains/Li-ion/thermal/stripboard flags, so
**no conditional items**):

- [ ] **Calc trail recorded** — every derived value (rails, currents, divider/timing,
  LED, GPIO drive) traces to a source (§3).
- [ ] **Each IC datasheet-verified** — the chosen part's datasheet matches the
  schematic symbol and intended use (§4); all four actives are re-used VERIFIED
  catalog parts.
- [ ] **Footprint ↔ pinout cross-checked** — each part's footprint pad map matches
  the datasheet pinout (re-uses L1.01's chosen symbols/footprints; **verified at the
  schematic `[S]` stage**, not pre-schematic).
- [ ] **Fab-DRU DRC accounted for** — the fab's `.kicad_dru` will be applied before
  gerber export (LAYOUT `[L]` stage).
- [ ] **BOM availability confirmed** — every part in stock and not EOL/NRND (live
  DigiKey snapshot, §8).
- [ ] **All top risks de-risked** — every §6 risk has a completed pass (RK1–RK4,
  RK7–RK10 de-risked; RK5/RK6 close in KiCad layout).

> Attestations (a human checked), not machine proofs — except BOM availability
> (DigiKey/parts MCP) and DRU presence, which are verifiable.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~$13–14 BOM **per node** (~$27 for the pair). New vs
  L1.01: +1 button, +1 expansion-header line; minus one breakout header row.
- **Reuse:** **100 % of parts are existing L1.01 catalog parts** — no new part needs
  creating; the BOM import is a pure strict-match against the curated library. This
  is the intended pilot outcome (reuse compounds across the burst).
- **Second sources noted for:** ESD — UMW `USBLC6-2SC6` (used on L1.01 when STMicro
  was out; pin/spec-compatible); PTC — Bel Fuse `0ZCJ0050FF2G` ($0.21). Commodity
  0805 R/C, buttons, LEDs, headers, test points are low-risk — any in-stock
  equivalent works.
- **BOM frozen:** **not yet.** Freeze (`bomFrozenAt`) is a side-effect of advancing
  past `BOM_SOURCING` into `LAYOUT` — **held** pending owner go-ahead and the
  schematic/layout-stage audits.

### Sourcing evidence — live DigiKey snapshot (2026-06-25)

Every line stock-checked via `makeDigikeyClient().searchByMpn` (`src/lib/digikey.ts`).
All **matched, lifecycle = Active, comfortably in stock**. Exact `(manufacturer,
mpn)` strings below are byte-for-byte the curated-catalog strings the BOM import
strict-matches.

| refDes | Manufacturer | MPN | Qty | Role | Stock | Unit $ |
| --- | --- | --- | --- | --- | --- | --- |
| U1 | Espressif Systems | ESP32-S3-WROOM-1-N16R2 | 1 | MCU module (radio) | 8,589 | 6.32 |
| U2 | Richtek | RT9080-33GJ5 | 1 | 3.3 V / 600 mA LDO | 98,947 | 0.28 |
| D1 | STMicroelectronics | USBLC6-2SC6 | 1 | VBUS + D± ESD array | 10,000 | 0.03 |
| F1 | Littelfuse | 1206L050YR | 1 | PTC polyfuse (0.5 A hold) | 29,418 | 0.64 |
| J1 | GCT | USB4110-GF-A | 1 | USB-C receptacle (right-angle SMT, THT retention posts) | 138,032 | 1.27 |
| C1 | KEMET | C0805C106K3PACTU | 1 | 10 µF 3V3 bulk | 271,467 | 0.23 |
| C5,C6 | Würth Elektronik | 885012207103 | 2 | 1 µF LDO in/out | 12,484 | 0.30 |
| C2,C3,C4 | Samsung Electro-Mechanics | CL21B104KBCNNNC | 3 | 0.1 µF decouple + EN cap | 8,534,211 | 0.10 |
| R1,R2 | Yageo | RC0805FR-0710KL | 2 | 10 kΩ EN / BOOT pull-ups | 3,957,388 | 0.10 |
| R3,R4 | Yageo | RC0805FR-075K1L | 2 | 5.1 kΩ CC pull-downs | 84,812 | 0.10 |
| R5,R6 | Yageo | RC0805FR-07470RL | 2 | 470 Ω LED series | 226,132 | 0.10 |
| LED1 | Würth Elektronik | 150080RS75000 | 1 | Red power LED | 88,459 | 0.19 |
| LED2 | Würth Elektronik | 150080YS75000 | 1 | Yellow LINK/RX LED | 52,541 | 0.19 |
| SW1,SW2,SW3 | Omron | B3F-1000 | 3 | EN / BOOT / USER tactile | 40,752 | 0.35 |
| J2 | Sullins Connector Solutions | PRPC040SAAN-RC | 1 | Expansion header (breakaway) | 68,482 | 1.23 |
| TP1 | Keystone Electronics | 5010 | 1 | 3V3 test point (red) | 269,028 | 0.30 |
| TP2 | Keystone Electronics | 5011 | 1 | GND test point (black) | 336,763 | 0.27 |

**Per-node:** 17 line items · 25 placements · ≈ **$13.50**. KiCad symbols/footprints/3D
are re-used from the L1.01 catalog parts (the pad-by-pad footprint↔pinout cross-check
is the `[S]` schematic-stage audit, per protocol — deferred, not pre-schematic).
