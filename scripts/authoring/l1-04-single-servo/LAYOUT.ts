// L1.04 single-servo driver — LAYOUT card.
//
// Authored ahead of the board from docs/boards/l1-04-single-servo/{design.md,
// bom.csv,validation-log.md}, with L1.01's LAYOUT card as gospel for everything
// the two boards share: 4 copper layers at 1.6 mm, Default 0.25 mm and Power
// 0.5 mm net classes, PCBWay's .kicad_dru and its 0.15 / 0.15 / 0.3 / 0.15 mm
// floor, the F.Cu / B.Cu layer pair, the 1.0 / 0.8 / 0.6 mm via presets with
// 0.6 / 0.3 mm as the fab floor, the antenna rule area on all four coppers plus
// both silks, pour and stitch at about every 10 mm with at least nine vias on
// U1's centre pad, B.Silkscreen text mirrored at 1 mm / 0.15 mm, and the DRC
// flow with Refill and parity ticked.
//
// The NEW material is the servo rail in copper, and it is all layout-stage risk
// the design deliberately deferred to here:
//
//   RK8 / K14 — the servo power and return traces carry up to 0.9 A, so they
//     need at least 0.8 mm of 1 oz copper for a 10 degree rise, which is wider
//     than the Power class. That is a third net class, not a wider Power class,
//     because widening Power would silently change the USB rail too.
//   RK8 — the servo return ties to logic ground at ONE point, at C8's ground,
//     so the motor's di/dt loop never runs through the logic reference.
//   RK9 — the antenna keep-out, inherited unchanged from L1.01.
//
// Board dimensions are deliberately absent. L1.01 is 30 x 62 mm with anchors at
// fixed coordinates; this board is larger and its outline is not fixed in
// design.md, so the card teaches the constraints that set it rather than
// inventing numbers the starter would contradict.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Layout: two power rails, one ground, and a capacitor the size of your thumb"),

  band("orient", "How layout works on a two-rail board", "Read this once with KiCad closed. Four layers, two inside are solid ground, and one net on this board is wider than the rest for a reason you can compute."),
  prose(
    "Layout is where the schematic meets physics. The same circuit works flawlessly or barely boots depending on where the parts sit and how the copper flows between them. You do it in five moves: **set up** the board to your fab's rules, **place** the parts, **route** the copper, **pour** the ground, then **confirm** it by eye and by DRC.\n\nThis board adds a sixth concern that L1.01 never had. There are **two power rails** on one piece of FR4, and the entire value of the design is that they meet at exactly one place. On the schematic that was a naming discipline. In copper it is a geometry problem: how wide the servo traces are, where the servo's return current physically flows, and which single point ties the two grounds together.",
  ),
  {
    type: "callout", severity: "info", label: "The board: four copper layers",
    body: "A bare board here is **four sheets of copper** stacked with insulation between them. You route signals on the **two outside** layers, near the parts. The **two inside** layers are each a solid [[ground pour|ground plane]], unbroken sheets of GND. Those planes are the **return path** every signal needs: current always flows in a loop, out along your trace and back through ground, and a solid plane against each signal layer gives that return the shortest, lowest-[[impedance]] way home. Signals outside, ground inside, so every signal layer hugs a plane.",
  },
  {
    type: "image", src: "/guide-diagrams/four-layer-cross-section.svg",
    alt: "Four-layer board cross-section: the two outside copper layers carry the signals and parts; the two inside layers are solid ground planes.",
    caption: "Four layers: signals on the two outsides, solid ground on the two insides.",
  },
  dive(
    "The return path is half the circuit, and a motor makes it visible",
    "It is tempting to think a signal is just the trace going out. But current cannot go anywhere without a way back: every current travels in a loop, out on the trace and home through ground. A solid ground plane lets the return flow **directly underneath** the trace, for the smallest possible loop. Small loop, low inductance, clean signal and a rail that does not sag. Break the plane with a slot and the return detours around it, the loop balloons, and you get exactly the droop the plane was there to prevent.\n\nOn L1.01 that argument was about a 12 Mbit/s data pair, and it was easy to take on faith. On this board it is about a motor. A servo's internal driver switches its current on and off at a few kilohertz, and every one of those edges sends a current pulse out through J5 and back through your ground. That is a loop with real amps in it, changing fast.\n\nSo the same principle produces a sharper rule here. It is not enough for the servo's return to *reach* ground. It matters **which path** it takes, because the voltage it develops along the way is a voltage the microcontroller sees as a shifting reference. Section 08 turns that into one placement decision.",
  ),

  // ── 01 setup ──────────────────────────────────────────────────────────────
  band("do", "in KiCad · Set up the board", "Hands on. Rules before routing, every time. This board adds one net class you have not needed before."),
  prose(
    "Your schematic becomes a layout in one step, with no new download. **Update PCB from Schematic** drops every footprint onto the canvas in a loose pile joined by thin **ratsnest** lines showing which pads still need connecting. That ratsnest is your to-do list: layout is finished when every line has become a trace or been swallowed by the ground pour.",
  ),
  does("update the PCB from schematic", [
    {
      text: "In the schematic editor run **Tools ▸ Update PCB from Schematic**, or open the `.kicad_pcb` and press **F8**. Ignore the dialog's wall of checkboxes, click **Update PCB**, then click once in the canvas to drop the whole group of footprints.",
      proof: "A PCB window is open with every footprint dropped in one loose pile, joined by thin ratsnest lines.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "KiCad PCB editor right after Update PCB from Schematic: footprints in a loose pile joined by thin ratsnest lines.",
    caption: "What F8 gives you: a pile of parts and the ratsnest. Every thin line is one connection still to make.",
    captureHint: "KiCad PCB editor immediately after Update PCB from Schematic for L1.04: the untouched footprint pile with white ratsnest lines visible, C8's large can obvious in the pile.",
  },
  {
    type: "callout", severity: "warn", label: "01 · Set up PCBWay's rules before you route",
    reason: "Do this before you route, or you will redo it",
    body: "Every board house has limits: the thinnest trace they can etch, the smallest gap, the smallest hole. **PCBWay**, where this course builds, publishes those limits as a rules file you load into KiCad, so from the first trace it will not let you draw one they cannot build. Load the rules file, then confirm the net classes underneath it. **Open the project, not just the board:** net classes and design rules live at the project level, so opening a bare `.kicad_pcb` on its own quietly loses them.",
  },
  {
    type: "table",
    columns: ["Rule", "What it means", "PCBWay's floor"],
    rows: [
      [{ text: "Min track width" }, { text: "The thinnest copper trace PCBWay can reliably etch." }, { text: "0.15 mm", tone: "gold", decoration: "badge" }],
      [{ text: "Min clearance" }, { text: "Smallest gap between two coppers before they risk shorting." }, { text: "0.15 mm", tone: "gold", decoration: "badge" }],
      [{ text: "Min hole / drill" }, { text: "Smallest hole their drill makes; smaller than this costs extra." }, { text: "0.3 mm", tone: "gold", decoration: "badge" }],
      [{ text: "Min annular ring" }, { text: "The copper collar around a hole that must survive a slightly-off drill." }, { text: "0.15 mm", tone: "gold", decoration: "badge" }],
    ],
  },
  does("load PCBWay's full rules file", [
    {
      text: "Open the link below, click the **KiCad** folder, click the **.zip**, then click the **Download** button rather than the filename. Right-click the zip ▸ **Extract All** to get the `.kicad_dru` inside.",
      proof: "A .kicad_dru file sits in your Downloads once the zip is extracted.",
    },
    {
      text: "Make KiCad use it: **rename the file to `l1-04-single-servo.kicad_dru`**, exactly your project's name, and drop it in the project folder beside `l1-04-single-servo.kicad_pcb`. KiCad only auto-loads a rules file whose stem matches the project. If that fails, paste the contents into **Board Setup ▸ Design Rules ▸ Custom Rules** instead.",
      proof: "A file named l1-04-single-servo.kicad_dru sits in your project folder beside the .kicad_pcb.",
    },
    {
      text: "Open it in a text editor and read the top. PCBWay ships **one file holding several rule sets** and comments the unused ones out. The live set is their **2-layer, 1 oz copper** one, and you keep it exactly as it is even though this board is 4-layer: those limits are **tighter** than PCBWay's own 4-layer limits (0.127 mm trace and gap against 0.09 mm, and a 0.5 mm minimum via against 0.45 mm), so a board that clears them clears either order.",
      proof: "You found the live rule block and can say why the 2-layer numbers are the safe ones to keep on a 4-layer board.",
    },
  ]),
  ref("PCBWay's KiCad design-rules file (the .zip is in the KiCad folder)", "https://github.com/pcbway/PCBWay-Design-Rules"),
  {
    type: "image", src: "",
    alt: "KiCad 10 Board Setup, Design Rules, Custom Rules, showing PCBWay's rule text loaded in the panel.",
    caption: "Verify it loaded: PCBWay's rule text fills the Custom Rules panel.",
    captureHint: "KiCad Board Setup > Design Rules > Custom Rules, scrolled to the top with several (rule ...) lines visible. A non-empty panel is the pass; empty means a filename mismatch.",
  },

  sect("02", "Three net classes, because one net carries an amp", "Default for signals, Power for the logic rails, and a third one this board needs that L1.01 did not."),
  prose(
    "A **net class** is a named group of nets sharing a track width and clearance, so every trace draws at the right width without you picking one. L1.01 shipped two. This board needs three, and the reason is arithmetic rather than taste.\n\nThe logic rails carry at most a few hundred milliamps, and **0.5 mm** of 1 oz copper handles that with margin. **VSERVO carries up to 0.9 A**, and holding a 1 oz trace to about a 10 degree Celsius rise at that current takes at least **0.8 mm**. Wider is better and costs nothing here, because the servo island has room.\n\nThe temptation is to widen the Power class to 0.8 mm and be done. Do not. Power carries VBUS and +5V and +3V3, which run all over the board including into tight spaces near the USB connector, and forcing them to 0.8 mm would fight your routing everywhere for a current that never arrives. One net needs the width. Give the width to one net class.",
  ),
  {
    type: "table",
    columns: ["Net class", "Width", "Nets", "Why that width"],
    rows: [
      [{ text: "Default" }, { text: "0.25 mm" }, { text: "Every signal, including SIG and the GPIO breakouts" }, { text: "Milliamps. Width is set by what the fab can etch, not by current" }],
      [{ text: "Power" }, { text: "0.5 mm" }, { text: "VBUS, +5V, +3V3" }, { text: "Up to about 0.6 A on the logic side, with margin" }],
      [{ text: "Servo" }, { text: "0.8 mm minimum, wider preferred" }, { text: "VSERVO" }, { text: "0.9 A worst-case stall, held to about a 10 degree rise in 1 oz copper" }],
    ],
  },
  does("confirm the floor, then the three classes", [
    {
      text: "Open **Board Setup ▸ Board Stackup ▸ Physical Stackup**. Copper layers reads **4** and the stack totals **1.6 mm**: F.Cu, prepreg, In1.Cu, core, In2.Cu, prepreg, B.Cu. Your starter set this.",
      proof: "Copper layers reads 4 and the stack adds up to 1.6 mm.",
    },
    {
      text: "Open **Board Setup ▸ Design Rules ▸ Constraints**. The starter already sets the minimum clearance, track width, hole and annular ring to hand-solder-friendly values inside PCBWay's limits. Nothing to type, just see where the floor lives.",
      proof: "Constraints already carry the minimum clearance, track width, hole and annular ring. Nothing was typed.",
    },
    {
      text: "Open **Board Setup ▸ Net Classes**. Confirm **Default at 0.25 mm** and **Power at 0.5 mm** with VBUS, +5V and +3V3 assigned. Then confirm a **Servo** class at **0.8 mm or wider** with **VSERVO** assigned to it, and nothing else.",
      proof: "Three net classes exist, and VSERVO is the only net in the Servo class.",
    },
    {
      text: "**Check what is not in the Servo class.** SIG stays on Default: it carries a logic pulse into a high-impedance input, so it is a signal, not a rail. Ground is not in any class, because you do not route it at all.",
      proof: "SIG sits on Default and no ground net has been assigned to a class.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "KiCad Board Setup, Net Classes: Default at 0.25 mm, Power at 0.5 mm, and a Servo class at 0.8 mm with only VSERVO assigned.",
    caption: "Three classes, one net each way: signals, logic rails, and the one rail that carries an amp.",
    captureHint: "KiCad Board Setup > Design Rules > Net Classes for L1.04: the three classes with their widths, and the net assignment panel showing VSERVO alone in Servo.",
  },
  tube("Set up the stackup, the fab rules, and the third net class"),
  check(
    "**Why not just widen the Power class to 0.8 mm and skip the third class?** Because Power carries VBUS, +5V and +3V3, which thread through the tight area around the USB connector. Forcing all of them to 0.8 mm fights your routing everywhere to solve a current problem that exists on exactly one net.",
  ),
  dive(
    "Where 0.8 mm comes from",
    "Trace width for a given current is a **thermal** question, not an electrical one. A trace has resistance, current through resistance makes heat, and the copper can only shed so much of it into the board before it rises in temperature. The standard way to size it is to pick an acceptable temperature rise and read off the width.\n\nThe design's number is **at least 0.8 mm, about 30 mil, in 1 oz copper for roughly a 10 degree Celsius rise at 0.9 A**. Ten degrees is the usual conservative choice for an internal or external trace you would rather not think about again.\n\nTwo things worth noticing. First, this applies to the **return** as much as the supply. The current that goes out through VSERVO comes back through ground, and on this board ground is a plane, which is enormously wider than 0.8 mm and so is never the constraint. Second, the number is a **floor**. On the servo side of this board copper is nearly free, so pouring VSERVO as a small filled zone rather than a trace is a legitimate and slightly better answer.",
  ),

  // ── 03 floor plan ─────────────────────────────────────────────────────────
  band("do", "in KiCad · Place every part", "Hands on. Placement is most of the battle, and this board's floor plan has two zones rather than one."),
  {
    type: "callout", severity: "info", label: "Keys · the KiCad 10 PCB-editor keys",
    body: "A few keys do most of the work. Hover and press. See them all under **Help ▸ List Hotkeys**.",
  },
  {
    type: "table",
    columns: ["Key", "What it does"],
    rows: [
      [{ text: "T", tone: "gold", decoration: "badge" }, { text: "Get and Move Footprint: type any refdes and that part jumps to your cursor" }],
      [{ text: "X", tone: "gold", decoration: "badge" }, { text: "Route a track" }],
      [{ text: "V", tone: "gold", decoration: "badge" }, { text: "Drop a via mid-route and switch layers" }],
      [{ text: "M / R / D", tone: "gold", decoration: "badge" }, { text: "Move / rotate / drag a part (D keeps tracks attached)" }],
      [{ text: "B", tone: "gold", decoration: "badge" }, { text: "Fill all copper zones (the pour)" }],
      [{ text: "E", tone: "gold", decoration: "badge" }, { text: "Edit properties: track width, via size, zone net" }],
    ],
  },
  sect("03", "Floor-plan two zones, not one", "Connectors on the edges, the module as the hub, and the servo island kept together in its own corner."),
  prose(
    "Spend your first real effort on placement. A good floor plan makes the copper almost draw itself.\n\nThe L1.01 rules still hold. **Connectors live on edges**: the USB-C port where a plug reaches it, the breakout headers down the long sides where a breadboard reaches them. **Place by the same islands you drew in the schematic**, with U1 as the hub and its antenna overhanging the board edge.\n\nThe new rule is a zoning rule. **Everything on VSERVO goes in one corner, and the logic stays out of it.** J4, F2, D2, D3, C8, C9 and J5 are one cluster. The reason is the same reason the schematic kept them apart, made physical: the shorter and more self-contained the servo's current loop, the less of it ends up anywhere near the microcontroller's reference. A servo island scattered across the board is a servo island whose return current crosses everything.\n\nAnd there is a mechanical constraint you have not had before. **C8 is a 10 mm diameter can, 20 mm tall, on 5 mm lead pitch.** It is the tallest thing on the board by a wide margin, and it needs its footprint plus room for your fingers at assembly.",
  ),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "L1.04 floor plan, top view: U1 with its antenna overhanging, USB-C on one edge, breakout headers down the long sides, and the servo island grouped in one corner.",
    caption: "The floor plan: two zones sharing a board. Logic around U1, servo around C8, and only ground crossing between them.",
    captureHint: "KiCad PCB editor, L1.04 placed but unrouted, top view: U1 top with antenna overhanging, USB-C on an edge, J2/J3 down the long sides, and J4/F2/D2/D3/C8/C9/J5 clustered in one corner.",
  },
  does("place it, outside-in, logic first", [
    {
      text: "**U1 first**, with its **antenna end overhanging the board edge** and every castellated pad landed on copper. The module is the biggest part and the antenna constrains where it can go, so nothing else gets a vote until it is placed.",
      proof: "U1 sits with its antenna overhanging the outline and all castellated pads on the board.",
    },
    {
      text: "**J1 on an edge** where a plug can reach it, with **D1 hard against it** and R3 and R4 by the CC pins. The ESD array only protects what sits behind it.",
      proof: "J1 is on a board edge with D1 tight against it and the CC resistors nearby.",
    },
    {
      text: "**The regulator island** (U2, F1, C5, C6) near the USB end where the 5 V arrives: F1 right where VBUS enters, then U2 with its in and out caps tight to its pins.",
      proof: "The regulator island sits near the USB end with C5 and C6 tight to U2's pins.",
    },
    {
      text: "**Decoupling** C2 and C3 in open board just off U1's power side, each with its own **ground via**, and C1 near where the 3V3 rail enters. The WROOM's pads are castellations tucked under the module body, so you cannot sit a cap on them and you do not need to.",
      proof: "C1, C2 and C3 sit near U1's power side, each with a ground via.",
    },
    {
      text: "**Boot and reset** where fingers go: SW1 and SW2 on an edge or an open spot, R1 and R2 anywhere convenient, and **C7 near U1's EN pin**.",
      proof: "SW1 and SW2 sit where a finger can reach them and C7 sits near U1's EN pin.",
    },
    {
      text: "**LEDs and test points**: both LEDs where they can be seen with their resistors beside them, and TP1 and TP2 in open space with room for a probe clip.",
      proof: "Both LEDs are visible with their series resistors, and TP1 and TP2 have room for a clip.",
    },
  ]),
  does("now the servo island, as one cluster", [
    {
      text: "**J4 on a board edge**, screw openings facing **outward** so you can get a screwdriver in without leaning over the board. Put it on a different edge from J1 if you can: the two supplies then arrive from opposite directions and nobody plugs the wrong one into the wrong place.",
      proof: "J4 sits on an edge with its wire openings facing off the board.",
    },
    {
      text: "**F2 immediately after J4**, in line, with nothing else between the terminal and the fuse. Everything downstream depends on the fuse being upstream.",
      proof: "F2 sits between J4 and the rest of the servo island with no other part in between.",
    },
    {
      text: "**C8 next**, close to F2's output and with **its own ground via short and fat**. Check the footprint's diameter marking against the can you actually have, and leave a couple of millimetres around it: it is a through-hole part you will solder last and it will be in the way of everything.",
      proof: "C8 sits near F2's output with clearance around its 10 mm body and a ground via at its negative lead.",
    },
    {
      text: "**D2 and D3 beside C8**, both across the rail. Keep their ground ends near C8's ground end rather than scattered, so the whole protection cluster returns to the same place.",
      proof: "D2 and D3 sit adjacent to C8 with their ground pads near C8's ground pad.",
    },
    {
      text: "**C9 hard against the rail**, the way C2 and C3 sit against U1's supply. It is the fast partner and its value comes from being close.",
      proof: "C9 sits directly on the VSERVO node near C8, not out in open board.",
    },
    {
      text: "**J5 on an edge**, near C8, so the servo lead leaves the board cleanly and the path from the reservoir to the connector is short. **R7 near U1's IO4 pin**, not near J5: the resistor's job is to protect the GPIO, so it belongs at the GPIO end.",
      proof: "J5 sits on an edge near C8, and R7 sits near U1's IO4 pin rather than near the connector.",
    },
  ]),
  tube("Floor-plan two zones and place the servo island"),
  check(
    "**Why does R7 go near U1 rather than near J5?** Because its job is to bound fault current flowing *into* the GPIO. A resistor at the connector end still limits the current, but every millimetre of copper between the fault and the resistor is unprotected. Put the protection at the thing it protects, which is the same argument that puts D1 hard against J1.",
  ),
  gotcha(
    "C8 is 20 mm tall and everything else on this board is under 4 mm",
    "Plan for it now rather than at assembly. The can will block a soldering iron reaching anything within a few millimetres of it, and if you mount the board in an enclosure later, C8 sets the lid height. Give it a clear circle, keep small passives out of its shadow, and make sure its polarity marking stays readable once it is on the board.",
  ),

  // ── 04 keep-out ───────────────────────────────────────────────────────────
  {
    type: "callout", severity: "warn", label: "04 · The antenna keep-out",
    reason: "The one mistake you cannot fix later",
    body: "U1's antenna only works over empty board, and this is the one mistake you cannot fix without spinning a new board.",
  },
  prose(
    "The WROOM radiates from a printed antenna at one end, and it only works over **empty board**. Under and around it you keep an [[antenna keep-out]]: no copper, no [[ground pour]], no traces, and no silkscreen either, because even ink detunes it. Espressif's rule is to place the antenna **off the board**, with the feed point right at the edge.\n\nDo not lean on the checker for this. **DRC will not flag a missing keep-out** unless you have drawn the rule area. It is the headline review item on every board in this family.",
  ),
  {
    type: "image", src: "/guide-diagrams/antenna-keepout.svg",
    alt: "Board top view: ground pour fills the copper everywhere except a keep-out zone under the module's antenna, reaching the board edge.",
    caption: "The antenna keep-out: no copper, no pour, no traces, no silk. You fence it as a rule area.",
  },
  does("fence off the keep-out", [
    {
      text: "**Place ▸ Draw Rule Areas** and trace the dashed guide box already drawn around U1's antenna end on the `Cmts.User` layer. That dashed box is a **guide only**: it excludes nothing by itself and never reaches the fab. Snap your rule area to its corners.",
      proof: "A rule area covers the antenna end of U1 and reaches the board edge.",
    },
    {
      text: "In **Rule Area Properties**, under **Layers** tick **all four copper layers** (F.Cu, In1.Cu, In2.Cu, B.Cu) and **both silkscreens**. Under **Keepouts** tick **tracks, vias, pads and zone fills**. Zone fills is the one that matters: it is what stops the ground planes flooding the antenna.",
      proof: "The rule area lists all four copper layers and both silkscreens, with tracks, vias, pads and zone fills all kept out.",
    },
    {
      text: "Draw the **Edge.Cuts** outline so the antenna end of U1 **overhangs** it, with the module's antenna region sitting off the board over air.",
      proof: "The board outline stops short of the antenna and the module overhangs it.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "KiCad Rule Area Properties: all four copper layers and both silkscreens ticked, with tracks, vias, pads and zone fills kept out.",
    caption: "Rule Area Properties: all four coppers plus silk, and zone fills is the box that blocks the planes.",
    captureHint: "KiCad Rule Area Properties dialog: F.Cu, In1.Cu, In2.Cu, B.Cu and both silkscreens ticked, Keepouts tab with tracks, vias, pads and zone fills all checked.",
  },
  trace("the keep-out excludes everything", [
    { text: "Under **Layers**: all four copper layers and both silkscreens are ticked.", help: "Miss an inner layer and its plane floods under the antenna just the same, invisibly." },
    { text: "Under **Keepouts**: tracks, vias, pads and **zone fills** are all on.", help: "Zone fills is the one that matters. Miss it and a plane pours straight through the area you just fenced." },
    { text: "Nothing from the **servo island** strayed into the area.", help: "This board has a second rail wanting board space. A VSERVO zone that grew toward the antenna is a new way to make the old mistake." },
  ]),
  check(
    "**You pour ground everywhere for a clean return path. Why must it stop short of U1's antenna?** Copper near a printed antenna adds stray capacitance that shifts its tuning off 2.4 GHz. The radio still transmits, but most of the power reflects back instead of leaving the board, and no firmware setting recovers it.",
  ),

  // ── 05 decoupling ─────────────────────────────────────────────────────────
  sect("05", "Decoupling first, on both rails", "The caps you placed are worth exactly what their placement makes them worth."),
  prose(
    "A [[decoupling capacitor]] does its best work close to the pin it feeds, with a short fat path to ground, because the loop from cap to pin and back has inductance and inductance resists a fast change in current. That argument now applies twice on this board, at two very different scales.\n\nOn the **logic rail** it is the familiar one, softened by the module: the WROOM carries its own bypass caps inside, so C1, C2 and C3 are the board-level reservoir rather than the last millimetre. Get them reasonably near, each with a ground via, and do not distort the board chasing pads you cannot reach.\n\nOn the **servo rail** it is stronger, because nothing is helping you. **C8 is the only thing between the servo and a metre of supply wire.** Every millimetre between C8 and J5 pin 2 is inductance in the path the motor's fast current step has to come through, and there is no capacitor inside a hobby servo doing the job for you.",
  ),
  {
    type: "image", src: "/guide-diagrams/decoupling-placement.svg",
    alt: "Two panels: a decoupling cap right at the IC pin makes a small current loop; the same cap placed far makes a large loop that chokes the fast current.",
    caption: "Why placement matters: the current-loop area sets the inductance.",
  },
  {
    type: "table",
    columns: ["Cap", "Serves", "How close is close enough"],
    rows: [
      [{ text: "C2, C3", decoration: "ref" }, { text: "U1's 3V3 pins" }, { text: "Near, each with its own ground via. The module's internal decoupling covers the fast tier" }],
      [{ text: "C1", decoration: "ref" }, { text: "The 3V3 rail as a whole" }, { text: "Near where 3V3 enters. It is bulk, so a few millimetres are irrelevant" }],
      [{ text: "C5, C6", decoration: "ref" }, { text: "U2's input and output" }, { text: "Hard against the pins. An LDO with distant capacitors can oscillate" }],
      [{ text: "C9", decoration: "ref" }, { text: "VSERVO, fast" }, { text: "Directly on the rail beside C8. This is the one small cap on this board with no module helping it" }],
      [{ text: "C8", decoration: "ref" }, { text: "VSERVO, bulk" }, { text: "As short a path as you can manage to J5 pin 2 and to ground. It is the whole reservoir" }],
    ],
  },
  check(
    "**A decoupling cap is electrically correct in the schematic but sits 15 mm from the pin. Does it still work?** On the logic rail, mostly: the WROOM's internal decoupling covers the fast tier and yours tolerate the distance. On the servo rail, less so, because nothing inside the servo is covering for C8. Keep the at-the-pin habit in both places.",
  ),

  // ── 06 route ──────────────────────────────────────────────────────────────
  band("do", "in KiCad · Route the copper", "Hands on. The pair first, then power, then everything else."),
  sect("06", "Layers, vias and the layer pair", "Two outside layers for signals, two inside for solid ground, and one via preset you will want to shrink."),
  prose(
    "Routing four coppers turns on two controls. First, **the active layer**: click a layer's name in the Appearance panel to route on it, though starting a track from a pad drops you onto that pad's layer automatically. Second, **where a via comes out**: pressing `V` drops a through via and jumps you to the next layer in the **active layer pair**, so set that pair first under **Route ▸ Set Layer Pair** and choose **F.Cu / B.Cu**. That is the hop you want, top straight to bottom, because In1.Cu and In2.Cu are solid ground and you keep signals off them.\n\nYour starter ships three via presets: **1.0 mm, 0.8 mm and 0.6 mm**, with **0.6 mm annulus and 0.3 mm drill** as the fab floor. Most of the board uses the big one. Two places want smaller, and one of them is new.",
  ),
  {
    type: "table",
    columns: ["Trap", "Do this instead"],
    rows: [
      [{ text: "Routing a signal on an inner layer" }, { text: "In1.Cu and In2.Cu are solid ground. Keep signals on F.Cu and B.Cu; a trace on an inner plane cuts a slot the return current must detour around." }],
      [{ text: "Sharp 90 degree corners" }, { text: "Route in 45 degree bends, KiCad's default. Acute angles can trap etchant, and 45 is tidier and shorter." }],
      [{ text: "Crossing another net on one layer" }, { text: "Move one trace to the bottom with a via. B.Cu is a full signal layer with a ground plane under it." }],
      [{ text: "A via dropped inside a pad" }, { text: "Keep vias out of pads; they wick your solder away when you hand-solder. Put the via just beside the pad on a short stub." }],
      [{ text: "Routing across the antenna keep-out" }, { text: "Never. Route around it. No copper in that zone, ever." }],
      [{ text: "Necking a servo trace to squeeze past something" }, { text: "Move the something. A 0.25 mm section in an 0.8 mm rail is the whole thermal calculation undone at one point, and DRC will not see it as an error." }],
    ],
  },
  dive(
    "Do 90 degree corners really hurt? Mostly a myth",
    "You will hear that 90 degree trace corners cause reflections and wreck signals. At this board's speeds that is a myth. The reflection story only bites at multi-gigahertz edge rates on long controlled-impedance lines.\n\nThe kernel of truth is older: in the acid-etch days a sharp **acute** inside angle, sharper than 90, could trap etchant and over-etch a notch. A 90 degree corner is not acute, so even that barely applies.\n\nSo why route 45? It is a hair shorter, it looks professional, and it stops you ever drawing an accidental acute angle. KiCad routes 45 by default. Let it, and do not lose sleep over a right angle on a GPIO trace.",
  ),

  sect("07", "The USB data pair, first and alone", "The one net whose route quality actually depends on when you draw it."),
  prose(
    "USB `D+` and `D-` are a [[differential pair]]: the receiver reads the **difference** between them, so they must travel together, side by side, the same length, over unbroken ground. Because you named the nets `USB_D+` and `USB_D-` on the schematic, KiCad's **differential-pair router** already knows they are a pair. Reach it with hotkey `6`.\n\n**Route the whole pair before you touch another trace.** It starts at J1, which brings each data line out twice for reversibility, runs through **D1 first** so a static zap is clamped at the port, and finishes at the module's `IO19` and `IO20`. It stays clean only because it rides the solid inner ground plane the whole way.",
  ),
  does("do the pair, start to finish", [
    {
      text: "**Tie J1's flip-duplicates first, with the plain router (`X`).** Each data line comes out on two pads for reversibility. These are single-net ties, so use the normal router, and run one tie the long way round on the same layer to clear the other: no via, and no hole punched in the ground plane.",
      proof: "J1's duplicate data pads are tied on one layer with no via.",
    },
    {
      text: "**Now the pair itself with the differential-pair router (`6`).** Click one of J1's data pads and KiCad grabs its partner. Route from J1 **into D1** first.",
      proof: "The pair runs from J1 into D1, routed together as a coupled pair.",
    },
    {
      text: "**Ground D1 with a smaller via.** The auto Power-class via at 1.0 mm is too fat in the cramped ESD area and blocks the pair, so shrink that one to **0.8 mm with a 0.4 mm drill** from the via-size dropdown. Your stitching vias out in open copper stay big.",
      proof: "D1's ground pad ties to the planes through a shrunk 0.8 mm via and the pair still clears.",
    },
    {
      text: "**Carry on from D1 to the module's `IO19` and `IO20`**, spaced and length-matched the whole way, riding over the inner ground plane.",
      proof: "Two traces run side by side from D1 to U1's IO19 and IO20.",
    },
    {
      text: "**Tap the header** for the two data pins the way L1.01 does, dropping a single via where the far leg crosses the near one. A short stub off a full-speed pair is electrically invisible.",
      proof: "Both data nets reach their header pins, with a single via where the legs cross.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "Top view of the USB pair: two parallel traces from J1 through D1's I/O pins to U1's IO19 and IO20, side by side and equal length over the continuous inner ground plane.",
    caption: "The USB pair: routed together through D1, over the unbroken inner ground plane.",
    captureHint: "KiCad PCB editor zoomed on the L1.04 USB pair: two parallel traces from J1 through D1 to U1's IO19 and IO20, over the inner ground plane.",
  },
  gotcha(
    "shrink the GND via at D1, or the pair will not route",
    "When you tie D1's ground pad into the planes, the via KiCad drops takes the wide **Power-class** size of 1.0 mm. In the cramped ESD area that via plus its clearance blocks the pair from leaving D1. Pick the **0.8 / 0.4 mm** preset for that one via. 0.6 / 0.3 mm is the fab floor if you ever want more room. Only this cramped one shrinks.",
  ),

  // ── 08 the servo rail in copper ───────────────────────────────────────────
  sect("08", "The servo rail in copper", "Wide, short, and self-contained. This is the section where the design's amps become geometry."),
  prose(
    "With the pair down, route the servo rail before the rest of the logic, while you still have room to make it wide and direct.\n\nThe path is **J4 pin 1 to F2 to the VSERVO node to J5 pin 2**, with D2, D3, C8 and C9 all hanging off that node. On the Servo class every one of those segments draws at **0.8 mm or wider** automatically. Two properties matter more than tidiness: the run should be **short**, because length is inductance in the path the motor's current step travels, and it must be **uniformly wide**, because the thermal number is only true at the narrowest point.\n\nConsider pouring it. On a rail this short with this much room, drawing **VSERVO as a small filled zone** on the top layer, rather than as a trace, gives you more copper than the minimum for no effort and no risk of a neck. KiCad treats it exactly like the ground pour: assign the zone to VSERVO, and it fills around the pads that belong to it.",
  ),
  does("route the servo rail", [
    {
      text: "**J4 pin 1 to F2**, on the Servo class. Short and direct: this segment carries every amp the servo will ever draw, including the fault current that trips the fuse.",
      proof: "A trace at 0.8 mm or wider runs from J4 pin 1 to F2 with no narrow section.",
    },
    {
      text: "**F2 to the VSERVO node**, then out to **C8's positive lead, D2's cathode, D3's cathode, C9, and J5 pin 2**. Keep C8 on the short side of that node: everything else can be a little further.",
      proof: "Every VSERVO pad is connected at 0.8 mm or wider, with C8 closest to the node.",
    },
    {
      text: "**Or pour it.** Add a filled zone on F.Cu covering the servo island, set **Net name = VSERVO**, and fill (**B**). Check that it reached every VSERVO pad and that it did not creep toward the logic side or the keep-out.",
      proof: "If poured, the VSERVO zone covers every VSERVO pad and touches nothing on the logic side.",
    },
    {
      text: "**Route SIG on Default.** IO4 to R7, then R7 to J5 pin 3 at 0.25 mm. It is a logic pulse into a high-impedance input, so it needs no width. Keep it away from the servo power path where you can: parallel runs of a switching power line and a signal line are how noise gets coupled.",
      proof: "SIG runs at 0.25 mm from R7 to J5 pin 3 and does not run alongside the VSERVO path.",
    },
    {
      text: "**Check the narrowest point.** Click along the whole VSERVO path and read the width in the status bar. Any segment KiCad drew at Default width is a segment you started from the wrong pad, and it will pass DRC.",
      proof: "Every segment of the VSERVO path reads 0.8 mm or wider.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "The servo island routed: a wide short path from the screw terminal through the fuse to the bulk capacitor and out to the 3-pin header, with the signal trace routed away from it.",
    caption: "The servo rail in copper: wide, short, and kept in its own corner.",
    captureHint: "KiCad PCB editor zoomed on the L1.04 servo island, routed: J4 to F2 to C8 to J5 at 0.8 mm or as a poured zone, with the thin SIG trace visibly separate.",
    reveal: "See it wired · the servo rail",
  },
  tube("Route the servo rail wide and short"),
  check(
    "**DRC passes, but one 3 mm section of your VSERVO path is 0.25 mm wide. Is that a problem?** Yes, and DRC will never say so, because 0.25 mm is legal copper. Current does not average itself out along a trace: that narrow section carries the same 0.9 A through a third of the metal, so it runs hot while the rest of the rail is fine. The thermal number is only true at the narrowest point.",
  ),

  sect("09", "One ground, tied at one point", "The subtlety that separates a board that works from a board that works reliably."),
  prose(
    "The servo and the logic share ground. That is by design and it is not optional: the servo's signal needs a reference that both ends agree on, and current needs a way home.\n\nBut *where* they share it is a real decision. The servo's return is not a quiet DC current. The motor's internal driver switches, so the return arrives in pulses, and any length of conductor carrying a changing current develops a voltage across it: partly from plain resistance, and partly from inductance, which is the L times di/dt term. If the servo's pulsing return has to travel through the same stretch of copper the microcontroller uses as its zero-volt reference, then the microcontroller's idea of zero moves around slightly every time the motor switches.\n\nThe fix is a **single-point tie**. Bring the servo's grounds together at **C8's ground**, and let that one place be where the servo ground meets the logic ground plane. The motor's loop then closes locally, between C8 and the servo, and never runs through the region the logic references.",
  ),
  {
    type: "image", src: "",
    alt: "Two ground paths compared: a servo return threading through the logic ground region, versus the same return closing locally at the bulk capacitor with one tie to the plane.",
    caption: "Same schematic, two boards. The loop the servo's return draws is a placement decision.",
    captureHint: "Two-panel diagram. Left: a servo return path crossing the logic ground area. Right: the same return closing at C8 with one tie to the plane. Current loop arrowed in both.",
  },
  does("give the servo return one way home", [
    {
      text: "**Gather the servo grounds.** J4 pin 2, D2's anode, D3's anode, C8's negative lead, C9's free leg and J5 pin 1 should all sit close together and connect to each other first, at **C8's ground pad**.",
      proof: "Every servo-side ground pad connects at or immediately beside C8's negative lead.",
    },
    {
      text: "**Tie that node to the plane at one place**, with a short fat drop: a via or a small cluster of vias right at C8's ground, straight down into the inner planes.",
      proof: "C8's ground has its own vias into the inner planes, and they are the servo island's main connection to them.",
    },
    {
      text: "**Keep J5 pin 1's return short.** The servo's ground wire is the other half of every amp leaving pin 2, so the path from J5 pin 1 back to C8's ground should be as short and wide as the supply side.",
      proof: "The path from J5 pin 1 to C8's ground is as short and wide as the VSERVO path.",
    },
    {
      text: "**Do not route a separate ground trace back to the logic side.** The plane already connects them. Adding a second deliberate path creates a loop, which is the opposite of what a single-point tie is for.",
      proof: "No hand-routed ground trace runs between the servo island and the logic side.",
    },
  ]),
  dive(
    "Why this is a layout problem and not a schematic one",
    "On the schematic, every ground symbol is the same net. There is exactly one GND, it has no resistance, and the drawing cannot express the difference between a good ground and a bad one. That is not a flaw in the tool: a schematic describes **connectivity**, and both boards described here are connected identically.\n\nWhat differs is **geometry**, and geometry is what layout is for. A real ground plane has a small resistance and a small inductance between any two points on it. Push a quiet milliamp through that and nothing happens. Push an amp that switches at a few kilohertz through it and you develop millivolts, in a place your analog readings and your reset threshold both care about.\n\nThe design flagged this as a risk to close at layout precisely because there is nothing to be done about it anywhere else. It is also why the guide does not ask you to derive it. The instruction is simple, the reasoning is not, and following the instruction gets you a board that behaves.\n\nIf you want to see the effect rather than take it on faith: at bring-up, scope the 3.3 V test point with the servo running, then jam the servo and watch the same trace. Anything you see there that is not the supply sagging is the ground moving.",
  ),
  gotcha(
    "the servo return that took the scenic route",
    "The failure this prevents is not dramatic and that is what makes it expensive. The board works. Then the analog readings on the header wobble whenever the servo moves, or a long move occasionally resets the chip, and nothing in the schematic explains either. Tie the servo grounds at C8, drop them into the plane there, and neither symptom shows up.",
  ),

  // ── 10 pour ───────────────────────────────────────────────────────────────
  band("do", "in KiCad · Pour and stitch the ground", "Hands on. Flood the planes and tie everything to them."),
  sect("10", "Pour and stitch", "Ground is not a net you route. It is a surface you flood and then connect between layers."),
  prose(
    "You routed power and signals and left every GND pad open. Now make ground real. Fill **In1.Cu** and **In2.Cu** as GND zones: those two inside layers are the board's ground. Add GND pours on **F.Cu** and **B.Cu** around the parts too, and tie all four together with a scatter of **[[stitching via|stitching vias]]** so the ground reads as one continuous body.\n\nTwo ties matter most, and this board has three. Vias under **U1's centre pad**, its main ground and heat path. A via next to each decoupling cap. And the cluster at **C8's ground** from the last section, which is the servo island's one way into the planes.\n\nThe one place copper must stop is the antenna keep-out, which your rule area already handles on every layer.",
  ),
  does("pour, fill and stitch", [
    {
      text: "For each of **In1.Cu** and **In2.Cu**: click that layer in the Appearance panel, hit **Add a filled zone**, and in **Copper Zone Properties** set **Net name = GND**. Do the same for smaller GND pours on F.Cu and B.Cu around the parts.",
      proof: "In1.Cu and In2.Cu carry filled GND zones and F.Cu and B.Cu carry smaller GND pours.",
    },
    {
      text: "Press **B** to fill everything. Look at the result rather than trusting it: check the inner planes are genuinely solid, that the fill respected the keep-out on every layer, and that the VSERVO zone (if you poured one) did not get swallowed.",
      proof: "All zones filled, the antenna keep-out is empty on every layer, and VSERVO is still its own copper.",
    },
    {
      text: "**Stitch** with free-standing vias about every **10 mm** across the open pour. Each is a **through via** from F.Cu to B.Cu, so because all four coppers are GND, one via ties all four at once.",
      proof: "Stitching vias sit about every 10 mm across the open pour.",
    },
    {
      text: "**Cluster where current concentrates.** At least **nine ground vias** on U1's centre pad, straight into the planes, which is Espressif's floor and the module's heat path. And the cluster at C8's ground.",
      proof: "At least nine vias sit on U1's centre pad and a cluster sits at C8's ground.",
    },
    {
      text: "**Refill (B) after the last via.** A zone you nudged and never refilled ships as whatever it looked like before you moved it.",
      proof: "Zones refilled after the final edit.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "The two inner ground planes filled, with top and bottom pours and stitching vias tying all four layers, notched out under the antenna, with a via cluster at the bulk capacitor's ground.",
    caption: "The poured and stitched ground, notched at the keep-out, with the servo island's one tie into the planes at C8.",
    captureHint: "KiCad PCB editor: In1 and In2 GND planes filled plus top and bottom pours, stitching vias about every 10 mm, a cluster on U1's centre pad and another at C8's ground, keep-out empty.",
  },
  tube("Pour and stitch the ground"),
  dive(
    "Why you can still solder a pad that touches a ground plane",
    "Flood two whole layers with copper and every GND pad should become impossible to heat: the plane would wick your iron's heat away as fast as you deliver it.\n\nKiCad handles it. When a zone fills around a pad on its own net it connects through **thermal reliefs**: a few thin spokes that carry the current but throttle the heat path, so the pad still climbs to temperature under an iron. Fill the zones and you can see them, little wagon-wheel spokes around each GND pad.\n\nTwo exceptions on this board. **U1's centre pad** meets the plane through its via cluster and wants real preheat rather than a hopeful iron. And **C8's ground**, a through-hole lead in heavy copper with a via cluster beside it, is the single hardest joint on the board to heat. Section 03 of the assembly card comes back to it.",
  ),
  gotcha(
    "a zone you nudged and never refilled",
    "KiCad shows the last computed fill, not the current one. Move a trace after filling and the display can still show the old copper. Press **B** before you look, and again before you export.",
  ),

  // ── 11 silk ───────────────────────────────────────────────────────────────
  band("do", "in KiCad · Label what a beginner will get wrong", "Hands on. On this board the silkscreen is part of the safety design, not decoration."),
  sect("11", "Silk that stops the mistake", "Three of this board's five risks are wiring mistakes, and silkscreen is the mitigation for all three."),
  prose(
    "L1.01's silkscreen was about usability: which pin is which, which button is BOOT. This board's silkscreen is about **preventing damage**, and the design says so explicitly. Mis-wiring is the headline user error, and every marking below is the countermeasure for a specific failure that has its own row in the risk register.\n\nPut header labels on the **back** (`B.Silkscreen`) with **mirror** ticked so they read the right way round, and put anything you look at while wiring on the **front**.",
  ),
  does("label the board", [
    {
      text: "**Place ▸ Add Text**, set **Layer = B.Silkscreen**, tick the **mirror** button, and size it about **1 mm** high with **0.15 mm** thickness. Leave **Font = KiCad Font**: the stroke font stays crisp at this size where a TrueType font blobs.",
      proof: "The Add Text dialog reads B.Silkscreen, mirror on, about 1 mm and 0.15 mm.",
    },
    {
      text: "**J4's polarity, on the front.** Mark **+** beside pin 1 and **-** beside pin 2, large enough to read while you are holding a screwdriver. This is the marking that stands between a learner and a reversed supply.",
      proof: "J4 carries clear + and - marks on the front silk beside the correct pins.",
    },
    {
      text: "**J5's pin order, on the front.** Label **GND**, **V+** and **SIG** beside pins 1, 2 and 3. Add a **1** or a small triangle at pin 1 so the order is unambiguous when a servo lead covers the text.",
      proof: "J5 carries GND, V+ and SIG labels and a pin-1 marker on the front silk.",
    },
    {
      text: "**The two rails, named.** Put a short label near J4 reading something like **SERVO 5V IN** and another near J1's end reading **USB**. Two power inputs on one board, and nothing else on it says which is which.",
      proof: "The board's front silk names the servo supply input and the USB input separately.",
    },
    {
      text: "**Cathode marks and pin 1.** Check that D2's and D3's footprints carry a visible band or bar on the silk, and that C8's footprint marks its **negative** side. These are the three polarised parts and the silk is what you check them against at assembly.",
      proof: "D2, D3 and C8 all carry a visible polarity marking on the silkscreen.",
    },
    {
      text: "**The header pins and the buttons**, as on L1.01: every J2 and J3 pin labelled with its signal on the mirrored back silk, and **SW1 = EN** and **SW2 = BOOT** on the front by their buttons.",
      proof: "Every breakout pin carries a mirrored back-silk label and both buttons are named on the front.",
    },
    {
      text: "**Stamp the revision.** Add a silkscreen text with the **commit hash** of the design you built from. That is how a physical board tells you which version of the layout you are holding.",
      proof: "A silkscreen label carries the design's commit hash.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "The servo connectors' silkscreen: plus and minus at the screw terminal, GND / V+ / SIG with a pin-1 marker at the 3-pin header.",
    caption: "The silkscreen that does real work: polarity at the terminal, pin order at the header.",
    captureHint: "KiCad PCB editor zoomed on J4 and J5 with the front silkscreen visible: + and - at the terminal, GND / V+ / SIG and a pin-1 marker at the header. All text legible.",
    reveal: "See it wired · the silkscreen that matters",
  },
  check(
    "**Silkscreen is not copper and DRC barely cares about it. Why spend a section on it?** Because three of this board's five main risks are a person wiring something backwards, and the mitigation for all three is a marking they can read at the moment they wire it. A crowbar diode protects against a reversed supply; a clear plus and minus prevents it.",
  ),

  // ── check + DRC ───────────────────────────────────────────────────────────
  band("check", "Eyeball what DRC cannot catch", "Verify. The checker measures distances against your fab's numbers. It does not understand intent."),
  prose(
    "DRC compares your board against PCBWay's limits. It cannot tell you the keep-out is in the wrong place, that the servo rail necks down, that the servo's return threads through the logic ground, or that J5's pins are in the wrong order. Those are intent, and intent is what the answer key is for.",
  ),
  trace("check these against the answer key before you run DRC", [
    { text: "The **antenna keep-out** is genuinely empty on every copper layer and both silks.", help: "Check each layer on its own, not just the top. This is the one that costs you range and DRC will never mention it." },
    { text: "Every segment of **VSERVO** is 0.8 mm or wider, with no necked-down section.", help: "A narrow section is legal copper, so DRC passes it. Click along the whole path and read the width." },
    { text: "The **servo grounds gather at C8** and drop into the plane there, with no separate ground trace to the logic side.", help: "This is the RK8 item. A servo return threading through the logic ground region is the subtle failure that shows up as wobbling analog readings months later." },
    { text: "**J5 reads GND, V+, SIG** and its front silk says so.", help: "Electrically valid in any order, mechanically wrong in all but one. Check the physical pin numbering, not the net names." },
    { text: "**J4's + and - marks** match the actual pins, and D2, D3 and C8 all show their polarity on silk.", help: "Silk mismatched to the footprint is worse than no silk, because it is confidently wrong." },
    { text: "The **USB pair** is matched and runs over unbroken inner ground the whole way.", help: "Follow it across the board. A split or a gap in the plane under the pair is the thing to catch." },
    { text: "**U1's centre pad** is stitched to ground with at least nine vias.", help: "It is the module's main ground and heat path. A cluster of vias straight into the planes." },
    { text: "**Every decoupling cap** is near its pin with its own ground via, including C9 beside C8.", help: "Far-away decoupling passes DRC and still browns out under load." },
  ]),
  {
    type: "image", src: "", zoom: true,
    alt: "Finished L1.04 board, top view: the logic zone around U1 with the antenna overhanging, and the servo zone with its wide rail, big electrolytic and 3-pin header.",
    caption: "The answer key: check your placement, routing, pour, keep-out and silk against this.",
    captureHint: "KiCad finished L1.04 board, hi-res top view, all four layers visible: U1 with antenna overhanging behind the keep-out, headers down the long sides, servo island with its wide rail and C8.",
  },

  band("do", "in KiCad · Run DRC to zero and export", "Hands on. Clean, or every remaining flag understood and written down."),
  sect("12", "Run DRC", "You set your fab's rules up front and routed inside them, so this is the confirmation, not a surprise."),
  {
    type: "table",
    columns: ["DRC says…", "…you do"],
    rows: [
      [{ text: "Clearance violation" }, { text: "Two coppers too close: nudge a trace or part apart." }],
      [{ text: "Track / via too small" }, { text: "Widen the track, or grow the via past its minimum." }],
      [{ text: "Unconnected items" }, { text: "A ratsnest line you never routed: finish it, or mark it no-connect on purpose." }],
      [{ text: "Courtyard overlap" }, { text: "Two parts physically clash: move one. On this board that usually means C8." }],
    ],
  },
  does("run it, read it, clear it", [
    {
      text: "Run **Inspect ▸ Design Rules Checker**. Tick **Refill all zones before performing DRC**, because fills go stale the moment you nudge anything, and **Test for parity between PCB and schematic**, which catches a schematic edit you never pushed across.",
      proof: "Both tickboxes are on before the run.",
    },
    {
      text: "**Clear the errors to zero. Warnings are fine.** Errors are things the fab cannot build or nets you forgot to route. Warnings are cosmetic, like silk crossing a pad. Fix every error, refill (**B**), and re-run until errors and unconnected items both read **0**.",
      proof: "The DRC summary reads 0 errors and 0 unconnected items, with only cosmetic warnings left.",
    },
    {
      text: "If a flag comes from the stock module footprint rather than your work, use **Exclude** and write down why. An excluded flag you cannot explain is a flag you have not understood.",
      proof: "Any remaining flags are excluded with a written reason.",
    },
    {
      text: "**Save the report.** The next stage runs one last DRC and takes the clean report as its proof, so hold on to that `.rpt`.",
      proof: "A .rpt file is saved for the next stage.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "KiCad Design Rules Checker reporting zero violations and zero unconnected items against the fab's rules.",
    caption: "DRC clean against PCBWay's own numbers, with both tickboxes on.",
    captureHint: "KiCad Design Rules Checker dialog showing 0 violations and 0 unconnected items, with Refill all zones and Test for parity both ticked.",
  },

  {
    type: "quiz",
    prompt: "Quick check: layout",
    gate: true,
    questions: [
      {
        id: "servo-net-class", reviewId: "l104-servo-net-class",
        q: "Why does VSERVO get its own net class instead of joining Power at 0.5 mm?",
        options: [
          "Because 0.9 A in 1 oz copper needs at least 0.8 mm, and widening Power would force every logic rail wider too",
          "Because KiCad requires a separate class for any net fed by a connector",
          "Because the servo rail is a different voltage from the logic rails",
        ],
        answer: 0,
        explain: "One net needs the width, so the width goes to one net class. Power threads through tight areas near the USB connector for a current that never arrives there.",
      },
      {
        id: "narrow-section",
        q: "One 3 mm stretch of your VSERVO path came out at 0.25 mm. DRC passes. Is it a problem?",
        options: [
          "No, DRC is the authority on trace width",
          "Yes: the whole 0.9 A goes through that narrow section, so it runs hot while the rest of the rail is fine",
          "No, as long as the average width across the rail is above 0.8 mm",
        ],
        answer: 1,
        explain: "0.25 mm is legal copper, so the checker has nothing to say. The thermal calculation is only true at the narrowest point.",
      },
      {
        id: "single-point-tie", reviewId: "l104-single-point-tie",
        q: "The servo's ground and the logic ground are one net. Where should they physically meet?",
        options: [
          "Everywhere, with as many connections as possible between the two zones",
          "Nowhere: they should be separate ground nets",
          "At one place, at the bulk capacitor's ground, so the motor's switching return closes locally",
        ],
        answer: 2,
        explain: "A pulsing return current develops a voltage along whatever copper it crosses. Tie it at C8 and that loop never runs through the region the microcontroller uses as its zero.",
      },
      {
        id: "rules-before-route",
        q: "Why load your fab's design rules into Board Setup before you route anything?",
        options: [
          "So KiCad enforces them live and every trace is manufacturable as you draw it",
          "You do not: you check at the very end and fix whatever fails",
          "To make DRC run faster at the end",
        ],
        answer: 0,
        explain: "With the rules loaded you cannot draw a trace the fab cannot make, so the board is buildable from the first trace instead of a re-do at the end.",
      },
      {
        id: "antenna-keepout",
        q: "The module has a printed antenna at one end. What goes under and around it?",
        options: [
          "A ground pour, for shielding",
          "Nothing: no copper, no traces, no pour, no silk",
          "The bulk capacitor, since it needs the space",
        ],
        answer: 1,
        explain: "Copper near the antenna detunes it and collapses your range, so that zone stays completely bare on all four layers and both silks.",
      },
      {
        id: "ground-planes-why",
        q: "Why give the two inside layers over to solid ground planes?",
        options: [
          "Only to look professional",
          "To make the board more rigid",
          "They are the low-impedance return path every signal on the outside layers needs",
        ],
        answer: 2,
        explain: "Every current returns through ground. A solid plane right under each signal layer is the shortest way home, which is what keeps the rail steady and the data clean.",
      },
      {
        id: "silk-is-safety",
        q: "Why does this board's silkscreen get a whole section when L1.01's did not?",
        options: [
          "Silkscreen affects the board's electrical performance",
          "Because three of this board's main risks are somebody wiring something backwards, and a readable marking is the mitigation",
          "Because the fab charges less for well-labelled boards",
        ],
        answer: 1,
        explain: "A crowbar diode protects against a reversed supply; a clear plus and minus prevents one. Both are part of the design.",
      },
      {
        id: "refill-zones",
        q: "You move a trace after pouring the ground, then export. What is the risk?",
        options: [
          "The zone refills automatically, so there is none",
          "KiCad shows the last computed fill, so the copper you exported may not match what you see",
          "The board outline changes size",
        ],
        answer: 1,
        explain: "Press B to refill before you look and again before you export, or you ship whatever the zone looked like before the edit.",
      },
      {
        id: "drc-blind-spots", reviewId: "l104-drc-blind-spots",
        q: "DRC reports zero errors. Which of these will it still not catch?",
        options: [
          "A trace thinner than the fab can etch",
          "Two pads too close together",
          "A servo return current routed through the middle of the logic ground",
        ],
        answer: 2,
        explain: "DRC measures clearances, widths and drills. It is blind to intent, which is what the eyeball list and the answer key are for.",
      },
    ],
  },

  exit(
    "You have a placed, routed, poured board that passes DRC against PCBWay's own rules, with the antenna keep-out fenced on all four layers, a servo rail wide enough for its worst-case current, and one tie point between the two grounds. Save the DRC report. The next stage runs one last check and exports the Gerbers the factory builds from, and those come from exactly this board file.",
  ),

  ref("ESP32-S3 Hardware Design Guidelines (Espressif): PCB layout, ground return paths and the antenna keep-out", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html"),
  ref("PCBWay's KiCad design-rules file: the fab's own limits, loaded before you route", "https://github.com/pcbway/PCBWay-Design-Rules"),
  ref("USB 2.0 specification (USB-IF): full-speed signalling and the D+/D- differential pair", "https://www.usb.org/document-library/usb-20-specification"),
  ref("KiCad 10: PCB Editor manual, design rules, rule areas and zone filling", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
];

publishCard({ slug: "l1-04-single-servo", stage: "LAYOUT", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
