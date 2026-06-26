# WS2812 Addressable-LED Driver (L1.03) — design doc

> Second board through the lifecycle, and the first driven cleanly from a blank
> page (L1.01 WROOM was retrofitted). Copied from `docs/boards/_template/design.md`;
> voice + depth follow the L1.01 worked example (`docs/boards/l1-01-wroom-breakout/design.md`).
> The point of this board is **pipeline validation** — see the Friction log at the
> bottom, which is the real deliverable.

> ✅ **Design-stage gate MET (2026-06-17).** The **Recursive Board-Design Validation
> Protocol** (`../_protocol.md`) has run **12 passes with a design-stage DRY pass at
> Pass 12** (`validation-log.md` is the evidence). The 8 new parts may now be created,
> the BOM imported, and the revision advanced. **Still owed** (F7 phase-staging, *not*
> blockers to part creation): footprint↔symbol↔pinout `[S]` at schematic, fab-DRU +
> VBUS⟂5V_EXT ERC `[L]` at layout, and the F10-4 DOUT-VOH residual at bring-up. The
> `DESIGN_VALIDATION` ticks remain **Josh's honest human attestations** — the log earns
> them, but he signs them.
>
> ⚠️ **Pass 13 (independent fresh-eyes re-pass, 2026-06-19) RE-OPENED the gate.** Re-reading
> the load-bearing datasheets from primary sources confirmed every electrical *margin* but
> found **1 HIGH sourcing + 4 MED part-truth/sourcing + 2 LOW** (see `validation-log.md`
> Pass 13). Not an electrical redesign — **documentation corrections + one MPN swap**.
> **ALL Pass-13 findings now RESOLVED 2026-06-19:** **(c)** part-truth corrected + folded
> (XINGLIGHT V1 abs-max `−0.5…+5.5 V absolute`, VDD `3.5–7.5 V`, 74AHCT125 tpd `≤10 ns` + SCLS264R,
> RES "≥100 µs" note dropped) — verified direct from the C2843785 PDF; **(a)** U3 →
> **`SN74AHCT125DR`** (library Part + bom.csv); **(b)** D1 → **STMicroelectronics** (shared Part —
> also updated l1-01's BOM + reference BOM.csv; UMW kept as alt). **Pass 14** (math/net) clean;
> **Pass 15** dry sweep confirms the design-stage gate. `[S]`/`[L]` audits (footprint↔pinout,
> fab-DRU/ERC) + the F10-4 DOUT-VOH bring-up residual remain owed at their phases, by design.

| | |
| --- | --- |
| **Slug** | `l1-03-ws2812-node` |
| **Owner** | Josh Tollette |
| **Status** | `draft` (post Passes 1–12 — design-stage DRY, for review, not frozen) |
| **Track / Level** | ACT / L1 |
| **Teaches** | **3.3 V→5 V level shifting** (the primary, graded concept) — with a dedicated 5 V LED rail + common ground as the supporting idea |
| **Validation** | `passes 1–12, Pass 12 DRY` (design-stage) → footprint↔pinout [S] + fab-DRU [L] owed at schematic/layout — see `validation-log.md` |

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
    **4.7 µF VBUS bulk cap (C11)** near the pixel/LDO-input node (PI-2) — sized so the
    *total* VBUS bulk stays under the USB-2.0 10 µF inrush ceiling (F10-1).
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
    (5 V_EXT / GND, common GND); **TVS (D2 SMAJ5.0A) across 5V_EXT**. Recommended
    strip supply is a **regulated 5 V, ≤ 5.25 V** — keeps D2 within its no-conduction
    band (below VBR 6.4 V; ~0.8 mA leakage at the 5.0 V nominal, a little more at the
    5.25 V corner, but no avalanche; F10-3).
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
        VBUS 5V │  [C11 4.7µF bulk]                  │ GPIO5 (non-strapping, non-USB)
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
| WS2812 data logic-high | XINGLIGHT XL-5050RGBC-WS2812B datasheet: **VIH = 0.7 × VDD**, VDD = 5 V | **3.5 V** | bar at the first DIN (DIN/SET, datasheet p.5) |
| Bare 3.3 V GPIO vs threshold | 3.3 V < 3.5 V | **fails (−0.2 V)** | reason for the shifter (RK1) |
| Shifter input acceptance | 74AHCT125 VIH = 2.0 V, VIL = 0.8 V (flat over VCC 4.5–5.5 V) | 3.3 V ✓ | TTL inputs; VBUS sag doesn't move the threshold |
| Shifter VOH (actual µA load) | WS2812 DIN high-Z → VOH ≈ 4.4 V (@ −50 µA) | ~4.4 V | operating point |
| Shifter VOH (guaranteed, **over-temp**) | 74AHCT125 **VOH = 3.8 V min @ −8 mA**, full temp range, VCC 4.5 V | 3.8 V | worst-case (3.94 V is the 25 °C value) |
| **Onboard-hop margin** | actual 4.4 − 3.5 = **+0.9 V**; guaranteed floor **3.8 − 3.5 = +0.30 V** | **≥ +0.30 V** | RK1; VOH & VIH both track VBUS (same node) → robust. +0.30 V is a *conservative floor* (it mis-stacks VOH@VCC 4.5 V against VIH@VDD 5.0 V — same net, can't be both; true single-corner margin ≈ +0.65 V) |
| **Cross-domain hop margin (strip)** | driver = onboard DOUT ≈ V(VBUS,local) − V_DOUT,drop; VBUS,local,min = USB **4.40 V** − PTC/trace IR ≈ **4.2 V**; threshold VIH = 0.7·V(5V_EXT,max **≤5.25 V**) = **3.68 V** | **~+0.2 … +0.5 V (residual)** | PI-1/F10-4: driver (VBUS) & threshold (5V_EXT) on *different* rails — margin does NOT track. **DOUT VOH is NOT specified in the XINGLIGHT datasheet** → the driver drop is an engineering assumption; **residual confirmed at bring-up** (measure DOUT-high + first-DIN). The ≤5.25 V bound buys ≈ +0.18 V vs the old 5.5 V |
| Prop delay vs bit | AHCT125 tpd ≈ 3.6–6.1 ns typ (**≤10 ns max**, CL 50 pF, VCC 5 V, full temp) vs 1.25 µs bit | tpd ≪ bit | negligible skew (**P13-1**: corrected vs TI **SCLS264R** — faster than the old "9–22 ns / ≤30 ns" figure, which was untraceable to this datasheet) |
| **Reset/latch low time** | XINGLIGHT datasheet: RES ≥ **80 µs** (TRST timing table; prose "low-level reset code above 80 µs") | **firmware latch ≥ 300 µs** | P5-3/F8 (**P13-6**: the prior "≥100 µs note b / internally inconsistent" claim is **not in the datasheet** — only 80 µs appears); 300 µs is comfortably conservative (also safe for generic strips) |
| Data series R (shifter→pixel) | WS2812 guidance 300–500 Ω | **470 Ω (R7)** | reuses L1.01 470 Ω part |
| Data series R (DOUT→strip) | guidance + parasitic-current limit | **470 Ω (R8)** | new placement, same part |
| Parasitic clamp current (strip unpowered) | (VOH − Vf)/R8 = (5 − 0.7)/470 | **~9 mA** | RK8 — see honest framing below |
| Onboard-pixel current | 1× WS2812 full white | 60 mA (max) | only LED load on VBUS; firmware-cap |
| VBUS budget — continuous | ESP32 ~160 mA + pixel 60 mA + shifter µA | **~220 mA** | ≪ 0.5 A PTC hold |
| VBUS budget — brief peak | linear LDO Iin≈Iout: WiFi-TX ~500 mA + 60 mA | **~560 mA (brief)** | < 1 A PTC trip; **C11 4.7 µF VBUS bulk + C1 10 µF 3V3 bulk** ride it (RK4) |
| TVS clamp (over-injection) | D2 SMAJ5.0A: VRWM 5.0 V, VC ~9.2 V @ Ipp | clamps >~6 V | RK10 — sacrificial vs sustained 12 V; pair w/ "fuse your supply" |
| Worst-case DATA back-drive current | (V_inject,max − VBUS)/R8, bounded by D2 clamp | bounded | RK11 — D2 caps 5V_EXT, R8 + D3 limit the bridge current into DOUT/1Y |
| Decoupling | shifter 0.1 µF (C8); pixel 0.1 µF (C9); **VBUS bulk 4.7 µF (C11)** | — | TI also suggests 0.1+1 µF; 0.1 alone adequate for one gate |
| **Total VBUS bulk vs USB-2.0 ceiling** | C5 1 µF + C8 0.1 + C9 0.1 + C11 4.7 = **5.9 µF** | **< 10 µF** | F10-1: USB-2.0 limits a device's VBUS bulk to ≤10 µF (inrush); 4.7 µF still rides the 60 mA pixel pulse (ΔV ≈ 16 mV/bit) |
| **D3 ESD-diode RC on the data edge** | R8 × C_D3 = 470 Ω × ~3 pF | **≈ 1.4 ns** | F10-2: ≪ the ~200–300 ns WS2812 high time → edge intact. D3 = **Bourns CDSOD323-T05C ~3 pF** (Pass-16 sub; was Nexperia 45 pF / 21 ns — the sub *improves* SI). SOD-323 same footprint |
| **D2 TVS leakage @ VRWM** | SMAJ5.0A I_R ≈ 800 µA @ 5.0 V (datasheet) | **0.8 mA, budgeted** | F10-3: on the 5V_EXT rail (off-board source); recommended supply ≤5.25 V keeps D2 below VBR 6.4 V (no conduction) |

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
| D1 | STMicroelectronics **USBLC6-2SC6** | Reused — USB ESD (P13-5: STMicro primary/multi-distributor; UMW clone = alt). | (verified in L1.01) |
| U3 | TI **SN74AHCT125DR** (SOIC-14) | NEW. HCT/TTL inputs accept 3.3 V, drive ~5 V; canonical NeoPixel shifter. Pinout: **7=GND, 14=VCC**; gate 1 used. (DR = T&R/active; bare D obsolete — P13-4.) | pinout, VIH/VIL/VOH(over-temp)/tpd, abs-max **(verified Pass 5; tpd Pass 13)** |
| LED3 | XINGLIGHT **XL-5050RGBC-WS2812B** (5050) | NEW. Digikey-orderable WS2812B-compatible pixel. **Datasheet OBTAINED** (LCSC C2843785, rev 2024-ish): pinout **1=VDD / 2=DO / 3=GND / 4=DI**; **VDD 3.5–7.5 V** (P13-2); VIH 0.7·VDD, VIL 0.3·VDD; **logic-input abs-max V1 = −0.5…+5.5 V (absolute)** (P13-3); VOUT(port) 7 V; IOL1 12 mA; ESD 2 kV HBM; RES ≥80 µs. **DOUT VOH NOT specified** (→ F10-4 residual). | ✅ Pass 11; **VDD range + V1 abs-max corrected Pass 13** (read direct from the C2843785 PDF) — exact string `XINGLIGHT` / `XL-5050RGBC-WS2812B` |
| D2 | Littelfuse **SMAJ5.0A** (SMA) | NEW. Uni TVS across 5V_EXT — clamps 12 V over-injection (RK10) + reverse (forward-conducts, protects C10, RK9) + caps the DATA back-feed (RK11). **VRWM 5.0 V / VBR 6.4 V min / VC ~9.2 V**; **I_R ≈ 800 µA @5 V (budgeted, F10-3)**; recommend regulated 5V_EXT ≤5.25 V. | VRWM/VBR/VC, SMA solderable |
| D3 | Bourns **CDSOD323-T05C** (SOD-323) | NEW (Pass-16 DK-stock sub for the backordered Nexperia PESD5V0S1BA, kept as alt). 5 V bidirectional ESD diode on J4.DATA→GND — protects the exposed data pin (RK13) + absorbs coupled transients (RK15). **Low-cap ~3 pF → R8·C ≈ 1.4 ns** ≪ the ~200–300 ns WS2812 high time (SI *better* than the Nexperia's 45 pF). Same SOD-323 footprint (no layout change). **Clamp ~18.3 V@17 A** — higher than the Nexperia's ~14 V@12 A but adequate for *transient* ESD of 5 V CMOS. | VRWM 5 V, C ~3 pF, VC ~18 V; SOD-323 solderable |

**Connectors & supporting passives (NEW unless noted):**
- **J4** TE Connectivity (Buchanan) **282837-3** (3-pos 5.08 mm screw terminal, strip
  out), THT — reused from TB-1-POWER family. **J5** TE **282837-2** (2-pos, injection).
- **C10** Panasonic **EEU-FM1C102** 1000 µF/16 V radial (inrush bulk) — ~Ø10×20 mm
  **tall** (enclosure keep-out, L9-1). *(Pass-16 DK-stock sub for EEU-FR1C102 — same FM/FR
  family, drop-in; original kept as alt.)*
- **C11** **4.7 µF** VBUS bulk — **NEW: Samsung CL21A475KAQNNNE** (0805, 25 V, X5R).
  Dropped from 10 µF (F10-1): C5 1 µF + C8/C9 0.1 µF + C11 4.7 µF = 5.9 µF total VBUS
  bulk, under the USB-2.0 10 µF inrush ceiling. (No longer reuses C1's 10 µF part.)
- **R7, R8** 470 Ω, **C8, C9** 0.1 µF — reuse L1.01 parts (RC0805FR-07470RL,
  CL21B104KBCNNNC). **TP3** data test point (Keystone, or a labeled pad).
- All **L1.01 core BOM** carries over unchanged (already in the library).

> **Silkscreen rule:** label every pin; **J5: "5 V ONLY (regulated, ≤5.25 V) — NOT 12 V/24 V" + polarity**;
> distinguish **"5V (USB)" vs "5V_EXT (strip)"**; WS2812 DIN→DOUT + pin-1; C10/D2
> polarity; mark TP3.

## 5 · Power & thermal

- **Rails:** **3.3 V** (RT9080, ESP32 only, from L1.01); **VBUS 5 V** (shifter +
  onboard pixel; **C11 4.7 µF bulk** added, PI-2/F10-1); **5V_EXT** (external strip,
  *sourced* off-board as a **regulated 5 V, ≤5.25 V**, routed J5→J4 on board copper).
  **VBUS ⟂ 5V_EXT — separate nets, never joined** (E3, §7 ERC check).
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
| RK8 | Parasitic / data-before-power (strip unpowered) | Med × Med | **Documented power-up order (PRIMARY control)** + **R8 limits the steady excursion current (~9 mA)**; D2/D3 are an ESD/transient backstop only — **D3 is OFF at the steady ~4.3 V DOUT-high** (VRWM 5 V) so it does *not* limit the steady parasitic current (F10-5). (P5-1 honest framing; the external strip's DIN abs-max depends on the user's part — bound conservatively, not on our XINGLIGHT's −0.5…+5.5 V abs-max.) | **DE-RISKED** |
| RK9 | Reverse-polarity on J5 | Med × Med | **D2 TVS forward-conducts on reverse → clamps ~−0.7 V, protects C10**; + silk polarity + keying. | **DE-RISKED** |
| RK10 | **12 V/24 V wrong-supply into J5** | Med × High | **D2 TVS (5.0 V)** clamps/crowbars; silk "5 V ONLY"; "fuse your supply" guide rule; recommend regulated 5V_EXT ≤5.25 V (F10-3). (Sustained 12 V = sacrificial D2 → blown supply fuse, not board death.) | **DE-RISKED (sacrificial)** |
| RK11 | **DATA net bridges 5V_EXT→VBUS/AHCT125** (R8 + clamps) | Med × High | **D2 caps 5V_EXT** + **D3 on DATA** + R8 limit; worst-case back-drive bounded (§3); isolation invariant (E3). | **DE-RISKED** |
| RK12 | Stray-strand short across J4 (5V-GND etc.) | Med × High | "Current-limited/fused injection supply" guide rule; silk; (optional rail PTC deferred). Document: no on-rail fault protection. | accept + document |
| RK13 | ESD onto exposed J4.DATA | Med × Med-High | **D3 ESD diode on DATA**. | **DE-RISKED** |
| RK14 | Hot-plug at J4 (ground-last; far-end-powered strip contention) | Med × Med | Guide: power-down before touching J4; strip must not be independently powered; D2/D3 blunt transients. | accept + document |
| RK15 | Long strip lead as antenna/transient injector | Low-Med × Med | D3 + keep R8 near J4; max-lead-length + routing guide note. | **DE-RISKED** |
| RK16 | AHCT125 always-enabled → strip flashes/latches during GPIO5 reset / VBUS brown-out while 5V_EXT up | Med × Med | Firmware blanks early + brightness cap; document GPIO5 reset state; optional 1OE-gating (deferred). | accept + document |
| RK17 | **Protection parts fail / leak** (D2 TVS fail-short → dead, **unindicated** 5V_EXT rail; D3 ESD-diode reverse-leakage on DATA) | Low × Med | D2 fail-short relies on the user's **fused / current-limited** injection supply (RK12) to clear — no onboard fuse; failure is **silent** (no rail LED). D3 I_R is µA at the 4.3 V data-high (off) → negligible on the 470 Ω-driven line. **Document the symptom:** a dead onboard pixel + dark strip *with* 5V_EXT present ⇒ suspect a shorted D2. | accept + document (P10-2) |

## 7 · DESIGN_VALIDATION checklist

Core — **6 items only** (no flags):

- [x] **Calc trail recorded** — every value (margins both hops, timing, reset, parasitic, budgets, TVS clamp, decoupling) traces to a source (§3). *(DB-attested.)*
- [x] **Each IC datasheet-verified** — 74AHCT125 ✓ (Pass 5); RT9080 ✓; **D2 SMAJ5.0A ✓** (Pass 11); **D3 Bourns CDSOD323-T05C ✓** (Pass-16 sub: ~3 pF / SOD-323 / VRWM 5 V / bidir, spec-verified); **LED3 XINGLIGHT ✓ — datasheet obtained** (LCSC C2843785, Pass 11), with the **DOUT-VOH residual** (F10-4) owed to bring-up. *(DB-attested.)*
- [x] **Footprint ↔ pinout cross-checked** — **[S]-VERIFIED Pass 17** (2026-06-21): all 9 new parts assigned KiCad-10 std-lib symbols + footprints, pad-by-pad (padCount=pins; LED3 WS2812 1=VDD/2=DOUT/3=VSS/4=DIN = XINGLIGHT; U3 74AHCT125 7=GND/14=VCC = TI). `[L]`-residuals: D3 generic D_TVS symbol (bidir part, fine); J4/J5 generic CUI 5.08mm footprint (confirm TE body at layout). *(DB-attested 2026-06-25.)*
- [ ] **Fab-DRU DRC accounted for** — incl. an **ERC/DRC check that VBUS and 5V_EXT are never joined** (E3 isolation invariant). **OWED `[L]`** (layout-stage).
- [x] **BOM availability confirmed** — the 9 new parts + reused lines, exact `(mfr, mpn)` strings (§8); all 25 lines Active + DK-in-stock (Pass 16). *(DB-attested.)*
- [x] **All top (design-stage) risks de-risked** — RK1–RK4, RK6, RK8–RK11, RK13, RK15 de-risked; RK5/RK7 at build/layout; RK12/RK14/RK16/RK17 accept+document. *(DB-attested.)*

> Evidence: `validation-log.md`.

## 8 · BOM sourcing & freeze

- **Design-to-cost target:** ~**$14–15**. **Actual ≈ $18–19 — over target** (F10-6; rose ~$1.9
  at the Pass-16 DK-stock subs): L1.01 core (~$12–13) + **~$6 new** (shifter $0.40 + pixel $0.40
  + J4 $2.04 + J5 $1.22 + **1000 µF $1.07** + TVS $0.47 + **ESD $1.13** + 4.7 µF $0.11 + **C1 10 µF $0.16**).
  The two TE terminals (~$3.26) + the DK-in-stock D3/C10 dominate. `targetCost` null (F3). Owner-accept
  the overage or value-engineer (cheaper-but-DK-stocked ESD / electrolytic) at freeze.
- **New parts to create BEFORE import (strict `(mfr, mpn)` match — exact strings):**
  1. Texas Instruments **SN74AHCT125DR** (SOIC-14)
  2. XINGLIGHT **XL-5050RGBC-WS2812B** (5050) — ✅ string confirmed + datasheet obtained
  3. TE Connectivity **282837-3** (J4)
  4. TE Connectivity **282837-2** (J5)
  5. Panasonic **EEU-FM1C102** (C10 — Pass-16 DK-stock sub for EEU-FR1C102)
  6. Littelfuse **SMAJ5.0A** (D2 TVS)
  7. Bourns **CDSOD323-T05C** (D3 ESD — Pass-16 DK-stock sub for PESD5V0S1BA)
  8. Samsung Electro-Mechanics **CL21A475KAQNNNE** (C11 4.7 µF — new per F10-1)
  9. Murata Electronics **GRM21BR61E106KA73L** (C1 10 µF — Pass-16 DK-stock sub; l1-03's C1 now diverges from L1.01's reused Samsung)
- **Already in library (reused):** WROOM core lines incl. 470 Ω (R5–R8), 0.1 µF
  (C2/C3/C7/C8/C9), 1 µF (C5/C6). *(C1 is now the Murata sub above, not the reused Samsung.)*
- **Second sources (alts in bom.csv):** shifter SN74AHCT125N (PDIP-14); pixel SK6812 (LCSC-only);
  **D3 ← Nexperia PESD5V0S1BA**, **C10 ← Panasonic EEU-FR1C102**, **C1 ← Samsung CL21A106KOQNNNE**
  (the originals, Active but DK-OOS on 2026-06-20); TVS/ESD have many drop-ins.
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
| F7 | Protocol | The footprint↔pinout (Pass 6) + fab-DRU audits **can't fully close at the design.md stage** (no KiCad symbols/footprints yet) — they stage to schematic/layout. The flat protocol implies all audits close before "add a part." **Manifested concretely:** the materialized `DESIGN_VALIDATION` checklist has 6 items, but items 3 (footprint↔pinout) and 4 (fab-DRU DRC) are `[S]`/`[L]` by nature → "Design validated" (needs ALL 6) and thus board-readiness "ready" **structurally can't go green at the design stage**, only after schematic/layout. | Med | **Refine `_protocol.md` to phase-stage audits** (design vs schematic vs layout; **PR #152, open**); a design-stage-dry board is "part-ready" with footprint/DRU explicitly owed. Consider letting the operator mark `[S]`/`[L]` DV items `notApplicable` at design stage so the design-stage attestation can complete honestly. (Owner-approved.) |
| F8 | Validation / parts | A BOM part can be a **WS2812-compatible clone** (XINGLIGHT) whose own datasheet isn't readily available — so "each IC datasheet-verified" can't be honestly ticked from the *compatible* part's marketing; numbers get inherited from the reference part by assumption. | Med | **Datasheet OBTAINED Pass 11** (LCSC C2843785) — VDD/VIH/VIL/abs-max/RES/pinout verified *directly*. **P13-3 correction:** Pass 11 misread the logic-input abs-max as "VDD+5.5 V (looser than Worldsemi)"; the datasheet actually specifies a flat **−0.5…+5.5 V absolute** ceiling (V1) — at VDD 5 V that's ~+0.5 V over rail, the **same** headroom as Worldsemi's VDD+0.5 V, *not* looser. (Also P13-2: VDD range is 3.5–7.5 V, not 3.5–5.5 V.) **DOUT VOH is unspecified even in the clone's own datasheet** → the F10-4 cross-domain residual stays owed to bring-up. Lesson holds: require the actual datasheet at part-creation; flag any number it still omits. |
| F9 | Parts / tooling | **Part creation can't be driven through the `createPart` server action headlessly** (`requireAdmin` + `revalidatePath`) — so the agent path for "add the 8 parts" is a **direct-Prisma seed-style script** (`scripts/seed-l103-parts.ts`, idempotent upsert on `(manufacturer, mpn)`). That bypasses the action's category-tree resolution, KiCad-index validation, and legacy-enum dual-write; `createdById` is also required (no system/seed user) so the script borrows an existing part's creator. | Med | The eventual `adding-parts` skill standardizes the seed-script path; **consider extracting a scriptable `createPartCore` that both the action and a CLI wrap** (so the agent gets the action's validation without a browser). |
| F10 | Parts / taxonomy | The **category tree has only 6 leaves — all the migrated legacy `PartCategory` enum tokens** (USB_CONNECTOR, USB_UART_IC, LDO_REGULATOR, RF_MODULE, MLCC_CAPACITOR, PASSIVE_RESISTOR). The second board immediately needs ~5 absent families: **addressable RGB LED, TVS diode, ESD diode, screw-terminal block, aluminum electrolytic, logic buffer/level-shifter.** 7 of the 8 new parts have nowhere to categorize → they land **uncategorized** (only the 4.7 µF MLCC fit). Doesn't block import (category optional) but degrades the public catalog. | Med | **RESOLVED 2026-06-18** (`scripts/extend-category-tree.ts`): added 3 interior nodes (`diodes`, `leds`, `ics/logic`) + 6 leaves (TVS_DIODE, ESD_DIODE, LED_ADDRESSABLE, TERMINAL_BLOCK, ALU_ELECTROLYTIC, LOGIC_BUFFER) and categorized all 8 parts (tree 14→23). Future boards reuse these. |

| F11 | Pipeline / stage gate | **Advancing the second board past REQUIREMENTS is blocked by two real gates.** (a) The REQUIREMENTS exit gate wants a **stage-tagged requirements artifact** — v1 had none (`artifacts: []`); for L1 the REQUIREMENTS_REVIEW checklist is skipped, but the artifact is still required. (b) The **cross-project DAG**: the edge `l1-03@REQUIREMENTS ⟸ l1-01-wroom-breakout@BRINGUP` blocks because l1-01's latest revision is only at **LAYOUT** → *"Depends on l1-01 at BRINGUP; latest revision is at LAYOUT."* So l1-03 cannot leave REQUIREMENTS until l1-01 is brought up (or the edge is relaxed). | Med | **Owner decision:** is "can't even leave REQUIREMENTS until the prereq board hits BRINGUP" intended? For this validation run, either advance l1-01→BRINGUP, relax the edge's `dependsOnStageRequired`, or accept l1-03 parks at REQUIREMENTS (design/parts/BOM/DV are all done regardless — freeze is 2 stages further and needs SCHEMATIC `[S]` + LAYOUT `[L]` anyway). Also: attach a requirements artifact (a note pointing at design.md) to clear gate (a). **SHIPPED PR #153 (merged):** admin `force`-advance makes the gates advisory for authoring. |
| F12 | Sourcing / process | **Manual stock verification was skipped, and DV item #5 ("BOM availability confirmed — in stock") was over-attested.** The run did *orderability* (real Western MPNs at design time, Pass 2) + lifecycle=ACTIVE + strict-match into the library — but never a current, line-by-line stock pass (the actual job of BOM_SOURCING). The `adding-parts` skill's "verify" step also only checks **library strict-match**, NOT distributor stock → it would perpetuate the omission. A proper screen (4 agents, 2026-06-18, `bom-stock-verification.md`) found **real issues** orderability had masked: U3 `D`-tube = DigiKey "no longer mfd" (want `DR`); D1 UMW = house-brand clone, DK-sole-source (spec STMicro); D3 `,115` DK-backorder; LED3 = DigiKey-*Marketplace*-only (not true Western stock). | Med | DV#5 **un-checked** until the manual buy-confirm (`bom-stock-verification.md`). **Fix the `adding-parts` skill** to make a manual stock-verification pass an explicit, not-skippable step before freeze (distinguish *library-match* from *distributor-stock-verified*). |

<!-- Append rows as the run continues (parts creation, import, freeze, guide). -->
