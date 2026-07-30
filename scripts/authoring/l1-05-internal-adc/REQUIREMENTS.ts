// L1.05 internal ADC — REQUIREMENTS card.
//
// Authored ahead of the board from docs/boards/l1-05-internal-adc/{design.md,
// bom.csv,validation-log.md} (DRY, 12 passes, design-stage part-ready), with
// L1.01's REQUIREMENTS card as gospel for everything the two boards share (the
// WROOM core, the 600 mA budget, the ADC1-only rule, the antenna keep-out).
//
// Every ADC number here is worst case from the ESP32-S3 Series Datasheet v2.2
// (Table 5-5 ADC Characteristics, Table 5-6 ADC Calibration Results, section
// 4.2.2.1 SAR ADC, Table 2-8 Analog Functions) and the ESP-IDF ADC docs, read
// 2026-07-30, not from memory.
//
// The card this replaces was 15 blocks against the 33-block bar: correct, and
// far too thin to teach from. The owner rejected that compression on
// 2026-07-22. L1.01 is the bar for every lesson.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Requirements: what a built-in ADC can honestly do"),

  prose(
    "Calling `adc_read()` is one line. This board is about the number that comes back. The ESP32-S3's built-in converter promises 12 bits: 4096 steps, about 0.8 mV each, across the rail. What it delivers is a reading trustworthy to about **±50 mV even after calibration**, on a range that **stops short of the rail entirely**. You will sweep a knob from 0 to 3.3 V and watch every one of those limits appear on your console.\n\nThe takeaway carries the whole SENSE track: **12-bit resolution is a different thing from 12-bit accuracy**, and knowing the difference is what separates a knob reader from an instrument.",
  ),

  band("orient", "The honest promises", "Read this one. The hardware is your L1.01 core plus four passives, a diode and a knob. The promises are about measurement truth, and one pin rule you already know by heart."),

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "What the datasheet actually grants", "Three numbers to carry into bring-up: ±100 mV, ±50 mV, and a top that clips early."),
  prose(
    "Every chip's internal voltage reference lands somewhere in a **1000 to 1200 mV** window. Espressif quote 1100 mV as the nominal value and state the spread plainly, which means a raw reading carries a **±100 mV per-chip unknown** before anything else goes wrong. Factory calibration data burned into eFuses at manufacture corrects most of it. What survives that correction is the number this board exists to show you: at the attenuation you will use, the datasheet's own calibration table gives a **total error of ±50 mV** over the 0 to 2900 mV range.\n\nOn a 4096-step scale that is roughly **±66 counts**. Your steps are still 0.8 mV apart. Your truth is 50 mV wide. All of this is what an on-die SAR ADC sharing silicon with a radio can honestly do, and it is why the next SENSE board reaches for an external converter with its own reference.",
  ),
  table(
    ["Spec", "Value", "What you will see"],
    [
      ["Resolution", "12 bits, 4096 codes", "About 0.8 mV steps: the promise"],
      ["Reference spread", "1000 to 1200 mV per chip", "Why calibration exists at all"],
      ["Total error, calibrated", "±50 mV at 12 dB", "The honest band: about ±66 codes"],
      ["Usable top", "2900 mV (datasheet) to 3100 mV (ESP-IDF)", "Count pins at 4095 before the pot reaches the rail"],
      ["Converter nonlinearity", "DNL ±4 LSB, INL ±8 LSB", "Buried inside the ±50 mV band, named not seen"],
    ],
  ),
  shot(
    "The promise against the delivery: 0.8 mV steps drawn inside a 50 mV error band.",
    "Diagram or whiteboard shot: a fine 12-bit staircase with a 50 mV wide shaded band drawn across it, labelled resolution vs accuracy. Both labels legible at card width.",
  ),
  check(
    "**12 bits over 3.3 V suggests millivolt precision. Why is a calibrated reading still only good to ±50 mV?** Resolution counts the steps. Accuracy is how close the whole staircase sits to reality. The per-chip reference uncertainty and the converter's own nonlinearity move the staircase bodily, and calibration shrinks that error to ±50 mV rather than to zero.",
  ),
  dive(
    "Where the ±50 mV actually comes from",
    "Three things stack up. The reference the converter compares against is nominally 1100 mV but lands anywhere from 1000 to 1200 mV on a given die, which alone is a ±9 % gain error. The attenuator in front of the converter has its own tolerance. And the converter's transfer curve is not a perfect straight line: the datasheet bounds that at ±4 LSB differential and ±8 LSB integral nonlinearity.\n\nEspressif's calibration measures the first of those at manufacture and stores the correction in eFuse, which is why a calibrated read is dramatically better than a raw count times a constant. What the calibration cannot remove is everything else, and the datasheet publishes the residual as a single honest figure per attenuation: ±5 mV at the lowest, ±50 mV at the highest. The ±8 LSB nonlinearity works out around ±6 mV, so it sits well inside that band. You will not be able to pick it out by turning a knob, and this lesson does not ask you to.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The range stops before the rail", "A 3.3 V pot drives higher than the converter can express, so the top of your sweep vanishes."),
  prose(
    "The ESP32-S3 puts a switchable attenuator in front of its converter, and the setting you pick decides how much voltage the input can accept. At the highest setting, **12 dB**, the datasheet's calibration table covers **0 to 2900 mV** and the ESP-IDF driver docs suggest an upper bound around **3100 mV**. Either way the ceiling arrives **before 3.3 V**.\n\nRV1 sits across the full 3.3 V rail, so the last **200 to 400 mV** of knob travel pushes the input past that ceiling. The count parks at **4095** and stays there while your meter keeps climbing. That is a hard, watchable clip, and it is the first thing you will see at bring-up.\n\nThe bottom behaves differently. Below roughly **75 mV** the reading is no longer trustworthy, but the codes are small, nonzero, and still changing as you turn. It is a fog rather than a wall, and you measure it rather than watch it.",
  ),
  table(
    ["Attenuation", "Suggested input range (ESP-IDF)", "What a 3.3 V pot does there"],
    [
      ["0 dB", "0 to 950 mV", "Clips after about a quarter turn"],
      ["2.5 dB", "0 to 1250 mV", "Clips before halfway"],
      ["6 dB", "0 to 1750 mV", "Clips near halfway"],
      ["12 dB", "0 to 3100 mV", "Clips in the last few degrees: the setting this board uses"],
    ],
  ),
  shot(
    "The sweep: counts against real volts, with the flat shelf at the top where the converter runs out.",
    "Plot or console capture: measured volts on X, ADC count on Y, a straight line that flattens hard at 4095 above about 3.0 V. Axis labels legible.",
  ),
  check(
    "**Your count reads 4095 and will not move, but your meter says 3.05 V and rising. Is the board broken?** The converter's usable window ended below the rail. Real volts keep going up and every one of them reads as the same maximum code. Turn back down and the count starts tracking again.",
  ),
  gotcha(
    "a lower attenuation looks more accurate and measures less",
    "The 0 dB setting has a **±5 mV** total error against 12 dB's ±50 mV, which is tempting. It also stops accepting input above about **950 mV**. Choosing an attenuation is choosing how much of your signal you can see, and the accuracy figure only applies inside the range it belongs to. Match the setting to the signal first, then read the error band that comes with it.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The pin rule, now designed in", "You learned ADC1-only on L1.01 as a warning. This board enforces it in copper."),
  prose(
    "The ESP32-S3 has two converters. The Wi-Fi radio borrows ADC2's hardware while it is running, and on a Wi-Fi board the radio is basically always active, so an analog reading taken on an ADC2 pin comes back as an error or a meaningless number. Espressif state it flatly in the datasheet: the ADC2 channel analog functions cannot be used with Wi-Fi simultaneously.\n\nOn the S3, **[[ADC1]] is GPIO1 through GPIO10** and **[[ADC2]] is GPIO11 through GPIO20**. This board routes the conditioned signal to **GPIO1**, which is ADC1 channel 0. Not ADC2, and not GPIO3, which is an ADC1 channel that also happens to be a [[strapping pin]]. You cannot wire this board into the works-until-Wi-Fi trap, and the lesson still teaches why the trap exists. The board prevents it; the guide explains it.",
  ),
  table(
    ["Bank", "GPIOs", "With the radio running"],
    [
      ["ADC1", "GPIO1 to GPIO10", "Works. This board uses GPIO1 (channel 0)"],
      ["ADC2", "GPIO11 to GPIO20", "Reads fail or return nonsense"],
      ["GPIO3", "ADC1 channel 2", "An ADC1 pin, but a JTAG strapping pin: kept clear"],
    ],
  ),
  check(
    "**You wire a knob to an ADC2 pin and the reading is garbage only when Wi-Fi is on. What rule did you break?** Anything you sample as analog has to land on an ADC1 pin. ADC2 is claimed by the radio, and the bug has no compile error and no smoke to point at it.",
  ),
  dive(
    "Why a strapping pin is the wrong home for a knob",
    "Four pins on the S3 do double duty. The instant the chip comes out of reset it samples GPIO0, GPIO3, GPIO45 and GPIO46 to decide how to start, and only afterwards do they become ordinary I/O. GPIO3 is genuinely an ADC1 channel, so it passes the ADC1 test, and it would still be a poor choice here: a voltage sitting on it at the moment of reset is a vote on how the chip boots, and the whole point of this board is that the voltage on the analog pin is whatever the learner left the knob at.\n\nGPIO1 has no start-up duty at all. Membership of ADC1 is necessary. It is not the whole test.",
  ),
  {
    type: "callout", severity: "warn", label: "Inherited · the antenna still needs clear air",
    body: "Nothing about the analog front end changes the WROOM's rule. The module carries its Wi-Fi antenna printed on one end, copper near it detunes it, and this board still promises that end clear air: the module overhangs the board edge and a keep-out area under and around the antenna stays empty on every layer. You drew that keep-out on L1.01 and you will draw it again at layout. It is the one mistake on this board that cannot be fixed without ordering new boards.",
  },

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "One knob, one filter, one guarded door", "The whole analog front end is a potentiometer, an RC, and protection on the one node a finger can reach."),
  prose(
    "**RV1**, a 10 kΩ trimpot across 3V3 and GND, makes the sweepable source. Its wiper is the signal, a net called **AIN**. A series **10 kΩ (R7)** and a **100 nF cap at the ADC pin (C8)** condition it into the converter, and that exact pair is deliberate: Espressif take their published ADC numbers with an external 100 nF capacitor connected to the input, so measuring under the same conditions is what makes their error bands apply to you.\n\nThe exposed side gets guards. An ESD diode (**D2**) sits on AIN, because AIN is what a finger and a probe can reach. A second **10 kΩ (R8)** sits between AIN and the probe header **J4 (3V3 / AIN / GND)**, so anything a learner pokes, shorts or back-feeds at that header is limited to a fraction of a milliamp before it reaches the pot's wiper or the 3.3 V rail.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["RV1", "3362P 10 kΩ trimpot", "The sweepable source: wiper is the AIN net"],
      ["R7", "10 kΩ 0805", "Series half of the conditioning filter into the pin"],
      ["C8", "100 nF 0805", "The at-the-pin half, matching the datasheet's test circuit"],
      ["D2", "CDSOD323-T05C", "ESD clamp on AIN, the node hands and probes touch"],
      ["R8", "10 kΩ 0805", "Current limiter between AIN and the J4 header"],
      ["J4", "1x3 header", "3V3 / AIN / GND probe point and guarded sensor entry"],
    ],
  ),
  shot(
    "The whole signal path: knob to guard to filter to pin, left to right.",
    "Block diagram: RV1 wiper to node AIN, D2 to GND and R8 to J4 branching off it, R7 in series to ADC_IN with C8 to GND, then into GPIO1. Every label legible.",
  ),
  check(
    "**Why does the ESD diode sit on AIN rather than right at the ADC pin?** Static arrives where fingers and probes arrive: the trimpot screw and the header. Clamp at the exposure and the strike shunts to ground before it travels; R7 then limits whatever residue heads for the pin.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The bench, and the one instrument this lesson leans on", "Same bench as every board so far, plus a meter you actually trust."),
  prose(
    "Nothing new goes on the bench. The board is hand built with the same temperature-controlled iron, **0.6 mm** lead-free solder, flux, tweezers and magnification you used on L1.01, and every part was picked to stay inside that envelope: passives at 0805, the ESD diode in a leaded SOD-323, and the trimpot through-hole.\n\nOne tool moves from useful to load-bearing. At bring-up you compare the converter's answer against your **multimeter**, so the meter becomes the reference this whole lesson rests on. Fresh batteries and a DC range you trust, before the boards arrive.",
  ),
  {
    type: "callout", severity: "info", label: "Everything is provided: you do not source or draw a thing",
    body: "The [[KiCad starter]] you download at the schematic stage ships every part's symbol, footprint and 3D model already placed, and the [[exact BOM]] is specified for you down to the manufacturer part numbers. You bring the bench and the meter; the parts library is ours.",
  },

  band("do", "in your notes · Write the promises down", "Five short lines, in your own words. Nothing uploads and no gate waits on it, which is exactly why it is worth doing."),
  does("your requirements note", [
    {
      text: "**TRUTH:** the calibrated reading is honest to **±50 mV**; the top of the sweep clips before the rail; the bottom is untrustworthy below about **75 mV**.",
      proof: "Your note carries the three honesty numbers.",
    },
    {
      text: "**RANGE:** the board runs at **12 dB** attenuation, whose usable window ends between **2900 and 3100 mV**, below the 3.3 V the pot can deliver.",
      proof: "Your note names the attenuation and says why the top of travel disappears.",
    },
    {
      text: "**PIN:** the signal lands on an ADC1 channel (**GPIO1**) in hardware, never ADC2, never a strapping pin.",
      proof: "Your note names ADC1 and the reason ADC2 is out.",
    },
    {
      text: "**NETWORK:** **10 kΩ series into 100 nF at the pin**, matching the input circuit Espressif characterise the converter with.",
      proof: "Your note records the RC and why it is that RC.",
    },
    {
      text: "**GUARDS:** the exposed node is ESD-clamped, and every external poke at J4 is current-limited through 10 kΩ.",
      proof: "Your note says the probe header is guarded rather than raw.",
    },
  ]),
  tube("Sweep the knob, watch the count: what this board sets out to prove"),

  {
    type: "quiz",
    prompt: "Quick check: requirements",
    gate: true,
    questions: [
      {
        id: "res-vs-acc", reviewId: "res-vs-acc",
        q: "The board's core claim, in one line?",
        options: [
          "12-bit resolution does not buy 12-bit accuracy: the calibrated reading is honest to about ±50 mV",
          "The internal ADC is broken and should not be used",
          "More bits always mean better measurements",
        ],
        answer: 0,
        explain: "Steps and truth are different axes. About 0.8 mV steps sitting on a ±50 mV staircase is the whole lesson in one number pair.",
      },
      {
        id: "top-clip", reviewId: "top-clip",
        q: "Sweeping the pot toward the top, the count pins at 4095 while your meter keeps climbing. What happened?",
        options: [
          "The pot is faulty",
          "The converter's usable range tops out below the rail, so real volts keep rising past what it can express",
          "The calibration expired",
        ],
        answer: 1,
        explain: "The usable window ends between 2900 and 3100 mV. Everything above reads as the same maximum code: a hard, visible clip.",
      },
      {
        id: "why-cal",
        q: "What problem does the factory calibration mostly correct?",
        options: [
          "The delay through the RC filter",
          "Noise picked up from the radio",
          "The per-chip reference, which lands anywhere from 1000 to 1200 mV without it",
        ],
        answer: 2,
        explain: "Each die's reference sits somewhere in a 200 mV window. The eFuse data pins yours down, which is what shrinks the error to the ±50 mV band.",
      },
      {
        id: "adc1-hardwired", reviewId: "adc1-hardwired",
        q: "How does this board handle the trap where ADC2 stops working once Wi-Fi starts?",
        options: [
          "A firmware check warns you at run time",
          "The signal is wired to an ADC1 channel in copper, so the trap cannot fire, and the lesson explains why it exists",
          "Wi-Fi is disabled for the whole lesson",
        ],
        answer: 1,
        explain: "Designing the failure out beats warning about it. The pin choice is the mitigation, made once, at the schematic.",
      },
      {
        id: "network-reason",
        q: "Why exactly 10 kΩ and 100 nF at the pin, rather than any other RC?",
        options: [
          "They were left over from L1.01",
          "That pair filters mains hum out of the reading",
          "It is the input network Espressif characterise the converter with, so their published error bands apply to your numbers",
        ],
        answer: 2,
        explain: "Measure under the maker's conditions and the spec's error bands are yours to use. Change the network and you are on your own.",
      },
      {
        id: "atten-tradeoff",
        q: "The 0 dB attenuation setting has a ±5 mV total error against 12 dB's ±50 mV. Why does this board still use 12 dB?",
        options: [
          "0 dB stops accepting input above about 950 mV, and the pot sweeps to 3.3 V",
          "0 dB is not available on the ESP32-S3",
          "12 dB samples faster",
        ],
        answer: 0,
        explain: "An accuracy figure only applies inside the range it belongs to. Pick the range that fits the signal first, then accept the error band that comes with it.",
      },
    ],
  },

  exit(
    "Three honesty numbers, a range that ends below the rail, a pin rule enforced in copper, the datasheet's own input network and a guarded probe point. The quick check above is the gate. There is nothing to attach on a board this size.",
  ),

  ref("ESP32-S3 Series Datasheet (Espressif): SAR ADC, Table 5-5 characteristics and Table 5-6 calibration results", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP-IDF ADC calibration driver (Espressif): the 1100 mV nominal reference and its 1000 to 1200 mV spread", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/adc_calibration.html"),
  ref("ESP-IDF ADC oneshot driver (Espressif): attenuation settings and reading a channel", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/adc_oneshot.html"),
  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module pinout and the antenna keep-out zone", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "REQUIREMENTS", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
