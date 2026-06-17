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
| **Validation** | `passes 1–3 logged` → owes ≥ 10 + a dry pass before part-ready — see `validation-log.md` |

> **Headline:** this board is the **WROOM core (L1.01) reused verbatim** + one small,
> genuinely-new sub-circuit: a **74AHCT125 level shifter** lifting the ESP32's
> 3.3 V data line to a clean 5 V WS2812 signal, an **onboard "first pixel"**, and a
> **strip output + dedicated 5 V injection terminal** (the board never *sources* a
> big strip's power from USB). No mains / Li-ion / thermal / stripboard flags → the
> `DESIGN_VALIDATION` checklist is the **6 core items only** (the no-flags base path
> this run is meant to validate).

> **Risk-ID note:** the §6 risk register uses IDs **`RK1`–`RK9`**. These are
> *risks*, not reference designators — resistors are `R1`–`R8` (§3/§4). The two
> namespaces are unrelated (a consistency-audit fix; see Friction F6).

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
  - **F2** — Drive a WS2812 data chain from **GPIO5** (RMT/bit-bang), **level-shifted
    to 5 V logic**.
  - **F3** — **One onboard WS2812 pixel** that lights from USB power alone (the
    "first pixel" — a self-contained bring-up target, no external strip needed).
  - **F4** — A **3-pin strip output** (5 V, DATA, GND) to continue the chain to an
    external strip.
  - **F5** — A **dedicated 2-pin 5 V injection terminal** for the external strip's
    power, with its **ground tied common** to board ground. The board does **not**
    source the strip's power from USB.
  - **F6** — **Series resistors + bulk capacitor** on the data/strip interface
    (data-line damping + parasitic-current limit + inrush reservoir), per WS2812
    application guidance.

- **Electrical / power budget:**
  - **E1** — Input: USB-C **VBUS 5 V** (sink role) — powers the board, the level
    shifter, and the **single onboard pixel** only.
  - **E2** — Regulate to **3.3 V** for the ESP32 (RT9080 LDO, inherited from L1.01).
  - **E3** — **Strip 5 V is external**, via the injection terminal — never sourced
    from VBUS. Onboard pixel (≤ ~60 mA full white) is the only LED load on VBUS.
    *(The board copper does carry the strip's 5 V from J5 → J4; see §5 / RK-ampacity.)*
  - **E4** — Level shifter VCC = **VBUS 5 V** (it must swing its output to 5 V to be
    read as logic-high by a 5 V-powered WS2812 — see §3).

- **Interfaces:**
  - **I1** — USB-C (power + native USB) — **inherited from L1.01**.
  - **I2** — WS2812 data path: **GPIO5** → 74AHCT125 (gate 1) → **470 Ω (R7)** →
    onboard pixel DIN → onboard pixel DOUT → **470 Ω (R8)** → strip output DATA.
  - **I3** — Strip output (J4): **TE 282837-3** 3-pos 5.08 mm screw terminal
    (5 V / DATA / GND).
  - **I4** — 5 V injection (J5): **TE 282837-2** 2-pos 5.08 mm screw terminal
    (5 V_EXT / GND, common GND).

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, not a stripboard build** —
    USB-5 V powered custom 2-layer PCB. All four project flags are **false**
    (`hasMainsNet`/`hasLiIon`/`hasThermalConcern`/`requiresStripboard` = false), so
    §7 lists **only the 6 core validation items**. *(The seeded project row had
    `requiresStripboard=true`; flipped to false on review — see Friction F1.)*
  - **Antenna keep-out (M1):** inherited from L1.01 — module on a board edge, PCB
    antenna over a keep-out (Espressif S3-WROOM-1 integration rules).
  - **Solderability (the L1 constraint — first-class):** every new part stays inside
    the L1.01 envelope — leaded SMD (SOIC) or through-hole, passives ≥ 0805. The
    level shifter is **SOIC-14** (leaded; PDIP-14 alt), the onboard WS2812 is a 5050
    4-pad (hardest joint on the board — **mandatory flux-pen step in the guide**, see
    RK5), and the strip/injection connectors are **THT screw terminals**.
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
        VBUS 5V │                                   │ GPIO5 (non-strapping, non-USB)
                │                                    ▼
                │  (VCC = VBUS 5V)         ┌──────────────────────┐
                ├─────────────────────────►│ 74AHCT125 (gate 1)   │ 3.3V in → ~5V out
                │                          │ 1OE→GND (ENABLE)      │ (HCT/TTL inputs)
                │                          │ 1A←GPIO5  1Y──────────┼─►[470Ω R7]─┐
                │                          │ gates 2-4 PARKED:     │            │
                │                          │   nOE→VCC, nA→GND      │            ▼
                │                          └──────────────────────┘   ┌──────────────┐
                │   5V (onboard pixel only)                           │ WS2812 (LED3)│
                ├─────────────────────────────────────────────────── │ onboard pixel│
                │                            [0.1µF C9 decap]         │ VDD, GND     │
                │                                                     │ DIN→…→DOUT ──┼─►[470Ω R8]─┐
                │                                                     └──────────────┘            │
               GND ◄──────────────────── common ground ─────────────────────────────────┐       │ DATA
                ▲                                                                          │       ▼
         ┌──────┴───────┐  5V_EXT ───────[board copper, see §5 ampacity]──────┬──────────────► J4 (strip out)
         │ J5 injection │  (external strip power ONLY)                        │  5V / DATA / GND  TE 282837-3
         │  TE 282837-2 │  [1000µF C10 bulk @ terminal]                       │  → external WS2812 strip
         │ 5V_EXT, GND  │  GND tied COMMON to board GND ──────────────────────┘
         └──────────────┘
```

**Sub-circuits the schematic is organised into:**
1. **L1.01 core (reused):** USB-C input + CC sink pull-downs · protection (PTC +
   USBLC6 ESD) · 3V3 power (RT9080 + decoupling) · the S3-WROOM-1 module with
   EN/BOOT · indicators · breakout headers. *Copied from the validated L1.01
   schematic — no new design work.*
2. **Level shifter (NEW):** 74AHCT125, VCC = VBUS 5 V, 0.1 µF VCC decoupling (C8).
   **Gate 1 USED:** `1OE → GND` (active-low enable → output ON), `1A ← GPIO5`,
   `1Y → R7`. **Gates 2–4 PARKED:** `nOE → VCC` (disable → Hi-Z), `nA → GND`
   (don't float CMOS inputs), `nY` open.
3. **Onboard pixel (NEW):** one WS2812 (LED3), VDD = VBUS 5 V, DIN ← R7 (470 Ω) from
   1Y, DOUT → R8 (470 Ω) → strip connector DATA; 0.1 µF decoupling (C9) at its VDD.
4. **Strip interface (NEW):** J4 (TE 282837-3) 3-pos screw terminal (5 V_EXT /
   DATA / GND) to the strip; J5 (TE 282837-2) 2-pos screw terminal (5 V_EXT / GND)
   for external injection; 1000 µF bulk (C10) across 5 V_EXT; all grounds common.

**Theory of operation:** the WROOM core boots and enumerates over native USB exactly
as in L1.01. Firmware drives **GPIO5** with the WS2812 protocol. That 3.3 V signal is
too low to be a reliable logic-high for a 5 V-powered WS2812 (§3), so it passes
through one 74AHCT125 buffer (TTL inputs accept 3.3 V, output swings to ~5 V), a
470 Ω series resistor (R7), into the onboard pixel's DIN. The onboard pixel runs off
VBUS — a no-strip-needed bring-up target. **Its DOUT** (a fresh 5 V re-clocked
output) drives the external strip via **R8** and J4. The **external strip is powered
separately** through the injection terminal (J5) — its 5 V is *sourced* externally,
though the board copper routes it J5 → J4 (an ampacity item, §5). All grounds are
common so the single-ended data has a shared reference. A 1000 µF bulk cap at the
injection terminal absorbs the strip's turn-on inrush.

**Power-up note (RK8):** if USB is on but the injection supply is off, the onboard
pixel's DOUT drives ~5 V into the *unpowered* strip's DIN; R8 limits the resulting
parasitic clamp current to a safe ~9 mA (§3), and the guide instructs powering the
strip supply **before/with** USB.

## 3 · Calc trail (DO — lock the math)

Worst-case (min/max/temperature), not typical, per the protocol math audit.

| Value | Formula / source | Result | Notes |
| --- | --- | --- | --- |
| WS2812 data logic-high threshold | WS2812B datasheet: **VIH = 0.7 × VDD**, VDD = 5 V | **3.5 V** | the bar the data line must clear at the first pixel's DIN |
| Bare 3.3 V GPIO vs that threshold | ESP32 VOH ≈ 3.3 V < 3.5 V | **fails (−0.2 V)** | the whole reason for the level shifter (RK1) |
| Level-shifter input acceptance | 74AHCT125 (HCT/TTL inputs): VIH = 2.0 V, VIL = 0.8 V @ VCC 5 V | 3.3 V ✓ | ESP32 3.3 V high ≥ 2.0 V; 0 V low ≤ 0.8 V — driven cleanly |
| Level-shifter VOH (actual load) | WS2812 DIN is high-Z CMOS (~µA) → VOH ≈ 4.4 V (datasheet @ −50 µA) | ~4.4 V | the real operating point |
| Level-shifter VOH (guaranteed min) | 74AHCT125: **VOH = 3.94 V min @ IOH = −8 mA**, VCC 4.5 V | 3.94 V | datasheet worst-case at heavy load |
| **Data-level margin** | actual: 4.4 − 3.5 = **+0.9 V**; guaranteed-worst: 3.94 − 3.5 = **+0.44 V** | **≥ +0.44 V** | both positive → de-risks RK1. Margin is robust: 0.7·VDD **tracks** pixel VDD, so a sagging pixel VDD lowers the threshold too |
| Level-shifter prop delay vs WS2812 timing | AHCT125 tpd ≈ 9–22 ns typ (~30 ns max @ 5 V) vs WS2812 bit period 1.25 µs (T0H/T1H ≈ 0.35/0.7 µs) | tpd ≪ bit | adds ~30 ns of skew to a 1.25 µs bit → negligible (< 3%); de-risks the timing concern |
| Data series resistor (shifter→pixel) | WS2812 app guidance: 300–500 Ω at the driver to damp reflections | **470 Ω (R7)** | reuses the L1.01 470 Ω part (RC0805FR-07470RL) |
| Data series resistor (pixel DOUT→strip) | same guidance, on the longer external run + limits parasitic clamp current | **470 Ω (R8)** | NEW placement of the same 470 Ω part |
| Parasitic clamp current (strip unpowered) | (VOH − Vdiode)/R8 = (5 − 0.7)/470 | **~9 mA** | RK8: safe for the WS2812 DIN clamp diode; makes the USB-only state benign |
| Onboard-pixel current | 1× WS2812 full white ≈ 60 mA @ 5 V | 60 mA (max) | the only LED load on VBUS; firmware-cap recommended |
| VBUS budget — continuous | ESP32-S3 typ ~160 mA + pixel 60 mA + shifter ~µA | **~220 mA** | well under the 0.5 A PTC **hold** |
| VBUS budget — brief peak | RT9080 is a **linear** LDO (Iin ≈ Iout): WiFi-TX peak ~500 mA + pixel 60 mA | **~560 mA (brief)** | between PTC hold (0.5 A) and trip (1 A); brief excursions don't trip; 3V3 bulk rides the TX transient (same regime L1.01 accepts) — de-risks RK4 |
| Level-shifter decoupling | logic-IC standard 0.1 µF at VCC | 0.1 µF (C8) | reuses L1.01 0.1 µF part |
| Onboard-pixel decoupling | WS2812 datasheet: 0.1 µF near each pixel VDD | 0.1 µF (C9) | reuses L1.01 0.1 µF part |
| Strip inrush bulk cap | Adafruit NeoPixel guidance: ≥ 1000 µF across the strip's 5 V near injection | **1000 µF / 16 V (C10)** | a floor, not generous; size up for long strips. De-risks RK2 |

## 4 · IC selection (DO — lock the parts)

"Datasheet-verified" means the relevant sections (pinout, abs-max, logic levels)
were read, not just the marketing page. *(Datasheet + footprint↔pinout attestations
are earned in Passes 4–6 of the validation run.)*

| Ref | Part (MPN) | Why this part | Datasheet §s to verify |
| --- | --- | --- | --- |
| U1 | Espressif **ESP32-S3-WROOM-1-N16R2** | **Reused from L1.01, unchanged** — validated core (native USB, pinout VERIFIED in Foundry). In the library. | (verified in L1.01) |
| U2 | Richtek **RT9080-33GJ5** | **Reused from L1.01** — 3.3 V/600 mA **linear** LDO. In library. | (verified in L1.01) |
| D1 | UMW **USBLC6-2SC6** | **Reused from L1.01** — USB ESD array. In library. | (verified in L1.01) |
| U3 | TI **SN74AHCT125D** (SOIC-14) | **NEW.** Quad bus buffer, **HCT (TTL) inputs** → accepts 3.3 V as logic-high (VIH 2.0 V), drives clean ~5 V; the canonical NeoPixel shifter. SOIC-14 leaded (PDIP-14 `SN74AHCT125N` alt). Gate 1 used; 3-state OE parks the spares. | pinout (1OE/1A/1Y, VCC/GND), VIH/VIL + VOH vs load, tpd, abs-max |
| LED3 | XINGLIGHT **XL-5050RGBC-WS2812B** (5050) | **NEW.** WS2812B-compatible 5050 pixel that is **Digikey-orderable** (bare Worldsemi WS2812B is not Western-distributor stocked — it would fail the §8 sourcing bar, the same trap that killed L1.01's bridge). One onboard. | DIN VIH (0.7VDD), VDD range, data timing, decoupling, **DIN abs-max input voltage** (for RK8) |

**Connectors & supporting passives (NEW unless noted):**
- **J4** — TE Connectivity (Buchanan) **282837-3** 3-pos 5.08 mm screw terminal
  (strip out: 5 V / DATA / GND), THT. **NEW** — reused from the TB-1-POWER board
  family (already team-vetted; `282837-2` is its 2-pos sibling).
- **J5** — TE Connectivity (Buchanan) **282837-2** 2-pos 5.08 mm screw terminal
  (5 V injection: 5 V_EXT / GND), THT. **NEW.**
- **C10** — Panasonic **EEU-FR1C102** 1000 µF / 16 V radial electrolytic (strip
  inrush bulk), THT. **NEW.**
- **R7, R8** — 470 Ω 0805 data series resistors — **reuse L1.01 RC0805FR-07470RL.**
- **C8, C9** — 0.1 µF 0805 (shifter + pixel decoupling) — **reuse L1.01
  CL21B104KBCNNNC.**
- All of the **L1.01 core BOM** (U1/U2/D1/F1/J1/J2/J3, C1/C2/C3/C5/C6/C7,
  R1–R6, LED1/LED2, SW1/SW2, TP1/TP2) **carries over unchanged** and already
  exists in the curated parts library.

> **Silkscreen rule (L1 lesson, carried from L1.01):** label every connector pin
> (esp. **J5 polarity + the 5 V_EXT / common-GND marking** — RK9), mark the WS2812
> DIN→DOUT direction + pixel pin-1, mark C10 polarity, and call out 5 V vs 3V3.

## 5 · Power & thermal

- **Rails:**
  - **3.3 V** (RT9080) — ESP32 only; **inherited from L1.01**, unchanged.
  - **VBUS 5 V** — powers the 74AHCT125 and the single onboard pixel only (≤ ~60 mA
    LED + a few mA logic, on top of the LDO input current).
  - **5 V_EXT** (injection terminal) — the **external strip's power**, *sourced* off-board;
    its **ground** is shared with the board, and **its 5 V is routed on board copper
    from J5 → J4** (the strip current does cross the board — an ampacity item below).
- **Budget (corrected, worst-case):** continuous VBUS ≈ 220 mA (well under the 0.5 A
  PTC hold); brief peak ≈ 560 mA (RT9080 is linear, so Iin ≈ Iout = WiFi-TX ~500 mA,
  + 60 mA pixel) — below the 1 A PTC trip, ridden by the 3V3 bulk, the same regime
  L1.01 already accepts (§3, RK4).
- **5 V_EXT ampacity (layout):** the J5 → J4 5 V_EXT and the common-GND return carry
  the **strip's** current (amps for a real strip). The TE 282837 terminals are rated
  ~15 A, so the **board copper** is the limit — size the J5→J4 5 V and GND traces for
  the documented max strip current; keep J5 adjacent to J4 (close in layout, RK7).
- **Thermal:** **not a flagged concern.** The LDO case is unchanged from L1.01
  (≤ ~1 W transient), the 74AHCT125 sources µA into a high-Z CMOS input, and the
  onboard pixel is a single LED → `hasThermalConcern = false`.

## 6 · Risk register

Top risks, each with a de-risk pass. IDs are **`RK#`** (risks ≠ resistor refDes).

| # | Risk | Likelihood × Impact | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **3.3 V→5 V data-level margin** — a bare ESP32 GPIO (3.3 V) is **below** the WS2812 logic-high (0.7·VDD = 3.5 V at 5 V); marginal → flicker/wrong colors/dead chain. | Med × High (core function) | **74AHCT125 (U3):** HCT inputs accept 3.3 V; VOH gives **+0.9 V** (actual µA load) / **+0.44 V** (guaranteed @ 8 mA) over the 3.5 V threshold, and the threshold tracks VDD (§3). | **DE-RISKED** |
| **RK2** | **Strip inrush / power** — WS2812 strips draw far more than USB can supply; turn-on inrush can glitch the first pixel. | Med × High | **Dedicated 5 V injection (J5);** strip power external; **1000 µF bulk (C10)** absorbs inrush; onboard pixel is a single budgeted VBUS load (§3). | **DE-RISKED** |
| **RK3** | **Common-ground omission** — floating/un-shared strip-supply ground breaks the single-ended data reference. | Med × Med | J5 ground **tied common** to board ground; silkscreen + guide call it out; data resistors + bulk on the board side. | **DE-RISKED** |
| **RK4** | **VBUS load vs PTC** — onboard pixel (60 mA) on top of the ESP32 WiFi-TX peak. | Low × Med | Corrected budget (§3): continuous ~220 mA ≪ 0.5 A hold; brief peak ~560 mA < 1 A trip, ridden by bulk (L1.01 regime); firmware brightness cap. | **DE-RISKED** |
| **RK5** | **WS2812 5050 solderability** — the 4-pad 5050's epoxy lens deforms / hidden pads bridge under beginner iron heat (hardest joint on the board). | Med × Med | **Mandatory flux-pen step in the guide** for LED3 (cuts time-at-temperature → saves the lens) + temp-controlled iron ~315 °C / quick dwell + tin-one-pad-first + a close-up. PDIP/THT-pixel fallback noted. | open → close in build/guide |
| **RK6** | **Level-shifter gate handling** — floating CMOS inputs / wrong enable polarity (AHCT125 OE is active-low). | Low × Low | **Gate 1 used: `1OE → GND` (enable).** Gates 2–4 parked: `nOE → VCC` (disable), `nA → GND`. Captured in §2 + schematic. | **DE-RISKED** |
| **RK7** | **Data / 5 V_EXT routing** — long/noisy first-pixel & strip leads (800 kHz data); strip-current trace ampacity. | Low × Med | 470 Ω at each driver (R7, R8); short shifter→pixel→J4 runs; size J5→J4 5 V/GND copper; antenna keep-out. | open → close in layout |
| **RK8** | **Parasitic power / data-before-power** — USB on + injection off: onboard-pixel DOUT drives ~5 V into the *unpowered* strip's DIN → the strip parasitically self-powers through the DIN clamp diode (degrades pixel #1 / drags the data line). **Inevitable in a classroom.** | Med × Med | **R8 (470 Ω)** limits the clamp current to ~9 mA (§3) → benign; **documented power-up order** (strip supply before/with USB) in the guide; silkscreen note. (Exact WS2812 DIN abs-max confirmed in the Pass-5 datasheet audit.) | **DE-RISKED** |
| **RK9** | **Reverse-polarity / mis-wire on J5** — a beginner reverses the bare 5 V_EXT/GND screw-terminal wires → reverse-biases C10 (electrolytic vents) + back-feeds common ground. | Med × Med | **Clear silkscreen polarity mark + keying convention + logged risk** (owner's call for this rev; a series P-FET ideal-diode is the hardware option deferred to a future rev). | **DE-RISKED (process)** — hardware option deferred |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board** (no mains/Li-ion/thermal/stripboard flags → **no
conditional items** — the no-flags base path):

- [ ] **Calc trail recorded** — every derived value (thresholds, margins, timing,
  series R, parasitic current, budgets, decoupling) traces to a source (§3).
- [ ] **Each IC datasheet-verified** — esp. the **74AHCT125 HCT thresholds + VOH +
  tpd** and the **XL-5050RGBC-WS2812B DIN VIH / timing / DIN abs-max** (§4).
- [ ] **Footprint ↔ pinout cross-checked** — 74AHCT125 SOIC-14 (1OE/1A/1Y/VCC/GND),
  WS2812 5050 DIN/DOUT/VDD/GND direction, the TE 282837 screw-terminal pinouts.
- [ ] **Fab-DRU DRC accounted for** — the fab's `.kicad_dru` applied before export.
- [ ] **BOM availability confirmed** — the 5 new parts + reused L1.01 lines, in stock,
  exact `(manufacturer, mpn)` strings (§8).
- [ ] **All top risks de-risked** — every **design-stage** risk in §6 has a completed
  de-risk pass (RK1–RK4, RK6, RK8, RK9 de-risked; RK5/RK7 close at the build/layout
  stage by design).

> Attestations (a human — Josh — checked), not machine proofs — except BOM
> availability (parts MCP) and DRU presence, which are verifiable. The evidence
> behind each tick is in `validation-log.md`.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~**$13–14** BOM — the L1.01 ~$10–12 core + ~$1.50 of new
  parts. (`Project.targetCost` currently null — set at the BOM stage; Friction F3.)
- **New parts to create in the library BEFORE the CSV import** (strict
  `(manufacturer, mpn)` match — unmatched rows are reported, never auto-created; create
  each with the **exact** string the CSV uses):
  1. Texas Instruments **SN74AHCT125D** (level shifter, SOIC-14)
  2. XINGLIGHT **XL-5050RGBC-WS2812B** (onboard pixel, 5050) — *confirm exact mfr/MPN
     string at Digikey when creating*
  3. TE Connectivity **282837-3** (J4, 3-pos screw terminal)
  4. TE Connectivity **282837-2** (J5, 2-pos screw terminal)
  5. Panasonic **EEU-FR1C102** (C10, 1000 µF/16 V radial)
- **Already in the library (reused L1.01 lines):** ESP32-S3-WROOM-1-N16R2, RT9080,
  USBLC6, 1206L050YR, USB4110-GF-A, the Sullins headers, both Würth LEDs, the Yageo
  10 k/5.1 k/470 Ω resistors (470 Ω = R7 + R8 too), the Samsung caps (0.1 µF = C8/C9
  too), B3F-1000 buttons, Keystone test points.
- **Second sources (exercise `altMpn`/`altManufacturer`):** level shifter —
  **SN74AHCT125N** (PDIP-14); pixel — **SK6812** is electrically a drop-in but
  **LCSC-only** (not a Western-distributor second source — noted, not relied on);
  PTC — Bel Fuse `0ZCJ0050FF2G` carries over from L1.01.
- **Stock verification:** the 5 new parts confirmed at Digikey/Newark during the
  sourcing audit (SN74AHCT125D/N, TE 282837-2/-3, EEU-FR1C102 verified; XINGLIGHT
  pixel to confirm exact string). Reused lines were stock-verified for L1.01.
- **BOM frozen:** **not yet.** Freeze (`bomFrozenAt`) is the side-effect of advancing
  the revision past `BOM_SOURCING` into `LAYOUT` — and that is itself **gated on the
  design passing the validation protocol** (`../_protocol.md`).

---

## Friction log (the real deliverable)

Running log of every rough edge hit driving this board through the pipeline. Each
becomes a follow-up issue.

| # | Stage | Friction | Severity | Proposed follow-up |
| --- | --- | --- | --- | --- |
| F1 | Design / flags | The seeded `l1-03-ws2812-node` row had **`requiresStripboard = true`**, contradicting the custom-PCB topology. **Correction (validation Pass 3):** the real consequence isn't a DESIGN_VALIDATION conditional item — `requiresStripboard` materializes a **separate `STRIPBOARD_VALIDATION` checklist + BOM_SOURCING exit-gate coupling** (`canonical-checklist-templates.ts`; DV conditionals are only mains/Li-ion/thermal). Caught only by a DB query; flipped to false. | Med | Audit seeded flags vs intended topology on all project rows; surface the flag set on the project page so a mismatch is visible without SQL. |
| F2 | Design / DB | `Project` has **no `title` column** — the human field is `name` (+ `publicTitle`); a reasonable first query errors. | Low | Document `name` vs `publicTitle` in the playbook's "where things live" map. |
| F3 | Design / parts | `targetCost` is **null** — the WS3 cost advisory has nothing to compare against until set. | Low | Seed `targetCost` with the project row, or prompt for it at the BOM stage when null. |
| F4 | BOM CSV authoring | Import upserts on **`[revisionId, partId]`**, so refDes sharing one part **must merge onto one row** (470 Ω → `R5,R6,R7,R8` qty 4; 0.1 µF → `C2,C3,C7,C8,C9` qty 5). Splitting per-refDes silently upsert-collapses to the last row — wrong BOM, no error. | Med | **FIXED in PR #150** (merged): `parseBomCsv` now reports + excludes intra-file duplicate `(manufacturer, mpn)` rows. |
| F5 | Process / docs | The pipeline-handoff doc this design references (`docs/plans/2026-06-17-second-board-pipeline-handoff.md`) lives only on the PR #149 branch — **absent on main / this branch**, so the reference dangles until #149 merges. | Low | Merge #149, or repoint the reference to `docs/plans/2026-06-16-board-design-process.md` + the WS docs. |
| F6 | Design / consistency | The risk register and reference designators **collided on `R#`** (risk R1 vs resistor R1; acute once R7/R8 resistors + RK7/RK8 risks coexist). | Low | Adopted `RK#` for risk IDs repo-wide; consider baking the convention into `_template/design.md`. |

<!-- Append new rows as the pipeline run continues (parts creation, CSV import,
     freeze, board-readiness, guide authoring). -->
