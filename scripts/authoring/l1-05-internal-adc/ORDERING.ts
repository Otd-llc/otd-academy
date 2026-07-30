// L1.05 internal ADC — ORDERING card.
//
// Authored ahead of the board, with L1.01's ORDERING card as gospel for both
// carts: PCBWay at 4 layers, 1.6 mm and ENIG with a quantity of 5, and DigiKey
// by exact MPN with MOQ and second sources handled.
//
// The board-specific beat is that this lesson compares the converter against
// the learner's own multimeter, which makes the meter the reference instrument
// of the whole lesson. So the meter gets checked before the boards arrive,
// rather than being discovered as untrustworthy at bring-up.
//
// The card this replaces was 5 blocks against the 24-block bar.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Ordering is a handful of choices and a lot of double-checking. Two carts, your boards at **PCBWay** and your parts at **DigiKey**, plus one preparation that is specific to this board: at bring-up you will hold the converter's answer against your multimeter, so the meter is about to become this lesson's reference instrument. Confirm it while the boxes are still in transit.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in your browser · Order the boards", "Hands on at PCBWay: upload the zip, set three options, order a few spares."),
  sect("01", "Ordering the PCB", "Three options turn your Gerbers into physical boards, and the third one is the only interesting choice."),
  prose(
    "Upload the zip you exported last stage and pick the options: **4 layers**, because this board needs its two inner ground planes and the analog run depends on one of them being continuous; **1.6 mm** thickness, which is standard; and a surface finish. [[HASL]] is cheap and slightly lumpy, [[ENIG]] is flat gold and better for the WROOM's fine-pitch pads.\n\nOrder a few spares. The extra board is nearly free and the shipping is not, and on a board you are going to prod with a screwdriver and a probe for an afternoon, a spare is worth having.",
  ),
  does("upload and configure at PCBWay", [
    {
      text: "On PCBWay's **instant-quote / Gerber upload** page, drop in the **`.zip` you exported last stage**. It auto-detects the board and renders a preview. Glance that the outline looks right and it reads **4 layers**.",
      proof: "The preview renders your board outline and reads 4 layers.",
    },
    {
      text: "Set the three options: **Layers = 4**, **Thickness = 1.6 mm**, **Surface finish = ENIG**. Leave everything else at PCBWay's defaults.",
      proof: "The order reads 4 layers, 1.6 mm, ENIG.",
    },
    {
      text: "**Quantity 5**, the usual minimum. Spare boards are nearly free; a second shipping run is not.",
      proof: "Quantity is 5 and the order is placed.",
    },
  ]),
  shot(
    "Drop the zip: PCBWay previews the board it will build.",
    "PCBWay instant-quote / Gerber upload page right after the L1.05 zip uploads: the upload area plus the auto-rendered board preview showing the outline.",
  ),
  shot(
    "The three options that matter: 4 layers, 1.6 mm, ENIG.",
    "PCBWay quote page options column, cropped to highlight Layers = 4, Thickness = 1.6 mm and Surface Finish = ENIG. Not the whole pricing sidebar.",
  ),
  { type: "vendorCta", vendor: "pcbway-order", label: "Order your boards at PCBWay" },
  check(
    "**Your board has the fine-pitch WROOM pads. HASL or ENIG?** ENIG. Its dead-flat surface lets every fine-pitch pad meet the module at the same height, where lumpy HASL invites a missed joint you cannot see once the module is down.",
  ),
  dive(
    "ENIG against HASL, and when the upcharge is not worth it",
    "Bare copper pads tarnish, so the fab coats them. HASL dips the board in molten solder and blows the excess off with hot air: cheap, very solderable, and it leaves each pad slightly domed and uneven in height. ENIG plates a flat layer of nickel capped with a thin gold flash: dead flat, long shelf life, a little pricier.\n\nFor through-hole and 0805 work, HASL is perfectly fine, and RV1 and J4 would not notice the difference. The WROOM's underside pads are what earn the upgrade: they are fine-pitch and packed close, and uneven bumps there invite a missed or bridged joint under a part you cannot inspect. Match the finish to the board rather than always reaching for the better one.",
  ),
  {
    type: "callout", severity: "info", label: "Not sure your layout is right?",
    body: "You do not have to bet a board on it. Download the reference design, the lesson's canonical board exported and zipped ready for the fab, and order that instead of or alongside your own. You still did the design work; this just means a slip in layout does not cost you a board and a week's wait.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "in your browser · Order the parts, and check your meter", "Hands on at DigiKey, then five minutes at the bench with the instrument this lesson trusts."),
  sect("02", "Ordering the parts, and the one instrument to check first", "A short cart on this board, and one thing to verify that is not on any BOM."),
  prose(
    "Order every line by its exact [[MPN]]. Mind the [[MOQ]], since passives come on reels of thousands, and buy a few extra of anything you will hand-place and inevitably drop. On this board the cart should be short: the trimpot and the ESD diode are the only lines you are likely to be missing, because R7, R8 and C8 are jellybean values from earlier boards and J4 snaps off a header stick you already have.\n\nThen the part that is not a part. This lesson's whole method is comparing the ADC's answer against a meter, which makes **your multimeter the reference** the conclusions rest on. A meter with a tired battery reads low and drifts, and if you discover that at bring-up you will spend an evening blaming the converter. Fresh batteries, a DC range you have sanity-checked against a known voltage, and you are ready.",
  ),
  does("fill the parts cart, then check the bench", [
    {
      text: "Work straight down the BOM and search DigiKey by the **exact MPN**. The right product page echoes it back character for character.",
      proof: "Each product page echoes your MPN back character for character.",
    },
    {
      text: "**Count your drawer first.** R7, R8 and C8 are values you bought reels of on earlier boards, and J4 snaps off a stick you already own. Buy the gaps rather than the list.",
      proof: "The cart reflects actual gaps rather than a reflex re-buy of the whole BOM.",
    },
    {
      text: "Add the two lines you probably do need: **RV1 (3362P-1-103LF)** and **D2 (CDSOD323-T05C)**, plus a spare of each. RV1 is through-hole and forgiving; D2 is a SOD-323 and small enough to lose.",
      proof: "RV1 and D2 are in the cart with spares.",
    },
    {
      text: "If a line is **out of stock**, swap in the second source you named at sourcing, by its exact MPN rather than a lookalike. For RV1 that is any 10 kΩ single-turn 6 mm cermet trimmer.",
      proof: "Any out-of-stock line is replaced by the named second source, by exact MPN.",
    },
    {
      text: "Before checkout, count cart lines against BOM gaps, then place the order.",
      proof: "Cart lines and outstanding BOM lines match one for one.",
    },
    {
      text: "**Check your multimeter.** Fresh batteries, then read a known voltage on the DC range: a fresh alkaline cell should sit near 1.5 V, and a USB rail near 5 V.",
      proof: "Your meter reads a known reference within its own stated accuracy.",
    },
    {
      text: "**Note your meter's DC accuracy** from its manual, usually a percentage of reading plus a count or two. You are about to compare it against a ±50 mV spec, so knowing its own error keeps the comparison honest.",
      proof: "You can state your meter's DC accuracy figure before bring-up.",
    },
  ]),
  { type: "bomTable", caption: "The BOM to shop against: the core plus five analog lines", collapsed: true },
  shot(
    "The whole cart in one pass: every line by exact MPN, spares where you will drop them.",
    "DigiKey cart or quick-order page with the L1.05 lines entered by exact MPN and quantities visible, enough rows to show the line-by-line flow.",
  ),
  { type: "vendorCta", vendor: "digikey-bom", label: "Shop the BOM at DigiKey" },
  shot(
    "The reference instrument: your meter, on DC volts, reading something you already trust.",
    "Bench shot: a multimeter in DC-V mode with probes on a known reference such as a fresh alkaline cell, display legible.",
  ),
  tube("Place both orders, and prove your meter before the boards arrive"),
  check(
    "**Why does the ordering stage care about your multimeter?** Bring-up compares the converter against the meter, so the meter is the reference the whole lesson leans on. A chain of trust starts at the bench, which is why it gets checked before the boards land rather than during the experiment.",
  ),
  gotcha(
    "a meter that is accurate enough for a rail and not for this",
    "Most cheap meters are specified around a percent of reading on DC, which is fine for confirming a 3.3 V rail. You are about to use one to judge a ±50 mV claim near 1.6 V, and a percent of 1.6 V is 16 mV of the budget before the board has done anything. That does not make the experiment invalid, it makes the number worth knowing, so read your meter's spec and carry it into the comparison.",
  ),
  {
    type: "callout", severity: "info", label: "What arrives when",
    body: "Parts usually ship in a few days; boards take about a week to fabricate, plus shipping. Place both orders the same day and the two boxes tend to land together, so nothing stalls assembly.",
  },
  trace(
    "Before you close the tabs",
    [
      { text: "The PCB order reads **4 layers, 1.6 mm, ENIG**, quantity 5", help: "Four layers is not optional here: the analog run depends on a continuous inner plane beneath it." },
      { text: "The parts cart covers the **gaps**, not the whole BOM", help: "Four boards of reels have accumulated. Buying the list again is how a $12 board costs $40." },
      { text: "Both orders are **attached to a build** on the stage gate", help: "The build is what ties a physical board back to the exact design it was fabricated from." },
      { text: "Your **meter has fresh batteries** and you know its DC accuracy", help: "You are about to use it as a reference. An instrument you have not checked is an assumption, not a measurement." },
    ],
  ),

  {
    type: "quiz",
    prompt: "Quick check: ordering",
    gate: true,
    questions: [
      {
        id: "meter-reference", reviewId: "meter-reference",
        q: "Why does this board's ordering stage ask you to check your multimeter?",
        options: [
          "It ships with the kit",
          "Bring-up compares the converter against the meter, so the meter is the lesson's reference instrument and has to be trusted first",
          "The fab requires a calibration certificate",
        ],
        answer: 1,
        explain: "You are about to measure a measurer. The chain of trust starts at the bench meter, so it gets checked before the boards land.",
      },
      {
        id: "enig-fine-pitch",
        q: "Your board has the fine-pitch WROOM pads. Which surface finish solders them more reliably?",
        options: [
          "It makes no difference",
          "HASL, which is cheaper and slightly lumpy",
          "ENIG, whose flat surface lets every fine-pitch pad meet the module at the same height",
        ],
        answer: 2,
        explain: "Uneven HASL bumps invite a missed joint under a part you cannot inspect once it is soldered down.",
      },
      {
        id: "drawer-first", reviewId: "drawer-first",
        q: "What cart discipline does this board's lean BOM reward?",
        options: [
          "Counting existing reel stock before re-buying jellybeans",
          "Buying everything fresh so the parts match",
          "Skipping the exact-MPN rule for passives",
        ],
        answer: 0,
        explain: "Four boards of reels accumulate. The parts library compounds and so does your drawer.",
      },
      {
        id: "four-layers-why",
        q: "Why order this as a 4-layer board rather than saving money on 2 layers?",
        options: [
          "Four layers are required for USB",
          "The two inner ground planes are what give the analog run and the USB pair a continuous return path beneath them",
          "PCBWay does not make 2-layer boards",
        ],
        answer: 1,
        explain: "On this board the plane under the analog run is part of the measurement, not just part of the routing.",
      },
      {
        id: "second-source-payoff",
        q: "A line on your BOM is out of stock when you go to order. What helps most?",
        options: [
          "Cancelling the project",
          "Ordering a random similar-looking part",
          "The second source you named back at sourcing, ordered by its exact MPN",
        ],
        answer: 2,
        explain: "A compatible backup identified ahead of time turns a dead stop into a quick swap. For RV1 that is any 10 kΩ single-turn 6 mm cermet trimmer.",
      },
      {
        id: "spare-boards",
        q: "Why order a few spare PCBs?",
        options: [
          "The fab requires a minimum of five",
          "An extra board is nearly free, but a second shipping run is not",
          "Spare boards appreciate in value",
        ],
        answer: 1,
        explain: "The extra board costs almost nothing. Re-ordering because you only got one and damaged it costs a week.",
      },
    ],
  },

  exit(
    "Two orders placed and one instrument checked. Create the build, attach the PCB order and the parts order to it, and put the meter somewhere you will not have to hunt for it. Assembly is next.",
  ),

  ref("PCBWay's KiCad design-rules file and process capabilities (the .zip is in the KiCad folder)", "https://github.com/pcbway/PCBWay-Design-Rules"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "ORDERING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
