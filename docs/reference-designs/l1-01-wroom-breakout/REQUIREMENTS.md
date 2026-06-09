# L1.01 — ESP32-S3 USB-C Breakout: Requirements

_Reference `REQUIREMENTS_DOC` for `l1-01-wroom-breakout` @ v1. The spec the board must
satisfy — the answer key for the REQUIREMENTS phase. Draft for review; refine to match the
shipped reference design._

## Overview
A minimal, hand-solderable carrier for the **ESP32-S3-WROOM-1-N16R2** module that brings the
module up over **USB-C** with no external programmer. It is the universal core every later
board builds on: power in, protection, programming, status, and all GPIO broken out. A
dev-kit would hide the very subsystems this board exists to teach, so it is **PCB-only**.

**Discipline taught:** module + USB-C + 3.3 V LDO + native-USB programming path + the
boot/reset control; WROOM antenna keep-out.

## Functional requirements
- **F1 — Power & program over one USB-C port.** A host USB-C cable powers the board *and*
  flashes/serial-monitors the module — no separate programmer or power supply.
- **F2 — Self-flashing via native USB.** The ESP32-S3's built-in USB-Serial-JTAG enumerates
  directly to the host (D−=GPIO19, D+=GPIO20). No USB-UART bridge IC.
- **F3 — Manual download-mode entry.** EN (reset) + BOOT (GPIO0) buttons let the user enter
  download mode: hold BOOT, tap EN, release BOOT.
- **F4 — Status indication.** A power LED (always-on when 3V3 is up) and a user LED on a GPIO
  (provable by a blink) for end-to-end verification.
- **F5 — Full GPIO access.** Every usable module GPIO is broken out to 2.54 mm headers so the
  board is a reusable development base.

## Electrical requirements
- **E1 — Input:** USB-C VBUS, 5 V nominal. Sink role only.
- **E2 — USB-C CC:** 5.1 kΩ Rd on CC1 and CC2 (advertise as a sink to a Type-C source).
- **E3 — Regulation:** 5 V → **3.3 V LDO, ≥ 600 mA**, with EN and OC/OT protection; stable
  with 1 µF ceramic in/out (RT9080-33). 3V3 rail powers the module and all I/O.
- **E4 — Power budget:** size the rail for the module's Wi-Fi TX current peaks (bulk + local
  decoupling), not just average draw.
- **E5 — Decoupling:** 10 µF bulk on 3V3 + 0.1 µF at the module's supply pins; 1 µF at LDO
  in/out.
- **E6 — Protection:** PTC resettable fuse on VBUS (0.5 A hold / 1 A trip) + low-capacitance
  ESD array on the USB data lines and VBUS.
- **E7 — Pull-ups:** 10 kΩ on EN and on GPIO0/BOOT (defined boot state; never float EN).
- **E8 — LED current limit:** series resistor sized per LED Vf on the 3V3 rail (470 Ω).

## Mechanical / DFM requirements
- **M1 — Antenna keep-out (hard constraint):** no copper, no ground pour, no traces under or
  around the WROOM PCB antenna; ideally the module overhangs the board edge. This is the
  headline LAYOUT review item and is uncorrectable after fab.
- **M2 — Hand-solderable:** all parts in hand-solder-friendly packages (0805 passives,
  SOT/TSOT, 6 mm tactiles, a USB-C receptacle with solder-retention tabs).
- **M3 — Test access:** 3V3 and GND test-point loops for bring-up probing.
- **M4 — Headers:** 2.54 mm breakaway headers for GPIO breakout (breadboard/jumper friendly).

## Constraints / known gotchas
- **C1 — Antenna keep-out** (see M1) — the one mistake you cannot fix without a new board.
- **C2 — Quad vs octal PSRAM:** N16R2 (quad) keeps GPIO35–37 available; octal-PSRAM modules
  tie those up. This board assumes the quad part.
- **C3 — ADC2-vs-radio:** ADC2 channels are unusable while Wi-Fi is active — route any analog
  inputs to ADC1. (Carried forward as the core lesson of L1.05.)
- **C4 — Never float EN;** define the boot state with the GPIO0 pull-up.

## Acceptance (definition of done for REQUIREMENTS)
- Attach this requirements artifact to the revision.
- (L1 build) the comprehension quiz gates understanding; the formal REQUIREMENTS_REVIEW
  design-review checklist is intentionally skipped for true-beginner L1 projects.
- `l1-01` is `requiresStripboard: false` and `hasMainsNet: false` — no stripboard-validation
  or certified-module branch applies at BOM_SOURCING.
