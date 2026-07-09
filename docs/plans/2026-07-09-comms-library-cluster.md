# Library cluster blueprint: Communication & Interfaces

**Status: DRAFT for review / authoring brief (2026-07-09).** Nothing seeded. Follows the
Fundamentals pattern + the parallel handoff (`2026-07-09-library-clusters-parallel-handoff.md`).
Generic textbook education only (no moat). Per-lesson: **thesis · beats · cite (verify) ·
diagram · quiz · links.**

**key:** `comms-interfaces` · **label:** "Communication & Interfaces" ·
**blurb:** "How the chips on a board talk to each other: UART, SPI, I2C, and USB, in plain terms."

**Why:** unblocks the immediate next courses (L1.01 USB-C, the SPI-bridge build) and carries
high-intent SEO ("SPI vs I2C", "USB-C CC pins", "UART explained"). Bridges Fundamentals (the
parts) to a board where parts must *talk*.

**Slug prefix:** use `bus-` / `usb-` / plain topic slugs; grep existing slugs first.

---

## Lessons (11)

### 01 · What is a bus?
- **thesis:** A bus is a shared set of wires plus a set of rules (a protocol) that lets chips exchange data. Serial sends bits one at a time down few wires; parallel sends many at once down many. Small boards are almost all serial.
- **beats:** serial vs parallel (pin count vs speed); the idea of a protocol (agreed framing/timing); controller vs peripheral roles; clocked vs clockless; why serial won on small boards.
- **cite:** a general digital-comms primer (Sparkfun "serial communication").
- **diagram:** serial (one wire, bits in time) vs parallel (many wires, bits at once).
- **quiz:** why is serial preferred on a small board? (far fewer pins/traces)
- **links:** prereq Fundamentals "voltage, current, resistance".

### 02 · UART — asynchronous serial
- **thesis:** UART is the simplest serial link: two wires (TX, RX), no shared clock. Both sides just agree on a speed (baud) and a framing, and send bytes. It is how a board talks to a terminal or a GPS.
- **beats:** TX/RX crossover; baud rate; start/stop/data/parity framing; no clock → both sides must match baud; full-duplex; common uses (console, GPS, modules).
- **cite:** Sparkfun "serial communication" / a UART reference.
- **diagram:** a UART frame (idle-start-8 data-stop) on a timeline.
- **quiz:** what do two UART devices have to agree on? (the baud rate + framing)
- **links:** the ESP32 UART (MCU cluster 09).

### 03 · SPI — the four-wire bus
- **thesis:** SPI is a fast, clocked serial bus: a controller drives a clock and picks a peripheral with a chip-select line, and data flows both ways on MOSI/MISO. It is how a fast ADC or display talks to the MCU.
- **beats:** SCK / MOSI / MISO / CS; controller-driven clock; one CS per peripheral; full-duplex; modes (CPOL/CPHA, keep light); fast, but more pins; used for ADCs/displays/flash.
- **cite:** a SPI reference (Sparkfun / Analog Devices SPI primer).
- **diagram:** an SPI bus, one controller + two peripherals, the four lines + a CS each.
- **quiz:** what selects which SPI peripheral is active? (its chip-select / CS line)
- **links:** the ADS1220/ADS1299 ADC courses; the SPI-bridge build.

### 04 · I2C — the two-wire bus
- **thesis:** I2C trades speed for pins: just two wires (SDA, SCL) shared by many devices, each with an address. Great for slow sensors when you are short on pins.
- **beats:** SDA/SCL; open-drain + pull-ups (why); 7-bit addresses; multi-device on one pair; slower than SPI; ACK/NACK (light); used for sensors/EEPROMs/RTCs.
- **cite:** an I2C reference (NXP/Sparkfun I2C primer) — I2C is an NXP spec.
- **diagram:** an I2C bus, two pull-ups + several addressed devices on SDA/SCL.
- **quiz:** why does I2C need pull-up resistors? (the lines are open-drain; the pull-up sets the idle-high level)
- **links:** prereq Fundamentals "grounds and power rails" (pull-ups); Fundamentals "resistors".

