// L1.05 internal ADC — BOM_SOURCING card.
//
// Authored ahead of the board from docs/boards/l1-05-internal-adc/{design.md,
// bom.csv,validation-log.md}, with L1.01's BOM_SOURCING card as gospel for the
// shared sourcing discipline (exact MPN, stock and lifecycle, second sources,
// jellybeans, hand-solderable packages).
//
// Part facts are from the manufacturers' own datasheets, re-checked 2026-07-30:
// Bourns 3362 (10 kOhm, 0.5 W, single turn, 240 deg electrical / 270 deg
// mechanical, terminal 2 = wiper) and Bourns CDSOD323-TxxC (V_RWM 5 V,
// V_BR(min) 6.0 V, V_C 9.8 V, about 3 pF, SOD-323, bidirectional). Stock and
// price snapshots are the live DigiKey screen of 2026-06-26 recorded in
// design.md section 8.
//
// The card this replaces was 7 blocks against the 36-block bar.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("BOM sourcing: one new part, and why it is the one worth choosing carefully"),

  prose(
    "This is the leanest BOM in Level 1. The board is the L1.01 core reused whole, and the analog front end adds **five lines**: a trimpot, an ESD diode you met on L1.03, two 10 kΩ resistors, a 100 nF capacitor and a three-pin header snapped off the same breakaway stick as J2 and J3. Four of those five are values already sitting on reels in your drawer.\n\nSo the interesting sourcing work is concentrated in one part. **RV1**, the trimpot, is the only genuinely new line on this board, and it is also the part a learner touches more than any other. That combination is worth twenty minutes.",
  ),

  band("orient", "One new line, four you already own", "Read this one. You are not choosing parts here, you are seeing why each of five lines earns its place."),

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "The one genuinely new part: a trimpot", "A sealed, top-adjust, single-turn cermet trimmer. Every word in that phrase is doing work."),
  prose(
    "**RV1 is a Bourns 3362P-1-103LF**: 10 kΩ, 0.5 W, a single-turn cermet trimming potentiometer in a 6 mm through-hole square body with the adjustment screw on top. It sits across the 3.3 V rail with its wiper feeding the analog node, so turning the screw sweeps your signal from 0 V to 3.3 V and back.\n\nSingle turn matters. A 25-turn trimmer would technically work and would bury the whole lesson: the top clip and the noise band you are meant to *watch* would be spread across half a minute of screwdriver work. The 3362's roughly **240 degrees of electrical travel** puts the entire sweep inside one wrist movement, which is what makes the clip visible as a moment rather than as a spreadsheet.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["RV1", "3362P-1-103LF", "10 kΩ single-turn cermet trimpot: the sweepable source"],
      ["D2", "CDSOD323-T05C", "ESD clamp on the touchable analog node: the L1.03 part again"],
      ["R7, R8", "RC0805FR-0710KL", "10 kΩ 0805: series conditioning, and the header's current limiter"],
      ["C8", "CL21B104KBCNNNC", "100 nF 0805: the at-the-pin half of the datasheet's test network"],
      ["J4", "PRPC040SAAN-RC", "1x3 header: the 3V3 / AIN / GND probe point"],
    ],
  ),
  {
    type: "partModel",
    mpn: "3362P-1-103LF",
    caption: "RV1: the 6 mm square trimpot, screw on top, three through-hole legs",
  },
  shot(
    "The trimpot itself: 6 mm square, adjustment screw on the face, three legs in a row.",
    "Macro of a Bourns 3362P trimpot on a neutral background, top-adjust screw and all three leads visible, with a ruler or an 0805 beside it for scale.",
  ),
  check(
    "**Why does the pot deserve a real sealed trimmer instead of the cheapest open-frame part?** The knob is this lesson's user interface. It gets swept constantly, and a scratchy or worn wiper injects noise that looks exactly like the ADC noise you are trying to observe. Instrument quality starts at the source.",
  ),
  dive(
    "Why the pot's own tolerance does not matter here",
    "The 3362P-1-103LF is specified at 10 kΩ **±10 %**, which sounds alarming for a part that sets a measurement. It is not, because a potentiometer wired across a rail is a ratiometric divider: the wiper voltage is the fraction of the track you have turned past, multiplied by the rail. A track that measures 9 kΩ or 11 kΩ divides that rail in exactly the same proportions.\n\nWhat the absolute value does set is the load. 3.3 V across 10 kΩ draws about **0.33 mA** continuously and dissipates about **1.1 mW**, both trivial against the RT9080's 600 mA and the part's 0.5 W rating. Drop to 1 kΩ and you would be pulling 3.3 mA to no benefit; climb to 100 kΩ and the wiper's own output impedance would start to matter to the converter. 10 kΩ is the comfortable middle, which is why it is the value in almost every hobby schematic you will ever read.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "Reading a trimpot's datasheet", "Four things to find, and one of them decides whether your schematic is wired backwards."),
  prose(
    "The same narrow-reading habit you learned on L1.01 works here. You are not reading the 3362 datasheet cover to cover. You want four facts, and the fourth is the one that bites.\n\n**Resistance and taper:** 10 kΩ, linear. A logarithmic taper would make the sweep feel wrong and the top clip arrive somewhere unexpected. **Power:** 0.5 W, against the 1.1 mW you will actually put through it. **Travel:** single turn, about 240 degrees of electrical adjustment inside about 270 degrees of mechanical rotation, so the last few degrees at each end are mechanical stop rather than signal. **And the pinout:** on the 3362, **terminal 2 is the wiper**. The two outer terminals are the ends of the resistive track and are interchangeable; swapping them only reverses which way you turn to go up.",
  ),
  shot(
    "The datasheet page that decides your schematic: which terminal is the wiper.",
    "Bourns 3362 datasheet PDF, the terminal identification / schematic diagram showing terminal 2 as the wiper. Zoom so the terminal numbers are legible at card width.",
  ),
  does("read the trimpot line like a datasheet, not a catalogue entry", [
    {
      text: "Confirm **resistance and taper**: 10 kΩ, **linear**. A log taper is a different part with a different feel and it would move where the clip appears in the sweep.",
      proof: "The product page and the datasheet both say 10 kΩ linear, not log.",
    },
    {
      text: "Confirm the **power rating** against your actual dissipation. 3.3 V across 10 kΩ is about **1.1 mW**, against the part's **0.5 W**. That is not close.",
      proof: "You can state the dissipation and the rating, and say which is larger.",
    },
    {
      text: "Confirm **single turn**, and note the travel: about **240 degrees electrical** inside about 270 degrees of mechanical rotation.",
      proof: "Your note says single turn, and gives the electrical travel.",
    },
    {
      text: "Confirm the **wiper terminal**. On the 3362 it is **terminal 2**, the middle leg. Write it down: this is the fact the schematic stage needs from you.",
      proof: "Your note names terminal 2 as the wiper.",
    },
  ]),
  check(
    "**You wire the wiper to one of the outer terminals by mistake. What does the board do?** The analog pin sees a fixed end of the track rather than the sweep, so the reading sits at 0 V or 3.3 V and never moves when you turn the screw. Nothing is damaged and nothing warns you: the reading is simply dead. Checking terminal 2 at sourcing is cheaper than finding it at bring-up.",
  ),
  gotcha(
    "the outer legs are interchangeable, the middle one is not",
    "Swap the two **end** terminals and the only consequence is that clockwise now sweeps down instead of up. Swap an **end** with the **wiper** and the circuit stops working as a divider entirely. So when you place RV1 on the schematic, check the middle leg first and let the ends fall where they land, as long as the silkscreen and the schematic agree with each other.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The ESD diode you already met", "Same part as L1.03, doing the same job on a different exposed node."),
  prose(
    "**D2 is a Bourns CDSOD323-T05C**, a single-line bidirectional ESD suppressor in a SOD-323 package. You placed this exact part on L1.03, and reusing it is the whole point: the library compounds, the footprint is proven hand-solderable, and you already know how it behaves.\n\nThe numbers that matter for this board are the ones at the *bottom* of the range. Its reverse standoff voltage is **5 V** and its minimum breakdown is **6.0 V**, both comfortably above the 3.3 V your pot can ever produce, so it idles off through the entire legitimate sweep instead of quietly leaking current into your measurement. Its capacitance is about **3 pF**, which is nothing next to the 100 nF sitting further down the path. And it is bidirectional, so it has no electrical polarity: the silkscreen still gets a pin-1 dot so every board in a batch is assembled the same way round.",
  ),
  table(
    ["Spec", "Value", "Why this board cares"],
    [
      ["Reverse standoff", "5 V", "Above the 3.3 V signal, so it stays off in normal use"],
      ["Breakdown, minimum", "6.0 V", "Over 2.7 V of margin above the pot's maximum output"],
      ["Clamping voltage", "9.8 V at 1 A", "It shunts the strike to ground at the exposed node"],
      ["Capacitance", "About 3 pF", "Negligible beside C8's 100 nF"],
      ["Package", "SOD-323, bidirectional", "Leaded, hand-solderable, no electrical polarity"],
    ],
  ),
  shot(
    "SOD-323 beside an 0805: small, leaded, and comfortably within iron reach.",
    "Macro on a neutral background: one SOD-323 diode next to one 0805 resistor, similar scale, both leads and terminations visible.",
  ),
  check(
    "**The diode clamps at 9.8 V, which is well above the 3.6 V the GPIO can survive. So what is it protecting?** It shunts the bulk energy of a static strike to ground at the point where the strike arrives. Holding the leftover current down to something the pin can survive is the series resistors' job, not the diode's. Two parts, two halves of one defence.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Jellybeans, packages, and your drawer", "Four of the five analog lines are parts you already own."),
  prose(
    "R7, R8 and C8 are **jellybeans**: commodity values where any reputable maker's part drops in as long as the value, package, tolerance, dielectric and voltage rating all match. R7 and R8 are the same 10 kΩ 0805 as L1.01's R1 and R2. C8 is the same 100 nF 0805 as C2, C3 and C7. J4 is a three-pin length snapped off the same breakaway header stick as J2 and J3. Four boards into the curriculum, the honest sourcing move is to count what you have before you buy reels twice.\n\nThe package rule has not moved either. This board stays at **0805 and larger** on every passive, because an 0805 is about 2.0 by 1.25 mm and an 0402 is **1.0 by 0.5 mm**, a quarter of the area and genuinely awkward with an iron. Nothing here is harder to place than L1.01's USB-C connector, and the one new part is through-hole.",
  ),
  shot(
    "Scale check: 0805, SOD-323 and the trimpot's 6 mm body, side by side.",
    "Macro on graph paper or beside a ruler: one 0805 passive, one SOD-323 diode and one 3362P trimpot in a row, so relative size reads at a glance.",
  ),
  dive(
    "Why this board never drops below 0805",
    "The package code is the part's size in hundredths of an inch. An 0805 is 0.08 by 0.05 inches, roughly 2.0 by 1.25 mm, about a grain of rice. An 0402 is 1.0 by 0.5 mm: half as long, half as wide, a quarter of the area. Both come in every value you could want, and both cost pennies.\n\nThe difference is entirely about your hands. An 0805 can be held in tweezers, placed onto a tinned pad and soldered with an iron tip you can actually see past. An 0402 really wants solder paste, a stencil and hot air. Since every board in this curriculum is specified to be iron-buildable, 0805 is the floor, and the trimpot being through-hole is a bonus rather than a compromise.",
  ),

  band("orient", "in your BOM · How every line earns its place", "The BOM below is already sourced. Read each line against the four checks, the same four that turned a value into an orderable part on L1.01."),
  does("lock the BOM", [
    {
      text: "**Exact MPN** on every line: a manufacturer plus a full part number. `3362P-1-103LF`, not \"a 10 k trimpot\".",
      proof: "Every line carries a manufacturer and a full part number.",
    },
    {
      text: "**In stock and Active** at your distributor. The 2026-06-26 screen had RV1 at 2,996 pieces and D2 at 3,394, both Active.",
      proof: "Every line shows stock and an Active lifecycle, not end of life.",
    },
    {
      text: "**A package you can hand-solder:** 0805 or larger for passives, leaded SOD-323 for the diode, through-hole for RV1 and J4.",
      proof: "No line on this board is leadless or smaller than 0805.",
    },
    {
      text: "**A second source** named for anything that could strand you. For RV1 that is any 10 kΩ single-turn 6 mm through-hole cermet trimmer, and the 3362 family itself is multi-sourced.",
      proof: "The one new line names a second source you could actually order.",
    },
    {
      text: "**Count your drawer before you fill a cart.** R7, R8 and C8 are values you bought reels of on earlier boards, and J4 snaps off a stick you already have.",
      proof: "Existing reel stock is counted before anything is added to the cart.",
    },
  ]),
  { type: "bomTable", caption: "The live BOM: the L1.01 core plus five analog lines" },
  table(
    ["Ref", "Qty", "MPN", "Package", "Sourcing note"],
    [
      ["RV1", "1", "3362P-1-103LF", "THT 6 mm", "The one new line. Second source: any 10 kΩ single-turn 6 mm cermet trimmer"],
      ["D2", "1", "CDSOD323-T05C", "SOD-323", "Reused from L1.03, already proven hand-solderable"],
      ["R7, R8", "2", "RC0805FR-0710KL", "0805", "Same jellybean as L1.01's R1 and R2"],
      ["C8", "1", "CL21B104KBCNNNC", "0805", "Same jellybean as L1.01's C2, C3 and C7"],
      ["J4", "1", "PRPC040SAAN-RC", "THT 1x3", "Snapped from the same breakaway stick as J2 and J3"],
    ],
  ),
  tube("Source the analog lines: the trimpot, the diode, and the reels you already own"),
  shot(
    "Two fields on every line: stock today, and lifecycle reading Active.",
    "DigiKey product page for 3362P-1-103LF, cropped to the part header plus the stock quantity and lifecycle status fields, both legible at card width.",
  ),
  shot(
    "The whole analog front end in one cart: five lines, one of them new.",
    "DigiKey cart or quick-order page showing the five L1.05 analog lines entered by exact MPN with quantities visible.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: sourcing",
    gate: true,
    questions: [
      {
        id: "pot-quality", reviewId: "pot-quality",
        q: "The trimpot spec (sealed, top-adjust, through-hole) is driven mainly by what?",
        options: [
          "Its role as the constantly-used interface: a worn or scratchy wiper adds noise that pollutes the measurement lesson",
          "Its voltage rating",
          "The board's overall height",
        ],
        answer: 0,
        explain: "This knob gets more human contact than any part in the series, and the data you collect is only as clean as the source. Source it like it matters.",
      },
      {
        id: "single-turn-why",
        q: "Why a single-turn trimmer rather than a 25-turn one?",
        options: [
          "Multi-turn parts are not available in 10 kΩ",
          "The whole sweep has to fit in one wrist movement, so the top clip reads as a moment rather than a spreadsheet",
          "Multi-turn parts cannot be hand-soldered",
        ],
        answer: 1,
        explain: "About 240 degrees of electrical travel puts 0 V to 3.3 V under one turn of a screwdriver, which is what makes the clip watchable.",
      },
      {
        id: "wiper-terminal", reviewId: "wiper-terminal",
        q: "On the 3362, which terminal is the wiper?",
        options: [
          "Terminal 1",
          "Terminal 3",
          "Terminal 2, the middle leg",
        ],
        answer: 2,
        explain: "The two outer terminals are the ends of the resistive track and are interchangeable. Get the middle one wrong and the reading never moves.",
      },
      {
        id: "pot-tolerance",
        q: "RV1 is specified at 10 kΩ ±10 %. Why does that tolerance not hurt the measurement?",
        options: [
          "A pot across a rail is a ratiometric divider: the wiper voltage is a fraction of the rail, whatever the track's absolute value",
          "The calibration data corrects for it",
          "±10 % is within the ADC's own error band",
        ],
        answer: 0,
        explain: "A 9 kΩ track and an 11 kΩ track divide the same rail in the same proportions. What the absolute value sets is the current drawn, about 0.33 mA here.",
      },
      {
        id: "jellybean-recall",
        q: "R7, R8 and C8 needed no new sourcing work. Why?",
        options: [
          "They are optional parts",
          "They ship with the trimpot",
          "They are jellybean values already on reels from earlier boards: the same commodity-substitution rule L1.01 taught",
        ],
        answer: 2,
        explain: "The parts library compounds and so does your drawer. Count what you have before buying the same reel twice.",
      },
    ],
  },

  exit(
    "Five analog lines, one part worth choosing carefully, and four you can pull from a drawer. Every line carries an exact MPN, shows stock and an Active lifecycle, sits in a package you can solder by hand, and names a backup. The quick check above is the gate, and there is nothing to attach here.",
  ),

  ref("Bourns 3362 Trimpot datasheet: resistance range, 0.5 W rating, single-turn travel and the terminal 2 wiper", "https://www.bourns.com/docs/Product-Datasheets/3362.pdf"),
  ref("Bourns CDSOD323-TxxC TVS diode array datasheet: standoff, breakdown, clamping voltage and capacitance", "https://bourns.com/docs/Product-Datasheets/CDSOD323-TxxC.pdf"),
  ref("ESP32-S3 Series Datasheet (Espressif): the ADC characteristics measured with an external 100 nF capacitor", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "BOM_SOURCING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
