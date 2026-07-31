// L1.04 single-servo driver — SCHEMATIC card.
//
// Authored ahead of the board from docs/boards/l1-04-single-servo/{design.md,
// bom.csv,validation-log.md}, with L1.01's SCHEMATIC card as gospel for the
// eight core islands the two boards share (KiCad 10, the starter, place by
// convention, the keys, wire-by-name, PWR_FLAG, no-connects, the ERC flow) and
// for every number those islands state.
//
// Two corrections against the card this replaces, both from design.md:
//
//   1. D2 sits on VSERVO, DOWNSTREAM of F2. The old card wired it "across the
//      J4 side". A crowbar upstream of the fuse shorts the supply without the
//      fuse in its path, so F2 never trips, which is the entire mechanism
//      (design.md §2 theory of operation, §4, RK2).
//   2. D2 and D3 both put their cathode on VSERVO. They bound opposite sides of
//      the rail: D2 the negative excursion at about -0.4 V, D3 the positive one
//      at 10.3 V (design.md K8). That symmetry is worth teaching.
//
// EN cap note: this board's bom.csv folds C7 onto the 0.1 uF line, so the card
// states 0.1 uF and computes the RC from it. L1.01's C7 is 1 uF and Espressif's
// checklist recommends 10 k / 1 uF as the usual setting. That divergence is
// real, it is flagged in the PR, and it is the owner's to reconcile in the BOM.
// The deepDive states both numbers rather than picking one silently.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

/** `See it wired · X` reveal capture, the L1.01 island-close shape. */
const wired = (island: string, caption: string, hint: string): Blk => ({
  type: "image", src: "", aspect: "16:10", alt: caption, caption,
  boxed: true, reveal: `See it wired · ${island}`, captureHint: hint,
});

