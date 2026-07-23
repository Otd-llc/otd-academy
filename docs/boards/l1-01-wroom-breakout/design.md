# ESP32-S3-WROOM Breakout (L1.01) — design doc

> Worked example. This is the first fully-filled-in design doc and the canonical
> template future boards copy (see `docs/boards/_template/design.md`). It ports
> the rich "Pass 2" requirements doc into the lifecycle structure: draft →
> validate (lock the math + ICs) → source/freeze the BOM → only then author the
> guide.

| | |
| --- | --- |
| **Slug** | `l1-01-wroom-breakout` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **bom-frozen** — 17 parts created + BOM written, revision v1 `bomFrozenAt` set; lesson published; revision at LAYOUT stage, physical build pending; **stackup revised 2→4 layer 2026-07-14** — R5 de-risk, see `validation-log.md` + §1 stackup M5) |
| **Track / Level** | COMMS (general dev core) / L1 |
| **Teaches** | Hand-soldering your first board — every joint achievable with a basic iron |

> **Pass 2 headline:** the MCU moved from **ESP32-WROOM-32E → ESP32-S3-WROOM-1**
> (native USB), forced by a 3-round bridge-sourcing dead end (§6 R1). This
> **deletes the USB-UART bridge + both auto-program transistors** — a simpler,
> more solderable, more modern L1 board, still a "WROOM."

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3-WROOM-1 development breakout** — the **first
  board a beginner hand-solders** (curriculum **L1.01**). It must be a genuinely
  useful ESP32-S3 dev board while **every joint is achievable with a basic
  soldering iron** (no hot air, no reflow, no microscope). Priority order: (1)
  **the learner** — soldering it is the lesson; (2) **the finished board** as a
  real ESP32-S3 dev board. When they conflict, **solderability wins**.

- **Functional requirements:**
  - **F1** — Run an ESP32-S3-WROOM-1 from a single USB-C cable (power + data).
  - **F2** — Flash + serial console over the chip's **native USB** (USB
    Serial/JTAG) — no bridge IC, **no host driver install**.
  - **F3** — **Auto-program** handled by the native USB (esptool resets into the
    bootloader over USB-CDC); **no external auto-program transistors**.
  - **F4** — Manual **EN (reset)** and **BOOT (GPIO0)** buttons (manual download
    fallback).
  - **F5** — Break out all usable S3-WROOM GPIO to 2.54 mm headers, **including
    5 V/VBUS, 3V3, GND**.
  - **F6** — **Power LED** + **user LED on a GPIO** (the "blink" first-lesson
    LED).
  - **F7** — **Resettable overcurrent protection** on VBUS (PTC polyfuse) —
    protects board + host port (beginners short things) and teaches the concept.

- **Electrical / power budget:**
  - **E1** — Input: USB-C **VBUS 5 V** (sink role).
  - **E2** — Regulate to **3.3 V**. ESP32-S3 WiFi TX peaks ~500 mA (brief);
    typical 80–160 mA; the deleted bridge/transistors draw nothing → LDO ≥ 600 mA
    + bulk cap to ride the transient.
  - **E3** — MCU domain is **3.3 V**. ESP32 GPIO is **not 5 V-tolerant** — the
    breakout headers expose raw 3.3 V GPIO; 5 V is exposed only as VBUS for
    *powering* peripherals, never into a GPIO.

