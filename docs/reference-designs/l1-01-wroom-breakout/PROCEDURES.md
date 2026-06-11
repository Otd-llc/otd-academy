# L1.01 — Assembly & Bring-up Procedures + Expected Measurements

_Reference `ASSEMBLY_PROCEDURE` + `BENCH_PROCEDURE` content for `l1-01-wroom-breakout`.
Draft for review; finalize current draw against the shipped design (user LED = IO2)._

## Assembly (`ASSEMBLY_PROCEDURE`)

**Screening (before you build):**
- Inspect the bare PCB: no solder-bridge-prone defects, clean pads, silkscreen legible.
- Confirm every part against `BOM.csv` (value, package, polarity for D1/LEDs).

**Hand-build order (lowest-profile / most-heat-sensitive first):**
1. 0805 passives — R1–R6, C1, C2/C3/C7, C5/C6.
2. SOT/TSOT actives — U2 (LDO), D1 (ESD array).
3. **U1 (WROOM module)** — orient antenna toward the board edge; confirm the keep-out is
   clear of copper before reflow/drag-solder.
4. J1 (USB-C receptacle) — anchor the retention tabs.
5. SW1/SW2 (EN/BOOT tactiles), LED1/LED2, R-limited.
6. J2/J3 (GPIO headers), TP1/TP2 (test points).

**`POST_ASSEMBLY_CONTINUITY` checklist (tick all before powering):**
- VBUS ↔ GND: **NOT** shorted.
- 3V3 ↔ GND: **NOT** shorted.
- LDO VIN (VBUS) ↔ LDO VOUT (3V3): correct, not bridged.
- Module GND pad ↔ GND plane: continuous.
- USB-C shell ↔ GND: as designed.

## Bring-up (`BENCH_PROCEDURE`) — power rails first

1. **Dry check:** with no power, confirm 3V3 ↔ GND is not shorted.
2. **First power:** apply USB-C from a current-limited source if available; watch for
   abnormal current (a dead short trips the PTC / your supply).
3. **Rails:** measure VBUS (~5 V) and the 3V3 rail at TP1→TP2.
4. **Power LED** should be on whenever 3V3 is up.
5. **Enumeration:** plug into a host; the native-USB S3 should appear as a serial device
   (`/dev/ttyACM*`, `/dev/cu.usbmodem*`, or `COM*`).
6. **Download mode:** hold **BOOT**, tap **EN** (reset), release BOOT; flash the bring-up
   firmware (`firmware/bringup_blink/`).
7. **Confirm life:** USB-CDC serial banner prints **and** the user LED blinks → the 3V3 rail,
   native USB, toolchain, and a GPIO are all proven end-to-end.

## Expected measurements (`BRINGUP_LOG` reference)

| Signal | Expected | Pass band |
|---|---|---|
| VBUS (USB 5 V) | ~5.0 V | 4.75–5.25 V |
| 3V3 rail (TP1→TP2) | 3.3 V | 3.13–3.47 V (±5%) |
| Idle current @ 5 V | tens of mA | board-dependent; flag if > ~150 mA |
| USB enumeration | device present | shows as USB-Serial/JTAG (CDC) |
| User LED | 1 Hz blink | visible toggle under the test firmware |
