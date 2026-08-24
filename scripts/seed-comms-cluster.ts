// Seeds the Communication & Interfaces cluster of public /library mini-lessons
// (docs/plans/2026-07-09-comms-library-cluster.md + the parallel handoff
// 2026-07-09-library-clusters-parallel-handoff.md). Generic electronics
// education, true-beginner bar, cited per claim, first-hand to real One Thousand
// Drones boards. cluster = "comms-interfaces"; clusterOrdinal = list order.
//
// Content lives in the PROD DB; this committed seed is the reviewable source and
// re-runs idempotently (upsert on the unique slug). Diagram `image` blocks point
// at their PLANNED /guide-diagrams/comms-<name>.svg registry key; they render
// caption-only until the diagram-export sandbox phase builds those components +
// rasters (same key, so no re-seed for figures).
//
// Voice: otd-content-writing house rules (no em-dashes; answer-first; no
// antithesis flourish). Assessment: 3 options, real same-register distractors,
// answer key spread, no math/edge-cases in stems (L1 beginner bar). Academy =
// generic only (no coined vocabulary, no paid-build values).
//
// Slugs are bus-/usb-/plain topic slugs, checked against every existing
// MiniLesson.slug (Fundamentals + EEG) for collisions.
//
// Run:
//   npx tsx scripts/seed-comms-cluster.ts --check   (validate blocks, NO DB)
//   npx tsx scripts/seed-comms-cluster.ts           (seed PROD)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import katex from "katex";
import { guideContentBlocksSchema, type ContentBlock } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";
import { PDF_SAIRA_FALLBACK } from "@/lib/pdf/pdf-fallback-set";
import { pdfGlyphIssues } from "@/lib/pdf/pdf-glyph-coverage";
import { revalidate } from "./lib/revalidate";

const BYLINE = "One Thousand Drones engineering team · verified 2026-07";
const VERIFIED_AT = new Date("2026-07-09T00:00:00.000Z");

type Lesson = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  clusterOrdinal: number;
  contentBlocks: ContentBlock[];
};

