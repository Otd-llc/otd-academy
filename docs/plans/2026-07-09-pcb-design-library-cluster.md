# Library cluster proposal: PCB Design & Fabrication

**Status: DRAFT for review (2026-07-09).** Nothing seeded. This is the lesson-by-lesson
blueprint for the third `/library` cluster, for the owner to curate before full authoring.
Follows the Fundamentals pattern (answer-first prose, cited-per-claim, beginner-bar quiz,
KaTeX where real math, a diagram slot per lesson, `/tools` + course cross-links) and the
**generic-education disclosure rule** (textbook PCB engineering only; no coined moat, no
paid-build values, no recipe).

## Why this cluster next
Fundamentals teaches the *parts* and ends at "reading a schematic / datasheet." The academy's
actual promise is "design a real PCB on the ESP32-S3 in KiCad 10, from requirements to
fab-ready gerbers." This cluster is the **reference layer for that promise** — the bridge from
understanding a circuit to making a board. It is universal to every course and carries huge
search volume (KiCad, PCB layout, gerbers, stackup, DFM). Cross-links: SUPPORTING up-links to
every L-track build; the `/tools` PCB trace-width calculator embeds inline.

**Cluster key:** `pcb-design` · **label:** "PCB Design & Fabrication" ·
**blurb:** "Turn a schematic into a real, fab-ready board: layout, routing, planes, and the files a factory needs."

**Overlap guard vs Fundamentals:** Fundamentals = the *concepts* (what a schematic / ground /
stackup IS). This cluster = the *doing* (creating the schematic in KiCad, pouring a ground on
a real layout, choosing a stackup for YOUR board). Each lesson cross-links its Fundamentals
prerequisite rather than repeating it.

---

## Lessons (12)

Each block below is: **thesis** (the answer-first opening) · **beats** (teaching points) ·
**cite** (sources to web-verify — flagged, NOT yet fetched, per the no-research rule) ·
**diagram** (the one figure) · **quiz** (checkpoint idea) · **links** (cross-links).

### 01 · From schematic to board — the layout workflow
- **thesis:** A finished schematic is only half a design; the other half is the physical board. The workflow is fixed: capture the schematic, assign a footprint to every part, import the netlist into the PCB editor, place, route, check, and export.
- **beats:** the two-file model (schematic + PCB share the netlist); annotation ties symbol → footprint → BOM line; the netlist is the contract; ERC before you leave the schematic; the PCB editor is a different tool with the same nets.
- **cite:** KiCad docs (schematic→PCB workflow, "update PCB from schematic").
- **diagram:** the pipeline as a horizontal flow (schematic → netlist → placement → routing → DRC → gerbers), gold arcs.
- **quiz:** what ties a schematic symbol to a physical footprint? (the reference designator / annotation)
- **links:** prereq Fundamentals "reading a schematic"; SUPPORTING → L1.01.

### 02 · Footprints & land patterns
- **thesis:** A footprint is the copper + hole pattern a real part solders to. Get it wrong and the part physically won't fit or won't connect. Choose the footprint that matches the part's package, and confirm it against the datasheet's recommended land pattern.
- **beats:** package vs footprint (0402/0603/SOT-23/QFN); pads, courtyard, silkscreen, the pin-1 marker; SMD vs through-hole; the datasheet "recommended land pattern"; IPC-7351 density levels; where footprint libraries come from.
- **cite:** IPC-7351 (land pattern standard); a manufacturer land-pattern example (e.g. the AP2112 SOT-23-5 datasheet, already used in Fundamentals).
- **diagram:** a labelled SMD land pattern (pads, courtyard, pin-1 dot) beside its real part.
- **quiz:** where do you confirm a part's correct land pattern? (its datasheet)
- **links:** prereq Fundamentals "reading a datasheet"; the parts library.

