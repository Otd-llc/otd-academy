# Single-Servo Driver (L1.04) — design doc

> Board design doc for the **ACT-track L1** board. Built on the **L1.01
> ESP32-S3-WROOM core** (reused 100%), it adds a single-servo drive subsystem:
> a PWM signal path, an **independent servo power rail**, and the protection
> that an inductive, current-hungry actuator demands. Draft → validate (lock the
> math + parts) → source/freeze the BOM → only then author the guide.

> ⛔ **NOT part-ready** until the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`) passes: ≥ 10 recursive audit passes, a `[D]` dry pass, every
> applicable audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION`
> ticks are honest human attestations. **Do not add parts until this passes.**

| | |
| --- | --- |
| **Slug** | `l1-04-single-servo` |
| **Owner** | Josh Tollette |
| **Status** | `draft` → `validated` → `bom-frozen` (currently: **validated to DRY**, not frozen, parts not yet created) |
| **Track / Level** | ACT / L1 |
| **Teaches** | **PWM servo drive + brownout-on-stall mitigation** — a stalling servo browns out your MCU unless its current never touches the logic rail (separate supply rail + bulk cap + wide power traces) |
| **Validation** | **`DRY ✓` — 10 passes, design-stage part-ready** (`[S]`/`[L]` audits owed at their stages) — see `validation-log.md` |

**Project flags (decide which audits fire):** `hasMainsNet=false`, `hasLiIon=false`,
`hasThermalConcern=false`, `requiresStripboard=false` (corrected in PROD 2026-06-25;
**there are no stripboards in this curriculum**). **Up-front conditional concerns
flagged for the physics + FMEA audits:** (a) **inductive / back-EMF transients** from
the servo motor on the servo V+ rail; (b) **peak / stall servo current** and its
brownout coupling into the logic rail. No mains/Li-ion/RF-radiator/stripboard audits
apply; the WROOM module carries the same **antenna keep-out** [L] constraint as L1.01.

---

## 1 · ORIENT — what & why

- **What it is:** A **USB-C ESP32-S3 board that drives one hobby servo over PWM.**
  It is the **L1.01 WROOM breakout, reused whole** (USB-C power+native-USB, RT9080
  3V3 LDO, EN/BOOT buttons, indicator LEDs, full GPIO breakout), **plus** a
  single-servo subsystem. The lesson here is **not the signal** — generating a
  50 Hz PWM is trivial — it is **power**: a hobby servo stalls at many times its
  idle current, and if that current is drawn through the same rail that feeds the
  microcontroller, the rail sags and the MCU **browns out and resets mid-move**.
  The board is designed around that failure: the servo runs on its **own supply
  rail**, buffered by a **bulk capacitor**, fed by **wide, short power traces**,
  sharing only **ground** with the logic.

- **Functional requirements (testable):**
  - **F1** — Run the full **L1.01 WROOM core** from one USB-C cable (power + native
    USB flash/console). *Inherited verbatim from L1.01 — same parts, same nets.*
  - **F2** — Generate a **servo PWM signal** (50 Hz, ~1.0–2.0 ms pulse) on a free
    GPIO and present it on a standard **3-pin servo header** (GND / V+ / SIG).
  - **F3** — Power the servo from a **separate supply rail** — an external 4.5–5.5 V
    input on a screw terminal — that **shares only GND** with the 3V3 logic, so
    servo current (including stall) **never** flows through the USB/LDO/3V3 path.
  - **F4** — **Buffer the servo rail** with a bulk capacitor sized to hold the rail
    through the fast motor current transients (inrush + PWM-rate pulses).
  - **F5** — **Protect the servo rail**: reverse-polarity (the screw terminal will
    be mis-wired), resettable overcurrent (short / hard fault), and an inductive
    back-EMF / transient clamp.
  - **F6** — **Protect the GPIO** driving the servo signal (series resistor limits
    fault current if SIG is shorted to V+).

