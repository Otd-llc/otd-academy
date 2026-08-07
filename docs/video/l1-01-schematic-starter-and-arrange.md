# L1.01 · SCHEMATIC · "Download the starter and arrange the parts"

YouTube task video for **L1.01 ESP32-S3 WROOM Breakout**, SCHEMATIC stage.
Covers the run of lesson blocks between the stage roadmap and the first wiring
island: get KiCad 10 + the starter open, then block the sheet out.

| | |
|---|---|
| Lesson | `l1-01-wroom-breakout` rev `v1`, `SCHEMATIC` card |
| Slot | new `youtube` block, inserted after the KLC `sourceRef` (currently block `[18]`), before the "Mode · do · Build it, island by island" callout |
| Source blocks | `[8]`–`[18]` of the SCHEMATIC card |
| Target runtime | 7:00–7:30 |
| Screen | KiCad 10, 1920×1080, dark theme, UI scale up one notch so menus are legible at 720p |

Narration uses the same `{TERM|pronunciation}` markup as the in-app teleprompter
scripts in `scripts/_l101-video-scripts.ts`: the brace pair marks a term whose
pronunciation is cued, the pipe half is never read aloud.

---

## Provenance

Every claim below already exists in shipped lesson copy or in the starter
generator. Nothing here asserts a new KiCad fact.