### 03 · Component placement
- **thesis:** Placement decides how easy routing is and how well the board works. Place with intent: connectors at the edges, the decoupling cap right at each chip's power pin, related parts grouped, and heat given room.
- **beats:** connectors/mechanical first; group by function (power, MCU, analog); decoupling caps touching the pins they serve (why: loop inductance); keep noisy + sensitive apart; thermal spacing; leave room for routing; the "rat's nest" as a placement guide.
- **cite:** an established layout-guidelines source (e.g. Altium / TI layout guidelines).
- **diagram:** a before/after placement (scattered vs grouped-with-decoupling), gold callouts.
- **quiz:** where does a decoupling cap go? (as close as possible to the chip's power pin)
- **links:** prereq Fundamentals "capacitors and decoupling".

### 04 · Routing traces — width, current, and vias
- **thesis:** A trace is a wire in copper; its width sets how much current it can carry without overheating, and a via moves a trace to another layer. Size power traces from the current, keep signal traces short, and change layers with vias only when you must.
- **beats:** trace width vs current (IPC-2221 external/internal); copper weight (1 oz); voltage-drop over a long trace; vias (through/blind/buried), via current; keeping high-speed/return paths tight; angles/width for manufacturability.
- **cite:** IPC-2221 (trace width/current); the KiCad routing docs.
- **diagram:** a trace-width-vs-current curve (reuse/adapt the tools calc visual) + a via cross-section.
- **quiz:** what mainly sets a power trace's width? (the current it carries)
- **links:** prereq Fundamentals "power and heat"; **embed `/tools` PCB trace-width calculator**; SUPPORTING → any build.

### 05 · Ground & power planes on a real layout
- **thesis:** On a real board, ground is a filled copper plane, not a trace. A plane gives every return current a low-inductance path right under its signal, which is what keeps a board quiet. Pour a ground plane, keep it whole, and stitch it with vias.
- **beats:** pour vs trace (return-path impedance, revisited on a real layout); keeping the plane unbroken (don't slice it with traces); stitching vias; power planes/pours; thermal reliefs on plane connections; the "one continuous return" rule.
- **cite:** All About Circuits return-paths article (already cited in Fundamentals) + a KiCad copper-pour how-to.
- **diagram:** a signal trace over a ground plane with the return current mirrored beneath it (adapt the Fundamentals grounds diagram to a layout view).
- **quiz:** why a poured plane over a thin ground trace? (a low-inductance return under the signal → less noise)
- **links:** prereq Fundamentals "grounds and power rails".

### 06 · PCB stackups — layers, materials, impedance
- **thesis:** The stackup is the sandwich of copper and insulator that makes up the board. Two layers is the cheap default; four or more sandwiches the signals against dedicated power/ground planes for a quieter board. The fabricator sets the exact thicknesses.
- **beats:** copper foil / prepreg / core; 2-layer (signal-ground) vs 4-layer (signal-ground-power-signal); FR-4; why tighter plane spacing lowers loop inductance; controlled impedance (intro, when it matters); the fab's stackup table.
- **cite:** Altium "4-layer stackup" + a fab-house (JLCPCB/Sierra) stackup page (already in the Fundamentals deep-dive).
- **diagram:** a 4-layer stackup cross-section (copper/prepreg/core labelled).
- **quiz:** what does a 4-layer board add over a 2-layer? (dedicated internal power + ground planes → lower-inductance returns)
- **links:** prereq Fundamentals "grounds and power rails" (the multi-layer deepDive).

### 07 · Design rules & DRC
- **thesis:** The design-rule check is the board's spell-check: it flags clearances, widths, and holes your chosen fab can't make. Set the rules to your fabricator's capabilities, and don't leave the layout until DRC is clean.
- **beats:** clearance / min trace / min hole / annular ring; matching rules to the fab's capability sheet; the DRC pass as a gate (ties to the course gate model); shorts/unconnected; courtyard overlaps.
- **cite:** KiCad DRC docs + a fab capability sheet (JLCPCB).
- **diagram:** a DRC error callout board (clearance violation, unrouted net, silk-over-pad) with gold/red markers.
- **quiz:** what should DRC be set to match? (your chosen fabricator's capabilities)
- **links:** ties to the course "DRC = 0 gate" model; SUPPORTING → every build.

### 08 · Silkscreen, soldermask & polarity marks
- **thesis:** Silkscreen and soldermask are the board's labels and protective coat. Good silkscreen (reference designators, pin-1 dots, polarity marks) is what makes a board buildable and debuggable; soldermask keeps solder where it belongs.
- **beats:** soldermask (what it does, mask-defined pads); silkscreen legend (refdes, values, pin-1, polarity for diodes/LEDs/electrolytics/connectors); keep silk off pads; a board title block / version; assembly-friendly marks.
- **cite:** a fab silkscreen/soldermask spec (JLCPCB) + IPC assembly marking guidance.
- **diagram:** an annotated board corner showing silkscreen refdes, pin-1 dot, polarity mark, mask opening.
- **quiz:** what does a pin-1 marker prevent? (installing a chip rotated / backwards)
- **links:** prereq Fundamentals "reading a schematic" (refdes).

### 09 · Gerbers & the fab package
- **thesis:** Gerbers are the universal language a factory reads to make your board — one file per copper/mask/silk layer, plus a drill file. Export the gerbers, the drill, the BOM, and the placement file, and you have the complete package a fab needs.
- **beats:** what a gerber is (per-layer vector); Gerber X2 vs RS-274X; the drill (Excellon) file; the fab package (gerbers + drill + BOM + centroid/pick-and-place); zip + naming; sanity-checking in a gerber viewer before you order.
- **cite:** the Gerber format (Ucamco spec) + KiCad "plot / fabrication outputs" docs.
- **diagram:** the fab package as a labelled file set (each gerber layer + drill + BOM), or a gerber-viewer preview.
- **quiz:** what file tells the fab where the holes go? (the drill file)
- **links:** ties to the KiCad-export feature; SUPPORTING → every build.

### 10 · DFM & ordering a board
- **thesis:** Design-for-manufacturing is designing a board the factory can actually build cheaply and reliably. Respect the fab's minimums, choose sane options, and read the cost drivers before you order.
- **beats:** DFM basics (min trace/space/hole/annular ring, board size, layer count); cost drivers (layers, size, quantity, finish, lead time); panelization (intro); ENIG vs HASL finish; ordering flow (upload gerbers → review → order); the DFM report a fab returns.
- **cite:** a fab DFM/ordering guide (JLCPCB/PCBWay) — pairs with the affiliate vendor CTAs.
- **diagram:** a cost-driver bar/readout (layers, size, qty, finish) or a DFM checklist.
- **quiz:** which most drives PCB cost? (layer count + size + quantity)
- **links:** the affiliate vendor CTAs (PCBWay/Newark); SUPPORTING → every build.

### 11 · Soldering & assembly basics
- **thesis:** A designed board is bare copper until parts are on it. Assembly is either hand-soldering (iron + solder, fine for through-hole and larger SMD) or reflow (solder paste + heat, for dense SMD). Know which your board needs before you order parts.
- **beats:** through-hole vs SMD assembly; hand-soldering (iron, flux, wick); reflow (paste, stencil, hotplate/oven, the reflow profile); tools (iron, hot-air, microscope); common defects (bridges, tombstoning, cold joints).
- **cite:** a soldering/reflow reference (Sparkfun/Adafruit soldering guide + a reflow-profile source).
- **diagram:** a reflow temperature profile (preheat → soak → reflow → cool), gold curve.
- **quiz:** what's reflow best for? (dense surface-mount assembly)
- **links:** ties to the bench-tools track; SUPPORTING → every build.

### 12 · Board bring-up — first power
- **thesis:** Never trust a fresh board on the first plug. Bring-up is a fixed cold-check-then-power sequence that catches a solder bridge before it kills your board or your laptop's USB port.
- **beats:** visual inspection; the cold continuity check (GND↔5V, GND↔3.3V, 5V↔3.3V shorts); polarity/orientation; current-limited first power; confirm the rails before trusting anything downstream; a simple bring-up checklist. (Extends the Fundamentals datasheet-lesson bring-up callout into a full lesson.)
- **cite:** procedure (no strong single source) + a hobbyist bring-up reference.
- **diagram:** the 3-pass bring-up as an ordered checklist / flow.
- **quiz:** what's the first thing you do to a fresh board? (a cold continuity check for shorts, before power)
- **links:** prereq Fundamentals "reading a datasheet" (bring-up callout); SUPPORTING → L1.01.

---

## Sequencing note
01–02 (workflow, footprints) and 12 (bring-up) are the true-beginner entry/exit; 06 (stackups)
and 04 (routing math) are the deepest. Keep the beginner main line clean; push the depth
(controlled impedance, blind/buried vias, panelization) into `deepDive` asides like Fundamentals.

## Open decisions for the owner
1. **This cluster next, or a different one?** (Comms / Power / MCU are the alternatives.)
2. **12 lessons, or trim?** (11 "assembly" + 12 "bring-up" could fold into one; or drop to a
   tighter 10.)
3. **Diagrams:** 12 new `pcb-*` diagrams (same sandbox-per-diagram rhythm as the others) — big,
   multi-session. Approve the cluster + lesson list first; diagrams come after authoring.
4. **Citations:** every "cite" above is a TARGET, not fetched (no-research rule). On your go I
   pull them (or hand the list to Gemini).

## Next step after approval
Author the 12 lessons into `scripts/seed-<pcb-design>-cluster.ts` (Fundamentals pattern:
`--check` mode, KaTeX, em-dash scan, PDF-glyph scan, answer-spread), register the cluster +
chrome, then seed PROD (gated on your explicit go, after the render code is live).
