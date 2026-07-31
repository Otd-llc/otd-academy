// L1.03 WS2812 node — BRINGUP card.
//
// Authored from docs/boards/l1-03-ws2812-node/design.md with L1.01's BRINGUP
// card as gospel: the stop-at-the-first-failure ladder, the sacrificial-charger
// rule for first power-on, the TP1-against-TP2 rail measurement at 3.3 V with
// 3.2 to 3.4 V acceptable, the full diagnostic tree off that one number,
// enumeration on the host, and the hold-BOOT-tap-EN-release-BOOT dance with the
// strapping-pin explanation behind it.
//
// The card this replaces was 12 blocks against L1.01's 32.
//
// NEW, and this card carries the board's two OWED bring-up items:
//   - F10-4. The cross-domain hop (onboard DOUT driving the strip's first DIN)
//     is an ENGINEERING ASSUMPTION, because the pixel's own datasheet does not
//     specify DOUT's output-high voltage. design.md assigns confirmation of
//     that residual to bring-up. The learner measures it.
//   - RK17. A shorted D2 fails SILENTLY: there is no rail LED on 5V_EXT, so the
//     symptom is a dead onboard pixel plus a dark strip WITH the supply
//     present. That symptom is in the troubleshooting table by name.
// Plus the power-up order (RK8), the firmware brightness cap and early blank
// (RK16), and the honest DMM-versus-scope point at TP3: a meter on an 800 kbps
// line reads an average, and that is expected rather than a fault.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Bring-up: rail, enumeration, the first pixel, and then the strip"),

  prose(
    "Bring-up is a ladder. Each rung proves one thing, and **you stop at the first rung that does not read what it should**, because every rung above it assumes the ones below are true. Debugging a board where three things are wrong at once is a different and much harder job than debugging one where you found the first fault immediately.\n\nThis board's ladder has eight rungs where L1.01 had five, and the extra ones are the point of the lesson: **the onboard pixel lights on USB alone**, and only then does a strip and its own supply join in.",
  ),
  table(
    ["Rung", "What it proves", "If it fails"],
    [
      ["1", "No shorts on either 5 V domain", "Stop. Find it with the meter before any power"],
      ["2", "3.3 V at TP1", "Stop. The number tells you where the fault is"],
      ["3", "LED1 lit", "The LED or its resistor, not the rail"],
      ["4", "The board enumerates on your host", "USB data path or the connector"],
      ["5", "LED2 blinks after flashing", "Toolchain and GPIO, both now proven"],
      ["6", "The onboard pixel obeys", "This is the graded rung. The shifter, GPIO5 and your timing"],
      ["7", "The shifted line reads about 4.4 V at TP3", "The measurement that closes the lesson's claim"],
      ["8", "A strip runs from J4 on its own supply", "The capability layer, and the second supply"],
    ],
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("check", "No shorts before power", "Verify. Two domains now, so two things to rule out."),
  sect("01", "Before power: hunt for shorts", "Repeat the assembly gates, because rework happens between stages."),
  prose(
    "You ran these at assembly. Run them again, because boards get handled and reworked between stages, and a strand of wire that arrived on your bench yesterday costs nothing to find now.\n\nMeter in continuity mode, board unpowered, nothing plugged in.",
  ),
  does("three silences and one beep", [
    {
      text: "**VBUS to ground: no beep.** Red on the VBUS point (U2's input pad or its input capacitor), black on **TP2**. Expect **OL**. A short here destroys the board the instant USB is plugged in.",
      proof: "The meter reads OL between VBUS and ground.",
    },
    {
      text: "**J5's 5 V to the board's 5 V: no beep.** This is the isolation invariant. Expect **OL**.",
      proof: "The meter reads OL between J5's 5 V position and the board's own 5 V rail.",
    },
    {
      text: "**J5's 5 V to ground: no beep.** A short here means your strip supply would be feeding a dead short the moment you switch it on, and there is no fuse on that rail to save you.",
      proof: "The meter reads OL between J5's 5 V position and ground.",
    },
    {
      text: "**J5's ground to TP2: it must beep.** The two supplies have to share a reference or the strip cannot read your data line. This is the one check where silence is the failure.",
      proof: "The meter beeps between J5's ground position and TP2.",
    },
  ]),
  gotcha(
    "first power-on wants a charger, not your laptop",
    "If a solder bridge has put 5 V onto **D+ or D-**, the continuity checks stay silent, but plugging into your computer would push 5 V straight into the host's USB data pins, which expect 3.3 V, and can kill the port. So for the **very first power-up**, use a cheap USB wall charger or a hub you do not care about. If the 3.3 V rail and the power LED come up clean on the sacrificial source, *then* move to the computer. Power first, data second.",
  ),
  check(
    "**Your meter beeps between VBUS and ground before power-on. Power it anyway to see what happens?** Never. That is a dead short, and it destroys the board the instant USB is plugged in. Find and clear it first.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Power it and measure the rail", "Hands on. Trust the 3.3 V rail only after you have measured it."),
  sect("02", "Rails first", "One number, and it tells you where the fault is."),
  prose(
    "Power the board over USB from your sacrificial source. With the meter set to DC volts, measure the rail at the test points: **red on TP1 (3V3), black on TP2 (GND)**. Confirm it reads **3.3 V**, where anything from **3.2 to 3.4 V** is fine, before assuming anything downstream is alive. The red power LED should light.",
  ),
  table(
    ["TP1 reads…", "What it means", "What to do"],
    [
      ["About 3.3 V", "The regulator is regulating", "Move on to enumeration"],
      ["About 4.9 V", "The regulator is passing its input straight through", "Stop. Do not connect 3.3 V parts. Recheck U2's orientation, joints and enable"],
      ["0 V", "No power reaching it, or something dragging it down", "Look for a broken joint upstream, or a short"],
      ["About 3.3 V, LED1 dark", "The rail is fine", "Check LED1's polarity and R5"],
    ],
  ),
  shot(
    "Probing the rail: red on TP1, black on TP2, expecting 3.3 V.",
    "Multimeter on the powered board, red probe on TP1 and black on TP2, display reading about 3.30 V. Crop to board and meter screen.",
  ),
  check(
    "**The board powers but TP1 reads 4.9 V, not 3.3. What failed?** Most likely the [[LDO]]. Its output is sitting at its input voltage, so it is mis-soldered, mis-oriented, or its enable is not asserted. Stop before you connect 3.3 V logic to a 5 V rail.",
  ),
  dive(
    "What else to measure while the meter is out",
    "This board puts loads on the 5 V rail for the first time, so the number at TP1 is no longer the only one worth knowing.\n\n**Measure the 5 V rail too**, at C11 or at U3's supply pin, with the black lead still on TP2. Expect somewhere close to 5 V, and note that USB sags under load: a long or thin cable can bring it down noticeably. That matters here because the buffer's output high, and therefore your data level, rides that rail. A 5 V rail sitting at 4.6 V is not a fault, but it is a smaller margin than the design assumed, and it is worth knowing before you spend an hour blaming firmware.\n\nThe regulator also needs its input comfortably above 3.3 V plus its dropout, so a sagging cable can starve it. Measure the input whenever the output looks low, and swap the cable before you swap a part.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Enumerate and flash", "Hands on. Make the chip talk, then put code on it."),
  sect("03", "USB enumeration and first flash", "The button dance, and why it works."),
  prose(
    "Plug USB into your computer now that the rail is proven. The native-USB S3 should show up as a device on the host: a new **ESP32-S3 USB JTAG/serial** entry in Device Manager, or in `lsusb` or `dmesg`.\n\nTo load firmware, use the two buttons: **hold BOOT, tap EN to reset, then release BOOT**. That drops the chip into USB download mode and it will accept a flash. Afterwards, a blink on **LED2** proves your toolchain, the [[GPIO]] path and the board all work together.",
  ),
  does("enumerate, flash, blink", [
    {
      text: "Plug the board into your computer and confirm a new device appears on the host.",
      proof: "The board enumerates as an ESP32-S3 USB serial device.",
    },
    {
      text: "**Hold BOOT, tap EN, release BOOT.** Holding BOOT pulls GPIO0 low; tapping EN resets the chip so it re-reads that pin; releasing after is fine, because the level is only sampled at the instant of reset.",
      proof: "The chip is in USB download mode and the flashing tool sees it.",
    },
    {
      text: "Flash a blink firmware and watch **LED2**. A blink proves the toolchain, the GPIO and the USB path in one observation.",
      proof: "LED2 blinks after flashing.",
    },
  ]),
  shot(
    "What enumeration looks like: the S3 shows up on the host as a USB serial device.",
    "Host screen, Device Manager or lsusb output, the moment the board is plugged in. Highlight the new ESP32-S3 USB JTAG serial entry. Crop tight to the device list.",
  ),
  dive(
    "Strapping pins: why holding BOOT picks download mode",
    "At the instant the chip comes out of reset it samples its [[strapping pin|strapping pins]] to decide how to start, and then they go back to being ordinary [[GPIO]]. On the ESP32-S3, GPIO0 is the one that matters here: sampled **high**, which is its resting default thanks to R2, the chip boots your firmware. Sampled **low**, it drops into USB download mode.\n\nThat is the entire button dance. Hold BOOT to force GPIO0 low, tap EN to reset the chip so it re-reads the strap, then release BOOT. Because the level is only read at that one instant, letting go straight after is fine.\n\nIt is also why you never hang a heavy load on GPIO0. Pull it the wrong way at power-up and the chip starts in the wrong mode every time, which presents as a board that will not run its own firmware.",
  ),
  check(
    "**The board powers fine but will not enter flash mode. The button move?** Hold BOOT to pull GPIO0 low, pulse EN to reset, then release BOOT. Sampling GPIO0 low at reset is what selects USB download.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Light the first pixel", "Hands on. This is the rung the lesson is graded on."),
  sect("04", "The first pixel", "One cable, one pixel, and the thing you have been building toward."),
  prose(
    "Nothing is plugged into either terminal. The board is running on the USB cable alone. Flash firmware that drives **GPIO5** with WS2812 data and watch **LED3**.\n\nThe ESP32 does not bit-bang this by hand. A hardware peripheral clocks the waveform out for you, which is what holds the sub-microsecond timing while the rest of your program carries on. Any of the common libraries will do it, and what matters is three settings.\n\n**The data pin is GPIO5.** **The pixel count is one**, for now. And **cap the brightness low**, somewhere around a fifth of maximum, for two reasons: a 5050 pixel at full white is genuinely unpleasant to look at from 30 cm, and a lower cap keeps the current draw modest while you are still proving the board.\n\nOne more firmware habit worth adopting now: **blank the pixel at the start of your program**, before anything else. On reset, GPIO5 is briefly in an undefined state, and a pixel that latched garbage will sit there displaying it. Writing black first makes every run start from a known state.",
  ),
  does("light it", [
    {
      text: "Flash firmware driving **one** WS2812 on **GPIO5**, with the brightness capped low.",
      proof: "The firmware flashed and reports no errors on the serial monitor.",
    },
    {
      text: "**Blank first, then set a colour.** Write black to the pixel at start-up, wait a moment, then write a clearly recognisable colour such as pure green.",
      proof: "LED3 lights the colour you asked for.",
    },
    {
      text: "**Check the colour is the one you asked for.** These parts take their data in **green, red, blue** order rather than the red, green, blue you might expect. If you asked for red and got green, your library's colour order is set wrong and nothing is broken.",
      proof: "The colour on the board matches the colour in your code.",
    },
    {
      text: "**Cycle it.** Have the firmware step through a few colours a second apart. A pixel that shows one colour could be luck; a pixel that follows a sequence is receiving data.",
      proof: "LED3 steps through the colour sequence in your code.",
    },
  ]),
  shot(
    "The graded moment: one cable, one lit pixel, both terminals empty.",
    "Close-up of the board with only a USB cable attached and LED3 lit a saturated colour, screw terminals visibly empty. Shallow depth of field with the pixel in focus.",
    "See it wired · the first pixel lights",
  ),
  tube("Flash the first-pixel firmware and watch the level shifter work"),
  check(
    "**Your pixel lights, but you asked for red and got green.** Nothing is broken. These parts take their 24 bits in green, red, blue order, so a library configured for RGB sends your colours to the wrong channels. Set the colour order and the same code works.",
  ),
  gotcha(
    "a pixel that lights on the first try still deserves the measurement",
    "A working pixel proves the chain end to end, and it does not prove your margin. A bare 3.3 V GPIO drives many of these parts perfectly well on a warm bench, which is the entire reason this board exists. So the next rung is not optional decoration: **measure the shifted line** and see the margin you designed rather than inferring it from a light being on.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "Measure the thing the lesson claims", "TP3 exists so you can stop taking our word for it."),
  prose(
    "**TP3 sits on the shifted data line**, between the buffer's output and the pixel. Everything this lesson has argued comes down to what is on that node, so go and look at it.\n\n**With a scope**, run the pixel firmware and trigger on that line. You should see a train of pulses reaching roughly **4.4 V**, against a bar of 3.5 V that the pixel needs. Put a second probe on GPIO5 and you see the input at 3.3 V beside it: the two traces together are the whole lesson in one screenshot.\n\n**With only a multimeter**, expect a low, jumpy number, and understand why before you panic. A meter set to DC volts reports an average. The data line spends most of its time low, so a line whose peaks reach 4.4 V averages out to well under a volt. **That reading is correct and expected.** It tells you the line is switching. It cannot tell you how high the peaks go, which is exactly the thing you wanted to know, and it is the honest reason a scope earns its place on a bench.",
  ),
  table(
    ["Instrument", "What you see at TP3", "What it proves"],
    [
      ["Oscilloscope", "Pulse train reaching about 4.4 V", "The margin, directly. This is the measurement"],
      ["Multimeter, DC volts", "A low, unsteady average", "The line is switching. Nothing about the peaks"],
      ["Multimeter, board idle", "Steady low", "Nothing is driving. Check the firmware is running"],
    ],
  ),
  shot(
    "The lesson in one screenshot: GPIO5 at 3.3 V and TP3 at about 4.4 V, same timebase.",
    "Two-channel scope capture. Ch1 on GPIO5 showing a 3.3 V high, Ch2 on TP3 showing about 4.4 V, cursors on both levels, roughly 1 us per division.",
    "See it wired · the level shift, measured",
  ),
  check(
    "**Your meter reads 0.4 V at TP3 while the pixel is happily cycling colours. Is the shifter failing?** No. A meter reports an average and the data line sits low most of the time, so a low average is exactly what a working line looks like. Only a scope shows you the peak, which is the number the whole design turns on.",
  ),
  dive(
    "The measurement this board's own design still owes",
    "There is a second measurement worth taking, and it is genuinely open rather than a teaching exercise. This board's design review closed almost everything, and left one number to be confirmed on real hardware.\n\nThe first hop, buffer to onboard pixel, has margin that is written down and guaranteed by the buffer's datasheet, because the driver and the receiver sit on the same rail. **The second hop does not.** When the onboard pixel drives an external strip, the driver is the pixel's own output and the receiver is the strip's first input, and those two run on **different supplies**: yours from USB, theirs from the injection terminal. The margin between them therefore does not track, and worse, **the pixel's own datasheet never specifies how hard its output drives**. The design's estimate is an engineering assumption rather than a quoted figure.\n\nSo when you get to the strip, if you have a scope, measure two things: the **high level at the onboard pixel's output** and the **high level arriving at the strip's first input**. Compare that second number against 0.7 of your strip's supply. It should clear. Writing down what it actually was is the sort of thing that turns a design assumption into a fact, and it is the measurement this board has been waiting for.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Add the strip", "Hands on. Two supplies now, and the order is the rule."),
  sect("06", "Adding the strip, in the right order", "The capability layer, and the habit that keeps it safe."),
  prose(
    "The graded lesson is done. What follows is the capability layer, and it introduces the one habit this board asks you to keep: **the strip's supply goes on before or with USB, and USB comes off first.**\n\nThe reason is small but real. If the board runs while the strip's supply is off, your pixel's output is driving data into an input whose chip has no power. R8 bounds that to a few milliamps and the diodes back it up, so nothing dies, but it is outside how the part is specified to be used and there is no reason to do it.\n\nWire the strip with everything off. **J4's three positions are 5 V, data and ground**, in the order the silkscreen names them. The strip's ground goes to J4's ground, and its 5 V goes to J4's 5 V, which is the rail your external supply feeds through J5.",
  ),
  does("bring up the strip", [
    {
      text: "**Everything off.** Unplug USB and switch off the strip supply before touching either terminal.",
      proof: "Both supplies are off and nothing is plugged in.",
    },
    {
      text: "**Wire the strip to J4**, matching 5 V, data and ground to the silkscreen. Strip the leads cleanly and check no stray strand bridges two positions, because there is no fuse on this rail.",
      proof: "The strip is screwed into J4 with no stray strands between positions.",
    },
    {
      text: "**Wire your supply to J5**, matching polarity to the silkscreen. Set it to **5 V** and, if it has a current limit, set that to a little above what your pixel count needs at the brightness you are using.",
      proof: "The supply is wired to J5 with correct polarity and set to 5 V.",
    },
    {
      text: "**Strip supply on first.** Nothing should light: no data is being sent yet. If anything lights or the supply's current reading jumps, switch off immediately and find out why.",
      proof: "The supply is on, the current reading is near zero, and nothing lit unexpectedly.",
    },
    {
      text: "**Then USB.** Update the firmware's pixel count to one plus the number on your strip, reflash, and watch the chain run.",
      proof: "The onboard pixel and the strip run as one chain.",
    },
    {
      text: "**To shut down, reverse it: USB off first, then the strip supply.**",
      proof: "You powered down USB first and the strip supply second.",
    },
  ]),
  shot(
    "The chain running: the onboard pixel as number zero, the strip continuing it.",
    "The board with a short WS2812 strip wired into J4 and a bench supply on J5, all pixels lit in a running pattern, the onboard pixel visibly part of the same sequence.",
    "See it wired · the full chain",
  ),
  tube("Wire the strip, power it in the right order, and run the whole chain"),
  check(
    "**You plug in USB first, with the strip supply still off. What is happening at the strip's first pixel?** Your board is driving data into an input whose chip has no power. R8 limits the current to a few milliamps and the diodes bound it, so nothing dies, but it is outside the part's specification. Strip supply first, every time.",
  ),
  gotcha(
    "the far end of a long strip goes red and flickers",
    "That is not a data problem and no amount of firmware will fix it. It is the supply sagging along the strip's own thin power rails, and red is simply the colour whose die needs the least voltage, so it is the last one still lighting when everything else has given up. The fix is power injection: run a second pair of wires from your supply directly to the far end of the strip, or to its middle, so the current does not have to travel the whole length through the strip's own copper.",
  ),

  // ── 07 ────────────────────────────────────────────────────────────────────
  sect("07", "When it does not work", "Symptoms, in the order they are worth checking."),
  table(
    ["Symptom", "Most likely cause", "Check"],
    [
      ["Nothing at all, TP1 at 0 V", "No power reaching the regulator, or a short", "The continuity gates, then joints upstream of U2"],
      ["TP1 at 4.9 V", "U2 not regulating", "U2's orientation, joints and enable pin"],
      ["Board enumerates, LED2 blinks, pixel dark", "The shifter's enable, or the data path", "Is 1OE on GND? Is TP3 switching at all?"],
      ["Pixel dark, TP3 steady low", "GPIO5 is not being driven", "Firmware pin number, and the IO5 net from module to U3"],
      ["Pixel dark, TP3 switching normally", "The pixel itself, or DIN and DOUT swapped", "R7 must land on pin 4, not pin 2. Then suspect the joint"],
      ["Pixel shows the wrong colour", "Colour order", "Set the library to green, red, blue. Nothing is broken"],
      ["Pixel flickers or shows garbage", "Timing, or a reset gap that is too short", "Let the library drive it, and leave a clear gap between frames"],
      ["Onboard pixel dark AND strip dark, with the supply on", "A shorted TVS on the external rail", "See the note below. This one fails silently"],
      ["Strip's far end red and flickering", "Supply sagging along the strip", "Inject power at the far end or the middle"],
    ],
  ),
  {
    type: "callout", severity: "warn", label: "The failure with no warning light",
    body: "There is no indicator LED on the external 5 V rail, which means **a failed TVS on that rail is invisible**. If D2 has been stressed, by a wrong supply or a transient, it can fail short, and then the injection rail is held near ground the moment you switch the supply on. The board looks dead, the strip looks dead, and nothing on the board tells you why. The tell is the combination: **the onboard pixel dark and the strip dark while your supply is definitely on and its current limit is pegged.** Switch off, meter J5's 5 V against ground with everything unpowered, and if it beeps with no strip attached, D2 is your suspect. This is a documented, accepted limitation of the design rather than a defect: the trade was made deliberately and written down, and knowing the symptom is what makes it survivable.",
  },
  trace("Before you call it working", [
    { text: "The onboard pixel obeys a **sequence**, not just one colour", help: "One colour could be luck or a latched value. A sequence proves data is arriving continuously." },
    { text: "**TP3 reaches about 4.4 V** on a scope, against the 3.5 V the pixel needs", help: "This is the measurement the whole lesson exists for. A lit pixel alone does not prove margin." },
    { text: "The colour you asked for is the colour you got", help: "Green, red, blue order. A mismatch here is a library setting, not a fault." },
    { text: "You powered up **strip supply first, USB second**, and down in reverse", help: "The habit is the primary control. The series resistor is only the backstop." },
    { text: "Nothing gets warm that should not", help: "Run it for a few minutes and touch the regulator, the buffer and the terminals. Warm is normal, hot is a question." },
  ]),

  {
    type: "quiz",
    prompt: "Quick check: bring-up",
    gate: true,
    questions: [
      {
        id: "meter-reads-average", reviewId: "l103-meter-average",
        q: "Your meter reads 0.4 V at TP3 while the pixel cycles colours happily. What does that tell you?",
        options: [
          "The shifter is failing and the pixel is running on luck",
          "The line is switching. A meter reports an average and the data line sits low most of the time, so only a scope shows the peak",
          "The firmware is sending the wrong data",
        ],
        answer: 1,
        explain: "A low average is exactly what a working 800 kbit per second data line looks like on a DC voltmeter. The peak is the number the design turns on, and a scope is what shows it.",
      },
      {
        id: "lit-is-not-margin", reviewId: "l103-lit-not-margin",
        q: "Your pixel lights on the first try. Why measure the shifted line anyway?",
        options: [
          "To confirm the firmware is correct",
          "It is not necessary once the pixel works",
          "Because a bare 3.3 V GPIO drives many of these parts fine on a warm bench, which is the exact failure this board exists to prevent",
        ],
        answer: 2,
        explain: "A lit pixel proves the chain end to end. It says nothing about how much margin you have, and marginal is what fails later on someone else's bench.",
      },
      {
        id: "power-order",
        q: "What is the power-up order once a strip is attached?",
        options: [
          "Strip supply before or with USB, and USB comes off first",
          "USB first, always",
          "Order does not matter once both are connected",
        ],
        answer: 0,
        explain: "USB-only with a dead strip means your data line is driving an unpowered input. The series resistor bounds it; the habit prevents it.",
      },
      {
        id: "silent-tvs-failure", reviewId: "l103-silent-tvs",
        q: "Your supply is on and current-limiting hard, and both the onboard pixel and the strip are dark. What is worth suspecting?",
        options: [
          "The firmware crashed",
          "A shorted TVS on the external rail, which fails with no warning light because that rail has no indicator LED",
          "The USB cable",
        ],
        answer: 1,
        explain: "Meter J5's 5 V against ground with everything unpowered and no strip attached. A beep points at D2. The design documents this as an accepted limitation rather than hiding it.",
      },
      {
        id: "wrong-colour",
        q: "You ask for red and the pixel shows green. What is wrong?",
        options: [
          "The pixel is damaged",
          "The level shifter is inverting the signal",
          "Nothing. These parts take their data in green, red, blue order, so your library's colour order is set wrong",
        ],
        answer: 2,
        explain: "It is a one-line configuration change. Worth knowing, because it looks alarming and costs people an evening.",
      },
      {
        id: "download-mode",
        q: "The board powers fine but will not enter flash mode. The button move?",
        options: [
          "Hold BOOT, tap EN to reset, then release BOOT",
          "Hold EN, tap BOOT, then release EN",
          "Hold both and release together",
        ],
        answer: 0,
        explain: "Holding BOOT pulls GPIO0 low, and the chip samples that pin at the instant EN resets it. Low at that moment selects USB download.",
      },
      {
        id: "far-end-red",
        q: "The far end of a long strip turns red and flickers. What is happening?",
        options: [
          "The data signal is degrading along the strip",
          "The supply is sagging along the strip's own power rails, and red is the colour whose die needs the least voltage",
          "The pixels at that end are faulty",
        ],
        answer: 1,
        explain: "No amount of firmware fixes it. Inject power at the far end or the middle so the current does not travel the whole length through thin copper.",
      },
    ],
  },

  band("check", "What success looks like", "Verify. Eight rungs, and the one measurement that makes the claim yours rather than ours."),
  exit(
    "The board powers, enumerates, flashes, and the onboard pixel obeys on one USB cable. TP3 reads about 4.4 V against a bar of 3.5 V, so the margin is measured rather than assumed. A strip runs from J4 on its own supply, with grounds shared and 5 V rails apart. If you took the second measurement, at the onboard pixel's output and the strip's first input, write the numbers down: that hop's margin is the one figure this board's design left open, and you are the person holding the instrument.",
  ),

  ref("ESP-IDF Programming Guide (Espressif): flashing the ESP32-S3 over native USB and the strapping-pin boot modes", "https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/"),
  ref("esptool (Espressif): the tool that writes firmware to the ESP32-S3 flash", "https://docs.espressif.com/projects/esptool/en/latest/esp32s3/"),
  ref("WS2812B datasheet (Worldsemi): the green, red, blue data order, the bit timing and the reset code", "https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf"),
  ref("SNx4AHCT125 datasheet (Texas Instruments, SCLS264R): the guaranteed output-high level you are measuring at TP3", "https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf"),
  ref("Adafruit NeoPixel Uberguide: colour order, power injection and troubleshooting a chain", "https://learn.adafruit.com/adafruit-neopixel-uberguide"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "BRINGUP", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
