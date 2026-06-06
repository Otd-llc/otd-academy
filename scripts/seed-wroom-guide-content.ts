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
    body: "In plain terms, why use a regulator (U2) instead of just resistors to drop the voltage? Because a regulator holds 3.3 V steady no matter how much the chip draws — a plain resistor divider would sag the moment the chip gets busy.",
  },
  {
    type: "deepDive",
    summary: "Why a low-dropout (LDO) part?",
    body: "Even when USB sags to about 4.6 V under load, the RT9080 only needs ~0.53 V of headroom to keep regulating: 4.6 − 0.53 = 4.07 V, still comfortably above 3.3 V. A cheaper regulator that needs 1–2 V of headroom would drop out here and the 3.3 V rail would collapse. That margin is the whole reason we chose a [[dropout voltage|low-dropout]] (LDO) part.",
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
    body: "In one line, what do C2/C3/C7 do? They sit right at the chip's power pins and keep its 3.3 V steady when it suddenly pulls current.",
  },
  {
    type: "deepDive",
    summary: "Why three small caps, not one big one?",
    body: "A capacitor only helps if it's close — the longer the trace between it and the pin, the more its help fades (trace inductance gets in the way). Three 0.1 µF caps, one hard against each power pin, beat a single 0.3 µF cap sitting a few millimetres away: proximity matters more than raw capacitance. The 10 µF [[bulk capacitor|bulk cap]] (C1) handles the slower, larger swings the little ones can't.",
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
    body: "If R1 weren't there and you pressed nothing, what would the EN pin read? It would float — pick up electrical noise and read randomly, so the chip might reset or never start. The pull-up gives it a steady, known level.",
  },
  {
    type: "deepDive",
    summary: "Why 10 kΩ, and why 'weak'?",
    body: "A pull-up only has to set the resting level, not power anything — so it should be 'weak' (a high value). At 3.3 V, a 10 kΩ pull-up leaks just 0.33 mA (3.3 V ÷ 10 kΩ) — negligible — yet still firmly holds the pin high. A 100 Ω pull-up would burn 33 mA doing the same job and fight the button when you press it. Weaker is better here.",
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
    body: "What is R3/R4's message to a charger, in plain words? 'I'm a device that wants power.' That's what makes a USB-C charger turn its 5 V on.",
  },
  {
    type: "deepDive",
    summary: "Why exactly 5.1 kΩ, and why two?",
    body: "A device advertises itself as a power 'sink' by tying each [[CC pin]] to ground through a 5.1 kΩ resistor (called [[Rd]]) — that exact value is what the USB-C spec assigns to a basic sink. There are two (R3, R4) because Type-C is reversible: whichever way the plug goes in, one CC pin is the live one, so both need their own Rd. The sneaky failure: with an old USB-A-to-C cable it would still work (A ports always have 5 V), so the board can seem fine on an old cable yet dead on a new charger.",
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
    body: "Why can't you wire an LED straight to 3.3 V with no resistor? An LED doesn't limit its own current — without a resistor it pulls far too much and burns out almost instantly.",
  },
  {
    type: "deepDive",
    summary: "Sizing the resistor (Ohm's law)",
    body: "The resistor sets the current from the leftover voltage: I = (Vsupply − Vf) / R. The red LED drops about 1.8 V across itself (its [[forward voltage|forward voltage, Vf]]), so on 3.3 V through 470 Ω: (3.3 − 1.8) / 470 ≈ 3.2 mA — bright enough to see, easy on the GPIO. The yellow LED's Vf is higher (~2.0 V), so the same 470 Ω gives a bit less — (3.3 − 2.0) / 470 ≈ 2.8 mA — which is why swapping LED colours at a fixed resistor quietly changes the brightness.",
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
    body: "What two things does the USB port need protecting from? Too much current (a short or a greedy device) and static-electricity zaps on the data lines.",
  },
  {
    type: "deepDive",
    summary: "How F1 and D1 actually protect the port",
    body: "F1 is a [[PTC|resettable fuse]] (a 'polyfuse'): on overcurrent it heats up, its resistance shoots up to throttle the current, then it heals once it cools — unlike a glass fuse you'd have to desolder and replace. D1 is an [[ESD]] array on the data lines; when a static spike arrives — thousands of volts off a fingertip — it clamps that spike to ground in a nanosecond. It's deliberately a low-capacitance part because USB data is fast and a bulky protector would smear the signal.",
  },

  // ── Draw it in KiCad (the 'how', after the 'why') ──────────────────────────────
  {
    type: "prose",
    md: "You've reasoned out every part — now you draw it. Open KiCad, drop in the parts from your BOM export, and capture the circuit as a real schematic. A good schematic isn't just correct, it's readable: someone (including future-you) should follow it at a glance. A few conventions and one rules-check get you there.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Draw it · place by convention",
    body: "Lay parts out so the drawing reads the way the circuit works — power in at the top, signal flowing left to right.",
  },
  {
    type: "prose",
    md: "Place each part so the sheet reads left → right: inputs on the left, outputs on the right. Put [[power port|power symbols]] (3V3, VBUS) at the top pointing up and grounds at the bottom pointing down. Group parts by sub-circuit, the same way you just learned them — the USB-C front end together, the regulator together, the ESP32 and its caps together. And draw each [[decoupling capacitor]] right next to the pin it feeds, so the schematic mirrors how the part must sit on the board.",
  },
  {
    type: "image",
    src: "/guide-diagrams/schematic-conventions.svg",
    alt: "An IC with signal flowing in from the left and out to the right, a 3V3 supply symbol pointing up, a GND symbol pointing down, and a decoupling capacitor drawn right at the power pin.",
    caption: "The four habits that make a schematic readable.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Draw it · wire it cleanly",
    body: "Connect with names, not a maze of lines. Two wires with the same label are the same net.",
  },
  {
    type: "prose",
    md: "For anything that crosses the sheet — a power rail, a reset line — give the wire a [[net label]] instead of dragging a line across everything: two wires sharing a label are connected, and the drawing stays clean. Use [[power port|power ports]] for 3V3 and GND so every part taps the rail by name. And remember wires that merely cross aren't joined unless there's a junction dot — let KiCad drop those at real T-connections.",
  },
  {
    type: "deepDive",
    summary: "Why named labels beat long wires",
    body: "A net is defined by connection, not by a drawn line — so a [[net label]] called 3V3 in one corner of the sheet is the same wire as a 3V3 label in the other corner, with nothing drawn between them. That isn't a shortcut, it's the readable way: a schematic with twenty rails crossing it hides mistakes, while one built from named [[power port|ports]] and short local wires shows each sub-circuit as a tidy island. The electrical meaning is identical; the human meaning is night and day.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Draw it · KiCad 10 shortcuts",
    body: "A handful of keys do most of the work — hover over a part and press the key. (Live list: Preferences → Hotkeys, or press ? in the editor.)",
  },
  {
    type: "table",
    columns: ["Key", "What it does"],
    rows: [
      [{ text: "A", decoration: "badge", tone: "gold" }, { text: "Add a symbol (place a part)" }],
      [{ text: "P", decoration: "badge", tone: "gold" }, { text: "Add a power port — 3V3, GND, VBUS" }],
      [{ text: "W", decoration: "badge", tone: "gold" }, { text: "Draw a wire" }],
      [{ text: "L", decoration: "badge", tone: "gold" }, { text: "Place a net label" }],
      [{ text: "R / M / G", decoration: "badge", tone: "gold" }, { text: "Rotate / move / drag (G keeps wires attached)" }],
      [{ text: "X / Y", decoration: "badge", tone: "gold" }, { text: "Mirror across the X / Y axis" }],
      [{ text: "E / V / U", decoration: "badge", tone: "gold" }, { text: "Edit properties / value / reference" }],
      [{ text: "Q", decoration: "badge", tone: "gold" }, { text: "No-connect flag — mark a pin you leave open" }],
    ],
  },
  {
    type: "callout",
    severity: "info",
    label: "Draw it · run ERC",
    body: "Before you trust the schematic, let KiCad check it: Inspect → Electrical Rules Checker.",
  },
  {
    type: "prose",
    md: "[[ERC]] reads your whole schematic and flags what's electrically wrong — a pin connected to nothing, two outputs fighting, a power rail nothing drives. Run it, then work the list to zero. The bar is the very one you'll meet again at DRC: clean, or every remaining flag is an exception you've marked and understood — not one you scrolled past.",
  },
  {
    type: "table",
    columns: ["ERC says…", "…you do"],
    rows: [
      [{ text: "Input power pin not driven", decoration: "badge", tone: "critical" }, { text: "Add a PWR_FLAG to rails that arrive from outside (VBUS from USB) or leave a regulator — it tells ERC the rail really is powered. Fix it, don't ignore it." }],
      [{ text: "Pin not connected", decoration: "badge", tone: "critical" }, { text: "Meant to leave it open? Drop a no-connect flag (Q) on it — now it reads as intentional, not an oversight." }],
      [{ text: "Unconnected wire / net", decoration: "badge", tone: "critical" }, { text: "A real mistake — join it, or delete the stray end. Don't scroll past this one." }],
    ],
  },
  {
    type: "deepDive",
    summary: "Why a powered rail still trips ERC (and PWR_FLAG fixes it)",
    body: "ERC checks by pin type: it wants every power-input pin (like the ESP32's 3V3) fed by a power-output pin somewhere. But your 3.3 V comes out of the [[LDO|regulator]], whose output KiCad may not mark as a power-output, and your 5 V arrives from a connector that has no 'output' pin at all — so ERC sees a rail nothing officially drives and warns you. A [[PWR_FLAG]] is a tiny symbol whose single pin IS a power-output: drop it on VBUS and on 3V3 and you've told ERC, truthfully, that the rail is driven and you checked. That's the honest way to clear the warning, not a mute button.",
  },
  {
    type: "callout",
    severity: "info",
    label: "Draw it · export & upload",
    body: "A clean, readable schematic is the artifact this stage wants.",
  },
  {
    type: "steps",
    ordered: true,
    items: [
      "Run ERC until it's clean — or every remaining flag is marked and understood.",
      "Plot the schematic to PDF (File → Plot) for a readable copy, and keep the .kicad_sch source.",
      "Attach the schematic as this stage's artifact — that's what the gate below checks.",
    ],
  },
  {
    type: "sourceRef",
    label: "KiCad 10 — Schematic Editor manual",
    href: "https://docs.kicad.org/10.0/en/eeschema/eeschema.html",
  },

  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — schematic",
    questions: [
      {
        q: "USB gives the board 5 V, but the ESP32 needs 3.3 V. Which part lowers the voltage to 3.3 V?",
        options: [
          "J1 — the USB-C connector",
          "U2 — the voltage regulator",
          "C1 — the big capacitor",
        ],
        answer: 1,
        explain: "U2 (the RT9080) is a voltage regulator — its whole job is to turn the 5 V from USB into a steady 3.3 V.",
      },
      {
        q: "What do the little capacitors right next to the ESP32 (C2, C3, C7) do?",
        options: [
          "Keep its power steady so it doesn't glitch",
          "Store your program",
          "Make the chip run faster",
        ],
        answer: 0,
        explain: "They sit right at the power pins and smooth out tiny dips, so the chip always sees a clean 3.3 V.",
      },
      {
        q: "Why does each LED have a small resistor next to it?",
        options: [
          "To change the LED's colour",
          "To make it brighter",
          "To limit the current so the LED doesn't burn out",
        ],
        answer: 2,
        explain: "An LED with no resistor pulls too much current and burns out. The resistor keeps the current at a safe level.",
      },
      {
        q: "The two small resistors on the USB-C port (R3, R4) are left off. You plug into a modern USB-C charger. What happens?",
        options: [
          "It charges, just slowly",
          "Nothing turns on — the charger won't send power",
          "The board overheats",
        ],
        answer: 1,
        explain: "Those resistors are how the board tells the charger 'send me power.' Without them, a USB-C charger keeps the power off.",
      },
      {
        q: "What are the two buttons (EN and BOOT) for?",
        options: [
          "Resetting the board and loading new code onto it",
          "Turning the LEDs on and off",
          "Changing the voltage",
        ],
        answer: 0,
        explain: "EN resets the chip; holding BOOT while you reset lets you load (flash) new code onto it over USB.",
      },
      {
        q: "In KiCad, you give two far-apart wires the same label, '3V3'. What happens?",
        options: [
          "Nothing — labels are just notes",
          "They become the same connection (the same net), no line needed between them",
          "KiCad warns you they conflict",
        ],
        answer: 1,
        explain: "A net is defined by connection, not by a drawn line. Same label = same net — that's how you keep a schematic readable instead of running wires everywhere.",
      },
      {
        q: "Your schematic is right, but ERC says 'input power pin not driven' on the 3.3 V rail. Best move?",
        options: [
          "Ignore it — the regulator obviously powers the rail",
          "Add a PWR_FLAG to the rail so ERC knows it's really driven",
          "Delete the power pin to silence it",
        ],
        answer: 1,
        explain: "A PWR_FLAG honestly tells ERC the rail is powered (a regulator output or a connector doesn't count as a 'power output' on its own). It clears the warning without hiding a real problem.",
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
    type: "deepDive",
    summary: "Native USB vs a separate bridge chip",
    body: "Most older microcontrollers can't speak USB at all — they talk a plain serial protocol, so the board needs a little translator chip (a CP2102 or CH340) sitting between the USB port and the chip just to load code. The ESP32-S3 has a USB controller built into the silicon, so the USB-C port wires almost straight to the module. That's one fewer chip to buy, place, and solder, and you get extras for free: the same port can act as a serial console and even a hardware debugger. The tradeoff is that if your own firmware ever jams the USB peripheral, you fall back on the BOOT and EN buttons to force a download — which is exactly why those two buttons are on the board.",
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
    body: "The 3.3 V regulator can supply up to 600 mA. The ESP32 mostly sips current but gulps hard for a few milliseconds each time its radio transmits. What rides out those gulps so the rail doesn't dip? The bulk capacitor (C1) — a little local reservoir of charge, right where it's needed.",
  },
  {
    type: "deepDive",
    summary: "The power budget, with numbers",
    body: "Add up the worst case: the ESP32-S3 can peak near 500 mA during a Wi-Fi transmit burst, and the rest of the board — LEDs, the regulator's own draw, anything you hang off the headers — is maybe 50 mA. That's about 550 mA against the [[LDO]]'s 600 mA ceiling, leaving only ~50 mA of margin. A tiny 150 mA regulator would [[brownout|brown out]] the instant Wi-Fi keyed up. The transmit spikes are also far faster than the regulator can react to, so C1, the 10 µF [[bulk capacitor]], holds a local pool of charge to cover them while the regulator catches up. Hang a motor or a servo on the rail and you blow the budget — those want their own supply.",
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
    type: "deepDive",
    summary: "Why ADC2 goes dark when Wi-Fi is on",
    body: "The ESP32-S3 has two analog-to-digital converters, [[ADC1]] and [[ADC2]]. The Wi-Fi radio borrows ADC2's hardware while it's running, so a program that reads an ADC2 pin with Wi-Fi active gets an error or a meaningless number — and because this is a Wi-Fi board, the radio is essentially always on. The fix is a layout decision, not a code workaround: route anything you'll sample as analog to an ADC1 pin (on the S3 those are GPIO1 through GPIO10). Settle it here, while pins are still just lines on a schematic, and you'll never hit the maddening 'works until I connect to Wi-Fi' bug at bring-up.",
  },
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — requirements",
    questions: [
      {
        q: "This board programs over its USB-C port with no extra 'programmer' chip. Why?",
        options: [
          "The ESP32-S3 can speak USB all by itself",
          "Because USB-C is faster than older USB",
          "Because the board has no other chips",
        ],
        answer: 0,
        explain: "The ESP32-S3 has USB built into the chip, so the USB-C port can load code directly — no separate translator chip needed.",
      },
      {
        q: "The 3.3 V regulator can supply up to 600 mA. Why not pick a tiny 150 mA one to save money?",
        options: [
          "Smaller parts always cost more",
          "The ESP32 briefly needs much more than that whenever Wi-Fi transmits",
          "150 mA regulators don't exist",
        ],
        answer: 1,
        explain: "A Wi-Fi burst pushes the current near 500 mA for a moment — a 150 mA part would brown out and reset the board.",
      },
      {
        q: "What is the bulk capacitor (C1) there for?",
        options: [
          "To store your program",
          "To hold a little spare charge for sudden current spikes",
          "To lower the voltage",
        ],
        answer: 1,
        explain: "C1 is a small local reservoir — it covers the fast Wi-Fi current spikes the regulator can't react to in time.",
      },
      {
        q: "You want to read a knob (a potentiometer) as an analog value while Wi-Fi is on. Which kind of pin must you use?",
        options: [
          "Any pin is fine",
          "An ADC1 pin",
          "An ADC2 pin",
        ],
        answer: 1,
        explain: "The Wi-Fi radio takes over ADC2, so analog readings must land on an ADC1 pin or they come back as garbage.",
      },
      {
        q: "When is the best time to decide which job each pin does?",
        options: [
          "Now, while planning — before drawing anything",
          "At the very end, after the board is built",
          "It doesn't matter when",
        ],
        answer: 0,
        explain: "Pin choices like the ADC1 rule are cheap to get right on paper now and painful to fix once the board exists.",
      },
    ],
  },
  // Exit
  {
    type: "callout",
    severity: "info",
    label: "Exit this stage",
    body: "You've pinned down what this board has to do — powered and programmed over one USB-C port, a 3.3 V budget that survives a Wi-Fi burst, and the ADC1-only rule. Write those decisions up as your requirements note and attach it, then pass the quick check above. That's the gate — no formal design-review checklist on a build this size.",
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
    type: "deepDive",
    summary: "Reading the part number RC0805FR-075K1L",
    body: "A manufacturer part number isn't random — it's a spec sheet squeezed into a string. Walk RC0805FR-075K1L: RC is Yageo's thick-film resistor family, 0805 is the package size, F means ±1% tolerance, the 07 is a packaging code, and 5K1 is the value — '5K1' reads as 5.1 kΩ, the same trick that writes 4.7 Ω as '4R7'. Why 5.1 and not a round 5.0? Resistors come in fixed [[E-series|E24]] steps (…, 4.7, 5.1, 5.6, …), so 5.1 kΩ is a real, stockable value and 5.0 kΩ simply isn't made. Once you can read the number, two near-identical parts tell themselves apart at a glance.",
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
  {
    type: "deepDive",
    summary: "0805 and 0402, in millimeters",
    body: "The package code is just the size in hundredths of an inch: an 0805 part is 0.08\" × 0.05\", about 2.0 × 1.25 mm — roughly a grain of rice. An 0402 is 1.0 × 0.5 mm, half that on each side and a quarter of the area. Both come in every common value, but 0805 is about the smallest you can comfortably hold with tweezers and drag-solder with an iron; 0402 really wants solder paste and a stencil. That's the whole reason this board specs 0805 throughout. One catch when you order: passives ship on reels with an [[MOQ]] in the thousands — but the parts are pennies, so buy the reel and keep the spares for the ones you'll inevitably flick across the room.",
  },
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — sourcing",
    questions: [
      {
        q: "A schematic says '5.1 kΩ resistor.' Why isn't that enough to actually order one?",
        options: [
          "It doesn't say the exact part — the size, tolerance, and maker are still missing",
          "5.1 kΩ resistors don't exist",
          "You can only order resistors in kits",
        ],
        answer: 0,
        explain: "An exact part number (MPN) pins the size, tolerance, and manufacturer — '5.1 kΩ' alone could be a thousand different parts.",
      },
      {
        q: "Two parts are both '10 kΩ' but only one fits your board. What's most likely different?",
        options: [
          "Their colour",
          "Their physical package size (like 0805 vs 0402)",
          "Their price",
        ],
        answer: 1,
        explain: "Same value, different footprint — an 0805 won't sit on pads laid out for an 0402. The MPN locks the size.",
      },
      {
        q: "When you open a new chip's datasheet, what should you find first?",
        options: [
          "Its price",
          "Its power and ground pins, and its maximum voltage",
          "Its release date",
        ],
        answer: 1,
        explain: "Everything depends on powering the part correctly and not exceeding its limits — so that's the first thing to confirm.",
      },
      {
        q: "Your chosen regulator goes out of stock halfway through the project. What saves you?",
        options: [
          "Waiting for it to come back",
          "A pre-picked 'second source' with the same pinout and specs",
          "Redesigning the whole board",
        ],
        answer: 1,
        explain: "A compatible backup named ahead of time (like this board's RT9080-for-AP2112K) turns a dead stop into a quick swap.",
      },
      {
        q: "Why does this board use 0805 parts instead of smaller 0402 ones?",
        options: [
          "0805 is cheaper",
          "0805 is big enough to solder comfortably by hand",
          "0402 is out of stock",
        ],
        answer: 1,
        explain: "0805 is about the smallest you can place and drag-solder with an iron; 0402 really wants paste and a stencil.",
      },
    ],
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
    type: "deepDive",
    summary: "Why nearby copper detunes the antenna",
    body: "The WROOM's printed antenna is tuned to radiate at 2.4 GHz — its shape and surroundings are designed for exactly that frequency. Bring copper close (a [[ground pour]], a trace, even thick silkscreen) and you add stray capacitance that shifts the tuning, like detuning a guitar string by hanging a weight on it. The antenna still 'works,' but its sweet spot slides off 2.4 GHz and most of your transmit power reflects back into the chip instead of leaving the board — range drops from across-the-house to across-the-desk. No firmware setting recovers it; the only cure is keeping the keep-out genuinely empty, which is why the module is usually placed hanging off the board edge.",
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
    type: "deepDive",
    summary: "Loop area becomes inductance becomes droop",
    body: "When the ESP32 suddenly demands current, that current flows out of the [[decoupling capacitor]], into the pin, and back through ground — a little loop. Every loop of conductor has inductance, and inductance fights sudden changes in current: the voltage it costs you is V = L × (di/dt). The chip's demand changes incredibly fast — a big di/dt — so even a few nanohenries of trace inductance turns into a real voltage dip right at the pin, exactly when the chip needs the rail to hold steady. The fix is pure geometry: a shorter, fatter path from cap to pin to ground makes a smaller loop, which means less inductance and less droop. So 'close to the pin' isn't a nicety — it's the whole mechanism.",
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
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — layout",
    questions: [
      {
        q: "The WROOM module has a printed antenna at one end. What goes under and around it?",
        options: [
          "A ground pour, for shielding",
          "Nothing — no copper, no traces (a keep-out)",
          "The biggest capacitor",
        ],
        answer: 1,
        explain: "Copper near the antenna detunes it and wrecks your wireless range, so that zone stays completely bare.",
      },
      {
        q: "Why must the small decoupling caps sit right against the chip's power pins?",
        options: [
          "To save board space",
          "A long path adds inductance that chokes the fast current they deliver",
          "So the board looks neat",
        ],
        answer: 1,
        explain: "Their whole job is delivering charge instantly; route them the long way and that benefit is throttled — proximity is the point.",
      },
      {
        q: "How should USB D+ and D− be routed?",
        options: [
          "Together, side by side, and the same length",
          "Far apart, on opposite sides of the board",
          "As short as possible — length doesn't matter",
        ],
        answer: 0,
        explain: "They're a differential pair: the receiver reads their difference, so they travel together and matched in length.",
      },
      {
        q: "Where should the ESD protection (D1) sit on the USB lines?",
        options: [
          "Right at the connector, before the signal travels inward",
          "Next to the ESP32",
          "Anywhere on the board",
        ],
        answer: 0,
        explain: "Put it at the connector so a static zap is clamped to ground before it can reach the module.",
      },
      {
        q: "Which layout mistake on this board usually can't be fixed without making a new board?",
        options: [
          "A slightly long trace",
          "Copper poured into the antenna keep-out",
          "An LED placed a little crooked",
        ],
        answer: 1,
        explain: "Detuning the antenna with copper is baked into the copper itself — the only cure is re-spinning the board.",
      },
    ],
  },
  // Exit
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
    type: "deepDive",
    summary: "What the rules checker actually tests",
    body: "A [[design rule check]] compares your layout against a list of fabrication limits and flags anything the board house can't reliably make. The usual suspects: copper-to-copper clearance (traces too close bridge when the copper is etched), minimum trace width (too thin and it etches away or can't carry its current), annular ring (too little copper around a drilled hole and the drill can break out of the pad), drill-to-copper spacing, and silkscreen printed over a bare pad. It also re-checks the electrics — nets that should connect but don't, or nets accidentally shorted together. You load the fab's capability numbers in first, so the check is measured against the shop that will actually build the board, not a generic guess.",
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
    type: "deepDive",
    summary: "What's inside a Gerber set",
    body: "A [[gerber]] set is a stack of flat 2D drawings, one file per physical layer: the front copper, the back copper, the [[solder mask]] for each side (the green coating, with openings where the pads are), the silkscreen (the white labels), and the paste layer (where a stencil would lay down solder). Riding alongside is a drill file — historically called Excellon — listing every hole's position and diameter, plus a board-outline file telling the fab where to cut. The format is decades old and deliberately literal: it describes shapes and nothing else, so there's no ambiguity about what gets built. That's why you open them in a viewer before ordering — the viewer shows you the actual board, not your hopeful design intent.",
  },
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — DRC & Gerbers",
    questions: [
      {
        q: "What does a design rule check (DRC) do?",
        options: [
          "Makes the board run faster",
          "Compares your layout to the fab's limits and flags what they can't make",
          "Orders the parts for you",
        ],
        answer: 1,
        explain: "DRC catches things like traces too close together or holes too small — mistakes your eyes would miss.",
      },
      {
        q: "DRC flags a clearance smaller than the fab allows. Ship it anyway?",
        options: [
          "Yes, it's probably fine",
          "No — fix it, or confirm the fab can do it and document why",
          "Yes, the fab will quietly fix it",
        ],
        answer: 1,
        explain: "A clearance the fab can't make reliably can short across a whole batch. Clear it, or document it as an understood exception.",
      },
      {
        q: "What are Gerber files?",
        options: [
          "A backup of your design software",
          "The exact per-layer files the board house builds from",
          "A list of parts to buy",
        ],
        answer: 1,
        explain: "Gerbers describe each copper, mask, and silkscreen layer plus the drilling — the literal recipe the fab follows.",
      },
      {
        q: "Why open the Gerbers in a viewer before ordering?",
        options: [
          "To make the files smaller",
          "The fab builds exactly those files — a viewer catches export mistakes while they're free to fix",
          "It's required by law",
        ],
        answer: 1,
        explain: "The fab uses the files, not your design tool — a quick look catches a mirrored layer or missing opening before it's a bad batch.",
      },
      {
        q: "When is a board ready to leave this stage?",
        options: [
          "When DRC is clean (or every flag is understood and documented) and the Gerbers are exported",
          "As soon as the layout looks finished",
          "After the parts arrive",
        ],
        answer: 0,
        explain: "A clean DRC plus inspected Gerbers is the proof that the design is actually manufacturable.",
      },
    ],
  },
  // Exit
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
    type: "deepDive",
    summary: "ENIG vs HASL — why the finish matters here",
    body: "Bare copper pads tarnish, so the fab coats them. [[HASL]] (hot-air solder leveling) dips the board in molten solder and blows the excess off with hot air — cheap and very solderable, but it leaves pads slightly domed and uneven in height. [[ENIG]] plates a flat layer of nickel capped with a thin gold flash — dead flat, long shelf life, a little pricier. For through-hole and 0805 work HASL is perfectly fine. But the WROOM's underside pads are fine-pitch and packed close, and there a flat surface lets every pad meet the module at the same height; uneven HASL bumps invite a missed or bridged joint you can't even see under the module. That coplanarity is what makes this board worth the ENIG upcharge.",
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
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — ordering",
    questions: [
      {
        q: "Your board has the fine-pitch WROOM pads. Which surface finish solders them more reliably?",
        options: [
          "HASL — cheaper, slightly lumpy",
          "ENIG — flat gold",
          "It makes no difference",
        ],
        answer: 1,
        explain: "ENIG's dead-flat surface lets every fine-pitch pad meet the module at the same height; lumpy HASL invites missed joints.",
      },
      {
        q: "Why order a few spare PCBs?",
        options: [
          "The fab requires it",
          "An extra board is nearly free, but a second shipping run isn't",
          "Spares are worth more later",
        ],
        answer: 1,
        explain: "The marginal board costs almost nothing; re-ordering because you only got one and damaged it costs time and shipping.",
      },
      {
        q: "You need two 5.1 kΩ resistors, but they only sell on reels of thousands. What now?",
        options: [
          "Pick a different value",
          "Buy the reel — it's pennies — and keep the spares",
          "Try to order exactly two somewhere",
        ],
        answer: 1,
        explain: "Passives have a minimum order quantity but cost almost nothing — buy the reel and keep extras of anything you hand-place.",
      },
      {
        q: "A part on your BOM is out of stock when you go to order. What helps most?",
        options: [
          "The second source you noted back at sourcing",
          "Cancelling the project",
          "Ordering a random similar-looking part",
        ],
        answer: 0,
        explain: "This is exactly when a pre-identified compatible backup — same pinout, same specs — earns its keep.",
      },
      {
        q: "How should you order each line of the BOM?",
        options: [
          "By a general value, like '10k resistor'",
          "By its exact part number (MPN)",
          "By whatever's cheapest that day",
        ],
        answer: 1,
        explain: "Ordering by exact MPN is what guarantees you get the part that actually fits your board.",
      },
    ],
  },
  // Exit
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
    type: "deepDive",
    summary: "Why the heavy parts go down first",
    body: "U1 and J1 are the thermally heavy parts: the module is a big slab with many pads (several hidden underneath), and the USB-C connector has chunky retention tabs that drain heat away. To solder them you flood the whole area with hot air or run the board through [[reflow]] — heat that radiates several millimeters in every direction. If the little 0805 passives are already sitting nearby, that same heat remelts their joints and the airflow can tumble them off (or stand one up on end — [[tombstoning]]). So you place the hard, heat-hungry parts onto the bare board first, then iron the passives one at a time afterward, where the heat stays local and nothing you've already placed gets cooked twice.",
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
    type: "deepDive",
    summary: "Why dragging molten solder doesn't bridge every pin",
    body: "It feels like dragging a bead of molten metal across a row of pins should short them all together — flux is what makes it not. Liquid flux strips the oxide off the copper and lowers the solder's surface tension, so molten solder wets clean metal eagerly but beads up and refuses to stick to the [[solder mask]] between pads. Drag a loaded tip along the row and surface tension pulls just enough solder onto each lead while the excess rides along; any bridge that forms gets reflowed and pulled apart by that same tension. Run out of flux and the magic stops — the oxide creeps back and solder clumps wherever it lands. On this lead-free board you're dragging [[SAC305]], which melts hotter and dries to a more matte finish than old leaded solder, so set the iron a touch higher.",
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
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — assembly",
    questions: [
      {
        q: "Which parts go down first on the bare board?",
        options: [
          "The little resistors and capacitors",
          "The heavy hot-air parts — the module (U1) and the USB-C connector (J1)",
          "The headers and switches",
        ],
        answer: 1,
        explain: "Do the heat-hungry parts first; reworking them later would remelt and knock off passives you'd already placed.",
      },
      {
        q: "What is flux for when soldering the fine-pitch rows?",
        options: [
          "It glues the part down",
          "It cleans the metal so solder flows onto pads and off bridges",
          "It changes the solder's colour",
        ],
        answer: 1,
        explain: "Flux strips oxide and lowers surface tension, so solder wets the pads cleanly and bridges pull themselves apart.",
      },
      {
        q: "Your drag pass leaves a solder bridge between two pins. First thing to try?",
        options: [
          "Add more flux and drag again cleanly",
          "Pull the part off and start over",
          "Add more solder on top",
        ],
        answer: 0,
        explain: "More flux lets surface tension lift the excess on the next pass — you rarely need solder wick for a small bridge.",
      },
      {
        q: "Before you apply any power, your meter beeps continuity between VBUS and GND. What do you do?",
        options: [
          "Power it on to test it",
          "Stop — that's a short; find and clear it first",
          "Ignore it if the board looks fine",
        ],
        answer: 1,
        explain: "VBUS shorted to ground would destroy the board the instant USB is plugged in. Never power a board showing that short.",
      },
      {
        q: "Why inspect the board under magnification before powering it?",
        options: [
          "To make it look nicer",
          "To catch bridges and tombstoned parts while they're still easy to fix",
          "It isn't really necessary",
        ],
        answer: 1,
        explain: "Finding a defect with your eyes or a meter costs a minute; finding it by powering up can cost the whole board.",
      },
    ],
  },
  // Exit
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
    type: "deepDive",
    summary: "Strapping pins: why holding BOOT picks download mode",
    body: "A few pins do double duty: at the instant the chip comes out of reset it samples its [[strapping pin|strapping pins]] to decide how to start, and then they go back to being ordinary [[GPIO]]. On the ESP32-S3, GPIO0 is the one that matters here — sampled HIGH (its resting default) the chip boots your firmware; sampled LOW it drops into USB download mode, ready to be flashed. That's the entire button dance: hold BOOT to force GPIO0 low, tap EN to reset the chip so it re-reads the strap, then release BOOT. Because the level is only read at that one instant, you can let go right after. It's also why you don't hang a heavy load on GPIO0 — pull it the wrong way at power-up and the board boots into the wrong mode all on its own.",
  },
  // Comprehension check (additive to the work-gate, not a replacement).
  {
    type: "quiz",
    prompt: "Quick check — bring-up",
    questions: [
      {
        q: "What's the very first thing to do before plugging in USB for the first time?",
        options: [
          "Load your code",
          "Check there's no short between VBUS and GND with a meter",
          "Connect a sensor",
        ],
        answer: 1,
        explain: "A short found with a meter costs a minute; the same short found by plugging in can cost the whole board.",
      },
      {
        q: "You power the board and probe TP1. What reading means the 3.3 V rail is healthy?",
        options: [
          "About 3.3 V",
          "About 5 V",
          "0 V",
        ],
        answer: 0,
        explain: "TP1 is the 3.3 V rail; ~3.3 V means the regulator is doing its job. Measure it before trusting anything downstream.",
      },
      {
        q: "TP1 reads 4.9 V instead of 3.3 V. What does that point to?",
        options: [
          "Everything's fine",
          "The regulator isn't regulating — it's passing the input straight through",
          "The battery is low",
        ],
        answer: 1,
        explain: "4.9 V is basically the USB input: the LDO is mis-soldered, backwards, or not enabled. Don't connect 3.3 V parts to it.",
      },
      {
        q: "Why bring the board up 'rails first' — checking the 3.3 V before anything else?",
        options: [
          "It's just tradition",
          "If the power is wrong, everything downstream can be damaged or misbehave",
          "It makes the LEDs brighter",
        ],
        answer: 1,
        explain: "Prove the power is correct before you trust the chip — a bad rail can take downstream parts with it.",
      },
      {
        q: "The board powers but won't enter flash mode to load code. The button move?",
        options: [
          "Hold BOOT, tap EN to reset, then release BOOT",
          "Hold both buttons down forever",
          "Press EN twice quickly",
        ],
        answer: 0,
        explain: "Holding BOOT pulls GPIO0 low; the chip samples that at reset (the EN tap) and drops into USB download mode.",
      },
    ],
  },
  // Exit
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
