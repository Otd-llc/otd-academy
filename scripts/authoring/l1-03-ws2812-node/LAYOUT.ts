// L1.03 WS2812 node — LAYOUT card.
//
// Authored ahead of the board from docs/boards/l1-03-ws2812-node/{design.md,
// bom.csv,validation-log.md}, with L1.01's LAYOUT card as gospel for everything
// the boards share: 4 copper layers at 1.6 mm, Default 0.25 mm and Power 0.5 mm
// net classes, the PCBWay .kicad_dru, the 1.0/0.8/0.6 mm via presets with
// 0.6/0.3 mm as the fab floor, the F.Cu/B.Cu layer pair, the 25.4 mm header
// spacing, the Rule Area keep-out on all four coppers plus silk, pour and
// stitch with plain through vias, and the DRC flow.
//
// The card this replaces was 11 blocks against L1.01's 96.
//
// NEW, all traceable to design.md sections 5 and 6:
//   07  the pixel data path (R7/R8 placement, TP3, keep it off the antenna)
//   08  the 5V_EXT power path and the isolation invariant, which is the ONE
//       DESIGN_VALIDATION item design.md still lists as OWED at layout stage
//   the C10 height keep-out (L9-1) and the star ground at J5/C10 (PI-3)
//
// DIMENSIONS: design.md does NOT state this board's outline, and L1.01's
// 30 x 62 mm is L1.01's board, not this one. So the outline step defers to the
// starter rather than asserting a size. The 25.4 mm header spacing IS carried
// over, because it is set by the module sitting between the rows.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Layout: placing and routing a board with two power domains"),

  band("orient", "How layout works", "Read this once. Most of this board is the layout you have done twice. One part of it is new and it is the part that can hurt you."),
  prose(
    "Layout is where the schematic becomes copper with a shape. You place each part, draw the board outline, run the connections as real traces on real layers, flood the leftover space with ground, and prove the result against the fab's limits. The schematic said what connects to what. Layout says where it physically sits and how wide the metal is.\n\nThe power and USB chain is L1.01's, unchanged, so most of the work is familiar. Two things are genuinely different here. **The board carries two separate 5 V domains** and keeping them apart is now a copper problem rather than a naming problem, easy to break with one stray trace and invisible until something expensive fails. And **one part is 20 mm tall**, which is a constraint no board in this curriculum has had before.",
  ),
  {
    type: "callout", severity: "info", label: "The board: four copper layers",
    body: "Same stackup as every board in this line: **four copper layers at 1.6 mm total**. Signals live on the two outer layers, F.Cu and B.Cu. The two inner layers, In1.Cu and In2.Cu, are poured solid with ground and left alone. The sandwich reads F.Cu, prepreg, In1.Cu, core, In2.Cu, prepreg, B.Cu, adding up to 1.6 mm. Your starter set this.",
  },
  shot(
    "Four copper layers at 1.6 mm: signals outside, solid ground inside.",
    "KiCad Board Setup, Physical Stackup for the L1.03 board: 4 copper layers, 1.6 mm total, dielectric thicknesses visible.",
  ),
  check(
    "**Why leave the two inner layers as solid ground instead of routing on them?** Because a trace cut through a plane leaves a slot, and any signal crossing that slot has to find its return current the long way round. On a board this size the two outer layers have room, so keeping the planes whole costs nothing and removes a whole class of problem.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Set up the board", "Hands on. Rules before routing, every time."),
  sect("01", "Set up the fab's rules before you route", "Load PCBWay's limits first, so the checker measures against the factory that will build this."),
  prose(
    "A design rule check is only as honest as the numbers you give it. KiCad ships with permissive defaults no cheap fab can hold, so a board can pass DRC and still come back unbuildable. Loading the fab's own rule file first means every trace you draw is measured against what that factory can etch.\n\nThis is the same **PCBWay `.kicad_dru`** file you used on L1.01, from the same fab, and the zip is in the starter's KiCad folder. Its limits are deliberately **tighter** than PCBWay's own 4-layer limits: 0.127 mm trace and gap against their 0.09 mm, and a 0.5 mm minimum via against their 0.45 mm. A board that clears these clears either order.",
  ),
  does("load the rules, confirm the stackup and the classes", [
    {
      text: "Open **File, Update PCB from Schematic** (F8). Every part lands in a loose pile joined by thin white **ratsnest** lines. Each line is one connection you have not made yet.",
      proof: "The pile is on the board and the ratsnest is visible.",
    },
    {
      text: "**Board Setup, Physical Stackup:** confirm **4 copper layers** at **1.6 mm** total. Your starter set this, so you are checking rather than changing it.",
      proof: "Copper layers reads 4 and the stack adds up to 1.6 mm.",
    },
    {
      text: "**Board Setup, Design Rules, Net Classes:** confirm **Default at 0.25 mm** and **Power at 0.5 mm**, with **VBUS, +5V and +3V3** assigned to Power.",
      proof: "Two net classes exist: Default at 0.25 mm, and Power at 0.5 mm carrying VBUS, +5V and +3V3.",
    },
    {
      text: "**Now the one that is new.** This board has a fourth power net, **5V_EXT**, which did not exist on the earlier boards, so check it did not land in Default. Assign it to **Power** at minimum. A strip supply on a 0.25 mm signal trace is a heating problem, not a styling one.",
      proof: "5V_EXT appears in the Power net class, not in Default.",
    },
    {
      text: "Drop **PCBWay's `.kicad_dru`** beside the board file, renamed to the project, or paste its contents into **Board Setup, Design Rules, Custom Rules**. Open the panel and read it back.",
      proof: "The Custom Rules panel is not empty.",
    },
  ]),
  shot(
    "Custom Rules filled with the fab's rule text, not an empty panel.",
    "KiCad Board Setup, Design Rules, Custom Rules with the PCBWay .kicad_dru text loaded and visible.",
  ),
  tube("Set up the stackup, the net classes and the fab rules"),
  check(
    "**DRC passes with KiCad's defaults but your fab rejects the board. What happened?** You checked against KiCad's limits instead of the factory's. The defaults allow clearances a low-cost process cannot etch. Load the fab's rule file first and DRC starts telling you the truth.",
  ),
  dive(
    "How wide does 5V_EXT actually need to be?",
    "The Power class at 0.5 mm is a floor for this net, not automatically the right answer, because the current on it is set by how long a strip you decide to support rather than by anything on this board.\n\nThe screw terminals are rated far beyond anything you will ask of them, around 15 A, so **the copper is the limit, not the connector**. Trace width for a given current is a well-defined calculation: it depends on the current, the copper weight the fab uses, whether the trace is on an outer or inner layer, and how much temperature rise you are willing to accept.\n\nWork it out for the strip current you intend to document, and use the wider of that answer and 0.5 mm. Do the same for the **ground return**, which carries exactly the same current back, and is the half people forget because ground feels free. The calculator below does the arithmetic.",
  ),
  { type: "calculator", slug: "pcb-trace-width", caption: "Size the 5V_EXT trace and its ground return for the strip current you intend to support" },

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Place every part", "Hands on. Placement decides how hard routing will be."),
  { type: "callout", severity: "info", label: "Keys · the KiCad 10 PCB-editor keys", body: "**M** move, **R** rotate, **F** flip to the other side, **E** edit properties, **V** drop a through via while routing, **X** start a track, **B** refill the zones. Hover and press." },
  sect("02", "Floor-plan before you route", "Where a part sits is a routing decision you make before you draw a single trace."),
  prose(
    "Placement is the cheapest optimisation on the board. A part in the right place makes its traces short and obvious. A part in the wrong place makes them long, forces vias, and pushes copper toward the antenna. You cannot route your way out of a bad floor plan.\n\nThis board has three placement constraints the earlier ones did not. **The two screw terminals want to be next to each other**, because 5V_EXT has to travel from J5 to J4 and every millimetre of that run is copper carrying the strip's full current. **Their wire exits must face away from the antenna**, because the wires you screw into them are conductors and they do not stop being conductors just because they are not on the board. And **C10 is about 20 mm tall**, so it needs vertical room and a note on the drawing.\n\nThe outline itself comes from the starter. Draw or confirm it on **Edge.Cuts**, using **Rectangle Properties, By Corners** with the rounded-rectangle option, corner at the origin, exactly as you did on L1.01. The **J2 and J3 header rows sit 25.4 mm apart**, one inch, because the module sits between them and needs the clearance; that spacing is set by the module and does not change from board to board.",
  ),
  table(
    ["Ref", "Part", "Where it goes"],
    [
      ["U1", "ESP32-S3-WROOM-1", "One short edge, antenna end overhanging the outline"],
      ["J1", "USB-C receptacle", "Opposite short edge, centred, inside its silkscreen"],
      ["D1", "USBLC6-2 ESD array", "Hard against J1, in the D+ and D- path"],
      ["R3, R4", "5.1 k CC pull-downs", "Beside J1's CC pins"],
      ["U3", "74AHCT125 shifter", "Between U1 and LED3, close to both"],
      ["LED3", "The onboard pixel", "On the face, visible, near U3"],
      ["J4, J5", "Screw terminals", "Adjacent, on the edge FURTHEST from the antenna"],
      ["C10", "1000 uF electrolytic", "Hard against J5. Tall: reserve the height"],
      ["D2", "TVS across 5V_EXT", "At J5, between the terminal and C10"],
      ["D3", "ESD on the data pin", "Hard against J4, with R8 beside it"],
    ],
  ),
  does("place it, constraints first", [
    {
      text: "**U1 first.** Antenna end overhanging a short edge, every castellated pad landed on the board. U1 is the biggest part and the antenna constrains where it can go, so nothing else gets a vote until it is placed.",
      proof: "U1 sits at one end, antenna overhanging, all castellated pads on copper.",
    },
    {
      text: "**J1 centred on the opposite edge**, inside its silkscreen outline, with **D1 hard against it** and R3 and R4 by the CC pins. The ESD array only protects what it sits in front of.",
      proof: "J1 is on the far edge with D1 tight against it.",
    },
    {
      text: "**The terminals next, as a pair.** Put **J4 and J5 adjacent** on the edge furthest from the antenna, with their wire openings facing off the board. Short J5-to-J4 copper is the whole reason they are neighbours.",
      proof: "J4 and J5 sit side by side, wire exits facing outward, on the edge away from U1's antenna.",
    },
    {
      text: "**C10 hard against J5**, so the reservoir is at the point the current enters rather than somewhere downstream of a length of trace. Then **D2 between J5 and C10**, so the clamp is also at the entry point.",
      proof: "C10 and D2 both sit within a few millimetres of J5.",
    },
    {
      text: "**Reserve C10's height.** Draw a **courtyard note or a keep-out marker on a documentation layer** showing roughly 10 mm across and 20 mm tall above the part. Nothing enforces this in DRC. It is a note to your future self and to whoever designs an enclosure.",
      proof: "A height note or marker for C10 exists on a documentation layer.",
    },
    {
      text: "**The signal chain in a line:** U1, then **U3**, then **R7**, then **LED3**, then **R8**, then **D3**, then **J4**. Placed in that order the data path is a short straight run and the routing is nearly automatic.",
      proof: "U3, LED3 and the two series resistors form a straight run from U1 towards J4.",
    },
    {
      text: "**Leave your iron room.** As you drop the 0805s near U1, U3 and J1, keep a couple of millimetres of clear space around each so your iron tip can reach every pad at assembly.",
      proof: "Every 0805 near U1, U3 and J1 has a couple of millimetres of clear space around it.",
    },
  ]),
  shot(
    "The floor plan: antenna clear at one end, terminals paired at the other, the data chain in a straight line.",
    "KiCad PCB editor, top view, all parts placed and nothing routed. U1 antenna overhanging one edge, J1 opposite, J4 and J5 adjacent at the far edge, U3 and LED3 between.",
  ),
  tube("Floor-plan the node: the antenna end, the terminal pair, and the data chain"),
  check(
    "**You place J4 and J5 at opposite ends of the board. What did that cost you?** Every millimetre between them is copper carrying the strip's full current, so a long run means wider traces, more voltage lost on the way, and more heat. Adjacent terminals make the high-current path as short as the board allows.",
  ),
  gotcha(
    "the wires are part of the layout",
    "A screw terminal's job is to hold bare wire, and those wires can be a metre long. Point a terminal's opening at the antenna end and you have effectively placed a length of conductor right where the radio radiates, even though nothing on the board moved. Face the openings off the board, on the edge away from U1.",
  ),
  { type: "partModel", mpn: "EEU-FM1C102", caption: "C10: the 1000 uF reservoir, and the first part in this curriculum with a height you have to plan for" },
  shot(
    "C10's height, reserved: a marked keep-out volume on a documentation layer.",
    "KiCad 3D viewer or PCB editor side view showing C10 standing proud of the board next to the low-profile SMD parts, with the documentation-layer height marker visible.",
  ),
  dive(
    "Where this board's outline actually comes from",
    "L1.01 gave you an exact rectangle to draw, because that board's shape was set by two 22-pin headers and the module between them and nothing else. This board carries more: two through-hole screw terminals with real bodies, a tall electrolytic, and a 14-pin buffer.\n\nSo **take the outline from the starter rather than from a number in this lesson**. Draw or confirm it on **Edge.Cuts** with **Rectangle Properties, By Corners**, rounded rectangle ticked, corner at the origin, which is the same method L1.01 taught. The one dimension that carries over unchanged is the **25.4 mm between the header rows**, because that is set by the module sitting between them rather than by anything else on the board.\n\nThis is worth noticing as a general habit. Board dimensions are an output of what you have to fit, not an input you choose first. When the parts list changes, the outline follows.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The antenna keep-out", "Copper near a PCB antenna detunes it. This lesson never keys the radio, and the rule still holds."),
  prose(
    "The ESP32-S3-WROOM-1 has its antenna printed on the module at one end, tuned assuming nothing conductive sits next to it. Put copper underneath or beside it and you shift its resonance and absorb the energy it is trying to radiate.\n\nThis board never turns the radio on. Draw the keep-out anyway, in full, for two reasons. Someone will use this board for something wireless later, because it is an ESP32 with every pin broken out. And a rule you follow only when it is convenient is not a habit, it is a coincidence.",
  ),
  does("fence the keep-out before any copper exists", [
    {
      text: "Select **Place, Draw Rule Areas**, then **trace the dashed box** already drawn around U1's antenna end. It sits on the `Cmts.User` layer: it is a guide, it excludes nothing by itself, and it never reaches the fab. Snap your rule area to its four corners.",
      proof: "A rule area covers the antenna end and reaches the board edge.",
    },
    {
      text: "In the **Rule Area Properties** dialog that opens, tick **all four copper layers** (F.Cu, In1.Cu, In2.Cu, B.Cu) **and both silkscreens**, then on the **Keepouts** tab tick **tracks, vias, pads and zone fills**. Zone fills is the one that stops the ground plane flooding through.",
      proof: "The rule area lists all four copper layers plus both silkscreens, with all four keepouts ticked.",
    },
    {
      text: "Confirm the **Edge.Cuts** outline stops short so the antenna end of U1 **overhangs** it. The module's antenna region should sit off the board, over air.",
      proof: "The board outline stops short of the antenna and the module overhangs it.",
    },
    {
      text: "**Then check what you just placed.** Neither screw terminal, neither of its wire exits, and no part of the 5V_EXT run should be anywhere near this area.",
      proof: "J4, J5 and the whole 5V_EXT run sit on the opposite side of the board from the keep-out.",
    },
  ]),
  shot(
    "The keep-out as a real rule area: four copper layers, silk, everything excluded, antenna overhanging.",
    "KiCad Rule Area Properties dialog over the antenna keep-out: F.Cu, In1.Cu, In2.Cu, B.Cu and both silkscreens ticked, Keepouts tab with tracks, vias, pads and zone fills ticked.",
  ),
  gotcha(
    "the pour will flood it if you let it",
    "A keep-out drawn without **zone fills** ticked looks correct until you run the ground pour, which then fills straight through it. Tick all four exclusions when you draw the area rather than after you notice the problem.",
  ),
  check(
    "**Nothing on this board uses Wi-Fi. Why draw the keep-out at all?** Because the board is an ESP32 with every pin broken out, so someone will eventually use it for something wireless, and by then the copper is fixed. A layout mistake you cannot detect on the bench today is still a layout mistake.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Decoupling caps go first, and close", "The capacitors that ride current spikes only work if they are near the pin."),
  prose(
    "A capacitor supplies current through the loop formed by its own pads, the traces, and the return path in the ground plane. The bigger the loop, the more inductance, and inductance is what resists a fast change in current. The same part moved 10 mm further from the pin works measurably worse.\n\nThis board has five decoupling caps and they are not all the same job. **C2 and C3** sit at U1, though as on L1.01 you cannot get them onto the pins: the WROOM is a module with its own decoupling at the die, its pads are castellations tucked under the body, and yours are the board-level reservoir rather than last-millimetre bypass. **C1** is the 3.3 V bulk. **C5 and C6** flank the regulator.\n\n**Two are new and both want to be tight.** **C8** at U3's supply pin and **C9** at LED3's. These are not module parts with internal help. They are bare silicon switching a fast edge, and the caps are genuinely the local supply.",
  ),
  does("place the decoupling before anything routes", [
    {
      text: "**C8 hard against U3's pin 14**, on the same side, with the shortest possible path to a ground via. This is the cap that lets the buffer make a clean fast edge.",
      proof: "C8 sits within a couple of millimetres of U3's supply pin.",
    },
    {
      text: "**C9 hard against LED3's pin 1.** The pixel's three colour channels switching is a small fast load, and C9 is what keeps that off the rail the buffer is using.",
      proof: "C9 sits within a couple of millimetres of LED3's supply pin.",
    },
    {
      text: "**C11 near where 5 V enters the board**, between the fuse and the loads it serves, so its charge is upstream of both U3 and the pixel.",
      proof: "C11 sits on the +5V rail between F1 and the U3 and LED3 cluster.",
    },
    {
      text: "**C2, C3 and C1** near U1 as on L1.01, and **C5 and C6** hard against U2's input and output pins. An LDO with its capacitors far away can oscillate.",
      proof: "C2, C3 and C1 sit near U1, and C5 and C6 are adjacent to U2's IN and OUT pins.",
    },
    {
      text: "Give every decoupling capacitor **its own ground via** right at its pad rather than sharing one further away.",
      proof: "Each decoupling cap has a ground via at its own pad.",
    },
  ]),
  shot(
    "Decoupling placement: C8 and C9 hard against their supply pins, each with its own ground via.",
    "KiCad PCB editor zoomed on U3 and LED3 with C8 and C9 placed tight to their supply pins, ground vias at each pad, ratsnest still showing.",
  ),
  check(
    "**Why do C8 and C9 want to be tighter to their pins than C2 and C3 do?** Because U3 and LED3 are bare silicon with no internal decoupling, so these caps really are the local supply. The module already carries decoupling at the die, so C2 and C3 are a board-level reservoir and cannot reach its pins anyway.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Route the copper", "Hands on. Important nets first, everything else after."),
  sect("05", "Layers, vias, and the layer pair", "Two outside layers for signals, two inside for solid ground."),
  prose(
    "Traces live on **F.Cu** and **B.Cu**. The two inner layers are poured solid with ground and left alone, which gives every signal a continuous return path directly beneath it.\n\nPressing **V** drops a through via and jumps you to the next layer in the **active layer pair**, so set that pair before you route: **Route, Set Layer Pair**, and choose **F.Cu / B.Cu**.\n\nYour starter ships three via presets: **1.0, 0.8 and 0.6 mm**. Use **0.8 mm** as the working size; it is what the reference board uses. **0.6 / 0.3 mm is the fab floor**, there for the cramped spots where 0.8 mm will not fit. Your stitching vias out in open copper stay big.",
  ),
  does("set up for routing", [
    {
      text: "Set the **layer pair** to **F.Cu / B.Cu** (**Route, Set Layer Pair**) so a via placed mid-route swaps between the two routing layers.",
      proof: "The layer pair selector reads F.Cu and B.Cu.",
    },
    {
      text: "Pick **0.8 mm** from the via-size dropdown as your working via. Keep **0.6 / 0.3 mm** in mind as the floor for tight spots.",
      proof: "The via preset reads 0.8 mm.",
    },
    {
      text: "Confirm the net classes are doing their job: traces should draw at **0.5 mm** on VBUS, +5V, +3V3 and 5V_EXT, and at **0.25 mm** on signals, without you picking a width.",
      proof: "Power nets draw at 0.5 mm and signals at 0.25 mm automatically.",
    },
  ]),
  tube("Set the layer pair, pick your via size, and understand the presets"),
  check(
    "**Your starter offers 1.0, 0.8 and 0.6 mm via presets. Which is the everyday one?** 0.8 mm, which is what the reference board uses. The 0.6 mm preset with its 0.3 mm drill is the fab floor, kept in reserve for the one or two cramped spots where a bigger via will not fit.",
  ),
  dive(
    "Why one via stitches all four layers",
    "A [[stitching via]] here is a plain **through via**: a plated barrel running from `F.Cu` all the way to `B.Cu`, passing straight through both inner planes. Because all four coppers on this board are the same GND net, **one via ties all four at once**.\n\nThat is why you never set a layer pair or reach for a blind or buried via to stitch. Those types exist to connect some layers but not others, and they cost more to fabricate. It also answers the natural worry about the two inner planes: you do not add dedicated In1-to-In2 vias, because every through stitch already ties them.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  sect("06", "The USB data pair", "D+ and D- are a matched pair and want to be treated as one object."),
  prose(
    "USB full-speed signalling is differential: the receiver reads the difference between D+ and D-, not either one against ground. That only works if the two traces experience the same thing, so they are routed together, the same length, the same distance apart, over unbroken ground.\n\nThe path is short: **J1 to D1 to U1's IO19 and IO20**. Route it before anything else competes for the space.",
  ),
  does("route D+ and D- as a pair", [
    {
      text: "Start at **J1**, route through **D1** so the ESD array sits in the path, and finish at U1's **IO19 and IO20**. Protection only works upstream of what it protects.",
      proof: "Both data traces pass through D1 between J1 and U1.",
    },
    {
      text: "Use **Route, Differential Pair**. Start on one pad and KiCad lays both traces together, matched and spaced, as you move.",
      proof: "Both traces were drawn in one pass and run parallel at a constant gap.",
    },
    {
      text: "Keep the pair **short** and **over unbroken ground**, and do not let a via or another trace split the plane beneath it.",
      proof: "The plane under the pair is continuous along its whole length.",
    },
  ]),
  gotcha(
    "shrink the GND via at D1, or the pair won't route",
    "The space around D1 is the tightest on the board, and a full-size ground via at its GND pad can leave the differential pair with nowhere to go. This is exactly what the **0.6 / 0.3 mm** preset is for: shrink that one via to the fab floor and the pair fits. Only that cramped via shrinks; the stitching vias out in open copper stay at 0.8 mm.",
  ),
  shot(
    "The USB pair routed together through D1, short and over unbroken ground.",
    "KiCad PCB editor zoomed on J1 to D1 to U1, differential pair visible as two parallel traces at constant spacing, inner ground plane continuous beneath.",
    "See it wired · the USB pair",
  ),
  check(
    "**Why route the two data lines with the differential-pair router instead of one at a time?** Drawing them separately gives you two traces that happen to be near each other, with different lengths and a varying gap. The receiver reads the difference between them, which only works if both see the same thing.",
  ),

  // ── 07 ────────────────────────────────────────────────────────────────────
  sect("07", "The pixel data path", "Short, damped at the driver, and nowhere near the antenna."),
  prose(
    "The data path is the point of this board and it is three hops: **U1's IO5 to U3's input**, **U3's output through R7 to LED3's DIN**, and **LED3's DOUT through R8 out to J4**. All of it is on the 0.25 mm Default class, because a data line carries almost no current.\n\nTwo placement rules make the difference between a clean edge and a marginal one. **Each series resistor goes at its driver, not at its receiver.** R7 belongs next to U3's output pin, and R8 next to LED3's DOUT. The resistor is damping energy at the source, and a resistor at the far end of a long trace has already let the reflection happen.\n\n**R8 is the exception worth noting.** The design also wants it close to J4, because the trace beyond it leaves the board and picks up interference. With LED3, R8 and J4 all in one short run, both wishes are satisfied at once, which is precisely why the floor plan put them in a line.\n\n**TP3** sits on the shifted line between U3 and R7. Give it a real, probe-sized pad you can land a scope tip on, and put it somewhere your hand can reach with the board powered.",
  ),
  does("route the data chain", [
    {
      text: "**IO5 into U3.** Route from U1's IO5 pad to U3's input pin. This one is still 3.3 V logic, so it is an ordinary signal trace.",
      proof: "A 0.25 mm trace runs from U1's IO5 to U3's data input pin.",
    },
    {
      text: "**U3's output to R7 to LED3's DIN.** Keep the run short and on one layer if you can. A via in a data path is not fatal, but each one is a small discontinuity and this path does not need any.",
      proof: "The shifted data line reaches LED3's DIN through R7 with no unnecessary via.",
    },
    {
      text: "**Put R7 at U3's end** of that run, not at the pixel's end. Damping works at the source.",
      proof: "R7 sits within a few millimetres of U3's output pin.",
    },
    {
      text: "**LED3's DOUT through R8 to J4.** Same rule, and here it lands naturally: R8 near LED3's output *and* near J4, because the floor plan put them adjacent.",
      proof: "R8 sits between LED3 and J4 with a short trace on both sides.",
    },
    {
      text: "**D3 hard against J4's data pin.** An ESD clamp protects what is behind it, so it belongs between the connector and everything else, exactly as D1 does at the USB port.",
      proof: "D3 sits between J4's data pin and R8, closer to J4.",
    },
    {
      text: "**Route TP3 off the shifted line** between U3 and R7, and check it is somewhere you can physically probe with the board powered and the strip connected.",
      proof: "TP3 connects to the shifted data net and is reachable with a probe.",
    },
  ]),
  tube("Route the pixel data chain and place the damping resistors at their drivers"),
  shot(
    "The data chain: U3, R7, the pixel, R8, D3, J4, in one short straight run.",
    "KiCad PCB editor zoomed on the data path from U3 through R7 to LED3 to R8 and D3 to J4, showing the series resistors at their driver ends and the short overall run.",
    "See it wired · the pixel data path",
  ),
  check(
    "**Why does a series damping resistor go at the driver rather than at the receiver?** Because it is damping the energy the driver puts into the trace. Put it at the far end and the reflection has already travelled the whole line and come back before the resistor sees it.",
  ),

  // ── 08 ────────────────────────────────────────────────────────────────────
  {
    type: "callout", severity: "warn", label: "08 · The strip power path, and the isolation you must not break",
    body: "The one thing on this board that DRC will not check for you unless you tell it to.",
  },
  prose(
    "**5V_EXT enters at J5 and leaves at J4, and that is its entire journey.** It touches C10, it touches D2, and it touches nothing else on the board, ever. Its ground return shares the board's ground, which is the whole point.\n\nOn the schematic that isolation was a naming discipline: keep a `+5V` port off the wrong pin. **In copper it is easier to break**, because copper does not have names. A pour that reaches where it should not, a trace routed on autopilot, a via placed on the wrong net, and two supplies are joined. The board will still pass a default DRC, because joining two nets that are not marked as needing separation is not an error KiCad knows about.\n\nSo you tell it. This board's own design review lists exactly one validation item as still owed at layout stage, and this is it: **a rule that proves VBUS and 5V_EXT are never joined.** You are the one who closes it.",
  ),
  does("route the strip power path and prove it stays separate", [
    {
      text: "**Route 5V_EXT from J5 to J4** on the Power class, at the width you calculated, keeping the run as short and direct as the floor plan allows.",
      proof: "A single 5V_EXT trace runs from J5 to J4 at 0.5 mm or wider.",
    },
    {
      text: "**Route C10 and D2 onto it right at J5**, both with short, fat connections. C10's whole value is being able to deliver current fast, and a thin trace to it undoes that.",
      proof: "C10 and D2 connect to 5V_EXT with short wide traces at J5.",
    },
    {
      text: "**Now add the rule.** In **Board Setup, Design Rules, Custom Rules**, add a clearance rule between the `5V_EXT` net and the `VBUS` and `+5V` nets, set generously wide. A rule with a large clearance turns any accidental approach into a DRC error you cannot miss.",
      proof: "A custom rule exists naming 5V_EXT against VBUS and +5V with a wide clearance.",
    },
    {
      text: "**Run DRC now**, before the pour, rather than at the end. If the rule fires, you want to know while there is still empty board to move things into.",
      proof: "A DRC run with the new rule in place reports no 5V_EXT clearance violations.",
    },
    {
      text: "**Then look at it.** Use the net highlight tool (hover a 5V_EXT trace and press **`**) and confirm the highlighted copper touches exactly four things: J5, C10, D2 and J4.",
      proof: "Highlighting 5V_EXT lights up only J5, C10, D2, J4 and the trace between them.",
    },
  ]),
  tube("Route 5V_EXT and write the clearance rule that proves the isolation"),
  shot(
    "5V_EXT highlighted: a short run from J5 to J4 touching only C10 and D2, with the board's own 5 V nowhere near it.",
    "KiCad PCB editor with the 5V_EXT net highlighted, showing the isolated run from J5 through C10 and D2 to J4 and no contact with VBUS or +5V copper.",
    "See it wired · the isolated strip rail",
  ),
  check(
    "**Default DRC passes and the two 5 V rails are touching. Why did it not complain?** Because two nets that overlap are only an error if a rule says they must not be. Clearance rules are the mechanism for encoding intent that the geometry alone does not carry, and writing that rule is what turns an invariant into something the tool can check.",
  ),
  dive(
    "Why the ground return matters as much as the trace",
    "It is easy to size the 5V_EXT trace carefully and then let its return current find its own way home through the ground pour, on the assumption that a plane is effectively zero resistance. It is not, and on this board the assumption has a specific consequence.\n\nThe strip's supply current goes out through 5V_EXT and comes back through **ground**. That is real current, potentially amps, flowing through your ground copper. Any resistance it crosses produces a voltage difference between one part of your ground and another, and one of the things referenced to that ground is **the data line the strip is reading**. Push enough current through a thin ground path and you shift the reference under your own signal.\n\nThe fix is a placement one, and it is why the design specifies a **star ground at J5 and C10**: bring the strip's ground return to one point, right where the external supply lands, so the surge from C10 charging and the strip's steady draw both settle there instead of travelling across the board through the copper your logic is referenced to.",
  ),

  // ── 09 ────────────────────────────────────────────────────────────────────
  sect("09", "Route the rest: power first, then signals", "Wide metal where the current is, short metal where the speed is."),
  prose(
    "With the pair and the data chain done, route the board's own power: **VBUS from J1 through F1 to the +5V rail**, then **+5V to U2's input, to U3's pin 14 and to LED3's pin 1**, then **+3V3 from U2's output to U1 and the headers**. All on the Power class at 0.5 mm.\n\nNote what that middle step means physically: the +5V rail now fans out to three destinations instead of one. Route it as a short trunk with branches rather than a daisy chain that visits the regulator, then the buffer, then the pixel in series, because a daisy chain puts the pixel's current pulses through the copper feeding everything upstream of it.\n\nThe rest is low speed and forgiving: the EN and BOOT networks, the LED strings, and the header pins. Keep them short, avoid crossing the plane, and stay out of the keep-out.",
  ),
  does("route in order of consequence", [
    {
      text: "**VBUS:** J1 to F1. Then **+5V** from F1 out to **U2's IN, U3's pin 14 and LED3's pin 1**, as a trunk with branches rather than a chain.",
      proof: "Every +5V destination is fed from a common trunk rather than in series through its neighbours.",
    },
    {
      text: "**+3V3:** U2's output to U1 and to the header rail positions.",
      proof: "Both rails are routed at 0.5 mm and no power trace is on the Default class.",
    },
    {
      text: "**EN and BOOT:** R1 with C7 to U1's EN, R2 to IO0, each with its button to ground. Keep C7 close to the EN pin.",
      proof: "EN and BOOT networks are routed with C7 near the EN pin.",
    },
    {
      text: "**The indicator LEDs:** +3V3 through R5 to LED1, and IO2 through R6 to LED2.",
      proof: "Both indicator LED strings are routed and the ratsnest for them is empty.",
    },
    {
      text: "**The headers:** every remaining module pin out to its position on J2 or J3.",
      proof: "Every header pin is connected and the ratsnest is empty.",
    },
  ]),
  gotcha(
    "a daisy chain is not a trunk",
    "It is tempting to route +5V from the fuse to the regulator, then on from the regulator's pad to the buffer, then on again to the pixel, because each hop is short and the ratsnest looks satisfied. Do not. That puts the pixel's 60 mA current pulses through the same copper feeding the regulator, so every colour change becomes a small disturbance upstream. Run a trunk from the fuse and branch off it.",
  ),
  check(
    "**Why route +5V as a trunk with branches rather than part to part?** Because in a chain, every load's current pulses travel through the copper feeding everything upstream of it. A trunk gives each load its own path back to the source, so the pixel's switching does not show up at the regulator's input.",
  ),
  band("do", "in KiCad · Label the breakout pins", "Hands on. The silkscreen is the only documentation that ships with the board."),
  does("silkscreen that keeps a user honest", [
    {
      text: "Label every **header position** with its pin name, outside the header footprint so a seated jumper does not hide it.",
      proof: "Every header position has a legible label outside the footprint.",
    },
    {
      text: "**Mark J5 clearly: 5 V only, regulated, 5.25 V maximum, and not 12 or 24 V.** Mark the polarity of both positions. This is the label that stands between a user and a destroyed board.",
      proof: "J5 carries a 5 V only warning and a polarity mark.",
    },
    {
      text: "**Distinguish the two 5 V nets by name on the silk:** the header's convenience rail is the board's USB 5 V, and J5 and J4 are the strip's 5V_EXT. Someone who cannot tell them apart will eventually bridge them with a jumper wire.",
      proof: "The silkscreen names the two 5 V rails differently.",
    },
    {
      text: "**Mark LED3's data direction**, DIN and DOUT, and its pin 1. Mark **C10's and D2's polarity**. Mark **TP3**.",
      proof: "LED3's direction and pin 1, C10 and D2 polarity, and TP3 are all marked.",
    },
    {
      text: "Label J4's three positions **5V, DATA, GND** in the order they physically sit, so a user wiring a strip does not have to count.",
      proof: "J4's three positions are individually labelled in physical order.",
    },
  ]),
  shot(
    "The silkscreen doing its job: J5 warned and polarised, J4's three positions named, the pixel's direction marked.",
    "KiCad PCB editor, silkscreen layers visible around J4, J5 and LED3, with the 5 V only warning, polarity marks and the DIN and DOUT direction all legible.",
  ),

  // ── 10 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Pour & stitch the ground", "Hands on. Fill the leftover copper and tie the layers together."),
  sect("10", "Pour and stitch the ground, with a star at J5", "Ground is a surface you flood and then connect between layers. On this board one point on it matters more than the rest."),
  prose(
    "Pour ground on all four layers: the two inner ones become solid planes, and the leftover space on the outer layers fills in around your traces. Then stitch: drop plain through vias that tie the outer ground to the inner planes, so return current can get where it needs to go without going around.\n\nStitch densely near the parts that switch current fastest, which here means around U1, U3, LED3 and the decoupling. Two ties matter most: vias under U1's centre pad, and a cluster at **J5 and C10**, which is where the strip's return current arrives and where you want it to settle rather than wander.\n\nThe one place that gets no ground at all is inside the keep-out.",
  ),
  does("flood it, then tie it together", [
    {
      text: "Add a **ground zone on each of the four copper layers**, covering the board outline.",
      proof: "Four ground zones exist, one per copper layer.",
    },
    {
      text: "Press **B** to fill. Then look at the result rather than trusting it: check the inner planes are genuinely solid and the fill respected the keep-out on every layer.",
      proof: "All four zones filled and the antenna keep-out is empty on every layer.",
    },
    {
      text: "**Stitch** with through vias around U1, under its centre pad, near each decoupling capacitor, around U3 and LED3, and along the board edges.",
      proof: "Stitching vias tie F.Cu and B.Cu ground to the inner planes around U1, U3, LED3 and the caps.",
    },
    {
      text: "**The star at J5.** Put a tight cluster of ground vias at J5's ground position and C10's negative pad, so the external supply's return has a low-impedance path straight into the planes at the point it arrives.",
      proof: "A cluster of ground vias sits at J5's ground pad and C10's negative pad.",
    },
    {
      text: "**Confirm the pour did not join your rails.** Re-run DRC after filling. A zone can reach places a trace never would, so the isolation rule you wrote earlier earns its keep right here.",
      proof: "DRC after the pour reports no 5V_EXT clearance violations.",
    },
    {
      text: "Refill (**B**) after the last via. A zone that was nudged and never refilled ships as whatever it looked like before you moved it.",
      proof: "Zones refilled after the final edit.",
    },
  ]),
  shot(
    "The poured and stitched ground, notched out at the antenna and starred at J5.",
    "KiCad PCB editor showing all four ground zones filled, stitching vias around U1, U3 and LED3, a cluster at J5 and C10, keep-out empty of copper on every layer.",
  ),
  tube("Pour and stitch the ground, and star it at the injection terminal"),
  check(
    "**Why put a tight cluster of ground vias at J5 rather than relying on the pour to carry the return?** Because the strip's whole return current lands there, and a pour is not zero resistance. A dense via cluster gets that current into the inner planes at the point it arrives, instead of letting it travel across the copper your data line is referenced to.",
  ),
  dive(
    "What the pour is actually for on a board like this",
    "The two inner layers being solid ground is the part that does the electrical work: every outer-layer signal has a continuous return path directly under it, and a return path that mirrors the signal keeps the loop small.\n\nThe **outer-layer pours** are a different, more modest thing. They fill the space your traces did not use, which gives you somewhere convenient to ground a nearby part without running a trace to find one, and adds a little copper for heat to spread into. They are useful rather than load-bearing.\n\nThat distinction matters when you are deciding what to worry about. A gap in an outer pour is cosmetic. A **slot cut through an inner plane** is not: any signal crossing it has to find its return current the long way round, and on this board the signal most likely to be crossing something is the one this whole lesson exists for.",
  ),
  gotcha(
    "a zone you nudged and never refilled",
    "KiCad shows the last computed fill, not the current one. Move a trace after filling and the display can still show the old copper. Press **B** before you look, and again before you export. On this board that habit has teeth, because the thing a stale fill can hide is a pour that bridged your two 5 V rails.",
  ),

  // ── check ─────────────────────────────────────────────────────────────────
  band("check", "Eyeball what DRC can't catch", "Verify. The checker measures distances against rules. It does not understand intent."),
  prose(
    "DRC compares your board against the fab's numbers and against the rules you wrote. It cannot tell you the keep-out is in the wrong place, that a terminal faces the antenna, or that C10 will not fit in the enclosure you have in mind. Those are intent, and intent is what the answer key is for.",
  ),
  {
    type: "image", src: "", aspect: "16:10", zoom: true,
    alt: "The finished L1.03 layout: all four layers visible, the antenna keep-out notched out, the data chain in a straight run, the isolated 5V_EXT path from J5 to J4, and the stitched ground.",
    caption: "The answer key: placement, routing, pour and keep-out on the finished board.",
    captureHint: "Hi-res top view of the completed L1.03 layout with all four layers visible, for learners to compare their board against. Full board, labels legible when zoomed.",
  },
  trace("Check these against the answer key before your final DRC", [
    { text: "**5V_EXT touches only J5, C10, D2 and J4**, on every layer including the pours", help: "This is the invariant. Highlight the net and look, on all four layers, after the final refill. A pour reaches places a trace never would." },
    { text: "**J5 pin 2's ground reaches the planes through a tight via cluster**", help: "The strip's whole return current lands here. A thin path shifts the reference under your own data line." },
    { text: "**U1's antenna end overhangs the outline and no copper sits in the keep-out on any layer**", help: "This lesson never keys the radio, so nothing will tell you if you got it wrong. Someone will use the board for Wi-Fi later." },
    { text: "**No screw terminal, and no wire exit, points at the antenna end**", help: "The wires people screw in are conductors too, and DRC cannot see anything that is not on the board." },
    { text: "**R7 sits at U3's output and R8 at LED3's output**, each at its driver", help: "A damping resistor at the receiving end has let the reflection happen already. Placement is the whole mechanism." },
    { text: "**C10 has its height reserved on a documentation layer**", help: "It stands about 20 mm proud. Nothing in DRC checks the third dimension." },
    { text: "**The USB pair runs J1 to D1 to U1, short, over continuous plane**", help: "Routing around D1 instead of through it leaves the data lines unprotected." },
    { text: "**Silkscreen warns 5 V only at J5 and marks both polarised parts**", help: "The silkscreen is the only documentation that ships with the board, and it is the last thing standing between a user and a 12 V mistake." },
  ]),

  // ── DRC ───────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Run DRC to zero & export", "Hands on. Clean, or every flag understood and written down."),
  sect("11", "Run DRC", "Clear it to zero, or know exactly why each remaining flag is safe."),
  does("run it, read it, clear it", [
    {
      text: "**Inspect, Design Rules Checker, Run DRC.** Leave **Test for parity between PCB and schematic** ticked.",
      proof: "DRC has run and the violation list is on screen.",
    },
    {
      text: "Fix what it finds, **refill the zones (B)**, and run again. Repeat until it reads **0 violations, 0 unconnected items**.",
      proof: "DRC reports 0 violations and 0 unconnected items.",
    },
    {
      text: "**Confirm your isolation rule actually ran.** Temporarily route a stub of 5V_EXT toward the +5V rail, run DRC, watch it fire, then delete the stub. A rule you never saw trigger is a rule you are only assuming works.",
      proof: "The isolation rule was seen to fire on a deliberate violation and the board is clean again after removing it.",
    },
    {
      text: "If a flag comes from the stock module footprint rather than your work, use **Exclude** and write down why. An excluded flag you cannot explain is a flag you have not understood.",
      proof: "Any remaining flags are excluded with a written reason.",
    },
  ]),
  shot(
    "DRC reporting zero violations and zero unconnected items against the fab's rules.",
    "KiCad Design Rules Checker dialog showing 0 violations and 0 unconnected items, with the PCBWay rule file and the 5V_EXT isolation rule both loaded.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: layout",
    gate: true,
    questions: [
      {
        id: "isolation-needs-a-rule", reviewId: "l103-isolation-rule",
        q: "Your two 5 V rails end up touching after the ground pour, and DRC passes. Why?",
        options: [
          "DRC only checks trace widths",
          "Two nets overlapping is only an error if a rule says they must stay apart, so you have to write that rule",
          "Pours are exempt from DRC",
        ],
        answer: 1,
        explain: "A clearance rule between 5V_EXT and the board's 5 V nets is how you encode an intent the geometry does not carry. It is the one validation item this board's design review still lists as owed at layout.",
      },
      {
        id: "terminals-adjacent",
        q: "Why do J4 and J5 belong next to each other?",
        options: [
          "It looks tidier",
          "So one screwdriver reaches both",
          "Every millimetre between them is copper carrying the strip's full current, so a short run means less width, less voltage lost and less heat",
        ],
        answer: 2,
        explain: "The terminals themselves are rated far beyond what you will ask of them. The board copper between them is the limit.",
      },
      {
        id: "damping-at-driver",
        q: "Where does a series damping resistor belong on a data line?",
        options: [
          "At the driver, because it is damping the energy the driver puts into the trace",
          "At the receiver, so it protects the input",
          "Halfway along, to split the difference",
        ],
        answer: 0,
        explain: "Put it at the far end and the reflection has already travelled the whole line and come back before the resistor sees it.",
      },
      {
        id: "ground-return-current", reviewId: "l103-ground-return",
        q: "The strip's supply current returns through your board's ground. Why does that matter?",
        options: [
          "It does not. A ground plane has no resistance",
          "It heats the board evenly",
          "Real current across real resistance makes one part of ground sit at a different voltage from another, and your data line is referenced to that ground",
        ],
        answer: 2,
        explain: "That is why the design specifies a star ground at J5 and C10: bring the return to one point where the supply lands, rather than letting it wander across the copper your logic references.",
      },
      {
        id: "keepout-all-layers",
        q: "Which layers does the antenna keep-out rule area need to cover?",
        options: [
          "The top layer only",
          "All four copper layers, plus both silkscreens",
          "The top and bottom layers",
        ],
        answer: 1,
        explain: "An inner ground plane under the antenna detunes it just as effectively as a top-layer trace, and the zone-fills keepout is what stops the pour flooding through.",
      },
      {
        id: "fab-rules-first",
        q: "Why load the fab's rule file before you start routing?",
        options: [
          "KiCad runs faster with custom rules loaded",
          "It is required before you can place parts",
          "So DRC measures against what the factory can actually etch, not KiCad's permissive defaults",
        ],
        answer: 2,
        explain: "A board can pass DRC on defaults and still be unbuildable. Loading the fab's numbers first means every trace is checked against the real process.",
      },
      {
        id: "via-preset-floor",
        q: "You are routing the USB pair past D1 and a full-size ground via leaves no room. What do you do?",
        options: [
          "Shrink that one via to the 0.6 / 0.3 mm fab floor and leave the stitching vias at 0.8 mm",
          "Shrink every via on the board to 0.6 / 0.3 mm",
          "Route the pair on an inner layer instead",
        ],
        answer: 0,
        explain: "The fab floor exists for cramped spots. Vias out in open copper have no reason to be small, and bigger ones are more robust.",
      },
      {
        id: "refill-zones",
        q: "You move a trace after pouring the ground, then export. What is the risk?",
        options: [
          "The zone refills automatically, so there is none",
          "KiCad shows the last computed fill, so the copper you exported may not match what you see, and on this board a stale fill can hide a pour that bridged the two 5 V rails",
          "The board outline changes size",
        ],
        answer: 1,
        explain: "Press B to refill before you look and again before you export, then re-run DRC so the isolation rule gets a look at the copper you are actually shipping.",
      },
      {
        id: "tall-part",
        q: "C10 stands about 20 mm proud of the board. What does DRC say about that?",
        options: [
          "It flags a height violation",
          "It checks it against the courtyard",
          "Nothing. DRC works in two dimensions, so the height is a note you leave on a documentation layer for yourself and whoever designs an enclosure",
        ],
        answer: 2,
        explain: "Mechanical constraints are real constraints, and this is the first board in the curriculum to have one worth writing down.",
      },
    ],
  },

  exit(
    "You have a placed, routed, poured board that passes DRC against the fab's own rules, with the antenna keep-out fenced on all four layers and, new to this board, a written rule proving the two 5 V domains never meet. Attach the DRC report. That isolation rule closes the one validation item this board's design left owed until layout, so it is worth being able to say you saw it fire. Next stage exports the Gerbers the fab will build from, and those come from exactly this board file.",
  ),

  ref("ESP32-S3 Hardware Design Guidelines (Espressif): PCB layout, ground return paths and antenna keep-out", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/"),
  ref("USB 2.0 specification (USB-IF): full-speed signalling and the D+ and D- differential pair", "https://www.usb.org/document-library/usb-20-specification"),
  ref("KiCad 10 documentation: design rules, rule areas, custom rules and zone filling", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
  ref("IPC-2221B generic standard on printed board design: conductor width and current-carrying capacity", "https://www.ipc.org/TOC/IPC-2221B.pdf"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "LAYOUT", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
