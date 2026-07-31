// L1.03 WS2812 node — DRC_GERBER card.
//
// Authored from docs/boards/l1-03-ws2812-node/design.md with L1.01's DRC_GERBER
// card as gospel: the final DRC with refill-and-parity ticked, the exact nine
// plotted layers, the layers to UNtick and why, X2 plus the job file, the two
// drill files, the twelve-file zip, and the look-at-it-in-a-viewer rule.
//
// The card this replaces was 6 blocks against L1.01's 25.
//
// NEW here, and specific to this board:
//   - the final DRC has to include the 5V_EXT isolation rule, which is the one
//     DESIGN_VALIDATION item design.md lists as owed at layout stage. A rule
//     that lives only in a local Board Setup is a rule that can quietly stop
//     being loaded.
//   - the silkscreen is now safety equipment. The "5 V only" warning at J5 is
//     the last thing between a user and a 12 V brick, so the viewer pass has to
//     confirm it survived the export legible.
//   - this board has far more plated holes than L1.01 (two screw terminals, a
//     radial electrolytic, headers, buttons, test points), so the drill file
//     stops being an afterthought.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("Run the final DRC, export the Gerbers, and look at what the fab will build"),

  prose(
    "Your layout is done and DRC-clean against your fab's rules, because you set them in Board Setup before you routed. Two things still stand between it and a box of boards: one last rules check in case a late edit slipped something past you, and a file export that has to be exactly right, because the fab builds precisely what you send, no more and no less.\n\nThis board adds a third thing. The rule you wrote at layout to prove the two 5 V domains never touch has to still be loaded when you run that final check, and the silkscreen warning at J5 has to survive the export legible, because on this board the silkscreen is safety equipment.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · One last DRC", "Hands on: confirm nothing slipped after your last clean run."),
  sect("01", "One last DRC", "Your rules were set in Board Setup and your layout already passed. This is the confirmation that nothing changed."),
  prose(
    "You loaded PCBWay's rules back in **Board Setup** and routed inside them, so your layout is already clean against the shop that will build it. Here you confirm it. Run [[design rule check|DRC]] one more time and expect zero errors.\n\nIts job now is to catch what slipped *after* your last clean run: a part you nudged, a trace you tweaked, a pour you refilled and forgot. A clearance the fab cannot make is a short waiting to happen across a whole batch, so you do not hand off until this comes up clean.",
  ),
  does("run the final DRC", [
    {
      text: "In the board editor, open **Inspect, Design Rules Checker**.",
      proof: "The Design Rules Checker dialog is open.",
    },
    {
      text: "Tick **Refill all zones before performing DRC** and **Test for parity between PCB and schematic**, then **Run DRC**. Expect **0 errors and 0 unconnected**. A few cosmetic warnings, silk near an edge or over a pad, are normal and fine to leave.",
      proof: "The run reports 0 violations and 0 unconnected items.",
    },
    {
      text: "**Confirm your isolation rule is still loaded.** Open **Board Setup, Design Rules, Custom Rules** and read back the clearance rule you wrote between `5V_EXT` and the board's 5 V nets. A rule that quietly stopped being loaded reports the same clean result as a rule that passed.",
      proof: "The Custom Rules panel still contains the 5V_EXT isolation rule.",
    },
    {
      text: "Anything else: fix it, refill (**B**), and run again until it is clean.",
      proof: "A repeat run comes up clean.",
    },
  ]),
  shot(
    "One last DRC: zero errors against the shop that will build it.",
    "KiCad, Inspect, Design Rules Checker after running it: 0 errors against the loaded PCBWay rules. Frame the Violations 0 and Unconnected 0 summary line at the bottom of the dialog.",
  ),
  check(
    "**DRC flags a 5 mil clearance where the fab requires 6. Ship it anyway?** No. Fix it, or confirm the fab can actually do 5 and write down the exception. A clearance violation can short in production, across the whole batch, and you will not find out until the boards arrive.",
  ),
  gotcha(
    "a clean report from a rule that is not loaded",
    "The isolation rule between the two 5 V domains lives in this project's Board Setup, not in the PCBWay rule file. If you rebuilt the project, restored a backup, or pasted the fab rules over the Custom Rules panel rather than adding to it, **the rule is gone and DRC reports clean anyway**, because the thing it was checking for is not an error by default. Read the panel back rather than trusting the result.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("orient", "What the fab actually reads", "Read this. Gerbers are what the board house builds from, not your design file."),
  sect("02", "Gerbers: the fab's instructions", "One flat file per layer, plus a drill file, plus a job file that says what order they stack in."),
  prose(
    "A [[gerber]] set is one file per layer, each copper layer, the [[solder mask]], the silkscreen, plus a drill file: the precise recipe for your board. Export them and **zip the whole set into one archive**. That archive is what you upload.\n\nThen open them in a Gerber viewer and actually look. It is your last chance to catch a mirrored layer, a missing mask opening, or a forgotten copper pour before the mistake becomes a batch of bad boards.",
  ),
  dive(
    "What is inside a Gerber set",
    "A Gerber set is a stack of flat 2D drawings, one file per physical layer: the front copper, two inner copper ground planes, the back copper, the [[solder mask]] for each side (the green coating, with openings where the pads are), and the silkscreen (the white labels).\n\nRiding alongside is a **drill file**, historically called Excellon, listing every hole's position and diameter; a board-outline file telling the fab where to cut; and a small **job file** (`.gbrjob`) naming your stackup and layer order, which is what stops In1 and In2 being built the wrong way round.\n\nThe format is decades old and deliberately literal: it describes shapes and nothing else, so there is no ambiguity about what gets built. That is exactly why you open them in a viewer before ordering. The viewer shows you the actual board rather than your hopeful design intent.",
  ),
  shot(
    "One flat file per layer, plus the drill: zip them all together and that is the board.",
    "Exploded illustration or GerbView screenshot showing the layer stack: front silk, front mask, four copper layers, back mask, back silk, Edge.Cuts, and the drill file piercing every copper layer.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · Export & zip the set", "Hands on: plot the layers, generate the drill, zip the whole set."),
  sect("03", "Plot, drill, zip", "One dialog plots every layer, a second writes the drill files, and a zip of the two is the whole recipe."),
  prose(
    "Match these settings once and KiCad remembers them, so every export after this is a couple of clicks. The count to remember for this board is the same as the last one: **nine Gerbers, two drill files, one job file, twelve in total**.",
  ),
  does("plot the Gerbers, generate the drill, zip the set", [
    {
      text: "Open **File, Plot**. Set **Plot format** to **Gerber**, pick an **Output directory** (a fresh empty folder, so the only files in it are the ones you are about to send), and leave the units in **mm**.",
      proof: "The Plot dialog is open, the format reads Gerber, and the output folder is empty.",
    },
    {
      text: "Now the layer list, and this is the step people get wrong. **Tick exactly these nine, and count them:** `F.Cu`, `In1.Cu`, `In2.Cu`, `B.Cu`, `F.Mask`, `B.Mask`, `F.Silkscreen`, `B.Silkscreen`, `Edge.Cuts`. Every copper layer, both solder masks, both silkscreens, and the board outline. Those nine are the board.",
      proof: "Nine layers are ticked: four copper, both masks, both silkscreens, Edge.Cuts.",
    },
    {
      text: "**Untick everything else, one by one.** KiCad opens this dialog with far more than nine ticked. Hunt down **`F.Paste` and `B.Paste`** (a solder-paste stencil you do not need, because you are hand-soldering), **`F.Fab` and `B.Fab`** (an assembly drawing for a human), **`F.Courtyard` and `B.Courtyard`** (part-spacing outlines that exist only for the rule checker), and the **`User.*`, `Margin` and adhesive** layers.",
      proof: "Nothing outside the nine is ticked. F.Paste and B.Paste in particular are off.",
    },
    {
      text: "**One of those user layers matters on this board.** The **height note you drew for C10** lives on a documentation layer, and it must stay out of the Gerbers, because it is a note to a human and the fab's checker has no idea what it is. Keep it in the project, keep it out of the zip.",
      proof: "The C10 height marker's documentation layer is unticked in the plot list.",
    },
    {
      text: "Why bother unticking? Because the board house does not open your design, it reads your files, and it decides what each file *is* from the file itself. Hand a stranger extra plausible-looking layers and an automatic checker can mis-file one as copper. Then somebody emails you a query and your order sits still for two days.",
      proof: "You can say why an extra layer in the zip is a risk rather than clutter.",
    },
    {
      text: "Check the three options above the layer list: leave **Generate Gerber job file** and **Use extended X2 format** ticked, and make sure **Check zone fills before plotting** is on. X2 and the job file label which file is which layer and in what order, so `In1.Cu` and `In2.Cu` cannot be built swapped. The zone-fill check means a plane you nudged but never refilled can never reach the fab. Click **Plot**.",
      proof: "The output folder holds exactly nine .gbr files plus one .gbrjob job file.",
    },
    {
      text: "Still in that dialog, click **Generate Drill Files**, then **Generate Drill File**. You get **two** files and that is correct: `-PTH.drl` holds every **plated** hole and `-NPTH.drl` the **non-plated** ones. Both go to the fab.",
      proof: "Two drill files sit beside the Gerbers: one ending -PTH.drl and one ending -NPTH.drl.",
    },
    {
      text: "**Select the twelve files and zip them**, or zip the folder now that it holds nothing else. Count before you send: nine `.gbr`, two `.drl`, one `.gbrjob`. That zip is exactly what you upload next stage.",
      proof: "One .zip holds twelve files: nine Gerbers, two drill files, one Gerber job file.",
    },
  ]),
  shot(
    "Nine layers ticked and nothing else, then Generate Drill Files. That is the whole export.",
    "KiCad File, Plot: Gerber format, exactly nine layers ticked (4 copper, both masks, both silks, Edge.Cuts), paste, fab, courtyard and user layers unticked, X2 and job file and zone-fill check on.",
  ),
  tube("Plot the nine layers, generate both drill files, and zip the set"),
  dive(
    "Why this board's drill file is worth a second look",
    "L1.01's plated-hole list was short: vias, two header rows, two buttons, two test points. This board adds a great deal more, and all of it is mechanical rather than electrical.\n\n**Two screw terminals** on a 5.08 mm pitch, whose holes take a solid pin and a real amount of solder. **A radial electrolytic** with two leads and a body that will lever on those joints every time someone tugs a wire. Those are the holes a user's hands will eventually load, and a hole that is a little tight is an assembly problem you meet with a hot iron in your hand.\n\nThe non-plated file stays short, holding the locating holes the USB-C connector drops into. The reason both files go to the fab is that plated and non-plated are different manufacturing operations: a plated hole gets copper through the barrel and a non-plated one deliberately does not. Send only one file and the fab either plates something that should be bare or leaves a hole with no copper in a place your circuit needs it.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  band("check", "Look at what the fab will build", "Verify. Open the Gerbers in a viewer, and check the things this board can lose silently."),
  prose(
    "Load the whole set into a viewer, view from the **top**, and read it as though you had never seen the design. Two of the checks below are new to this board, and both are things a clean DRC will happily let through.",
  ),
  trace("What to look for in the viewer", [
    { text: "The silkscreen reads **left to right, not mirrored**, viewed from the top", help: "A mirrored layer means an export setting is wrong, and every board comes back with its labels reversed." },
    { text: "**The 5 V warning at J5 is present and legible**, not clipped by the board edge or swallowed by a pad", help: "New on this board. That warning is what stands between a user and a 12 V brick, and silkscreen over a pad gets removed at the fab, silently." },
    { text: "**The antenna keep-out is empty on all four copper layers**", help: "Step through the copper layers one at a time. The inner planes are the ones that fill in without you noticing." },
    { text: "**5V_EXT is a visibly separate island of copper** from the board's other 5 V", help: "The viewer shows finished copper rather than nets, so this is the one place you see the isolation as a picture rather than as a rule that passed." },
    { text: "Every pad has a **mask opening**, including the pixel's four", help: "A pad with no opening is a pad you cannot solder to, and the pixel's pads are already the hardest on the board." },
    { text: "The **outline is a single closed shape** on Edge.Cuts", help: "A gap in the outline leaves the fab guessing where to cut, which is a query email and a stalled order." },
    { text: "The **drill hits are where the through-hole parts are**, including both terminals and C10", help: "Compare the drill layer against the silkscreen outlines. A missing hole here means a part with nowhere to go." },
  ]),
  shot(
    "The Gerbers in a viewer: the literal board the fab builds, layer by layer.",
    "KiCad GerbView, all layers on and colour-separated, board viewed from the TOP and not mirrored, silkscreen readable left to right, layer-list panel visible.",
  ),
  shot(
    "The check that only the viewer can give you: 5V_EXT as its own island of copper.",
    "GerbView with only F.Cu and the inner planes shown, zoomed on the J5 to J4 run, so the isolated 5V_EXT copper is visibly separate from the board's other 5 V copper.",
    "See it wired · the isolation, as finished copper",
  ),
  {
    type: "callout", severity: "info", label: "Compare against the reference",
    body: "Want to be sure your Gerbers came out right? Download the reference set and open it next to yours in the viewer: the same board, correctly exported. Diff the layers, and anything that looks different is worth understanding before you spend money. It is also your safety net at ordering: if you would rather not bet a board on your own export, you can order these.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },
  check(
    "**Your Gerber viewer shows the top silkscreen mirrored. Safe to send?** No. A mirrored layer means an export setting is wrong, and every board would come back with its labels reversed, including the 5 V warning at J5. Fix the export and re-check the viewer. The fab builds exactly these files, not your design intent.",
  ),
  gotcha(
    "silkscreen over a pad disappears",
    "Fabs strip silkscreen that lands on an exposed pad, because ink on a pad ruins the joint. They do it automatically and they do not tell you. So a warning label that overlaps a terminal's pad in your layout arrives as a warning label with a hole in it, or missing entirely. This is why the viewer pass reads the silk rather than glancing at it, and why the safety-critical text at J5 belongs in clear space.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: DRC and Gerbers",
    gate: true,
    questions: [
      {
        id: "what-drc-does",
        q: "What does a design rule check do?",
        options: [
          "Compares your layout to the fab's limits and to the rules you wrote, and flags what breaks either",
          "Orders the parts for you",
          "Makes the board run faster",
        ],
        answer: 0,
        explain: "It catches traces too close together, holes too small, and on this board a 5V_EXT trace that strayed toward the board's own 5 V.",
      },
      {
        id: "rule-still-loaded", reviewId: "l103-rule-still-loaded",
        q: "DRC reports clean. What would make that result meaningless on this board?",
        options: [
          "Running it before refilling the zones",
          "The 5V_EXT isolation rule no longer being in Custom Rules, since two nets touching is not an error by default",
          "Having the parity test switched on",
        ],
        answer: 1,
        explain: "A rule that quietly stopped being loaded reports exactly the same clean result as a rule that passed. Read the panel back rather than trusting the summary.",
      },
      {
        id: "upload-zip",
        q: "What exactly do you upload to the board house?",
        options: [
          "One zip containing every Gerber layer plus both drill files and the job file",
          "Just the front copper layer",
          "Your KiCad project file",
        ],
        answer: 0,
        explain: "The fab never sees your design file. It builds from the archive alone, so the zip has to hold the full set together: nine Gerbers, two drill files, one job file.",
      },
      {
        id: "untick-extras",
        q: "Why untick the paste, fab and courtyard layers before plotting?",
        options: [
          "They make the zip too large to upload",
          "KiCad cannot plot them correctly",
          "The fab identifies each file from the file itself, so extra plausible-looking layers give an automatic checker something to mis-file",
        ],
        answer: 2,
        explain: "Nine files and nothing else means nothing to guess about. An extra layer usually costs you a query email and a stalled order rather than a bad board, which is still two days.",
      },
      {
        id: "two-drill-files",
        q: "The drill export produces two files rather than one. Why?",
        options: [
          "One is a backup of the other",
          "Plated and non-plated holes are different manufacturing operations, so they are listed separately",
          "One holds the vias and one holds everything else",
        ],
        answer: 1,
        explain: "A plated hole gets copper through the barrel and a non-plated one deliberately does not. Send only one file and the fab either plates something that should be bare or leaves copper out of a hole your circuit needs.",
      },
      {
        id: "silk-over-pad",
        q: "Your 5 V warning at J5 overlaps a terminal pad in the layout. What arrives on the board?",
        options: [
          "The warning, printed over the pad as drawn",
          "A DRC error you would have caught",
          "A warning with a hole in it or missing entirely, because fabs strip silkscreen off exposed pads automatically and silently",
        ],
        answer: 2,
        explain: "Ink on a pad ruins the joint, so they remove it without telling you. On this board that text is safety equipment, which is why the viewer pass reads it rather than glancing at it.",
      },
    ],
  },

  exit(
    "Confirm a clean DRC with your isolation rule still loaded, export the twelve files, and open them in a viewer before you order. The fab builds exactly what is in those files, not what is in your design tool. Attach the zip and the DRC report. Next stage spends money.",
  ),

  ref("The Gerber Format Specification (Ucamco): the fab-ready files a DRC-clean board exports", "https://www.ucamco.com/en/gerber"),
  ref("KiCad 10 documentation: plotting, drill file generation and GerbView", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
  ref("PCBWay PCB capabilities: the process limits the loaded rule file encodes", "https://www.pcbway.com/capabilities.html"),
];

publishCard({ slug: "l1-03-ws2812-node", stage: "DRC_GERBER", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
