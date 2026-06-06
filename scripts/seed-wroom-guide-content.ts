// Seed grounded TEACHING CONTENT into the L1.01 WROOM-breakout build guide.
//
// This enriches GuideCard.contentBlocks (and lead) per stage with mini-lessons
// that read THIS board's real sub-circuits — every refdes/value below is on the
// frozen v1 BOM. Voice: original prose in the style of a friendly beginner's
// electronics guide (show the part → explain the why → check yourself); no text
// is copied from any source.
//
// SCOPE: teaching content ONLY (lead + contentBlocks). The gate-wiring fields
// (isGate / completionRef / ordinal / stage) are LEFT UNTOUCHED — they were
// seeded once at materialize time and drive the authoritative-done mapping.
//
// Idempotent: re-running overwrites the same cards with the same content.
// Direct Prisma (server actions can't be scripted — requireUser/revalidatePath);
// env/db imports are deferred so dotenv loads before they read process.env.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { ContentBlock } from "@/lib/schemas/guide";
import type { GuideStage } from "@/lib/guide-templates/stage-skeletons";

const PROJECT_SLUG = "foundry-l1-01-wroom-breakout";
const REV_LABEL = "v1";

// ── SCHEMATIC card: six sub-circuit mini-lessons, in power-flow order ──────────
const SCHEMATIC_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Six small problems stand between a bare ESP32 module and a board you can plug in and flash: it needs the right voltage, a steady supply, a defined way to boot, a USB port that negotiates power, something you can see, and a shield from the outside world. Each section below takes one of those problems and the exact parts on your board that solve it. Read them in order — they roughly follow the power as it enters at the USB connector and works its way to the chip.\n\nEvery part carries a [[refdes]] — U1, C5, R3 — the label that ties its symbol, its BOM line, and its footprint on the board together. You'll meet them in the tables under each section, and you can rotate the real 3D model of the headline parts as you go.",
  },
  {
    type: "image",
    src: "/guide-diagrams/wroom-power-flow.svg",
    alt: "Power-flow block diagram: USB-C J1 to polyfuse F1 to RT9080 LDO U2 to 3.3 V for the ESP32-S3 U1; USB data via the D1 ESD array; with C1 bulk, C2/C3/C7 decoupling, and R3/R4 CC resistors to ground.",
    caption: "How it all connects — power flows left to right; the six lessons below follow this path.",
  },
  {
    type: "partModel",
    mpn: "ESP32-S3-WROOM-1-N16R2",
    caption: "U1 — ESP32-S3-WROOM-1 module (drag to rotate)",
  },

  // 1 — The 3.3 V rail (LDO regulator)
  {
    type: "callout",
    severity: "info",
    label: "01 · The 3.3 V rail — your regulator",
    body: "Your ESP32-S3 wants a clean 3.3 V supply, but USB hands you 5 V. Something has to step it down.",
  },
  {
    type: "prose",
    md: "That something is U2, the RT9080. It's an [[LDO]], which just means low-dropout: a regulator that holds its output steady even when the input is only a little above it.\n\nWhy not a voltage divider? Because a divider sags the instant the chip pulls current — and the ESP32's draw lurches every time its radio transmits. The LDO actively holds 3.3 V no matter the load. That is the entire job of a regulator.\n\nOne catch: the RT9080 needs a capacitor on its input and its output to stay stable — that's C5 and C6, 1 µF each. The datasheet promises stability with 1 µF ceramic in and out, which is exactly what we gave it.",
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
    severity: "warn",
    label: "Gotcha",
    body: "Don't treat C5/C6 as optional. An LDO without its output cap can oscillate, turning your clean rail into noise.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "The RT9080 drops 0.53 V at 600 mA. If USB sags to 4.6 V under load, do you still clear 3.3 V at the output? Yes: 4.6 − 0.53 = 4.07 V, well above 3.3 V. That headroom is exactly why we picked a low-dropout part.",
  },

  // 2 — Decoupling the module
  {
    type: "callout",
    severity: "info",
    label: "02 · Decoupling — a reservoir at the pins",
    body: "A steady rail at the regulator is not the same as a steady rail at the chip a few centimetres away.",
  },
  {
    type: "prose",
    md: "When the ESP32 switches its transistors millions of times a second, it grabs tiny gulps of current faster than the regulator across the board can possibly respond. Left unfed, the 3.3 V at the chip's pins would dip on every gulp — and a microcontroller fed a dipping rail glitches or resets.\n\nThe fix is a small [[decoupling capacitor|capacitor]] parked right at each power pin: C2, C3, and C7 (0.1 µF each). They hold a little reserve of charge and dump it instantly when the chip asks, then refill between demands. C1 (10 µF) plays the same game one size up — a [[bulk capacitor|bigger, slower reservoir]] for the whole rail, smoothing the larger swings the little caps don't cover. Together: bulk plus bypass.",
  },
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [
        { text: "C2  C3  C7", decoration: "ref" },
        { text: "0.1 µF X7R" },
        { text: "Bypass — one at each module 3V3 pin" },
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
    severity: "warn",
    label: "Gotcha",
    body: "These only work if they sit hard against the module's power pins. A decoupling cap routed the long way round is just decoration — the trace inductance chokes off the fast current it's meant to deliver. (Carry this into LAYOUT.)",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Why three 0.1 µF caps instead of one 0.3 µF cap? Because each has to sit next to a different power pin. A capacitor's help fades with distance, so proximity beats raw capacitance.",
  },

  // 3 — Boot & reset straps (pull-ups)
  {
    type: "callout",
    severity: "info",
    label: "03 · Boot & reset — pull-ups that set a default",
    body: "A digital input wired to nothing doesn't read 0. It floats, picking up noise and reading randomly.",
  },
  {
    type: "prose",
    md: "The ESP32 samples two [[strapping pin|strapping pins]] the instant it wakes: EN (chip-enable / reset) and GPIO0 (boot select). Both must be at a definite level at that moment, so each gets a [[pull-up resistor]] — R1 and R2, 10 kΩ — tying it gently to 3.3 V (logic high). EN high means the chip runs; GPIO0 high at reset means boot normally from flash.\n\nThe two buttons override that resting level. SW1 yanks EN to ground to reset the chip; holding SW2 (GPIO0 to ground) through a reset drops it into USB download mode to flash new firmware. The resistor sets the default, the button wins while you hold it.",
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
    severity: "info",
    label: "Check yourself",
    body: "Why 10 kΩ and not 100 Ω? A pull-up wants to be weak — just enough to define the level. At 3.3 V a 10 kΩ pull-up leaks only 0.33 mA yet holds the pin firmly high; a 100 Ω pull-up would burn 33 mA and turn the button press into a tug-of-war. Ohm's law: I = V / R.",
  },

  // 4 — USB-C as a sink (pull-downs)
  {
    type: "callout",
    severity: "info",
    label: "04 · USB-C — advertising as a sink",
    body: "A USB-C source won't push 5 V onto VBUS until it's sure something on the other end actually wants power.",
  },
  {
    type: "prose",
    md: "Your board announces itself as a consumer (a [[sink]]) by tying each [[CC pin]] to ground through a 5.1 kΩ resistor, called [[Rd]]. The host detects that exact resistance and only then switches [[VBUS]] on.\n\nThere are two — R3 and R4 — because Type-C is reversible: whichever way the plug goes in, one of CC1/CC2 is the live one, so both need their own Rd. These are [[pull-down resistor|pull-down resistors]] (to ground) — the mirror image of the boot pull-ups in the last lesson. And 5.1 kΩ isn't arbitrary; it's the value the USB-C spec assigns to a basic sink.",
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
    severity: "info",
    label: "Check yourself",
    body: "Leave them off and plug into a modern USB-C charger — what happens? Nothing powers up: the charger never sees an Rd and keeps VBUS off. The cruel part is that a legacy USB-A-to-C cable would still work (A ports always have 5 V), so the board seems fine on an old cable and dead on a new charger. That ghost is why these two resistors are not optional.",
  },

  // 5 — Indicator LEDs (current-limiting)
  {
    type: "callout",
    severity: "info",
    label: "05 · Indicator LEDs — a resistor sets the current",
    body: "An LED is a diode, and a diode is a poor judge of its own appetite.",
  },
  {
    type: "prose",
    md: "Give an LED more voltage than it wants and it gulps more and more current until it cooks itself. So you never connect one straight across a supply — you put a [[current-limiting resistor|resistor in series]] to set the current.\n\nThe math is Ohm's law on the leftover voltage. The supply is 3.3 V; the red LED drops about 1.8 V across itself (its [[forward voltage|forward voltage, Vf]]), leaving 1.5 V across R5. With 470 Ω that's I = 1.5 V / 470 Ω ≈ 3.2 mA — bright enough to see, easy on the [[GPIO]] driving it. R5 and R6 do this for LED1 (red, power) and LED2 (yellow, user).",
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
    severity: "warn",
    label: "Gotcha",
    body: "An LED without its series resistor is a short with extra steps — it flashes once and dies. R5/R6 are not garnish.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "The yellow LED drops about 2.0 V. Through the same 470 Ω, does it run brighter or dimmer than the red? Dimmer: a higher Vf leaves less voltage for the resistor — (3.3 − 2.0)/470 ≈ 2.8 mA versus the red's 3.2 mA. That's why swapping LED colours at a fixed resistor quietly changes the brightness.",
  },

  // 6 — Protecting the port
  {
    type: "callout",
    severity: "info",
    label: "06 · Protecting the port — two bodyguards",
    body: "The USB connector is the one part of your board that touches the outside world, so it's where trouble comes in.",
  },
  {
    type: "prose",
    md: "It gets two bodyguards. F1 is a [[PTC|resettable fuse]] (a PTC polyfuse) on [[VBUS]]: if something downstream pulls too much current, it heats up, its resistance spikes, and it throttles the current to a trickle — then, once it cools, it returns to normal all by itself.\n\nD1 is an [[ESD]]-protection array (USBLC6-2) on the two data lines and VBUS. When a static spike arrives — thousands of volts off a fingertip — it clamps that spike to ground in a nanosecond with a [[TVS diode|clamping diode]], before it can punch through the ESP32's delicate USB pins. It's deliberately a low-capacitance part, because USB data is fast and a bulky protector would smear the signal.",
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
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Why a resettable PTC instead of an ordinary one-shot fuse? A blown glass fuse is dead weight until you desolder it and fit a new one — miserable on a populated board. The PTC trips to protect, then heals when the fault clears. Protection without a service call.",
  },

  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — schematic",
    questions: [
      {
        q: "USB sags to 4.6 V under load. The RT9080 LDO drops 0.53 V at 600 mA. Do you still clear 3.3 V at the output?",
        options: [
          "No — the regulator can't hold 3.3 V that low.",
          "Yes — 4.6 − 0.53 = 4.07 V, well above 3.3 V.",
          "Only if you remove the output cap.",
        ],
        answer: 1,
        explain: "That headroom is exactly why we chose a low-dropout part.",
      },
      {
        q: "Why three 0.1 µF caps at U1's power pins instead of one 0.3 µF cap?",
        options: [
          "More total capacitance is always better.",
          "Each must sit next to a different power pin — proximity beats raw capacitance.",
          "0.3 µF caps don't exist.",
        ],
        answer: 1,
        explain: "A cap's help fades with trace distance, so one per pin beats one big shared cap.",
      },
      {
        q: "The EN / boot straps use 10 kΩ pull-ups, not 100 Ω. Why keep them 'weak'?",
        options: [
          "100 Ω would leak ~33 mA and fight the button; 10 kΩ sets the level for ~0.33 mA.",
          "10 kΩ is the only value that comes in 0805.",
          "A stronger pull-up boots the chip faster.",
        ],
        answer: 0,
        explain: "A pull-up only needs to set the resting level; weaker wastes less and lets the button win.",
      },
      {
        q: "You omit R3/R4 (the 5.1 kΩ CC resistors) and plug into a modern USB-C charger. What happens?",
        options: [
          "It charges normally.",
          "Nothing powers up — the charger never sees a sink and keeps VBUS off.",
          "The board draws too much current and trips the fuse.",
        ],
        answer: 1,
        explain: "The 5.1 kΩ Rd is how a sink advertises itself; without it a C-to-C source won't enable VBUS.",
      },
      {
        q: "The yellow LED (Vf ≈ 2.0 V) has a higher forward voltage than the red (≈ 1.8 V). Through the same 470 Ω it runs…",
        options: [
          "brighter — a higher Vf means more current.",
          "dimmer — a higher Vf leaves less voltage across the resistor, so less current.",
          "exactly the same — the resistor fixes the current.",
        ],
        answer: 1,
        explain: "I = (3.3 − Vf) / 470, so a higher Vf gives a smaller current.",
      },
    ],
  },
  // Exit
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "You've now read every part on the board and why it's there. To leave SCHEMATIC, capture the schematic as a file artifact (the gate below tracks it). Carry one thing forward: U1 has a PCB antenna, so when you reach LAYOUT the keep-out under it is a hard constraint, not a suggestion.",
  },
];