### 05 · SPI vs I2C vs UART
- **thesis:** Pick the bus by the job. UART for a simple point-to-point stream, I2C when you are pin-starved and speed does not matter, SPI when you need speed and have pins to spare.
- **beats:** the trade-off table (wires, speed, device count, complexity); when each wins; reading a part's datasheet to see which it uses; mixing buses on one board.
- **cite:** a comparison article (Sparkfun / a vendor comparison).
- **diagram:** a 3-column compare (UART · I2C · SPI: wires / speed / #devices).
- **quiz:** you are out of pins and the sensor is slow; which bus? (I2C)
- **links:** lessons 02-04.

### 06 · USB basics
- **thesis:** USB is more than serial over a cable: a host and a device negotiate (enumerate) over a differential pair (D+/D-) before any data flows. That handshake is why a board "appears" when you plug it in.
- **beats:** host vs device; D+/D- differential pair; enumeration (the device describes itself); power + data on one cable; speeds (full/high); why it is not just UART.
- **cite:** a USB primer (Sparkfun / usb.org basics).
- **diagram:** host↔device with D+/D- + the enumerate handshake beats.
- **quiz:** what happens before USB data flows? (enumeration: the device describes itself to the host)
- **links:** the ESP32-S3 native USB (MCU cluster 06 flashing).

### 07 · USB-C, the connector
- **thesis:** USB-C is reversible because of its CC (configuration channel) pins, and a device declares its role with a resistor on CC. On a simple board, two 5.1 kΩ resistors to ground on CC1/CC2 tell a host "I am a device, give me 5 V." (Directly the L1.01 board.)
- **beats:** the reversible connector; CC1/CC2; the 5.1 kΩ pull-downs = "sink/device" role; VBUS 5 V default; why you need them (or the port stays dead); no PD needed for a simple 5 V board.
- **cite:** the USB-C spec / a USB-C CC-pin reference (e.g. a well-known USB-C hardware primer).
- **diagram:** a USB-C receptacle with CC1/CC2 + the 5.1 kΩ pull-downs called out.
- **quiz:** what do the two 5.1 kΩ resistors on CC do? (set the port's device/sink role so it gets 5 V)
- **links:** SUPPORTING → L1.01; prereq Fundamentals "resistors".

### 08 · Level shifting
- **thesis:** A 3.3 V chip and a 5 V chip cannot always share a line safely; a level shifter translates between them. Know your logic levels before you wire two parts together.
- **beats:** logic levels (VIH/VIL); 3.3 V vs 5 V; the risk (over-voltage a 3.3 V pin); level-shifter types (resistor divider for slow input, a MOSFET/IC for bidirectional); when you can skip it (tolerant pins).
- **cite:** a level-shifting reference (Sparkfun bi-directional level shifter).
- **diagram:** a 5 V ↔ 3.3 V line through a level shifter, both domains labelled.
- **quiz:** why can driving a 3.3 V pin with 5 V be a problem? (it can exceed the pin's max and damage it)
- **links:** prereq Fundamentals "voltage dividers" (a divider as a crude shifter).

### 09 · Pull-ups, pull-downs & the idle line
- **thesis:** A floating input reads noise; a pull-up or pull-down resistor gives a line a known default. Different buses set their idle level by convention, and getting it wrong is a classic "bus does nothing" bug.
- **beats:** a floating pin is undefined; pull-up = idle high, pull-down = idle low; I2C needs pull-ups (open-drain); reset/enable/boot lines; internal vs external pull-ups; sizing (weak vs strong).
- **cite:** a pull-up/pull-down reference (Sparkfun).
- **diagram:** a pin with a pull-up vs pull-down vs floating (three states).
- **quiz:** what does a pull-up resistor do to an idle line? (holds it at a known high level)
- **links:** prereq Fundamentals "resistors"; lesson 04 (I2C).

### 10 · Digital isolation
- **thesis:** Sometimes two parts of a board must exchange signals without sharing a ground, for safety or to break a noise loop. A digital isolator passes the bits across a barrier with no electrical connection. (Supports the isolated-SPI-bridge build.)
- **beats:** why isolate (safety, ground loops, different grounds); the isolation barrier; digital isolators vs optocouplers; isolating a bus (SPI/UART across the barrier); isolated power (intro).
- **cite:** an isolation primer (Analog Devices / TI digital isolator basics).
- **diagram:** a bus crossing an isolation barrier (two grounds, no direct connection).
- **quiz:** what does a digital isolator NOT carry across the barrier? (a direct electrical/ground connection)
- **links:** SUPPORTING → the isolated-SPI-bridge course; prereq Fundamentals "grounds and power rails".

### 11 · Debugging a bus
- **thesis:** When a bus does nothing, the fault is usually simple and physical: a missing pull-up, the wrong mode, a clashing address, or a swapped wire. A logic analyzer turns "it doesn't work" into "here's the exact byte."
- **beats:** the logic analyzer (what it shows); the usual suspects (no pull-up, wrong SPI mode, I2C address clash, TX/RX swapped, baud mismatch); check power + ground first; scope vs analyzer.
- **cite:** a logic-analyzer / bus-debug guide (Sparkfun / Saleae basics).
- **diagram:** a captured bus trace with an annotated failure (e.g. no ACK on I2C).
- **quiz:** two I2C devices answer at once; likely cause? (an address clash)
- **links:** the bench-tools track; lessons 03-04.

---

## Open decisions
1. 11 lessons or trim (e.g. fold 09 pull-ups into 04 I2C).
2. Slugs (grep for clashes: `grounds`, `resistors` are taken by Fundamentals).
3. Citations = targets, unfetched (no-research); pull on go.
