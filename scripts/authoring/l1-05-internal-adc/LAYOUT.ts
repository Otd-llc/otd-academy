// L1.05 internal ADC — LAYOUT card.
//
// Authored ahead of the board from docs/boards/l1-05-internal-adc/{design.md,
// bom.csv,validation-log.md}. RK11 (antenna keep-out) and RK12 (analog routing
// and ground, plus a screwdriver-access keep-out around RV1) are the two risks
// this card is responsible for closing.
//
// L1.01's LAYOUT card is gospel for everything the boards share: 4 copper
// layers at 1.6 mm, Default 0.25 mm and Power 0.5 mm net classes, PCBWay's
// .kicad_dru loaded into Custom Rules, the 1.0 / 0.8 / 0.6 mm via presets with
// 0.6 mm annulus and 0.3 mm drill as the fab floor, the F.Cu / B.Cu layer pair,
// the Rule Area keep-out on all four coppers and both silks, the differential
// pair, the pour and stitch, and the DRC-to-zero flow.
//
// The card this replaces was 7 blocks against the 96-block bar and ran the
// whole stage "at recall speed".
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Layout: placing and routing a board that has to measure well"),

  band("orient", "How layout works on a measuring board", "Read this once with KiCad closed. Four layers, two of them solid ground, and one new job: a high-impedance analog node that picks up whatever runs beside it."),
  prose(
    "Layout is where the schematic meets physics. The same circuit can work perfectly or measure badly depending on where the parts sit and how the copper flows between them. You do it in five moves: **set up** the board to your fab's rules, **place** the parts, **route** the copper, **pour** the ground, then **confirm** by eye and with DRC.\n\nThis board reuses L1.01's core exactly, so most of it is muscle memory. Three things are genuinely new, and all three are placement decisions rather than routing ones. **C8 has to sit at the ADC pin**, and 'at the pin' is a distance you can measure on screen. **The analog run has to stay away from the USB pair and the antenna**, because a high-impedance node picks up its neighbours. And **RV1 has to be reachable by a screwdriver while the board is running and the console is visible**, which is an ergonomic constraint that only exists because the lesson is sweep-and-watch.",
  ),
  shot(
    "Four layers: signals on the two outsides, solid ground on the two insides, 1.6 mm overall.",
    "KiCad Board Setup > Physical Stackup for the L1.05 board: 4 copper layers totalling 1.6 mm, F.Cu, prepreg, In1.Cu, core, In2.Cu, prepreg, B.Cu all legible.",
  ),
  dive(
    "The return path is half the circuit, and all of the measurement",
    "Current cannot go anywhere without a way back: every signal travels in a loop, out along the trace and home through ground. A solid ground plane lets that return flow directly underneath the trace, for the smallest possible loop. Small loop means low inductance, which means a clean signal and a rail that does not sag.\n\nOn a measuring board there is a second reason to care. Your analog node is a high-impedance point being read against ground, so anything that makes the ground under it noisy shows up directly in the number. Keeping the two inner planes whole is not just about signal integrity here. It is about whether the reading you take is the reading the pot produced.",
  ),

  {
    type: "callout", severity: "info", label: "Keys · the KiCad 10 PCB-editor keys",
    body: "A few keys do most of the work: hover and press. See them all under **Help ▸ List Hotkeys**, and change them in Preferences ▸ Hotkeys.",
  },
  table(
    ["Key", "What it does"],
    [
      ["T", "Get and move footprint: type any refdes and that part jumps to your cursor"],
      ["X", "Route a track"],
      ["V", "Drop a via mid-route and swap to the other layer of the pair"],
      ["M / R / D", "Move, rotate, drag a part (D keeps tracks attached)"],
      ["B", "Fill all copper zones (the pour)"],
      ["E", "Edit properties: track width, via size, zone net"],
    ],
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Set up the board", "Hands on. Rules before routing, every time."),
  sect("01", "Set up PCBWay's rules before you route", "Load the factory's limits first so the checker measures against the shop that will actually build this."),
  prose(
    "A design rule check is only as honest as the numbers you give it. KiCad ships permissive defaults no cheap fab can hold, so a board can pass DRC and still come back unbuildable. Load **PCBWay's** own rule file first and every trace you draw is measured against what that factory can etch.\n\nIt is the same file you used on L1.01, from the same shop. Rename it to match this project's stem and drop it beside the `.kicad_pcb`, or paste its contents into **Board Setup ▸ Design Rules ▸ Custom Rules**. KiCad only auto-loads a `.kicad_dru` whose name matches the project, which is why the filename has to be exact.",
  ),
  table(
    ["Rule", "What it means", "PCBWay's floor"],
    [
      ["Min track width", "The thinnest copper trace they can reliably etch", "0.15 mm"],
      ["Min clearance", "Smallest gap between two coppers before they risk shorting", "0.15 mm"],
      ["Min hole / drill", "Smallest hole their drill makes", "0.3 mm"],
      ["Min annular ring", "The copper collar around a hole that survives a slightly off drill", "0.15 mm"],
    ],
  ),
  does("load the rules, confirm the stackup and the net classes", [
    {
      text: "Run **Tools ▸ Update PCB from Schematic** (or press **F8** in the board editor). Every footprint lands in a loose pile joined by thin white **ratsnest** lines. Each line is one connection you have not made yet.",
      proof: "A PCB window is open with every footprint dropped in one pile and the ratsnest visible.",
    },
    {
      text: "Drop **PCBWay's `.kicad_dru`** beside the board file, renamed to the project stem, then open **Board Setup ▸ Design Rules ▸ Custom Rules** and read it back. A non-empty panel is the pass; empty means the filename does not match.",
      proof: "The Custom Rules panel is not empty.",
    },
    {
      text: "**Board Setup ▸ Board Stackup ▸ Physical Stackup:** copper layers reads **4** and the stack totals **1.6 mm**. The two inner layers are solid ground and the two outer ones carry your signals.",
      proof: "Copper layers reads 4 and the stack adds up to 1.6 mm.",
    },
    {
      text: "**Board Setup ▸ Net Classes:** confirm **Default at 0.25 mm** and **Power at 0.5 mm**, with **VBUS, +5V and +3V3** assigned to Power. Nothing to type; the starter set both.",
      proof: "Two net classes exist: Default at 0.25 mm and Power at 0.5 mm carrying the three rails.",
    },
    {
      text: "Confirm the **via presets**: **1.0 mm**, **0.8 mm** and **0.6 mm** are all available, with **0.6 mm annulus and 0.3 mm drill** as the fab floor you can reach for when space is tight.",
      proof: "Three via sizes are selectable and the smallest reads 0.6 mm with a 0.3 mm drill.",
    },
  ]),
  shot(
    "Custom Rules filled with the fab's rule text, not an empty panel.",
    "KiCad Board Setup > Design Rules > Custom Rules, scrolled to the top with several rule lines from the PCBWay .kicad_dru visible. A non-empty panel is the pass.",
  ),
  tube("Set up the stackup, the net classes and the fab rules"),
  check(
    "**DRC passes with KiCad's defaults but your fab rejects the board. What happened?** You checked against KiCad's limits rather than the factory's. The defaults allow clearances a low-cost process cannot etch. Load the fab's rule file first and DRC starts telling you the truth.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "Draw the outline, then pin the anchors", "Four parts sit at exact coordinates because they have to line up with the outside world."),
  prose(
    "The board outline goes on the **Edge.Cuts** layer, and four parts get placed by coordinate before anything else moves: **U1** at the top with its antenna end overhanging the short edge, **J1** centred on the bottom edge, and **J2 / J3** down the two long sides. The header rows still sit **25.4 mm** apart, because the module still sits between them and the pads still have to stay clear of the board edge.\n\nEverything else, including the whole analog cluster, you place by hand around those four.",
  ),
  does("outline and anchors", [
    {
      text: "Pick **Edge.Cuts** in the layers panel and draw the board outline the starter defines, with rounded corners. Starting the rectangle at the origin lets you type dimensions directly in **Rectangle Properties**.",
      proof: "A closed outline sits on the Edge.Cuts layer with rounded corners.",
    },
    {
      text: "Press **E** on **U1** and set its position so the **antenna end overhangs the top short edge**, with every castellated pad still landing on the board.",
      proof: "U1 sits at the top, antenna overhanging, all castellated pads on copper.",
    },
    {
      text: "Place **J1** centred on the bottom edge, its metal shell just off the board with the pads well inside, and **J2 / J3** down the two long sides, **25.4 mm** apart, J3 rotated 180 degrees so its pin order matches the ratsnest.",
      proof: "The two header rows sit 25.4 mm apart with a clean ratsnest to J3.",
    },
    {
      text: "Drag a **left-to-right** selection window around the outline and those four parts and move them to the middle of the sheet. Left to right selects only what is fully inside; right to left grabs anything it touches and would drag the loose pile with it.",
      proof: "The outline and four anchors move together and the loose pile is untouched.",
    },
  ]),
  shot(
    "What F8 gives you: a pile of parts and the ratsnest. Every thin line is a connection still to make.",
    "KiCad PCB editor immediately after Update PCB from Schematic: the untouched footprint pile with white ratsnest lines clearly visible, before any placement.",
  ),
  shot(
    "Rectangle Properties: start at the origin, type the size, then tick Rounded rectangle.",
    "KiCad Rectangle Properties on the By Corners tab with Start X/Y at 0, the board dimensions typed into End X/Y, Rounded rectangle checked and the layer reading Edge.Cuts.",
  ),
  check(
    "**Why place the four anchors by coordinate rather than by eye?** They line up with the outside world: a USB plug, a breadboard's two rails, and the antenna's overhang. Everything else on the board can move a millimetre without consequence; those four cannot.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Place every part", "Hands on. Placement is most of the battle, and on this board it is also most of the measurement."),
  sect("03", "Floor-plan: where a knob and a probe header go", "Two of this board's parts are user interface, so they get placed for hands before they get placed for copper."),
  prose(
    "Work outside in. Connectors and anything a finger touches go on edges first, then the parts that must be near them, then everything else fills the middle. The core clusters are the ones you already know: the regulator island near where 5 V arrives, the decoupling by U1's supply side, the buttons where fingers reach.\n\nThe analog cluster is new and it wants to be together, on an edge, and away from the noisy end of the board. **RV1** is a screwdriver interface, so it needs an accessible edge with the screw facing up and nothing tall crowding it. **J4** goes right beside it with its labels facing outward, because a hand holding a probe reads that silk. **D2 and R8** sit at that exposure, guarding the node where the outside world touches. And **C8 goes at U1's GPIO1 pad**, with **R7** immediately upstream of it.",
  ),
  table(
    ["Ref", "Part", "Where it goes"],
    [
      ["U1", "ESP32-S3-WROOM-1", "Top short edge, antenna end overhanging the outline"],
      ["J1", "USB-C receptacle", "Bottom edge, centred, inside its silkscreen"],
      ["D1", "USBLC6-2 ESD array", "Hard against J1, in the D+/D- path"],
      ["U2, F1, C5, C6", "Regulator island", "Near the USB end, where 5 V arrives"],
      ["RV1", "10 kΩ trimpot", "An accessible edge, screw up, clear of tall neighbours"],
      ["J4", "1x3 analog header", "Beside RV1, labels facing outward"],
      ["D2, R8", "ESD clamp and limiter", "At that exposure, between RV1 and J4"],
      ["R7, C8", "The conditioning filter", "C8 at U1's GPIO1 pad, R7 immediately upstream"],
      ["J2, J3", "Breakout headers", "Down the two long sides, labels outward"],
    ],
  ),
  does("place it, outside in", [
    {
      text: "**The core first**, exactly as on L1.01: **D1** hard against **J1**, the CC pull-downs **R3 / R4** by J1's CC pins, the regulator island near the USB end with **C5 / C6** tight to U2's pins, and **SW1 / SW2** where a finger can press them.",
      proof: "The core clusters match the L1.01 plan with D1 against J1 and C5/C6 at U2.",
    },
    {
      text: "**RV1 on an accessible edge**, adjustment screw facing up, with a few millimetres of clear space around it so a screwdriver blade can sit in the slot without fouling a neighbour.",
      proof: "RV1 sits on an edge with clear space around its screw.",
    },
    {
      text: "**J4 immediately beside RV1**, labels facing outward so its 3V3 / AIN / GND order reads from off the board. The two of them are one cluster: you turn one and probe the other.",
      proof: "J4 sits next to RV1 with its silk reading outward.",
    },
    {
      text: "**D2 and R8 at that exposure**, between the wiper node and the header, so the guards are physically where the risk is rather than tucked somewhere convenient.",
      proof: "D2 and R8 sit in the RV1 and J4 cluster, not across the board from it.",
    },
    {
      text: "**C8 hard against U1's GPIO1 pad**, and **R7 immediately behind C8**, so the signal reaches the capacitor and then the pin with nothing in between.",
      proof: "C8's pad is within a couple of millimetres of GPIO1's pad, with R7 just upstream.",
    },
    {
      text: "**Keep the analog cluster away from the USB end and the antenna end.** The run from RV1's wiper to R7 should not have to pass the USB pair or cross the keep-out.",
      proof: "A straight line from RV1 to R7 crosses neither the USB pair nor the antenna zone.",
    },
  ]),
  shot(
    "The floor plan: core in its familiar places, the analog cluster together on an accessible edge.",
    "KiCad PCB editor, top view, all parts placed and nothing routed. U1 top with antenna overhanging, J1 bottom-centre, RV1 and J4 clustered on one edge with D2 and R8, C8 at U1's GPIO1 pad.",
  ),
  tube("Floor-plan the board: the core, then the analog cluster"),
  check(
    "**Why does RV1's placement have a constraint no other part in this series has had?** It is a human interface. The lesson is sweep and watch, so the screw has to be reachable while the board is powered and the console is visible. Ergonomics of the sweep is part of the design, the same way button spacing was on the servo board.",
  ),
  gotcha(
    "a knob you cannot reach with the board plugged in",
    "It is easy to place RV1 somewhere tidy and discover at bring-up that a USB cable, a probe clip or J2's jumper wires sit exactly where the screwdriver needs to go. Check the clearance with the board's real neighbours in mind, not just with the 3D view rotated to a convenient angle.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "The antenna keep-out", "Unchanged from L1.01, and still the one mistake you cannot fix without ordering new boards."),
  prose(
    "The WROOM radiates from a printed antenna at one end, and it only works over empty board. Under and around it you keep a keep-out: no copper, no [[ground pour]], no traces and no silkscreen either, because even ink detunes it. Espressif's own rule is to hang the antenna off the board edge, which is why U1 is placed with that end overhanging.\n\nDraw it now, before you route or pour. **DRC will not flag a missing keep-out** unless you have drawn the rule area, so this one is on you rather than on the checker.",
  ),
  does("fence off the keep-out", [
    {
      text: "**Place ▸ Draw Rule Areas** and trace the dashed guide already drawn around U1's antenna end. That guide sits on a user layer, excludes nothing by itself, and never reaches the fab.",
      proof: "A rule area covers the antenna end of U1 and reaches the board edge.",
    },
    {
      text: "In **Rule Area Properties**, under **Layers** tick **all four copper layers (F.Cu, In1.Cu, In2.Cu, B.Cu)** and both silkscreens.",
      proof: "The rule area lists all four copper layers and both silkscreens.",
    },
    {
      text: "Under **Keepouts** tick **tracks, vias, pads** and, the one that matters, **zone fills**. That last box is what stops the ground planes flooding the antenna when you pour.",
      proof: "All four keepout boxes are ticked, zone fills included.",
    },
  ]),
  shot(
    "Rule Area Properties: all four copper layers plus both silks, and every keepout box ticked.",
    "KiCad Rule Area Properties dialog over the L1.05 antenna keep-out: F.Cu, In1.Cu, In2.Cu, B.Cu and both silkscreens ticked, tracks/vias/pads/zone fills all checked.",
  ),
  trace(
    "The keep-out excludes everything",
    [
      { text: "All four copper layers and both silkscreens are ticked", help: "Miss an inner layer and its plane floods under the antenna just the same, and you will not see it from the top view." },
      { text: "**Zone fills** is on, not just tracks and vias", help: "This is the box people miss. Without it the pour flows straight through a keep-out that looks correctly drawn." },
      { text: "The board outline stops short so the antenna overhangs", help: "FR4 under the antenna loads it too. Air is the intended dielectric." },
      { text: "Nothing from the analog cluster strayed toward the antenna end", help: "The analog run is the one new net on this board that could wander there. Keep it at the other end." },
    ],
  ),
  gotcha(
    "the pour floods a keep-out drawn without zone fills ticked",
    "A rule area with tracks, vias and pads excluded but **zone fills** left off looks completely correct until you press **B** and watch the ground plane fill straight through it. Tick all four exclusions when you draw the area rather than after you notice the problem.",
  ),
  dive(
    "Why nearby copper costs you range",
    "The WROOM's printed antenna is tuned to radiate at 2.4 GHz, and its shape plus its surroundings are what set that frequency. Bring copper close, whether a pour, a trace or thick silkscreen, and you add stray capacitance that shifts the tuning, like detuning a guitar string by hanging a weight on it.\n\nThe antenna still works. Its sweet spot slides off 2.4 GHz, so most of the transmit power reflects back into the chip instead of leaving the board, and range drops from across-the-house to across-the-desk. No firmware setting recovers it. The only cure is keeping the keep-out genuinely empty, which is why the module hangs off the board edge.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "Decoupling first, and close", "The caps that hold the rail steady only work if they are near the pin, and on this board the rail is the reference domain."),
  prose(
    "Place **C2 and C3** in open board just off U1's 3V3 side, each with a **ground via at its own pad** so the return drops straight into the plane, and put **C1**, the bulk cap, near where the 3.3 V rail enters. The WROOM carries its own decoupling on the die, so yours are the board-level reservoir rather than last-millimetre bypass, and you cannot sit them on the pins anyway because the module's pads are castellations tucked under its body.\n\nThere is a reason to be a little more careful here than on L1.01. The module's analog supply rides this same rail, and the converter's reference lives in that domain. Rail wobble becomes reading wobble, so the decoupling is part of the measurement chain on this board rather than only part of the power chain.",
  ),
  does("place the decoupling before anything routes", [
    {
      text: "**C2 and C3** in open board just off U1's supply side, each with its own **ground via** at its pad.",
      proof: "Both bypass caps sit near U1's supply side with a ground via each.",
    },
    {
      text: "**C1**, the bulk cap, near where the 3.3 V rail enters the module side of the board.",
      proof: "C1 sits on the 3V3 rail near U1 rather than out at the regulator.",
    },
    {
      text: "**C5 and C6** hard against U2's input and output pins. An LDO with its capacitors far away can oscillate, and on this board that would look like an ADC fault.",
      proof: "C5 and C6 are adjacent to U2's IN and OUT pins.",
    },
    {
      text: "**Leave your iron room.** Keep a couple of millimetres of clear space around every 0805 near U1 and J1 so a tip can reach each pad at assembly without knocking the big parts you soldered first.",
      proof: "Every 0805 near U1 and J1 has clear space around it.",
    },
  ]),
  shot(
    "Decoupling placement: caps near the supply side, each with its own ground via.",
    "KiCad PCB editor zoomed on U1's supply side with C2/C3 placed close and a ground via at each pad, ratsnest still showing.",
  ),
  check(
    "**Your readings drift slowly while the board is busy, and the drift tracks what the firmware is doing. Where do you look first?** The rail. The converter's reference sits in the same 3.3 V domain as the digital load, so a rail that sags under activity moves the whole staircase. Check the decoupling and the ground return before you blame the converter.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Route the copper", "Hands on. Important nets first, everything else after."),
  sect("06", "Four layers, vias, and the layer pair", "Two outside layers for signals, two inside for solid ground, and one key that jumps between them."),
  prose(
    "The stackup is signal, ground, ground, signal. Traces live on **F.Cu** and **B.Cu**; the two inner layers are poured solid with ground and left alone. That gives every signal a continuous return directly beneath it.\n\nSet the **layer pair** to **F.Cu / B.Cu** before you route, so pressing the via key mid-route drops a through via and swaps you between the two signal layers without touching the planes. When you want a via to land somewhere specific instead, press the select-layer via key and pick the target from the dialog.",
  ),
  does("set up for routing", [
    {
      text: "**Route ▸ Set Layer Pair**, choose **F.Cu / B.Cu**. That is the hop you want: the inner layers are ground and you keep signals off them.",
      proof: "The layer pair selector reads F.Cu and B.Cu.",
    },
    {
      text: "Keep the default via for open copper, and reach for the smaller presets only where space is tight. **0.6 mm annulus with a 0.3 mm drill** is the fab floor, and it exists for cramped spots rather than for general use.",
      proof: "You can name the three via presets and say which one is the fab floor.",
    },
    {
      text: "Turn off **F.Fab** and **F.Mask** in the Appearance panel so the canvas shows pads, silk and ratsnest only.",
      proof: "The canvas shows pads, silk and ratsnest with the fab and mask layers hidden.",
    },
  ]),
  table(
    ["Trap", "Do this instead"],
    [
      ["Routing a signal on an inner layer", "In1.Cu and In2.Cu are solid ground. Keep signals on F.Cu and B.Cu; a trace on a plane cuts a slot the return current must detour around"],
      ["Sharp 90 degree corners", "Route in 45 degree bends. Acute angles can trap etchant, and 45 degrees is tidier and shorter"],
      ["Crossing another net on one layer", "Move one trace to B.Cu with a via, then come back up. The bottom layer has its own plane against it"],
      ["A via dropped inside a pad", "Keep vias out of pads; they wick your solder away when you hand-solder. Put the via beside the pad on a short stub"],
      ["Routing across the antenna keep-out", "Never. Route around it. No copper in that zone, ever"],
      ["Running the analog trace beside a switching net", "Give it its own quiet lane. A high-impedance node couples to whatever runs next to it"],
    ],
  ),
  dive(
    "Why the inner layers stay unrouted",
    "It is tempting to treat the inner copper as two more routing layers. Do not. A trace cut through a ground plane leaves a slot, and any signal crossing that slot has to find its return current the long way around, which turns a short trace into a loop.\n\nOn a board this size there is easily enough room on the two outer layers. Keeping the planes whole costs nothing and removes an entire class of problem. On a board whose whole point is measuring small voltages against ground, it also removes an entire class of measurement artifact, which is the kind you would spend a weekend blaming on the converter.",
  ),

  // ── 07 ────────────────────────────────────────────────────────────────────
  sect("07", "The USB data pair", "Unchanged from L1.01, and it goes down first because it needs the room."),
  prose(
    "USB full-speed signalling is differential: the receiver reads the difference between D+ and D-, not either one against ground. That works only if both traces experience the same thing, so they are routed together, the same length, the same distance apart, over unbroken ground.\n\nBecause you named the nets `USB_D+` and `USB_D-` at the schematic, KiCad's **differential pair router** already knows they are a pair. Route the whole thing before you touch another trace: J1's flip-duplicates tied with the plain router, then the coupled run from J1 through **D1** and on to the module's **IO19** and **IO20**.",
  ),
  does("route the pair, start to finish", [
    {
      text: "**Tie J1's flip-duplicates first with the plain router.** The connector brings each data line out twice for reversibility, so short the D+ twins together and the D- twins together, on one layer, with no via.",
      proof: "Both twin pairs are tied on a single layer with no via punched through the plane.",
    },
    {
      text: "Switch to the **differential pair router**, click one of J1's data pads and route the pair **into D1** first, so a static zap is clamped at the port before it travels inward.",
      proof: "The pair runs from J1 into D1, drawn together as a coupled pair.",
    },
    {
      text: "**Ground D1 with a smaller via.** The auto Power-class via is too fat for that cramped area and blocks the pair, so shrink that one to **0.8 mm with a 0.4 mm drill**. Your stitching vias out in open copper stay big.",
      proof: "D1's ground pad ties to the planes through a shrunk 0.8 mm via and the pair still clears.",
    },
    {
      text: "Carry on from D1 to **IO19 and IO20**, spaced and length matched the whole way, riding over the inner ground plane with nothing splitting it.",
      proof: "Two traces run side by side from D1 to U1's IO19 and IO20 over a continuous plane.",
    },
  ]),
  shot(
    "The USB pair routed together through D1, short and over unbroken ground.",
    "KiCad PCB editor zoomed on J1 to D1 to U1: the differential pair as two parallel traces at constant spacing, inner ground plane continuous beneath.",
    "See it wired · the USB pair",
  ),
  gotcha(
    "routing the pair one trace at a time",
    "Drawing D+ and then D- separately gives you two traces that happen to be near each other, with different lengths and a varying gap. Use the differential pair router so they are matched by construction rather than by care.",
  ),

  // ── 08 ────────────────────────────────────────────────────────────────────
  sect("08", "The analog run, and 'at the pin' as a distance", "This is the section that is new. Everything else on this card you have done before."),
  prose(
    "The schematic said C8 sits at the ADC pin. Layout is where that phrase becomes millimetres.\n\nAt the instant the converter samples, it takes charge from whatever is electrically nearest. With **C8's pad within a couple of millimetres of GPIO1's pad**, that is the capacitor, and the trimpot's own impedance stops mattering. Move the capacitor 15 mm away on a thin trace and you have put inductance between the reservoir and the thing drawing from it, which is exactly the effect the arrangement exists to avoid.\n\nThe run itself has three rules. Keep it **short**, keep it **direct**, and keep it **over solid ground** with nothing splitting the plane beneath it. And route it in its own quiet neighbourhood: the analog node is high impedance, so a fast-switching trace running alongside couples straight into the number you are trying to read.",
  ),
  does("route the analog path", [
    {
      text: "Route **RV1's wiper to R7** as a short, direct run. It has no current in it worth speaking of, so this is entirely about keeping it out of trouble.",
      proof: "The wiper trace reaches R7 without a detour and without crossing the board.",
    },
    {
      text: "Route **R7 to C8 to GPIO1** as the shortest path the pads allow, with C8's pad millimetres from the module's pad.",
      proof: "You can measure the C8 to GPIO1 distance on screen and it is a small number of millimetres.",
    },
    {
      text: "Give **C8 its own ground via** at its low pad, straight into the planes, so its return does not travel before it gets home.",
      proof: "C8's ground pad has a via of its own at the pad.",
    },
    {
      text: "Route **D2 to ground** with a short via of its own at the exposure, and **R8 to J4's middle pin**. Neither is in the measurement path, and both want a low-inductance path to the plane.",
      proof: "D2's ground pad has its own via and R8 reaches J4 pin 2.",
    },
    {
      text: "**Check what runs beside the analog trace.** It must not ride alongside the USB pair, and it must not cross the antenna keep-out. Move whichever trace is easier to move.",
      proof: "No switching trace runs parallel to the analog run, and the run stays clear of the keep-out.",
    },
    {
      text: "**Check the plane under the run.** Follow it along and confirm the inner ground beneath it is continuous, with no via cluster or stray trace carving a slot.",
      proof: "The plane under the analog run is unbroken along its whole length.",
    },
  ]),
  shot(
    "The analog run: RV1 to R7 to C8 at the pin, short, direct and over solid ground.",
    "KiCad PCB editor zoomed on the L1.05 analog path: RV1 wiper to R7, R7 to C8, C8's pad against U1's GPIO1 pad, each ground via visible, inner plane continuous beneath.",
    "See it wired · the analog run",
  ),
  tube("Route the analog path: what 'at the pin' looks like in copper"),
  check(
    "**'C8 at the pin' becomes what, concretely, in layout?** The capacitor's pad within a couple of millimetres of GPIO1's pad, with R7 immediately behind it and a ground via at C8's own low pad. The converter grabs charge from C8 at the sampling instant, so distance is inductance is droop.",
  ),
  gotcha(
    "a tidy analog trace that runs the length of the USB pair",
    "The temptation is to route the analog node the neat way, along an edge, parallel with everything else. If that edge is where the USB pair lives, you have built a small antenna pointing at your own measurement. Cross at right angles if you must cross, and never run alongside for any distance.",
  ),
  dive(
    "Why a high-impedance node is the one that picks things up",
    "Coupling between two traces is capacitive: the noisy trace pushes a small current into the quiet one through the capacitance between them. What that current does to the quiet node depends entirely on the node's impedance. Push a microamp into a low-impedance node and nothing measurable happens. Push the same microamp into a node whose source impedance is kilohms and you have made millivolts.\n\nYour analog node sits behind a trimpot wiper, whose output impedance peaks at about a quarter of the track, so a couple of kilohms. That is exactly the regime where crosstalk turns into reading error. C8 helps a great deal, because at higher frequencies it is a low impedance sitting right at the pin, which is another reason it belongs there and not upstream.",
  ),

  // ── 09 ────────────────────────────────────────────────────────────────────
  sect("09", "Route the rest: power first, then signals", "Wide metal where the current is, short metal where it matters."),
  prose(
    "With the pair and the analog path down, route the power: **VBUS** from J1 through F1 to U2's input, then **+3V3** from U2's output to U1 and to the headers. These are on the **Power** net class at **0.5 mm**, because VBUS carries up to about 0.5 A and a thin trace both drops voltage and heats.\n\nEverything else is low speed and forgiving. The EN and BOOT networks, the LED strings, and the GPIO breakouts can wander a little. Keep them out of the keep-out and out of the analog lane, and work the unrouted-net count in the status bar down to zero. Ground you do not route at all: it comes last, as the pour.",
  ),
  does("route in order of consequence", [
    {
      text: "**VBUS:** J1 to F1 to U2's input on the Power class, with the input cap hard at that pin. Then **+3V3** from U2's output to U1 and out to the header rail positions.",
      proof: "Both rails are routed at 0.5 mm and no power trace is left on the Default class.",
    },
    {
      text: "**EN and BOOT:** R1 with C7 to U1's EN, R2 to IO0, each with its button to ground. Keep C7 near the EN pin.",
      proof: "The EN and IO0 networks are routed with C7 near the EN pin.",
    },
    {
      text: "**LEDs:** the 3V3 string through R5 to LED1, and IO2 through R6 to LED2. Both are a few milliamps, so Default class is right.",
      proof: "Both LED strings are routed on the Default class.",
    },
    {
      text: "**The breakouts:** every remaining GPIO to its matching header pin, dropping to **B.Cu** with a via where two must cross rather than taking a long detour on top.",
      proof: "Each GPIO reaches its header pin and crossings drop to the bottom layer.",
    },
    {
      text: "**Work the unrouted count to zero.** The status bar counts what is left. GND pads are the exception: leave them for the pour.",
      proof: "The unrouted-net count reads 0 with only GND pads outstanding.",
    },
  ]),
  check(
    "**Why is VBUS on a wider net class than the trace from GPIO1?** VBUS carries up to about 0.5 A to the regulator and anything you power from a header. The analog trace carries essentially nothing, and its width has no effect on the reading. Width follows current.",
  ),

  // ── 10 ───────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Pour and stitch the ground", "Hands on. Flood the leftover copper and tie the layers together."),
  sect("10", "Pour, stitch, and the screwdriver keep-out", "Ground is a surface you flood, and RV1 needs one small area left alone for a different reason."),
  prose(
    "Pour ground on all four copper layers: the two inner ones become solid planes and the leftover space on the outer layers fills in around your traces. Then **stitch**, dropping vias that tie the outer ground to the inner planes so return current can get where it needs to. About one every 10 mm across the open pour, with a cluster of at least nine under **U1's centre pad**, which is the module's main ground and heat path.\n\nOne place gets no copper at all, which is the antenna keep-out. One more place gets left alone for a mechanical reason: a small **screwdriver-access area around RV1's adjustment screw**, so nothing tall or fragile is where a blade has to go.",
  ),
  does("flood it, then tie it together", [
    {
      text: "Add a **ground zone on each of the four copper layers**, covering the board outline, then press **B** to fill.",
      proof: "Four ground zones exist, one per copper layer, and all four are filled.",
    },
    {
      text: "**Look at the result rather than trusting it.** Check that the inner planes are genuinely solid and that the fill respected the keep-out on every layer, not just the top.",
      proof: "All four zones filled and the antenna keep-out is empty on every layer.",
    },
    {
      text: "**Stitch** with ground vias around U1, beside each decoupling capacitor, at **C8 and D2's ground pads**, and along the board edges, about one every 10 mm across the open pour.",
      proof: "Stitching vias tie F.Cu and B.Cu ground to the inner planes throughout, including at the analog cluster.",
    },
    {
      text: "Add the cluster of **at least nine ground vias on U1's centre pad**, straight into the planes.",
      proof: "A grid of nine or more vias sits under U1's centre pad.",
    },
    {
      text: "**Refill (B)** after the last via. A zone that was nudged and never refilled ships as whatever it looked like before you moved it.",
      proof: "Zones refilled after the final edit.",
    },
    {
      text: "Confirm nothing tall or fragile sits in the **screwdriver path** to RV1's screw, and that no stitching via ended up where a blade would scrape.",
      proof: "A screwdriver can reach RV1's slot straight down with clear space around it.",
    },
  ]),
  shot(
    "The poured and stitched ground, notched out cleanly at the antenna keep-out.",
    "KiCad PCB editor showing all four ground zones filled, stitching vias around U1 and the decoupling and at the analog cluster, keep-out clearly empty of copper on every layer.",
  ),
  tube("Pour and stitch the ground"),
  gotcha(
    "a zone you nudged and never refilled",
    "KiCad shows the last computed fill rather than the current one. Move a trace after filling and the display can still show the old copper. Press **B** before you look, and again before you export, because the Gerbers come from the fill rather than from your intention.",
  ),
  dive(
    "Why one via stitches all four layers",
    "A stitching via here is a plain through via: a plated barrel from F.Cu all the way to B.Cu, passing through In1.Cu and In2.Cu on the way. Copper of the same net on any layer the barrel touches connects to it, and on this board all four coppers are GND, so a single through via bonds all four at that spot.\n\nThat is why you never set a layer pair or reach for a blind or buried via to stitch: those types exist to connect some layers and not others, which is the opposite of what ground wants. It also answers the natural worry about tying the two inner planes to each other, since every through stitch already does it.",
  ),

  // ── 11 ───────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Label the silk", "Hands on. On this board the silkscreen carries a rule, so it is content rather than decoration."),
  sect("11", "The silk that keeps a probing hand honest", "Three labels on this board are teaching, not tidiness."),
  prose(
    "The breakout pin names go on the **back** silkscreen with mirror ticked, about 1 mm high at 0.15 mm thickness, exactly as on L1.01. The button labels go on the front where a finger presses them.\n\nThen the three that belong to this board. **J4 gets its pin order printed**, 3V3 / AIN / GND, so a hand holding a probe does not have to count from a drawing. **J4 also gets its limit**, 0 to 3.3 V only, because that header invites a home-made sensor. And **the GPIO1 breakout position gets marked as the ADC input**, with a short note that ADC2 stops working when the radio is on, so the rule survives on the board rather than only in this guide.",
  ),
  does("label it", [
    {
      text: "**Place ▸ Add Text**, layer **B.Silkscreen**, mirror on, about **1 mm** high at **0.15 mm** thickness, and work down J2 then J3 naming each pin's signal beside its pad.",
      proof: "Every J2 and J3 pin carries a mirrored back-silk label of its signal.",
    },
    {
      text: "On the **front** silk, label **SW1 as EN** and **SW2 as BOOT** beside their buttons, plus the LEDs and test points while you are there.",
      proof: "Both buttons are labelled on the front silk beside the part they name.",
    },
    {
      text: "Print **J4's pin order (3V3 / AIN / GND)** and the note **0 to 3.3 V only** where a hand approaching with a probe will read them.",
      proof: "J4's silk names all three pins and carries the voltage limit.",
    },
    {
      text: "Mark **D2 with a pin-1 dot** and the **GPIO1 breakout position as the ADC1 analog input**, with a short ADC1-only note.",
      proof: "D2 has an orientation dot and the GPIO1 header position is marked as the ADC input.",
    },
    {
      text: "**Stamp the revision.** Add a silkscreen label carrying the commit hash of the design you built from, anywhere clear. That is how a physical board tells you which layout you are holding.",
      proof: "A silkscreen label carries the design's commit hash.",
    },
  ]),
  shot(
    "Silk that teaches: J4's pin order and voltage limit, and the ADC1 note at the breakout.",
    "KiCad PCB editor zoomed on the L1.05 analog cluster with silkscreen visible: J4 labelled 3V3 / AIN / GND with the 0 to 3.3 V only note, D2's pin-1 dot, the ADC1 marking at GPIO1.",
  ),
  tube("Label the silk: the breakout, the probe header and the knob"),
  check(
    "**Why does J4's pin order go on the silk when it is already in the guide?** The board outlives the tab you read it in. Someone probing this header in six months has the copper in front of them and nothing else, and a mislabelled probe on a rail is exactly the mistake R8 exists to survive.",
  ),
  gotcha(
    "silkscreen that shrinks into a blob",
    "Leave the font as **KiCad Font**. Its stroke font stays crisp and actually hits the size you asked for on silk, where a TrueType brand font shrinks to roughly 60 % and blurs at this size. Save the brand look for a logo placed through the Image Converter.",
  ),

  // ── 12 + gate ─────────────────────────────────────────────────────────────
  band("check", "Eyeball what DRC cannot catch", "Verify. The checker measures distances. It has no opinion about intent."),
  prose(
    "DRC compares your board against the fab's numbers. It cannot tell you the keep-out is in the wrong place, that C8 ended up 15 mm from the pin, or that the analog run took the scenic route past the USB pair. Those are intent, and intent is what the answer key is for.",
  ),
  trace(
    "Check these against the answer key before you run DRC",
    [
      { text: "U1's antenna end overhangs the outline and **no copper sits in the keep-out on any layer**", help: "This is the one that costs you range, and DRC will never mention it. Check each copper layer on its own." },
      { text: "**C8's pad is millimetres from GPIO1's pad**, with R7 immediately upstream and a ground via at C8", help: "Far-away decoupling passes DRC. So does far-away sample-and-hold reservoir, and it quietly degrades every reading you take." },
      { text: "**The analog run is short, direct and over unbroken plane**, and never rides alongside the USB pair", help: "A high-impedance node picks up whatever runs beside it. This is the difference between measuring the pot and measuring the board." },
      { text: "**RV1's screw is reachable and J4's silk reads outward**", help: "Both are user interface. A knob you cannot turn with the board plugged in fails the lesson without failing any check." },
      { text: "Every decoupling cap is close to its pin with its own ground via", help: "On this board the rail is the converter's reference domain, so rail noise is reading noise." },
      { text: "Power nets are on the **Power** class and the inner planes are unbroken", help: "A slot cut in a plane forces return current the long way and undoes the whole four-layer stackup." },
    ],
  ),
  shot(
    "The answer key: placement, routing, pour and keep-out on the finished board.",
    "Hi-res KiCad top view of the completed L1.05 layout with all four layers visible: the analog cluster, C8 at GPIO1, the keep-out empty, the pour stitched. Full board.",
  ),

  band("do", "in KiCad · Run DRC to zero", "Hands on. Clean, or every remaining flag understood and written down."),
  sect("12", "Run DRC and save the report", "Your fab's rules have been on since Board Setup, so this is a confirmation rather than a surprise."),
  table(
    ["DRC says", "You do"],
    [
      ["Clearance violation", "Two coppers too close: nudge a trace or a part apart"],
      ["Track or via too small", "Widen the track, or grow the via past its minimum"],
      ["Unconnected items", "A ratsnest line you never routed: finish it, or no-connect it on purpose"],
      ["Courtyard overlap", "Two parts physically clash: move one. Watch for this around RV1's body"],
    ],
  ),
  does("run it, read it, clear it", [
    {
      text: "**Inspect ▸ Design Rules Checker.** Tick **Refill all zones before performing DRC** and **Test for parity between PCB and schematic**, then run it.",
      proof: "Both tickboxes are on before the run.",
    },
    {
      text: "Fix what it finds, **refill (B)**, and run again until it reads **0 violations and 0 unconnected items**. Cosmetic warnings like silk near an edge are fine to leave.",
      proof: "DRC reports 0 violations and 0 unconnected items.",
    },
    {
      text: "If a flag comes from the stock module footprint rather than from your work, use **Exclude** and write down why. An excluded flag you cannot explain is a flag you have not understood.",
      proof: "Any remaining flags are excluded with a written reason.",
    },
    {
      text: "**Save the report.** The next stage runs one last DRC and takes the clean report as its proof.",
      proof: "A .rpt file is saved and ready to attach.",
    },
  ]),
  shot(
    "DRC reporting zero violations and zero unconnected items against the fab's rules.",
    "KiCad Design Rules Checker dialog showing 0 violations and 0 unconnected items with the PCBWay rules loaded. Frame the summary line.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: layout",
    gate: true,
    questions: [
      {
        id: "at-the-pin", reviewId: "at-the-pin",
        q: "'C8 at the pin' becomes what, concretely, in layout?",
        options: [
          "The capacitor's pad within a couple of millimetres of GPIO1's pad, with R7 immediately behind it",
          "The same net assignment as on the schematic",
          "A wider trace running to the capacitor",
        ],
        answer: 0,
        explain: "The converter grabs charge from C8 at the sampling instant. Distance is inductance is droop, and layout is where the phrase gets measured.",
      },
      {
        id: "quiet-run", reviewId: "quiet-run",
        q: "What is the routing rule for the analog run?",
        options: [
          "As wide as the power traces",
          "Short, direct, over solid ground, and never alongside the USB pair or another switching line",
          "On an inner layer, for shielding",
        ],
        answer: 1,
        explain: "A high-impedance measurement node picks up whatever runs beside it. Quiet neighbourhood, solid plane below.",
      },
      {
        id: "knob-access",
        q: "RV1's placement carries a constraint no other part in this series has had. What is it?",
        options: [
          "It needs a heat sink",
          "It must clear the ground pour",
          "It is a human interface: the screw has to be reachable while the board runs and the console is visible",
        ],
        answer: 2,
        explain: "The lesson is sweep and watch. Ergonomics of the sweep is part of the design, the same way button spacing was on the servo board.",
      },
      {
        id: "keepout-layers", reviewId: "keepout-layers",
        q: "Which layers does the antenna keep-out need to cover?",
        options: [
          "The top layer only",
          "The top and bottom layers",
          "All four copper layers and both silkscreens",
        ],
        answer: 2,
        explain: "An inner ground plane under the antenna detunes it just as effectively as a top-layer trace, and even silkscreen ink counts.",
      },
      {
        id: "zone-fills-box",
        q: "You draw the keep-out with tracks, vias and pads excluded, then pour. The ground floods straight through it. What did you miss?",
        options: [
          "The zone fills keepout box",
          "The board outline",
          "The layer pair setting",
        ],
        answer: 0,
        explain: "Zone fills is the box that stops the planes filling the antenna area. Without it the keep-out looks correctly drawn and does nothing.",
      },
      {
        id: "fab-rules-first",
        q: "Why load PCBWay's rule file before you start routing?",
        options: [
          "KiCad runs faster with custom rules loaded",
          "So DRC measures against what the factory can actually etch rather than KiCad's permissive defaults",
          "It is required before you can place parts",
        ],
        answer: 1,
        explain: "A board can pass DRC on the defaults and still be unbuildable. Loading the fab's numbers first means every trace is checked against the real process.",
      },
      {
        id: "planes-unbroken",
        q: "Why are the two inner layers left as solid ground rather than used for routing?",
        options: [
          "KiCad cannot route on inner layers",
          "A trace cut through a plane leaves a slot, and signals crossing it have to find their return current the long way round",
          "Inner layers cost more to fabricate when routed",
        ],
        answer: 1,
        explain: "Keeping the planes whole gives every outer-layer signal a continuous return directly beneath it, which is the point of the four-layer stackup and, on this board, of the measurement.",
      },
      {
        id: "vbus-width",
        q: "Why is VBUS on the Power net class at 0.5 mm rather than the 0.25 mm default?",
        options: [
          "Wider traces are easier for the fab to etch",
          "USB requires 0.5 mm traces by specification",
          "VBUS carries up to about 0.5 A, and a thin trace both drops voltage and heats",
        ],
        answer: 2,
        explain: "Trace width follows current. The analog run carries essentially nothing, and making it wider would not improve a single reading.",
      },
      {
        id: "drc-blind-spot", reviewId: "drc-blind-spot",
        q: "DRC reports zero violations. What can it still not tell you?",
        options: [
          "Whether any traces are too close together",
          "Whether the board matches the schematic",
          "Whether C8 is actually at the pin, or whether the analog run took a sensible route",
        ],
        answer: 2,
        explain: "DRC measures distances against the fab's numbers. Intent is what the answer key and the eyeball list are for.",
      },
    ],
  },

  exit(
    "A placed, routed, poured board that passes DRC against the fab's own rules, with the antenna keep-out fenced on all four layers and the analog path short, quiet and honest about what 'at the pin' means. Attach the DRC report. The next stage exports the Gerbers the fab builds from, and they come from exactly this board file.",
  ),

  ref("ESP32-S3 Hardware Design Guidelines (Espressif): PCB layout, ground return paths and antenna keep-out", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html"),
  ref("PCBWay's KiCad design-rules file (the .zip is in the KiCad folder)", "https://github.com/pcbway/PCBWay-Design-Rules"),
  ref("USB 2.0 specification (USB-IF): full-speed signalling and the D+/D- differential pair", "https://www.usb.org/document-library/usb-20-specification"),
  ref("KiCad 10 documentation: design rules, rule areas and zone filling", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "LAYOUT", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
