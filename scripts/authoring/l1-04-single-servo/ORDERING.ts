// L1.04 single-servo driver — ORDERING card.
//
// L1.01's ORDERING card is gospel and this board changes almost none of it: the
// same PCBWay flow (upload the zip, 4 layers, 1.6 mm, ENIG for the WROOM's
// fine-pitch pads, order spares), the same DigiKey pass down the BOM by exact
// MPN with MOQ and second sources, the same lead-time advice.
//
// What is new is that this build has a THIRD order the BOM cannot contain: the
// servo and its supply. Both have real specifications from design.md (micro
// class up to MG90S, 3.3 V signal compatible, regulated 5 V at 2 A or better
// with a hard 5.5 V ceiling), and a learner who buys the wrong one of either
// discovers it at bring-up, a week later.
//
// The second-source lines come from design.md §8: F2 -> Bel Fuse 0ZCG0150FF2C,
// D2 -> any 40 V / 3 A SMC Schottky, D3 -> another maker's SMAJ6.0A.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Ordering is a handful of choices and a lot of double-checking. On L1.01 there were two carts: your boards at **PCBWay**, your parts at **DigiKey**. This build has **three**, because the servo and its power supply are not on the BOM. They do not get soldered to anything, so the parts list has no line for them, and a build that arrives without them stops dead at bring-up.\n\nEverything else is the flow you already know.",
  ),

  band("do", "in your browser · Order the boards", "Hands on. Upload the zip, set three options, order a few spares."),
  sect("01", "Ordering the PCB", "A few options turn your Gerbers into physical boards."),
  prose(
    "Upload the [[Gerber]] zip to PCBWay and pick the options: a **4-layer** board, because this design needs the two inner ground planes; a **thickness**, where 1.6 mm is standard and is what your stackup says; and a **surface finish**, [[HASL]] (cheap, slightly lumpy) or [[ENIG]] (flat gold, better for the WROOM's fine-pitch pads).\n\nOrder a few spares. The extra board is nearly free and the shipping is not.",
  ),
  does("upload and configure at PCBWay", [
    {
      text: "On PCBWay's **instant-quote / Gerber upload** page, drop in **the `.zip` you exported last stage**. It auto-detects the board and renders a preview. Glance that the outline looks right and it reads **4 layers**.",
      proof: "The preview renders your board outline and reads 4 layers.",
    },
    {
      text: "Set the three options that matter: **Layers = 4**, **Thickness = 1.6 mm**, **Surface finish = ENIG**. Leave everything else at PCBWay's defaults.",
      proof: "The order reads 4 layers, 1.6 mm, ENIG.",
    },
    {
      text: "**Quantity: 5**, the usual minimum. Spare boards are nearly free and shipping is the real cost, and on this board a spare is worth more than usual: it is the first board in the course where a single wiring mistake at the screw terminal can damage parts.",
      proof: "Quantity is 5 and the order is placed.",
    },
  ]),
  {
    type: "image", src: "", reveal: "",
    alt: "PCBWay instant-quote page with the Gerber zip uploaded and the board preview rendered.",
    caption: "Drop the zip: PCBWay previews the board it will build.",
    captureHint: "PCBWay instant-quote page right after the zip uploads: the upload area and the auto-rendered board preview for the L1.04 board.",
  },
  {
    type: "image", src: "/guide-diagrams/hasl-vs-enig.svg",
    alt: "Cross-section comparing HASL and ENIG under fine-pitch pads: HASL's solder domes are uneven so one joint never forms; ENIG is flat and every pad meets the module.",
    caption: "HASL leaves each pad domed a slightly different height. ENIG is dead flat, and under the WROOM that flatness decides whether every joint forms.",
  },
  check(
    "**Your board has the fine-pitch WROOM pads. HASL or ENIG?** ENIG. Its flat surface lets every one of those packed pads meet the module at the same height, where lumpy HASL invites a missed or bridged joint you cannot see once the module is down.",
  ),
  dive(
    "ENIG versus HASL, and when the upcharge is not worth it",
    "Bare copper pads tarnish, so the fab coats them. [[HASL]] dips the board in molten solder and blows the excess off with hot air: cheap and very solderable, but it leaves the pads slightly domed and uneven in height. [[ENIG]] plates a flat layer of nickel capped with a thin gold flash: dead flat, long shelf life, a little pricier.\n\nFor through-hole and 0805 work HASL is perfectly fine, and most of this board is exactly that. What tips it is the WROOM's underside pads, which are fine-pitch and packed close, and where a flat surface lets every pad meet the module at the same height.\n\nSo the rule is to match the finish to the hardest part on the board, not to always upgrade. A board of nothing but screw terminals, electrolytics and 0805s would not need ENIG at all.",
  ),
  {
    type: "vendorCta", vendor: "pcbway-order", label: "Order your boards at PCBWay",
    sublabel: "Upload your Gerber zip here, choose 4-layer and ENIG, and order a few spares. Affiliate link. It supports the academy at no extra cost to you.",
  },
  {
    type: "callout", severity: "info", label: "Not sure your layout is right?",
    body: "You do not have to bet a board on it. Download the reference design, this lesson's canonical board exported and zipped ready for the fab, and order that instead of or alongside your own. You still did the design work. This just means a slip in layout does not cost you a board and a week's wait.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },

  band("do", "in your browser · Order the parts", "Hands on. Every line by its exact MPN, and mind the stock and the minimums."),
  sect("02", "Ordering the parts", "Your BOM becomes a shopping cart, with the same traps as last time and one new one."),
  prose(
    "Order every line from DigiKey by its exact [[MPN]]. Mind the [[MOQ]], because passives come on reels of thousands, and buy extra of anything you will hand-place and lose. If a line is out of stock, this is where the second sources you noted at sourcing pay off.\n\nThe new trap is a suffix. **D2 is `SS34-E3/57T`, which is the SMC (DO-214AB) package.** The SMA variant, `SS34A-E3/61T`, is a different part number for a different footprint and it is not stocked here. Searching for \"SS34\" and clicking the first result is exactly how you end up with a diode that does not fit the pads you drew.",
  ),
  does("fill the parts cart at DigiKey", [
    {
      text: "Open your BOM and work straight down it. Search DigiKey by the **exact MPN**: the right product page echoes it back character for character, not just \"a 40 V Schottky\".",
      proof: "Each product page echoes your MPN back character for character.",
    },
    {
      text: "**Check the package on the three new lines.** D2 must read **DO-214AB / SMC**. D3 must read **DO-214AC / SMA**. F2 must read **1812**. These three are the parts you have never bought before, and two of them have close relatives in the wrong package.",
      proof: "D2 reads DO-214AB, D3 reads DO-214AC, and F2 reads 1812 on their product pages.",
    },
    {
      text: "Set quantities. Where a line has an **MOQ**, buy the minimum pack, since a reel of passives costs cents, and add spares of everything you will hand-place. **C8 is worth a spare of its own**: it is polarised, through-hole, and the one part on this board that fails destructively if it goes in backwards.",
      proof: "Every hand-placed part has spares in the cart, including a spare C8.",
    },
    {
      text: "If a line is **out of stock**, use the second source noted at sourcing: **F2** becomes the Bel Fuse **0ZCG0150FF2C** at the same 1.5 A hold and 3 A trip, **D2** becomes any 40 V / 3 A Schottky in **DO-214AB**, and **D3** becomes another maker's **SMAJ6.0A**. Always by exact MPN, never a lookalike.",
      proof: "Any out-of-stock line is replaced by its noted second source, by exact MPN.",
    },
    {
      text: "Before checkout, count cart lines against BOM lines. Every line accounted for, then place the order.",
      proof: "Cart lines and BOM lines match one for one.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "DigiKey cart with the project's BOM lines added by exact MPN, quantities set.",
    caption: "The whole BOM in one cart: every line by exact MPN, with the package confirmed on the three new ones.",
    captureHint: "DigiKey cart or quick-order page with several L1.04 BOM lines entered by exact MPN, showing the F2, D2 and D3 rows with their packages visible.",
  },
  gotcha(
    "the suffix is the package",
    "`SS34-E3/57T` and `SS34A-E3/61T` are the same silicon in different bodies, and only one of them fits the pads on your board. The same trap waits on any diode, LDO or fuse you buy in future: the base part number tells you what it does, and the suffix tells you what it looks like. Read the package field on the product page every time, and treat a mismatch as a stop rather than a detail.",
  ),
  {
    type: "vendorCta", vendor: "digikey-bom", label: "Shop the BOM at DigiKey",
    sublabel: "Search each MPN from your BOM and add it to the cart. Affiliate link. It supports the academy at no extra cost to you.",
  },

  band("do", "in your browser · Order the two things the BOM cannot list", "Hands on. A servo and a supply, both with real specifications."),
  sect("03", "The servo and its supply", "Neither gets soldered, so neither is on the BOM. Both still have numbers you have to meet."),
  prose(
    "A bill of materials lists what goes on the board. The servo plugs into a header and the supply screws into a terminal, so neither appears, and that is a genuinely easy way to arrive at assembly with a finished board and nothing to demonstrate.\n\nBoth have specifications, and both specifications came out of the design rather than out of preference.",
  ),
  {
    type: "table",
    columns: ["Item", "What to buy", "Why that spec"],
    rows: [
      [{ text: "The servo" }, { text: "A micro servo up to the MG90S class, specified as working from a 3.3 V signal" }, { text: "The protection is sized for a 0.9 A worst-case stall. A standard-size servo like an MG996R stalls near 2.5 A and is outside this board's ratings" }],
      [{ text: "The supply" }, { text: "Regulated 5 V, 2 A or better, current-limited if you have the choice" }, { text: "Start inrush reaches about 1.3 A and a stall holds 0.9 A. A 1 A supply sags exactly when you are trying to observe a clean stall" }],
      [{ text: "Not this" }, { text: "A 6 V adapter, at any price" }, { text: "F2 is rated 6 VDC maximum and D3 stands off 6.0 V. The rail's ceiling is 5.5 V, so 6 V leaves no margin at all" }],
      [{ text: "Also useful" }, { text: "Two short lengths of stranded hookup wire for the screw terminal" }, { text: "Solid-core wire works loose in a screw terminal under vibration, and a servo vibrates" }],
    ],
  },
  does("order the mechanicals", [
    {
      text: "**Pick the servo the kit names**, or another micro servo whose seller states 3.3 V signal compatibility. Hobby servos publish no input-threshold number at all, so this is mitigation by choosing a known-good part rather than by reading a datasheet.",
      proof: "A micro-class servo with stated 3.3 V signal compatibility is on the order.",
    },
    {
      text: "**Pick the supply.** A bench supply with an adjustable current limit is ideal and makes every mistake in this lesson boring. A regulated 5 V 2 A wall adapter is the cheap alternative. Check the label says **regulated** and **5 V**, not \"5 to 6 V\".",
      proof: "A regulated 5 V supply of 2 A or better is on the order, and it is not a 6 V adapter.",
    },
    {
      text: "**Order them in the same week as the boards.** Parts usually ship in a few days and boards take about a week to fabricate plus shipping, so placing everything on the same day tends to land the boxes together.",
      proof: "The servo and supply orders are placed alongside the board and parts orders.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "The three deliveries side by side: the fabricated boards, the parts bag, and the servo with its power supply.",
    caption: "Three orders, one build. The two on the right are the ones no parts list will remind you about.",
    captureHint: "Bench photo: five bare L1.04 PCBs, the DigiKey parts bag, and a micro servo beside a regulated 5 V supply. Neutral background, all three groups clearly separate.",
  },
  tube("Place all three orders: the boards, the parts, and the servo with its supply"),
  check(
    "**Why does a supply want 2 A when the servo stalls at 0.9 A?** Because start-up inrush reaches about 1.3 A, and a supply that folds back or sags at the wrong moment behaves exactly like a broken board. Headroom keeps the supply out of your debugging story.",
  ),
  {
    type: "callout", severity: "info", label: "What arrives when",
    body: "Parts usually ship in a few days. Boards take about a week to fabricate, plus shipping. The servo and supply are whatever their seller says. Place all of it the same day and the boxes tend to land together, so nothing stalls assembly.",
  },

  {
    type: "quiz",
    prompt: "Quick check: ordering",
    gate: true,
    questions: [
      {
        id: "three-orders", reviewId: "l104-three-orders",
        q: "This build needs three orders rather than two. What is the third?",
        options: [
          "A second set of boards, in case the first is wrong",
          "The servo and its power supply, which are not on the BOM because they are not soldered to the board",
          "A soldering iron, which the bench list covers",
        ],
        answer: 1,
        explain: "A bill of materials lists what goes on the board. Both of these plug in, so neither appears, and a build without them stops dead at bring-up.",
      },
      {
        id: "supply-ceiling-purchase",
        q: "The supply spec reads \"regulated 5 V, 5.5 V absolute maximum\". Is a 6 V adapter acceptable?",
        options: [
          "Yes, servos tolerate extra volts",
          "Yes, as long as the servo is a small one",
          "No: F2 is rated 6 VDC maximum and D3 stands off 6.0 V, so the margin is gone before the supply's own tolerance is counted",
        ],
        answer: 2,
        explain: "The ceiling is a chain of component ratings. The place to respect it is at the point of purchase, not at the bench.",
      },
      {
        id: "amp-headroom",
        q: "Why does the supply want 2 A or better for a servo that stalls at 0.9 A?",
        options: [
          "Start-up inrush reaches about 1.3 A, and a supply sagging at the wrong moment looks exactly like a broken board",
          "The rest of the board draws the difference",
          "So the same supply can drive a larger servo later",
        ],
        answer: 0,
        explain: "Headroom over the transient keeps the supply out of your debugging story, which matters on a lesson whose whole subject is a rail collapsing.",
      },
      {
        id: "package-suffix", reviewId: "l104-package-suffix",
        q: "You search DigiKey for \"SS34\" and add the first result. What might go wrong?",
        options: [
          "Nothing: SS34 is one part",
          "You may get the SMA-package variant, which is a different part number and does not fit the pads you drew",
          "The price will be higher than the BOM says",
        ],
        answer: 1,
        explain: "The base number says what the part does and the suffix says what it looks like. This board's D2 is the DO-214AB (SMC) part, SS34-E3/57T.",
      },
      {
        id: "enig-fine-pitch",
        q: "Your board has the fine-pitch WROOM pads. Which surface finish solders them more reliably?",
        options: [
          "It makes no difference",
          "HASL, which is cheaper and slightly lumpy",
          "ENIG, which is dead flat so every packed pad meets the module at the same height",
        ],
        answer: 2,
        explain: "Match the finish to the hardest part on the board. Everything else here would be happy on HASL; the module is what earns the upcharge.",
      },
      {
        id: "second-source-payoff",
        q: "The 1.5 A PTC is out of stock when you go to order. What helps most?",
        options: [
          "The second source you noted at sourcing, the Bel Fuse 0ZCG0150FF2C at the same hold and trip",
          "Any 1812 fuse that looks similar",
          "Waiting for it to come back in stock",
        ],
        answer: 0,
        explain: "This is exactly the moment a pre-identified compatible backup pays off: same package, same hold, same trip, ordered by its exact part number.",
      },
    ],
  },

  exit(
    "Three orders placed: five boards at PCBWay in 4-layer ENIG, the full BOM at DigiKey with the packages checked on the three new lines, and a micro servo with a regulated 5 V supply that is not a 6 V adapter. Create the build and attach the PCB order and the parts order to it. Next you solder it.",
  ),

  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module footprint and the fine-pitch pads that set the surface finish", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
  ref("TowerPro MG90S product specifications: the micro-servo class this board's protection is sized for", "https://towerpro.com.tw/product/mg90s-3/"),
];

publishCard({ slug: "l1-04-single-servo", stage: "ORDERING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
