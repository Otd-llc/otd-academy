# Internal-ADC Analog Sensing (L1.05) — design doc

> Board design doc for the **SENSE-track L1** board. Built on the **L1.01
> ESP32-S3-WROOM core** (reused 100%), it adds a minimal **analog front-end** —
> a sweepable input source, an RC anti-alias / sample-and-hold filter, and ESD +
> series protection on the exposed analog node — so a learner can read a real
> analog voltage on the **ESP32-S3 internal SAR ADC** and *see its real-world
> limits* (noise, a usable range narrower than the rail, an aggregate ±50 mV
> accuracy band, and the ADC1-only-with-Wi-Fi rule). Draft → validate (lock the
> math + parts) → source/freeze the BOM → only then author the guide.

> ⛔ **NOT part-ready** until the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`) passes: ≥ 10 recursive audit passes, a `[D]` dry pass, every
> applicable audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION`
> ticks are honest human attestations. **Do not add parts until this passes.**

| | |
| --- | --- |
| **Slug** | `l1-05-internal-adc` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **validated to DRY**, not frozen, parts not yet created) |
| **Track / Level** | SENSE / L1 (critical path) |
| **Teaches** | **The internal ADC and why it isn't enough** — read an analog voltage on the ESP32-S3 SAR ADC, then confront its real limits: a usable range that **clips the top of a 3.3 V signal** (and degrades at the bottom), an aggregate **±50 mV** accuracy band that survives calibration, noise that demands averaging, and the **ADC1-only** rule (ADC2 dies when Wi-Fi is on). Core takeaway: **resolution ≠ accuracy** |
| **Validation** | **`DRY ✓` — 12 passes, design-stage part-ready** (`[S]`/`[L]` audits owed at their stages) — see `validation-log.md` |

**Project flags (decide which audits fire):** `hasMainsNet=false`, `hasLiIon=false`,
`hasThermalConcern=false`, `requiresStripboard=false` (**there are no stripboards in
this curriculum**; matches the live PROD DB — all four flags false). **Up-front
conditional concerns flagged for the physics + FMEA audits:** (a) **ADC measurement
accuracy** — the internal SAR ADC's reference spread, nonlinearity, and limited
usable range, worked worst-case from the Espressif datasheet; (b) **analog-pin
integrity** — ESD / over-voltage / fault current on an exposed, hand-touchable analog
input. No mains/Li-ion/thermal/RF-radiator/stripboard audits apply; the WROOM module
carries the same **antenna keep-out** [L] constraint as L1.01.

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 board that reads one analog voltage on the
  chip's built-in ADC.** It is the **L1.01 WROOM breakout, reused whole** (USB-C
  power + native USB flash/console, RT9080 3V3 LDO, EN/BOOT buttons, indicator
  LEDs, full GPIO breakout), **plus** a small analog front-end: an **on-board
  10 kΩ trimpot** the learner sweeps from 0 → 3.3 V, an **RC anti-alias / S&H
  filter** that conditions the wiper into the ADC pin, and **ESD + series
  protection** on the exposed analog node. The lesson is **not "how to call
  `adc_read()`"** — that is one line — it is **what you get back, and how far it is
  from the truth**: the ESP32-S3 SAR ADC has a per-chip reference that varies
  ±100 mV, an aggregate error band of ±50 mV even after calibration, a usable window
  that **clips the top of a 3.3 V signal**, and noise that forces you to average.
  The board is designed to make those limits *observable* and to bake in the one
  rule that silently breaks beginners' projects: **route the analog signal to an
  ADC1 pin**, because **ADC2 is unusable whenever Wi-Fi is on**.

- **The single coherent takeaway (L1 altitude):** **resolution ≠ accuracy.** 12 bits
  promises 0.8 mV steps; the chip delivers a ±50 mV-class reading on a range that
  doesn't even reach the rail. The internal ADC is a *good knob reader and a poor
  instrument* — which is exactly why the next SENSE board reaches for an external ADC.

- **Functional requirements (testable):**
  - **F1** — Run the full **L1.01 WROOM core** from one USB-C cable (power + native
    USB flash/console). *Inherited verbatim from L1.01 — same parts, same nets.*
  - **F2** — Present a **variable analog source** the learner can sweep across the
    full rail: an on-board **10 kΩ potentiometer** wired across 3V3↔GND, wiper = the
    analog signal (`AIN`).
  - **F3** — **Condition `AIN` into the ADC pin** with an **RC anti-alias / sample-
    and-hold filter** (series R + a 100 nF cap *at the pin*), matching the exact
    input network under which Espressif characterizes the ADC.
  - **F4** — **Record the ADC1-only constraint** and route the conditioned signal to
    an **ADC1 channel** GPIO (and **not** a strapping pin). *Constraint recorded at
    `[D]` (K2/RK1); the final pin is assigned + verified at `[S]` (RK10) — the
    hardware enforcement closes at schematic capture, not at design.*
  - **F5** — **Expose `AIN`** on a labelled header (3V3 / AIN / GND) through a series
    limiter (R8) so the learner can **probe it (high-Z meter/scope)** and optionally
    attach a small **0–3.3 V** sensor — every external connection current-limited.
  - **F6** — **Protect the analog pin**: ESD clamp on the exposed node + series
    resistors that limit any fault/injection current into both the GPIO (R7) and the
    pot/3V3 rail (R8).