const SCHEMATIC_LEAD =
  "A schematic isn't drawn — it's reasoned out, one sub-circuit at a time. Walk your board the way a designer built it: name the problem, then meet the parts that solve it. Every refdes below is on your BOM.";

// ── REQUIREMENTS ──────────────────────────────────────────────────────────────
const REQUIREMENTS_LEAD =
  "Before a single wire, decide what the board must do and the limits it must respect. Get this wrong and every later stage inherits the mistake.";
const REQUIREMENTS_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Requirements are the promises the board has to keep. For this board they're small in number but unforgiving: power it from one USB-C port, run an ESP32-S3, expose its pins, and don't break the radio. Pin those down now and the rest of the build is mostly bookkeeping.",
  },
  {
    type: "partModel",
    mpn: "ESP32-S3-WROOM-1-N16R2",
    caption: "U1 — the ESP32-S3-WROOM-1 module this board exists to break out",
  },
  {
    type: "callout",
    severity: "info",
    label: "01 · What you're building",
    body: "A USB-C-powered ESP32-S3 breakout: a minimal, hand-solderable board that brings the module's pins out to headers.",
  },
  {
    type: "prose",
    md: "The heart is U1, the ESP32-S3-WROOM-1 — a [[microcontroller]] module with Wi-Fi and Bluetooth built in. One USB-C port (J1) both powers the board and programs it: the S3 has native USB, so it enumerates and accepts firmware directly, with no separate USB-to-serial bridge chip. Two breakaway headers (J2/J3) bring the GPIO out to a breadboard. That's the whole mission — a clean, reliable way to get hands on the S3.",
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
    severity: "info",
    label: "Check yourself",
    body: "Why does this board need no separate USB-to-serial programmer chip? Because the ESP32-S3 has native USB built in — it enumerates and takes firmware over the USB-C port directly.",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Power budget",
    body: "Will the 3.3 V rail survive a Wi-Fi transmit burst? Answer it now, on paper.",
  },
  {
    type: "prose",
    md: "USB hands you 5 V; the [[LDO]] (U2) turns that into 3.3 V at up to 600 mA. The ESP32-S3 sips current most of the time but spikes hard the instant its radio transmits. Budget so the peak — the S3's burst plus everything else — fits under 600 mA with margin to spare. That headroom is exactly why the board uses a 600 mA regulator and a 10 µF bulk cap, not a tiny 150 mA part. Add hungry loads later (a motor, a servo) and you invite [[brownout]].",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "The LDO can deliver 600 mA. If the ESP32 peaks near 500 mA on a Wi-Fi burst and the rest of the board draws ~50 mA, are you inside budget? Just — about 550 mA leaves thin margin, which is why bulk cap C1 is there to ride out the spikes.",
  },
  {
    type: "callout",
    severity: "info",
    label: "03 · The ADC1-only rule",
    body: "On any Wi-Fi-connected ESP32, half the analog pins go dark.",
  },
  {
    type: "prose",
    md: "[[ADC2]] is unusable while the radio is active — and on a Wi-Fi board, the radio is basically always active. So every analog input you plan to sample must land on an [[ADC1]] pin. This is a decision to record now, while you're choosing which GPIO does what, not a mystery to debug at bring-up when an analog read returns garbage only when Wi-Fi is on.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "You wire a potentiometer to an ADC2 pin and the reading is garbage only when Wi-Fi is on. What's the rule you broke? Sampled analog inputs must be on ADC1 — ADC2 is claimed by the radio.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "The REQUIREMENTS_REVIEW checklist captures the COMMS-track design decisions — the ADC1 rule, level-shifting for any addressable LEDs, brownout mitigation for motors/servos, idle-current and power-source choices — plus the one that binds this board hardest: the WROOM [[antenna keep-out]] confirmed against the module datasheet. Complete it to advance.",
  },
];

