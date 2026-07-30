// L1.02 ESP-NOW link — LAYOUT card.
//
// Authored ahead of the board from docs/boards/l1-02-espnow-link/{design.md,
// bom.csv,validation-log.md}, with L1.01's LAYOUT card as gospel for everything the
// two boards share (4 copper layers at 1.6 mm, Default 0.25 / Power 0.5 net
// classes, the PCBWay .kicad_dru, the 0.6/0.3 mm via preset, the USB pair, pour and
// stitch, the DRC flow).
//
// The card this replaces was correct but compressed ("checklist speed", "at recall
// speed", 3 numbered sections against L1.01's 9). The owner rejected that
// compression on 2026-07-22: L1.01 is the bar for every lesson.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Layout: placing and routing the ESP-NOW node"),

  band("orient", "What layout is doing here", "Read this once. The board is small and the radio is the whole point."),
  prose(
    "Layout is where the schematic becomes copper with a shape. You place each part, draw the board outline, run the connections as real traces on real layers, flood the leftover space with ground, and prove the result against the fab's limits. The schematic said what connects to what. Layout says where it physically sits and how wide the metal is.\n\nThis board reuses L1.01's power and USB chain exactly, so most of the work is familiar. One thing is genuinely different and it decides whether the board works at all: **U1 carries the 2.4 GHz antenna on the module itself**, and copper near that antenna detunes it. On L1.01 the keep-out was good practice. Here it is load-bearing.",
  ),
  shot(
    "Four copper layers at 1.6 mm: signals on the two outer layers, solid ground on the two inner ones.",
    "KiCad Board Setup > Physical Stackup for the L1.02 board: 4 copper layers, 1.6 mm total, dielectric thicknesses visible.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Set up the board", "Hands on. Rules before routing, every time."),
  sect("01", "Set up the fab's rules before you route", "Load PCBWay's limits first so the checker measures against the factory that will build this."),
  prose(
    "A design rule check is only as honest as the numbers you give it. KiCad ships with permissive defaults that no cheap fab can actually hold, so a board can pass DRC and still come back unbuildable. Loading the fab's own rule file first means every trace you draw is measured against what that factory can etch.\n\nThis is the same PCBWay `.kicad_dru` file you used on L1.01, from the same fab. Copy it beside the new board file and rename it to match the project.",
  ),
  does("load the rules, set the stackup", [
    {
      text: "Open **File ▸ Update PCB from Schematic** (F8). Every part lands in a loose pile joined by thin white **ratsnest** lines. Each line is one connection you have not made yet.",
      proof: "The pile is on the board and the ratsnest is visible.",
    },
    {
      text: "**Board Setup ▸ Physical Stackup:** set **4 copper layers** at **1.6 mm** total. Four layers buys two things on this board: a solid ground plane directly under the signals, and somewhere to put ground that is not competing with traces.",
      proof: "Stackup reads 4 layers, 1.6 mm.",
    },
    {
      text: "**Board Setup ▸ Design Rules ▸ Net Classes:** confirm **Default at 0.25 mm** and **Power at 0.5 mm**, with VBUS, +5V and +3V3 assigned to Power. The wider power class is not decoration: VBUS carries up to about **0.5 A** on this board.",
      proof: "Both net classes exist and the three power nets sit in Power.",
    },
    {
      text: "Drop **PCBWay's `.kicad_dru`** beside the board file, renamed to the project, or paste its contents into **Board Setup ▸ Design Rules ▸ Custom Rules**. Open the panel and read it back.",
      proof: "The Custom Rules panel is not empty.",
    },
  ]),
  shot(
    "Custom Rules filled with the fab's rule text, not an empty panel.",
    "KiCad Board Setup > Design Rules > Custom Rules with the PCBWay .kicad_dru text loaded and visible.",
  ),
  tube("Set up the stackup, net classes and the fab rules"),
  check(
    "**DRC passes with KiCad's defaults but your fab rejects the board. What happened?** You checked against KiCad's limits instead of the factory's. The defaults allow clearances a low-cost process cannot etch. Load the fab's rule file first and DRC starts telling you the truth.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Place every part", "Hands on. Placement decides how hard routing will be."),
  sect("02", "Floor-plan before you route", "Where a part sits is a routing decision you make before you draw a single trace."),
  prose(
    "Placement is the cheapest optimisation on the board. A part in the right place makes its traces short and obvious. A part in the wrong place makes them long, forces vias, and pushes copper toward the antenna. You cannot route your way out of a bad floor plan.\n\nWork outside-in: connectors and anything a finger touches go on edges first, then the parts that must be near them, then everything else fills the middle.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Where it goes"],
    rows: [
      [{ text: "U1" }, { text: "ESP32-S3-WROOM-1" }, { text: "Top short edge, antenna end overhanging the board outline" }],
      [{ text: "J1" }, { text: "USB-C receptacle" }, { text: "Bottom edge, centred, inside its silkscreen" }],
      [{ text: "D1" }, { text: "USBLC6-2 ESD array" }, { text: "Hard against J1, in the D+/D- path" }],
      [{ text: "R3, R4" }, { text: "5.1 k CC pull-downs" }, { text: "Beside J1's CC pins" }],
      [{ text: "SW1, SW2" }, { text: "EN and BOOT buttons" }, { text: "Together on one edge, as on L1.01" }],
      [{ text: "SW3" }, { text: "USER / SEND button" }, { text: "Alone on the opposite edge" }],
      [{ text: "LED2" }, { text: "LINK LED on GPIO47" }, { text: "On the face, near SW3" }],
      [{ text: "J2" }, { text: "Expansion header" }, { text: "Down one long side, labels outward" }],],
  },
  does("place it, outside-in", [
    {
      text: "**U1 first.** Antenna end overhanging the **top short edge**, every castellated pad landed on the board. U1 is the biggest part and the antenna constrains where it can go, so nothing else gets a vote until it is placed.",
      proof: "U1 sits at the top, antenna overhanging, all castellated pads on copper.",
    },
    {
      text: "**J1 centred on the bottom edge**, inside its silkscreen outline, with **D1 hard against it** and R3/R4 by the CC pins. The ESD array only protects what it sits in front of, so it goes between the connector and everything downstream.",
      proof: "J1 is on the bottom edge with D1 tight against it.",
    },
    {
      text: "**The three buttons where fingers go.** SW1 (EN) and SW2 (BOOT) share one edge as on L1.01. **SW3 (USER) goes alone on the opposite edge**, so a send-press can never fat-finger a reset mid-demo.",
      proof: "SW1 and SW2 share an edge; SW3 sits apart on the opposite one.",
    },
    {
      text: "**J2 down one long side**, labels facing outward, so jumper wires leave the board cleanly. **LED1 and LED2 on the face**, with LINK LED2 near SW3: press here on one node, look here on the other.",
      proof: "J2 runs down one long side with labels outward and both LEDs are visible on the face.",
    },
    {
      text: "**U2 and its capacitors in the middle**, between J1's VBUS and U1's 3V3 pin, so the power path runs in a straight line rather than doubling back.",
      proof: "U2 sits between the connector and the module with no detour in the power path.",
    },
  ]),
  shot(
    "The floor plan: U1 at the top with the antenna clear, J1 at the bottom, buttons on opposite edges.",
    "KiCad PCB editor, top view, all parts placed and nothing routed yet. U1 antenna overhanging the top edge, J1 bottom-centre, SW3 opposite SW1/SW2, J2 down one side.",
  ),
  tube("Floor-plan the node and fence the antenna keep-out"),
  check(
    "**You place J2 across the top edge, beside the antenna. Why is that a problem?** A header is a row of copper pads and the wires you plug into it are more copper still, sitting right where the antenna radiates. The link will be weak and you will blame the firmware. Keep the antenna end clear of everything.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The antenna keep-out, and why it matters more here", "Copper near a PCB antenna detunes it. This board is a radio, so this is the rule that decides whether it works."),
  prose(
    "The ESP32-S3-WROOM-1 has its antenna printed on the module, at one end. That antenna is tuned assuming nothing conductive sits next to it. Put copper underneath or beside it and you shift its resonance and absorb the energy it is trying to radiate: the link gets short-range or intermittent.\n\nEspressif's hardware design guidelines are explicit that the antenna area must be kept clear and should overhang the carrier board edge. On L1.01 you could get away with a sloppy keep-out because nothing depended on range. Here two nodes have to hear each other, so the keep-out is the difference between a working demo and a mystery.",
  ),
  does("fence the keep-out before any copper exists", [
    {
      text: "Select **Draw ▸ Rule Area** and draw a rectangle over the antenna end of U1, extending to the board edge and slightly past the module outline on both sides.",
      proof: "A rule area covers the antenna end and reaches the board edge.",
    },
    {
      text: "In **Rule Area Properties**, tick **all four copper layers**, then tick **Keep out tracks**, **Keep out vias**, **Keep out pads** and **Keep out copper pours**. All four layers matters: an inner ground plane under the antenna detunes it just as effectively as a top-layer trace.",
      proof: "The rule area lists all four copper layers and all four keep-out boxes are ticked.",
    },
    {
      text: "Draw the **Edge.Cuts** outline so the antenna end of U1 **overhangs** it. The module's own antenna region should sit off the board, over air.",
      proof: "The board outline stops short of the antenna; the module overhangs it.",
    },
  ]),
  shot(
    "The keep-out as a real rule area: all four copper layers, everything excluded, antenna overhanging the outline.",
    "KiCad Rule Area Properties dialog open over the antenna keep-out, all four copper layers ticked and all four keep-out options ticked, board outline visible under the module.",
  ),
  {
    type: "traceList",
    headline: "Eyeball the keep-out before you route",
    body: "",
    items: [
      { text: "The rule area covers the whole antenna region, not just the tip", help: "A partial fence still leaves copper in the near field. Cover the printed antenna and a margin around it." },
      { text: "All four copper layers are ticked, not just F.Cu", help: "The inner planes are the easiest to forget and the most likely to be flooded later by the pour." },
      { text: "The board outline stops short so the antenna overhangs", help: "FR4 under the antenna loads it too. Air is the intended dielectric." },
      { text: "No test point, via or silkscreen-only feature strayed into the area", help: "Silkscreen is harmless, copper is not. Check what is actually on a copper layer." },
    ],
  },
  gotcha(
    "the pour will flood it if you let it",
    "A keep-out drawn without **Keep out copper pours** ticked looks correct until you run the ground pour, which then fills straight through it. Tick all four exclusions when you draw the area, not after you notice the problem.",
  ),
  dive(
    "Why copper near the antenna costs you range",
    "A PCB antenna is a resonant structure: its length and its surroundings set the frequency it radiates efficiently at. Nearby conductor changes the effective permittivity around it, which shifts that resonance away from 2.4 GHz. The radio still transmits, but more of the power reflects back into the front end instead of leaving the board, and the usable range drops.\n\nThis is why the module is designed to hang off the board edge. Espressif specify the clearance rather than leaving it to judgement, and following it is cheaper than debugging an intermittent link later.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Decoupling goes first, and close", "The capacitors that ride the radio's current spikes only work if they are near the pin."),
  prose(
    "ESP-NOW runs the Wi-Fi radio, so this board draws about **80 to 160 mA** while it is listening and spikes to roughly **500 mA** for a brief moment on transmit. That spike has to come from somewhere faster than the regulator can respond, which is what the decoupling capacitors are for.\n\nA capacitor supplies that current through the loop formed by its own pads, the traces, and the return path in the ground plane. The bigger that loop, the more inductance it has, and inductance is exactly what resists a fast change in current. Placement is the whole game: the same part, moved 10 mm further from the pin, works measurably worse.",
  ),
  does("place the decoupling before anything else routes", [
    {
      text: "Put **C2 and C3 (0.1 µF)** as close to U1's 3V3 pins as the footprints allow, on the same side, with the shortest possible path to a ground via.",
      proof: "Both 0.1 uF caps sit within a couple of millimetres of U1's supply pins.",
    },
    {
      text: "Put **C1 (10 µF bulk)** near U1 as well, slightly further out. It handles the slower part of the transmit transient that the small caps cannot.",
      proof: "C1 sits near U1, outside the two 0.1 uF caps.",
    },
    {
      text: "Put **C5 and C6 (1 µF)** hard against U2's input and output pins. An LDO with its capacitors far away can oscillate.",
      proof: "C5 and C6 are adjacent to U2's IN and OUT pins.",
    },
    {
      text: "Give every capacitor its own **ground via** right at its pad rather than sharing one further away.",
      proof: "Each decoupling cap has a ground via at its own pad.",
    },
  ]),
  shot(
    "Decoupling placement: the small caps hard against the supply pins, each with its own ground via.",
    "KiCad PCB editor zoomed on U1's supply pins with C2/C3 placed close, ground vias at each pad, ratsnest still showing.",
  ),
  check(
    "**Your board resets every time it transmits. What would you look at first?** The transmit spike is pulling the rail down faster than the regulator can answer. Check that the decoupling is close to the pins and that C1's bulk capacitance is actually connected, then check the ground return.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Route the copper", "Hands on. Important nets first, everything else after."),
  sect("05", "Four layers, vias, and the layer pair", "Two outside layers for signals, two inside for solid ground."),
  prose(
    "The stackup on this board is signal, ground, ground, signal. Traces live on **F.Cu** and **B.Cu**; the two inner layers are poured solid with ground and left alone. That arrangement gives every signal a continuous return path directly beneath it, which is what keeps a fast edge from radiating and what makes the USB pair behave.\n\nSet the layer pair to F.Cu and B.Cu so that pressing the via key while routing drops a via and swaps you between the two signal layers without touching the planes.",
  ),
  does("set up for routing", [
    {
      text: "Set the **layer pair** to **F.Cu / B.Cu** so a via placed mid-route swaps between the two routing layers.",
      proof: "The layer pair selector reads F.Cu and B.Cu.",
    },
    {
      text: "Set the via preset to the fab floor from L1.01: **0.6 mm annulus / 0.3 mm drill**. KiCad's default via is larger than PCBWay needs and eats room you do not have on a board this size.",
      proof: "The via preset reads 0.6 mm / 0.3 mm, not KiCad's default.",
    },
  ]),
  dive(
    "Why the inner layers stay unrouted",
    "It is tempting to treat the inner copper as two more routing layers. Do not. A trace cut through a ground plane leaves a slot, and any signal crossing that slot has to find its return current the long way around, which turns a short trace into a loop antenna.\n\nOn a board this small there is easily enough room on the two outer layers. Keeping the planes whole costs nothing and removes an entire class of problem.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  sect("06", "The USB data pair", "D+ and D- are a matched pair and want to be treated as one object."),
  prose(
    "USB full-speed signalling is differential: the receiver reads the difference between D+ and D-, not either one against ground. That only works if the two traces experience the same thing, so they are routed together, the same length, the same distance apart, over unbroken ground.\n\nThe path is short here: J1 to D1 to U1's native USB pins on **GPIO19 and GPIO20**. Route it before anything else competes for the space.",
  ),
  does("route D+ and D- as a pair", [
    {
      text: "Start at **J1**, route through **D1** so the ESD array sits in the path, and finish at U1's **GPIO19 / GPIO20**. The protection only works upstream of what it protects.",
      proof: "Both data traces pass through D1 between J1 and U1.",
    },
    {
      text: "Use **Route ▸ Differential Pair**. Start on one pad and KiCad lays both traces together, matched and spaced, as you move.",
      proof: "Both traces were drawn in one pass and run parallel at a constant gap.",
    },
    {
      text: "Keep the pair **short**, keep it **over unbroken ground**, and do not let a via or another trace split the plane beneath it.",
      proof: "The plane under the pair is continuous along its whole length.",
    },
  ]),
  shot(
    "The USB pair routed together through D1, short and over unbroken ground.",
    "KiCad PCB editor zoomed on J1 to D1 to U1, differential pair visible as two parallel traces at constant spacing, inner ground plane continuous beneath.",
    "See it wired · the USB pair",
  ),
  gotcha(
    "routing them one at a time",
    "Drawing D+ and then D- separately gives you two traces that happen to be near each other, with different lengths and a varying gap. Use the differential pair router so they are matched by construction.",
  ),

  // ── 07 ────────────────────────────────────────────────────────────────────
  sect("07", "Route the rest: power first, then signals", "Wide metal where the current is, short metal where the speed is."),
  prose(
    "With the pair done, route the power path: VBUS from J1 through F1 to U2's input, then 3V3 from U2's output to U1 and J2. These are on the **Power** net class at **0.5 mm**, because VBUS carries up to about 0.5 A and a thin trace both drops voltage and heats.\n\nThe rest is low-speed and forgiving: the EN and BOOT networks, SW3 to GPIO21, GPIO47 to LED2 through R6, and the header pins. Keep them short, avoid crossing the plane, and stay out of the keep-out.",
  ),
  does("route in order of consequence", [
    {
      text: "**VBUS:** J1 to F1 to U2 IN, on the Power class. Then **3V3:** U2 OUT to U1 and to J2's 3V3 pin.",
      proof: "Both rails are routed at 0.5 mm and no power trace is on the Default class.",
    },
    {
      text: "**EN and BOOT:** R1 with C4 to U1's EN, R2 to GPIO0, each with its button to ground. Keep C4 close to the EN pin.",
      proof: "EN and BOOT networks are routed with C4 near the EN pin.",
    },
    {
      text: "**Node I/O:** SW3 to **GPIO21**, and **GPIO47** through R6 to LED2. LED1 sits across 3V3 through R5.",
      proof: "GPIO21 reaches SW3 and GPIO47 reaches LED2 through R6.",
    },
    {
      text: "**J2's remaining pins:** the ADC1 group (GPIO1, 2, 4, 5, 6) and the spares (GPIO7 to 10), plus 5V, 3V3 and GND.",
      proof: "Every J2 pin is connected and the ratsnest is empty.",
    },
  ]),
  check(
    "**Why is VBUS on a wider net class than GPIO47?** VBUS carries up to about 0.5 A to the regulator and anything you power from the header. GPIO47 drives an LED through a 470 ohm resistor, so a few milliamps. Width follows current.",
  ),

  // ── 08 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Pour and stitch the ground", "Hands on. Fill the leftover copper and tie the layers together."),
  sect("08", "Pour and stitch the ground", "Ground is not a net you route. It is a surface you flood and then connect between layers."),
  prose(
    "Pour ground on all four layers: the two inner ones become solid planes, and the leftover space on the outer layers fills in around your traces. Then stitch: drop vias that tie the outer ground to the inner planes, so return current can get where it needs to without going around.\n\nStitch densely near the parts that switch current fastest, which here means around U1 and the decoupling. The one place that gets no ground at all is inside the keep-out.",
  ),
  does("flood it, then tie it together", [
    {
      text: "Add a **ground zone on each of the four copper layers**, covering the board outline.",
      proof: "Four ground zones exist, one per copper layer.",
    },
    {
      text: "Press **B** to fill. Look at the result rather than trusting it: check that the inner planes are genuinely solid and that the fill respected the keep-out.",
      proof: "All four zones filled and the antenna keep-out is empty on every layer.",
    },
    {
      text: "**Stitch** with ground vias around U1, near each decoupling capacitor, and along the board edges.",
      proof: "Stitching vias tie F.Cu and B.Cu ground to the inner planes around U1 and the caps.",
    },
    {
      text: "Refill (**B**) after the last via. A zone that was nudged and never refilled ships as whatever it looked like before you moved it.",
      proof: "Zones refilled after the final edit.",
    },
  ]),
  shot(
    "The poured and stitched ground, notched out cleanly at the antenna keep-out.",
    "KiCad PCB editor showing all four ground zones filled, stitching vias around U1 and the decoupling, keep-out clearly empty of copper on every layer.",
  ),
  tube("Pour and stitch the ground on the ESP-NOW node"),
  gotcha(
    "a zone you nudged and never refilled",
    "KiCad shows the last computed fill, not the current one. Move a trace after filling and the display can still show the old copper. Press B before you look, and again before you export.",
  ),

  // ── 09 + gate ─────────────────────────────────────────────────────────────
  band("check", "Eyeball what DRC cannot catch", "Verify. The checker measures distances, it does not understand intent."),
  prose(
    "DRC compares your board against the fab's numbers. It cannot tell you that the antenna keep-out is in the wrong place, that SW3 ended up next to SW1, or that you routed the USB pair the long way round. Those are intent, and intent is what the answer key is for.",
  ),
  {
    type: "traceList",
    headline: "Check these against the answer key before you run DRC",
    body: "",
    items: [
      { text: "U1's antenna end overhangs the outline and no copper sits in the keep-out on any layer", help: "This is the one that costs you range, and DRC will never mention it." },
      { text: "The USB pair runs J1 to D1 to U1, short, over continuous plane", help: "Routing around D1 instead of through it leaves the data lines unprotected." },
      { text: "SW3 is on the opposite edge from SW1 and SW2", help: "A USER button beside the EN button means demo presses that reset the node." },
      { text: "Every decoupling cap is close to its pin with its own ground via", help: "Far-away decoupling passes DRC and still browns out on transmit." },
      { text: "Power nets are on the Power class and the inner planes are unbroken", help: "A slot cut in a plane forces return current the long way and undoes the stackup." },
    ],
  },
  shot(
    "The answer key: placement, routing, pour and keep-out on the finished board.",
    "Hi-res top view of the completed L1.02 layout with all four layers visible, for learners to compare their board against.",
  ),

  band("do", "in KiCad · Run DRC to zero", "Hands on. Clean, or every flag understood and written down."),
  sect("09", "Run DRC", "Clear it to zero, or know exactly why each remaining flag is safe."),
  does("run it, read it, clear it", [
    {
      text: "**Inspect ▸ Design Rules Checker ▸ Run DRC.** Leave **Test for parity between PCB and schematic** ticked.",
      proof: "DRC has run and the violation list is on screen.",
    },
    {
      text: "Fix what it finds, **refill the zones (B)**, and run again. Repeat until it reads **0 violations, 0 unconnected items**.",
      proof: "DRC reports 0 violations and 0 unconnected items.",
    },
    {
      text: "If a flag comes from the stock module footprint rather than your work, use **Exclude** and write down why. An excluded flag you cannot explain is a flag you have not understood.",
      proof: "Any remaining flags are excluded with a written reason.",
    },
  ]),
  shot(
    "DRC reporting zero violations and zero unconnected items against the fab's rules.",
    "KiCad Design Rules Checker dialog showing 0 violations and 0 unconnected items, with the fab rule file loaded.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: layout",
    gate: true,
    questions: [
      {
        id: "keepout-why", reviewId: "l102-antenna-keepout",
        q: "Why does copper under the module's antenna matter more on this board than on L1.01?",
        options: [
          "The board is a radio, so detuning the antenna costs the link range the lesson depends on",
          "It makes the board harder to solder",
          "It uses more copper and costs more to fabricate",
        ],
        answer: 0,
        explain: "Copper near a PCB antenna shifts its resonance away from 2.4 GHz, so less power leaves the board. Two nodes that cannot hear each other is the failure this board is built to avoid.",
      },
      {
        id: "keepout-layers",
        q: "Which copper layers does the antenna keep-out need to cover?",
        options: ["The top layer only", "The top and bottom layers", "All four copper layers"],
        answer: 2,
        explain: "An inner ground plane under the antenna detunes it just as well as a top-layer trace. Tick all four layers when you draw the rule area.",
      },
      {
        id: "fab-rules-first", reviewId: "l102-fab-rules-first",
        q: "Why load the fab's rule file before you start routing?",
        options: [
          "KiCad runs faster with custom rules loaded",
          "So DRC measures against what the factory can actually etch, not KiCad's permissive defaults",
          "It is required before you can place parts",
        ],
        answer: 1,
        explain: "A board can pass DRC on defaults and still be unbuildable. Loading the fab's numbers first means every trace is checked against the real process.",
      },
      {
        id: "diffpair-router",
        q: "What does routing D+ and D- with the differential pair router give you that drawing them separately does not?",
        options: [
          "Two traces matched in length and held at a constant spacing",
          "Thicker traces that carry more current",
          "Automatic ESD protection",
        ],
        answer: 0,
        explain: "The receiver reads the difference between the two lines, which only works if both see the same thing. The pair router matches them by construction.",
      },
      {
        id: "decoupling-close",
        q: "Why does a decoupling capacitor have to sit close to the pin it serves?",
        options: [
          "The loop from the capacitor to the pin and back has inductance, which resists the fast current change the cap is there to supply",
          "So it is easier to reach with a soldering iron",
          "Capacitors lose value with distance from the regulator",
        ],
        answer: 0,
        explain: "The same part further away works measurably worse, because the loop area rises and inductance rises with it.",
      },
      {
        id: "planes-unbroken", reviewId: "l102-unbroken-plane",
        q: "Why are the two inner layers left as solid ground rather than used for routing?",
        options: [
          "KiCad cannot route on inner layers",
          "A trace cut through a plane leaves a slot, and signals crossing it have to find their return current the long way round",
          "Inner layers cost more to fabricate when routed",
        ],
        answer: 1,
        explain: "Keeping the planes whole gives every outer-layer signal a continuous return directly beneath it, which is the point of the four-layer stackup.",
      },
      {
        id: "vbus-width",
        q: "Why is VBUS on the Power net class at 0.5 mm instead of the 0.25 mm default?",
        options: [
          "Wider traces are easier for the fab to etch",
          "USB requires 0.5 mm traces by specification",
          "VBUS carries up to about 0.5 A, and a thin trace both drops voltage and heats",
        ],
        answer: 2,
        explain: "Trace width follows current. GPIO47 driving an LED through 470 ohms needs nothing like the metal VBUS does.",
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
        id: "drc-blind-spot", reviewId: "l102-drc-blind-spot",
        q: "DRC reports zero violations. What can it still not tell you?",
        options: [
          "Whether any traces are too close together",
          "Whether the board matches the schematic",
          "Whether the keep-out is in the right place or the USB pair took a sensible route",
        ],
        answer: 2,
        explain: "DRC measures distances against the fab's numbers. Intent is what the answer key and the eyeball checklist are for.",
      },
    ],
  },

  {
    type: "callout", severity: "info", label: "Exit this stage",
    body: "You have a placed, routed, poured board that passes DRC against the fab's own rules, with the antenna keep-out fenced on all four layers. Attach the DRC report. Next stage exports the Gerbers the fab will build from, and those come from exactly this board file.",
  },

  { type: "sourceRef", label: "ESP32-S3 Hardware Design Guidelines (Espressif): antenna clearance and module placement", href: "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/" },
  { type: "sourceRef", label: "ESP32-S3-WROOM-1 datasheet (Espressif): module dimensions, pinout and antenna region", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf" },
  { type: "sourceRef", label: "USB 2.0 specification (USB-IF): full-speed differential signalling", href: "https://www.usb.org/document-library/usb-20-specification" },
  { type: "sourceRef", label: "KiCad 9 documentation: design rules, rule areas and zone filling", href: "https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html" },
];

publishCard({ slug: "l1-02-espnow-link", stage: "LAYOUT", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