- **Electrical / signal budget:**
  - **E1** — Logic rail: USB-C **VBUS 5 V** → RT9080 → **3.3 V** (unchanged from
    L1.01). The 3.3 V rail also feeds the WROOM **analog supply (VDDA)** and is the
    top of the potentiometer — so the pot's full-scale output *is* the rail.
  - **E2** — Analog signal: **0 → 3.3 V** at the pot wiper (DC / slowly varying).
    The ADC's usable, accurate window is **narrower than this** (see §3 K4) — that
    gap is the lesson, not a defect.
  - **E3** — No second rail, no external supply. Pot draws **3.3 V / 10 kΩ ≈
    0.33 mA** continuously from 3V3 — negligible against the RT9080's 600 mA.

- **Interfaces:**
  - **I1** — USB-C (sink, 5.1 kΩ Rd ×2), native USB Serial/JTAG — *L1.01, verbatim.*
  - **I2** — **Analog-in header `J4`**: 1×3 0.1″, order **3V3 / AIN / GND** — a
    high-Z probe point for the wiper, and a current-limited (via R8) entry for a
    small **0–3.3 V** sensor.
  - **I3** — 2× GPIO breakout headers (incl. 5 V/3V3/GND), one of which carries the
    chosen ADC1 GPIO so the conditioned signal is also reachable there — *L1.01.*

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, no stripboard.** All project
    flags **false**. The front-end is passive and dissipates essentially nothing
    (pot ~1 mW, no active analog parts) → `hasThermalConcern=false` holds trivially.
  - **Analog integrity (flagged):** the analog node is exposed and hand-touchable
    (a trimpot screw + a header). It is attacked by the physics + FMEA audits —
    ESD, over-voltage/injection, fault current, source impedance, and reading noise
    (§6 RK4/RK5/RK6/RK9).
  - **Solderability (the L1 envelope, first-class):** no leadless packages; passives
    ≥ 0805; leaded SMD (SOT-23/SOD-323/SOIC) + THT only. Every added part complies:
    the trimpot is **THT** (3362P, 6 mm, top-adjust); the analog filter R/C reuse the
    L1.01 **0805** jellybeans; the ESD diode is **SOD-323** (already proven hand-
    solderable on L1.03). No part harder than L1.01's USB-C connector. **This is the
    least component-dense L1 board after the pilot** — one new THT part.
  - **Antenna keep-out (M1):** inherited from the WROOM core — module on a board
    edge, no copper/parts under the PCB antenna (closes at layout, RK11).
  - **Regulatory:** ESP32-S3-WROOM-1 is a pre-certified module; no board-level
    radiator cert needed (keep-out honored). No mains/battery/HV — out of scope.

## 2 · Topology

The L1.01 core is unchanged. The new **analog front-end** is a single passive signal
path from a sweepable source to one ADC1 pin, with protection on the exposed node.

```
  ── LOGIC RAIL (L1.01 core, unchanged) ───────────────────────────────────
   USB-C(sink) → F1 PTC(0.5A) → D1 USBLC6 ESD → U2 RT9080 LDO → 3V3 → U1 ESP32-S3-WROOM-1
                                                        │   D+/D- → native USB
                                                        │   EN/BOOT buttons, LEDs
                                                        └─ GPIO → J2/J3 headers
                                                              │
  ── ANALOG FRONT-END (new) ─────────────────────────────────│────────────
                                                              │  (ADC1 channel,
        3V3 ──┐                                               │   e.g. GPIO1/ADC1_CH0
              │ RV1 10kΩ pot                                  │   — NOT a strapping pin,
              ▣ (wiper)                                       │   NOT ADC2)
              │                                               │
        GND ──┘     node AIN (internal)     R7 10k   node ADC_IN│
                wiper ───┬───────────────────[ Rs ]──────┬─────┴──► U1 ADC1 pin
                         │  │                            │
              D2 CDSOD323│  │ R8 10k                     │ C8 100nF
              ESD ⤓ (5V, │  └──[ limiter ]──► J4 hdr     │ (at the pin —
              3pF) to GND│                   (3V3/AIN/GND)│  datasheet S&H cond.)
                        GND   high-Z probe +            GND
                              current-limited 0–3.3V in
   ── COMMON GROUND (analog return tied to the ADC reference ground) ──────
```

**Sub-circuits the schematic is organised into:**
1. **(L1.01 core, reused whole)** USB-C input + CC sink, protection (PTC + USBLC6
   ESD), 3V3 power (RT9080 + decoupling), the S3-WROOM-1 module with EN/BOOT
   strap+button RCs, indicators (power + user LED), GPIO breakout + test points.
2. **Analog source** — RV1 10 kΩ trimpot across 3V3↔GND; wiper = node **AIN**.
3. **Analog protection** — D2 CDSOD323-T05C ESD clamp on AIN (exposed node); R8
   (10 kΩ) series limiter from AIN to the J4 probe/inject header (3V3/AIN/GND).
4. **Anti-alias / S&H filter** — R7 (10 kΩ series) from AIN to node **ADC_IN**;
   C8 (100 nF) from ADC_IN to GND, *at the ADC pin*.
5. **ADC input** — ADC_IN → an **ADC1** GPIO of U1 (intended GPIO1/ADC1_CH0;
   final pin assignment + verification is the `[S]`-stage activity, RK7/RK10). The
   locked constraint is **ADC1-only** (§3 K2; recorded on the REQUIREMENTS_REVIEW
   checklist, distinct from the §7 DESIGN_VALIDATION rows).

