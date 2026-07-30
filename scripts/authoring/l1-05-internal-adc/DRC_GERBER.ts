// L1.05 internal ADC — DRC_GERBER card.
//
// Authored ahead of the board, with L1.01's DRC_GERBER card as gospel for the
// entire export: the final DRC with refill and parity ticked, the exactly-nine
// plotted layers (F.Cu, In1.Cu, In2.Cu, B.Cu, both masks, both silkscreens,
// Edge.Cuts), X2 plus the job file plus the zone-fill check, the two drill
// files, and the twelve-file zip.
//
// The board-specific part is small and real: this board's silkscreen carries a
// teaching rule (J4's pin order and its voltage limit, the ADC1 note), so the
// viewer pass has something specific to read rather than a generic glance.
//
// The card this replaces was 5 blocks against the 25-block bar and compressed
// the whole stage into one checklist line.
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, trace, table, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  prose(
    "Your layout is routed and DRC-clean against PCBWay's rules, because you loaded them into Board Setup before you drew a trace. Two things still stand between it and a box of boards: one last rules check, in case a late edit slipped something past you, and an export that has to be exactly right, because the fab builds precisely what you send and nothing else.",
  ),

  // ── 01 ────────────────────────────────────────────────────────────────────
  band("do", "in KiCad · One last DRC", "Hands on. Confirm nothing moved after your last clean run."),
  sect("01", "One last DRC", "The rules have been on since Board Setup, so this is a confirmation rather than a discovery."),
  prose(
    "Run **Inspect ▸ Design Rules Checker** one more time and expect zero. Its job now is to catch what slipped **after** your last clean run: a part you nudged, a trace you tweaked, a zone you refilled and then edited again. A clearance the fab cannot make is a short waiting to happen across a whole batch, so you do not hand off until this comes up clean.\n\nTwo tickboxes carry the weight. **Refill all zones before performing DRC** matters because fills go stale the moment you move anything, and on this board the ground under the analog run is part of the measurement. **Test for parity between PCB and schematic** catches a schematic edit you never pushed across with F8, which on this board would most likely be a change to the analog island.",
  ),
  does("run the final DRC", [
    {
      text: "Open **Inspect ▸ Design Rules Checker** in the board editor.",
      proof: "The Design Rules Checker dialog is open.",
    },
    {
      text: "Tick **Refill all zones before performing DRC** and **Test for parity between PCB and schematic**, then **Run DRC**.",
      proof: "Both tickboxes are on before the run.",
    },
    {
      text: "Expect **0 violations and 0 unconnected items**. A few cosmetic warnings, such as silk near an edge or over a pad, are normal and fine to leave.",
      proof: "The run reports 0 violations and 0 unconnected items.",
    },
    {
      text: "Anything else: fix it, refill (**B**), and run again until it is clean. If a flag comes from a stock footprint rather than your work, use **Exclude** and write down the reason.",
      proof: "A repeat run comes up clean, or every remaining flag is excluded with a written reason.",
    },
  ]),
  shot(
    "One last DRC: zero against the shop that will build it.",
    "KiCad Inspect > Design Rules Checker after a run on the L1.05 board, 0 errors against the loaded PCBWay rules. Frame the violations and unconnected summary line.",
  ),
  check(
    "**DRC flags a clearance the fab requires 6 mil for and you have 5. Ship it anyway?** No. Fix it, or confirm with the fab that they can do 5 and write down the exception. A clearance violation can short in production across every board in the batch.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  band("orient", "What the fab actually reads", "Read this. Gerbers are what the board house builds from, not your design file."),
  sect("02", "Gerbers: the fab's instructions", "One flat file per layer, plus the drilling, plus a job file that says which is which."),
  prose(
    "A Gerber set is one file per layer, each copper layer plus the [[solder mask]] and the silkscreen, with a drill file and a board outline alongside. It is deliberately literal: it describes shapes and nothing else, so there is no ambiguity about what gets built.\n\nExport them, **zip the whole set together**, then open the zip in a viewer and actually look. That viewer pass is the last cheap check before the mistake becomes a batch of bad boards. On this board it has something specific to read: **J4's pin order and its 0 to 3.3 V limit**, and the **ADC1 note** at the GPIO1 breakout. Those labels are what a probing hand relies on, so they get checked on the artwork like any other spec.",
  ),
  band("do", "in KiCad · Export and zip the set", "Hands on. Plot the layers, generate the drill files, zip the whole thing."),
  does("plot the Gerbers, generate the drill, zip the set", [
    {
      text: "**File ▸ Plot.** Set the format to **Gerber**, pick a **fresh empty output folder** so the only files in it are the ones you are about to send, and leave the units in mm.",
      proof: "The Plot dialog reads Gerber and the output folder is empty.",
    },
    {
      text: "**Tick exactly nine layers, and count them:** `F.Cu`, `In1.Cu`, `In2.Cu`, `B.Cu`, `F.Mask`, `B.Mask`, `F.Silkscreen`, `B.Silkscreen`, `Edge.Cuts`. Four copper layers, both masks, both silkscreens, the outline. Those nine are the board.",
      proof: "Nine layers are ticked: four copper, both masks, both silkscreens, Edge.Cuts.",
    },
    {
      text: "**Untick everything else, one by one.** In particular `F.Paste` and `B.Paste` (a stencil you do not need for hand assembly), `F.Fab` and `B.Fab` (a drawing for a human), `F.Courtyard` and `B.Courtyard` (spacing outlines that exist for the checker), and the User and Margin layers.",
      proof: "Nothing outside the nine is ticked, F.Paste and B.Paste in particular.",
    },
    {
      text: "Leave **Generate Gerber job file** and **Use extended X2 format** ticked, and make sure **Check zone fills before plotting** is on. The job file is what stops In1 and In2 being built the wrong way round; the zone-fill check means a plane you nudged and never refilled cannot reach the fab. Click **Plot**.",
      proof: "The output folder holds exactly nine .gbr files plus one .gbrjob.",
    },
    {
      text: "Still in that dialog, click **Generate Drill Files**. You get **two**, and that is correct: `-PTH.drl` holds every plated hole (vias, headers, buttons, test points, and RV1's three legs), `-NPTH.drl` the non-plated ones. Both go to the fab.",
      proof: "Two drill files sit beside the Gerbers, one ending -PTH.drl and one -NPTH.drl.",
    },
    {
      text: "**Zip the twelve files.** Count before you send: nine `.gbr`, two `.drl`, one `.gbrjob`. That zip is exactly what you upload next stage.",
      proof: "One .zip holds twelve files: nine Gerbers, two drill files, one job file.",
    },
  ]),
  shot(
    "Nine layers ticked and nothing else, then Generate Drill Files. That is the whole export.",
    "KiCad File > Plot with Gerber format, exactly nine layers ticked (4 copper, both masks, both silks, Edge.Cuts), paste and fab and courtyard unticked, X2 and job file and zone-fill check on.",
  ),
  tube("Run DRC clean, then export and zip the Gerber set"),
  dive(
    "What is inside a Gerber set, and why the extras are a risk",
    "The set is a stack of flat 2D drawings: front copper, two inner ground planes, back copper, a solder mask per side with openings where the pads are, the silkscreen, and the outline telling the fab where to cut. Alongside it rides a drill file listing every hole's position and diameter, and a small job file naming your stackup and layer order.\n\nThe reason to untick the extras is not tidiness. The board house does not open your design; it reads your files and decides what each one is from the file itself. Hand a stranger a folder with an assembly drawing and a courtyard layer in it and you have handed them extra plausible-looking layers to guess about. An automatic checker can misfile one as copper, somebody emails you a query, and your order sits still for two days. Nine files, nothing else, nothing to guess.",
  ),

  band("check", "Look at what the fab will build", "Verify. Open the Gerbers in a viewer before you upload, and read the labels."),
  trace(
    "The viewer pass, with this board's specifics",
    [
      { text: "The board is viewed from the **top** and the front silkscreen reads left to right", help: "A mirrored layer means an export setting is wrong, and every board would come back with reversed labels." },
      { text: "**J4's 3V3 / AIN / GND order and its 0 to 3.3 V note are legible**", help: "This header is the measurement interface. Its labels are a spec, and a hand with a probe is going to trust them." },
      { text: "The **ADC1 note at the GPIO1 breakout** is present and readable", help: "The rule the board exists to teach should survive on the copper, not only in the guide." },
      { text: "The **antenna keep-out is empty on every copper layer**, checked one layer at a time", help: "Turn the layers on individually. An inner plane flooding the antenna is invisible from a top view with everything on." },
      { text: "**Edge.Cuts is a single closed outline** with nothing stray on it", help: "A gap or a duplicate segment in the outline is a query email at best and a wrongly-cut board at worst." },
      { text: "Every pad has a **mask opening**, including RV1's three through-hole legs", help: "A missing opening is a pad you physically cannot solder, and it is invisible on the copper layer alone." },
    ],
  ),
  shot(
    "The Gerbers in a viewer: the literal board the fab builds, layer by layer.",
    "KiCad GerbView with the L1.05 set loaded, all layers on and colour-separated, board viewed from the top (not mirrored), silkscreen readable, layer list panel visible.",
  ),
  shot(
    "The silk that has to survive the export: J4's order and limit, read off the artwork.",
    "GerbView zoomed on the L1.05 analog cluster silkscreen: J4 labelled 3V3 / AIN / GND with the 0 to 3.3 V only note, legible at card width.",
  ),
  {
    type: "callout", severity: "info", label: "Compare against the reference",
    body: "Want to be sure your export came out right? Download the reference set and open it beside yours in the viewer: the same board, correctly exported. Anything that looks different is worth understanding before you spend money. It is also your safety net at ORDERING, since you can order the reference files instead of, or alongside, your own.",
  },
  { type: "action", action: "downloadReferenceFiles", label: "Download the reference gerbers" },
  gotcha(
    "the zone you refilled, then edited, then exported",
    "The plot comes from the last computed fill. Tick **Check zone fills before plotting** and it cannot ship stale copper, but the habit is still worth keeping: press **B**, look at the pour, then export. On this board a stale fill could mean a slot under the analog run that neither you nor DRC ever saw.",
  ),
  check(
    "**Your viewer shows the top silkscreen mirrored. Safe to send?** No. A mirrored layer means an export setting is wrong, and every board comes back with its labels reversed, including J4's pin order. Fix the export and recheck: the fab builds exactly these files, not your design intent.",
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
          "One zip containing every Gerber layer plus the drill files and the job file",
          "Just the front copper layer",
          "Your KiCad project file",
        ],
        answer: 0,
        explain: "The fab never sees your design file. It builds from the archive alone, so the zip has to hold the full set together.",
      },
      {
        id: "nine-layers",
        q: "How many Gerber layers does this four-layer board plot, and which are they?",
        options: [
          "Four, one per copper layer",
          "Nine: four copper, both solder masks, both silkscreens, and Edge.Cuts",
          "Twelve, one per file in the zip",
        ],
        answer: 1,
        explain: "Those nine are the board. The twelve files in the zip are those nine plus two drill files and the job file.",
      },
      {
        id: "silk-what", reviewId: "silk-what",
        q: "Which silkscreen on this board is worth a deliberate look in the viewer?",
        options: [
          "The board name font",
          "The layer count marking",
          "J4's 3V3 / AIN / GND order and its 0 to 3.3 V note: the labels a probing hand relies on",
        ],
        answer: 2,
        explain: "That header is the measurement interface. Its labels are a spec, and they are checked on the artwork like any other.",
      },
      {
        id: "refill-parity",
        q: "Why tick both 'Refill all zones' and 'Test for parity' on the final DRC?",
        options: [
          "They make the check run faster",
          "Fills go stale the moment you nudge anything, and parity catches a schematic edit you never pushed across with F8",
          "The fab requires both boxes to be ticked",
        ],
        answer: 1,
        explain: "Both catch the same class of mistake: something you changed after the last clean run and never propagated.",
      },
      {
        id: "viewer-before-order",
        q: "Why open the Gerbers in a viewer before ordering?",
        options: [
          "It is required by the fab",
          "To make the files smaller",
          "The fab builds exactly those files, so a viewer catches export mistakes while they are still free to fix",
        ],
        answer: 2,
        explain: "The viewer shows the actual board rather than your hopeful design intent. A mirrored layer or a missing mask opening costs nothing to fix here and a batch of boards later.",
      },
    ],
  },

  exit(
    "A clean final DRC against PCBWay's own rules, nine layers plus two drill files plus the job file zipped into one archive, and a viewer pass that read the labels rather than glancing at the shape. That zip is what you upload next stage.",
  ),

  ref("The Gerber Format Specification (Ucamco): the fab-ready files a DRC-clean board exports", "https://www.ucamco.com/en/gerber"),
  ref("KiCad 10 documentation: plotting, drill file generation and GerbView", "https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html"),
];

publishCard({ slug: "l1-05-internal-adc", stage: "DRC_GERBER", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
