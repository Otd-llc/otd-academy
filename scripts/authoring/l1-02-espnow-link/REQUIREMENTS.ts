// L1.02 ESP-NOW link — REQUIREMENTS card.
//
// Authored from docs/boards/l1-02-espnow-link/{design.md,bom.csv,validation-log.md},
// with L1.01's REQUIREMENTS card as gospel for everything the two boards share
// (the ADC1-only rule, the antenna keep-out, the 5 V to 3.3 V chain, the
// promises-in-your-own-words note).
//
// This card was already close to the bar (31 blocks against 33). The pass adds
// the media the island rhythm was missing: the shared power-flow, ADC1 and
// keep-out diagrams L1.01 already ships, a first-hand current capture on the
// always-awake receiver, and a video slot. It also closes one real contradiction:
// the old prose banned SILKSCREEN from the antenna keep-out, while the merged
// LAYOUT card says silkscreen is harmless and copper is the problem. Espressif's
// integration rule is about conductor, so LAYOUT is right and this card now
// agrees with it.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Requirements: what the ESP-NOW pair has to do"),

  prose(
    "You already built the general-purpose L1.01 breakout. This board is that same proven core, stripped to a purpose: a **wireless node**. One [[ESP-NOW]] packet is the whole mission: press the button on node A, and the LED on node B lights. You build **two identical boards**, and the requirements below are really promises about the *pair*.",
  ),
  band("orient", "Decide what the pair must do", "Read this one. Nothing to build yet: you are settling the promises both boards keep. Everything here leans on L1.01; where a rule repeats, you get the one-line recall, then we move."),
  {
    type: "callout", severity: "info", label: "What carries over from L1.01",
    body: "Your bench, your KiCad setup, and most of this design. Every active part is the exact L1.01 part you already sourced and soldered: the [[KiCad starter]] and the [[exact BOM]] are provided as before. The new hardware surface is three items: a USER button, the LINK LED's new job, and one expansion header. The new *skill* is the radio.\n\nThe bench is unchanged, so nothing new to buy there: the temperature-controlled iron, **0.6 mm** rosin-core solder for the fine SMD joints and 0.8 mm for the bigger ones, flux, [[ESD]]-safe tweezers, a multimeter with a [[continuity]] beeper, and magnification. Two things do double. You need **two USB-C data cables** and **two power sources**, because the demo only proves anything with both nodes live at once. Order parts for two boards at BOM sourcing, not one.",
  },
  {
    type: "partModel", mpn: "ESP32-S3-WROOM-1-N16R2",
    caption: "U1 again: the WROOM's on-module PCB antenna carries the whole lesson this time",
  },

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "What you're building", "A pair of USB-C ESP-NOW nodes. Each has one USER button (press to send), one LINK LED (lights on receive), and an expansion header. The boards are identical; which one transmits is decided by the firmware you flash."),
  shot(
    "The whole lesson in one photo: press on A, light on B.",
    "Bench photo, two finished L1.02 nodes ~10 cm apart: finger on left board's USER button, right board's yellow LINK LED visibly lit. Both USB cables in frame. Dark neutral background.",
  ),
  prose(
    "Why two? [[ESP-NOW]] is peer-to-peer: there is no router, no access point, and no 'main' board. Both ends run the same radio, so the hardware is symmetric and only the firmware differs. Building the pair also doubles your assembly practice at almost no extra design cost, and this node is itself a building block: the L3 wireless fleet hub grows out of it.",
  ),
  table(
    ["Delta vs L1.01", "Pin", "Job"],
    [
      ["SW3 · USER button", "GPIO21", "Press to send a packet. Uses the chip's internal pull-up: no external resistor"],
      ["LED2 · LINK/RX", "GPIO47", "Lights when a packet arrives: the visible proof the link works"],
      ["J2 · expansion header", "5V / 3V3 / GND + spare GPIO", "One snapped-to-size row; exposes ADC1 pins so analog works while the radio runs"],
    ],
  ),
  check(
    "**Why are the two boards identical instead of one transmitter board and one receiver board?** ESP-NOW peers are symmetric: both radios can send and receive, so the role is set by the firmware you flash, and either board can play either part.",
  ),
  dive(
    "What ESP-NOW actually is",
    "[[ESP-NOW]] is Espressif's connectionless protocol riding the same 2.4 GHz Wi-Fi radio the chip already has. A normal Wi-Fi link spends seconds associating with an access point before any data moves. ESP-NOW skips all of it: a node writes application data into a vendor-specific Wi-Fi action frame and transmits it directly to a peer's [[MAC address]] on a shared channel. No association, no IP addresses, no router. The cost of that simplicity is scope: small payloads (up to 250 bytes per packet), best-effort delivery, and both peers must already know the channel and each other's MAC. For button-to-LED, sensor readings, and fleet control links, that trade is exactly right.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The link: MAC + channel", "Two numbers make the link work: the peer's MAC address (who to send to) and the shared Wi-Fi channel (where to listen). Both live in firmware; nothing on the board selects them."),
  prose(
    "Every WROOM module ships with a unique factory [[MAC address]], the radio's serial number. Node A sends *to* node B's MAC; node B accepts frames *from* peers it knows. Both radios must also sit on the same [[Wi-Fi channel]], one of the numbered 2.4 GHz slots. Channel mismatch is the classic silent failure: both boards run happily and nothing arrives. You will print each board's MAC over USB at bring-up and bake the pair into the firmware.",
  ),
  shot(
    "Addressed by MAC, carried on a shared channel, no router in the middle.",
    "Simple two-node diagram: node A and node B with short MAC labels, one arrow A to B labelled 'ESP-NOW frame · channel 1', a crossed-out router icon. Clean dark background, brand gold accents.",
  ),
  check(
    "**Node A transmits and node B never blinks, yet both boards passed bring-up. What are the first two suspects?** The peer MAC (is A sending to B's real address?) and the channel (are both radios on the same one?). Both are firmware settings, so no meter will find them.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "Power: same chain, new duty cycle", "The power chain is L1.01 verbatim: USB-C in, fuse, LDO, 3.3 V. What changes is how long the radio stays on."),
  prose(
    "A receiving node must keep its radio awake to hear packets, so it idles at roughly **80 to 100 mA**, all day. Transmit bursts still peak near **500 mA** for milliseconds, which the 600 mA [[LDO]] and the 10 µF [[bulk capacitor]] ride exactly as on L1.01. The always-awake draw has one practical upside: it sits above the auto-shutoff threshold of most USB power banks. Even so, the lesson recommends a **wall adapter or a PC port** for each node, because a bank that does time out will kill your receiver mid-demo and look exactly like a broken link.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/wroom-power-flow.svg",
    alt: "Power-flow block diagram: USB-C J1 to polyfuse F1 to RT9080 LDO U2 to the 3.3 V rail to the ESP32-S3 module U1, with the 10 uF bulk cap C1 on the rail.",
    caption: "The chain is unchanged from L1.01: USB-C in, through the fuse and the regulator, out to the module.",
  },
  shot(
    "What an always-awake receiver actually draws, measured at the cable.",
    "Inline USB power meter between wall adapter and an L1.02 node running the receiver firmware. Current reading legible, sitting in the 80 to 100 mA band. Board in soft focus behind.",
  ),
  check(
    "**Why does the receiving board draw a steady 80 to 100 mA even when nothing is being sent?** ESP-NOW reception rides the Wi-Fi radio, and a radio can only hear a packet while it is powered and listening. No deep sleep in this lesson.",
  ),
  dive(
    "The budget, re-proven with numbers",
    "The numbers are re-proven from the same datasheets rather than inherited on faith. Worst-case transmit peaks near 500 mA for a few milliseconds; typical operation sits at 80 to 160 mA. The RT9080 supplies 600 mA with a 0.53 V worst-case dropout, so even USB low-line at 4.75 V leaves 4.75 − 0.53 = 4.22 V of input headroom against a 3.3 V output: comfortable. Continuous worst case is about 0.27 W in the LDO, which lands its junction near 98 °C against a 125 °C limit. Brief 1 W transmit spikes are absorbed by thermal mass. Same parts, same margins, now proven for a radio that never sleeps.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Safe pins, by design", "One button and one LED sound trivial to place. The whole trick is which pins they avoid."),
  prose(
    "You met the dangerous pins on L1.01: the [[strapping pin|strapping pins]] (GPIO0, 3, 45, 46) that decide how the chip boots, and the fixed USB pair (GPIO19/20). The USER button lands on **GPIO21** and the LINK LED on **GPIO47** precisely because they are plain pins: no strap duty, no USB, no flash or PSRAM role, and neither burns an [[ADC1]] input. That last point matters here: [[ADC2]] is dead whenever the radio runs, and on this board the radio runs *always*, so the expansion header deliberately exposes ADC1 pins and nothing else analog.",
  ),
  table(
    ["Signal", "GPIO", "Why it's safe"],
    [
      ["USER / SEND", "GPIO21", "Plain GPIO: no strap, no USB, no ADC. Internal pull-up, button to GND"],
      ["LINK / RX LED", "GPIO47", "Plain digital out; free on the WROOM-1"],
      ["BOOT", "GPIO0", "A strapping pin on purpose: boot-mode select, as L1.01"],
      ["Native USB", "GPIO19 / 20", "The module's fixed D− / D+"],
      ["Expansion J2", "GPIO1, 2, 4, 5, 6 + spares", "ADC1 pins + power rails only; every used, strapping, and USB pin is excluded"],
    ],
  ),
  {
    type: "image",
    src: "/guide-diagrams/adc1-pin-map.svg",
    alt: "ADC pin map: GPIO 1 to 10 (ADC1) stay usable for analog input; GPIO 11 to 20 (ADC2) are claimed by the radio and read garbage while the radio is on.",
    caption: "Same rule as L1.01, with more bite: this board's radio never turns off, so ADC2 is never available.",
  },
  check(
    "**A colleague suggests moving the USER button to GPIO0 to save the third switch. What breaks?** GPIO0 is the BOOT strapping pin: holding the button through a reset would drop the chip into download mode instead of running your code. Buttons you press casually never belong on a strapping pin.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "warn", label: "05 · Don't hurt the radio, now for real",
    body: "On L1.01 the antenna keep-out protected a feature. Here the radio IS the lesson: copper under the antenna quietly shortens your link range, and no firmware setting recovers it.",
  },
  prose(
    "The promise is unchanged from L1.01, but its weight is different. The WROOM's printed antenna hangs past the board edge over an [[antenna keep-out]]: no copper, no traces, no [[ground pour]], and no parts beneath or beside it. The module is FCC/CE pre-certified *provided* that integration rule is honored, and this board's entire purpose travels through that antenna. You will draw the keep-out as a rule area at layout and verify it by eye before DRC, on both boards.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/antenna-keepout.svg",
    alt: "Top view of the WROOM module at the board edge: the antenna end overhangs the edge above a marked keep-out zone with no copper and no ground pour beneath it.",
    caption: "The keep-out: the one spot on this board where emptiness is the feature.",
  },
  check(
    "**Your nodes talk fine sitting 20 cm apart on the bench, then drop out across the room. What is the first hardware suspect?** Copper in the antenna keep-out. A detuned antenna still radiates enough to work at short range, so a weak link reads as a firmware bug right up until you look at the board.",
  ),
  gotcha(
    "the keep-out bans conductor, not ink",
    "Copper is the problem: traces, pours, pads, vias, and any part that sits in the antenna's near field. Silkscreen ink is not conductive and does no harm there. Ban the metal, and do not waste an afternoon moving a legend.",
  ),

  // ── the note ──────────────────────────────────────────────────────────────
  band("do", "in your notes · Write the pair's promises down", "Four short lines, your own words. Same discipline as L1.01: nothing uploads, which is exactly why writing it works."),
  does("Your requirements note", [
    {
      text: "**PAIR:** two identical boards; transmitter vs receiver is only the firmware flashed.",
      proof: "Your note says the boards are identical and the role lives in firmware.",
    },
    {
      text: "**LINK:** peers are addressed by MAC and must share a Wi-Fi channel; both are firmware settings.",
      proof: "Your note names the peer MAC and the shared channel as the two link settings.",
    },
    {
      text: "**POWER:** same 5 V to 3.3 V chain as L1.01, but the receiver keeps its radio awake at 80 to 100 mA; power from a wall adapter or PC port.",
      proof: "Your note records the always-awake receiver draw and the wall-or-PC power rule.",
    },
    {
      text: "**PINS + RADIO:** USER on GPIO21, LINK LED on GPIO47, ADC1-only on the header, and the antenna keep-out stays empty of copper.",
      proof: "Your note lists GPIO21, GPIO47, ADC1-only, and the empty keep-out.",
    },
  ]),
  {
    body: "Open a plain text file or a notebook page and write the pair's promises, one line each. Keep it visible while you build. Nothing uploads and no gate waits on it, which is exactly why it is worth doing: putting each promise in your own words is what makes it stick.",
    type: "callout", severity: "info", label: "How to use that note",
  },

  {
    type: "quiz",
    prompt: "Quick check: requirements",
    gate: true,
    questions: [
      {
        id: "espnow-what", reviewId: "espnow-what",
        q: "What is ESP-NOW, in one line?",
        options: [
          "A connectionless protocol that sends small packets directly between ESP32 radios, no router involved",
          "A Wi-Fi network created by the first board",
          "A faster version of Bluetooth",
        ],
        answer: 0,
        explain: "ESP-NOW rides the Wi-Fi radio but skips association entirely: peers exchange small frames directly, addressed by MAC.",
      },
      {
        id: "pair-symmetric", reviewId: "pair-symmetric",
        q: "Why are the two boards in this lesson identical?",
        options: [
          "The receiver needs more parts, but they fit the same layout",
          "ESP-NOW peers are symmetric, so the role is set by firmware, and either board can send or receive",
          "It is cheaper to make two of the same board",
        ],
        answer: 1,
        explain: "Both radios can transmit and receive. Hardware stays symmetric; the firmware you flash decides the role.",
      },
      {
        id: "link-settings",
        q: "Which two settings must be right before a packet from node A lights node B?",
        options: [
          "The LED resistor value and the USB cable length",
          "The boards' serial numbers and their flash sizes",
          "Node B's MAC address in node A's firmware, and a shared Wi-Fi channel",
        ],
        answer: 2,
        explain: "ESP-NOW addresses peers by MAC on a common channel. Both live in firmware, so no meter can check them.",
      },
      {
        id: "rx-awake",
        q: "The receiving node draws a steady 80 to 100 mA doing nothing. Why?",
        options: [
          "Its radio must stay awake and listening, or it would miss every packet",
          "The LINK LED draws it while off",
          "The LDO wastes that much as heat",
        ],
        answer: 0,
        explain: "Reception needs a powered, listening radio. That constant draw is the price of never missing a packet, and it also keeps most power banks awake.",
      },
      {
        id: "user-pin-choice",
        q: "Why does the USER button sit on GPIO21 rather than GPIO0?",
        options: [
          "GPIO21 is closer to the button's corner of the board",
          "GPIO0 is reserved for the LINK LED",
          "GPIO0 is a strapping pin: pressing the button through a reset would change the boot mode",
        ],
        answer: 2,
        explain: "GPIO21 has no strap, USB, or ADC duty. A casual button on strapping GPIO0 could drop the chip into download mode.",
      },
      {
        id: "adc1-header",
        q: "The expansion header exposes ADC1 pins and no ADC2 pins. What's the reason?",
        options: [
          "ADC1 pins are faster",
          "ADC2 is unusable while the radio runs, and this board's radio runs continuously",
          "ADC2 pins are all used by the LEDs",
        ],
        answer: 1,
        explain: "The Wi-Fi radio borrows ADC2's hardware. With ESP-NOW always on, only ADC1 inputs stay trustworthy, so only ADC1 reaches the header.",
      },
      {
        id: "keepout-weight", reviewId: "l102-antenna-keepout",
        q: "Copper strays into the antenna keep-out on one node. What do you see at bring-up?",
        options: [
          "Nothing at all: the keep-out only matters for certification paperwork",
          "The board refuses to enumerate over USB",
          "A link that works across the desk and gets unreliable across the room",
        ],
        answer: 2,
        explain: "Copper near the printed antenna detunes it, so less power leaves the board. Short range still works, which is what makes this look like a firmware problem.",
      },
    ],
  },

  exit(
    "You've pinned the pair's promises: identical boards with firmware roles, a MAC-plus-channel link, an always-awake receiver on wall or PC power, safe pins, and an antenna keep-out that now carries the whole lesson. The quick check above is the gate. Next: the BOM, which you have almost entirely already met, doubled for two boards.",
  ),

  ref("ESP-NOW API reference (Espressif, ESP-IDF): connectionless action frames, peers, and channels", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/network/esp_now.html"),
  ref("ESP32-S3 datasheet (Espressif): radio current profile and the ADC1 vs ADC2 split", "https://documentation.espressif.com/esp32-s3_datasheet_en.html"),
  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module pinout, factory MAC, antenna keep-out", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
  ref("ESP32-S3 hardware design guidelines (Espressif): module placement and antenna clearance", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/"),
];

publishCard({ slug: "l1-02-espnow-link", stage: "REQUIREMENTS", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
