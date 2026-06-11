// Rewrites the WROOM L1.01 guide-card content into the plain, warm, beginner
// voice of Jonathan Bartlett's "Electronics for Beginners" (Apress, 2020),
// while keeping the rich structure (callouts, tables, deep-dives, 3D part
// models, quizzes), every board-specific fact + MPN, and the source-first order
// (BOM before schematic). Re-runnable + idempotent: updates by (project, stage).
//
// Backup of the pre-rewrite content lives in scripts/_wroom-guide-backup.json.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SLUG = "l1-01-wroom-breakout";

type Card = { lead: string; contentBlocks: unknown[] };

const CARDS: Record<string, Card> = {
  REQUIREMENTS: {
    lead: "Before you pick a single part, decide what the board has to do and the limits it has to respect. These are the promises everything else has to keep — cheap to get right now, expensive to fix later.",
    contentBlocks: [
      {
        type: "prose",
        md: "Requirements are just the promises your board has to keep. The good news is that this board's promises are short and clear: power it from one USB-C port, run an ESP32-S3, bring its pins out to headers, and don't hurt the radio. Nail these down now and the rest of the build is mostly careful bookkeeping.",
      },
      {
        type: "partModel",
        mpn: "ESP32-S3-WROOM-1-N16R2",
        caption: "U1 — the ESP32-S3-WROOM-1 module this board exists to break out",
      },
      {
        type: "callout",
        label: "01 · What you're building",
        severity: "info",
        body: "A USB-C-powered ESP32-S3 breakout: a small, hand-solderable board that brings the module's pins out to breadboard headers.",
      },
      {
        type: "prose",
        md: "At the center is **U1**, the ESP32-S3-WROOM-1 — a [[microcontroller]] module (a tiny computer on a single chip) with Wi-Fi and Bluetooth already built in. One USB-C port (**J1**) does two jobs at once: it powers the board and it loads your programs. The S3 can speak USB by itself, so it shows up on your computer and takes firmware directly — there's no separate USB-to-serial 'programmer' chip in the middle. Two snap-apart headers (**J2/J3**) bring the GPIO pins out to a breadboard. That's the whole mission: a clean, reliable way to get your hands on the S3.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "U1", decoration: "ref" },
            { text: "ESP32-S3-WROOM-1-N16R2", decoration: "mpn" },
            { text: "The microcontroller module (native USB)" },
          ],
          [
            { text: "J2  J3", decoration: "ref" },
            { text: "1×22 headers" },
            { text: "Break the GPIO out to a breadboard" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why does this board need no separate USB-to-serial programmer chip? Because the ESP32-S3 has native USB built in — it shows up on your computer and takes firmware over the USB-C port directly.",
      },
      {
        type: "deepDive",
        summary: "Native USB vs a separate bridge chip",
        body: "Most older microcontrollers can't speak USB at all. They talk a simpler language called serial, so the board needs a little translator chip — something like a CP2102 or CH340 — sitting between the USB port and the chip just to load code. The ESP32-S3 has a USB controller built right into the silicon, so the USB-C port wires almost straight to the module. That's one fewer chip to buy, place, and solder — and you get a few things for free: the same port can act as a serial console and even a hardware debugger. The one tradeoff is that if your own program ever locks up the USB peripheral, you fall back on the BOOT and EN buttons to force the chip into download mode by hand. That's exactly why those two buttons are on the board.",
      },
      {
        type: "callout",
        label: "02 · Power budget",
        severity: "info",
        body: "Will the 3.3 V rail hold up when Wi-Fi transmits? Answer that now, on paper — it's a five-minute sum.",
      },
      {
        type: "prose",
        md: "USB hands you 5 V. The [[LDO]] (a kind of voltage regulator, **U2**) turns that into the 3.3 V the chip needs, at up to 600 mA. The ESP32-S3 sips current most of the time, but it gulps hard for a few milliseconds every time its radio transmits. Add up the worst case — that gulp plus everything else on the board — and make sure it fits under 600 mA with room to spare. That headroom is exactly why the board uses a 600 mA regulator and a 10 µF [[bulk capacitor]], not a tiny 150 mA part. Hang hungry loads (a motor, a servo) off the rail later and you invite a [[brownout]] — the voltage sagging low enough to reset the chip.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "The regulator can supply up to 600 mA. The ESP32 mostly sips current but gulps hard for a few milliseconds each time its radio transmits. What rides out those gulps so the rail doesn't dip? The bulk capacitor (C1) — a little local reservoir of charge, right where it's needed.",
      },
      {
        type: "deepDive",
        summary: "The power budget, with numbers",
        body: "Add up the worst case. The ESP32-S3 can peak near 500 mA during a Wi-Fi transmit burst, and the rest of the board — LEDs, the regulator's own draw, anything you hang off the headers — is maybe 50 mA. That's about 550 mA against the [[LDO]]'s 600 mA ceiling, leaving only ~50 mA of margin. A tiny 150 mA regulator would [[brownout|brown out]] the instant Wi-Fi keyed up. The transmit spikes are also far faster than the regulator can react to, so C1, the 10 µF [[bulk capacitor]], holds a local pool of charge to cover them while the regulator catches up. Hang a motor or a servo on the rail and you blow the budget — those want their own supply.",
      },
      {
        type: "callout",
        label: "03 · The ADC1-only rule",
        severity: "info",
        body: "On any Wi-Fi-connected ESP32, half the analog pins go dark.",
      },
      {
        type: "prose",
        md: "Here's a rule that's easy to honor now and maddening to discover later: [[ADC2]] can't be used while the radio is active — and on a Wi-Fi board, the radio is basically always active. So every analog input you plan to read has to land on an [[ADC1]] pin. Decide this now, while you're choosing which pin does what — not at bring-up, when an analog reading comes back as garbage but only when Wi-Fi is on.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "You wire a knob to an ADC2 pin and the reading is garbage only when Wi-Fi is on. What rule did you break? Analog inputs you sample must be on ADC1 — ADC2 is claimed by the radio.",
      },
      {
        type: "deepDive",
        summary: "Why ADC2 goes dark when Wi-Fi is on",
        body: "The ESP32-S3 has two analog-to-digital converters, [[ADC1]] and [[ADC2]]. The Wi-Fi radio borrows ADC2's hardware while it's running, so a program that reads an ADC2 pin with Wi-Fi active gets an error or a meaningless number — and because this is a Wi-Fi board, the radio is essentially always on. The fix is a planning decision, not a code workaround: route anything you'll read as analog to an ADC1 pin (on the S3 those are GPIO1 through GPIO10). Settle it here, while the pins are still just names on a list, and you'll never hit the 'works until I connect to Wi-Fi' bug at bring-up.",
      },
      {
        type: "quiz",
        prompt: "Quick check — requirements",
        questions: [
          {
            q: "This board programs over its USB-C port with no extra 'programmer' chip. Why?",
            answer: 0,
            explain: "The ESP32-S3 has USB built into the chip, so the USB-C port can load code directly — no separate translator chip needed.",
            options: [
              "The ESP32-S3 can speak USB all by itself",
              "Because USB-C is faster than older USB",
              "Because the board has no other chips",
            ],
          },
          {
            q: "The 3.3 V regulator can supply up to 600 mA. Why not pick a tiny 150 mA one to save money?",
            answer: 1,
            explain: "A Wi-Fi burst pushes the current near 500 mA for a moment — a 150 mA part would brown out and reset the board.",
            options: [
              "Smaller parts always cost more",
              "The ESP32 briefly needs much more than that whenever Wi-Fi transmits",
              "150 mA regulators don't exist",
            ],
          },
          {
            q: "What is the bulk capacitor (C1) there for?",
            answer: 1,
            explain: "C1 is a small local reservoir — it covers the fast Wi-Fi current spikes the regulator can't react to in time.",
            options: [
              "To store your program",
              "To hold a little spare charge for sudden current spikes",
              "To lower the voltage",
            ],
          },
          {
            q: "You want to read a knob (a potentiometer) while Wi-Fi is on. Which kind of pin must you use?",
            answer: 1,
            explain: "The Wi-Fi radio takes over ADC2, so analog readings must land on an ADC1 pin or they come back as garbage.",
            options: ["Any pin is fine", "An ADC1 pin", "An ADC2 pin"],
          },
          {
            q: "When is the best time to decide which job each pin does?",
            answer: 0,
            explain: "Pin choices like the ADC1 rule are cheap to get right on paper now and painful to fix once the board exists.",
            options: [
              "Now, while planning — before drawing anything",
              "At the very end, after the board is built",
              "It doesn't matter when",
            ],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "You've pinned down what this board has to do — powered and programmed over one USB-C port, a 3.3 V budget that survives a Wi-Fi burst, and the ADC1-only rule. Write those decisions up as your requirements note and attach it, then pass the quick check above. That's the gate — no formal design-review checklist on a build this size.",
      },
    ],
  },

  BOM_SOURCING: {
    lead: "Before you draw a single wire, lock in your real parts. The BOM — your Bill of Materials — is the exact list of everything on the board, where every line is a part you can actually order. Pick and check the real parts first; the schematic comes next.",
    contentBlocks: [
      {
        type: "prose",
        md: "Before you draw anything, you need to know exactly which parts you'll use. That list is the **BOM** — the Bill of Materials. Here's the key idea: a schematic will happily let you write '5.1 kΩ resistor,' but a distributor won't ship you one of those. What they ship is a part with an exact number, like RC0805FR-075K1L. The whole job of this stage is turning every part you need into one of those real, orderable numbers — *first*, before the schematic — so that when you do draw, every part on the page is real, in stock, and something you could hold in your hand.",
      },
      {
        type: "callout",
        label: "01 · Why an exact part number",
        severity: "info",
        body: "'A 5.1 kΩ resistor' is a wish. RC0805FR-075K1L is a part. The exact number is what makes it orderable — and what makes sure it fits.",
      },
      {
        type: "prose",
        md: "Every BOM line needs an [[MPN]] — a manufacturer plus an exact part number. That number pins down far more than the value: it also fixes the tolerance, the package size, the voltage rating, and how the part behaves with temperature. 'A 0.1 µF cap' could be any of a thousand different parts; the MPN is the one that fits your footprint and survives your rail. Vague values are how you end up ordering a reel of parts that won't fit the pads you laid out.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "R3  R4", decoration: "ref" },
            { text: "RC0805FR-075K1L", decoration: "mpn" },
            { text: "5.1 kΩ ±1% 0805 — value, tolerance, size, all pinned" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Two '10 kΩ resistors' from different reels — why might only one fit your board? Package size. An 0805 and an 0402 are both 10 kΩ but won't share a footprint; the MPN locks the size.",
      },
      {
        type: "deepDive",
        summary: "Reading the part number RC0805FR-075K1L",
        body: "A manufacturer part number isn't random — it's a little spec sheet squeezed into a string, and once you can read it, two near-identical parts tell themselves apart at a glance. Walk RC0805FR-075K1L: RC is Yageo's thick-film resistor family, 0805 is the package size, F means ±1% tolerance, the 07 is a packaging code, and 5K1 is the value — '5K1' reads as 5.1 kΩ, the same trick that writes 4.7 Ω as '4R7'. Why 5.1 and not a round 5.0? Resistors are made in fixed [[E-series|E24]] steps (…, 4.7, 5.1, 5.6, …), so 5.1 kΩ is a real, stockable value and 5.0 kΩ simply isn't.",
      },
      {
        type: "callout",
        label: "02 · Reading a datasheet",
        severity: "info",
        body: "Datasheets are long and rarely put what you want where you'd expect. One habit tames them.",
      },
      {
        type: "prose",
        md: "For every chip, the manufacturer publishes a **datasheet** — the part's manual. Don't read the whole thing; you almost never need to. Find two things first: the **power and ground pins**, and the **absolute-maximum ratings** (the voltages and currents that will destroy the part). Everything else depends on powering the part correctly and staying under its limits. For U1 that means confirming the 3V3 pin's range (3.0–3.6 V) and how the EN and boot pins behave; for U2, the input range and the in/out capacitors it needs to stay stable. Read narrowly and on purpose.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Before wiring any chip, what's the first thing to find in its datasheet? Its power and ground pins (and its maximum voltage) — everything else is moot if you power it wrong.",
      },
      {
        type: "callout",
        label: "03 · Stock, lifecycle & a second source",
        severity: "info",
        body: "The best part is the one you can actually get today.",
      },
      {
        type: "prose",
        md: "For each part, check two things on the distributor's page: that it's in stock, and that it's still active (not end-of-life). This board already carries two real sourcing saves: U2 is the RT9080 because the original AP2112K went out of stock, and D1 is a UMW USBLC6-2, a pin- and spec-compatible **second source** for ST's part. Naming a backup now — same pinout, same specs — is the difference between a five-minute swap and a stalled project when something goes out of stock mid-build.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "U2", decoration: "ref" },
            { text: "RT9080-33GJ5", decoration: "mpn" },
            { text: "Chosen because the AP2112K was out of stock" },
          ],
          [
            { text: "D1", decoration: "ref" },
            { text: "USBLC6-2SC6", decoration: "mpn" },
            { text: "UMW second source for the ST USBLC6-2" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Your chosen LDO goes out of stock mid-project. What saves you? A pre-identified second source with the same pinout and specs — exactly what the BOM's sourcing notes call out.",
      },
      {
        type: "callout",
        label: "04 · Packages you can hand-build",
        severity: "info",
        body: "A part you can't solder by hand is the wrong part for this board.",
      },
      {
        type: "prose",
        md: "Because you'll hand-build this board, choose parts you can actually place with an iron. This board sticks to hand-friendly packages on purpose: 0805 passives (big enough to place by hand, unlike tiny 0402), a USB-C receptacle with board guides and solder-retention tabs, and through-hole switches and headers. When you order, watch the [[MOQ]] (minimum order quantity) — passives ship on reels — and buy a few spares of anything you'll hand-place and inevitably drop or cook.",
      },
      {
        type: "partModel",
        mpn: "USB4110-GF-A",
        caption: "J1 — USB-C receptacle with retention tabs, chosen to be hand-solderable",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "J1", decoration: "ref" },
            { text: "USB4110-GF-A", decoration: "mpn" },
            { text: "SMD USB-C with board guides + retention tabs" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why 0805 passives instead of smaller 0402? Hand-soldering. 0805 is large enough to place and drag-solder with an iron; 0402 really wants paste and hot air.",
      },
      {
        type: "deepDive",
        summary: "0805 and 0402, in millimeters",
        body: "The package code is just the part's size in hundredths of an inch: an 0805 part is 0.08\" × 0.05\", about 2.0 × 1.25 mm — roughly a grain of rice. An 0402 is 1.0 × 0.5 mm, half that on each side and a quarter of the area. Both come in every common value, but 0805 is about the smallest you can comfortably hold with tweezers and drag-solder with an iron; 0402 really wants solder paste and a stencil. That's the whole reason this board specs 0805 throughout. One catch when you order: passives ship on reels with an [[MOQ]] in the thousands — but they cost pennies, so buy the reel and keep the spares for the ones you'll inevitably flick across the room.",
      },
      {
        type: "quiz",
        prompt: "Quick check — sourcing",
        questions: [
          {
            q: "A schematic says '5.1 kΩ resistor.' Why isn't that enough to actually order one?",
            answer: 0,
            explain: "An exact part number (MPN) pins the size, tolerance, and manufacturer — '5.1 kΩ' alone could be a thousand different parts.",
            options: [
              "It doesn't say the exact part — the size, tolerance, and maker are still missing",
              "5.1 kΩ resistors don't exist",
              "You can only order resistors in kits",
            ],
          },
          {
            q: "Two parts are both '10 kΩ' but only one fits your board. What's most likely different?",
            answer: 1,
            explain: "Same value, different footprint — an 0805 won't sit on pads laid out for an 0402. The MPN locks the size.",
            options: [
              "Their colour",
              "Their physical package size (like 0805 vs 0402)",
              "Their price",
            ],
          },
          {
            q: "When you open a new chip's datasheet, what should you find first?",
            answer: 1,
            explain: "Everything depends on powering the part correctly and not exceeding its limits — so that's the first thing to confirm.",
            options: [
              "Its price",
              "Its power and ground pins, and its maximum voltage",
              "Its release date",
            ],
          },
          {
            q: "Your chosen regulator goes out of stock halfway through the project. What saves you?",
            answer: 1,
            explain: "A compatible backup named ahead of time (like this board's RT9080-for-AP2112K) turns a dead stop into a quick swap.",
            options: [
              "Waiting for it to come back",
              "A pre-picked 'second source' with the same pinout and specs",
              "Redesigning the whole board",
            ],
          },
          {
            q: "Why does this board use 0805 parts instead of smaller 0402 ones?",
            answer: 1,
            explain: "0805 is about the smallest you can place and drag-solder with an iron; 0402 really wants paste and a stencil.",
            options: [
              "0805 is cheaper",
              "0805 is big enough to solder comfortably by hand",
              "0402 is out of stock",
            ],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "Every line of your BOM is now a real part: an exact MPN, in stock and active, in a package you can hand-solder, with a second source named where it matters. Attach your BOM and pass the quick check. With the parts locked, the schematic is next — and it'll go fast, because every part on it is one you've already chosen.",
      },
    ],
  },

  SCHEMATIC: {
    lead: "Your parts are already chosen and sourced — so the schematic isn't where you make decisions, it's where you write them down. Walk the board one small sub-circuit at a time: name the problem, meet the parts that solve it, then capture it in KiCad. Every refdes below is already on your BOM.",
    contentBlocks: [
      {
        type: "prose",
        md: "Think of the schematic as six small problems standing between a bare ESP32 module and a board you can plug in and flash. The board needs the right voltage, a steady supply, a defined way to boot, a USB port that negotiates power, something you can see, and a shield from the outside world. Each section below takes one of those problems and shows you the exact parts that solve it. Read them in order — they follow the power as it comes in at the USB connector and works its way to the chip.\n\nEvery part has a [[refdes]] — U1, C5, R3 — the short label that ties its symbol, its BOM line, and its spot on the board together. You'll meet them in the tables under each section, and you can spin the 3D model of the headline parts as you go.",
      },
      {
        type: "image",
        src: "/guide-diagrams/wroom-power-flow.svg",
        alt: "Power-flow block diagram: USB-C J1 to polyfuse F1 to RT9080 LDO U2 to 3.3 V for the ESP32-S3 U1; USB data via the D1 ESD array; with C1 bulk, C2/C3/C7 decoupling, and R3/R4 CC resistors to ground.",
        caption: "How it all connects — power flows left to right; the six sections below follow this path.",
      },
      {
        type: "partModel",
        mpn: "ESP32-S3-WROOM-1-N16R2",
        caption: "U1 — ESP32-S3-WROOM-1 module (drag to rotate)",
      },
      {
        type: "callout",
        label: "01 · The 3.3 V rail — your regulator",
        severity: "info",
        body: "Your ESP32-S3 wants a clean 3.3 V supply, but USB gives you 5 V. Something has to step it down.",
      },
      {
        type: "prose",
        md: "That something is **U2**, the RT9080. It's an [[LDO]] — short for low-dropout — which is just a voltage regulator that holds its output steady even when the input is only a little above it.\n\nWhy not a simple voltage divider (two resistors)? Because a divider sags the moment the chip pulls current — and the ESP32's draw jumps every time its radio transmits. A regulator actively holds 3.3 V no matter the load. That's the whole point of a regulator.\n\nOne thing to remember: the RT9080 needs a capacitor on its input and another on its output to stay stable — that's **C5** and **C6**, 1 µF each. The datasheet promises stability with 1 µF ceramic in and out, which is exactly what we gave it.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "U2", decoration: "ref" },
            { text: "RT9080-33GJ5", decoration: "mpn" },
            { text: "5 V → 3.3 V LDO, 600 mA" },
          ],
          [
            { text: "C5  C6", decoration: "ref" },
            { text: "1 µF X7R" },
            { text: "LDO input / output stability caps" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Gotcha",
        severity: "warn",
        body: "Don't treat C5/C6 as optional. An LDO without its output capacitor can oscillate — turning your clean rail into noise.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "In plain terms, why use a regulator (U2) instead of just resistors to drop the voltage? Because a regulator holds 3.3 V steady no matter how much the chip draws — a plain resistor divider would sag the moment the chip gets busy.",
      },
      {
        type: "deepDive",
        summary: "Why a low-dropout (LDO) part?",
        body: "Even when USB sags to about 4.6 V under load, the RT9080 only needs about 0.53 V of headroom to keep regulating: 4.6 − 0.53 = 4.07 V, still comfortably above 3.3 V. A cheaper regulator that needs 1–2 V of headroom would drop out right here, and the 3.3 V rail would collapse. That margin is the whole reason we chose a [[dropout voltage|low-dropout]] (LDO) part.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-power.svg",
        alt: "Regulator sub-circuit: U2 (RT9080) with +5V on VIN, EN tied to VIN, VOUT to +3V3; C5 across the input, C6 across the output.",
        caption: "VIN on +5V, VOUT on +3V3, a cap on each side, EN tied high.",
        reveal: "Check your work · the regulator",
      },
      {
        type: "callout",
        label: "02 · Decoupling — a reservoir at the pins",
        severity: "info",
        body: "A steady rail at the regulator is not the same as a steady rail at the chip a few centimetres away.",
      },
      {
        type: "prose",
        md: "When the ESP32 switches its transistors millions of times a second, it grabs tiny gulps of current faster than the regulator across the board can possibly respond. Left unfed, the 3.3 V right at the chip's pins would dip on every gulp — and a microcontroller fed a dipping rail glitches or resets.\n\nThe fix is a small [[decoupling capacitor|capacitor]] parked right at each power pin: **C2, C3, and C7** (0.1 µF each). They hold a little reserve of charge and hand it over instantly when the chip asks, then refill between demands. **C1** (10 µF) plays the same game one size up — a [[bulk capacitor|bigger, slower reservoir]] for the whole **3.3 V** rail, smoothing the larger swings the little caps don't cover. Together they're called bulk plus bypass.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "C2  C3  C7", decoration: "ref" },
            { text: "0.1 µF X7R" },
            { text: "Bypass — clustered at the module's 3V3 pin" },
          ],
          [
            { text: "C1", decoration: "ref" },
            { text: "10 µF X5R" },
            { text: "Bulk reservoir for the rail" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Gotcha",
        severity: "warn",
        body: "These only work if they sit right against the module's power pins. A decoupling cap routed the long way round is just decoration — the trace inductance chokes off the fast current it's supposed to deliver. (Carry this into LAYOUT.)",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "In one line, what do C2/C3/C7 do? They sit right at the chip's power pins and keep its 3.3 V steady when it suddenly pulls current.",
      },
      {
        type: "deepDive",
        summary: "Why three small caps, not one big one?",
        body: "A capacitor only helps if it's close — the longer the trace between it and the pin, the more its help fades (trace inductance gets in the way). Three 0.1 µF caps, one hard against each power pin, beat a single 0.3 µF cap sitting a few millimetres away: being close matters more than raw capacitance. The 10 µF [[bulk capacitor|bulk cap]] (C1) then handles the slower, larger swings the little ones can't.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-mcu.svg",
        alt: "The ESP32-S3-WROOM-1 (U1) with its decoupling caps C1, C2, C3 and C7 — each tied between +3V3 and GND at the module's supply pin.",
        caption: "Check the decoupling — each of C1/C2/C3/C7 between +3V3 and GND.",
        reveal: "Check your work · decoupling",
      },
      {
        type: "callout",
        label: "03 · Boot & reset — pull-ups that set a default",
        severity: "info",
        body: "A digital input wired to nothing doesn't read 0. It floats — it picks up noise and reads randomly.",
      },
      {
        type: "prose",
        md: "The ESP32 checks two [[strapping pin|strapping pins]] the instant it wakes up: EN (chip-enable / reset) and GPIO0 (boot select). Both have to be at a definite level at that moment, so each gets a [[pull-up resistor]] — **R1** and **R2**, 10 kΩ — gently tying it to 3.3 V (logic high). EN high means the chip runs; GPIO0 high at reset means boot normally from flash.\n\nThe two buttons override that resting level while you hold them. **SW1** pulls EN to ground to reset the chip; holding **SW2** (GPIO0 to ground) through a reset drops the chip into USB download mode so you can flash new firmware. The resistor sets the default; the button wins while it's pressed.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "R1  R2", decoration: "ref" },
            { text: "10 kΩ" },
            { text: "Pull-ups on EN / GPIO0" },
          ],
          [
            { text: "SW1  SW2", decoration: "ref" },
            { text: "B3F-1000", decoration: "mpn" },
            { text: "EN (reset) / BOOT (download)" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "If R1 weren't there and you pressed nothing, what would the EN pin read? It would float — pick up electrical noise and read randomly, so the chip might reset or never start. The pull-up gives it a steady, known level.",
      },
      {
        type: "deepDive",
        summary: "Why 10 kΩ, and why 'weak'?",
        body: "A pull-up only has to set the resting level, not power anything — so it should be 'weak,' meaning a high value. At 3.3 V, a 10 kΩ pull-up leaks just 0.33 mA (3.3 V ÷ 10 kΩ), which is negligible, yet it still firmly holds the pin high. A 100 Ω pull-up would burn 33 mA doing the same job and would fight the button when you press it. Weaker is better here.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-bootreset.svg",
        alt: "Boot and reset: R1 pulls EN up to +3V3 and SW1 pulls EN to GND; R2 pulls IO0 up to +3V3 and SW2 pulls IO0 to GND, at the ESP32 module.",
        caption: "Check boot/reset — R1+SW1 on EN, R2+SW2 on IO0.",
        reveal: "Check your work · boot & reset",
      },
      {
        type: "callout",
        label: "04 · USB-C — advertising as a sink",
        severity: "info",
        body: "A USB-C source won't push 5 V onto VBUS until it's sure something on the other end actually wants power.",
      },
      {
        type: "prose",
        md: "Your board announces itself as a consumer — a [[sink]] — by tying each [[CC pin]] to ground through a 5.1 kΩ resistor, called [[Rd]]. The host sees that exact resistance and only then switches [[VBUS]] on.\n\nThere are two of them, **R3** and **R4**, because Type-C is reversible: whichever way the plug goes in, one of CC1/CC2 is the live one, so both need their own Rd. These are [[pull-down resistor|pull-down resistors]] (to ground) — the mirror image of the boot pull-ups you just met. And 5.1 kΩ isn't arbitrary; it's the value the USB-C spec assigns to a basic sink.",
      },
      {
        type: "partModel",
        mpn: "USB4110-GF-A",
        caption: "J1 — USB-C receptacle (drag to rotate)",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "R3  R4", decoration: "ref" },
            { text: "5.1 kΩ" },
            { text: "CC1 / CC2 sink resistors (Rd) to GND" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "What is R3/R4's message to a charger, in plain words? 'I'm a device that wants power.' That's what makes a USB-C charger turn its 5 V on.",
      },
      {
        type: "deepDive",
        summary: "Why exactly 5.1 kΩ, and why two?",
        body: "A device advertises itself as a power 'sink' by tying each [[CC pin]] to ground through a 5.1 kΩ resistor (called [[Rd]]) — that exact value is what the USB-C spec assigns to a basic sink. There are two (R3, R4) because Type-C is reversible: whichever way the plug goes in, one CC pin is the live one, so both need their own Rd. The sneaky failure: with an old USB-A-to-C cable the board would still work (A ports always have 5 V), so it can seem fine on an old cable yet look dead on a new charger.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-usb.svg",
        alt: "USB front-end: J1 USB-C, R3/R4 (5.1k) on CC1/CC2, doubled data pins joined to USB_D+/USB_D−, F1 polyfuse on VBUS, D1 ESD array on the data lines.",
        caption: "Check the connector — CC resistors to GND, the data pairs joined.",
        reveal: "Check your work · USB-C connector",
      },
      {
        type: "callout",
        label: "05 · Indicator LEDs — a resistor sets the current",
        severity: "info",
        body: "An LED is a diode, and a diode is a poor judge of its own appetite.",
      },
      {
        type: "prose",
        md: "Give an LED more voltage than it wants and it pulls more and more current until it cooks itself. So you never connect one straight across a supply — you put a [[current-limiting resistor|resistor in series]] with it to set the current.\n\nThe math is just Ohm's law on the leftover voltage. The supply is 3.3 V; the red LED drops about 1.8 V across itself (its [[forward voltage|forward voltage, Vf]]), leaving 1.5 V across **R5**. With 470 Ω that's I = 1.5 V ÷ 470 Ω ≈ 3.2 mA — bright enough to see, easy on the [[GPIO]] driving it. **R5** and **R6** do this for the two LEDs: **LED1** (red) is the power light — wired **+3V3 → R5 → LED1 → GND**, so it glows whenever the board has power; **LED2** (yellow) is the user light, driven by a pin — **IO2 → R6 → LED2 → GND**.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "LED1", decoration: "ref" },
            { text: "Red, Vf ≈ 1.8 V" },
            { text: "Power indicator" },
          ],
          [
            { text: "LED2", decoration: "ref" },
            { text: "Yellow, Vf ≈ 2.0 V" },
            { text: "User / blink LED" },
          ],
          [
            { text: "R5  R6", decoration: "ref" },
            { text: "470 Ω" },
            { text: "LED series current-limit" },
          ],
        ],
      },
      {
        type: "callout",
        label: "Gotcha",
        severity: "warn",
        body: "An LED without its series resistor is a short circuit with extra steps — it flashes once and dies. R5/R6 are not optional.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why can't you wire an LED straight to 3.3 V with no resistor? An LED doesn't limit its own current — without a resistor it pulls far too much and burns out almost instantly.",
      },
      {
        type: "deepDive",
        summary: "Sizing the resistor (Ohm's law)",
        body: "The resistor sets the current from the leftover voltage: I = (Vsupply − Vf) ÷ R. The red LED drops about 1.8 V across itself (its [[forward voltage|forward voltage, Vf]]), so on 3.3 V through 470 Ω: (3.3 − 1.8) ÷ 470 ≈ 3.2 mA — bright enough to see, easy on the GPIO. The yellow LED's Vf is higher (~2.0 V), so the same 470 Ω gives a bit less: (3.3 − 2.0) ÷ 470 ≈ 2.8 mA. That's why swapping LED colours at a fixed resistor quietly changes the brightness.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-leds.svg",
        alt: "Indicator LEDs: +3V3 through R5 into LED1 to GND (power light), and IO2 through R6 into LED2 to GND (user light), at the ESP32 module.",
        caption: "Check the LEDs — +3V3→R5→LED1→GND, IO2→R6→LED2→GND.",
        reveal: "Check your work · the LEDs",
      },
      {
        type: "callout",
        label: "06 · Protecting the port — two guardians",
        severity: "info",
        body: "The USB connector is the one part of your board that touches the outside world, so it's where trouble comes in.",
      },
      {
        type: "prose",
        md: "It gets two guardians. **F1** is a [[PTC|resettable fuse]] (a PTC polyfuse) on [[VBUS]]: if something downstream pulls too much current, it heats up, its resistance shoots up, and it throttles the current down to a trickle — then, once it cools off, it returns to normal all by itself. It's a symmetric 2-pin part — either leg to [[VBUS]], the other to `+5V`, no 'right way round.' That rename is deliberate: the connector side is **`VBUS`** (raw 5 V, straight off USB), the regulator side is **`+5V`** (the same current, now *protected* by the fuse). Same wire, two names — the rename is the fuse.\n\n**D1** is an [[ESD]]-protection array (the USBLC6-2) on the two data lines and VBUS. When a static spike arrives — thousands of volts off a fingertip — it clamps that spike to ground in a nanosecond with a [[TVS diode|clamping diode]], before it can punch through the ESP32's delicate USB pins. It's deliberately a low-capacitance part, because USB data is fast and a bulky protector would smear the signal.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "F1", decoration: "ref" },
            { text: "1206L050YR", decoration: "mpn" },
            { text: "Resettable PTC — 0.5 A hold / 1 A trip on VBUS" },
          ],
          [
            { text: "D1", decoration: "ref" },
            { text: "USBLC6-2SC6", decoration: "mpn" },
            { text: "ESD clamp on D+ / D− and VBUS" },
          ],
        ],
      },
      {
        type: "table",
        columns: ["D1 pin", "Name", "Wire to"],
        rows: [
          [{ text: "1, 6" }, { text: "I/O1" }, { text: "USB_D+" }],
          [{ text: "3, 4" }, { text: "I/O2" }, { text: "USB_D−" }],
          [{ text: "2" }, { text: "GND" }, { text: "GND" }],
          [{ text: "5" }, { text: "VBUS" }, { text: "VBUS" }],
        ],
      },
      {
        type: "prose",
        md: "Each I/O line lands on two pins (same node — route-through), and the array is symmetric, so making `I/O1` the D+ side is a free choice. D1's `VBUS` pin sits on the **raw `VBUS`** rail — ESD belongs at the port, ahead of the fuse.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "What two things does the USB port need protecting from? Too much current (a short or a greedy device) and static-electricity zaps on the data lines.",
      },
      {
        type: "deepDive",
        summary: "How F1 and D1 actually protect the port",
        body: "F1 is a [[PTC|resettable fuse]] (a 'polyfuse'): on overcurrent it heats up, its resistance shoots up to throttle the current, then it heals once it cools — unlike a glass fuse you'd have to desolder and replace. D1 is an [[ESD]] array on the data lines; when a static spike arrives — thousands of volts off a fingertip — it clamps that spike to ground in a nanosecond. It's deliberately a low-capacitance part, because USB data is fast and a bulky protector would smear the signal.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-usb.svg",
        alt: "Port protection on the USB front-end: F1 polyfuse in series on VBUS, and D1 (USBLC6) clamping the two data lines and VBUS to GND.",
        caption: "Check the guardians — F1 in series on VBUS, D1 across the data lines.",
        reveal: "Check your work · port protection",
      },
      {
        type: "callout",
        label: "07 · Which pin connects where",
        severity: "info",
        body: "You've met every part. Two kinds of connection are left: the ones you can reason out — and a few the chip decides for you, that you simply can't guess.",
      },
      {
        type: "prose",
        md: "First, the thing nobody tells you outright: you wire by pin **name**, not pin **number**. Your chips, the module, and the connector label their pins by name — the regulator's pins read `VIN`, `VOUT`, `GND`, `EN`; the module's read `3V3`, `EN`, `IO0`, `IO19`, `IO20`. So when a step says 'U2's EN to VIN,' you find the pin *named* `EN` and wire it to the pin *named* `VIN`. (The little resistors and caps are the exception — they just show pins `1` and `2`; that's fine, and there's a heads-up on exactly what every symbol looks like right before you download.) The names in this lesson are the names on those symbols — for the chips, 'which pin?' is answered by reading the part in front of you.",
      },
      {
        type: "prose",
        md: "Most of the ESP32's pins are yours to use however you like. A handful are already spoken for. The big one: the chip talks to your computer over **USB**, and that USB lives on two fixed pins — **D− is GPIO19, D+ is GPIO20**, always. They're wired straight into the chip's USB hardware; no other pins work, and nothing on the schematic hints at it. So the two data lines from the USB-C connector run to exactly those pins, with **D1** sitting across them to clamp static. (You already wired the other reserved pins back in section 03: **GPIO0** for boot and **EN** for reset.)\n\nOne rule for every *free* pin you choose: steer clear of the [[strapping pin|strapping pins]] — **GPIO0, 3, 45, 46** — for anything you actively drive at power-up. The chip reads those four the instant it wakes to decide how to boot, so a part tugging on one can stop it starting.",
      },
      {
        type: "table",
        columns: ["This connection", "Wire it", "Why it isn't a free choice"],
        rows: [
          [
            { text: "Power the chip", tone: "gold", decoration: "badge" },
            { text: "U1 3V3 → +3V3" },
            { text: "The headline connection: U1 pin 2 is the module's 3.3 V supply. The regulator can be perfect and the MCU still stays dark if this pin isn't on the rail." },
          ],
          [
            { text: "USB data", tone: "gold", decoration: "badge" },
            { text: "D+ → module IO20,  D− → IO19" },
            { text: "The S3's USB hardware is fixed to these two pins — nowhere else works. D1 clamps both." },
          ],
          [
            { text: "Power in", tone: "gold", decoration: "badge" },
            { text: "VBUS → F1 → +5V → U2 VIN" },
            { text: "Raw VBUS from USB passes through the polyfuse and becomes the protected +5V rail. Wire U2 VIN to +5V, not VBUS — VIN taps after the fuse." },
          ],
          [
            { text: "Regulator on-switch", tone: "gold", decoration: "badge" },
            { text: "U2 EN → VIN" },
            { text: "The LDO's active-high enable — a CMOS input that must not float; tie it high (to VIN) or the rail may never come up. (A different EN from the module's reset.)" },
          ],
          [
            { text: "User LED", tone: "gold", decoration: "badge" },
            { text: "IO2 → R6 → LED2 → GND" },
            { text: "A free GPIO drives it high to light it — see the pin-pick note below." },
          ],
          [
            { text: "Test points", tone: "gold", decoration: "badge" },
            { text: "TP1 → +3V3,  TP2 → GND" },
            { text: "Bare loops to clip a meter onto when you bring the board up." },
          ],
        ],
      },
      {
        type: "prose",
        md: "While you're on the USB pair: name the two data nets **`USB_D+`** and **`USB_D-`** — type a plain ASCII `+` and `-`, because the router matches the literal suffix. KiCad reads a shared base name plus a paired suffix (`+`/`-`, **or** `_P`/`_N`, never mixed) as a **differential pair**, and that schematic-side naming is what unlocks the diff-pair router and length-matching when you reach LAYOUT. (USB is a 90 Ω pair that wants matched, length-tuned traces — but that's a LAYOUT job; here you just name it right.)",
      },
      {
        type: "callout",
        label: "Two easy mix-ups",
        severity: "warn",
        body: "Two small things bite beginners here. Polarity: an LED — and the ESD diodes in D1 — only work one way round; match the bar/flat side of the symbol to the lower-voltage end (for an LED, the GND side). Backwards, an LED just stays dark. Two different ENs: the module's EN (reset — R1 + SW1) is NOT the regulator's EN (U2 → VIN). Same name, different pins, different nets — wire them as two separate things.",
      },
      {
        type: "callout",
        label: "Picking the user-LED pin",
        severity: "info",
        body: "Why IO2 for LED2? It's a plain GPIO with no special duty. Avoid the strapping pins (0, 3, 45, 46), the USB pins (19, 20), and the serial-console pins (43, 44 — keep those for debugging); of what's left, the lowest tidy GPIO wins. (Reading an analog sensor one day? Prefer GPIO1–10 — that's ADC1, the only ADC that still works while Wi-Fi is on.)",
      },
      {
        type: "prose",
        md: "That leaves the two long headers, **J2** and **J3** — they bring the spare GPIOs out to the board edge so you can jumper to them later. Wire each free GPIO out to a header pin — electrically the order doesn't matter, so the tidy move is to follow the module's own physical pin order: straight, short runs that stay easy to route. Bring **+3V3, GND, +5V and EN** out to the headers too, so a breadboard has power and a reset.\n\nA tidy default you can copy: put **+3V3** on J2 pin 1 and **GND** on J2 pin 2, then march the module's spare GPIOs down the rest in pin order — `IO1`→pin 3, `IO4`→pin 4, `IO5`→pin 5, and so on, carrying onto J3 until every free GPIO has a home. Skip the ones already spoken for (the USB pins `IO19`/`IO20`, the strapping pins `0`/`3`/`45`/`46`, `EN` and `IO0`, and `IO2` driving your LED). It's ~40 little connections, but they're all the same move — label a few and the rest is muscle memory.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-headers.svg",
        alt: "The two breakout headers J2 and J3 — the spare GPIOs plus the +3V3/+5V/GND/EN rails brought out to the board edge in pin order.",
        caption: "Check the breakout — rails + spare GPIOs marched out to J2/J3.",
        reveal: "Check your work · breakout headers",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-sub-test-points.svg",
        alt: "Test points: TP1 on the +3V3 rail and TP2 on GND — bare loops to clip a meter onto during bring-up.",
        caption: "Check the test points — TP1 on +3V3, TP2 on GND.",
        reveal: "Check your work · test points",
      },
      {
        type: "prose",
        md: "One wiring habit that pays off here: a GPIO net needs the **same label on both ends** — the header pin *and* the module pin. That includes the three nets that already have a circuit on U1's side: label **`EN`, `IO0`, `IO2` on the module too**, not just at the header. (You skip those three when *marching spare GPIOs onto the header* — they're already used — but each still needs its label where its own circuit lives.) Miss one end and the two pins land on separate nets; ERC flags the loose one — and that flag is the point, the safety net catching the slip for you.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "You wire the user LED to GPIO0 by mistake. What might go wrong? GPIO0 is a strapping pin — an LED circuit can hold it low at power-up, which drops the chip into download mode instead of running your code. That's exactly why the free-pin rule skips the strapping four.",
      },
      {
        type: "prose",
        md: "You've now reasoned out every part and know what each one connects to — so now you draw it. Start from the KiCad starter below: it's a ready-made project, with the symbol library plus every BOM part already dropped onto the sheet, spaced out but not yet wired. Your job isn't to find parts, it's to arrange them into a readable layout and wire them into the real circuit. A good schematic isn't just correct, it's readable: someone (including future-you) should be able to follow it at a glance. A few habits and one rules-check get you there.",
      },
      {
        type: "callout",
        label: "Before you open it · what your symbols look like",
        severity: "warn",
        body: "The starter is real CAD, not a tidy textbook drawing — a few parts won't look how you'd expect. Skim this so nothing throws you when you open it.",
      },
      {
        type: "table",
        columns: ["What you'll see", "What it really is", "Wire it"],
        rows: [
          [
            { text: "Resistors & caps: pins 1 / 2, no names" },
            { text: "Symmetric parts — either leg works" },
            { text: "Either way round. Every cap here is non-polarised — no + side, even the 10 µF C1." },
          ],
          [
            { text: "U2 drawn as an AP2112K" },
            { text: "The RT9080 second-sourced it — same 5-pin LDO" },
            { text: "It's your regulator, not the wrong file. Same VIN / VOUT / GND / EN." },
          ],
          [
            { text: "J1 data pins: DP1 / DN1 / DP2 / DN2" },
            { text: "D+ / D− doubled (Type-C is reversible)" },
            { text: "DP1+DP2 → USB_D+, DN1+DN2 → USB_D−. VBUS/GND are single pins; CC1/CC2 stay separate (your two Rd's)." },
          ],
          [
            { text: "U1 shows one GND pin" },
            { text: "The pad underneath is hidden GND pins that auto-connect" },
            { text: "Wire the visible pin; the pad grounds itself. (View ▸ Show Hidden Pins to see it.)" },
          ],
          [
            { text: "D1 pins: I/O1 / I/O2" },
            { text: "I/O1 on D+, I/O2 on D− (symmetric)" },
            { text: "Its other two pins are VBUS (raw, ahead of the fuse) and GND." },
          ],
          [
            { text: "LED pins: A / K" },
            { text: "Anode (resistor side) / cathode" },
            { text: "Bar/flat side is K — the GND side." },
          ],
          [
            { text: "J2 / J3: pins 1–22, no names" },
            { text: "Generic 22-pin strips" },
            { text: "You pick which GPIO lands on each — no wrong order." },
          ],
        ],
      },
      {
        type: "callout",
        label: "If a pin shows only a number",
        severity: "info",
        body: "A few symbols still hide their pin names — the headers, the buttons, the test points — whose pins are generic numbers anyway. Hover any pin to read its name, or turn on View ▸ Show Hidden Pins. (The starter already un-hides the ones that matter: the LED's A/K and D1's I/O pins.)",
      },
      {
        type: "deepDive",
        summary: "A library part is a draft, not gospel",
        body: "Even a 'verified' SnapEDA symbol can surprise you. U1 hides nine of its ground pins — you only know the pad is grounded because you turned on Show Hidden Pins and looked. U2 is drawn as an AP2112K because that's the closest stock symbol; its value still says RT9080. And a footprint can be built for a reflow process or a package that isn't quite yours, and may need fattening for hand-soldering. So treat every library part as a draft: read it against the datasheet, confirm what each pin really is, and be ready to fix or work around it. The CAD looking 'off' isn't a crisis — it's the first thing the datasheet settles.",
      },
      {
        type: "action",
        action: "downloadKicadStarter",
        label: "Download the KiCad starter",
      },
      {
        type: "callout",
        label: "Draw it · place by convention",
        severity: "info",
        body: "Arrange the parts the export gave you so the drawing reads the way the circuit works — power in at the top, signal flowing left to right.",
      },
      {
        type: "prose",
        md: "Drag each part so the sheet reads left → right: inputs on the left, outputs on the right. Put [[power port|power symbols]] (+3V3, VBUS) at the top pointing up, and grounds at the bottom pointing down. Group parts by sub-circuit, the same way you just learned them — the USB-C front end together, the regulator together, the ESP32 and its caps together. And place each [[decoupling capacitor]] near the pin it feeds for readability — but that's a drawing nicety, not a wiring rule: a cap connected only through same-named +3V3 / GND ports is already fully wired (same name, same net). Where it physically sits is a LAYOUT concern, enforced later in copper — so a tidy-but-scattered cap on the schematic isn't wrong.",
      },
      {
        type: "image",
        src: "/guide-diagrams/schematic-conventions.svg",
        alt: "An IC with signal flowing in from the left and out to the right, a 3V3 supply symbol pointing up, a GND symbol pointing down, and a decoupling capacitor drawn right at the power pin.",
        caption: "The four habits that make a schematic readable.",
      },
      {
        type: "prose",
        md: "Aim for the same composition as the reference: J1 on the left edge (USB in), U1 in the centre (the hub), J2/J3 on the right edges (breakout out). The regulator island (U2/F1/C5/C6) sits upper-left so power reads left → right; D1 tucks against J1 at the port; the decoupling caps hug U1's 3V3 pin; boot/reset (R1/R2/SW1/SW2) sits by U1's EN/IO0. Rails point up, grounds down, connectors on the edges.\n\nTwo habits make this painless. Drag a part to *empty space*, wire its little sub-circuit there, then slide the finished island into position — it beats fighting auto-placement. And **Ctrl+F** jumps you straight to any refdes. (Tying two adjacent pins directly — `U2 EN` to `VIN` — is fine too; same net, less clutter.)",
      },
      {
        type: "prose",
        md: "One finishing habit: keep each part's reference and value from overlapping the symbol, its pins, or a wire — and when a label's in the way, *move* it into open space. Never declutter by *hiding* a refdes: the BOM, the layout, and future-you all key off it. That's really the only placement rule that matters here; the rest is taste. (KiCad's own conventions, linked below, spell out the few that are genuinely rules — like power-input pins on the left, outputs on the right.)",
      },
      {
        type: "sourceRef",
        href: "https://klc.kicad.org/",
        label: "KiCad Library Conventions (KLC)",
      },
      {
        type: "callout",
        label: "Draw it · wire it cleanly",
        severity: "info",
        body: "Connect with names, not a maze of lines. Two wires with the same label are the same connection.",
      },
      {
        type: "prose",
        md: "For anything that crosses the sheet — a power rail, a reset line — give the wire a [[net label]] instead of dragging a line all the way across: two wires that share a label are connected, and the drawing stays clean. Use [[power port|power ports]] for +3V3 and GND so every part taps the rail by name. And remember that wires which merely cross aren't joined unless there's a junction dot — let KiCad drop those at real T-connections. (New in KiCad 10: turn on **File ▸ Schematic Setup ▸ Formatting ▸ Hop-over size** and non-connected crossings render as little arcs — much clearer in the dense power/ground area around J1.)",
      },
      {
        type: "callout",
        label: "Power symbol or net label?",
        severity: "info",
        body: "A power symbol (P) is for a rail — a power/ground net lots of parts tap: VBUS, +5V, +3V3, GND. A net label (L) is for a signal between a few pins: USB_D+, a reset line. The test: is it a rail many things share, or a signal between a few pins? Rail → power symbol; signal → net label. Note GND is a power symbol, not a label — the odd one out visually (the down-pointing triangle), but it behaves like +3V3 and VBUS: a global net every matching symbol joins by name.",
      },
      {
        type: "callout",
        label: "Draw it · one net, start to finish",
        severity: "info",
        body: "Wiring feels abstract until you've done one. Do the 3.3 V rail with me — every other net is the same handful of moves.",
      },
      {
        type: "steps",
        ordered: true,
        items: [
          "Press P and drop a +3V3 power port; click it onto U2's VOUT pin — that's where the 3.3 V comes out.",
          "Drop a +3V3 port on U1's 3V3 pin too, and on one leg of C1, C2, C3, C7. Same label = same net, no wire drawn between them.",
          "Press P for GND; drop GND ports on U1's visible GND pin, the other leg of each of those caps, and U2's GND. (U1's hidden pad pins ground themselves — you don't place a port on them.)",
          "Run Inspect → Electrical Rules Checker. The +3V3 rail comes up clean — KiCad sees the regulator's output driving it. Watch instead for the rails with no driver: when you wire VBUS and +5V, ERC says 'input power pin not driven' — drop a PWR_FLAG on each (and one on GND) to tell ERC real power enters there.",
          "That's one net done. Every rail and signal after this is the same three moves: name it, drop ports, repeat.",
        ],
      },
      {
        type: "deepDive",
        summary: "Why named labels beat long wires",
        body: "A net is defined by connection, not by a drawn line — so a [[net label]] called 3V3 in one corner of the sheet is the same wire as a 3V3 label in the other corner, with nothing drawn between them. That isn't a shortcut, it's the readable way: a schematic with twenty rails crossing it hides mistakes, while one built from named [[power port|ports]] and short local wires shows each sub-circuit as a tidy island. The electrical meaning is identical; the human meaning is night and day.",
      },
      {
        type: "callout",
        label: "Draw it · KiCad 10 shortcuts",
        severity: "info",
        body: "A handful of keys do most of the work — hover over a part and press the key. (Live list: Preferences → Hotkeys, or press ? in the editor.)",
      },
      {
        type: "table",
        columns: ["Key", "What it does"],
        rows: [
          [
            { text: "A", tone: "gold", decoration: "badge" },
            { text: "Add a symbol (place a part)" },
          ],
          [
            { text: "P", tone: "gold", decoration: "badge" },
            { text: "Add a power port — +3V3, +5V, GND, VBUS" },
          ],
          [
            { text: "W", tone: "gold", decoration: "badge" },
            { text: "Draw a wire" },
          ],
          [
            { text: "L", tone: "gold", decoration: "badge" },
            { text: "Place a net label" },
          ],
          [
            { text: "R / M / G", tone: "gold", decoration: "badge" },
            { text: "Rotate / move / drag (G keeps wires attached)" },
          ],
          [
            { text: "X / Y", tone: "gold", decoration: "badge" },
            { text: "Mirror across the X / Y axis" },
          ],
          [
            { text: "E / V / U", tone: "gold", decoration: "badge" },
            { text: "Edit properties / value / reference" },
          ],
          [
            { text: "Q", tone: "gold", decoration: "badge" },
            { text: "No-connect flag — mark a pin you leave open" },
          ],
        ],
      },
      {
        type: "prose",
        md: "One more shortcut for the header slog: **Insert** repeats the last wire or label one grid-step down and **auto-increments the trailing number** (`IO4`→`IO5`→`IO6`…) — perfect for marching GPIOs onto J2/J3. Set the step under **Preferences ▸ Schematic Editor ▸ Editing Options ▸ Label increment**. The header order *jumps* in places (…`IO7` then `IO15`), so sprint each run with Insert and hand-place the seams. **No Insert key** (some compact laptops omit it)? Use the on-screen keyboard, or remap a key to Insert with Microsoft **PowerToys ▸ Keyboard Manager**. On a Mac it's **Fn+Enter**.",
      },
      {
        type: "callout",
        label: "Draw it · grounds & loose ends",
        severity: "info",
        body: "Two quick sweeps before you check it: make every ground one net, and tell KiCad about every pin you're leaving open.",
      },
      {
        type: "prose",
        md: "First, **grounds**. Every GND pin ties to the *same* net — the [[power port|power-port]] trick makes that painless: drop a GND port at each ground instead of running lines across the sheet. The big pad under the WROOM module grounds *itself* — its hidden GND pins auto-connect, so you don't wire it by hand; just confirm it with **View ▸ Show Hidden Pins** and a clean ERC.\n\nSecond, the **USB-C data pins**. Type-C is reversible, so J1 carries **two copies of each data line** — tie `DP1` + `DP2` and `DN1` + `DN2` each into one net. (`VBUS` and `GND` are already single pins here; the two **CC** pins stay separate, one [[Rd]] each, which is why there are two.)\n\nThird, **anything you're leaving open**. A spare GPIO you didn't break out, the connector's unused SBU pins, an unused regulator pin — drop a no-connect flag (the **Q** key) on each. That turns 'I forgot this' into 'I meant this' — the difference between a clean ERC and a screen of warnings you'll be tempted to scroll past.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "You leave a dozen unused module pins unwired and skip the no-connect flags. What does ERC give you? A dozen 'pin not connected' errors — real noise that buries a real mistake. Flag the ones you mean to leave open so the list shows only what matters.",
      },
      {
        type: "deepDive",
        summary: "ERC is the net, not a hoop",
        body: "You can't instruction your way out of every slip. A careful builder with the rule right in front of them still half-finishes a both-ends task across 40 pins — that's just how humans handle long, two-sided work. So the durable move isn't 'try harder,' it's design the safety net and learn to read it. That's why this lesson pairs each error-prone step with its ERC tell: label both ends — and if you miss one, ERC flags the loose pin. That flag IS your check. Work the list to zero and the net has done its job; it isn't a hoop to clear, it's the thing catching what your eyes skipped.",
      },
      {
        type: "callout",
        label: "Draw it · run ERC",
        severity: "info",
        body: "Before you trust the schematic, let KiCad check it: Inspect → Electrical Rules Checker.",
      },
      {
        type: "prose",
        md: "[[ERC]] reads your whole schematic and flags what's electrically wrong — a pin connected to nothing, two outputs fighting each other, a power rail that nothing drives. Run it, then work the list down to zero. The bar is the same one you'll meet again at DRC: clean, or every remaining flag is an exception you've marked and understood — not one you scrolled past.",
      },
      {
        type: "image",
        src: "/guide-diagrams/l1-01-schematic-reference.svg",
        alt: "Completed L1.01 schematic: USB-C front-end (J1, D1), RT9080 regulator, ESP32-S3 U1 with decoupling, J2/J3 headers, boot/reset, LEDs and test points — every net labelled.",
        caption: "The answer key — check your wiring against this, especially the USB diff pair: ERC can't catch a crossed D+/D−.",
      },
      {
        type: "table",
        columns: ["ERC says…", "…you do"],
        rows: [
          [
            { text: "Input power pin not driven", tone: "critical", decoration: "badge" },
            { text: "Drop a PWR_FLAG on each rail no chip output drives — VBUS (from the connector), +5V (after the passive fuse), and GND. It tells ERC real power enters there. You don't need one on +3V3 — the regulator's output already counts as a driver. Fix it this way; don't ignore it." },
          ],
          [
            { text: "Pin not connected", tone: "critical", decoration: "badge" },
            { text: "Meant to leave it open? Drop a no-connect flag (Q) on it — now it reads as intentional, not an oversight." },
          ],
          [
            { text: "Unconnected wire / net", tone: "critical", decoration: "badge" },
            { text: "A real mistake — join it, or delete the stray end. Don't scroll past this one." },
          ],
        ],
      },
      {
        type: "deepDive",
        summary: "Why a powered rail still trips ERC (and PWR_FLAG fixes it)",
        body: "ERC checks by pin type: it wants every power-input pin (like the ESP32's 3V3) fed by a power-output pin somewhere. Your +3V3 is fine — the [[LDO|regulator]]'s output pin counts as a driver, so ERC stays quiet. But VBUS arrives from a connector that has no 'output' pin at all, and +5V sits on the far side of a passive fuse — neither has a chip output behind it, so ERC warns 'input power pin not driven.' A [[PWR_FLAG]] is a tiny symbol whose single pin IS a power-output: drop it on VBUS, +5V, and GND and you've told ERC, truthfully, that real power enters there. That's the honest way to clear the warning, not a mute button. One trap: if you spot GNDPWR in the symbol picker, that's not this — it's a separate stacked-ground symbol that makes its own net; use a plain PWR_FLAG on a normal GND, never GNDPWR.",
      },
      {
        type: "callout",
        label: "Draw it · export & upload",
        severity: "info",
        body: "A clean ERC report is what this stage's gate wants — backed by a readable schematic you keep.",
      },
      {
        type: "steps",
        ordered: true,
        items: [
          "Run ERC until it's clean — or every remaining flag is marked and understood.",
          "Plot the schematic to PDF (File → Plot) for a readable copy, and keep the .kicad_sch source.",
          "Attach your clean ERC report as this stage's artifact — that's what the gate below checks.",
        ],
      },
      {
        type: "sourceRef",
        href: "https://docs.kicad.org/10.0/en/eeschema/eeschema.html",
        label: "KiCad 10 — Schematic Editor manual",
      },
      {
        type: "quiz",
        prompt: "Quick check — schematic",
        questions: [
          {
            q: "USB gives the board 5 V, but the ESP32 needs 3.3 V. Which part lowers the voltage to 3.3 V?",
            answer: 1,
            explain: "U2 (the RT9080) is a voltage regulator — its whole job is to turn the 5 V from USB into a steady 3.3 V.",
            options: ["J1 — the USB-C connector", "U2 — the voltage regulator", "C1 — the big capacitor"],
          },
          {
            q: "What do the little capacitors right next to the ESP32 (C2, C3, C7) do?",
            answer: 0,
            explain: "They sit right at the power pins and smooth out tiny dips, so the chip always sees a clean 3.3 V.",
            options: ["Keep its power steady so it doesn't glitch", "Store your program", "Make the chip run faster"],
          },
          {
            q: "Why does each LED have a small resistor next to it?",
            answer: 2,
            explain: "An LED with no resistor pulls too much current and burns out. The resistor keeps the current at a safe level.",
            options: ["To change the LED's colour", "To make it brighter", "To limit the current so the LED doesn't burn out"],
          },
          {
            q: "The two small resistors on the USB-C port (R3, R4) are left off. You plug into a modern USB-C charger. What happens?",
            answer: 1,
            explain: "Those resistors are how the board tells the charger 'send me power.' Without them, a USB-C charger keeps the power off.",
            options: ["It charges, just slowly", "Nothing turns on — the charger won't send power", "The board overheats"],
          },
          {
            q: "What are the two buttons (EN and BOOT) for?",
            answer: 0,
            explain: "EN resets the chip; holding BOOT while you reset lets you load (flash) new code onto it over USB.",
            options: ["Resetting the board and loading new code onto it", "Turning the LEDs on and off", "Changing the voltage"],
          },
          {
            q: "In KiCad, you give two far-apart wires the same label, 'IO4'. What happens?",
            answer: 1,
            explain: "A net is defined by connection, not by a drawn line. Same label = same net — that's how you keep a schematic readable instead of running wires everywhere.",
            options: ["Nothing — labels are just notes", "They become the same connection (the same net), no line needed between them", "KiCad warns you they conflict"],
          },
          {
            q: "Your schematic is right, but ERC says 'input power pin not driven' on the VBUS rail. Best move?",
            answer: 1,
            explain: "A PWR_FLAG honestly tells ERC the rail is powered. VBUS comes straight from the connector, which has no 'power-output' pin for ERC to see — so the flag clears the warning without hiding a real problem.",
            options: ["Ignore it — the regulator obviously powers the rail", "Add a PWR_FLAG to the rail so ERC knows it's really driven", "Delete the power pin to silence it"],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "You've now read every part on the board and why it's there, captured it as a schematic, and run ERC until it's clean. Attach the ERC report (the gate below tracks it). Carry one thing forward: U1 has a PCB antenna, so when you reach LAYOUT the keep-out underneath it is a hard constraint, not a suggestion.",
      },
    ],
  },

  LAYOUT: {
    lead: "Now you place the parts into copper and route the connections. The circuit is settled; what turns the board from 'works' into 'barely boots' is where the parts sit and how the copper flows. On this board, one rule stands above the rest: protect the antenna.",
    contentBlocks: [
      {
        type: "prose",
        md: "Layout is where the schematic meets physics. The very same circuit can work flawlessly or barely boot, depending on where the parts sit and how the copper flows between them. Three placements decide this board: the empty zone under the antenna, the decoupling caps right at the pins, and the USB pair.",
      },
      {
        type: "callout",
        label: "01 · The antenna keep-out",
        severity: "info",
        body: "U1's antenna only works over empty board.",
      },
      {
        type: "prose",
        md: "The WROOM module sends out its signal from a printed antenna at one end. Under and around that antenna you keep an [[antenna keep-out]]: no copper, no [[ground pour]], no traces — ideally the module even hangs off the edge of the board. Copper there detunes the antenna and quietly kills your wireless range. This is the headline item on the LAYOUT review, and it's the one mistake you can't fix without making a whole new board.",
      },
      {
        type: "image",
        src: "/guide-diagrams/antenna-keepout.svg",
        alt: "Board top view: ground pour fills the copper everywhere except a red dashed keep-out zone under the WROOM module's antenna, reaching the board edge.",
        caption: "Top view — the antenna keep-out: no copper, no pour, no traces (often a board cut-out).",
      },
      {
        type: "partModel",
        mpn: "ESP32-S3-WROOM-1-N16R2",
        caption: "U1 — the antenna sits at one end; keep all copper out from under it",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "You pour ground everywhere for a clean return path. Why must it stop short of U1's antenna? Copper near the antenna detunes it — the keep-out has to stay bare.",
      },
      {
        type: "deepDive",
        summary: "Why nearby copper detunes the antenna",
        body: "The WROOM's printed antenna is tuned to radiate at 2.4 GHz — its shape and its surroundings are designed for exactly that frequency. Bring copper close (a [[ground pour]], a trace, even thick silkscreen) and you add stray capacitance that shifts the tuning, like detuning a guitar string by hanging a weight on it. The antenna still 'works,' but its sweet spot slides off 2.4 GHz and most of your transmit power reflects back into the chip instead of leaving the board — range drops from across-the-house to across-the-desk. No firmware setting recovers it; the only cure is keeping the keep-out genuinely empty, which is why the module is usually placed hanging off the board edge.",
      },
      {
        type: "callout",
        label: "02 · Decoupling caps go first, and close",
        severity: "info",
        body: "Remember C2/C3/C7? Their whole value is decided here, by where you place them.",
      },
      {
        type: "prose",
        md: "A [[decoupling capacitor]] only does its job parked right against the pin it feeds, with a short, fat path to ground. So place C2, C3, and C7 right at U1's 3V3 pins before you route anything else — and put C1, the [[bulk capacitor]], near where power enters the module. Route them the long way around and the trace inductance throttles the fast current they exist to deliver; they turn into decoration.",
      },
      {
        type: "image",
        src: "/guide-diagrams/decoupling-placement.svg",
        alt: "Two panels: a decoupling cap right at the IC pin makes a small current loop (low inductance); the same cap placed far makes a large loop that chokes the fast current.",
        caption: "Why placement matters — the current-loop area sets the inductance.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "A decoupling cap is electrically correct in the schematic but placed 15 mm from the pin. Does it still work? Barely — trace inductance chokes the fast current, so being close to the pin is the entire point.",
      },
      {
        type: "deepDive",
        summary: "Loop area becomes inductance becomes droop",
        body: "When the ESP32 suddenly demands current, that current flows out of the [[decoupling capacitor]], into the pin, and back through ground — a little loop. Every loop of conductor has inductance, and inductance fights sudden changes in current: the voltage it costs you is V = L × (di/dt). The chip's demand changes incredibly fast — a big di/dt — so even a few nanohenries of trace inductance becomes a real voltage dip right at the pin, exactly when the chip needs the rail to hold steady. The fix is pure geometry: a shorter, fatter path from cap to pin to ground makes a smaller loop, which means less inductance and less droop. So 'close to the pin' isn't a nicety — it's the whole mechanism.",
      },
      {
        type: "callout",
        label: "03 · The USB data pair",
        severity: "info",
        body: "D+ and D− are a team — route them like one.",
      },
      {
        type: "prose",
        md: "USB D+ and D− form a [[differential pair]]: keep them short, side by side, equal in length, and away from noisy nets. Run them through D1, the [[ESD]] array, right at the connector, so a static zap is clamped before it can travel into the module. A [[ground pour]] alongside the pair gives a clean return path and a little shielding.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why route USB D+ and D− together and length-matched? They're a differential pair — the receiver reads the difference between them, so mismatched length or stray noise on one line corrupts the signal.",
      },
      {
        type: "quiz",
        prompt: "Quick check — layout",
        questions: [
          {
            q: "The WROOM module has a printed antenna at one end. What goes under and around it?",
            answer: 1,
            explain: "Copper near the antenna detunes it and wrecks your wireless range, so that zone stays completely bare.",
            options: ["A ground pour, for shielding", "Nothing — no copper, no traces (a keep-out)", "The biggest capacitor"],
          },
          {
            q: "Why must the small decoupling caps sit right against the chip's power pins?",
            answer: 1,
            explain: "Their whole job is delivering charge instantly; route them the long way and that benefit is throttled — proximity is the point.",
            options: ["To save board space", "A long path adds inductance that chokes the fast current they deliver", "So the board looks neat"],
          },
          {
            q: "How should USB D+ and D− be routed?",
            answer: 0,
            explain: "They're a differential pair: the receiver reads the difference between them, so they travel together and matched in length.",
            options: ["Together, side by side, and the same length", "Far apart, on opposite sides of the board", "As short as possible — length doesn't matter"],
          },
          {
            q: "Where should the ESD protection (D1) sit on the USB lines?",
            answer: 0,
            explain: "Put it at the connector so a static zap is clamped to ground before it can reach the module.",
            options: ["Right at the connector, before the signal travels inward", "Next to the ESP32", "Anywhere on the board"],
          },
          {
            q: "Which layout mistake on this board usually can't be fixed without making a new board?",
            answer: 1,
            explain: "Detuning the antenna with copper is baked into the copper itself — the only cure is making a new board.",
            options: ["A slightly long trace", "Copper poured into the antenna keep-out", "An LED placed a little crooked"],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "Complete the LAYOUT review (antenna keep-out, isolation, decoupling placement). The BOM freezes here — after this, a parts change means a new revision.",
      },
    ],
  },

  DRC_GERBER: {
    lead: "Prove the layout obeys the fab's rules, then export the exact files that get manufactured.",
    contentBlocks: [
      {
        type: "prose",
        md: "Two gates stand between your layout and a box of boards: a rules check that catches what your eyes missed, and a file export that has to be exactly right — because the fab builds precisely what you send, no more and no less.",
      },
      {
        type: "callout",
        label: "01 · DRC — the rules checker",
        severity: "info",
        body: "Before anyone builds your board, let the software find the mistakes.",
      },
      {
        type: "prose",
        md: "A [[design rule check]] tests your layout against the fab's limits — minimum trace width, copper-to-copper clearance, drill sizes, and any unconnected or shorted nets. Run it until it's clean, or until every remaining flag is an intentional exception you've understood and written down. A clearance the fab can't actually make is a short waiting to happen across a whole batch of boards.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "DRC flags a 5-mil clearance where the fab requires 6. Ship it anyway? No — fix it, or confirm the fab can do 5 and write down the exception. A clearance violation can short in production.",
      },
      {
        type: "deepDive",
        summary: "What the rules checker actually tests",
        body: "A [[design rule check]] compares your layout against a list of fabrication limits and flags anything the board house can't reliably make. The usual suspects: copper-to-copper clearance (traces too close bridge together when the copper is etched), minimum trace width (too thin and it etches away or can't carry its current), annular ring (too little copper around a drilled hole and the drill can break out of the pad), drill-to-copper spacing, and silkscreen printed over a bare pad. It also re-checks the electrics — nets that should connect but don't, or nets accidentally shorted together. You load the fab's capability numbers in first, so the check is measured against the shop that will actually build the board, not a generic guess.",
      },
      {
        type: "callout",
        label: "02 · Gerbers — the fab's instructions",
        severity: "info",
        body: "Gerbers are what the board house actually reads — not your design file.",
      },
      {
        type: "prose",
        md: "A [[gerber]] set is one file per layer — each copper layer, the solder mask, the silkscreen — plus a drill file: the precise recipe for your board. Export them, then open them in a Gerber viewer and actually look. It's your last chance to catch a mirrored layer, a missing mask opening, or a forgotten copper pour before the mistake becomes a batch of bad boards.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why open the Gerbers in a viewer after exporting? The fab builds exactly what's in those files, not what's in your design tool — a viewer catches export mistakes while they're still free to fix.",
      },
      {
        type: "deepDive",
        summary: "What's inside a Gerber set",
        body: "A [[gerber]] set is a stack of flat 2D drawings, one file per physical layer: the front copper, the back copper, the [[solder mask]] for each side (the green coating, with openings where the pads are), the silkscreen (the white labels), and the paste layer (where a stencil would lay down solder). Riding alongside is a drill file — historically called Excellon — listing every hole's position and diameter, plus a board-outline file telling the fab where to cut. The format is decades old and deliberately literal: it describes shapes and nothing else, so there's no ambiguity about what gets built. That's why you open them in a viewer before ordering — the viewer shows you the actual board, not your hopeful design intent.",
      },
      {
        type: "quiz",
        prompt: "Quick check — DRC & Gerbers",
        questions: [
          {
            q: "What does a design rule check (DRC) do?",
            answer: 1,
            explain: "DRC catches things like traces too close together or holes too small — mistakes your eyes would miss.",
            options: ["Makes the board run faster", "Compares your layout to the fab's limits and flags what they can't make", "Orders the parts for you"],
          },
          {
            q: "DRC flags a clearance smaller than the fab allows. Ship it anyway?",
            answer: 1,
            explain: "A clearance the fab can't make reliably can short across a whole batch. Clear it, or write it down as an understood exception.",
            options: ["Yes, it's probably fine", "No — fix it, or confirm the fab can do it and note why", "Yes, the fab will quietly fix it"],
          },
          {
            q: "What are Gerber files?",
            answer: 1,
            explain: "Gerbers describe each copper, mask, and silkscreen layer plus the drilling — the literal recipe the fab follows.",
            options: ["A backup of your design software", "The exact per-layer files the board house builds from", "A list of parts to buy"],
          },
          {
            q: "Why open the Gerbers in a viewer before ordering?",
            answer: 1,
            explain: "The fab uses the files, not your design tool — a quick look catches a mirrored layer or missing opening before it's a bad batch.",
            options: ["To make the files smaller", "The fab builds exactly those files — a viewer catches export mistakes while they're free to fix", "It's required by law"],
          },
          {
            q: "When is a board ready to leave this stage?",
            answer: 0,
            explain: "A clean DRC plus inspected Gerbers is the proof that the design is actually manufacturable.",
            options: ["When DRC is clean (or every flag is understood and noted) and the Gerbers are exported", "As soon as the layout looks finished", "After the parts arrive"],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "Run DRC clean (or with documented exceptions) and attach the DRC report and the Gerber zip.",
      },
    ],
  },

  ORDERING: {
    lead: "Commit the design to the real world: boards from a fab, parts from distributors.",
    contentBlocks: [
      {
        type: "prose",
        md: "Ordering is mostly a handful of choices and a lot of double-checking. There are two carts to fill — one at the board house, one at the parts distributor — and a few traps that cost you a week if you miss them.",
      },
      {
        type: "callout",
        label: "01 · Ordering the PCB",
        severity: "info",
        body: "A few options turn your Gerbers into physical boards.",
      },
      {
        type: "prose",
        md: "Upload the Gerber zip and pick the fab options: a 2-layer board, a thickness (1.6 mm is standard), and a surface finish — [[HASL]] (cheap, slightly lumpy) or [[ENIG]] (flat gold, better for the WROOM's fine-pitch pads). Order a few spares; the extra board is nearly free, and the shipping isn't.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Your board has the fine-pitch WROOM module pads. HASL or ENIG? ENIG — its flat surface solders fine-pitch parts more reliably than lumpy HASL.",
      },
      {
        type: "deepDive",
        summary: "ENIG vs HASL — why the finish matters here",
        body: "Bare copper pads tarnish, so the fab coats them. [[HASL]] (hot-air solder leveling) dips the board in molten solder and blows the excess off with hot air — cheap and very solderable, but it leaves the pads slightly domed and uneven in height. [[ENIG]] plates a flat layer of nickel capped with a thin gold flash — dead flat, long shelf life, a little pricier. For through-hole and 0805 work, HASL is perfectly fine. But the WROOM's underside pads are fine-pitch and packed close, and there a flat surface lets every pad meet the module at the same height; uneven HASL bumps invite a missed or bridged joint you can't even see under the module. That flatness is what makes this board worth the ENIG upcharge.",
      },
      {
        type: "callout",
        label: "02 · Ordering the parts",
        severity: "info",
        body: "Your BOM becomes a shopping cart — with a few traps.",
      },
      {
        type: "prose",
        md: "Order every line by its exact [[MPN]]. Mind the [[MOQ]] — passives come on reels of thousands — and buy extra of the parts you'll hand-place and lose. If anything is out of stock, this is where the second sources you noted back at sourcing (the RT9080-for-AP2112K, the UMW USBLC6-2) pay off.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "You need two 5.1 kΩ resistors but they sell in reels of 5,000. What now? Buy the reel — it's cents — and keep the spares. Always order a few extra of any part you hand-place.",
      },
      {
        type: "quiz",
        prompt: "Quick check — ordering",
        questions: [
          {
            q: "Your board has the fine-pitch WROOM pads. Which surface finish solders them more reliably?",
            answer: 1,
            explain: "ENIG's dead-flat surface lets every fine-pitch pad meet the module at the same height; lumpy HASL invites missed joints.",
            options: ["HASL — cheaper, slightly lumpy", "ENIG — flat gold", "It makes no difference"],
          },
          {
            q: "Why order a few spare PCBs?",
            answer: 1,
            explain: "The extra board costs almost nothing; re-ordering because you only got one and damaged it costs time and shipping.",
            options: ["The fab requires it", "An extra board is nearly free, but a second shipping run isn't", "Spares are worth more later"],
          },
          {
            q: "You need two 5.1 kΩ resistors, but they only sell on reels of thousands. What now?",
            answer: 1,
            explain: "Passives have a minimum order quantity but cost almost nothing — buy the reel and keep extras of anything you hand-place.",
            options: ["Pick a different value", "Buy the reel — it's pennies — and keep the spares", "Try to order exactly two somewhere"],
          },
          {
            q: "A part on your BOM is out of stock when you go to order. What helps most?",
            answer: 0,
            explain: "This is exactly when a pre-identified compatible backup — same pinout, same specs — pays off.",
            options: ["The second source you noted back at sourcing", "Cancelling the project", "Ordering a random similar-looking part"],
          },
          {
            q: "How should you order each line of the BOM?",
            answer: 1,
            explain: "Ordering by exact MPN is what guarantees you get the part that actually fits your board.",
            options: ["By a general value, like '10k resistor'", "By its exact part number (MPN)", "By whatever's cheapest that day"],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "Create the build, then attach the PCB order and the parts order to it.",
      },
    ],
  },

  ASSEMBLY: {
    lead: "Hand-build the board in the right order. Sequence is everything — the wrong order lifts parts you've already placed.",
    contentBlocks: [
      {
        type: "prose",
        md: "Assembly rewards patience and a plan. The parts go down in a deliberate order, every joint gets flux, and you inspect the board before you ever apply power. Rush the order and you'll spend longer reworking than you saved.",
      },
      {
        type: "callout",
        label: "01 · Order of operations",
        severity: "critical",
        body: "Hot-air the hard parts first, iron the rest after. Do it the other way and you knock off what you already placed.",
      },
      {
        type: "prose",
        md: "Do the fine-pitch, heat-hungry parts first on the bare board — U1, the module, and J1, the connector — with hot air or paste-and-[[reflow]]. Then iron-solder the passives and small discretes. Finally, fit the through-hole parts (switches, headers, test points). Work the other way and the hot-air rework for U1/J1 blows your freshly-placed 0805s right off the board.",
      },
      {
        type: "partModel",
        mpn: "ESP32-S3-WROOM-1-N16R2",
        caption: "U1 — a hot-air / reflow part: place it before the iron-soldered passives",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why solder the WROOM module before the 0805 resistors? Hot-air rework near already-placed passives blows them off — do the hot-air parts first, irons after.",
      },
      {
        type: "deepDive",
        summary: "Why the heavy parts go down first",
        body: "U1 and J1 are the heat-hungry parts: the module is a big slab with many pads (several hidden underneath), and the USB-C connector has chunky retention tabs that drain heat away. To solder them you flood the whole area with hot air or run the board through [[reflow]] — heat that radiates several millimeters in every direction. If the little 0805 passives are already sitting nearby, that same heat remelts their joints, and the airflow can tumble them off (or stand one up on end — [[tombstoning]]). So you place the hard, heat-hungry parts onto the bare board first, then iron the passives one at a time afterward, where the heat stays local and nothing you've already placed gets cooked twice.",
      },
      {
        type: "image",
        src: "",
        alt: "U1 and J1 tacked onto the bare board before the passives go on.",
        caption: "Your board — U1 + J1 placed first (drop your photo in here when you build it).",
      },
      {
        type: "callout",
        label: "02 · Flux and drag-soldering",
        severity: "info",
        body: "Flux is the difference between a bridge and a clean joint.",
      },
      {
        type: "prose",
        md: "Flood the pads with flux, then [[drag-tin|drag-solder]] the fine-pitch rows: load the iron tip with fresh solder and drag it steadily along the row, letting surface tension and flux pull just the right amount onto each lead while clearing the bridges. On a lead-free board you're working in [[SAC305]], which wants a slightly hotter tip and gives a more matte joint.",
      },
      {
        type: "steps",
        ordered: true,
        items: [
          "Flood the footprint with liquid flux.",
          "Load the iron tip with fresh solder.",
          "Drag along one pad row at about 3 mm/sec.",
        ],
      },
      {
        type: "video",
        src: "",
        alt: "A single drag-solder pass along one pad row.",
        caption: "Your board — one drag-solder pass (drop a short clip in here when you solder it).",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Your drag pass leaves a bridge between two pins. First move? More flux and a clean dragged pass — flux lets surface tension pull the excess off; you rarely need wick for a small bridge.",
      },
      {
        type: "deepDive",
        summary: "Why dragging molten solder doesn't bridge every pin",
        body: "It feels like dragging a bead of molten metal across a row of pins should short them all together — flux is what makes it not. Liquid flux strips the oxide off the copper and lowers the solder's surface tension, so molten solder wets clean metal eagerly but beads up and refuses to stick to the [[solder mask]] between pads. Drag a loaded tip along the row and surface tension pulls just enough solder onto each lead while the excess rides along; any bridge that forms gets reflowed and pulled apart by that same tension. Run out of flux and the magic stops — the oxide creeps back and solder clumps wherever it lands. On this lead-free board you're dragging [[SAC305]], which melts hotter and dries to a more matte finish than old leaded solder, so set the iron a touch higher.",
      },
      {
        type: "callout",
        label: "03 · Screen, then continuity",
        severity: "info",
        body: "Check your work before you ever apply power.",
      },
      {
        type: "prose",
        md: "Under magnification, hunt for solder bridges and [[tombstoning]] (a passive stood up on one end). Then run a [[continuity]] sweep with your meter: confirm the grounds are connected and — the one that matters most — confirm there is NO continuity between VBUS and GND. A short there would destroy the board the instant USB is plugged in. This is the POST_ASSEMBLY_CONTINUITY gate.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "critical",
        body: "Your meter beeps continuity between VBUS and GND before power-on. Power it anyway? Never — that's a dead short; find and clear it before any power reaches the board.",
      },
      {
        type: "quiz",
        prompt: "Quick check — assembly",
        questions: [
          {
            q: "Which parts go down first on the bare board?",
            answer: 1,
            explain: "Do the heat-hungry parts first; reworking them later would remelt and knock off passives you'd already placed.",
            options: ["The little resistors and capacitors", "The heavy hot-air parts — the module (U1) and the USB-C connector (J1)", "The headers and switches"],
          },
          {
            q: "What is flux for when soldering the fine-pitch rows?",
            answer: 1,
            explain: "Flux strips oxide and lowers surface tension, so solder wets the pads cleanly and bridges pull themselves apart.",
            options: ["It glues the part down", "It cleans the metal so solder flows onto pads and off bridges", "It changes the solder's colour"],
          },
          {
            q: "Your drag pass leaves a solder bridge between two pins. First thing to try?",
            answer: 0,
            explain: "More flux lets surface tension lift the excess on the next pass — you rarely need solder wick for a small bridge.",
            options: ["Add more flux and drag again cleanly", "Pull the part off and start over", "Add more solder on top"],
          },
          {
            q: "Before you apply any power, your meter beeps continuity between VBUS and GND. What do you do?",
            answer: 1,
            explain: "VBUS shorted to ground would destroy the board the instant USB is plugged in. Never power a board showing that short.",
            options: ["Power it on to test it", "Stop — that's a short; find and clear it first", "Ignore it if the board looks fine"],
          },
          {
            q: "Why inspect the board under magnification before powering it?",
            answer: 1,
            explain: "Finding a defect with your eyes or a meter costs a minute; finding it by powering up can cost the whole board.",
            options: ["To make it look nicer", "To catch bridges and tombstoned parts while they're still easy to fix", "It isn't really necessary"],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "Pass the build's POST_ASSEMBLY_CONTINUITY checklist — every item checked or marked N/A.",
      },
    ],
  },

  BRINGUP: {
    lead: "Power the board for the first time — carefully, rails first — and prove each one before you trust the next.",
    contentBlocks: [
      {
        type: "prose",
        md: "Bring-up is where the board either comes alive or teaches you something. Do it in order — no shorts, then the rail, then the chip — and let your multimeter, not optimism, tell you each step is safe.",
      },
      {
        type: "callout",
        label: "01 · Before power: hunt for shorts",
        severity: "info",
        body: "The safest power-on is the one you've already de-risked with a meter.",
      },
      {
        type: "prose",
        md: "With no power applied, run a [[continuity]] check between VBUS and GND — it must NOT beep — and confirm the grounds are tied together. A solder bridge found with a meter costs you a minute; the same bridge found by plugging in costs you the board.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "Why check VBUS-to-GND continuity before plugging in USB? A short there turns the first power-up into the last — the meter finds it while it's still harmless.",
      },
      {
        type: "callout",
        label: "02 · Rails first",
        severity: "info",
        body: "Trust the 3.3 V rail only after you've measured it.",
      },
      {
        type: "prose",
        md: "Power the board over USB and measure the rail at the test points: 3.3 V at TP1 (red), ground at TP2 (black). Confirm it reads 3.3 V — give or take a little — before assuming anything downstream is alive. The red power LED (LED1) should light. Glance at the input current too: a healthy idle board draws modestly, while a sudden spike means a fault you should chase before going any further.",
      },
      {
        type: "table",
        columns: ["Ref", "Part", "Role"],
        rows: [
          [
            { text: "TP1", decoration: "ref" },
            { text: "Red test point" },
            { text: "Probe the 3.3 V rail here" },
          ],
          [
            { text: "TP2", decoration: "ref" },
            { text: "Black test point" },
            { text: "Ground reference for your meter" },
          ],
        ],
      },
      {
        type: "image",
        src: "/guide-diagrams/bringup-probe-points.svg",
        alt: "Board top view with a multimeter: the red probe on TP1 (3V3) and the black probe on TP2 (GND), the meter reading 3.30 V.",
        caption: "Probing the rail — red on TP1 (3V3), black on TP2 (GND); expect 3.3 V.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "The board powers but TP1 reads 4.9 V, not 3.3. What failed? Likely the LDO (U2) — its output is sitting at the input voltage, so it's mis-soldered, mis-oriented, or its enable isn't asserted. Stop before you connect 3.3 V logic to 5 V.",
      },
      {
        type: "deepDive",
        summary: "Reading the rail voltage like a diagnostician",
        body: "The number on the meter at TP1 tells you where the fault is. A healthy ~3.3 V means the [[LDO]] is regulating — move on. 4.9 V (basically the USB input) means the regulator isn't regulating at all and is passing its input straight through: it's mis-oriented, mis-soldered, or its enable pin isn't pulled high — and you must NOT connect 3.3 V parts to that rail. 0 V means either no power is reaching it (a broken joint upstream) or something is dragging it down (a short). Around 3.3 V but LED1 stays dark points at the LED or its resistor, not the rail. The regulator also needs its input to sit comfortably above 3.3 V plus its [[dropout voltage|dropout]], so a sagging USB cable can starve it — measure the input too whenever the output looks low.",
      },
      {
        type: "image",
        src: "",
        alt: "Probing 3.3 V at TP1 with the meter's black lead on TP2 (GND).",
        caption: "Your board — the 3.3 V rail check at TP1/TP2 (add your photo here).",
      },
      {
        type: "callout",
        label: "03 · USB enumeration & first flash",
        severity: "info",
        body: "Now make the S3 talk.",
      },
      {
        type: "prose",
        md: "Plug USB into a host — the native-USB S3 should show up (enumerate) as a device. To load firmware, use the [[strapping pin|EN and BOOT buttons]]: hold BOOT (GPIO0 low), tap EN to reset, then release BOOT to drop into USB download mode and flash. A blink on LED2 afterward proves the GPIO, your toolchain, and the whole chain end to end.",
      },
      {
        type: "callout",
        label: "Check yourself",
        severity: "info",
        body: "The board powers fine but won't enter flash mode. The button move? Hold BOOT (GPIO0 low), pulse EN (reset), then release BOOT — sampling GPIO0 low at reset selects USB download.",
      },
      {
        type: "deepDive",
        summary: "Strapping pins: why holding BOOT picks download mode",
        body: "A few pins do double duty: at the instant the chip comes out of reset it samples its [[strapping pin|strapping pins]] to decide how to start, and then they go back to being ordinary [[GPIO]]. On the ESP32-S3, GPIO0 is the one that matters here — sampled HIGH (its resting default) the chip boots your firmware; sampled LOW it drops into USB download mode, ready to be flashed. That's the entire button dance: hold BOOT to force GPIO0 low, tap EN to reset the chip so it re-reads the strap, then release BOOT. Because the level is only read at that one instant, you can let go right after. It's also why you don't hang a heavy load on GPIO0 — pull it the wrong way at power-up and the board boots into the wrong mode all on its own.",
      },
      {
        type: "quiz",
        prompt: "Quick check — bring-up",
        questions: [
          {
            q: "What's the very first thing to do before plugging in USB for the first time?",
            answer: 1,
            explain: "A short found with a meter costs a minute; the same short found by plugging in can cost the whole board.",
            options: ["Load your code", "Check there's no short between VBUS and GND with a meter", "Connect a sensor"],
          },
          {
            q: "You power the board and probe TP1. What reading means the 3.3 V rail is healthy?",
            answer: 0,
            explain: "TP1 is the 3.3 V rail; ~3.3 V means the regulator is doing its job. Measure it before trusting anything downstream.",
            options: ["About 3.3 V", "About 5 V", "0 V"],
          },
          {
            q: "TP1 reads 4.9 V instead of 3.3 V. What does that point to?",
            answer: 1,
            explain: "4.9 V is basically the USB input: the LDO is mis-soldered, backwards, or not enabled. Don't connect 3.3 V parts to it.",
            options: ["Everything's fine", "The regulator isn't regulating — it's passing the input straight through", "The battery is low"],
          },
          {
            q: "Why bring the board up 'rails first' — checking the 3.3 V before anything else?",
            answer: 1,
            explain: "Prove the power is correct before you trust the chip — a bad rail can take downstream parts with it.",
            options: ["It's just tradition", "If the power is wrong, everything downstream can be damaged or misbehave", "It makes the LEDs brighter"],
          },
          {
            q: "The board powers but won't enter flash mode to load code. The button move?",
            answer: 0,
            explain: "Holding BOOT pulls GPIO0 low; the chip samples that at reset (the EN tap) and drops into USB download mode.",
            options: ["Hold BOOT, tap EN to reset, then release BOOT", "Hold both buttons down forever", "Press EN twice quickly"],
          },
        ],
      },
      {
        type: "callout",
        label: "Exit this stage",
        severity: "info",
        body: "Capture the bring-up measurements and log, then mark each board BROUGHT_UP (or QUARANTINED). That closes the build.",
      },
    ],
  },
};

async function main() {
  const { db } = await import("@/lib/db");
  const { guideContentBlocksSchema } = await import("@/lib/schemas/guide");
  let updated = 0;
  for (const [stage, card] of Object.entries(CARDS)) {
    // Defense-in-depth: validate before writing. The render path (guide page)
    // safeParses contentBlocks and drops the WHOLE array on failure (e.g. over
    // the block cap), so a write that skips validation can silently blank a
    // card. Fail loudly here instead.
    guideContentBlocksSchema.parse(card.contentBlocks);
    const res = await db.guideCard.updateMany({
      where: {
        stage: stage as never,
        guide: { revision: { project: { slug: SLUG } } },
      },
      data: { lead: card.lead, contentBlocks: card.contentBlocks as never },
    });
    console.log(`${stage}: ${res.count} card(s) updated`);
    updated += res.count;
  }
  console.log(`DONE — ${updated} card(s) total`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log("ERR " + (e?.message ?? e));
    process.exit(1);
  });
