// L1.02 ESP-NOW link — BRINGUP card.
//
// L1.01's BRINGUP card is gospel for the ladder itself: continuity before power,
// rails first, the TP1 diagnostic table, enumeration, and the BOOT/EN dance.
// Board facts from docs/boards/l1-02-espnow-link/design.md (E4 and RK8, the
// always-awake receiver at 80 to 100 mA; RK4 and RK7, channel and peer MAC as
// firmware-owned; RK5, the keep-out that range loss reports on).
//
// The card this replaces was 19 blocks against a 32 bar. Its ESP-NOW half was
// strong and stays; what it lacked was the per-board half, which it delegated
// with "the 4.9 V and 0 V diagnoses from L1.01 apply unchanged" instead of
// stating them. It also had ZERO mode bands against a bar of four.
//
// One correction: the old card blamed range loss on "copper or silk in the
// keep-out". Silkscreen ink is not conductive and the merged LAYOUT card says so.
// Fixed here to name copper, in both the Gotcha and the symptom table.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Bring-up: two boards alive, then the link test"),

  prose(
    "Bring-up happens twice, then a third time as a pair. Each board earns the L1.01 ladder on its own: no shorts, a healthy rail, an LED, enumeration, firmware. Only then does the radio enter the story, because a link test on an unproven board debugs two unknowns at once, and that is how demos die.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/bringup-ladder.svg",
    alt: "Diagram: five bring-up steps as a ladder (no shorts, 3.3 V rail, LED lit, enumerates, firmware runs), with a stop-and-fix rule if any step fails.",
    caption: "Bring-up is a ladder: five rungs, in order, and you stop the moment one fails. On this lesson you climb it twice.",
  },

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("check", "No shorts before power", "Verify. Prove each board is safe to power before either one is ever plugged in."),
  sect("01", "Each board alone: the L1.01 ladder", "Run the ladder you know on board A, then board B. Wall adapter or PC port, per the power promise."),
  prose(
    "With no power applied, run a [[continuity]] check between [[VBUS]] and GND. **It must not beep.** Red lead on the VBUS point (U2's input pad, or its input cap), black on TP2. Then confirm the grounds are tied together and that TP1 really sits on the 3V3 net.\n\nDo this on both boards. A solder bridge found with a meter costs you a minute; the same bridge found by plugging in costs you a module. You did this check once already at the end of assembly, and doing it again here costs nothing, which is the correct price for the only irreversible step in the lesson.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/continuity-vbus-gnd.svg",
    alt: "Diagram: meter in continuity mode, red probe on the VBUS point at U2's input, black probe on TP2; the display reads OL, so no beep means no short.",
    caption: "The pre-power check, per board: VBUS to GND must NOT beep.",
  },
  gotcha(
    "first power-on wants a charger, not your laptop",
    "That continuity check proved there is no short between VBUS and GND. It says nothing about the **data lines**. If a stray bridge tied VBUS to D+ or D−, the check stays silent, and plugging into your computer would push 5 V straight into the host's USB data pins, which expect 3.3 V, and can kill the port.\n\nSo for the **very first power-up of each board**, use a cheap USB wall charger or a hub you do not care about. If the rail and the power LED come up clean on the sacrificial source, then move to the computer to enumerate and flash. Power first, data second, twice.",
  ),

  band("do", "at the bench · Power each board and measure the rail", "Hands on. Trust the 3.3 V rail only after the meter agrees, on each board separately."),
  does("prove each board, solo", [
    {
      text: "**Rails:** power from a wall adapter or PC port; TP1 reads **3.3 V** against TP2, and **3.2 to 3.4 V** is healthy. LED1, the red power light, should be lit.",
      proof: "Both boards read about 3.3 V at TP1 with LED1 lit.",
    },
    {
      text: "**Glance at the current** if you have an inline USB meter. An idle node sits at a modest draw; a sudden spike is a fault worth chasing before you go further.",
      proof: "Neither board draws an alarming current at idle.",
    },
    {
      text: "**Enumerate:** each board shows up on the host over its USB-C. A known-good **data** cable, as always, because charge-only cables are the usual culprit.",
      proof: "Each board appears as a USB serial device when plugged in.",
    },
    {
      text: "**Flash check:** each board accepts firmware. If it will not enter download mode, do the dance: **hold BOOT, tap EN, release BOOT**.",
      proof: "Both boards take a test flash without error.",
    },
  ]),
  {
    type: "image",
    src: "/guide-diagrams/bringup-probe-points.svg",
    alt: "Diagram: board top view with a multimeter, the red probe on TP1 (3V3) and the black probe on TP2 (GND), the meter reading 3.30 V.",
    caption: "Probing the rail: red on TP1 (3V3), black on TP2 (GND). Expect 3.3 V.",
  },
  shot(
    "The rail check, board by board, before any radio work.",
    "Bench: red probe TP1, black TP2 on one powered L1.02 node, meter reading about 3.30 V, LED1 visibly lit. Crop to board and meter display.",
  ),
  {
    type: "table",
    columns: ["TP1 reads…", "Likely cause", "What to do"],
    rows: [
      [{ text: "~3.3 V", tone: "gold", decoration: "badge" }, { text: "The LDO is regulating" }, { text: "Healthy: move on to USB enumeration" }],
      [{ text: "~4.9 V", tone: "critical", decoration: "badge" }, { text: "U2 passing its input straight through (backwards, mis-soldered, or EN not high)" }, { text: "Stop: don't connect 3.3 V parts; recheck U2" }],
      [{ text: "0 V", tone: "critical", decoration: "badge" }, { text: "No power reaching it, or a short dragging it down" }, { text: "Check the USB power chain, then hunt for a short" }],
      [{ text: "~3.3 V, LED1 dark", tone: "blue", decoration: "badge" }, { text: "The LED or its resistor, not the rail" }, { text: "Check LED1's polarity and R5" }],
    ],
  },
  check(
    "**The board powers but TP1 reads 4.9 V, not 3.3.** What failed? Almost certainly U2: its output is sitting at the input voltage, so it is mis-soldered, mis-oriented, or its enable is not asserted. Stop before you connect 3.3 V logic to a 5 V rail.",
  ),
  dive(
    "Reading the rail voltage like a diagnostician",
    "The number on the meter at TP1 tells you where the fault is. A healthy 3.3 V means the [[LDO]] is regulating: move on. **4.9 V**, basically the USB input, means the regulator is not regulating at all and is passing its input straight through, so it is mis-oriented, mis-soldered, or its enable pin is not pulled high, and you must not connect 3.3 V parts to that rail. **0 V** means either no power is reaching it (a broken joint upstream) or something is dragging it down (a short). Around 3.3 V with LED1 dark points at the LED or its resistor rather than the rail.\n\nThe regulator also needs its input comfortably above 3.3 V plus its [[dropout voltage|dropout]] of 0.53 V, so a sagging cable can starve it. Measure the input too whenever the output looks low.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Read each board's identity", "Hands on. The pairing step: each radio's factory MAC comes out over the USB console, and the firmware needs its peer's."),
  sect("02", "Identity: read each board's MAC", "Two flashes, two console reads, two pieces of tape. Get this wrong and everything runs while nothing arrives."),
  prose(
    "Flash the lesson's **identity firmware** to each board in turn: it prints the module's factory [[MAC address]] over the USB console. Label the boards **A** and **B** with tape and write each MAC on its label. The send firmware needs the *other* board's MAC (the peer it transmits to), and both firmwares pin the same [[Wi-Fi channel]]. Mixing the MACs up produces the classic silence: everything runs, nothing arrives.",
  ),
  does("collect the pair's identities", [
    { text: "Flash the identity firmware to board A; open the serial console; write the printed MAC on board A's tape label.", proof: "Board A wears its own MAC on a label." },
    { text: "Repeat for board B. Do it now, while both boards are on the bench: a MAC read later, off an unlabelled board, is a MAC you will re-read.", proof: "Board B wears its own MAC on a label." },
    { text: "In the lesson firmware's config, set **A's peer = B's MAC** and **B's peer = A's MAC**, and confirm both use the same channel constant.", proof: "Each config carries the other board's MAC and one shared channel." },
  ]),
  shot(
    "The MAC arriving over the same USB-C cable that powers and flashes the board.",
    "Host screen: serial console showing the identity firmware's printed MAC address line, legible at card width. Board visible in the background if possible.",
  ),
  shot(
    "Tape, a marker, and two MACs. The least technical step that decides whether the link works.",
    "Bench macro: both L1.02 boards with tape labels reading A and B plus their MAC addresses, marker in frame.",
  ),
  check(
    "**Whose MAC goes into board A's firmware?** Board B's. A packet is addressed to its destination, so each sender carries its peer's address, never its own.",
  ),
  dive(
    "Why a MAC and a channel, and nothing else",
    "ESP-NOW has no association step, so there is no handshake to go wrong and no router to configure. What replaces all of that is two constants each node has to be told: **who** (the peer's 6-byte MAC address, which the module carries from the factory and never changes) and **where** (the 2.4 GHz channel both radios sit on).\n\nThat is the whole configuration surface, which is why the failure mode is so quiet. A wrong MAC means frames go out addressed to a device that is not there. A wrong channel means they go out on a frequency nobody is listening to. In both cases every board is working correctly and nothing arrives, so no meter, LED or console message will point at it. Diffing the two configs is the diagnostic.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The link test", "The payoff. One board flashed as sender, one as receiver, and a button press that crosses the room."),
  does("light the LED across the air", [
    { text: "Flash **sender** firmware to A and **receiver** to B (a build flag: the boards are identical). Power both.", proof: "A runs sender firmware, B runs receiver, both powered." },
    { text: "**Press A's USER button.** B's LINK LED lights. That is an ESP-NOW frame, addressed to B's MAC, crossing on your shared channel.", proof: "A press on A lights the LINK LED on B." },
    { text: "**Swap the roles** (flash receiver to A, sender to B) and repeat. Symmetry proven: either board plays either part.", proof: "After the swap, a press on B lights A." },
    { text: "Walk apart while pressing. Note roughly where the link starts dropping: that range is your antenna keep-out doing its job.", proof: "You know the pair's comfortable range in your space." },
  ]),
  shot(
    "The lesson, working: press here, light there, nothing in between.",
    "Bench: node A foreground with finger on USER button, node B about 50 cm back with the yellow LINK LED clearly lit. Focus on B's LED. Both boards' antennas visible.",
  ),
  tube("Flash both boards and run the link test"),
  gotcha(
    "a dead link usually isn't the radio",
    "Both boards healthy and no light? Work the list before blaming hardware: the **same channel** on both firmwares; each config carrying the **other** board's MAC; the receiver actually running receiver firmware; a power bank that quietly slept. The radio itself, behind a clean keep-out, is the least likely suspect on a board that already enumerated and flashed.",
  ),
  {
    type: "table",
    columns: ["Symptom", "Likely cause", "What to do"],
    rows: [
      [{ text: "No light, both boards run" }, { text: "Channel mismatch or wrong peer MAC" }, { text: "Diff both configs: one channel, each carrying the other's MAC" }],
      [{ text: "Worked, then stopped" }, { text: "A power bank auto-slept" }, { text: "Wall adapter or PC port, per the power promise" }],
      [{ text: "Only works within arm's reach" }, { text: "Detuned antenna: copper in the keep-out, or the module not overhanging the outline" }, { text: "Inspect the keep-out on every copper layer; range loss is the tell" }],
      [{ text: "Sender's own LED blinks, receiver silent" }, { text: "Roles swapped or receiver never flashed" }, { text: "Confirm which firmware each board actually runs" }],
    ],
  },
  check(
    "**The link dies at two metres but works at twenty centimetres. Is that a configuration problem?** No. Addressing failures are absolute: a wrong MAC or channel means nothing arrives at any distance. A link that works close and fails far is the antenna, which means copper in the keep-out or a module that does not overhang the board outline.",
  ),

  // ── the log ───────────────────────────────────────────────────────────────
  band("check", "What success looks like", "Verify. Six proofs, in order, that the pair is alive. Log the build only when all six hold."),
  trace("the six proofs the pair is alive", [
    { text: "**No VBUS-to-GND short**, either board.", help: "The silent meter, per board, before first power." },
    { text: "**TP1 reads about 3.3 V**, either board.", help: "3.2 to 3.4 against TP2. Outside that band the rail is the problem, not the firmware." },
    { text: "**Both boards enumerate** over USB.", help: "A new serial device per board. A charge-only cable is the usual reason one does not." },
    { text: "**Each board's MAC is known** and labelled.", help: "Tape on the board, MAC in the peer's config." },
    { text: "**A press on A lights B.**", help: "The frame crossed: addressing, channel, and radio all proven at once." },
    { text: "**The swap works too.**", help: "Roles are firmware; the hardware pair is symmetric. This is the requirements card's first promise, demonstrated." },
  ]),
  shot(
    "Both nodes logged: two live boards, two labels, one working link.",
    "Bench overhead: both finished L1.02 nodes with their A and B MAC labels, both powered, B's LINK LED lit. Dark neutral background.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: bring-up",
    gate: true,
    questions: [
      {
        id: "solo-before-pair",
        q: "Why bring each board up alone before any link test?",
        options: [
          "The receiver drains too much power during solo tests",
          "The link test needs both boards' MACs first",
          "A failed link on unproven boards debugs two unknowns at once; solo bring-up removes the board as a suspect",
        ],
        answer: 2,
        explain: "Rails, USB, and flash get proven per board on the L1.01 ladder. Then a dead link can only be firmware config or the radio.",
      },
      {
        id: "peer-mac", reviewId: "peer-mac",
        q: "Board A's firmware config needs a MAC address. Whose?",
        options: [
          "Either works",
          "Board B's: packets are addressed to their destination",
          "Board A's own",
        ],
        answer: 1,
        explain: "Each sender carries its peer's address. Writing a board's own MAC into its config is the classic silent-link mistake.",
      },
      {
        id: "channel-match", reviewId: "channel-match",
        q: "Both boards run happily; nothing ever arrives. The single most likely config culprit?",
        options: [
          "The LDO",
          "A Wi-Fi channel mismatch: both radios must listen on the same one",
          "USB cable quality",
        ],
        answer: 1,
        explain: "Channel mismatch fails silently by design: each radio works, on its own frequency. Diff the configs first.",
      },
      {
        id: "ldo-passthrough", reviewId: "ldo-passthrough",
        q: "TP1 reads 4.9 V instead of 3.3 V. What does that point to?",
        options: [
          "That's normal: the rail sits near 5 V under light load",
          "Everything's fine",
          "The regulator isn't regulating: it's passing the input straight through",
        ],
        answer: 2,
        explain: "4.9 V is basically the USB input, so U2 is mis-soldered, backwards, or not enabled. Do not connect 3.3 V parts to it.",
      },
      {
        id: "role-swap",
        q: "What does swapping the firmwares (receiver to A, sender to B) prove?",
        options: [
          "The USB cables are good",
          "The channel is correct",
          "The hardware pair is symmetric: the role really does live in firmware",
        ],
        answer: 2,
        explain: "Identical boards should play either part. The swap is the requirements card's first promise, demonstrated.",
      },
      {
        id: "range-tell",
        q: "The link only works within arm's reach. What does that symptom point at?",
        options: [
          "A detuned antenna: something conductive ended up in the keep-out",
          "The wrong MAC",
          "A slow USB port",
        ],
        answer: 0,
        explain: "Addressing failures are absolute, so nothing would arrive at any range. Range collapse is the antenna's signature, and the keep-out inspection is the fix.",
      },
      {
        id: "powerbank-sleep",
        q: "The demo worked for five minutes, then the receiver went dark. First suspect?",
        options: [
          "A USB power bank auto-slept under the light load",
          "The PTC fuse tripped",
          "The firmware crashed",
        ],
        answer: 0,
        explain: "The receiver's 80 to 100 mA usually keeps banks awake, but not all of them. The lesson's power promise exists for this moment: wall or PC.",
      },
      {
        id: "identity-first",
        q: "Why flash identity firmware before the sender and receiver firmwares?",
        options: [
          "It erases the flash properly",
          "Each board must print its factory MAC so the peer's config can carry it",
          "It calibrates the radio",
        ],
        answer: 1,
        explain: "Pairing needs both addresses known up front. Read them once, label the boards, and the send configs write themselves.",
      },
    ],
  },

  exit(
    "Six proofs held: two live boards, two known identities, a press that crosses the air, and a swap that proves the symmetry. Capture the bring-up log and mark each board BROUGHT_UP, or QUARANTINED if one of them is not there yet. You built a wireless link from parts, twice.",
  ),

  ref("ESP-NOW API reference (Espressif, ESP-IDF): peers, channels, and send/receive callbacks", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/network/esp_now.html"),
  ref("ESP-IDF Programming Guide (Espressif): flashing the ESP32-S3 over native USB, and the reset into download mode", "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/flashing-troubleshooting.html"),
  ref("esptool (Espressif): the tool that writes firmware to the ESP32-S3 flash", "https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/flashing-firmware.html"),
];

publishCard({ slug: "l1-02-espnow-link", stage: "BRINGUP", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
