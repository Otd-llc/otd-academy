// Seeds the PCB Design & Fabrication cluster of public /library mini-lessons
// (docs/plans/2026-07-09-pcb-design-library-cluster.md + the parallel-authoring
// handoff). Generic PCB engineering education, beginner main line with depth in
// collapsed deepDive asides, cited per claim, first-hand to real One Thousand
// Drones boards. cluster = "pcb-design"; clusterOrdinal = list order.
//
// This is the reference layer for the academy's core promise: turn a finished
// schematic into a real, fab-ready board. It bridges Fundamentals (the concepts,
// what a schematic / ground / stackup IS) to the doing (creating the layout,
// pouring a plane, exporting gerbers). Each lesson cross-links its Fundamentals
// prerequisite rather than repeating it.
//
// Content lives in the PROD DB; this committed seed is the reviewable source and
// re-runs idempotently (upsert on the unique slug). Diagram `image` blocks point
// at their PLANNED /guide-diagrams/pcb-*.svg registry key; they render caption-
// only until the diagram-export sandbox phase builds those components + rasters
// (same key, so no re-seed for figures).
//
// Voice: otd-content-writing house rules (no em-dashes; answer-first; no
// antithesis flourish). Assessment: 3 options, real same-register distractors,
// answer key spread (one {0,1,2} permutation per lesson = 12/12/12 across the
// bank), no math/edge-cases in stems (beginner bar). Academy = generic only (no
// coined vocabulary, no paid-build values, no recipe).
//
// Run:
//   npx tsx scripts/seed-pcb-design-cluster.ts --check   (validate blocks, NO DB)
//   npx tsx scripts/seed-pcb-design-cluster.ts           (seed PROD)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import katex from "katex";
import { guideContentBlocksSchema, type ContentBlock } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";
import { PDF_SAIRA_FALLBACK } from "@/lib/pdf/pdf-fallback-set";
import { pdfGlyphIssues } from "@/lib/pdf/pdf-glyph-coverage";

const BYLINE = "One Thousand Drones engineering team · verified 2026-07";
const VERIFIED_AT = new Date("2026-07-09T00:00:00.000Z");

type Lesson = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  clusterOrdinal: number;
  contentBlocks: ContentBlock[];
};

