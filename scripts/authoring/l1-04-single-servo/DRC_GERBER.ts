// L1.04 single-servo driver — DRC_GERBER card.
//
// L1.01's DRC_GERBER card is gospel for the whole export, and this board changes
// none of it: the same final DRC with Refill and parity ticked, the same nine
// plotted layers (four copper, both masks, both silks, Edge.Cuts) and nothing
// else, the same two drill files, the same twelve-file zip, the same viewer pass.
//
// What is genuinely different is what you are looking FOR in the viewer. On
// L1.01 the viewer pass caught export mistakes. On this board it is also the
// last chance to read the silkscreen the way a person holding the board will,
// because three of the design's risks (RK2, RK4, a reversed C8) are mitigated by
// markings, and a marking that came out illegible is a mitigation that did not
// ship (design.md §4 silkscreen rule).
//
// The servo-rail width check belongs here too: a necked-down VSERVO segment is
// legal copper, so it survives DRC, and the copper layer in a Gerber viewer is
// where you can actually see it.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Your layout is done and DRC-clean against your fab's rules, because you loaded them in Board Setup before you routed. Two things still stand between it and a box of boards: one last rules check, in case a late edit slipped something past you, and a file export that has to be exactly right, because the fab builds precisely what you send.\n\nThis board adds a third. Two of its protections are **printed**, not soldered, and the artwork you are about to send is the only place left to check that they came out readable.",
  ),

  band("do", "in KiCad · One last DRC", "Hands on. Confirm nothing slipped after your last clean run."),
  sect("01", "One last DRC", "Your rules were set in Board Setup and your layout already passed. This confirms nothing changed."),
  prose(
    "You loaded PCBWay's rules back in Board Setup and routed inside them, so the board is already clean against the shop that will build it. Here you confirm it: run [[design rule check|DRC]] once more and expect zero errors. Its job now is to catch anything that moved *after* your last clean run: a part you nudged, a trace you tweaked, a pour you refilled.\n\nOne thing DRC still cannot catch, and this is the board where it matters: **a narrow section in the servo rail.** VSERVO is on a net class at 0.8 mm because it carries 0.9 A, but 0.25 mm is perfectly legal copper, so a segment you accidentally drew at Default width passes every check. You look for that by eye, on the copper layer, in the next section.",
  ),
  does("run the final DRC", [
    {
      text: "In the board editor open **Inspect ▸ Design Rules Checker**.",
      proof: "The Design Rules Checker dialog is open.",
    },
    {
      text: "Tick **Refill all zones before performing DRC**, because fills go stale the moment you nudge anything, and **Test for parity between PCB and schematic**, which catches a schematic edit you never pushed across with F8. Then **Run DRC**.",
      proof: "Both tickboxes are on and the run has completed.",
    },
    {
      text: "Expect **0 errors and 0 unconnected items**. A few cosmetic warnings, like silk near an edge or crossing a pad, are normal and fine to leave. Anything else: fix it, refill (**B**), and run again until it is clean.",
      proof: "The run reports 0 violations and 0 unconnected items, with only cosmetic warnings left.",
    },
  ]),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "KiCad Design Rules Checker showing zero errors and zero unconnected items against the loaded fab rules.",
    caption: "One last DRC: zero errors against the shop that will build it.",
    captureHint: "KiCad Inspect > Design Rules Checker after running: 0 errors against the loaded PCBWay rules. Frame the Violations 0 / Unconnected 0 summary line.",
  },
  check(
    "**DRC flags a clearance the fab cannot make. Ship it anyway?** No. Fix it, or confirm with the fab that they can hold it and write the exception down. A clearance violation is a short waiting to happen across a whole batch of boards, and you are about to pay for five of them.",
  ),

  band("orient", "What the fab actually reads", "Read this. Gerbers are what the board house builds from, not your design file."),
  sect("02", "Gerbers: the fab's instructions", "One flat file per physical layer, plus the drilling, zipped into one archive."),
  prose(
    "A [[gerber]] set is one file per layer, each copper layer, the [[solder mask]], the silkscreen, plus a drill file: the precise recipe for your board. Export them, **zip the whole set into one archive**, then open them in a viewer and actually look. It is your last chance to catch a mirrored layer, a missing mask opening, a forgotten pour, or an unreadable polarity mark, before the mistake becomes a batch of bad boards.",
  ),
  {
    type: "image", src: "/guide-diagrams/gerber-layer-stack.svg",
    alt: "Exploded stack of Gerber files: front silkscreen, front mask, front copper, inner copper, back copper, back mask, back silkscreen, the board outline, and a drill file piercing every copper layer.",
    caption: "One flat file per layer, plus the drill. Zip them all together and that is the board.",
  },

  band("do", "in KiCad · Export and zip the set", "Hands on. Plot the layers, generate the drill, zip the whole set."),
  does("plot the Gerbers, generate the drill, zip the set", [
    {
      text: "Open **File ▸ Plot**. Set **Plot format** to **Gerber**, pick a **fresh empty output directory** so the only files in it are the ones you are about to send, and leave the units in mm.",
      proof: "The Plot dialog is open, the format reads Gerber, and the output folder is empty.",
    },
    {
      text: "**Tick exactly these nine, and count them:** `F.Cu`, `In1.Cu`, `In2.Cu`, `B.Cu`, `F.Mask`, `B.Mask`, `F.Silkscreen`, `B.Silkscreen`, `Edge.Cuts`. Four copper layers because this board is 4-layer, both solder masks, both silkscreens, and the outline. Those nine **are** the board.",
      proof: "Nine layers are ticked: four copper, both masks, both silkscreens, Edge.Cuts.",
    },
    {
      text: "**Untick everything else, one by one.** KiCad opens this dialog with more than nine ticked. Hunt down **F.Paste and B.Paste** (a solder-paste stencil you do not need when hand-soldering), **F.Fab and B.Fab** (an assembly drawing for a human), **F.Courtyard and B.Courtyard** (part-spacing outlines that exist only for DRC), and the User and Adhesive layers.",
      proof: "Nothing outside the nine is ticked, and F.Paste and B.Paste in particular are off.",
    },
    {
      text: "Leave **Generate Gerber job file** and **Use extended X2 format** ticked, and make sure **Check zone fills before plotting** is on. X2 and the job file label which file is which layer and in what order, so `In1.Cu` and `In2.Cu` cannot be built swapped. Click **Plot**.",
      proof: "The output folder holds exactly nine .gbr files plus one .gbrjob job file.",
    },
    {
      text: "Still in that dialog, click **Generate Drill Files**, then **Generate Drill File**. You get **two**, and that is correct: `-PTH.drl` holds every **plated** hole, which on this board means all your vias plus the header, button, test-point, screw-terminal and **C8's two lead holes**; `-NPTH.drl` holds the **non-plated** ones, such as the locating holes the USB-C connector drops into. Both go to the fab.",
      proof: "Two drill files sit beside the Gerbers, one ending -PTH.drl and one ending -NPTH.drl.",
    },
    {
      text: "**Open the `.gbrjob` in a text editor and read it.** It should name four copper layers in stackup order, top to bottom. This is the file that tells the fab which of your two identical-looking inner planes is In1 and which is In2, and on a board where both are ground it is the one place that order is written down.",
      proof: "The .gbrjob lists four copper layers in stackup order.",
    },
    {
      text: "**Zip the twelve files**, or zip the folder now that it holds nothing else. Count before you send: nine `.gbr`, two `.drl`, one `.gbrjob`. That zip is exactly what you upload next stage.",
      proof: "One .zip holds twelve files: nine Gerbers, two drill files, one Gerber job file.",
    },
  ]),
  {
    type: "image", src: "",
    alt: "KiCad File Plot dialog: Gerber format with exactly nine layers ticked and the paste, fab and courtyard layers unticked.",
    caption: "Nine layers ticked and nothing else, then Generate Drill Files. That is the whole export.",
    captureHint: "KiCad File > Plot: Gerber format, exactly nine layers ticked (4 copper, both masks, both silks, Edge.Cuts), paste and fab and courtyard unticked, X2 and job file on.",
  },
  tube("Run the final DRC, then export and zip the Gerbers"),
  dive(
    "What is inside a Gerber set",
    "A Gerber set is a stack of flat 2D drawings, one file per physical layer: the front copper, the two inner copper ground planes, the back copper, the [[solder mask]] for each side (the green coating, with openings where the pads are), and the silkscreen for each side (the white labels).\n\nRiding alongside is a drill file, historically called Excellon, listing every hole's position and diameter, plus a board-outline file telling the fab where to cut, plus a small **job file** naming your stackup and layer order, which is what stops In1 and In2 being built the wrong way round.\n\nThe format is decades old and deliberately literal: it describes shapes and nothing else, so there is no ambiguity about what gets built. Which is exactly why you open it in a viewer. The viewer shows you the actual board, not your hopeful design intent.\n\nWorth noticing on this board: **the silkscreen files are a deliverable, not a garnish.** On most boards silk is a convenience. Here the plus and minus at J4 and the pin order at J5 are the mitigations for two named risks, so a silk layer that plotted at the wrong size or got clipped is a real defect in the safety design, and this is the last stage it is free to fix.",
  ),

  band("check", "Look at what the fab will build", "Verify. Open the Gerbers in a viewer and read them the way the factory will."),
  {
    type: "image", src: "", aspect: "16:10",
    alt: "A Gerber viewer showing the exported board layers: copper, mask, silkscreen and drill, viewed from the top.",
    caption: "The Gerbers in a viewer: the literal board the fab builds, layer by layer.",
    captureHint: "KiCad GerbView with all layers on and colour-separated, board viewed from the TOP and not mirrored, silkscreen reading left to right, layer-list panel visible.",
  },
  trace("the viewer pass, in this order", [
    { text: "**The board reads from the top, not mirrored.** Silk text runs left to right.", help: "A mirrored layer means an export setting is wrong, and every board comes back with reversed labels. Free to fix now." },
    { text: "**The antenna keep-out is empty on every copper layer.** Turn the layers on one at a time.", help: "All four coppers at once looks fine when one inner plane flooded it. Check them individually, which the viewer makes easy." },
    { text: "**The VSERVO path is visibly wider than the signal traces along its whole length.**", help: "This is the check DRC cannot do. A narrow segment is legal copper. In the viewer it is obvious because it will look like the thin traces around it." },
    { text: "**J4's + and - marks are legible and beside the right pins.**", help: "Compare against the copper layer to confirm which pad is pin 1. Silk that is confidently wrong is worse than no silk." },
    { text: "**J5's GND / V+ / SIG labels and its pin-1 marker are legible.**", help: "Zoom to the size they will actually print. 1 mm text with 0.15 mm strokes reads; smaller than that fills in and blurs." },
    { text: "**C8's polarity marking survived**, and so did D2's and D3's cathode bands.", help: "These three are the polarised parts. If a footprint's polarity mark sits under where the part body goes, you will not be able to check it at assembly." },
    { text: "**Every pad has a mask opening**, including the screw terminal's and C8's through-holes.", help: "A pad with no opening is a pad you cannot solder. Compare the mask layer against the copper layer." },
    { text: "**The outline is closed** and the antenna end of U1 hangs past it.", help: "An open Edge.Cuts loop makes the fab guess, or ask, and your order waits." },
  ]),
  {
    type: "callout", severity: "info", label: "Compare against the reference",
    body: "Want to be sure your Gerbers came out right? Download the reference set and open it beside yours in the viewer: same board, correctly exported. Diff the layers, and anything that looks different is worth understanding before you spend money. It is also your safety net at ordering, if you would rather not bet a board on your own export.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },
  gotcha(
    "silk that is too small to read is not a mitigation",
    "The whole point of J4's polarity marks is that somebody reads them while holding a screwdriver. Zoom the silkscreen layer to the size it will print. If **+** and **-** are indistinct at 1 mm, make them bigger and re-export: text is free, and this board's reverse-polarity protection is designed as a backstop rather than a plan.",
  ),
  check(
    "**Your viewer shows the top silkscreen mirrored. Safe to send?** No. A mirrored layer means an export setting is wrong, and every board would come back with reversed labels, including the polarity marks at J4. Fix the export and re-check the viewer. The fab builds exactly these files, not your design intent.",
  ),

  {
    type: "quiz",
    prompt: "Quick check: DRC and Gerbers",
    gate: true,
    questions: [
      {
        id: "upload-zip",
        q: "What exactly do you upload to the board house?",
        options: [
          "One zip containing every Gerber layer plus the drill files",
          "Your KiCad project file",
          "Just the front copper layer and the outline",
        ],
        answer: 0,
        explain: "The fab never opens your design. It builds from the archive alone, so the zip has to hold the full Gerber set and the drill files together.",
      },
      {
        id: "nine-layers",
        q: "How many layers do you plot for this board, and why that number?",
        options: [
          "Eleven, adding the two paste layers for the stencil",
          "Nine: four copper, both masks, both silkscreens, and the outline",
          "Whatever KiCad has ticked by default",
        ],
        answer: 1,
        explain: "Four copper because the board is 4-layer, plus both masks, both silks and Edge.Cuts. Extra layers in the zip give a stranger something plausible to guess about.",
      },
      {
        id: "silk-is-a-deliverable", reviewId: "l104-silk-is-a-deliverable",
        q: "Why does the viewer pass on this board include reading the silkscreen carefully?",
        options: [
          "The fab charges extra if the silk is unreadable",
          "Silkscreen affects the copper layers",
          "Two of this board's protections are printed, so silk that came out illegible is a mitigation that did not ship",
        ],
        answer: 2,
        explain: "The crowbar diode catches a reversed supply; the plus and minus marks prevent one. Both are part of the design, and only one of them is copper.",
      },
      {
        id: "narrow-rail-in-viewer",
        q: "A 3 mm stretch of your VSERVO path came out at 0.25 mm. DRC passed it. Where do you catch it?",
        options: [
          "By eye on the copper layer, where it looks as thin as the signal traces around it",
          "Nowhere: if DRC passed, the board is fine",
          "The fab's automated check will flag it",
        ],
        answer: 0,
        explain: "0.25 mm is legal copper, so no checker objects. It carries the full 0.9 A through a third of the metal, and the viewer is where a human can see it.",
      },
      {
        id: "viewer-before-order",
        q: "Why open the Gerbers in a viewer before ordering?",
        options: [
          "To make the files smaller",
          "It is required by the Gerber specification",
          "The fab builds exactly those files, so a viewer catches export mistakes while they are still free to fix",
        ],
        answer: 2,
        explain: "A quick look catches a mirrored layer, a missing mask opening, or unreadable silk before it becomes five bad boards and a week of shipping.",
      },
    ],
  },

  exit(
    "Confirm a clean DRC, export the nine layers plus the two drill files, zip them, and read the artwork in a viewer before you order. On this board that read includes the silkscreen: the marks at J4 and J5 are the last cheap chance to prevent a mis-wire, and after this stage they are printed.",
  ),

  ref("The Gerber Format Specification (Ucamco): the fab-ready files a DRC-clean board exports", "https://www.ucamco.com/en/gerber"),
  ref("KiCad 10: PCB Editor manual, plotting and drill-file generation", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
];

publishCard({ slug: "l1-04-single-servo", stage: "DRC_GERBER", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
