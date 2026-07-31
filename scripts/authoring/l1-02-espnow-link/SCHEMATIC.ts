// L1.02 ESP-NOW link — SCHEMATIC card.
//
// Facts from docs/boards/l1-02-espnow-link/{design.md §2 §3 §4, bom.csv,
// validation-log.md passes 2, 3, 5}, with L1.01's SCHEMATIC card as gospel for
// every shared habit: the KiCad 10 setup band, place-by-convention, ports and
// labels before wires, power symbol vs net label, the wire-by-NAME rule, the
// PWR_FLAG explanation, the both-ends label trap, and the ERC triage table.
//
// The card this replaces was 80 blocks against a 120 bar. It had the seven
// island walks and their capture slots, but none of the scaffolding L1.01 puts
// in front of them (no KiCad install path, no schematic-conventions figure, no
// name-vs-number rule, no power-symbol-vs-label decision), only two of the four
// mode bands, and it skipped both the finish-U1 pass and the test-point walk.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

/** A "See it wired · X" reveal slot. */
const wired = (name: string, caption: string, hint: string): Blk => ({
  type: "image", src: "", alt: caption, caption, captureHint: hint, reveal: `See it wired · ${name}`,
});

const BLOCKS: Blk[] = [
  {
    type: "youtube", videoId: "",
    title: "Schematic stage: the node's seven islands",
    caption: "A tour of what you'll wire: the familiar power core, the new node I/O, and the expansion header that makes this board a building block.",
  },
  band("orient", "Meet the node", "Read this once. You won't open KiCad yet. Seven islands make this board: five you built on L1.01 (USB power, regulator, module + decoupling, boot/reset, the USB data pair) and two new ones (node I/O, expansion header). Every island gets the full walk. As you go: **Do ·** = do it in KiCad, **Check yourself** = a quick gut-check, **See it wired** = verify by eye."),
  prose(
    "A schematic is a set of small jobs standing between a USB cable and a working radio. This board's list is short, and you have done most of it before:",
  ),
  {
    type: "steps", ordered: false,
    items: [
      "the right voltage",
      "a steady supply at the module's pins",
      "a defined way to boot",
      "a USB port that negotiates power and shrugs off a static zap",
      "that port's data pair",
      "a button that says send and a light that says received",
      "a few safe pins brought out to one header",
      "one clean ground under it all",
    ],
  },
  {
    type: "partModel", mpn: "RT9080-33GJ5",
    caption: "U2: the same 600 mA LDO as L1.01, because the radio's current profile has not changed",
  },
  {
    type: "image",
    src: "/guide-diagrams/wroom-power-flow.svg",
    alt: "Power-flow block diagram: USB-C J1 to polyfuse F1 to RT9080 LDO U2 to the 3.3 V rail to the ESP32-S3 module U1, with the 10 uF bulk cap C1 on the rail.",
    caption: "5 V in, a clean 3.3 V out. Islands 1 to 4 draw this chain.",
  },
  {
    type: "table",
    columns: ["Island", "What it does"],
    rows: [
      [{ text: "1 · Regulator (U2)" }, { text: "5 V in, a steady 3.3 V rail out" }],
      [{ text: "2 · Module & decoupling" }, { text: "U1 powered, caps at its pins" }],
      [{ text: "3 · Boot & reset" }, { text: "pull-ups + EN / BOOT buttons + the C4 reset RC" }],
      [{ text: "4 · USB power & protection" }, { text: "the CC sink, the fuse, ESD at the port" }],
      [{ text: "5 · USB data" }, { text: "the D+/D− pair, named as a diff pair" }],
      [{ text: "6 · Node I/O", tone: "gold", decoration: "badge" }, { text: "NEW: USER button (no resistor) + LINK LED + power LED" }],
      [{ text: "7 · Expansion header & test points", tone: "gold", decoration: "badge" }, { text: "NEW: rails + safe GPIO out to one snapped row" }],
    ],
  },

  // ── setup ────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "info", label: "Setup · Get KiCad + the starter open",
    body: "KiCad 10, as always. The L1.02 starter ships every part's symbol, footprint, and 3D model already placed, plus the rule floor and net classes. Download it below and open it through the **project** file (net classes live at the project level; a bare `.kicad_sch` loses them).",
  },
  {
    type: "callout", severity: "info", label: "Don't have KiCad yet?",
    body: "These lessons run in **KiCad 10**: every menu path, shortcut, and dialog here matches version 10. If it isn't installed, grab **KiCad 10 or newer** first (free, official, and it runs on Windows, macOS, and Linux). Already have it open? Skip straight to the starter download below.",
  },
  ref("Download KiCad: official, all platforms", "https://www.kicad.org/download/"),
  { type: "action", action: "downloadKicadStarter", label: "Download the L1.02 KiCad starter" },

  {
    type: "callout", severity: "info", label: "Place by convention",
    body: "Arrange the sheet before wiring: power in at the top-left, signal flowing left to right, U1 the hub in the centre, the header at the right edge. Rails point up, grounds point down. Group each island as a cluster; **Ctrl+F** jumps to any refdes.",
  },
  {
    type: "image",
    src: "/guide-diagrams/schematic-conventions.svg",
    alt: "An IC with signal flowing in from the left and out to the right, a 3V3 supply symbol pointing up, a GND symbol pointing down, and a decoupling capacitor drawn right at the power pin.",
    caption: "The four habits that make a schematic readable.",
  },
  does("arrange the sub-circuits", [
    {
      text: "**Ctrl+F** each refdes and drag its island into position as one cluster. **USB front end** (J1, F1, D1, R3/R4) to the far **left**. **Regulator** (U2, C5, C6) just right of it, **upper-left**.",
      proof: "J1's cluster holds the far left with the regulator beside it.",
    },
    {
      text: "**U1** to the **centre**. Its **decoupling** (C1/C2/C3) beside its 3V3 pin; **boot/reset** (R1/R2, SW1/SW2, C4) just left of U1 by its EN and IO0 pins.",
      proof: "U1 sits centre with decoupling and boot/reset clustered at its pins.",
    },
    {
      text: "**Node I/O** (SW3, LED1/LED2, R5/R6) to a corner near U1 where the story reads. **J2** (the expansion header) to the **right edge**. **TP1/TP2** anywhere open.",
      proof: "The node island sits near U1 and J2 holds the right edge.",
    },
  ]),
  prose(
    "Two habits make this painless. Drag a part into *empty space*, wire its little sub-circuit there, then slide the finished island into position: it beats fighting whatever the export gave you. And keep each part's reference and value clear of the symbol, its pins, and any wire. When a label is in the way, *move* it into open space. Never declutter by hiding a refdes: the BOM, the layout, and future-you all key off it.",
  ),
  ref("KiCad Library Conventions (KLC)", "https://klc.kicad.org/"),

  band("do", "in KiCad · Build it, island by island", "Each sub-circuit is one island: meet it, wire it, then eyeball it against the reference. Hold the full [[ERC]] for the very end. Run it per island and it is just a wall of 'not connected' noise."),
  {
    type: "callout", severity: "info", label: "Ports and labels first, then wires",
    body: "The L1.01 habit that saves the most rework, restated because it carries every island below: on each island, drop every **power port** and **net label** onto its pin FIRST, then draw the few real wires. Same name = same net; a drawn wire is the exception.",
  },
  {
    type: "callout", severity: "info", label: "Wire by name, not a maze",
    body: "Connect with names, not a maze of lines. Two wires that share a label are the same connection. For anything crossing the sheet (a rail, the EN line), give the wire a [[net label]] instead of dragging it across, and remember that wires which merely cross are not joined unless there is a junction dot.",
  },
  {
    type: "callout", severity: "info", label: "Power symbol or net label?",
    body: "A power symbol (press **P**) is for a rail that many parts tap: VBUS, +5V, +3V3, GND. A net label (press **L**) is for a signal between a few pins: USB_D+, EN, IO21. The test: rail many things share, or signal between a few pins? One mechanical difference: a power symbol drops straight onto the pin, while a net label rides a **wire**. So for a signal like **EN**, **IO0** or **IO21**, draw a short wire off the pin first, then press **L** and drop the label on that wire. Dropped in open space it floats unattached and ERC flags it. GND is the odd one out visually (the down-pointing triangle) but behaves like the other rails: a global net every matching symbol joins by name.",
  },
  prose(
    "One more thing nobody says outright: you wire by pin **name**, not pin **number**. The regulator's pins read `VIN`, `VOUT`, `GND`, `EN`; the module's read `3V3`, `EN`, `IO0`, `IO19`, `IO20`, `IO21`, `IO47`. So when a step says 'U2's EN to VIN', you find the pin *named* EN and wire it to the pin *named* VIN. Resistors and capacitors are the exception: they show pins `1` and `2`, and that is fine. The pin numbers in this card appear only where a connector needs them, like J1's A4 or the module's pin 23.",
  ),
  {
    type: "callout", severity: "info", label: "Keys · the KiCad 10 keys you'll use",
    body: "A handful of keys do most of the work: hover over a part and press. (Live list: **Preferences ▸ Hotkeys**, or **?** in the editor.)",
  },
  {
    type: "table",
    columns: ["Key", "What it does"],
    rows: [
      [{ text: "A", tone: "gold", decoration: "badge" }, { text: "Add a symbol (place a part)" }],
      [{ text: "P", tone: "gold", decoration: "badge" }, { text: "Add a power port: +3V3, +5V, GND, VBUS" }],
      [{ text: "W", tone: "gold", decoration: "badge" }, { text: "Draw a wire" }],
      [{ text: "L", tone: "gold", decoration: "badge" }, { text: "Place a net label" }],
      [{ text: "R / M / G", tone: "gold", decoration: "badge" }, { text: "Rotate / move / drag (G keeps wires attached)" }],
      [{ text: "E / V / U", tone: "gold", decoration: "badge" }, { text: "Edit properties / value / reference" }],
      [{ text: "Q", tone: "gold", decoration: "badge" }, { text: "No-connect flag: mark a pin you leave open" }],
      [{ text: "Insert", tone: "gold", decoration: "badge" }, { text: "Repeat the last label one step down, number auto-bumped (IO4 to IO5)" }],
    ],
  },
  prose(
    "**Insert** earns its keep on the header march: it repeats the last label one grid step down and auto-increments the trailing number. Set the step under **Preferences ▸ Schematic Editor ▸ Editing Options ▸ Label increment**. This board's header run jumps (IO1, IO2, then IO4 to IO10), so Insert helps on the unbroken stretch and you hand-place the rest. **No Insert key** on a compact laptop? Use the on-screen keyboard, remap one with Microsoft **PowerToys ▸ Keyboard Manager**, or press **Fn+Enter** on a Mac.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "The regulator", "Your ESP32-S3 wants a clean 3.3 V; USB hands you 5 V. U2 steps it down, exactly as on L1.01, and wiring it again is the point: this island should start feeling like muscle."),
  prose(
    "**U2** is the RT9080 again: an [[LDO]] that holds 3.3 V steady while the input rides anywhere reasonably above it. It needs its two stability caps, **C5** on the input and **C6** on the output, 1 µF each, or it can oscillate. Nothing about this island changed from L1.01, and that is the pattern of this whole board: a proven core, re-earned by your own hands.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "U2", decoration: "ref" }, { text: "RT9080-33GJ5", decoration: "mpn" }, { text: "5 V to 3.3 V LDO, 600 mA" }],
      [{ text: "C5  C6", decoration: "ref" }, { text: "1 µF X7R" }, { text: "LDO input / output stability caps" }],
    ],
  },
  does("wire the regulator", [
    { text: "**Ctrl+F**, type **U2**, Enter. Click U2's **body**, press **M**, drag it to clear space; pull its refdes and value above it.", proof: "U2 sits in clear space with readable labels." },
    { text: "Press **P**, pick **+5V**, drop it on **VIN**. The fuse island will feed this rail later; the shared name is the connection.", proof: "VIN carries a +5V port." },
    { text: "**Flag the rail.** Press **P**, pick **PWR_FLAG**, drop it on the +5V net at VIN. +5V arrives through a passive fuse, so no chip output drives it and ERC would call it undriven without the flag.", proof: "A PWR_FLAG rides the +5V net." },
    { text: "Press **W** and wire **EN to VIN**: the enable sits high with the input, so the LDO always runs.", proof: "A wire ties EN to VIN." },
    { text: "Press **P**, pick **+3V3**, drop it on **VOUT**: the rail leaving the regulator.", proof: "VOUT carries a +3V3 port." },
    { text: "**C5** across the input: one leg gets a **+5V** port, the other **GND**. **C6** across the output: **+3V3** and **GND**. No wires drawn to U2: same name, same net.", proof: "C5 spans +5V/GND and C6 spans +3V3/GND." },
    { text: "Press **P**, pick **GND**, drop it on U2's **GND** pin. Copy-paste the port (**Ctrl+C / Ctrl+V**) for the caps' ground legs.", proof: "U2 and both caps carry GND ports." },
  ]),
  {
    type: "youtube", videoId: "", title: "Wire the regulator island",
    caption: "U2's EN-to-VIN tie, the +5V/+3V3 ports, the PWR_FLAG, and both stability caps.",
  },
  wired(
    "the regulator",
    "Check the regulator: +5V flagged on VIN, EN tied high, a cap each side.",
    "KiCad 10 schematic, regulator island only: U2 with +5V+PWR_FLAG on VIN, EN-VIN tie, +3V3 on VOUT, C5/C6 either side. Refdes and ports legible.",
  ),
  check(
    "**Why does the +5V rail need a PWR_FLAG when the regulator's own +3V3 output never does?** +3V3 is driven by U2's output pin, which ERC recognizes as a source. +5V arrives through a passive fuse from the connector: no output pin anywhere, so the flag tells ERC, truthfully, that power enters there.",
  ),
  dive(
    "Why the same LDO again (and when it wouldn't be)",
    "ESP-NOW rides the Wi-Fi radio, so this board's power profile is L1.01's Wi-Fi case: roughly 500 mA transmit peaks over an 80 to 160 mA baseline. The RT9080's 600 mA rating and 0.53 V worst-case dropout clear that with the same margins you proved before, which is exactly why the part carries over unchanged. At USB low-line, 4.75 V minus 0.53 V leaves 4.22 V into a 3.3 V output: comfortable. The day a board's radio duty or logic load outgrows those numbers is the day this island finally changes, and re-proving the numbers on each board is what tells you when.",
  ),
  gotcha(
    "an LDO without its output cap can oscillate",
    "C5 and C6 are not optional decoration. An LDO robbed of its output capacitor can break into oscillation, which turns your clean rail into noise and shows up at bring-up as a board that boots sometimes. The RT9080 datasheet specifies 1 µF ceramics on both sides; give it both.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The module & its decoupling", "A steady rail at the regulator is not a steady rail at the chip. The caps at U1's pins are the fix, and the WROOM's internal cushion is the nuance you learned on L1.01."),
  prose(
    "Every time the ESP32-S3 keys its radio it asks the rail for current faster than the regulator can answer. **C2** and **C3**, 0.1 µF each, sit at the module's 3V3 pin: they hold a small reserve of charge, hand it over the instant the chip asks, then refill between demands. **C1**, 10 µF, plays the same game one size up: the slower, deeper reservoir that rides the whole transmit burst. On this board that burst happens every time somebody presses the button, and on a receiving node the radio never sleeps at all, so this island earns its keep continuously rather than occasionally.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "C2  C3", decoration: "ref" }, { text: "0.1 µF X7R" }, { text: "Bypass at the module's 3V3 pin" }],
      [{ text: "C1", decoration: "ref" }, { text: "10 µF" }, { text: "Bulk reservoir for the rail (the radio's gulps)" }],
    ],
  },
  does("wire the decoupling, then tie the module", [
    { text: "**Ctrl+F** to **U1**, click its body, **M**, drag it centre-sheet. Drag **C1, C2, C3** in beside its 3V3 pin.", proof: "U1 holds the centre with the three caps beside it." },
    { text: "Press **P** twice per cap: a **+3V3** and a **GND** port on each of C1, C2, C3. No wires to U1: the rail's name is the wiring.", proof: "Each cap spans +3V3 and GND by ports." },
    { text: "**U1's 3V3 pin** (module pin 2) gets a +3V3 port. **U1's visible GND pin** (pin 1) gets a GND port. This is the headline connection: a perfect regulator and a dark chip are separated by exactly these two ports.", proof: "U1's power pins carry +3V3 and GND." },
    { text: "U1's centre pad hides more GND pins (40 and 41). You'll confirm them in the grounds sweep at the end (**View ▸ Show Hidden Pins**).", proof: "Noted: hidden grounds get their check in island 8's sweep." },
  ]),
  {
    type: "youtube", videoId: "", title: "Wire the decoupling and tie the module",
    caption: "C1/C2/C3 at the pins, then the two ports that bring U1 to life.",
  },
  wired(
    "module & decoupling",
    "Check the module: rails ported, three caps at the pin.",
    "KiCad 10 schematic, module island: U1's 3V3/GND ports plus C1/C2/C3 on +3V3/GND beside it. Ports and refdes legible.",
  ),
  check(
    "**In one line, what do C2 and C3 do, and what does C1 add?** C2 and C3 hand the chip instant charge for fast demands; C1 is the bigger, slower reservoir that rides the radio's transmit gulps. Bulk plus bypass, same as L1.01.",
  ),
  dive(
    "Why small caps close, not one big one",
    "A capacitor only helps if it is close: the longer the path between it and the pin, the more its help fades, because the loop picks up inductance and inductance is what resists a fast change in current. Two 0.1 µF caps right at the module's 3V3 pin beat a single 0.2 µF cap a few millimetres away. Being close matters more than raw capacitance.\n\nThe 10 µF bulk cap then covers the slower, larger swing the small ones cannot. On this board the numbers are worth knowing: a transmit burst pulls roughly 0.34 A extra for about 10 µs, and 10 µF holds the rail's sag to around 0.34 V, so 3.3 V dips to about 2.96 V. The ESP32-S3's brownout detector sits below that. The margin is real but it is not enormous, which is why C1's value and its placement both matter.",
  ),
  gotcha(
    "the module's own decoupling is a cushion, not a licence",
    "The WROOM carries decoupling inside, right at the die, so your board caps are the reservoir tier rather than the last line of defence for fast current. Keep them close anyway. The habit is what transfers to bare-chip boards, where that last millimetre is the whole game.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "Boot & reset", "Two strapping pins that must read right at the instant of power-up, two buttons that override them, and the reset RC. One value differs from L1.01, and it's a lesson, not a bug."),
  prose(
    "The chip samples **EN** (run/reset) and **GPIO0** (boot select) the moment it wakes, so each carries a 10 kΩ [[pull-up]] to a definite high: **R1** on EN, **R2** on IO0. **SW1** grounds EN (reset); **SW2** grounds IO0 (hold through a reset to enter USB download mode). **C4**, 0.1 µF from EN to GND, pairs with R1 as the power-on RC: 10 kΩ times 0.1 µF is a 1 ms time constant, so EN rises only after the rail settles, and the cap debounces SW1's contacts.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "R1  R2", decoration: "ref" }, { text: "10 kΩ" }, { text: "Pull-ups on EN / IO0" }],
      [{ text: "SW1  SW2", decoration: "ref" }, { text: "B3F-1000", decoration: "mpn" }, { text: "EN (reset) / BOOT (download)" }],
      [{ text: "C4", decoration: "ref" }, { text: "0.1 µF" }, { text: "EN reset RC (1 ms) + SW1 debounce" }],
    ],
  },
  does("wire boot & reset", [
    { text: "**R1**: press **P** for a **+3V3** port on its top leg. Press **L**, type **EN**, and drop the label on R1's other leg, on **U1's EN pin** (module pin 3), and on **SW1's top leg**. Three pins, one name, no wires drawn.", proof: "The EN label ties R1, U1's EN, and SW1 together." },
    { text: "**SW1's** far leg gets a **GND** port. Press it and EN goes low: reset.", proof: "SW1 grounds the EN net when pressed." },
    { text: "**C4**: an **EN** label on one leg, a **GND** port on the other. R1 charges it; the 1 ms rise is the clean power-on.", proof: "C4 spans EN to GND." },
    { text: "**R2**: +3V3 port on top; an **IO0** label on its other leg, on **U1's IO0 pin**, and on **SW2's top leg**. SW2's far leg gets GND.", proof: "IO0 ties R2, U1, and SW2, with SW2 grounded." },
  ]),
  {
    type: "youtube", videoId: "", title: "Wire boot & reset",
    caption: "The EN and IO0 nets by name: pull-ups, buttons, and the C4 reset RC.",
  },
  wired(
    "boot & reset",
    "Check boot/reset: R1+SW1+C4 on EN, R2+SW2 on IO0.",
    "KiCad 10 schematic, boot/reset island: EN net with R1/SW1/C4 and IO0 net with R2/SW2, pull-ups to +3V3. Net labels legible.",
  ),
  check(
    "**If R1 vanished and no button were pressed, what would EN read?** Nothing definite. The pin would float, drift with ambient noise, and the chip might reset randomly or never start. Strapping pins get external pull-ups precisely because they are read before any firmware exists to configure internal ones.",
  ),
  dive(
    "C4 is 0.1 µF where L1.01's C7 was 1 µF: both are right",
    "Espressif's design guide wants an RC on EN so the chip leaves reset after the rail settles; the datasheet baseline is 10 kΩ with 0.1 µF, a 1 ms constant, and that is this board's C4. L1.01 fitted 1 µF for a 10 ms constant, buying margin against slow or bouncy supplies. Both satisfy the requirement. Seeing the two side by side teaches the real lesson: the requirement is a minimum, the value is a margin choice, and you now know the range designers actually use.",
  ),
  gotcha(
    "BOOT alone does nothing",
    "Pressing SW2 on a running board changes nothing at all: GPIO0 is only *sampled* at reset. The download-mode move is both hands: hold **BOOT**, tap **EN**, release **BOOT**. Learners who press BOOT and wait usually conclude the button is broken. It is doing exactly what a strapping pin does.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "USB power & protection", "The port that touches the outside world: the CC sink handshake, the fuse rename, and static clamped at the door. The full L1.01 walk, because the port deserves it every time."),
  prose(
    "The board announces itself as a power [[sink]] by tying each [[CC pin]] to ground through 5.1 kΩ (**R3**, **R4**: one per CC line, because the plug flips). **F1**, the resettable [[PTC]] fuse, sits in the 5 V path and performs the rename you know: **VBUS** is raw connector power, **+5V** is the same current after the fuse. **D1**, the USBLC6 array, clamps static on VBUS and both data lines right at the connector.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "R3  R4", decoration: "ref" }, { text: "5.1 kΩ" }, { text: "CC1/CC2 sink resistors (Rd) to GND" }],
      [{ text: "F1", decoration: "ref" }, { text: "1206L050YR", decoration: "mpn" }, { text: "Resettable PTC: 0.5 A hold / 1 A trip on VBUS" }],
      [{ text: "D1", decoration: "ref" }, { text: "USBLC6-2SC6", decoration: "mpn" }, { text: "ESD clamp on D+/D− and VBUS" }],
    ],
  },
  does("wire USB power & protection", [
    { text: "**J1's VBUS pin** (A4/B9): press **P**, drop a **VBUS** port. Place **F1**: **W** a wire from one leg to that VBUS node; **P** a **+5V** port on the other leg. The fuse is symmetric; the rename is the point.", proof: "F1 bridges VBUS to +5V at the connector." },
    { text: "**Flag VBUS and GND.** Press **P**, pick **PWR_FLAG**, drop one on the **VBUS** net and one on **J1's GND** net after you port it: **P** then **GND** on J1's GND (A1/B12). Three flags now exist on the board: +5V, VBUS, GND.", proof: "VBUS and GND carry PWR_FLAGs; the count is three." },
    { text: "**R3** from **J1's CC1** (A5) to a **GND** port; **R4** from **CC2** (B5) to GND. This is the handshake: without it a modern charger never switches VBUS on.", proof: "Each CC pin runs through its own 5.1 kΩ to ground." },
    { text: "**D1** beside J1: its **VBUS pin** (5) to the raw VBUS rail, its **GND pin** (2) to a GND port. Its data pins wait for island 5.", proof: "D1 sits at the port with VBUS and GND tied." },
    { text: "Leave **J1's data pins** and **SBU1/SBU2** alone for now; data is island 5 and the no-connects come in the final sweep.", proof: "Only power-side pins are wired so far." },
  ]),
  {
    type: "youtube", videoId: "", title: "Wire the USB port: power and protection",
    caption: "VBUS through F1 to +5V, the CC sink pair, D1 at the door, and the three PWR_FLAGs.",
  },
  wired(
    "USB power & protection",
    "Check the port: fuse rename done, CC pair grounded, ESD at the door.",
    "KiCad 10 schematic, USB island: J1, F1 (VBUS to +5V), R3/R4 to GND, D1 with VBUS/GND tied, three PWR_FLAGs visible. Labels legible.",
  ),
  check(
    "**What two different failures do F1 and R3/R4 prevent?** F1 limits over-current: a short downstream heats it, it throttles, then self-heals. R3 and R4 prevent a dead board on modern chargers: they are how a USB-C source knows to supply power at all.",
  ),
  dive(
    "How F1 and D1 actually protect the port",
    "F1 is a [[PTC|resettable fuse]]. Where a glass fuse blows once and needs desoldering, the PTC heats on over-current, throttles, then heals when it cools, so an accidental short is self-recovering. Its rating on this board is 0.5 A hold and 1 A trip, which sits above the 80 to 160 mA this node actually draws while leaving the brief 500 mA transmit peaks alone: a PTC has a thermal time constant far longer than a millisecond burst, so those peaks never trip it.\n\nD1 works at the other end of the timescale. A static spike is over in nanoseconds, so the clamp has to react faster than that, and it has to be low-capacitance, because anything bulky sitting across the data lines would round off the USB edges and corrupt the signal.",
  ),
  gotcha(
    "a missing CC resistor works on one cable and dies on another",
    "On an old A-to-C cable VBUS is always live, so a board missing R3/R4 seems fine. On a C-to-C charger it is stone dead. Intermittent by cable is the worst kind of bug, which is why this pair is worth understanding rather than copying. Same trap as L1.01, worth re-feeling.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The USB data pair", "Two fixed pins, one differential pair, and the naming that unlocks the router at layout. Identical to L1.01, and drilled again because the suffix discipline must be automatic."),
  prose(
    "The module speaks USB on **IO19 (D−)** and **IO20 (D+)**, always. The connector's doubled data pins, both of D1's per-line pins, and the module all join by name. The names carry the meaning: a shared base with **+ and − suffixes** is what KiCad reads as a [[differential pair]], and that unlocks the paired router when you reach copper.",
  ),
  {
    type: "table",
    columns: ["D1 pin", "Name", "Wire to"],
    rows: [
      [{ text: "1, 6" }, { text: "I/O1" }, { text: "USB_D+" }],
      [{ text: "3, 4" }, { text: "I/O2" }, { text: "USB_D-" }],
      [{ text: "2" }, { text: "GND" }, { text: "GND" }],
      [{ text: "5" }, { text: "VBUS" }, { text: "VBUS" }],
    ],
  },
  does("name the pair, label every pin", [
    { text: "Press **L** and create **USB_D+** and **USB_D-**: plain ASCII plus and minus. The router matches the literal suffix.", proof: "Both labels exist with ASCII suffixes." },
    { text: "**USB_D+** on: J1's **DP1 and DP2**, both of **D1's I/O1 pins (1 and 6)**, and **U1's IO20**.", proof: "USB_D+ rides five pins across three parts." },
    { text: "**USB_D-** on: J1's **DN1 and DN2**, both of **D1's I/O2 pins (3 and 4)**, and **U1's IO19**. Keep the suffixes straight the whole way: a crossed pair enumerates never and ERC says nothing.", proof: "USB_D- mirrors it, suffixes never flipped." },
  ]),
  {
    type: "youtube", videoId: "", title: "Name the USB data pair",
    caption: "The plus and minus suffix discipline that pays off at layout, drilled once more.",
  },
  wired(
    "the USB data pair",
    "Check the pair: the same two names from connector to module, through the clamp.",
    "KiCad 10 schematic, USB data pair: USB_D+/USB_D- labels on J1 DP/DN, D1's I/O pins, and U1's IO20/IO19. Labels legible.",
  ),
  check(
    "**Why label these nets USB_D+ and USB_D- instead of IO20 and IO19?** The matched suffix pair is the instruction KiCad's differential-pair router reads at layout. Names are the only place the schematic can say 'these two travel together'.",
  ),
  dive(
    "Where's the USB-to-serial chip?",
    "Older ESP32 boards needed a separate **USB-to-UART bridge** (a CP2102 or CH340) just to flash and print to the serial monitor, because the classic ESP32 had no USB of its own. The **ESP32-S3 does**: a built-in USB-Serial-JTAG peripheral wired to exactly these two pins (IO19 is D−, IO20 is D+). So the USB-C port talks to the chip directly, and flashing, the serial console, and JTAG debug all run over the one cable. No bridge chip, no driver install, and one fewer hard-to-hand-solder package on the board.\n\nOn this board that matters twice over: bring-up asks you to read each node's MAC address off the serial console, and that console is the same cable that powers and flashes it.",
  ),
  gotcha(
    "a crossed pair fails silently",
    "Swap the suffixes anywhere along the run, say USB_D+ on IO19 instead of IO20, and every net is still fully connected. ERC has nothing to complain about. The board simply never enumerates, and you spend an evening suspecting the connector. Follow each label end to end against the answer key.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  sect("06", "Node I/O: the button with no resistor", "The island that makes this board a node. One button, two LEDs, and a deliberate absence to understand."),
  prose(
    "**SW3**, the USER button, connects **GPIO21 to GND**, and that is the entire circuit. No pull-up resistor exists because firmware enables the chip's **internal** [[pull-up]] before reading the pin: the pin rests high, a press pulls it low, and the firmware treats the falling edge as 'send'. Compare EN and IO0 one island back: those are read *before* firmware exists, so they carry real resistors. Same principle, applied with judgment.\n\n**LED2** becomes the **LINK/RX indicator** on **GPIO47**: a packet arrives, firmware drives the pin, the yellow LED lights. **LED1** stays the power light on the 3V3 rail. Both strings run through their 470 Ω series resistors, the Ohm's-law sizing you did on L1.01.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "SW3", decoration: "ref" }, { text: "B3F-1000", decoration: "mpn" }, { text: "USER/SEND: GPIO21 to GND, internal pull-up, no external resistor" }],
      [{ text: "LED2  R6", decoration: "ref" }, { text: "Yellow, 470 Ω" }, { text: "LINK/RX: GPIO47 to R6 to LED2 to GND" }],
      [{ text: "LED1  R5", decoration: "ref" }, { text: "Red, 470 Ω" }, { text: "Power light: +3V3 to R5 to LED1 to GND" }],
    ],
  },
  {
    type: "callout", severity: "info", label: "Picking the button and LED pins",
    body: "**GPIO21** is module pin 23 and **GPIO47** is pin 24: both plain digital pins with no start-up duty. The pins to keep off anything you press or drive are the strapping pins (0, 3, 45, 46), the two USB data pins (19, 20), and the flash and PSRAM pins the module reserves. Neither IO21 nor IO47 is an ADC pin either, which keeps all five ADC1 inputs free for the expansion header.",
  },
  does("wire the node I/O", [
    { text: "**SW3**: press **L**, type **IO21**, drop the label on **U1's GPIO21 pin** and on **SW3's top leg**. SW3's far leg gets a **GND** port. Notice what you did NOT place: any resistor.", proof: "IO21 ties U1 to SW3, whose far leg is grounded, with no resistor on the net." },
    { text: "**LED2**: an **IO47** label on **U1's GPIO47** and on **R6's top leg**. **W** one wire from R6's bottom leg to **LED2's anode**; a **GND** port on the **cathode** (the bar side).", proof: "IO47 runs U1 to R6 to LED2 to GND." },
    { text: "**LED1**: a **+3V3** port on **R5's top leg**; one wire R5 to LED1's anode; GND on the cathode. It glows whenever the board has power.", proof: "LED1's string runs +3V3 to R5 to LED1 to GND." },
    { text: "**Polarity, the silent bug**: each LED's bar or flat side faces GND. Backwards just stays dark, and ERC never notices. Eyeball both against the reveal below.", proof: "Both bar sides face the ground end." },
  ]),
  {
    type: "youtube", videoId: "", title: "Wire the node I/O island",
    caption: "The resistor-free button, the LINK LED on GPIO47, and the power light.",
  },
  wired(
    "the node I/O",
    "Check the island: a button with no resistor, two LED strings with their bars on ground.",
    "KiCad 10 schematic, node I/O island: SW3 on IO21 to GND (no resistor), LED2 IO47 to R6 to LED2 to GND, LED1 +3V3 to R5 to LED1 to GND. Labels and LED polarity legible.",
  ),
  check(
    "**With the internal pull-up on, what does GPIO21 read at rest, and pressed?** At rest: high, held at 3.3 V by the internal 45 kΩ. Pressed: low, shorted to ground through SW3. The firmware watches for high-to-low.",
  ),
  dive(
    "Sizing the resistor (Ohm's law)",
    "The resistor sets the current from the leftover voltage: I = (Vsupply − Vf) ÷ R. The red power LED drops about 1.8 V across itself (its [[forward voltage|forward voltage, Vf]]), so on 3.3 V through 470 Ω that is (3.3 − 1.8) ÷ 470, about **3.2 mA**: bright enough to see, easy on the rail. The yellow LINK LED's Vf is higher, around 2.0 V, so the same 470 Ω gives (3.3 − 2.0) ÷ 470, about **2.8 mA**.\n\nBoth sit far under the ESP32-S3's 40 mA absolute maximum per pin, which is the number that matters for LED2 because GPIO47 drives it directly. And this is why swapping LED colours at a fixed resistor quietly changes brightness: the colour sets Vf, and Vf sets what is left for the resistor to work with.",
  ),
  gotcha(
    "the button pulls DOWN, not up",
    "Wire SW3's far leg to +3V3 by mistake and the pin reads high both ways: presses become invisible and nothing warns you, because ERC sees a legal circuit either way. The reveal image is the check.",
  ),
  dive(
    "Internal pull-ups: when to trust them",
    "Behind most GPIO sits a switchable pull-up in the 30 to 60 kΩ range, enabled by a register write. Trust it when firmware controls the timing and the signal is human-slow: buttons, jumpers. Use a real resistor when the level must exist before firmware (strapping pins), when a bus names a value (I2C), or when the line leaves the board into real noise. This island and the boot island are the two answers side by side, on one schematic.",
  ),

  // ── finish U1 ─────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "info", label: "Finish U1 before the header",
    body: "Every sub-circuit that touches U1 is done: power and ground, EN and IO0, the USB pair, the USER button and the LINK LED all carry their names on the module. Before J2 fans a few more pins out to the board edge, take one pass down U1 itself and account for **every** pin. On this board that means something slightly different from L1.01: most of the module's remaining GPIO are deliberately left alone.",
  },
  does("account for every U1 pin", [
    {
      text: "The pins with a job already carry their names: **3V3** (pin 2) and **GND** (1, 40, 41), **EN** (3) and **IO0**, **IO19/IO20** as `USB_D-`/`USB_D+`, **IO21** (pin 23) and **IO47** (pin 24). Leave those.",
      proof: "Every pin with a circuit already carries its net label or power port.",
    },
    {
      text: "Label the nine pins the header takes: **IO1, IO2, IO4, IO5, IO6** and **IO7 to IO10**. Press **L**, type the name printed on the pin, drop it. **Insert** marches the unbroken run IO4 to IO6 and IO7 to IO10; hand-place IO1 and IO2 where the numbering jumps.",
      proof: "All nine header nets carry a label on the module side.",
    },
    {
      text: "**Leave the strapping pins GPIO3, 45 and 46 bare for now.** They are not used and they are not on the header; they get a no-connect flag in island 8, which is what makes their safety permanent.",
      proof: "GPIO3, 45 and 46 carry no label and no wire.",
    },
  ]),
  wired(
    "the finished module",
    "Check U1: every pin now carries a net label, a power port, or is a deliberate open waiting for its no-connect flag.",
    "KiCad 10 schematic, U1 alone, fully accounted for: 3V3/GND rails, EN, IO0, USB_D-/USB_D+ on IO19/IO20, IO21 and IO47, the nine header labels, and GPIO3/45/46 still bare. Zoom so each pin name reads.",
  ),

  // ── 07 ────────────────────────────────────────────────────────────────────
  sect("07", "The expansion header & test points", "One snapped row makes this node a building block. What it exposes matters less than what it excludes."),
  prose(
    "**J2** breaks out the rails (5V, 3V3, GND) and a run of safe GPIO: the [[ADC1]] pins **IO1, IO2, IO4, IO5, IO6** plus spares **IO7 to IO10**. The exclusions are the design: no strapping pins, no USB pins, no IO21 or IO47. Nothing a learner jumpers here can break boot, USB, or the link, and ADC1-only means analog keeps working while the radio runs. The 5 V position powers peripherals only: the module's GPIO are 3.3 V parts, and the silkscreen will say so.",
  ),
  {
    type: "table",
    columns: ["J2 position", "carries"],
    rows: [
      [{ text: "1" }, { text: "5V (power out only, never into a GPIO)" }],
      [{ text: "2" }, { text: "3V3" }],
      [{ text: "3" }, { text: "GND" }],
      [{ text: "4 to 8" }, { text: "IO1, IO2, IO4, IO5, IO6 (ADC1)" }],
      [{ text: "9 to 12" }, { text: "IO7, IO8, IO9, IO10" }],
    ],
  },
  {
    type: "callout", severity: "info", label: "Spot what is missing",
    body: "On L1.01 the headers carried a handful of pins that already had jobs, so wiring them meant reusing an existing net name. **Not one position on J2 does that.** Before you read on, work out why the list above has no EN, no IO0, no IO19 or IO20, no IO21 or IO47, and no ADC2 pin anywhere. Each absence protects a different thing.",
  },
  prose(
    "Five exclusions, five reasons. **Strapping pins** (IO0, 3, 45, 46) stay off because a jumper pulled during a reset changes how the chip boots. **IO19 and IO20** stay off because they are the USB pair and a stub on them costs you enumeration. **IO21 and IO47** stay off because they are this board's own button and LED, and a learner shorting one would break the very demo the board exists for. **Every ADC2 pin** stays off because ADC2 is unusable while the radio runs, which on this board is always. And **EN** stays off because grounding it from a breadboard is an accidental reset with no undo.\n\nWhat is left is nine plain GPIO and three rails: the largest set that cannot hurt anything.",
  ),
  does("wire the header + test points", [
    { text: "**J2 pins 1 to 3**: press **P** for a **+5V**, a **+3V3**, and a **GND** port.", proof: "The three rail positions carry ports." },
    { text: "**J2 pin 4**: press **L**, type **IO1**, drop it. Press **Insert** to repeat down the row with the number auto-bumping where the run is unbroken (IO4 to IO5 to IO6); hand-place where numbering jumps (IO2, IO7).", proof: "Positions 4 to 12 carry IO1, IO2 and IO4 to IO10 labels." },
    { text: "**The other end**: the same label on each matching **U1 pin**, which you placed in the pass above. Both ends, every net: a missed end is an ERC flag (good), a MISlabelled end is silence (the trap).", proof: "Every header label has its twin on the module pin." },
  ]),
  gotcha(
    "label both ends, the one slip ERC can't catch",
    "ERC catches a *missing* label, because that leaves a loose pin. It cannot catch a *wrong* one: put IO5 on the module and IO6 at the header and both nets read as used, so ERC stays silent. Nine nets is exactly the length where attention slips. Check the header against the answer key image, not against a green tick.",
  ),
  trace("Walk the nine header nets against the module", [
    { text: "Position 4 reads IO1 at both ends", help: "IO1 and IO10 are the two easiest to transpose on a quick read. Zoom in." },
    { text: "Position 5 reads IO2, and the run then jumps to IO4", help: "There is no IO3 on this header: GPIO3 is a strapping pin and is deliberately absent." },
    { text: "Positions 6 to 8 read IO4, IO5, IO6 in order", help: "This is the stretch where Insert marched for you, so it is also where an off-by-one lands quietly." },
    { text: "Positions 9 to 12 read IO7, IO8, IO9, IO10 in order", help: "Four spares, no gaps. A duplicate label here shorts two module pins together and ERC will not say a word." },
    { text: "Positions 1 to 3 carry power PORTS, not net labels", help: "A rail typed as a label makes a private net that joins nothing. It should be the +5V, +3V3 and GND symbols." },
  ]),
  {
    type: "youtube", videoId: "", title: "Wire the expansion header",
    caption: "The Insert-key march, both-end labels, and the exclusion logic that keeps J2 safe.",
  },
  wired(
    "expansion header",
    "Check the header: rails ported, every IO labelled at both ends.",
    "KiCad 10 schematic, J2 island: rail ports on pins 1-3, IO1 to IO10 labels down the row with twins visible on U1. Labels legible.",
  ),
  does("the two test points", [
    { text: "**TP1 to the +3V3 rail.** Press **P**, pick **+3V3**, drop it on TP1. Nothing else attaches: it is a labelled loop to clip a probe onto.", proof: "TP1 carries a +3V3 port and nothing else." },
    { text: "**TP2 to GND.** Press **P**, pick **GND**, drop it on TP2. Now you have a rail and a ground to meter against the moment you first power each node.", proof: "TP2 carries a GND port and nothing else." },
  ]),
  wired(
    "test points",
    "Check the test points: TP1 on +3V3, TP2 on GND.",
    "KiCad 10 schematic, the test points: TP1 with a +3V3 port and TP2 with a GND port, two bare loops. Zoom so both labels read.",
  ),
  gotcha(
    "5 V is for powering things, never for pins",
    "The header's 5V position feeds hungry peripherals. Jumper it into any GPIO position and that pin can die: ESP32-S3 GPIO are 3.3 V parts and are not 5 V tolerant. The silkscreen labels every position for exactly this reason.",
  ),
  check(
    "**Which pins does J2 deliberately exclude, and what does each exclusion protect?** Strapping pins (boot integrity), USB pins (enumeration), IO21 and IO47 (the node's own button and LED), EN (accidental reset), and every ADC2 pin (readings that die under the radio). Exclusion is the safety design.",
  ),

  // ── 08 ────────────────────────────────────────────────────────────────────
  sect("08", "Grounds, no-connects, and the strap pins you leave alone", "The finishing sweep, plus one deliberate choice: three strapping pins stay unconnected on purpose."),
  prose(
    "Confirm every ground: U2's, the caps', each button's low leg, each LED cathode, TP2, and the module's hidden pad grounds (**View ▸ Show Hidden Pins**: they auto-join the net named GND, which is why your ground must carry that exact name). Then the no-connect sweep: strapping pins **GPIO3, 45, 46** are left **NC at their module-internal defaults**, deliberately unrouted and off the header so no jumper can ever disturb a boot strap. Press **Q** on them, on the module's true NC pins, and on J1's SBU1/SBU2.",
  ),
  does("grounds, then the no-connect sweep", [
    { text: "Walk the sheet dropping **GND** ports on anything still open-grounded; **View ▸ Show Hidden Pins** to confirm the WROOM pad's grounds sit on GND.", proof: "Every ground pin carries the GND net, hidden ones confirmed." },
    { text: "**Q** on GPIO3, 45, 46 (the deliberate NC straps), the module's NC pins, and J1's SBU pins.", proof: "Every intentional open carries a no-connect flag." },
    { text: "Run **ERC once as a scratch pass**: every remaining 'not connected' is your to-do list. Q the intentional ones; wire the mistakes.", proof: "A scratch ERC lists nothing unexplained." },
  ]),
  {
    type: "youtube", videoId: "", title: "Grounds, no-connects, and the scratch ERC",
    caption: "The sweep that turns a wall of warnings into a clean list.",
  },
  check(
    "**Why are GPIO3, 45, and 46 left unconnected AND kept off the expansion header?** They are strapping pins the design doesn't use. NC leaves them at safe internal defaults, and absence from J2 makes that safety permanent: no jumper can ever pull one during boot.",
  ),
  dive(
    "ERC is the net, not a hoop",
    "You cannot instruct your way out of every slip. A careful builder with the rule right in front of them still half-finishes a both-ends task across nine nets, because that is how humans handle long, two-sided work. So the durable move is to design the safety net and learn to read it. That is why this card pairs each error-prone step with its ERC tell: label both ends, and if you miss one, ERC flags the loose pin. That flag IS your check. Work the list to zero and the net has done its job.",
  ),

  {
    type: "callout", severity: "info", label: "One sheet, two boards",
    body: "You are drawing this schematic once. There is no node-A file and no node-B file: both nodes are this exact sheet, ordered twice at the fab, assembled twice, and flashed differently. Every asymmetry in the whole lesson lives in firmware and arrives at bring-up. That is what 'ESP-NOW peers are symmetric' means once it reaches a drawing.",
  },
  check(
    "**Where does the difference between the transmitter and the receiver live?** Nowhere on this sheet. Both nodes are this schematic, down to the refdes. The role is a firmware setting you apply at bring-up, which is also why either board can play either part later.",
  ),

  // ── prove it ──────────────────────────────────────────────────────────────
  band("check", "Prove it", "Trace what ERC can't see against the answer key, then run the checker for real."),
  {
    type: "image", src: "", aspect: "16:10", zoom: true,
    alt: "Completed L1.02 schematic: all seven islands wired and labelled, from USB front end to expansion header.",
    caption: "The answer key: check your sheet against this, island by island, especially the pair's suffixes and the resistor-free button.",
    captureHint: "KiCad 10 full L1.02 schematic, one hi-res shot, every island and net label legible (the answer key). Full sheet framed.",
  },
  trace("what ERC can't catch", [
    { text: "**SW3's far leg lands on GND**, so a press pulls IO21 low.", help: "Wired to +3V3, the pin reads high both ways and every press is invisible. ERC is satisfied either way." },
    { text: "Each **LED's bar side faces GND**.", help: "Backwards LEDs stay dark silently: the L1.01 trap, still live." },
    { text: "**USB_D+ / USB_D-** keep their suffixes straight through D1 to IO20/IO19.", help: "A crossed pair never enumerates; follow each label end to end." },
    { text: "**U2's VIN sits on +5V** (after the fuse), never raw VBUS.", help: "Both are valid rails to ERC; only the fused one is protected." },
    { text: "**GPIO3, 45 and 46 carry no-connect flags**, not net labels.", help: "A stray label on a strapping pin makes a net nothing drives, and the board's boot mode becomes whatever the ambient noise says." },
  ]),

  band("do", "in KiCad · Run ERC & export", "Hands on. The bar never moves: clean, or every remaining flag marked and understood."),
  prose(
    "Now the checker: **Inspect ▸ Electrical Rules Checker**. [[ERC]] reads the whole sheet and flags what is electrically wrong: a pin connected to nothing, two outputs fighting each other, a rail that nothing drives. Work the list down to zero, or to flags you have marked and understood. It is the same bar you meet again at **DRC** two stages from now, and setting it here is what makes it feel normal there. The table below is the same triage you learned on L1.01, because the same three ERC complaints cover most sheets.",
  ),
  {
    type: "table",
    columns: ["ERC says…", "…you do"],
    rows: [
      [{ text: "Input power pin not driven", tone: "critical", decoration: "badge" }, { text: "A PWR_FLAG on the flagless rail (VBUS, +5V, GND carry the three here). Don't ignore it; fix it this way." }],
      [{ text: "Pin not connected", tone: "critical", decoration: "badge" }, { text: "Meant it? Q the pin. Didn't? Wire it." }],
      [{ text: "Unconnected wire / net", tone: "critical", decoration: "badge" }, { text: "A real mistake: join it or delete the stray end." }],
    ],
  },
  dive(
    "Why a powered rail still trips ERC (and PWR_FLAG fixes it)",
    "ERC checks by pin type: it wants every power-input pin (like the module's 3V3) fed by a power-output pin somewhere. Your +3V3 is fine, because the regulator's output pin counts as a driver. But VBUS arrives from a connector that has no output pin at all, and +5V sits on the far side of a passive fuse. Neither has a chip output behind it, so ERC warns 'input power pin not driven'.\n\nA [[PWR_FLAG]] is a tiny symbol whose single pin IS a power-output: drop it on VBUS, +5V and GND and you have told ERC, truthfully, that real power enters there. That is the honest way to clear the warning rather than a mute button. One trap: if you spot GNDPWR in the symbol picker, that is a different, stacked-ground symbol that makes its own net. Use a plain PWR_FLAG on a normal GND, never GNDPWR.",
  ),
  does("run ERC", [
    { text: "Run **Inspect ▸ Electrical Rules Checker**. Fix to zero. The three PWR_FLAGs clear the undriven-rail trio.", proof: "ERC reports no errors, or only marked exceptions." },
    { text: "Re-run after every batch of fixes rather than at the end. A short list is a list you actually read.", proof: "The final run was made after the last edit, not before it." },
    { text: "Any flag you keep gets a written reason. An exception you cannot explain is one you have not understood.", proof: "Every remaining flag is marked and explained." },
  ]),
  does("export & upload", [
    { text: "**File ▸ Plot** the schematic to PDF for a readable copy, and keep the `.kicad_sch` source beside it.", proof: "A schematic PDF sits alongside the .kicad_sch source." },
    { text: "Attach your clean ERC report: this stage's gate artifact.", proof: "The stage shows your ERC report attached." },
    { text: "You are drawing this sheet once and building it twice. Save the project under a name you will recognise in a month, because node B is the same file.", proof: "The project is saved somewhere you can find it again." },
  ]),
  {
    type: "youtube", videoId: "", title: "Run ERC clean and export",
    caption: "Working the list to zero and plotting the record copy.",
  },

  {
    type: "quiz",
    prompt: "Quick check: schematic",
    gate: true,
    questions: [
      {
        id: "internal-pullup-wiring", reviewId: "internal-pullup-wiring",
        q: "SW3 connects GPIO21 straight to GND with no resistor anywhere. Why is that legal here?",
        options: [
          "The chip's internal pull-up holds the pin high; firmware enables it before reading",
          "Buttons never need resistors",
          "GPIO21 has a special button mode",
        ],
        answer: 0,
        explain: "Firmware switches on the internal pull-up (roughly 45 kΩ) before reading the pin, so an external resistor is unnecessary for a firmware-read button.",
      },
      {
        id: "button-direction",
        q: "You wire SW3 from GPIO21 to +3V3 instead of GND. ERC passes. What actually happens?",
        options: [
          "The internal pull-up burns out",
          "The board won't boot",
          "The pin reads high whether pressed or not, so presses are invisible",
        ],
        answer: 2,
        explain: "With a pull-up holding the pin high, a button to +3V3 changes nothing. The press must pull the pin LOW, and ERC cannot see intent.",
      },
      {
        id: "en-rc-values",
        q: "C4 is 0.1 µF here, but L1.01's EN cap was 1 µF. Which is correct?",
        options: [
          "Only 0.1 µF: 1 µF is too slow",
          "Both: they give 1 ms and 10 ms reset delays, and either satisfies the power-on requirement",
          "Only 1 µF: 0.1 µF is a design error",
        ],
        answer: 1,
        explain: "The requirement is an RC that lets the rail settle before EN rises. 10 kΩ with 0.1 µF is the datasheet baseline; 1 µF buys extra margin. It is a margin choice.",
      },
      {
        id: "header-exclusions", reviewId: "header-exclusions",
        q: "Which pins does the expansion header deliberately EXCLUDE?",
        options: [
          "Every strapping, USB, and already-used pin (GPIO0/3/45/46, 19/20, 21, 47, EN)",
          "The ground pins",
          "The ADC1 pins, to protect them",
        ],
        answer: 0,
        explain: "Exclusion is the safety design: nothing a learner jumpers onto J2 can break boot, USB, the button, or the LED.",
      },
      {
        id: "five-volt-pin",
        q: "A learner jumpers the header's 5V position into IO5 to 'give the sensor pin more power.' What's wrong?",
        options: [
          "Nothing, the pin regulates it down",
          "ESP32-S3 GPIO are 3.3 V parts: 5 V into a pin can destroy it. 5V on the header is for powering peripherals only",
          "IO5 is a strapping pin",
        ],
        answer: 1,
        explain: "The module's GPIO are not 5 V tolerant. The header's 5V position exists to feed hungry loads, never to drive a pin.",
      },
      {
        id: "strap-nc",
        q: "GPIO3, 45, and 46 are left unconnected and are NOT on the header. Why?",
        options: [
          "They are broken on this module",
          "They are reserved for a future revision",
          "They are strapping pins the board doesn't need: leaving them NC and off the header means nothing can disturb a boot strap",
        ],
        answer: 2,
        explain: "Unused strapping pins rest at safe module-internal defaults. Keeping them off the header makes that safety permanent.",
      },
      {
        id: "pwr-flag-recall",
        q: "ERC flags 'input power pin not driven' on VBUS. Your move?",
        options: [
          "Drop a PWR_FLAG on the net: the connector has no output pin ERC can see",
          "Delete the warning from the report",
          "Ignore it, the rail obviously works",
        ],
        answer: 0,
        explain: "VBUS, +5V and GND are all powered through connectors or passives, so each carries a PWR_FLAG. Same three flags as L1.01.",
      },
      {
        id: "both-ends-label", reviewId: "l102-both-ends-label",
        q: "You type IO5 on the module pin and IO6 at the matching header position. What does ERC report?",
        options: [
          "A conflicting-label error on both nets",
          "Nothing: both nets look connected, so the mistake is invisible to the checker",
          "An unconnected-pin warning on the header",
        ],
        answer: 1,
        explain: "A missing label leaves a loose pin, which ERC flags. A wrong label leaves two nets that both look used, so only your eyes and the answer key catch it.",
      },
    ],
  },

  exit(
    "Seven islands wired with every keystroke earned: the proven core, a resistor-free button you can defend, a header that excludes its way to safety, and a clean ERC. Attach the report. Carry forward: the antenna keep-out becomes a drawn rule at layout, and on this board the radio is the product.",
  ),

  ref("ESP32-S3 Hardware Design Guidelines (Espressif): schematic checklist, EN reset RC, strapping pins", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html"),
  ref("ESP32-S3 datasheet (Espressif): GPIO absolute-maximum current and the internal pull-up value", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("USB Type-C Cable and Connector Specification (USB-IF): the 5.1 kohm CC pulldown that marks a power sink", "https://www.usb.org/usb-type-cr-cable-and-connector-specification"),
  ref("KiCad 10: Schematic Editor manual", "https://docs.kicad.org/10.0/en/eeschema/eeschema.html"),
];

publishCard({ slug: "l1-02-espnow-link", stage: "SCHEMATIC", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
