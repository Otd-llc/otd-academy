// L1.05 internal ADC — BRINGUP card.
//
// Authored ahead of the board, with L1.01's BRINGUP card as gospel for the
// ladder: no VBUS-to-GND short, TP1 at 3.3 V (3.2 to 3.4), LED1 lit, the board
// enumerates, LED2 blinks after flashing, plus the 4.9 V reading that means
// the LDO is passing its input straight through and the hold-BOOT, tap-EN,
// release-BOOT dance.
//
// The new material is the experiment: four observations that turn the numbers
// the REQUIREMENTS card promised into things the learner has personally seen.
// Every figure is from the ESP32-S3 Series Datasheet v2.2 Table 5-5 and Table
// 5-6 and the ESP-IDF ADC docs, re-read 2026-07-30. Note the datasheet's ADC
// figures are taken with Wi-Fi DISABLED, so observed noise on this board is a
// floor rather than a target (design.md K7/K14).
//
// The card this replaces was 12 blocks against the 32-block bar.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Bring-up: measuring the measurer"),

  prose(
    "Bring-up on this board is two things stacked. First the ladder you have climbed four times: no shorts, then the rail, then the chip, with the meter rather than optimism telling you each rung is safe. Then an experiment.\n\nThe experiment has four observations, and each one is a number the REQUIREMENTS card promised you. The console and your meter deliver them live. This board's job was to make the invisible limits of a built-in converter visible, and this is where they show.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("check", "No shorts before power", "Prove the board is safe to power before you plug anything in."),
  sect("01", "The ladder, unchanged", "Five rungs, in order, and you stop the moment one fails."),
  prose(
    "With no power applied, run a [[continuity]] check between [[VBUS]] and GND. It must **not** beep. Red lead on the VBUS point at U2's input, black on TP2. A solder bridge found with a meter costs you a minute; the same bridge found by plugging in costs you the board.\n\nThen power over USB and measure the rail: **3.3 V at TP1**, ground at TP2, and anything from **3.2 to 3.4 V** is healthy. The red power LED should light. Then the host should see the board, and after flashing, LED2 blinks.",
  ),
  does("climb the ladder", [
    {
      text: "**No power.** Confirm **VBUS to GND does not beep**, and that the grounds are common.",
      proof: "The meter stays silent between VBUS and GND, showing OL.",
    },
    {
      text: "**Power up on a charger, not your laptop, for the very first time.** The continuity check proved there is no VBUS-to-GND short. It says nothing about the data lines, and a stray bridge from VBUS to D+ or D- would push 5 V into a host's USB data pins.",
      proof: "First power-on happened on a cheap charger or a hub you do not care about.",
    },
    {
      text: "Meter on DC volts: **TP1 reads about 3.3 V** against TP2, inside 3.2 to 3.4, and **LED1 is lit**.",
      proof: "TP1 sits between 3.2 and 3.4 V and the power LED is on.",
    },
    {
      text: "Move to the computer. The board should **enumerate** as a USB serial device on its own, with no bridge chip in the path.",
      proof: "A new USB serial device appears when the board is plugged into the host.",
    },
    {
      text: "**Flash the ADC firmware**: hold **BOOT**, tap **EN** to reset, release **BOOT**, then load. It configures ADC1 channel 0 on GPIO1 at 12 dB with calibration applied, and streams raw counts and a spaced average to the console.",
      proof: "The board takes the firmware and the console streams readings.",
    },
  ]),
  table(
    ["TP1 reads", "Likely cause", "What to do"],
    [
      ["About 3.3 V", "The LDO is regulating", "Healthy: move on to enumeration"],
      ["About 4.9 V", "The regulator is passing its input straight through: backwards, mis-soldered, or EN not high", "Stop. Do not connect 3.3 V parts to that rail. Recheck U2"],
      ["0 V", "No power reaching it, or a short dragging it down", "Check the USB power chain, then hunt for a short"],
      ["About 3.3 V, LED1 dark", "The LED or its resistor, not the rail", "Check LED1's polarity and R5"],
    ],
  ),
  shot(
    "Probing the rail: red on TP1, black on TP2, expect about 3.3 V.",
    "Bench: red probe on TP1, black on TP2, multimeter in DC-V reading about 3.30 V on a powered L1.05 board with the power LED lit.",
  ),
  check(
    "**The board powers but TP1 reads 4.9 V.** The regulator is not regulating: its output is sitting at its input, so it is mis-soldered, mis-oriented, or its enable is not asserted. Stop before you connect anything expecting 3.3 V.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Run the experiment", "Knob in one hand, meter on J4's AIN pin, console in view. Take your time on each of the four."),
  sect("02", "The four observations", "Each one is a datasheet claim you are about to see with your own eyes."),
  prose(
    "Put your meter's black lead on **J4's GND pin** and the red on **AIN**. The meter now reads the true voltage at the analog node, and the console reads the converter's opinion of the same voltage. Everything from here is a comparison between those two numbers.\n\nGo slowly. Each observation is a different kind of limit, and the differences between them are the lesson.",
  ),
  does("the four observations", [
    {
      text: "**The clip.** Sweep the knob slowly toward the top. Watch the count pin at **4095** while your meter keeps climbing toward 3.3 V. Note the meter voltage at the moment it pinned: that is your chip's usable ceiling, measured rather than quoted.",
      proof: "You recorded the voltage at which the count saturated, somewhere near 2.9 to 3.1 V.",
    },
    {
      text: "**The noise band.** Park mid-range and watch the raw readings wobble. Note the band's width in counts. Then watch the averaged stream: it tightens, and it does not become a single number.",
      proof: "You wrote down the raw band's width in counts and saw the averaged stream tighten.",
    },
    {
      text: "**The ±50 mV truth.** At three knob positions, compare your meter's reading on AIN against the console's calibrated millivolts. The differences should land inside **±50 mV**, the datasheet's own total-error figure at this attenuation.",
      proof: "Three meter-against-converter deltas recorded, all inside the band.",
    },
    {
      text: "**The bottom.** Sweep down to zero. The codes shrink but keep changing, and below roughly **75 mV** they drift outside the accuracy band. It behaves visibly differently from the top's hard stop.",
      proof: "You watched small codes wander near zero rather than pin flat.",
    },
    {
      text: "**The boring one.** Enable Wi-Fi mid-experiment and watch the readings. They should barely move, because the signal is on ADC1 in copper and the trap this board removed cannot fire.",
      proof: "Turning the radio on changed nothing structural about the readings.",
    },
  ]),
  shot(
    "The experiment: meter truth on the left, the converter's version on the right, the knob deciding.",
    "Bench: L1.05 powered, meter probes on J4 (AIN against GND) showing a mid-range voltage, console visible with raw and averaged columns, a hand on RV1.",
  ),
  shot(
    "The clip, caught: the count flat at 4095 while the meter is still climbing.",
    "Split or side-by-side capture: console showing 4095 held steady, meter showing about 3.1 V and rising as the knob turns. Both numbers legible.",
  ),
  shot(
    "Raw against averaged on the same input: the band, then the band tightened.",
    "Console capture at a parked mid-range knob position: a column of wobbling raw counts beside a steadier averaged column, enough rows to show the spread.",
  ),
  check(
    "**Your meter says 1.650 V and the console's calibrated reading says 1.628 V. Fault or spec?** Spec. A 22 mV delta sits comfortably inside the ±50 mV band the datasheet publishes for this attenuation. Knowing which deviations are findings and which are physics is the skill this board exists to build.",
  ),
  dive(
    "What averaging fixes, and what it cannot touch",
    "The datasheet itself suggests it: to get better results, sample multiple times and apply a filter, or take the average. That works on **random** error, the wobble that is different on every sample, because averaging N samples shrinks random spread. It does nothing at all to **systematic** error, the part of the reading that is offset the same way every time.\n\nOne practical wrinkle. Samples taken in a fast burst are correlated with each other, because the RC filter at the pin has a time constant around a millisecond and low-frequency noise on the shared rail moves slower still. Space your samples out and the average genuinely improves; take a thousand of them in a microsecond and you have mostly averaged the same instant a thousand times.\n\nSo the band tightens and the ±50 mV floor stays. That floor is the honest reason the next SENSE board reaches for a converter with its own reference.",
  ),
  gotcha(
    "the datasheet's numbers were taken with the radio off",
    "Espressif measure the ADC characteristics with an external 100 nF capacitor on the input, DC signals, 25 °C, and **Wi-Fi disabled**. Your board runs the radio by design, because the ADC1 rule is half the lesson. So treat the published noise figures as a floor rather than a target: what you observe can honestly be worse, and that is the measurement telling the truth rather than the board being faulty.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  band("check", "When the numbers look wrong", "Verify. Most surprises here are the board being honest, and a few are real faults."),
  sect("03", "Reading a bad number correctly", "Half of instrument literacy is knowing which deviations to chase."),
  table(
    ["Symptom", "Likely cause", "What to do"],
    [
      ["Readings pinned at 0 or 4095 whatever the knob does", "The wiper net is open, or the firmware is on the wrong channel", "Meter AIN at J4 while sweeping; confirm the channel is GPIO1"],
      ["The reading never moves but the meter does", "RV1's wiper is not on the AIN net, or R7 is missing", "Re-run the assembly ohm sweep, then check R7 and C8 are fitted the right way round"],
      ["Wild noise even after averaging", "A scratchy pot, or the analog run passing something noisy", "Re-run the ohm sweep; inspect the routing against the answer key"],
      ["A steady offset larger than 50 mV", "Calibration not applied: raw counts multiplied by a constant", "Use the calibrated read path rather than scaling raw counts yourself"],
      ["Readings shift when Wi-Fi starts", "Small drift is normal noise. Garbage means ADC2 got selected in firmware", "GPIO1 is ADC1. Fix the channel configuration"],
      ["Meter and console disagree by 60 to 80 mV", "Possibly real, possibly your meter", "Check the meter's own DC accuracy figure before calling it a fault"],
    ],
  ),
  shot(
    "The bottom end: small codes still changing, rather than a flat shelf at zero.",
    "Console capture with the knob near the bottom of travel: counts in the low tens changing as the knob moves, beside meter readings under 100 mV.",
  ),
  check(
    "**Sweeping to the bottom, the count reads 41, then 37, then 44, with the meter under 50 mV. Is the board broken?** No. Below about 75 mV the reading stops being accurate, and it does that by drifting rather than by stopping. The top of the range fails as a wall; the bottom fails as a fog. Telling them apart is instrument literacy.",
  ),

  band("check", "What success looks like", "Five proofs, and then the build is logged."),
  trace(
    "The proofs this board is done",
    [
      { text: "**The L1.01 ladder passes**: no short, TP1 at 3.3 V, LED1 lit, enumeration, LED2 blinking", help: "The permanent five rungs. If any of them fails, nothing downstream means anything." },
      { text: "**The clip observed**, and the meter voltage where it happened written down", help: "Your chip's real ceiling, measured rather than quoted from a table." },
      { text: "**Raw and averaged both witnessed** on the same parked input", help: "The noise band and its honest half-fix, seen together rather than described." },
      { text: "**Three meter-against-converter deltas inside ±50 mV**", help: "The headline spec, personally verified, with your meter's own accuracy noted beside it." },
      { text: "**Turning Wi-Fi on changed nothing structural**", help: "The ADC1 rule, proven by boring behaviour. On ADC2 this moment would return garbage." },
      { text: "**The bottom drifts rather than pins**", help: "The accuracy floor is a different animal from the range ceiling, and you have now seen both." },
    ],
  ),
  tube("The four observations: clip, band, truth, floor"),

  {
    type: "quiz",
    prompt: "Quick check: bring-up",
    gate: true,
    questions: [
      {
        id: "meter-vs-adc", reviewId: "meter-vs-adc",
        q: "Meter reads 1.650 V, the calibrated converter reads 1.628 V. What is the correct log entry?",
        options: [
          "Within spec: a 22 mV delta sits inside the ±50 mV band",
          "Fault: 22 mV is enormous against 0.8 mV resolution",
          "Recalibrate until the two agree exactly",
        ],
        answer: 0,
        explain: "Resolution tempts you to expect millivolt agreement. Accuracy says ±50 mV is the contract, and reading the delta correctly is the lesson.",
      },
      {
        id: "clip-character", reviewId: "clip-character",
        q: "How do the top and bottom limits differ in character on the console?",
        options: [
          "Both pin flat at their end of the scale",
          "The top pins hard at 4095; the bottom's small codes keep wandering, just outside the accuracy band",
          "Both wander",
        ],
        answer: 1,
        explain: "Saturation against an accuracy floor: one is a wall, the other a fog. Distinguishing them is instrument literacy.",
      },
      {
        id: "averaging-honesty",
        q: "Averaging tightened the noise band. What did it not fix?",
        options: [
          "The sample rate",
          "The wobble's amplitude",
          "The ±50 mV systematic band: averaging attacks random error and never touches a fixed offset",
        ],
        answer: 2,
        explain: "Random error shrinks with more samples; systematic error does not. The floor that remains is why precision work buys an external converter.",
      },
      {
        id: "wifi-boring", reviewId: "wifi-boring",
        q: "You enable Wi-Fi mid-experiment and the readings barely change. What does that boring result prove?",
        options: [
          "The radio never actually started",
          "The ADC1-in-hardware decision: the trap this board removed cannot fire, whatever the firmware does with the radio",
          "The filter blocks all radio noise",
        ],
        answer: 1,
        explain: "On ADC2 this moment returns garbage. On this board it is a shrug, by a choice made once at the schematic.",
      },
      {
        id: "next-board-why",
        q: "The measured ±50 mV floor is the justification for what?",
        options: [
          "Buying a better multimeter",
          "The next SENSE board's external precision converter, now that you know exactly why the built-in one is not enough",
          "Running the ADC faster",
        ],
        answer: 1,
        explain: "You leave this board knowing the internal converter's honest envelope and what class of part exceeds it. That is the handoff.",
      },
    ],
  },

  exit(
    "You measured a measurer and read its limits the way a datasheet author would: the wall, the fog, the band, the rule. Log the numbers with the build and mark each board BROUGHT_UP or QUARANTINED. Level 1's SENSE foundation is set, and the case for an external converter is now something you have seen rather than been told.",
  ),

  ref("ESP32-S3 Series Datasheet (Espressif): Table 5-5 ADC characteristics and Table 5-6 calibrated total error", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP-IDF ADC calibration driver (Espressif): the eFuse correction the firmware applies", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/adc_calibration.html"),
  ref("ESP-IDF ADC oneshot driver (Espressif): configuring the channel and its attenuation", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/adc_oneshot.html"),
  ref("ESP-IDF Programming Guide (Espressif): flashing the ESP32-S3 over native USB", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/flashing-troubleshooting.html"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "BRINGUP", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
