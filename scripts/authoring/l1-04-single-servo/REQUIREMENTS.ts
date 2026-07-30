// L1.04 single-servo driver — REQUIREMENTS card.
//
// Authored ahead of the board from docs/boards/l1-04-single-servo/{design.md,
// bom.csv,validation-log.md} (DRY, 10 passes, design-stage part-ready), with
// L1.01's REQUIREMENTS card as gospel for everything the two boards share (the
// WROOM core, the 600 mA LDO budget, the ADC1-only rule, the antenna keep-out).
//
// The new material is driving a hobby servo: the 50 Hz / 1.0 to 2.0 ms signal,
// the servo's own current draw, and why that current does not come off the logic
// rail. design.md §7 records the pedagogy decision this card obeys: foreground
// the rail-separation + bulk-cap story, and frame F2/D2/D3 as guard rails the
// learner does not have to fully understand yet.
//
// Numbers are design.md's, worst-case-proven there: stall 0.9 A working figure
// (0.95 A computed from MG90S 750 mA +/-10% at 4.8 V scaled to the 5.5 V rail
// ceiling), inrush ~1.3 A, running 0.1 to 0.2 A, idle ~10 mA, rail 5.0 V nominal
// with a hard 5.5 V ceiling. The card states the same numbers, never a rounder
// version of them.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Making a hobby servo move takes one signal wire: a pulse repeating about every 20 ms, whose 1.0 to 2.0 ms width picks the angle. Any tutorial covers that in a paragraph. What tutorials skip is the day the servo hits an obstacle, stalls at roughly **0.9 A**, and your microcontroller **reboots mid-move**. That reboot is the lesson. Stall current drawn through the same rail that feeds the [[microcontroller]] sags the supply past the regulator's [[dropout]], and the 3.3 V collapses. This board designs that failure out. The servo gets its **own external 5 V rail**, sharing only ground with the logic, so servo current can never reach the USB and regulator path the processor lives on.",
  ),

  band("orient", "A power lesson wearing a motor costume", "Read this one. Nothing to build yet. You are settling five promises, and four of them are about amps rather than angles."),
  {
    type: "callout", severity: "info", label: "What carries over from L1.01",
    body: "Your bench, your KiCad setup, and the whole core of this board. **U1** is the same ESP32-S3-WROOM-1, **J1** the same USB-C receptacle, **U2** the same 600 mA [[LDO]], with the same [[PTC]], the same ESD array, the same EN and BOOT buttons and the same GPIO breakout headers. The [[KiCad starter]] and the [[exact BOM]] are provided as before, part numbers and all. The new hardware surface is one signal pin, one screw terminal, one 3-pin servo header, a bulk capacitor and three protection parts. The new *skill* is thinking about a load that fights back.",
  },
  { type: "partModel", mpn: "ESP32-S3-WROOM-1-N16R2", caption: "U1 again: the same module, now with a motor hanging off the board" },

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "What you're building", "A USB-C ESP32-S3 board that drives one hobby servo, with the servo's power kept off the logic rail on purpose."),
  shot(
    "The finished single-servo board: USB-C at one end, the green screw terminal for the servo supply, and a micro servo plugged into the 3-pin header.",
    "Finished L1.04 board on a bench, micro servo plugged into J5 and a bench supply on J4. USB-C in frame. Board ~80% of frame, dark neutral background.",
  ),
  prose(
    "At the centre is the L1.01 breakout you already built and understand. Around it sit five new things. **J4** is a 2-position 5.08 mm screw terminal where an external regulated 5 V supply lands. **F2** is a resettable fuse in that supply line. **C8** is a 1000 µF [[bulk capacitor]] holding the servo rail steady through the fast current steps a motor makes. **J5** is a 1x3 header carrying GND, V+ and the signal to the servo. And **GPIO4** drives that signal through **R7**, a 470 Ω series resistor.\n\nThe two power paths meet at exactly one place: ground. Nothing else connects them.",
  ),
  table(
    ["Delta vs L1.01", "Ref", "Job"],
    [
      ["Servo supply input", "J4", "5.08 mm screw terminal: external regulated 5 V, 4.5 to 5.5 V, positive and negative marked on the silkscreen"],
      ["Servo-rail fuse", "F2", "1.5 A resettable PTC: holds a real stall, trips on a real short, resets itself when you fix it"],
      ["Servo bulk cap", "C8", "1000 µF / 16 V: the local reservoir the motor pulls from before the supply can react"],
      ["Servo connector", "J5", "1x3 header, GND / V+ / SIG, V+ deliberately in the middle"],
      ["PWM signal", "GPIO4 + R7", "50 Hz pulse train from the module, through a 470 Ω series resistor to J5 pin 3"],
      ["Guard rails", "D2, D3", "Reverse-polarity crowbar and a transient clamp on the servo rail. Section 05 covers what they do"],
    ],
  ),
  check(
    "**Which pin on the board carries servo current?** None of them. The servo's current comes from the external supply at J4, passes through F2 and C8, reaches the servo at J5 pin 2, and returns through ground. No GPIO, no USB pin, and no regulator output is in that loop.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The brownout argument, with numbers", "Why a shared rail reboots the chip. Walk the volts once and you will never wire a servo to the logic rail again."),
  prose(
    "Feed the servo from USB's 5 V and a 0.9 A stall pulls that current through the cable and connector resistance, roughly **0.3 to 0.5 Ω** on a typical USB path. Ohm's law turns that into a **0.27 to 0.45 V sag** on the 5 V the regulator sees. The RT9080 needs its input above 3.3 V plus its own dropout, which is **310 mV typical and about 0.5 V worst case** near full load and temperature. The sag eats that headroom, the 3.3 V rail falls, and the ESP32-S3 hits its brownout detector and resets. A stiffer servo pulling 1 to 2 A sags it further still.\n\nOn a separate rail the sum has no terms left in it. The servo's current loop runs external supply to F2 to C8 to the servo and back through ground. The USB, fuse and regulator path carries **zero amps** of servo current, so there is no sag mechanism to size against, for any servo you can plug in.",
  ),
  table(
    ["Topology", "Where stall current flows", "What happens to 3.3 V"],
    [
      ["Shared rail (the failure being taught)", "USB cable, connector, PTC, LDO input", "0.27 to 0.45 V sag on the LDO input, dropout exceeded, 3.3 V collapses, reset mid-move"],
      ["Separate rail (this board)", "External supply, F2, C8, servo, ground", "No servo current on the logic high side, so no sag from the stall at all"],
    ],
  ),
  shot(
    "Two power paths sharing only ground: USB to LDO to 3.3 V on one side, screw terminal to fuse to bulk cap to servo on the other.",
    "Two-rail block diagram: USB-C to F1 to U2 to 3V3 to U1 across the top; J4 to F2 to C8 to J5 across the bottom; the two joined only at a single GND symbol.",
  ),
  check(
    "**The servo jams against its end stop and the LED on the board keeps blinking without a hiccup. Which promise just paid off?** The separate rail. The stall amps came out of the external supply and returned through ground, never touching the USB and regulator path the processor runs on.",
  ),
  dive(
    "Where 0.9 A comes from",
    "The MG90S datasheet gives a stall current of **750 mA plus or minus 10 % at 4.8 V**. Take the unfavourable end of the tolerance, 825 mA, and scale it to this rail's 5.5 V ceiling: 825 x 5.5 / 4.8 is about **945 mA**. The design carries **0.9 A** as the working figure and re-checks every protection margin at 0.95 A, so nothing on the board depends on the rounding.\n\nThe other operating points matter less but are worth knowing. A micro servo idles at roughly **10 mA** holding position with no load, runs at **100 to 200 mA** while it moves, and draws a brief starting inrush of about **1.3 A**, roughly one and a half times stall, for a few milliseconds. That inrush is what C8 exists for. Sustained stall current comes from the external supply; the capacitor covers the fast step at the front of it.\n\nWorst case, honestly computed, then designed against. That is the pattern every board in this series repeats.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The signal: a pulse whose width is the message", "50 Hz, 1.0 to 2.0 ms, one wire. The easiest part of the whole board."),
  prose(
    "A hobby servo listens for a pulse on its signal wire. The pulse repeats about every **20 ms**, which is **50 Hz**, and the servo reads the *width* of the high time to decide where to point. Around **1.5 ms** is the middle of its travel. Roughly **1.0 ms** and **2.0 ms** are the two ends. The gap between pulses carries no information at all.\n\nOn this board **GPIO4** generates that pulse using the ESP32-S3's LEDC peripheral, the same hardware that dims LEDs, configured to 50 Hz instead of a few kHz. The signal leaves the module at 3.3 V, passes through **R7** at 470 Ω, and arrives at **J5 pin 3**.\n\nOne honest caveat, because it will bite somebody. Hobby servos publish no input-threshold specification, so 3.3 V driving a servo designed around a 5 V receiver is common practice rather than a guaranteed one. Most micro servos read it happily. The kit specifies a servo that does. If yours jitters or refuses to move while the pulse looks correct on a scope, a logic buffer powered from the servo rail is the documented fix, and section 05 of the BRINGUP card walks it.",
  ),
  shot(
    "A scope on J5 pin 3: a 3.3 V pulse about 1.5 ms wide, repeating every 20 ms.",
    "Oscilloscope screen, single channel probing J5 pin 3, showing a 20 ms period and a ~1.5 ms high pulse. Cursors on the pulse width, amplitude reading ~3.3 V legible.",
    "See it wired · the servo pulse on a scope",
  ),
  check(
    "**You double the pulse rate to 100 Hz but keep the width at 1.5 ms. Where does the servo point?** Still the middle. The servo decodes the width of the high time, and the width did not change. Most servos tolerate a faster frame; none of them read position from it.",
  ),
  dive(
    "Why 20 ms, and why the width carries the angle",
    "The 20 ms frame is inherited, not derived. Early radio-control receivers carried several channels in one stream by putting each servo's command at a different time position inside a repeating frame of about 22.5 ms. Converting that stream into per-servo signals was trivial: the time between two markers became the high time of one servo's pulse. The frame period stuck, and so did 50 Hz.\n\nThe practical consequences are worth holding on to. The period is a habit, so most servos tolerate a range of rates; the width is the command, so it is the only thing you change. And there is no standard that ties a given width to a given angle: 1.0 to 2.0 ms yields roughly 90 to 180 degrees depending on the servo, and two units of the same model can differ. Anything needing real accuracy gets calibrated against the actual servo, not against a table.\n\nPush the width past the ends and the servo keeps trying, grinding into its mechanical stop. That is one of the two easy ways to hold a servo at stall, which is exactly the condition this board is built to survive.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "The servo contract", "One class of servo, one hard supply ceiling, one connector order. Read these three as limits, because they are."),
  prose(
    "The board is sized for **micro servos up to the MG90S class**, meaning a worst-case stall around **0.9 A**. A standard-size servo like the MG996R stalls near **2.5 A** and sits outside this board's protection ratings. That is a documented limit, written down before you order rather than discovered after the fuse trips.\n\nThe supply ceiling is a real number too. The rail is **5.0 V nominal with a 4.5 to 5.5 V range and 5.5 V as an absolute maximum**, because F2 stands off 6 V and D3 stops conducting at 6.0 V. A 6 V adapter has no margin left in it.\n\nThe servo connector uses the standard order, **GND / V+ / SIG**, with power deliberately in the middle. Reverse a symmetric 3-pin plug and the two outer pins swap. With V+ centred, a flipped plug puts ground on the signal pin, which is harmless. Put V+ on the outside and a flipped plug would land 5 V on a 3.3 V logic pin.",
  ),
  table(
    ["The contract", "Number", "Why it is that number"],
    [
      ["Servo class", "Micro, up to MG90S, stall about 0.9 A", "F2's hold current and C8's sizing were proven against this worst case"],
      ["Supply range", "4.5 to 5.5 V regulated, at J4", "Below 4.5 V the servo gets weak; above 5.5 V the protection parts run out of standoff"],
      ["Absolute supply ceiling", "5.5 V", "F2 is rated 6 V maximum and D3 stands off 6.0 V. A 6 V adapter is out of spec"],
      ["Signal pin", "GPIO4, 3.3 V, through 470 Ω", "A plain GPIO with no strapping, USB or flash duty; the resistor bounds any fault current"],
      ["Connector order", "GND / V+ / SIG, pin 1 to pin 3", "V+ in the middle so a reversed plug swaps the harmless pair"],
      ["Power-up order", "USB first, or both together", "Section 06 walks why the servo supply should not come up alone"],
    ],
  ),
  shot(
    "The servo header up close: pin 1 GND, pin 2 V+, pin 3 SIG, with the silkscreen labels legible and a servo lead plugged in.",
    "Macro shot of J5 with a servo lead seated, silkscreen GND / V+ / SIG legible, and the J4 screw terminal with its + and - marks visible in the same frame.",
    "See it wired · the servo header",
  ),
  check(
    "**Your servo lead has brown, red and orange wires. Which one goes on pin 1?** Brown. On the common hobby colour scheme brown or black is ground, red is V+, and orange, yellow or white is signal. Pin 1 on this board is silkscreened GND, so brown lands there and the plug goes in the only way that matches.",
  ),
  gotcha(
    "a 6 V wall wart because it was in the drawer",
    "6 V reads close enough to 5.5 V until you check what the parts are rated for. F2's maximum working voltage is **6 VDC** and D3 begins conducting above **6.0 V**, so a 6 V supply removes the entire margin and leaves a clamp diode sitting on its knee getting warm. Use a regulated 5 V supply. If all you own is 6 V, that is a reason to buy a 5 V one, not a reason to try it.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The guard rails on the servo rail", "Three parts you do not have to fully understand today. Each one exists because of a specific mistake beginners make."),
  prose(
    "This is the most component-dense board in Level 1, and most of the extra parts are protection. You do not need to derive any of them today. You do need to know what each one is standing guard against, because that is what tells you whether the board is behaving.\n\nAll three sit on the servo rail. None of them is in the signal path, and none of them touches the logic side.",
  ),
  table(
    ["Ref", "Part", "The mistake it is standing guard against"],
    [
      ["F2", "1.5 A resettable PTC", "A short across the servo connector, or a servo jammed beyond what this board is rated for. Trips, then heals once you fix the fault"],
      ["D2", "Schottky diode across the rail", "Wiring the screw terminal backwards. It conducts on reverse polarity, holds the rail near -0.4 V, and forces F2 to trip"],
      ["D3", "6.0 V transient suppressor", "The voltage spikes a motor makes as it commutates and as it releases a stall. Clamps them below what C8 can take"],
      ["R7", "470 Ω in series with the signal", "A probe slip or a mis-wire shorting the signal pin to 5 V. Holds the fault current into the GPIO to a few milliamps"],
    ],
  ),
  check(
    "**You wire the screw terminal backwards, and the board's servo simply does nothing until you swap the wires and wait a moment. What happened?** D2 conducted, which clamped the rail near -0.4 V so the electrolytic capacitor and the servo were never exposed to reverse voltage, and the resulting current tripped F2. The PTC resets itself once it cools, which is why the board comes back rather than needing a new fuse.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  sect("06", "What L1.01 already taught you, still true here", "Two inherited rules, one new sequencing rule. All three cost nothing now and hurt later."),
  prose(
    "The [[ADC1]] rule carries over unchanged: [[ADC2]] is unusable while the radio runs, so anything you plan to read as an analog voltage lands on GPIO1 through GPIO10. The [[antenna keep-out]] carries over too, because U1 is the same module with the same printed antenna at the same end. The keep-out becomes a drawn rule area at layout.\n\nThe new rule is about sequencing. Bring the **USB logic rail up before or at the same time as the servo supply**. If the servo rail is live while the board's 3.3 V is dead, a servo whose signal input has an internal pull can push a small current back through J5 pin 3 and R7 into GPIO4's protection diode. R7 bounds that to about 9.5 mA at worst, and a real servo input is high impedance so the actual figure is far below it. It is still a state worth not living in. Plug the USB cable in first, or switch both on together.",
  ),
  tube("What a servo actually asks for, and why it gets its own rail"),

  // ── the note ──────────────────────────────────────────────────────────────
  band("do", "in your notes · Write the promises down", "Five short lines, in your own words. Nothing uploads and no gate waits on it, which is exactly why it works."),
  does("Your requirements note", [
    {
      text: "**RAIL:** the servo runs on an external regulated 4.5 to 5.5 V at J4, ceiling 5.5 V. Only ground is shared with the logic, so stall current never reaches the USB or regulator path.",
      proof: "Your note names the external rail, the 5.5 V ceiling, and the ground-only tie.",
    },
    {
      text: "**WHY IT MATTERS:** on a shared rail, 0.9 A of stall across 0.3 to 0.5 Ω of cable and connector sags the 5 V by 0.27 to 0.45 V, past the regulator's dropout, and the chip resets.",
      proof: "Your note carries the sag figure and names dropout as the thing it eats.",
    },
    {
      text: "**SIGNAL:** a 50 Hz pulse on GPIO4, about 20 ms apart, 1.0 to 2.0 ms wide, through a 470 Ω resistor to J5 pin 3. Width picks the angle.",
      proof: "Your note records the pin, the rate, the width range, and that width is the command.",
    },
    {
      text: "**CLASS:** micro servos up to the MG90S class, about 0.9 A stall. An MG996R-class servo is outside this board's ratings. Connector order is GND / V+ / SIG with V+ centred.",
      proof: "Your note states the supported servo class and the connector order.",
    },
    {
      text: "**ORDER:** USB up before or with the servo supply, so the signal pin never faces a live servo rail on a dead board.",
      proof: "Your note records the power-up order.",
    },
  ]),

  {
    type: "quiz",
    prompt: "Quick check: requirements",
    gate: true,
    questions: [
      {
        id: "brownout-mechanism", reviewId: "l104-brownout-mechanism",
        q: "On a shared rail, what exactly turns a servo stall into a microcontroller reset?",
        options: [
          "Motor noise corrupts the firmware in flash",
          "The stall current sagging across cable and connector resistance eats the regulator's headroom, so 3.3 V collapses",
          "The signal pin is overloaded by the servo's current",
        ],
        answer: 1,
        explain: "About 0.9 A across 0.3 to 0.5 Ω sags the regulator's input by 0.27 to 0.45 V, which is enough to push past its dropout and drop the 3.3 V rail.",
      },
      {
        id: "separate-rail", reviewId: "l104-separate-rail",
        q: "How does a separate servo rail make that brownout impossible rather than just less likely?",
        options: [
          "The servo's current loop closes through its own supply and ground, so the logic path carries no servo current at all",
          "A bigger capacitor on the USB input absorbs the stall",
          "The external supply limits the servo's stall current",
        ],
        answer: 0,
        explain: "It is a topology change. With zero servo amps on the USB and regulator path there is no sag mechanism left to size against, whatever servo you plug in.",
      },
      {
        id: "pwm-basics",
        q: "What does the servo actually read off its signal wire?",
        options: [
          "A voltage between 0 and 5 V proportional to the angle",
          "The width of the high pulse, repeating about every 20 ms",
          "A stream of digital commands on a data bus",
        ],
        answer: 1,
        explain: "The frame repeats at roughly 50 Hz and the high time carries the position: about 1.0 ms at one end, 1.5 ms in the middle, 2.0 ms at the other.",
      },
      {
        id: "v-plus-middle",
        q: "The servo header uses the order GND / V+ / SIG. Which mistake does putting V+ in the middle protect against?",
        options: [
          "Overtightening the screw terminal",
          "Static discharge through the servo lead",
          "A plug pushed on backwards: reversing swaps the outer pins, so power stays centred and never lands on the signal",
        ],
        answer: 2,
        explain: "Flip a symmetric 3-pin plug and pins 1 and 3 exchange places. With V+ centred, that swap puts ground on the signal pin instead of 5 V on it.",
      },
      {
        id: "servo-class",
        q: "Why is an MG996R-class servo explicitly out of scope for this board?",
        options: [
          "It uses a different connector",
          "Its stall current, around 2.5 A, is well past the protection this rail was sized for",
          "It needs a 12 V supply",
        ],
        answer: 1,
        explain: "The fuse, the bulk capacitor and the trace widths were all proven against a 0.9 A worst case. Beyond that the limit is stated rather than quietly hoped past.",
      },
      {
        id: "supply-ceiling",
        q: "A 6 V adapter is the only one in the drawer. Close enough to the 5.5 V ceiling?",
        options: [
          "Yes, 0.5 V of slack is built into the design",
          "Yes, as long as the servo is rated for 6 V",
          "No: the fuse is rated 6 V maximum and the transient clamp starts conducting at 6.0 V, so the margin is gone",
        ],
        answer: 2,
        explain: "The ceiling comes from component ratings. Use a regulated 5 V supply and the protection parts sit idle where they belong.",
      },
    ],
  },

  exit(
    "You have pinned the board's promises: a servo rail that shares only ground, the brownout argument with its numbers, a 50 Hz pulse whose width is the command, a stated servo class with a hard 5.5 V supply ceiling, and a power-up order. The quick check above is the gate. Next is the BOM, where you meet the four parts that make the servo rail behave.",
  ),

  ref("ESP32-S3 datasheet (Espressif): GPIO drive levels, brownout detector, and the ADC1 vs ADC2 split", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module pinout, GPIO4, and the antenna keep-out zone", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
  ref("LED Control (LEDC) API reference (Espressif, ESP-IDF, ESP32-S3): generating a 50 Hz PWM signal", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html"),
  ref("Pololu: servo control interface in detail, the 20 ms frame, the 1.0 to 2.0 ms range, and why width does not map to a standard angle", "https://www.pololu.com/blog/17/servo-control-interface-in-detail"),
  ref("TowerPro MG90S product specifications: operating voltage, stall torque, speed and dead band", "https://towerpro.com.tw/product/mg90s-3/"),
];

publishCard({ slug: "l1-04-single-servo", stage: "REQUIREMENTS", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
