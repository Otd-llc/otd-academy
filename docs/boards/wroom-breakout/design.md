# ESP32-S3-WROOM Breakout (L1.01) — Hardware Design Document

**Date:** 2026-06-04
**Status:** **Pass 2 (draft)** — for review. Not frozen. Not sourced.
**Project:** `foundry-l1-01-wroom-breakout` · revision **v1** (at REQUIREMENTS)
**This doc is:** the project's `REQUIREMENTS_DOC` artifact, refined in progressive passes (Requirements → PDR → CDR) and frozen **before** BOM sourcing.

> **Pass 2 headline:** the MCU moved from **ESP32-WROOM-32E → ESP32-S3-WROOM-1** (native USB), forced by a 3-round bridge-sourcing dead end (§5 D9 / §6 R1). This **deletes the USB-UART bridge + both auto-program transistors** — a simpler, more solderable, more modern L1 board, still a "WROOM."

---

## 1. Purpose & audience

A **USB-C ESP32-S3-WROOM-1 development breakout** — the **first board a beginner hand-solders** (curriculum **L1.01**). It must be a genuinely useful ESP32 dev board while **every joint is achievable with a basic soldering iron** (no hot air, no reflow, no microscope).

Priority order: (1) **the learner** — soldering it is the lesson; (2) **the finished board** as a real ESP32-S3 dev board. When they conflict, **solderability wins** (§2.5).

**Why S3-WROOM-1 (not WROOM-32E):** see §5 D9 — the bridge a WROOM-32E needs was un-sourceable at Digikey across three rounds. The S3's **built-in USB** removes the bridge entirely.

---

## 2. Requirements

### 2.1 Functional
- F1 — Run an ESP32-S3-WROOM-1 from a single USB-C cable (power + data).
- F2 — **Flash + serial console over the chip's native USB** (USB Serial/JTAG) — no bridge IC, **no host driver install**.
- F3 — **Auto-program** handled by the native USB (esptool resets into the bootloader over USB-CDC); **no external auto-program transistors**.
- F4 — Manual **EN (reset)** and **BOOT (GPIO0)** buttons (manual download fallback).
- F5 — Break out all usable S3-WROOM GPIO to 2.54 mm headers, **including 5 V/VBUS, 3V3, GND**.
- F6 — **Power LED** + **user LED on a GPIO** (the "blink" first-lesson LED).
- F7 — **Resettable overcurrent protection** on VBUS (PTC polyfuse) — protects board + host port (beginners short things) and teaches the concept.

### 2.2 Electrical / power budget
- E1 — Input: USB-C **VBUS 5 V** (sink role).
- E2 — Regulate to **3.3 V**. ESP32-S3 WiFi TX peaks ~500 mA (brief); typical 80–160 mA; bridge/transistors no longer draw anything. → LDO ≥ 600 mA + bulk cap to ride the transient. **[OPEN: AP2112K 600 mA vs a 1 A LDO for headroom — §6 R2]**
- E3 — MCU domain is **3.3 V**. ESP32 GPIO is **not 5 V-tolerant** — the breakout headers expose raw 3.3 V GPIO; 5 V is exposed only as VBUS for *powering* peripherals, never into a GPIO. *(The old "power the bridge at 3.3 V" hazard is gone with the bridge.)*

### 2.3 Interfaces
- I1 — USB-C, USB 2.0 full-speed, **sink** (Rd = 5.1 kΩ on CC1 **and** CC2). D+/D- go **straight to the module's native-USB pins (GPIO19/20)**.
- I2 — Native USB Serial/JTAG (CDC) for flash + console.
- I3 — 2× 2.54 mm GPIO headers exposing GPIO + **5 V/3V3/GND**. **[OPEN: row spacing / breadboard-straddle]**

