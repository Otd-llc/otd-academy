// L1.03 WS2812 node — BOM_SOURCING card.
//
// Authored ahead of the board from docs/boards/l1-03-ws2812-node/{design.md,
// bom.csv,validation-log.md}, with L1.01's BOM_SOURCING card as gospel for the
// shared teaching (exact MPNs, reading a datasheet narrowly, stock and
// lifecycle, second sources, jellybean passives, hand-solderable packages).
//
// The card this replaces was 12 blocks against L1.01's 36.
//
// The NEW material here is the best sourcing story in the curriculum, and it is
// first-hand: this board's own validation run found that "orderable" and "in
// stock" are different claims, and the difference cost it four part swaps
// (design.md friction F12). It also hit the clone-datasheet problem head on
// (F8): the pixel is a WS2812B-COMPATIBLE part, and compatible is a marketing
// word until you have the actual PDF. Both are taught here as they happened.
//
// Every refDes, manufacturer and MPN below is copied from bom.csv verbatim.
// Per-line prices are deliberately absent where design.md section 8 and bom.csv
// disagree; the total is quoted from design.md section 8.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("BOM sourcing: nine new parts, and the difference between orderable and in stock"),

  prose(
    "Before you draw anything you need to know exactly which parts you will use. That list is the **BOM**, the bill of materials, and the job of this stage is turning every part you need into a real, orderable number, first, before the schematic. A schematic will happily let you write \"470 ohm resistor\". A distributor will not ship you one of those.\n\nMost of this board's BOM is already familiar: the whole L1.01 power and USB chain carries over unchanged. **Nine lines are new**, and they are where the interesting sourcing lives, because two of them taught this board's own design review a lesson it did not expect.",
  ),

  band("orient", "Turn every part into an orderable one", "Read this one. A value is a wish. A manufacturer part number is a thing a distributor will put in a box."),

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "Why an exact part number", "\"A 470 ohm resistor\" is a wish. RC0805FR-07470RL is a part."),
  prose(
    "Every BOM line needs a manufacturer plus an exact part number. That number pins down far more than the value: it also fixes the tolerance, the package size, the voltage rating, and how the part behaves as it warms up. \"A 0.1 uF cap\" could be any of a thousand different parts. The exact number is the one that fits your footprint and survives your rail.\n\nOn this board the point is easy to see in the 470 ohm line. **R5 and R6** set the brightness of the two indicator LEDs, which is a job almost any 470 ohm part could do. **R7 and R8** damp the edges on the pixel data line, which is a job that depends on the part actually being 470 ohm and actually being an 0805 that fits the pads you laid out. One part number covers all four, and that is deliberate: fewer distinct lines means fewer things to order, fewer reels, and fewer chances to fit the wrong one.",
  ),
  table(
    ["Ref", "Part", "What the number pins down"],
    [
      ["R5, R6, R7, R8", "RC0805FR-07470RL", "470 ohm, 1%, 0805. Value, tolerance and size, all fixed"],
      ["C2, C3, C7, C8, C9", "CL21B104KBCNNNC", "0.1 uF, X7R dielectric, 0805. The dielectric is part of the part"],
      ["C11", "CL21A475KAQNNNE", "4.7 uF, X5R, 0805, 25 V. The voltage rating is why it survives"],
    ],
  ),
  shot(
    "Reading a part number: every segment of RC0805FR-07470RL pins something down.",
    "Annotated close-up of the Yageo RC0805FR-07470RL line on a distributor page, with the family, package, tolerance and value segments of the part number called out.",
  ),
  check(
    "**Two reels both say 470 ohm, but only one fits your board. What is most likely different?** The package size. An 0805 and an 0402 are both 470 ohm and will not share a footprint. The exact part number locks the size along with the value.",
  ),
  dive(
    "Why C11 is 4.7 uF and not the 10 uF you might expect",
    "There is a bulk capacitor on the USB 5 V rail to ride out current spikes, and the instinct is to make it as big as convenient. On this board it is deliberately smaller than that instinct wants.\n\nUSB 2.0 limits how much capacitance a device may hang on the bus, because every capacitor you attach draws a slug of current the instant the plug seats, and a bus full of greedy devices browns out its own hub. The ceiling is 10 uF. This board already carries 1 uF at the regulator input and two 0.1 uF decoupling caps on the 5 V rail, so the bulk part gets what is left: 4.7 uF, for a total of 5.9 uF, comfortably under the limit.\n\nThe design still works, because 4.7 uF is plenty to ride the pixel's 60 mA pulses. The lesson is that a capacitor value can be set by a rule somewhere else in the system rather than by the circuit it sits in, and that this is the kind of constraint you only find by reading the specification rather than reasoning from the schematic.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "Reading a datasheet, and what to do when the part is a clone", "Two things to find first. And one part on this board where finding them was genuinely hard."),
  prose(
    "For every chip the manufacturer publishes a datasheet, the part's manual. Do not read the whole thing. Find two things first: the **power and ground pins**, and the **absolute maximum ratings**, the voltages and currents that destroy the part. Everything else depends on powering it correctly and staying under its limits.\n\nFor **U3**, the 74AHCT125, that means confirming pin 14 is the supply and pin 7 is ground, that the inputs are happy with 3.3 V, and that the output can drive the pixel. Ten minutes with the TI datasheet settles all of it.\n\n**LED3 is the awkward one.** It is a XINGLIGHT XL-5050RGBC-WS2812B, and it is sold as \"WS2812B compatible\". Compatible is a marketing word. It tells you the part speaks the same protocol; it does not tell you the supply range, the input threshold or the absolute maximum on the data pin. The honest move is to refuse to design against the reference part's numbers and go get the compatible part's own datasheet, which is exactly what this board's review had to do.",
  ),
  shot(
    "First stop in any datasheet: the pin table. Pin 7 is ground, pin 14 is the supply.",
    "TI SN74AHCT125 datasheet PDF, Pin Functions table. Zoom so the GND row (pin 7) and VCC row (pin 14) are legible at card width; highlight both rows before capture.",
  ),
  shot(
    "Second stop: absolute maximum ratings. The numbers that end the part.",
    "TI SN74AHCT125 datasheet PDF, Absolute Maximum Ratings table, zoomed to fill the frame. Supply and input voltage rows legible.",
  ),
  {
    type: "callout", severity: "warn", label: "Gotcha · \"compatible\" is not a specification",
    body: "A clone part's marketing page will tell you it is a drop-in replacement and stop there. The numbers you actually need to design against, its supply range and the voltage that kills its data pin, may differ from the part it clones. This board's own review initially inherited those numbers from the reference part by assumption, then went and found the real PDF and corrected two of them. Get the datasheet for the part you are ordering, not the part it imitates. If a supplier cannot produce one, that is a sourcing answer in itself.",
  },
  check(
    "**Before wiring any chip, what is the first thing to find in its datasheet?** Its power and ground pins, and its absolute maximum ratings. Everything else is moot if you power it wrong or exceed its limits.",
  ),
  dive(
    "What the pixel's own datasheet actually says",
    "Once the real document for this part turned up, three numbers mattered.\n\nIts supply range is wider than the reference part's, which is comfortable news: running it at 5 V is well inside where it is happy. Its input high threshold is the 0.7 of supply that the whole lesson turns on, so that number is confirmed at the source rather than assumed from a lookalike. And its data pin tolerates roughly half a volt above the supply before you are outside the specification, which is the number that sets the power-up order rule you met at requirements.\n\nOne number the datasheet does not give is how hard the pixel's own data output drives. That matters for the second hop, where the onboard pixel drives the strip, and it is why this board treats that hop as an engineering estimate to be confirmed with a meter at bring-up rather than a settled calculation. An unspecified number is not the same as a safe one. Writing down which numbers you are trusting and which you are still owed is what keeps a design honest.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "Orderable is not the same as in stock", "This board learned the difference the hard way, and four of its lines changed because of it."),
  prose(
    "There are two questions you can ask about a part, and it is easy to think you asked the second when you only asked the first.\n\n**Is it orderable?** Does a real manufacturer make it, is it a Western part with a real part number, is it still an active product rather than end-of-life. **Is it in stock?** Can this distributor put one in a box today, at a price you expected, from actual inventory rather than a marketplace reseller.\n\nThis board's design review did the first check thoroughly and assumed it had done the second. A later line-by-line stock pass found four real problems that the first check had hidden. None of them were electrical. All four changed the BOM.",
  ),
  table(
    ["Line", "What the stock pass found", "What changed"],
    [
      ["U3 shifter", "The tube-packaged version showed as no longer manufactured", "Moved to the tape-and-reel part, SN74AHCT125DR"],
      ["D1 USB ESD", "The stocked option was a house-brand clone, single-source", "Specified the STMicroelectronics part, clone kept as the alternate"],
      ["D3 data ESD", "The chosen part was on distributor backorder", "Substituted the Bourns CDSOD323-T05C"],
      ["C10 bulk", "The chosen electrolytic was out of stock", "Substituted a part from the same family, drop-in"],
    ],
  ),
  shot(
    "Two fields to read on every line: stock today, and lifecycle status.",
    "DigiKey product page for SN74AHCT125DR. Crop to the part header, the in-stock quantity and the lifecycle or product-status field, all legible at card width.",
  ),
  tube("Checking stock and lifecycle, line by line"),
  check(
    "**A part is listed as Active and comes from a real manufacturer. Is it safe to put on a frozen BOM?** Only if you also checked that a distributor holds inventory of it now. Active describes the product's lifecycle, not the shelf. This board had four lines that passed the first test and failed the second.",
  ),
  {
    type: "callout", severity: "info", label: "Jellybeans: the escape hatch for a passive",
    body: "One nuance to the exact-part-number rule, so a stockout never strands you. The **chips and connectors** here (U1, U2, U3, D1, D2, D3, J1, J4, J5, F1, LED3) are locked. Order those exactly. But a plain resistor or capacitor is a **jellybean**, a commodity part where any reputable maker's version works, as long as the **value, package, tolerance, dielectric and voltage rating all match**. If this board's 470 ohm 0805 line is out of stock, another manufacturer's 470 ohm 0805 at the same 1 percent drops right in. Beginners abandon projects over a sold-out resistor. You do not have to.",
  },
  dive(
    "Why the backordered ESD diode was replaced with a better one",
    "The data pin at the strip connector is exposed copper that a human will touch, so it carries a small diode whose job is to swallow a static discharge before it reaches anything expensive. The originally chosen part went on backorder, and the substitute was picked for availability. It turned out to be the better part anyway, for a reason worth understanding.\n\nAn ESD diode sits across the signal it protects, and every diode has capacitance. That capacitance hangs on the data line and, together with the 470 ohm series resistor in front of it, forms a low-pass filter that rounds off the edges of the signal. The original part had roughly 45 pF, which works out to a time constant of about 21 nanoseconds. The substitute has roughly 3 pF, which is about 1.4 nanoseconds.\n\nBoth are small next to a WS2812 pulse that stays high for hundreds of nanoseconds, so neither would have broken anything. But the low-capacitance part gives the edge back almost untouched, and on a signal whose whole meaning lives in pulse width, a sharper edge is free margin. A forced substitution is a chance to re-ask the selection question, and sometimes the answer improves.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Packages you can hand-build", "Every new part on this board was chosen so an iron can reach it."),
  prose(
    "Because you hand-build this board, the parts have to be ones you can actually place with an iron. The new lines were selected inside the same envelope as L1.01: **0805 passives**, big enough to hold with tweezers, unlike a 0402 that wants paste and hot air.\n\n**U3** arrives as a SOIC-14, a leaded package with pins you can see and touch, which is the friendliest thing a 14-pin chip can be. **J4 and J5** are through-hole screw terminals on a 5.08 mm pitch, so they are forgiving and mechanically solid, which matters because someone will tug the wires in them. **D2** is an SMA, big for a diode. **D3** is a SOD-323, small but leaded.\n\n**LED3 is the hard one, and there is no way around it.** A 5050 pixel has four pads that sit partly under a plastic body, with a lens directly over them that does not like heat. It is the only part on this board that genuinely demands technique, which is why flux moved to required at the requirements stage.",
  ),
  {
    type: "partModel", mpn: "SN74AHCT125DR",
    caption: "U3: the SN74AHCT125DR in SOIC-14, leaded and iron-friendly",
  },
  table(
    ["Ref", "Part", "Package", "How it solders"],
    [
      ["U3", "SN74AHCT125DR", "SOIC-14", "Leaded SMD. Drag-solder with flux, easiest 14-pin part there is"],
      ["LED3", "XL-5050RGBC-WS2812B", "5050", "The hard one. Pads part-hidden, lens hates heat, flux mandatory"],
      ["J4, J5", "282837-3 / 282837-2", "THT, 5.08 mm", "Through-hole. Forgiving, and mechanically strong for tugged wires"],
      ["D2", "SMAJ5.0A", "SMA", "Leaded SMD, physically large. Watch the cathode band"],
      ["D3", "CDSOD323-T05C", "SOD-323", "Small but leaded. Tweezers and a fine tip"],
      ["C10", "EEU-FM1C102", "Radial THT", "Through-hole, polarised, and tall. See the note below"],
    ],
  ),
  shot(
    "The 5050 pixel next to an 0805 resistor, for scale, with its four part-hidden pads visible.",
    "Macro shot of a loose XL-5050RGBC-WS2812B beside an 0805 resistor on a neutral mat, lit so the four underside pads and the lens are both legible.",
  ),
  gotcha(
    "C10 is 1000 uF, and it is tall",
    "The bulk capacitor at the injection terminal is a radial electrolytic roughly 10 mm across and 20 mm tall. That is fine on an open bench and a problem the moment the board goes in an enclosure, so it needs a height keep-out noted at layout rather than discovered at assembly. It is also **polarised**: a marked stripe on the can shows the negative leg, and fitting it backwards on a 5 V rail makes it vent. Through-hole parts are forgiving about heat and unforgiving about orientation.",
  ),
  check(
    "**Why 0805 passives instead of the smaller 0402?** Hand-soldering. An 0805 is about 2.0 by 1.25 mm, large enough to hold with tweezers and drag-solder with an iron. An 0402 is 1.0 by 0.5 mm, a quarter of the area, and really wants solder paste and a stencil.",
  ),
  dive(
    "Package sizes, in millimetres, and why the 5050 is the exception",
    "The package code is the part's size in hundredths of an inch. An 0805 is 0.08 by 0.05 inches, about **2.0 by 1.25 mm**, roughly a grain of rice. An 0402 is **1.0 by 0.5 mm**, half that on each side and a quarter of the area. Both come in every common value, but 0805 is about the smallest you can comfortably hold with tweezers and drag-solder with an iron, which is why this board specs 0805 throughout.\n\nThe pixel breaks the pattern. A 5050 is 5.0 by 5.0 mm, so by area it is the largest part on the board apart from the module, and you would expect it to be the easiest. It is the hardest. Size is not what makes a joint difficult; access is. The pixel's four pads sit partly beneath its own body, so you cannot watch the solder wet them, and the lens above them limits how long you can apply heat. A large part with hidden pads is harder than a small part with exposed ones, every time.\n\nOne ordering note that catches people: passives ship on reels with a minimum order quantity in the thousands. They cost pennies, so buy the reel and keep the spares for the ones you will inevitably flick across the room.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The nine newcomers", "Everything else on this BOM you have ordered before."),
  prose(
    "The L1.01 core carries over line for line: the module, the USB-C receptacle, the polyfuse, the USB ESD array, the regulator and its capacitors, the pull-ups, the CC pull-downs, the buttons, the indicator LEDs, the headers and the test points. Nine lines are new to this board, and each exists because of a decision you already met at requirements.\n\nRead the live BOM below against the four checks, then use the table to see what each newcomer is for.",
  ),
  table(
    ["Ref", "Manufacturer and MPN", "Why this board needs it"],
    [
      ["U3", "Texas Instruments SN74AHCT125DR", "The level shifter. The graded concept lives here"],
      ["LED3", "XINGLIGHT XL-5050RGBC-WS2812B", "The onboard first pixel, so the lesson runs on USB alone"],
      ["J4", "TE Connectivity 282837-3", "Strip output: 5 V, data and ground on a 3-position terminal"],
      ["J5", "TE Connectivity 282837-2", "Strip power in, on its own 2-position terminal"],
      ["C10", "Panasonic EEU-FM1C102", "1000 uF reservoir so a strip switching on does not sag its own supply"],
      ["C11", "Samsung CL21A475KAQNNNE", "4.7 uF bulk on USB 5 V, sized by the USB inrush ceiling"],
      ["D2", "Littelfuse SMAJ5.0A", "TVS across the injected 5 V. Catches a 12 V mistake"],
      ["D3", "Bourns CDSOD323-T05C", "ESD diode on the exposed data pin at J4"],
      ["C1", "Yageo CC0805KKX5R7BB106", "The 10 uF bulk cap, re-sourced when the original went out of stock"],
    ],
  ),
  { type: "bomTable", collapsed: false },
  band("orient", "in your BOM · How every line earns its place", "The BOM below is already sourced and frozen. You are not choosing parts here. You are seeing how each line earns its place."),
  does("Read the locked BOM", [
    {
      text: "**Exact part number:** a manufacturer plus a full part number on every line, never just a value.",
      proof: "Every line carries a manufacturer and a full part number.",
    },
    {
      text: "**In stock and active** at your distributor today, from real inventory rather than a marketplace reseller.",
      proof: "Every line shows current stock and an active lifecycle status.",
    },
    {
      text: "**A package you can hand-solder:** 0805 or larger for passives, leaded for anything with pins.",
      proof: "No package on the BOM is smaller than 0805 and nothing has hidden pins except the pixel.",
    },
    {
      text: "**A second source** named for anything critical, so a stockout is a swap rather than a stop.",
      proof: "The shifter, the pixel, both diodes and the bulk capacitor each name an alternate.",
    },
    {
      text: "**A real datasheet** for anything sold as a clone or a compatible part, not the datasheet of the part it imitates.",
      proof: "You can open the pixel's own datasheet, not just a WS2812B reference document.",
    },
  ]),
  trace("Before you call the BOM frozen", [
    { text: "Every new line has been checked for stock today, not just for being an active product", help: "Active describes the lifecycle. Stock describes the shelf. This board lost four lines to that distinction." },
    { text: "Nothing on the list is marketplace-only inventory", help: "A marketplace listing is a third-party reseller, not the distributor's own stock. Lead times and authenticity both get less certain." },
    { text: "The pixel's own datasheet is in your hands, not a compatible part's", help: "Compatible describes the protocol. It says nothing about supply range or what voltage kills the data pin." },
    { text: "Every polarised part has its orientation marked and understood", help: "C10, D2, D3, LED1, LED2 and LED3 all care which way round they go, and two of them vent or die if you get it wrong." },
    { text: "The tall parts are flagged so layout can leave them room", help: "C10 stands about 20 mm proud. That is an enclosure problem you want to find now." },
  ]),

  // ── 06 ────────────────────────────────────────────────────────────────────
  sect("06", "What it cost, honestly", "This board came in over its own budget, and the reason is worth knowing."),
  prose(
    "The design set out to land around **14 to 15 dollars** in parts. It actually lands around **18 to 19**, and the overrun is not spread thinly. Two screw terminals account for a large share of it, and the in-stock substitutions for the ESD diode and the electrolytic added most of the rest.\n\nThat is a real result, reported rather than smoothed over. It is also a lesson in what connectors cost: a terminal block that takes bare wire and holds it under a screw is a piece of machined metal in a moulded housing, and it prices like one. The silicon on this board is cheap; the things that touch the outside world are not.\n\nYou have two honest options at this point in a real project. Accept the overrun because the connectors buy something the board needs, or go back and value-engineer, which here would mean a cheaper terminal style or a cheaper in-stock ESD part. This board accepted it, because a terminal a beginner can wire without a crimp tool is worth the money.",
  ),
  check(
    "**Your BOM comes in 25 percent over its cost target. What is the wrong move?** Quietly restating the target. The useful moves are to accept the overrun with a reason, or to re-open the two or three lines that dominate it. On this board the dominant lines are the connectors, not the chips.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: sourcing",
    gate: true,
    questions: [
      {
        id: "mpn-not-value",
        q: "A schematic says \"470 ohm resistor\". Why is that not enough to order one?",
        options: [
          "470 ohm is not a real stockable value",
          "It does not say the exact part, so the package size, tolerance and manufacturer are still missing",
          "Resistors can only be ordered in kits",
        ],
        answer: 1,
        explain: "An exact part number pins the size, tolerance and maker. A bare value could be any of a thousand parts, most of which will not fit your pads.",
      },
      {
        id: "orderable-vs-stock", reviewId: "l103-orderable-vs-stock",
        q: "A part is made by a real manufacturer and its lifecycle says Active. What have you still not checked?",
        options: [
          "Whether a distributor is actually holding inventory you can buy today",
          "Whether the value is correct",
          "Nothing. Active means it is available",
        ],
        answer: 0,
        explain: "Active describes the product's lifecycle, not the shelf. This board's review passed the first check and still lost four lines to the second.",
      },
      {
        id: "clone-datasheet", reviewId: "l103-clone-datasheet",
        q: "The onboard pixel is sold as \"WS2812B compatible\". What does that word actually promise you?",
        options: [
          "Identical electrical specifications to the original part",
          "That the manufacturer has tested it against the original",
          "That it speaks the same protocol. It says nothing about supply range or what voltage damages the data pin",
        ],
        answer: 2,
        explain: "Compatible is a protocol claim. Design against the clone's own datasheet, and if a supplier cannot produce one, treat that as a sourcing answer.",
      },
      {
        id: "second-source",
        q: "Your chosen ESD diode goes on backorder halfway through the project. What saves you?",
        options: [
          "A pre-identified second source with the same footprint and adequate specs",
          "Redesigning the board around what is available",
          "Waiting for it to come back into stock",
        ],
        answer: 0,
        explain: "That is exactly what happened here. The substitute kept the same SOD-323 footprint, so nothing in the layout had to move.",
      },
      {
        id: "hand-solder-0805",
        q: "Why does this board use 0805 passives rather than smaller 0402 ones?",
        options: [
          "An 0805 is large enough to place and drag-solder comfortably with an iron",
          "0402 parts cannot be bought in small quantities",
          "0805 parts are cheaper",
        ],
        answer: 0,
        explain: "An 0805 is about 2.0 by 1.25 mm. An 0402 is a quarter of that area and really wants solder paste and a stencil.",
      },
      {
        id: "polarised-parts",
        q: "Which of these new parts will vent or fail if you fit it the wrong way round?",
        options: [
          "U3, the SOIC-14 buffer",
          "C10, the 1000 uF electrolytic",
          "The 470 ohm series resistors",
        ],
        answer: 1,
        explain: "The electrolytic is polarised and marked with a stripe on the negative side. Reversed on a 5 V rail it vents. Resistors have no orientation at all.",
      },
    ],
  },

  exit(
    "Every line of this BOM is now a real part: an exact manufacturer part number, in stock and active today rather than merely orderable, in a package an iron can reach, with a second source named where it matters and a genuine datasheet behind the one part that is a clone. The quick check above is the gate and there is nothing to attach. The schematic is next, and it will go quickly, because every part on it is one you have already chosen.",
  ),

  ref("SNx4AHCT125 datasheet (Texas Instruments, SCLS264R): pin functions, absolute maximum ratings and input thresholds", "https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf"),
  ref("WS2812B datasheet (Worldsemi): the reference part this board's pixel is compatible with", "https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf"),
  ref("USB 2.0 specification (USB-IF): the 10 uF ceiling on a device's bus capacitance", "https://www.usb.org/document-library/usb-20-specification"),
  ref("Ceramic capacitor basics (PSMA): why the dielectric class sets real capacitance under voltage", "https://www.psma.com/sites/default/files/uploads/files/Ceramic%20Capacitor%20Basics.pdf"),
  ref("SMAJ series TVS datasheet (Littelfuse): standoff, breakdown and clamping voltages for the SMAJ5.0A", "https://www.littelfuse.com/products/tvs-diodes/surface-mount/smaj"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "BOM_SOURCING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