// ── BOM_SOURCING ──────────────────────────────────────────────────────────────
const BOM_LEAD =
  "Turn the schematic's ideal parts into real, orderable ones — every line an exact part you can actually buy, with a fallback for when you can't.";
const BOM_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "A schematic says '5.1 kΩ resistor.' A BOM says RC0805FR-075K1L. Sourcing is the unglamorous translation from intent to a part number a distributor will ship — and the place where a board quietly dies if a part is out of stock and you have no plan B. Your board's BOM already shows the scars of doing this well.",
  },
  {
    type: "callout",
    severity: "info",
    label: "01 · Why an exact MPN",
    body: "'A 5.1 kΩ resistor' isn't orderable. RC0805FR-075K1L is.",
  },
  {
    type: "prose",
    md: "Every BOM line needs an [[MPN]] — a manufacturer plus an exact number — and that number pins far more than the value: tolerance, package size, voltage rating, temperature behavior. 'A 0.1 µF cap' could be any of a thousand parts; the MPN is the one that fits your footprint and survives your rail. Vague values are how you order a reel that won't fit the pads you laid out.",
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
    severity: "info",
    label: "Check yourself",
    body: "Two '10 kΩ resistors' from different reels — why might only one fit your board? Package size. An 0805 and an 0402 are both 10 kΩ but won't share a footprint; the MPN locks the size.",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Reading a datasheet",
    body: "Datasheets are dense and rarely put what you want where you want it. One habit tames them.",
  },
  {
    type: "prose",
    md: "Find the power and ground pins and the absolute-maximum ratings first, before anything else — everything depends on powering the part correctly and not exceeding its limits. For U1 that means confirming the 3V3 pin's range (3.0–3.6 V) and how EN and the boot pin behave; for U2, the input range and the in/out caps it needs to stay stable. Read narrowly and on purpose; you rarely need the whole document.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Before wiring any IC, what's the first thing to find in its datasheet? Its power and ground pins (and absolute-max voltage) — everything else is moot if you power it wrong.",
  },
  {
    type: "callout",
    severity: "info",
    label: "03 · Stock, lifecycle & a second source",
    body: "The best part is the one you can actually get today.",
  },
  {
    type: "prose",
    md: "Check that each part is in stock and still active (not end-of-life). Your board already records two real sourcing saves: U2 is the RT9080 because the original AP2112K went out of stock, and D1 is a UMW USBLC6-2, a pin- and spec-compatible second source for ST's part. Naming a fallback now — same pinout, same specs — is the difference between a five-minute swap and a stalled project.",
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
    severity: "info",
    label: "Check yourself",
    body: "Your chosen LDO goes out of stock mid-project. What saves you? A pre-identified second source with the same pinout and specs — exactly what the BOM's sourcing notes call out.",
  },
  {
    type: "callout",
    severity: "info",
    label: "04 · Packages you can hand-build",
    body: "A part you can't solder by hand is the wrong part for this board.",
  },
  {
    type: "prose",
    md: "This board deliberately favors hand-friendly packages: 0805 passives (big enough to place with an iron, unlike 0402), a USB-C receptacle with board guides and solder-retention tabs, and through-hole switches and headers. When you order, watch the [[MOQ]] — passives ship on reels — and buy a few spares of anything you'll hand-place and inevitably lose or cook.",
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
    severity: "info",
    label: "Check yourself",
    body: "Why 0805 passives instead of smaller 0402? Hand-soldering. 0805 is large enough to place and drag-solder with an iron; 0402 really wants paste and hot air.",
  },
];

