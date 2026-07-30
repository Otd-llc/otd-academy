// L1.05 internal ADC — SCHEMATIC card.
//
// Authored ahead of the board from docs/boards/l1-05-internal-adc/{design.md,
// bom.csv,validation-log.md} (DRY, 12 passes), with L1.01's SCHEMATIC card as
// gospel for the whole reused core: the RT9080 island and its EN-to-VIN tie,
// the VBUS / +5V rename across F1, the 5.1 kOhm CC sink, ESD at the port, the
// USB_D+ / USB_D- differential-pair naming onto IO20 / IO19, the 10 kOhm
// straps with the 1 uF EN cap, the 470 Ohm LED resistors, the 1x22 headers,
// the three PWR_FLAGs and the no-connect sweep.
//
// The new island is the analog front end: RV1 across the rail, D2 and R8 on
// the exposed node, R7 into C8 at the pin, and ADC_IN landing on GPIO1
// (ADC1 channel 0), never ADC2 and never the GPIO3 strapping pin.
//
// The card this replaces was 12 blocks against the 120-block bar and told the
// learner the core was "one line now". The owner rejected that compression on
// 2026-07-22: the fifth board gets the same walk as the first.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Schematic: the familiar core, plus one analog island"),

  band("orient", "Meet the board", "Read this once with KiCad closed. Eight of the nine islands you have drawn before. The ninth is the reason this board exists."),
  prose(
    "This schematic is the L1.01 breakout with one island added. That is a real statement about the design and not a shortcut for you: the power chain, the USB front end, the module, the straps, the LEDs and the headers are the same shapes with the same values, and you will confirm every one of them rather than assume it.\n\nThe ninth island is four nets wide. A trimpot makes a voltage you can sweep. Two parts guard the one node a finger can reach. Two more condition that voltage into the converter. And the wire lands on a pin chosen for a reason that has nothing to do with convenience.\n\nThe order of elements along that path is the design. Swap two of them and everything still connects, ERC still passes, and the circuit is wrong.",
  ),
  table(
    ["Island", "What it does"],
    [
      ["1 · Regulator (U2)", "5 V in, a steady 3.3 V rail out"],
      ["2 · USB power and protection", "the CC sink, the fuse, ESD at the port"],
      ["3 · Module and decoupling", "caps on the rail so it holds steady"],
      ["4 · Boot and reset", "pull-ups plus the EN and BOOT buttons"],
      ["5 · USB data", "the D+/D- pair to the module, named as a pair"],
      ["6 · Indicator LEDs", "a power light and a user light, each current-limited"],
      ["7 · Headers and test points", "every GPIO out to the breadboard"],
      ["8 · Analog front end", "RV1, its guards, the RC, and the ADC1 pin"],
      ["9 · Grounds and no-connects", "one ground net, every open pin flagged"],
    ],
  ),
  {
    type: "callout", severity: "info", label: "Setup · get KiCad and the starter open",
    body: "These lessons run in **KiCad 10**: every menu path, shortcut and dialog here matches version 10. The starter ships every symbol, footprint and 3D model already placed, including RV1, D2 and J4, so nothing is left for you to hunt down.",
  },
  { type: "action", action: "downloadKicadStarter", label: "Download the L1.05 KiCad starter" },
  {
    type: "callout", severity: "info", label: "Keys · the KiCad 10 keys you will use",
    body: "The same handful as every board: **A** add a symbol, **P** add a [[power port]], **W** draw a wire, **L** place a [[net label]], **R / M / G** rotate, move, drag, **E** edit properties, **Q** no-connect flag. Hover over a part and press the key.",
  },
  {
    type: "callout", severity: "info", label: "Ports and labels first, then wires",
    body: "One ordering habit saves the most rework. On each island, drop every power port and net label onto its pin **first**, then draw the few real wires between legs. Most connections here are by name (same label, same net), so a drawn wire is the exception.",
  },

  {
    type: "callout", severity: "info", label: "Wire by name, not a maze",
    body: "For anything crossing the sheet, give the wire a [[net label]] instead of dragging a line all the way over: two wires that share a label are one connection. Use [[power port|power ports]] for +3V3 and GND so every part taps the rail by name. Wires that merely cross are not joined unless a junction dot says so.",
  },
  {
    type: "callout", severity: "info", label: "Power symbol or net label?",
    body: "A **power symbol** (press **P**) is for a rail many parts tap: VBUS, +5V, +3V3, GND. A **net label** (press **L**) is for a signal between a few pins: USB_D+, EN, and on this board **AIN** and **ADC_IN**. One mechanical difference matters: a power symbol drops straight onto a pin, but a net label rides a **wire**. So for AIN and ADC_IN, draw a short wire off the pin first, then press **L** and drop the label on that wire. Dropped in open space it floats unattached and ERC flags it.",
  },
  prose(
    "Arrange the sheet before the wiring gets dense. Drag each part so the drawing reads left to right: inputs on the left, outputs on the right, [[power port|power symbols]] at the top pointing up, grounds at the bottom pointing down. Group parts by the sub-circuit islands in the table above, and give the analog island its own clear space near U1's IO1 side, because it is the one you will be tracing element by element later.\n\nRough is fine. You are setting reading order here, not final placement. Where a part physically sits is a layout problem.",
  ),
  does("arrange the sub-circuits", [
    {
      text: "**Ctrl+F** each part and drag its sub-circuit as one cluster. The starter scatters them on a grid, so work in signal order rather than in refdes order.",
      proof: "Each sub-circuit moves as one cluster rather than as scattered single parts.",
    },
    {
      text: "**USB front end** (J1, F1, D1) far **left**, with D1 hard against J1. **Regulator** (U2, C5, C6) just to its right, so 5 V flows in and 3V3 leaves rightward.",
      proof: "J1, F1 and D1 sit together at the far left, with U2 and its caps beside them.",
    },
    {
      text: "**U1** in the **centre** as the hub, with C1/C2/C3 by its 3V3 pin and boot/reset (R1, R2, SW1, SW2, C7) just to its left.",
      proof: "U1 sits centre with its decoupling and straps around it.",
    },
    {
      text: "**The analog island** (RV1, D2, R8, J4, R7, C8) in clear space on U1's IO1 side, drawn so it reads left to right on its own.",
      proof: "The six analog parts sit together with room to read the path across them.",
    },
    {
      text: "**LEDs** in a corner near U1, **J2 / J3** on the right edges, test points anywhere open.",
      proof: "LEDs, headers and test points are placed and nothing overlaps a symbol or a wire.",
    },
  ]),
  shot(
    "The sheet blocked out: power in on the left, the module central, the analog island in its own space.",
    "KiCad 10 Schematic Editor zoomed to fit the whole L1.05 sheet with parts clustered but not yet wired, the analog island clearly grouped. Refdes legible.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Confirm the core, island by island", "Hands on. The core is familiar, which is exactly why it gets walked rather than waved at."),
  sect("01", "The power path: regulator, fuse and CC sink", "USB gives you 5 V, the module wants 3.3 V, and the port has to be told to send power at all."),
  prose(
    "**U2** is the RT9080, a low-[[dropout]] regulator holding 3.3 V steady no matter what the chip draws. It needs a capacitor on its input and another on its output to stay stable, which is **C5** and **C6** at 1 µF each. Its **EN** pin ties to **VIN** so the regulator turns on with the input.\n\nAhead of it sit two guardians. **F1** is a [[PTC|resettable fuse]] on VBUS: pull too much current and it heats, throttles, then heals once it cools. The rename across it is the design: the connector side is **VBUS**, the regulator side is **+5V**, so nothing can rats-nest to raw VBUS and skip the fuse. **D1** is the USBLC6-2 ESD array, sitting on the **raw VBUS** rail at the door.\n\nAnd **R3 / R4**, 5.1 kΩ from each CC pin to ground, are what tell a USB-C host you are a [[sink]] and to switch VBUS on. Two of them, because Type-C is reversible and only one CC line is live at a time.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["U2", "RT9080-33GJ5", "5 V to 3.3 V LDO, 600 mA"],
      ["C5, C6", "1 µF X7R", "LDO input and output stability caps"],
      ["F1", "1206L050YR", "Resettable PTC on VBUS: 0.5 A hold, 1 A trip"],
      ["D1", "USBLC6-2SC6", "ESD clamp on D+/D- and VBUS, at the port"],
      ["R3, R4", "5.1 kΩ", "CC1 / CC2 sink resistors to GND"],
    ],
  ),
  does("confirm the regulator island", [
    {
      text: "**Ctrl+F** to **U2**, click its body, and check it sits in clear space with its refdes and value readable. Press **P** and confirm a **+5V** port on **VIN**.",
      proof: "U2 sits clear of other parts with a +5V port on VIN.",
    },
    {
      text: "Confirm the wire from **EN to VIN**. EN cannot float or the regulator may never turn on, so it rides high with the input.",
      proof: "A wire runs from EN to VIN.",
    },
    {
      text: "Confirm the **PWR_FLAG** on the +5V net, dropped on that EN-to-VIN wire. +5V arrives through a passive fuse, so no chip output drives it and [[ERC]] would otherwise call it undriven.",
      proof: "A PWR_FLAG sits on the +5V net.",
    },
    {
      text: "Confirm a **+3V3** port on **VOUT**, and that **C5** carries +5V and GND while **C6** carries +3V3 and GND. Same port name, same net: nothing is drawn between them and U2.",
      proof: "VOUT carries +3V3, C5 sits across +5V and GND, C6 across +3V3 and GND.",
    },
  ]),
  shot(
    "The regulator: +5V on VIN, EN tied high with it, +3V3 leaving VOUT, a cap each side.",
    "KiCad 10 Schematic Editor, the regulator island only: U2 with +5V on VIN, EN wired to VIN, +3V3 on VOUT, C5 and C6 either side, PWR_FLAG on the +5V net. Zoom so every pin name reads.",
    "See it wired · the regulator",
  ),
  tube("Wire the regulator with me"),
  check(
    "**In plain terms, why a regulator rather than two resistors dividing 5 V down?** A divider sags the moment the chip draws current, and the ESP32's draw jumps every time the radio transmits. A regulator actively holds 3.3 V whatever the load.",
  ),
  dive(
    "Why a low-dropout part specifically",
    "Dropout is the headroom a regulator needs above its output before it stops regulating. The RT9080's is small: about **0.31 V typical** and **0.53 V worst case** at this board's load. So even when a long USB cable sags the input to around 4.6 V, there is still 4.6 minus 0.53, about 4.07 V, comfortably above the 3.3 V it has to produce.\n\nA cheaper regulator needing 1 to 2 V of headroom would drop out right there and take the rail down with it. That margin is the whole reason the design specifies a low-dropout part, and on this board it has a second consequence: the converter's reference domain rides this rail, so a rail that quietly sags under load is a measurement that quietly drifts.",
  ),
  gotcha(
    "an LDO without its output cap can oscillate",
    "C5 and C6 are not optional garnish. An LDO missing its output capacitor can turn into an oscillator, which converts your clean 3.3 V rail into noise. On a board whose entire subject is measuring small voltages accurately, that failure would look like a mysterious ADC problem rather than a power problem.",
  ),
  does("confirm the USB front end", [
    {
      text: "**J1's VBUS pin** carries a **VBUS** port, and **F1** has that VBUS node on one leg with a **+5V** port on the other. The fuse is symmetric, so either leg is fine.",
      proof: "J1's VBUS pin is named VBUS and F1 renames it to +5V across itself.",
    },
    {
      text: "A **PWR_FLAG** sits on the **VBUS** net, and **J1's GND pin** carries a **GND** port with the third PWR_FLAG on it. Three flags total: +5V, VBUS and GND.",
      proof: "Exactly three PWR_FLAGs exist, on +5V, VBUS and GND.",
    },
    {
      text: "**R3** runs from **J1's CC1** to a GND port, and **R4** from **CC2** to a GND port. One 5.1 kΩ per CC line, straight to ground.",
      proof: "CC1 and CC2 each reach GND through their own 5.1 kΩ.",
    },
    {
      text: "**D1** sits by the connector with its **VBUS** pin on the **raw VBUS** rail, ahead of the fuse, and a **GND** port on its GND pin.",
      proof: "D1's VBUS pin is on raw VBUS, not on +5V.",
    },
    {
      text: "**J1's data pins** (DP1/DP2, DN1/DN2) are still bare. They belong to island 05.",
      proof: "No label sits on J1's data pins yet.",
    },
  ]),
  shot(
    "The USB front end: VBUS in through F1 to +5V, CC to ground through 5.1 kΩ, ESD at the door.",
    "KiCad 10 Schematic Editor, USB front-end island: J1 with F1 renaming VBUS to +5V, R3/R4 from CC1/CC2 to GND, D1 on raw VBUS, PWR_FLAGs visible. Refdes legible.",
    "See it wired · USB power and protection",
  ),
  tube("Wire the USB port: power and protection"),
  check(
    "**Why does D1 sit on raw VBUS rather than on +5V after the fuse?** ESD belongs at the door. A static strike arriving on the cable has to be clamped before it travels anywhere, and the fuse is a slow thermal device that does nothing for a nanosecond-scale spike.",
  ),
  gotcha(
    "a missing CC resistor works on one cable and dies on another",
    "Leave R3/R4 off and the board still runs on an old USB-A-to-C cable, because a USB-A port has 5 V live with no handshake. Plug the same board into a modern USB-C charger and nothing happens at all. That is a bug that is intermittent by **cable** rather than by board, which is the worst kind to chase.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The module, its decoupling, boot and reset", "A steady rail at the regulator is a different thing from a steady rail at the chip."),
  prose(
    "**C2 and C3** (0.1 µF) sit on the 3.3 V rail as bypass, and **C1** (10 µF) is the [[bulk capacitor]] that covers the larger, slower swings when the radio keys up. On this board they matter for a second reason: the analog supply inside the module rides the same 3.3 V rail, so rail noise is measurement noise. That connection is the honest reason an external converter with its own reference wins later.\n\nBoot and reset are unchanged. **R1** and **R2**, 10 kΩ each, pull **EN** and **IO0** up to 3.3 V so neither floats. **SW1** pulls EN to ground to reset; holding **SW2** (IO0 low) through a reset drops the chip into USB download mode. **C7**, 1 µF from EN to GND, makes roughly a **10 ms RC** with R1 so EN crosses its threshold well after the rail has settled, and it debounces SW1 at the same time.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["C2, C3", "0.1 µF X7R", "Bypass on the 3V3 rail at the module"],
      ["C1", "10 µF X5R", "Bulk reservoir for the rail"],
      ["R1, R2", "10 kΩ", "Pull-ups on EN and IO0"],
      ["SW1, SW2", "B3F-1000", "EN (reset) and BOOT (download)"],
      ["C7", "1 µF", "EN reset RC: about 10 ms rise delay, plus SW1 debounce"],
    ],
  ),
  does("confirm the module and its decoupling", [
    {
      text: "**U1** sits in the centre of the sheet as the hub, with **C1, C2, C3** beside it. Where they sit on the sheet is readability; where they sit on the board is a layout job.",
      proof: "U1 is central with C1, C2 and C3 drawn beside it.",
    },
    {
      text: "Each of **C1, C2, C3** carries a **+3V3** port and a **GND** port. Same name, same net, nothing drawn across.",
      proof: "All three caps sit between +3V3 and GND.",
    },
    {
      text: "**U1's 3V3** pin carries a +3V3 port and its **visible GND** pin carries a GND port. The regulator can be perfect and the chip stays dark if this one is missing.",
      proof: "U1's 3V3 and visible GND pins both carry ports.",
    },
    {
      text: "Turn on **View ▸ Show Hidden Pins** and confirm U1's hidden GND pins sit on **GND**. KiCad joins a hidden power pin to the net of its name, which works only because your ground net is called GND.",
      proof: "With hidden pins shown, U1's hidden grounds are on GND.",
    },
  ]),
  shot(
    "The decoupling: C1, C2 and C3 each between +3V3 and GND, U1's rail pins named.",
    "KiCad 10 Schematic Editor, the decoupling island only: U1's supply pins with C1/C2/C3 each on a +3V3 and a GND port. Zoom so the three caps, refdes and port labels are legible.",
    "See it wired · decoupling and the module",
  ),
  tube("Wire the decoupling, then tie the module"),
  does("confirm boot and reset", [
    {
      text: "**R1** has +3V3 on one leg and an **EN** net label on the other, with matching EN labels on **U1's EN pin** and **SW1's** top leg. SW1's other leg carries GND.",
      proof: "The EN label appears on R1, U1's EN pin and SW1, and SW1's far leg is GND.",
    },
    {
      text: "**C7** carries an **EN** label on one leg and a **GND** port on the other. With R1 that is the RC giving EN a clean power-on rise and debouncing SW1.",
      proof: "C7 sits between the EN net and GND.",
    },
    {
      text: "**R2** has +3V3 on one leg and an **IO0** label on the other, matched on **U1's IO0 pin** and **SW2's** top leg, with SW2's far leg on GND.",
      proof: "The IO0 label appears on R2, U1's IO0 pin and SW2, and SW2's far leg is GND.",
    },
  ]),
  shot(
    "Boot and reset: R1 with SW1 and C7 on EN, R2 with SW2 on IO0.",
    "KiCad 10 Schematic Editor, boot/reset island: R1+SW1 on the EN net with C7 from EN to GND, R2+SW2 on IO0, both pull-ups to +3V3. Zoom so refdes and net labels read.",
    "See it wired · boot and reset",
  ),
  tube("Wire boot and reset"),
  check(
    "**If R1 were missing and you pressed nothing, what would EN read?** It would float, pick up whatever noise is around, and read at random, so the chip might reset or never start at all. The pull-up gives the pin a known resting level, and the button overrides it while held.",
  ),
  dive(
    "Why 10 kΩ, and why weak is the point",
    "A pull-up only has to set a resting level, so it should be weak, meaning a high value. At 3.3 V a 10 kΩ pull-up leaks about 0.33 mA, which is nothing, and it still holds the pin firmly high. A 100 Ω pull-up would burn 33 mA doing the identical job and would then fight the button when you press it.\n\nThe same reasoning is why RV1 is 10 kΩ rather than 1 kΩ. It is the value that is high enough to be free and low enough to be stiff, which is exactly why 10 kΩ turns up four times on this one board: R1, R2, R7 and R8, plus the trimpot's track.",
  ),
  check(
    "**Why does the rail's cleanliness matter more on this board than on L1.01?** The module's analog supply is the same 3.3 V rail the digital side and the radio run from, and the converter's reference lives in that domain. Rail noise turns straight into reading noise, which is part of why the ±50 mV floor is where it is.",
  ),
  dive(
    "Why the shared rail is named rather than fixed",
    "A precision analog design would give the converter its own filtered supply and often its own external reference, so the measurement stops depending on what the digital side is doing. This board deliberately does not. It powers the module's analog supply from the same RT9080 rail as everything else, exactly as a real ESP32 development board does.\n\nThat is a teaching choice rather than an oversight. The noise you will see at bring-up is the noise a normal board has, and naming its source (a shared rail feeding the reference domain) is what makes the case for the next SENSE board concrete rather than abstract. Separating the analog supply is an L2 topic; recognising why you would want to is an L1 one.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "USB data, LEDs, headers and test points", "The rest of the core, and the pin that is about to gain a second job."),
  prose(
    "The module speaks USB on two fixed pins: **D- is IO19, D+ is IO20**, always. Because you name the nets **USB_D+** and **USB_D-** with a plain ASCII plus and minus, KiCad reads them as a [[differential pair]], and that naming is what unlocks the differential-pair router when you reach layout.\n\nThe LEDs are unchanged: **470 Ω** in series with each, **LED1** across the rail as the power light, **LED2** driven from **IO2** as the user light. The headers **J2** and **J3** carry every module pin out in the module's own pin order, and **TP1 / TP2** are the 3V3 and GND loops you will clip a meter onto at bring-up.\n\nOne header position is about to change meaning. On L1.01, **J3 pin 17** carried a plain **IO1** label. On this board GPIO1 is the analog input, so that position joins the small set of pins that already carry a name from another island. You reuse the name rather than inventing one.",
  ),
  {
    type: "callout", severity: "info", label: "Finish U1 before the headers",
    body: "Every sub-circuit that touches U1 should carry its name on the module first: the rails, EN and IO0, the USB pair, IO2 for the user LED, and on this board **ADC_IN on IO1**. Take one pass down U1 giving every remaining GPIO its own [[net label]], and the header column becomes those same names copied across rather than forty separate decisions.",
  },
  {
    type: "callout", severity: "info", label: "The Insert-key trick for the header slog",
    body: "**Insert** repeats the last wire or label one grid step down and auto-increments the trailing number (IO4 to IO5 to IO6). The header order jumps around, so Insert only earns its keep on the unbroken runs; everywhere else you place by hand from the table. That is expected rather than you doing it wrong. No Insert key on your laptop? Use the on-screen keyboard, or Fn+Enter on a Mac.",
  },
  prose(
    "One rule for every free pin you label here: keep anything you actively **drive** at power-up off the four [[strapping pin|strapping pins]], GPIO0, GPIO3, GPIO45 and GPIO46. The chip reads those the instant it wakes, so a part tugging on one can stop it starting. Bringing a strapping pin out to a bare header is fine, because nothing is driving it there. The caution is about wiring a load or a driver onto one on the board, which on this design is exactly why the analog input went to GPIO1 and not GPIO3.",
  ),
  dive(
    "Why there is no USB-to-serial chip on this board",
    "Older ESP32 boards needed a separate bridge chip, a CP2102 or a CH340, sitting between the USB port and the microcontroller purely so code could be loaded, because the classic ESP32 could not speak USB. The S3 can: it has a USB Serial/JTAG peripheral wired to exactly two pins, IO19 for D- and IO20 for D+.\n\nSo the connector talks to the chip directly, and flashing, the serial console and JTAG debug all run down one cable. That is one fewer chip to buy, one fewer often-leadless package to hand-solder, and on this board it is also what lets the console stream ADC readings to you at bring-up over the same cable that powers the thing.",
  ),
  check(
    "**Why label the data nets USB_D+ and USB_D- rather than IO19 and IO20?** The matched plus and minus suffix is what marks them a [[differential pair]], and that naming is what unlocks the pair router and its length matching when you reach layout. Use a plain ASCII plus and minus: the router matches the literal suffix.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["LED1", "Red, forward voltage about 1.8 V", "Power indicator, straight off the rail"],
      ["LED2", "Yellow, forward voltage about 2.0 V", "User light, driven from IO2"],
      ["R5, R6", "470 Ω", "LED series current limit"],
    ],
  ),
  does("confirm the USB pair, the LEDs and the breakout", [
    {
      text: "**USB_D+** appears on **J1's DP1 and DP2**, on both of **D1's D+ pins (1 and 6)**, and on **U1's IO20**. The shared name is the connection.",
      proof: "USB_D+ appears on J1's two DP pins, both D1 D+ pins, and IO20.",
    },
    {
      text: "**USB_D-** appears on **J1's DN1 and DN2**, both of **D1's D- pins (3 and 4)**, and **U1's IO19**. Check the suffix never flips on the way through D1.",
      proof: "USB_D- appears on J1's two DN pins, both D1 D- pins, and IO19.",
    },
    {
      text: "**LED1**: +3V3 on **R5's** top leg, GND on **LED1's cathode** (the bar side), one wire between R5 and the anode.",
      proof: "The string reads +3V3 to R5 to LED1 to GND, bar side facing ground.",
    },
    {
      text: "**LED2**: an **IO2** label on **R6's** top leg, GND on **LED2's cathode**, one wire between. Drive IO2 high and it lights.",
      proof: "The string reads IO2 to R6 to LED2 to GND.",
    },
    {
      text: "**J2 and J3** carry every module pin in the module's own order, with power symbols on the rail positions and a net label matching the module pin everywhere else.",
      proof: "Every header position carries either a power port or a net label.",
    },
    {
      text: "**TP1** carries a **+3V3** port and nothing else; **TP2** carries a **GND** port and nothing else.",
      proof: "TP1 is on +3V3, TP2 is on GND, both otherwise bare.",
    },
  ]),
  shot(
    "The pair: USB_D+ on J1's DP pins, through D1, onto IO20; USB_D- the mirror onto IO19.",
    "KiCad 10 Schematic Editor, the USB data pair: J1's DP1/DP2 and DN1/DN2, D1's I/O pins and U1's IO19/IO20 all carrying the USB_D+ / USB_D- labels. Zoom so the labels read.",
    "See it wired · the USB data pair",
  ),
  shot(
    "The LEDs: +3V3 to R5 to LED1 to GND, and IO2 to R6 to LED2 to GND.",
    "KiCad 10 Schematic Editor, the LED island: both strings drawn with 470 Ω in series and each cathode bar facing GND. Zoom so refdes and net labels read.",
    "See it wired · the indicator LEDs",
  ),
  tube("Wire the LEDs and the USB data pair"),
  dive(
    "Sizing an LED resistor, in one line of Ohm's law",
    "The resistor sets the current out of whatever voltage the LED does not use: I = (Vsupply minus Vf) divided by R. The red LED drops about 1.8 V, so on 3.3 V through 470 Ω that is (3.3 minus 1.8) over 470, roughly 3.2 mA. Bright enough to read across a bench, gentle on the pin driving it.\n\nThe yellow LED's forward voltage is higher, about 2.0 V, so the same 470 Ω gives a little less, about 2.8 mA. That is why swapping LED colours at a fixed resistor quietly changes the brightness, and why a resistor value copied from someone else's schematic is a starting point rather than an answer.",
  ),
  gotcha(
    "an LED without its series resistor flashes once and dies",
    "An LED is a diode, and a diode is a poor judge of its own appetite: give it more voltage than it wants and it pulls more and more current until it cooks. R5 and R6 are not optional. Neither is polarity: the bar side of the symbol is the cathode and it faces ground. Backwards, the LED simply stays dark and ERC says nothing.",
  ),
  {
    type: "callout", severity: "info", label: "Spot the reused pins, and note there are six now",
    body: "On L1.01 five header positions already carried a name from another island: **J2.13 / J2.14** (the USB pair), **J2.3 EN**, **J3.5 IO0** and **J3.16 IO2**. This board adds a sixth. **GPIO1** is no longer a bare breakout pin, it is the analog input, so its header position carries **ADC_IN**. Reuse the existing name on the header rather than inventing a second one for the same node.",
  },
  table(
    ["Header position", "Carries", "Because"],
    [
      ["J2.3", "EN", "Already on the reset net with R1, C7 and SW1"],
      ["J2.13, J2.14", "USB_D-, USB_D+", "Already the differential pair on IO19 and IO20"],
      ["J3.5", "IO0", "Already on the boot strap with R2 and SW2"],
      ["J3.16", "IO2", "Already driving LED2 through R6"],
      ["The IO1 position", "ADC_IN", "New on this board: GPIO1 is the analog input"],
    ],
  ),
  shot(
    "The breakout: every module pin mirrored to J2 and J3, rails on the power positions.",
    "KiCad 10 Schematic Editor, the header island: J2 and J3 with every module pin mirrored, power ports on the rail positions, the IO1 position carrying ADC_IN. Zoom so the pin labels read.",
    "See it wired · headers and test points",
  ),
  tube("Wire the breakout headers with me"),
  gotcha(
    "label both ends, the one slip ERC cannot catch",
    "[[ERC]] catches a **missing** label, because the pin reads as loose. It cannot catch a **wrong** one: name the module pin IO5 and the header pin IO6 and both nets look used, so the checker stays silent. The header order is the one place to check your work against the reference image rather than against a green tick.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Wire the analog island", "Hands on. Four nets, drawn in signal order, because the order is the design."),
  sect("04", "The analog source: RV1 across the rail", "A potentiometer across a supply is a divider you can turn."),
  prose(
    "**RV1** is a 10 kΩ trimpot. Its two outer terminals are the ends of a resistive track; the middle one, **terminal 2**, is the wiper that slides along it. Put one end on **+3V3** and the other on **GND** and the wiper delivers whatever fraction of the rail you have turned past. Full anticlockwise gives 0 V, full clockwise gives 3.3 V, and everything in between is a straight line.\n\nThat wiper is the board's signal, and it gets a name: **AIN**. Naming it now matters, because three separate things hang off that node and every one of them connects by name rather than by a drawn wire.\n\nThe outer two terminals are interchangeable. Swapping them only reverses which way you turn to go up, so pick one and make sure the silkscreen agrees with the schematic.",
  ),
  table(
    ["RV1 terminal", "Connects to", "Why"],
    [
      ["1", "+3V3", "Top of the track: the full-scale end of the sweep"],
      ["2 (wiper)", "AIN", "The signal. This is the one that cannot be swapped"],
      ["3", "GND", "Bottom of the track: the zero end of the sweep"],
    ],
  ),
  does("wire the source", [
    {
      text: "Place **RV1** in clear space. Press **P** and drop a **+3V3** port on **terminal 1**, and a **GND** port on **terminal 3**. The knob now spans the rail.",
      proof: "RV1's outer terminals carry +3V3 and GND ports.",
    },
    {
      text: "Draw a short wire off **terminal 2**, press **L**, and drop an **AIN** label on it. A label dropped in open space floats unattached and ERC will flag it, so put it on the wire.",
      proof: "Terminal 2 carries a net label reading AIN, sitting on a wire.",
    },
    {
      text: "Confirm nothing else is drawn to RV1. Everything downstream joins the AIN net by name.",
      proof: "RV1 has exactly three connections: +3V3, GND and the AIN label.",
    },
  ]),
  shot(
    "RV1 bridging the rail, wiper labelled AIN.",
    "KiCad 10 Schematic Editor, the RV1 sub-island only: terminal 1 on +3V3, terminal 3 on GND, terminal 2 carrying an AIN net label. Zoom so terminal numbers read.",
    "See it wired · the analog source",
  ),
  check(
    "**What does the wiper read when the pot is exactly halfway?** About 1.65 V, half the rail. The pot divides the supply in the ratio of the two track sections, which is why its absolute resistance does not matter and its position does.",
  ),
  gotcha(
    "the ends are interchangeable, the middle is not",
    "Wire the two **end** terminals the other way round and the only consequence is that clockwise sweeps down instead of up. Wire an **end** where the **wiper** should be and the analog pin sees a fixed rail forever. Both mistakes pass ERC in silence, so check terminal 2 against the reveal image while the schematic is still cheap to change.",
  ),
  {
    type: "partModel",
    mpn: "3362P-1-103LF",
    caption: "RV1: terminal 2 is the wiper, and it is the only leg whose position is not negotiable",
  },
  prose(
    "One number worth noting while you are here. The whole track sits across 3.3 V, so RV1 draws about **0.33 mA** continuously and dissipates about **1.1 mW**. Against the RT9080's 600 mA and the part's 0.5 W rating, both are noise in the budget, which is why this board's power sums are the same ones you did on L1.01 with nothing added.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The exposed node and its two guards", "AIN is the one net a finger and a probe can reach, so it gets protection before it gets used."),
  prose(
    "Two parts hang off AIN and neither is in the measurement path.\n\n**D2**, the ESD diode, sits from **AIN to GND**. It clamps at 9.8 V, well above the 3.6 V the pin can survive, so its job is to dump the bulk energy of a static strike into ground at the point where the strike arrives. It idles off through the whole legitimate 0 to 3.3 V sweep, because its standoff is 5 V and its minimum breakdown is 6 V.\n\n**R8**, 10 kΩ, sits between **AIN and J4's middle pin**. J4 is a three-pin header carrying **3V3 / AIN / GND**, and it exists so you can put a meter probe on the analog node and, optionally, feed a small 0 to 3.3 V sensor in. Anything that reaches the outside world needs a limiter: with R8 in the way, a probe slip that shorts that pin to a rail passes about **half a milliamp**, which the trimpot's wiper and the 3.3 V rail both shrug off. The raw AIN node stays internal to the board, reachable from outside only through R8.",
  ),
  table(
    ["Ref", "From", "To", "Job"],
    [
      ["D2", "AIN", "GND", "Shunt the bulk of an ESD strike at the exposed node"],
      ["R8", "AIN", "J4 pin 2", "Limit any external drive or short to a fraction of a milliamp"],
      ["J4 pin 1", "+3V3", "", "A rail for a small sensor, labelled on the silk"],
      ["J4 pin 3", "GND", "", "The return, and your meter's black lead"],
    ],
  ),
  does("wire the guards", [
    {
      text: "Place **D2** and give one leg an **AIN** label, the other a **GND** port. It is bidirectional, so it has no electrical polarity; the silkscreen dot exists so a batch gets assembled consistently.",
      proof: "D2 sits between the AIN net and GND.",
    },
    {
      text: "Place **R8**. One leg takes an **AIN** label; the other wires to **J4's middle pin (pin 2)**.",
      proof: "R8 bridges the AIN net and J4 pin 2, with nothing else between them.",
    },
    {
      text: "**J4 pin 1** takes a **+3V3** port and **J4 pin 3** takes a **GND** port, so the header reads 3V3 / AIN / GND top to bottom.",
      proof: "J4's outer pins carry +3V3 and GND, in that order around pin 2.",
    },
    {
      text: "Confirm **no direct wire** runs from AIN to J4. The only path is through R8, and that is the whole point of the part.",
      proof: "J4's AIN pin connects to the AIN net through R8 alone.",
    },
  ]),
  table(
    ["What goes wrong at J4", "Without R8", "With R8"],
    [
      ["Probe slips and shorts AIN to 3V3", "Hundreds of mA through the pot's wiper", "About 0.33 mA, which nothing notices"],
      ["A 5 V sensor gets wired in by mistake", "Over-voltage straight at the pin's clamp", "Under half a milliamp, current-limited twice"],
      ["A sensor back-feeds the board", "Unbounded current pushed into the 3.3 V rail", "Sub-milliamp, bounded by construction"],
    ],
  ),
  shot(
    "The guarded door: D2 to ground, R8 out to J4, raw AIN staying inside the board.",
    "KiCad 10 Schematic Editor, the guard sub-island: D2 from AIN to GND, R8 from AIN to J4 pin 2, J4's outer pins on +3V3 and GND. Refdes legible.",
    "See it wired · the guards and the probe header",
  ),
  check(
    "**Why does D2 clamp AIN rather than the pin the converter actually reads?** Strikes enter where fingers and probes are, which is the trimpot screw and the header. Clamp at the exposure and the energy goes to ground before it travels; the series resistor behind it then limits whatever is left.",
  ),
  dive(
    "Two 10 kΩ resistors, two different doors",
    "R7 and R8 are the same jellybean part and they do unrelated jobs.\n\nR7 sits **in the measurement path**. With C8 it forms the conditioning filter the converter reads through, and its 10 kΩ also limits any fault that gets past D2 to roughly a milliamp into the pin's own internal clamp, which is about 130 times below the ±200 mA the datasheet gives as the latch-up trigger. Its cost in the other direction is honest and tiny: the pin leaks at most 50 nA, and 50 nA across 10 kΩ is half a millivolt, buried under a ±50 mV error band.\n\nR8 sits **in the human path**. It is a stub off AIN going nowhere near the converter. Any short, mis-probe or back-fed sensor at J4 pushes at most half a milliamp through it, which protects the pot's wiper from being driven hard and bounds how much current can be pushed back into the 3.3 V rail. Same part number, two doors guarded.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  sect("06", "The conditioning filter: R7 into C8 at the pin", "Two more parts, and the order of them is the whole circuit."),
  prose(
    "**R7**, 10 kΩ, runs from **AIN** to a new net called **ADC_IN**. **C8**, 100 nF, runs from **ADC_IN to GND**. And **ADC_IN** goes to the module's **GPIO1**.\n\nRead that as a sequence rather than a set. The resistor is in series with the signal; the capacitor is across the signal, at the far end, right where the converter samples. That arrangement does two things at once. It bandlimits the input so nothing fast arrives to be misread, and it parks a large local reservoir of charge at the pin so the converter's sampling circuit takes what it needs from the capacitor rather than from the trimpot.\n\nIt also happens to be exactly the input network Espressif use when they characterise this converter: their published figures are taken with an external 100 nF capacitor connected to the ADC. Measuring under the maker's conditions is what makes the maker's error bands yours.",
  ),
  table(
    ["Ref", "From", "To", "Job"],
    [
      ["R7", "AIN", "ADC_IN", "Series half of the filter, and the pin's fault limiter"],
      ["C8", "ADC_IN", "GND", "The at-the-pin reservoir, matching the datasheet's test circuit"],
      ["ADC_IN", "C8 / R7", "U1 GPIO1", "The conditioned signal, landing on ADC1 channel 0"],
    ],
  ),
  does("wire the filter", [
    {
      text: "Place **R7**. One leg takes an **AIN** label; draw a short wire off the other, press **L**, and name it **ADC_IN**.",
      proof: "R7 bridges the AIN and ADC_IN nets.",
    },
    {
      text: "Place **C8** with an **ADC_IN** label on one leg and a **GND** port on the other. The capacitor sits across the signal, not in line with it.",
      proof: "C8 sits between ADC_IN and GND.",
    },
    {
      text: "Drop an **ADC_IN** label on **U1's IO1** pin. Same name, same net: the shared label is the connection and nothing is dragged across the sheet.",
      proof: "U1's IO1 pin carries the ADC_IN label.",
    },
    {
      text: "Trace the whole path left to right and say it out loud: **RV1 wiper, then AIN with D2 and R8 branching off it, then R7, then C8 at the pin, then GPIO1**.",
      proof: "You can name the five elements in order without looking at the sheet.",
    },
  ]),
  shot(
    "The finished analog island: source, guards, filter, pin, in signal order.",
    "KiCad 10 Schematic Editor, the whole analog island: RV1 to AIN, D2 and R8 branching, R7 to ADC_IN, C8 to GND, ADC_IN on U1's IO1. Every refdes and net label legible.",
    "See it wired · the analog island",
  ),
  check(
    "**C8 accidentally lands on the AIN side of R7 instead of the ADC_IN side. Everything still connects. What broke?** The filter. The network the datasheet assumes is a resistor feeding a capacitor **at the pin**, and moving the capacitor upstream leaves the pin fed through 10 kΩ with nothing local to draw from. Same parts, different circuit.",
  ),
  {
    type: "math",
    tex: "f_c = \\frac{1}{2\\pi R_7 C_8} = \\frac{1}{2\\pi \\cdot 10\\,\\mathrm{k}\\Omega \\cdot 100\\,\\mathrm{nF}} \\approx 159\\ \\mathrm{Hz}",
    display: true,
    plain: "fc = 1 / (2 x pi x R7 x C8) = 1 / (2 x pi x 10 kohm x 100 nF), about 159 Hz",
  },
  gotcha(
    "everything connects and the circuit is still wrong",
    "This island is the clearest example in the whole curriculum of a schematic that passes every automated check while being wrong. Swap any two elements along the chain and the netlist still says RV1, D2, R8, R7, C8 and GPIO1 are all joined. ERC has no opinion about order. Only tracing the path against the reveal image catches it.",
  ),
  dive(
    "What the filter is honestly doing, and what it is not",
    "Ten kilohms into a hundred nanofarads gives a corner frequency around **159 Hz**. Above that the capacitor's impedance falls and the pair increasingly shorts signal to ground, which is what bandlimits the input and what shunts radio-frequency pickup away from a high-impedance node sitting on a board with a 2.4 GHz transmitter on it.\n\nBe honest about the limits. A 159 Hz corner barely touches 50 or 60 Hz mains hum: the gain there is still about 0.95. Anything slower than the corner, including noise riding on the shared 3.3 V rail, passes straight through. Those are exactly the residuals the averaging step at bring-up has to deal with, and part of why the error floor stays where it does.\n\nThe other half of the job is quieter. At the instant the converter samples, it grabs charge from whatever is nearest. With 100 nF sitting at the pin, that is the capacitor rather than the trimpot's wiper, so the source's own impedance stops mattering and R7's value is free to be chosen for the filter and for fault limiting instead.",
  ),

  trace(
    "The analog island, net by net",
    [
      { text: "**+3V3** reaches RV1 terminal 1 and J4 pin 1", help: "Both are ports rather than drawn wires. If either is missing, the sweep loses its top end or the header loses its rail." },
      { text: "**GND** reaches RV1 terminal 3, D2's low leg, C8's low leg and J4 pin 3", help: "Four ground connections in one island. Missing one is the most common way this island half-works." },
      { text: "**AIN** appears on exactly four things: RV1's wiper, D2, R8 and R7", help: "A fifth AIN label anywhere means something joined the exposed node that should have joined ADC_IN instead." },
      { text: "**ADC_IN** appears on exactly three: R7's far leg, C8's high leg and U1's IO1", help: "Plus the matching header position. If ADC_IN shows up on the J4 side, R7 has been bypassed." },
    ],
  ),
  check(
    "**You count five AIN labels instead of four. What is the likely mistake?** Something that belongs on ADC_IN got labelled AIN, most often C8. That puts the capacitor on the wrong side of R7, which removes the filter and leaves the converter's pin fed through 10 kΩ with nothing local to draw from.",
  ),

  // ── 07 ────────────────────────────────────────────────────────────────────
  sect("07", "Choosing the pin: ADC1, GPIO1, and not GPIO3", "Membership of ADC1 is necessary. It is not the whole test."),
  prose(
    "The signal has to land on **ADC1**, because the Wi-Fi radio takes ADC2's hardware while it runs and Espressif state in the datasheet that the ADC2 channel analog functions cannot be used with Wi-Fi simultaneously. On the ESP32-S3 that means **GPIO1 through GPIO10**, with GPIO11 through GPIO20 belonging to ADC2.\n\nThat still leaves ten candidates, and one of them is a trap. **GPIO3** is genuinely ADC1 channel 2, and it is also one of the chip's four [[strapping pin|strapping pins]]: the level on it at the instant of reset is a vote on how the chip starts. A knob is the last thing you want holding a vote, since its position is whatever the last person left it at.\n\n**GPIO1** is ADC1 channel 0 with no start-up duty of any kind. That is the pin, and wiring it in copper is how this board makes the ADC2 mistake impossible rather than merely discouraged.",
  ),
  table(
    ["Candidate", "ADC bank", "Verdict"],
    [
      ["GPIO1", "ADC1 channel 0", "Chosen: an ADC1 channel with no strapping duty"],
      ["GPIO3", "ADC1 channel 2", "Rejected: a JTAG strapping pin sampled at reset"],
      ["GPIO11 to GPIO20", "ADC2", "Rejected: unusable while the radio is running"],
    ],
  ),
  does("confirm the pin choice, and the header position it changes", [
    {
      text: "Confirm **ADC_IN** lands on **U1's IO1**, and that no other net is labelled onto that pin.",
      proof: "IO1 carries exactly one net label, ADC_IN.",
    },
    {
      text: "Find the **J3 header position that carried IO1** on L1.01. On this board it must carry **ADC_IN**, reusing the analog net's name rather than inventing a second one for the same node.",
      proof: "The header position for module pin IO1 carries the ADC_IN label.",
    },
    {
      text: "Confirm **nothing** is labelled onto GPIO3, and that GPIO3's header position still carries its plain **IO3** label. Bringing a strapping pin out to a bare header is fine; wiring a driver or a load onto one is what causes trouble.",
      proof: "GPIO3 carries only its header label and no analog net.",
    },
  ]),
  {
    type: "traceList",
    headline: "The pin audit, in three lines",
    body: "",
    items: [
      { text: "The analog net is on **GPIO1**, which is in the ADC1 range of GPIO1 to GPIO10", help: "On ADC2 (GPIO11 to GPIO20) the reading fails or returns nonsense the moment Wi-Fi starts, with no error you would notice on the bench." },
      { text: "The analog net is **not** on GPIO3", help: "GPIO3 passes the ADC1 test and fails the strapping test. The knob's position would become a vote on how the chip boots." },
      { text: "The header position for IO1 carries **ADC_IN**, not a second name for the same node", help: "Two names for one node is how you end up with a net that looks connected in two places and is actually split." },
    ],
  },
  check(
    "**GPIO3 is an ADC1 channel. Why is it still the wrong pin?** It is a strapping pin, sampled at the instant of reset to decide how the chip starts. On this board the voltage on the analog pin is wherever the learner left the knob, and that must never be an input to the boot decision.",
  ),
  dive(
    "Designing a failure out beats warning about it",
    "The ADC2 mistake is a good one to study because of how it fails. There is no compile error, no smoke and no flag. The board works perfectly on the bench, and then a reading turns to nonsense the first time the firmware joins a network, which is usually days later and in someone else's hands.\n\nA warning in a guide only helps the person who reads the guide at the moment they need it. A pin chosen at the schematic helps everyone who ever builds the board, including the person who copies your design without reading anything. That is why this constraint is spent here, in copper, rather than saved for a note in the firmware. The guide still teaches the rule, because you will meet chips whose schematic somebody else drew.",
  ),
  prose(
    "One forward-looking note, so the firmware at bring-up is not a surprise. Reading this pin takes three settings: the **channel** (ADC1 channel 0, which is GPIO1), the **attenuation** (12 dB, so the input range reaches toward the rail), and the **calibration** handle that turns a raw count into millivolts using the correction burned into the chip's eFuses at manufacture. The hardware you just drew decides the first. The other two are one line each, and the numbers they produce are what the whole lesson is about.",
  ),

  // ── 08 ────────────────────────────────────────────────────────────────────
  sect("08", "Silk, grounds, no-connects and the ERC sweep", "Two finishing sweeps, plus the silkscreen that keeps a probing hand honest."),
  prose(
    "Silkscreen is content on this board, not decoration. **J4 gets its pin order printed**, 3V3 / AIN / GND, and a **0 to 3.3 V only** note beside it, because that header invites a probe and a home-made sensor. **D2 gets a pin-1 dot** so a batch is assembled the same way round even though it is electrically symmetric. And the breakout position for GPIO1 gets marked as the ADC1 input, with a short note that ADC2 stops working when the radio is on, so the rule survives contact with the board rather than living only in this guide.\n\nThen the two sweeps you know. **Grounds:** every GND pin lands on the same net, including the module's hidden ones. **No-connects:** press **Q** on every pin you genuinely mean to leave open, so a real mistake is not buried under a screen of intentional ones.",
  ),
  does("silk, grounds and no-connects", [
    {
      text: "Add the silkscreen text for **J4**: the pin order **3V3 / AIN / GND** and the warning **0 to 3.3 V only**, placed so a hand holding a probe can read it.",
      proof: "J4's silk names all three pins and carries the voltage limit.",
    },
    {
      text: "Mark **D2** with a pin-1 dot, and label the **GPIO1 breakout position** as the ADC1 analog input with a short ADC1-only note.",
      proof: "D2 has an orientation dot and the GPIO1 header position is marked as the ADC input.",
    },
    {
      text: "**Grounds:** drop a **GND** port on every ground pin: U2's, the free legs of C5/C6 and the decoupling caps, **C8's** free leg, **D2's** ground leg, **RV1's terminal 3**, **J4 pin 3**, each button's low leg, each LED's cathode, U1's visible GND and TP2.",
      proof: "Every ground pin on the sheet carries a GND port, the analog island included.",
    },
    {
      text: "**No-connects:** press **Q** on every pin you mean to leave open: J1's SBU1 and SBU2, the regulator's NC pin, and any unused J1 contact.",
      proof: "A no-connect marker sits on each deliberately open pin.",
    },
  ]),
  shot(
    "Silk that teaches: J4's pin order, the voltage limit, and the ADC1 note at the breakout.",
    "KiCad 10 Schematic or PCB editor showing the L1.05 silkscreen text around J4 (3V3 / AIN / GND plus the 0 to 3.3 V only note) and the ADC1 marking at the GPIO1 breakout position.",
  ),
  tube("Grounds, no-connects and the silk that carries the rule onto the board"),
  prose(
    "One more thing before the checker. [[ERC]] reads your whole schematic and flags what is electrically wrong: a pin connected to nothing, two outputs fighting, a power rail nothing drives. Run it, then work the list to zero. The bar is the same one you will meet again at [[design rule check|DRC]] in layout: clean, or every remaining flag is an exception you have marked and understood rather than one you scrolled past.",
  ),
  table(
    ["ERC says", "You do"],
    [
      ["Input power pin not driven", "Drop a [[PWR_FLAG]] on each rail no chip output drives: VBUS, +5V and GND. +3V3 needs none, since the regulator's output counts as a driver"],
      ["Pin not connected", "Meant to leave it open? Press Q for a [[no-connect]] flag, so it reads as intentional"],
      ["Unconnected wire or net", "A real mistake: join it, or delete the stray end. Do not scroll past this one"],
      ["Label not connected", "A net label dropped in open space rather than on a wire. Common on AIN and ADC_IN: put it on the wire"],
    ],
  ),
  gotcha(
    "GNDPWR in the symbol picker is not the flag you want",
    "If you go hunting for PWR_FLAG and land on **GNDPWR**, stop. That is a separate stacked-ground symbol which makes its own net, so dropping it in will split your ground rather than flag it. Use a plain **PWR_FLAG** on a normal GND.",
  ),
  dive(
    "ERC is the safety net, not a hoop",
    "You cannot instruct your way out of every slip. A careful builder with the rule in front of them still half-finishes a both-ends task across forty pins, because that is how humans handle long two-sided work. So the durable move is to design the net and learn to read it.\n\nThat is why this lesson pairs each error-prone step with the checker's tell. Label both ends and if you miss one, ERC flags the loose pin: that flag is your check. It also means knowing where the net has holes. Order along the analog path, the wiper terminal, and whether J4 reaches AIN through R8 are all invisible to ERC, which is exactly why the list below exists.",
  ),
  band("check", "Prove it", "Verify. Trace what ERC cannot see against the answer key, then run the checker."),
  {
    type: "traceList",
    headline: "What ERC cannot catch here",
    body: "",
    items: [
      { text: "**The order along the path is RV1, then the D2 and R8 branch, then R7, then C8 at the pin, then GPIO1.**", help: "Trace it left to right against the reveal image. Elements swapped along the chain still connect everything to everything, and a C8 on the wrong side of R7 filters nothing." },
      { text: "**RV1's wiper is on terminal 2**, with the outer two on +3V3 and GND", help: "Wire an end terminal as the wiper and the reading sits at a rail and never moves when you turn the screw. Nothing warns you." },
      { text: "**J4's AIN pin reaches the analog node through R8 alone**", help: "A direct wire from AIN to the header would pass DRC, pass ERC, and hand a probe slip a straight path into the trimpot's wiper." },
      { text: "**U2's VIN sits on +5V**, after the fuse, rather than on raw VBUS", help: "Both are valid rails so ERC cannot tell them apart, and VIN on raw VBUS quietly loses the regulator its overcurrent protection." },
      { text: "**USB_D+ and USB_D- are not swapped** through D1", help: "Follow each label from J1 through D1 to the module and check the suffix never flips." },
      { text: "**Each LED's bar side faces GND**", help: "Backwards it simply stays dark, and ERC says nothing at all." },
    ],
  },
  shot(
    "The answer key: the whole sheet, with the analog island legible.",
    "KiCad 10 full L1.05 schematic in one shot, hi-res: the analog island readable (RV1, D2, R8 to J4, R7 to C8 to GPIO1) with the core framed around it. Fit the full sheet.",
  ),
  does("run ERC and export", [
    {
      text: "Run a **scratch ERC** first. Every genuinely open pin lists as not connected, and that list is your to-do: press **Q** on each one you meant to leave open.",
      proof: "A scratch run lists no open pin you did not intend.",
    },
    {
      text: "Run **Inspect ▸ Electrical Rules Checker** properly and work the list to zero, or to flags you have marked and understood.",
      proof: "ERC reports no errors, or every remaining flag is marked and understood.",
    },
    {
      text: "Plot the schematic to **PDF** (File ▸ Plot) for a readable copy and keep the `.kicad_sch` source beside it.",
      proof: "A schematic PDF sits alongside the .kicad_sch source.",
    },
    {
      text: "Attach the clean **ERC report** as this stage's artifact.",
      proof: "The stage shows your ERC report attached.",
    },
  ]),
  shot(
    "ERC clean: no errors, and every remaining flag understood.",
    "KiCad Electrical Rules Checker dialog after a clean run on the L1.05 schematic, violation list empty. Frame the summary line.",
  ),
  tube("Wire the analog island with me: source, guards, filter, pin"),
  tube("Run ERC clean and export the schematic PDF"),

  {
    type: "quiz",
    prompt: "Quick check: schematic",
    gate: true,
    questions: [
      {
        id: "path-order", reviewId: "path-order",
        q: "C8 accidentally lands on the AIN side of R7. Everything still connects. What broke?",
        options: [
          "The filter: without the resistor in front of a capacitor sitting at the pin, the network the datasheet assumes no longer exists",
          "Nothing: a capacitor's position is cosmetic",
          "The pot's range",
        ],
        answer: 0,
        explain: "The network is R7 feeding C8 at the pin. Same parts, wrong order, a different circuit. Order is the design, and ERC has no opinion about it.",
      },
      {
        id: "clamp-location",
        q: "The ESD diode guards AIN, the touchable node, rather than the ADC pin itself. Why?",
        options: [
          "There is no room next to the pin",
          "Strikes enter at fingers and probes, so you clamp at the exposure and let R7 limit the residue",
          "It needs the pot's resistance to work",
        ],
        answer: 1,
        explain: "Protection goes at the door. The clamp shunts the energy where it arrives; the series resistor guards the pin behind it.",
      },
      {
        id: "gpio-choice", reviewId: "gpio-choice",
        q: "GPIO3 is an ADC1 channel. Why is it still the wrong pin for this signal?",
        options: [
          "It belongs to the USB pair",
          "Its channel number conflicts with GPIO1",
          "It is a strapping pin: the knob's position at reset would become a vote on how the chip boots",
        ],
        answer: 2,
        explain: "Membership of ADC1 is necessary and not sufficient. Strapping duty disqualifies a pin from analog service on a board whose analog voltage is set by a knob.",
      },
      {
        id: "r8-job",
        q: "R8 sits between AIN and the J4 header. What does its presence mean a mistake at that header costs?",
        options: [
          "About half a milliamp: the voltage across 10 kΩ, harmless to the pot, the rail and the pin alike",
          "A blown fuse",
          "The ESD diode",
        ],
        answer: 0,
        explain: "The header invites probes and home-made sensors, so it gets a limiter. A fraction of a milliamp is the worst a slip can do.",
      },
      {
        id: "wiper-terminal-sch",
        q: "You wire RV1's terminal 1 as the signal instead of terminal 2. What happens at bring-up?",
        options: [
          "The reading sits at a rail and never changes as you turn the screw",
          "The pot overheats",
          "The sweep runs backwards",
        ],
        answer: 0,
        explain: "Terminal 2 is the wiper. An end terminal is a fixed point on the track, so the analog pin sees 3.3 V or 0 V forever. Swapping the two ends is the harmless mistake; swapping an end with the wiper is not.",
      },
      {
        id: "adc-in-header",
        q: "The J3 position that carried a plain IO1 label on L1.01 must carry ADC_IN on this board. Why?",
        options: [
          "IO1 is reserved on the ESP32-S3",
          "It is the same physical node as the analog input, and one node deserves exactly one name",
          "The header cannot carry analog signals",
        ],
        answer: 1,
        explain: "Same pin, same net. Giving one node two names is how you end up with a net that looks connected in two places and is actually split.",
      },
      {
        id: "fuse-rename",
        q: "The connector side of F1 is called VBUS and the regulator side is called +5V. What does that rename buy you?",
        options: [
          "It makes the schematic shorter",
          "It sets the trace width automatically",
          "Nothing downstream can rats-nest to raw VBUS, so the fuse is in series by construction",
        ],
        answer: 2,
        explain: "Two names for two sides of a protective part means you cannot accidentally route around it. The rename is the fuse.",
      },
      {
        id: "erc-blind-order", reviewId: "erc-blind-order",
        q: "ERC comes back clean on this schematic. What can it still not tell you?",
        options: [
          "Whether a pin is left unconnected",
          "Whether a power rail has nothing driving it",
          "Whether the parts along the analog path are in the right order",
        ],
        answer: 2,
        explain: "ERC checks connectivity, not intent. Every element on the chain is connected either way; only tracing the path against the answer key shows the order is right.",
      },
    ],
  },

  exit(
    "One new island in signal order, both guards placed, the right ADC1 pin, and silkscreen that carries the rule onto the board. Attach the clean ERC report. Layout's genuinely new job is honouring the phrase 'at the pin' as a distance, plus the [[antenna keep-out]] you already know: a **Rule Area** on every copper layer, drawn before you pour, refilled and confirmed under DRC.",
  ),

  ref("ESP32-S3 Series Datasheet (Espressif): SAR ADC, the ADC2 with Wi-Fi note, and Table 2-8 analog functions", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP32-S3 Hardware Design Guidelines (Espressif): the schematic checklist for the module and its supplies", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html"),
  ref("Bourns 3362 Trimpot datasheet: terminal 2 is the wiper", "https://www.bourns.com/docs/Product-Datasheets/3362.pdf"),
  ref("Bourns CDSOD323-TxxC datasheet: 5 V standoff, 6.0 V minimum breakdown, 9.8 V clamping", "https://bourns.com/docs/Product-Datasheets/CDSOD323-TxxC.pdf"),
  ref("KiCad 10: Schematic Editor manual", "https://docs.kicad.org/10.0/en/eeschema/eeschema.html"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "SCHEMATIC", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
