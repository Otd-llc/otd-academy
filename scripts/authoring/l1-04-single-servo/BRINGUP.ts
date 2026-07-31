// L1.04 single-servo driver — BRINGUP card.
//
// L1.01's BRINGUP card is gospel for the ladder and every number in it: the
// pre-power continuity check, the sacrificial-charger rule for first power-on,
// TP1 reading 3.2 to 3.4 V with the 4.9 V and 0 V diagnoses, enumeration, the
// hold-BOOT / tap-EN / release-BOOT dance, and the five proofs.
//
// This board runs that ladder first, on USB alone, and then adds a second
// ladder for the servo rail. The finale is the stall demo: hold the horn
// against a commanded move, forcing the 0.9 A worst case, and watch a serial
// heartbeat stay unbroken. That is the board's thesis, demonstrated rather
// than asserted.
//
// The power-up order is RK12 (design.md K15): bring the USB logic rail up
// before or with the servo supply, so the servo's SIG input can never
// back-feed ~9.5 mA through R7 into GPIO4's clamp on a dead 3V3 rail.
//
// The servo-signal caveat is RK11 / K13: hobby servos publish no input
// threshold, so 3.3 V drive is commonly reliable but not spec-guaranteed, and
// the documented fix is a buffer powered from VSERVO.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Bring-up: the stall that does not reboot anything"),

  prose(
    "Bring-up is where the board either comes alive or teaches you something. Do it in order, no shorts, then the logic rail, then the chip, then the servo rail, then the servo, and let your multimeter rather than optimism tell you each step is safe.\n\nThe finale is a deliberate failure. You will command the servo to a position, pinch the horn and hold it against the move, forcing the worst-case current the board was designed around, while the processor streams a heartbeat over USB without missing a line. That demonstration is the entire point of this lesson: a mechanical fault, absorbed by topology.",
  ),
  {
    type: "image", src: "/guide-diagrams/bringup-ladder.svg",
    alt: "Diagram: bring-up steps as a ladder, with a stop-and-fix rule if any step fails.",
    caption: "Bring-up is a ladder. You climb it in order and you stop the moment a rung fails.",
  },

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("check", "No shorts before power", "Verify. Prove the board is safe to power before you plug anything in."),
  sect("01", "Before power: the two sweeps", "The safest power-on is one you have already de-risked with a meter."),
  prose(
    "With no power applied, repeat the two sweeps from assembly. Between **VBUS and GND** there must be **no beep**: a short there turns the first power-up into the last. Between **VSERVO and VBUS** there must also be no beep: that one proves the two rails are still two rails.\n\nConfirm the grounds are common while you are here. Probe J5 pin 1 against TP2, and this one **should** beep. Ground is the single thing the two rails share, by design.",
  ),
  {
    type: "image", src: "/guide-diagrams/continuity-vbus-gnd.svg",
    alt: "Meter in continuity mode, red probe on the VBUS point, black probe on TP2, display reading OL with no beep.",
    caption: "The pre-power check: VBUS to GND must not beep.",
  },
  check(
    "**Why check VBUS-to-GND continuity before plugging in USB?** A short there turns the first power-up into the last. The meter finds it while it is still harmless and free to fix.",
  ),
  gotcha(
    "first power-on wants a charger, not your laptop",
    "The continuity check proved there is no short between VBUS and GND. It says **nothing about the data lines**. If a stray bridge tied VBUS to D+ or D-, the sweep stays silent, and plugging into your computer would push 5 V into the host's USB data pins, which expect 3.3 V, and can kill the port. For the **very first** power-up use a cheap USB wall charger or a hub you do not care about. If the rail and the power LED come up clean, then move to the computer. Power first, data second.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · The logic ladder, on USB alone", "Hands on. The whole L1.01 ladder, before the servo enters the story."),
  sect("02", "Rails first, then the chip", "Everything you already know how to do, and the servo supply stays in the box until it passes."),
  prose(
    "Power the board over USB only. The servo supply stays disconnected and the servo stays unplugged. There is a real reason beyond tidiness: if something is wrong you want the smallest possible set of suspects, and a board that has never had a second rail connected cannot have a second-rail fault.\n\nWith your meter on DC volts, measure at the test points: **3.3 V at TP1** (red), ground at TP2 (black). Anything from **3.2 to 3.4 V** is fine. The red power LED should light. Then plug into a host and confirm the board enumerates, flash a test blink, and watch LED2.",
  ),
  {
    type: "table",
    columns: ["TP1 reads…", "Likely cause", "What to do"],
    rows: [
      [{ text: "about 3.3 V", tone: "gold", decoration: "badge" }, { text: "The LDO is regulating" }, { text: "Healthy. Move on to enumeration" }],
      [{ text: "about 4.9 V", tone: "critical", decoration: "badge" }, { text: "The LDO is passing its input straight through: backwards, mis-soldered, or EN not high" }, { text: "Stop. Do not connect 3.3 V parts to that rail. Recheck U2" }],
      [{ text: "0 V", tone: "critical", decoration: "badge" }, { text: "No power reaching it, or a short dragging it down" }, { text: "Check the USB power chain, then hunt for a short" }],
      [{ text: "about 3.3 V, LED1 dark", tone: "blue", decoration: "badge" }, { text: "The LED or its resistor, not the rail" }, { text: "Check LED1's polarity and R5" }],
    ],
  },
  does("climb the logic ladder", [
    {
      text: "**Power from a sacrificial charger**, not your laptop. Meter TP1 against TP2 in DC volts and confirm **3.2 to 3.4 V**.",
      proof: "TP1 reads between 3.2 and 3.4 V against TP2.",
    },
    {
      text: "**LED1 should be lit.** It runs straight off the 3V3 rail through R5, so it comes on the moment the rail is up.",
      proof: "LED1 is lit.",
    },
    {
      text: "**Move to the computer and check it enumerates.** A new USB serial device should appear. If not, swap to a known-good **data** cable first, because charge-only cables are the usual culprit, then recheck the D+ and D- joints.",
      proof: "A new USB serial device appears on the host when the board is plugged in.",
    },
    {
      text: "**Flash a test blink** using the button dance: hold **BOOT**, tap **EN** to reset, then release **BOOT** to drop into USB download mode. LED2 blinking afterwards proves the GPIO, your toolchain, and the whole chain end to end.",
      proof: "LED2 blinks after flashing.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "Probing 3.3 V at TP1 with the meter's black lead on TP2, on a powered board with the power LED lit.",
    caption: "The rail check: red on TP1, black on TP2, reading about 3.3 V.",
    captureHint: "Bench: red probe on TP1, black on TP2, multimeter reading about 3.30 V on a powered board with the power LED lit. Meter in DC-V mode.",
  },
  check(
    "**The board powers but TP1 reads 4.9 V rather than 3.3 V. What failed?** The regulator is not regulating: its output is sitting at its input, so it is mis-soldered, backwards, or its enable is not asserted. Stop before you connect 3.3 V logic to 5 V.",
  ),
  dive(
    "Why the logic ladder runs alone first",
    "Every rung of this ladder was already true on L1.01, and you could reasonably ask why it is worth repeating on a board whose interesting part is elsewhere.\n\nThe answer is about diagnosis rather than about the rungs. This board has two power sources, and a fault with two possible causes takes far more than twice as long to find as a fault with one. Running the logic ladder to completion on USB alone partitions the problem: everything the ladder proves is now known-good, so anything that goes wrong after the servo supply arrives has a much smaller set of suspects.\n\nIt also matches the power-up order the design asks for anyway, which section 03 covers. So you get the discipline for free.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Bring up the servo rail", "Hands on. Order matters here, and it is USB first."),
  sect("03", "The servo rail, in the right order", "USB up before or with the servo supply, every time, and there is a reason."),
  prose(
    "With the logic ladder passing and USB still connected, bring up the second rail.\n\n**The order is not arbitrary.** If the servo supply is live while the board's 3.3 V is dead, a servo whose signal input has an internal pull can push current back through J5 pin 3 and R7 into GPIO4's protection diode, partially biasing a rail that is supposed to be off. R7 bounds that to about **9.5 mA** at worst and a real servo input is high impedance, so the actual figure is far smaller. It is still a state worth never being in, and the habit costs nothing.\n\nWire the screw terminal with the power off, check the polarity against the silkscreen, then switch on.",
  ),
  does("bring up VSERVO", [
    {
      text: "**With the supply switched off**, wire it into J4: positive to the pin marked **+**, negative to the pin marked **-**. Check the silkscreen rather than your memory. Use stranded wire and tighten the screws firmly.",
      proof: "The supply's positive wire is in the pin marked + and the negative in the pin marked -, both screws tight.",
    },
    {
      text: "**USB is already connected and the board is running.** Now switch the servo supply on. If your supply has an adjustable current limit, set it to about **1.5 A** first: enough for a stall plus inrush, low enough that a mistake is boring.",
      proof: "USB was live before the servo supply was switched on.",
    },
    {
      text: "**Meter VSERVO at C8's positive lead** against TP2. Expect the supply's voltage, around **5 V**. If it reads 0 V, F2 has tripped or the supply is not delivering.",
      proof: "VSERVO reads about 5 V at C8 against TP2.",
    },
    {
      text: "**Check nothing on the logic side moved.** TP1 should still read 3.2 to 3.4 V and LED1 should still be lit. Adding the second rail should have changed nothing at all on the first one.",
      proof: "TP1 still reads 3.2 to 3.4 V with the servo rail live.",
    },
    {
      text: "**Now plug the servo into J5**, matching its lead to the GND / V+ / SIG silk. On the common colour scheme brown or black is ground, red is V+, and orange, yellow or white is signal.",
      proof: "The servo is seated on J5 with its ground wire on pin 1.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "The servo supply wired into the screw terminal and metered at the bulk capacitor, with the servo plugged into the 3-pin header.",
    caption: "Second rail up: about 5 V at C8, the logic rail unchanged, the servo seated in the right order.",
    captureHint: "Bench: supply wired to J4 with polarity visible, meter probing C8's positive lead against TP2 reading about 5 V, servo plugged into J5. Meter display legible.",
    reveal: "See it wired · the servo rail live",
  },
  check(
    "**Why bring the USB rail up before the servo supply?** Because a servo's signal input can source a small current back through R7 into the microcontroller's protection diode when the 3.3 V rail is dead. R7 keeps it to about 9.5 mA at worst, so nothing breaks, but it is a state with no upside and the habit costs nothing.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Make it move", "Hands on. A sweep first, then the demonstration this board exists for."),
  sect("04", "The sweep", "Fifty hertz, one to two milliseconds, and a horn that goes where you tell it."),
  prose(
    "Flash the sweep firmware. It drives **GPIO4** at **50 Hz** and walks the pulse width across the servo's range, roughly **1.0 to 2.0 ms**, so the horn tracks smoothly from one end to the other and back.\n\nWatch two things. The **horn** should follow the commanded angle without hunting or buzzing at rest. The **supply's current display**, if it has one, should sit at tens of milliamps while the servo holds still and rise to a couple of hundred while it moves.",
  ),
  does("run the sweep", [
    {
      text: "Flash the sweep firmware and watch the horn. It should move smoothly across its range and stop cleanly at each end.",
      proof: "The servo follows commanded angles smoothly across its range.",
    },
    {
      text: "**Read the idle current.** Holding a position with no load should be tens of milliamps. Moving with no load should be roughly 100 to 200 mA.",
      proof: "Idle current reads tens of milliamps and moving current reads a couple of hundred.",
    },
    {
      text: "**Scope the signal if you have one**, at the IO4 header position or at J5 pin 3. You should see a pulse about 20 ms apart whose high time changes as the sweep runs.",
      proof: "The scope shows a 20 ms frame with a high time between about 1.0 and 2.0 ms.",
    },
  ]),
  tube("Flash the sweep and watch the horn track"),
  gotcha(
    "a servo that twitches instead of tracking",
    "If the horn buzzes, hunts, or refuses to move while the pulse looks correct on a scope, suspect the **signal threshold** before you suspect the board. Hobby servos publish no input-threshold specification at all, and some units want a logic high above 3.3 V. The kit names a servo that reads 3.3 V reliably; a random servo from a drawer may not. The documented fix is a logic buffer powered from the servo rail, and it is a spec gap rather than a fault.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The stall demo", "The graded moment. You are about to cause the exact failure this board was designed to survive."),
  prose(
    "This is the demonstration the whole lesson has been building towards. You will force the servo into stall, which is the worst-case current the design was sized against, and prove that the processor does not notice.\n\nThe firmware streams a **heartbeat** over USB serial throughout: a counter that ticks steadily. The counter is the instrument. If the microcontroller resets, the counter restarts from zero, and you will see it. If the counter runs unbroken through a held stall, the servo pulled about **0.9 A** and none of it crossed the logic path.\n\nHold the horn gently but firmly, against the direction it is trying to move. A second or two is plenty. You are not trying to damage the servo, and the fuse is there in case you do something worse than intended.",
  ),
  does("run the stall demo", [
    {
      text: "**Start the heartbeat log.** Open the serial console and confirm the counter is ticking steadily while the servo sweeps.",
      proof: "The console ticks steadily while the servo moves.",
    },
    {
      text: "**Pinch the horn** and hold it against a commanded move for a second or two. You will feel the stall torque, and the supply's current display should jump towards an amp.",
      proof: "You feel the stall torque and the supply current rises towards 0.9 A.",
    },
    {
      text: "**Read the console.** The heartbeat should be **unbroken** across the whole stall window: no restart, no gap, no reset message. Release the horn and the servo resumes.",
      proof: "The counter is unbroken across the stall window and the servo resumes on release.",
    },
    {
      text: "**Meter both rails during a stall** if you have a second pair of hands or a clip lead. TP1 should hold 3.2 to 3.4 V while VSERVO sags a little under load. Two rails, two behaviours, one of them completely unbothered.",
      proof: "TP1 stays between 3.2 and 3.4 V while the servo is stalled.",
    },
    {
      text: "**Say what you just proved.** On a shared rail this stall would have dropped the regulator's input by 0.27 to 0.45 V, past its dropout, and reset the chip mid-move. Your board has no path for that to happen through.",
      proof: "You can state why the reboot cannot happen on this board.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "The stall demo: a finger holding the servo horn mid-move while a serial console streams an unbroken heartbeat.",
    caption: "The lesson, live: worst-case mechanical load, and no effect at all on the processor.",
    captureHint: "Bench: finger pinching the servo horn on a powered board, laptop console visible with a scrolling counter, supply current display readable if available.",
    reveal: "See it wired · the stall demo",
  },
  tube("The stall demo: hold the horn and watch the heartbeat"),
  check(
    "**The heartbeat runs unbroken while you hold the servo stalled. What did that prove?** That the stall pushed about 0.9 A through the external supply, the servo and ground, and the microcontroller never saw an amp of it. That is the board's thesis, demonstrated rather than asserted.",
  ),
  dive(
    "What the same test would have looked like on a shared rail",
    "It is worth being precise about what you avoided, because the number is the whole design.\n\nOn a board that fed the servo from USB's 5 V, a 0.9 A stall would run through the USB cable and connector, which together have roughly **0.3 to 0.5 ohm** of resistance. Ohm's law makes that a **0.27 to 0.45 V** sag on the 5 V the regulator sees. The RT9080 needs its input above 3.3 V plus its dropout, which is 310 mV typical and about **0.5 V** at worst near full load. The sag eats the headroom, the 3.3 V rail falls, the brownout detector fires, and the chip resets in the middle of the move.\n\nA stiffer servo drawing 1 to 2 A sags it further, so the failure gets worse exactly as the application gets more useful. That is the shape of the problem: it is not a bug you can fix in firmware and it does not announce itself until you load the mechanism.\n\nThe fix on this board is not margin, it is the absence of a path. There is no arithmetic to redo for a bigger servo, because the term you would be computing is multiplied by zero amps.",
  ),

  // ── troubleshooting ───────────────────────────────────────────────────────
  sect("06", "When a rung fails", "Each symptom points at one suspect, and most of them are things you can check with a meter."),
  {
    type: "table",
    columns: ["Symptom", "Likely cause", "What to do"],
    rows: [
      [{ text: "Board resets when the servo starts moving" }, { text: "The two rails are joined somewhere" }, { text: "Power down and re-run the VSERVO-to-VBUS sweep. A bridge or a mislabelled net rebuilt the shared rail. This is the one failure that should be impossible" }],
      [{ text: "VSERVO dead at C8, supply healthy" }, { text: "F2 has tripped, from a short or a reversed hookup that fired the crowbar" }, { text: "Remove the cause, check J4's polarity against the silk, and let the PTC cool. It self-resets" }],
      [{ text: "VSERVO sits near -0.4 V" }, { text: "The supply is wired backwards and D2 is doing its job" }, { text: "Switch off, swap the wires, and let F2 cool. Nothing is damaged: that is what the crowbar is for" }],
      [{ text: "Servo twitches or hums, will not track" }, { text: "This servo's signal threshold is above 3.3 V" }, { text: "Confirm the pulse on a scope first. If the signal is correct, use the kit-specified servo or a buffer powered from VSERVO" }],
      [{ text: "Servo jitters at rest" }, { text: "Unregulated or noisy supply, or a long unshielded lead" }, { text: "Confirm the supply says regulated, shorten the servo lead, and keep it away from the antenna end" }],
      [{ text: "Servo does not move at all, rails both good" }, { text: "No signal reaching it, or the plug is on backwards" }, { text: "Scope J5 pin 3. Then check the plug: brown or black on pin 1" }],
      [{ text: "Supply current-limits during a move" }, { text: "The supply is too small for the inrush" }, { text: "Inrush reaches about 1.3 A. Raise the limit to 1.5 A or use a bigger supply" }],
    ],
  },
  check(
    "**The board resets when the servo starts moving. What is the design-level suspect?** The rails are joined somewhere. On a correct build that reset mechanism does not exist, so its reappearance means a bridge or a label rebuilt the shared-rail failure the board was built to prevent. Go find the copper.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: bring-up",
    gate: true,
    questions: [
      {
        id: "continuity-first",
        q: "What is the very first thing to do before plugging in USB for the first time?",
        options: [
          "Connect the servo supply so both rails come up together",
          "Load the sweep firmware",
          "Check with a meter that there is no short between VBUS and GND",
        ],
        answer: 2,
        explain: "A short found with a meter costs a minute. The same short found by plugging in can cost the whole board.",
      },
      {
        id: "stall-demo-meaning", reviewId: "l104-stall-demo-meaning",
        q: "The heartbeat runs unbroken while you hold the servo stalled. What did that prove?",
        options: [
          "The separate-rail topology: worst-case motor current flowed and none of it crossed the logic path",
          "That the servo is weaker than its datasheet claims",
          "That the firmware has good error handling",
        ],
        answer: 0,
        explain: "The stall pushed about 0.9 A through the supply, the servo and ground. The microcontroller never saw an amp of it.",
      },
      {
        id: "reset-diagnosis", reviewId: "l104-reset-diagnosis",
        q: "The board resets when the servo starts moving. What is the design-level suspect?",
        options: [
          "The PWM frequency is wrong",
          "The rails are joined somewhere: a bridge or a mislabelled net rebuilt the shared-rail failure",
          "The USB port is too weak",
        ],
        answer: 1,
        explain: "On a correct build that mechanism does not exist. Its reappearance means the isolation broke somewhere in copper.",
      },
      {
        id: "ptc-reset",
        q: "After a reversed hookup the servo rail is dead, but the supply is fine. What restores it?",
        options: [
          "Replacing D2, which sacrificed itself",
          "A firmware reset",
          "Remove the fault, fix the wiring, and let the PTC cool. It self-resets",
        ],
        answer: 2,
        explain: "The crowbar clamped the rail and tripped the fuse, exactly as designed. The plus and minus marks on the silk were the first line of defence and the fuse was the second.",
      },
      {
        id: "power-order", reviewId: "l104-power-order",
        q: "Bringing USB up before the servo supply protects against what?",
        options: [
          "The servo supply back-feeding a small current through the header into the signal pin of a board whose 3.3 V is dead",
          "Nuisance trips of the resettable fuse",
          "USB enumeration failures",
        ],
        answer: 0,
        explain: "R7 bounds that back-feed to about 9.5 mA either way, so nothing breaks. The habit simply keeps the path unused.",
      },
      {
        id: "rail-healthy",
        q: "You power the board over USB and probe TP1. What reading means the logic rail is healthy?",
        options: [
          "About 5 V",
          "About 3.3 V, anywhere from 3.2 to 3.4",
          "0 V until the servo supply is connected",
        ],
        answer: 1,
        explain: "TP1 is the 3.3 V rail. Measure it before trusting anything downstream, and before the servo rail enters the story at all.",
      },
    ],
  },

  band("check", "What success looks like", "Verify. Six proofs, in order, that this board is finished."),
  trace("the proofs this board is done", [
    { text: "**No VBUS-to-GND short and no VSERVO-to-VBUS short**, both confirmed with the meter before any power.", help: "The second sweep is the one unique to this board. The isolation has to exist in solder, not just in intent." },
    { text: "**The logic ladder passes on USB alone**: TP1 at 3.2 to 3.4 V, LED1 lit, the board enumerates, LED2 blinks after flashing.", help: "All of it before the servo supply is connected, so any later fault has a small set of suspects." },
    { text: "**VSERVO reads about 5 V at C8** and the logic rail did not move when it came up.", help: "Adding the second rail should change nothing at all on the first one. If TP1 shifted, the rails are talking." },
    { text: "**The servo tracks a sweep smoothly**, idling at tens of milliamps and moving at a couple of hundred.", help: "Hunting or buzzing at rest points at the signal threshold or a noisy supply, not at the board." },
    { text: "**The stall demo holds**: the heartbeat is unbroken through a held stall and TP1 never leaves 3.2 to 3.4 V.", help: "This is the graded moment. It is the board's whole thesis, demonstrated with a finger and a serial console." },
    { text: "**The power order is a habit**: USB up first, servo supply second, every time.", help: "It keeps the back-feed path at K15 permanently unused rather than merely bounded." },
  ]),

  exit(
    "You stalled a motor against a running computer and nothing happened, which is the highest compliment a power topology gets. Capture the bring-up measurements and the log, then mark each board BROUGHT_UP or QUARANTINED. That closes the build.",
  ),

  ref("ESP-IDF Programming Guide (Espressif): flashing the ESP32-S3 over native USB and download-mode entry", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/flashing-troubleshooting.html"),
  ref("LED Control (LEDC) API reference (Espressif, ESP32-S3): the peripheral generating the 50 Hz pulse", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html"),
  ref("esptool (Espressif): the tool that writes firmware to the ESP32-S3 flash", "https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/flashing-firmware.html"),
  ref("Pololu: servo control interface in detail, the 20 ms frame and the 1.0 to 2.0 ms range", "https://www.pololu.com/blog/17/servo-control-interface-in-detail"),
];

publishCard({ slug: "l1-04-single-servo", stage: "BRINGUP", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
