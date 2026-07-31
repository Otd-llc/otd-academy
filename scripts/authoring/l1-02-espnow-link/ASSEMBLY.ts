// L1.02 ESP-NOW link — ASSEMBLY card.
//
// L1.01's ASSEMBLY card is gospel for every technique: heavy parts first on the
// bare board, the iron-vs-hot-air fork, one passive at a time, flux and
// drag-soldering, magnified inspection, and the VBUS-to-GND continuity gate
// before any power. Part facts from docs/boards/l1-02-espnow-link/bom.csv (three
// identical B3F-1000 buttons, a red LED1 and a yellow LED2, a red TP1 and a
// black TP2, the 40-pin breakaway J2 stick).
//
// The card this replaces was 12 blocks against a 40 bar, and it said so out
// loud: "the full technique walkthrough lives in the L1.01 ASSEMBLY card; this
// card assumes it." That is a link, not a lesson, and it fails the density rule.
// The board-specific contribution, batch passes across the pair, is kept and
// promoted; everything a learner needs to hold an iron is now on this page.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Assembly: building the pair in batch passes"),

  prose(
    "Everything you learned assembling L1.01 applies twice. Each node is **25 placements**, so the pair is 50, and the efficient way through them is **batch passes**: do each pass on *both* boards while the bench is set for it. Flux out and iron hot? Drag both boards' module rows. Through-hole jig set up? Seat both boards' buttons. You finish two boards in far less than twice the time, and the second board comes out better than the first, every time.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("orient", "The build order", "Read this before you melt anything: the order is the whole game."),
  sect("01", "Order of operations", "The hardest parts go down first, on the bare board: U1 and J1, then the passives, then the through-hole parts."),
  prose(
    "Solder **U1** (the module) and **J1** (the USB-C connector) first, on the bare board. Both are the joints that want the most heat and the most room for your iron, and a bare board gives you both. Do them after the passives and every rework move risks knocking an 0805 loose or cooking a part twice.\n\nThen the passives, one at a time. Then the through-hole parts last, because a board with buttons and a header sticking out of it no longer lies flat.",
  ),
  {
    type: "partModel", mpn: "ESP32-S3-WROOM-1-N16R2",
    caption: "U1: castellated edge pads, drag-solderable with an iron. It goes down first, on the bare board",
  },
  shot(
    "Pass 1, only the hard parts: U1 and J1 on both bare boards.",
    "Bench overhead: two bare L1.02 boards, each with U1 and J1 soldered and every other pad still empty. Tilt slightly so the castellated joints catch the light.",
  ),
  shot(
    "Pass 2: the passives added, one at a time with the iron.",
    "Same two boards after the 0805 pass: every resistor and capacitor placed, through-hole holes still empty. Overhead, pads legible.",
  ),
  shot(
    "Pass 3, the through-hole parts fitted: three buttons, the snapped header, two test points.",
    "Same two finished L1.02 boards: three buttons, the 12-pin J2 row, red TP1 and black TP2 seated on each. Overhead, slight tilt.",
  ),
  does("batch passes across the pair", [
    {
      text: "**Pass 1, modules:** position, tack, and drag-solder U1 on board A, then immediately board B while the flux and iron are set. Inspect both rows under magnification before moving on.",
      proof: "Both boards carry a soldered, inspected U1 with no bridges.",
    },
    {
      text: "**Pass 2, USB-C:** J1's retention tabs first, then the contact row, board A then board B.",
      proof: "Both J1s are anchored through their tabs and dragged clean.",
    },
    {
      text: "**Pass 3, passives:** one at a time with the iron, both boards. Tin one pad, slide the part in, solder the far pad.",
      proof: "Every 0805 on both boards sits flat with two shiny joints.",
    },
    {
      text: "**Snap the headers:** score-snap two 12-pin J2 rows off the 40-pin stick. One stick covers the pair with 16 pins left over.",
      proof: "Two clean 12-pin J2 rows are snapped to length.",
    },
    {
      text: "**Pass 4, through-hole:** three buttons, J2, and both test points per board. One pin first, check the part sits flat, then the rest.",
      proof: "All through-hole parts sit flat and soldered on both boards.",
    },
  ]),
  shot(
    "Batch passes: the pair moves through each stage together.",
    "Bench overhead: both L1.02 boards side by side after pass 2 (U1 and J1 down, passive pads empty), flux and iron in frame. Tilt slightly; pads legible.",
  ),
  check(
    "**Why solder the WROOM module before the 0805 resistors?** The hardest joints get the bare board and your full attention. Rework near placed passives knocks them loose, and every part you reheat twice is a part you have cooked twice.",
  ),
  check(
    "**Why batch each pass across both boards instead of finishing board A completely first?** Setup dominates: flux out, iron at temperature, the right tip fitted. Doing each pass twice while the bench is configured for it halves the overhead, and board B benefits from board A's practice.",
  ),
  dive(
    "Why the heavy parts go down first",
    "Two reasons, and they compound. The first is access: U1's castellated pads run along the module edge and J1's contacts sit in a tight row, and both want an iron tip coming in at a shallow angle with nothing in the way. An 0805 parked 2 mm away is exactly the thing in the way.\n\nThe second is thermal history. Every joint you reheat ages the part and the pad a little. If the hard parts go last, every fix and every drag pass happens over a board full of finished work, and you end up reflowing small parts you had already got right. Hard first means each part sees the iron about once.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Solder it, heavy parts first", "Bench time. U1 and J1 first with the iron, then the rest. The hot-air alternative is below if you have a station."),
  {
    type: "callout", severity: "critical", label: "Warning · a soldering iron never looks hot",
    reason: "Safety: read before you heat anything",
    body: "A soldering iron sits at roughly **340 °C** and never looks hot. It burns instantly, so it goes back in the stand every single time you put it down. Hot air scorches whatever it points at, including your other hand. Work over a heat-resistant mat, run a fan to clear flux fumes, wear eye protection when you clip leads, and wash your hands afterwards.\n\nTwo boards means twice the time at temperature. Stay deliberate, and stop when you get tired: the joints show it before you notice it.",
  },
  sect("02", "The modules and the connectors", "The two hardest joints on the board, done twice, while the boards are still bare."),
  prose(
    "U1 lands on castellated edge pads, which is the friendliest fine-pitch package there is: the pad wraps around the module edge, so your iron touches metal you can actually see. J1 is harder. Its contacts are surface-mount and its **through-hole solder-retention posts** are what physically anchor it, which is why those go first.",
  ),
  does("solder U1 and J1 with the iron", [
    { text: "**Flux the pads generously.** No-clean liquid flux, straight from the dropper along the row. Flux is what makes solder go where you want and skip where you do not.", proof: "A visible film of flux sits along the whole pad row." },
    { text: "**Position U1 and tack one corner pad.** Get the module square against the silkscreen outline first, then tack. Check the alignment before you commit; reheating one corner to nudge it is cheap, moving it after ten joints is not.", proof: "U1 sits square on its outline, held by one tacked corner." },
    { text: "**Tack the opposite corner**, then drag-solder each row (technique in island 04). Work one edge at a time and let the board cool between edges.", proof: "Every castellated pad on U1 carries a fillet and no two are bridged." },
    { text: "**J1's retention posts first.** Fill the through-holes so the connector cannot shift, then do the contact row. A USB-C receptacle takes real force every time you plug in, and the posts are what carries it.", proof: "J1's tab holes are filled and the connector does not move under thumb pressure." },
    { text: "**Repeat both on board B** before you change anything on the bench. Same flux, same tip, same temperature.", proof: "Both boards carry a finished U1 and J1." },
  ]),
  gotcha(
    "J1's tabs are the anchor, not decoration",
    "The retention posts do two jobs: they hold the connector square while you solder the contacts, and they take the mechanical load of every cable insertion for the life of the board. Skip them and the first firm plug-in tears the contacts off the pads, on a board you cannot power any other way.",
  ),
  tube("Solder the board: heavy parts, passives, and a drag-solder pass (plus the hot-air option)"),
  {
    type: "callout", severity: "info", label: "Alternative · have hot air? Reflow them instead",
    body: "Same order, different heat. If you own a hot-air station, U1 and J1 can be pasted and reflowed rather than dragged. It is faster across a pair and the joints under the module come out more uniform. Everything after this island is iron work either way.",
  },
  shot(
    "How much paste 'a small dab' actually is: less than you think.",
    "Macro shot of a syringe laying a thin paste bead on one row of L1.02 pads, next to an over-pasted row for comparison. Pads legible at card width.",
  ),
  does("paste and reflow U1 and J1", [
    { text: "Lay a **thin** bead of SAC305 paste along each pad row. Paste collapses to far less metal than it looks like wet, and too much is what bridges.", proof: "Each pad carries a thin bead, not a mound." },
    { text: "Place the part with tweezers and get it square. Surface tension will pull it into final alignment as the paste melts, but only from close.", proof: "The part sits square on its outline before any heat." },
    { text: "Bring hot air in from above at a moderate flow, moving constantly. Watch for the moment the paste turns from grey and grainy to bright and liquid: that is reflow, and it is your cue to stop.", proof: "The paste has visibly gone shiny and the part has settled onto the pads." },
    { text: "Let it cool untouched. Then do board B, and inspect both under magnification.", proof: "Both boards' modules and connectors are reflowed and inspected." },
  ]),
  shot(
    "Hot-air reflow: paste turns shiny and the part settles onto the pads.",
    "Close shot mid-reflow on an L1.02 board: hot-air nozzle above U1, paste visibly gone bright and liquid along the castellated row.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "Iron the passives, then the through-hole parts", "U1 and J1 are down. Now the iron does the rest: passives one at a time, through-hole last."),
  does("solder one passive at a time", [
    { text: "**Tin one pad** of the pair with a small amount of solder. One pad, not both.", proof: "One pad of the pair carries a small solder bump." },
    { text: "**Hold the part with tweezers**, reheat that tinned pad, and slide the part in until it sits flat and centred. Remove the iron and let it set before you let go.", proof: "The part sits flat and centred, held by one joint." },
    { text: "**Solder the far pad** properly: iron on the pad and the part's end cap together, feed solder into the joint rather than onto the tip.", proof: "The far pad carries a shiny concave fillet." },
    { text: "**Go back and redo the first joint.** The tacking joint is almost never a good one. Add flux and a touch of solder.", proof: "Both ends of the part carry a proper fillet." },
    { text: "Do the same part on board B, then move to the next value. Working by value across both boards keeps you from misreading a 470 Ω for a 5.1 kΩ.", proof: "Each value is placed on both boards before the next value is opened." },
  ]),
  does("snap the header, then the through-hole parts", [
    { text: "**Snap two 12-pin rows** from the 40-pin stick: grip close to the score line and bend. A clean snap leaves the end pins intact on both pieces.", proof: "Two 12-pin rows are snapped clean, with 16 pins left on the stick." },
    { text: "**Buttons:** all three are the same Omron B3F-1000 with the same ivory plunger, so the **silkscreen is the only thing telling EN from BOOT from USER**. Seat each one flat, solder one leg, check it is not tilted, then do the rest.", proof: "Three buttons sit flat on each board, each over its labelled outline." },
    { text: "**J2:** seat the row, solder one end pin, check the row is square to the board edge, then solder the rest.", proof: "J2 sits square and flush on both boards." },
    { text: "**Test points:** the **red 5010 goes on 3V3** and the **black 5011 goes on GND**. They are colour-coded for bring-up, so swapping them makes every later measurement confusing.", proof: "Red TP1 sits on the 3V3 pad and black TP2 on the GND pad, on both boards." },
  ]),
  shot(
    "Two 12-pin rows snapped from one 40-pin stick, ready to seat.",
    "Macro: a 1x40 breakaway header with two 12-pin rows snapped off and laid beside the remainder, on a bench mat. Score lines visible.",
  ),
  check(
    "**A resistor sits tilted up on a solder blob instead of flat. Fix?** Reheat the tinned pad while pressing the part gently down with tweezers until it settles, then redo both joints. Adding more solder on top of a tilted part never levels it.",
  ),
  gotcha(
    "LED1 is red and LED2 is yellow, and both have a polarity",
    "Two ways to get this wrong and only one of them is obvious. Swap the colours and the board still works, with a yellow power light and a red link light, which will quietly confuse every photo and every instruction after this. Fit either one backwards and it simply stays dark forever, because an LED conducts one way only. Check the cathode mark against the silkscreen before you solder the second leg.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Flux and drag-soldering", "Flux is the difference between a bridge and a clean joint."),
  prose(
    "Drag-soldering is the technique for U1's rows and J1's contacts, and for rescuing any row that came out bridged. The idea sounds wrong the first time: you deliberately drag a bead of molten solder across several pins at once and let surface tension sort it out. Flux is what makes that work.",
  ),
  does("drag-solder a row", [
    { text: "**Flood the row with flux.** More than feels necessary. This is the whole trick, and a dry row is what bridges.", proof: "The row is visibly wet with flux before any heat." },
    { text: "**Load a small bead of solder** onto the tip. A chisel tip works best; a fine conical tip carries too little.", proof: "A small bead sits on the tip, not a dangling blob." },
    { text: "**Drag slowly along the row**, tip in contact with both the pads and the pins, moving at about a pin per second.", proof: "The bead moves with the tip and leaves fillets behind it." },
    { text: "**Lift at the end of the row**, not in the middle. Lifting mid-row is what leaves a bridge behind.", proof: "The pass ended past the last pin." },
    { text: "**Inspect under magnification, add flux, and drag again** if anything bridged. A second dragged pass with fresh flux clears most bridges without wick.", proof: "No bridge survives between any two adjacent pins." },
  ]),
  check(
    "**Your drag pass leaves a bridge between two pins. First move?** More flux and a clean dragged pass, not solder wick. Wick is the cleanup of last resort and it lifts heat into pads that have already had enough.",
  ),
  dive(
    "Why dragging molten solder doesn't bridge every pin",
    "Molten solder minimises its surface area, so it prefers to sit on metal it wets (the tinned pad and the pin) rather than to span the gap between two pads. Flux is what keeps those surfaces wettable by stripping the thin oxide that forms the instant metal gets hot.\n\nWith enough flux, the bead you drag along the row gets pulled onto each pad in turn and released as the tip moves on. Without it, the oxide stops the solder wetting the pads properly, so the bead stays a bead and bridges whatever it touches. That is why the fix for a bridge is almost always more flux rather than more skill.",
  ),
  shot(
    "Bridge versus clean: what to look for under magnification.",
    "Magnified side-by-side on an L1.02 board: one bridged pair of module pads and one clean row with individual fillets. Both legible at card width.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  band("check", "Inspect, then continuity", "Verify. Hunt for bridges under magnification, then prove no [[VBUS]] to GND short before any power reaches either board."),
  sect("05", "Screen, then continuity, per board", "Every check from L1.01, on each board separately. A pair is only as good as its worse member."),
  prose(
    "Under magnification, hunt for solder bridges and [[tombstoning]] (a passive stood up on one end because one joint reflowed before the other). Then take the meter to it. The gate is the same one you met on L1.01: **VBUS to GND must not beep**. A short there turns your first power-up into a dead node or a hot regulator, and here you would do it twice.",
  ),
  shot(
    "Tombstoning: one joint reflowed before the other and stood the part on end.",
    "Magnified shot of a tombstoned 0805 on a practice board beside a correctly seated one. Both legible at card width.",
  ),
  shot(
    "Aim for the shiny concave fillet on the left. Dull and blobby means reheat.",
    "Magnified side-by-side of a good concave solder fillet and a starved or cold joint on an 0805. Both legible at card width.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/continuity-vbus-gnd.svg",
    alt: "A multimeter in continuity mode across VBUS and GND on an unpowered board: silence means no short, a beep means stop and find the bridge.",
    caption: "The POST_ASSEMBLY_CONTINUITY gate: VBUS to GND must stay silent, on every board, before any power.",
  },
  does("screen both boards before any power", [
    { text: "Under magnification: bridges, tombstoning, starved joints, on board A and then board B. Fix what you find while the bench is still hot.", proof: "Both boards pass visual inspection under magnification." },
    { text: "**Board unpowered**, meter in [[continuity]] mode: confirm the grounds are tied (TP2 to any GND pad beeps) and the 3V3 rail reaches TP1.", proof: "Grounds beep together and TP1 sits on the 3V3 net, on both boards." },
    { text: "The gate: **no beep between VBUS and GND**. Silence is the pass. Repeat on the second board rather than assuming.", proof: "Both boards show no VBUS-to-GND continuity." },
  ]),
  trace("Per board, before either one sees power", [
    { text: "No beep between VBUS and GND", help: "This is the gate. A beep means a bridge, usually at J1 or under U1, and powering it anyway is how a regulator dies." },
    { text: "No beep between 3V3 and GND", help: "A short on the regulated rail is the same problem one stage downstream. Check the decoupling caps and U2 first." },
    { text: "Every 0805 sits flat with two fillets, none tombstoned", help: "A tombstoned cap is an open circuit that looks placed. Under the loupe it is unmistakable; from above it is not." },
    { text: "All three buttons are over their labelled outlines", help: "The plungers are identical, so a swapped pair only shows up when EN does what USER should have." },
    { text: "Red test point on 3V3, black on GND, on both boards", help: "Swap them and every measurement instruction in the next card points at the wrong loop." },
  ]),
  check(
    "**Your meter beeps continuity between VBUS and GND before power-on. Power it anyway?** Never. That beep is a short between the incoming 5 V and ground. Find it under magnification, clear it, and re-check before anything gets plugged in.",
  ),
  shot(
    "Two finished nodes, inspected and silent on the meter, ready for first power.",
    "Bench overhead: both completed L1.02 boards side by side, fully populated, with a multimeter in frame. Dark neutral background.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: assembly",
    gate: true,
    questions: [
      {
        id: "batch-passes", reviewId: "l102-batch-passes",
        q: "The efficient way to hand-build two identical boards?",
        options: [
          "Solder both boards' parts simultaneously with two irons",
          "Finish board A completely, then start board B",
          "Each pass on both boards while the bench is set for it: modules, then connectors, then passives, then through-hole",
        ],
        answer: 2,
        explain: "Setup time dominates hand assembly. Batching each pass across the pair halves the overhead and the second board rides the first's practice.",
      },
      {
        id: "order-recall",
        q: "Which parts go down first, from L1.01 memory?",
        options: [
          "U1 and J1, the heat-hungry parts, on the bare board",
          "The through-hole buttons, to anchor the board",
          "The passives, to get them out of the way",
        ],
        answer: 0,
        explain: "Hard joints want the bare board and your full attention, and rework near placed passives knocks them loose.",
      },
      {
        id: "drag-bridge-fix",
        q: "A drag-solder pass leaves two module pads bridged. What do you reach for first?",
        options: [
          "Solder wick, straight away",
          "More flux and a second dragged pass",
          "A knife to cut the bridge",
        ],
        answer: 1,
        explain: "Flux is what lets molten solder wet the pads instead of spanning them. Wick is the cleanup of last resort and it puts more heat into pads that have had enough.",
      },
      {
        id: "snap-technique",
        q: "How do you get two J2 rows from the 1x40 breakaway stick?",
        options: [
          "Desolder pins you don't need afterwards",
          "Cut it with side cutters mid-pin",
          "Snap at the score lines: grip close and bend, leaving the end pins intact",
        ],
        answer: 2,
        explain: "Breakaway headers are scored between positions. A clean bend at the score gives a straight row and keeps both neighbouring pins usable.",
      },
      {
        id: "continuity-per-board", reviewId: "continuity-per-board",
        q: "Board A passes the VBUS-to-GND continuity check. Do you power board B without checking it?",
        options: [
          "Only if board B looks clean",
          "Yes: identical boards, identical result",
          "No: every board earns its own check; a bridge is a per-board accident, and the check costs a minute",
        ],
        answer: 2,
        explain: "Solder bridges are random per-board events. The gate is per board, and a minute with the meter beats a dead node.",
      },
      {
        id: "second-board-better",
        q: "Which board of the pair usually comes out cleaner?",
        options: [
          "Board B: every pass rides the practice of board A minutes earlier",
          "Board A: you were fresher",
          "They come out identical",
        ],
        answer: 0,
        explain: "Immediate repetition is the best practice there is. Expect visibly better joints on the second pass of every stage.",
      },
    ],
  },

  exit(
    "Two assembled nodes, both visually inspected, both silent on the VBUS-to-GND check. Pass the build's POST_ASSEMBLY_CONTINUITY checklist, every item checked or marked N/A, then bring the pair up.",
  ),

  ref("IPC-A-610 Acceptability of Electronic Assemblies (IPC): the joint-quality reference", "https://webstore.ansi.org/preview-pages/ipc/preview_ipc-a-610h.pdf"),
  ref("ESP32-S3-WROOM-1 datasheet (Espressif): module dimensions and the castellated pad layout", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"),
];

publishCard({ slug: "l1-02-espnow-link", stage: "ASSEMBLY", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
