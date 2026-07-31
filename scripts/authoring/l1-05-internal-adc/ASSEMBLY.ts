// L1.05 internal ADC — ASSEMBLY card.
//
// Authored ahead of the board, with L1.01's ASSEMBLY card as gospel for the
// whole method: the three-pass order (U1 and J1 on the bare board, then the
// 0805 field one at a time, then through-hole), the iron at about 340 C in
// SAC305, flux and the drag pass at roughly 3 mm/sec, the magnified screen for
// bridges and tombstoning, and the POST_ASSEMBLY_CONTINUITY gate whose one
// non-negotiable is no VBUS-to-GND beep before power.
//
// Board-specific: RV1 joins the through-hole pass, and the pre-power screen
// gains one check no other board in the series has, an ohmmeter sweep of the
// wiper, because a scratchy pot would masquerade as ADC noise later.
//
// CORRECTION carried deliberately: the previous card taught "D2's cathode band
// must match silk" as this board's one orientation trap. D2 is a CDSOD323-T05C,
// a SINGLE-LINE BIDIRECTIONAL suppressor with no electrical polarity
// (design.md section 4 and section 6; Bourns CDSOD323-TxxC datasheet). Its
// silk dot is an assembly-consistency mark. The parts on this board where
// direction really is function are the LEDs and the ICs.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Assembly: building the analog board by hand"),

  prose(
    "Assembly rewards patience and a plan. The parts go down in a deliberate order, every joint gets flux, and you inspect the board before you ever apply power. Rush the order and you will spend longer reworking than you saved.\n\nNothing about this board's technique is new. What is new sits at the end: before power reaches anything, you put a meter on RV1 and turn it, because a scratchy wiper would show up later as ADC noise and you would spend an evening blaming the converter.",
  ),

  band("orient", "The build order", "Read this before you melt anything. The order is the whole game, and it is the same order as every board so far."),

  // ── 01 ────────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "critical", label: "01 · Order of operations",
    body: "The hardest parts go down first, on the bare board: **U1 and J1**. Then the 0805 field and the small discretes. Then the through-hole parts, **RV1 and J4 included**. Trickiest joints first, tall parts last.",
  },
  prose(
    "Solder **U1** (the module) and **J1** (the USB-C connector) first, on the bare board. Both are this board's hardest jobs and both were chosen to be iron-solderable: the module connects through castellated edge pads you drag-solder, and the connector holds itself still with through-board retention tabs while you work its pin row. Give them an empty board and your full attention.\n\nThen iron-solder the 0805 passives and the small discretes, **D2 among them**. Finally fit the through-hole parts: the buttons, the headers, the test points, **J4**, and **RV1**. Using hot air instead? The order stops being a preference, because hot-air rework for U1 or J1 blows freshly-placed 0805s off the board.",
  ),
  shot(
    "Pass 1, only the hard parts: U1 and J1 on a bare board.",
    "KiCad PCB editor or 3D view, top view of the L1.05 board showing ONLY U1 and J1 placed, every passive and through-hole footprint hidden. Use the same zoom and frame for all three pass shots.",
  ),
  shot(
    "Pass 2: the 0805 field and D2 added, one at a time with the iron.",
    "KiCad PCB editor, SAME frame as pass 1: U1, J1 plus all 0805 passives and D2 visible, through-hole parts hidden.",
  ),
  shot(
    "Pass 3: the through-hole parts fitted, RV1 and J4 last.",
    "KiCad PCB editor, SAME frame: the fully populated L1.05 board with buttons, headers, test points, J4 and RV1 all visible.",
  ),
  {
    type: "partModel",
    mpn: "ESP32-S3-WROOM-1-N16R2",
    caption: "U1: castellated edge pads, drag-solderable with an iron, and it goes down first on the bare board",
  },
  check(
    "**Why solder the module before the 0805 resistors?** The hardest joints get the bare board: full access, nothing nearby to knock loose or reheat. On the hot-air path it matters more, because rework near placed passives blows them off.",
  ),
  dive(
    "Why the heavy parts go down first",
    "U1 and J1 are the heat-hungry parts. The module is a big slab with many pads, several of them hidden underneath, and the USB-C connector has chunky retention tabs that drain heat away. Hard joints want a bare board: you can prop it flat, angle the iron freely, and rework a pad without cooking a neighbour.\n\nThe order matters even more on the hot-air path, because [[reflow]] heat radiates several millimetres in every direction. An 0805 already sitting nearby can have its joints remelt, tumble off in the airflow, or stand up on one end. Either way the sequence holds: heat-hungry parts onto the bare board first, then passives one at a time with the iron, where the heat stays local.",
  ),

  band("do", "at the bench · Solder it, heavy parts first", "Bench time. U1 and J1 with the iron, then the field, then the through-hole pass."),
  {
    type: "callout", severity: "critical", label: "Warning · a soldering iron never looks hot",
    body: "A soldering iron sits at about **340 °C** and never looks hot: it burns instantly, so it goes back in its stand the moment it leaves your hand. Using hot air? Same hazard, moving: 300 °C air burns skin and scorches whatever is in the blast path. Work somewhere **ventilated**, wear **eye protection** (hot flux spits), tin the tip on a damp sponge, and treat the board, the tweezers and the parts as hot for a while afterwards. Lead-free or not, **wash your hands** when you are done.",
  },
  does("solder U1 and J1 with the iron", [
    {
      text: "Position **U1** on its pads, antenna end matching the silkscreen outline, and tack ONE corner castellation. Reheat and nudge until every pad row lines up. Alignment is the whole job at this point.",
      proof: "U1 sits on its pads matching the silkscreen, tacked at one corner, every pad row lined up.",
    },
    {
      text: "Flux each pad row and **drag-solder** it: load the tip with fresh solder and pull it steadily along the castellations at about **3 mm/sec**. The centre pad under the module is out of an iron's reach, and that is fine here: the GND castellations carry the ground.",
      proof: "Each castellation row is soldered and shiny with no bridge between pads.",
    },
    {
      text: "Seat **J1** so its retention tabs drop through the board, solder the **tabs first** so the connector cannot move, then flux and drag its signal-pin row.",
      proof: "J1's tabs are soldered first and the connector cannot move, and its signal row is dragged.",
    },
    {
      text: "Inspect both under magnification **before any passive goes on**: every joint shiny and slightly concave, no bridges between pins.",
      proof: "Under magnification every joint is shiny and slightly concave with no bridge between pins.",
    },
  ]),
  gotcha(
    "J1's tabs are the anchor, not decoration",
    "You soldered the through-hole retention tabs first so the connector could not shift. They do a second, longer job: they are the board's mechanical anchor, and every plug and yank of a USB-C cable lands its force on them. So do not just tack them, **fill each tab hole** with solder so it grips through the board. A well-anchored port outlives thousands of plug cycles; an under-soldered one lifts its pads after a dozen.",
  ),
  shot(
    "Bridge against clean: what to look for under magnification before you call a row done.",
    "Macro under magnification: one pad row where a bridge spans two adjacent pins with clean joints beside it. Single frame, bridge clearly legible.",
  ),
  tube("Solder the board: heavy parts, the 0805 field, and a drag pass"),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "The 0805 field, and the diode that is not polarised", "Nine passives and one small diode, one at a time, and one common assumption to unlearn."),
  prose(
    "The technique is the one you own by now: tin one pad, slide the part in with tweezers while the solder is molten, then solder the other end. One passive at a time keeps the heat local, which is the whole reason these go after the hot-air parts.\n\n**D2** joins this pass, and it is worth a pause. It looks like a diode and it has a marking, so the reflex is to treat it as polarised. It is not: the CDSOD323-T05C is a single-line **bidirectional** suppressor, symmetric across its two terminals, so either way round works electrically. Match its marking to the silk dot anyway, because a batch of boards assembled the same way is a batch you can inspect quickly.\n\nThe parts on this board where direction genuinely is function are the two **LEDs** and the two **ICs**. Those are the ones to slow down for.",
  ),
  does("solder one passive at a time", [
    {
      text: "**Tin one pad**: melt a small bead of solder onto ONE pad of the footprint. A low mound is plenty.",
      proof: "One pad of the footprint carries a low mound of solder.",
    },
    {
      text: "Grip the part in tweezers, **reheat the tinned pad**, and slide the part's end into the molten solder. Hold still a second while it freezes. The part should sit flat rather than perched on a blob.",
      proof: "The part sits flat against the board rather than perched on a blob.",
    },
    {
      text: "Solder the **other pad**: touch the iron to pad and part-end together, feed in a little solder, lift. Re-touch the first joint with a dab of flux if it looks dull.",
      proof: "Both pads are soldered and any dull first joint has been re-touched with flux.",
    },
    {
      text: "Work through the field: **R7, R8 and C8** with the rest of the 0805s, then **D2**, marking matched to the silk dot for consistency.",
      proof: "Every 0805 is down and D2's marking matches the silk dot.",
    },
    {
      text: "Check the two parts where direction is function: each **LED's bar side faces the ground end** of its string, and **U2** matches its silkscreen outline.",
      proof: "Both LED bar sides face ground and U2 sits the way its outline says.",
    },
  ]),
  table(
    ["Ref", "Does orientation matter?", "What to match"],
    [
      ["U1, U2", "Yes, electrically", "The silkscreen outline and the pin-1 marker"],
      ["LED1, LED2", "Yes, electrically", "The bar or flat side faces the ground end of the string"],
      ["D2", "No, it is bidirectional", "Match the silk dot anyway, so the batch inspects quickly"],
      ["RV1", "No", "It seats one way; the outer terminals only set sweep direction"],
      ["R7, R8, C8", "No", "Nothing to get wrong beyond sitting flat"],
    ],
  ),
  check(
    "**A resistor sits tilted up on a solder blob instead of flat. Fix?** Reheat the tinned pad while pressing the part gently flat with tweezers. Do not add more solder: there is already too much, which is why it is perched.",
  ),
  gotcha(
    "assuming the ESD diode has a cathode to get wrong",
    "It is the natural assumption, and on many ESD parts it would be right. This one is a single-line **bidirectional** suppressor, so it clamps in both directions and has no electrical polarity. Fitting it the other way round changes nothing about how the board behaves. Match the dot for tidiness and spend your care on the LEDs instead, where backwards means dark and nothing warns you.",
  ),
  shot(
    "Aim for the shiny concave fillet. Dull and grainy is a cold joint; barely wetted is starved.",
    "Macro on a scrap board: three joints labelled GOOD (shiny concave fillet), COLD (dull, grainy) and STARVED (barely wetted). Even light, sharp focus so the texture reads.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The through-hole pass, RV1 included", "Tall parts last, and the one part on this board a human will physically operate."),
  prose(
    "Through-hole goes last because the parts are tall and stand in the way of everything else. Push each one fully through, solder ONE pin, check it sits flat against the board, then do the rest. For header rows, one pin at each end first, recheck flatness, then fill in.\n\n**J4** snaps off the same breakaway header stick as J2 and J3: count three positions, snap, and check the break is clean before you fit it. **RV1** drops in on three legs with no orientation trap, and it wants two things. It has to sit **flush** against the board, because a trimpot standing proud on one leg twists when a screwdriver pushes on it, and every twist works the joints. And its adjustment screw has to end up **accessible**, which layout already arranged, so all you have to do is not fit it upside down.",
  ),
  does("fit the through-hole parts", [
    {
      text: "**Buttons and test points** first: push fully through, solder one pin, confirm flat, then the rest.",
      proof: "Each button and test point sits flat against the board before its remaining pins are soldered.",
    },
    {
      text: "**J2 and J3**: solder one pin at each end, recheck flatness against the board, then fill in the row.",
      proof: "Both header rows sit flat with no rocking before the middle pins go in.",
    },
    {
      text: "**J4**: snap a three-position length off the breakaway stick, check the break is clean, fit it with its labels reading outward, and solder the two outer pins before the middle.",
      proof: "J4 is a clean 3-position piece sitting flat with its silk reading outward.",
    },
    {
      text: "**RV1**: push all three legs fully through so the body sits **flush**, solder one leg, confirm it has not lifted or tilted, then solder the other two.",
      proof: "RV1 sits flush against the board with no gap under its body.",
    },
  ]),
  shot(
    "RV1 seated flush: no gap under the body, screw facing up and reachable.",
    "Bench macro of the L1.05 board with RV1 fitted: body flush to the board, all three legs soldered, screw facing up. Slight angle so any gap under the body would show.",
  ),
  check(
    "**Why does RV1 sitting flush matter more than it would for a resistor?** It is the one part a human physically pushes on. A trimpot standing proud on one leg rocks every time a screwdriver seats in the slot, and the joints work loose over a lesson's worth of sweeping.",
  ),
  shot(
    "J4 snapped to three positions and fitted with its labels reading outward.",
    "Bench macro: the L1.05 board with J4 fitted beside RV1, three pins, silk reading 3V3 / AIN / GND outward from the board edge.",
  ),
  gotcha(
    "a breakaway header snapped one position short",
    "J4 is three pins: 3V3, AIN and GND. Snap two and you have a header with no ground return for your probe, which is easy to miss because it still fits the two outer holes and looks almost right. Count the positions against the footprint before you snap, not after.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  band("check", "Inspect, continuity, then the knob", "Verify. Hunt bridges under magnification, prove there is no short, then prove the source is clean."),
  sect("04", "Screen, continuity, and one sweep unique to this board", "Three checks before power, and the third one exists only because this board measures things."),
  prose(
    "Under magnification, hunt for solder bridges and for a passive stood up on one end. Then run a [[continuity]] sweep with the meter: confirm the grounds are connected and, the one that matters most, confirm there is **no continuity between [[VBUS]] and GND**. A short there would destroy the board the instant USB is plugged in. That is the POST_ASSEMBLY_CONTINUITY gate, and it is the same gate on every board in this curriculum.\n\nThen the check that belongs to this board alone. Put the meter in **ohms** between **RV1's wiper and one end terminal** and turn the screw slowly across its whole travel. The reading should sweep smoothly from near zero to near 10 kΩ with no jumps, no dead spots and no moments of open circuit. You are proving your signal source is clean while the board is cold, because a scratchy wiper produces exactly the kind of jitter you are about to go looking for in the converter.",
  ),
  does("screen it, then prove the source", [
    {
      text: "Under magnification, sweep the whole board for **bridges** and for any 0805 standing on one end.",
      proof: "No bridge and no tombstoned passive anywhere on the board.",
    },
    {
      text: "Meter in **continuity**: confirm the grounds are common, including **J4 pin 3**, **TP2** and the header ground positions.",
      proof: "Every ground point beeps against every other.",
    },
    {
      text: "The one that matters: **VBUS to GND must NOT beep.** Red probe on the VBUS point at U2's input, black on TP2. Display reads OL, meter silent.",
      proof: "The meter stays silent between VBUS and GND, showing OL.",
    },
    {
      text: "Meter in **ohms** between **RV1's wiper and one end terminal**. Turn the screw slowly from stop to stop and watch the reading sweep from near zero to near 10 kΩ.",
      proof: "The resistance changes smoothly across the whole travel with no jump, dead spot or open reading.",
    },
    {
      text: "Move the meter to **J4's AIN pin against GND** and turn again. You should see the wiper voltage divider through R8, proving the header reaches the analog node and that R8 is actually fitted.",
      proof: "J4's AIN pin tracks the knob, which proves R8 is in place and the header is live.",
    },
  ]),
  shot(
    "The gate: VBUS to GND must NOT beep before USB ever touches this board.",
    "Bench, no power: meter in continuity mode, red probe on the VBUS point at U2's input, black on TP2, display showing OL and no beep. Crop to board plus meter screen.",
  ),
  shot(
    "The sweep that is unique to this board: ohms across the wiper, turned end to end.",
    "Bench, no power: meter in ohms with probes on RV1's wiper and one end terminal, screwdriver in the slot mid-turn, display showing a mid-scale resistance. Both the meter and the pot legible.",
  ),
  tube("The pre-power screen, and the ohm sweep that proves your source"),
  check(
    "**Your meter beeps continuity between VBUS and GND before power-on. Power it anyway?** Never. That is a dead short, and it will destroy the board the instant USB is plugged in. Find and clear it first.",
  ),
  trace(
    "Before you log the build",
    [
      { text: "No bridge and no tombstoned passive, checked under magnification", help: "Finding a defect with your eyes costs a minute. Finding it by powering up can cost the board." },
      { text: "**VBUS to GND does not beep**", help: "The one non-negotiable on every board in this curriculum." },
      { text: "**RV1 sweeps smoothly** from near zero to near 10 kΩ with no dead spots", help: "A scratchy wiper injects noise indistinguishable from converter noise, and you will chase it in the wrong place." },
      { text: "**J4's AIN pin tracks the knob**", help: "This proves R8 is fitted and the probe header actually reaches the analog node, which is hard to confirm any other way." },
      { text: "Both LEDs face the right way and RV1 sits flush", help: "Backwards LEDs simply stay dark at bring-up, and a proud trimpot works its joints loose over an afternoon of sweeping." },
    ],
  ),

  {
    type: "quiz",
    prompt: "Quick check: assembly",
    gate: true,
    questions: [
      {
        id: "pot-preflight", reviewId: "pot-preflight",
        q: "Which pre-power check is unique to this board?",
        options: [
          "Measuring the voltage at TP1",
          "An ohmmeter sweep of the pot: smooth wiper travel proven before the converter ever reads it",
          "A capacitance check on C8",
        ],
        answer: 1,
        explain: "A scratchy wiper would masquerade as ADC noise later. Prove the source is clean while the board is still cold.",
      },
      {
        id: "d2-not-polarised", reviewId: "d2-not-polarised",
        q: "Which parts on this board have an orientation that changes how the circuit behaves?",
        options: [
          "D2 and RV1",
          "Every part with a marking on it",
          "The two ICs and the two LEDs. D2 is bidirectional, so its dot is only an assembly-consistency mark",
        ],
        answer: 2,
        explain: "The CDSOD323-T05C is a single-line bidirectional suppressor with no electrical polarity. Spend your care on the LEDs, where backwards means dark and nothing warns you.",
      },
      {
        id: "heavy-parts-first",
        q: "Which parts go down first, on the bare board?",
        options: [
          "The two hardest: the module (U1) and the USB-C connector (J1)",
          "The through-hole parts, since they are the tallest",
          "The 0805 resistors and capacitors",
        ],
        answer: 0,
        explain: "Do the heat-hungry parts first. Reworking them later would remelt and knock off passives you had already placed.",
      },
      {
        id: "vbus-gnd-short",
        q: "Before you apply any power, your meter beeps continuity between VBUS and GND. What do you do?",
        options: [
          "Ignore it if the board looks fine",
          "Power it on to see what happens",
          "Stop: that is a short, and it has to be found and cleared before any power reaches the board",
        ],
        answer: 2,
        explain: "VBUS shorted to ground destroys the board the instant USB is plugged in. Never power a board showing that short.",
      },
      {
        id: "rv1-flush",
        q: "Why does RV1 have to sit flush against the board rather than merely soldered?",
        options: [
          "It affects the resistance value",
          "It is the one part a human pushes on, so a proud body rocks under a screwdriver and works its joints loose",
          "The ground pour needs contact with its body",
        ],
        answer: 1,
        explain: "Every sweep of the lesson puts force on that part. Flush means the force goes into the board rather than into three solder joints.",
      },
    ],
  },

  exit(
    "Built, screened, and the knob proven smooth before a single volt arrived. Pass the build's POST_ASSEMBLY_CONTINUITY checklist with every item checked or marked N/A. Bring-up is where this board finally does the thing it was designed for.",
  ),

  ref("IPC-A-610 Acceptability of Electronic Assemblies (IPC): a good solder joint against a cold or starved one", "https://webstore.ansi.org/preview-pages/ipc/preview_ipc-a-610h.pdf"),
  ref("Bourns CDSOD323-TxxC datasheet: single-line bidirectional, which is why it has no electrical polarity", "https://bourns.com/docs/Product-Datasheets/CDSOD323-TxxC.pdf"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "ASSEMBLY", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