// ── LAYOUT ────────────────────────────────────────────────────────────────────
const LAYOUT_LEAD =
  "Place and route the parts into copper. On this board one rule towers over the rest — protect the antenna.";
const LAYOUT_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Layout is where the schematic meets physics. The same circuit can work flawlessly or barely boot depending on where parts sit and how copper flows. Three placements decide this board: the antenna's empty zone, the decoupling caps at the pins, and the USB pair.",
  },
  {
    type: "callout",
    severity: "info",
    label: "01 · The antenna keep-out",
    body: "U1's antenna only works over empty board.",
  },
  {
    type: "prose",
    md: "The WROOM module radiates from a printed antenna at one end. Under and around it you hold an [[antenna keep-out]]: no copper, no [[ground pour]], no traces — ideally the module overhangs the board edge entirely. Copper there detunes the antenna and quietly destroys your wireless range. This is the headline item on the LAYOUT review, and it's the one mistake you can't fix without re-spinning the board.",
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
    severity: "info",
    label: "Check yourself",
    body: "You pour ground everywhere for a clean return path. Why must it stop short of U1's antenna? Copper near the antenna detunes it — the keep-out must stay bare.",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Decoupling caps go first, and close",
    body: "Remember C2/C3/C7? Their whole value is decided here, by placement.",
  },
  {
    type: "prose",
    md: "A [[decoupling capacitor]] only does its job parked hard against the pin it feeds, with a short fat path to ground. So place C2, C3, and C7 right at U1's 3V3 pins before you route the scenic stuff — and put C1, the [[bulk capacitor]], near where power enters the module. Route them the long way and the trace inductance throttles the fast current they exist to deliver; they become decoration.",
  },
  {
    type: "image",
    src: "/guide-diagrams/decoupling-placement.svg",
    alt: "Two panels: a decoupling cap right at the IC pin makes a small current loop (low inductance); the same cap placed far makes a large loop that chokes the fast current.",
    caption: "Why placement matters — the current-loop area sets the inductance.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "A decoupling cap is electrically correct in the schematic but placed 15 mm from the pin. Does it still work? Barely — trace inductance chokes the fast current, so proximity is the entire point.",
  },
  {
    type: "callout",
    severity: "info",
    label: "03 · The USB data pair",
    body: "D+ and D− are a team — route them like one.",
  },
  {
    type: "prose",
    md: "USB D+ and D− form a [[differential pair]]: keep them short, side by side, equal in length, and away from noisy nets. Run them through D1, the [[ESD]] array, right at the connector so a static zap is clamped before it can travel into the module. A [[ground pour]] alongside the pair gives a clean return and a little shielding.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Why route USB D+ and D− together and length-matched? They're a differential pair — the receiver reads their difference, so mismatched length or stray noise on one line corrupts the signal.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "Complete the LAYOUT review (antenna keep-out, isolation, decoupling placement). The BOM freezes here — after this, parts changes mean a new revision.",
  },
];