**Theory of operation:** USB powers and programs the WROOM core exactly as L1.01.
Turning RV1 sweeps **AIN** from 0 V (wiper at GND) to 3.3 V (wiper at 3V3). The
signal passes the ESD-clamped node, through the series R7, into the 100 nF cap that
sits at the ADC pin — the same input network Espressif uses to characterize the ADC
(datasheet §5.5). Firmware configures the chosen **ADC1** channel at 12 dB
attenuation, samples (ideally multi-samples + averages with spacing), and applies the
eFuse calibration. As the learner sweeps the pot they **see** the ADC's truth: near
the top of travel the count **pins flat at 4095** before the pot reaches 3.3 V (the
usable range stops ~200–400 mV short of the rail — a hard, watchable clip); the
mid-range count wobbles by a noise band (until they average); and even after
calibration the reading is trustworthy only to **±50 mV** because the per-chip
reference is unknown to ±100 mV. (Near 0 V the reading is *inaccurate but still
changing* — small nonzero codes, not a flat shelf; that bottom limit is measured and
named, not visually obvious.) Routing the signal to **ADC1** means the demo keeps
working with Wi-Fi on — the failure mode (**ADC2 + Wi-Fi → garbage**) is designed out
at the pin, so the board *prevents* the trap and the guide *teaches* the rule. *That
gap between "what I measured" and "what's true" is the lesson, and it is why the next
SENSE board reaches for an external ADC.*

## 3 · Calc trail (DO — lock the math)

Logic-rail rows (3V3, LDO, CC, EN/BOOT, LED, USB PTC) are **inherited unchanged
from L1.01** (`../l1-01-wroom-breakout/design.md` §3) and not re-derived here. The
analog front-end + ADC budget is derived worst-case below. *(Calc-row IDs are
`K1…K15` — a separate namespace from component refDes like C8/R7/R8/D2.)*

All ADC figures are from the **Espressif ESP32-S3 Series Datasheet v2.2** (§4.2.2.1
SAR ADC; §5 Electrical Characteristics) and the **ESP-IDF ESP32-S3 ADC docs**, taken
at worst case.