- **Interfaces:**
  - **I1** — USB-C, USB 2.0 full-speed, **sink** (Rd = 5.1 kΩ on CC1 **and**
    CC2). D+/D- go **straight to the module's native-USB pins (GPIO19/20)**.
  - **I2** — Native USB Serial/JTAG (CDC) for flash + console.
  - **I3** — 2× 2.54 mm GPIO headers exposing GPIO + **5 V/3V3/GND**.

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern** — the board is USB-5 V
    powered with a low-dissipation LDO. So this board's project flags are all
    **false** (`hasMainsNet=false`, `hasLiIon=false`, `hasThermalConcern=false`),
    and §7 lists **only the 6 core validation items**.
  - **Antenna keep-out (M1):** module on a board **edge** with the PCB antenna
    over a keep-out (no copper/parts under/beside it, per Espressif S3-WROOM-1
    integration rules). **On the 4-layer board (M5) the keep-out rule area must
    exclude all four copper layers — including both inner ground planes
    (`In1.Cu` + `In2.Cu`)** — a solid inner plane under the antenna detunes it as
    surely as a top pour.
  - **Stackup (M5) — 4-layer:** the native-USB `D+/D-` pair runs a **long
    diagonal** (USB-C at one board edge → the module's fixed `GPIO19/20` at the
    opposite corner). A 2-layer board cannot hold a **continuous ground reference**
    under that whole run while the 40+ GPIO fan out to the headers, so the board is
    **4-layer** — signals outside, **two ground planes inside** so both signal
    layers hug a plane: `F.Cu` (signal) · **`In1.Cu` (GND)** · **`In2.Cu` (GND)** ·
    `B.Cu` (signal). The USB pair rides `F.Cu` over the solid `In1.Cu` plane; `B.Cu`
    (GPIO fanout) references `In2.Cu`; 3V3 stays a routed trace/pour — one
    low-current, well-decoupled rail needs no power plane. At USB
    full-speed (12 Mbit/s) a broken 2-layer reference would still *function*, but it
    is not cleanly routable — the layer count is set by **routability**, not FS
    signal integrity. See **R5**.
  - **Solderability (the L1 constraint — first-class):** no leadless packages
    (QFN/BGA/DFN); passives ≥ 0805 (1206 OK); leaded SMD (SOT-23, SOIC) +
    through-hole only; buttons + headers through-hole; USB-C is the hardest joint
    → THT-tab variant. *(This is what killed the bridge options and forced the
    native-USB pivot — and it's why the S3-WROOM-1 castellated module is fine:
    edge pads, iron-solderable. Native USB is itself a solderability win:
    removing the bridge removes the part most at risk of being QFN-only.)*
  - **Regulatory:** ESP32-S3-WROOM-1 is a **pre-certified module** (FCC/IC/CE) —
    no board-level radiator cert, provided antenna keep-out (M1) is honored. No
    mains/battery/HV — out of scope.
  - **Mechanical / breadboard (M6):** outline **30 × 62 mm**; the two 1×22 breakout
    headers (J2/J3) at **25.4 mm on-center** — the S3-WROOM-1's 18 mm body sits
    *between* them (23.114 mm floor: body + ~0.1″ hand-clearance per side). At that
    spacing the board is wider than a single breadboard straddles, so it seats across
    **two** breadboards (one row per board). Placement (KiCad, owner-verified
    2026-07-23): **J2 (2.3, 4.33) 0°**, **J3 (27.7, 57.67 = 62−4.33) 180°** (rotated
    so pin order matches the ratsnest); header pads ~1.45 mm off each side edge
    (> PCBWay 0.5 mm). Closes **R7** (§6); see `validation-log.md`.
  - **Board finish (M7):** **ENIG** (immersion gold) — flat gold pads so the
    WROOM's fine-pitch castellated pads solder reliably (lumpy HASL leaves each pad
    a slightly different height, risking an open joint under the module). RoHS;
    small cost bump over HASL, negligible at proto quantity. Set in the starter's
    KiCad stackup (`copper_finish "ENIG"`, PR #357) and picked in the PCBWay order
    (§8 / the ORDERING lesson card).

## 2 · Topology

USB-C (sink) → PTC polyfuse → ESD clamp → LDO (RT9080, AP2112K-class) → 3.3 V rail →
ESP32-S3-WROOM-1. After the S3 pivot there is **no bridge IC** — D+/D- pass
through the ESD array straight to the module's native-USB pins.

```
            ┌───────────────── USB-C (sink) ─────────────────┐
   VBUS 5V  │  CC1/CC2 → 5.1k×2 → GND (Rd, sink advertise)    │
   ────┬────┘  D+/D- ───────────────────────┐                │
       │                                      │               │
   [PTC polyfuse]                    [USBLC6-2 ESD: VBUS + D+/D-]
       │                                      │
   (VBUS clamp via ESD)                       ▼  GPIO19/20
       ▼                            ┌────────────────────────────┐
  ┌──────────┐   3V3 rail           │   ESP32-S3-WROOM-1          │
  │ LDO      │──────┬──────────────►│   • native USB Serial/JTAG  │
  │ (AP2112K │ 1µF  │ +10µF bulk    │     (no bridge, no driver)  │
  │  class)  │      │ +0.1µF decap  │   • EN: 10k↑ +0.1µF +SW1    │
  │ in/out   │      │               │   • GPIO0: 10k↑ +SW2 (boot) │
  └──────────┘      │               │   • USER LED on GPIO (+R)   │
                    ├──► Power LED (+R)│   • GPIO ──► J2/J3 headers│
                    │               └────────────────────────────┘
                    └──► 3V3 to headers ;  VBUS(5V) also to headers
```

**Sub-circuits the schematic is organised into:** (1) USB-C input + CC sink
pull-downs, (2) protection (PTC polyfuse + USBLC6 ESD), (3) 3V3 power (LDO +
decoupling), (4) the S3-WROOM-1 module with EN/BOOT strap+button RCs, (5)
indicators (power LED + user/blink LED), (6) breakout headers + color-coded test
points.

**Theory of operation:** USB-C VBUS (5 V) → PTC polyfuse → ESD clamp → LDO →
3.3 V. D+/D- pass through the ESD part **directly to the module's native USB pins
(GPIO19 = D-, GPIO20 = D+)** — no bridge. The S3's **USB Serial/JTAG** enumerates
as a standard CDC serial port → flash + monitor with no host driver; esptool
resets the chip into the bootloader over USB, with **BOOT + EN buttons as the
manual fallback** (hold BOOT, tap EN). Power LED on 3V3; user LED on a free GPIO
for "blink." All usable GPIO + 5 V/3V3/GND go to the two headers (module
flash/PSRAM pins are internal/not exposed).

**Stackup (4-layer).** Signals outside, planes inside — both signal layers reference
an adjacent ground plane: `F.Cu` (signal) · **`In1.Cu` (GND plane)** ·
**`In2.Cu` (GND plane)** · `B.Cu` (signal), on 1.6 mm FR4. The USB `D+/D-` pair
routes on `F.Cu` over the continuous `In1.Cu` plane the entire run; `B.Cu` (GPIO
fanout) references `In2.Cu`; the two planes stitch together and to U1's centre pad;
3V3 stays a routed trace/pour (no power plane needed). The antenna keep-out excludes
**all four** copper layers. Layer count is driven by routability of the long
native-USB diagonal, not FS signal integrity — see §1 stackup (M5) and **R5**.

## 3 · Calc trail (DO — lock the math)

| Value | Formula / source | Result | Notes |
| --- | --- | --- | --- |
| 3V3 rail | USB VBUS 5 V → LDO output | 3.3 V | E2; ESP32-S3 domain is 3.3 V (E3) |
| LDO current headroom | WiFi TX peak ~500 mA (brief), typ 80–160 mA → spec ≥ 600 mA | 600 mA LDO | E2; bridge/transistors deleted so no extra draw |
| LDO dropout @ 600 mA | RT9080 datasheet: 0.53 V from 5 V in | 0.53 V | comfortable margin from 5 V → 3.3 V (R2 resolved) |
| LDO in/out caps | LDO datasheet — stable with 1 µF ceramics | 1 µF ×2 (C5,C6) | caps unchanged across the AP2112K→RT9080 swap |
| Bulk on 3V3 | ride the WiFi-TX current transient | 10 µF (C1) | + 0.1 µF module decoupling (C2,C3) |
| EN power-on-reset RC | reference EN 10 kΩ pull-up + 0.1 µF cap | 10 kΩ + 0.1 µF (R1,C7) | clean reset / debounce of EN/SW1 |
| GPIO0 (BOOT) strap | 10 kΩ pull-up + SW2 to GND | 10 kΩ (R2) | hold-low = bootloader; manual download fallback |
| CC sink pull-downs (Rd) | USB-C sink role advertise: 5.1 kΩ on **both** CC1 + CC2 | 5.1 kΩ ×2 (R3,R4) | I1 — required for the host to source VBUS |
| LED series R | (3.3 − Vf≈2 V) / R → ~2.8 mA at 470 Ω | 470 Ω (R5,R6) | D21 — 1 kΩ was too dim; 470 Ω is clearly visible |
| Power-LED color/Vf | red Vf ~1.8 V lights on 3V3; green Vf 3.2 V will NOT | red LED1 | D20 — green won't light on a 3.3 V rail |
| PTC polyfuse | resettable VBUS overcurrent: 0.5 A hold / 1 A trip, 6 V | 1206L050YR (F1) | F7 — protects board + host port |

## 4 · IC selection (DO — lock the parts)

"Datasheet-verified" means the relevant sections were read (pinout, abs-max,
power), not just the marketing page.

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U1 | Espressif **ESP32-S3-WROOM-1-N16R2** (module) | Native USB; dual-core; 16 MB flash + 2 MB **quad** PSRAM; PCB antenna; castellated edge pads (iron-solderable). Quad PSRAM keeps all GPIO (octal R8 would steal GPIO33–37). Universal curriculum core. **LOCKED.** | pinout (VERIFIED in Foundry), power domains, native-USB pins GPIO19/20, antenna keep-out integration rules |
| U2 | **Richtek RT9080-33GJ5** (TSOT-23-5) | 3.3 V / 600 mA LDO with EN; **0.53 V dropout @ 600 mA**; OC/OT protection; stable with 1 µF ceramics. **Replaces AP2112K (out of stock)** — same 3.3 V/600 mA class, cheaper, in stock, Digikey EDA models. **Use RT9080's own pinout.** **LOCKED.** | pinout, dropout vs current, abs-max, min output cap |
| D1 | **UMW USBLC6-2SC6** (SOT-23-6) | ESD/TVS array on VBUS + D+/D-. UMW second-source (STMicro USBLC6 out of stock); pin/spec-compatible. **LOCKED.** | pin map (VBUS/D+/D- channels), clamp voltage |
| F1 | Littelfuse **1206L050YR** (1206) | PTC resettable fuse — 0.5 A hold / 1 A trip, 6 V (F7). Bel Fuse `0ZCJ0050FF2G` is an alt. **LOCKED.** | hold/trip current, voltage rating |

**Supporting passives & parts (from §3 / the locked BOM):** C5,C6 = 1 µF (LDO
in/out); C1 = 10 µF bulk; C2,C3 = 0.1 µF module decoupling; C7 = 0.1 µF EN cap;
R1,R2 = 10 kΩ EN/GPIO0 pull-ups; R3,R4 = 5.1 kΩ CC pull-downs; R5,R6 = 470 Ω LED
series; LED1 = red power LED; LED2 = yellow user/"blink" LED; SW1,SW2 = Omron
B3F-1000 (EN/BOOT, THT); J1 = GCT USB4110-GF-A USB-C (THT solder-retention tabs);
J2,J3 = Sullins PRPC040SAAN-RC breakaway headers (2× 1×22); TP1/TP2 = Keystone
5010 (red, 3V3) / 5011 (black, GND) test points.

**Deleted vs Pass 1:** the USB-UART bridge (CH340x) and the Q1/Q2 MMBT3904
auto-program transistors (and their decoupling) are gone — the native-USB pivot
removed the hardest sub-circuit entirely.

> **Silkscreen rule (part of the L1 lesson):** label every header pin, mark
> LED/diode polarity + pin-1, and call out 5 V vs 3V3 clearly.

## 5 · Power & thermal

- **Rails:** single **3.3 V** rail from the LDO; **VBUS 5 V** passes through (PTC
  + ESD) to the headers for *powering* peripherals only — never into a GPIO (E3).
- **Budget:** ESP32-S3 typical 80–160 mA, WiFi-TX peak ~500 mA (brief). LDO spec
  ≥ 600 mA with a 10 µF bulk cap on 3V3 to ride the TX transient (E2; R2).
- **Ground return (4-layer):** the inner ground planes (`In1.Cu`/`In2.Cu`) give
  every return — the WiFi-TX transient, the decoupling loops, the USB pair — a continuous
  low-impedance path directly under the signal, better than a 2-layer bottom pour.
  A mild power-integrity gain, no regression (M5; R5).
- **Thermal:** **not a flagged concern.** Worst case the RT9080 drops ~1.7 V
  (5 V → 3.3 V) at ≤ 600 mA → ~1 W transient / well under that typically; the
  SOT-23-class LDO with board copper handles it, and the OC/OT protection is the
  backstop. No heatsink/copper-pour design required → `hasThermalConcern=false`.

## 6 · Risk register

Top risks, each with one de-risk pass before the board advances. **R1 is the
worked example of a registered → de-risked risk** (the bridge-sourcing dead end
that forced the S3 pivot).

| # | Risk | Likelihood × Impact | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **R1** | **USB-UART bridge un-sourceable** — a WROOM-32E needs an onboard bridge; under the Digikey/Amazon + hand-solderable constraint **every** candidate failed (FT231X out · CH340C out · CH343G not carried by Digikey · FT232RL no stock · PL2303 too expensive · CP2102N/CP2104/CH9102 all QFN, unsolderable for L1). | High × High (blocks the whole board) | **Pivot to native-USB ESP32-S3-WROOM-1 (D9):** the S3's built-in USB Serial/JTAG removes the bridge entirely — and the two auto-program transistors with it. Simpler, more solderable, no driver, still a "WROOM." | **DE-RISKED** |
| R2 | 600 mA LDO vs ~500 mA WiFi-TX peak — headroom worry (AP2112K vs a 1 A LDO) | Med × Med | RT9080-33GJ5: 0.53 V dropout @ 600 mA from 5 V; 10 µF bulk rides the transient. 600 mA accepted (D17). | **DE-RISKED** |
| R3 | Curriculum-wide ripple — the native-USB S3 pivot affects all 22 projects | Med × Med | Accepted curriculum-wide (D15); L1.01 is the reference template; migrating the other 21 BOMs/content is a **separate tracked effort** (code mostly ports: ESP-IDF/Arduino). | **DE-RISKED** |
| R4 | Antenna keep-out — copper/parts under the PCB antenna would detune it and break the module's pre-cert | Low × High | Module on a board **edge** with a keep-out (M1, per Espressif integration rules); resolved in KiCad layout + the LAYOUT_REVIEW antenna-keep-out gate item. **On 4-layer (M5) the keep-out rule area must exclude all four copper layers, incl. both inner ground planes (`In1.Cu` + `In2.Cu`)** — a solid inner plane under the antenna detunes it too. | open → close in layout |
| R5 | USB D+/D- routing — the native-USB pair is a **forced long diagonal** (USB-C edge → GPIO19/20 at the opposite corner); a 2-layer board cannot keep a continuous ground reference under it while the GPIO fan out | Med × Med | **Resolved by the 4-layer stackup (M5):** a dedicated inner ground plane (`In1.Cu`) gives the pair a continuous reference the whole run, independent of GPIO routing. FS (12 Mbit/s) tolerates the length; the extra layers buy clean routability + margin, not FS SI. See `validation-log.md` 2026-07-14. | **DE-RISKED** |
| R6 | S3 native-USB quirk — firmware that reconfigures GPIO19/20 (or heavy USB use) can drop the CDC port | Low × Low | Documented; recover via **BOOT + EN** (keep the buttons, F4). | **DE-RISKED** |
| R7 | Board outline / header row spacing (physical) | Low × Low | **Geometry closed 2026-07-23** (`validation-log.md`): outline **30 × 62 mm**; J2/J3 = **25.4 mm on-center** (the S3-WROOM-1 18 mm body sits *between* them → 23.114 mm floor); **J2 (2.3, 4.33) 0°**, **J3 (27.7, 57.67 = 62−4.33) 180°** (rotated so pin order matches the ratsnest); owner-verified in KiCad. Wider than one breadboard straddles → seats across **two** breadboards. | geometry captured; final `[L]` tick (antenna lateral keep-out + DRC=0) closes at layout review with R4 |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board** (this board has no mains/Li-ion/thermal
flags, so there are **no conditional items**):

> Ticked retroactively 2026-07-02 against the shipped v1 design (parts created,
> BOM frozen, lesson published). L1.01's validation predates `_protocol.md` —
> provenance in `validation-log.md`.

- [x] **Calc trail recorded** — every derived value (rails, currents,
  divider/timing) traces to a source (§3).
- [x] **Each IC datasheet-verified** — the chosen part's datasheet matches the
  schematic symbol and intended use (§4; re-confirmed for C1 in the 2026-06-24
  ECN).
- [x] **Footprint ↔ pinout cross-checked** — each part's footprint pad map
  matches the datasheet pinout (esp. RT9080's own pinout, the USBLC6 channel
  map, and the S3-WROOM-1 castellated pads; KiCad symbol/footprint refs
  populated on all 17 parts). **U1 EPAD re-modelled in the 2026-07-19 ECN** —
  the ESP32-S3-WROOM-1 exposed pad (Espressif **pin 41 = GND**) is now a single
  symbol pin `41` on the KiCad-stock footprint `RF_Module:ESP32-S3-WROOM-1`
  (was a non-idiomatic 9-way `41_1..41_9` split on an UNVERIFIED SnapEDA
  footprint); `[S]`/`[P]`/`[DFM]` re-run clean, starter re-exported.
- [x] **Fab-DRU DRC accounted for** — the fab's design rules (`.kicad_dru`,
  PCBWay) are applied in the lesson's Board Setup and DRC = 0 errors gates the
  LAYOUT stage. **Now a 4-layer PCBWay stackup** (M5): the Board-Setup physical
  stackup + the all-copper-layer keep-out are *captured* here, *verified* at layout.