// ── DRC_GERBER ────────────────────────────────────────────────────────────────
const DRC_LEAD =
  "Prove the layout obeys the fab's rules, then export the exact files that get manufactured.";
const DRC_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Two gates stand between your layout and a box of boards: a rules check that catches what your eyes missed, and a file export that has to be exactly right because the fab builds precisely what you send — no more, no less.",
  },
  {
    type: "callout",
    severity: "info",
    label: "01 · DRC — the rules checker",
    body: "Before anyone builds your board, let the software find the mistakes.",
  },
  {
    type: "prose",
    md: "A [[design rule check]] tests your layout against the fab's limits — minimum trace width, copper-to-copper clearance, drill sizes, and any unconnected or shorted nets. Run it until it's clean, or until every remaining flag is an intentional exception you've understood and documented. A clearance the fab can't actually make is a short waiting to happen across a whole batch.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "DRC flags a 5-mil clearance where the fab requires 6. Ship it anyway? No — fix it, or confirm the fab can do 5 and document the exception. A clearance violation can short in production.",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Gerbers — the fab's instructions",
    body: "Gerbers are what the board house actually reads — not your design file.",
  },
  {
    type: "prose",
    md: "A [[gerber]] set is one file per layer — each copper layer, the solder mask, the silkscreen — plus a drill file: the precise recipe for your board. Export them, then open them in a Gerber viewer and actually look. It's your last chance to catch a mirrored layer, a missing mask opening, or a forgotten copper pour before the mistake becomes a batch of bad boards.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Why open the Gerbers in a viewer after exporting? The fab builds exactly what's in those files, not what's in your design tool — a viewer catches export mistakes while they're still free to fix.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "Run DRC clean (or with documented exceptions) and attach the DRC report and the Gerber zip.",
  },
];

