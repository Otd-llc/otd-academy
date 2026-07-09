# Library cluster roadmap — the next ~45 lessons (2026-07-09)

**Status: DRAFT for review.** Nothing seeded. This is the strategic map of the next `/library`
reference clusters, for the owner to **prioritize** on return. The deep, lesson-by-lesson
blueprint for the recommended first cluster (**PCB Design & Fabrication**) is its own doc:
`2026-07-09-pcb-design-library-cluster.md`. This doc gives the lesson LISTS (title + one-line
thesis) for the other three so you can see the full shape and pick the order.

All follow the same rules as Fundamentals: generic textbook education only (no coined moat, no
paid-build values), answer-first, cited-per-claim, beginner main line with `deepDive` asides,
a diagram per lesson, `/tools` + course cross-links.

## Where the library stands
- **Fundamentals** (12) — LIVE. The EE concepts + reading a schematic/datasheet.
- **EEG & BCI** (12) — LIVE. The flagship/moat topic (generic side).
- **Next: 4 candidate clusters below.**

## Recommended order (why)
1. **PCB Design & Fabrication** — the bridge from "understand the parts" to "make the board,"
   which is the academy's core promise; universal to every course; the biggest SEO surface
   (KiCad, layout, gerbers, stackup, DFM). **Deep blueprint written.**
2. **Communication & Interfaces** — unblocks the *immediate* next courses (L1.01 USB-C, the
   SPI-bridge). High-intent SEO ("SPI vs I2C", "USB-C CC pins").
3. **Power & Batteries** — supports the Power Systems track + the Li-ion module; strong SEO
   ("power an ESP32", "LiPo safety", "LDO vs buck"). Reuses the `/tools` LiPo + LDO calcs.
4. **Microcontrollers & ESP32** — the core MCU reference; supports every ESP32 course.

Sensors/Actuators (motion track) + a Bench/Test cluster are a **later** tier (further-out
courses); noted at the bottom.

---

## Cluster 2 — Communication & Interfaces  (`comms-interfaces`, ~11)
*"How the chips on a board talk: UART, SPI, I2C, and USB, in plain terms."*

1. **What is a bus?** — serial vs parallel, the idea of a protocol + a shared set of wires.
2. **UART — asynchronous serial** — TX/RX, baud rate, framing, no shared clock.
3. **SPI — the four-wire bus** — MOSI/MISO/SCK/CS, controller/peripheral, full-duplex, fast.
4. **I2C — the two-wire bus** — SDA/SCL, addresses, pull-ups, why it's slower but frugal on pins.
5. **SPI vs I2C vs UART** — the trade-offs and how to pick one for a given part.
6. **USB basics** — D+/D-, host vs device, enumeration, why it's more than "serial over a cable".
7. **USB-C, the connector** — the CC pins, orientation, the 5.1 kΩ resistors that set the port role (ties straight to L1.01).
8. **Level shifting** — 3.3 V vs 5 V logic, why mismatched levels break a bus, how to translate.
9. **Pull-ups, pull-downs & bus idle** — the resistor that sets a line's default, per-bus conventions.
10. **Digital isolation** — why you isolate a bus (safety, ground loops), digital isolators (supports the SPI-bridge course).
11. **Debugging a bus** — the logic analyzer, the usual failures (no pull-up, wrong mode, address clash).

## Cluster 3 — Power & Batteries  (`power-batteries`, ~11)
*"Powering a board that runs: batteries, regulators, and how to size a supply."*

1. **Power rails & budgets** — what a rail is, adding up a board's current draw, sizing the source.
2. **Batteries 101** — chemistries, capacity (mAh/Wh), C-rate, what "3.7 V nominal" means.
3. **LiPo / Li-ion safety** — the 4.2 V ceiling, protection circuits, charge/discharge limits, why it matters.
4. **Battery charging** — CC/CV charging, the charge curve, single-cell charger ICs.
5. **Linear regulators (LDO)** — dropout, dissipation as heat, thermal limits (the deep version of the Fundamentals lesson).
6. **Buck regulators (step-down)** — switching to convert down efficiently, the basic topology.
7. **Boost regulators (step-up)** — getting a higher voltage from a lower one.
8. **LDO vs switcher** — efficiency vs noise vs cost, when each wins.
9. **Reverse-polarity & inrush protection** — the diode vs the P-FET ideal diode, on a real power input (extends the Fundamentals deepDive).
10. **Power sequencing & soft-start** — why rails come up in an order, inrush control.
11. **Measuring power & battery runtime** — how to estimate runtime; **embeds the `/tools` LiPo runtime calc**.

## Cluster 4 — Microcontrollers & the ESP32  (`microcontrollers`, ~11)
*"What a microcontroller is and how the ESP32 reads pins, sensors, and time."*

1. **What is a microcontroller?** — CPU + RAM + flash + peripherals on one chip; MCU vs CPU.
2. **GPIO** — reading and driving a pin, input vs output, pull-ups, drive strength.
3. **The ADC** — reading an analog voltage: resolution, reference, the ESP32's attenuation (ties to Fundamentals voltage-dividers).
4. **PWM** — faking an analog output with a fast on/off duty cycle.
5. **Boot & strapping pins** — how the ESP32 decides how to boot, why strapping-pin state matters at reset.
6. **Flashing firmware** — the USB bootloader, esptool, what "flashing" actually writes.
7. **Clocks & timers** — the system tick, timers, why timing underlies everything.
8. **Interrupts** — responding to an event without polling; the ISR in plain terms.
9. **On-chip comms peripherals** — the UART/SPI/I2C blocks inside the chip (links to the Comms cluster).
10. **Power modes & sleep** — active vs deep sleep, the current-draw difference for battery life.
11. **Reading the ESP32 pinout** — the practical "which pin can do what," strapping/ADC/USB caveats.

---

## Later tier (not now)
- **Sensors & Actuators** (motion track) — IMUs, motor drivers, encoders, PWM control.
- **Test & Measurement / Bench** — multimeter, oscilloscope, logic analyzer, ERC/DRC as tools.

## Open decisions for the owner
1. **Order** — is PCB-first right, or do you want Comms first (unblocks L1.01/SPI-bridge sooner)?
2. **Scope per cluster** — ~11-12 each, or tighter 8-10?
3. **How many to greenlight now** — one cluster (author + seed), or approve the roadmap and
   batch two?
4. On approval I write the deep lesson-by-lesson blueprint for the chosen cluster(s) (like the
   PCB doc), then author → `--check` → seed (gated on your go).

## Reminder / guardrails
- **Generic only** (disclosure policy) — nothing here touches the moat/recipe.
- **Overlap** — each new cluster cross-links its Fundamentals prerequisite instead of repeating it.
- **Diagrams** — each cluster is ~11 new diagrams (sandbox-per-diagram, multi-session); they
  come AFTER authoring, not blocking.
- **Citations** — all "cite" targets are unfetched (no-research rule); pulled on your go.