- **Electrical / power budget:**
  - **E1** — Logic rail: USB-C **VBUS 5 V** → RT9080 → **3.3 V** (unchanged from
    L1.01). ESP32-S3: typ 80–160 mA, WiFi-TX peak ~500 mA (brief).
  - **E2** — Servo rail: external **5.0 V nominal (4.5–5.5 V)** for a **micro servo
    up to the MG90S/metal-gear class** (SG90 plastic-gear is the easy case). Idle
    ~6–10 mA; no-load running ~100–200 mA; **stall ~0.9 A worst case** (MG90S spec
    750 mA ±10% @ 4.8 V, scaled to the 5.5 V rail max — *not* the SG90 low end);
    momentary start inrush up to ~1.3 A. **Larger standard servos** (e.g. MG996R,
    ~2.5 A stall) are **out of this board's protection rating** — documented limit.
  - **E3** — The two rails are **galvanically common at GND only**. There is **no**
    DC path from the servo rail into VBUS or 3V3.

- **Interfaces:**
  - **I1** — USB-C (sink, 5.1 kΩ Rd ×2), native USB Serial/JTAG — *L1.01, verbatim.*
  - **I2** — **Servo power input**: 2-pin 5.08 mm screw terminal (external 5 V).
  - **I3** — **Servo connector**: 1×3 0.1″ header, order **GND / V+ / SIG** (V+ in
    the middle — the standard safe order so a flipped plug doesn't put V+ on SIG).
  - **I4** — 2× GPIO breakout headers (incl. 5 V/3V3/GND) — *L1.01, verbatim.*

- **Constraints / DFM / safety flags:**
  - **No mains, no Li-ion, no notable thermal concern, no stripboard.** All project
    flags **false**. The dissipative additions are tiny (PTC ~0.089 W at stall,
    Schottky non-conducting in normal use; worst single-fault case ~0.75 W in the
    Schottky, within its rating — §5) → `hasThermalConcern=false` holds.
  - **Inductive load (flagged):** the servo contains a DC motor + its own driver;
    commutation and stall-release produce **back-EMF transients on the servo V+
    rail**. These are clamped (TVS) and absorbed (bulk cap), and attacked by the
    physics + FMEA audits — see §6 RK3.
  - **Solderability (the L1 envelope, first-class):** no leadless packages; passives
    ≥ 0805; leaded SMD (SOT-23/SMA/SMC/SOIC/1812) + THT only. Every added part
    complies: screw terminal + servo header + bulk electrolytic are **THT**; PTC is
    **1812 SMD**; the TVS is **SMA**; the Schottky is **SMC/DO-214AB** (larger than
    SMA — *easier* to hand-solder, and the bigger body better dissipates the
    reverse-polarity fault surge). No part harder than L1.01's USB-C connector.
  - **Antenna keep-out (M1):** inherited from the WROOM core — module on a board
    edge, no copper/parts under the PCB antenna (closes at layout, RK9).
  - **Regulatory:** ESP32-S3-WROOM-1 is a pre-certified module; no board-level
    radiator cert needed (keep-out honored). No mains/battery/HV — out of scope.

## 2 · Topology

The L1.01 core is unchanged. The new **servo subsystem** is a self-contained power
path from an external supply to the servo, sharing only ground with the logic.

```
  ── LOGIC RAIL (L1.01 core, unchanged) ───────────────────────────────────
   USB-C(sink) → PTC(F1 0.5A) → USBLC6 ESD → RT9080 LDO → 3V3 → ESP32-S3-WROOM-1
                                                         │  D+/D-→ native USB
                                                         │  EN/BOOT buttons, LEDs
                                                         └─ GPIO → J2/J3 headers
                                                              │
                                              GPIO4 ──[R7 470Ω]──┐  (PWM, 3V3 logic)
  ── SERVO RAIL (new, separate) ───────────────────────────────│────────────
                                                                │
   J4 screw term (ext 5V) → F2 PTC(1.5A) → node VSERVO ─────────┼──► J5 servo hdr
        +                                    │   │   │           │     pin3 SIG ◄┘
        │                          D2 ⤓shunt │   │   │ C8 1000µF  │     pin2 V+  ◄ VSERVO
        │                          Schottky  │   │   │ C9 100nF   │     pin1 GND ◄ GND
       GND ───────────────────────(rev-poly) │ D3 TVS │          │
                                              │ SMAJ6.0A          │
                                             GND  (clamp) GND    GND
   ── COMMON GROUND (single low-Z reference; servo return ↛ logic GND) ──────
```

**Sub-circuits the schematic is organised into:**
1. **(L1.01 core, reused whole)** USB-C input + CC sink, protection (PTC + USBLC6
   ESD), 3V3 power (RT9080 + decoupling), the S3-WROOM-1 module with EN/BOOT
   strap+button RCs, indicators (power + user LED), GPIO breakout + test points.
2. **Servo power input** — J4 screw terminal → F2 PTC (overcurrent) → **VSERVO** node.
3. **Servo-rail protection** — D2 shunt Schottky (reverse-polarity crowbar, trips
   F2) + D3 SMAJ6.0A TVS (back-EMF / transient clamp).
4. **Servo-rail bulk** — C8 1000 µF aluminium electrolytic + C9 100 nF (HF).
5. **Servo signal + connector** — GPIO4 → R7 470 Ω series → J5 SIG; J5 V+ = VSERVO,
   J5 GND = common GND.

**Theory of operation:** USB powers and programs the WROOM core exactly as L1.01.
Firmware drives **GPIO4** with a 50 Hz PWM (LEDC peripheral), ~1.0–2.0 ms pulse →
servo angle. The servo is powered **only** from the external 5 V at J4: that current
passes the PTC (F2), is buffered by the bulk cap (C8), and reaches the servo at J5
pin 2. Reverse-wiring J4 forward-biases the shunt Schottky (D2), clamping VSERVO to
≈ −0.4 V and forcing F2 to trip; motor back-EMF spikes on VSERVO are clamped by the
TVS (D3) and absorbed by C8. Because the servo's current loop closes through C8 and
**GND only**, a servo **stall draws zero current from the USB/LDO/3V3 path** — the
MCU cannot brown out from servo load. That isolation **is** the lesson.

## 3 · Calc trail (DO — lock the math)

Logic-rail rows (3V3, LDO, CC, EN/BOOT, LED, USB PTC) are **inherited unchanged
from L1.01** (`../l1-01-wroom-breakout/design.md` §3) and not re-derived here. The
servo subsystem is derived worst-case below.

*(Calc-row IDs are `K1…K15` — a separate namespace from component refDes like C1/C8,
which the §3 rows would otherwise alias.)*

| # | Value | Formula / source | Result | Notes (worst case) |
| --- | --- | --- | --- | --- |
| K1 | Servo rail nominal / ceiling | micro-servo operating range; **regulated 5 V source** | **5.0 V nominal, 5.5 V absolute max** | E2; external supply at J4. **Design ceiling 5.5 V — do NOT feed a 6 V supply** (F2 V_max 6 V + D3 V_wm 6.0 V are both sized to this ceiling) |
| K2 | Servo stall current | **MG90S datasheet 750 mA ±10% @ 4.8 V** = 825 mA, × 5.5/4.8 → 945 mA | **≈ 0.9 A (0.95 A computed)** worst case | working figure 0.9 A; protection margins (K4 derated I_hold ~1.2 A) hold even at 0.95 A. SG90 plastic-gear ~0.55–0.65 A; running ~0.1–0.2 A; idle ~10 mA. *Honest worst case = MG90S-class.* |
| K3 | Servo start inrush | ~1.5× stall, momentary (ms) | **≈ 1.3 A** | brief; buffered by C8. Below F2's **time-current** trip curve (1.3 A for ~1 ms is far too short to trip a 1.5 A device — not merely below the 3 A DC I_trip) |
| K4 | PTC F2 hold ≥ stall | need I_hold(derated) > 0.9 A stall, no nuisance-trip; I_trip on short; V_max > rail ceiling | **miniSMDC150F-2: I_hold 1.5 A, I_trip 3.0 A, V_max 6 VDC, R_typ 0.04 Ω / R1max 0.11 Ω** | I_hold derates ~0.8× hot → **~1.2 A @ 60 °C > 0.9 A stall ✓** (clean margin so a legit stall keeps powering the servo mid-demo); trips on a real short (>3 A); **V_max 6 V > 5.5 V rail ceiling** (0.5 V margin — a tripped F2 holds off ≤ 5.5 V; the rail is spec'd to 5.5 V max, *not* a 6 V supply, K1) |
| K5 | PTC series drop @ stall | datasheet R1max 0.11 Ω (aged, worst case) × 0.9 A | **≤ ~0.10 V** | negligible at 5 V; servo still ≥ 4.4 V |
| K6 | PTC dissipation @ stall | I²R = 0.9² × 0.11 | **≈ 0.089 W** | well within 1812 rating → no thermal flag |
| K7 | TVS standoff vs rail | **SMAJ6.0A** V_wm = 6.0 V > rail max 5.5 V | **V_wm 6.0 V, V_BR(min) 6.67 V** | comfortably non-conducting through 5.5 V (µA leakage); standoff chosen **above** the 5.5 V max (SMAJ5.0A's 5.0 V V_wm would sit on the leakage knee) |
| K8 | TVS clamp vs cap/servo | SMAJ6.0A V_clamp = 10.3 V @ I_pp 38.8 A (P_pp 400 W) | **clamps ≤ 10.3 V** | < C8's 16 V rating ✓. **Most commutation energy recirculates inside the servo's own H-bridge body diodes**; D3 (positive) + D2 (negative, −0.4 V) together bound *both* rails — the TVS handles the residual positive spike the servo doesn't |
| K9 | Bulk cap — PWM ripple | ΔV = I·Δt/C = 0.9 A · 50 µs / 1000 µF | **≈ 0.045 V** | PWM-rate ripple. *Assumption:* servo internal drive ~1–10 kHz → even at a 1 ms period ΔV ≈ 0.9 V on a 5 V rail (floor 4.5 V) — still acceptable; 50 µs is the fast-edge timescale, the kHz period is the bounding case and both pass |
| K10 | Bulk cap — inrush hold | ΔV = I·Δt/C = 1.3 A · 1 ms / 1000 µF | **≈ 1.3 V (1 ms)** | holds the **fast** start step; **DC stall current is supplied by the external source**, not the cap |
| K11 | Bulk cap rating | rail max 5.5 V + TVS clamp 10.3 V vs 16 V part | **16 V ≫ 10.3 V** | EEU-FM1C102 = 1000 µF/16 V, low-ESR FM |
| K12 | Signal series R | fault: SIG shorted to V+ (5 V), GPIO low. Short current = 5 V / 470 Ω ≈ 10.6 mA; current *into the GPIO clamp* (clamp ≈ 3.6 V) = (5 − 3.6)/470 ≈ **3 mA** | **≈ 3 mA into clamp** | Espressif publishes **no hard per-pin injection limit**; margin rests on R7 holding fault current to single-digit mA (well below the ~20–40 mA drive spec). Also damps ringing. *Injection abs-max = unverified against the ESP32-S3 datasheet.* |
| K13 | Servo logic threshold | 3V3 GPIO high vs hobby-servo SIG input | **empirical: 3.3 V drives standard hobby servos** | Hobby servos publish **no V_IH**; 3.3 V drive is *commonly reliable but not spec-guaranteed* (some units key off a threshold up to ~3.5 V). Mitigation: kit specifies a 3.3 V-compatible servo (RK11). No level shifter on the base board. |
| K14 | Servo-rail trace ampacity | I_cont ≤ ~0.9 A → 1 oz Cu, ΔT 10 °C | **≥ 0.8 mm (≈ 30 mil), wider preferred** | captured for **[L]** layout (RK8) |
| K15 | SIG back-feed, MCU unpowered | VSERVO live + USB absent (3V3=0): servo SIG-input pull sources back through J5p3 → R7 → GPIO4 ESD clamp. Worst case ≈ (5 − 0.5)/470 ≈ **9.5 mA** | **≤ ~9.5 mA, R7-bounded** | Servo SIG input is high-Z (sub-mA to low-mA typical); R7 caps the worst case. Mitigation: **power the USB logic rail before/with the servo supply** (RK12). Accepted residual; no series blocking part added (would drop the PWM) |

**The brownout argument (the core teaching number), worst-case both ways:**
- **Shared-rail (the failure being taught):** if the servo were fed from the same
  5 V/3V3 as the MCU, a stall step of ~0.9 A through the USB cable + connector ESR
  (~0.3–0.5 Ω) sags VBUS by **~0.27–0.45 V**; a stiffer servo (1–2 A) sags it well
  past the RT9080 dropout (310 mV typ @ 600 mA, **~0.5 V max** near full load/temp)
  → **3.3 V collapses → brownout reset.** Motor current on the logic rail is *how
  you brown out your MCU.*
- **Separate-rail (the fix, this board):** the servo's supply current returns through
  C8 + GND only; the USB/LDO/3V3 high-side path carries **0 A** of servo current →
  **the MCU cannot brown out *from rail sag*, for any servo size.** The one residual
  coupling path is **shared-ground bounce** (the servo return pulse develops an
  IR / L·di/dt offset across a shared ground) — *not* a rail sag, and addressed by a
  single-point GND tie at C8 + wide/short power+return traces (RK8, [L]). The bulk
  cap keeps the servo's *own* rail clean against fast transients.

## 4 · IC / active-part selection (DO — lock the parts)

Core actives (U1 ESP32-S3-WROOM-1-N16R2, U2 RT9080-33GJ5, D1 USBLC6-2SC6, J1
USB4110-GF-A, F1 1206L050YR) are **inherited unchanged from L1.01** and already
datasheet-verified in that board's run. New/servo-subsystem parts:

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| F2 | **Littelfuse miniSMDC150F-2** (1812 SMD PTC) | Resettable servo-rail OCP. **I_hold 1.5 A** — derates ~0.8× hot (~1.2 A @ 60 °C) and still clears the 0.9 A worst stall (K4), so a legitimate stall keeps powering the servo during the brownout demo; **I_trip 3.0 A** trips on a real short; **V_max 6 VDC > 5.5 V rail ceiling** (0.5 V margin — the rail is spec'd ≤ 5.5 V, K1); R_typ 0.04 Ω / R1max 0.11 Ω. Littelfuse — same miniSMD family. **In stock (8.6 k), Active.** | I_hold/I_trip, **V_max 6 V**, R, temp-derating, package |
| D2 | **Vishay General Semiconductor SS34-E3/57T** (**SMC / DO-214AB**) | 40 V / 3 A Schottky (V_F 0.5 V @ 3 A, **I_FSM 100 A** 8.3 ms) as **shunt reverse-polarity crowbar**: forward-conducts on mis-wired J4, clamps VSERVO to ≈ −0.4 V and drives F2 above I_trip; the 100 A surge rating carries the fault until the PTC trips. *Package is SMC (DO-214AB), not SMA — the larger body helps the crowbar.* **In stock (15.8 k), Active.** | V_R 40 V, I_F(AV) 3 A, I_FSM 100 A, V_F, **package DO-214AB** |
| D3 | **Littelfuse SMAJ6.0A** (SMA / DO-214AC) | Unidirectional **6.0 V** TVS clamping back-EMF / inductive transients on VSERVO. **V_wm 6.0 V chosen above the 5.5 V rail max** (so it idles in µA leakage, not on the 5.0 V-part's knee); V_BR(min) 6.67 V, V_clamp 10.3 V, 400 W. | V_wm, V_BR, V_clamp/I_pp, P_pp, unidirectional |

**Supporting passives & connectors (servo subsystem):**
- **J4 = TE Connectivity 282837-2** — 2-pos 5.08 mm THT screw terminal (servo 5 V
  input). *Reused from L1.03.*
- **J5 = Sullins PRPC040SAAN-RC** — breakaway 0.1″ header, snapped to **1×3** (servo
  GND/V+/SIG). *Reused from L1.01/03.*
- **C8 = Panasonic EEU-FM1C102** — 1000 µF / 16 V radial THT low-ESR (FM) servo
  bulk. *Reused from L1.03.*
- **C9 = Samsung Electro-Mechanics CL21B104KBCNNNC** — 100 nF 0805 (servo HF
  decouple). *Reused from L1.01/03.*
- **R7 = Yageo RC0805FR-07470RL** — 470 Ω 0805 (PWM series). *Reused from L1.01/03.*

> **Silkscreen rule (part of the lesson):** label J5 pin order **GND/V+/SIG** and
> J4 polarity **+ / −** explicitly; mark D2/D3 cathode + pin-1; call out the servo
> rail vs the logic rail. Mis-wiring is the headline user error (RK2/RK4).

## 5 · Power & thermal

- **Rails:** (1) **3.3 V logic** from RT9080 (USB-5 V in) — L1.01, unchanged;
  (2) **VSERVO ~5 V** from the external screw terminal — independent, GND-common
  only. VBUS 5 V still goes (PTC+ESD) to the GPIO headers for *peripheral power*
  only, never into a GPIO (E3, L1.01 rule).
- **Servo budget:** idle ~10 mA, running ~0.1–0.2 A, **stall ~0.9 A worst case**
  (MG90S-class), inrush ~1.3 A momentary (K2/K3). Supplied by the external source;
  buffered by C8.
- **Thermal:** **not a flagged concern.** New dissipators: F2 PTC ~0.089 W at stall
  (1812, fine); D2 Schottky **0 W in normal operation** (reverse-biased). Its one
  non-trivial case is a **reverse-polarity fault from a current-limited supply that
  never reaches F2's 3 A trip** (RK2/RK13): D2 then conducts steady-state at the
  sub-trip current — worst ~V_F × I ≈ 0.5 V × ~1.5 A ≈ **0.75 W continuous** in the
  SMC body. SS34 is rated I_F(AV) 3 A (~1.5 W at full rating), so DO-214AB on board
  copper stays within junction limits at 0.75 W — bounded, not a board-thermal-design
  concern. D3 TVS 0 W except during a clamped transient; C8 ESR ripple negligible
  (K9). The logic-side RT9080 worst case is unchanged from L1.01 (~1 W transient,
  SOT-23 + copper). No heatsink/pour design required → `hasThermalConcern=false`.

## 6 · Risk register

| # | Risk | L × I | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| **RK1** | **Servo stall browns out the MCU** — the headline failure this board teaches: stall current on the logic rail sags VBUS past the LDO dropout → S3 resets mid-move. | High × High | **Separate servo supply rail** (external J4, GND-common only) + **bulk cap C8** + wide/short power traces. Servo current never touches USB/LDO/3V3 (§3 brownout argument). | **DE-RISKED** (by topology) |
| **RK2** | **Reverse polarity at J4** — a beginner wires the servo supply +/− backwards into the screw terminal. | High × High | **Shunt Schottky D2** clamps VSERVO to ≈ −0.4 V (protects C8 electrolytic + servo) and forward-conducts → **PTC F2 trips**. Silk-mark + / − on J4. | **DE-RISKED** |
| **RK3** | **Inductive / back-EMF transient** on VSERVO from the servo motor (commutation, stall-release). | Med × Med | **TVS D3 (SMAJ6.0A)** clamps to ≤ 10.3 V (< C8 16 V); **C8** absorbs the energy. Unidirectional TVS correct for a positive rail; V_wm 6.0 V > 5.5 V rail max so it doesn't leak in normal use. | **DE-RISKED** |
| **RK4** | **Servo plug reversed / mis-ordered** on J5 (GND/V+/SIG). | Med × Med | **V+ placed in the middle** (standard safe order) so a flipped plug never lands V+ on SIG; **R7 470 Ω** limits SIG fault current to ~10 mA (K12); clear silk pin-labels. Residual = user care (inherent to 0.1″ servo headers). | **DE-RISKED** (mitigated) |
| **RK5** | **Servo-rail short / overcurrent** (shorted connector, jammed servo beyond rating). | Med × Med | **PTC F2** (I_hold 1.5 A, I_trip 3.0 A, V_max 6 V > 5.5 V rail ceiling) — resettable; holds a legit ~0.9 A stall (even derated hot) but trips on a real short; protects board traces + external supply. | **DE-RISKED** |
| **RK6** | **External servo supply absent** — learner powers USB but forgets the servo supply. | Med × Low | Safe failure: servo simply doesn't move (no VSERVO). Documented in the guide as a first debug step. | **DE-RISKED** (accepted) |
| **RK7** | **GPIO PWM pin shorted to V+** (mis-wire / probe slip). | Low × Med | **R7 470 Ω** series limits fault current into the GPIO clamp to ~3 mA effective (K12) — within tolerance. | **DE-RISKED** |
| **RK8** | **Servo high-current return contaminates the logic ground / trace ampacity** — the servo return through a shared ground develops both an **IR offset** *and* an **L·di/dt transient** (motor PWM edges, ~kHz) on the MCU's ground reference, which can disturb the ADC reference, USB D± common-mode, and EN/BOOT strap thresholds; **and** GPIO4's PWM return through that same bouncing ground can jitter the pulse width the servo decodes (pairs with RK11). Thin servo traces also overheat. | Med × High | **[L] layout:** servo return tied to C8 ground, **single-point** tie to logic GND near the cap (keeps the di/dt loop out of the logic reference); servo power+return traces **≥ 0.8 mm (wider preferred)**, short; keep the SIG return path short. Captured for layout. | open → close at **[L]** |
| **RK9** | **WROOM antenna keep-out** (inherited from the core). | Low × High | Module on a board edge, no copper/parts under the PCB antenna (Espressif integration rules). | open → close at **[L]** |
| **RK10** | **Footprint ↔ pinout** for the new parts (F2 1812, D2 **SMC/DO-214AB**, D3 SMA, J4 screw term, J5 1×3) not yet pad-verified. | Low × Med | Captured at `[D]` (intended pinout below); **verified at `[S]`** once KiCad symbols/footprints are chosen (cannot close pre-schematic). **D2 = DO-214AB (SMC), not SMA** — assign the SMC footprint, do not reuse the SMA pads. | open → close at **[S]** |
| **RK11** | **Servo signal-input threshold variance** — some hobby servos key off a logic-high threshold up to ~3.5 V, so 3.3 V drive (no level shifter on the base board) may be marginal on certain units (jitter / no-move). | Low × Med | Hobby servos publish no V_IH; 3.3 V drive is commonly reliable. Mitigation: **kit specifies a 3.3 V-compatible servo**; if a learner's servo won't read 3.3 V, a single 74AHCT125 buffer (already a catalog part from L1.03) powered from VSERVO is the documented level-shift option. Accepted for the base board. | **DE-RISKED** (accepted w/ mitigation) |
| **RK12** | **SIG back-feed into an unpowered MCU** (two-rail sequencing) — VSERVO applied while the USB logic rail is absent (3V3 = 0): a servo whose SIG input has an internal pull can source current back through J5 pin3 → R7 → GPIO4's ESD clamp, partially biasing the dead 3V3 rail. | Low × Med | Worst case **R7-bounded to ~9.5 mA** (K15); a hobby-servo SIG input is high-Z so real back-feed is sub-mA–low-mA. Mitigation: **document "power the USB logic rail before/with the servo supply"** in the guide; no series blocking diode added (it would drop the PWM and over-complicate an L1 board). Accepted residual. | **DE-RISKED** (accepted w/ mitigation) |
| **RK13** | **Reverse-polarity from a current-limited supply** — a bench supply (or weak adapter) current-limited **below F2's 3 A trip** is reverse-wired into J4: D2 clamps VSERVO to ≈ −0.4 V (C8 + servo protected) but F2 never trips, so D2 conducts **steady-state** at the sub-trip current. | Low × Med | D2 (SS34, I_F(AV) 3 A) dissipates worst ~0.75 W continuous (§5) — within its rating on DO-214AB copper, so it survives indefinitely; the −0.4 V clamp still protects the electrolytic + servo. Silk-mark J4 polarity (RK2). Bounded, accepted. | **DE-RISKED** (accepted) |

**Intended pinout / polarity captured for the [S] audit:** D2 SS34 **DO-214AB (SMC)**
— cathode band = VSERVO side (anode to GND for the shunt crowbar); D3 SMAJ6.0A SMA —
cathode = VSERVO, anode = GND (unidirectional, band toward the rail); F2 1812 —
non-polar, in-line in VSERVO; J4 282837-2 — pin1 = +5 V in, pin2 = GND; J5 1×3 —
pin1 GND, pin2 V+ (VSERVO), pin3 SIG.

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board** (no mains/Li-ion/thermal/stripboard flags, so
**no conditional rows fire**):

- [ ] **Calc trail recorded** — every derived servo value worst-case-sourced (§3),
  logic-rail values inherited from L1.01.
- [ ] **Each IC datasheet-verified** — F2/D2/D3 against their own datasheets; core
  actives inherited from L1.01 (§4).
- [ ] **Footprint ↔ pinout cross-checked** — each part's footprint pad map matches
  the datasheet pinout (**[S]** — verified at schematic capture; intended pinout
  captured in §6).
- [ ] **Fab-DRU DRC accounted for** — fab design rules (`.kicad_dru`) applied before
  gerber export (**[L]**).
- [ ] **BOM availability confirmed** — every part in stock, not EOL/NRND, exact
  import strings (§8 — live DigiKey screened).
- [ ] **All top risks de-risked** — §6: RK1–RK7 + RK11–RK13 de-risked/accepted by
  design; RK8/RK9 close at layout [L], RK10 at schematic [S].

> Attestations (a human checked), except BOM availability (DigiKey/MCP) and DRU
> presence, which are verifiable. **Inductive-load + stall-current concerns** are
> covered by the physics (audit 4) + FMEA (audit 8) passes, not a separate flag.

> **Pedagogy framing (guide-authoring decision, recorded):** this is the most
> component-dense L1 board (reverse-poly crowbar + TVS + PTC + series-R on top of a
> two-rail mental model). The parts are each justified by a real beginner failure
> (RK2/RK3/RK5/RK7), so they stay — but the **guide must foreground only the
> rail-separation + bulk-cap story** and frame D2/D3/F2 as "guard rails you don't
> have to fully understand yet," or the headline lesson drowns. The advanced
> shared-ground subtlety (RK8) is a layout/teardown topic, not a first-pass concept.

## 8 · BOM sourcing & freeze

**Live DigiKey screen — 2026-06-25 (all Active):**

| Ref(s) | MPN | Mfr | Pkg | Stock | Unit | Source |
| --- | --- | --- | --- | ---: | ---: | --- |
| F2 | miniSMDC150F-2 | Littelfuse | 1812 | 8,620 | $0.61 | **NEW** |
| D2 | SS34-E3/57T | Vishay General Semiconductor | **SMC/DO-214AB** | 15,807 | $1.02 | **NEW** |
| D3 | SMAJ6.0A | Littelfuse | SMA/DO-214AC | 65,681 | $0.47 | **NEW** |
| C8 | EEU-FM1C102 | Panasonic | radial THT | 1,825 | $1.07 | reuse (L1.03) |
| J4 | 282837-2 | TE Connectivity | THT | 162,659 | $1.22 | reuse (L1.03) |
| J5 | PRPC040SAAN-RC | Sullins Connector Solutions | THT 1×3 | 68,482 | $1.23 | reuse (L1.01/03) |
| C9 | CL21B104KBCNNNC | Samsung Electro-Mechanics | 0805 | (commodity) | ~$0.01 | reuse (L1.01/03) |
| R7 | RC0805FR-07470RL | Yageo | 0805 | 226,132 | $0.10 | reuse (L1.01/03) |

Core (U1/U2/J1/D1/F1 + L1.01 passives/LEDs/buttons/headers/TPs) reuse L1.01's
already-sourced, in-stock lines (U1 ESP32-S3-WROOM-1-N16R2 8,589 stock $6.32; U2
RT9080-33GJ5 98,947 $0.28 — re-screened 2026-06-25, Active). All servo lines
live-screened 2026-06-25.

- **Design-to-cost target:** ~**$15–17** BOM (L1.01 core ~$11 + servo subsystem
  ~$4.4). **3 new line items** (F2, D2, D3); everything else reuses the live catalog.
- **Second sources:** F2 PTC — **Bel Fuse 0ZCG0150FF2C** (1.5 A, $0.26, 6.8 k stock,
  Active) is a verified second source; D2 Schottky — any 40 V/3 A SMC/DO-214AB
  Schottky (SS34 is multi-sourced; onsemi/SMC equivalents); D3 TVS — STMicro/onsemi
  SMAJ6.0A equivalents. Core second sources per L1.01.
- **Stock verification:** new + critical servo lines live-screened at DigiKey on
  2026-06-25 (above). Commodity 0805 R/C are low-risk.
- **BOM frozen:** **not yet.** Freeze (`bomFrozenAt`) is held until after the design
  passes validation **and** the owner authorizes advancing into LAYOUT (RK8/RK9 [L],
  RK10 [S] close at their stages). `bomFrozenAt` stays **null**.