// ── ORDERING ──────────────────────────────────────────────────────────────────
const ORDERING_LEAD =
  "Commit the design to the real world: boards from a fab, parts from distributors.";
const ORDERING_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Ordering is mostly a handful of choices and a lot of double-checking. Two carts to fill — one at the board house, one at the parts distributor — and a few traps that cost a week if you miss them.",
  },
  {
    type: "callout",
    severity: "info",
    label: "01 · Ordering the PCB",
    body: "A few options turn your Gerbers into physical boards.",
  },
  {
    type: "prose",
    md: "Upload the Gerber zip and pick the fab options: a 2-layer board, a thickness (1.6 mm is standard), and a surface finish — [[HASL]] (cheap, slightly lumpy) or [[ENIG]] (flat gold, better for the WROOM's fine-pitch pads). Order a few spares; the marginal board is nearly free and the shipping isn't.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Your board has the fine-pitch WROOM module pads. HASL or ENIG? ENIG — its flat surface solders fine-pitch parts more reliably than lumpy HASL.",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Ordering the parts",
    body: "Your BOM becomes a shopping cart — with a few traps.",
  },
  {
    type: "prose",
    md: "Order every line by its exact [[MPN]]. Mind the [[MOQ]] — passives come on reels of thousands — and buy extra of the parts you'll hand-place and lose. If anything is out of stock, this is where the second sources you noted at sourcing (the RT9080-for-AP2112K, the UMW USBLC6-2) earn their keep.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "You need two 5.1 kΩ resistors but they sell in reels of 5,000. What now? Buy the reel — it's cents — and keep the spares. Always order a few extra of any part you hand-place.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "Create the build, then attach the PCB order and the parts order to it.",
  },
];

// ── ASSEMBLY ──────────────────────────────────────────────────────────────────
const ASSEMBLY_LEAD =
  "Hand-build the board in the right order. Sequence is everything — the wrong order lifts parts you already placed.";
