# WS2812 Addressable-LED Driver (L1.03) — design doc

> Second board through the lifecycle, and the first driven cleanly from a blank
> page (L1.01 WROOM was retrofitted). Copied from `docs/boards/_template/design.md`;
> voice + depth follow the L1.01 worked example (`docs/boards/l1-01-wroom-breakout/design.md`).
> The point of this board is **pipeline validation** — see the Friction log at the
> bottom, which is the real deliverable.

> ⛔ **NOT part-ready.** This board owes the **Recursive Board-Design Validation
> Protocol** (`../_protocol.md`) before *any* part is created, BOM imported, or
> revision advanced: ≥ 10 recursive audit passes, a "dry" pass, every applicable
> audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION` ticks are
> honest human attestations — earn them. **Do not add parts until this passes.**

| | |
| --- | --- |
| **Slug** | `l1-03-ws2812-node` |
| **Owner** | Josh Tollette |
| **Status** | `draft` (Pass 1 — for review, not validated, not frozen) |
| **Track / Level** | ACT / L1 |
| **Teaches** | Driving an addressable-LED strip — **3.3 V→5 V level shifting** and a **dedicated 5 V LED rail with a common ground** |
| **Validation** | `not started` — owes ≥ 10 recursive passes before part-ready — see `validation-log.md` |

> **Headline:** this board is the **WROOM core (L1.01) reused verbatim** + one small,
> genuinely-new sub-circuit: a **74AHCT125 level shifter** lifting the ESP32's
> 3.3 V data line to a clean 5 V WS2812 signal, an **onboard "first pixel"**, and a
> **strip output + dedicated 5 V injection terminal** (the board never powers a big
> strip from USB). No mains / Li-ion / thermal / stripboard flags → the
> `DESIGN_VALIDATION` checklist is the **6 core items only** (the no-flags base path
> this run is meant to validate).

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 node that drives a strip of addressable
  WS2812/NeoPixel RGB LEDs** (curriculum **L1.03**, ACT track). It is the L1.01
  WROOM breakout's proven core (USB-C power, RT9080 LDO, native-USB ESP32-S3) with
  **one new job bolted on**: take the MCU's 3.3 V data output, **shift it to 5 V**,
  and drive a WS2812 data chain — an onboard demo pixel first, then an external
  strip powered from its **own 5 V supply** through a screw terminal. The lesson is
  the new sub-circuit: **why 3.3 V isn't enough for a 5 V LED's data input**, and
  **why the strip needs a dedicated rail with a ground tied common to the board**.

- **Functional requirements:**
  - **F1** — Run an ESP32-S3-WROOM-1 from a single USB-C cable (power + native-USB
    flash/console) — **inherited unchanged from L1.01** (F1–F4 there).
  - **F2** — Drive a WS2812 data chain from one ESP32 GPIO via the RMT/bit-bang
    peripheral, **level-shifted to 5 V logic**.
  - **F3** — **One onboard WS2812 pixel** that lights from USB power alone (the
    "first pixel" — a self-contained bring-up target, no external strip needed).
  - **F4** — A **3-pin strip output** (5 V, DATA, GND) to continue the chain to an
    external strip.
  - **F5** — A **dedicated 2-pin 5 V injection terminal** for the external strip's
    power, with its **ground tied common** to board ground. The board does **not**
    source strip power from USB.
  - **F6** — **Series resistor + bulk capacitor** on the strip interface (data-line
    damping + inrush reservoir), per WS2812 application guidance.

- **Electrical / power budget:**
  - **E1** — Input: USB-C **VBUS 5 V** (sink role) — powers the board, the level
    shifter, and the **single onboard pixel** only.
  - **E2** — Regulate to **3.3 V** for the ESP32 (RT9080 LDO, inherited from L1.01).
  - **E3** — **Strip 5 V is external**, via the injection terminal — never from
    VBUS. Onboard pixel (≤ ~60 mA at full white) is the only LED load on VBUS.
  - **E4** — Level shifter VCC = **VBUS 5 V** (it must swing its output to 5 V to be
    read as logic-high by a 5 V-powered WS2812 — see §3).

- **Interfaces:**
  - **I1** — USB-C (power + native USB) — **inherited from L1.01**.
  - **I2** — WS2812 data out: ESP32 GPIO → 74AHCT125 → 470 Ω → onboard pixel DIN →
    pixel DOUT → strip output connector.
  - **I3** — Strip output (J4): 3-pos screw terminal (5 V / DATA / GND).
  - **I4** — 5 V injection (J5): 2-pos screw terminal (5 V_EXT / GND, common GND).

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, not a stripboard build** —
    USB-5 V powered custom 2-layer PCB. All four project flags are **false**
    (`hasMainsNet`/`hasLiIon`/`hasThermalConcern`/`requiresStripboard` = false), so
    §7 lists **only the 6 core validation items**. *(The seeded project row had
    `requiresStripboard=true`; flipped to false on review — see Friction log F1.)*
  - **Antenna keep-out (M1):** inherited from L1.01 — module on a board edge, PCB
    antenna over a keep-out (Espressif S3-WROOM-1 integration rules).
  - **Solderability (the L1 constraint — first-class):** every new part stays inside
    the L1.01 envelope — leaded SMD (SOIC) or through-hole, passives ≥ 0805. The
    level shifter is **SOIC-14** (leaded, iron-solderable; DIP-14 alt), the onboard
    WS2812 is a 5050 4-pad (hand-solderable with care), and the strip/injection
    connectors are **THT screw terminals** (the most beginner-robust connector).
  - **Regulatory:** unchanged from L1.01 — ESP32-S3-WROOM-1 is a pre-certified
    module; no board-level radiator cert needed given the antenna keep-out. No
    mains/battery/HV.

## 2 · Topology

The signal/power chain is the **L1.01 core, untouched**, plus the new WS2812
sub-circuit hanging off one GPIO and a second (external) 5 V rail.

```
   ┌─────────────────── L1.01 CORE (reused verbatim, validated) ───────────────────┐
   │  USB-C(sink) → PTC polyfuse → USBLC6 ESD → RT9080 LDO → 3V3 → ESP32-S3-WROOM-1 │
   │  (native USB Serial/JTAG, EN/BOOT buttons, power+user LEDs, GPIO headers)      │
   └───────────────────────────────────────────────────────────────────────────────┘
        VBUS 5V │                                   │ GPIO (one free pin, e.g. IO5)
                │                                    ▼
                │                          ┌──────────────────┐
                │  (VCC = VBUS 5V)         │  74AHCT125        │  3.3V in → 5V out
                ├─────────────────────────►│  (1 of 4 buffers) │  (HCT TTL inputs)
                │                          │  1OE→GND, 1A←GPIO │
                │                          │  1Y = 5V data ────┼──► [470Ω R7] ─┐
                │                          └──────────────────┘                │
                │                                                              ▼
                │   5V (onboard pixel only)                          ┌──────────────┐
                ├───────────────────────────────────────────────────►│ WS2812 (LED3)│
                │                            [0.1µF decap]            │ onboard pixel│
                │                                                     │ DIN→…→DOUT ──┼──┐
               GND ◄──────────────────── common ground ─────────────►│ GND, VDD     │  │ DATA
                ▲                                                     └──────────────┘  │
                │                                                                        ▼
         ┌──────┴───────┐   5V_EXT ──────────────────────────┬───────────────► J4 (strip out)
         │ J5 injection │   (external strip power ONLY)       │  5V / DATA / GND
         │ 5V_EXT, GND  │   [1000µF C10 bulk @ terminal]      │  → external WS2812 strip
         └──────────────┘   GND tied COMMON to board GND ─────┘
