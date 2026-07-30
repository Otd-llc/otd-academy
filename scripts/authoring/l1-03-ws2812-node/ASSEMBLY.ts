// L1.03 WS2812 node — ASSEMBLY card.
//
// Authored from docs/boards/l1-03-ws2812-node/{design.md,bom.csv} with L1.01's
// ASSEMBLY card as gospel: the iron at ~340 C for SAC305, the drag at ~3 mm/sec,
// heavy-and-hard parts onto a bare board first, U1 tacked at one castellation
// then flux-and-drag, J1's retention tabs filled BEFORE its signal row, the
// hot-air alternative at ~300-350 C, tack-one-pad-then-the-other for passives,
// inspect under magnification for bridges and tombstoning, and the
// VBUS-to-GND continuity gate that must NOT beep.
//
// The card this replaces was 8 blocks against L1.01's 40.
//
// NEW, from design.md:
//   - the 5050 pixel (RK5). MANDATORY flux, a temp-controlled iron at ~315 C
//     and a QUICK dwell, because the lens deforms and the pads hide under the
//     body. Note the deliberate temperature split from L1.01's 340 C: that is
//     design.md's number for this part, not a contradiction.
//   - the two screw terminals and the radial electrolytic: real thermal mass,
//     real polarity, and C10 goes on LAST because it is 20 mm tall and in the
//     way of everything else.
//   - a SECOND continuity gate. L1.01 proves no VBUS-to-GND short. This board
//     also has to prove 5V_EXT is not joined to +5V, which is the first time
//     the isolation invariant gets tested in physical copper rather than in a
//     rule file.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Assembly: build order, the hardest joint in the curriculum, and two continuity gates"),

  prose(
    "Assembly rewards patience and a plan. The parts go down in a deliberate order, every joint gets flux, and you inspect the board before you ever apply power. Rush the order and you will spend longer reworking than you saved.\n\nThis board has two firsts. **The 5050 pixel is the hardest joint in this curriculum so far**, because its pads sit partly under its own body where you cannot watch them wet, and the lens above them does not tolerate a parked iron. And **the through-hole parts have real thermal mass** for the first time: two screw terminals and an electrolytic that will drink heat and lever on their joints when someone tugs a wire.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("orient", "The build order", "Read this once. The order is the plan, and it is different from the last two boards."),
  sect("01", "Order of operations", "Hard parts onto an empty board, tall parts last, and the pixel somewhere in between."),
  prose(
    "The rule that governs everything: **anything hard to place goes down while the board is still empty**, because clear space around a part is what lets your iron reach it. Everything low and easy fills in after. Anything tall goes last, because a 20 mm capacitor standing in the middle of the board is in the way of every joint you have not made yet.\n\nOn L1.01 that ordering had two hard parts, the module and the USB connector. This board has four.",
  ),
  table(
    ["Order", "Parts", "Why here"],
    [
      ["1", "U1, the module", "Castellated edge pads, drag-soldered. Hardest alignment, wants an empty board"],
      ["2", "J1, the USB-C receptacle", "Retention tabs first, then a fine pin row. Also wants space"],
      ["3", "U3, the SOIC-14 shifter", "Another drag row. Easy, but easier still with nothing around it"],
      ["4", "LED3, the pixel", "The hardest joint. Hidden pads, heat-sensitive lens, needs clear access"],
      ["5", "0805 passives, D2, D3", "Quick, and forgiving. They fill in around what is already down"],
      ["6", "Buttons, headers, test points, J4, J5", "Through-hole. Big thermal mass, no finesse required"],
      ["7", "C10, the 1000 uF electrolytic", "Last. It is 20 mm tall and blocks everything if it goes on early"],
    ],
  ),
  shot(
    "The kit laid out in build order, so you are never hunting for the next part with a hot iron in your hand.",
    "Flat lay of all L1.03 parts on a mat, grouped left to right in the seven build-order groups, with the bare PCB beside them. Refdes labels or small cards under each group.",
  ),
  check(
    "**Why does C10 go on last rather than with the other through-hole parts?** Because it stands about 20 mm proud of the board. Every joint you make after it is one you make around it, with less room for your iron and less room to see. Tall parts last, always.",
  ),
  dive(
    "Why order matters more on this board than the last one",
    "There is a general principle underneath the table, and it is worth having rather than memorising a list. **Solder every joint you can while the board around it is empty**, because your access to a pad is set by what is next to it, not by the pad itself.\n\nL1.01 got away with a loose interpretation, because after the module and the connector everything else was low, flat 0805s with nothing to obstruct. This board breaks that in two ways. The pixel needs a clear approach from several angles, since you are heating pads you cannot see and judging the joint by how the part settles. And the through-hole parts, especially the terminals and the electrolytic, are tall enough to shadow their neighbours.\n\nThere is a thermal argument too. A big through-hole joint takes several seconds of sustained heat to make properly. Put those in early and every subsequent small joint nearby gets a share of that heat load, which is how a well-made 0805 joint quietly reflows and shifts while you work on something else.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("do", "at the bench · Solder it, hard parts first", "Hands on. Four hard parts, then everything else."),
  {
    type: "callout", severity: "critical", label: "Warning · a soldering iron never looks hot",
    body: "A soldering iron sits at around **340 °C** and never looks hot. It burns instantly, so it goes back in its stand the moment it leaves your hand. Using hot air? Same hazard, moving: 300 °C air burns skin and scorches anything in the blast path, so mind where it points whenever it leaves the work. Work somewhere **ventilated**, because flux fumes irritate. Wear **eye protection**, because hot flux spits. Treat the board, the tweezers and the parts as hot for a while after. Lead-free or not, wash your hands when you are done.",
  },
  sect("02", "The four hard parts", "The module, the connector, the buffer and the pixel, onto a bare board."),
  prose(
    "Set the iron around **340 °C**. [[SAC305]] is lead-free and wants a little more heat than leaded solder. The pixel is the exception and gets its own section below, at a lower temperature.\n\nThe technique for U1, J1 and U3 is the same one you already know: flux the row, load the tip with a bead, and drag steadily. What differs is how each part is held still first.",
  ),
  does("U1, J1 and U3", [
    {
      text: "**U1 first, on the bare board.** Position it on its pads, antenna end matching the silkscreen outline, and **tack ONE corner castellation**. Reheat and nudge until every pad row lines up. Alignment is the whole job at this point; tidy solder comes after.",
      proof: "U1 sits on its pads matching the silkscreen outline, tacked at one corner, with every pad row lined up.",
    },
    {
      text: "**Flux each of U1's pad rows and drag-solder them**, using the technique in section 04. Work one row at a time and check it before starting the next.",
      proof: "Every castellation on U1 has a joint, with no bridges between adjacent pads.",
    },
    {
      text: "**J1 next.** Seat it so its **retention tabs drop through the board**, and **solder the tabs first** so the connector cannot move. Fill each tab hole with solder rather than just tacking it: a plugged USB-C cable lands its force on the connector, and the tabs are what stop it peeling the fine signal pads off the board.",
      proof: "J1's tab holes are filled with solder and the connector cannot move.",
    },
    {
      text: "**Then flux and drag J1's signal-pin row**, the same way as U1's.",
      proof: "J1's signal row is dragged and no two pins are bridged.",
    },
    {
      text: "**U3, the SOIC-14.** Tack one corner pin, check the part sits square against its silkscreen, then flux and drag each side. This is the friendliest 14-pin part there is: the pins are visible, they stand off the body, and you can see every joint form.",
      proof: "U3 sits square with all 14 pins soldered and no bridges.",
    },
    {
      text: "**Inspect all three under magnification before the pixel goes on.** Every joint shiny and slightly concave, no bridges. Rework is far easier now than it will be with a board full of parts.",
      proof: "Under magnification every joint on U1, J1 and U3 is shiny and slightly concave, with no bridges.",
    },
  ]),
  shot(
    "U1, J1 and U3 tacked onto a bare board before anything else goes on.",
    "Top-down macro of the L1.03 board with only U1, J1 and U3 soldered, the rest of the board still bare pads. Silkscreen legible.",
  ),
  tube("Solder the module, the connector and the buffer"),
  gotcha(
    "J1's tabs are the anchor, not decoration",
    "Fill each tab hole so it grips through the board. A well-anchored port outlives thousands of plug cycles. A tacked one eventually takes the fine signal pads with it, and there is no repairing that.",
  ),
  {
    type: "callout", severity: "info", label: "Alternative · have hot air? Reflow them instead",
    body: "**Reflow with hot air:** around **300 to 350 °C**, medium airflow, small circles over the part until the paste flashes from grey to **shiny** and the part settles flat. Keep the nozzle moving. Then inspect: every pad shiny and slightly concave, no bridges between pins. Re-touch any dull or bridged joint with a little flux and a quick pass. **Use hot air on the pixel with care**, and read the next section first: its lens has a lower tolerance than its pads do.",
  },

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "The pixel: the hardest joint so far", "Four pads you cannot see, under a lens that does not like heat."),
  prose(
    "**LED3 is the one part on this board that punishes a dry technique.** Two things make it hard, and they pull in opposite directions.\n\nIts four pads sit partly **under the body**, so you cannot watch the solder wet them. On every other part you judge a joint by looking at it; here you judge it by how the part settles and by what the joint looks like from the side, at the edge of the pad.\n\nAnd the **plastic lens sits directly above those pads**. It deforms, clouds or discolours if you park a hot iron next to it, and a clouded lens is a pixel whose colour is wrong forever. So the technique is the opposite of the drag rows you just did: **less heat, and less time**.\n\nThe design specifies a **temperature-controlled iron at around 315 °C** for this part, lower than the 340 °C you have been working at, with a **quick dwell** on each pad and **flux as a requirement rather than a nicety**. Flux is what lets solder flow into a pad you cannot see at a temperature that leaves the lens alone.",
  ),
  table(
    ["Pin", "What it is", "How to know"],
    [
      ["1", "VDD", "Pin 1 is marked on the part and on the silkscreen. Find it before you place"],
      ["2", "DOUT", "Data out, to R8 and the strip"],
      ["3", "VSS", "Ground"],
      ["4", "DIN", "Data in, from R7"],
    ],
  ),
  does("solder the pixel", [
    {
      text: "**Turn the iron down to about 315 °C** and let it settle. Use a clean, freshly tinned tip: a dirty tip transfers heat badly, which means you compensate by dwelling longer, which is exactly what you are trying to avoid.",
      proof: "The iron reads about 315 °C with a clean tinned tip.",
    },
    {
      text: "**Find pin 1 before you place the part.** Match the part's own pin-1 mark to the silkscreen. The pixel is close to symmetrical and rotating it 180 degrees swaps power with ground and input with output.",
      proof: "The part's pin-1 mark lines up with the silkscreen mark.",
    },
    {
      text: "**Flux generously.** A flux pen or a dropper, on all four pads. This is the step design.md makes mandatory rather than recommended, and it is the difference between solder flowing under the body and solder sitting on the edge of the pad looking done.",
      proof: "All four pads carry visible flux before any solder.",
    },
    {
      text: "**Tack one corner pad**, quickly, then take the heat away and look. Check the part sits flat and square against the silkscreen. If it is skewed, reheat that one pad and nudge, rather than fighting it with a second joint down.",
      proof: "The pixel is tacked at one pad and sits flat and square.",
    },
    {
      text: "**Do the other three, one at a time, with a pause between each.** Touch, feed a small amount of solder, lift. Count to a couple between pads and let the part cool. The lens is what you are protecting and cumulative heat is what damages it.",
      proof: "All four pads are soldered with a cooling pause taken between each.",
    },
    {
      text: "**Inspect from the side, under magnification.** You are looking for a small shiny fillet at the visible edge of each pad. Dull or absent means it did not flow, and the fix is more flux and one more quick touch, never a longer one.",
      proof: "Each of the four pads shows a shiny fillet at its visible edge.",
    },
  ]),
  shot(
    "The pixel down: pin 1 matched to the silkscreen, four fillets visible at the pad edges.",
    "Macro under magnification of LED3 soldered to the board, viewed slightly from the side so the solder fillets at the visible pad edges and the pin-1 mark are both legible.",
    "See it wired · the pixel joint",
  ),
  tube("Solder the 5050 pixel without cooking its lens"),
  check(
    "**Your first pixel comes out with a cloudy lens and shows the wrong colour. What went wrong and what do you do?** Too much heat for too long. A clouded lens does not recover, so fit the spare you ordered, drop the iron to about 315 °C, use more flux, and work one pad at a time with a pause between. Flux is what lets you use less heat, not an optional extra.",
  ),
  gotcha(
    "the pixel is close to symmetrical",
    "Rotated 180 degrees it still fits the footprint perfectly, and then VDD sits on ground, ground sits on VDD, and your data input and output are swapped. Nothing about the placement will look wrong. Find pin 1 on the part and on the silkscreen **before** the flux comes out, because afterwards you will be working quickly and by feel.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "Flux and drag-soldering", "The technique for every fine row, and for rescuing one that bridged."),
  prose(
    "Flood the pads with flux, then drag-solder the row: load the iron tip with fresh solder and drag it steadily along, letting surface tension and flux pull just the right amount onto each lead while clearing the bridges.",
  ),
  does("drag-solder a row", [
    {
      text: "Set the iron around **340 °C** (SAC305 is lead-free, so it wants a little more heat) and flood the pad row with liquid flux.",
      proof: "The pad row is flooded with liquid flux and the iron sits around 340 °C.",
    },
    {
      text: "Load the tip with a small bead of fresh solder. Rest the bead at one end of the row and drag steadily along it at about **3 mm per second**. Let surface tension pull just enough onto each lead.",
      proof: "The row was dragged in one steady pass at roughly 3 mm per second.",
    },
    {
      text: "Lift at the end. If a bridge stays behind, **add more flux and drag once more. Do not add solder.**",
      proof: "Any bridge left behind clears with more flux and a second drag, with no solder added.",
    },
  ]),
  shot(
    "Bridge versus clean: what to look for under magnification before you call a row done.",
    "Macro under magnification of one pad row where a bridge spans two adjacent pins and the neighbouring joints are clean. Single frame, bridge clearly legible.",
  ),
  check(
    "**Your drag pass leaves a bridge between two pins. First move?** More flux and a clean dragged pass. Flux lets surface tension pull the excess off, and you rarely need wick for a small bridge.",
  ),
  dive(
    "Why flux is the whole trick",
    "It feels like dragging a bead of molten metal across a row of pins should short them all together. Flux is what makes it not.\n\nLiquid flux strips the oxide off the copper and lowers the solder's surface tension, so molten solder wets onto each lead while the excess rides along. Any bridge that does form gets reflowed and pulled apart by that same tension. Run out of flux and the magic stops: the oxide creeps back and solder clumps wherever it lands.\n\nThis is also why flux is **mandatory** on the pixel rather than merely helpful. There, you are asking solder to flow into a pad you cannot see, at a temperature deliberately lower than you would normally use, in less time than you would normally take. Flux is the only thing making that combination possible.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "Passives, then the through-hole parts", "The easy stretch, with three parts that care which way round they go."),
  prose(
    "The 0805 passives are quick: **tack one pad**, then touch the iron to the other pad and the part end together, feed a little solder, lift. Re-touch a dull first joint with a dab of flux.\n\nThen the through-hole parts, which are forgiving about technique and unforgiving about orientation. The buttons, headers and test points have no polarity. **D2, D3, C10 and the indicator LEDs do**, and two of them fail loudly.",
  ),
  table(
    ["Ref", "Polarity mark", "What happens if you reverse it"],
    [
      ["C10", "Stripe on the can marks the NEGATIVE leg", "Heats, swells and eventually vents on a 5 V rail"],
      ["D2", "Band marks the cathode, which goes to 5V_EXT", "Conducts the instant power arrives: looks like a dead short"],
      ["D3", "Bidirectional, so orientation is electrically free", "Nothing, but match the reference anyway"],
      ["LED1, LED2", "Bar or flat side is the cathode, faces ground", "Stays dark. Nothing warns you"],
    ],
  ),
  does("passives, then through-hole", [
    {
      text: "**The 0805s.** Tack one pad, then solder the other: touch the iron to pad and part-end together, feed a little solder, lift. Re-touch a dull first joint with a dab of flux.",
      proof: "Both pads on every 0805 are soldered, and dull first joints have been re-touched.",
    },
    {
      text: "**D2 and D3.** Small, leaded, quick. **Check D2's band faces the 5V_EXT side** against the silkscreen before you solder the second leg.",
      proof: "D2's band matches the silkscreen and D3 is down.",
    },
    {
      text: "**The indicator LEDs**, bar side to ground, and their resistors.",
      proof: "Both indicator LEDs have their bar side facing the ground end of the string.",
    },
    {
      text: "**Buttons, headers and test points.** No polarity, plenty of thermal mass. Give each joint a couple of seconds of sustained heat and let the solder flow through the hole rather than sitting on top of it.",
      proof: "Every through-hole joint shows solder that flowed through the barrel, not a blob on one side.",
    },
    {
      text: "**J4 and J5, the screw terminals.** These have real thermal mass and want the iron held on longer than feels right. Seat them flat against the board, solder one pin, check the body is square and flush, then do the rest.",
      proof: "Both terminals sit flush and square, with solder that filled each barrel.",
    },
    {
      text: "**C10 last.** Match the **stripe on the can to the negative marking** on the silkscreen. Seat it flat, solder both legs, and trim the leads. Then leave it alone: a 20 mm capacitor makes a good lever, and its joints are the ones a knock will break.",
      proof: "C10's stripe matches the silkscreen negative marking, it sits flat, and its leads are trimmed.",
    },
  ]),
  shot(
    "The finished board: every part down, C10 standing tall, terminals flush and square.",
    "Three-quarter view of the fully assembled L1.03 board on a mat, C10 upright, both screw terminals flush, the pixel and indicator LEDs visible.",
  ),
  tube("Passives, through-hole parts, and the two polarised ones that fail loudly"),
  check(
    "**You fit C10 backwards. What tells you?** Eventually the part does, by heating, swelling and venting on a 5 V rail. Nothing on the board warns you first and no test catches it before power. That is why the stripe gets checked against the silkscreen before the second leg is soldered, not after.",
  ),

  // ── 06 ────────────────────────────────────────────────────────────────────
  band("check", "Inspect, then two continuity gates", "Verify. Hunt bridges under magnification, then prove two things with a meter before any power."),
  sect("06", "Screen, then continuity, twice", "L1.01 had one short to rule out. This board has two."),
  prose(
    "Under magnification, hunt for **solder bridges** and [[tombstoning]], a passive stood up on one end. Then get the meter out, set it to continuity, and prove two things about a board that has never had power.\n\n**The first is the one you already know: there must be no continuity between VBUS and ground.** A short there destroys the board the instant USB is plugged in.\n\n**The second is new to this board, and it is the isolation invariant finally being tested in copper.** You wrote a rule at layout and watched DRC pass it, but a rule checks the design file. The meter checks the thing on your bench, including the solder you just applied, which is the one place the design file has nothing to say about. A stray strand between two terminal pins, or a bridge under a part, joins two rails that a rule file swore were separate.",
  ),
  does("screen, then meter", [
    {
      text: "**Under magnification, sweep every row** you dragged: U1's castellations, J1's signal pins, U3's fourteen. Look for bridges, and for joints that are dull or starved rather than shiny and slightly concave.",
      proof: "Every dragged row has been inspected and no bridges remain.",
    },
    {
      text: "**Check the passives for tombstoning**, a part stood on one end with the other pad unmade. It happens most on the smallest parts and it is obvious once you look from the side.",
      proof: "No passive is standing on one end.",
    },
    {
      text: "**Gate one: VBUS to ground must NOT beep.** Meter in continuity mode, red probe on the VBUS point (U2's input pad or its input capacitor), black on TP2. Expect **OL** and silence.",
      proof: "The meter reads OL between VBUS and ground, with no beep.",
    },
    {
      text: "**Gate two: 5V_EXT to +5V must NOT beep.** Red probe on **J5's 5 V position**, black on the board's own 5 V, at U2's input or C11. Expect **OL** and silence. This is the isolation invariant, measured.",
      proof: "The meter reads OL between J5's 5 V position and the board's own 5 V rail.",
    },
    {
      text: "**Gate three: 5V_EXT to ground must NOT beep either.** Same probe on J5's 5 V position, black on TP2. A short here means the strip supply would be feeding a dead short the moment you switch it on.",
      proof: "The meter reads OL between J5's 5 V position and ground.",
    },
    {
      text: "**Then prove what SHOULD connect.** J5's ground position **must** beep against TP2, because the two supplies have to share a reference. This is the one continuity check on this board where silence is the failure.",
      proof: "The meter beeps between J5's ground position and TP2.",
    },
  ]),
  shot(
    "The isolation, measured: probing J5's 5 V against the board's own 5 V, reading OL.",
    "Multimeter in continuity mode on the unpowered board, red probe at J5's 5 V position and black at C11 or U2's input, display reading OL. Crop to board and meter screen.",
    "See it wired · the isolation gate",
  ),
  shot(
    "The gate you already know: VBUS to ground, reading OL before USB ever touches the board.",
    "Multimeter in continuity mode probing the VBUS point against TP2 on the unpowered board, display reading OL, no beep.",
  ),
  tube("Inspect under magnification, then walk the three silences and one beep"),
  shot(
    "Tombstoning: a passive stood on one end with its other pad unmade.",
    "Macro under magnification of a tombstoned 0805 beside correctly seated neighbours, viewed slightly from the side so the lifted end is unmistakable.",
  ),
  check(
    "**Your meter beeps continuity between J5's 5 V and the board's own 5 V. The layout passed DRC with an isolation rule. What now?** The rule checked the design file; the meter checked the board. Something you soldered joined them: a strand across a terminal, a bridge under a part, or a splash. Find it and clear it. Do not apply either supply until that reads OL.",
  ),
  gotcha(
    "a rule that passed is not a board that passed",
    "The isolation rule you wrote at layout is a good rule and it did its job. But it checks geometry in a file, and the failure mode most likely to bite you here is a stray strand of wire or a solder splash between two adjacent terminal pins, neither of which exists in the design. **The meter is the only test that sees the board you actually built.** Run it every time you rework anything near J4 or J5.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: assembly",
    gate: true,
    questions: [
      {
        id: "pixel-heat", reviewId: "l103-pixel-heat",
        q: "Why is the pixel soldered at a lower temperature than the drag rows, with pauses between pads?",
        options: [
          "Its pads are smaller and need less heat",
          "Its plastic lens sits directly over the pads and clouds or deforms from cumulative heat, which no rework fixes",
          "Lead-free solder melts lower on that part",
        ],
        answer: 1,
        explain: "A clouded lens is a pixel whose colour is wrong forever. Flux is what makes the lower temperature and shorter dwell work at all.",
      },
      {
        id: "isolation-in-copper", reviewId: "l103-isolation-meter",
        q: "Your layout passed DRC with an isolation rule. Why still meter 5V_EXT against the board's 5 V?",
        options: [
          "To confirm the rule was written correctly",
          "DRC does not check power nets",
          "Because the rule checked the design file, and a stray strand or a solder splash between two terminal pins exists only on the board you built",
        ],
        answer: 2,
        explain: "The meter is the only test that sees the physical board. Re-run it after any rework near the terminals.",
      },
      {
        id: "tall-part-last",
        q: "Why does the 1000 uF electrolytic go on last?",
        options: [
          "Because it stands about 20 mm proud, so every joint made after it is made around it",
          "Because it needs the most heat",
          "Because it is polarised",
        ],
        answer: 0,
        explain: "Tall parts last, always. Access to a pad is set by what is next to it, not by the pad itself.",
      },
      {
        id: "j1-tabs",
        q: "On J1, what gets soldered first and why?",
        options: [
          "The signal pins, so the connector is electrically live before it is mechanically fixed",
          "The retention tabs, filled with solder, because a plugged cable lands its force on the connector and the tabs stop it peeling the fine pads off",
          "It does not matter as long as everything is soldered",
        ],
        answer: 1,
        explain: "A well-anchored port outlives thousands of plug cycles. A tacked one eventually takes the signal pads with it, and that is not repairable.",
      },
      {
        id: "bridge-fix",
        q: "Your drag pass leaves a bridge between two pins. First move?",
        options: [
          "Add more solder and drag again",
          "Reach for the wick immediately",
          "Add more flux and drag once more, with no extra solder",
        ],
        answer: 2,
        explain: "Flux lowers surface tension so the excess rides away with the tip. You rarely need wick for a small bridge.",
      },
      {
        id: "should-beep",
        q: "Which continuity check on this board FAILS if the meter stays silent?",
        options: [
          "J5's ground position against TP2",
          "VBUS against ground",
          "5V_EXT against the board's 5 V",
        ],
        answer: 0,
        explain: "The two supplies must share a ground reference, or the strip has nothing to measure your data signal against. Everywhere else, silence is what you want.",
      },
    ],
  },

  exit(
    "Every part is down, every row inspected under magnification, and the board has passed three silences and one beep on the meter. Attach your continuity results. The board has still never had power, which is exactly right: the next stage applies it, one step at a time, and stops at the first thing that does not read what it should.",
  ),

  ref("IPC-A-610 Acceptability of Electronic Assemblies (IPC): a good solder joint versus a cold or starved one", "https://www.ipc.org/TOC/IPC-A-610H.pdf"),
  ref("WS2812B datasheet (Worldsemi): the pixel's pin order and its package", "https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf"),
  ref("SNx4AHCT125 datasheet (Texas Instruments, SCLS264R): the SOIC-14 package and pin numbering", "https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "ASSEMBLY", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