const ASSEMBLY_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Assembly rewards patience and a plan. The parts go down in a deliberate order, each joint gets flux, and you inspect before you ever apply power. Rush the order and you'll spend longer reworking than you saved.",
  },
  {
    type: "callout",
    severity: "critical",
    label: "01 · Order of operations",
    body: "Hot-air the hard parts first, iron the rest after. Reverse it and you knock off what you placed.",
  },
  {
    type: "prose",
    md: "Do the fine-pitch, thermally-heavy parts first on the bare board — U1, the module, and J1, the connector — with hot air or paste-and-[[reflow]]. Then iron-solder the passives and discretes. Finally fit the through-hole parts (switches, headers, test points). Work the other way and the hot-air rework for U1/J1 blows your freshly-placed 0805s off the board.",
  },
  {
    type: "partModel",
    mpn: "ESP32-S3-WROOM-1-N16R2",
    caption: "U1 — a hot-air / reflow part: place it before the iron-soldered passives",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Why solder the WROOM module before the 0805 resistors? Hot-air rework near already-placed passives blows them off — do the hot-air parts first, irons after.",
  },
  {
    type: "image",
    src: "",
    alt: "U1 and J1 tacked onto the bare board before the passives go on.",
    caption: "Your board — U1 + J1 placed first (drop your photo in here when you build it).",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Flux and drag-soldering",
    body: "Flux is the difference between a bridge and a clean joint.",
  },
  {
    type: "prose",
    md: "Flood the pads with flux, then [[drag-tin|drag-solder]] the fine-pitch rows: load the iron tip with fresh solder and drag steadily along the row, letting surface tension and flux pull just the right amount onto each lead while clearing bridges. On a lead-free board you're working in [[SAC305]], which wants a slightly hotter tip and gives a more matte joint.",
  },
  {
    type: "steps",
    ordered: true,
    items: [
      "Flood the footprint with liquid flux.",
      "Load the iron tip with fresh solder.",
      "Drag along one pad row at ~3 mm/sec.",
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
    severity: "info",
    label: "Check yourself",
    body: "Your drag pass leaves a bridge between two pins. First move? More flux and a clean dragged pass — flux lets surface tension pull the excess off; you rarely need wick for a small bridge.",
  },
  {
    type: "callout",
    severity: "info",
    label: "03 · Screen, then continuity",
    body: "Check your work before you ever apply power.",
  },
  {
    type: "prose",
    md: "Under magnification, hunt for solder bridges and [[tombstoning]] (a passive stood up on one end). Then run a [[continuity]] sweep with your meter: confirm grounds are connected and — the one that matters most — confirm there is NO continuity between VBUS and GND. A short there would destroy the board the instant USB is plugged in. This is the POST_ASSEMBLY_CONTINUITY gate.",
  },
  {
    type: "callout",
    severity: "critical",
    label: "Check yourself",
    body: "Your meter beeps continuity between VBUS and GND before power-on. Power it anyway? Never — that's a dead short; find and clear it before any power reaches the board.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "Pass the build's POST_ASSEMBLY_CONTINUITY checklist — every item checked or marked N/A.",
  },
];

// ── BRINGUP ───────────────────────────────────────────────────────────────────
const BRINGUP_LEAD =
  "Power the board for the first time — carefully, rails first — and prove each one before you trust the next.";