| # | Value | Formula / source | Result | Notes (worst case) |
| --- | --- | --- | --- | --- |
| K1 | ADC type / resolution | datasheet §4.2.2.1: "two 12-bit SAR ADCs… 20 channels" | **2× 12-bit SAR, 4096 codes** | One conversion = a 12-bit code 0…4095; the chip has ADC1 + ADC2, 10 channels each |
| K2 | **ADC1-only constraint** | datasheet §4.2.2.1 Note: "ADC2_CH… analog functions **cannot be used with Wi-Fi simultaneously**"; ESP-IDF maps **ADC1 = GPIO1–10**, **ADC2 = GPIO11–20** | **route AIN to an ADC1 pin (GPIO1–10), not GPIO3 (strapping)** | The board's locked REQUIREMENT, recorded on the **REQUIREMENTS_REVIEW** checklist ("ADC1-only constraint recorded") — *distinct from the §7 DESIGN_VALIDATION rows.* Designed-in at the pin so a Wi-Fi-on demo can't silently break (RK1). GPIO3 is ADC1_CH2 **but a floating JTAG strapping pin** (datasheet §3) → excluded. Intended **GPIO1 = ADC1_CH0** (a valid, non-strapping ADC1 channel); final assignment at `[S]` |
| K3 | ADC reference spread | ESP-IDF: Vref **1100 mV nominal**, ranges **1000–1200 mV** chip-to-chip | **±100 mV (±~9%) raw gain error** | The dominant accuracy error and the reason calibration exists; still leaves the K5 residual. The reference is per-die and unknown without the eFuse cal value |
| K4 | Attenuation & usable range | datasheet Tbl 5-6 *effective* ranges (12 dB = **0–2900 mV**) / ESP-IDF *suggested* upper bounds (12 dB ≈ **3100 mV**); accuracy floor ≈ **75 mV** | **top hard-clips ~200–400 mV below the rail; bottom ~75 mV inaccurate (not zero)** | A pot referenced to **3.3 V** drives **above** the ADC's top → the upper **~200–400 mV of travel saturates to 4095** (a hard, visible clip). The bottom **~75 mV is the *accuracy* floor**, not a saturation floor: raw codes there are **small but nonzero and still change** (≈ 98 codes across 0–75 mV) — inaccurate/nonlinear, *not* a flat "reads 0" shelf. Lower attenuations read even less (0 dB tops out at ~0.95 V). **The top clip + the limited window are the visible lesson (RK2)** |
| K5 | Total error after calibration | datasheet Tbl 5-6, "Total error" after HW+SW calibration: 0 dB ±5 mV, 2.5 dB ±6 mV, 6 dB ±10 mV, **12 dB ±50 mV** (on the 0–2900 mV range) | **±50 mV @ 12 dB (≈ ±1.7 % of range, ≈ ±66 LSB)** | The headline "isn't enough" number: **even calibrated**, a 12 dB reading is trustworthy only to ±50 mV. ±66 LSB = 50 mV / (0.76 mV/LSB, K6). Fine for a knob, useless for a precision sensor → motivates the external-ADC board |
| K6 | DNL / INL | datasheet Tbl 5-5: **DNL −4…+4 LSB**, **INL −8…+8 LSB**; 1 LSB ≈ 3100 mV / 4096 ≈ **0.76 mV** | **DNL ±4 LSB, INL ±8 LSB (≈ ±6 mV)** | Code-level nonlinearity. **Swamped** by the ±50 mV (±66 LSB) total error AND by the pot's own mechanical/contact nonlinearity → **not independently observable** by a beginner sweeping a single-turn pot. Named + bounded (it's what multisampling smooths), not a SEE-able headline (RK3) |
| K7 | Anti-alias / S&H cutoff | f_c = 1 / (2π·R7·C8) = 1 / (2π · 10 kΩ · 100 nF) | **f_c ≈ 159 Hz** | First-order LP. Its real jobs: **anti-alias bandlimiting** (vs the 100 kSPS Nyquist, K13) and **shunting RF/>~kHz pickup** via the 100 nF's low HF impedance. It does **NOT** reject 50/60 Hz mains hum (gain ≈ 0.95 at 60 Hz, well below the corner) or the sub-159 Hz shared-VDDA noise — those pass, and are the residual the averaging + teardown lesson addresses (RK4). **C8 = 100 nF at the pin is exactly the datasheet's ADC characterization input network** (§5.5) — *but that characterization is taken Wi-Fi-DISABLED; this board runs Wi-Fi-ON by design (K2), so observed noise is at or above the datasheet figures (K14).* |
| K8 | S&H source stiffness | internal S&H cap **unpublished** (SAR family ~few pF, conservatively ≤ ~25 pF) « **C8 100 nF** reservoir | **charge-share droop ≲ 1 LSB even at 25 pF** | At the sampling instant the S&H grabs charge from C8, not from the 10 kΩ + pot — droop = C_sh/(C_sh+C8) ≈ 0.08 LSB at a few pF, ≲ 1 LSB even at a generous 25 pF. So the *effective* source impedance the converter sees ≈ C8's ESR (sub-Ω). **Pin C_IN is 2 pF (datasheet Tbl 5-4) — that is the pin loading spec, NOT the S&H cap.** R7 only sets how fast C8 re-tracks the wiper (K10); it is **non-critical *for the S&H sample only*** — see K7/K10/K11 where R7's value IS load-bearing |
| K9 | Series-R DC offset | R7 × I_leak = 10 kΩ × **50 nA** (datasheet Tbl 5-4 I_IH/I_IL max) | **≤ 0.5 mV** | DC error from GPIO input leakage across the signal-path R7 (R8 is a stub to J4, not in the ADC path). Negligible vs the ±50 mV ADC total error (K5). Confirms 10 kΩ (reused) is a safe series value |
| K10 | Pot loading + settling | pot 10 kΩ across 3V3 → **0.33 mA** draw; wiper Z_out ≤ R/4 = **2.5 kΩ**; τ = (2.5 k + 10 k)·100 nF = **1.25 ms** | **0.33 mA load; ~8.6 ms to 0.1 % (6.9τ), ~6 ms to ~1 % (5τ)** | Draw negligible vs 600 mA LDO. ~8.6 ms full settle is invisible for a hand-turned pot; if a faster signal were ever needed, drop R7 to ~1 kΩ (f_c→1.6 kHz) — but that **raises the GPIO fault-current limit 10× (K11)**, so it's a tradeoff, not free (RK8) |
| K11 | Pin / pot fault & latch-up margin | external drive at J4 limited by **R8 10 kΩ** to ≤ V/10 k; into the GPIO via R7; D2 clamps AIN; latch-up trigger **±200 mA** (datasheet §5.8) | **J4 fault ≤ ~0.5 mA (5 V); GPIO ≤ ~1.5 mA worst (D2-clamped) « 200 mA** | R8 limits ANY drive/short at the exposed J4 to ≤ V_inj/10 kΩ (≈ 0.5 mA at 5 V) → protects the pot wiper, bounds 3V3 back-feed, all far below ratings (K15). Worst GPIO injection (AIN at D2 clamp ≈ 18 V, through R7): (18 − 3.6)/10 kΩ ≈ **1.5 mA**, ~130× below the 200 mA latch-up trigger. The pot itself can only output 0–3.3 V, so over-voltage requires deliberate external injection at J4 — now R8-bounded (RK9) |
| K12 | Analog-node ESD clamp | D2 **CDSOD323-T05C**: V_RWM 5 V, **V_BR(min) 6.0 V @1 mA**, **V_C 9.8 V @1 A / 18.3 V @17 A**, **I_leak ≤ 5 µA @5 V**, **C ≈ 3 pF** (datasheet); chip rated **HBM ±2 kV / CDM ±1 kV** (datasheet §5.8) | **shunts bulk ESD at the node; idles off through 3.3 V; ≤ ~12 mV worst-case skew** | V_RWM 5 V and V_BR(min) 6.0 V both **above** the 3.3 V signal max (>2.7 V margin) → **off in normal use**. Leakage is **≤ 5 µA at the 5 V spec point** (not literally zero); sunk through the ≤ 2.5 kΩ wiper that is **≤ ~12 mV worst-case skew, and far less at 3.3 V** — ≪ the ±50 mV K5 error. **D2 clamps at 9.8–18.3 V — *above* the 3.6 V GPIO abs-max — so D2 shunts the bulk ESD/surge energy to GND at the exposed node; it is R7 (+R8) that hold the residual current into the GPIO below latch-up (K11), not D2's clamp level.** 3 pF « C8 → shifts f_c by ~0.005 %, negligible. *Reused from L1.03* |
| K13 | Sample rate vs front-end | datasheet Tbl 5-5: **≤ 100 kSPS**; front-end BW 159 Hz (K7) | **159 Hz « 50 kHz Nyquist** | The RC filter is far inside the converter's Nyquist, so the band of interest is alias-free and the converter is never the bandwidth bottleneck |
| K14 | Noise mitigation (the lesson) | datasheet Tbl 5-5 footnote: "sample multiple times and apply a filter, or calculate the average"; + K7 RC + K3/K5 calibration | **RC filter + (spaced) multisample/average + eFuse cal — ±50 mV floor remains** | The three honest mitigations the guide teaches. **Caveat:** effective averaging needs samples **spaced beyond the RC time constant (≫ 1 ms)** to decorrelate — a fast back-to-back burst mostly cuts HF noise, not the low-frequency/shared-VDDA noise that dominates here. And the datasheet noise/DNL figures assume **Wi-Fi disabled**; this board runs Wi-Fi on, so observed noise ≥ those figures. Even with RC + spaced averaging + cal, the **±50 mV (K5)** systematic floor remains → "the built-in ADC isn't enough" |
| K15 | J4 access limiter (R8) | R8 = 10 kΩ between node AIN and the J4 header pin | **≤ V_inj/10 kΩ on any J4 fault; high-Z probe reads AIN with no drop** | R8 makes the exposed J4 safe: any short or external drive at J4 is current-limited to ≤ V_inj/10 kΩ (≈ 0.5 mA at 5 V, ≈ 0.33 mA on a rail short) → the pot wiper sees ≪ its rating, 3V3 back-feed is bounded to sub-mA, and the GPIO is doubly protected (R8 + R7). A high-Z meter/scope on J4 reads AIN with negligible drop (10 kΩ into ≥ 1 MΩ ≤ 1 %). This **re-enables a safe 0–3.3 V BYO-sensor entry** and removes the pot-overstress/back-feed failure mode (RK9). The raw AIN node is internal (wiper + D2 + R7/R8 pads), reachable from outside only through R8 |