- [x] **BOM availability confirmed** — every part in stock (nightly DigiKey
  watchdog; C1 Murata→KEMET ECN 2026-06-24 proves the loop).
- [ ] **All top risks de-risked** — R1–R3, R6 de-risked; **R5 de-risked via the
  4-layer stackup** (2026-07-14, `validation-log.md`); **R7 geometry captured +
  owner-verified in KiCad** (2026-07-23, `validation-log.md`: 30×62 mm outline +
  J2/J3 25.4 mm on-center); **R4** (now incl. the inner-plane keep-out) **and R7's
  final tick close at layout review** (the in-app LAYOUT_REVIEW checklist — antenna
  keep-out item — is still unchecked; tick after that sign-off, incl. R7's antenna
  lateral keep-out + DRC = 0).

> These are *attestations* (a human checked), not machine proofs — except BOM
> availability (parts MCP) and DRU presence, which are verifiable.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~$10–12 BOM (hobby/education breakout). Key locked
  line-item costs: U1 ESP32-S3-WROOM-1-N16R2 **$6.32** (8,884 stock); U2 RT9080
  **$0.28** (48k stock); J1 USB4110-GF-A **$1.27** (170k stock); F1 1206L050YR
  **$0.64** (Bel Fuse `0ZCJ0050FF2G` = $0.21 alt); plus ~17 distinct parts / BOM
  lines total. The hardest sub-circuit (bridge + transistors) is **deleted**.