const BRINGUP_BLOCKS: ContentBlock[] = [
  {
    type: "prose",
    md: "Bring-up is where the board either comes alive or teaches you something. Do it in order — no shorts, then the rail, then the chip — and let your multimeter, not optimism, tell you each step is safe.",
  },
  {
    type: "callout",
    severity: "info",
    label: "01 · Before power: hunt for shorts",
    body: "The safest power-on is the one you've already de-risked with a meter.",
  },
  {
    type: "prose",
    md: "With no power applied, run a [[continuity]] check between VBUS and GND — it must NOT beep — and confirm the grounds are tied together. A solder bridge found with a meter costs you a minute; the same bridge found by plugging in costs you the board.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "Why check VBUS-to-GND continuity before plugging in USB? A short there turns the first power-up into the last — the meter finds it while it's still harmless.",
  },
  {
    type: "callout",
    severity: "info",
    label: "02 · Rails first",
    body: "Trust the 3.3 V rail only after you've measured it.",
  },
  {
    type: "prose",
    md: "Power the board over USB and measure the rail at the test points: 3.3 V at TP1 (red), ground at TP2 (black). Confirm it reads 3.3 V — give or take a little — before assuming anything downstream is alive. The red power LED (LED1) should light. Glance at the input current too: a healthy idle board draws modestly, while a sudden spike means a fault you should chase before going further.",
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
    severity: "info",
    label: "Check yourself",
    body: "The board powers but TP1 reads 4.9 V, not 3.3. What failed? Likely the LDO (U2) — its output is sitting at the input voltage, so it's mis-soldered, mis-oriented, or its enable isn't asserted. Stop before you connect 3.3 V logic to 5 V.",
  },
  {
    type: "image",
    src: "",
    alt: "Probing 3.3 V at TP1 with the meter's black lead on TP2 (GND).",
    caption: "Your board — the 3.3 V rail check at TP1/TP2 (add your photo here).",
  },
  {
    type: "callout",
    severity: "info",
    label: "03 · USB enumeration & first flash",
    body: "Now make the S3 talk.",
  },
  {
    type: "prose",
    md: "Plug USB into a host — the native-USB S3 should enumerate as a device. To load firmware, use the [[strapping pin|EN and BOOT buttons]]: hold BOOT (GPIO0 low), tap EN to reset, then release BOOT to drop into USB download mode and flash. A blink on LED2 afterward proves the GPIO, your toolchain, and the whole chain end to end.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Check yourself",
    body: "The board powers fine but won't enter flash mode. The button move? Hold BOOT (GPIO0 low), pulse EN (reset), then release BOOT — sampling GPIO0 low at reset selects USB download.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "Capture the bring-up measurements and log, then mark each board BROUGHT_UP (or QUARANTINED). That closes the build.",
  },
];

// stage → { lead, blocks }. All eight design→bring-up cards are authored here;
// the seed updates each card's teaching content (gate wiring stays untouched).
const CARDS: Partial<Record<GuideStage, { lead: string; blocks: ContentBlock[] }>> = {
  REQUIREMENTS: { lead: REQUIREMENTS_LEAD, blocks: REQUIREMENTS_BLOCKS },
  SCHEMATIC: { lead: SCHEMATIC_LEAD, blocks: SCHEMATIC_BLOCKS },
  BOM_SOURCING: { lead: BOM_LEAD, blocks: BOM_BLOCKS },
  LAYOUT: { lead: LAYOUT_LEAD, blocks: LAYOUT_BLOCKS },
  DRC_GERBER: { lead: DRC_LEAD, blocks: DRC_BLOCKS },
  ORDERING: { lead: ORDERING_LEAD, blocks: ORDERING_BLOCKS },
  ASSEMBLY: { lead: ASSEMBLY_LEAD, blocks: ASSEMBLY_BLOCKS },
  BRINGUP: { lead: BRINGUP_LEAD, blocks: BRINGUP_BLOCKS },
};

async function main() {
  const { db } = await import("@/lib/db");
  const { guideContentBlocksSchema } = await import("@/lib/schemas/guide");

  // Optional `--stage SCHEMATIC` (or `--stage=SCHEMATIC`) to update ONE card —
  // useful when the live cards for other stages are ahead of this branch's seed
  // (e.g. content seeded from a not-yet-merged branch) and a full run would
  // clobber them.
  const i = process.argv.indexOf("--stage");
  const onlyStage =
    process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1] ??
    (i >= 0 ? process.argv[i + 1] : undefined);

  const project = await db.project.findUniqueOrThrow({
    where: { slug: PROJECT_SLUG },
    select: { id: true, name: true },
  });
  const rev = await db.revision.findFirstOrThrow({
    where: { projectId: project.id, label: { equals: REV_LABEL, mode: "insensitive" } },
    select: { id: true, frozenAt: true },
  });
  const guide = await db.guide.findUniqueOrThrow({
    where: { revisionId: rev.id },
    select: { id: true },
  });

  for (const [stage, content] of Object.entries(CARDS)) {
    if (onlyStage && stage !== onlyStage) continue;
    // Defense-in-depth: validate against the same schema the page + persistence
    // layer enforce, so a malformed block fails here, not in the browser.
    guideContentBlocksSchema.parse(content.blocks);

    const card = await db.guideCard.findFirstOrThrow({
      where: { guideId: guide.id, stage: stage as GuideStage },
      select: { id: true },
    });
    await db.guideCard.update({
      where: { id: card.id },
      data: {
        lead: content.lead,
        contentBlocks: content.blocks as object,
      },
    });
    console.log(`updated ${stage} card ${card.id} — ${content.blocks.length} blocks`);
  }

  console.log(`done (project="${project.name}", revision=${rev.id}, frozen=${rev.frozenAt ? "yes" : "no"})`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