const LESSONS: Lesson[] = [
  // ── 0. bus-basics ─────────────────────────────────────────────────────────
  {
    slug: "bus-basics",
    title: "What is a bus?",
    seoTitle: "What is a bus? Serial vs parallel communication explained",
    seoDescription:
      "A bus is the shared wires plus the rules that let chips exchange data. Serial vs parallel, what a protocol fixes, and controller vs peripheral, in plain terms.",
    clusterOrdinal: 0,
    contentBlocks: [
      { type: "prose", md: "A bus is a set of shared wires plus the rules for using them, and it is how the chips on a board pass data to each other. The rules are the protocol: which wire carries what, when a bit counts as valid, and who is allowed to talk. Get the bus right and two parts that have never met can trade bytes reliably." },
      { type: "heading", text: "Serial or parallel?" },
      { type: "prose", md: "A serial bus sends bits one at a time down a couple of wires. A parallel bus sends a whole byte at once across eight or more. Parallel moves more per clock tick, but it spends a pin on every bit and every trace has to stay length-matched. On a small board, pins and space are the scarce thing, so almost every on-board bus is serial." },
      { type: "sourceRef", label: "SparkFun. Serial Communication (serial vs parallel, logic levels).", href: "https://learn.sparkfun.com/tutorials/serial-communication" },
      { type: "heading", text: "What a protocol fixes" },
      { type: "prose", md: "A protocol is the agreement both sides keep. It fixes the framing (where a byte starts and stops), the timing (how fast bits move, and whether a separate clock marks each one), and the roles (which chip drives the exchange). Two chips that follow the same protocol interoperate even when different companies built them." },
      { type: "heading", text: "Controller and peripheral" },
      { type: "prose", md: "Most buses have one part that starts each transfer, the controller, and one or more that answer, the peripherals. The controller decides when a transfer happens and, on a clocked bus, supplies the clock. Older datasheets call these two roles master and slave; the idea is the same." },
      { type: "deepDive", summary: "Clocked vs clockless buses", body: "A clocked bus carries a separate clock line, so the receiver samples each bit on a clock edge and the two sides stay in step even at high speed. SPI and I2C work this way. A clockless, or asynchronous, bus sends no clock, so both ends must be preset to the same speed and agree on the bit timing in advance. UART works this way. The clock is why a clocked bus can push more data before the two sides drift out of time with each other." },
      { type: "image", src: "/guide-diagrams/comms-serial-vs-parallel.svg", alt: "A serial link sending bits one at a time on one wire, beside a parallel link sending eight bits at once on eight wires.", caption: "Serial sends bits one at a time on few wires; parallel sends many at once on many wires." },
      { type: "prose", md: "On a One Thousand Drones board every on-board data link is serial: USB back to your computer, and a serial bus out to each sensor. That is what keeps the pin count low and the board small." },
      { type: "quiz", questions: [
        { q: "Why is serial usually preferred over parallel on a small board?", options: ["It sends a whole byte at once", "It uses far fewer pins and traces", "It needs no protocol"], answer: 1, explain: "Serial spends only a couple of wires; parallel costs a pin and a matched trace for every bit, which a small board cannot spare." },
        { q: "What is a bus protocol?", options: ["The speed of the fastest chip", "A single shared ground wire", "The agreed rules for framing, timing, and roles"], answer: 2, explain: "The protocol is the agreement both sides keep about framing, timing, and who talks; it is what lets parts from different makers interoperate." },
        { q: "On most buses, which part starts a transfer?", options: ["The controller", "The slowest peripheral", "The pull-up resistor"], answer: 0, explain: "The controller decides when a transfer happens; peripherals answer when addressed." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage, current, and resistance", href: "/library/voltage-current-resistance" },
      { type: "sourceRef", label: "Next: UART, asynchronous serial", href: "/library/uart-explained" },
    ],
  },

  // ── 1. uart-explained ─────────────────────────────────────────────────────
  {
    slug: "uart-explained",
    title: "UART, asynchronous serial",
    seoTitle: "UART explained: TX, RX, baud rate, and framing",
    seoDescription:
      "UART is the simplest serial link: two wires, no shared clock, an agreed baud rate and framing. How TX/RX crossover works and what both sides must match.",
    clusterOrdinal: 1,
    contentBlocks: [
      { type: "prose", md: "UART is the simplest way two chips talk over a serial line: two wires, no shared clock, and one agreed speed. One wire carries data out (`TX`), the other carries it in (`RX`), and as long as both ends are set to the same baud rate and framing, bytes cross reliably. It is how a board talks to a terminal, a GPS, or a plug-in module." },
      { type: "heading", text: "TX, RX, and the crossover" },
      { type: "prose", md: "Each device has a transmit pin (`TX`) and a receive pin (`RX`). You wire one device's `TX` to the other's `RX`, and back again, a crossover, so each side's output lands on the other's input. Both share a common ground. It is full-duplex: both directions can carry data at the same time." },
      { type: "heading", text: "Baud rate and framing" },
      { type: "prose", md: "Because there is no clock line, both ends have to be preset to the same bit rate, the baud rate, with `9600` and `115200` being common. Each byte is wrapped in a frame: the idle-high line drops for one start bit, then the data bits (usually 8), an optional parity bit, then one or two stop bits. Miss the baud or the framing and the same bits arrive as garbage." },
      { type: "sourceRef", label: "SparkFun. Serial Communication (asynchronous serial, baud rate, framing).", href: "https://learn.sparkfun.com/tutorials/serial-communication" },
      { type: "math", tex: "t_{bit} = \\frac{1}{baud} \\qquad t_{frame} = \\frac{10}{baud}", plain: "t_bit = 1 / baud,   t_frame (8N1) = 10 / baud" },
      { type: "prose", md: "The math is simple. At `115200` baud each bit lasts about `8.7 us`, so a plain 8N1 byte, ten bits counting its start and stop, takes about `87 us`. That figure is the real ceiling on how fast a single UART link moves data." },
      { type: "deepDive", summary: "How far the two clocks can drift", body: "Since each side runs its own clock, they only have to stay in step for the length of one frame, about ten bits, and the receiver resyncs on every start bit. That is why a small speed error is tolerable: the usual budget is a few percent before the last data bit samples at the wrong moment. A wildly wrong baud, double or half the target, fails completely, while a close-but-imperfect crystal usually still works. When a UART prints garbled characters, a wrong baud rate is the first thing to check." },
      { type: "image", src: "/guide-diagrams/comms-uart-frame.svg", alt: "A UART frame on a timeline: the idle-high line drops for a start bit, then eight data bits, then a stop bit.", caption: "One UART frame: idle high, a start bit, the data bits, then a stop bit." },
      { type: "prose", md: "On a One Thousand Drones board the USB link presents itself to your computer as a serial port, and this same start-and-stop framing carries the boot log and your `print` output while you bring the board up." },
      { type: "quiz", questions: [
        { q: "What must two UART devices agree on before they can talk?", options: ["The baud rate and framing", "A shared clock line", "Their chip-select lines"], answer: 0, explain: "UART sends no clock, so both ends must be preset to the same baud rate and framing, or the bytes arrive as garbage." },
        { q: "How is one UART device's TX wired to the other device?", options: ["TX to TX, RX to RX", "In a crossover: TX to RX both ways", "Both to a single shared wire"], answer: 1, explain: "Each side's transmit pin drives the other's receive pin, so the wiring crosses over." },
        { q: "UART has no clock line, so what marks the start of each byte?", options: ["A chip-select pulse", "A rising clock edge", "A start bit that pulls the idle line low"], answer: 2, explain: "The idle-high line drops for one start bit, which tells the receiver a frame is coming." },
      ] },
      { type: "sourceRef", label: "Prerequisite: what is a bus?", href: "/library/bus-basics" },
      { type: "sourceRef", label: "Next: SPI, the four-wire bus", href: "/library/spi-bus" },
    ],
  },

  // ── 2. spi-bus ────────────────────────────────────────────────────────────
  {
    slug: "spi-bus",
    title: "SPI, the four-wire bus",
    seoTitle: "SPI explained: SCK, MOSI, MISO, and chip-select",
    seoDescription:
      "SPI is the fast clocked serial bus: a controller drives the clock, picks a peripheral with chip-select, and data flows both ways on MOSI and MISO.",
    clusterOrdinal: 2,
    contentBlocks: [
      { type: "prose", md: "SPI is the fast bus on a board. A controller drives a clock line, picks one peripheral with a chip-select, and data moves both ways at once on two data lines. When an ADC or a display has to shift a lot of data quickly, it is usually on SPI." },
      { type: "heading", text: "The four lines" },
      { type: "prose", md: "SPI uses four signals. `SCK` is the clock the controller drives. `MOSI` carries data from controller to peripheral, `MISO` carries it back the other way, so the bus is full-duplex. `CS`, the chip-select, picks which peripheral is active. Every peripheral shares `SCK`, `MOSI`, and `MISO`, and gets its own `CS`." },
      { type: "sourceRef", label: "SparkFun. Serial Peripheral Interface (SPI): the four lines, modes, and chip-select.", href: "https://learn.sparkfun.com/tutorials/serial-peripheral-interface-spi" },
      { type: "heading", text: "One chip-select per peripheral" },
      { type: "prose", md: "The controller talks to exactly one peripheral at a time by pulling that peripheral's `CS` low; the rest ignore the bus while their `CS` stays high. Add a second peripheral and you add one more `CS` pin. That is the main cost of SPI: the bus is fast, and each peripheral you add costs another pin." },
      { type: "deepDive", summary: "SPI modes: CPOL and CPHA", body: "SPI has four modes set by two choices: the clock's idle level (CPOL) and which clock edge the data is sampled on (CPHA). Both ends must use the same mode, or every byte reads wrong, and the peripheral's datasheet states which one it needs. Mode 0, an idle-low clock sampled on the rising edge, is the common default. A wrong mode is a frequent first-bringup bug: the wiring checks out, the clock runs, and the data is still nonsense, because the two sides disagree on which edge carries the bit." },
      { type: "image", src: "/guide-diagrams/comms-spi-bus.svg", alt: "One SPI controller wired to two peripherals: shared SCK, MOSI, and MISO lines, with a separate chip-select to each peripheral.", caption: "One controller, two peripherals: shared SCK/MOSI/MISO, and a chip-select for each." },
      { type: "prose", md: "On a One Thousand Drones precision-ADC board the converter rides SPI so the microcontroller can pull sample after sample fast enough to keep up with the signal, with a single chip-select line picking it out." },
      { type: "quiz", questions: [
        { q: "What selects which SPI peripheral is active?", options: ["Its chip-select (CS) line", "Its baud rate", "Its I2C address"], answer: 0, explain: "The controller pulls one peripheral's CS low to talk to it; the others stay idle while their CS is high." },
        { q: "On SPI, which line carries the clock?", options: ["MOSI", "MISO", "SCK"], answer: 2, explain: "SCK is the clock the controller drives; MOSI and MISO carry the two directions of data." },
        { q: "Add another SPI peripheral to the bus and what does it cost you?", options: ["A slower clock for all devices", "Nothing, they share every line", "One more chip-select pin"], answer: 2, explain: "Peripherals share SCK/MOSI/MISO, but each needs its own chip-select, so every added device costs a pin." },
      ] },
      { type: "sourceRef", label: "Prerequisite: what is a bus?", href: "/library/bus-basics" },
      { type: "sourceRef", label: "See it on a real board: the precision ADC build", href: "/courses/l2-02-ads1220-sense" },
      { type: "sourceRef", label: "Next: I2C, the two-wire bus", href: "/library/i2c-bus" },
    ],
  },

  // ── 3. i2c-bus ────────────────────────────────────────────────────────────
  {
    slug: "i2c-bus",
    title: "I2C, the two-wire bus",
    seoTitle: "I2C explained: SDA, SCL, addresses, and pull-ups",
    seoDescription:
      "I2C puts a whole bus of devices on two wires, SDA and SCL, each with an address. Why it needs pull-up resistors, and how it trades speed for pins.",
    clusterOrdinal: 3,
    contentBlocks: [
      { type: "prose", md: "I2C gets a whole bus of devices onto just two wires. A clock (`SCL`) and a data line (`SDA`) are shared by every device, and each one answers to its own address. When you have several slow sensors and few pins to spare, I2C is the bus to reach for." },
      { type: "heading", text: "Two wires, many devices" },
      { type: "prose", md: "Every device hangs on the same `SDA` and `SCL` pair. The controller starts a transfer by sending the 7-bit address of the device it wants; only that device responds, and the rest stay quiet. That is how a dozen parts share one pair of wires with no extra pins." },
      { type: "sourceRef", label: "NXP. UM10204 I2C-bus specification and user manual (7-bit addressing, open-drain lines, standard and fast-mode data rates).", href: "https://www.pololu.com/file/0J435/UM10204.pdf" },
      { type: "heading", text: "Open-drain and the pull-ups" },
      { type: "prose", md: "I2C lines are open-drain: a device can only pull a line low, never drive it high. A pull-up resistor on each line restores it to high whenever nothing is pulling it down. Leave the pull-ups off and both lines sit at an undefined level and the bus does nothing, which is the classic first I2C mistake. A `4.7 kΩ` pull-up is a good starting value." },
      { type: "sourceRef", label: "SparkFun. I2C (open-drain lines, pull-up resistors, addressing).", href: "https://learn.sparkfun.com/tutorials/i2c" },
      { type: "deepDive", summary: "How fast, and the trade against SPI", body: "I2C runs at `100 kbit/s` in standard mode and `400 kbit/s` in fast mode, with faster modes defined but less common (NXP UM10204). That is well below SPI, and the open-drain lines pulled up by resistors limit how fast the signals can rise back to high. The payoff is the pin count: two wires carry the whole bus no matter how many devices you add, where SPI needs another chip-select for each one. Slow and pin-thrifty is exactly the right trade for a handful of housekeeping sensors." },
      { type: "image", src: "/guide-diagrams/comms-i2c-bus.svg", alt: "An I2C bus: two pull-up resistors on SDA and SCL, with several addressed devices sharing the same two lines.", caption: "One SDA/SCL pair, two pull-ups, and many devices, each reached by its address." },
      { type: "prose", md: "On a One Thousand Drones board a small I2C sensor shares its two lines with the rest of the bus and is reached by its address, so adding it costs no new microcontroller pins." },
      { type: "quiz", questions: [
        { q: "Why does I2C need pull-up resistors?", options: ["To raise the bus speed", "The lines are open-drain, so a pull-up sets the idle-high level", "To give each device its address"], answer: 1, explain: "Devices can only pull the lines low; the pull-up is what returns a line to high when nothing drives it." },
        { q: "How does an I2C controller pick which device it talks to?", options: ["The device's 7-bit address sent on the bus", "A chip-select line per device", "A different clock wire per device"], answer: 0, explain: "The controller sends a 7-bit address, and only the matching device responds; there are no per-device select lines." },
        { q: "Compared with SPI, I2C is generally which of these?", options: ["Faster but needs more pins", "Faster and needs fewer pins", "Slower but needs fewer pins"], answer: 2, explain: "I2C trades speed for pins: two wires for the whole bus, at a lower data rate than SPI." },
      ] },
      { type: "sourceRef", label: "Prerequisite: resistors", href: "/library/resistors" },
      { type: "sourceRef", label: "Related: pull-ups, pull-downs, and the idle line", href: "/library/pull-ups-and-pull-downs" },
      { type: "sourceRef", label: "Next: SPI vs I2C vs UART", href: "/library/spi-vs-i2c-vs-uart" },
    ],
  },

  // ── 4. spi-vs-i2c-vs-uart ─────────────────────────────────────────────────
  {
    slug: "spi-vs-i2c-vs-uart",
    title: "SPI vs I2C vs UART",
    seoTitle: "SPI vs I2C vs UART: how to pick a bus",
    seoDescription:
      "Pick the bus by the job. UART for a simple stream, I2C when pins are short and speed does not matter, SPI when you need speed. A side-by-side comparison.",
    clusterOrdinal: 4,
    contentBlocks: [
      { type: "prose", md: "Pick the bus by the job. Reach for UART for a simple point-to-point stream, I2C when you are short on pins and speed does not matter, and SPI when you need speed and can spare a pin per device. Most boards run more than one of them at once." },
      { type: "heading", text: "The trade-off at a glance" },
      { type: "table", columns: ["Bus", "Wires", "Clock", "Devices", "Speed"], rows: [
        [{ text: "UART" }, { text: "2 (TX, RX)" }, { text: "none (async)" }, { text: "2, point to point" }, { text: "low to moderate" }],
        [{ text: "I2C" }, { text: "2 (SDA, SCL)" }, { text: "shared" }, { text: "many, by address" }, { text: "moderate" }],
        [{ text: "SPI" }, { text: "3 plus 1 per device" }, { text: "shared" }, { text: "one per chip-select" }, { text: "high" }],
      ] },
      { type: "prose", md: "Read the table as three trade-offs. UART costs the fewest ideas but only joins two devices. I2C adds as many devices as you like on the same two wires, at a lower speed. SPI buys the highest speed and full-duplex data, and pays a chip-select pin for every peripheral." },
      { type: "heading", text: "Which bus does a part use?" },
      { type: "prose", md: "You rarely choose a sensor's bus; the part chooses for you. Its datasheet's first page states the interface, and that decides how you wire it and how many pins it costs. Read that line before you commit a design to a part." },
      { type: "sourceRef", label: "SparkFun. Serial Communication (a shared primer across UART, SPI, and I2C).", href: "https://learn.sparkfun.com/tutorials/serial-communication" },
      { type: "image", src: "/guide-diagrams/comms-bus-compare.svg", alt: "A three-column comparison of UART, I2C, and SPI by wire count, speed, and number of devices.", caption: "The three on-board buses side by side: wires, speed, and how many devices each carries." },
      { type: "prose", md: "A single One Thousand Drones board often carries all three at once: USB serial back to the host, SPI to a fast converter, and I2C to a slow housekeeping sensor, each chosen for what it connects to." },
      { type: "quiz", questions: [
        { q: "You are out of pins and the sensor is slow. Which bus fits?", options: ["SPI", "I2C", "UART"], answer: 1, explain: "I2C puts many devices on two wires at a modest speed, which is exactly the pin-starved, slow-sensor case." },
        { q: "You need the highest data rate to a fast ADC. Which bus fits?", options: ["SPI", "I2C", "UART"], answer: 0, explain: "SPI is the fastest of the three and is full-duplex, at the cost of a chip-select pin per device." },
        { q: "Where do you find out which bus a given sensor uses?", options: ["By measuring the idle voltage", "By counting its pins", "On the first page of its datasheet"], answer: 2, explain: "The interface is stated up front on the datasheet, so the part effectively picks the bus and you read it off the page." },
      ] },
      { type: "sourceRef", label: "See also: SPI, the four-wire bus", href: "/library/spi-bus" },
      { type: "sourceRef", label: "See also: I2C, the two-wire bus", href: "/library/i2c-bus" },
      { type: "sourceRef", label: "Next: USB basics", href: "/library/usb-basics" },
    ],
  },

  // ── 5. usb-basics ─────────────────────────────────────────────────────────
  {
    slug: "usb-basics",
    title: "USB basics",
    seoTitle: "USB basics: host, device, D+/D-, and enumeration",
    seoDescription:
      "USB is a negotiated bus. A host and a device enumerate over a differential pair (D+/D-) before any data flows. What enumeration is and why it matters.",
    clusterOrdinal: 5,
    contentBlocks: [
      { type: "prose", md: "USB is a negotiated bus. Before any of your data crosses the cable, a host and a device introduce themselves and agree on terms, a step called enumeration. That handshake is why a board pops up on your computer a second after you plug it in, and why USB carries more machinery than a plain serial link." },
      { type: "heading", text: "Host and device" },
      { type: "prose", md: "One end is the host, usually your computer, and the other is the device, the board. The host runs the bus: it powers it, starts every transfer, and manages who talks. A device stays quiet until the host asks it something." },
      { type: "heading", text: "One differential pair" },
      { type: "prose", md: "Full-speed and low-speed USB carry data on a single differential pair, `D+` and `D-`. The two wires swing in opposite directions and the receiver reads the difference between them, which cancels out noise that hits both wires alike. Power, on `VBUS` and ground, shares the same cable, so one connector both feeds the board and talks to it." },
      { type: "heading", text: "Enumeration, the handshake" },
      { type: "prose", md: "On plug-in the host detects the device, resets it, and asks it to describe itself. The device answers with descriptors: who it is, what it does, and how much current it needs. The host loads a matching driver, and only then does your application data start to flow." },
      { type: "sourceRef", label: "Beyond Logic. USB in a NutShell (host/device, descriptors, enumeration).", href: "https://www.beyondlogic.org/usbnutshell/usb1.shtml" },
      { type: "deepDive", summary: "Why USB is more than a fast UART", body: "A UART link is two chips preset to the same speed, and they just send bytes. USB does more before any payload moves: it detects the device on plug-in, resets it, assigns it an address, and reads its capabilities. That negotiation is what lets one port accept a keyboard, a flash drive, and your board with no manual setup, and it is why a USB stack is a real piece of firmware. On a small board you usually get it for free from the microcontroller's built-in USB, but the handshake is still happening under the hood." },
      { type: "image", src: "/guide-diagrams/comms-usb-enumerate.svg", alt: "A USB host and device linked by the D+/D- pair, with the enumeration handshake shown as a sequence of steps before data flows.", caption: "Host and device over D+/D-, and the enumeration handshake that runs before any data." },
      { type: "prose", md: "Plug a One Thousand Drones board into your computer and enumeration is the short pause before it appears as a serial port. The board describes itself, the host loads a driver, and your terminal opens." },
      { type: "quiz", questions: [
        { q: "What happens before USB application data can flow?", options: ["Enumeration: the device describes itself to the host", "The device picks a baud rate", "Both ends agree on a chip-select"], answer: 0, explain: "The host resets the device and reads its descriptors first; only then does a driver load and data move." },
        { q: "On a USB link, which end starts every transfer?", options: ["The device", "The host", "Whichever powers on first"], answer: 1, explain: "USB is host-directed: the device never speaks until the host asks." },
        { q: "Full-speed USB carries its data on what?", options: ["A single-ended TX and RX pair", "Eight parallel data lines", "A differential pair, D+ and D-"], answer: 2, explain: "The receiver reads the difference between D+ and D-, which cancels noise common to both wires." },
      ] },
      { type: "sourceRef", label: "Prerequisite: what is a bus?", href: "/library/bus-basics" },
      { type: "sourceRef", label: "See it on a real board: the USB-C breakout", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: USB-C, the connector", href: "/library/usb-c-connector" },
    ],
  },

  // ── 6. usb-c-connector ────────────────────────────────────────────────────
  {
    slug: "usb-c-connector",
    title: "USB-C, the connector",
    seoTitle: "USB-C explained: the CC pins and the 5.1 kohm resistors",
    seoDescription:
      "USB-C is reversible because of its CC pins, and a device declares its role with a resistor on CC. Why a simple board needs two 5.1 kohm pull-downs to get 5 V.",
    clusterOrdinal: 6,
    contentBlocks: [
      { type: "prose", md: "USB-C is reversible because of two extra pins called CC, the configuration channel. A device tells the host what it is by putting a resistor on CC, and for a simple board that resistor is the whole story: two `5.1 kΩ` pull-downs to ground, one on each CC pin, say I am a device, please give me `5 V`." },
      { type: "heading", text: "The reversible connector" },
      { type: "prose", md: "A USB-C plug goes in either way up. The host uses the CC pins to work out which way it went in and which CC pin is actually connected through the cable, then routes the signals to match. The CC pins are what make the reversibility work." },
      { type: "heading", text: "The 5.1 kilohm resistors" },
      { type: "prose", md: "On the device end, a `5.1 kΩ` resistor from each CC pin down to ground marks the port as a sink, a device that draws power. The host sees those pull-downs, recognizes a device, and turns on `5 V` on `VBUS`. Leave them off and a proper USB-C host never enables power, so the board stays dead even though the cable is fine. Two resistors, one on `CC1` and one on `CC2`, cover both plug orientations." },
      { type: "sourceRef", label: "Texas Instruments. A Primer on USB Type-C and USB Power Delivery Applications and Requirements (SLYY109): CC roles, sink Rd pull-downs.", href: "https://www.ti.com/lit/slyy109" },
      { type: "sourceRef", label: "Texas Instruments. TUSB320 datasheet: a sink presents 5.1 kohm +/-20% (Rd) on CC.", href: "https://www.ti.com/lit/gpn/TUSB320" },
      { type: "callout", severity: "warn", label: "No CC resistors, no power", body: "This is the number-one dead-USB-C-board bug. A compliant USB-C host will not switch on `VBUS` until it sees the `5.1 kΩ` pull-down that marks a sink. Forget the two resistors and the board looks fully wired and stays completely dead, with no `5 V` anywhere. Check for them first when a fresh USB-C board shows no power." },
      { type: "deepDive", summary: "Why two resistors, and why not just tie CC to ground", body: "Each CC pin gets its own `5.1 kΩ` because only one of the two is connected through any given cable, and the resistor has to be present whichever way the plug went in. The specific value matters: the host reads the size of the pull-down to decide the role, so a dead short to ground or a wrong value reads as a different kind of port. A plain `5 V` board needs nothing more than these two resistors. USB Power Delivery, which negotiates higher voltages like `9 V` or `20 V`, adds an active chip that actually talks on the CC line, which a simple board does not need." },
      { type: "image", src: "/guide-diagrams/comms-usb-c-cc.svg", alt: "A USB-C receptacle with the two CC pins, each carrying a 5.1 kohm pull-down resistor to ground to set the device role.", caption: "A USB-C receptacle with a 5.1 kohm resistor on each CC pin, setting the device role." },
      { type: "prose", md: "This is exactly the One Thousand Drones L1.01 board's USB-C input: two `5.1 kΩ` resistors from `CC1` and `CC2` to ground, and nothing more, because the board only needs the default `5 V`. It is the smallest circuit that makes a USB-C port come alive." },
      { type: "quiz", questions: [
        { q: "What do the two `5.1 kΩ` resistors on the CC pins do?", options: ["Set the port's device/sink role so the host provides 5 V", "Speed up the USB data lines", "Protect against reverse polarity"], answer: 0, explain: "The host reads the pull-downs as a sink asking for power, and only then enables 5 V on VBUS." },
        { q: "Why are there two CC resistors instead of one?", options: ["One is a spare", "To cover both plug orientations", "To double the current"], answer: 1, explain: "Only one CC pin connects through any given cable, so each needs its own resistor to work either way up." },
        { q: "Does a simple 5 V USB-C board need USB Power Delivery to get power?", options: ["Yes, PD is always required", "No, the CC resistors alone get the default 5 V", "Only if the cable is reversible"], answer: 1, explain: "PD is for negotiating higher voltages; the plain 5 V default just needs the two CC pull-downs." },
      ] },
      { type: "sourceRef", label: "See it on a real board: the L1.01 USB-C breakout", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Prerequisite: resistors", href: "/library/resistors" },
      { type: "sourceRef", label: "Next: level shifting", href: "/library/level-shifting" },
    ],
  },

  // ── 7. level-shifting ─────────────────────────────────────────────────────
  {
    slug: "level-shifting",
    title: "Level shifting",
    seoTitle: "Level shifting explained: 3.3 V and 5 V logic levels",
    seoDescription:
      "A 3.3 V chip and a 5 V chip cannot always share a line safely. What logic levels are, the risk of over-voltage, and the kinds of level shifter to use.",
    clusterOrdinal: 7,
    contentBlocks: [
      { type: "prose", md: "A `3.3 V` chip and a `5 V` chip cannot always share a signal wire safely, and a level shifter is the part that translates between them. Before you connect two parts, check their logic levels, because driving a `3.3 V` input with `5 V` can damage it." },
      { type: "heading", text: "Logic levels" },
      { type: "prose", md: "A digital line stands for a 1 or a 0 by its voltage. Each input has a threshold above which it reads high (`VIH`) and below which it reads low (`VIL`). A `3.3 V` part and a `5 V` part have different thresholds, so a level that reads clearly high to one can sit in the undefined middle of the other." },
      { type: "sourceRef", label: "SparkFun. Serial Communication (logic levels, 3.3 V vs 5 V).", href: "https://learn.sparkfun.com/tutorials/serial-communication" },
      { type: "heading", text: "The risk, and when you can skip it" },
      { type: "prose", md: "The danger runs one way. Feeding a `5 V` output into a `3.3 V` input can push the pin past its maximum rated voltage and degrade it over time. Going the other way, a `3.3 V` output into a `5 V` input, is usually safe electrically, though it may not reach the higher part's high threshold. Some pins are `5 V` tolerant and need no shifter at all; the datasheet says which ones." },
      { type: "heading", text: "Kinds of shifter" },
      { type: "prose", md: "For a slow one-way input, a resistor divider can knock `5 V` down to about `3.3 V`. For a bidirectional bus like I2C, a single MOSFET per line shifts both directions at once, and for anything fast a dedicated level-translator IC does the job cleanly." },
      { type: "sourceRef", label: "SparkFun. Bi-Directional Logic Level Converter Hookup Guide (MOSFET shifter for I2C).", href: "https://learn.sparkfun.com/tutorials/bi-directional-logic-level-converter-hookup-guide" },
      { type: "math", tex: "V_{out} = V_{in} \\cdot \\frac{R_2}{R_1 + R_2}", plain: "Vout = Vin x R2 / (R1 + R2)" },
      { type: "deepDive", summary: "Why a divider only works for slow signals", body: "A resistor divider drops the voltage, but the capacitance of the wire and the receiving input forms an RC with those resistors, so the shifted signal rounds off and slows down. At a few kilohertz that is fine; at megahertz the edges smear and the data is lost. That is why a divider suits a slow enable line or a low-baud UART, and a fast bus wants an active translator that drives both edges hard. The same RC idea sizes an anti-alias filter in the reactive-parts guide." },
      { type: "image", src: "/guide-diagrams/comms-level-shift.svg", alt: "A signal crossing from a 5 V domain to a 3.3 V domain through a level shifter, with both voltage domains labelled.", caption: "A line crossing from a 5 V domain to a 3.3 V domain through a level shifter." },
      { type: "prose", md: "On a One Thousand Drones board a `3.3 V` microcontroller reads a `5 V`-tolerant input directly where the datasheet allows it, and gets a shifter only where a part truly runs at a different level. Checking the levels first is what keeps a pin from slowly failing." },
      { type: "quiz", questions: [
        { q: "Why can driving a `3.3 V` pin with `5 V` be a problem?", options: ["It can exceed the pin's maximum rating and damage it", "It makes the signal too slow", "It shorts the two grounds"], answer: 0, explain: "Over-voltage on a pin can push it past its absolute maximum and degrade or destroy it over time." },
        { q: "For a bidirectional I2C bus, a common level shifter is which of these?", options: ["A single resistor", "A diode in series", "A MOSFET per line"], answer: 2, explain: "A single MOSFET per line shifts both directions, which is what a bidirectional bus like I2C needs." },
        { q: "When can you skip a level shifter entirely?", options: ["Never, always shift", "When the input pin is rated 5 V tolerant", "When the wire is short"], answer: 1, explain: "A 5 V-tolerant input can take the higher level safely, so no shifter is needed; the datasheet says which pins qualify." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage dividers", href: "/library/voltage-dividers" },
      { type: "sourceRef", label: "Related: reactive parts and filtering", href: "/library/reactive-and-filtering" },
      { type: "sourceRef", label: "Next: pull-ups, pull-downs, and the idle line", href: "/library/pull-ups-and-pull-downs" },
    ],
  },

  // ── 8. pull-ups-and-pull-downs ────────────────────────────────────────────
  {
    slug: "pull-ups-and-pull-downs",
    title: "Pull-ups, pull-downs, and the idle line",
    seoTitle: "Pull-up and pull-down resistors explained",
    seoDescription:
      "A floating input reads noise; a pull-up or pull-down resistor gives a line a known default. How buses set their idle level, and how to size the resistor.",
    clusterOrdinal: 8,
    contentBlocks: [
      { type: "prose", md: "A digital input wired to nothing floats. With no driver, its voltage wanders with noise coupled from nearby signals, so it flickers between high and low and the chip cannot tell a 1 from a 0. A pull-up or pull-down resistor fixes that by tying the line to a known default level, and getting that default wrong is a classic reason a bus sits dead." },
      { type: "heading", text: "A floating pin is undefined" },
      { type: "prose", md: "An input pin with nothing driving it has no defined voltage, so stray coupling from nearby signals swings it around unpredictably. A weak resistor to a rail settles it: a pull-up to the supply holds the line high, a pull-down to ground holds it low, until something actively drives it the other way." },
      { type: "sourceRef", label: "SparkFun. Pull-up Resistors (floating pins, when and where to use a pull-up).", href: "https://learn.sparkfun.com/tutorials/pull-up-resistors" },
      { type: "heading", text: "Idle level by convention" },
      { type: "prose", md: "Each bus sets its resting level on purpose. I2C's open-drain lines idle high through their pull-ups. A UART line idles high and drops for the start bit. A reset or enable line carries a pull-up or pull-down so the chip powers up in a known state instead of a random one." },
      { type: "math", tex: "I = \\frac{V_{cc}}{R}", plain: "I = Vcc / R" },
      { type: "prose", md: "The resistor value is a trade-off. A `10 kΩ` pull-up on a `3.3 V` rail passes only about `0.33 mA` when the line is held low, which is easy on the driver but slow to pull the line back high. A stronger `1 kΩ` snaps it high faster and costs about `3.3 mA`. Fast buses want the stronger pull-up; low-power designs want the weaker one." },
      { type: "deepDive", summary: "Internal pull-ups on a microcontroller", body: "Most microcontroller pins have a weak pull-up, and often a pull-down, built in that firmware can switch on, typically tens of kilohms. It saves a part on an undemanding line like a button input. For a bus with real speed or noise requirements, an external resistor of a value you chose is still the better call, because the internal one is weak and only loosely specified. So a button gets the internal pull-up, and an I2C bus gets external ones sized for the job." },
      { type: "image", src: "/guide-diagrams/comms-pull-up-down.svg", alt: "A pin shown three ways: with a pull-up resistor holding it high, with a pull-down holding it low, and floating with no resistor.", caption: "The same pin three ways: pulled up to high, pulled down to low, or left floating." },
      { type: "prose", md: "On a One Thousand Drones board the I2C lines carry their pull-ups, and the microcontroller's boot-strap and enable pins carry pull-ups or pull-downs so the chip always starts in the state the design intends." },
      { type: "quiz", questions: [
        { q: "What does a pull-up resistor do to an idle line?", options: ["Holds it at a known high level", "Speeds up the clock", "Blocks all current"], answer: 0, explain: "A pull-up ties the line to the supply, so it rests high until something actively pulls it low." },
        { q: "An input pin connected to nothing does what?", options: ["Reads a steady 0", "Floats and picks up noise", "Damages the chip"], answer: 1, explain: "With nothing driving it, the pin has no defined level and stray coupling swings it around." },
        { q: "Which bus relies on pull-ups because its lines are open-drain?", options: ["SPI", "UART", "I2C"], answer: 2, explain: "I2C devices only pull low, so a pull-up on each line supplies the idle-high level." },
      ] },
      { type: "sourceRef", label: "Prerequisite: resistors", href: "/library/resistors" },
      { type: "sourceRef", label: "Related: I2C, the two-wire bus", href: "/library/i2c-bus" },
      { type: "sourceRef", label: "Next: digital isolation", href: "/library/digital-isolation" },
    ],
  },

  // ── 9. digital-isolation ──────────────────────────────────────────────────
  {
    slug: "digital-isolation",
    title: "Digital isolation",
    seoTitle: "Digital isolation explained: crossing a barrier without a ground",
    seoDescription:
      "A digital isolator passes bits across an insulating barrier with no shared ground, for safety or to break a noise loop. How it works and how to isolate a bus.",
    clusterOrdinal: 9,
    contentBlocks: [
      { type: "prose", md: "Sometimes two parts of a system have to trade digital signals without sharing a ground wire, for safety or to stop a noise loop. A digital isolator does exactly that: it carries the bits across an insulating barrier, so the two sides pass data with no direct electrical connection between them." },
      { type: "heading", text: "Why isolate at all" },
      { type: "prose", md: "There are two reasons. Safety: keep a person, or a delicate circuit, on one side clear of any fault current on the other, which matters whenever mains power or a human body is in the loop. Noise: when two grounds sit at slightly different voltages, current flows in the ground itself, a ground loop, and isolation breaks that loop by cutting the shared connection." },
      { type: "sourceRef", label: "Texas Instruments. Digital Isolator Design Guide (SLLA284): what isolation is and how it works.", href: "https://www.ti.com/lit/pdf/slla284" },
      { type: "heading", text: "How it crosses the barrier" },
      { type: "prose", md: "An isolator has a transmitter on one side, a receiver on the other, and an insulating barrier between them that blocks direct current while letting the signal across. The barrier is often a tiny capacitor or transformer built into the chip; an older optocoupler uses light across a gap. What never crosses is a direct electrical or ground connection." },
      { type: "deepDive", summary: "Isolators vs optocouplers, and isolating the power", body: "An optocoupler sends the signal as light: an LED on one side, a photo-transistor on the other, with an air or resin gap between them. It works, but it is slow and it ages as the LED dims. A modern digital isolator sends the signal across a capacitive or magnetic barrier instead, which is faster, more stable, and packs several channels into one chip (TI SLLA284). Isolating the signal is only half the job. The far side still needs power, so a fully isolated link adds an isolated DC-DC converter to carry energy across the same barrier, again with no shared ground." },
      { type: "heading", text: "Isolating a whole bus" },
      { type: "prose", md: "To isolate a bus like SPI or UART, you pass each of its signals through its own isolator channel, matching the direction of each line. A four-wire SPI link needs four channels routed the right way. The controller then talks to the peripheral exactly as before, with the barrier invisible in the middle." },
      { type: "image", src: "/guide-diagrams/comms-isolation-barrier.svg", alt: "A bus crossing a vertical isolation barrier, with a separate ground symbol on each side and no direct wire between them.", caption: "A bus crossing an isolation barrier: two separate grounds, and no direct electrical connection." },
      { type: "prose", md: "A One Thousand Drones isolated bridge board does this on purpose: a full SPI bus crosses a digital isolator so the sensor side and the computer side never share a ground, which is what keeps a person safe when the sensor sits on skin." },
      { type: "quiz", questions: [
        { q: "What does a digital isolator NOT carry across its barrier?", options: ["The data bits", "A direct electrical or ground connection", "The clock signal"], answer: 1, explain: "The point of the barrier is that no direct electrical or ground path crosses it; the bits still get through." },
        { q: "One reason to isolate two parts of a board is which of these?", options: ["To break a ground loop and cut noise", "To share a single ground", "To raise the bus speed"], answer: 0, explain: "Cutting the shared ground breaks the loop current, and it also protects a person from fault current on the other side." },
        { q: "To isolate a four-wire SPI bus, you need what?", options: ["One isolator channel for the whole bus", "No isolation, SPI is already isolated", "A channel for each of the four signals"], answer: 2, explain: "Each SPI line crosses on its own channel, routed to match that line's direction." },
      ] },
      { type: "sourceRef", label: "See it on a real board: the isolated SPI-bridge build", href: "/courses/l2-05-isolated-spi-bridge" },
      { type: "sourceRef", label: "Prerequisite: grounds and power rails", href: "/library/grounds-and-power-rails" },
      { type: "sourceRef", label: "Next: debugging a bus", href: "/library/debugging-a-bus" },
    ],
  },

  // ── 10. debugging-a-bus ───────────────────────────────────────────────────
  {
    slug: "debugging-a-bus",
    title: "Debugging a bus",
    seoTitle: "How to debug a bus: the usual suspects and a logic analyzer",
    seoDescription:
      "When a bus does nothing, the fault is usually simple: a missing pull-up, the wrong mode, an address clash, or a swapped wire. A logic analyzer shows the exact bytes.",
    clusterOrdinal: 10,
    contentBlocks: [
      { type: "prose", md: "When a bus does nothing, the cause is almost always simple and physical: a missing pull-up, the wrong mode, two devices at one address, or a swapped wire. The fastest way to find it is a logic analyzer, which shows you the actual bits on the wire and turns a dead bus into a specific fault you can point at." },
      { type: "heading", text: "Check power and ground first" },
      { type: "prose", md: "Before you suspect the protocol, confirm the boring things: both parts are powered, they share a common ground, and the wires go where you think they do. A missing ground between two boards is the single most common reason a bus is silent." },
      { type: "heading", text: "The usual suspects" },
      { type: "prose", md: "Match the symptom to the bus. On I2C, no pull-ups means the lines never reach a valid high, so nothing moves, and two devices at the same address answer at once and collide. On SPI, the wrong mode (CPOL/CPHA) makes every byte read wrong even though the wiring is right. On UART, a baud mismatch prints garbage, and swapped `TX` and `RX` means nothing arrives at all." },
      { type: "heading", text: "The logic analyzer" },
      { type: "prose", md: "A logic analyzer clips onto the bus lines, records their exact high-low timing, then decodes it into bytes, addresses, and acknowledgements. It shows whether the clock is even running, whether a device answered, and where the sequence broke. An inexpensive analyzer with a `sigrok`/PulseView setup is enough for most on-board buses." },
      { type: "sourceRef", label: "SparkFun. Using the USB Logic Analyzer with sigrok PulseView (capturing and decoding a bus).", href: "https://learn.sparkfun.com/tutorials/using-the-usb-logic-analyzer-with-sigrok-pulseview" },
      { type: "callout", severity: "info", label: "When a bus is silent, in this order", body: "Work from the most common cause outward, so your first probe lands on the likely fault before the rare one." },
      { type: "steps", ordered: true, items: [
        "Confirm power and a shared ground. Both parts powered, both grounds tied together, before anything else.",
        "Check the wiring against the schematic. `TX` to `RX`, `SDA` to `SDA`, no swapped pair.",
        "For I2C, confirm the pull-ups are present and no two devices share an address.",
        "For SPI, confirm the mode (CPOL/CPHA) matches the peripheral's datasheet.",
        "For UART, confirm both ends are set to the same baud rate.",
        "Clip on a logic analyzer and read the actual bits: is the clock running, and did the device answer?",
      ] },
      { type: "image", src: "/guide-diagrams/comms-bus-trace.svg", alt: "A captured logic-analyzer trace of an I2C transfer with an annotated failure: the controller sends an address and gets no acknowledgement.", caption: "A captured I2C trace with the failure annotated: an address sent, and no acknowledgement back." },
      { type: "prose", md: "Bringing up a One Thousand Drones board, an analyzer on the I2C lines shows the controller sending an address and then either an acknowledgement from the sensor or silence, which tells you in a single capture whether the part is alive, mis-addressed, or missing its pull-ups." },
      { type: "quiz", questions: [
        { q: "Two I2C devices answer at once. What is the likely cause?", options: ["A baud-rate mismatch", "An address clash: two devices at the same address", "A missing chip-select"], answer: 1, explain: "I2C picks a device by address, so two parts sharing an address both respond and collide." },
        { q: "A bus between two separate boards is silent. What is the most common physical cause?", options: ["No shared ground between them", "Too much data", "The clock is too fast"], answer: 0, explain: "Without a common ground the signals have no shared reference, and the bus does nothing; check it first." },
        { q: "SPI is wired correctly but every byte reads wrong. What is the likely cause?", options: ["A missing pull-up", "An I2C address clash", "The wrong SPI mode (CPOL/CPHA)"], answer: 2, explain: "If the mode is wrong, the two sides sample on different clock edges and the data comes out scrambled even with correct wiring." },
      ] },
      { type: "sourceRef", label: "Related: SPI, the four-wire bus", href: "/library/spi-bus" },
      { type: "sourceRef", label: "Related: I2C, the two-wire bus", href: "/library/i2c-bus" },
    ],
  },
];

// ── validation (no DB) ──────────────────────────────────────────────────────
function validate(): void {
  const EM_DASH = "—";
  let ok = true;
  const answerPositions: number[] = [];
  const seen = new Set<string>();
  for (const l of LESSONS) {
    if (seen.has(l.slug)) {
      ok = false;
      console.error(`[${l.slug}] DUPLICATE slug in this seed`);
    }
    seen.add(l.slug);
    const parsed = guideContentBlocksSchema.safeParse(l.contentBlocks);
    if (!parsed.success) {
      ok = false;
      console.error(`[${l.slug}] INVALID blocks:`, JSON.stringify(parsed.error.issues, null, 2));
      continue;
    }
    for (const b of l.contentBlocks) {
      if (!LIBRARY_BLOCK_TYPES.has(b.type)) {
        ok = false;
        console.error(`[${l.slug}] non-library block type: ${b.type}`);
      }
      if (b.type === "quiz") for (const q of b.questions) answerPositions.push(q.answer);
      if (b.type === "math") {
        try {
          katex.renderToString(b.tex, { throwOnError: true });
        } catch (e) {
          ok = false;
          console.error(`[${l.slug}] BAD LaTeX \`${b.tex}\`: ${(e as Error).message}`);
        }
      }
    }
    if (JSON.stringify(l).includes(EM_DASH)) {
      ok = false;
      console.error(`[${l.slug}] CONTAINS EM-DASH`);
    }
    // Every glyph in the content must render in the field-guide PDF (a body face
    // has it, or the render fallback set + Saira do). Catches a symbol that would
    // .notdef-box in print before it ships. See pdf-glyphs.test.ts for the twin
    // guard over the tool registry.
    for (const g of pdfGlyphIssues(JSON.stringify(l.contentBlocks), PDF_SAIRA_FALLBACK)) {
      ok = false;
      console.error(`[${l.slug}] PDF-unrenderable glyph "${g.char}" (${g.codepoint}) — ${g.kind}`);
    }
  }
  const spread = answerPositions.reduce<Record<number, number>>((m, a) => ((m[a] = (m[a] ?? 0) + 1), m), {});
  console.log(`answer-key spread across ${answerPositions.length} questions:`, JSON.stringify(spread));
  if (!ok) process.exit(1);
  console.log(`validated ${LESSONS.length} lessons OK`);
}

// ── seed (PROD) ─────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  const { db } = await import("@/lib/db");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No ADMIN user found to own the lessons");
  for (const l of LESSONS) {
    const row = await db.miniLesson.upsert({
      where: { slug: l.slug },
      update: {
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "comms-interfaces",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
      },
      create: {
        slug: l.slug,
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "comms-interfaces",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
        createdById: admin.id,
      },
      select: { slug: true, clusterOrdinal: true },
    });
    console.log(`seeded ${row.slug} (clusterOrdinal ${row.clusterOrdinal})`);
  }
}

if (process.argv.includes("--check")) {
  validate();
  process.exit(0);
}
validate();
seed()
  .then(async () => {
    // A whole-cluster seed rewrites every lesson in the cluster, so the broad tag
    // is the honest scope -- listing the slugs would be a longer way of saying
    // the same thing. No-ops on a local write.
    //
    // AWAITED before process.exit: an unawaited fetch would be killed by the exit
    // before the request left, and the call would silently never happen.
    await revalidate({ tags: ["mini-lessons"] });
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
