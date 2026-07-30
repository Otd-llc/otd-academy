// L1.02 ESP-NOW link — DRC_GERBER card.
//
// L1.01's DRC_GERBER card is gospel here, and almost nothing about this stage
// is board-specific: both boards are 4 copper layers at 1.6 mm going to PCBWay,
// so the export is the same nine layers, the same two drill files, and the same
// twelve-file zip. What IS board-specific is the last look in the viewer: on a
// radio board the antenna keep-out has to be empty in the EXPORT, not just in
// the rule area.
//
// The card this replaces was 11 blocks against a 25 bar: one doSteps of three
// compressed steps, no numbered sections at all, one of four mode bands, and
// no statement of which layers to plot or how many files should end up in the
// zip. A learner could not have followed it without L1.01 open beside them.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Your layout is done and DRC-clean against your fab's rules, because you loaded them in Board Setup before you routed a single trace. Two things still stand between that and a box of boards: one last rules check, in case a late edit slipped something past you, and a file export that has to be exactly right, because the fab builds precisely what you send.\n\nNothing here is new, and that is the point of doing it again: this stage is the muscle memory of shipping a board. **One export covers both of your nodes**, because the pair is one design.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · One last DRC", "Hands on: confirm nothing slipped after your last clean run."),
  sect("01", "One last DRC", "Your rules were set in Board Setup and your layout already passed. This is the final confirmation that nothing changed."),
  prose(
    "You loaded PCBWay's rules back in **Board Setup** and routed inside them, so the board is already clean against the shop that will build it. Here you simply confirm it: run **[[design rule check|DRC]]** once more and expect **0 violations and 0 unconnected items**. Its job now is to catch what slipped *after* your last clean run: a part you nudged, a trace you tweaked, a zone you refilled and then edited again. A clearance the fab cannot make is a short waiting to happen across a whole batch, and on this board it is a whole batch of two.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/pcb-drc.svg",
    alt: "A design-rule check comparing a layout against the fab's minimum clearance, trace width and drill limits, flagging the features that fall below them.",
    caption: "What DRC actually does: measure your board against the factory's floor.",
  },
  does("run the final DRC", [
    {
      text: "In the board editor, open **Inspect ▸ Design Rules Checker**.",
      proof: "The Design Rules Checker dialog is open.",
    },
    {
      text: "Tick **Refill all zones before performing DRC** and **Test for parity between PCB and schematic**, then **Run DRC**. Expect **0 errors and 0 unconnected**. A few cosmetic warnings (silk near an edge or over a pad) are normal and fine to leave.",
      proof: "The run reports 0 violations and 0 unconnected items.",
    },
    {
      text: "Anything else: fix it, refill (**B**), and run again until it is clean.",
      proof: "A repeat run comes up clean.",
    },
    {
      text: "If a flag survives because it comes from the stock module footprint rather than your work, use **Exclude** and write the reason down. An excluded flag you cannot explain is a flag you have not understood.",
      proof: "Every remaining flag is excluded with a written reason.",
    },
  ]),
  shot(
    "One last DRC: zero errors against the shop that will build it.",
    "KiCad Inspect > Design Rules Checker after running it, 0 errors against the loaded PCBWay rules. Frame the Violations: 0 / Unconnected: 0 summary line at the bottom of the dialog.",
  ),
  tube("Run DRC clean, then export the Gerbers"),
  check(
    "**DRC flags a 5 mil clearance where the fab requires 6. Ship it anyway?** No. Fix it, or confirm the fab can hold 5 and write the exception down. A clearance violation can short in production, and it will do it on every board in the order.",
  ),
  gotcha(
    "an unrefilled zone exports the copper you used to have",
    "KiCad displays the last computed fill, not the current one. Nudge a trace after filling and the screen can still show the old copper, which is what the plotter would then write. Ticking **Refill all zones before performing DRC** here, and **Check zone fills before plotting** in the Plot dialog below, closes that gap twice. On this board the zone that matters most is the one bordering the antenna keep-out.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("orient", "What the fab actually reads", "Read this: Gerbers are what the board house builds from, not your design file."),
  sect("02", "Gerbers: the fab's instructions", "One flat file per layer, plus a drill file. Between them they are the whole board."),
  prose(
    "A [[gerber]] set is one file per layer (each copper layer, the [[solder mask]], the silkscreen) plus a drill file: the precise recipe for your board. Export them and **zip the whole set into one archive**, then open them in a Gerber viewer and actually look. It is your last chance to catch a mirrored layer, a missing mask opening, or a plane that never refilled, before the mistake becomes a batch of bad boards.",
  ),
  {
    type: "image",
    src: "/guide-diagrams/gerber-layer-stack.svg",
    alt: "Exploded stack of Gerber files: front silkscreen, front mask, front copper, back copper, back mask, back silkscreen, Edge.Cuts outline, and a drill file piercing every copper layer.",
    caption: "One flat file per layer, plus the drill: zip them all together and that is the board.",
  },

  band("do", "in KiCad · Export & zip the set", "Hands on: plot the layers, generate the drill, zip the whole set."),
  prose(
    "One dialog plots every layer, a second writes the drill files, and a zip of the two is the whole recipe. This board is **4 copper layers at 1.6 mm**, same as L1.01, so the export is the same **twelve files**. Match these settings once and KiCad remembers them, which is worth knowing because you will do this again on every board in the path.",
  ),
  does("plot the Gerbers, generate the drill, zip the set", [
    {
      text: "Open **File ▸ Plot**. Set **Plot format** to **Gerber**, pick an **Output directory** (a fresh empty folder, so the only files in it are the ones you are about to send), and leave the units in **mm**.",
      proof: "The Plot dialog is open, the format reads Gerber, and the output folder is empty.",
    },
    {
      text: "Now the layer list, and this is the step people get wrong. **Tick exactly these nine, and count them:** `F.Cu`, `In1.Cu`, `In2.Cu`, `B.Cu`, `F.Mask`, `B.Mask`, `F.Silkscreen`, `B.Silkscreen`, `Edge.Cuts`. Four copper layers, both solder masks, both silkscreens, and the board outline. Those nine ARE the board.",
      proof: "Nine layers are ticked: four copper, both masks, both silkscreens, Edge.Cuts.",
    },
    {
      text: "**Untick everything else, one by one.** KiCad opens this dialog with far more than nine ticked. Hunt down **`F.Paste` and `B.Paste`** (a solder-paste stencil you do not need, because you are hand-soldering), **`F.Fab` and `B.Fab`** (an assembly drawing for a human), **`F.Courtyard` and `B.Courtyard`** (part-spacing outlines that exist only for the checker), and **`User.Drawings`, `User.Comments`, `User.Eco1`, `User.Eco2`, `Margin`, `F.Adhesive`, `B.Adhesive`**.",
      proof: "Nothing outside the nine is ticked. F.Paste and B.Paste in particular are off.",
    },
    {
      text: "Why bother unticking? The board house does not open your design; it reads your files and decides what each file *is* from the file itself. Hand it a folder with an assembly drawing and a courtyard layer in it and you have handed a stranger extra plausible-looking layers to guess about. A fab's automatic checker can mis-file one as copper, and then your order sits still while somebody emails you a query.",
      proof: "You can say why an extra layer in the zip is a risk and not just clutter.",
    },
    {
      text: "Check the three options above the layer list: leave **Generate Gerber job file** and **Use extended X2 format** ticked (both default), and make sure **Check zone fills before plotting** is on. X2 and the job file matter more on four layers than two: they label which file is which layer and in what order, so `In1.Cu` and `In2.Cu` cannot be built swapped. Click **Plot**.",
      proof: "The output folder holds exactly nine `.gbr` files plus one `.gbrjob` job file.",
    },
    {
      text: "Still in that dialog, click **Generate Drill Files…**, then **Generate Drill File**. You get **two** files, not one, and that is correct: `-PTH.drl` holds every **plated** hole (your vias plus the header, button and test-point holes, the ones with copper through the barrel) and `-NPTH.drl` holds the **non-plated** ones (on this board the locating holes the USB-C connector drops into). Both go to the fab.",
      proof: "Two drill files sit beside the Gerbers: one ending `-PTH.drl` and one ending `-NPTH.drl`.",
    },
    {
      text: "**Select the twelve files and zip them** (or zip the folder, now that it holds nothing else). Count before you send: nine `.gbr`, two `.drl`, one `.gbrjob`. That `.zip` is exactly what you upload next stage, once, for however many boards you order.",
      proof: "One `.zip` holds twelve files: nine Gerbers, two drill files, one Gerber job file.",
    },
  ]),
  shot(
    "Nine layers ticked and nothing else, then Generate Drill Files. That's the whole export.",
    "KiCad File > Plot: Gerber format; EXACTLY nine layers ticked (4 copper, both masks, both silks, Edge.Cuts); paste, fab, courtyard and user layers UNticked; X2 + job file + zone-fill check on.",
    "See it set · the Plot dialog",
  ),
  trace("Count the zip before you send it", [
    { text: "Nine `.gbr` files, not eight and not eleven", help: "Eight usually means a copper layer went missing on a 4-layer board. Eleven usually means the paste pair came along." },
    { text: "Two `.drl` files, one PTH and one NPTH", help: "One drill file means the non-plated holes were folded in or dropped. The USB-C connector's locating holes are the ones at stake." },
    { text: "One `.gbrjob`", help: "It names the stackup and layer order. Without it a fab has to infer which inner layer is which." },
    { text: "No `.kicad_pcb` and no project files in the archive", help: "Harmless to the fab, but it means you zipped the project folder instead of the plot folder, and the plot folder was supposed to be empty." },
  ]),

  // ── 03 ────────────────────────────────────────────────────────────────────
  band("check", "Look at what the fab will build", "Verify. Open the Gerbers in a viewer and look before you upload."),
  sect("03", "The viewer pass, and the keep-out one last time", "On a radio board there is one region worth a deliberate stare, and this is the last moment it is free to fix."),
  prose(
    "Open the exported set in **GerbView** (or any Gerber viewer) with every layer on. You are checking the export, not the design: the viewer shows the literal board, so a mirrored silkscreen or a missing mask opening shows up here and nowhere else.\n\nThen go to the antenna end. **The keep-out has to be empty on all four copper layers in the export**, not merely covered by a rule area in your board file. A rule area is an instruction; the Gerber is the result. If a zone was nudged and never refilled, this is where you find out, and it is the difference between a link that reaches across a room and one that does not.",
  ),
  shot(
    "The viewer pass: the literal boards the fab will build. Look at the keep-out one last time.",
    "KiCad GerbView, all L1.02 layers on, top view unmirrored, silk readable, the empty antenna keep-out region visible in frame.",
  ),
  check(
    "**In the viewer, where do your eyes go first on this particular board?** The antenna strip. Every layer of it should be empty in the actual export, because the viewer shows what the fab builds rather than what your rule area intended.",
  ),
  check(
    "**Your viewer shows the top silkscreen mirrored. Safe to send?** No. A mirrored layer means an export setting is wrong, and every board comes back with its labels reversed. On this board that means three identical buttons with the wrong names beside them. Fix the export and re-check the viewer.",
  ),
  {
    type: "callout", severity: "info", label: "Compare against the reference",
    body: "The reference export exists for this board as it did for L1.01: open it beside yours in the viewer and diff the layers. Same board, correctly exported. Anything that looks different is worth understanding before you spend money. It is also your safety net at ORDERING: if you would rather not bet two boards on your own export, you can order from these.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },
  dive(
    "What's inside a Gerber set",
    "A [[gerber]] set is a stack of flat 2D drawings, one file per physical layer: the front copper, two inner copper ground planes, the back copper, the [[solder mask]] for each side (the green coating, with openings where the pads are), and the silkscreen (the white labels). Riding alongside is a drill file, historically called Excellon, listing every hole's position and diameter, plus a board-outline file telling the fab where to cut, and a small **job file** (`.gbrjob`) naming your stackup and layer order, which is what stops In1 and In2 being built the wrong way round.\n\nThe format is decades old and deliberately literal: it describes shapes and nothing else, so there is no ambiguity about what gets built. That is exactly why you open it in a viewer before ordering. The viewer shows you the actual board rather than your hopeful design intent.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: DRC & Gerbers",
    gate: true,
    questions: [
      {
        id: "parity-recall",
        q: "What does 'Test for parity between PCB and schematic' catch?",
        options: [
          "Missing stitching vias",
          "A schematic edit you never pushed across with F8",
          "Traces that are too thin",
        ],
        answer: 1,
        explain: "Parity compares the board's netlist against the schematic, catching the drifted-edit case DRC alone cannot see.",
      },
      {
        id: "one-design-two-boards", reviewId: "l102-one-design-two-boards",
        q: "You are building two boards. How many Gerber zips do you upload?",
        options: [
          "One per copper layer",
          "Two, one per board",
          "One: the pair is one design, and quantity is an ordering option",
        ],
        answer: 2,
        explain: "Identical boards come from one design. The fab builds whatever quantity you order from that single zip.",
      },
      {
        id: "viewer-first-look", reviewId: "l102-keepout-in-export",
        q: "First thing to eyeball in the Gerber viewer on this board?",
        options: [
          "The antenna strip: empty on every exported layer",
          "The silkscreen font",
          "The board outline corners",
        ],
        answer: 0,
        explain: "The viewer shows the actual export. On a radio board the keep-out is the detail worth a deliberate look, because a rule area is an instruction and the Gerber is the result.",
      },
      {
        id: "jobfile-recall",
        q: "Why keep the Gerber job file in the zip on a 4-layer board?",
        options: [
          "PCBWay refuses zips without it",
          "It makes the zip smaller",
          "It names the layer order so In1 and In2 can't be built swapped",
        ],
        answer: 2,
        explain: "The job file pins which file is which layer and in what stack order: cheap insurance on any multilayer board.",
      },
      {
        id: "untick-paste",
        q: "Why untick F.Paste and B.Paste before you plot?",
        options: [
          "They double the fab's price",
          "A paste layer is a stencil you are not ordering, and every extra file is one more thing the fab has to guess about",
          "KiCad cannot export them correctly",
        ],
        answer: 1,
        explain: "You are hand-soldering, so there is no stencil. Nine files and nothing else means nothing in the archive needs interpreting.",
      },
    ],
  },

  exit(
    "Clean DRC, inspected Gerbers, one zip that builds both nodes, and a keep-out you have now confirmed in the export rather than in your intentions. Confirm and move to ordering, where the only new arithmetic is times two.",
  ),

  ref("The Gerber Format Specification (Ucamco): the fab-ready files a DRC-clean board exports", "https://www.ucamco.com/en/gerber"),
  ref("KiCad 10: PCB Editor manual, plotting and drill-file generation", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
];

publishCard({ slug: "l1-02-espnow-link", stage: "DRC_GERBER", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
