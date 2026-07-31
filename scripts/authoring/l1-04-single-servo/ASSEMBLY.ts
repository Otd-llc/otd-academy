// L1.04 single-servo driver — ASSEMBLY card.
//
// L1.01's ASSEMBLY card is gospel for the craft: heat-hungry parts onto the
// bare board first, the iron at about 340 C in SAC305, flux and drag-solder for
// the fine rows, one passive at a time, through-hole last, the safety warning,
// the tombstoning and cold-joint references, and the POST_ASSEMBLY_CONTINUITY
// gate with its NO-beep VBUS-to-GND rule.
//
// This board changes the order, because it adds a class L1.01 did not have.
// L1.01 was two passes: SMD then through-hole. This board is four:
//
//   1  U1 and J1 on the bare board, exactly as before.
//   2  the 0805 field, one at a time.
//   3  the LEADED SMD protection parts, F2 (1812), D2 (DO-214AB) and D3 (SMA).
//      Two are polarised and one has real thermal mass.
//   4  through-hole, ending with C8 (polarised, tall, and the hardest joint on
//      the board because its ground lead sits in heavy copper with a via
//      cluster beside it) and the two connectors.
//
// The gate grows one item: VSERVO to VBUS must also NOT beep. The isolation the
// schematic named and the layout drew has to exist in solder, and a meter is
// the only thing that proves it before power.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Assembly: four passes, three polarised parts, and one joint that fights back"),

  prose(
    "Assembly rewards patience and a plan. The parts go down in a deliberate order, every joint gets flux, and you inspect the board before you ever apply power.\n\nL1.01 was two passes: surface-mount, then through-hole. This board is **four**, because it adds a class of part you have not soldered yet. Three of its parts are **polarised**, which means there is a wrong way round that solders perfectly and fails later. One joint has genuinely more thermal mass than anything you have met. And the continuity gate at the end grows a second sweep, because this board has an isolation to prove.",
  ),

  band("orient", "The build order", "Read this before you melt anything. On this board the order is the whole game, and it has four steps rather than two."),
  {
    type: "callout", severity: "critical", label: "01 · Order of operations",
    reason: "Safety: read before you heat anything",
    body: "The hardest parts go down first on the bare board: **U1 and J1**. Then the **0805 passives**, one at a time with the iron. Then the **leaded SMD protection parts**, F2, D2 and D3, which are bigger than an 0805 and two of which are polarised. Finally the **through-hole parts**, ending with C8 and the two connectors, because they are tall and they get in the way of everything.",
  },
  prose(
    "Solder **U1** (the module) and **J1** (the USB-C connector) first, on the bare board. Both are the board's hardest jobs and both were chosen to be iron-solderable: the module connects through castellated edge pads you drag-solder, and the connector holds itself still with through-board retention tabs while you work its pin row. Give them an empty board and your full attention.\n\nThen the 0805 field. Then the three protection parts, which sit between the passives and the through-hole work in difficulty as well as in order. Then everything with legs.\n\nUsing hot air for U1 and J1 instead? The order stops being a preference. Hot-air rework blows freshly-placed 0805s right off the board.",
  ),
  {
    type: "table",
    columns: ["Pass", "Parts", "Why here"],
    rows: [
      [{ text: "1" }, { text: "U1, J1" }, { text: "The hardest joints get the bare board: full access, nothing nearby to knock loose or reheat" }],
      [{ text: "2" }, { text: "Every 0805: C1, C2, C3, C5, C6, C7, C9, R1 to R7, LED1, LED2" }, { text: "Iron only, one at a time, so the heat stays local" }],
      [{ text: "3" }, { text: "F2 (1812), D2 (DO-214AB), D3 (SMA)" }, { text: "Bigger bodies, more thermal mass, and two of them polarised. Easier once the small stuff is settled" }],
      [{ text: "4" }, { text: "SW1, SW2, TP1, TP2, J2, J3, then C8, J4, J5" }, { text: "Tall and in the way. C8 and the connectors go last of all" }],
    ],
  },
  {
    type: "image", src: "", aspect: "4:3",
    alt: "Board top view with only U1 and J1 placed on the bare board.",
    caption: "Pass 1, only the hard parts: U1 and J1 on an empty board.",
    captureHint: "KiCad PCB editor or 3D view, top view: show ONLY U1 and J1 placed, every other footprint hidden. Use the same zoom and frame for all four pass shots.",
  },
  {
    type: "image", src: "", aspect: "4:3",
    alt: "Board top view with U1, J1 and all the 0805 passives placed.",
    caption: "Pass 2: the 0805 field added, one part at a time with the iron.",
    captureHint: "KiCad PCB editor, same frame as pass 1: U1, J1 and every 0805 visible; F2, D2, D3 and all through-hole parts hidden.",
  },
  {
    type: "image", src: "", aspect: "4:3",
    alt: "Board top view with the three leaded SMD protection parts added: the 1812 fuse, the DO-214AB Schottky and the SMA transient suppressor.",
    caption: "Pass 3: the three protection parts, noticeably larger than the 0805s around them.",
    captureHint: "KiCad PCB editor, same frame: U1, J1, the 0805s plus F2, D2 and D3 visible; through-hole parts still hidden so the size difference reads.",
  },
  {
    type: "image", src: "", aspect: "4:3",
    alt: "The fully populated board with the through-hole parts fitted, including the tall electrolytic and both connectors.",
    caption: "Pass 4, everything with legs: buttons, headers, test points, then C8 and the connectors.",
    captureHint: "KiCad PCB editor, same frame: the fully populated L1.04 board with C8's can and the screw terminal clearly the tallest things on it.",
  },
  { type: "partModel", mpn: "ESP32-S3-WROOM-1-N16R2", caption: "U1: castellated edge pads, drag-solderable with an iron. It goes down first, on the bare board" },
  check(
    "**Why solder the WROOM module before the 0805 resistors?** The hardest joints get the bare board: full access, freedom to angle the iron, and nothing nearby to knock loose or cook twice. On the hot-air path it goes further, because reworking U1 later would blow placed passives off the board.",
  ),
  dive(
    "Why the heavy parts go down first",
    "U1 and J1 are the heat-hungry parts. The module is a big slab with many pads, several hidden underneath, and the USB-C connector has chunky retention tabs that drain heat away.\n\nHard joints want a bare board: you can prop it flat, angle the iron freely, and rework a pad without cooking a neighbour. The order matters even more on the hot-air path, because [[reflow]] heat radiates several millimetres in every direction, so 0805 passives already sitting nearby can have their joints remelt, tumble off in the airflow, or stand up on one end ([[tombstoning]]).\n\nThis board extends the same logic downward. **C8 goes last of everything**, not because it is hard to solder but because it is 20 mm tall and 10 mm across, and once it is on the board your iron cannot reach anything within a few millimetres of it. Every part in its shadow has to be finished before the can goes in.",
  ),

  band("do", "at the bench · Solder it, hardest parts first", "Hands on. Iron at about 340 C, flux on everything, and the safety rules below are not optional."),
  {
    type: "callout", severity: "critical", label: "Warning · a soldering iron never looks hot",
    body: "A soldering iron sits at about **340 °C** and never looks hot. It burns instantly, so it goes back in its stand the moment it leaves your hand. Using **hot air**? Same hazard, moving: 300 °C air burns skin and scorches anything in the blast path. Work somewhere **ventilated**, because flux fumes irritate. Wear **eye protection**, because hot flux spits. Treat the board, the tweezers and the parts as hot for a while after. **Wash your hands** when you are done, lead-free or not.",
  },
  does("pass 1: solder U1 and J1 with the iron", [
    {
      text: "Position **U1** on its pads, antenna end matching the silkscreen outline, and tack **one** corner castellation. Reheat and nudge until every pad row lines up. Alignment is the whole job at this point; tidy solder comes later.",
      proof: "U1 sits on its pads matching the silkscreen outline, tacked at one corner, with every pad row lined up.",
    },
    {
      text: "Flux each pad row and [[drag-tin|drag-solder]] it: load the tip with fresh solder and pull it steadily along the castellations. The centre pad under the module is out of an iron's reach, and that is fine here: the GND castellations carry the ground.",
      proof: "Each castellation row is soldered and shiny, with no bridge between pads.",
    },
    {
      text: "Seat **J1** so its retention tabs drop through the board, solder the **tabs first** so the connector cannot move, then flux and drag its signal-pin row.",
      proof: "J1's tabs are soldered first and the connector cannot move, and its signal row is dragged.",
    },
    {
      text: "Inspect both under magnification before any passive goes on: every joint shiny and slightly concave, no bridges between pins.",
      proof: "Under magnification every joint is shiny and slightly concave, with no bridge between pins.",
    },
  ]),
  gotcha(
    "J1's tabs are the anchor, not decoration",
    "You soldered the through-hole retention tabs first so the connector could not shift. They do a second, longer job: they are the board's **mechanical anchor**. Every plug and yank of a USB-C cable lands its force on the connector, and the tabs are what stop it peeling the fine signal pads off. So do not just tack them. **Fill each tab hole** so it grips through the board.",
  ),

  sect("02", "Pass 2: the 0805 field", "One at a time, so the heat stays local."),
  does("solder one passive at a time", [
    {
      text: "**Tin one pad**: melt a small bead of solder onto one pad of the footprint. A low mound is plenty.",
      proof: "One pad of the footprint carries a low mound of solder.",
    },
    {
      text: "Grip the part in tweezers, **reheat the tinned pad**, and slide the part's end into the molten solder. Hold still a second while it freezes: the part should sit flat, not perched on a blob.",
      proof: "The part sits flat against the board, not perched on a blob.",
    },
    {
      text: "Solder the **other pad**: touch the iron to pad and part-end together, feed in a little solder, lift. Re-touch the first joint with a dab of flux if it looks dull.",
      proof: "Both pads are soldered and any dull first joint has been re-touched with flux.",
    },
    {
      text: "**Mind LED1 and LED2's polarity.** They are the only 0805s on this board with a wrong way round, and backwards they simply stay dark. Bar side towards the ground end of the string.",
      proof: "Both LEDs have their bar side facing the ground end of their string.",
    },
    {
      text: "**C9 and R7 belong to the servo island** but they are ordinary 0805s and they go down in this pass with everything else. Placing them now keeps them out from under C8's shadow later.",
      proof: "C9 and R7 are soldered before any through-hole part goes in.",
    },
  ]),
  check(
    "**A resistor sits tilted up on a solder blob instead of flat. Fix?** Reheat the tinned pad while pressing the part gently flat with tweezers. Do not add more solder: there is already too much, which is why it is perched.",
  ),

  sect("03", "Pass 3: the three protection parts", "Bigger bodies, more heat, and two of them only go in one way."),
  prose(
    "F2, D2 and D3 are surface-mount like the 0805s, but they are larger, they carry more thermal mass, and two of them are polarised. Take them as their own pass rather than mixing them into the 0805 field.\n\n**Match every band to its silkscreen mark before heat touches the pad.** A flipped crowbar diode conducts on every power-up and trips the fuse with no fault present. A flipped transient suppressor clamps the wrong polarity and does nothing useful. Both solder perfectly. Neither shows up until you power the board.",
  ),
  {
    type: "table",
    columns: ["Ref", "Package", "Orientation", "Soldering note"],
    rows: [
      [{ text: "F2", decoration: "ref" }, { text: "1812" }, { text: "None: it is symmetric" }, { text: "Two large pads. Treat it like a very big 0805" }],
      [{ text: "D2", decoration: "ref" }, { text: "DO-214AB (SMC)" }, { text: "Cathode band towards VSERVO, matching the silk" }, { text: "The biggest SMD body on the board. Its tab sinks heat, so give the joint an extra beat until the fillet forms" }],
      [{ text: "D3", decoration: "ref" }, { text: "DO-214AC (SMA)" }, { text: "Cathode band towards VSERVO, matching the silk" }, { text: "Smaller than D2 but the same rule. Unidirectional, so the band is not decoration" }],
    ],
  },
  does("solder the protection parts", [
    {
      text: "**Read the silk first, then the part.** Find the cathode mark printed on the board for D2 and D3, and find the band on each diode's body. Say out loud which way each goes before you pick up the iron.",
      proof: "You can point at the silk mark and the part band for both diodes and say they agree.",
    },
    {
      text: "**F2 first**, since it needs no thought about orientation. Tin one pad, seat it, solder the other, then re-touch the first.",
      proof: "F2 sits flat with both pads wetted.",
    },
    {
      text: "**D2 next.** Tin one pad, seat it with the band matching the silk, then solder the far pad. **Hold the iron on the big tab joint a couple of seconds longer than feels necessary**: the body sinks heat and a joint that looks wetted from above can be cold underneath.",
      proof: "D2's band matches the silk and both joints show a proper fillet rather than a domed blob.",
    },
    {
      text: "**D3 the same**, band matching the silk. Smaller body, so it comes up to temperature faster than D2.",
      proof: "D3's band matches the silk and both joints are wetted.",
    },
    {
      text: "**Check all three under magnification** before moving on, and check the bands once more now that the parts are down. This is the last easy moment to catch a reversed diode.",
      proof: "Under magnification all three are wetted, and both diode bands still match their silk marks.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "Macro of the three protection parts soldered: the 1812 fuse, the large DO-214AB Schottky and the SMA suppressor, with both diode bands matching the silkscreen marks.",
    caption: "The three protection parts down, with both cathode bands matching the silk beneath them.",
    captureHint: "Bench macro of the soldered F2, D2 and D3 on the servo island, angled so both diode bands and the silkscreen cathode marks are legible in one frame.",
    reveal: "See it wired · the protection parts",
  },
  check(
    "**D2 and D3 carry cathode bands. What is assembly's job with them?** Match each band to its silkscreen mark before heat touches the pad. A flipped crowbar conducts on every power-up and trips the fuse with no fault present; a flipped suppressor clamps the wrong way and protects nothing. Both solder beautifully.",
  ),

  sect("04", "Pass 4: through-hole, ending with the big one", "Everything with legs, and then the two parts that get in the way of everything."),
  prose(
    "Through-hole is the forgiving part of the build, with two exceptions on this board.\n\n**C8 is polarised and it is the hardest joint here.** Its negative lead sits in heavy copper with a via cluster beside it, all of which conducts heat away from your iron. A joint that looks fine from the top can be a cold ring underneath. It also has to go in the right way round: the can is marked on its negative side, its negative lead is the shorter one, and the footprint marks its positive pad on the silk.\n\n**J4 and J5 go in last**, after C8, so nothing you still have to solder is hidden behind a connector body.",
  ),
  does("fit the through-hole parts", [
    {
      text: "**Buttons, headers and test points first.** Push the part fully through, solder **one** pin, check it sits flat against the board, then do the rest. For a header row: one pin at each end first, recheck flatness, then fill in.",
      proof: "Each through-hole part sits flat against the board before its remaining pins are soldered.",
    },
    {
      text: "**C8, and check the polarity twice.** The **longer lead is positive** and the can is **striped on the negative side**. Match the long lead to the pad the silk marks with a plus. Seat it fully so the can sits on the board rather than standing proud.",
      proof: "C8's long lead is in the pad marked plus, its stripe faces the negative pad, and the can sits flat on the board.",
    },
    {
      text: "**Solder C8's ground lead with real dwell.** That pad ties into the plane and a via cluster, so it drinks heat. Hold the iron on it until you see solder flow up into the hole and form a fillet on the far side, not just a dome on top. If your iron cannot get there, turn it up rather than pressing harder.",
      proof: "C8's ground joint shows solder flowed through the hole with a fillet on both sides.",
    },
    {
      text: "**J4 and J5 last.** Seat the screw terminal with its wire openings facing off the board, and give its pins the same long dwell as C8: they are chunky and they anchor a part somebody will torque a screwdriver into.",
      proof: "J4 faces outward and both its joints are filled, and J5 sits flat with all three pins soldered.",
    },
    {
      text: "**Trim the leads** on C8 and anything else that stands proud, flush with the fillet. A long lead under the board is a short waiting for the first time you set the board down on something metallic.",
      proof: "Every through-hole lead is trimmed flush with its fillet.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "The electrolytic seated on the board, long lead in the pad marked plus, its stripe over the negative pad.",
    caption: "C8 in: long lead to the plus pad, stripe over the negative one, can flat on the board.",
    captureHint: "Bench macro of C8 seated but not yet trimmed, angled so the can's negative stripe and the silkscreen plus mark are visible together, with the long lead identifiable.",
    reveal: "See it wired · the electrolytic",
  },
  tube("Build it in four passes, ending with the electrolytic and the terminals"),
  gotcha(
    "the joint that looks finished and is not",
    "C8's ground lead and J4's pins sit in heavy copper. Solder that has only wetted the top of the pad makes a joint that conducts today and cracks in a month, and on the servo rail it is carrying an amp. The tell is the far side of the board: a good through-hole joint shows a fillet on **both** sides, because the solder was hot enough to be drawn through the barrel. Flip the board and look before you call it done.",
  ),

  sect("05", "Flux and drag-soldering", "The technique behind pass 1, and the fix for any row that came out bridged."),
  prose(
    "Flood the pads with flux, then [[drag-tin|drag-solder]] the fine-pitch rows: load the iron tip with fresh solder and drag it steadily along the row, letting surface tension and flux pull just the right amount onto each lead while clearing the bridges. On a lead-free board you are working in [[SAC305]], which wants a slightly hotter tip and gives a more matte joint.",
  ),
  does("drag-solder a row", [
    {
      text: "Set the iron around **340 °C**, since SAC305 is lead-free and wants a little more heat, and flood the pad row with liquid flux.",
      proof: "The pad row is flooded with liquid flux and the iron sits around 340 C.",
    },
    {
      text: "Load the tip with a small bead of fresh solder, rest it at one end of the row, and drag steadily along at about **3 mm per second**.",
      proof: "The bead runs the length of the row in one steady pass.",
    },
    {
      text: "Lift at the end. If a bridge stays behind, **add more flux and drag once more. Do not add solder.**",
      proof: "Any bridge left behind clears with more flux and a second drag, with no solder added.",
    },
    {
      text: "Inspect: each lead should show a shiny, slightly concave fillet, and no bridges between pins.",
      proof: "Each lead shows a shiny, slightly concave fillet, and no bridge between pins.",
    },
  ]),
  dive(
    "Why dragging molten solder does not bridge every pin",
    "It feels like dragging a bead of molten metal across a row of pins should short them all together. Flux is what makes it not.\n\nLiquid flux strips the oxide off the copper and lowers the solder's surface tension, so molten solder wets clean metal eagerly but beads up and refuses to stick to the [[solder mask]] between pads. Drag a loaded tip along the row and surface tension pulls just enough onto each lead while the excess rides along. Any bridge that forms gets reflowed and pulled apart by that same tension.\n\nRun out of flux and the magic stops: the oxide creeps back and solder clumps wherever it lands. That is why the answer to a bridge is always more flux and never more solder.",
  ),
  {
    type: "image", src: "", aspect: "1:1",
    alt: "Macro of a pad row: a solder bridge across two pins beside properly wetted clean joints.",
    caption: "Bridge against clean: what to look for under magnification before you call a row done.",
    captureHint: "Macro under magnification: one pad row where a bridge spans two adjacent pins and the neighbouring joints are clean. Single frame, bridge clearly legible.",
  },
  {
    type: "image", src: "", aspect: "16:10",
    alt: "A tombstoned 0805: one end lifted off its pad with the part standing up on end.",
    caption: "Tombstoning: one joint reflowed before the other and stood the part up on end.",
    captureHint: "Macro: an 0805 tombstoned on a scrap board, one end soldered and the other lifted. Angle the shot so the abandoned pad underneath is visible.",
  },
  {
    type: "image", src: "", aspect: "16:10",
    alt: "Solder-joint reference: a good joint with a shiny concave fillet, a cold joint that is dull and balled up, and a starved joint where the pad is barely wetted.",
    caption: "Aim for the shiny concave fillet. Dull and grainy is a cold joint, so reflow it. Barely wetted is starved, so add flux and solder.",
    captureHint: "Macro on a scrap board: three joints side by side labelled GOOD, COLD and STARVED. Even light and sharp focus so the fillet texture reads.",
  },

  // ── the gate ──────────────────────────────────────────────────────────────
  band("check", "Inspect, then two continuity sweeps", "Verify. This board's gate has one more sweep than L1.01's, and it is the one that proves the design."),
  sect("06", "Screen, then continuity", "Check your work before you ever apply power. Twice, on this board."),
  prose(
    "Under magnification, hunt for solder bridges and [[tombstoning]], a passive stood up on one end. Then run a [[continuity]] sweep with your meter.\n\nL1.01 had one sweep that mattered: **no continuity between VBUS and GND**, because a short there destroys the board the instant USB is plugged in. That still applies.\n\nThis board adds a second: **no continuity between VSERVO and VBUS**. The isolation between the two rails was a naming discipline on the schematic and a geometry decision at layout. Here is where you find out whether it survived a soldering iron. A single stray bridge rebuilds the shared rail this whole lesson exists to eliminate, and nothing downstream will tell you: the board will work, right up until the servo stalls and the processor reboots.",
  ),
  {
    type: "table",
    columns: ["Probe from", "Probe to", "Expected", "If it beeps"],
    rows: [
      [{ text: "VBUS (U2's input, or F1's connector side)" }, { text: "GND (TP2)" }, { text: "No beep. OL on the display" }, { text: "Stop. That is a dead short and USB would destroy the board. Find it before any power" }],
      [{ text: "VSERVO (C8's positive lead)" }, { text: "VBUS or +5V" }, { text: "No beep" }, { text: "The rails are joined. Find the bridge or the mislabelled net before you go any further" }],
      [{ text: "VSERVO (C8's positive lead)" }, { text: "GND (TP2)" }, { text: "No beep once C8 has settled" }, { text: "A short on the servo rail, or D2 in backwards. Check the crowbar's band first" }],
      [{ text: "GND at J5 pin 1" }, { text: "GND (TP2)" }, { text: "Beep. They are one net" }, { text: "No beep means the servo's return never reaches the board's ground, and the servo will not work" }],
    ],
  },
  does("screen it, then sweep it", [
    {
      text: "**Under magnification**, walk every row: bridges between pins, tombstoned passives, dull grainy joints, and pads that are barely wetted. Fix what you find now.",
      proof: "Every row has been inspected under magnification and any bridge or tombstone is fixed.",
    },
    {
      text: "**Sweep one, VBUS to GND.** Meter in continuity mode, red on the VBUS point, black on TP2. It must **not** beep.",
      proof: "The VBUS-to-GND sweep is silent and the display reads OL.",
    },
    {
      text: "**Sweep two, VSERVO to VBUS.** Red on C8's positive lead, black on the VBUS point or the header's 5V pin. It must **not** beep. This is the sweep that proves the two rails are still two rails.",
      proof: "The VSERVO-to-VBUS sweep is silent.",
    },
    {
      text: "**Confirm the grounds are common.** Probe J5 pin 1 against TP2. This one **should** beep: ground is the single thing the two rails share, by design.",
      proof: "J5 pin 1 beeps against TP2, confirming one common ground.",
    },
    {
      text: "**Check D2 with the meter while you are here.** In diode mode, probing from its anode (ground side) to its cathode (VSERVO side) should read a forward drop of a few tenths of a volt, and the other way round should read open. Reversed, those results swap, and that is a reversed crowbar caught before it ever conducts.",
      proof: "D2 reads a forward drop from ground to VSERVO and open the other way.",
    },
  ]),
  {
    type: "image", src: "/guide-diagrams/continuity-vbus-gnd.svg",
    alt: "Multimeter in continuity mode probing VBUS against GND on the unpowered board, reading OL with no beep.",
    caption: "The continuity gate: VBUS to GND must not beep before USB ever touches this board.",
  },
  {
    type: "image", src: "", aspect: "16:10",
    alt: "Probing VSERVO at the bulk capacitor against the board's 5 V rail, meter reading OL with no beep.",
    caption: "The sweep this board adds: VSERVO against VBUS, silent. The isolation exists in solder, not just in intent.",
    captureHint: "Bench, no power, meter in continuity mode: red probe on C8's positive lead, black on the header's 5V pin. Display shows OL. Crop to board and meter screen.",
  },
  check(
    "**Your meter beeps between VSERVO and VBUS. Power it anyway to see what happens?** No. That beep means a bridge or a mislabelled net has joined the two rails, so the servo's stall current would flow straight through the USB path. The board would appear to work and would then reboot on the first stall, which is precisely the failure this design removes. Find the copper first.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: assembly",
    gate: true,
    questions: [
      {
        id: "heavy-parts-first",
        q: "Which parts go down first on the bare board?",
        options: [
          "The two hardest: the module (U1) and the USB-C connector (J1)",
          "The three protection parts, since they are the most important",
          "The little resistors and capacitors",
        ],
        answer: 0,
        explain: "The heat-hungry parts get an empty board. Reworking them later would remelt and knock off passives you had already placed.",
      },
      {
        id: "cathode-bands", reviewId: "l104-cathode-bands",
        q: "D2 and D3 both carry a cathode band. What is assembly's job with them?",
        options: [
          "Point both bands towards the screw terminal",
          "Match each band to its silkscreen mark before heat touches the pad",
          "Nothing: bands are decorative on surface-mount diodes",
        ],
        answer: 1,
        explain: "A flipped crowbar conducts on every power-up and trips the fuse with no fault present. A flipped suppressor clamps the wrong polarity. Both solder perfectly and neither shows up until you power the board.",
      },
      {
        id: "isolation-in-solder", reviewId: "l104-isolation-in-solder",
        q: "The VSERVO-to-VBUS continuity sweep guards against what?",
        options: [
          "A drained bulk capacitor",
          "A tripped fuse",
          "A solder bridge welding together the two rails the whole design keeps apart",
        ],
        answer: 2,
        explain: "The isolation was a naming discipline on the schematic and a geometry decision at layout. The meter is what proves it survived a soldering iron.",
      },
      {
        id: "big-diode-dwell",
        q: "D2's DO-214AB body wants a slightly longer iron dwell. Why?",
        options: [
          "Its plating needs more heat to wet",
          "Schottky diodes are heat-sensitive and need slow warming",
          "The large tab sinks heat away, so the joint needs the extra beat to wet fully",
        ],
        answer: 2,
        explain: "Thermal mass. A joint that looks wetted from above can be cold underneath, which is the same physics as C8's ground lead and J1's retention tabs.",
      },
      {
        id: "c8-polarity",
        q: "How do you tell which way round C8 goes?",
        options: [
          "The longer lead is positive, and the can is striped on its negative side",
          "Either way is fine on a 16 V part",
          "The lead nearest the stripe is positive",
        ],
        answer: 0,
        explain: "It is the one part on this board that fails destructively when reversed, and there are two independent markings so you can check yourself twice.",
      },
      {
        id: "vbus-gnd-short",
        q: "Before you apply any power, your meter beeps continuity between VBUS and GND. What do you do?",
        options: [
          "Ignore it if the board looks fine",
          "Power it on briefly to see what happens",
          "Stop: that is a dead short, and it has to be found and cleared before any power reaches the board",
        ],
        answer: 2,
        explain: "VBUS shorted to ground would destroy the board the instant USB is plugged in. Never power a board showing that short.",
      },
    ],
  },

  exit(
    "Four passes down, both diode bands matched to their silk, C8 the right way round with a fillet on both sides of its ground joint, and two continuity sweeps that came back silent. Pass the build's POST_ASSEMBLY_CONTINUITY checklist, every item checked or marked not applicable. Next you power it, and then you make something move.",
  ),

  ref("IPC-A-610 Acceptability of Electronic Assemblies (IPC): a good solder joint versus a cold or starved one", "https://webstore.ansi.org/preview-pages/ipc/preview_ipc-a-610h.pdf"),
  ref("EEU-FM1C102 product listing (DigiKey): the electrolytic's dimensions, lead pitch and polarity marking", "https://www.digikey.com/en/products/detail/panasonic-industry/EEU-FM1C102/613727"),
];

publishCard({ slug: "l1-04-single-servo", stage: "ASSEMBLY", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
