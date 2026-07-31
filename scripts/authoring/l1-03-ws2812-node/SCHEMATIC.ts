// L1.03 WS2812 node — SCHEMATIC card.
//
// Authored ahead of the board from docs/boards/l1-03-ws2812-node/{design.md,
// bom.csv,validation-log.md}, with L1.01's SCHEMATIC card as gospel for the
// entire reused core: the RT9080 island and its dropout numbers, the decoupling
// story, the EN/BOOT RC, the CC sink resistors, the fuse rename (VBUS -> +5V),
// the USBLC6 pin map, the fixed IO19/IO20 USB pins, the LED sizing, the header
// method, the PWR_FLAG rule and the ERC flow. Where L1.01 states a number, this
// card states the same number.
//
// The card this replaces was 19 blocks against L1.01's 120.
//
// NEW islands, all from design.md sections 2, 3 and 4:
//   06  the 74AHCT125 level shifter, including the three PARKED gates
//   07  the onboard first pixel and the two 470 ohm damping resistors
//   08  the strip interface and the VBUS-to-5V_EXT isolation invariant
//
// ONE INTERPRETATION, flagged in the PR for the owner's walk-through: design.md
// calls the shifter and pixel supply "VBUS 5 V", but its own power budget counts
// both loads against the 0.5 A PTC hold, which puts them DOWNSTREAM of F1. On
// L1.01's net naming that rail is `+5V`, not raw `VBUS`. This card uses L1.01's
// names, and says why.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  {
    type: "youtube", videoId: "",
    title: "Schematic stage: the core you know, plus the three islands that make it a pixel driver",
    caption: "A tour of the eleven islands, and why the shifter's parked gates and the two-rail rule are the ones to get right.",
  },

  band("orient", "Meet the board", "Read this once. You will not open KiCad yet. This is the map for everything you are about to wire. As you go: **Do** means do it in KiCad, **Check yourself** is a gut check, **Eyeball it** means verify by eye."),

  prose(
    "Eleven small jobs stand between a bare module and a board that drives a pixel chain. Eight of them you have wired before. Three are new, and they are the reason this board exists.\n\nThe board needs:",
  ),
  {
    type: "steps", ordered: false,
    items: [
      "the right voltage",
      "a steady supply at the chip",
      "a defined way to boot",
      "a USB port that negotiates power and shrugs off a static zap",
      "that port's data pair",
      "a buffer that lifts 3.3 V data to 5 V",
      "one pixel on the board to prove it",
      "a way for an external strip to join, on its own power",
      "a light or two you can see",
      "every pin brought out to the board edge",
      "one clean ground under it all",
    ],
  },
  prose(
    "Each section below takes one of those jobs and names the exact parts that solve it. Read them in order: they follow the power in at the USB connector and work outward to the strip terminal.\n\nEvery part has a [[refdes]] (U3, C9, R7), the short label that ties its symbol, its BOM line and its spot on the board together. You will meet them in the tables under each section.",
  ),
  { type: "partModel", mpn: "SN74AHCT125DR", caption: "U3: the 74AHCT125 buffer, the part this whole board is built around" },
  table(
    ["Island", "What it does"],
    [
      ["1 · Regulator (U2)", "5 V in, a steady 3.3 V rail out"],
      ["2 · Decoupling and the module", "caps at U1's pins so the rail stays steady"],
      ["3 · Boot and reset", "pull-ups plus the EN and BOOT buttons"],
      ["4 · USB power and protection", "the CC sink, the fuse, ESD at the port, and C11"],
      ["5 · USB data", "the D+ and D- pair to the module, named as a pair"],
      ["6 · The level shifter", "GPIO5 in at 3.3 V, pixel data out at 5 V. NEW"],
      ["7 · The onboard first pixel", "LED3, its decoupling, and the two damping resistors. NEW"],
      ["8 · The strip interface", "J4, J5, and the rule that keeps two 5 V rails apart. NEW"],
      ["9 · Indicator LEDs", "a power light and a user light, each current-limited"],
      ["10 · Headers and test points", "every GPIO out to the breadboard, plus TP1 to TP3"],
      ["11 · Grounds and no-connects", "one ground net, and a flag on every open pin"],
    ],
  ),

  // ── setup ─────────────────────────────────────────────────────────────────
  { type: "callout", severity: "info", label: "Setup · Get KiCad + the starter open", body: "First, get KiCad and the starter project open." },
  {
    type: "callout", severity: "info", label: "Don't have KiCad yet?",
    body: "These lessons run in **KiCad 10**: every menu path, shortcut and dialog here matches version 10. If it is not installed, grab **KiCad 10 or newer** first. It is free, official, and runs on Windows, macOS and Linux. Already have it open? Skip to the starter download below.",
  },
  ref("Download KiCad: official, all platforms", "https://www.kicad.org/download/"),
  { type: "action", action: "downloadKicadStarter", label: "Download the KiCad starter" },
  {
    type: "callout", severity: "info", label: "Place by convention",
    body: "Arrange the parts the export gave you so the drawing reads the way the circuit works: power in at the top, signal flowing left to right.",
  },
  prose(
    "Drag each part so the sheet reads left to right: inputs on the left, outputs on the right. Put [[power port|power symbols]] (+3V3, +5V, [[VBUS]], 5V_EXT) at the top pointing up, and grounds at the bottom pointing down. Group parts by sub-circuit, the same way you just met them: the USB-C front end together, the regulator together, the module and its caps together, and the new shifter, pixel and terminal cluster together on the far side.\n\nPlace each [[decoupling capacitor]] near the pin it feeds for readability, but that is a drawing nicety rather than a wiring rule. A cap connected only through same-named ports is already fully wired. Where it physically sits is a layout concern, enforced later in copper.",
  ),
  does("arrange the sub-circuits", [
    {
      text: "**Ctrl+F** each part and drag its sub-circuit as one cluster into position. The export scattered them on a grid. Work in signal order.",
      proof: "Each sub-circuit moves as one cluster rather than as scattered single parts.",
    },
    {
      text: "**USB front end** (J1, F1, D1, R3, R4) to the far **left**, where power and data enter, with **D1 hard against J1**. **Regulator** (U2, C5, C6) just to its right, upper left, so 5 V flows in and 3V3 leaves rightward.",
      proof: "J1, F1 and D1 sit together at the far left with D1 hard against J1, and U2 with C5 and C6 to their right.",
    },
    {
      text: "**U1, the module**, in the **centre**. Its decoupling caps (C1, C2, C3) by its 3V3 pin, and boot and reset (R1, R2, SW1, SW2, C7) just left, by its EN and IO0 pins.",
      proof: "U1 sits in the centre with its decoupling caps by its 3V3 pin and the boot parts to its left.",
    },
    {
      text: "**The new cluster on the right:** U3 with C8, then LED3 with C9 and R7, then R8, D3, J4, and below them J5 with C10 and D2. Left to right this reads exactly as the signal travels.",
      proof: "U3, LED3 and the two terminals form one left-to-right run on the right of the sheet.",
    },
    {
      text: "**LEDs** (LED1, LED2, R5, R6) in a corner near U1. **Headers J2 and J3** on the right edges. **Test points** anywhere open. Rails point **up**, grounds point **down**.",
      proof: "LEDs sit near U1, J2 and J3 on the right edges, rails pointing up and grounds pointing down.",
    },
  ]),
  prose(
    "Two habits make this painless. Drag a part to *empty space*, wire its little sub-circuit there, then slide the finished island into position. That beats fighting auto-placement. And **Ctrl+F** jumps you straight to any refdes.\n\nOne finishing habit: keep each part's reference and value from overlapping the symbol, its pins or a wire, and when a label is in the way, move it into open space. Never declutter by *hiding* a refdes. The BOM, the layout and future you all key off it.",
  ),
  ref("KiCad Library Conventions (KLC)", "https://klc.kicad.org/"),

  // ── how to work ───────────────────────────────────────────────────────────
  band("do", "in KiCad · Build it, island by island", "Each sub-circuit is one island: meet it, wire it, then eyeball it against the reference. Hold the full [[ERC]] for the very end. Run it per island and it is just a wall of \"not connected\" noise."),
  {
    type: "callout", severity: "info", label: "Ports and labels first, then wires",
    body: "One ordering habit saves the most rework: on each island, drop every **power port** and **net label** onto its pin *first*, then draw the few real wires between legs. Run a wire first and a label dropped on top of it later forces you to nudge the wire aside. Place the labels first and the wires slot into clean space. Most connections here are by name anyway, so a drawn wire is the exception.",
  },
  { type: "callout", severity: "info", label: "Keys · the KiCad 10 keys you'll use", body: "A handful of keys do most of the work: hover over a part and press the key. Live list: Preferences, Hotkeys, or press ? in the editor." },
  {
    type: "table",
    columns: ["Key", "What it does"],
    rows: [
      [{ text: "A", tone: "gold", decoration: "badge" }, { text: "Add a symbol (place a part)" }],
      [{ text: "P", tone: "gold", decoration: "badge" }, { text: "Add a power port: +3V3, +5V, GND, VBUS, 5V_EXT" }],
      [{ text: "W", tone: "gold", decoration: "badge" }, { text: "Draw a wire" }],
      [{ text: "L", tone: "gold", decoration: "badge" }, { text: "Place a net label" }],
      [{ text: "R / M / G", tone: "gold", decoration: "badge" }, { text: "Rotate / move / drag (G keeps wires attached)" }],
      [{ text: "X / Y", tone: "gold", decoration: "badge" }, { text: "Mirror across the X / Y axis" }],
      [{ text: "E / V / U", tone: "gold", decoration: "badge" }, { text: "Edit properties / value / reference" }],
      [{ text: "Q", tone: "gold", decoration: "badge" }, { text: "No-connect flag: mark a pin you leave open" }],
    ],
  },
  prose(
    "One more shortcut for the header slog: **Insert** repeats the last wire or label one grid step down and **auto-increments the trailing number** (IO4 to IO5 to IO6). Set the step under **Preferences, Schematic Editor, Editing Options, Label increment**. The header order jumps around a lot, so Insert only earns its keep on the few unbroken runs. Everywhere else you place by hand from the reference, and that is expected. No Insert key on your laptop? Use the on-screen keyboard, remap one with PowerToys Keyboard Manager, or on a Mac press Fn and Enter.",
  ),
  {
    type: "callout", severity: "info", label: "Power symbol or net label?",
    body: "A power symbol (press **P**) is for a rail that many parts tap: VBUS, +5V, +3V3, 5V_EXT, GND. A net label (press **L**) is for a signal between a few pins: USB_D+, the shifted pixel data line. The test: a rail many things share, or a signal between a few pins? Rail means power symbol; signal means net label. One mechanical difference: a power symbol drops straight onto the pin, but a net label rides a **wire**. So for a signal like EN, IO0 or IO5, draw a short wire off the pin first, then press **L** and drop the label on that wire. Dropped in open space it floats unattached and ERC flags it. Note GND is a power symbol, the odd one out visually with its down-pointing triangle, but it behaves like the rest: a global net every matching symbol joins by name.",
  },
  prose(
    "One thing nobody tells you outright: you wire by pin **name**, not pin **number**. Your chips, the module and the connectors label their pins by name. The regulator's read `VIN`, `VOUT`, `GND`, `EN`. The buffer's read `1OE`, `1A`, `1Y`, `VCC`, `GND`. The module's read `3V3`, `EN`, `IO0`, `IO5`, `IO19`, `IO20`. So when a step says \"U3's 1OE to GND\", find the pin *named* `1OE`. The small resistors and caps are the exception: they show pins `1` and `2`, and that is fine.\n\nOne quirk to expect on these boards: **the regulator's symbol carries the library's older AP2112K name while the BOM says RT9080**. Same pinout, same job. Wire by pin name and the difference never bites you. This is the reason the pin-name habit matters rather than a footnote about it.",
  ),

  // ── 01 regulator ──────────────────────────────────────────────────────────
  sect("01", "The regulator", "Your ESP32-S3 wants a clean 3.3 V supply and USB gives you 5 V. Something has to step it down."),
  prose(
    "That something is **U2**, the RT9080. It is an [[LDO]], short for low [[dropout]], a voltage regulator that holds its output steady even when the input is only a little above it.\n\nWhy not a simple voltage divider? Because a divider sags the moment the chip pulls current, and the ESP32's draw jumps every time its radio transmits. A regulator actively holds 3.3 V no matter the load.\n\nThe RT9080 needs a capacitor on its input and another on its output to stay stable: **C5** and **C6**, 1 uF each. The datasheet promises stability with 1 uF ceramic in and out, which is exactly what we gave it.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [["U2", "RT9080-33GJ5", "5 V to 3.3 V LDO, 600 mA"], ["C5, C6", "1 uF X7R", "LDO input and output stability caps"]],
  ),
  does("wire the regulator with me", [
    {
      text: "Press **Ctrl+F**, type **U2**, Enter. That highlights U2's **name tag**, so Ctrl+F lands on the label rather than the part and **M** will not move it yet. **Click the body** of U2, press **M**, drag it to clear space, then pull its refdes and value above it. Now press **P** and drop a **+5V** power port on **VIN**.",
      proof: "U2 sits in clear space with its refdes and value above it, and a +5V port on VIN.",
    },
    {
      text: "EN cannot float or the LDO may never turn on, so wire **EN to VIN**: press **W** and click from one pin to the other. Now EN sits high with the input.",
      proof: "A wire runs from EN to VIN, so EN sits high with the input.",
    },
    {
      text: "**Flag the input rail.** +5V reaches VIN through the fuse, a passive part, so nothing on this rail is a power *output* ERC recognises as a source. Press **P**, pick **PWR_FLAG**, and drop it on the wire you just ran from EN to VIN. VBUS and GND get their own flags at the connector in island 04.",
      proof: "A PWR_FLAG sits on the +5V net, on the EN to VIN wire.",
    },
    {
      text: "Press **P** and drop a **+3V3** power port on **VOUT**: the 3.3 V rail leaving the regulator.",
      proof: "VOUT carries a +3V3 port.",
    },
    {
      text: "Stability caps: **C5** across the input (one leg +5V, one GND) and **C6** across the output (one leg +3V3, one GND). Same port name means same net, so nothing is drawn between them and U2.",
      proof: "C5 carries +5V and GND on its legs, C6 carries +3V3 and GND, and no wire is drawn to U2.",
    },
    {
      text: "Grounds: press **P** for **GND** on U2's GND pin and on the free leg of C5 and C6. Once one GND port is down, copy and paste it rather than re-picking each time.",
      proof: "U2's GND pin and the free leg of C5 and C6 each carry a GND port.",
    },
  ]),
  tube("Wire the regulator with me"),
  shot(
    "Check the regulator: VIN on +5V, VOUT on +3V3, a cap each side, EN tied high.",
    "KiCad 10 Schematic Editor, the regulator island only: U2 with +5V on VIN, EN tied to VIN, +3V3 on VOUT, C5 and C6 each side. Zoom so every refdes, pin and rail label is legible.",
    "See it wired · the regulator",
  ),
  check(
    "**In plain terms, why a regulator rather than two resistors to drop the voltage?** Because a regulator holds 3.3 V steady no matter how much the chip draws. A plain resistor divider sags the moment the chip gets busy.",
  ),
  dive(
    "Why a low-dropout part?",
    "The RT9080's dropout, the headroom it needs above 3.3 V to keep regulating, is small: about **0.31 V typical and 0.53 V worst case** at this load. So even when USB sags to around 4.6 V under load, the worst case still leaves 4.6 minus 0.53, which is 4.07 V, comfortably above 3.3 V. A cheaper regulator needing 1 to 2 V of headroom would drop out right here and the 3.3 V rail would collapse. That margin is the whole reason this board uses a [[dropout voltage|low-dropout]] part.\n\nThis board leans on that margin slightly harder than L1.01 did, because the onboard pixel is a second load on the same USB rail. It is still comfortable: the pixel takes its 60 mA from the 5 V side, ahead of the regulator, so it costs the rail a little sag rather than costing the regulator any headroom.",
  ),
  gotcha(
    "an LDO without its output cap can oscillate",
    "Do not treat C5 and C6 as optional. An LDO without its output capacitor can oscillate, which turns your clean rail into noise, and noise on the 3.3 V rail becomes jitter on the data line you are about to build.",
  ),

  // ── 02 decoupling ─────────────────────────────────────────────────────────
  sect("02", "Decoupling and the module", "A steady rail at the regulator is not a steady rail at the chip a few centimetres away."),
  prose(
    "When the ESP32 switches its transistors millions of times a second it grabs tiny gulps of current faster than a regulator across the board can respond. Left unfed, the 3.3 V right at the chip's pins dips on every gulp, and a [[microcontroller]] fed a dipping rail glitches or resets.\n\nThe fix is a small [[decoupling capacitor|capacitor]] parked right at each power pin: **C2 and C3**, 0.1 uF each. They hold a little reserve of charge and hand it over instantly, then refill between demands. **C1**, 10 uF, plays the same game one size up: a [[bulk capacitor|bigger, slower reservoir]] for the whole 3.3 V rail. Together they are called bulk plus bypass.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [["C2, C3", "0.1 uF X7R", "Bypass: clustered at the module's 3V3 pin"], ["C1", "10 uF X5R", "Bulk reservoir for the 3.3 V rail"]],
  ),
  does("wire the decoupling, then tie the module", [
    {
      text: "**Ctrl+F** to **U1**, click its body, press **M**, and drag it to the centre of the sheet. It is the hub every other island feeds. Then drag **C1, C2, C3** in beside it.",
      proof: "U1 sits in the centre of the sheet with C1, C2 and C3 beside it.",
    },
    {
      text: "Drop a **+3V3** and a **GND** port on each of **C1, C2, C3**. The +3V3 you made in the regulator island: same name, same net, nothing drawn between.",
      proof: "Each of C1, C2 and C3 carries a +3V3 port and a GND port.",
    },
    {
      text: "Now the module: **U1's 3V3** pin gets a +3V3 port, **U1's visible GND** pin gets a GND port. This is the headline connection. The regulator can be perfect and the chip still stays dark if 3V3 is not on the rail.",
      proof: "U1's 3V3 pin carries a +3V3 port and its visible GND pin carries a GND port.",
    },
    {
      text: "U1's pad also has hidden GND pins. You will confirm those land on GND in the grounds sweep at the end.",
      proof: "You have noted that U1 has hidden ground pins still to confirm.",
    },
  ]),
  tube("Wire the decoupling, then tie the module"),
  shot(
    "Check the decoupling: each of C1, C2 and C3 between +3V3 and GND.",
    "KiCad 10 Schematic Editor, the decoupling island only: U1's supply pins with C1, C2 and C3 each on a +3V3 and a GND port. Zoom so the three caps, refdes and port labels are legible.",
    "See it wired · decoupling and the module",
  ),
  check(
    "**In one line, what do C2 and C3 do?** They sit right at the chip's power pins and keep its 3.3 V steady when it suddenly pulls current.",
  ),
  dive(
    "Why small caps close, rather than one big one?",
    "A capacitor only helps if it is close. The longer the trace between it and the pin, the more its help fades, because the loop's own inductance resists the fast current change the cap exists to supply. Two 0.1 uF caps right at the module's 3V3 pin beat a single 0.2 uF cap sitting a few millimetres away: being close matters more than raw capacitance. The 10 uF [[bulk capacitor|bulk cap]] then handles the slower, larger swings the little ones cannot.",
  ),
  gotcha(
    "the module's own decoupling is a cushion, not a licence",
    "Still keep C1, C2 and C3 tight to the 3V3 pin. That habit pays on every board. But the WROOM gives you a cushion: it already carries decoupling right at the chip inside the module, so these board caps are the bulk reservoir and rail steadier rather than the chip's last line for fast current. On a bare chip, in a later lesson, that last millimetre is the whole game. Carry the habit forward into layout.",
  ),

  // ── 03 boot & reset ───────────────────────────────────────────────────────
  sect("03", "Boot and reset: pull-ups that set a default", "A digital input wired to nothing does not read 0. It floats, picks up noise, and reads randomly."),
  prose(
    "The ESP32 checks two [[strapping pin|strapping pins]] the instant it wakes: EN (chip enable and reset) and GPIO0 (boot select). Both have to be at a definite level at that moment, so each gets a [[pull-up resistor]], **R1** and **R2**, 10 kohm, gently tying it to 3.3 V. EN high means the chip runs. GPIO0 high at reset means boot normally from flash.\n\nThe two buttons override that resting level while you hold them. **SW1** pulls EN to ground to reset the chip. Holding **SW2** through a reset drops the chip into USB download mode so you can flash new firmware. The resistor sets the default; the button wins while it is pressed.\n\nOne more part rides on EN: **C7**, 1 uF, from the EN net to GND. With R1's 10 kohm it makes roughly a **10 ms RC delay**, so EN only crosses high well after the 3.3 V rail has settled and the chip leaves reset cleanly instead of racing the supply. It also debounces SW1, because a bare button's contacts bounce and one press can otherwise fire several resets. This is the CHIP_PU RC that Espressif's design guide calls for, at the more generous 1 uF value it suggests.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["R1, R2", "10 kohm", "Pull-ups on EN and GPIO0"],
      ["SW1, SW2", "B3F-1000", "EN (reset) and BOOT (download)"],
      ["C7", "1 uF", "EN reset RC: about 10 ms rise delay plus SW1 debounce"],
    ],
  ),
  does("wire boot and reset", [
    {
      text: "**R1** pull-up: one leg to a **+3V3** port. Its other leg is the **EN** net. Do not drag a wire to the module: press **L** and drop an **EN** net label on that leg, on **U1's EN pin**, and on **SW1's** top leg. **SW1's** other leg gets a **GND** port.",
      proof: "R1 has +3V3 on one leg, an EN label on the other, matching labels on U1's EN pin and SW1's top leg, and GND on SW1's other leg.",
    },
    {
      text: "**C7, the EN reset cap.** Press **L** for an **EN** label on one leg, and a **GND** port on the other. R1 and C7 together are the RC that gives EN a clean power-on reset and debounces SW1.",
      proof: "C7 carries an EN label on one leg and a GND port on the other.",
    },
    {
      text: "**R2** pull-up on **IO0** the same way: a **+3V3** port on one leg, an **IO0** net label on the other, on **U1's IO0 pin**, and on **SW2's** top leg. **SW2's** other leg to a **GND** port.",
      proof: "R2 has +3V3 on one leg, an IO0 label on the other, matching labels on U1's IO0 pin and SW2's top leg, and GND on SW2's other leg.",
    },
  ]),
  tube("Wire boot and reset"),
  shot(
    "Check boot and reset: R1, SW1 and C7 on the EN net, R2 and SW2 on IO0.",
    "KiCad 10 Schematic Editor, boot and reset island: R1 and SW1 on the EN net with C7 from EN to GND, R2 and SW2 on IO0, pull-ups to +3V3. Zoom so refdes and the EN and IO0 net labels are legible.",
    "See it wired · boot and reset",
  ),
  check(
    "**If R1 were missing and you pressed nothing, what would the EN pin read?** It would float, pick up electrical noise and read randomly, so the chip might reset or never start. The pull-up gives it a steady, known level.",
  ),
  dive(
    "Why 10 kohm, and why weak?",
    "A pull-up only has to set the resting level, not power anything, so it should be weak, meaning a high value. At 3.3 V a 10 kohm pull-up leaks just **0.33 mA**, which is negligible, and it still firmly holds the pin high. A 100 ohm pull-up would burn 33 mA doing the same job and would fight the button when you press it. Weaker is better here.",
  ),

  // ── 04 USB power ──────────────────────────────────────────────────────────
  sect("04", "USB power and protection", "The port that touches the outside world: tell the charger to send power, fuse the rail, clamp static at the door."),
  prose(
    "Your board announces itself as a consumer, a [[sink]], by tying each [[CC pin]] to ground through a 5.1 kohm resistor called [[Rd]]. The host sees that exact resistance and only then switches [[VBUS]] on.\n\nThere are two, **R3** and **R4**, because Type-C is reversible: whichever way the plug goes in, one of CC1 or CC2 is live, so both need their own Rd. These are [[pull-down resistor|pull-down resistors]], the mirror of the boot pull-ups. 5.1 kohm is the value the USB-C specification assigns to a basic sink.",
  ),
  table(["Ref", "Part", "Role"], [["R3, R4", "5.1 kohm", "CC1 and CC2 sink resistors (Rd) to GND"]]),
  prose(
    "The rail gets two guardians. **F1** is a [[PTC|resettable fuse]] on VBUS: if something downstream pulls too much current it heats, its resistance shoots up, and it throttles the current to a trickle, then heals by itself once it cools. It is a symmetric 2-pin part, so either leg to VBUS and the other to `+5V`. **That rename is deliberate**: the connector side is `VBUS`, raw 5 V straight off USB, and the regulator side is `+5V`, the same current now protected by the fuse. Same wire, two names, and the rename *is* the fuse.\n\n**D1** is an [[ESD]] protection array on the two data lines and VBUS. When a static spike arrives, thousands of volts off a fingertip, it clamps that spike to ground in a nanosecond with a [[TVS diode|clamping diode]], before it can punch through the ESP32's USB pins. It is deliberately a low-capacitance part, because USB data is fast and a bulky protector would smear the signal.\n\nOne part here is new to this board. **C11**, 4.7 uF, is a bulk capacitor on the `+5V` rail, and it exists because this board puts real loads on the 5 V side for the first time: the buffer and the onboard pixel. When the pixel snaps to full brightness it wants 60 mA in a hurry, and C11 supplies that locally instead of letting it show up as a dip at the regulator input.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["F1", "1206L050YR", "Resettable PTC: 0.5 A hold, 1 A trip, on VBUS"],
      ["D1", "USBLC6-2SC6", "ESD clamp on D+, D- and VBUS"],
      ["C11", "4.7 uF X5R", "Bulk on the +5V rail, sized by the USB inrush ceiling. NEW"],
    ],
  ),
  does("wire USB power and protection", [
    {
      text: "**The power path.** Find **J1's VBUS pin**; press **P** and drop a **VBUS** port on it. Place **F1**: press **W** to wire one leg to that VBUS node, then press **P** for a **+5V** port on F1's other leg. U2's VIN already taps +5V, so the shared name joins them with nothing drawn across.",
      proof: "J1's VBUS pin carries a VBUS port, and F1 has that VBUS node on one leg and a +5V port on the other.",
    },
    {
      text: "**Flag the VBUS rail.** VBUS comes straight off the connector with no power-output pin driving it, so it needs a **PWR_FLAG** just as +5V did. Press **P**, pick PWR_FLAG, drop it on the VBUS net.",
      proof: "A PWR_FLAG sits on the VBUS net.",
    },
    {
      text: "**Ground the connector.** Press **P**, drop a **GND** port on **J1's GND pin**, and give GND a **PWR_FLAG** too. That is the third and last flag on the board: +5V, VBUS and GND.",
      proof: "J1's GND pin carries a GND port with a PWR_FLAG on it, and exactly three flags exist.",
    },
    {
      text: "**The CC sink resistors.** **R3**: press **W**, wire one leg to **J1's CC1 pin**, then **P** for a **GND** port on the other leg. **R4**: the same from **CC2**. This is what tells a USB-C charger you are a sink and to switch VBUS on.",
      proof: "R3 runs from J1's CC1 to a GND port, and R4 from CC2 to a GND port.",
    },
    {
      text: "**ESD at the port.** Place **D1** by the connector and wire its **VBUS** pin to the **raw VBUS** rail: the clamp sits ahead of the fuse, right at the door. Press **P** for a **GND** port on D1's GND pin. Its data pins wait for island 05.",
      proof: "D1 sits by J1 with its VBUS pin on the raw VBUS rail and a GND port on its GND pin.",
    },
    {
      text: "**C11, the new one.** One leg to a **+5V** port, the other to a **GND** port. Note which rail that is: **+5V, after the fuse**, not raw VBUS. Everything this board hangs on 5 V sits behind the fuse's protection.",
      proof: "C11 carries a +5V port on one leg and a GND port on the other, on the fused side.",
    },
    {
      text: "**Not yet:** leave J1's data pins alone, they are island 05. The unused SBU pins get their no-connect flags in the end-of-stage sweep.",
      proof: "J1's data and SBU pins are still bare.",
    },
  ]),
  tube("Wire the USB port: power, protection and the new bulk cap"),
  shot(
    "Check the connector: CC resistors to GND, the fuse renaming VBUS to +5V, C11 on the fused rail.",
    "KiCad 10 Schematic Editor, USB front-end island: J1 with F1 on VBUS to +5V, R3 and R4 to GND, D1 on raw VBUS, C11 between +5V and GND. Zoom so refdes and net labels are legible.",
    "See it wired · USB power and protection",
  ),
  check(
    "**What two things does the USB port need protecting from?** Too much current, from a short or a greedy device, and static electricity zaps on the data lines. F1 handles the first and D1 the second.",
  ),
  dive(
    "Which side of the fuse the pixel lives on, and why it matters",
    "This board has a choice L1.01 never had to make. The buffer and the onboard pixel both run from 5 V, and there are two 5 V nets to pick from: raw `VBUS` at the connector, or `+5V` after the fuse.\n\nThey go on `+5V`. The reason is the power budget: the board's continuous draw is worked out as the ESP32 at roughly 160 mA plus the pixel at 60 mA plus the buffer's microamps, about **220 mA**, and that sum is compared against the fuse's **0.5 A hold current**. A load only counts against the fuse if it sits behind the fuse. Putting the pixel there is what makes the fuse protect it, and what makes a solder bridge under the pixel a tripped fuse rather than a hot USB port.\n\nThe one thing that deliberately sits *ahead* of the fuse is **D1**, the ESD clamp, because protection belongs at the door. Everything else is downstream.",
  ),
  gotcha(
    "a missing CC resistor works on one cable and dies on another",
    "Leave R3 and R4 off and the board still works on an old USB-A-to-C cable, because a USB-A port always has 5 V live with no [[Rd]] handshake required. So a missing sink resistor can look perfectly fine on the cable in your drawer and stone dead on a new USB-C charger. That is the worst kind of bug, intermittent by *cable* rather than by board.",
  ),

  // ── 05 USB data ───────────────────────────────────────────────────────────
  sect("05", "The USB data pair", "Two fixed pins, one [[differential pair]], and a naming trick that pays off at layout."),
  prose(
    "The module talks USB on two **fixed** pins: **D- is IO19, D+ is IO20**, always. No other pins work, and nothing on the schematic hints at it. So the connector's two data lines run to exactly those pins, passing through **D1** on the way to clamp static.",
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
      text: "**Name the two nets.** Press **L** and make **USB_D+** and **USB_D-**. Type a plain ASCII plus and minus, no fancy glyphs: the differential-pair router matches the literal suffix, and that exact pairing is what marks them a pair later.",
      proof: "Two labels exist, spelled USB_D+ and USB_D- with a plain ASCII plus and minus.",
    },
    {
      text: "**Label the D+ line.** Drop **USB_D+** on every pin it touches: **J1's DP1 and DP2**, **both of D1's D+ pins (1 and 6)**, and the module's **IO20**. Nothing is wired across. The shared name is the connection.",
      proof: "USB_D+ appears on J1's DP1 and DP2, on both of D1's D+ pins, and on U1's IO20.",
    },
    {
      text: "**Label the D- line.** The same with **USB_D-**: **J1's DN1 and DN2**, **both of D1's D- pins (3 and 4)**, and the module's **IO19**.",
      proof: "USB_D- appears on J1's DN1 and DN2, on both of D1's D- pins, and on U1's IO19.",
    },
  ]),
  prose(
    "KiCad reads a shared base name plus a paired suffix (`+` and `-`, or `_P` and `_N`, never mixed) as a [[differential pair]], and that schematic-side naming is what unlocks the differential-pair router and length matching when you reach layout. USB is a 90 ohm pair that wants matched, length-tuned traces, but that is a layout job. Here you just name it right.",
  ),
  shot(
    "Check the pair: USB_D+ on J1's DP pins, D1 and IO20; USB_D- on J1's DN pins, D1 and IO19.",
    "KiCad 10 Schematic Editor, the USB data pair: J1's DP and DN pins, D1's I/O pins, and the module's IO19 and IO20 all carrying the USB_D- and USB_D+ labels. Zoom so the labels read.",
    "See it wired · the USB data pair",
  ),
  check(
    "**Why label these nets USB_D+ and USB_D- rather than IO19 and IO20?** The matched plus and minus suffix is what marks them a differential pair, and that is exactly what unlocks the pair router and length matching at layout.",
  ),

  // ── 06 the shifter ────────────────────────────────────────────────────────
  sect("06", "The level shifter", "The island this whole board exists for. One gate does the work, and three do nothing, carefully."),
  prose(
    "**U3** is a 74AHCT125: four independent buffers in one 14-pin package, each with its own enable. A buffer copies its input to its output, which sounds pointless until you notice that the input and the output answer to different rules. The AHCT input calls anything above **2.0 V** a high, so a 3.3 V GPIO is a comfortable one. The output swings to whatever supply you give the chip, and you give it **5 V**. That is the whole translation: read at logic's terms, write at the pixel's.\n\nYou need one buffer. The other three are the interesting part of this island, because an unused CMOS input left floating drifts to a mid-level voltage where the input stage conducts, burning current and generating noise. So the parked gates get wired deliberately: their **enable pins go to VCC**, which disables them and leaves their outputs in a high-impedance state, and their **inputs go to ground** so nothing floats. Their outputs are left open, and that is the one float this board allows, because a disabled output is not driving anything.\n\nNote the enable's polarity. The pin is `1OE` with a bar over it on the symbol, meaning **active low**: pull it *low* to turn the gate *on*. That is backwards from most people's instinct and it is the single easiest mistake to make on this island.",
  ),
  table(
    ["Pin", "Name", "Goes to", "Why"],
    [
      ["14", "VCC", "+5V", "The output rail. This is what sets the shifted level"],
      ["7", "GND", "GND", "Common ground with the ESP32 and the pixel"],
      ["1", "1OE", "GND", "Active low enable. Low turns gate 1 ON"],
      ["2", "1A", "IO5", "The 3.3 V data in from the module"],
      ["3", "1Y", "PIX_DATA", "The 5 V data out, through R7 to the pixel"],
      ["4, 10, 13", "2OE, 3OE, 4OE", "+5V", "High disables gates 2, 3 and 4"],
      ["5, 9, 12", "2A, 3A, 4A", "GND", "Parked inputs, so nothing floats"],
      ["6, 8, 11", "2Y, 3Y, 4Y", "left open", "Disabled outputs. The one allowed float"],
    ],
  ),
  does("wire the level shifter", [
    {
      text: "**Power first.** Press **P** and drop a **+5V** port on **VCC (pin 14)** and a **GND** port on **GND (pin 7)**. Get this the right way round: a 14-pin logic chip conventionally has ground at the bottom left and supply at the top right, and this one follows that.",
      proof: "U3 pin 14 carries +5V and pin 7 carries GND.",
    },
    {
      text: "**Decouple it.** **C8**, 0.1 uF, gets a **+5V** port on one leg and a **GND** port on the other. Same net names as U3's supply pins, so nothing is drawn between. This cap is what lets the buffer switch a fast edge without dragging its own supply down.",
      proof: "C8 carries a +5V port on one leg and a GND port on the other.",
    },
    {
      text: "**Enable gate 1.** Press **P** and drop a **GND** port on **1OE (pin 1)**. Low means on. If you tie this to +5V instead, the gate goes high impedance and the pixel sees nothing at all, which looks exactly like a dead pixel.",
      proof: "U3's 1OE pin carries a GND port.",
    },
    {
      text: "**The data in.** Draw a short wire off **1A (pin 2)**, press **L**, and label it **IO5**. Drop the same **IO5** label on **U1's IO5 pin**. Same name, same net, nothing dragged across the sheet.",
      proof: "An IO5 label sits on a wire off U3's 1A pin and on U1's IO5 pin.",
    },
    {
      text: "**The data out.** Draw a short wire off **1Y (pin 3)** and label it **PIX_DATA**. That name follows the shifted signal to R7, to the test point, and into the pixel.",
      proof: "A PIX_DATA label sits on a wire off U3's 1Y pin.",
    },
    {
      text: "**Park gates 2, 3 and 4.** Press **P** and drop a **+5V** port on **2OE, 3OE and 4OE** (pins 4, 10 and 13), and a **GND** port on **2A, 3A and 4A** (pins 5, 9 and 12). Six ports, and they are not optional.",
      proof: "All three unused enable pins carry +5V and all three unused inputs carry GND.",
    },
    {
      text: "**Leave the unused outputs open**, then press **Q** on **2Y, 3Y and 4Y** (pins 6, 8 and 11) so ERC knows you meant it. A disabled output drives nothing, so an open pin here is correct rather than an oversight.",
      proof: "A no-connect flag sits on U3 pins 6, 8 and 11.",
    },
  ]),
  tube("Wire the level shifter, and park the three gates you are not using"),
  shot(
    "Check the shifter: VCC on +5V, 1OE grounded, IO5 in, PIX_DATA out, three gates parked.",
    "KiCad 10 Schematic Editor, the U3 island: pin 14 on +5V with C8, pin 7 on GND, 1OE to GND, IO5 on 1A, PIX_DATA on 1Y, parked gates with OE on +5V and A on GND. Zoom so every pin name reads.",
    "See it wired · the level shifter",
  ),
  check(
    "**You wire 1OE to +5V instead of GND. What happens when you power the board?** Nothing lights. The enable is active low, so a high enable puts gate 1 into a high-impedance state and the pixel's data input sees no signal at all. It looks identical to a dead pixel or a bad solder joint, which is why this pin is worth a second look now.",
  ),
  dive(
    "Why a floating CMOS input is a real problem, not a tidiness rule",
    "A CMOS input is the gates of two transistors, one that conducts when the input is low and one when it is high. Drive the input firmly to either rail and exactly one of them is on, and the pair draws essentially no current. Leave the input floating and it drifts to somewhere in the middle, where **both** transistors conduct at once and the input stage passes current straight from supply to ground.\n\nThat costs you three things. Standing current, which on a battery design matters and here just wastes a little. Heat in the package. And noise: a mid-level input sits right at the switching threshold, so any coupled interference toggles the gate repeatedly, and each toggle is a current spike on the same 5 V rail your working gate depends on. The chip's datasheet says it plainly: all unused inputs must be held at VCC or ground.\n\nThe outputs are the opposite case. A *disabled* output is high impedance, genuinely disconnected, so leaving it open is exactly right. Wiring it anywhere would be the mistake.",
  ),
  gotcha(
    "the enable bar is easy to miss",
    "On the symbol the pin reads `1OE` with a bar over the letters, and that bar is the entire specification: **active low**. Wire it to ground to enable the gate. The three parked gates go the other way, to +5V, which disables them. Two opposite polarities on one chip, six pins apart, is exactly the kind of thing to check twice against the reference image rather than trust to memory.",
  ),

  // ── 07 the first pixel ────────────────────────────────────────────────────
  sect("07", "The onboard first pixel", "One WS2812, its own decoupling, and two resistors that exist to keep edges civil."),
  prose(
    "**LED3** is a single 5050 pixel with four pins: **1 is VDD, 2 is DOUT, 3 is VSS, 4 is DIN**. Data goes in at pin 4 and the pixel's own regenerated copy comes out at pin 2, which is what makes a chain possible.\n\nIt runs from **+5V**, the fused rail, with **C9**, 0.1 uF, right at its supply pin. A pixel switching its three colour channels on and off is a small, fast current load, and the cap is what stops that showing up as a wobble on the rail feeding the buffer that drives it.\n\nBetween the buffer and the pixel sits **R7**, 470 ohm. Between the pixel's output and the strip connector sits **R8**, also 470 ohm. Neither is there to limit LED current, which the pixel handles internally. They damp the data edge and they bound a fault, and the deep dive explains both.\n\n**TP3** is a test point on the shifted line, between the buffer and the pixel. It exists so you can put a probe on the thing this lesson claims and see the 5 V swing for yourself rather than take our word for it.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["LED3", "XL-5050RGBC-WS2812B", "The first pixel. Pin 1 VDD, 2 DOUT, 3 VSS, 4 DIN"],
      ["C9", "0.1 uF X7R", "Decoupling at the pixel's supply pin"],
      ["R7", "470 ohm", "Series damping, buffer output to pixel DIN"],
      ["R8", "470 ohm", "Series damping and fault limit, pixel DOUT to the strip"],
      ["TP3", "Test point", "On the shifted data line, so you can measure it"],
    ],
  ),
  does("wire the first pixel", [
    {
      text: "**Power the pixel.** Press **P** and drop a **+5V** port on **LED3's VDD (pin 1)** and a **GND** port on **VSS (pin 3)**. The same fused rail the buffer runs from, which is the point: driver and receiver share a supply, so their levels track together.",
      proof: "LED3's pin 1 carries +5V and pin 3 carries GND.",
    },
    {
      text: "**Decouple it.** **C9** gets a **+5V** port on one leg and a **GND** port on the other, the same way C8 did for the buffer.",
      proof: "C9 carries a +5V port on one leg and a GND port on the other.",
    },
    {
      text: "**The first data hop.** **R7**: press **L** and put the **PIX_DATA** label on one leg, so it joins the buffer's 1Y output by name. Press **W** and wire R7's other leg to **LED3's DIN (pin 4)**.",
      proof: "R7 carries a PIX_DATA label on one leg and a wire from its other leg to LED3's DIN.",
    },
    {
      text: "**The test point.** Press **L** and drop a **PIX_DATA** label on **TP3**. It sits on the shifted line ahead of R7, so a probe there reads what the buffer actually put out.",
      proof: "TP3 carries a PIX_DATA label.",
    },
    {
      text: "**The second data hop.** Press **W** and wire **LED3's DOUT (pin 2)** to one leg of **R8**. Press **L** and label R8's other leg **STRIP_DATA**. That net leaves the board at J4 in the next island.",
      proof: "A wire runs from LED3's DOUT to R8, and R8's other leg carries a STRIP_DATA label.",
    },
    {
      text: "**Check the direction before you move on.** Data enters at pin 4 and leaves at pin 2. Swap them and the pixel is deaf: it will sit dark while its output tries to drive your buffer backwards. ERC cannot see this, because both pins are connected to something.",
      proof: "R7 lands on pin 4 (DIN) and R8 comes off pin 2 (DOUT), confirmed against the pin table.",
    },
  ]),
  tube("Wire the first pixel and its two damping resistors"),
  shot(
    "Check the pixel: +5V and GND on the right pins, PIX_DATA into DIN through R7, DOUT out through R8.",
    "KiCad 10 Schematic Editor, the LED3 island: pin 1 on +5V with C9, pin 3 on GND, R7 from PIX_DATA into pin 4, R8 off pin 2 to STRIP_DATA. Zoom so all four pin names read.",
    "See it wired · the first pixel",
  ),
  check(
    "**What do R7 and R8 actually limit?** Not the LED current. The pixel regulates its own colour channels internally. They damp the data edge so it does not ring, and R8 additionally bounds the current if the board ever drives an unpowered strip. Neither has anything to do with brightness.",
  ),
  dive(
    "What a series resistor on a data line is really doing",
    "A trace with a fast edge on it behaves less like a wire and more like a short transmission line. When the edge reaches the far end and finds an input that barely draws any current, the energy has nowhere to go and reflects back, arriving at the driver as an overshoot, bouncing again, and ringing for a few nanoseconds. If a ring dips back below the receiving threshold at the wrong moment, the receiver can read one edge as two.\n\nA resistor in series at the driver damps that. It is a deliberately imperfect match rather than a calculated one, and the usual guidance for these parts is somewhere in the **300 to 500 ohm** range, which is where the 470 ohm value comes from. That value is also the same part already on this board's BOM for the indicator LEDs, so it costs nothing extra to stock.\n\n**R8 has a second job.** If USB is live while the external strip's supply is off, the pixel's output is driving into an unpowered input, and 470 ohm holds that current down to roughly **9 mA**, small enough that nothing is damaged while you notice and fix the order. That is a backstop rather than a licence. The primary control is still the power-up order you wrote down at requirements.",
  ),
  gotcha(
    "DIN and DOUT are not interchangeable",
    "A WS2812 chain has a direction, and the pixel enforces it: pin 4 listens, pin 2 talks. Wire the buffer to pin 2 by mistake and you get a pixel that never lights and a buffer output fighting a pixel output. ERC will not say a word, because every pin involved is connected to something. The pin table above and the reference image are the only checks that catch it.",
  ),

  // ── 08 the strip interface ────────────────────────────────────────────────
  {
    type: "callout", severity: "warn", label: "08 · The strip interface, and the rule that keeps two rails apart",
    body: "Two screw terminals, a big capacitor, two protection diodes, and one invariant you can break silently.",
  },
  prose(
    "**J5** is where the strip's own power arrives: two positions, an external **regulated 5 V of 5.25 V or less** and ground. That 5 V gets its own net name, **5V_EXT**, and it travels across the board to **J4**, where the strip plugs in alongside the data line and ground.\n\n**The invariant: 5V_EXT and the board's own 5 V never share copper.** Not through a jumper, not through a diode, not \"just in case USB is missing\". Only ground is common. Break it and you have joined a supply that can deliver several amps to a rail protected by a half-amp fuse, with your microcontroller on the far end.\n\nGround, by contrast, **must** be common, and that is not a contradiction. The strip decides whether its data line is high or low by measuring it against its own ground. If the two supplies do not share a ground reference, that measurement is meaningless and the strip reads noise.\n\nThree parts protect this connector. **C10**, 1000 uF, sits at J5 as a reservoir, so a strip snapping to full brightness pulls its first slug of current from the capacitor rather than from a long, thin supply lead. **D2** is a TVS across 5V_EXT: it conducts hard if the voltage climbs past where it should be, which is what stands between a 12 V brick in the wrong socket and a dead board. **D3** is a small ESD diode on the exposed data pin at J4, because that pin is bare metal a human will touch.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["J5", "282837-2", "Strip power in: 5V_EXT and common ground"],
      ["J4", "282837-3", "Strip out: 5V_EXT, data, ground"],
      ["C10", "EEU-FM1C102", "1000 uF reservoir at the injection terminal. Polarised"],
      ["D2", "SMAJ5.0A", "TVS across 5V_EXT. Clamps a wrong supply. Polarised"],
      ["D3", "CDSOD323-T05C", "ESD diode on the exposed data pin at J4"],
    ],
  ),
  does("wire the strip interface", [
    {
      text: "**The injection terminal.** Press **P** and drop a **5V_EXT** port on **J5 pin 1** and a **GND** port on **J5 pin 2**. That GND port is the common ground the whole isolation story rests on: the two supplies meet here and nowhere else.",
      proof: "J5 pin 1 carries a 5V_EXT port and pin 2 carries a GND port.",
    },
    {
      text: "**The reservoir.** **C10**, 1000 uF and polarised: its **positive** leg gets a **5V_EXT** port and its **negative** leg, the one marked with a stripe on the real part, gets a **GND** port. Place it hard against J5 on the drawing so the intent carries into layout.",
      proof: "C10's positive leg carries 5V_EXT and its marked negative leg carries GND.",
    },
    {
      text: "**The over-voltage clamp.** **D2** is a unidirectional TVS, so it has a direction: its **cathode**, the banded end, goes to **5V_EXT** and its **anode** to **GND**. Backwards it conducts the moment you apply 5 V and looks like a dead short.",
      proof: "D2's banded cathode carries 5V_EXT and its anode carries GND.",
    },
    {
      text: "**The strip connector.** Press **P** and drop a **5V_EXT** port on **J4 pin 1** and a **GND** port on **J4 pin 3**. Then press **L** and drop the **STRIP_DATA** label on **J4 pin 2**, joining it to R8 by name.",
      proof: "J4 carries 5V_EXT, STRIP_DATA and GND on pins 1, 2 and 3.",
    },
    {
      text: "**Protect the exposed pin.** **D3** goes from the **STRIP_DATA** net to **GND**: press **L** for a STRIP_DATA label on one end and **P** for a GND port on the other. It is a bidirectional part, so orientation does not matter electrically, but keep it consistent with the reference anyway.",
      proof: "D3 sits between the STRIP_DATA net and a GND port.",
    },
    {
      text: "**Now prove the invariant.** With everything placed, press **Ctrl+F** and search **5V_EXT**. Every hit should be one of exactly five places: J5 pin 1, C10's positive leg, D2's cathode, J4 pin 1, and nothing else. If a **+5V** or **VBUS** port has crept onto any of them, you have joined the two rails.",
      proof: "A search for 5V_EXT returns only J5, C10, D2 and J4, with no +5V or VBUS port anywhere on that net.",
    },
  ]),
  tube("Wire the strip terminals and prove the two rails never meet"),
  shot(
    "Check the terminals: 5V_EXT on its own net, ground shared, C10 and D2 the right way round.",
    "KiCad 10 Schematic Editor, the J4 and J5 island: J5 on 5V_EXT and GND, C10 across them, D2 cathode to 5V_EXT, J4 on all three nets, D3 to GND. Polarity marks legible.",
    "See it wired · the strip interface",
  ),
  check(
    "**Someone suggests adding a diode from 5V_EXT to +5V so the board can run without USB. Why is that a bad idea on this board?** It joins the two rails. A supply that can deliver several amps would then be feeding a rail whose only protection is a half-amp fuse, with the module downstream. The isolation is the safety story, and a diode does not make an exception to it, it ends it.",
  ),
  dive(
    "Why the ground has to be shared even though the 5 V must not be",
    "This trips people because it sounds inconsistent. It is not, and the reason is worth internalising because it applies to every board that talks to something powered separately.\n\nA logic level is not an absolute quantity. When the strip's first pixel decides whether its data input is high, it compares that pin's voltage against **its own ground**. Your board's buffer, meanwhile, produces its high relative to **your** ground. If those two grounds are the same node, the comparison is meaningful. If they are not, the two references can sit at any offset at all, and the strip reads whatever that offset happens to make of your signal.\n\nA shared ground carries the return current for the data signal, and that is all it has to do. It does not need to carry the strip's supply current, which returns to its own supply through the strip's own ground wire. That is why one thin ground connection is enough for the signal to work, and why it is still worth making the shared ground a solid, short connection rather than an afterthought.\n\nThe 5 V rails are the opposite case. Nothing about the data path needs them joined, and joining them puts an unlimited supply behind a limited fuse. Share the reference, isolate the power.",
  ),
  gotcha(
    "two polarised parts, and one of them vents",
    "**C10** and **D2** both care which way round they go, and both fail loudly. A 1000 uF electrolytic fitted backwards on a 5 V rail heats, swells and eventually vents, which is unpleasant and smells worse. A TVS fitted backwards conducts the instant you apply 5 V, so the board looks like a dead short and your supply's current limit is the only thing saving it. ERC checks connectivity, not polarity, so both of these are eyeball checks against the reference image.",
  ),

  // ── 09 LEDs ───────────────────────────────────────────────────────────────
  sect("09", "Indicator LEDs", "An LED is a diode, and a diode is a poor judge of its own appetite."),
  prose(
    "Give an LED more voltage than it wants and it pulls more and more current until it cooks itself, so you never connect one straight across a supply. A [[current-limiting resistor|resistor in series]] sets the current.\n\nHere that resistor is **470 ohm**, the same part as R7 and R8, which sets a gentle few milliamps: bright enough to see, easy on the [[GPIO]] driving it. **LED1**, red, is the power light, wired **+3V3 to R5 to LED1 to GND**, so it glows whenever the board has power. **LED2**, yellow, is the user light, driven by a pin: **IO2 to R6 to LED2 to GND**.\n\nThese two are ordinary LEDs, unlike LED3. They have no controller, no data pin and no opinion. Having both kinds on one board is a useful contrast: LED1 and LED2 need an external resistor to survive, and LED3 needs none, because everything the resistor would have done is built into the chip inside it.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["LED1", "Red, Vf about 1.8 V", "Power indicator"],
      ["LED2", "Yellow, Vf about 2.0 V", "User / blink LED on IO2"],
      ["R5, R6", "470 ohm", "LED series current limit"],
    ],
  ),
  does("wire the LEDs", [
    {
      text: "**LED1, the power light.** Ports first: press **P**, drop a **+3V3** port on **R5's top leg** and a **GND** port on **LED1's cathode**, the bar or flat side. Then one wire with **W** from R5's bottom leg to LED1's anode.",
      proof: "R5's top leg carries +3V3, LED1's cathode carries GND, and one wire joins R5's bottom leg to LED1's anode.",
    },
    {
      text: "**LED2, the user light.** Same shape, but a GPIO drives the top: press **L** and put an **IO2** net label on **R6's top leg**, then **P** for a **GND** port on **LED2's cathode**, then one wire from R6's bottom leg to LED2's anode.",
      proof: "R6's top leg carries an IO2 label, LED2's cathode carries GND, and one wire joins R6's bottom leg to LED2's anode.",
    },
    {
      text: "**Polarity, the silent bug.** The bar or flat side of the symbol, the cathode, must face **GND**. Backwards it just stays dark and ERC will not flag it, so eyeball each LED against the reference before moving on.",
      proof: "Every LED's bar side faces the ground end of its string.",
    },
  ]),
  shot(
    "Check the LEDs: +3V3 through R5 to LED1 to GND, IO2 through R6 to LED2 to GND.",
    "KiCad 10 Schematic Editor, the LED island: +3V3 to R5 to LED1 to GND, and IO2 to R6 to LED2 to GND. Zoom so both LEDs, their series resistors, refdes and net labels are legible.",
    "See it wired · the indicator LEDs",
  ),
  check(
    "**You wire the user LED to GPIO0 by mistake. What might go wrong?** GPIO0 is a strapping pin. An LED circuit can hold it low at power-up, which drops the chip into download mode instead of running your code. That is exactly why the free-pin rule skips the strapping four.",
  ),
  dive(
    "Sizing the resistor, and why the pixel needs none",
    "The resistor sets the current from the leftover voltage: I equals (Vsupply minus Vf) divided by R. The red LED drops about 1.8 V across itself, its [[forward voltage|forward voltage]], so on 3.3 V through 470 ohm you get (3.3 minus 1.8) over 470, about **3.2 mA**: bright enough to see and easy on the GPIO. The yellow LED's forward voltage is higher at about 2.0 V, so the same 470 ohm gives (3.3 minus 2.0) over 470, about **2.8 mA**. That is why swapping LED colours at a fixed resistor quietly changes the brightness.\n\nLED3 skips all of this because it is not just an LED. Inside that 5050 package sits a small controller that runs each colour die from a constant-current source, so the current is set by the chip rather than by anything you fit outside it. That is also why its brightness is a number you send it rather than a resistor you choose, and why 60 mA at full white is a fixed property of the part rather than something your circuit decides.",
  ),
  gotcha(
    "an LED without its series resistor flashes once and dies",
    "R5 and R6 are not optional. An ordinary LED wired straight across a rail is a short circuit with extra steps.",
  ),

  // ── 10 headers ────────────────────────────────────────────────────────────
  sect("10", "Headers and test points", "Every module pin out to the board edge, plus three places to clip a probe."),
  prose(
    "The two long headers, **J2 and J3**, break the module out to the board edge so you can reach any pin with a jumper. There is a way to do this with no skip list to track: **every module pin gets exactly one header position, in the module's own physical pin order**, so you copy names straight down and never decide which pins to bring out. The GPIO numbers jump around as you go, because that is how they sit on the package, so follow the starter's own order and the answer-key image rather than a running count.\n\nA handful of **rail positions** are convenience rails you add rather than module pins: each gets a [[power port|power symbol]] (`GND`, `+3V3`, and a `+5V` tap to power a breadboard) and joins the rail by name. Every other position gets a [[net label]] matching the module pin's name.\n\n**Five positions on this board are already on a named net** and take a moment's thought: **EN** and **IO0** carry their buttons, **IO2** carries the user LED, **IO19 and IO20** are the USB pair (label them `USB_D-` and `USB_D+`, not `IO19` and `IO20`, or you trip a conflicting-label warning), and **IO5** now carries the pixel data into the shifter. For each of those, put the label on the existing node *and* on the header pin.",
  ),
  prose(
    "One rule for every free pin you label here: steer clear of the **strapping pins, GPIO0, 3, 45 and 46**, for anything you actively drive at power-up. The chip reads those four the instant it wakes to decide how to boot, so a part tugging on one can stop it starting. The two USB pins are already spoken for, and so is IO5 now. Bringing a strapping pin out to a **bare header** is fine, because nothing is driving it there. The caution is only about wiring a driver or a load onto one on the board.",
  ),
  does("the header column, carefully", [
    {
      text: "This island breaks the island-by-island rhythm. You are not wiring a sub-circuit, you are transcribing pins against a reference, and the only real trap is miscopying. Slow down. Do the first three by hand to find the groove, then work steadily down.",
      proof: "You are working from the reference order rather than from memory.",
    },
    {
      text: "**Rail positions first.** Press **P** and drop **GND**, **+3V3** and **+5V** power ports on the positions the starter marks as rails.",
      proof: "Every rail position on J2 and J3 carries a power port rather than a net label.",
    },
    {
      text: "**The five reused pins next**, while you are still fresh: **EN**, **IO0**, **IO2**, **IO5**, and the pair as **USB_D-** and **USB_D+**. Reuse the exact names already on the module side. Do not invent new ones.",
      proof: "All five reused positions carry the exact net names already used elsewhere on the sheet.",
    },
    {
      text: "**Then the plain GPIO.** Press **L**, type the name printed on that module pin, drop it on the header position. On the long unbroken runs press **Insert** to repeat the last label one row down with the number auto-bumped. Hand-place wherever the numbering jumps.",
      proof: "Every remaining header position carries a label matching its module pin, with no number skipped or repeated.",
    },
    {
      text: "**Label both ends of every net**, the module pin and its header pin, the same name. Miss an end and ERC flags the orphaned pin, which is the safety net working.",
      proof: "Every net you created has a label at the module and at the header.",
    },
    {
      text: "**TP1 to the +3V3 rail.** Press **P**, pick **+3V3**, drop it on TP1. Nothing else attaches: it is a labelled loop to clip a probe onto.",
      proof: "TP1 carries a +3V3 port and nothing else.",
    },
    {
      text: "**TP2 to GND**, the same way. Now you have a rail and a ground reference to meter against the moment you first power the board.",
      proof: "TP2 carries a GND port and nothing else.",
    },
    {
      text: "**TP3 is already done**, back in island 07: it sits on **PIX_DATA**, the shifted line. That is the one this lesson is really about, so confirm its label rather than assuming it.",
      proof: "TP3 carries the PIX_DATA label, confirmed by eye.",
    },
  ]),
  tube("Wire the breakout headers with me"),
  shot(
    "Check the headers: every module pin mirrored to J2 and J3, rails on the power positions.",
    "KiCad 10 Schematic Editor, the breakout-headers island: J2 and J3 with every module pin mirrored, power ports on the rail positions, the five reused nets named. Zoom so pin labels read.",
    "See it wired · breakout headers",
  ),
  gotcha(
    "label both ends, the one slip ERC cannot catch",
    "ERC catches a *missing* label, which shows up as a loose pin. It cannot catch a *wrong* one. Mislabel an end, say `IO5` on the module and `IO6` at the header, and **both nets read as used, so ERC stays silent**. On this board that particular slip is expensive, because IO5 is the pixel data line: the board would come up looking perfect and the pixel would never light. Check the header order against the answer-key image rather than a green tick.",
  ),

  // ── 11 grounds ────────────────────────────────────────────────────────────
  sect("11", "Grounds and no-connects", "Two finishing sweeps before the check: make every ground one net, and flag every pin you meant to leave open."),
  prose(
    "**Grounds:** every GND pin has to land on the *same* net. The [[power port|power-port]] trick makes that painless, but the WROOM module's big pad *hides* its ground pins, and KiCad auto-joins a hidden power pin to the net of its name, so they tie to GND on their own **only because your ground net is named GND**. That invisible link is exactly the kind ERC can miss, so confirm it by eye rather than trusting it.\n\nThis board has more ground pins than either of the ones before it, and one of them carries a claim: **J5 pin 2 is where the external supply's ground meets yours**. Everything else grounds locally; that one is the bridge between two power domains. It is worth checking on its own.\n\n**No-connects:** a genuinely open pin reads to ERC as a mistake, identical to one you forgot. A [[no-connect]] flag is you telling ERC you meant it, and that is the difference between a clean report and a screen of warnings you learn to scroll past.",
  ),
  does("grounds, then the no-connect sweep", [
    {
      text: "**Grounds first.** Press **P** and drop a **GND** port on every ground pin: U2's GND, the free legs of C5, C6, C1, C2, C3, C8, C9 and C11, each button's low leg, each indicator LED's cathode, **LED3's VSS**, **U3's pin 7**, the parked inputs 2A, 3A and 4A, D1's GND, D2's anode, D3's ground end, **C10's negative leg**, **J4 pin 3**, **J5 pin 2**, the module's visible GND pin, and TP2.",
      proof: "Every ground pin in that list carries a GND port and no ground is left bare.",
    },
    {
      text: "**Confirm the hidden grounds.** Turn on **View, Show Hidden Pins**, check U1's hidden ground pins sit on **GND**, and make sure the module's visible ground pin carries a GND port so the tie is on the sheet rather than merely implied.",
      proof: "With hidden pins shown, U1's hidden grounds sit on GND and its visible ground pin carries a GND port.",
    },
    {
      text: "**Confirm the bridge.** Search **GND** and satisfy yourself that **J5 pin 2** is on it. That single port is what makes the strip's data line readable. It is one port, it is easy to miss, and missing it produces a board that works perfectly on USB and fails the moment a strip is attached.",
      proof: "J5 pin 2 is confirmed on the GND net.",
    },
    {
      text: "**Then the no-connects.** Press **Q** on every pin you mean to leave open: J1's SBU pins and any unused contact, the regulator's NC pin, and **U3's three disabled outputs, pins 6, 8 and 11**.",
      proof: "A no-connect marker sits on J1's SBU pins, the regulator's NC pin and U3 pins 6, 8 and 11.",
    },
    {
      text: "**Not sure which are open?** Run **ERC** once as a scratch pass: every genuinely open pin lists as not connected. That list is your to-do. Press **Q** on each one you meant to leave open and the noise clears.",
      proof: "A scratch ERC run lists no not-connected pin you did not mean to leave open.",
    },
  ]),
  tube("Wire grounds and no-connects, then run ERC clean"),
  check(
    "**You leave a dozen unused module pins unwired and skip the no-connect flags. What does ERC give you?** A dozen \"pin not connected\" errors: real noise that buries a real mistake. Flag the ones you mean to leave open so the list shows only what matters.",
  ),
  dive(
    "ERC is the net, not a hoop",
    "You cannot instruct your way out of every slip. A careful builder with the rule right in front of them still half-finishes a both-ends task across forty pins, because that is how humans handle long two-sided work. So the durable move is to design the safety net and learn to read it.\n\nThat is why this lesson pairs each error-prone step with its ERC tell. Label both ends, and if you miss one, ERC flags the loose pin. That flag *is* your check. Work the list to zero and the net has done its job.\n\nBut know its blind spots, and on this board there are four worth naming: a mislabelled net that exists at both ends, a reversed polarised part, a swapped DIN and DOUT on the pixel, and the two 5 V rails accidentally joined. Every one of those leaves a schematic where every pin is connected to something, which is all ERC ever checks. Those four are what the eyeball list below is for.",
  ),

  // ── check ─────────────────────────────────────────────────────────────────
  band("check", "Prove it", "Trace the things ERC cannot see against the answer key, then run the checker."),
  {
    type: "image", src: "", aspect: "16:10", zoom: true,
    alt: "Completed L1.03 schematic: the USB-C front end, the regulator, the ESP32-S3 module and its decoupling, the 74AHCT125 shifter, the onboard pixel, the two screw terminals, headers and test points.",
    caption: "The answer key. Check your wiring against this, especially the shifter's enable pins and the pixel's data direction.",
    captureHint: "KiCad 10 Schematic Editor: the whole finished L1.03 schematic in one shot, every island and net label visible. Fit the full sheet and keep refdes and labels legible.",
  },
  trace("what ERC cannot catch", [
    { text: "**U3's 1OE is on GND** and 2OE, 3OE and 4OE are on +5V.", help: "Both are valid connections, so ERC sees nothing. Get this backwards and the working gate goes high impedance while three unused gates enable into open circuits." },
    { text: "**LED3's DIN is pin 4 and DOUT is pin 2**, with R7 into pin 4 and R8 off pin 2.", help: "Swapped, the pixel is deaf and its output fights the buffer. Every pin is still connected, so ERC stays quiet." },
    { text: "**5V_EXT touches only J5, C10, D2 and J4.** No +5V or VBUS port anywhere on it.", help: "This is the isolation invariant. One stray power port joins a multi-amp supply to a half-amp fused rail with your module downstream." },
    { text: "**J5 pin 2 carries a GND port**, so the two supplies share a reference.", help: "Miss it and the board works perfectly on USB and fails the moment a strip is attached, because the strip has no reference to read the data against." },
    { text: "**C10's stripe faces GND and D2's band faces 5V_EXT.**", help: "ERC checks connectivity, not polarity. A reversed electrolytic vents; a reversed TVS looks like a dead short the instant you apply power." },
    { text: "**U2's VIN sits on +5V, after the fuse**, not on raw VBUS.", help: "Both are valid rails, so ERC cannot tell them apart. VIN on raw VBUS means the regulator loses the fuse's overcurrent protection." },
    { text: "Each indicator LED's **bar side faces GND**.", help: "Backwards it just stays dark, and ERC says nothing about it." },
    { text: "**USB_D+ and USB_D- are not swapped through D1.**", help: "Follow each label from J1 through D1 to the module and check the suffix never flips." },
  ]),

  // ── ERC ───────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Run ERC & export", "Now let KiCad check it, fix to zero, and export the report the gate wants."),
  prose(
    "[[ERC]] reads your whole schematic and flags what is electrically wrong: a pin connected to nothing, two outputs fighting each other, a power rail nothing drives. Run it from **Inspect, Electrical Rules Checker**, then work the list down to zero. The bar is the same one you meet again at DRC: clean, or every remaining flag is an exception you have marked and understood rather than one you scrolled past.",
  ),
  {
    type: "table",
    columns: ["ERC says…", "…you do"],
    rows: [
      [{ text: "Input power pin not driven", tone: "critical", decoration: "badge" }, { text: "Drop a PWR_FLAG on each rail no chip output drives: VBUS from the connector, +5V after the passive fuse, and GND. You do not need one on +3V3, because the regulator's output already counts as a driver. Fix it this way rather than ignoring it." }],
      [{ text: "Pin not connected", tone: "critical", decoration: "badge" }, { text: "Meant to leave it open? Drop a no-connect flag (Q) on it. On this board that is U3's three disabled outputs, J1's SBU pins and the regulator's NC pin." }],
      [{ text: "Unconnected wire / net", tone: "critical", decoration: "badge" }, { text: "A real mistake: join it, or delete the stray end. Do not scroll past this one." }],
      [{ text: "Conflicting net names", tone: "critical", decoration: "badge" }, { text: "Usually a header position labelled IO19 or IO20 where the module side says USB_D- or USB_D+. Use the existing name." }],
    ],
  },
  dive(
    "Why a powered rail still trips ERC, and what PWR_FLAG really is",
    "ERC checks by pin type: it wants every power-input pin, like the ESP32's 3V3, fed by a power-output pin somewhere. Your +3V3 is fine, because the [[LDO|regulator]]'s output pin counts as a driver. But VBUS arrives from a connector that has no output pin at all, and +5V sits on the far side of a passive fuse. Neither has a chip output behind it, so ERC warns that an input power pin is not driven.\n\nA [[PWR_FLAG]] is a tiny symbol whose single pin *is* a power output. Drop it on VBUS, +5V and GND and you have told ERC, truthfully, that real power enters there. That is the honest way to clear the warning rather than a mute button.\n\nOne question this board raises: does **5V_EXT** need a flag too? It is a rail with no driver on the sheet, so ERC may well ask. The honest answer is yes, for the same reason as VBUS: real power genuinely enters there, from an external supply through J5. Flag it and you have described the board accurately.\n\nOne trap: if you spot **GNDPWR** in the symbol picker, that is not this. It is a separate stacked-ground symbol that makes its own net. Use a plain PWR_FLAG on a normal GND, never GNDPWR.",
  ),
  does("export and upload", [
    {
      text: "Run ERC until it is clean, or every remaining flag is marked and understood.",
      proof: "ERC reports no errors, or every remaining flag is marked and understood.",
    },
    {
      text: "Plot the schematic to PDF (**File, Plot**) for a readable copy, and keep the `.kicad_sch` source.",
      proof: "A schematic PDF sits alongside the .kicad_sch source.",
    },
    {
      text: "Attach your clean ERC report as this stage's artifact. That is what the gate below checks.",
      proof: "The stage shows your ERC report attached.",
    },
  ]),
  ref("KiCad 10: Schematic Editor manual", "https://docs.kicad.org/10.0/en/eeschema/eeschema.html"),

  {
    type: "quiz",
    prompt: "Quick check: schematic",
    gate: true,
    questions: [
      {
        id: "shifter-rail", reviewId: "l103-shifter-rail",
        q: "What sets the voltage the level shifter's output swings to?",
        options: [
          "The voltage on its input pin",
          "The supply you connect to its VCC pin, which here is 5 V",
          "A resistor on its output",
        ],
        answer: 1,
        explain: "A buffer reads at its input threshold and writes at its supply rail. Feeding VCC from the same 5 V the pixel runs on is what makes the margin hold as that rail moves.",
      },
      {
        id: "oe-active-low", reviewId: "l103-oe-active-low",
        q: "The buffer's enable pin is drawn as 1OE with a bar over it. To turn gate 1 on, you wire it to...",
        options: [
          "GND, because the bar means active low",
          "+5V, because enable means high",
          "The same net as the data input",
        ],
        answer: 0,
        explain: "The bar is the specification. Low enables. Tie it high instead and the gate goes high impedance, which looks exactly like a dead pixel.",
      },
      {
        id: "parked-gates",
        q: "Why are the three unused buffer gates wired up rather than left alone?",
        options: [
          "So they can be used later without rework",
          "To spread the current across the package",
          "A floating CMOS input drifts to mid level, where both transistors conduct, wasting current and making noise",
        ],
        answer: 2,
        explain: "The datasheet requires unused inputs to sit at VCC or ground. Their disabled outputs, by contrast, are correctly left open.",
      },
      {
        id: "pixel-direction",
        q: "On the pixel, pin 4 is DIN and pin 2 is DOUT. What happens if you swap them?",
        options: [
          "Nothing. The pixel works out which is which",
          "The pixel stays dark, its output fights the buffer, and ERC says nothing because every pin is connected",
          "ERC flags a conflicting output error",
        ],
        answer: 1,
        explain: "A chain has a direction and the part enforces it. Connectivity is all ERC checks, so this one is caught only by the pin table and the answer key.",
      },
      {
        id: "rails-isolated", reviewId: "l103-rails-isolated",
        q: "Which of these would break the board's isolation rule?",
        options: [
          "A GND port on J5 pin 2",
          "A 5V_EXT port on J4 pin 1",
          "A diode from 5V_EXT to +5V so the board can run without USB",
        ],
        answer: 2,
        explain: "Ground is meant to be common. The 5 V rails are not. A diode between them puts a multi-amp supply behind a half-amp fuse with the module downstream.",
      },
      {
        id: "shared-ground-why",
        q: "Why must the external supply's ground be tied to the board's ground?",
        options: [
          "To carry the strip's supply current back to the board",
          "Because the strip reads its data input as a voltage measured against its own ground, so without a shared reference the signal is meaningless",
          "To complete the 5 V circuit",
        ],
        answer: 1,
        explain: "The shared ground carries the data signal's return, not the strip's supply current. It is the reference that makes a logic level mean anything.",
      },
      {
        id: "series-resistor-role",
        q: "What are R7 and R8 doing on the data line?",
        options: [
          "Limiting the pixel's LED current",
          "Setting the pixel's brightness",
          "Damping the edge so it does not ring, and in R8's case bounding the current if the strip is unpowered",
        ],
        answer: 2,
        explain: "The pixel runs its colour channels from an internal constant-current source, so nothing outside it sets the LED current. The 300 to 500 ohm guidance is about signal integrity.",
      },
      {
        id: "pwr-flag",
        q: "Your schematic is right, but ERC says \"input power pin not driven\" on the VBUS rail. Best move?",
        options: [
          "Add a PWR_FLAG so ERC knows real power enters there",
          "Delete the power pin to silence it",
          "Ignore it, since the connector obviously powers the rail",
        ],
        answer: 0,
        explain: "VBUS comes straight from a connector, which has no power-output pin for ERC to see. The flag states the truth rather than hiding a problem.",
      },
      {
        id: "label-both-ends",
        q: "You label the module's pin IO5 but the matching header pin IO6 by mistake. Does ERC catch it?",
        options: [
          "No. Both pins now look used, so ERC stays quiet, and only checking against the reference image catches it",
          "Yes, ERC flags the mismatched net names",
          "Yes, KiCad auto-renames one so they match",
        ],
        answer: 0,
        explain: "On this board that slip is expensive: IO5 is the pixel data line, so the schematic would look perfect and the pixel would never light.",
      },
    ],
  },

  exit(
    "You have read every part on this board and why it is there, captured it as a schematic, and run ERC until it is clean. Attach the ERC report, which the gate below tracks. Carry three things forward into layout. **U1 has a PCB antenna**, so the keep-out underneath it is a hard constraint even though this lesson never keys the radio. **5V_EXT and +5V must stay apart in copper** as well as on the sheet, and layout is where that is easiest to break by accident. And **C10 stands about 20 mm tall**, so it needs room reserved rather than discovered.",
  ),

  ref("SNx4AHCT125 datasheet (Texas Instruments, SCLS264R): pin functions, input thresholds, and the unused-input requirement", "https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf"),
  ref("WS2812B datasheet (Worldsemi): pin order, the input threshold, and the cascade method", "https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf"),
  ref("ESP32-S3 Hardware Design Guidelines (Espressif): schematic checklist, power and decoupling", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html"),
  ref("USB Type-C Cable and Connector Specification (USB-IF): the 5.1 kohm CC pulldown that marks a power sink", "https://www.usb.org/usb-type-cr-cable-and-connector-specification"),
  ref("Adafruit NeoPixel Uberguide: the 300 to 500 ohm series resistor and level-shifting practice", "https://learn.adafruit.com/adafruit-neopixel-uberguide"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "SCHEMATIC", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
