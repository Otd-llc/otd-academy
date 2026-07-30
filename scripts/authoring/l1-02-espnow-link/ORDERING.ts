// L1.02 ESP-NOW link — ORDERING card.
//
// Almost entirely board-agnostic, so L1.01's ORDERING card is gospel: same two
// carts (PCBWay for boards, DigiKey for parts), same three fab options (4
// layers, 1.6 mm, ENIG), same minimum quantity of 5, same exact-MPN discipline.
// The one thing that changes is the parts arithmetic, because this lesson
// builds two nodes: quantities from docs/boards/l1-02-espnow-link/bom.csv,
// doubled.
//
// The card this replaces was 11 blocks against a 24 bar: no numbered sections,
// no images at all, and it named the three fab options without ever saying why
// ENIG earns its upcharge, which is the one judgment call on this page.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Same two carts as L1.01: boards from **PCBWay**, parts from **DigiKey**. The board order barely changes, because the fab's minimum quantity already covers the pair. The parts cart is where the pair discipline bites: every line, times two, plus spares.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in your browser · Boards first", "Hands on. Upload the one zip, set three options, and the minimum quantity already builds your pair with spares."),
  sect("01", "Ordering the PCB", "A few options turn your Gerbers into physical boards. One upload covers both nodes."),
  prose(
    "Upload the [[Gerber]] zip to PCBWay and pick the options: a **4-layer** board (this design needs the two inner ground planes, so it costs a little more than a 2-layer), a **thickness** (1.6 mm is standard), and a **surface finish**, either [[HASL]] (cheap, slightly lumpy) or [[ENIG]] (flat gold, better for the WROOM's fine-pitch pads).\n\nThere is no pair-specific option to find. One design, one zip, and quantity is just a number on the same page.",
  ),
  does("upload & configure at PCBWay", [
    {
      text: "On PCBWay's **instant-quote / Gerber upload** page, drop in **the `.zip` you exported last stage**. It auto-detects the board and renders a preview. Glance that the outline looks right and that it reads **4 layers**.",
      proof: "The preview renders your board outline and reads 4 layers.",
    },
    {
      text: "Set the three options that matter: **Layers = 4**, **Thickness = 1.6 mm**, **Surface finish = ENIG**. Leave everything else at PCBWay's defaults.",
      proof: "The order reads 4 layers, 1.6 mm, ENIG.",
    },
    {
      text: "**Quantity: 5**, the usual minimum. Two to build, three spares. No second upload and no second design: both nodes come out of this one order.",
      proof: "Quantity is 5 and the order is placed.",
    },
  ]),
  shot(
    "Drop the zip: PCBWay previews the board it will build.",
    "PCBWay instant-quote / Gerber upload page right after the zip uploads: the upload area and the auto-rendered board preview.",
    "See it set · the upload",
  ),
  shot(
    "The three options that matter: 4 layers, 1.6 mm, ENIG.",
    "PCBWay quote page options column: highlight Layers = 4, Thickness = 1.6 mm, Surface Finish = ENIG (not the whole pricing sidebar).",
    "See it set · the options",
  ),
  trace("Before you check out at the fab", [
    { text: "The preview renders your outline, antenna overhang and all", help: "A preview that looks wrong means the zip is wrong. This is the fab reading your Gerbers back to you, for free." },
    { text: "Layers reads 4, not 2", help: "A 4-layer design quoted as 2-layer usually means the inner copper files never made it into the zip." },
    { text: "Thickness reads 1.6 mm", help: "The default is normally right, but a thinner board changes how the USB-C receptacle sits in its cutout." },
    { text: "Surface finish reads ENIG", help: "The one option worth paying for on this board. See the deep dive below for why." },
    { text: "Quantity is at least 5", help: "You need two working boards. An extra board is nearly free; a second shipping run is not." },
  ]),
  {
    type: "image",
    src: "/guide-diagrams/hasl-vs-enig.svg",
    alt: "Cross-section comparing HASL and ENIG surface finishes under the WROOM's fine-pitch pads: HASL's solder domes are uneven so one joint never forms; ENIG is flat and every pad meets the module.",
    caption: "HASL leaves each pad domed a slightly different height; ENIG is dead flat. Under the WROOM, that flatness decides whether every joint forms.",
  },
  tube("Place both orders: the PCB at PCBWay, the parts at DigiKey"),
  check(
    "**Your board has the fine-pitch WROOM module pads. HASL or ENIG?** ENIG. Its flat surface solders fine-pitch parts more reliably than lumpy HASL, and on this board you are betting two module joints on it rather than one.",
  ),
  dive(
    "ENIG vs HASL: why the finish matters here",
    "Bare copper pads tarnish, so the fab coats them. [[HASL]] (hot-air solder levelling) dips the board in molten solder and blows the excess off with hot air: cheap and very solderable, but it leaves the pads slightly domed and uneven in height. [[ENIG]] plates a flat layer of nickel capped with a thin gold flash: dead flat, long shelf life, a little pricier.\n\nFor through-hole and 0805 work HASL is perfectly fine. The WROOM's underside pads are fine-pitch and packed close, and there a flat surface lets every pad meet the module at the same height. Uneven HASL bumps invite a missed or bridged joint you cannot even see under the module, and on this lesson you would be hunting it on two boards rather than one. That flatness is what makes this board worth the ENIG upcharge.",
  ),
  {
    type: "vendorCta", vendor: "pcbway-order",
    label: "Order your boards at PCBWay",
    sublabel: "Upload the zip, pick 4-layer + ENIG, quantity 5 covers the pair. Affiliate link. It supports the academy at no extra cost to you.",
  },
  {
    type: "callout", severity: "info", label: "Not sure your layout is right?",
    body: "You don't have to bet a board on it. Download the reference design, this lesson's canonical board, exported and zipped ready for the fab, and order that instead of or alongside your own. You still did the design work; this just means a slip in layout does not cost you a board and a week's wait.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "in your browser · Then the parts, times two", "Hands on. Walk the BOM by exact [[MPN]] as always. The only new arithmetic is the pair."),
  sect("02", "Ordering the parts", "Your BOM becomes a shopping cart, with a few traps and one multiplication."),
  prose(
    "Order every line from DigiKey by its exact [[MPN]]. Mind the [[MOQ]]: passives come on reels of thousands, which is convenient here because one reel already covers both boards. Buy extra of anything you will hand-place and lose. If a line is out of stock, this is where the second sources you noted at sourcing pay off: the UMW `USBLC6-2SC6` for D1, the Bel Fuse `0ZCJ0050FF2G` for F1.",
  ),
  does("fill the parts cart for the pair", [
    {
      text: "Open your BOM from the sourcing stage and work straight down it. Search DigiKey by the **exact MPN**: the right product page echoes the number back character for character, not just 'a 10 kΩ resistor'.",
      proof: "Each product page echoes your MPN back character for character.",
    },
    {
      text: "**Double the discretes:** 2 modules, 2 LDOs, 2 ESD arrays, 2 polyfuses, 2 USB-C receptacles, **6 buttons**, 2 of each LED and test point. One reel of each passive already covers both boards, and one 40-pin header stick yields both J2 rows.",
      proof: "The cart covers two boards, including 6 buttons and 2 of every discrete part.",
    },
    {
      text: "**Spares on top**, as always, for everything hand-placed. Small parts escape tweezers, and a second shipment costs more than a reel.",
      proof: "Every part you will hand-place has spares in the cart.",
    },
    {
      text: "If a line is **out of stock**, swap in the second source you noted at sourcing, again by its exact MPN, never a lookalike.",
      proof: "Any out-of-stock line is replaced by the second source you noted, by its exact MPN.",
    },
    {
      text: "Before checkout, count cart lines against BOM lines: seventeen lines, every one accounted for. Then place the order, the same day you ordered the boards.",
      proof: "Cart lines and BOM lines match one for one and both orders are placed.",
    },
  ]),
  shot(
    "The whole BOM in one cart: every line by exact MPN, quantities already doubled.",
    "DigiKey cart or quick-order page with several L1.02 BOM lines entered by exact MPN, quantities visible and the button line reading 6.",
  ),
  check(
    "**You need four 5.1 kΩ resistors for the pair, but they sell in reels of 5,000. What now?** Buy the reel. It is cents, it covers both boards several hundred times over, and you keep the spares. Always order a few extra of anything you hand-place.",
  ),
  {
    type: "vendorCta", vendor: "digikey-bom",
    label: "Shop the BOM at DigiKey",
    sublabel: "Every line by exact MPN, quantities doubled for the pair. Affiliate link. It supports the academy at no extra cost to you.",
  },
  {
    type: "callout", severity: "info", label: "What arrives when",
    body: "Parts usually ship in a few days; boards take about a week to fabricate, plus shipping. Place both orders the same day and the two boxes tend to land together, so nothing stalls ASSEMBLY.",
  },
  gotcha(
    "two nodes need two cables and two power sources",
    "The demo only proves anything with both boards live at once, and a receiving node holds its radio awake at 80 to 100 mA rather than sleeping. So you need **two USB-C data cables** (not charge-only) and **two supplies**, a wall adapter or a PC port each. Neither is on the BOM, because neither is a part on the board. Check your drawer now rather than on demo day.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: ordering",
    gate: true,
    questions: [
      {
        id: "qty-covers-pair",
        q: "You need two boards. What do you change on the PCBWay order versus L1.01?",
        options: [
          "Ask for panelization",
          "Upload the zip twice",
          "Nothing: the minimum quantity of 5 already covers the pair plus spares",
        ],
        answer: 2,
        explain: "One design, one zip, and the fab's usual minimum already builds more boards than the lesson needs.",
      },
      {
        id: "discrete-doubling", reviewId: "l102-discrete-doubling",
        q: "Which cart line is easiest to get wrong for the pair?",
        options: [
          "The discretes: modules, connectors and buttons must each be counted times two (six buttons total)",
          "The test points: they only fit one board",
          "The passives: reels run out",
        ],
        answer: 0,
        explain: "Reels cover both boards by default. The countable discretes are where a per-node BOM quietly becomes a one-board cart.",
      },
      {
        id: "enig-reason-recall", reviewId: "enig-fine-pitch",
        q: "ENIG again on this board. The reason, from L1.01 memory?",
        options: [
          "Dead-flat pads under the WROOM's fine-pitch castellations: lumpy HASL invites hidden missed joints",
          "Gold matches the brand",
          "ENIG resists corrosion longer",
        ],
        answer: 0,
        explain: "Fine-pitch pads want a flat surface so every joint forms at the same height. Same part, same reason, same finish.",
      },
      {
        id: "finish-match-board",
        q: "A different board you design is all through-hole and 0805, with no fine-pitch parts. Is the ENIG upcharge worth it there?",
        options: [
          "Yes, always pick ENIG",
          "Not necessarily: HASL solders through-hole and 0805 just fine, and ENIG mainly earns its cost on fine-pitch pads",
          "No, ENIG never makes a difference",
        ],
        answer: 1,
        explain: "Match the finish to the board instead of always upgrading. The flatness matters where the pitch is fine.",
      },
      {
        id: "same-day-orders",
        q: "Why place the board and parts orders the same day?",
        options: [
          "The vendors give a joint discount",
          "The BOM expires",
          "Boards take about a week to fab; parts ship in days. Same-day orders mean both boxes land together and assembly never stalls",
        ],
        answer: 2,
        explain: "It is pure logistics: match the lead times so the slower box sets the schedule and nothing waits on a forgotten cart.",
      },
      {
        id: "reference-fallback",
        q: "You're unsure your layout is right. What keeps the lesson moving?",
        options: [
          "Order anyway and hope",
          "Order the reference gerbers, alongside or instead of your own export",
          "Skip to assembly with L1.01 boards",
        ],
        answer: 1,
        explain: "The reference set is the canonical board, exported and fab-ready. Your design work still happened; the build risk goes to zero.",
      },
    ],
  },

  exit(
    "Create the build, then attach the PCB order and the parts order to it. Two boxes are inbound and one of them builds two nodes; the next card turns them into a pair.",
  ),
];

publishCard({ slug: "l1-02-espnow-link", stage: "ORDERING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