| Beat | Source |
|---|---|
| KiCad 10, install link | SCHEMATIC blocks `[9]`, `[10]` |
| Download button, account required | block `[11]`; `src/components/guide/GuideActionButton.tsx` PUBLIC-RESOURCE RULE |
| Zip contents, "unwired on purpose" | `buildReadme()` in [export.ts:545](src/lib/kicad/export.ts#L545) |
| Open `.kicad_pro`, then the sheet | retired narration script, `_l101-video-scripts.ts` ("opening the downloaded KiCad starter") |
| Hop over size | retired narration script ("Enabling hop-over wiring in KiCad 10") |
| U2 drawn as AP2112K, real part RT9080 | retired narration script ("wire the regulator"), block `[30]` table |
| Placement conventions | blocks `[12]`, `[13]`, `[17]` |
| The four arrange moves | `doSteps` block `[15]` "arrange the sub-circuits" |
| Keys A / P / W / L / R / M / G / X / Y / E / V / U / Q | block `[22]` table |
| Eight islands | block `[7]` table |

---

## Production notes

**Before you record**

1. Sign in to the academy on a clean browser profile. The download is
   account-gated, and the video should show the real signed-in flow.
2. Delete any existing `l1-01-wroom-breakout` folder from the recording
   directory so the unzip is genuinely first-run.
3. KiCad 10, fresh profile if possible, so no leftover panels or custom hotkeys
   contradict the on-screen key hints.
4. Explorer set to show file extensions. Half the beat at 1:30 is reading them.

**Must be visibly on screen**

- The lesson page with the "Download the KiCad starter" button, so the learner
  can match what they are looking at.
- The unzipped folder listing, long enough to read `README.md`,
  `EXPORT_REPORT.md`, `bom.csv`, and the three `kicad_*` files.
- `EXPORT_REPORT.md` open for at least three seconds.
- The unwired schematic at full extent before any part is moved. This is the
  "before" frame the whole video pays off.
- The final arrangement at full extent, held for four seconds on the outro.

**Do not**

- Do not speed-ramp the arranging. Cut it instead. A 4× drag reads as a
  different tool.
- Do not hide reference designators to tidy the sheet, on camera or off. The
  lesson explicitly forbids it and a viewer will copy what they see.
- Do not wire anything. Wiring is the next eight videos.

---

## Shot list

| # | Shot | Notes |
|---|---|---|
| 1 | Lesson page, SCHEMATIC card, scrolled to the Setup callout | Start scrolled, not at the top |
| 2 | kicad.org/download, version badge visible | Two seconds, cut away |
| 3 | Click "Download the KiCad starter", browser download lands | Show the filename |
| 4 | Unzip, folder opens, file listing | Slow scroll down the listing |
| 5 | `README.md` open, "UNWIRED on purpose" line highlighted | Selection highlight, no zoom effect |
| 6 | `EXPORT_REPORT.md` open, coverage table | Three seconds |
| 7 | Double-click `l1-01-wroom-breakout.kicad_pro`, project window | |
| 8 | Open the schematic sheet, full extent, unwired grid of parts | The "before" frame |
| 9 | File ▸ Schematic Setup ▸ Formatting ▸ Hop over size | Show the field, then a crossing rendering as an arc |
| 10 | Ctrl+F, type `U2`, Enter, part highlights | |
| 11 | Arrange pass A: USB front-end and regulator to the left | Real time, cut, no ramp |
| 12 | Arrange pass B: U1 to centre, decoupling, boot/reset | |
| 13 | Arrange pass C: LEDs, J2/J3 to the right edges, test points | |
| 14 | Refdes text nudged out from under a symbol | One example, close in |
| 15 | Final arrangement, full extent | Hold four seconds |

---

## Script

Read at a walking pace. Line breaks are breath points, not sentence ends.

### 0:00 · Cold open

> ON SCREEN: shot 8, the unwired grid of parts, then cut to shot 1.

```
This is what the {KiCad|KEE-cad} starter looks like the moment you open it.
Every part on the board, placed on a grid, and not one wire drawn.
That is on purpose. The wiring is the lesson.
In this video we get that file downloaded and open,
and then we block the whole sheet out
so it reads the way the circuit actually works.
No wiring yet. That starts in the next one.
```

### 0:20 · KiCad 10

> ON SCREEN: shot 2.

```
One thing first: these lessons run on {KiCad 10|KEE-cad ten}.
Every menu path and every shortcut you are about to see matches version 10.
If you have not installed it, the link is right under this video and in the lesson.
It is free, it is the official build, and it runs on Windows, macOS and Linux.
Already have it open? Skip ahead to the download.
```

### 0:50 · Download the starter

> ON SCREEN: shot 3.

```
Back in the lesson, there is a button that says Download the KiCad starter.
Click it.
You need to be signed in for this one. A free account is enough.
If you are signed out, the button walks you to sign-up and then hands you the file.
What lands is a zip named for the board: {l1-01-wroom-breakout|L-one-oh-one wroom breakout}.
```

### 1:30 · Unzip and read the room

> ON SCREEN: shots 4, 5, 6.

```
Unzip it somewhere you keep your projects, not in your Downloads folder.
You are going to be living in here for a few hours.
Open the folder and look at what you got.
Three {KiCad|KEE-cad} files: the project, the schematic, the board.
A libs folder holding this board's own symbols, footprints and 3D models,
so nothing here depends on a library you have not installed.
A {bom.csv|B-O-M dot C-S-V}, which is the parts list for this revision.
And two files worth reading before you touch anything.
{README|READ-me} tells you the one thing that surprises people:
every part is placed, fielded and footprint-assigned,
and the schematic is unwired on purpose.
{EXPORT_REPORT|export report} is the honest one.
It lists every part and where its symbol, its footprint and its 3D model came from:
bundled with the project, borrowed from KiCad's own libraries,
or generated as a stub that you would not want to ship.
Read it once now. It is the fastest way to know what you have been handed.
```

### 2:25 · Open the project

> ON SCREEN: shot 7.

```
The file you actually open is the one ending in dot {kicad_pro|KEE-cad pro}.
That is the project file.
It brings up KiCad's project window with every design file listed beside it.
Double-click the schematic sheet to open the Schematic Editor.
That is where you will spend this whole stage.
```

### 2:55 · The first look

> ON SCREEN: shot 8, held.

```
Zoom to fit and take it in.
Everything the parts list gave you, sitting on a grid, in no particular order.
That grid is not a suggestion about layout. It is just where the export dropped them.
One thing to spot before it throws you.
Find {U2|you-two}, the regulator.
The symbol is drawn as an {AP2112K|A-P twenty-one-twelve-K}.
The real part on this board is the {RT9080|R-T ninety-eighty}.
The symbol is the drawing, the part number on the {BOM|B-O-M} is the truth,
and the pins are the same either way, so nothing about your wiring changes.
```

### 3:35 · Hop over

> ON SCREEN: shot 9.

```
Before you move anything, one setting worth turning on.
Open File, Schematic Setup, then Formatting,
and set a Hop over size.
Here is what it buys you.
Anywhere two wires cross without connecting,
{KiCad|KEE-cad} now draws one of them as a small arc that hops over the other.
So a crossing can never be mistaken for a join.
That is a real readability win down near {J3|jay-three},
where the power and ground wires pile up and crossings are everywhere.
It is new in KiCad 10, and it costs you nothing to switch on now.
```

### 4:10 · How to move a part

> ON SCREEN: shot 10.

```
Four keys do almost all of this.
{Ctrl+F|control F} finds a part by its reference: type {U2|you-two}, press Enter,
and the editor jumps straight to it.
Hover a part and press {M|em} to move it. {R|arr} rotates.
{X|ex} and {Y|why} mirror it across those axes.
There is also {G|gee}, which drags a part and keeps its wires attached.
Nothing is wired yet, so today M is the one you want.
Two habits make the arranging painless.
Work by group, not by part: grab a whole sub-circuit and move it as one cluster.
And rough is fine here. You are setting reading order, not final placement.
Where parts physically sit gets decided in {LAYOUT|LAY-out}, in copper, later.
```

### 4:45 · Arrange, pass one: power comes in on the left

> ON SCREEN: shot 11.

```
The target is a sheet that reads like the circuit runs:
power in at the top, signal flowing left to right, breakout on the right.
Start where the power enters.
The {USB|U-S-B} front end goes to the far left:
{J1|jay-one} the connector, {F1|eff-one} the fuse, {D1|dee-one} the {ESD|E-S-D} array.
Keep D1 hard against J1. Its whole job is to catch a static zap at the door,
and the drawing should say so.
Then the regulator, just to its right and up:
{U2|you-two} with its two stability caps, {C5|see-five} and {C6|see-six}.
Now five volts flows in from the left and three-point-three leaves to the right.
```

### 5:25 · Arrange, pass two: the module in the middle

> ON SCREEN: shot 12.

```
{U1|you-one}, the module, goes in the centre. It is the hub everything else feeds.
Its decoupling caps, {C1|see-one}, {C2|see-two} and {C3|see-three},
sit right by its {3V3|three-volt-three} pin.
That is a drawing nicety, not a wiring rule.
A cap tied to matching {+3V3|plus-three-volt-three} and {GND|ground} ports
is already fully wired, wherever it sits.
Boot and reset go just to the left of U1, next to its {EN|E-N} and {IO0|eye-oh-zero} pins:
the two pull-ups {R1|arr-one} and {R2|arr-two},
the two buttons {SW1|switch-one} and {SW2|switch-two},
and {C7|see-seven}, the cap that holds EN steady while the rail comes up.
```

### 6:00 · Arrange, pass three: lights, headers, rails

> ON SCREEN: shot 13.

```
The two {LEDs|L-E-Ds} and their resistors go in a corner near U1.
The breakout headers, {J2|jay-two} and {J3|jay-three}, go out to the right edges.
That is the whole point of them: every pin brought to the board edge.
Test points anywhere open.
And two directions that matter more than they look:
power ports point up, grounds point down.
Every schematic you will ever read follows that, so yours should too.
```

### 6:35 · One finishing habit

> ON SCREEN: shot 14.

```
Last thing, and it is the only placement rule here that is genuinely a rule.
Keep each part's reference and value clear of the symbol, its pins and any wire.
When a label lands somewhere awkward, move it into open space.
Never tidy up by hiding a reference.
The {BOM|B-O-M}, the layout, and future-you all key off that little label.
Hide it and you have not cleaned the drawing, you have broken the thread
that ties the symbol to the part you ordered.
```

### 7:00 · Close

> ON SCREEN: shot 15, held four seconds.

```
That is the sheet blocked out:
power in at the left, the module in the middle, breakout on the right.
Eight islands, none of them wired.
Next video we wire the first one, the regulator, together, slowly,
because every island after it is the same handful of moves.
```

---

## YouTube metadata

**Title**

```
Download the KiCad Starter and Arrange the Parts | ESP32-S3 Breakout, Part 3
```

Alternates, if the series numbering shifts:
- `KiCad Schematic Setup: Open the Starter and Block Out the Sheet (ESP32-S3)`
- `Before You Wire Anything: Arranging a KiCad Schematic That Reads Right`

**Description**

```
Every part on the board, placed on a grid, and not one wire drawn. That is what
the KiCad starter for this board looks like when you open it, and it is on
purpose. In this video we download it, open it, and block the whole sheet out so
the drawing reads the way the circuit runs: power in at the left, the module in
the middle, breakout headers on the right.

No wiring in this one. That starts next video, with the regulator.

Runs on KiCad 10. Every menu path and shortcut shown matches version 10.

CHAPTERS
0:00 What the starter looks like
0:20 You need KiCad 10
0:50 Downloading the starter
1:30 What is inside the zip
2:25 Opening the project
2:55 First look: unwired on purpose
3:35 Turn on hop-over wiring
4:10 Ctrl+F, M, R, X and Y
4:45 USB front end and regulator, on the left
5:25 The module in the centre
6:00 LEDs, headers and test points
6:35 Never hide a reference designator
7:00 What is next

LINKS
Full lesson, free account: https://academy.onethousanddrones.com/learn/l1-01-wroom-breakout
KiCad, official download: https://www.kicad.org/download/
KiCad Library Conventions: https://klc.kicad.org/
KiCad 10 Schematic Editor manual: https://docs.kicad.org/10.0/en/eeschema/eeschema.html

The starter download is account-gated. A free account is enough.
```

**Tags**

`kicad`, `kicad 10`, `kicad tutorial`, `esp32`, `esp32-s3`, `pcb design`,
`schematic capture`, `esp32 breakout board`, `pcb for beginners`,
`electronics design`, `kicad schematic editor`

**Thumbnail**

Split frame. Left: the scattered grid of parts, desaturated. Right: the blocked
out sheet, full colour. One line of text across the middle, four words maximum,
in Bebas. No face, no arrows, no red circles.

**Card / end screen**

End screen points at the next video in the series (wire the regulator) and at
the lesson page. Do not put an end screen over the final held frame; add two
extra seconds of the arrangement instead.

---

## After upload

Fill the slot in the SCHEMATIC card. `scripts/_l101-add-arrange-video-slot.ts`
owns the block: set `VIDEO_ID` and `UPLOAD_DATE` at the top of the file and run
it. Dry by default, LOCAL by default, and idempotent, so the same command both
creates the empty slot and later fills it.

```powershell
pnpm exec tsx --env-file=.env.local scripts/_l101-add-arrange-video-slot.ts
pnpm exec tsx --env-file=.env.local scripts/_l101-add-arrange-video-slot.ts --write
```

Verified against local on 2026-08-01: the anchor resolves, the block lands at
`[19]` right after the KLC `sourceRef`, and the card revalidates at 121 blocks.

Then, and only then, the owner pushes to prod. Remember the Library cache does
not apply to guide cards, but a seed-script write still lands outside a request
context, so verify the rendered lesson page, not the database row.
