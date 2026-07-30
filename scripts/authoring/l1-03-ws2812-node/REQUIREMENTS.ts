// L1.03 WS2812 node — REQUIREMENTS card.
//
// Authored ahead of the board from docs/boards/l1-03-ws2812-node/{design.md,
// bom.csv,validation-log.md}, with L1.01's REQUIREMENTS card as gospel for
// everything the two boards share (the bench, the lead-free choice, the ADC1
// rule, the antenna keep-out, the "everything is provided" promise).
//
// The card this replaces was 19 blocks against L1.01's 33: correct, but with no
// bench, no media, no deep dives and four sections carrying the whole lesson.
// The owner rejected that compression on 2026-07-22.
//
// NEW material here is the addressable-LED chain: the 0.7 x VDD threshold, the
// one-wire protocol, and the current budget that forces a second 5 V supply.
// Facts: WS2812 thresholds and timings from the Worldsemi WS2812B datasheet;
// 74AHCT125 thresholds, VOH and pinout from TI SCLS264R (Feb 2024 revision);
// board-specific numbers from design.md sections 3 and 5.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("L1.03: driving addressable LEDs from a 3.3 V microcontroller"),

  prose(
    "Addressable LEDs look like magic: one wire, any colour, chainable as far as you like. This board teaches the un-magic part, and it comes down to one number. A WS2812 pixel running on 5 V will only read a data high that reaches **0.7 of its own supply**, which is **3.5 V**. Your ESP32-S3 drives **3.3 V**. The signal lands 0.2 V short of the bar.\n\nThat gap is the graded concept. You fix it with a **[[level shifter]]**, a small buffer chip that takes the 3.3 V signal in and puts a clean 5 V version out, and you watch it work on a single pixel soldered to the board and lit from the USB cable alone. Driving a long external strip is the capability layer that sits on top.",
  ),

  band("orient", "Meet the margin problem", "Read this once. Nothing to build yet. You are settling the five promises the rest of the lesson has to keep."),

  {
    type: "callout", severity: "info", label: "Everything's provided: you don't source or draw a thing",
    body: "As on the first two boards, you will not hunt for a part or draw a symbol. The [[KiCad starter]] you download at the schematic stage ships with every part's symbol, footprint and 3D model already placed, and the [[exact BOM]], manufacturer part numbers and all, is specified for you. You bring the bench below; we bring the parts library.",
  },

  // ── 00 ────────────────────────────────────────────────────────────────────
  sect("00", "The bench you'll need", "The same bench as the first two boards, with one tool moving from optional to mandatory."),
  prose(
    "This board is hand-built with a small [[SMD rework|SMD-rework]] setup anchored by a temperature-controlled iron, exactly as L1.01 was. Every joint on it was chosen to be iron-solderable. Beyond the iron you want flux, tweezers, a multimeter and some magnification for inspecting joints. A hot-air station stays optional and the assembly card shows both paths.\n\nOne change from the earlier boards: **flux is now required, not merely recommended**. The onboard pixel is a 5050 package with a plastic lens sitting directly over its pads, and its four pads face partly under the body. Flux is what lets solder flow into those pads at a temperature the lens survives. Sort your bench out before you order parts.",
  ),
  {
    type: "callout", severity: "info", label: "Lead-free or leaded?",
    body: "Either works here, and the reasoning is unchanged from L1.01. We recommend **lead-free** ([[SAC305]]) for two honest reasons: no lead to handle or dispose of, and it is the real commercial process, so your joints behave like production. The catch: lead-free melts about 35 °C hotter and its joints look duller, so **leaded 63/37 is more forgiving for a first board**. On this board the tradeoff has a second edge, because the 5050 pixel's lens dislikes heat and leaded solder lets you work cooler. If you go leaded, don't eat at the bench and wash your hands.",
  },
  gotcha(
    "the pixel is the hardest joint on the board",
    "The 5050 pixel is the one part on this board that punishes a dry technique. Its lens deforms if you park a hot iron on it, and its pads sit partly under the body where you cannot see the joint form. The assembly card walks it properly. For now, just make sure a flux pen or flux dropper is on your order.",
  ),
  {
    type: "kit",
    intro: "The gear, grouped by how essential it is. This is the L1.01 bench with flux promoted to required. The iron is the anchor; a 2-in-1 heat station covers the optional hot-air path too and bundles several of the smaller items. Tiered rows give you a budget / mid / pro choice.",
    items: [
      {
        label: "Soldering iron (a 2-in-1 heat station is the easy pick)", need: "required",
        note: "Temperature control is the feature that matters here: you want to hold around 315 °C for the pixel and not guess. The WEP 2-in-1 adds hot air for the optional [[reflow]] path.",
        picks: [{ asin: "B0BXN5NXFQ", label: "Hobby" }],
      },
      {
        label: "No-clean flux", need: "required",
        note: "Promoted from recommended on this board. Liquid no-clean RMA flux in a dropper; a flux pen works as well and is tidier for one 5050 pad set.",
        picks: [{ asin: "B0CN29BZKV" }],
      },
      {
        label: "Lead-free solder", need: "required",
        note: "Rosin-core. 0.6 mm for the fine SMD work, 0.8 mm for the screw terminals and headers.",
        picks: [{ asin: "B07R6J8DXH", label: "0.6 mm" }, { asin: "B07QZX9LG2", label: "0.8 mm" }],
      },
      {
        label: "ESD tweezers", need: "required",
        note: "A precision anti-static set. The pixel has to be placed and held square, and fingers will not do it.",
        picks: [{ asin: "B0BNNGC3Q2" }],
      },
      {
        label: "Magnification: USB microscope", need: "required",
        note: "For inspecting joints and hunting bridges. On this board it earns its keep on the SOIC-14 shifter and the pixel.",
        picks: [{ asin: "B08NSL6CDZ" }],
      },
      {
        label: "Digital multimeter", need: "required",
        note: "Needs a [[continuity]] beeper and DC volts. You will use it to prove the two 5 V rails are separate before you power anything.",
        picks: [{ asin: "B07SHLS639", label: "Budget" }, { asin: "B00HE6MIJY", label: "Pro" }],
      },
      {
        label: "USB-C data cable", need: "required",
        note: "A known-good DATA cable, not charge-only. Grab a USB-A-to-C instead if your computer has the older port.",
        picks: [{ asin: "B08BYBFQ62" }],
      },
      {
        label: "Regulated 5 V bench supply for the strip", need: "recommended",
        note: "Only for the external-strip half of the lesson. Wants a real 5 V output, current limiting, and its own fuse. The onboard pixel needs none of this.",
      },
      {
        label: "A short WS2812 strip or ring", need: "recommended",
        note: "Eight to thirty pixels is plenty to see a chain run. The graded lesson works without one, so this is the capability layer, not a blocker.",
      },
      {
        label: "Solder wick / braid", need: "recommended",
        note: "Flux-coated desoldering braid for lifting bridges off the SOIC-14.",
        picks: [{ asin: "B0943PDCC4" }],
      },
      {
        label: "ESD wrist strap", need: "recommended",
        note: "Adjustable, with a grounding cord and alligator clip.",
        picks: [{ asin: "B00B2T9C8Y" }],
      },
      {
        label: "Brass-wool tip cleaner + tinner", need: "recommended",
        note: "The coiled-brass kind, plus tip tinner to revive a dead tip.",
        picks: [{ asin: "B000AQQFMG" }],
      },
      {
        label: "Isopropyl alcohol + brush", need: "recommended",
        note: "99% IPA and a cheap flux brush. You will use more flux on this board, so you will wash more of it off.",
        picks: [{ asin: "B004SPJP5O" }],
      },
      {
        label: "Bench fan / ventilation", need: "recommended",
        note: "Clear the flux fumes. A safety item.",
        picks: [{ asin: "B07VWDN29F" }],
      },
      {
        label: "Inline USB power meter", need: "helpful",
        note: "Reads volts and amps. Genuinely useful here: it shows you what the onboard pixel actually costs the USB rail.",
        picks: [{ asin: "B0B5W5NKKN" }],
      },
      {
        label: "Heat-resistant ESD work mat", need: "helpful",
        note: "Magnetic, anti-static, with a grounding cord. A safe surface that catches parts.",
        picks: [{ asin: "B0D2LL5V4R" }],
      },
      {
        label: "Kapton tape", need: "helpful",
        note: "5 to 10 mm polyimide tape to hold parts during reflow.",
        picks: [{ asin: "B08KY8Y5BS" }],
      },
    ],
  },

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "What you're building", "The L1.01 board again, plus one new sub-circuit and two screw terminals."),
  { type: "partModel", mpn: "XL-5050RGBC-WS2812B", caption: "LED3: the onboard first pixel, a 5050 WS2812-compatible part" },
  prose(
    "Underneath, this is your L1.01 breakout: **U1**, an ESP32-S3-WROOM-1 module, powered and programmed over one USB-C port (**J1**), through a [[polyfuse]], an ESD array and an [[LDO]] that makes the 3.3 V rail. That whole chain is validated and reused unchanged, which is why this lesson can spend its attention somewhere new.\n\nThe new part is a chain of four things. **GPIO5** carries the pixel data. **U3**, a 74AHCT125 buffer, lifts it from 3.3 V to the 5 V rail. **LED3**, one WS2812 pixel soldered to the board, is the first link in the chain and runs on USB power. And two screw terminals let a real strip join in: **J4** carries 5 V, data and ground out to the strip, while **J5** brings in the strip's own 5 V supply from an external brick.",
  ),
  shot(
    "Where this ends up: the finished node with its onboard pixel lit, driving a strip out of the screw terminal.",
    "Finished L1.03 board, photo preferred. USB-C at one end, onboard pixel lit, wires from J4 running to a short WS2812 strip that is also lit. Dark neutral background, board about 70% of frame.",
  ),
  table(
    ["Ref", "Part", "Role"],
    [
      ["U1", "ESP32-S3-WROOM-1-N16R2", "The microcontroller module. Reused from L1.01"],
      ["U3", "SN74AHCT125DR", "The level shifter: reads 3.3 V, drives 5 V"],
      ["LED3", "XL-5050RGBC-WS2812B", "The onboard first pixel, powered from USB"],
      ["R7, R8", "470 ohm", "Series damping on each data hop"],
      ["J4", "282837-3", "Strip output: 5 V, data, ground"],
      ["J5", "282837-2", "Strip power in: external 5 V and common ground"],
      ["D2", "SMAJ5.0A", "TVS across the injected 5 V: catches a wrong supply"],
      ["D3", "CDSOD323-T05C", "[[ESD]] diode on the exposed data pin at J4"],
      ["C10", "EEU-FM1C102", "1000 uF reservoir at the injection terminal"],
    ],
  ),
  check(
    "**Which of the parts above is doing the thing this lesson grades you on?** U3, the 74AHCT125. Everything else either carries power, protects a connector or damps an edge. U3 is the part that solves the 3.3 V into 3.5 V problem.",
  ),
  dive(
    "What \"addressable\" actually means",
    "A plain LED strip has one brightness for the whole strip. An addressable strip gives every pixel its own controller chip, sitting in the same package as the three colour dies, and they are wired in a chain: the data output of one pixel feeds the data input of the next.\n\nThe controller sends a burst of colour data down the single wire. Each pixel swallows the first 24 bits it hears (8 bits each of green, red and blue, in that order, most significant bit first) and passes everything after that along to the next pixel in the chain. When the line goes quiet for long enough, every pixel latches what it grabbed and shows it. That is why one GPIO can drive hundreds of LEDs, and why the chain has a strict order: pixel 7 gets the eighth block of 24 bits because seven pixels ahead of it each took a bite first.\n\nThe cost of that elegance is timing. Each bit is a fixed-length pulse whose high time encodes the value, so the driver has to hold sub-microsecond accuracy. On the ESP32 you do not bit-bang it by hand; a hardware peripheral clocks the waveform out for you.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The 0.2 V that breaks everything", "3.3 V into a threshold of 3.5 V. Sometimes it works on the bench anyway, which makes it worse."),
  prose(
    "The pixel's datasheet sets its input-high threshold as a fraction of its own supply: **0.7 x VDD**. Run the pixel at 5 V and the bar is **3.5 V**. A bare 3.3 V GPIO sits under it.\n\nReal silicon has slack, so a direct connection often flickers into life and works all afternoon. Then it glitches when the supply rides high, or when a new reel of pixels has a slightly different threshold, or when the room is cold. A design that passes the demo and fails in the field is worse than one that never worked, because nothing tells you where to look.\n\n**U3, the 74AHCT125, converts that luck into a specification.** Its inputs are TTL-style, which means they call anything above **2.0 V** a high, so 3.3 V is a comfortable, unambiguous one. Its output swings to whatever rail you feed it, and here that rail is the same 5 V the pixel runs on. Worst case, over the full temperature range and driving 8 mA, the part guarantees at least **3.8 V** out. The bar is 3.5 V. You have margin, in writing.",
  ),
  table(
    ["Level", "Value", "Verdict"],
    [
      ["What the pixel demands (0.7 x 5 V)", "3.5 V", "the bar"],
      ["Bare ESP32-S3 GPIO high", "3.3 V", "0.2 V under the bar: marginal"],
      ["74AHCT125 input threshold", "2.0 V", "3.3 V clears it easily"],
      ["74AHCT125 output, worst case at 8 mA", "3.8 V", "clears the bar, guaranteed"],
      ["74AHCT125 output, at the pixel's actual load", "about 4.4 V", "the number you will measure"],
    ],
  ),
  shot(
    "The proof on a scope: the 3.3 V GPIO edge and the shifted edge at TP3, on the same timebase.",
    "Two-channel scope capture. Ch1 on GPIO5 showing a 3.3 V high, Ch2 on TP3 showing about 4.4 V, cursors on both levels, 1 us/div. Both traces legible with voltage readouts.",
    "See it wired · the level shift, measured",
  ),
  tube("Why 3.3 V is not enough for a 5 V pixel"),
  check(
    "**A friend's directly-wired 3.3 V strip works fine. Why is that not evidence you can skip the shifter?** Their build is sitting 0.2 V below the worst-case threshold and running on part-to-part slack. It can stop working with a new reel, a warmer room, or a supply that reads 5.2 V. Working once is not the same as being specified to work.",
  ),
  dive(
    "Why the threshold moves with the supply, and why that matters",
    "The pixel does not have a fixed voltage it calls high. It derives one from its own supply: 0.7 x VDD. Feed the strip 5.25 V and the bar climbs to 3.68 V. Feed it 4.8 V and the bar drops to 3.36 V. A fixed 3.3 V driver loses ground every time the supply rises, which is the wrong way round, because a supply riding high is exactly the condition you cannot control on someone else's bench.\n\nThe buffer's output rides the same rail the onboard pixel runs on, so when that rail moves, driver and threshold move together and the margin holds instead of eroding. That co-tracking is the real reason a level shifter beats hopeful direct wiring, and it is worth more than the raw voltage headroom.\n\nThe second thing you buy is edge quality. The pixel reads a bit by measuring how long the line stays high, with roughly 400 ns separating a zero from a one. A slow, rounded edge moves the moment the pixel decides the line went high, which eats into that budget. A buffer driving a short trace gives you a fast, square edge and hands the whole timing budget to the protocol instead of to the wiring.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The first pixel: a lesson that runs on one USB cable", "One WS2812 lives on the board. The graded concept is provable with nothing plugged into the terminals."),
  prose(
    "**LED3** is a single 5050 pixel wired to the USB 5 V rail. GPIO5 drives it through the shifter and a 470 ohm series resistor (**R7**). Before any strip exists, you flash firmware and watch this one pixel obey. That is the level shifter working, on one cable, with nothing else attached.\n\nOne pixel at full white draws about **60 mA**, which the USB rail can carry without complaint. Its data output then leaves the board through a second 470 ohm resistor (**R8**) and out to **J4**, so the onboard pixel is genuinely pixel zero of whatever chain you attach later. Nothing about it is a mock-up.",
  ),
  shot(
    "The whole graded lesson: one cable, one lit pixel, nothing in the terminals.",
    "Close-up of the assembled board with only a USB-C cable attached and LED3 lit a saturated colour. Screw terminals visibly empty. Shallow depth of field, pixel in focus.",
  ),
  check(
    "**Why put a pixel on the board when the point is driving a strip?** Because it makes the graded concept provable on USB power alone. No bench supply, no strip, no wiring mistakes between you and the result. It also becomes the first link of any real chain, so it is not wasted once you move on.",
  ),
  dive(
    "The one-wire protocol, in numbers",
    "Every bit is a pulse of the same total length, about **1.25 microseconds**, and the value lives in how much of that is spent high. A zero holds high for roughly 0.4 microseconds; a one holds high for roughly 0.8. That works out to a data rate of 800 kbit per second, which is the number you will see quoted for these parts.\n\nAfter the last bit, the driver holds the line low. Once it has been low long enough (the datasheet calls for tens of microseconds; this lesson's firmware waits 300 microseconds, which is comfortably past any variant's requirement) every pixel latches its 24 bits at once and the chain updates.\n\nTwo consequences fall out of this. First, refresh rate is bounded by pixel count: 24 bits at 1.25 microseconds each is 30 microseconds per pixel, so 300 pixels take about 9 milliseconds to send, and you cannot update faster than that. Second, the timing tolerance is tight enough that an operating system with other things to do will miss it, which is why the ESP32 hands the job to a dedicated hardware peripheral rather than a delay loop.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "warn", label: "04 · Two 5 V rails that must never meet",
    body: "A real strip eats amps. USB does not have them. So the strip gets its own supply, and the board keeps the two 5 V nets strictly apart.",
  },
  prose(
    "At **60 mA per pixel at full white**, a strip outruns USB almost immediately. Ten pixels want 0.6 A. Thirty want 1.8 A. The [[polyfuse]] on this board holds 0.5 A, and the USB port behind it was never promising more than the ESP32 already spends.\n\nSo strip power enters at **J5**, its own screw terminal, from an external **regulated 5 V supply of 5.25 V or less**, and travels on its own net called **5V_EXT** to the strip connector. **The USB 5 V net and 5V_EXT never share copper on this board.** Only ground is common, and it has to be: the strip's data input measures its voltage against ground, so if the two supplies do not share one, the data signal has no meaning at the far end.\n\nThat isolation is an invariant. The schematic will enforce it and the layout will honour it, and the payoff is a board that can *drive* a thousand pixels while *powering* exactly one.",
  ),
  table(
    ["Pixels at full white", "Current", "Can USB do it?"],
    [
      ["1 (the onboard pixel)", "about 60 mA", "Yes. This is the graded lesson"],
      ["8", "about 0.5 A", "No. Already at the polyfuse hold current"],
      ["30", "about 1.8 A", "No. Needs its own supply"],
      ["144 (a 1 m dense strip)", "about 8.6 A", "No. Needs power injected at both ends"],
    ],
  ),
  shot(
    "What a strip actually costs: an inline meter reading the current for a 30-pixel run at white.",
    "Bench shot: 30-pixel WS2812 strip lit full white, powered from a bench supply, current display legible showing roughly 1.8 A. Include the board driving it.",
  ),
  check(
    "**Why can't the strip just draw from the board's USB 5 V?** A 30-pixel strip at full white wants about 1.8 A. That is past the polyfuse, past what the USB port is offering, and enough to drag down the rail feeding your microcontroller. Big loads get their own supply and join the board at ground only.",
  ),
  gotcha(
    "5 V only at J5, and fuse the supply",
    "J5 accepts a regulated 5 V supply and nothing else. A 12 V brick with the same barrel plug will make **D2**, the TVS across the rail, do its job and die doing it. That is the intended outcome: a sacrificial part and a blown supply fuse, instead of a dead board. It only works if your supply is actually fused or current-limited, so use one that is.",
  ),
  dive(
    "Budgeting a strip's power for real",
    "The 60 mA figure is one pixel with all three colour channels at maximum, which is white at full brightness. Most real animations never get there: a moderate colour at half brightness is closer to 15 mA per pixel, so a 60-pixel strip that would need 3.6 A in the worst case might comfortably run on 1 A of supply.\n\nDesign to the worst case anyway when you are choosing a supply, then cap brightness in firmware to guarantee you stay inside it. The failure mode of an under-sized supply is not a blown fuse; it is a sagging rail that makes the far end of the strip turn red and flicker, because red is the lowest forward-voltage die and the last one to give up.\n\nThe other thing that sags is the copper. A long strip fed from one end drops voltage along its own power rails, so the far pixels see less than 5 V, run dim, and shift colour. The standard fix is power injection: run a second pair of wires from the supply directly to the far end, or to the middle, so the current does not have to travel the whole length through thin traces.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The order of operations, and the rule that never lapses", "Two supplies mean a sequence. And the antenna keeps its clear air whether or not you use the radio."),
  prose(
    "With two supplies comes a habit: **bring the strip's 5 V up before or with USB, and take USB down first**. If the board runs while the strip supply is off, the board's data line is driving a powered-down input on the first strip pixel. The 470 ohm series resistor bounds that current to a harmless few milliamps and the protection diodes back it up, but the primary control is the order you plug things in. The bring-up card drills it.\n\nThe antenna rule from L1.01 carries over unchanged. The striped end of **U1** is the Wi-Fi antenna, metal near an antenna detunes it, and this lesson leaves the radio idle. The copper rule still holds: the module sits at the board edge with the antenna end overhanging it, and nothing copper goes under or beside that zone. Rules you only follow when they are convenient are not rules.\n\nThe [[ADC1]] rule carries over too. Nothing on this board reads an analog input, but if you hang one off the headers later, it lands on GPIO1 through GPIO10, because [[ADC2]] belongs to the radio.",
  ),
  shot(
    "The silkscreen that keeps you honest: J5 labelled for 5 V only, with polarity marked.",
    "Close-up of the board silkscreen around J4 and J5, legible: the 5 V ONLY warning at J5, polarity marks, and the separate labels distinguishing USB 5 V from the strip 5V_EXT.",
  ),
  check(
    "**You plug in USB first, with the strip supply still off. What is happening at the first strip pixel?** Your board is driving data into an input whose chip has no power. R8 limits the current to a few milliamps and the diodes bound it, so nothing dies, but it is outside how the part is specified to be used. Strip supply first, every time.",
  ),

  // ── the note ──────────────────────────────────────────────────────────────
  band("do", "in your notes · Write the promises down", "Five short lines, in your own words. Nothing uploads and no gate waits on it, which is exactly why it is worth doing."),
  does("Your requirements note", [
    {
      text: "**LEVELS:** the pixel wants data highs of 3.5 V, which is 0.7 of its 5 V supply. A bare 3.3 V GPIO is 0.2 V short. The 74AHCT125 buffer guarantees at least 3.8 V out.",
      proof: "Your note carries 3.5 V, 3.3 V, and the guaranteed 3.8 V floor.",
    },
    {
      text: "**FIRST PIXEL:** one WS2812 lives on the board, runs on USB power, and proves the whole graded concept with nothing attached to the terminals.",
      proof: "Your note says the graded demo runs on USB alone.",
    },
    {
      text: "**RAILS:** the strip runs on external regulated 5 V at its own terminal, 5.25 V or less. The USB 5 V net and 5V_EXT never share copper. Ground is common.",
      proof: "Your note names two separate 5 V nets that share only ground.",
    },
    {
      text: "**ORDER:** strip supply on before or with USB. USB comes down first.",
      proof: "Your note records the power-up and power-down order.",
    },
    {
      text: "**RADIO:** the antenna end of U1 gets clear air, overhanging the board edge with no copper under or beside it, even though this lesson never keys the radio.",
      proof: "Your note says the antenna keeps its keep-out regardless of whether Wi-Fi is used.",
    },
  ]),

  {
    type: "quiz",
    prompt: "Quick check: requirements",
    gate: true,
    questions: [
      {
        id: "threshold-math", reviewId: "l103-threshold-math",
        q: "A WS2812 running on a 5 V supply will only read a data high that reaches...",
        options: [
          "3.5 V, which is 0.7 of its supply voltage",
          "3.3 V, one standard logic level",
          "5 V exactly, the full supply",
        ],
        answer: 0,
        explain: "The threshold is specified as 0.7 x VDD. At a 5 V supply that lands on 3.5 V, which a bare 3.3 V GPIO sits under.",
      },
      {
        id: "marginal-worse",
        q: "A directly-wired 3.3 V data line often works on the bench. What is wrong with shipping it?",
        options: [
          "Nothing. Working is working",
          "It sits 0.2 V under the worst-case threshold, so it runs on part-to-part slack and fails with a new reel, a cold room or a high supply",
          "The GPIO pin will burn out over time",
        ],
        answer: 1,
        explain: "Marginal designs pass demos and fail in the field. The buffer replaces luck with a guaranteed floor of margin.",
      },
      {
        id: "shifter-input-threshold",
        q: "Why can the 74AHCT125 accept a 3.3 V input as a solid high when the pixel cannot?",
        options: [
          "It amplifies whatever voltage it is given",
          "Its inputs are TTL-style, so anything above 2.0 V counts as a high regardless of the supply rail",
          "It runs on 3.3 V rather than 5 V",
        ],
        answer: 1,
        explain: "The AHCT family has a fixed 2.0 V input threshold that does not scale with the supply, which is exactly what makes it a 3.3 V to 5 V translator.",
      },
      {
        id: "first-pixel-role",
        q: "Why does one pixel live on the board itself?",
        options: [
          "To light the enclosure",
          "As a spare in case a strip pixel dies",
          "It makes the level-shifting lesson provable on USB power alone, before any strip exists",
        ],
        answer: 2,
        explain: "The onboard pixel is the graded demo: flash, watch it obey, concept proven. It then becomes pixel zero of any chain you attach.",
      },
      {
        id: "rails-never-join", reviewId: "l103-rails-never-join",
        q: "What is the relationship between the board's USB 5 V and the strip's 5 V?",
        options: [
          "They are the same net, joined at the fuse",
          "Separate nets that never share copper, with only ground in common",
          "The strip's 5 V feeds the board when USB is absent",
        ],
        answer: 1,
        explain: "Keeping them isolated means strip amps never cross the USB path. Common ground is the one shared reference, and the data signal needs it.",
      },
      {
        id: "why-external",
        q: "The reason a strip needs its own supply comes down to...",
        options: [
          "Voltage: strips need more than 5 V",
          "Noise: USB power is too dirty for LEDs",
          "Current: about 60 mA per pixel at full white outruns USB within a handful of pixels",
        ],
        answer: 2,
        explain: "It is a current budget problem. Thirty pixels can want about 1.8 A, which is past the polyfuse and past what the port offers.",
      },
      {
        id: "common-ground-why",
        q: "The two supplies must share a ground. Why does the data line care?",
        options: [
          "Ground carries the data signal itself",
          "A shared ground doubles the available current",
          "The strip reads its data input as a voltage measured against ground, so without a shared ground the signal has no meaning at the far end",
        ],
        answer: 2,
        explain: "Every logic threshold is a voltage relative to that device's ground. Two grounds that never meet give the receiver no reference to compare against.",
      },
      {
        id: "power-order",
        q: "What is the power-up order for the two supplies?",
        options: [
          "Strip supply before or with USB, and USB comes down first",
          "USB first, always",
          "Order never matters",
        ],
        answer: 0,
        explain: "USB-only with a dead strip means the data line is driving an unpowered input. The series resistor bounds it; the habit prevents it.",
      },
    ],
  },

  exit(
    "Five promises pinned: the 3.5 V bar and the buffer that clears it, an onboard first pixel that runs on USB alone, two 5 V rails joined at ground only, a power order, and clear air for the antenna. The quick check above is the gate. Pass it and the next stage opens, where the bill of materials is mostly old friends plus nine newcomers. There is nothing to attach on a build this size.",
  ),

  ref("WS2812B datasheet (Worldsemi): the 0.7 x VDD input threshold, bit timings and the 24-bit GRB data order", "https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf"),
  ref("SNx4AHCT125 datasheet (Texas Instruments, SCLS264R): TTL input thresholds and the guaranteed output high", "https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf"),
  ref("ESP32-S3 datasheet (Espressif): native USB, the ADC1 and ADC2 split, and GPIO drive", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module pinout and the antenna keep-out zone", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
  ref("Adafruit NeoPixel Uberguide: level shifting, power budgeting and injection practice for WS2812 chains", "https://learn.adafruit.com/adafruit-neopixel-uberguide"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "REQUIREMENTS", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