**The accuracy argument (the core teaching numbers), worst-case:**
- **What you'd hope:** 12-bit over 0–3.3 V ⇒ 0.8 mV resolution, so "millivolt-accurate."
- **What you get (worst case):** the reference is unknown to **±100 mV** (K3); after the
  chip's HW+SW calibration the 12 dB reading is still good only to **±50 mV** (K5,
  ≈ ±66 codes); the converter's own ±8 LSB INL / ±4 LSB DNL (K6) is *swamped* by that
  band; the reading is noisy until you **average with spacing** (K14); and the usable
  window **doesn't reach the rail** — the top **~200–400 mV of a 3.3 V pot clips to
  4095** (K4). **Resolution ≠ accuracy.** The internal ADC is a *good knob reader and a
  poor instrument* — exactly the gap that justifies an external precision ADC on the
  next SENSE board.
- **The one rule that bites silently:** put the signal on **ADC1** (K2). On ADC2 the
  read returns garbage the moment Wi-Fi starts — a bug with no compile error and no
  smoke, which is why the board wires the input to an ADC1 pin in hardware (so the
  board *prevents* it and the guide *teaches* it).

## 4 · IC / active-part selection (DO — lock the parts)

Core actives (U1 ESP32-S3-WROOM-1-N16R2, U2 RT9080-33GJ5, D1 USBLC6-2SC6, J1
USB4110-GF-A, F1 1206L050YR) are **inherited unchanged from L1.01** and already
datasheet-verified in that board's run. The "active" part of this board is the
WROOM's **internal ADC**, characterized above (§3, datasheet §4.2.2.1/§5). New /
front-end parts:

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| RV1 | **Bourns 3362P-1-103LF** (10 kΩ ±10 %, single-turn, top-adjust, 6 mm THT cermet trimpot, 0.5 W) | The sweepable analog source. Single-turn (**240° electrical / 270° mechanical**) so a learner can sweep 0 → 3.3 V in one motion and *watch the top clip + the noise band* (multi-turn would bury it in 25 turns). 10 kΩ = light 0.33 mA rail load (K10). **±10 % tolerance is irrelevant** — a pot is a ratiometric divider (output = wiper-fraction × 3V3, independent of absolute resistance). Worst-case dissipation 3.3²/10 kΩ ≈ **1.1 mW ≪ 0.5 W**. THT, industry-standard, hand-solderable. **The one NEW part.** | resistance/taper (10 kΩ linear), power (0.5 W), turns/angle, mechanical (THT 6 mm), wiper = terminal 2 |
| D2 | **Bourns CDSOD323-T05C** (SOD-323 single-line bidirectional ESD) | Analog-node ESD clamp. **V_RWM 5 V, V_BR(min) 6.0 V** so it idles off through the full 3.3 V signal (>2.7 V margin; leakage ≤ 5 µA at the 5 V spec point → ≤ ~12 mV worst-case skew, ≪ ±50 mV, K12); **~3 pF** so it doesn't load the node; SOD-323, hand-solderable. **Shunts bulk ESD to GND at the exposed node** (it clamps at 9.8–18.3 V, *above* the GPIO abs-max — GPIO protection comes from R7/R8, not D2's clamp). **Reused from L1.03.** | V_RWM 5 V, V_BR 6.0 V, V_C 9.8/18.3 V, I_leak 5 µA, C ~3 pF, bidirectional, package |