### 2.4 Mechanical
- M1 — Module on a board **edge** with the **PCB antenna over a keep-out** (no copper/parts under/beside it, per Espressif S3-WROOM-1 integration rules). *(Clears the `REQUIREMENTS_REVIEW` antenna-keep-out gate item.)*
- M2 — USB-C connector chosen with **through-hole shield tabs** for mechanical strength + iron access.
- M3 — Target outline / mounting holes **[OPEN]**.

### 2.5 Solderability (the L1 constraint — first-class)
- S1 — **No leadless packages** (QFN/BGA/DFN). *(This is what killed the bridge options and forced the native-USB pivot — and it's why the S3-WROOM-1 castellated module is fine: edge pads, iron-solderable.)*
- S2 — **Passives ≥ 0805** (0402/0603 disallowed; 1206 OK if easier).
- S3 — Leaded SMD (SOT-23, SOIC) + through-hole only.
- S4 — Buttons + headers **through-hole**.
- S5 — USB-C is the hardest joint → THT-tab variant (S5/M2).
- **Native USB is itself a solderability win:** removing the bridge removes the part most at risk of being QFN-only.

### 2.6 Regulatory
- R1 — ESP32-S3-WROOM-1 is a **pre-certified module** (FCC/IC/CE) — no board-level radiator cert, provided antenna keep-out (M1) is honored.
- R2 — No mains/battery/HV — out of scope.

---

## 3. Architecture

### 3.1 Block diagram (Pass 2 — bridge + auto-program block deleted)

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
  │ AP2112K  │──────┬──────────────►│   • native USB Serial/JTAG  │
  │ LDO      │ 1µF  │ +10µF bulk    │     (no bridge, no driver)  │
  │ in/out   │      │ +0.1µF decap  │   • EN: 10k↑ +0.1µF +SW1    │
  └──────────┘      │               │   • GPIO0: 10k↑ +SW2 (boot) │
                    ├──► Power LED (+R) │   • USER LED on GPIO (+R)│
                    │               │   • GPIO ──► J2/J3 headers   │
                    │               └────────────────────────────┘
                    └──► 3V3 to headers ;  VBUS(5V) also to headers
```

### 3.2 Theory of operation
- **Power:** USB-C VBUS (5 V) → PTC polyfuse → ESD clamp → AP2112K LDO → 3.3 V. 1 µF in/out at the LDO; 10 µF + 0.1 µF at the module for WiFi TX spikes.
- **USB role:** sink → 5.1 kΩ Rd on both CC lines. D+/D- pass through the ESD part **directly to the module's native USB pins (GPIO19 = D-, GPIO20 = D+)**. No bridge.
- **Flash/console:** the S3's **USB Serial/JTAG** enumerates as a standard CDC serial port — flash + monitor with no host driver. esptool resets the chip into the bootloader over USB; **BOOT + EN buttons are the manual fallback** (hold BOOT, tap EN).
- **Indicators:** power LED on 3V3; user LED on a free GPIO for "blink."
- **I/O:** all usable GPIO + 5 V/3V3/GND to the two headers. Module flash/PSRAM pins are internal/not exposed.

---

## 4. Detailed design & part selection (CDR-bound)

| Block | Ref | Part / MPN | Pkg | Value / why |
|---|---|---|---|---|
| **MCU** | U1 | Espressif **ESP32-S3-WROOM-1-N16R2** | module | Native USB; dual-core; 16 MB flash + 2 MB quad PSRAM; PCB antenna; castellated. Universal core (blink→FPV); all GPIO kept (quad PSRAM, unlike octal R8). $6.32, 8,884 stock. **LOCKED.** |
| **Power** | U2 | **Richtek RT9080-33GJ5** | TSOT-23-5 | 3.3 V/600 mA LDO, EN, 0.53 V dropout @600 mA, OC/OT. Replaces AP2112K (out of stock). Stable w/ 1 µF ceramics (caps unchanged). $0.28, 48k stock, Digikey EDA models. **Use RT9080's own pinout.** **LOCKED.** |
| | C5,C6 | 1 µF — Samsung CL21A105KBFNNNE | 0805 | LDO in/out |
| | C1 | 10 µF — Samsung CL21A106KOQNNNE | 0805 | Bulk on 3V3 |
| | C2,C3 | 0.1 µF — Samsung CL21B104KBCNNNC | 0805 | Module decoupling |
| | C7 | 0.1 µF | 0805 | EN power-on-reset cap |
| **USB-C** | J1 | GCT **USB4110-GF-A** | SMD R/A | USB 2.0 Type-C, 24 (16+8) pos; **board-guide + solder-retention tabs** (hand-solder-friendly). 170k stock, $1.27, Digikey EDA models. **LOCKED.** |
| | R3,R4 | 5.1 kΩ — Yageo RC0805FR-075K1L | 0805 | CC1/CC2 sink pull-downs |
| | D1 | **UMW** USBLC6-2SC6 | SOT-23-6 | ESD on VBUS + D+/D-. UMW second-source (STMicro out); pin/spec-compatible TVS array. **LOCKED.** |
| | F1 | Littelfuse **1206L050YR** | 1206 | PTC resettable fuse, 0.5 A hold / 1 A trip, 6 V. $0.64 (Bel Fuse `0ZCJ0050FF2G` = $0.21 alt). **LOCKED.** |
| **Straps** | R1,R2 | 10 kΩ — Yageo RC0805FR-0710KL | 0805 | EN + GPIO0 pull-ups |
| **Buttons** | SW1,SW2 | Omron B3F-1000 6 mm | THT | EN (reset) + BOOT |
| **Indicators** | LED1 | **red — Würth 150080RS75000** | 0805 | Power LED (3V3); red Vf ~1.8 V (green GS75000's 3.2 V won't light on a 3V3 rail — D20) |
| | **LED2** | **yellow — Würth 150080YS75000** | 0805 | **User LED (GPIO) — the "blink" LED (NEW)** |
| | R5,R6 | **470 Ω — Yageo RC0805FR-07470RL** | 0805 | LED series — ~2.8 mA at Vf 2 V (D21) |
| **Breakout** | J2,J3 | **Sullins PRPC040SAAN-RC** ×2 (breakaway → 1×22) | THT | GPIO + 5V/3V3/GND; 2× 1×22 male, breadboard-standard; footprint 1×22 (D22) |
| **Test pts** | TP1 / TP2 | **Keystone 5010 (red) / 5011 (black)** | THT | 3V3 (red) + GND (black) color-coded loops — teaches the probing convention (D23) |

**Deleted vs Pass 1:** ❌ U3 USB-UART bridge (CH340x), ❌ Q1/Q2 MMBT3904 auto-program transistors, ❌ their decoupling. Distinct parts: ~17 (17 BOM lines), but the **hardest sub-circuit is gone**.

> **Silkscreen rule (S/W of the board):** label every header pin, mark LED/diode polarity + pin-1, and call out 5 V vs 3V3 clearly. The silkscreen is part of the L1 lesson.

---

## 5. Decision & trade-off log

| # | Decision | Why | Date |
|---|---|---|---|
| D1 | Passives **0805** | L1 solderability; 0402 tombstones | 06-04 |
| D2–D8 | *(Pass 1 — see git history; bridge-era decisions superseded by D9)* | | 06-04 |
| **D9** | **MCU → ESP32-S3-WROOM-1 (native USB)**; **delete bridge + auto-program transistors** | 3-round bridge dead end at Digikey (R1); native USB is simpler, more solderable, no driver, still a "WROOM" | 06-04 |
| D10 | Keep USBLC6-2 ESD | beginners handle/plug roughly; easy SOT-23-6 | 06-04 |
| D11 | EN 0.1 µF cap (C7) | reference power-on-reset RC | 06-04 |
| D12 | Buttons + headers **through-hole** | easiest joints | 06-04 |
| D13 | **Add user LED + VBUS polyfuse + GND/3V3 test points + silkscreen rule** | high-value L1 lessons without bloat | 06-04 |
| D14 | Expose **5 V + 3V3 + GND** on headers | so the board can power peripherals | 06-04 |
| **D15** | **Native-USB ESP32-S3 = the curriculum's universal core** (not just L1.01) | bridge-sourcing wall hits every board; one modern chip = simpler/consistent/cheaper across all 22 projects (downstream migration tracked separately) | 06-04 |
| **D16** | **U1 = ESP32-S3-WROOM-1-N16R2** (quad PSRAM, all GPIO) | 2 MB PSRAM covers JPEG FPV comfortably + keeps GPIO the camera's DVP bus needs (octal R8 would steal GPIO33–37); highest-stock variant. Verified in-stock. | 06-04 |
| **D17** | **LDO = RT9080-33GJ5** (was AP2112K) | AP2112K out of stock; RT9080 is same 3.3 V/600 mA class, cheaper, in stock, Digikey EDA models | 06-04 |
| **D18** | **ESD = UMW USBLC6-2SC6**; **fuse = Littelfuse 1206L050YR** | STMicro USBLC6 out → UMW second-source; both verified in-stock | 06-04 |
| **D19** | **Header pinout = ESP32-S3-DevKitC-1 v1.1 J1/J3, verbatim** (2× 1×22) | the industry-standard reference for the WROOM-1 module — the learner's board then matches every tutorial / pin diagram / official getting-started doc. Validated against our VERIFIED module pinout. Deltas: keep GPIO35–37 (quad N16R2, not octal — they're free), **simple LED on GPIO38** (vs the reference's addressable RGB) for L1, our RST/BOOT buttons + USB/5V/3V3/GND power (same as DevKitC-1). Source: Espressif esp-dev-kits user_guide_v1.1. | 06-04 |
| **D20** | **Indicator LEDs = red `150080RS75000` (power) + yellow `150080YS75000` (user/blink)** | seeded green `150080GS75000` has Vf 3.2 V → won't light on the 3.3 V rail; low-Vf red/yellow are bright + reliable; matches DevKitC-1's red power LED + amber-activity convention; two colors make "powered" vs "code runs" unambiguous for L1 | 06-04 |
| **D21** | **R5,R6 = 470 Ω** (`RC0805FR-07470RL`; was OPEN 1 kΩ) | ~2.8 mA at Vf 2 V — clearly visible; 1 kΩ was too dim | 06-04 |
| **D22** | **J2,J3 = Sullins `PRPC040SAAN-RC` breakaway 1×40 ×2** (snap to 1×22) | breadboard-standard maker/industry header; guaranteed Digikey stock (fixed 1×22 unconfirmed); footprint stays 1×22 | 06-04 |
| **D23** | **TP1/TP2 = Keystone 5010 (red=3V3) + 5011 (black=GND)** | industry-standard color-coded test points (stocked Digikey + Amazon); the red/black convention is itself the L1 probing lesson | 06-04 |

### The bridge saga (for the record)
A WROOM-32E needs an onboard USB-UART bridge. Under the **Digikey + Amazon + hand-solderable** constraint, every candidate failed: **FT231X** out · **CH340C** out · **CH343G** not carried by Digikey · **FT232RL** no stock · **PL2303** too expensive · **CP2102N/CP2104/CH9102** all QFN (unsolderable for L1). Root cause: the cheap solderable bridges (WCH) are LCSC/Amazon-module parts Digikey doesn't carry; the leaded Digikey parts (FTDI) are out/pricey. → Pivot to native-USB S3 (D9).

---

## 6. Risk register / open items

| ID | Risk / open item | Plan |
|---|---|---|
| **R1** | *(closed)* Bridge un-sourceable | **Resolved by D9** (native-USB S3 — no bridge) |
| R2 | *(resolved — D17)* 600 mA LDO (RT9080) vs ~500 mA peak | 0.53 V dropout from 5 V is fine; 10 µF bulk rides the WiFi TX transient. 600 mA accepted. |
| R3 | *(resolved — D15)* Curriculum-wide pivot to native-USB S3 | Accepted curriculum-wide. Migrating the other 21 projects' BOMs + chip-specific content is a **separate tracked effort**; L1.01 is the reference template. Code mostly ports (ESP-IDF/Arduino). |
| R4 | S3 native-USB quirk: firmware that reconfigures GPIO19/20 (or heavy USB use) can drop the CDC port | Documented; recover via BOOT+EN. Keep buttons. |
| R5 | Board outline / row spacing | **[OPEN]** — only the physical outline remains; USB-C, header, LED + resistor, LDO, ESD/fuse, S3 variant all CLOSED (D16–D23), resolved in KiCad layout |
| R6 | Stock (user verifies manually) | User stock-checks S3-WROOM-1 (current-gen, widely stocked) + all parts at Digikey/Amazon |

---

## 7. Verification & bring-up plan
- **V1 (power):** USB-C in → 3.3 V rail (±5 %), LDO cool, power LED on, polyfuse not tripped.
- **V2 (enumeration):** host sees a CDC serial port **with no driver install** (validates native USB).
- **V3 (flash):** `esptool flash_id` enters/exits bootloader over native USB (no manual buttons in the normal case).
- **V4 (run):** flash blink on the **user LED** + serial "hello" on console; toggle GPIO on the headers.
- **V5 (buttons):** EN resets; BOOT+EN = manual download fallback.
- **V6 (RF):** WiFi scan/connect (validates antenna keep-out M1 + power budget E2).
- **V7 (protection):** brief VBUS overload trips + recovers the polyfuse.

---

## 8. Review gates (PDR/CDR ↔ Foundry stages)

| Industry gate | Foundry stage | Exit criteria |
|---|---|---|
| Requirements Review | **REQUIREMENTS** | §1–2 agreed; antenna-keep-out (M1) checklist item cleared; this doc is the artifact |
| PDR | REQUIREMENTS → **SCHEMATIC** | §3 architecture sound; part choices (§4) accepted |
| CDR | **SCHEMATIC** → **BOM_SOURCING** | KiCad schematic captured; §4 finalized; **[OPEN]s closed**; **design freeze** |
| — | **BOM_SOURCING** | Only *after* freeze: stock verified, symbols/footprints/3D sourced, BOM ordered |

**We are at: Requirements Review, Pass 2.**

---

## Appendix A — Open questions blocking freeze

**Resolved (stock-verified 06-04):** ~~curriculum ripple~~ (D15, curriculum-wide) · ~~flash/PSRAM variant~~ (N16R2) · ~~LDO~~ (RT9080-33GJ5) · ~~USB-C MPN~~ (USB4110-GF-A). ESD (UMW USBLC6-2SC6) + fuse (1206L050YR) also locked.

**Resolved (06-04; user-LED updated 06-10):** module pinout **VERIFIED** in Foundry; header pinout = **mirror the module 1:1** (header pin N = module pin N; 2× 1×22, DevKitC-1-style — see D19). User LED → **IO2** (moved from the DevKitC-1's GPIO38 during the schematic walkthrough — lowest free GPIO with no special duty). Note: `IO35/36/37` break out to J3.6–8 only because this is the quad-PSRAM **N16R2**; an octal R8/R16V consumes those three, so a BOM swap would dead those header pins.

**Still open:**
1. Row spacing + board outline (physical — finalized in KiCad layout).
2. LED series resistor 1 k vs 470 Ω; **simple single-color LED vs match-the-reference addressable RGB** on the user-LED GPIO (now IO2).
3. Commodity stock-check (0805 R/C, buttons B3F-1000, LEDs, headers, test points) — low risk, any in-stock equivalent works.
4. Any further additions, or is this the L1 scope?