const BLOCKS: Blk[] = [
  tube("Schematic stage: nine islands, and the one net that must stay alone"),

  {
    type: "callout", severity: "info", label: "Mode · orient · Meet the board",
    body: "Read this once. You will not open KiCad yet. This is the map for everything you are about to wire. As you go: **Mode · do** means do it in KiCad, **Check yourself** is a quick gut-check, and **Eyeball it** means verify by eye.",
  },
  prose(
    "Nine small jobs stand between a bare module and a board that drives a servo. Six of them you have done before on L1.01 and they are here in full, because a schematic you half-remember is a schematic you half-draw. Three are new, and all three belong to one net.\n\nThat net is **VSERVO**. It is born at a screw terminal, passes a fuse, gets a crowbar, a clamp and a reservoir hung off it, and ends at one pin of a 3-pin header. It touches nothing else on the board. Keeping it that way is the single thing this stage has to get right.",
  ),
  {
    type: "steps",
    ordered: false,
    items: [
      "the right voltage for the logic",
      "a steady supply at the chip",
      "a defined way to boot",
      "a USB port that negotiates power and shrugs off a static zap",
      "that port's data pair",
      "a light or two you can see",
      "a second power rail that shares only ground",
      "a signal wire with a resistor in it",
      "one clean ground under it all",
    ],
  },
  prose(
    "Each section below takes one of those jobs and shows you the exact parts that solve it. Read them in order: they follow the power in at the USB connector, out to the module, and then start again at the screw terminal for the rail that has nothing to do with any of it.\n\nEvery part has a [[refdes]] (U1, C8, R7), the short label that ties its symbol, its BOM line and its spot on the board together. You will meet them in the tables under each section.",
  ),
  { type: "partModel", mpn: "ESP32-S3-WROOM-1-N16R2", caption: "U1: the module at the centre of all nine islands" },
  {
    type: "table",
    columns: ["Island", "What it does"],
    rows: [
      [{ text: "1 · Regulator (U2)" }, { text: "5 V in, a steady 3.3 V rail out" }],
      [{ text: "2 · Decoupling and the module" }, { text: "caps at U1's pins so the rail stays steady" }],
      [{ text: "3 · Boot and reset" }, { text: "pull-ups, the EN RC, the EN and BOOT buttons" }],
      [{ text: "4 · USB power and protection" }, { text: "the CC sink, the fuse, ESD at the port" }],
      [{ text: "5 · USB data" }, { text: "the D+ and D- pair to the module, named as a pair" }],
      [{ text: "6 · Indicator LEDs" }, { text: "a power light and a user light, each current-limited" }],
      [{ text: "7 · The servo rail, VSERVO" }, { text: "screw terminal, fuse, crowbar, clamp, reservoir" }],
      [{ text: "8 · The servo signal and connector" }, { text: "GPIO4 through a resistor to a GND / V+ / SIG header" }],
      [{ text: "9 · Headers, test points, grounds, no-connects" }, { text: "every GPIO out, then the two finishing sweeps" }],
    ],
  },

  // ── setup ─────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "info", label: "Setup · Get KiCad and the starter open",
    body: "These lessons run in **KiCad 10**: every menu path, shortcut and dialog here matches version 10. If it is not installed, grab KiCad 10 or newer first. It is free, official, and runs on Windows, macOS and Linux. Already have it open? Go straight to the starter download below.",
  },
  ref("Download KiCad: official, all platforms", "https://www.kicad.org/download/"),
  { type: "action", action: "downloadKicadStarter", label: "Download the L1.04 KiCad starter" },
  {
    type: "callout", severity: "info", label: "Place by convention",
    body: "Arrange the parts the export gave you so the drawing reads the way the circuit works: power in at the top, signal flowing left to right. Put [[power port|power symbols]] at the top pointing up and grounds at the bottom pointing down. Group parts by sub-circuit. This board has one extra grouping rule: **keep the whole VSERVO island physically apart on the sheet**, in its own corner, with nothing from the logic side drawn through it. Where a part sits on the schematic is only readability, but on this board the readability *is* the lesson.",
  },
  does("arrange the sub-circuits", [
    {
      text: "**Ctrl+F** each part and drag its sub-circuit as one cluster into position. The export scatters them on a grid. Work in signal order.",
      proof: "Each sub-circuit moves as one cluster, not as scattered single parts.",
    },
    {
      text: "**USB front-end** (J1, F1, D1) to the far **left**, where power and data enter, with **D1 hard against J1**. **Regulator** (U2, C5, C6) just to its right, upper-left, so 5 V flows in and 3V3 leaves rightward.",
      proof: "J1, F1 and D1 sit together at the far left with D1 hard against J1, and U2 with C5 and C6 just to their right.",
    },
    {
      text: "**U1, the module**, in the **centre**. Its decoupling caps (C1, C2, C3) by its 3V3 pin, and boot/reset (R1, R2, SW1, SW2, C7) just left of it, by U1's EN and IO0 pins.",
      proof: "U1 sits in the centre with its decoupling caps by its 3V3 pin and the boot and reset parts just left of it.",
    },
    {
      text: "**The servo island** (J4, F2, D2, D3, C8, C9, J5) in its **own corner**, well away from the USB front-end. Give it room: C8 is a 10 mm can and it will dominate that area on the board too.",
      proof: "The servo parts sit together in their own corner, clear of the USB and regulator islands.",
    },
    {
      text: "**LEDs** (LED1, LED2, R5, R6) in a corner near U1. **Headers J2 and J3** on the right edges. **Test points** anywhere open. Rails point up, grounds point down.",
      proof: "LEDs sit near U1, J2 and J3 are on the right edges, rails point up and grounds point down.",
    },
  ]),
  {
    type: "image", src: "/guide-diagrams/schematic-conventions.svg",
    alt: "An IC with signal flowing in from the left and out to the right, a 3V3 supply symbol pointing up, a GND symbol pointing down, and a decoupling capacitor drawn right at the power pin.",
    caption: "The four habits that make a schematic readable.",
  },
  ref("KiCad Library Conventions (KLC)", "https://klc.kicad.org/"),

  {
    type: "callout", severity: "info", label: "Mode · do · in KiCad · Build it, island by island",
    body: "Each sub-circuit is one island: meet it, wire it, then eyeball it against the reference. Hold the full [[ERC]] for the very end. Run it per-island and it is just a wall of 'not connected' noise.",
  },
  {
    type: "callout", severity: "info", label: "Ports and labels first, then wires",
    body: "One ordering habit saves the most rework: on each island, drop every **power port** and **net label** onto its pin *first*, then draw the few real wires between legs. Run a wire first and a label dropped on top of it later forces you to nudge the wire aside. Most connections here are by name anyway, so a drawn wire is the exception.",
  },
  {
    type: "callout", severity: "info", label: "Keys · the KiCad 10 keys you'll use",
    body: "A handful of keys do most of the work. Hover over a part and press the key. Live list: Preferences ▸ Hotkeys, or press ? in the editor.",
  },
  {
    type: "table",
    columns: ["Key", "What it does"],
    rows: [
      [{ text: "A", tone: "gold", decoration: "badge" }, { text: "Add a symbol (place a part)" }],
      [{ text: "P", tone: "gold", decoration: "badge" }, { text: "Add a power port: +3V3, +5V, GND, VBUS, PWR_FLAG" }],
      [{ text: "W", tone: "gold", decoration: "badge" }, { text: "Draw a wire" }],
      [{ text: "L", tone: "gold", decoration: "badge" }, { text: "Place a net label" }],
      [{ text: "R / M / G", tone: "gold", decoration: "badge" }, { text: "Rotate / move / drag (G keeps wires attached)" }],
      [{ text: "X / Y", tone: "gold", decoration: "badge" }, { text: "Mirror across the X / Y axis" }],
      [{ text: "E / V / U", tone: "gold", decoration: "badge" }, { text: "Edit properties / value / reference" }],
      [{ text: "Q", tone: "gold", decoration: "badge" }, { text: "No-connect flag: mark a pin you leave open" }],
    ],
  },
  {
    type: "callout", severity: "info", label: "Power symbol or net label?",
    body: "A power symbol (press **P**) is for a rail that many parts tap: VBUS, +5V, +3V3, GND. A net label (press **L**) is for a signal between a few pins: USB_D+, EN, IO4. The test: a rail many things share, or a signal between a few pins? One mechanical difference: a power symbol drops straight onto a pin, but a net label rides a **wire**, so for a signal like EN or IO4 draw a short wire off the pin first, then press **L** and drop the label on that wire.",
  },
  prose(
    "**VSERVO is the interesting case.** It is a rail: six parts tap it. But it is a rail that exists on this board only, with no matching global symbol, so you make it with a **net label** rather than a power symbol. That is fine, and it has an upside. Every VSERVO connection on the sheet will be a label you typed, which means a single **Ctrl+F** for `VSERVO` shows you the complete list of everything touching that rail. You will use that at the end of this card as the proof that the two rails never met.",
  ),
  prose(
    "One shortcut for the header slog in island 09: **Insert** repeats the last wire or label one grid-step down and **auto-increments the trailing number**, so `IO4` becomes `IO5` becomes `IO6`. Set the step under **Preferences ▸ Schematic Editor ▸ Editing Options ▸ Label increment**. The header order jumps around, so Insert only earns its keep on the unbroken runs; everywhere else you place by hand from the table, and that is expected. No Insert key on a compact laptop? Use the on-screen keyboard, or **Fn+Enter** on a Mac.",
  ),
  prose(
    "One more thing before you start: you wire by pin **name**, not pin **number**. The regulator's pins read `VIN`, `VOUT`, `GND`, `EN`. The module's read `3V3`, `EN`, `IO0`, `IO4`, `IO19`, `IO20`. The connectors number their pins, and for J4 and J5 the numbers are what matters, so those two islands call out pin numbers explicitly.",
  ),

  // ── 01 regulator ──────────────────────────────────────────────────────────
  sect("01", "The regulator", "Your ESP32-S3 wants a clean 3.3 V supply, but USB gives you 5 V. Something has to step it down."),
  prose(
    "That something is **U2**, the RT9080. It is an [[LDO]], short for low-[[dropout]], a voltage regulator that holds its output steady even when its input is only a little above it.\n\nWhy not a voltage divider? Because a divider sags the moment the chip pulls current, and the ESP32's draw jumps every time its radio transmits. A regulator actively holds 3.3 V no matter the load.\n\nThe RT9080 needs a capacitor on its input and another on its output to stay stable. That is **C5** and **C6**, 1 µF each. The datasheet promises stability with 1 µF ceramic in and out, which is exactly what the BOM gives it.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "U2", decoration: "ref" }, { text: "RT9080-33GJ5", decoration: "mpn" }, { text: "5 V to 3.3 V LDO, 600 mA" }],
      [{ text: "C5  C6", decoration: "ref" }, { text: "1 uF X7R" }, { text: "LDO input and output stability caps" }],
    ],
  },
  does("wire the regulator", [
    {
      text: "Press **Ctrl+F**, type **U2**, Enter. That highlights U2's name tag, so **M** will not move it yet: click the **body** of U2, press **M**, and drag it to clear space. Then press **P** and drop a **+5V** power port on its **VIN** pin.",
      proof: "U2 sits in clear space with a +5V port on VIN.",
    },
    {
      text: "EN cannot float or the LDO may never turn on, so wire **EN to VIN**: press **W** and click from one pin to the other. Now EN sits high with the input.",
      proof: "A wire runs from EN to VIN, so EN sits high with the input.",
    },
    {
      text: "**Flag the input rail.** +5V reaches VIN through a passive fuse, so nothing on that rail is a power output ERC recognises as a source. Press **P**, pick **PWR_FLAG**, and drop it on the wire you just ran from EN to VIN.",
      proof: "A PWR_FLAG sits on the +5V net, on the EN-to-VIN wire.",
    },
    {
      text: "Press **P** and drop a **+3V3** power port on **VOUT**: the 3.3 V rail leaving the regulator.",
      proof: "VOUT carries a +3V3 port.",
    },
    {
      text: "Stability caps: **C5** across the input (one leg +5V, one GND) and **C6** across the output (one leg +3V3, one GND). Same port name is the same net, so nothing is drawn between them and U2.",
      proof: "C5 carries +5V and GND on its legs, C6 carries +3V3 and GND, and no wire is drawn to U2.",
    },
    {
      text: "Grounds: press **P** for **GND** and drop it on U2's GND pin and on the free leg of C5 and C6. Once one GND port is down, copy and paste it rather than re-picking it each time.",
      proof: "U2's GND pin and the free leg of C5 and C6 each carry a GND port.",
    },
  ]),
  tube("Wire the regulator island"),
  wired(
    "the regulator",
    "Check the regulator: VIN on +5V, VOUT on +3V3, a cap each side, EN tied high.",
    "KiCad 10 Schematic Editor, the regulator island only: U2 with +5V on VIN, EN tied to VIN, +3V3 on VOUT, C5 and C6 each side. Zoom so every refdes, pin and rail label is legible.",
  ),
  check(
    "**Why a regulator instead of two resistors dropping the voltage?** A resistor divider sags the moment the chip draws current, and this chip's draw jumps every time the radio transmits. A regulator holds 3.3 V steady regardless of load.",
  ),
  dive(
    "Why a low-dropout part",
    "The RT9080's [[dropout]], the headroom it needs above 3.3 V to keep regulating, is small: about **0.31 V typical** and **0.53 V worst case** at this load. So even when USB sags to around 4.6 V under load, the worst case still leaves 4.6 minus 0.53, about 4.07 V, comfortably above 3.3 V.\n\nA cheaper regulator wanting 1 to 2 V of headroom would drop out right there and the 3.3 V rail would collapse. That margin is the whole reason the design picks an LDO.\n\nHold on to the number **0.5 V**. It reappears in the requirements card as the thing a servo stall eats when the servo is wired to this rail: a 0.9 A stall across 0.3 to 0.5 ohm of USB cable and connector sags the input by 0.27 to 0.45 V, which is most of the headroom you just counted. That is the entire argument for the second rail, expressed in the regulator's own datasheet numbers.",
  ),
  gotcha(
    "an LDO without its output cap can oscillate",
    "C5 and C6 are not optional decoration. An LDO missing its output capacitor can turn into an oscillator, which converts your clean rail into noise that shows up as unexplained resets later.",
  ),

  // ── 02 decoupling ─────────────────────────────────────────────────────────
  sect("02", "Decoupling and the module", "A steady rail at the regulator is not the same as a steady rail at the chip a few centimetres away."),
  prose(
    "When the ESP32 switches its transistors millions of times a second, it grabs tiny gulps of current faster than the regulator across the board can respond. Left unfed, the 3.3 V right at the chip's pins dips on every gulp, and a [[microcontroller]] fed a dipping rail glitches or resets.\n\nThe fix is a small [[decoupling capacitor|capacitor]] parked right at each power pin: **C2 and C3**, 0.1 µF each. They hold a reserve of charge and hand it over instantly, then refill between demands. **C1**, 10 µF, plays the same game one size up: a [[bulk capacitor|bigger, slower reservoir]] for the whole 3.3 V rail.\n\nHold on to this idea. Island 07 does exactly the same thing on the servo rail, at a thousand times the scale, for a load that is mechanical rather than electronic.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "C2  C3", decoration: "ref" }, { text: "0.1 uF X7R" }, { text: "Bypass, clustered at the module's 3V3 pin" }],
      [{ text: "C1", decoration: "ref" }, { text: "10 uF X5R" }, { text: "Bulk reservoir for the 3.3 V rail" }],
    ],
  },
  does("wire the decoupling, then tie the module", [
    {
      text: "**Ctrl+F** to **U1**, click its body, press **M**, and drag it to the centre of the sheet. It is the hub every other island feeds. Then drag **C1, C2, C3** in beside it.",
      proof: "U1 sits in the centre of the sheet with C1, C2 and C3 beside it.",
    },
    {
      text: "Drop a **+3V3** and a **GND** port on each of C1, C2 and C3. Same name, same net, nothing drawn between.",
      proof: "Each of C1, C2 and C3 carries a +3V3 port and a GND port.",
    },
    {
      text: "Now the module: **U1's 3V3** pin gets a +3V3 port, and **U1's visible GND** pin gets a GND port. The regulator can be perfect and the chip stays dark if 3V3 is not on the rail.",
      proof: "U1's 3V3 pin carries a +3V3 port and its visible GND pin carries a GND port.",
    },
    {
      text: "U1's pad also has hidden GND pins. You will confirm those land on GND in the grounds sweep in island 09.",
      proof: "You can say that U1 has hidden GND pins and that island 09 is where they get checked.",
    },
  ]),
  tube("Wire the decoupling and tie the module"),
  wired(
    "decoupling and the module",
    "Check the decoupling: each of C1, C2 and C3 between +3V3 and GND.",
    "KiCad 10 Schematic Editor, the decoupling island only: U1's supply pins with C1, C2 and C3 each on a +3V3 and a GND port. Zoom so the three caps, refdes and port labels are legible.",
  ),
  check(
    "**In one line, what do C2 and C3 do?** They sit at the chip's power pins and keep its 3.3 V steady when it suddenly pulls current, because the regulator cannot respond fast enough on its own.",
  ),
  dive(
    "Why small caps close, not one big one",
    "A capacitor only helps if it is close. The longer the path between it and the pin, the more its help fades, because that path has inductance and inductance is what resists a fast change in current. Two 0.1 µF caps right at the module's 3V3 pin beat one 0.2 µF cap a few millimetres away.\n\nThe same argument runs the other way for the big values. C1 at 10 µF is physically larger and internally slower, so it covers the bigger, slower swings the little caps cannot. Bulk plus bypass, each doing the part the other is bad at.\n\nYou will meet this pairing a third time in island 07, where **C8** at 1000 µF and **C9** at 0.1 µF do the identical job on the servo rail. Same physics, different decade.",
  ),
  gotcha(
    "the module's own decoupling is a cushion, not a licence",
    "Keep C1, C2 and C3 tight to the 3V3 pin, because that is the habit every board rewards. But know why you are getting away with it here: the WROOM already carries decoupling next to the chip **inside** the module, so these board caps are the bulk reservoir and rail steadier rather than the chip's last line of defence. On a bare chip that last millimetre is the whole game. Carry the habit into layout anyway.",
  ),

  // ── 03 boot & reset ───────────────────────────────────────────────────────
  sect("03", "Boot and reset", "A digital input wired to nothing does not read 0. It floats, picks up noise, and reads randomly."),
  prose(
    "The ESP32 checks two [[strapping pin|strapping pins]] the instant it wakes: EN (chip-enable and reset) and GPIO0 (boot select). Both must be at a definite level at that moment, so each gets a [[pull-up resistor]], **R1** and **R2** at 10 kΩ, gently tying it to 3.3 V. EN high means the chip runs. GPIO0 high at reset means boot normally from flash.\n\nThe two buttons override that resting level while you hold them. **SW1** pulls EN to ground to reset the chip. Holding **SW2** (GPIO0 to ground) through a reset drops the chip into USB download mode so you can flash new firmware. The resistor sets the default; the button wins while pressed.\n\nOne more part rides on EN: **C7**, 0.1 µF, from the EN net to GND. With R1's 10 kΩ it forms an RC that holds EN low briefly while the 3.3 V rail settles, so the chip leaves reset cleanly instead of racing its own supply, and it debounces SW1 so one press fires one reset rather than several.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "R1  R2", decoration: "ref" }, { text: "10 kohm" }, { text: "Pull-ups on EN and GPIO0" }],
      [{ text: "SW1  SW2", decoration: "ref" }, { text: "B3F-1000", decoration: "mpn" }, { text: "EN (reset) and BOOT (download)" }],
      [{ text: "C7", decoration: "ref" }, { text: "0.1 uF" }, { text: "EN reset RC and SW1 debounce" }],
    ],
  },
  does("wire boot and reset", [
    {
      text: "**R1** pull-up: one leg to a **+3V3** port. Its other leg is the **EN** net. Press **L** and drop an **EN** net label on that leg, on **U1's EN pin**, and on **SW1's** top leg. Same name is one net, so nothing is drawn across. **SW1's** other leg gets a **GND** port.",
      proof: "R1 has +3V3 on one leg, an EN label sits on its other leg and on U1's EN pin and SW1's top leg, and SW1's other leg carries GND.",
    },
    {
      text: "**C7, the EN cap.** Press **L** for an **EN** label on one leg, so it joins R1 and SW1 by name, and a **GND** port on the other.",
      proof: "C7 carries an EN label on one leg and a GND port on the other.",
    },
    {
      text: "**R2** pull-up on **IO0** the same way: a **+3V3** port on one leg, an **IO0** net label on the other, on **U1's IO0 pin**, and on **SW2's** top leg. **SW2's** other leg to a **GND** port.",
      proof: "R2 has +3V3 on one leg, an IO0 label sits on its other leg and on U1's IO0 pin and SW2's top leg, and SW2's other leg carries GND.",
    },
  ]),
  tube("Wire boot and reset"),
  wired(
    "boot and reset",
    "Check boot and reset: R1, SW1 and C7 on the EN net; R2 and SW2 on IO0.",
    "KiCad 10 Schematic Editor, boot and reset island: R1 and SW1 on the EN net with C7 from EN to GND, R2 and SW2 on IO0, both pull-ups to +3V3. Zoom so refdes and the EN and IO0 labels are legible.",
  ),
  check(
    "**Without R1, and with nothing pressed, what does EN read?** Nothing definite. It floats, picks up noise, and reads randomly, so the chip might reset at random or never start. The pull-up gives it a steady, known level.",
  ),
  dive(
    "Why 10 kilohms, and what the EN cap is worth",
    "A pull-up only has to set a resting level, not power anything, so it should be weak, meaning high-valued. At 3.3 V a 10 kΩ pull-up passes 0.33 mA, which is negligible, and it still holds the pin firmly high. A 100 Ω pull-up would burn 33 mA doing the same job and would fight the button when you pressed it.\n\nThe RC on EN is R1 times C7. On this board's BOM that is 10 kΩ times 0.1 µF, about **1 ms**. Espressif's own schematic checklist gives the usual recommendation as **10 kΩ with 1 µF**, roughly 10 ms, and adds that the value should be adjusted to the actual supply. L1.01 uses the 1 µF version. Either way the mechanism is the same: EN charges through R1 and crosses its threshold *after* the rail has come up, and the capacitor absorbs the contact bounce when you press SW1.\n\nThe pin to *not* hang a large capacitor on is GPIO0. Espressif call that out specifically, because enough capacitance there can hold GPIO0 low through a reset and drop the chip into download mode when you did not ask for it.",
  ),

  check(
    "**Could you steady GPIO0 by hanging a capacitor on it too, the way C7 steadies EN?** No, and Espressif call this one out by name. Enough capacitance on GPIO0 can hold it low through a reset, which is exactly the condition that drops the chip into download mode. The pull-up alone is the right treatment there.",
  ),

  // ── 04 USB power ──────────────────────────────────────────────────────────
  sect("04", "USB power and protection", "The port that touches the outside world: tell the charger to send power, fuse the rail, clamp static at the door."),
  prose(
    "Your board announces itself as a consumer, a [[sink]], by tying each [[CC pin]] to ground through a 5.1 kΩ resistor called [[Rd]]. The host sees that exact resistance and only then switches [[VBUS]] on. There are two of them, **R3** and **R4**, because Type-C is reversible: whichever way the plug goes in, one of CC1 and CC2 is the live one.\n\nThe rail gets two guardians. **F1** is a [[PTC|resettable fuse]] on VBUS: pull too much current and it heats, its resistance shoots up, and it throttles the current to a trickle until it cools. It is symmetric, so either leg faces either way. The rename across it is deliberate: the connector side is `VBUS`, raw 5 V straight off USB, and the regulator side is `+5V`, the same current now protected. Same wire, two names, and the rename is the fuse.\n\n**D1** is an [[ESD]] array on the two data lines and VBUS. A static spike off a fingertip is thousands of volts and is over in nanoseconds, so D1 clamps it to ground faster than that, before it reaches the module's USB pins.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "R3  R4", decoration: "ref" }, { text: "5.1 kohm" }, { text: "CC1 and CC2 sink resistors (Rd) to GND" }],
      [{ text: "F1", decoration: "ref" }, { text: "1206L050YR", decoration: "mpn" }, { text: "Resettable PTC on VBUS, 0.5 A hold / 1 A trip" }],
      [{ text: "D1", decoration: "ref" }, { text: "USBLC6-2SC6", decoration: "mpn" }, { text: "ESD clamp on D+, D- and VBUS" }],
    ],
  },
  does("wire USB power and protection", [
    {
      text: "**The power path.** Find **J1's VBUS pin**, press **P** and drop a **VBUS** port on it to name the raw rail. Place **F1**: press **W** to wire one leg to that VBUS node, then press **P** for a **+5V** port on F1's other leg. U2's VIN already taps +5V, so the shared name joins them with no wire drawn across.",
      proof: "J1's VBUS pin carries a VBUS port, and F1 has that VBUS node on one leg and a +5V port on the other.",
    },
    {
      text: "**Flag the VBUS rail.** VBUS comes straight off the connector, with no power-output pin driving it, so press **P**, pick **PWR_FLAG**, and drop it on the VBUS net.",
      proof: "A PWR_FLAG sits on the VBUS net.",
    },
    {
      text: "**Ground the connector.** Press **P** and drop a **GND** port on **J1's GND pin**. GND has no power output driving it either, so give it a **PWR_FLAG** too.",
      proof: "J1's GND pin carries a GND port with a PWR_FLAG on it.",
    },
    {
      text: "**The CC sink resistors.** **R3**: wire one leg to **J1's CC1 pin** and put a **GND** port on the other. **R4**: the same from **CC2**. Two 5.1 kΩ pull-downs, one per CC line, because only one of them is live at a time.",
      proof: "R3 runs from J1's CC1 to a GND port and R4 runs from CC2 to a GND port.",
    },
    {
      text: "**ESD at the port.** Place **D1** by the connector, wire its **VBUS** pin to the **raw VBUS** rail so the clamp sits ahead of the fuse, and put a **GND** port on its GND pin. Its data pins wait for island 05.",
      proof: "D1 sits by J1 with its VBUS pin on the raw VBUS rail and a GND port on its GND pin.",
    },
  ]),
  tube("Wire the USB port: power and protection"),
  wired(
    "USB power and protection",
    "Check the connector: F1 renaming VBUS to +5V, CC resistors to GND, D1 on raw VBUS.",
    "KiCad 10 Schematic Editor, USB front-end island: J1 with F1 on VBUS to +5V, R3 and R4 CC resistors to GND, D1 ESD array. Zoom so refdes and net labels are legible.",
  ),
  check(
    "**What two things does the USB port need protecting from?** Too much current, which is a short or a greedy load, and static-electricity zaps on the data lines. F1 handles the first over milliseconds; D1 handles the second in nanoseconds.",
  ),
  dive(
    "How F1 and D1 actually protect the port",
    "They work at opposite ends of the timescale, which is why one part cannot do both jobs.\n\n**F1** is thermal. Where a glass fuse blows once and needs desoldering, a [[PTC]] heats on overcurrent, its resistance climbs steeply, and it throttles the current to a trickle until it cools and heals. That is a process measured in tens of milliseconds to seconds. It is the right shape for a sustained overload and useless against a spark.\n\n**D1** is the other extreme. A static discharge off a fingertip is thousands of volts and is over in nanoseconds, so the clamp has to react faster than the event. It also has to be **low capacitance**, because anything bulky sitting across high-speed data lines would round off the USB edges and corrupt the signal.\n\nThe servo rail repeats the same split in island 07: **F2** is the thermal part and **D3** is the fast part. Different currents, different voltages, identical division of labour.",
  ),
  gotcha(
    "a missing CC resistor works on one cable and dies on another",
    "Leave R3 and R4 off and the board still works on an old USB-A-to-C cable, because a USB-A port has 5 V live with no handshake. On a modern USB-C charger the same board is stone dead. That is a bug that is intermittent by **cable** rather than by board, which is the worst kind to chase.",
  ),

  // ── 05 USB data ───────────────────────────────────────────────────────────
  sect("05", "The USB data pair", "Two fixed pins, one differential pair, and a naming trick that pays off at layout."),
  prose(
    "The module talks USB on two **fixed** pins: **D- is IO19 and D+ is IO20**, always. No other pins work, and nothing on the schematic hints at it. So the connector's two data lines run to exactly those pins, passing through **D1** on the way so a static hit is clamped before it arrives.",
  ),
  dive(
    "Where is the USB-to-serial chip?",
    "Older ESP32 boards needed a separate USB-to-UART bridge, a CP2102 or a CH340, just to flash and print to a serial monitor, because the classic ESP32 had no USB of its own.\n\nThe ESP32-S3 does. It has a built-in USB-Serial-JTAG peripheral wired to exactly these two pins, IO19 as D- and IO20 as D+. So the USB-C port talks to the chip directly, and flashing, the serial console and JTAG debug all run over the one cable. No bridge chip, no driver install, and one fewer hard-to-hand-solder part on the board.\n\nThat matters more on this board than it did on L1.01. When you get to bring-up you will want the serial console open while a motor is moving, watching for the reset that is supposed to never come. Native USB means the console is the same cable that powers the logic, with nothing extra to go wrong in between.",
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
  does("name the pair first, then label the pins", [
    {
      text: "**Name the two nets.** Press **L** and make **USB_D+** and **USB_D-**. Type a plain ASCII plus and minus, not a typographic glyph: the differential-pair router matches the literal suffix, and that is what pairs them at layout.",
      proof: "Two labels exist, spelled USB_D+ and USB_D- with a plain ASCII plus and minus.",
    },
    {
      text: "**Label the D+ line.** Drop **USB_D+** on **J1's DP1 and DP2**, on **both of D1's D+ pins**, and on the module's **IO20**. Nothing is wired across: the shared name is the connection.",
      proof: "USB_D+ appears on J1's DP1 and DP2, on both of D1's D+ pins, and on U1's IO20.",
    },
    {
      text: "**Label the D- line.** The same with **USB_D-** on **J1's DN1 and DN2**, **both of D1's D- pins**, and the module's **IO19**. D1 is symmetric, so which line you call D+ is a free choice. Just keep them straight from connector to module.",
      proof: "USB_D- appears on J1's DN1 and DN2, on both of D1's D- pins, and on U1's IO19.",
    },
  ]),
  prose(
    "KiCad reads a shared base name plus a paired suffix, `+` and `-` or `_P` and `_N` and never mixed, as a [[differential pair]]. That schematic-side naming is what unlocks the differential-pair router and length matching when you reach layout. Nothing else on the sheet says these two wires are a matched team.",
  ),
  wired(
    "the USB data pair",
    "Check the pair: USB_D+ on J1 DP, D1 and IO20; USB_D- on J1 DN, D1 and IO19.",
    "KiCad 10 Schematic Editor, the USB data pair: J1's DP and DN pins, D1's I/O pins, and the module's IO19 and IO20, all carrying the USB_D- and USB_D+ labels. Zoom so the labels read.",
  ),
  check(
    "**Why label the data nets USB_D+ and USB_D- instead of IO19 and IO20?** The matched plus and minus suffix is what marks them a differential pair, which is exactly what unlocks the pair router and length matching at layout.",
  ),

  // ── 06 LEDs ───────────────────────────────────────────────────────────────
  sect("06", "Indicator LEDs", "An LED is a diode, and a diode is a poor judge of its own appetite."),
  prose(
    "Give an LED more voltage than it wants and it pulls more and more current until it cooks itself, so it never goes straight across a supply. A [[current-limiting resistor|resistor in series]] sets the current instead.\n\nHere that resistor is **470 Ω**, a gentle few milliamps: bright enough to see, easy on the [[GPIO]] driving it. **LED1** in red is the power light, wired +3V3 through **R5** to LED1 to GND, so it glows whenever the board has power. **LED2** in yellow is the user light, driven by a pin: **IO2** through **R6** to LED2 to GND.\n\nNote the value. **R5, R6 and R7 are the same 470 Ω part**, and R7 is the one in the servo signal line in island 08. Three of them come on the same BOM line.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "LED1", decoration: "ref" }, { text: "Red, Vf about 1.8 V" }, { text: "Power indicator" }],
      [{ text: "LED2", decoration: "ref" }, { text: "Yellow, Vf about 2.0 V" }, { text: "User / blink LED on IO2" }],
      [{ text: "R5  R6", decoration: "ref" }, { text: "470 ohm" }, { text: "LED series current-limit" }],
    ],
  },
  does("wire the LEDs", [
    {
      text: "**LED1, the power light.** Ports first: a **+3V3** port on **R5's top leg** and a **GND** port on **LED1's cathode**, the bar side. Then one wire with **W** from **R5's bottom leg to LED1's anode**.",
      proof: "R5's top leg carries +3V3, LED1's cathode carries GND, and one wire joins R5's bottom leg to LED1's anode.",
    },
    {
      text: "**LED2, the user light.** Same shape, but a GPIO drives the top: press **L** and put an **IO2** label on **R6's top leg**, then a **GND** port on **LED2's cathode**, and one wire from **R6's bottom leg to LED2's anode**.",
      proof: "R6's top leg carries an IO2 label, LED2's cathode carries GND, and one wire joins R6's bottom leg to LED2's anode.",
    },
    {
      text: "**Polarity, the silent bug.** The bar side of the symbol, the cathode, must face **GND**. Backwards it simply stays dark, and ERC says nothing, so eyeball each LED against the reference before moving on.",
      proof: "Every LED's bar side faces the ground end of its string.",
    },
  ]),
  {
    type: "callout", severity: "info", label: "Picking the user-LED pin",
    body: "Why IO2 for LED2? It is a plain GPIO with no start-up duty, which is exactly what you want for something you switch on and off. The pins to keep a driven part off are the strapping pins (0, 3, 45, 46), the two USB data pins (19, 20), and the serial-console pins (43, 44, which you leave free for debugging). IO2 sits clear of all of them. **IO4**, this board's servo pin, is clear of them too, and it is an [[ADC1]] pin, so choosing it for the servo does cost you one analog input. That is a deliberate trade: nine ADC1 pins remain on the headers.",
  },
  tube("Wire the LEDs"),
  wired(
    "the indicator LEDs",
    "Check the LEDs: +3V3 to R5 to LED1 to GND, and IO2 to R6 to LED2 to GND.",
    "KiCad 10 Schematic Editor, the LED island: +3V3 to R5 to LED1 to GND, and IO2 to R6 to LED2 to GND. Zoom so both LEDs, their series resistors, refdes and net labels are legible.",
  ),
  check(
    "**You wire the user LED to GPIO0 by mistake. What might go wrong?** GPIO0 is a strapping pin. An LED circuit can hold it low at power-up, dropping the chip into download mode instead of running your code. Keep driven parts off GPIO0, 3, 45 and 46.",
  ),
  dive(
    "Sizing the resistor, and why the same value suits the servo signal",
    "The resistor sets the current from the leftover voltage: **I = (V − Vf) / R**. The red LED drops about 1.8 V across itself, so on 3.3 V through 470 Ω you get (3.3 − 1.8) / 470, about **3.2 mA**. The yellow LED's forward voltage is nearer 2.0 V, so the same resistor gives about **2.8 mA**. That is why swapping LED colours at a fixed resistor quietly changes the brightness.\n\nR7 in island 08 is the same 470 Ω part doing an unrelated job. A servo's signal input draws almost nothing, so the resistor barely affects the pulse. What it does is bound the current if that line is ever shorted to the 5 V servo rail: 5 V across 470 Ω is about **10.6 mA** of short current, and the part that actually flows into the GPIO's protection diode is smaller still, roughly **(5 − 3.6) / 470**, about **3 mA**. One commodity value, two completely different arguments for it.",
  ),
  gotcha(
    "an LED without its series resistor flashes once and dies",
    "R5 and R6 are not optional. An LED straight across a rail is a short circuit with extra steps.",
  ),

  // ── 07 the servo rail ─────────────────────────────────────────────────────
  sect("07", "The servo rail: VSERVO", "A second power rail, born at a screw terminal, that touches five parts and one header pin and never meets anything else."),
  prose(
    "Everything so far was L1.01. This island is why this board exists.\n\n**VSERVO** starts at **J4**, a two-position screw terminal where an external regulated 5 V lands. It passes through **F2**, the resettable fuse, and becomes the rail. Hung off that rail are three parts that do nothing at all while everything is fine: **D2** the reverse-polarity crowbar, **D3** the transient clamp, and **C8** with **C9**, the reservoir. Then the rail leaves for **J5 pin 2**, and that is the entire net.\n\nOrder matters and it is the thing to get right. **F2 goes between the terminal and everything else.** Protection only protects what sits behind it, and D2's whole plan is to draw enough current to trip F2. Put the crowbar upstream of the fuse and it would short the supply with nothing in the path to interrupt it.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role on this net"],
    rows: [
      [{ text: "J4", decoration: "ref" }, { text: "282837-2", decoration: "mpn" }, { text: "Pin 1 is the external +5 V in, pin 2 is GND. Silkscreen marks the polarity" }],
      [{ text: "F2", decoration: "ref" }, { text: "miniSMDC150F-2", decoration: "mpn" }, { text: "In line between J4 pin 1 and VSERVO. Non-polar, so either way round" }],
      [{ text: "D2", decoration: "ref" }, { text: "SS34-E3/57T", decoration: "mpn" }, { text: "Cathode on VSERVO, anode on GND. Bounds the rail's negative excursion at about -0.4 V" }],
      [{ text: "D3", decoration: "ref" }, { text: "SMAJ6.0A", decoration: "mpn" }, { text: "Cathode on VSERVO, anode on GND. Bounds the positive side, clamping at 10.3 V" }],
      [{ text: "C8", decoration: "ref" }, { text: "EEU-FM1C102", decoration: "mpn" }, { text: "Positive lead on VSERVO, negative on GND. 1000 uF reservoir. Polarised" }],
      [{ text: "C9", decoration: "ref" }, { text: "0.1 uF" }, { text: "Across VSERVO and GND. The fast partner C8 is too slow to be" }],
    ],
  },
  does("wire the servo power path", [
    {
      text: "**Start at the terminal.** Press **Ctrl+F** to **J4** and move it into the servo corner. Press **W** and wire **J4 pin 1** to one leg of **F2**. Press **P** and drop a **GND** port on **J4 pin 2**.",
      proof: "J4 pin 1 runs to F2 and J4 pin 2 carries a GND port.",
    },
    {
      text: "**Name the rail.** Draw a short wire off **F2's other leg**, press **L**, type **VSERVO**, and drop the label on it. Every remaining connection on this island is that same label, which is what makes the net searchable later.",
      proof: "F2's far leg carries a VSERVO net label, so the fuse sits between J4 and the rail.",
    },
    {
      text: "**D2, the crowbar.** Place it across the rail with its **cathode on VSERVO** and its **anode on GND**: a **VSERVO** label on the cathode leg and a **GND** port on the anode. Reverse-biased and invisible in normal use. Wire J4 backwards and it conducts hard, holds the rail near -0.4 V, and pushes F2 past its trip point.",
      proof: "D2 spans VSERVO to GND with its cathode, the banded end, on VSERVO and downstream of F2.",
    },
    {
      text: "**D3, the clamp.** Same orientation, **cathode on VSERVO**, **anode on GND**. It is unidirectional, so the band faces the rail. Below 6.0 V it does nothing; a motor transient above that is clamped to 10.3 V.",
      proof: "D3 spans VSERVO to GND with its cathode on VSERVO.",
    },
    {
      text: "**C8, the reservoir.** Its **positive** lead takes a **VSERVO** label and its **negative** lead a **GND** port. This is the one part on the board where getting the symbol the wrong way round is a real failure rather than a dark LED, so check the symbol's plus mark before you move on.",
      proof: "C8's positive lead carries VSERVO and its negative lead carries GND, with the symbol's polarity mark visible.",
    },
    {
      text: "**C9, the fast partner.** A **VSERVO** label on one leg and a **GND** port on the other. It is a ceramic, so it has no polarity.",
      proof: "C9 sits across VSERVO and GND.",
    },
    {
      text: "**Check the rail's driver.** VSERVO enters through a connector and a passive fuse, exactly like VBUS did, so nothing on it is a power output ERC recognises. If your final ERC calls VSERVO undriven, drop a **PWR_FLAG** on it for the same honest reason VBUS has one.",
      proof: "VSERVO either passes ERC or carries a PWR_FLAG, with no warning left unexplained.",
    },
  ]),
  tube("Wire the servo rail: terminal, fuse, crowbar, clamp, reservoir"),
  wired(
    "the servo rail",
    "Check VSERVO: J4 through F2 to the rail, with D2, D3, C8 and C9 all hanging off it to ground.",
    "KiCad 10 Schematic Editor, the VSERVO island only: J4 to F2 to the VSERVO label, with D2 and D3 cathodes on VSERVO, C8 polarity marked, C9 beside it. Zoom so refdes and every VSERVO label read.",
  ),
  check(
    "**F2 sits between the terminal and everything else. Why exactly there?** Because every fault path has to run through the fuse for the fuse to interrupt it, and that includes D2's deliberate short. A crowbar upstream of the fuse would short the supply with nothing in the path to stop it.",
  ),
  dive(
    "Two diodes, one rail, opposite directions of trouble",
    "D2 and D3 look identical on the sheet: both across VSERVO, both cathode up. They handle opposite failures.\n\n**D2 catches the rail going too far down.** A Schottky conducts when its anode is above its cathode, so with the anode on ground it does nothing while VSERVO is positive. Reverse the supply and VSERVO tries to go negative, D2 conducts, and the rail is held at about **-0.4 V**, which the electrolytic and the servo both survive comfortably. The current that flows doing this is the current that trips F2.\n\n**D3 catches the rail going too far up.** A transient suppressor conducts above its standoff voltage. At **6.0 V** standoff it stays asleep through the rail's 5.5 V ceiling and clamps a motor transient at **10.3 V**, safely under C8's 16 V rating.\n\nBetween them the rail is bounded on both sides: roughly -0.4 V to 10.3 V, whatever the servo or the person wiring the terminal does. Most of the motor's commutation energy never reaches the board at all, because it recirculates inside the servo's own H-bridge, so what D3 actually sees is the residue.",
  ),
  check(
    "**C1 is 10 µF for the whole logic rail. C8 is 1000 µF for one servo. Why a hundred times more for one part?** Because a motor's current step is a hundred times bigger. The chip's gulps are milliamps at a time; the servo's start is over an amp. The rule is the same in both places, ΔV equals I times t divided by C, so a bigger current over a similar time needs a proportionally bigger capacitor to hold the same rail.",
  ),
  {
    type: "image", src: "", aspect: "16:9",
    alt: "A scope on the servo rail during a stall: the rail dips as the motor starts, then holds while the external supply catches up.",
    caption: "First-hand: the servo rail through a start and a stall, with the logic rail on the second channel staying flat.",
    captureHint: "Two-channel scope capture: channel 1 on VSERVO at C8, channel 2 on the 3V3 test point, through a servo start into a stall. Both traces and the volts-per-division legible.",
  },
  gotcha(
    "a flipped crowbar shorts the rail every time you power it",
    "Orientation **is** the function here. Cathode on VSERVO means invisible until the supply is reversed. Anode on VSERVO means a deliberate short across the rail on every single power-up, tripping F2 with no fault present. ERC cannot tell the difference, because both are electrically valid connections of a two-pin part. Check the band against the reference image.",
  ),

  // ── 08 the signal ─────────────────────────────────────────────────────────
  sect("08", "The servo signal and its connector", "One resistor, three pins, and one pin order that forgives a mistake."),
  prose(
    "The signal half of the servo is almost nothing: **GPIO4** drives a pulse, **R7** at 470 Ω sits in the line, and the pulse arrives at **J5 pin 3**. The resistor bounds the current if that line is ever shorted to the servo's 5 V, and it damps ringing on a wire that will be a flying lead.\n\nThe connector is where the thought went. **J5** is a 1x3 header wired **pin 1 GND, pin 2 VSERVO, pin 3 SIG**. Power in the middle is the standard hobby-servo order and it exists for one reason: a 3-pin plug pushed on backwards swaps the two **outer** pins. With V+ centred, a reversed plug puts ground on the signal pin, which is harmless. With V+ on an outside pin, a reversed plug would put 5 V onto a 3.3 V logic line.\n\nNote where pin 2 comes from. J5's V+ is **VSERVO**, the external rail. It is not +5V and it is not VBUS. Those names are one keystroke apart on the sheet and one of them undoes the entire board.",
  ),
  {
    type: "table",
    columns: ["J5 pin", "Net", "Why"],
    rows: [
      [{ text: "1" }, { text: "GND" }, { text: "The servo's return, and the single point the two rails share" }],
      [{ text: "2" }, { text: "VSERVO" }, { text: "The external rail, after F2. Never +5V, never VBUS" }],
      [{ text: "3" }, { text: "SIG" }, { text: "GPIO4 through R7. The pulse the servo decodes" }],
    ],
  },
  does("wire the servo connector", [
    {
      text: "**J5's power pins first.** Press **P** and drop a **GND** port on **J5 pin 1**. Press **L** and drop a **VSERVO** label on **J5 pin 2**. That is the rail from island 07 arriving by name.",
      proof: "J5 pin 1 carries a GND port and J5 pin 2 carries a VSERVO label.",
    },
    {
      text: "**The signal resistor.** Place **R7**, draw a short wire off **U1's IO4** pin, press **L** and label it **IO4**, then put the same **IO4** label on R7's first leg. The GPIO reaches the resistor by name.",
      proof: "U1's IO4 pin and one leg of R7 both carry an IO4 label.",
    },
    {
      text: "**Out to the header.** Draw a short wire off **R7's other leg**, label it **SIG**, and put the same **SIG** label on **J5 pin 3**. The only path from the module to the servo now runs through R7.",
      proof: "R7's far leg and J5 pin 3 both carry a SIG label, and no other wire reaches J5 pin 3.",
    },
    {
      text: "**Prove the resistor is in the path.** Press **Ctrl+F** and search **IO4**. It should appear on exactly two places: U1's pin and R7's leg. If IO4 also appears at J5, you have shorted past the resistor.",
      proof: "A search for IO4 finds it on U1's IO4 pin and one leg of R7, and nowhere else.",
    },
  ]),
  tube("Wire the servo signal and the 3-pin header"),
  wired(
    "the servo connector",
    "Check J5: GND on pin 1, VSERVO on pin 2, and SIG on pin 3 arriving only through R7.",
    "KiCad 10 Schematic Editor, the servo connector island: J5 with GND, VSERVO and SIG on pins 1, 2 and 3, and R7 between U1's IO4 and the SIG label. Zoom so all three pin labels read.",
  ),
  check(
    "**Wiring J5 from memory, which order is right?** GND, then V+, then SIG, with power in the middle. Reversing a symmetric 3-pin plug swaps the outer pins, so centring power means a flipped plug exchanges ground and signal rather than dropping 5 V on a logic pin.",
  ),
  dive(
    "Nothing on this sheet says 50 Hz",
    "Look at island 08 and notice what is missing. There is no oscillator, no timer part, no divider network. The signal's timing lives entirely in firmware.\n\nThe ESP32-S3 generates it with the **LEDC** peripheral, the same hardware that dims an LED, configured for 50 Hz instead of the few kHz you would use for dimming. You pick a duty resolution, set the frequency, and write a duty value; the peripheral produces the pulse train on IO4 with no processor involvement between updates. Espressif's LEDC reference covers the setup, and note one ESP32-S3 specific: it only supports low-speed mode channels, unlike the original ESP32.\n\nThis is worth internalising as a hardware lesson rather than a firmware one. The schematic's job here was to get a clean 3.3 V pulse from a pin to a connector with a resistor in the way. Everything about *what* that pulse says is a software decision you can change without touching copper. That division is why the signal half of this board is three parts and the power half is six.",
  ),
  check(
    "**You want to see the pulse on a scope without unplugging the servo. Where do you probe?** The IO4 position on the breakout header. It carries the same net as the module pin, upstream of R7, so the servo keeps running while you look. Probing at J5 pin 3 works too and shows you the signal after the resistor, which is what the servo actually receives.",
  ),
  gotcha(
    "labelling J5 pin 2 as +5V instead of VSERVO",
    "This is the one keystroke that silently undoes the whole board. **+5V** is the logic rail after F1, fed by USB. **VSERVO** is the external rail after F2. Label J5 pin 2 as +5V and the servo now draws its stall current straight through the USB cable and the logic fuse, which is precisely the brownout this board was designed to make impossible. ERC will not say a word, because both are perfectly valid rails.",
  ),

  // ── 09 headers, grounds, no-connects ──────────────────────────────────────
  sect("09", "Headers, test points, grounds and no-connects", "Every module pin out to the board edge, then the two sweeps that make ERC's report honest."),
  prose(
    "**J2** and **J3** break the module out 1:1, in the module's own physical pin order, so you copy names straight down and never have to decide which pins to bring out. The GPIO numbers jump around as you go, because that is how they sit on the package, so follow the starter's own header table rather than a running count. A handful of positions are convenience rails you add rather than module pins, and each of those gets a [[power port]].\n\nOne rule for every free pin you label here: steer clear of the **strapping pins**, GPIO0, 3, 45 and 46, for anything you actively drive at power-up. Bringing a strapping pin out to a bare header is fine, because nothing is driving it there.\n\n**IO4 is the pin to think about on this board.** It now carries the servo pulse, and it also appears at the header the way every other GPIO does. That is deliberate: it lets you scope the signal without unplugging the servo. Just remember that anything you plug into that header position is in parallel with a servo that is being told where to point.",
  ),
  does("label U1's pins, then mirror them to the headers", [
    {
      text: "The pins with a dedicated circuit already carry their names: **3V3**, **GND**, **EN**, **IO0**, the USB pair on **IO19 and IO20**, **IO2** for the user LED, and now **IO4** for the servo. Leave those. Every other usable GPIO on U1 is still bare.",
      proof: "3V3, GND, EN, IO0, IO19, IO20, IO2 and IO4 already carry names and the rest of U1's GPIO are bare.",
    },
    {
      text: "For each bare GPIO: press **L**, type the name printed on that pin, and drop the [[net label]] on it. On an unbroken run, **Insert** repeats the last label one pin down with the number auto-bumped. Hand-place where the numbering jumps.",
      proof: "Every bare GPIO carries a net label matching the name printed on that pin.",
    },
    {
      text: "**Mirror them across.** For each header position, drop the **same** label as the module pin. Reuse the exact spelling: **EN** is EN, not RESET, and **IO4** at the header is the same IO4 that reaches R7.",
      proof: "Every header position carries a label spelled exactly as on the module side.",
    },
    {
      text: "**The rail positions** are power ports, not labels: **GND**, **+3V3**, and a **+5V** tap so you can power something from a breadboard. Note that the header's +5V tap is the **logic** rail, protected by F1 at 0.5 A. It is not the servo rail.",
      proof: "Each rail position on J2 and J3 carries a power port rather than a net label.",
    },
    {
      text: "**Test points.** Press **P** and drop a **+3V3** port on **TP1** and a **GND** port on **TP2**. Two bare loops to clip a meter onto the moment you first power the board.",
      proof: "TP1 carries a +3V3 port and TP2 carries a GND port, with nothing else attached.",
    },
  ]),
  gotcha(
    "label both ends, the one slip ERC cannot catch",
    "ERC catches a **missing** label, because that leaves a loose pin. It cannot catch a **wrong** one: put `IO5` on the module and `IO6` at the header and both nets read as used, so ERC stays silent. The header order is the one place to check your work against the reference image rather than against a green tick.",
  ),
  wired(
    "breakout headers",
    "Check the headers: every module pin mirrored to J2 and J3, rails on the power positions.",
    "KiCad 10 Schematic Editor, the breakout-header island: J2 and J3 with every module pin mirrored 1:1 and power ports on the rail positions. Zoom so the pin labels and refdes read.",
  ),
  prose(
    "Two finishing sweeps, both about what ERC can and cannot see. **Grounds:** every GND pin has to land on the same net, and this board has two families of them. The logic grounds you already know. The servo grounds are J4 pin 2, D2's anode, D3's anode, C8's negative lead, C9, and J5 pin 1. They all use the same **GND** port, and that is correct: **ground is the one thing the two rails share**, by design.\n\n**No-connects:** a genuinely open pin reads to ERC as a mistake, identical to one you forgot. A [[no-connect]] flag is you telling ERC that you meant it.",
  ),
  does("grounds, then the no-connect sweep", [
    {
      text: "**Logic grounds.** Press **P** and drop a **GND** port on U2's GND, the free legs of C5, C6 and the decoupling caps, each button's low leg, each LED's cathode, the module's visible GND pin, and TP2.",
      proof: "Every logic ground pin carries a GND port.",
    },
    {
      text: "**Servo grounds.** The same port on **J4 pin 2**, **D2's anode**, **D3's anode**, **C8's negative lead**, **C9's free leg**, and **J5 pin 1**. One ground net, both rails.",
      proof: "Every servo-side ground pin carries a GND port on the same net as the logic grounds.",
    },
    {
      text: "**Confirm the hidden grounds.** The WROOM pad has hidden GND pins. Turn on **View ▸ Show Hidden Pins**, check they sit on GND, and make sure the module's visible ground pin carries a GND port so the tie is on the sheet rather than implied.",
      proof: "With hidden pins shown, U1's hidden grounds sit on GND and its visible ground pin carries a GND port.",
    },
    {
      text: "**Then the no-connects.** Press **Q** on every pin you mean to leave open: J1's SBU pins, the regulator's NC pin, and any unused J1 contact.",
      proof: "A no-connect marker sits on every pin left deliberately open.",
    },
    {
      text: "**Not sure which are open?** Run **ERC** once as a scratch pass. Every genuinely open pin lists as 'not connected', and that list is your to-do. Press **Q** on each one you meant to leave open and the noise clears.",
      proof: "A scratch ERC run lists no 'not connected' pin you did not mean to leave open.",
    },
  ]),
  tube("Grounds, no-connects, and the first scratch ERC"),
  check(
    "**The servo's ground and the logic ground are the same net. Doesn't that break the isolation?** No, and it is required. Current needs a return path, and a shared ground is what lets the servo's signal have a reference the module agrees with. What the design keeps apart is the **high side**: no servo current flows through the USB, fuse or regulator path. Ground is the one thing the two rails are supposed to share.",
  ),

  dive(
    "ERC is the net, not a hoop",
    "You cannot instruct your way out of every slip. A careful builder with the rule right in front of them still half-finishes a both-ends task across forty pins, because that is how humans handle long two-sided work.\n\nSo the durable move is to design the safety net and learn to read it. That is why this card pairs each error-prone step with the checker's tell: label both ends, and if you miss one, ERC flags the loose pin. That flag **is** your check. Work the list to zero and the net has done its job.\n\nThe corollary is the part that matters on this board. Where there is no tell, there has to be a different net. ERC has nothing to say about a flipped crowbar, a reversed electrolytic, a shuffled connector order, or a VSERVO label that reads +5V. For those, the net is the eyeball list and the Ctrl+F sweep in the next section. Both are cheaper than the board they save.",
  ),

  // ── check band ────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "info", label: "Mode · check · Prove it",
    body: "Trace the things ERC cannot see against the answer key, then run the checker.",
  },
  {
    type: "image", src: "", zoom: true,
    alt: "Completed L1.04 schematic: the L1.01 core plus the VSERVO island with its fuse, crowbar, clamp and reservoir, and the 3-pin servo header.",
    caption: "The answer key: check your wiring against this, especially the VSERVO island and J5's pin order.",
    captureHint: "KiCad 10 Schematic Editor: the whole finished L1.04 schematic in one shot, every island and net label visible. Fit the full sheet, keep refdes and labels legible.",
  },
  trace("what ERC cannot catch on this board", [
    { text: "**VSERVO shares no copper with VBUS, +5V or +3V3.** Search the net name and read every hit.", help: "Two healthy rails look identical to ERC whether they are joined or apart. This is the one that undoes the whole board, and only a search finds it." },
    { text: "**D2's cathode faces VSERVO, and it sits downstream of F2.**", help: "Flipped, it shorts the rail on every power-up. Upstream of F2, it shorts the supply with no fuse in the path. Both are valid connections to ERC." },
    { text: "**C8's positive lead is on VSERVO.**", help: "A reversed electrolytic fails at first power, sometimes loudly. ERC does not read polarity marks." },
    { text: "**J5 reads GND, VSERVO, SIG down pins 1 to 3.**", help: "Any other order is electrically valid and mechanically wrong. The middle pin is the one that matters." },
    { text: "**J5 pin 3 reaches IO4 only through R7.**", help: "A stray IO4 label at the header position would bypass the resistor and leave the GPIO facing a 5 V short unprotected." },
    { text: "**U2's VIN sits on +5V, after F1, not on raw VBUS.**", help: "Both are valid rails, so ERC cannot tell them apart. On raw VBUS the regulator loses the fuse's protection." },
    { text: "**Each LED's bar side faces GND, and USB_D+ and USB_D- are not swapped through D1.**", help: "A backwards LED just stays dark. A swapped pair enumerates as nothing at all, and neither raises a flag." },
  ]),

  // ── ERC ───────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "info", label: "Mode · do · in KiCad · Run ERC and export",
    body: "Now let KiCad check it, fix to zero, and export the report the gate wants.",
  },
  prose(
    "[[ERC]] reads the whole schematic and flags what is electrically wrong: a pin connected to nothing, two outputs fighting, a power rail nothing drives. Run **Inspect ▸ Electrical Rules Checker**, then work the list to zero. The bar is the same one you meet again at DRC: clean, or every remaining flag is an exception you have marked and understood rather than one you scrolled past.",
  ),
  {
    type: "table",
    columns: ["ERC says…", "…you do"],
    rows: [
      [{ text: "Input power pin not driven", tone: "critical", decoration: "badge" }, { text: "Drop a PWR_FLAG on each rail no chip output drives: VBUS from the connector, +5V after the passive fuse, GND, and VSERVO if it is flagged. It tells ERC real power enters there. +3V3 needs none, because the regulator's output already counts as a driver." }],
      [{ text: "Pin not connected", tone: "critical", decoration: "badge" }, { text: "Meant to leave it open? Press Q for a no-connect flag. Now it reads as intentional rather than as an oversight." }],
      [{ text: "Unconnected wire / net", tone: "critical", decoration: "badge" }, { text: "A real mistake: join it, or delete the stray end. Do not scroll past this one." }],
    ],
  },
  dive(
    "Why a powered rail still trips ERC",
    "ERC checks by pin type. It wants every power-input pin fed by a power-output pin somewhere. Your +3V3 is fine, because the [[LDO|regulator]]'s output pin counts as a driver.\n\nVBUS arrives from a connector that has no output pin at all, and +5V sits on the far side of a passive fuse, so neither has a driver behind it. A **PWR_FLAG** is a tiny symbol whose single pin *is* a power output. Dropping it on VBUS, +5V and GND tells ERC, truthfully, that real power enters there.\n\nVSERVO has exactly the same shape: a connector, then a passive fuse. Whether ERC complains about it depends on the pin types your symbols use, so treat it the same way. If the checker names it, flag it. If it does not, leave it alone. What you never do is silence a warning you have not read.\n\nOne trap: if you spot **GNDPWR** in the symbol picker, that is not this. It is a separate stacked-ground symbol that makes its own net. Use a plain PWR_FLAG on a normal GND.",
  ),
  does("run ERC, then export", [
    {
      text: "Run ERC until it is clean, or until every remaining flag is marked and understood.",
      proof: "ERC reports no errors, or every remaining flag is marked and understood.",
    },
    {
      text: "**Run the isolation sweep one last time.** Press **Ctrl+F**, search **VSERVO**, and read every hit. The complete list is F2's output leg, D2, D3, C8, C9 and J5 pin 2. Anything else on that list is a bug, whatever ERC says.",
      proof: "A search for VSERVO returns only F2, D2, D3, C8, C9 and J5 pin 2.",
    },
    {
      text: "Plot the schematic to PDF (**File ▸ Plot**) for a readable copy, and keep the `.kicad_sch` source.",
      proof: "A schematic PDF sits alongside the .kicad_sch source.",
    },
    {
      text: "Attach your clean ERC report as this stage's artifact. That is what the gate below checks.",
      proof: "The stage shows your ERC report attached.",
    },
  ]),

  {
    type: "quiz",
    prompt: "Quick check: schematic",
    gate: true,
    questions: [
      {
        id: "vservo-isolation", reviewId: "l104-vservo-isolation",
        q: "Which single schematic mistake would silently defeat this board's whole purpose?",
        options: [
          "Labelling J5 pin 2 as +5V instead of VSERVO, so servo current runs back through the USB path",
          "Leaving a PWR_FLAG off the VSERVO rail",
          "Swapping C8 and C9",
        ],
        answer: 0,
        explain: "The brownout immunity is topological. One shared label rebuilds the shared rail the board exists to eliminate, and ERC stays quiet because both names are perfectly valid rails.",
      },
      {
        id: "fuse-position", reviewId: "l104-fuse-position",
        q: "F2 sits between the screw terminal and everything else on the rail. Why that exact position?",
        options: [
          "It keeps the trace short",
          "Every fault path, including the crowbar's deliberate short, has to run through the fuse for the fuse to interrupt it",
          "Resettable fuses need to be near a connector to cool down",
        ],
        answer: 1,
        explain: "Protection only protects what sits behind it. D2's entire mechanism is to draw enough current to trip F2, which requires F2 to be upstream of D2.",
      },
      {
        id: "crowbar-orientation",
        q: "D2's cathode goes on VSERVO. Flip it and what happens?",
        options: [
          "Nothing changes, because a two-pin diode symbol is symmetric",
          "It protects slightly better",
          "It conducts on every power-up, shorting the rail and tripping the fuse with no fault present",
        ],
        answer: 2,
        explain: "Orientation is the function. Cathode on the rail means invisible until the supply is reversed; anode on the rail means a deliberate short every time you switch on.",
      },
      {
        id: "two-diodes-two-directions",
        q: "D2 and D3 both sit across VSERVO with their cathodes on the rail. What is the difference between them?",
        options: [
          "D2 bounds how far the rail can go negative, D3 bounds how far it can go positive",
          "They are redundant, and the board would work with either one",
          "D2 handles fast transients and D3 handles slow ones",
        ],
        answer: 0,
        explain: "The Schottky holds the rail near -0.4 V on a reversed supply; the transient suppressor clamps a motor spike at 10.3 V. Together they bound the rail on both sides.",
      },
      {
        id: "sig-resistor",
        q: "R7 in the signal line earns its place by doing what?",
        options: [
          "Setting the servo's speed",
          "Matching the impedance of the signal wire",
          "Bounding the fault current if the signal pin is ever shorted to the 5 V rail, and damping ringing on the line",
        ],
        answer: 2,
        explain: "5 V through 470 ohms is about 10.6 mA of short current, and only about 3 mA of that reaches the GPIO's protection diode. Survivable by design rather than by luck.",
      },
      {
        id: "header-order-wire",
        q: "You are wiring J5 from memory. Which pin order is correct?",
        options: [
          "SIG, GND, V+",
          "GND, V+, SIG, with power in the middle",
          "V+, GND, SIG",
        ],
        answer: 1,
        explain: "Centred power survives a flipped plug, because reversing a symmetric 3-pin connector swaps the two outer pins.",
      },
      {
        id: "shared-ground-ok",
        q: "The servo's ground and the logic ground are the same net. Does that break the isolation the board is built on?",
        options: [
          "Yes, they should be two separate ground nets joined nowhere",
          "No: the isolation is on the high side, and a shared ground is what gives the signal a reference both ends agree on",
          "Yes, but it is an acceptable compromise to save a part",
        ],
        answer: 1,
        explain: "Current needs a return path. What the design keeps apart is the high side, so no servo current flows through the USB, fuse or regulator path.",
      },
      {
        id: "label-both-ends", reviewId: "l104-label-both-ends",
        q: "You label the module's pin IO5 but the matching header pin IO6 by mistake. Does ERC catch it?",
        options: [
          "No: both pins now look used, so ERC stays quiet, and only checking against the reference image finds it",
          "Yes, ERC flags the mismatched net names",
          "Yes, KiCad renames one so they match",
        ],
        answer: 0,
        explain: "A mislabel leaves both ends looking connected. A missing label leaves a loose pin ERC will flag, which is why the safety net half-covers this and the reference image covers the rest.",
      },
    ],
  },

  exit(
    "You have drawn a board with two power rails that meet at exactly one net, and you have proved it by searching for VSERVO rather than by trusting a green tick. Attach the ERC report, which the gate below tracks. Carry two things into layout: the antenna keep-out under U1 is a hard constraint, and the servo rail's traces have to be wide enough for 0.9 A, with the servo's return tied at C8 rather than wandering through the logic ground.",
  ),

  ref("ESP32-S3 Hardware Design Guidelines (Espressif): schematic checklist, the CHIP_PU RC, power and decoupling", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html"),
  ref("ESP32-S3 datasheet (Espressif): GPIO drive levels, strapping pins and the native USB pins", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module pinout and the hidden ground pads", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
  ref("USB Type-C Cable and Connector Specification (USB-IF): the 5.1 kohm CC pulldown that marks a power sink", "https://www.usb.org/usb-type-cr-cable-and-connector-specification"),
  ref("KiCad 10: Schematic Editor manual", "https://docs.kicad.org/10.0/en/eeschema/eeschema.html"),
];

publishCard({ slug: "l1-04-single-servo", stage: "SCHEMATIC", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