**Supporting passives & connectors (analog front-end), all reused from L1.01/03:**
- **R7 = Yageo RC0805FR-0710KL** — 10 kΩ 0805, the anti-alias series R (K7–K9).
  *Same MPN as R1/R2 (EN/GPIO0 pull-ups).*
- **R8 = Yageo RC0805FR-0710KL** — 10 kΩ 0805, the J4 access limiter (K15). *Same
  MPN as R1/R2/R7.*
- **C8 = Samsung Electro-Mechanics CL21B104KBCNNNC** — 100 nF 0805, the at-pin S&H
  cap (K7, datasheet §5.5 condition). *Same MPN as C2/C3/C7.*
- **J4 = Sullins PRPC040SAAN-RC** — breakaway 0.1″ header, snapped to **1×3** (3V3/
  AIN/GND probe + current-limited inject). *Same MPN as J2/J3.*

> **Silkscreen rule (part of the lesson):** label J4 pin order **3V3 / AIN / GND**
> and mark it **"0–3.3 V only"**; mark D2 with a pin-1 dot (it is symmetric/bidirec-
> tional — orientation doesn't matter electrically, a dot not a polarity band);
> silk the chosen **ADC1** GPIO at the breakout and a "**ADC1 only — ADC2 dies with
> Wi-Fi**" note near the input. The ADC1-only rule is the headline user trap (RK1).

## 5 · Power & thermal

- **Rails:** single **3.3 V** rail from RT9080 (USB-5 V in) — L1.01, unchanged. It
  powers the WROOM (incl. its **analog supply VDDA**, which sets the ADC reference
  domain) and is the **top of RV1**, so the pot's full-scale equals the rail (E1/E2).
  VBUS 5 V still passes (PTC+ESD) to the GPIO headers for *peripheral power* only,
  never into a GPIO (L1.01 rule).
- **Analog "budget":** the front-end is passive. RV1 dissipates worst-case
  **3.3 V² / 10 kΩ ≈ 1.1 mW**; R7/R8 carry ≤ ~0.5 mA → ≤ µW each; D2/C8 ≈ 0.
  Nothing to heatsink.
- **Thermal:** **not a flagged concern.** No active analog parts, no dissipators
  beyond the L1.01 LDO (unchanged, ~1 W transient worst case per L1.01 §5). No
  heatsink/pour design required → `hasThermalConcern=false`.
- **A note on the reference, recorded for pedagogy:** the ADC reference rides the
  3.3 V analog supply (VDDA = the LDO rail, shared with the digital + RF load). This
  board does **not** add a separate clean analog supply or external reference — that
  is an L2+ topic. The shared-rail noise (sub-159 Hz, so it passes the RC, K7) is part
  of *why* the internal ADC is noisy, and the guide names it as a reason an external
  ADC (with its own reference) wins.

## 6 · Risk register

| # | Risk | L × I | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **Analog signal on ADC2 → garbage when Wi-Fi is on** — the headline trap this board teaches: ADC2 is shared with the Wi-Fi radio and reads fail/return noise once Wi-Fi starts (datasheet §4.2.2.1 Note). A beginner picks any "ADC pin" and the demo works on the bench, then dies the moment it joins Wi-Fi. | High × High | **Route AIN to an ADC1 pin in hardware** (intended GPIO1/ADC1_CH0 — an ADC1 channel, **not** ADC2, **not** strapping GPIO3). The board **prevents** the failure; the guide **teaches** the rule narratively (TOLD, not experienced "the hard way", since it's designed out). Constraint recorded on REQUIREMENTS_REVIEW; silk + guide call it out (K2). | **DE-RISKED** (by topology — final pin verified at `[S]`) |
| **RK2** | **Usable range clips the rail** — a 3.3 V-referenced pot exceeds the ADC's top (≈ 2.9–3.1 V at 12 dB), so the top ~200–400 mV of travel reads 4095 (K4). A learner who expects 0–3.3 V → 0–4095 is surprised. | Med × Med | **This is the intended, *visible* lesson.** Pot kept across the full rail so the top clip is watchable; the guide explains the effective range per attenuation. (The bottom ~75 mV is an *accuracy* droop — small nonzero codes, **not** a flat shelf — so it's named/measured, not presented as a second visible clip.) | **DE-RISKED** (by design / documented) |
| **RK3** | **Per-chip error + nonlinearity** — even calibrated, a 12 dB reading is good only to ±50 mV (K5), with the reference unknown to ±100 mV (K3); ±8 LSB INL / ±4 LSB DNL (K6) sits *inside* that band. | Med × Med | **The core teaching point.** The learner SEES the **aggregate ±50 mV (~±66 count) band** + the top clip + the noise + averaging tightening it. INL/DNL is named + bounded but **sub-dominant/not independently observable** (swamped by the error band + the pot's own mechanical nonlinearity). Residual ±50 mV is *named as the reason to move to an external ADC*. | **DE-RISKED** (by design / documented) |
| **RK4** | **Noisy reading** — SAR + shared analog-supply noise makes a raw single-shot read jitter several LSB. | Med × Med | **RC filter** (R7+C8, f_c 159 Hz, K7) **bandlimits/anti-aliases + shunts RF** + **100 nF at the pin** (datasheet §5.5) + **spaced multisample & average** (K14). Honest scope: the RC does **not** remove 50/60 Hz or sub-159 Hz shared-supply noise — those + the ±50 mV floor are the residual the averaging/teardown lesson addresses. | **DE-RISKED** |
| **RK5** | **ESD / over-voltage on the exposed analog node** — the trimpot screw + J4 are hand-touchable; a learner could zap the node or attach a >3.3 V source. | Low × Med | **D2 shunts bulk ESD** to GND at the node (clamps 9.8–18.3 V; the chip itself is HBM ±2 kV). **R8 + R7 current-limit** any DC over-voltage: D2 does **not** clamp in the 3.6–5 V band (it's ESD-only there), but R8 (J4) + R7 (GPIO) hold the current to sub-mA so the GPIO's own internal clamp survives (K11/K12). **Silk: "J4 0–3.3 V only."** | **DE-RISKED** (D2 = ESD; R7/R8 = over-voltage current limit) |
| **RK6** | **GPIO latch-up from current injection** at the analog pin. | Low × Med | **R7 (+R8)** hold injected current to ≤ ~1.5 mA worst case — **~130× below** the ±200 mA latch-up trigger (datasheet §5.8, K11). | **DE-RISKED** |
| **RK7** | **Strapping-pin misuse** — GPIO3 is ADC1_CH2 but a **floating JTAG strapping pin with no internal pull** (datasheet §3); using it for the analog input risks boot/JTAG mode issues. | Low × Med | **Design rule: AIN → a clean ADC1 GPIO (GPIO1/2/4–10), never GPIO3.** Intended GPIO1 (ADC1_CH0). Captured for `[S]` pin assignment (RK10). | **DE-RISKED** (design rule; verified at `[S]`) |
| **RK8** | **Source impedance vs the S&H** — a high source impedance can leave the S&H cap under-charged and skew the reading. | Low × Low | **C8 100 nF at the pin** gives the S&H a stiff local reservoir (droop ≲ 1 LSB even at a generous 25 pF S&H cap, K8), so R7 + pot impedance don't matter for a slow read. **R7's value is non-critical *only for the S&H sample*** — it still co-sets f_c (K7), settle time (K10) and the GPIO fault limit (K11), so the 1 kΩ tradeoff (K10) costs 10× fault current (still safe). | **DE-RISKED** (accepted w/ tradeoff) |
| **RK9** | **External source / short at J4 contends with the pot + back-feeds 3V3** — J4 sits on the analog node; a probe-slip short to a rail, or a learner wiring an external source, would (without protection) drive 100s of mA through the trimpot wiper and push current back into the 3V3 rail. | Low × Med | **R8 (10 kΩ) between AIN and J4** current-limits ANY J4 fault/drive to ≤ V/10 kΩ (≈ 0.5 mA at 5 V, ≈ 0.33 mA on a rail short, K15) → pot wiper ≪ its rating, 3V3 back-feed bounded to sub-mA, GPIO doubly limited (R8+R7). The raw AIN node is internal (only reachable through R8). Silk "J4 0–3.3 V only." | **DE-RISKED** (by R8 + silk) |
| **RK10** | **Footprint ↔ pinout** for the new parts (RV1 3362P 3-lead trimpot — terminal 2 = wiper, D2 SOD-323, R8 0805, J4 1×3) not yet pad-verified; and the **final ADC1 pin** not yet assigned. | Low × Med | Captured at `[D]` (intended pinout/pin below); **verified at `[S]`** once KiCad symbols/footprints are chosen and the schematic is drawn (cannot close pre-schematic). | open → close at **[S]** |
| **RK11** | **WROOM antenna keep-out** (inherited from the core). | Low × High | Module on a board edge, no copper/parts under the PCB antenna (Espressif integration rules). | open → close at **[L]** |
| **RK12** | **Analog routing / ground + trimpot access** — the AIN trace can pick up digital/RF crosstalk, and the analog return must reference the ADC's ground cleanly, or the noise lesson turns into a layout artifact. | Med × Med | **[L] layout:** keep AIN short and away from the USB D± pair, the WROOM antenna, and high-d/dt digital nets; place C8 right at the ADC pin; tie the analog return to the module ground near the pin (single low-Z reference). Also leave a small **screwdriver-access keep-out** around the RV1 top-adjust screw. Captured for layout. | open → close at **[L]** |

**Intended pinout / polarity captured for the `[S]` audit:** RV1 3362P — **terminal 2
= wiper → AIN**, terminals 1/3 = element ends → 3V3 / GND (either end may tie to 3V3
so long as the schematic + silk agree; CW/CCW only flips sweep direction); D2
CDSOD323-T05C — single-line bidirectional ESD across AIN↔GND (no electrical polarity;
silk a pin-1 dot for consistent assembly); R8 — in-line between AIN and the J4 AIN
pin; J4 1×3 — pin1 3V3, pin2 AIN(via R8), pin3 GND; **AIN → ADC_IN via R7; C8 from
ADC_IN to GND; ADC_IN → an ADC1 GPIO (intended GPIO1 = ADC1_CH0).**

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board** (no mains/Li-ion/thermal/stripboard flags, so
**no conditional rows fire**). *(Note: the "ADC1-only constraint recorded" item is a
**REQUIREMENTS_REVIEW** item, not one of these DESIGN_VALIDATION rows — see K2.)*

- [ ] **Calc trail recorded** — every ADC + front-end value worst-case-sourced from
  the ESP32-S3 datasheet/ESP-IDF (§3); logic-rail values inherited from L1.01.
- [ ] **Each IC datasheet-verified** — the WROOM internal ADC characterized
  (§3/§4 against datasheet §4.2.2.1 + §5); RV1 + D2 against their own datasheets;
  core actives inherited from L1.01.
- [ ] **Footprint ↔ pinout cross-checked** — RV1/D2/R8/J4 pad maps + the chosen ADC1
  pin match the datasheet (**[S]** — verified at schematic capture; intended pinout
  captured in §6).
- [ ] **Fab-DRU DRC accounted for** — fab design rules (`.kicad_dru`) applied before
  gerber export (**[L]**).
- [ ] **BOM availability confirmed** — every part in stock, not EOL/NRND, exact
  import strings (§8 — live DigiKey screened).
- [ ] **All top risks de-risked** — §6: RK1–RK9 de-risked/accepted by design; RK10
  closes at schematic [S], RK11/RK12 at layout [L].

> Attestations (a human checked), except BOM availability (DigiKey/MCP) and DRU
> presence, which are verifiable. **ADC accuracy/nonlinearity + analog-pin
> integrity** are covered by the math (audit 3), physics (audit 4) + FMEA (audit 8)
> passes, not a separate flag.

> **Pedagogy framing (guide-authoring decision, recorded):** this is a deliberately
> *minimal* L1 board — one new part, a five-part passive front-end — because the
> teaching load is conceptual, not constructional. **Tier the concepts:** the ONE L1
> takeaway is **"resolution ≠ accuracy."** The L1 *must-land* set is: the **top clip**
> (visible), the **±50 mV error band** (measured), **averaging** tightening the noise,
> and the **ADC1-only** rule. **Demote to optional/teardown asides** (the guide does
> not test these): Nyquist (K13), S&H stiffness (K8), anti-alias theory (K7), INL/DNL
> (K6) — they explain *why the passive values are what they are*, at L2-instrumentation
> altitude. The guide's arc: (1) sweep the pot, watch counts; (2) hit the top clip;
> (3) average + calibrate, and find you're *still* ±50 mV; (4) be told the ADC1-only
> rule (the board already protects you from it). The board's payoff is the
> **motivation for the external-ADC SENSE board.** *(SENSE-track ordering should give
> the learner "attenuation" + "LSB" before this board — confirm when L1.02–04 guides
> exist.)*

## 8 · BOM sourcing & freeze

**Live DigiKey screen — 2026-06-26 (all Active):** the one NEW line is RV1; the rest
reuse the live catalog byte-for-byte.

| Ref(s) | MPN | Mfr | Pkg | Stock | Unit | Source |
| --- | --- | --- | --- | ---: | ---: | --- |
| RV1 | 3362P-1-103LF | Bourns | THT 6 mm trimpot | 2,996 | $0.96 | **NEW** |
| D2 | CDSOD323-T05C | Bourns | SOD-323 | 3,394 | $1.13 | reuse (L1.03) |
| R7, R8 | RC0805FR-0710KL | Yageo | 0805 | 3,957,288 | $0.10 | reuse (L1.01 — same as R1/R2) |
| C8 | CL21B104KBCNNNC | Samsung Electro-Mechanics | 0805 | 8,530,178 | $0.10 | reuse (L1.01 — same as C2/C3/C7) |
| J4 | PRPC040SAAN-RC | Sullins Connector Solutions | THT 1×3 | 68,482 | $1.23 | reuse (L1.01 — same as J2/J3) |

Core spot-checks (2026-06-26, Active): U1 ESP32-S3-WROOM-1-N16R2 8,589 stock $6.32;
U2 RT9080-33GJ5 98,947 $0.28; J1 USB4110-GF-A 138,022 $1.27. Remaining core lines
(D1/F1 + L1.01 passives/LEDs/buttons/headers/TPs) reuse L1.01's already-sourced,
in-stock lines. All lines live-screened 2026-06-26 (`validation-log.md` Pass 3).

> **Import-string note:** DigiKey displays the trimpot vendor as "Bourns Inc.", but
> the curated catalog stores the existing Bourns part (CDSOD323-T05C) under
> manufacturer **`Bourns`** — so RV1 is created and imported as **`Bourns` /
> `3362P-1-103LF`** to match the catalog convention byte-for-byte (the strict
> `(manufacturer, mpn)` BOM-import key).

- **Design-to-cost target:** ~**$12** BOM (L1.01 core ~$11 + analog front-end
  ~**$1.0** — RV1 ~$0.96 is the only added line; R7/R8/C8/D2/J4 reuse parts already
  in the ~$11 core). **1 new line item** (RV1 trimpot).
- **Second sources:** RV1 — any 10 kΩ single-turn 6 mm THT cermet trimpot (Bourns
  3362P family is multi-sourced; e.g. 3386P / Vishay T7/TS53 equivalents). D2 ESD —
  per L1.03 (Nexperia PESD5V0S1BA is a higher-cap alt; Littelfuse SP-series). Core
  second sources per L1.01. R7/R8/C8/J4 are commodity jellybeans.
- **Stock verification:** the new line (RV1) + critical reused lines live-screened at
  DigiKey 2026-06-26 (above). Commodity 0805 R/C are low-risk.
- **BOM frozen:** **not yet.** Freeze (`bomFrozenAt`) is held until after the design
  passes validation **and** the owner authorizes advancing into LAYOUT (RK11/RK12
  [L], RK10 [S] close at their stages). `bomFrozenAt` stays **null**.