- **Second sources noted for:** ESD array — **UMW USBLC6-2SC6** is itself the
  second source (STMicro USBLC6 out of stock, pin/spec-compatible); PTC fuse —
  Bel Fuse `0ZCJ0050FF2G` ($0.21) second-sources the Littelfuse 1206L050YR; LDO —
  RT9080-33GJ5 replaced the originally-specced AP2112K after it went out of
  stock. Headers are a breakaway 1×40 ×2 snapped to 1×22 (guaranteed Digikey
  stock vs the unconfirmed fixed 1×22).
- **Stock verification:** all locked parts stock-verified at Digikey/Amazon on
  06-04 (U1/U2/J1/D1/F1). Commodity 0805 R/C, buttons (B3F-1000), LEDs, headers,
  and test points are low-risk — any in-stock equivalent works.
- **BOM frozen: YES.** All 17 parts created in the library, BOM lines written,
  revision v1 `bomFrozenAt` set; the guide was authored and published against it.
  One post-freeze sourcing ECN: **C1** bulk cap Murata `GRM21BR61E106KA73L` (OOS)
  → KEMET `C0805C106K3PACTU`, 2026-06-24 — drop-in, scoped audit clean (see
  `validation-log.md`). The **2026-07-14 2→4 layer stackup** change (M5; R5) is a
  layout-domain design change: the **component BOM is unchanged** — only the
  bare-board fab spec moves to 4-layer (a small per-unit cost delta, not a BOM
  line). Scoped audit in `validation-log.md`.
