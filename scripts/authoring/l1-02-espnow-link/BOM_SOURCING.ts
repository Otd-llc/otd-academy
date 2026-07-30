// L1.02 ESP-NOW link — BOM_SOURCING card.
//
// Facts from docs/boards/l1-02-espnow-link/{design.md §3 §4 §8, bom.csv,
// validation-log.md pass 10}. Exact MPNs are copied byte-for-byte from bom.csv,
// never paraphrased. L1.01's BOM_SOURCING card is gospel for the shared craft
// (exact MPN over value, the datasheet habit, stock and lifecycle, second
// sources, jellybean passives, hand-solderable packages).
//
// The card this replaces was 20 blocks against a 36 bar: three numbered
// sections, three video slots and no stills at all. This pass adds the missing
// island (stock moves between a validation snapshot and your order), the
// diagrams and capture slots, the pre-order eyeball checklist, and the concrete
// pair arithmetic the old card only gestured at.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("BOM sourcing for the pair: reuse, times two"),

  prose(
    "On L1.01 you turned every 'wish' into an exact [[MPN]]. This BOM rewards that work: **every single line is a part you already sourced, verified, and soldered.** Seventeen line items, 25 placements, about **$13.50 per node**, and the only genuinely new entries are a third button and one breakaway header. The craft this time is quantity discipline: you are building **two boards**, so the cart math doubles to roughly **$27** and 50 placements.",
  ),
  band("orient", "One familiar BOM, two boards", "Read this one. Nothing needs re-deriving: the checks are the same four from L1.01. The new habits are pair quantities, re-checking stock that has moved, and noticing what is NOT on the BOM."),

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "Reuse is the point", "A curated parts library compounds: your second board sources in minutes because the first one was done right."),
  prose(
    "Every active part carries over locked: U1 the WROOM, U2 the RT9080, D1 the USBLC6, F1 the polyfuse. So do the passives, the buttons, the USB-C connector, and the test points. The second sources you noted on L1.01 still stand ready (the UMW USBLC6-2SC6 for D1, a Bel Fuse PTC for F1), and the jellybean rule still applies to the commodity resistors and caps. When sourcing is already proven, a new board is a diff, and this board's diff is three lines.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Why it's here"],
    rows: [
      [{ text: "SW3", decoration: "ref" }, { text: "B3F-1000", decoration: "mpn" }, { text: "The USER button: third copy of the switch you already own twice" }],
      [{ text: "J2", decoration: "ref" }, { text: "PRPC040SAAN-RC", decoration: "mpn" }, { text: "1x40 breakaway header: snap off exactly the row this board needs" }],
      [{ text: "C4", decoration: "ref" }, { text: "CL21B104KBCNNNC", decoration: "mpn" }, { text: "The EN reset cap, same 0.1 µF part as the decoupling pair" }],
    ],
  },
  prose(
    "SW3 is the same Omron **B3F-1000** already on the board twice: a 6 x 6 mm through-hole tactile switch, 4.3 mm tall, with silver-plated contacts and a **0.98 N** (100 gf) operating force. Omron rate the 6 x 6 mm type at 1 million operations, which is a lot of packets. The plunger is ivory, so all three buttons look identical and the silkscreen is the only thing telling EN from BOOT from USER. Get that legend right at layout.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/mpn-anatomy.svg",
    alt: "The part number RC0805FR-075K1L split into segments: RC Yageo family, 0805 package size, F for 1% tolerance, R-07 packaging code, 5K1 the value 5.1 kilohm.",
    caption: "The habit that made this BOM reusable: every segment of an MPN pins something down.",
  },
  check(
    "**This board's sourcing took minutes where L1.01's took an evening. What changed?** The parts did not. The library did the work: every line was already an exact, in-stock, hand-solderable MPN with second sources noted. Reuse compounds.",
  ),
  dive(
    "What a library entry actually stores",
    "An MPN alone would not save you this much time. A curated part in the Foundry library carries five things, each of which cost somebody an hour the first time: the exact manufacturer and part number the distributor matches on, a **KiCad symbol** with a verified pin map, a **footprint** whose pads match the datasheet's land pattern, a **3D model** so the board renders and you can see collisions before you order, and the **datasheet link** itself.\n\nThat bundle is why the BOM import is strict: it matches on manufacturer plus MPN and refuses to invent a part it has never seen. A row that fails to match is a row nobody has verified, and the import reports it rather than guessing. Every one of this board's 17 lines matched on the first pass.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The line that isn't there", "Look for SW3's pull-up resistor on the BOM. You won't find one, and that absence is a lesson."),
  prose(
    "The EN and BOOT lines each carry an external 10 kΩ [[pull-up]] (R1, R2), exactly as L1.01. The USER button has none: it leans on the ESP32's **internal pull-up**, a weak resistor (roughly **45 kΩ** typical) built into the pin itself that firmware switches on. For a human-speed button that is plenty, and it saves a part. The strapping pins keep their external resistors because they must read correctly *before* any firmware runs; the USER pin is only read by code that also enables its pull-up. Same principle you learned, applied at the next level of judgment.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/comms-pull-up-down.svg",
    alt: "A pull-up resistor holds an input high until a switch pulls it to ground; a pull-down does the reverse. Both give a floating input a defined resting level.",
    caption: "Either way, the job is the same: give the pin a defined level when nothing is driving it.",
  },
  {
    type: "table",
    columns: ["Pin", "Pull-up", "Why that choice"],
    rows: [
      [{ text: "EN", decoration: "ref" }, { text: "External 10 kΩ (R1) + 0.1 µF (C4)" }, { text: "Must be high the instant power arrives, long before firmware exists" }],
      [{ text: "GPIO0 (BOOT)", decoration: "ref" }, { text: "External 10 kΩ (R2)" }, { text: "A strapping pin: the chip samples it at reset to pick the boot mode" }],
      [{ text: "GPIO21 (USER)", decoration: "ref" }, { text: "Internal, roughly 45 kΩ" }, { text: "Only ever read by running firmware, which enables the pull-up first" }],
    ],
  },
  check(
    "**Why do EN and BOOT get external pull-up resistors while the USER button uses the chip's internal one?** EN and GPIO0 must sit at a defined level the instant power arrives, before firmware exists. GPIO21 is read only by running firmware, which can enable the internal pull-up first.",
  ),
  dive(
    "Internal pull-ups: what they are and when to trust them",
    "Most microcontroller pins hide a switchable pull-up (and often a pull-down) behind a configuration register: a transistor-connected resistor in the 30 to 60 kΩ range, weaker and less precise than a discrete 10 kΩ. Trust it when firmware controls the timing and the signal is slow: buttons, mode jumpers, waking a lazy input. Reach for an external resistor when the level must be defined before or without firmware (strapping and reset pins), when a bus standard names a value (I2C), or when the line leaves the board and picks up real noise. This board shows both answers on purpose: external on EN/BOOT, internal on USER.",
  ),
  gotcha(
    "an internal pull-up is off until firmware turns it on",
    "Between power-on and the line of code that configures GPIO21, that pin floats. It reads as noise, and a program that samples it too early sees phantom presses. Configure the pin with its pull-up as the first thing your setup does, then read it. This is the cost of saving the resistor, and it is a fair trade on a button nothing depends on at boot.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "Stock moves, so check it again", "A sourcing snapshot is true on the day it was taken. Yours is taken the day you order."),
  prose(
    "This board's BOM was stock-checked line by line against a live distributor feed on **2026-06-25**. Every line came back matched, lifecycle **Active**, and comfortably in stock: the tightest was U1 at 8,589 modules against a build quantity of two. That is the evidence behind calling the BOM sourced.\n\nIt is also evidence with a date on it. Semiconductor stock swings, and the ESP32 module is the line most likely to move. Before you order, re-open the four active parts and confirm two fields on each: quantity available today, and lifecycle still Active. Thirty seconds a line, and it is how L1.01 caught the AP2112K going dry in the first place.",
  ),
  {
    type: "table",
    columns: ["Ref", "MPN", "Stock on 2026-06-25", "Unit $"],
    rows: [
      [{ text: "U1", decoration: "ref" }, { text: "ESP32-S3-WROOM-1-N16R2", decoration: "mpn" }, { text: "8,589" }, { text: "6.32" }],
      [{ text: "U2", decoration: "ref" }, { text: "RT9080-33GJ5", decoration: "mpn" }, { text: "98,947" }, { text: "0.28" }],
      [{ text: "D1", decoration: "ref" }, { text: "USBLC6-2SC6", decoration: "mpn" }, { text: "10,000" }, { text: "0.03" }],
      [{ text: "F1", decoration: "ref" }, { text: "1206L050YR", decoration: "mpn" }, { text: "29,418" }, { text: "0.64" }],
    ],
  },
  shot(
    "Two fields to re-check on every active line: stock today, and lifecycle still Active.",
    "Distributor product page for ESP32-S3-WROOM-1-N16R2. Crop to the part header, the quantity-available figure and the lifecycle or status field, both legible at card width.",
  ),
  check(
    "**The BOM says 8,589 in stock and the page you just opened says 40. Do you order?** Yes, and quickly. Forty covers your two boards with room to spare, and a line that has fallen that far is a line worth buying before it hits zero. What you do not do is assume last month's number is still true.",
  ),
  {
    type: "callout", severity: "info", label: "Second sources, still standing",
    body: "Two lines carry a named backup, both proven rather than guessed. **D1**: the UMW `USBLC6-2SC6` is pin- and spec-compatible, and it shipped on L1.01 while the STMicroelectronics part was dry. **F1**: Bel Fuse `0ZCJ0050FF2G`, the same 0.5 A hold / 1 A trip PTC at about $0.21. Every commodity resistor and capacitor is a [[MPN|jellybean]]: any reputable maker's part drops in as long as value, package, tolerance, dielectric and voltage rating all match.",
  },

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Nothing new to solder", "Every package on this board is one your iron has already met. That is a sourcing decision, made on purpose."),
  prose(
    "The package envelope is identical to L1.01, so this board carries **no new soldering risk**. Passives stay at **0805** (2.0 x 1.25 mm, about a grain of rice) rather than 0402 (1.0 x 0.5 mm, a quarter of the area and really a paste-and-stencil part). The actives stay leaded and visible: SOT-23-5 for the RT9080, SOT-23-6 for the USBLC6. Buttons, header and test points are through-hole. J1 is the same right-angle USB-C receptacle, SMT contacts anchored by through-hole solder-retention posts, and it is still the hardest joint on the board.\n\nNothing here is leadless, and nothing hides its joints under the body. That constraint is why the BOM looks the way it does: a cheaper QFN regulator exists, and it would put a first hand-build at risk for nine cents.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/0805-vs-0402.svg",
    alt: "An 0805 passive (2.0 x 1.25 mm) beside an 0402 (1.0 x 0.5 mm), drawn to scale. The 0402 is about a quarter of the area.",
    caption: "The size floor this BOM holds to: 0805, not 0402.",
  },
  check(
    "**A parts search offers the same 10 kΩ value in 0402 for less money. Do you take it?** No. The pads on this board are laid out for 0805, and even if they were not, 0402 is the size at which tweezers stop being enough. Value alone never makes two parts interchangeable.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "Two boards, one cart", "The BOM below is per node. Your cart is that, times two, plus the spares rule you already know."),
  prose(
    "Seventeen lines and 25 placements per node means your cart covers **50 placements**. Reels make most of it easy: one reel of each passive covers both boards with hundreds to spare. Count the discrete parts deliberately: two WROOMs, two RT9080s, two USB-C connectors, **six** B3F buttons, two of each LED and test point. [[MOQ]] maths is unchanged; buy the reel, keep the extras.",
  ),
  {
    type: "partModel", mpn: "PRPC040SAAN-RC",
    caption: "J2: a 1x40 breakaway header. Both boards' rows come out of this one stick",
  },
  prose(
    "J2 breaks out **12 pins** per node: 5 V, 3V3 and GND, the five ADC1 pins (GPIO1, 2, 4, 5, 6), and four spares (GPIO7 to 10). Two rows of twelve is 24 pins, so a single 40-pin stick covers the pair with 16 pins left in the drawer. Snap it along the score line with a pair of pliers before you solder anything, and count the pins twice: a header snapped one pin short is a header you desolder.",
  ),
  shot(
    "One 40-pin stick, two 12-pin rows snapped off, 16 pins spare.",
    "Bench photo: a 1x40 breakaway header with two 12-pin rows snapped off and laid beside the remainder. Pliers in frame. Shallow depth of field, dark neutral background.",
  ),
  { type: "bomTable", caption: "The live per-node BOM: order every line times two", collapsed: true },
  shot(
    "The cart before checkout: every quantity already doubled, one shipment.",
    "Distributor cart screen for the L1.02 pair. Line quantities and the order total legible, with the button line showing 6 and the module line showing 2.",
  ),
  check(
    "**The BOM line for the buttons reads quantity 3. How many do you buy?** Six, plus spares. Every quantity on that table is per node, and tactile switches are cheap enough that a couple of extras cost less than a second shipping charge.",
  ),

  // ── the order ─────────────────────────────────────────────────────────────
  band("do", "in your BOM · Lock the pair's order", "Same four checks as L1.01, one pass, then the quantity sweep."),
  does("Lock the pair's BOM", [
    {
      text: "**Exact MPN, in stock, active, hand-solderable:** confirm the four L1.01 checks still hold on every line. Stock moves; thirty seconds per line.",
      proof: "Every line is an exact MPN, in stock and active, in a package you can hand-solder.",
    },
    {
      text: "**Times two:** multiply every line's quantity by two boards. Reels already cover the passives; count the discretes (2 each of the module, LDO, USB-C, LEDs and test points; 6 buttons).",
      proof: "The cart covers two full boards, with 6 buttons and 2 of every discrete part.",
    },
    {
      text: "**Spares:** add extras of everything you hand-place, exactly as L1.01 taught. The 0805 passives are pennies on a reel and the buttons are cheap.",
      proof: "Every hand-placed part has spares in the cart.",
    },
    {
      text: "**Second sources:** note the standing backups (UMW `USBLC6-2SC6` for D1, Bel Fuse `0ZCJ0050FF2G` for F1) in case a line dries up between now and ordering.",
      proof: "Your BOM notes name a backup for D1 and F1.",
    },
    {
      text: "**One shipment:** put the whole cart in a single order. Two shipments for one build is the most avoidable cost on this board.",
      proof: "Everything for both boards is in one cart before you check out.",
    },
  ]),
  trace("Before you press order", [
    { text: "The line total reads about $27 for the pair, not $13.50", help: "$13.50 is one node. A cart at the single-node figure means a quantity somewhere is still at 1." },
    { text: "Six B3F-1000 buttons, not three", help: "The button line is the easiest to under-count because L1.01 needed two and this board needs three." },
    { text: "Two ESP32-S3-WROOM-1-N16R2 modules", help: "The most expensive line and the one that stalls the whole build if it arrives short." },
    { text: "One 1x40 breakaway header covers both boards", help: "24 of the 40 pins get used. Ordering two sticks is harmless, ordering none stops you." },
    { text: "Every MPN in the cart matches the BOM string character for character", help: "A neighbouring part number differs by one character and by a whole package size. Copy and paste; do not retype." },
  ]),
  tube("Lock the pair's BOM with me"),

  {
    type: "quiz",
    prompt: "Quick check: sourcing the pair",
    gate: true,
    questions: [
      {
        id: "reuse-compounds",
        q: "Why did this board's sourcing take minutes instead of an evening?",
        options: [
          "The board has fewer parts than L1.01",
          "Every line reuses an already-verified L1.01 part, so the library did the work",
          "Distributors stock ESP-NOW parts specially",
        ],
        answer: 1,
        explain: "A curated library compounds: exact MPNs, stock checks, symbols, footprints and second sources carry over to every board that reuses them.",
      },
      {
        id: "no-pullup-line", reviewId: "no-pullup-line",
        q: "SW3, the USER button, has no pull-up resistor on the BOM. Why is that correct?",
        options: [
          "GPIO21 works fine floating",
          "Firmware enables the chip's internal pull-up before it reads the pin",
          "The button contains its own resistor",
        ],
        answer: 1,
        explain: "Only firmware ever reads GPIO21, and it switches on the internal pull-up first. Strapping pins keep external resistors because they are read before firmware runs.",
      },
      {
        id: "pair-quantities",
        q: "The BOM says SW1, SW2, SW3 at quantity 3. How many B3F-1000 buttons go in your cart?",
        options: [
          "Six, plus spares: the BOM is per node and you are building two",
          "Three, the BOM says so",
          "Twelve, to be safe",
        ],
        answer: 0,
        explain: "Every BOM line doubles for the pair. Three buttons per node means six, and the spares rule from L1.01 still applies.",
      },
      {
        id: "breakaway-header",
        q: "J2 is a 1x40 'breakaway' header but each board needs only a 12-pin row. What do you do?",
        options: [
          "Snap the rows you need off the 40-pin stick; one stick covers both boards",
          "Install all 40 pins and trim after soldering",
          "Order a custom-length header",
        ],
        answer: 0,
        explain: "Breakaway headers are scored between pins so you snap rows to size. Two 12-pin rows leave 16 pins spare on one stick.",
      },
      {
        id: "second-source-standing",
        q: "D1 goes out of stock the day you order. What's the move?",
        options: [
          "Redesign around a different ESD part",
          "Wait for restock",
          "Drop in the UMW USBLC6-2SC6 noted as the second source: same pinout, same specs",
        ],
        answer: 2,
        explain: "The second source was pre-verified on L1.01, where it shipped while the STMicroelectronics part was dry. Sourcing notes exist for exactly this moment.",
      },
      {
        id: "stock-date", reviewId: "l102-stock-moves",
        q: "The BOM's stock figures were captured weeks ago. What do you do with them before ordering?",
        options: [
          "Trust them: a validated BOM does not go stale",
          "Re-derive the whole power budget",
          "Re-check quantity available and lifecycle on the four active parts today",
        ],
        answer: 2,
        explain: "A sourcing snapshot is true on its date. Stock and lifecycle are the two fields that move, and they take about thirty seconds a line to confirm.",
      },
    ],
  },

  exit(
    "Every line re-verified against today's stock, quantities doubled, spares counted, second sources standing by, and the whole pair in one cart. The quick check above is the gate. Next: the schematic, where the only new wiring is the node I/O island.",
  ),

  ref("ESP32-S3 datasheet (Espressif): internal pull-up and pull-down specifications", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("B3F tactile switch datasheet (Omron): the B3F-1000 model line, operating force and durability rating", "https://omronfs.omron.com/en_US/ecb/products/pdf/en-b3f.pdf"),
  ref("USB Type-C Cable and Connector Specification (USB-IF): the 5.1 kohm CC pulldown that marks a power sink", "https://www.usb.org/usb-type-cr-cable-and-connector-specification"),
];

publishCard({ slug: "l1-02-espnow-link", stage: "BOM_SOURCING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