const LESSONS: Lesson[] = [
  // ── 0. pcb-layout-workflow ────────────────────────────────────────────────
  {
    slug: "pcb-layout-workflow",
    title: "From schematic to board: the layout workflow",
    seoTitle: "PCB layout workflow: from schematic to fab-ready board",
    seoDescription:
      "The fixed sequence that turns a schematic into a real PCB: assign footprints, import the netlist, place, route, run DRC, and export the fab files. In KiCad terms.",
    clusterOrdinal: 0,
    contentBlocks: [
      { type: "prose", md: "A finished schematic is half a design. The other half is the physical board, and the path between them is a fixed sequence: capture the schematic, give every part a footprint, push the netlist into the PCB editor, place the parts, route the copper, run the design-rule check, and export the fab files. Learn that sequence once and every board you draw follows it." },
      { type: "heading", text: "The two files share one netlist" },
      { type: "prose", md: "A KiCad project holds two linked documents: the schematic and the PCB. You do not redraw one into the other by hand. They share a netlist, the machine-readable list of which pins connect to which. You draw the circuit once in the schematic, and `Update PCB from Schematic` carries that netlist into the board so the two can never silently disagree (KiCad)." },
      { type: "sourceRef", label: "KiCad. PCB Editor (Pcbnew) documentation: Update PCB from Schematic, placement, routing, DRC, and fabrication outputs.", href: "https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html" },
      { type: "heading", text: "A footprint for every symbol" },
      { type: "prose", md: "Each schematic symbol is an abstract part. Before it can live on a board it needs a footprint, the real copper-and-hole pattern it solders to. Assigning footprints ties the symbol to a physical part and to its bill-of-materials line, so `U2` on the schematic becomes one `SOT-23-5` land pattern on the board. A symbol with no footprint cannot be placed." },
      { type: "heading", text: "The netlist is the contract" },
      { type: "prose", md: "The netlist is what the PCB editor trusts. Every connection you drew, and only those, show up as a ratsnest: thin lines between the pads that still need copper. If a wire is missing on the schematic it is missing here too, so you fix the circuit in the schematic and re-import, never by drawing a stray trace on the board." },
      { type: "callout", severity: "info", label: "Run ERC before you leave the schematic", body: "The electrical-rule check reads the schematic for unconnected pins, conflicting outputs, and power nets with no source. Clearing it before you import the netlist means the board you place is built on a circuit that already checks out, so a layout problem stays a layout problem and not a hidden schematic bug." },
      { type: "image", src: "/guide-diagrams/pcb-layout-workflow.svg", alt: "The PCB workflow as a horizontal pipeline: schematic, netlist, placement, routing, DRC, gerbers, each feeding the next.", caption: "The workflow is fixed: schematic to netlist to placement to routing to DRC to fab files." },
      { type: "heading", text: "Then place, route, check, export" },
      { type: "prose", md: "With the netlist imported you place the footprints, route copper to satisfy the ratsnest, run the design-rule check against your fabricator's limits, and plot the gerbers. Each of those is its own guide in this cluster. What matters first is the shape of the whole: schematic, netlist, placement, routing, DRC, fab files, in that order, every time." },
      { type: "quiz", questions: [
        { q: "What ties a schematic symbol to a physical part on the board?", options: ["Its footprint assignment", "Its color on the schematic", "The order it was drawn"], answer: 0, explain: "A footprint is the real land pattern the symbol solders to; assigning it links symbol, part, and BOM line." },
        { q: "How does the circuit you drew get into the PCB editor?", options: ["You redraw it by hand on the board", "It is emailed to the fabricator", "The shared netlist is imported with `Update PCB from Schematic`"], answer: 2, explain: "The schematic and PCB share a netlist; importing it keeps the two in sync." },
        { q: "You find a missing connection while routing. Where do you fix it?", options: ["Draw a new trace on the board only", "In the schematic, then re-import the netlist", "In the exported gerber files"], answer: 1, explain: "The schematic owns the netlist; fix the circuit there and update the PCB so the two never disagree." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a schematic", href: "/library/reading-a-schematic" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: footprints and land patterns", href: "/library/pcb-footprints" },
    ],
  },

  // ── 1. pcb-footprints ─────────────────────────────────────────────────────
  {
    slug: "pcb-footprints",
    title: "Footprints and land patterns",
    seoTitle: "PCB footprints and land patterns explained",
    seoDescription:
      "What a footprint is, how package maps to footprint, what pads and courtyards and pin-1 markers do, and why you confirm every land pattern against the datasheet.",
    clusterOrdinal: 1,
    contentBlocks: [
      { type: "prose", md: "A footprint is the pattern of copper pads, holes, and silkscreen that one real part solders to. Choose the footprint that matches the part's package, confirm it against the datasheet's recommended land pattern, and the part fits and connects. Get it wrong and the part physically will not sit down, or it will not make contact." },
      { type: "heading", text: "Package versus footprint" },
      { type: "prose", md: "The package is the part's physical body: an `0402` or `0603` chip, a `SOT-23-5` transistor outline, a `QFN` with pads under its belly. The footprint is the board-side copper that body lands on. One package maps to one footprint family, so reading `SOT-23-5` off a datasheet tells you which footprint to place." },
      { type: "heading", text: "What a footprint contains" },
      { type: "prose", md: "A footprint carries pads (the copper each pin solders to), a courtyard (a keep-out rectangle that reserves the part's space so neighbours cannot crowd it), a silkscreen outline, and a pin-1 marker. The pin-1 marker is the one that saves boards: it fixes the part's rotation so a chip cannot be assembled turned around." },
      { type: "heading", text: "Surface-mount and through-hole" },
      { type: "prose", md: "Surface-mount parts solder to flat pads on one side of the board and dominate a modern layout. Through-hole parts have leads that pass through drilled, plated holes and solder on the far side, which is mechanically stronger for connectors and anything that takes stress. A footprint is drawn for one or the other, and they are not interchangeable." },
      { type: "heading", text: "Confirm it against the datasheet" },
      { type: "prose", md: "Every part datasheet gives the package dimensions a footprint has to match, and many add a recommended land pattern too: the manufacturer's own drawing of the pad sizes and spacing that part wants. The AP2112K regulator's datasheet, for instance, specifies its `SOT-23-5` package and pinout (Diodes AP2112 datasheet). Industry land-pattern geometry follows the IPC-7351 standard, and the datasheet is the first place you check for a specific part." },
      { type: "sourceRef", label: "Diodes Incorporated. AP2112 600mA CMOS LDO Regulator datasheet (SOT-23-5 package and pinout).", href: "https://www.diodes.com/assets/Datasheets/AP2112.pdf" },
      { type: "image", src: "/guide-diagrams/pcb-land-pattern.svg", alt: "A labelled surface-mount land pattern showing the pads, the courtyard keep-out, the silkscreen outline, and the pin-1 dot, beside its real part.", caption: "A footprint: pads to solder to, a courtyard that reserves space, and a pin-1 marker that fixes rotation." },
      { type: "deepDive", summary: "IPC-7351 density levels", body: "The IPC-7351 land-pattern standard does not give one footprint per package; it gives three, called density levels. The Most level leaves the largest pads and solder fillets, which suits hand assembly and rework. The Least level is the tightest, for high-density boards assembled by machine. The Nominal level sits between and is the sensible default for most work. Footprint generators that follow IPC-7351 let you pick the level, so you trade board area against how forgiving the part is to solder." },
      { type: "quiz", questions: [
        { q: "Where do you confirm a part's correct land pattern?", options: ["By measuring a similar part", "From the schematic symbol alone", "In its datasheet's recommended land pattern"], answer: 2, explain: "A datasheet gives the package dimensions and, for many parts, a recommended pad geometry; check it there first." },
        { q: "What does the pin-1 marker on a footprint prevent?", options: ["The part being assembled rotated the wrong way", "The part overheating in use", "The pads oxidizing before assembly"], answer: 0, explain: "Pin-1 fixes orientation so a chip cannot be placed turned around." },
        { q: "The courtyard on a footprint is there to do what?", options: ["Carry the part's main current", "Reserve the part's space so neighbours cannot crowd it", "Show the soldermask color"], answer: 1, explain: "The courtyard is a keep-out rectangle that guards the part's footprint area." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a datasheet", href: "/library/reading-a-datasheet" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: component placement", href: "/library/pcb-placement" },
    ],
  },

  // ── 2. pcb-placement ──────────────────────────────────────────────────────
  {
    slug: "pcb-placement",
    title: "Component placement",
    seoTitle: "PCB component placement: how to place parts for easy routing",
    seoDescription:
      "Placement decides how easy routing is and how well the board works. Connectors at the edges, decoupling caps at the power pin, parts grouped by function, and heat given room.",
    clusterOrdinal: 2,
    contentBlocks: [
      { type: "prose", md: "Placement is where you decide how easy the board is to route and how well it works. Place with intent: connectors at the edges, each chip's decoupling capacitor hard against its power pin, related parts grouped by function, and hot parts given room. Good placement makes routing almost fall out. Bad placement fights you the whole way." },
      { type: "heading", text: "Place the fixed things first" },
      { type: "prose", md: "Start with what cannot move: the connectors, mounting holes, and any part whose position is set by the enclosure or the outside world. A USB connector belongs at a board edge because a cable has to reach it. Once the fixed parts anchor the layout, everything else places around them." },
      { type: "heading", text: "Group by function" },
      { type: "prose", md: "Keep a circuit's parts together: the power section in one region, the microcontroller and its support in another, any analog or sensing parts in their own quiet corner. Parts that connect on the schematic should sit near each other on the board, because every net you shorten now is a trace you do not fight later." },
      { type: "heading", text: "Decoupling caps touch the pin" },
      { type: "prose", md: "A decoupling capacitor only works if it is close. The loop from the capacitor to the chip's power pin and back through ground has inductance, and the longer that loop, the less the capacitor can react to a fast current demand. So the `100 nF` cap goes right at the power pin, on the same side, with the shortest possible path, before you place anything less urgent." },
      { type: "image", src: "/guide-diagrams/pcb-placement.svg", alt: "A before-and-after placement: scattered parts with long tangled connections, then the same parts grouped by function with decoupling caps at each power pin.", caption: "Group by function and put the decoupling cap at the pin: routing gets easier and the board gets quieter." },
      { type: "heading", text: "Keep noisy and sensitive apart, and leave room for heat" },
      { type: "prose", md: "A switching regulator or a fast digital bus radiates, and a sensitive analog input picks that up, so put distance between them. Give a part that dissipates real power, a regulator or a driver, open space and copper around it so its heat has somewhere to go. And leave lanes between the groups for the traces that will connect them." },
      { type: "heading", text: "Let the ratsnest guide you" },
      { type: "prose", md: "The ratsnest draws a straight line for every unrouted connection. When a placement makes those lines short and untangled, routing is easy. When the lines cross into a knot, the placement is telling you to move something. Nudge parts until the ratsnest looks calm, and only then start laying copper." },
      { type: "deepDive", summary: "Return-path-aware placement", body: "Placement sets more than trace length; it sets where return current flows. A signal's return travels in the ground plane directly under the trace, so a part placed such that its signal has to hop over a gap or a board cutout forces that return on a long detour, and that loop radiates. Placing related parts over the same continuous stretch of ground plane keeps every return short and tight, the same low-inductance idea that makes a plane beat a trace in the first place (All About Circuits)." },
      { type: "sourceRef", label: "All About Circuits. How to use return paths for better PCB design (ground-plane impedance and return-current loops).", href: "https://www.allaboutcircuits.com/technical-articles/better-pcb-design-return-paths-impedance/" },
      { type: "quiz", questions: [
        { q: "Where does a decoupling capacitor belong?", options: ["Anywhere on the same board", "As close as possible to the chip's power pin", "Next to the board's connector"], answer: 1, explain: "A short loop keeps its inductance low so it can react to the chip's fast current demand." },
        { q: "Which parts do you place first?", options: ["The fixed ones: connectors and mounting holes", "The smallest resistors", "The decoupling capacitors"], answer: 0, explain: "Anchor the layout with parts whose position is constrained, then place around them." },
        { q: "A knotted, crossing ratsnest is telling you what?", options: ["The board is finished", "The copper is too thick", "The placement should change before you route"], answer: 2, explain: "Short, untangled ratsnest lines mean routing will be easy; a knot means move parts." },
      ] },
      { type: "sourceRef", label: "Prerequisite: capacitors and decoupling", href: "/library/capacitors" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: routing traces, width, current, and vias", href: "/library/pcb-routing-traces" },
    ],
  },

  // ── 3. pcb-routing-traces ─────────────────────────────────────────────────
  {
    slug: "pcb-routing-traces",
    title: "Routing traces: width, current, and vias",
    seoTitle: "PCB trace routing: width, current capacity, and vias",
    seoDescription:
      "A trace is a wire in copper. Its width sets the current it carries (IPC-2221) and a via moves it between layers. Size power traces from current, keep signals short. With a live calculator.",
    clusterOrdinal: 3,
    contentBlocks: [
      { type: "prose", md: "A trace is a wire made of copper printed on the board. Its width sets how much current it can carry before it overheats, and a via is a plated hole that carries a trace to another layer. Size power traces from their current, keep signal traces short and direct, and change layers with a via only when you must." },
      { type: "heading", text: "Trace width comes from the current" },
      { type: "prose", md: "The current a trace can carry rises with its cross-section, which for a fixed copper thickness means its width. The IPC-2221 standard turns a target current and an allowed temperature rise into a minimum copper cross-section, from which the width follows once you know the copper weight. The calculator below implements it: give it the current and the temperature rise, and it returns the width." },
      { type: "math", tex: "A = \\left(\\frac{I}{k\\,\\Delta T^{0.44}}\\right)^{1/0.725}", plain: "A = ( I / (k x dT^0.44) )^(1 / 0.725)" },
      { type: "prose", md: "Here `A` is the copper cross-section, `I` the current, and `dT` the temperature rise you allow; `k` is a constant that is larger for an outer-layer trace than an inner one. Divide the cross-section by the copper thickness and you have the trace width." },
      { type: "calculator", slug: "pcb-trace-width", caption: "Find the minimum trace width for a current at a chosen temperature rise (IPC-2221)." },
      { type: "heading", text: "Copper weight and voltage drop" },
      { type: "prose", md: "A trace's thickness is its copper weight, usually `1 oz` per square foot, about 35 micrometres of copper. Heavier copper carries more current in the same width. A long trace also has resistance, so a big current down a thin track drops voltage along the way and wastes it as heat. Widen a power trace and that drop falls." },
      { type: "heading", text: "Vias move a trace between layers" },
      { type: "prose", md: "A via is a plated hole that connects copper on one layer to copper on another. Use one when a trace has to cross to the other side to get past an obstacle. A via has resistance and inductance of its own, and it carries limited current, so a high-current path uses several vias in parallel rather than one. Keep signal detours through vias few, because each one is a small discontinuity (KiCad)." },
      { type: "sourceRef", label: "KiCad. PCB Editor (Pcbnew) documentation: the interactive router, track width, and vias.", href: "https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html" },
      { type: "image", src: "/guide-diagrams/pcb-routing.svg", alt: "A curve of trace width against current for a fixed temperature rise, beside a cross-section of a via connecting a top and bottom copper layer.", caption: "Wider copper carries more current; a via carries a trace to another layer." },
      { type: "deepDive", summary: "External versus internal traces", body: "IPC-2221 gives an external trace on an outer layer a larger current constant than an internal one, because an outer trace sheds heat to the air while an inner trace is buried in insulation. In the calculator that shows up as the external setting allowing a narrower trace for the same current than the internal setting. On a four-layer board, a power net routed on an inner layer has to be wider than the same net carried on the surface." },
      { type: "quiz", questions: [
        { q: "What mainly sets how wide a power trace must be?", options: ["The color of the soldermask", "The number of parts on the board", "The current it carries"], answer: 2, explain: "Wider copper carries more current before overheating; IPC-2221 sizes it from the current and the allowed temperature rise." },
        { q: "What is a via for?", options: ["Labeling the trace on silkscreen", "Carrying a trace to another copper layer", "Storing charge like a capacitor"], answer: 1, explain: "A via is a plated hole connecting copper between layers." },
        { q: "To carry a large current through vias, you should do what?", options: ["Use several vias in parallel", "Use one very small via", "Avoid vias entirely on the power net"], answer: 0, explain: "Each via carries limited current, so parallel them on a high-current path." },
      ] },
      { type: "sourceRef", label: "Prerequisite: power and heat", href: "/library/power-and-heat" },
      { type: "sourceRef", label: "Calculate it: the PCB trace width calculator", href: "/tools/pcb-trace-width" },
      { type: "sourceRef", label: "Next: ground and power planes on a real layout", href: "/library/pcb-ground-planes" },
    ],
  },

  // ── 4. pcb-ground-planes ──────────────────────────────────────────────────
  {
    slug: "pcb-ground-planes",
    title: "Ground and power planes on a real layout",
    seoTitle: "PCB ground planes: pour, keep whole, and stitch with vias",
    seoDescription:
      "On a real board, ground is a filled copper plane rather than a trace. A plane gives every return a low-inductance path under its signal. Pour it, keep it unbroken, and stitch it with vias.",
    clusterOrdinal: 4,
    contentBlocks: [
      { type: "prose", md: "On a real board, ground is a filled sheet of copper, a plane that covers a whole layer, rather than a single thin trace. A plane gives every signal's return current a low-inductance path directly beneath it, which is what keeps a board quiet. Pour a ground plane, keep it unbroken, and stitch it with vias." },
      { type: "heading", text: "Why a plane beats a trace" },
      { type: "prose", md: "Return current follows the path of least impedance, and at any real speed that path is the copper directly under the signal trace, not a far-off thin wire. A continuous plane offers that path everywhere, so the loop between a signal and its return stays tiny and radiates almost nothing. This is the return-path idea from the fundamentals, now poured in copper (All About Circuits)." },
      { type: "sourceRef", label: "All About Circuits. How to use return paths for better PCB design (why a plane gives a lower-impedance return than a trace).", href: "https://www.allaboutcircuits.com/technical-articles/better-pcb-design-return-paths-impedance/" },
      { type: "heading", text: "Keep the plane whole" },
      { type: "prose", md: "A plane only works while it is continuous. Route a trace across the ground layer and you cut a slot in it, and every return current that needed to cross that slot has to detour around the end, making a large loop that radiates and picks up noise. So keep signals off the ground layer, and where one must cross the plane, give its return a way across." },
      { type: "heading", text: "Stitch it with vias" },
      { type: "prose", md: "On a two-layer board, ground exists on both sides, joined by stitching vias: plated holes that tie the two ground areas into one. Stitching keeps the whole ground at one potential and shortens the path a return takes to hop layers. Sprinkle stitching vias across the board, and especially wherever a signal changes layers." },
      { type: "heading", text: "Power pours and thermal relief" },
      { type: "prose", md: "A power rail can be poured as a plane too, giving it a low-resistance spread to every part that taps it. Where a plane connects to a pad it uses a thermal relief, a few short spokes instead of solid copper, so the pad can still be soldered without the whole plane sinking the heat away from the iron." },
      { type: "image", src: "/guide-diagrams/pcb-ground-plane.svg", alt: "A signal trace on the top layer with its return current mirrored in the ground plane directly beneath it, and stitching vias tying the ground copper together.", caption: "The return current mirrors the signal in the plane right beneath it; stitching vias tie the ground together." },
      { type: "deepDive", summary: "Going to four layers", body: "A two-layer board shares its ground plane with signals. A quieter board uses four or more layers so the fabricator can dedicate whole internal layers to ground and power, sandwiched close to the signal layers. That tight spacing drops the loop inductance further, and it frees the outer layers for routing. It is the same principle as the ground plane, built into the structure of the board (Altium)." },
      { type: "sourceRef", label: "Altium. The right way to use power planes in a 4-layer PCB stackup (dedicated internal ground and power planes).", href: "https://resources.altium.com/p/right-way-use-power-planes-4-layer-pcb-stackup" },
      { type: "quiz", questions: [
        { q: "Why pour a ground plane instead of running a thin ground trace?", options: ["It gives return current a low-inductance path right under the signal", "It uses less copper overall", "It makes the board cheaper to fabricate"], answer: 0, explain: "A continuous plane keeps every return loop tiny, which keeps the board quiet." },
        { q: "What happens if you route a signal trace across the ground plane?", options: ["Nothing, the plane is unaffected", "It cuts a slot that forces returns on a long detour", "The plane starts carrying more current"], answer: 1, explain: "A slot in the plane breaks the return path; currents detour around it and radiate." },
        { q: "Stitching vias do what?", options: ["Add decoration to the silkscreen", "Increase the board thickness", "Tie ground areas together into one low-impedance plane"], answer: 2, explain: "They join ground copper across layers so the whole ground sits at one potential." },
      ] },
      { type: "sourceRef", label: "Prerequisite: grounds and power rails", href: "/library/grounds-and-power-rails" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: PCB stackups, layers, materials, impedance", href: "/library/pcb-stackups" },
    ],
  },

  // ── 5. pcb-stackups ───────────────────────────────────────────────────────
  {
    slug: "pcb-stackups",
    title: "PCB stackups: layers, materials, impedance",
    seoTitle: "PCB stackup explained: 2-layer vs 4-layer, FR-4, impedance",
    seoDescription:
      "A stackup is the sandwich of copper and insulator the board is built from. Two layers is the cheap default; four adds dedicated power and ground planes. The fab sets the thicknesses.",
    clusterOrdinal: 5,
    contentBlocks: [
      { type: "prose", md: "A stackup is the sandwich of copper and insulation the board is built from. Two layers is the cheap default. Four or more lets you dedicate internal layers to power and ground, which makes a quieter board. The fabricator sets the exact thicknesses, and you design to their stackup." },
      { type: "heading", text: "Copper, prepreg, and core" },
      { type: "prose", md: "A board is layers of copper foil bonded to an insulating substrate. The rigid inner insulator is the core; the sheets that bond layers together under heat and pressure are prepreg. The insulator itself is usually `FR-4`, a woven glass-epoxy laminate that is cheap, strong, and stable enough for almost everything you will build." },
      { type: "heading", text: "Two layers versus four" },
      { type: "prose", md: "A two-layer stackup is copper, insulator, copper: signals and ground share both sides. A four-layer stackup is signal, ground, power, signal, so the two inner planes give every outer signal a return plane a fraction of a millimetre away. Tighter spacing between a signal and its return plane means lower loop inductance, which is the whole reason to add layers." },
      { type: "image", src: "/guide-diagrams/pcb-stackup.svg", alt: "A four-layer PCB stackup cross-section with the copper foils, prepreg, and core labelled: signal, ground, power, signal from top to bottom.", caption: "A four-layer stackup: copper foils separated by prepreg and a core, with dedicated inner planes." },
      { type: "heading", text: "Controlled impedance, and when it matters" },
      { type: "prose", md: "For fast signals like USB or high-speed data, a trace and its reference plane behave like a transmission line with a characteristic impedance set by the trace width, the distance to the plane, and the insulator. When a signal is fast enough that this matters, you ask the fab for a controlled-impedance stackup and route those traces to the width they specify. For low-speed hobby work it rarely comes up, and knowing the term tells you when to reach for it." },
      { type: "heading", text: "The fab sets the stackup" },
      { type: "prose", md: "You do not invent the thicknesses. Each fabricator publishes a stackup table, the exact copper weights and insulator heights they build, and you design to it. A four-layer order from a low-cost fab comes with a standard stackup you can look up before you route, so your impedance and via choices match what they will actually make." },
      { type: "deepDive", summary: "Why tighter plane spacing wins", body: "The loop inductance of a signal and its return falls as the two get closer, because inductance grows with the area of the loop between them. In a four-layer stackup the fabricator can put a signal layer only a few tenths of a millimetre from its reference plane, far closer than the full board thickness that separates the two sides of a two-layer board. Less loop area means less inductance, less ringing, and less radiated noise, which is why dense or fast designs justify the extra layers and cost (Altium)." },
      { type: "sourceRef", label: "Altium. The right way to use power planes in a 4-layer PCB stackup (signal, ground, power, signal and prepreg spacing).", href: "https://resources.altium.com/p/right-way-use-power-planes-4-layer-pcb-stackup" },
      { type: "quiz", questions: [
        { q: "What does a four-layer board add over a two-layer board?", options: ["A second silkscreen color", "Dedicated internal power and ground planes", "A larger board outline"], answer: 1, explain: "The inner planes give signals a nearby return, lowering loop inductance." },
        { q: "Who sets the exact layer thicknesses in a stackup?", options: ["The soldering iron temperature", "The schematic editor's defaults", "The fabricator, in their published stackup table"], answer: 2, explain: "You design to the fab's stackup; they build fixed copper and insulator heights." },
        { q: "Controlled impedance mainly matters for what?", options: ["Fast signals like USB and high-speed data", "Slow power rails", "The silkscreen legend"], answer: 0, explain: "Fast traces behave like transmission lines; their impedance depends on the stackup." },
      ] },
      { type: "sourceRef", label: "Prerequisite: grounds and power rails", href: "/library/grounds-and-power-rails" },
      { type: "sourceRef", label: "Next: design rules and DRC", href: "/library/pcb-drc" },
    ],
  },

  // ── 6. pcb-drc ────────────────────────────────────────────────────────────
  {
    slug: "pcb-drc",
    title: "Design rules and DRC",
    seoTitle: "PCB design rules and DRC: clearance, width, hole, annular ring",
    seoDescription:
      "The design-rule check is the board's spell-check. Set the rules to your fabricator's capabilities and clear every clearance, width, hole, and short before you leave the layout.",
    clusterOrdinal: 6,
    contentBlocks: [
      { type: "prose", md: "The design-rule check is the board's spell-check. It compares your layout against a set of manufacturing limits, the clearances, trace widths, and hole sizes, and flags every place the board breaks them. Set the rules to your fabricator's capabilities, and do not leave the layout until the check is clean." },
      { type: "heading", text: "What the rules cover" },
      { type: "prose", md: "The core rules are geometric: the minimum clearance between two pieces of copper, the minimum trace width, the minimum drilled hole, and the minimum annular ring (the collar of copper around a via or pad). Each is a number your fabricator can hold. Set them tighter than the fab and boards come back wrong; set them looser and you waste some space, but the board still builds." },
      { type: "heading", text: "Match the rules to your fab" },
      { type: "prose", md: "Every fabricator publishes a capability sheet: the smallest trace, space, hole, and ring they reliably make. You copy those numbers into the design rules before you route, so the check enforces what your chosen fab can actually build. A board that passes against the wrong fab's limits can still fail in production." },
      { type: "heading", text: "The check catches more than geometry" },
      { type: "prose", md: "DRC also finds electrical mistakes the layout introduced: two nets shorted by overlapping copper, a connection in the netlist with no trace yet (an unrouted net), and courtyards that overlap because two parts sit too close. KiCad reports each as a marker you jump to and fix (KiCad)." },
      { type: "sourceRef", label: "KiCad. PCB Editor (Pcbnew) documentation: the design rules and the Design Rules Check (DRC).", href: "https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html" },
      { type: "callout", severity: "critical", label: "A clean DRC is a hard gate", body: "The courses here treat `DRC = 0` the way they treat `ERC = 0` on the schematic: a hard gate you clear before the board is allowed to move forward. An unrouted net or a clearance violation that ships is a board that does not work or cannot be built. Clear every marker, then export." },
      { type: "image", src: "/guide-diagrams/pcb-drc.svg", alt: "A board with DRC markers called out: a clearance violation between two traces, an unrouted net, and silkscreen crossing a pad, each flagged in red.", caption: "DRC flags what the fab cannot make: clearance violations, unrouted nets, and silk over pads." },
      { type: "deepDive", summary: "Annular ring and why it fails", body: "The annular ring is the ring of copper left around a drilled hole after the drill bites. If a via's ring is too thin and the drill wanders even slightly, the hole breaks out of the pad and the connection is unreliable. Fabs quote a minimum annular ring and the DRC enforces it, because this is one of the quiet ways a cheap board fails: it passes a glance but the plating barely catches the pad. Give vias a ring with margin over the fab minimum." },
      { type: "quiz", questions: [
        { q: "What should you set the design rules to match?", options: ["The largest board you have made", "The schematic's net count", "Your chosen fabricator's capabilities"], answer: 2, explain: "Copy the fab's capability sheet into the rules so DRC enforces what they can build." },
        { q: "An unrouted net flagged by DRC means what?", options: ["A connection in the netlist has no copper trace yet", "The board is physically too large", "A part is drawn in the wrong color"], answer: 0, explain: "DRC checks the layout against the netlist and flags connections still missing copper." },
        { q: "In the course gate model, `DRC = 0` is treated as what?", options: ["An optional cleanup at the end", "A hard gate you clear before moving forward", "A cosmetic preference"], answer: 1, explain: "Like ERC on the schematic, a clean DRC gates the board; every marker is fixed before export." },
      ] },
      { type: "sourceRef", label: "Prerequisite: PCB stackups", href: "/library/pcb-stackups" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: silkscreen, soldermask, and polarity marks", href: "/library/pcb-silkscreen-soldermask" },
    ],
  },

  // ── 7. pcb-silkscreen-soldermask ──────────────────────────────────────────
  {
    slug: "pcb-silkscreen-soldermask",
    title: "Silkscreen, soldermask, and polarity marks",
    seoTitle: "PCB silkscreen and soldermask: refdes, pin-1, polarity marks",
    seoDescription:
      "Silkscreen and soldermask are the board's labels and protective coat. Good silkscreen (reference designators, pin-1 dots, polarity marks) makes a board buildable and debuggable.",
    clusterOrdinal: 7,
    contentBlocks: [
      { type: "prose", md: "Silkscreen and soldermask are the board's labels and its protective coat. Silkscreen prints reference designators, pin-1 dots, and polarity marks that make a board buildable and debuggable. Soldermask is the colored layer that covers the copper and keeps solder only where you want it." },
      { type: "heading", text: "What soldermask does" },
      { type: "prose", md: "Soldermask is the thin lacquer, usually green, that coats the copper everywhere except the pads. It stops solder from bridging between close pins, protects the copper from oxidation, and insulates traces you might otherwise touch. The openings in the mask define where solder can wet, so on a fine-pitch part the mask openings matter as much as the pads." },
      { type: "heading", text: "The silkscreen legend" },
      { type: "prose", md: "Silkscreen is the printed text and symbols on top of the mask. A good legend gives every part its reference designator (`R1`, `C3`, `U2`) so you can find it, marks pin 1 on every chip, and shows polarity on the parts that have it: the band on a diode, the stripe or plus on an electrolytic capacitor, the marked cathode on an LED, and the pin-1 corner on a connector." },
      { type: "heading", text: "Keep silk off the pads" },
      { type: "prose", md: "Silkscreen ink over a pad stops solder wetting and ruins the joint, so the fab and the design rules push silk clear of copper openings. When a reference designator will not fit beside its part without touching a pad, move the text; do not shrink it onto the pad. Legible silk that sits in the free space is the goal." },
      { type: "image", src: "/guide-diagrams/pcb-silkscreen.svg", alt: "A board corner showing a reference designator, a pin-1 dot on a chip, a diode polarity band, and a soldermask opening over a pad, each labelled.", caption: "The silkscreen legend: reference designators, a pin-1 dot, and polarity marks that make the board buildable." },
      { type: "heading", text: "A title block earns its space" },
      { type: "prose", md: "Print a small title block somewhere on the copper or silk: the board name, a version, and a date. When you are holding three revisions of the same board, the one thing that tells them apart is the version you printed on them. It costs nothing and saves an afternoon of confusion at the bench." },
      { type: "deepDive", summary: "Mask-defined versus copper-defined pads", body: "Most pads are copper-defined: the copper is smaller than the mask opening, so the copper edge sets the pad shape. On some fine-pitch or BGA parts the fab makes a mask-defined pad instead, where the mask opening is smaller than the copper and the mask edge defines the solderable area. It gives tighter, more repeatable pads on dense parts, at the cost of a little solderable area. For most boards you will build, copper-defined is the default and you never think about it." },
      { type: "quiz", questions: [
        { q: "What does soldermask do?", options: ["Covers the copper and keeps solder off everything but the pads", "Carries the board's main current", "Labels the parts by name"], answer: 0, explain: "Mask stops bridges, resists oxidation, and its openings define where solder wets." },
        { q: "What does a pin-1 marker on the silkscreen prevent?", options: ["The board drawing too much current", "Solder bridges between pins", "Installing a chip rotated the wrong way"], answer: 2, explain: "Pin-1 fixes orientation so a part is not assembled backwards." },
        { q: "Why keep silkscreen off the pads?", options: ["It looks cleaner on the render", "Ink over a pad stops solder wetting and ruins the joint", "It saves silkscreen ink"], answer: 1, explain: "Silk on a pad blocks the solder joint; move the text into free space instead." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a schematic (reference designators)", href: "/library/reading-a-schematic" },
      { type: "sourceRef", label: "Next: gerbers and the fab package", href: "/library/pcb-gerbers" },
    ],
  },

  // ── 8. pcb-gerbers ────────────────────────────────────────────────────────
  {
    slug: "pcb-gerbers",
    title: "Gerbers and the fab package",
    seoTitle: "Gerber files explained: the fab package a factory needs",
    seoDescription:
      "Gerbers are the universal files a factory reads to make your board, one per copper, mask, and silk layer. Add the drill, BOM, and placement file and you have the complete fab package.",
    clusterOrdinal: 8,
    contentBlocks: [
      { type: "prose", md: "Gerbers are the universal files a factory reads to build your board, one file per copper, mask, and silk layer. Add the drill file, the bill of materials, and the placement file, and you have the complete package a fab needs. Export those, check them in a viewer, and you are ready to order." },
      { type: "heading", text: "What a gerber is" },
      { type: "prose", md: "A gerber file describes one layer of the board as vector shapes: where copper is, where the mask opens, where silk prints. There is one gerber per layer, so a two-layer board has a top copper gerber, a bottom copper gerber, two mask gerbers, two silk gerbers, and a board-outline gerber. Gerber is an ASCII format, human-readable and unambiguous, which is why it has been the fabrication backbone for decades (Ucamco)." },
      { type: "sourceRef", label: "Ucamco. The Gerber format: the de-facto standard for PCB fabrication data (format specification and drill/route data).", href: "https://www.ucamco.com/en/gerber" },
      { type: "heading", text: "The modern format" },
      { type: "prose", md: "The current format is Gerber X2, which extends the older RS-274X by embedding attributes: which layer each file is, what a pad's function is, even net names. That metadata lets the fab set up your board with less guesswork. When your tool offers X2, use it; a fab that wants plain RS-274X can still read the copper." },
      { type: "heading", text: "The drill file" },
      { type: "prose", md: "Holes are not in the copper gerbers. They ship as a separate drill file, historically in Excellon format, listing every hole's position and diameter. Without it the fab knows your copper but not where to drill, so the drill file is as essential as the gerbers themselves (KiCad)." },
      { type: "sourceRef", label: "KiCad. PCB Editor (Pcbnew) documentation: plotting gerbers and generating drill files.", href: "https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html" },
      { type: "heading", text: "The rest of the package" },
      { type: "prose", md: "Two more files turn a bare board into an assembled one. The bill of materials lists every part by reference designator and part number. The placement file, also called the centroid or pick-and-place, gives each part's position and rotation so an assembly machine can place it. Zip the gerbers, drill, BOM, and placement together, and that archive is what you upload." },
      { type: "image", src: "/guide-diagrams/pcb-gerber-package.svg", alt: "The fab package as a labelled set of files: top and bottom copper gerbers, two mask gerbers, two silk gerbers, a board outline, a drill file, a BOM, and a placement file, zipped together.", caption: "The complete fab package: one gerber per layer, plus the drill file, the BOM, and the placement file." },
      { type: "callout", severity: "warn", label: "Preview before you order", body: "Load your gerbers into a gerber viewer and look at every layer before you send them. A missing ground pour, a silk layer that did not export, a board outline plotted on the wrong layer: all of these are obvious in a viewer and invisible in the raw files. Five minutes here saves a wrong board and a lead time." },
      { type: "quiz", questions: [
        { q: "What does a single gerber file describe?", options: ["The whole board as a 3D model", "One layer of the board as vector shapes", "The list of parts to buy"], answer: 1, explain: "There is one gerber per layer: top copper, bottom copper, mask, silk, and outline." },
        { q: "Which file tells the fab where the holes go?", options: ["The drill file", "The top copper gerber", "The bill of materials"], answer: 0, explain: "Holes ship separately as a drill file (Excellon), listing each hole's position and size." },
        { q: "The placement (centroid) file is used for what?", options: ["Setting the soldermask color", "Pricing the finished board", "Telling an assembly machine each part's position and rotation"], answer: 2, explain: "The pick-and-place file positions parts for automated assembly." },
      ] },
      { type: "sourceRef", label: "Prerequisite: silkscreen, soldermask, and polarity marks", href: "/library/pcb-silkscreen-soldermask" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: DFM and ordering a board", href: "/library/pcb-dfm-ordering" },
    ],
  },

  // ── 9. pcb-dfm-ordering ───────────────────────────────────────────────────
  {
    slug: "pcb-dfm-ordering",
    title: "DFM and ordering a board",
    seoTitle: "PCB design for manufacturing (DFM) and how to order a board",
    seoDescription:
      "Design for manufacturing means a board the factory can build cheaply and reliably. Respect the fab minimums, read the cost drivers (layers, size, quantity, finish), and order.",
    clusterOrdinal: 9,
    contentBlocks: [
      { type: "prose", md: "Design for manufacturing means drawing a board the factory can actually build, cheaply and reliably. Respect the fab's minimums, pick sane options, and read the cost drivers before you order. A manufacturable board is boring in all the right ways." },
      { type: "heading", text: "The manufacturability basics" },
      { type: "prose", md: "DFM is mostly the DRC numbers plus a few board-level ones: minimum trace and space, minimum hole and annular ring, and a sensible board size and layer count. Stay comfortably inside the fab's limits rather than right at the edge, because a design that hugs the minimums yields worse and costs more to build." },
      { type: "heading", text: "What drives the cost" },
      { type: "prose", md: "A few choices move the price far more than the rest: the layer count (two is cheap, four steps up, more climbs fast), the board size, the quantity, the surface finish, and the lead time you pick. For a small board the biggest levers are usually layer count and quantity, so a two-layer board bought in a modest batch is the cheap sweet spot most projects start from." },
      { type: "heading", text: "ENIG versus HASL finish" },
      { type: "prose", md: "The surface finish is the coating on the exposed pads. HASL (hot-air solder levelling) is a tinned finish, cheap and solderable, with a slightly uneven surface. ENIG (electroless nickel immersion gold) is flat and gold-topped, better for fine-pitch parts and nicer to hand-solder, at a higher price. For most through-hole and larger surface-mount work HASL is fine; reach for ENIG when a part is fine-pitch or the flatness matters." },
      { type: "heading", text: "The ordering flow" },
      { type: "prose", md: "Ordering is: upload your zipped gerbers and drill file, let the fab's checker parse them and show you a render, choose the layers, thickness, finish, color, and quantity, and place the order. Many fabs return a short DFM report flagging anything marginal in your files, which is a last free check before your board is committed to copper." },
      { type: "vendorCta", vendor: "pcbway-order", label: "Order this board at PCBWay", sublabel: "Upload your zipped gerbers and drill file for a fabrication quote." },
      { type: "vendorCta", vendor: "jlcpcb", label: "Order this board at JLCPCB", sublabel: "Low-cost two-layer and four-layer PCB fabrication." },
      { type: "image", src: "/guide-diagrams/pcb-dfm.svg", alt: "A cost-driver readout showing how layer count, board size, quantity, surface finish, and lead time each push a PCB order's price up or down.", caption: "The cost drivers: layer count and quantity move the price most, then size, finish, and lead time." },
      { type: "deepDive", summary: "Panelizing to save on small boards", body: "A fabricator builds on a large sheet and charges partly by the area of it, so a tiny board leaves most of that sheet wasted. Panelization arrays several copies of your board into one panel that the fab builds and ships as a unit, which you then separate into individual boards, either by snapping them along a scored line or by breaking the small tabs that hold each board in a routed slot. For a first small run you usually let the fab arrange it or skip it; laying out your own panel becomes worthwhile once you are making many of one board." },
      { type: "quiz", questions: [
        { q: "Which choice usually drives a small board's cost the most?", options: ["The silkscreen text", "The reference designators", "The layer count and quantity"], answer: 2, explain: "Layer count and quantity move price far more than cosmetic choices." },
        { q: "When is ENIG the better surface finish?", options: ["Only on the very cheapest boards", "For fine-pitch parts and when flatness matters", "When you never plan to solder the board"], answer: 1, explain: "ENIG is flat and gold-topped, better for fine-pitch and hand-soldering; HASL is the cheaper default." },
        { q: "What is the safe way to treat a fab's minimum trace and hole sizes?", options: ["Stay comfortably inside them", "Design right at the minimum every time", "Ignore them and let the fab adjust"], answer: 0, explain: "Hugging the minimums yields worse and costs more; leave margin." },
      ] },
      { type: "sourceRef", label: "Prerequisite: gerbers and the fab package", href: "/library/pcb-gerbers" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: soldering and assembly basics", href: "/library/pcb-soldering-assembly" },
    ],
  },

  // ── 10. pcb-soldering-assembly ────────────────────────────────────────────
  {
    slug: "pcb-soldering-assembly",
    title: "Soldering and assembly basics",
    seoTitle: "PCB soldering and assembly: hand-soldering vs reflow",
    seoDescription:
      "A designed board is bare copper until parts are on it. Hand-soldering with an iron suits through-hole and larger SMD; reflow with paste and heat suits dense SMD. With the reflow profile.",
    clusterOrdinal: 10,
    contentBlocks: [
      { type: "prose", md: "A finished board is bare copper until the parts are on it. Assembly is either hand-soldering with an iron and solder, which is fine for through-hole and larger surface-mount parts, or reflow, where solder paste and heat melt every joint at once for dense boards. Know which your board needs before you order the parts." },
      { type: "heading", text: "Through-hole and surface-mount assembly" },
      { type: "prose", md: "Through-hole parts drop into plated holes and solder on the far side; they are forgiving and strong, good for connectors and anything hand-built. Surface-mount parts sit on top of pads and range from easy `0805` chips down to fine-pitch packages that fight a hand iron. The part sizes on your board decide how you will assemble it." },
      { type: "heading", text: "Hand-soldering" },
      { type: "prose", md: "Hand-soldering needs a temperature-controlled iron, solder, and flux, plus solder wick to undo mistakes. You heat the pad and the pin together, feed solder into the joint, and let it flow into a shiny fillet. Flux is what makes it easy: it cleans the metal so solder wets instead of balling up. Larger surface-mount parts hand-solder fine with a fine tip and patience." },
      { type: "heading", text: "Reflow soldering" },
      { type: "prose", md: "For dense surface-mount boards, reflow does every joint at once. You apply solder paste (a mix of tiny solder balls and flux) to the pads, usually through a stencil, place the parts on the wet paste, and heat the whole board on a hotplate or in a reflow oven. The paste melts and pulls each part into place by surface tension, which is why reflow is the way to assemble crowded boards." },
      { type: "prose", md: "The heat follows a profile with four stages: a preheat ramp, a soak that evens the temperature and activates the flux, a reflow spike above the solder's melting point, and a controlled cool-down. Common lead-free paste (the SAC305 alloy) melts around 217 to 219 C and is taken to a peak near 245 to 255 C, held only briefly (CompuPhase). The paste datasheet gives the exact profile to follow." },
      { type: "sourceRef", label: "CompuPhase. Reflow soldering profiles (four-stage profile; SAC305 melts at 217 to 219 C, peak 245 to 255 C).", href: "https://www.compuphase.com/electronics/reflowsolderprofiles.htm" },
      { type: "image", src: "/guide-diagrams/pcb-reflow-profile.svg", alt: "A reflow temperature-versus-time curve with its four stages labelled: preheat ramp, soak, reflow spike above the melting point, and cool-down.", caption: "The reflow profile: preheat, soak, a spike above the solder's melting point, then a controlled cool-down." },
      { type: "heading", text: "Common defects" },
      { type: "prose", md: "A few faults show up again and again. A solder bridge is stray solder shorting two pins, cleared with wick and flux. Tombstoning is a small two-pad part standing up on one end because one side reflowed first. A cold joint is dull and grainy from too little heat and can fail intermittently. Learn to spot these under a loupe and most assembly problems are quick fixes." },
      { type: "deepDive", summary: "Why lead-free runs hotter", body: "Older tin-lead solder melts near 183 C at its eutectic point; the lead-free SAC305 alloy melts around 217 C, over thirty degrees higher (CompuPhase). That higher melting point is why lead-free reflow needs a hotter peak and a tighter profile, and why the parts and the board have to tolerate more heat. It is also why the soak stage matters more for lead-free: the narrower window between melting solder and damaging parts leaves less room for an uneven board." },
      { type: "quiz", questions: [
        { q: "What is reflow soldering best suited for?", options: ["Dense surface-mount assembly", "A single through-hole connector", "Stripping parts off a board"], answer: 0, explain: "Reflow melts every joint at once from paste and heat, ideal for crowded surface-mount boards." },
        { q: "What is flux for when hand-soldering?", options: ["It cools the iron tip", "It cleans the metal so solder wets into a joint", "It colors the finished board"], answer: 1, explain: "Flux removes oxide so solder flows and wets instead of balling up." },
        { q: "A part standing up on one end after reflow is called what?", options: ["A cold joint", "A solder bridge", "Tombstoning"], answer: 2, explain: "Tombstoning is uneven reflow lifting one end of a small two-pad part." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a datasheet (package and assembly)", href: "/library/reading-a-datasheet" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: board bring-up, first power", href: "/library/pcb-bringup" },
    ],
  },

  // ── 11. pcb-bringup ───────────────────────────────────────────────────────
  {
    slug: "pcb-bringup",
    title: "Board bring-up: first power",
    seoTitle: "PCB board bring-up: the cold-check-then-power sequence",
    seoDescription:
      "Never trust a fresh board on the first plug. Bring-up is a fixed sequence: inspect, cold continuity check for shorts, confirm orientation, then power current-limited and verify the rails.",
    clusterOrdinal: 11,
    contentBlocks: [
      { type: "prose", md: "Never trust a fresh board on the first plug. Bring-up is a fixed sequence: inspect it, check it cold for shorts, confirm orientation, then power it through a current limit and verify the rails before anything downstream. That order catches a solder bridge before it kills your board or your laptop's USB port." },
      { type: "heading", text: "Inspect it first" },
      { type: "prose", md: "Before any power, look the board over under good light and magnification. Scan every joint for bridges, especially between the close pins of the regulator and the microcontroller, and confirm no part is missing or lifted. Most first-power failures are visible if you look before you plug in." },
      { type: "heading", text: "The cold continuity check" },
      { type: "prose", md: "With the board unpowered and a multimeter in continuity mode, probe for shorts between the rails that should never touch: ground to `5 V`, ground to `3.3 V`, and `5 V` to `3.3 V`. A beep on any of those is a short to find and fix before power goes anywhere near the board. This one check catches the fault that most often destroys a fresh board." },
      { type: "heading", text: "Confirm polarity and orientation" },
      { type: "prose", md: "Check that the power connector's polarity is right and that every polarized part faces the way the silkscreen says: the diodes, the electrolytic capacitors, and any chip's pin 1. A part installed backwards can short the rail the instant you apply power, so this is the last check before the first plug." },
      { type: "heading", text: "First power, current-limited" },
      { type: "prose", md: "Power the board from a current-limited bench supply set to a modest limit, not straight from USB, so a fault trips the limit instead of cooking a part. Bring the voltage up and watch the current: a healthy board draws a small, steady current, while a short pins the supply at its limit immediately. If it looks right, confirm each rail reads its target voltage before you trust anything the rails feed." },
      { type: "image", src: "/guide-diagrams/pcb-bringup.svg", alt: "The bring-up sequence as an ordered checklist: inspect, cold continuity check for shorts, confirm polarity, then current-limited first power with rail verification.", caption: "Bring-up in order: inspect, check cold for shorts, confirm orientation, then power current-limited and verify the rails." },
      { type: "steps", ordered: true, items: [
        "Inspect the unpowered board under magnification for bridges, missing parts, and lifted pins.",
        "Probe for shorts in continuity mode: ground to `5 V`, ground to `3.3 V`, and `5 V` to `3.3 V`. Any beep is a short to fix first.",
        "Confirm connector polarity and that the diodes, electrolytic capacitors, and every chip's pin 1 face the way the silkscreen says.",
        "Power from a current-limited supply, watch for a small steady current, and confirm each rail reads its target before trusting anything downstream.",
      ] },
      { type: "callout", severity: "warn", label: "A current limit is cheap insurance", body: "The first time a board sees power is when a hidden short does its damage. A bench supply with the current limit set low turns a board-killing short into a harmless trip you can diagnose. Bring up every new board this way before it ever meets your computer's USB port." },
      { type: "deepDive", summary: "Reading the first-power current", body: "The current a healthy board draws at idle tells you a lot. A board that should sip a few milliamps but instead jumps to hundreds has a short or a backwards part pulling it. A board that draws nothing at all may have an open in its power path, a missing regulator, or a cold joint on the input. Before chasing firmware, get the idle current to match what the design should draw; a wrong number here means a hardware fault to fix first." },
      { type: "quiz", questions: [
        { q: "What is the first thing you do to a fresh board?", options: ["Plug it straight into USB", "A cold continuity check for shorts, before power", "Flash the firmware immediately"], answer: 1, explain: "Inspect and check for shorts unpowered; power comes only after the board is proven safe." },
        { q: "During the cold check you probe for continuity between which points?", options: ["Every pair of pads on the board", "Only the silkscreen labels", "The rails that should never touch: ground, `5 V`, and `3.3 V`"], answer: 2, explain: "A beep between ground, 5 V, and 3.3 V means a short to fix before power." },
        { q: "Why bring a new board up on a current-limited supply?", options: ["A fault trips the limit instead of destroying a part", "It charges the board faster", "It lets you skip the inspection step"], answer: 0, explain: "A low current limit turns a board-killing short into a harmless trip you can diagnose." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a datasheet (the bring-up check)", href: "/library/reading-a-datasheet" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
    ],
  },
];

// ── validation (no DB) ──────────────────────────────────────────────────────
function validate(): void {
  const EM_DASH = "—";
  let ok = true;
  const answerPositions: number[] = [];
  for (const l of LESSONS) {
    const parsed = guideContentBlocksSchema.safeParse(l.contentBlocks);
    if (!parsed.success) {
      ok = false;
      console.error(`[${l.slug}] INVALID blocks:`, JSON.stringify(parsed.error.issues, null, 2));
      continue;
    }
    for (const b of l.contentBlocks) {
      if (!LIBRARY_BLOCK_TYPES.has(b.type)) {
        ok = false;
        console.error(`[${l.slug}] non-library block type: ${b.type}`);
      }
      if (b.type === "quiz") for (const q of b.questions) answerPositions.push(q.answer);
      if (b.type === "math") {
        try {
          katex.renderToString(b.tex, { throwOnError: true });
        } catch (e) {
          ok = false;
          console.error(`[${l.slug}] BAD LaTeX \`${b.tex}\`: ${(e as Error).message}`);
        }
      }
    }
    if (JSON.stringify(l).includes(EM_DASH)) {
      ok = false;
      console.error(`[${l.slug}] CONTAINS EM-DASH`);
    }
    // Every glyph in the content must render in the field-guide PDF (a body face
    // has it, or the render fallback set + Saira do). Catches a symbol that would
    // .notdef-box in print before it ships. See pdf-glyphs.test.ts for the twin
    // guard over the tool registry.
    for (const g of pdfGlyphIssues(JSON.stringify(l.contentBlocks), PDF_SAIRA_FALLBACK)) {
      ok = false;
      console.error(`[${l.slug}] PDF-unrenderable glyph "${g.char}" (${g.codepoint}) — ${g.kind}`);
    }
  }
  const spread = answerPositions.reduce<Record<number, number>>((m, a) => ((m[a] = (m[a] ?? 0) + 1), m), {});
  console.log(`answer-key spread across ${answerPositions.length} questions:`, JSON.stringify(spread));
  if (!ok) process.exit(1);
  console.log(`validated ${LESSONS.length} lessons OK`);
}

// ── seed (PROD) ─────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  const { db } = await import("@/lib/db");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No ADMIN user found to own the lessons");
  for (const l of LESSONS) {
    const row = await db.miniLesson.upsert({
      where: { slug: l.slug },
      update: {
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "pcb-design",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
      },
      create: {
        slug: l.slug,
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "pcb-design",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
        createdById: admin.id,
      },
      select: { slug: true, clusterOrdinal: true },
    });
    console.log(`seeded ${row.slug} (clusterOrdinal ${row.clusterOrdinal})`);
  }
}

if (process.argv.includes("--check")) {
  validate();
  process.exit(0);
}
validate();
seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
