// L1.03 WS2812 node — ORDERING card.
//
// Authored from docs/boards/l1-03-ws2812-node/{design.md,bom.csv} with L1.01's
// ORDERING card as gospel: the PCBWay flow (4 layers, 1.6 mm, ENIG, quantity 5),
// the ENIG-vs-HASL reasoning for the WROOM's fine-pitch pads, ordering every
// line by exact MPN, MOQ and spares, and the second-source payoff.
//
// The card this replaces was 6 blocks against L1.01's 24.
//
// NEW: this is the first board in the curriculum where the learner buys things
// that are NOT on the BOM, and both of them can destroy the board.
//   - the strip. "Addressable" is a family, not a part, and the 12 V members of
//     it (WS2815 and friends) look identical in a listing. Web-verified 2026-07:
//     WS2815 is 12 V with dual data lines; WS2812B is 5 V. J5 says 5 V only.
//   - the injection supply, which design.md requires to be a REGULATED 5 V of
//     5.25 V or less AND fused or current-limited, because D2's protection
//     against a wrong supply is sacrificial and only works if something
//     upstream clears the fault (RK10/RK12/F10-3).
//
// The ws2812-power-supply calculator is embedded here, where the learner is
// actually choosing what to buy.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Ordering: two carts, one strip, and the supply that has to be fused"),

  prose(
    "Ordering is mostly a handful of choices and a lot of double-checking. On the earlier boards there were two carts: your boards at **PCBWay** and your parts at **DigiKey**.\n\nThis board adds a third kind of purchase, and it is the one to be careful with. **The strip and its power supply are not on the BOM**, because they are not part of the board. They are what the board drives, and both of them can destroy it if you buy the wrong thing. The BOM has been checked for you. These two have not, because only you know how long a strip you want.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in your browser · Order the boards", "Hands on at PCBWay: upload the zip, set three options, order a few spares."),
  sect("01", "Ordering the PCB", "A few options turn your Gerbers into physical boards."),
  prose(
    "Upload the [[gerber|Gerber]] zip to PCBWay and pick the options: a **4-layer** board, because this one needs the two inner ground planes; a **thickness**, where 1.6 mm is standard; and a **surface finish**, [[HASL]] or [[ENIG]]. Order a few spares. The extra board is nearly free and the shipping is not.\n\nThe finish choice is the same one L1.01 faced and the answer is the same, for the same reason: this board still carries the WROOM's fine-pitch underside pads.",
  ),
  does("upload and configure at PCBWay", [
    {
      text: "On PCBWay's **instant-quote and Gerber upload** page, drop in **the `.zip` you exported last stage**. It auto-detects the board and renders a preview. Glance that the outline looks right and it reads **4 layers**.",
      proof: "The preview renders your board outline and reads 4 layers.",
    },
    {
      text: "Set the three options that matter: **Layers 4**, **Thickness 1.6 mm**, **Surface finish ENIG**. Leave everything else at PCBWay's defaults.",
      proof: "The order reads 4 layers, 1.6 mm, ENIG.",
    },
    {
      text: "**Quantity 5**, the usual minimum. Spare boards are nearly free and shipping is the real cost. Add to cart and check out.",
      proof: "Quantity is 5 and the order is placed.",
    },
  ]),
  shot(
    "Drop the zip: PCBWay previews the board it will build.",
    "PCBWay instant-quote and Gerber upload page right after the zip uploads: the upload area and the auto-rendered board preview.",
  ),
  shot(
    "The three options that matter: 4 layers, 1.6 mm, ENIG.",
    "PCBWay quote page options column: highlight Layers 4, Thickness 1.6 mm, Surface Finish ENIG, rather than the whole pricing sidebar.",
  ),
  check(
    "**Your board has the fine-pitch WROOM module pads. HASL or ENIG?** ENIG. Its flat surface lets every fine-pitch pad meet the module at the same height, where lumpy HASL invites a missed joint you cannot see under the module.",
  ),
  dive(
    "ENIG and HASL: why the finish matters here",
    "Bare copper pads tarnish, so the fab coats them. [[HASL]], hot-air solder levelling, dips the board in molten solder and blows the excess off with hot air: cheap and very solderable, but it leaves the pads slightly domed and uneven in height. [[ENIG]] plates a flat layer of nickel capped with a thin gold flash: dead flat, long shelf life, a little pricier.\n\nFor through-hole and 0805 work HASL is perfectly fine. The WROOM's underside pads are fine-pitch and packed close, and there a flat surface lets every pad meet the module at the same height. Uneven HASL bumps invite a missed or bridged joint you cannot even see once the module is down.\n\nThis board gives you a second reason to want flat. **The 5050 pixel's four pads sit partly under its body**, which is the same problem in miniature: you cannot inspect the joint, so you want every condition that makes it form correctly on the first attempt.",
  ),
  {
    type: "vendorCta", vendor: "pcbway-order", label: "Order your boards at PCBWay",
    sublabel: "Upload your Gerber zip here, choose 4-layer and ENIG, order a few spares. Affiliate link. It supports the academy at no extra cost to you.",
  },
  {
    type: "callout", severity: "info", label: "Not sure your layout is right?",
    body: "You do not have to bet a board on it. Download the reference design, this lesson's canonical board, exported and zipped ready for the fab, and order that instead of or alongside your own. You still did the design work. This just means a slip in layout does not cost you a board and a week's wait.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "in your browser · Order the parts", "Hands on at DigiKey: every line by its exact part number, and mind the minimums."),
  sect("02", "Ordering the parts", "Twenty-five lines, nine of them new, and a few traps."),
  prose(
    "Order every line from DigiKey by its exact manufacturer part number. Mind the minimum order quantity, because passives come on reels of thousands, and buy extras of anything you will hand-place and lose.\n\nIf a line is out of stock, this is where the second sources you noted at sourcing pay off. This board is unusually well provided for on that front, because four of its lines already went through a substitution once and each named its predecessor as the alternate.",
  ),
  does("fill the parts cart at DigiKey", [
    {
      text: "Open your BOM from the sourcing stage and work straight down it. Search DigiKey by the **exact part number**: the right product page echoes it back character for character, rather than showing you a 470 ohm resistor that happens to be close.",
      proof: "Each product page echoes your part number back character for character.",
    },
    {
      text: "Set quantities. Where a line has a minimum order quantity, buy the minimum pack, since a reel of passives costs cents, and add extras of every part you will hand-place.",
      proof: "Every part you will hand-place has spares in the cart.",
    },
    {
      text: "**Buy at least two of LED3.** The 5050 pixel is the joint most likely to go wrong on this board, and the failure mode is a cooked part rather than a joint you can rework. One spare turns a bad afternoon into a ten-minute setback.",
      proof: "The cart holds at least two pixels.",
    },
    {
      text: "**Buy a spare U3 too.** It is a 40 cent part in a leaded package, and having one on the bench means a suspected shifter is a swap rather than a diagnosis.",
      proof: "The cart holds a spare 74AHCT125.",
    },
    {
      text: "If a line is **out of stock**, swap in the alternate named on that BOM line, again by its exact part number and never a lookalike.",
      proof: "Any out-of-stock line is replaced by the alternate from the BOM, by its exact part number.",
    },
    {
      text: "Before checkout, count cart lines against BOM lines. Every line accounted for, then place the order.",
      proof: "Cart lines and BOM lines match one for one.",
    },
  ]),
  shot(
    "The whole BOM in one cart: every line by exact part number.",
    "DigiKey cart or quick-order page with several L1.03 BOM lines entered by exact MPN and quantities visible, enough rows to show the line-by-line flow.",
  ),
  check(
    "**You need four 470 ohm resistors but they sell in reels of 5,000. What now?** Buy the reel. It costs cents, and you will use them. Always order a few extra of anything you hand-place.",
  ),
  {
    type: "vendorCta", vendor: "digikey-bom", label: "Shop the BOM at DigiKey",
    sublabel: "Search each part number from your BOM and add it to the cart. Affiliate link. It supports the academy at no extra cost to you.",
  },

  // ── 03 ────────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "warn", label: "03 · The two things you buy that are not on the BOM",
    body: "A strip and a supply. Nobody has checked these for you, and both can end the board.",
  },
  prose(
    "**Addressable LED strip is a family, not a part.** Listings use the words interchangeably, and the members differ in ways that matter enormously here. The one that will hurt you is voltage. **WS2812B strips run on 5 V. WS2815 strips run on 12 V**, with a second data line for redundancy, and they look identical in a photograph.\n\nYour board's injection terminal says 5 V only, and its TVS is sized to defend that. Put 12 V into it and the clamp does what it was designed to do, sacrificially, once.\n\nSo when you buy a strip, read the voltage before the pixel count, before the density, before the price. Then read it again on the reel itself when it arrives, because listings are wrong more often than reels are.",
  ),
  table(
    ["What to check", "What you want", "What goes wrong"],
    [
      ["Voltage", "5 V", "A 12 V strip is a different part family. It will not run and your TVS takes the hit"],
      ["Protocol", "WS2812B or a stated compatible", "A 4-wire clocked type needs a second signal this board does not provide"],
      ["Wire count", "Three: 5 V, data, ground", "Four wires usually means 12 V or a clocked protocol"],
      ["Pixel count", "Whatever your supply can feed", "Sixty milliamps per pixel at full white adds up faster than people expect"],
      ["Ends", "Bare wire or a connector you can cut off", "J4 is a screw terminal, so you want strippable wire"],
    ],
  ),
  { type: "calculator", slug: "ws2812-power-supply", caption: "Size the strip supply for the pixel count you are actually buying" },
  prose(
    "**The supply has three requirements and all three are load-bearing.** It must be **regulated**, so its output stays at 5 V rather than drifting up when lightly loaded. It must be **5.25 V or less**, because that is the ceiling this board's protection was designed around. And it must be **fused or current-limited**, which is the one people skip.\n\nThat last requirement is worth understanding rather than obeying. The TVS across the injection terminal protects you from a wrong supply by conducting hard, and a part conducting hard on a rail that can deliver unlimited current does not survive and does not stop. **What actually ends the fault is something upstream giving up**: a fuse in the supply, or a current limit that folds back. There is no fuse on this board's external rail, and the design says so plainly rather than pretending otherwise. Your supply's protection is the protection.\n\nA bench supply with an adjustable current limit is the ideal answer and doubles as a diagnostic tool at bring-up. A sealed 5 V brick with a fuse inside is the practical answer. An unfused, unregulated wall wart is the one to avoid.",
  ),
  does("choose the strip and the supply", [
    {
      text: "**Check the strip's voltage first.** You want a **5 V WS2812B strip or a stated compatible**. If a listing says 12 V, or mentions WS2815, or shows four wires, it is the wrong family for this board.",
      proof: "The strip you chose is explicitly 5 V with three wires.",
    },
    {
      text: "**Work out the current** for the pixel count you are buying, at full white, using the calculator above. Then choose a supply with headroom over that number rather than exactly it.",
      proof: "You have a current figure for your strip at full white and a supply rated above it.",
    },
    {
      text: "**Confirm the supply is regulated and 5.25 V or less.** A listing that says only 5 V DC without saying regulated is worth skipping, because an unregulated supply can sit noticeably high with no load.",
      proof: "The supply's listing states a regulated output at 5 V.",
    },
    {
      text: "**Confirm it is fused or current-limited.** This is the requirement that keeps a wrong-supply mistake sacrificial rather than terminal, because there is no fuse on the board's external rail.",
      proof: "The supply has a stated fuse or an adjustable current limit.",
    },
    {
      text: "**Check the ends of the strip.** J4 is a screw terminal, so you want bare wire or a connector you are willing to cut off. Buying a strip with a proprietary plug means your first job is destroying it.",
      proof: "The strip's leads can be stripped and screwed into a terminal.",
    },
  ]),
  shot(
    "What to look for on a reel: the voltage, printed where you can read it.",
    "Close-up of a WS2812B strip reel or its packaging with the 5 V rating and the three-wire lead clearly legible, ideally beside a 12 V strip for contrast.",
  ),
  tube("Choosing a strip and a supply without buying the wrong family"),
  check(
    "**A listing says addressable RGB LED strip, 60 pixels per metre, individually controllable, 12 V. Can you use it?** No. Twelve volt addressable strips are a different family with a different chip, and this board's terminal is labelled 5 V only for a reason. The word addressable tells you almost nothing about compatibility on its own.",
  ),
  gotcha(
    "the supply is your only fuse on that rail",
    "The board's polyfuse protects the USB side. **There is no fuse on the external 5 V rail**, and the design documents that as an accepted limitation rather than hiding it. So if a stray strand of wire shorts the strip's supply across the terminal, the only thing that ends that fault is your supply's own protection. Buy a supply that has some.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "What it costs and what arrives when", "Two carts, one strip, one supply, and a week."),
  prose(
    "The board's parts land at roughly **18 to 19 dollars**, which is over the design's own 14 to 15 dollar target, and the two screw terminals are most of the difference. That figure covers the BOM only. The strip and the supply are yours to choose and are not in it.\n\nParts usually ship in a few days. Boards take about a week to fabricate plus shipping. Place both orders the same day and the two boxes tend to land together, so nothing stalls assembly. The strip and supply are worth ordering at the same time even though you will not need them for the graded part of the lesson, because the onboard pixel proves the concept on USB alone.",
  ),
  trace("Before you close all four tabs", [
    { text: "The PCB order reads **4 layers, 1.6 mm, ENIG**, quantity 5", help: "The finish is the one that matters for the module's fine-pitch pads and the pixel's hidden ones." },
    { text: "Every BOM line is in the DigiKey cart **by exact part number**, with spares of the hand-placed parts", help: "Count cart lines against BOM lines. Twenty-five lines, and a missing one stalls a build for a week." },
    { text: "**At least two pixels and a spare shifter** are in the cart", help: "The pixel is the joint most likely to go wrong, and its failure mode is a cooked part rather than a reworkable joint." },
    { text: "The strip is **5 V**, three-wire, WS2812B or a stated compatible", help: "Twelve volt strips are a different family and look identical in a listing. Read the reel when it arrives too." },
    { text: "The supply is **regulated, 5.25 V or less, and fused or current-limited**", help: "There is no fuse on the board's external rail, so this supply's protection is the only protection that rail has." },
  ]),

  {
    type: "quiz",
    prompt: "Quick check: ordering",
    gate: true,
    questions: [
      {
        id: "strip-voltage-family", reviewId: "l103-strip-voltage",
        q: "A strip is listed as addressable RGB, individually controllable, 12 V. Can you drive it from this board?",
        options: [
          "Yes. Addressable is addressable",
          "No. Twelve volt addressable strips are a different chip family, and this board's terminal is 5 V only",
          "Only if you halve the brightness",
        ],
        answer: 1,
        explain: "WS2812B strips run on 5 V; the 12 V families such as WS2815 use a different chip and often a second data line. The word addressable says almost nothing about compatibility.",
      },
      {
        id: "supply-must-be-fused", reviewId: "l103-supply-fused",
        q: "Why must the strip's supply be fused or current-limited?",
        options: [
          "So the strip does not draw too much current in normal use",
          "Because USB requires it of anything sharing a ground",
          "Because the board's polyfuse cannot reach that rail, and the TVS protecting it is sacrificial, so only something upstream can end a fault",
        ],
        answer: 2,
        explain: "There is no fuse on the external 5 V rail, and the design records that as an accepted limitation. Your supply's protection is that rail's protection.",
      },
      {
        id: "enig-fine-pitch",
        q: "Your board has the fine-pitch WROOM pads and a 5050 pixel with pads under its body. Which surface finish?",
        options: [
          "ENIG: flat gold, so every hidden pad meets its part at the same height",
          "HASL: cheaper, and slightly lumpy",
          "It makes no difference",
        ],
        answer: 0,
        explain: "Both of this board's hardest joints are ones you cannot inspect, so you want every condition that helps them form on the first attempt.",
      },
      {
        id: "spare-pixel",
        q: "Why buy a spare pixel rather than just a spare resistor?",
        options: [
          "Pixels are cheaper in pairs",
          "The pixel is the joint most likely to go wrong, and its failure mode is a heat-damaged part rather than a joint you can rework",
          "You need two pixels for the chain to work",
        ],
        answer: 1,
        explain: "A bridged resistor is a wick-and-retry. A cooked lens is a new part, and without one on the bench that is a week's wait.",
      },
      {
        id: "spare-boards",
        q: "Why order a few spare PCBs?",
        options: [
          "Spares are worth more later",
          "The fab requires it",
          "An extra board is nearly free, and a second shipping run is not",
        ],
        answer: 2,
        explain: "The marginal board costs almost nothing. Re-ordering because you only got one and damaged it costs time and shipping.",
      },
      {
        id: "second-source-payoff",
        q: "A part on your BOM is out of stock when you go to order. What helps most?",
        options: [
          "Ordering a similar-looking part",
          "The alternate named on that BOM line",
          "Cancelling the project",
        ],
        answer: 1,
        explain: "Four of this board's lines already went through a substitution once, and each kept its predecessor as the alternate, so the fallback is written down rather than improvised.",
      },
      {
        id: "order-by-mpn",
        q: "How should you order each line of the BOM?",
        options: [
          "By a general value, like a 10k resistor",
          "By whatever is cheapest that day",
          "By its exact manufacturer part number",
        ],
        answer: 2,
        explain: "The exact part number is what guarantees you get the part that actually fits the pads you laid out.",
      },
    ],
  },

  exit(
    "Create the build, then attach the PCB order and the parts order to it. The strip and the supply are not build artifacts, so nothing tracks them, which is exactly why the checklist above exists. Next stage is a soldering iron and the hardest joint in this curriculum so far.",
  ),

  ref("WS2812B datasheet (Worldsemi): the 5 V part this board's terminal and protection are designed around", "https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf"),
  ref("PCBWay PCB capabilities: layer count, thickness and surface-finish options", "https://www.pcbway.com/capabilities.html"),
  ref("SMAJ series TVS datasheet (Littelfuse): the standoff and clamping voltages that set the 5.25 V supply ceiling", "https://www.littelfuse.com/products/tvs-diodes/surface-mount/smaj"),
  ref("Adafruit NeoPixel Uberguide: choosing a strip, choosing a supply, and power budgeting", "https://learn.adafruit.com/adafruit-neopixel-uberguide"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "ORDERING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