```

**Sub-circuits the schematic is organised into:**
1. **L1.01 core (reused):** (a) USB-C input + CC sink pull-downs, (b) protection
   (PTC + USBLC6 ESD), (c) 3V3 power (RT9080 + decoupling), (d) the S3-WROOM-1
   module with EN/BOOT, (e) indicators, (f) breakout headers. *These are copied
   from the validated L1.01 schematic — no new design work.*
2. **Level shifter (NEW):** 74AHCT125, VCC = VBUS 5 V, one buffer used (1OE tied
   low to enable; 1A ← ESP32 GPIO; 1Y = 5 V data), the other three buffers parked
   (OE → VCC disabled, A → GND); 0.1 µF VCC decoupling.
3. **Onboard pixel (NEW):** one WS2812 (LED3), VDD = VBUS 5 V, DIN ← 470 Ω from
   1Y, DOUT → strip connector DATA; 0.1 µF decoupling at its VDD.
4. **Strip interface (NEW):** J4 3-pos screw terminal (5 V_EXT / DATA / GND) to the
   strip; J5 2-pos screw terminal (5 V_EXT / GND) for external injection; 1000 µF
   bulk (C10) across 5 V_EXT; all grounds common.

**Theory of operation:** the WROOM core boots and enumerates over native USB
exactly as in L1.01. Firmware drives one GPIO with the WS2812 protocol (RMT or
bit-bang). That 3.3 V signal is too low to be a reliable logic-high for a
5 V-powered WS2812 (§3), so it passes through one 74AHCT125 buffer — TTL-level
inputs accept 3.3 V, the output swings to ~5 V — then a 470 Ω series resistor into
the onboard pixel's DIN. The onboard pixel runs off VBUS (one pixel is well within
USB's budget) and gives a no-strip-needed bring-up target. Its DOUT continues to
the strip connector. The **external strip is powered separately** through the
injection terminal (J5) — its 5 V never touches USB — with the strip's ground tied
common to the board so the single-ended data signal has a shared reference. A
1000 µF bulk cap at the injection terminal absorbs the strip's turn-on inrush.

## 3 · Calc trail (DO — lock the math)

| Value | Formula / source | Result | Notes |
| --- | --- | --- | --- |
| WS2812 data logic-high threshold | WS2812B datasheet: **VIH = 0.7 × VDD**, VDD = 5 V | **3.5 V** | The number the data line must clear at the first pixel's DIN |
| Bare 3.3 V GPIO vs that threshold | ESP32 VOH ≈ 3.3 V < 3.5 V | **marginal/fails** | This is the whole reason for the level shifter (R1) |
| Level-shifter input acceptance | 74AHCT125 (HCT/TTL inputs): VIH = 2.0 V, VIL = 0.8 V @ VCC 5 V | 3.3 V ✓ | ESP32 3.3 V high ≥ 2.0 V; 0 V low ≤ 0.8 V — driven cleanly |
| Level-shifter output high | 74AHCT125 VOH = 4.4 V @ −50 µA; ≥ 3.7 V @ −8 mA, VCC 4.5 V | ~4.4 V | WS2812 DIN is high-Z CMOS → ~µA load → VOH near 4.4–5 V ≫ 3.5 V ✓ |
| Data-level margin (the lesson) | VOH(shifter) − VIH(WS2812) = 4.4 − 3.5 | **+0.9 V** | vs **−0.2 V** for a bare 3.3 V GPIO → de-risks R1 |
| Data series resistor | WS2812 app note / Adafruit NeoPixel best-practice: 300–500 Ω at the driver to damp reflections | **470 Ω (R7)** | reuses the L1.01 470 Ω part (RC0805FR-07470RL) |
| Onboard-pixel current | 1× WS2812 full white ≈ 60 mA @ 5 V | 60 mA (max) | only LED load on VBUS; firmware-cap to avoid stacking on WiFi-TX peak |
| VBUS budget worst case | LDO-in (~350 mA @ WiFi-TX peak, brief) + pixel 60 mA + shifter few mA | < 0.5 A | under the 0.5 A PTC hold; transient/brief (R3) |
| Level-shifter decoupling | logic-IC standard 0.1 µF at VCC | 0.1 µF (C8) | reuses L1.01 0.1 µF part |
| Onboard-pixel decoupling | WS2812 datasheet: 0.1 µF near each pixel VDD | 0.1 µF (C9) | reuses L1.01 0.1 µF part |
| Strip inrush bulk cap | Adafruit NeoPixel guidance: ≥ 1000 µF across the strip's 5 V near injection | **1000 µF / 16 V (C10)** | electrolytic; de-risks R2 |

## 4 · IC selection (DO — lock the parts)

"Datasheet-verified" means the relevant sections (pinout, abs-max, logic levels)
were read, not just the marketing page.

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U1 | Espressif **ESP32-S3-WROOM-1-N16R2** | **Reused from L1.01, unchanged** — the validated curriculum core (native USB, pinout VERIFIED in Foundry). Already in the parts library. | (verified in L1.01) |
| U2 | Richtek **RT9080-33GJ5** | **Reused from L1.01** — 3.3 V/600 mA LDO. Already in library. | (verified in L1.01) |
| D1 | UMW **USBLC6-2SC6** | **Reused from L1.01** — USB ESD array. Already in library. | (verified in L1.01) |
| U3 | TI **SN74AHCT125D** (SOIC-14) | **NEW.** Quad bus buffer with **HCT (TTL-compatible) inputs** → accepts 3.3 V as logic-high (VIH 2.0 V) and drives a clean ~5 V output — the canonical NeoPixel level shifter. SOIC-14 leaded (iron-solderable; **PDIP-14 SN74AHCT125N** is the solderability-max alt). One of four buffers used; 3-state OE makes parking the spares trivial. **LOCKED pending datasheet attestation.** | pinout (1OE/1A/1Y, VCC/GND), VIH/VIL @ 5 V, VOH vs load, abs-max |
| LED3 | Worldsemi **WS2812B** (5050, 4-pin) | **NEW.** The reference addressable RGB pixel (integrated controller, 5 V, single-wire). One onboard as the "first pixel." 5050 4-pad is hand-solderable with care. **SK6812 (Opsco) is a drop-in alt.** **LOCKED pending datasheet attestation.** | DIN VIH (0.7VDD), VDD range, data timing, decoupling rec |

**Connectors & supporting passives (NEW unless noted):**
- **J4** — On-Shore Technology **ED120/3DS** 3-pos 5.08 mm screw terminal (strip out:
  5 V / DATA / GND), THT. **NEW.**
- **J5** — On-Shore Technology **ED120/2DS** 2-pos 5.08 mm screw terminal (5 V
  injection: 5 V_EXT / GND), THT. **NEW.**
- **C10** — Panasonic **EEU-FR1C102** 1000 µF / 16 V radial electrolytic (strip
  inrush bulk), THT. **NEW.**
- **R7** — 470 Ω 0805 data series resistor — **reuses L1.01 RC0805FR-07470RL.**
- **C8, C9** — 0.1 µF 0805 (shifter + pixel decoupling) — **reuses L1.01
  CL21B104KBCNNNC.**
- All of the **L1.01 core BOM** (U1/U2/D1/F1/J1/J2/J3, C1/C2/C3/C5/C6/C7,
  R1–R6, LED1/LED2, SW1/SW2, TP1/TP2) **carries over unchanged** and already
  exists in the curated parts library.

> **Silkscreen rule (L1 lesson, carried from L1.01):** label every connector pin
> (esp. J4/J5 polarity + the **5 V_EXT / common-GND** markings), mark the WS2812
> DIN→DOUT direction and pixel pin-1, and call out 5 V vs 3V3 clearly.

## 5 · Power & thermal

- **Rails:**
  - **3.3 V** (RT9080) — ESP32 only; **inherited from L1.01**, unchanged.
  - **VBUS 5 V** — powers the 74AHCT125 and the single onboard pixel only (≤ ~60 mA
    LED + a few mA logic, on top of the LDO input current).
  - **5 V_EXT** (injection terminal) — the **external strip's power, isolated from
    USB**; only its **ground** is shared with the board.
- **Budget:** worst-case VBUS draw (LDO input at the brief WiFi-TX peak + onboard
  pixel at full white + shifter) stays under the 0.5 A PTC hold (§3). The big strip
  current is **off-board** by design (injection terminal), so the board never has to
  carry it.
- **Thermal:** **not a flagged concern.** No part dissipates meaningfully — the LDO
  case is unchanged from L1.01 (≤ ~1 W transient), the 74AHCT125 sources µA into a
  high-Z CMOS input, and the onboard pixel is a single LED. No heatsink/pour design
  → `hasThermalConcern = false`.

## 6 · Risk register

Top risks, each with one de-risk pass before the board advances. **R1 and R2 are
the two textbook WS2812 risks** the handoff named.

| # | Risk | Likelihood × Impact | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **R1** | **3.3 V→5 V data-level margin** — a bare ESP32 GPIO (3.3 V) is **below** the WS2812 logic-high threshold (0.7·VDD = 3.5 V at 5 V). Marginal: may work at room temp / short runs, fail cold / on long first-pixel leads → flicker, wrong colors, dead chain. | Med × High (the core function) | **74AHCT125 level shifter (U3):** HCT inputs accept 3.3 V; output VOH ~4.4 V gives **+0.9 V margin** over the 3.5 V threshold (vs −0.2 V bare). The single genuinely-new design element exists precisely to close this. | **DE-RISKED** |
| **R2** | **Strip inrush / power** — WS2812 strips draw far more than USB can supply (60 mA/pixel white); powering a strip from VBUS would trip the PTC or brown out the board, and turn-on inrush can glitch the first pixel. | Med × High | **Dedicated 5 V injection terminal (J5):** strip power is external, never USB; **1000 µF bulk (C10)** at the terminal absorbs inrush; the onboard pixel (the only VBUS LED) is a single, budgeted load (§3). | **DE-RISKED** |
| **R3** | **Common-ground omission** — external strip power with a floating/none-shared ground breaks the single-ended data reference → no/garbled data. A classic beginner failure. | Med × Med | J5 ground is **tied common to board ground** on the PCB; silkscreen + the guide call it out explicitly; the data resistor + bulk cap live on the board side of the common ground. | **DE-RISKED** |
| R4 | **Onboard-pixel current stacks on WiFi-TX peak** — pixel at full white (60 mA) coincident with the brief WiFi-TX current peak could approach the 0.5 A PTC hold. | Low × Med | Budgeted under 0.5 A in §3 (peak is brief); firmware caps onboard-pixel brightness; PTC is resettable. | **DE-RISKED** |
| R5 | **WS2812 5050 solderability** — the 4-pad 5050 is harder than a 2-pad passive for a beginner. | Low × Med | One pixel only; hand-solderable with care; guide adds a close-up; SK6812 drop-in alt. Within the L1 leaded/THT envelope. | open → close in guide/build |
| R6 | **Level-shifter unused-gate handling** — floating CMOS inputs on the 3 unused 74AHCT125 buffers can oscillate / waste power. | Low × Low | Park spares: unused **OE → VCC** (disable), unused **A → GND**. Captured in §2 + the schematic. | **DE-RISKED** |
| R7 | **Data-pair / first-lead routing** — long or noisy data lead to the first pixel can corrupt the high-speed (800 kHz) signal. | Low × Med | 470 Ω series R at the driver; short shifter→pixel→connector run; resolved in KiCad layout. | open → close in layout |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board** (this board has **no** mains/Li-ion/thermal/
stripboard flags, so there are **no conditional items** — the no-flags base path):

- [ ] **Calc trail recorded** — every derived value (logic thresholds, margins,
  series R, currents, decoupling) traces to a source (§3).
- [ ] **Each IC datasheet-verified** — the chosen part's datasheet matches the
  schematic symbol and intended use (§4): esp. the **74AHCT125 HCT thresholds +
  VOH** and the **WS2812B DIN VIH / timing**.
- [ ] **Footprint ↔ pinout cross-checked** — each part's footprint pad map matches
  the datasheet pinout (74AHCT125 SOIC-14 1OE/1A/1Y/VCC/GND, WS2812 5050
  DIN/DOUT/VDD/GND direction, the screw-terminal pinouts).
- [ ] **Fab-DRU DRC accounted for** — the fab's design rules (`.kicad_dru`) will be
  applied before gerber export.
- [ ] **BOM availability confirmed** — every part in stock and not EOL/NRND at a
  real distributor (see §8) — the 5 new parts + the reused L1.01 lines.
- [ ] **All top risks de-risked** — every §6 risk has a completed de-risk pass
  (R1–R4, R6 de-risked; R5/R7 close in build/layout).

> These are *attestations* (a human — Josh — checked), not machine proofs — except
> BOM availability (parts MCP) and DRU presence, which are verifiable.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~**$13–14** BOM — the L1.01 ~$10–12 core + ~$1.50 of
  new parts (74AHCT125 ~$0.40, WS2812B ~$0.30, two screw terminals ~$0.80, 1000 µF
  ~$0.30). (`Project.targetCost` currently null — set at the BOM stage.)
- **New parts to create in the library BEFORE the CSV import** (strict
  `(manufacturer, mpn)` match — unmatched rows are reported, never auto-created):
  1. TI **SN74AHCT125D** (level shifter, SOIC-14)
  2. Worldsemi **WS2812B** (onboard pixel, 5050)
  3. On-Shore Technology **ED120/3DS** (J4, 3-pos screw terminal)
  4. On-Shore Technology **ED120/2DS** (J5, 2-pos screw terminal)
  5. Panasonic **EEU-FR1C102** (C10, 1000 µF/16 V radial)
- **Already in the library (reused L1.01 lines):** ESP32-S3-WROOM-1-N16R2, RT9080,
  USBLC6, 1206L050YR, USB4110-GF-A, the Sullins headers, both Würth LEDs, the
  Yageo 10 k/5.1 k/470 Ω resistors (470 Ω = R7 too), the Samsung/Würth caps
  (0.1 µF = C8/C9 too), B3F-1000 buttons, Keystone test points.
- **Second sources to note (exercise the `altMpn`/`altManufacturer` field):**
  level shifter — **SN74AHCT125N** (PDIP-14, solderability-max); onboard pixel —
  **SK6812** (Opsco, drop-in); plus the L1.01 alts carry over.
- **Stock verification:** to confirm at the BOM stage via the parts MCP / distributor
  for the 5 new parts (the reused lines were stock-verified for L1.01).
- **BOM frozen:** **not yet.** Freeze (`bomFrozenAt`) is the side-effect of advancing
  the revision past `BOM_SOURCING` into `LAYOUT` — the handoff that says guide
  authoring may begin.

---

## Friction log (the real deliverable)

Running log of every rough edge hit while driving this board through the pipeline
front-to-back. Each becomes a follow-up issue for the next pipeline round.

| # | Stage | Friction | Severity | Proposed follow-up |
| --- | --- | --- | --- | --- |
| F1 | Design / flags | The seeded `l1-03-ws2812-node` project row had **`requiresStripboard = true`**, contradicting the handoff's "no flags → 6 core items" premise and the actual custom-PCB topology. Caught only by querying the DB directly; nothing in the UI/handoff flagged the mismatch. | Med | Audit the seeded flags on all curriculum project rows vs their intended topology; consider surfacing the flag set on the project page so a mismatch is visible without a SQL query. (Flipped to false for this board, with Josh's go-ahead.) |
| F2 | Design / DB | `Project` has **no `title` column** — the human-facing field is `name` (+ `publicTitle`). A reasonable first query (`SELECT title …`) errors. Minor, but a schema-naming surprise for anyone scripting against it. | Low | Doc the `name` vs `publicTitle` distinction in the board playbook's "where things live" map. |
| F3 | Design / parts | `targetCost` on the project row is **null** — there's no design-to-cost anchor seeded, so the BOM cost advisory (WS3) has nothing to compare against until someone sets it. | Low | Either seed a `targetCost` with the project row, or have the BOM stage prompt for one when null. |
| F4 | BOM CSV authoring | The import upserts on **`[revisionId, partId]`**, so every refDes that shares one library part **must be merged onto a single CSV row** with a combined refDes list + summed quantity (e.g. the 470 Ω part becomes `R5,R6,R7` qty 3; the 0.1 µF part becomes `C2,C3,C7,C8,C9` qty 5). Splitting them into per-refDes rows would silently upsert-collapse to the last row, not error. A modeler thinking "one row per reference designator" gets a wrong BOM with no warning. | Med | Doc the per-part-row rule prominently in the BOM editor / playbook; consider an import-time warning if the same `(manufacturer,mpn)` appears on multiple rows. |

<!-- Append new rows as the pipeline run continues (parts creation, CSV import,
     freeze, board-readiness, guide authoring). -->
