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
| **Status** | `draft` (post Passes 1–9 — for review, not validated, not frozen) |
| **Track / Level** | ACT / L1 |
| **Teaches** | **3.3 V→5 V level shifting** (the primary, graded concept) — with a dedicated 5 V LED rail + common ground as the supporting idea |
| **Validation** | `passes 1–9 folded` → owes a dry pass (+ schematic-stage Pass 6) before part-ready — see `validation-log.md` |

> **Headline:** the **WROOM core (L1.01) reused verbatim** + one new sub-circuit: a
> **74AHCT125 level shifter** lifting the ESP32's 3.3 V data to a clean 5 V WS2812
> signal, an **onboard "first pixel"**, and a **strip output + dedicated 5 V
> injection terminal** (the board never *sources* a big strip's power from USB), now
> with **external-connector protection** (TVS + ESD). No mains / Li-ion / thermal /
> stripboard flags → `DESIGN_VALIDATION` is the **6 core items only**.

> **Priority (carried from L1.01):** (1) the learner — first success must be
> frictionless; (2) the finished board's capability. **When they conflict,
> beginner-success wins.** The onboard pixel makes the core lesson (level-shifting)
> completable on **USB alone**; the external-strip features are the capability layer.

> **Risk-ID note:** the §6 register uses IDs **`RK1`–`RK16`** — these are *risks*,
> not reference designators (resistors are `R1`–`R8`). Unrelated namespaces (F6).

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 node that drives addressable WS2812/NeoPixel
  RGB LEDs** (curriculum **L1.03**, ACT track) — the L1.01 WROOM core plus a small
  new sub-circuit. **The one graded thing it teaches: why a 3.3 V GPIO can't reliably
  drive a 5 V LED's data input, and how a level shifter fixes it** — provable by
  watching the onboard pixel light. The dedicated-5 V-rail + common-ground idea is
  the *supporting* concept the external-strip path introduces.

- **Functional requirements:**
  - **F1** — Run an ESP32-S3-WROOM-1 from one USB-C cable (power + native-USB
    flash/console) — **inherited from L1.01**.
  - **F2** — Drive a WS2812 chain from **GPIO5** (RMT/bit-bang), **level-shifted to 5 V**.
  - **F3** — **One onboard WS2812 pixel** lit from USB power alone (the "first pixel"
    — a self-contained bring-up target; makes the core lesson USB-only).
  - **F4** — A **3-pin strip output** (5 V, DATA, GND) to continue the chain.
  - **F5** — A **dedicated 2-pin 5 V injection terminal** for the strip's power,
    ground tied **common**; the board does not source strip power from USB.
  - **F6** — **Series resistors + bulk cap + external-connector protection** (data
    damping, parasitic limit, inrush reservoir, TVS/ESD) per WS2812 guidance + FMEA.

- **Electrical / power budget:**
  - **E1** — USB-C **VBUS 5 V** (sink) — powers the board, shifter, onboard pixel; a
    **10 µF VBUS bulk cap (C11)** near the pixel/LDO-input node (PI-2).
  - **E2** — Regulate to **3.3 V** (RT9080 linear LDO, from L1.01).
  - **E3** — **Strip 5 V is external** (injection terminal), never sourced from VBUS.
    **VBUS and 5V_EXT are separate nets, never joined** — only GND is common (an
    isolation invariant; §7 + ERC check). Board copper carries 5V_EXT J5→J4 (§5).
  - **E4** — Level shifter VCC = **VBUS 5 V** (output must swing to 5 V — §3).

- **Interfaces:**
  - **I1** — USB-C (power + native USB) — **inherited from L1.01**.
  - **I2** — WS2812 data: **GPIO5** → 74AHCT125 gate 1 → **470 Ω (R7)** → onboard
    pixel DIN → DOUT → **470 Ω (R8)** → J4.DATA → external strip.
  - **I3** — Strip output (J4): **TE 282837-3** 3-pos 5.08 mm screw terminal
    (5 V / DATA / GND); **ESD diode (D3) on DATA**.
  - **I4** — 5 V injection (J5): **TE 282837-2** 2-pos 5.08 mm screw terminal
    (5 V_EXT / GND, common GND); **TVS (D2) across 5V_EXT**.
  - **I5** — **Data test point (TP3)** on the shifted line (1Y / pixel-DIN side) — to
    *see* the 5 V swing the lesson promises (L9-3).

- **Constraints / DFM / safety flags:**
  - **No mains / Li-ion / thermal / stripboard** — all four flags **false** → §7 is
    the **6 core items only**. *(Seeded `requiresStripboard` was wrongly true; flipped
    — Friction F1.)*
  - **Antenna keep-out (M1):** inherited — module on a board edge, antenna over a
    keep-out (Espressif rules). New parts + screw-terminal wire-exits stay **off the
    antenna edge** (L9-4/L9-5).
  - **Solderability (first-class L1):** new parts in the L1.01 envelope — 74AHCT125
    SOIC-14 (leaded), WS2812 5050 (hardest joint → **mandatory flux-pen step**, RK5),
    TE screw terminals (THT), D2 SMA / D3 SOD-323 (leaded SMD).
  - **Regulatory:** unchanged — pre-certified module; no board-level cert. No
    mains/battery/HV.

## 2 · Topology

L1.01 core untouched + the new WS2812 sub-circuit on GPIO5 + a second (external)
5 V rail with protection.

```
   ┌─────────────────── L1.01 CORE (reused verbatim, validated) ───────────────────┐
   │  USB-C(sink) → PTC polyfuse → USBLC6 ESD → RT9080 LDO → 3V3 → ESP32-S3-WROOM-1 │
   └───────────────────────────────────────────────────────────────────────────────┘
        VBUS 5V │  [C11 10µF bulk]                   │ GPIO5 (non-strapping, non-USB)
                │                                     ▼
                │  (VCC=VBUS, C8 0.1µF)    ┌──────────────────────┐
                ├─────────────────────────►│ 74AHCT125 (gate 1)   │ 3.3V→~5V
                │                          │ 1OE→GND(EN) 1A←GPIO5  │ 7=GND 14=VCC
                │                          │ 1Y──[470Ω R7]──┐      │ gates2-4: nOE→VCC,nA→GND
                │                          └────────────────┼──────┘
                │   5V (onboard pixel)                       ▼     ┌──────────────┐
                ├────────────────────────────[C9 0.1µF]──────────►│ WS2812 (LED3)│ VDD,VSS→GND
                │                                                  │ DIN→DOUT ────┼─[470Ω R8]─┐
                │                                                  └──────────────┘           │
               GND ◄───────────────────── common GND (star @ J5) ──────────────────┐         │ DATA
                ▲                                                                    │   [D3 ESD]
         ┌──────┴───────┐  5V_EXT ──[board copper, §5]──┬──────────────────────────────────► J4 (strip out)
         │ J5 injection │  [C10 1000µF] [D2 TVS 5.0V]   │   (5V_EXT / DATA / GND)   TE 282837-3
         │  TE 282837-2 │  GND COMMON ─────────────────┘   → external WS2812 strip
         └──────────────┘   ⚠ VBUS and 5V_EXT are SEPARATE nets — never joined
```

**Sub-circuits:**
1. **L1.01 core (reused):** USB-C + CC pull-downs · PTC + USBLC6 · 3V3 (RT9080 +
   decoupling) · S3-WROOM-1 + EN/BOOT · indicators · headers. *No new design work.*
2. **Level shifter (NEW):** 74AHCT125, **VCC = VBUS (pin 14)**, **GND (pin 7) → board
   GND**, C8 0.1 µF (pin 14→7). **Gate 1 USED:** `1OE → GND` (active-low enable ON),
   `1A ← GPIO5`, `1Y → R7`. **Gates 2–4 PARKED:** `nOE → VCC` (disable → Hi-Z),
   `nA → GND`; `nY` left open (OK — Hi-Z output, the one allowed float).
3. **Onboard pixel (NEW):** WS2812 (LED3), **VDD = VBUS**, **VSS → board GND**,
   DIN ← R7, DOUT → R8; C9 0.1 µF at VDD. TP3 (data test point) on the 1Y/DIN node.
4. **Strip interface (NEW):** J4 (TE 282837-3) 5 V_EXT/DATA/GND; J5 (TE 282837-2)
   5 V_EXT/GND; **C10 1000 µF** (C10− → common GND) + **D2 TVS (5.0 V) across 5V_EXT**
   at J5; **D3 ESD diode on J4.DATA → GND**. **Star ground at J5/C10.** **VBUS and
   5V_EXT never share copper** (isolation invariant).

**Theory of operation:** core boots/enumerates as L1.01. GPIO5 drives the WS2812
protocol; 3.3 V is too low for a 5 V-powered WS2812 (§3), so it passes through one
74AHCT125 buffer (TTL inputs accept 3.3 V; output ~5 V), R7, into the onboard pixel
(on VBUS — a no-strip bring-up target). Its DOUT drives the external strip via R8,
D3, J4. The strip is powered separately at J5 (5V_EXT, off-board source); D2 clamps
over-voltage/reverse, C10 absorbs inrush; all grounds common (star at J5).

**Sequencing (RK8 + P4-S1):** *Power-up* — strip supply before/with USB (else
onboard DOUT drives the unpowered strip DIN; R8 limits to ~9 mA, D2/D3 bound it).
*Power-down* — if USB is pulled while 5V_EXT stays on, the strip stays lit and U3
(VBUS) loses VCC while GPIO5/3V3 briefly linger; back-drive into U3's input is small
and clamped — documented, guide covers unplug order.

## 3 · Calc trail (DO — lock the math)

Worst-case (min/max/temperature), not typical.

| Value | Formula / source | Result | Notes |
| --- | --- | --- | --- |
| WS2812 data logic-high | WS2812B: **VIH = 0.7 × VDD**, VDD = 5 V | **3.5 V** | bar at the first DIN |
| Bare 3.3 V GPIO vs threshold | 3.3 V < 3.5 V | **fails (−0.2 V)** | reason for the shifter (RK1) |
| Shifter input acceptance | 74AHCT125 VIH = 2.0 V, VIL = 0.8 V (flat over VCC 4.5–5.5 V) | 3.3 V ✓ | TTL inputs; VBUS sag doesn't move the threshold |
| Shifter VOH (actual µA load) | WS2812 DIN high-Z → VOH ≈ 4.4 V (@ −50 µA) | ~4.4 V | operating point |
| Shifter VOH (guaranteed, **over-temp**) | 74AHCT125 **VOH = 3.8 V min @ −8 mA**, full temp range, VCC 4.5 V | 3.8 V | worst-case (3.94 V is the 25 °C value) |
| **Onboard-hop margin** | actual 4.4 − 3.5 = **+0.9 V**; guaranteed worst **3.8 − 3.5 = +0.30 V** | **≥ +0.30 V** | RK1; threshold tracks VDD so it's robust |
| **Cross-domain hop margin (strip)** | onboard DOUT ≈ V(VBUS,min ~4.6 V) vs VIH = 0.7·V(5V_EXT,max ≤5.5 V) = 3.85 V | **~+0.75 V** | PI-1: driver (VBUS) & threshold (5V_EXT) on *different* rails — margin does NOT track; assumes 5V_EXT ≤ 5.5 V |
| Prop delay vs bit | AHCT125 tpd ~9–22 ns (≤30 ns max) vs 1.25 µs bit | tpd ≪ bit | negligible skew (P5 confirmed) |
| **Reset/latch low time** | WS2812B RES ≥ 50 µs; **clones may need ≥ 280 µs** | **firmware latch ≥ 300 µs** | P5-3 — clone-safe (XINGLIGHT is a clone) |
| Data series R (shifter→pixel) | WS2812 guidance 300–500 Ω | **470 Ω (R7)** | reuses L1.01 470 Ω part |
| Data series R (DOUT→strip) | guidance + parasitic-current limit | **470 Ω (R8)** | new placement, same part |
| Parasitic clamp current (strip unpowered) | (VOH − Vf)/R8 = (5 − 0.7)/470 | **~9 mA** | RK8 — see honest framing below |
| Onboard-pixel current | 1× WS2812 full white | 60 mA (max) | only LED load on VBUS; firmware-cap |
| VBUS budget — continuous | ESP32 ~160 mA + pixel 60 mA + shifter µA | **~220 mA** | ≪ 0.5 A PTC hold |
| VBUS budget — brief peak | linear LDO Iin≈Iout: WiFi-TX ~500 mA + 60 mA | **~560 mA (brief)** | < 1 A PTC trip; **C11 10 µF VBUS bulk + 3V3 bulk** ride it (RK4) |
| TVS clamp (over-injection) | D2 SMAJ5.0A: VRWM 5.0 V, VC ~9.2 V @ Ipp | clamps >~6 V | RK10 — sacrificial vs sustained 12 V; pair w/ "fuse your supply" |
| Worst-case DATA back-drive current | (V_inject,max − VBUS)/R8, bounded by D2 clamp | bounded | RK11 — D2 caps 5V_EXT, R8 + D3 limit the bridge current into DOUT/1Y |
| Decoupling | shifter 0.1 µF (C8); pixel 0.1 µF (C9); VBUS bulk 10 µF (C11) | — | TI also suggests 0.1+1 µF; 0.1 alone adequate for one gate |

> **RK8 honest framing (P5-1):** with the strip **unpowered (VDD = 0)** the WS2812
> abs-max input voltage is VDD+0.5 V = **+0.5 V**, so ~5 V on DIN is an **abs-max-
> voltage excursion mitigated by R8 current-limiting (~9 mA)** — NOT "within abs-max."
> WS2812 publishes **no DIN clamp-current rating**, so 9 mA is a conservative
> engineering bound. **Primary control = documented power-up order**; D2/D3 + R8 are
> the hardware backstop.

## 4 · IC selection (DO — lock the parts)

| Ref | Part (MPN) | Why | Datasheet §s to verify |
| --- | --- | --- | --- |
| U1 | Espressif **ESP32-S3-WROOM-1-N16R2** | Reused from L1.01 (validated). | (verified in L1.01) |
| U2 | Richtek **RT9080-33GJ5** | Reused; **linear** LDO (P-MOSFET pass → Iin≈Iout). | (verified; P5 confirmed) |
| D1 | UMW **USBLC6-2SC6** | Reused — USB ESD. | (verified in L1.01) |
| U3 | TI **SN74AHCT125D** (SOIC-14) | NEW. HCT/TTL inputs accept 3.3 V, drive ~5 V; canonical NeoPixel shifter. Pinout: **7=GND, 14=VCC**; gate 1 used. | pinout, VIH/VIL/VOH(over-temp)/tpd, abs-max **(verified Pass 5)** |
| LED3 | XINGLIGHT **XL-5050RGBC-WS2812B** (5050) | NEW. Digikey-orderable WS2812B-compatible pixel. ⚠ **its OWN datasheet must be obtained at part-creation** — numbers below are from Worldsemi WS2812B pending that (P5-2); the LED3 datasheet tick is BLOCKED until then. | DIN VIH (0.7VDD), VDD range, **DIN/DOUT abs-max** (RK8/RK11), RES time |
| D2 | Littelfuse **SMAJ5.0A** (SMA) | NEW. Uni TVS across 5V_EXT — clamps 12 V over-injection (RK10) + reverse (forward-conducts, protects C10, RK9) + caps the DATA back-feed (RK11). | VRWM/VBR/VC, SMA solderable |
| D3 | Nexperia **PESD5V0S1BA** (SOD-323) | NEW. Low-cap 5 V ESD diode on J4.DATA→GND — protects the exposed data pin (RK13) + absorbs coupled transients (RK15); low C keeps the 800 kHz edge. | standoff 5 V, capacitance, clamp |

**Connectors & supporting passives (NEW unless noted):**
- **J4** TE Connectivity (Buchanan) **282837-3** (3-pos 5.08 mm screw terminal, strip
  out), THT — reused from TB-1-POWER family. **J5** TE **282837-2** (2-pos, injection).
- **C10** Panasonic **EEU-FR1C102** 1000 µF/16 V radial (inrush bulk) — ~Ø10×20 mm
  **tall** (enclosure keep-out, L9-1).
- **C11** 10 µF VBUS bulk — **reuses L1.01 CL21A106KOQNNNE** (= C1's part).
- **R7, R8** 470 Ω, **C8, C9** 0.1 µF — reuse L1.01 parts (RC0805FR-07470RL,
  CL21B104KBCNNNC). **TP3** data test point (Keystone, or a labeled pad).
- All **L1.01 core BOM** carries over unchanged (already in the library).

> **Silkscreen rule:** label every pin; **J5: "5 V ONLY — NOT 12 V/24 V" + polarity**;
> distinguish **"5V (USB)" vs "5V_EXT (strip)"**; WS2812 DIN→DOUT + pin-1; C10/D2
> polarity; mark TP3.

## 5 · Power & thermal

- **Rails:** **3.3 V** (RT9080, ESP32 only, from L1.01); **VBUS 5 V** (shifter +
  onboard pixel; **C11 10 µF bulk** added, PI-2); **5V_EXT** (external strip,
  *sourced* off-board, routed J5→J4 on board copper). **VBUS ⟂ 5V_EXT — separate
  nets, never joined** (E3, §7 ERC check).
- **Budget (worst-case):** continuous ~220 mA ≪ 0.5 A hold; brief peak ~560 mA <
  1 A trip, ridden by C11 + 3V3 bulk (§3, RK4).
- **5V_EXT ampacity (layout):** J5→J4 5 V_EXT + common-GND return carry the strip
  current; TE terminals ~15 A so **board copper is the limit** — size for the
  documented max strip current; keep J5 adjacent to J4; **star-ground at J5/C10** so
  the C10 hot-plug surge (PI-3) doesn't bounce the data reference.
- **Thermal:** not flagged. LDO ≤ ~1 W transient (L1.01); shifter µA; one onboard
  pixel → `hasThermalConcern = false`.

## 6 · Risk register

IDs `RK#` (risks ≠ resistor refDes).

| # | Risk | L × I | De-risk | Status |
| --- | --- | --- | --- | --- |
| **RK1** | 3.3 V→5 V data-level margin (bare GPIO below 0.7·VDD) | Med × High | 74AHCT125: VOH margin **+0.9 V actual / +0.30 V guaranteed-over-temp**; threshold tracks VDD (§3). | **DE-RISKED** |
| RK2 | Strip inrush | Med × High | Dedicated injection (J5); C10 1000 µF; budgeted onboard load. | **DE-RISKED** |
| RK3 | Common-ground omission | Med × Med | J5 GND tied common (star); LED3.VSS + C10− netted to it; silk + guide. | **DE-RISKED** |
| RK4 | VBUS load vs PTC | Low × Med | ~220 mA cont. ≪ 0.5 A; ~560 mA brief < 1 A trip; **C11** + 3V3 bulk ride it. | **DE-RISKED** |
| RK5 | 5050 solderability (lens heat) | Med × Med | **Mandatory flux-pen** + temp-controlled iron ~315 °C / quick dwell + close-up; THT-pixel fallback. | open → build/guide |
| RK6 | Shifter gate handling (active-low EN) | Low × Low | **Gate 1 `1OE→GND` (EN)**; gates 2–4 `nOE→VCC`, `nA→GND`; nY open (Hi-Z). | **DE-RISKED** |
| RK7 | Data / 5V_EXT routing + ampacity | Low × Med | 470 Ω at each driver; short runs; size J5→J4 copper; antenna keep-out. | open → layout |
| RK8 | Parasitic / data-before-power (strip unpowered) | Med × Med | **Abs-max-V excursion current-limited by R8 (~9 mA)** + **documented power-up order (primary)** + D2/D3 backstop. (P5-1 honest framing.) | **DE-RISKED** |
| RK9 | Reverse-polarity on J5 | Med × Med | **D2 TVS forward-conducts on reverse → clamps ~−0.7 V, protects C10**; + silk polarity + keying. | **DE-RISKED** |
| RK10 | **12 V/24 V wrong-supply into J5** | Med × High | **D2 TVS (5.0 V)** clamps/crowbars; silk "5 V ONLY"; "fuse your supply" guide rule. (Sustained 12 V = sacrificial D2 → blown supply fuse, not board death.) | **DE-RISKED (sacrificial)** |
| RK11 | **DATA net bridges 5V_EXT→VBUS/AHCT125** (R8 + clamps) | Med × High | **D2 caps 5V_EXT** + **D3 on DATA** + R8 limit; worst-case back-drive bounded (§3); isolation invariant (E3). | **DE-RISKED** |
| RK12 | Stray-strand short across J4 (5V-GND etc.) | Med × High | "Current-limited/fused injection supply" guide rule; silk; (optional rail PTC deferred). Document: no on-rail fault protection. | accept + document |
| RK13 | ESD onto exposed J4.DATA | Med × Med-High | **D3 ESD diode on DATA**. | **DE-RISKED** |
| RK14 | Hot-plug at J4 (ground-last; far-end-powered strip contention) | Med × Med | Guide: power-down before touching J4; strip must not be independently powered; D2/D3 blunt transients. | accept + document |
| RK15 | Long strip lead as antenna/transient injector | Low-Med × Med | D3 + keep R8 near J4; max-lead-length + routing guide note. | **DE-RISKED** |
| RK16 | AHCT125 always-enabled → strip flashes/latches during GPIO5 reset / VBUS brown-out while 5V_EXT up | Med × Med | Firmware blanks early + brightness cap; document GPIO5 reset state; optional 1OE-gating (deferred). | accept + document |

## 7 · DESIGN_VALIDATION checklist

Core — **6 items only** (no flags):

- [ ] **Calc trail recorded** — every value (margins both hops, timing, reset, parasitic, budgets, TVS clamp, decoupling) traces to a source (§3).
- [ ] **Each IC datasheet-verified** — 74AHCT125 ✓ (Pass 5); RT9080 ✓; D2/D3 to verify; **LED3 BLOCKED until the XINGLIGHT datasheet is obtained** (P5-2).
- [ ] **Footprint ↔ pinout cross-checked** — *schematic-stage* (Pass 6): U3 SOIC-14, LED3 5050, TE terminals, D2 SMA, D3 SOD-323.
- [ ] **Fab-DRU DRC accounted for** — incl. an **ERC/DRC check that VBUS and 5V_EXT are never joined** (E3 isolation invariant). *Schematic/layout-stage.*
- [ ] **BOM availability confirmed** — the 7 new parts + reused lines, exact `(mfr, mpn)` strings (§8).
- [ ] **All top (design-stage) risks de-risked** — RK1–RK4, RK6, RK8–RK11, RK13, RK15 de-risked; RK5/RK7 at build/layout; RK12/RK14/RK16 accept+document.

> Evidence: `validation-log.md`.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~**$14–15** (L1.01 core + ~$2.50 new: shifter, pixel, 2
  terminals, 1000 µF, TVS, ESD, 10 µF). `targetCost` null (F3).
- **New parts to create BEFORE import (strict `(mfr, mpn)` match — exact strings):**
  1. Texas Instruments **SN74AHCT125D** (SOIC-14)
  2. XINGLIGHT **XL-5050RGBC-WS2812B** (5050) — *confirm exact string + obtain datasheet*
  3. TE Connectivity **282837-3** (J4)
  4. TE Connectivity **282837-2** (J5)
  5. Panasonic **EEU-FR1C102** (C10)
  6. Littelfuse **SMAJ5.0A** (D2 TVS)
  7. Nexperia **PESD5V0S1BA** (D3 ESD)
- **Already in library (reused):** WROOM core lines incl. 470 Ω (R7/R8), 0.1 µF
  (C8/C9), **10 µF CL21A106KOQNNNE (C1 + now C11)**.
- **Second sources:** shifter SN74AHCT125N (PDIP-14); pixel SK6812 (LCSC-only,
  noted not relied on); TVS/ESD have many drop-ins.
- **BOM frozen:** **not yet** — and freeze is **gated on the design passing the
  validation protocol** (`../_protocol.md`).

---

## Friction log (the real deliverable)

| # | Stage | Friction | Severity | Follow-up |
| --- | --- | --- | --- | --- |
| F1 | Design / flags | Seeded `requiresStripboard=true` (custom PCB). It would have materialized a **separate `STRIPBOARD_VALIDATION` checklist + BOM_SOURCING exit gate** (not a DV conditional — those are mains/Li-ion/thermal only). Flipped to false. | Med | Audit seeded flags vs topology; surface flags on the project page. |
| F2 | Design / DB | `Project` has no `title` column (it's `name`/`publicTitle`). | Low | Document in the playbook. |
| F3 | Design / parts | `targetCost` null → cost advisory has no anchor. | Low | Seed `targetCost` or prompt at BOM stage. |
| F4 | BOM CSV | Import upserts on `[revisionId, partId]` → shared-part refDes must merge to one row. | Med | **FIXED in PR #150.** |
| F5 | Process / docs | The handoff doc the design references lives only on PR #149's branch (absent on main). | Low | Merge #149 or repoint. |
| F6 | Design / consistency | Risk IDs `R#` collided with resistor refDes. | Low | Adopted `RK#`; bake the convention into `_template`. |
| F7 | Protocol | The footprint↔pinout (Pass 6) + fab-DRU audits **can't fully close at the design.md stage** (no KiCad symbols/footprints yet) — they stage to schematic/layout. The flat protocol implies all audits close before "add a part." | Med | **Refine `_protocol.md` to phase-stage audits** (design vs schematic vs layout); a design-stage-dry board is "part-ready" with footprint/DRU explicitly owed. (Owner-approved; follow-up PR.) |
| F8 | Validation / parts | A BOM part can be a **WS2812-compatible clone** (XINGLIGHT) whose own datasheet isn't readily available — so "each IC datasheet-verified" can't be honestly ticked from the *compatible* part's marketing; numbers get inherited from the reference part by assumption. | Med | Require the actual part datasheet (or an explicit "assumed-from-X, RISK" note) at part-creation; the datasheet audit can't pass on a substitute datasheet. |

<!-- Append rows as the run continues (parts creation, import, freeze, guide). -->
