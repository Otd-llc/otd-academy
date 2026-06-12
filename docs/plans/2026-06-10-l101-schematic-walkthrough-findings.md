# L1.01 SCHEMATIC — Live-Walkthrough Findings & Correction Tally

_2026-06-10. Captured from a live KiCad walkthrough: Claude guided Josh net-by-net through
wiring the L1.01 (ESP32-S3 WROOM Breakout) starter, using the SCHEMATIC guide card as the
script. The walkthrough doubles as a real-time audit of the card and produces the long-requested
reference schematic PNG (#3). This doc exists so the accumulated findings survive a context
loss — it is the recovery artifact for that session._

**Companion docs:** platform/design layer is `2026-06-09-reference-cad-and-schematic-verification-design.md`;
starter-symbol ground truth is the `l101-kicad-starter-symbols` memory.
**Target file for all fixes:** `scripts/rewrite-wroom-guide.ts`, the `SCHEMATIC` card (≈ lines 357–796).
Verify edits by **loading the live page**, not just the DB write (the card renders `[]`/blank on any
schema failure). Ship via branch → PR → merge on green `build | pass`.

---

## 0. Status of the walkthrough

Wired and confirmed correct, block by block (Josh driving real KiCad 10):
- **Block 1** power in: VBUS → F1 → +5V; U2 VIN+EN tied together → +5V; VOUT → +3V3; GND symbols; C5/C6 across the right rails.
- **Block 2** decoupling + boot/reset: C1/C2/C3/C7 across +3V3↔GND; R1+SW1 on EN; R2+SW2 on IO0.
- **Block — USB data:** USB_D+ = J1 DP1/DP2 · D1 I/O1 (pins 1,6) · U1 IO20. USB_D− = J1 DN1/DN2 · D1 I/O2 (pins 3,4) · U1 IO19. D1 pin5 VBUS → +5V, pin2 GND → GND.
- **Back nine:** CC (R3/CC1→GND, R4/CC2→GND, kept separate) · SBU1/SBU2 no-connect · TP1→+3V3, TP2→GND · LED1: +3V3→R5→LED1→GND · LED2: IO2→R6→LED2→GND (both bars to GND).
- **Headers:** J2 + J3 fully wired to the canonical table below (44 positions).

**ACTUAL STATUS at the crash (recovered from transcript tail — see §6):**
- ✅ **ERC is GREEN** — the board passed clean (95 → 26 → 0 violations). Milestone hit: the guide
  takes a true beginner from zero to a clean, ERC-passing ESP32-S3 USB-C breakout.
- ✅ **Sheet composed** to the reference-layout convention (J1 left / U1 center / J2·J3 right edges;
  regulator + decoupling islands tightened; D1 at the port). Render-ready.
- ✅ **The reference SVG is EXPORTED** (`foundry-l1-01-wroom-breakout.svg`, 2026-06-10, A3 light
  theme, drawing sheet unplotted). Verified against the SVG net labels: USB diff pair uncrossed
  (DP1/DP2→USB_D+, DN1/DN2→USB_D−, D1 I/O1→USB_D+/I/O2→USB_D−, U1 IO20→USB_D+/IO19→USB_D−); both LEDs
  have series R (R5/R6); 3 PWR_FLAGs on the rails. #3 deliverable complete.

**Remaining steps to finish the deliverable:**
1. **Export the reference image** — `File ▸ Plot…` (NOT `Export`; KiCad has no native schematic
   PNG). Format **SVG**; **uncheck "Plot drawing sheet"**; **Color**; a **light theme** (e.g. KiCad
   Classic); **check "Plot background color"** (else transparent bg → dark traces vanish on the dark
   guide page); Plot Current Page. (Full settings in §6.9.)
2. Wire that SVG into the SCHEMATIC card as an `image` block (the #3 deliverable).
3. Ship the corrections + additions below (§2, §3, §6) to the guide (branch → PR).
4. **Export-generator PR** (separate, benefits all 22 projects): (a) emit `(pin_names (hide no))` so
   LED A/K + D1 I/O names show; (b) **suppress the "symbol doesn't match library" ERC warning at the
   source** (set that check's severity to Ignore in the generated project, or match embedded symbols)
   so students get a clean ERC without running Update-Symbols; (c) fix the stale `foundry-l1-01-…`
   title-block name in the generator.

---

## 1. Ground-truth resolutions (read live off the real symbols — authoritative)

These override anything the student-sim rounds or the older memory claimed.

### 1.1 EPAD — THERE IS NO EPAD PIN  ⟵ corrects a real bug
U1 (ESP32-S3-WROOM-1) shows **one visible GND pin (pin 1)**; the numbered pins run **1–39**.
The thermal pad is **pin 40 + pins 41_1…41_9**, every one **named `GND`** and flagged **hidden
`Power input`**. In KiCad a **hidden power-input pin auto-connects to the global net matching its
name** — so all those pad pins wire themselves to `GND` the instant U1 is placed, invisibly.
You wire only the **one visible GND (pin 1)**; the thermal pad grounds itself.

- The card's "wire the pin named EPAD" is **wrong twice**: there is no EPAD to hunt for, and the
  pad isn't something you wire — it auto-grounds.
- Sim verdicts: **Maya/Devon correct** (GND, 41_x); **Priya wrong** (claimed "EPAD pin 41").
- **Teaching pivot (better than the original):** "U1's grounds are one visible GND pin (wire it)
  plus a stack of hidden GND pins for the thermal pad. KiCad auto-connects hidden power pins, so
  the pad is grounded for you — but turn on **View ▸ Show Hidden Pins** and run **ERC** to confirm
  it, because trusting an invisible connection is how a board ships with a floating ground."
- **Thermal-pad + thermal-vias** material moves to the **LAYOUT** card (where the pad is actually
  soldered/via'd) — it is not a SCHEMATIC concern.
- **Decision (Josh):** KEEP the hidden pins as-is for lesson 1 (forcing 11 GND wires is pure
  friction) and turn the discovery into the "library part is a draft" teaching moment (#10 below).
  Modern best practice favors visible/explicitly-wired grounds — note that as a deep-dive, don't
  refactor the symbol.

### 1.2 D1 (USBLC6-2SC6) number → signal map  ⟵ resolves the missing map
Read straight off D1's pin table (names are hidden on the symbol — wired from the table, which is
itself the "verify the part" lesson happening for real):

| D1 pin | Name | Wire to |
|---|---|---|
| 1, 6 | I/O1 | USB_D+ |
| 3, 4 | I/O2 | USB_D− |
| 2 | GND | GND |
| 5 | VBUS | +5V |

Each I/O line lands on two pins (same internal node — route-through). The array is symmetric, so
**I/O1 = D+ is a free choice** (we used I/O1 = D+, I/O2 = D−).

### 1.3 J1 (USB4110-GF-A) USB-C connector
- Data pins read **`DP1`/`DN1`/`DP2`/`DN2`** (NOT `D+`/`D−`), doubled for reversibility:
  DP1+DP2 → USB_D+, DN1+DN2 → USB_D−.
- **`VBUS` and `GND` are pre-merged single pins** on this symbol — the card's "tie the repeated
  VBUS/GND contacts each into one net" is wrong; there are no repeats to tie.
  _(Confirm against J1's pin table on the next pass — we re-read U1 and D1 tables live; the J1
  VBUS/GND merge is asserted from the sim findings + reality-box audit, not re-screenshotted.)_
- **CC1/CC2 stay separate** → R3/R4 (the two Rd's). **SBU1/SBU2** → no-connect flags.

### 1.4 Canonical J2/J3 header table  ⟵ the #1 ask across all 4 sim rounds
**Decision: mirror the module 1:1 (DevKitC-style)** — header pin N = module pin N, every pin
broken out. J2 = module pins 1–22; J3 = module pins 23–40, then the last four J3 positions add
breadboard power. Power placement follows convention (pair each rail with an adjacent GND, keep
grounds distributed — Raspberry-Pi/Electric-Imp practice; no single universal standard exists).

| J2 | sig | | J3 | sig |
|---|---|---|---|---|
| 1 | GND (power sym) | | 1 | IO21 |
| 2 | +3V3 (power sym) | | 2 | IO47 |
| 3 | EN ⚠ | | 3 | IO48 |
| 4 | IO4 | | 4 | IO45 |
| 5 | IO5 | | 5 | IO0 ⚠ |
| 6 | IO6 | | 6 | IO35 |
| 7 | IO7 | | 7 | IO36 |
| 8 | IO15 | | 8 | IO37 |
| 9 | IO16 | | 9 | IO38 |
| 10 | IO17 | | 10 | IO39 |
| 11 | IO18 | | 11 | IO40 |
| 12 | IO8 | | 12 | IO41 |
| 13 | USB_D− ⚠ (IO19) | | 13 | IO42 |
| 14 | USB_D+ ⚠ (IO20) | | 14 | RXD0 |
| 15 | IO3 | | 15 | TXD0 |
| 16 | IO46 | | 16 | IO2 ⚠ |
| 17 | IO9 | | 17 | IO1 |
| 18 | IO10 | | 18 | GND (power sym) |
| 19 | IO11 | | 19 | +5V (power sym) |
| 20 | IO12 | | 20 | GND (power sym) |
| 21 | IO13 | | 21 | +3V3 (power sym) |
| 22 | IO14 | | 22 | GND (power sym) |

⚠ = already on a named net; reuse the existing name, don't invent a new one:
- **J2.13 = USB_D−, J2.14 = USB_D+** (IO19/IO20 are already the USB nets — don't also label them IO19/IO20 or you get conflicting-label warnings).
- **J2.3 EN, J3.5 IO0, J3.16 IO2** already have local circuits (buttons / the LED) — add the net label with that name to the existing node, then the same on the header pin.

**Wiring mechanics:** power positions → power symbols (auto-join the rail); GPIO positions → net
label matching the module's pin name (label module pin + header pin the same → they join). ~40
labels, pure transcription. (Open: the current card's loose "3V3 on J2.1, GND on J2.2, IO1→pin3…"
example at ~line 679 conflicts with this mirror-1:1 table and should be replaced by it.)

---

## 2. Corrections (bugs in the current card)

| # | Bug | Where (current card) | Fix |
|---|---|---|---|
| 1 | No crisp power-symbol-vs-net-label **decision rule**; VBUS falls in the gap | reality/draw-it prose (~714, 730) | State the rule: **rail** (power/ground net many parts tap — VBUS, +5V, +3V3, GND) → **power symbol (P)**; **signal** between a few pins → **net label (L)**. Test: "rail many things share, or a signal between a few pins?" |
| 2 | "tie the repeated VBUS/GND contacts each into one net" — they're **pre-merged single pins** | reality box prose (~699) | Drop the "repeated contacts" language; VBUS/GND are single pins on J1. |
| 3 | "wire the pin named EPAD" / "GND and EPAD pins" — **no EPAD exists** | reality box (~699) + worked-net step (~744) | Kill all EPAD refs; teach hidden-GND auto-connect + Show Hidden Pins/ERC verify (§1.1). |
| 4 | No D1 number→signal map | section 06 / 07 | Add the §1.2 table. |
| 5 | VBUS(raw, **pre-fuse**) vs +5V(protected, **post-fuse**) split never named | power-in prose / table (~645) | Name the two nets across F1: connector side = `VBUS` (raw), regulator side = `+5V` (protected). |
| 6 | "F1 pin 1" implies polarity; student can't ID pin 1 (symbol shows no numbers) | walkthrough verbal step | **F1 is a symmetric 2-pin polyfuse — no polarity.** Either leg to VBUS, the other to +5V; stop looking for "pin 1." (Mechanically: hover a pin / enable pin numbers if curious.) |

---

## 3. Additions (the missing craft layer — KiCad *drawing* skills the card is thin on)

| # | Addition | Content |
|---|---|---|
| 7 | Working habits | Drag a part to empty space, wire its sub-circuit there, then move the finished **island** into place (beats fighting cramped auto-placement). **Ctrl+F** → type a refdes (U2, J1) → KiCad jumps/centers. It's fine to **tie pins directly** (U2 VIN+EN) instead of a power symbol on each — same net, less clutter; bless it so rule-followers don't over-symbol. |
| 8 | GND/rails ARE power symbols (say it plainly) | GND is a **power symbol**, not a label — and it's the odd one out visually (the **down-triangle**). "Ground" feels like a label until you learn it's a global power net like the rails. |
| 9 | House-style / layout standards | Consistent refdes+value placement (don't overlap symbol/pins/wires), power in at top, GND down, signal left→right, sub-circuits as tidy islands, net labels horizontal. Strongest invariants = **consistency + no overlap + readable**; exact designator placement is convention not law → **anchor to a recognized style reference** before asserting "the standard." |
| 10 | **"A library part is a draft, not gospel"** (deep-dive) | Even a "verified" SnapEDA symbol can hide pins (U1's GND 41_x — the live example), mis-name them, or ship a footprint built for a process/variant that isn't yours; a reflow footprint may need fattening for hand-soldering. Rule: treat every library part as a draft — verify against the datasheet, be ready to fix/work around it. Anchor to the hidden-GND moment + the Show-Hidden-Pins/ERC verify habit. **This is the keystone teaching beat (Josh: more valuable than the original plan).** |
| 11 | Keep refdes visible | Declutter by **moving/rotating refdes+value into open space** and **spacing parts**, never by hiding identity — the BOM, layout, pick-and-place, and future-you all key off the refdes. Exception: power symbols' `#PWR…` refdes is hidden by default (standard). Doubles as a "why refdes matters" beat. |
| 12 | Scattered decouplers are fine on a schematic | Caps connected only through +3V3/GND power symbols (no wire to U1) are **fully connected** — same-named symbol = same net. "Keep decouplers close to the pin" is a **PCB-layout** concern enforced later; on the schematic, right-net is all that matters, tidy placement is for readability. Say it so nobody thinks scattered caps are "wrong." |
| 13 | Name diff pairs to unlock layout tools | Name USB nets **`USB_D+` / `USB_D−`** — KiCad recognizes a diff pair from a shared base name + paired suffix (`+/-` **or** `_P/_N`, don't mix). That schematic-side naming is the **declaration** that unlocks the **diff-pair router** + length/skew tuning over in the PCB editor. Cross-stage thread: plant in SCHEMATIC, pay off in LAYOUT (USB is a 90 Ω pair wanting matched, length-tuned traces). Verified KiCad 10 behavior. |
| 14 | Insert = Repeat Last Item (fast header labeling) | **Insert** repeats the last wire/label at the same grid step and **auto-increments a trailing number** (IO4→IO5→IO6…). Step size: Preferences ▸ Schematic Editor ▸ Editing ▸ "Repeated item increment" (+1). Caveat: our table is in module-pin order which **jumps** (…IO7 then IO15) — sprint each sequential run, hand-place the seams. **No Insert key (e.g. HP Spectre):** use the on-screen keyboard or remap Insert via Windows **PowerToys** (Mac = Fn+Enter). |
| 15 | Hop-over crossings (KiCad 10) | Enable via **Schematic Setup ▸ Formatting ▸ Hop-over size** (None → a size). Non-connected wire crossings then render as **arcs** instead of plain crossings — clearer layout, esp. the dense power/ground area around J1. New in KiCad 10. |

---

## 4. The "ERC can't catch it" thread (why the reference PNG matters)

Three silent-failure classes on this board — all pass ERC, all functionally broken — make the
case that the **reference schematic image is the real safety net**, not the rules check:
1. **Crossed D+/D−** — board looks perfectly wired, passes ERC, just won't enumerate over USB.
2. **Backwards LED** — bar must go to GND; reversed = dark board, clean ERC.
3. **LED with no series resistor** — forward LED straight across the rail ("a short with extra
   steps"); every pin connected, no power-pin error, but it cooks in service. (Caught live: LED1
   was briefly missing R5.)

Teach this trio as a set; it's the cleanest argument for shipping the reference image.

---

## 5. The three-vocabularies hazard (USB data net)

The same two wires wear **three names**: `D+`/`D−` (lesson) = `DP`/`DN` (J1) = `I/O1`/`I/O2` (D1).
Hold the map: DP→D+, DN→D−, I/O1→D+, I/O2→D−. This is the exact connection the reference image
exists to let a student check against.

---

## 6. RECOVERED — the walkthrough tail past hop-over (ERC → compose → export)

_This section was lost from the first recovery pass (the context summary cut off at the hop-over
search). Reconstructed directly from transcript `4cdf3c3c…jsonl` lines L2083–L2216. It contains four
new corrections, a teaching philosophy, a platform-side fix, the composition spec, and the export
correction — the most valuable material in the whole walkthrough._

### 6.1 The ERC triage (95 violations → 4 root causes) — itself good guide content
First ERC run threw **95 violations**; they were only four things:
1. **34 errors + 28 warnings, one cause:** header pins were labeled but the **module** pins weren't,
   so every `IO` net had only *one* end → *"Pin not connected"* (module side) + *"Label connected to
   only one pin"* (header side). **Fix:** net-label each **module** GPIO pin to match its header.
2. **3 power errors** *"Input power pin not driven"* on `VBUS`, `+5V`, `GND` → one **`PWR_FLAG`** per rail.
3. **~30 "Symbol doesn't match copy in library" warnings — BENIGN:** the starter embeds a cached copy
   of each symbol; ERC compares it to the student's *installed* library version. Harmless. Ignore, or
   `Tools ▸ Update Symbols from Library`. (Fixed at the source on our end — see §6.7.)
Result after fixes: 95 → 26 → **0**. Teaching this triage (what the 95 mean, which to ignore) belongs
in the guide — it's the difference between a student panicking and a student reading ERC.

### 6.2 Correction #7 — "POWER THE MODULE" (the worst implicit gap)
The block-by-block walkthrough **never explicitly said to connect U1's `3V3` pin (pin 2) to the
`+3V3` rail** — it lived only in the worked-net example, not restated in the wiring blocks. This is
the single connection that powers the chip: a student marching the blocks literally could build a
board where **the regulator runs and the MCU is dead**. (Verified harmless on our sheet only because
ERC showed pin 2 connected + `+3V3` driven by U2's VOUT.) **Fix:** add an explicit wiring step —
"**Power the module: U1 `3V3` → the `+3V3` rail**" (U1 pin 1 = GND, pin 2 = 3V3 on the WROOM).

### 6.3 Correction #8 — label BOTH ends, including the three circuit-nodes
Every GPIO net needs a label on **both** the header pin **and** the module pin. Beyond the plain
GPIOs, the three nodes that already had circuits — **`EN` (J2.3), `IO0` (J3.5), `IO2` (J3.16)** — were
labeled on the **header** side only; their **U1-side** wasn't, so ERC flagged each *"connected to only
one pin."* **Fix:** the wiring step must say to net-label the **U1 side** of `EN`/`IO0`/`IO2` too, not
just the plain GPIOs.

### 6.4 Teaching philosophy (keystone) — you can't instruction your way out of a slip
The "label both ends" instruction **was present and correct**, and a careful builder *still* half-did
it (labeled one whole side, dropped the other) — because that's how humans handle long two-sided
tasks. The durable lesson is **not** "instruct harder / bold the word BOTH." It is:
> **You can't instruction your way out of every slip — design the safety net and teach the student to
> read it.** Pair each error-prone instruction with its ERC *tell*: "label both ends — and if you miss
> one, ERC says *'label connected to only one pin.'* That message **is** your check."
This reframes the whole card: ERC isn't a hoop, it's the safety net the lesson teaches you to read.

### 6.5 Correction #9 — `PWR_FLAG` ≠ `GNDPWR`
Students confuse the two and may drop a **`GNDPWR`** power symbol on J1's `GND`. Clarify: clear
*"input power pin not driven"* with a **`PWR_FLAG`** on each rail (`VBUS`/`+5V`/`+3V3`/`GND`) — that
flag just tells ERC "real power enters here." J1's ground uses a normal **`GND`** symbol; the ground
*rail* carries one `PWR_FLAG`. `GNDPWR` is a different (stacked-ground) symbol and is **not** what you
want here.

### 6.6 Correction #10 — the export path (the step the crash interrupted)
The instruction "`File ▸ Export ▸ Schematic as… → PNG`" is **wrong for KiCad 10** (and KiCad
generally). The schematic image export is under **`File ▸ Plot…`**, not `Export` (Export = netlists /
drawing sheets). KiCad 10 Plot formats: **PDF, SVG, PostScript, DXF — no native PNG** (HPGL dropped in
10). **Use SVG** (crisp vector, embeds cleanly in the guide's image block, stays sharp when a beginner
zooms into pin labels). Anywhere the guide tells a student to export the schematic image, it must say
**`File ▸ Plot… → SVG`**.

### 6.7 Platform fix — kill the symbol-mismatch warnings at the source
The *"symbol doesn't match copy in library"* check is a **configurable ERC severity** (added KiCad
5.99, default Warning). Don't make students run *Update Symbols from Library* — **set that check's
severity to Ignore in the project we generate** (or make the embedded symbols byte-match). Goes on the
**export-generator PR** alongside the pin-name un-hide and the `foundry-` title-block rename. One fix
retires ~23–30 warnings for every student on every project.

### 6.8 Addition #16 — composition / placement convention (for the reference image & the lesson)
Where to drag finished sub-circuit islands (user: "connectors on the edges"):
- **J1 → left edge** (USB/power *in*) · **U1 → center** (the hub) · **J2/J3 → right / outer edges**
  (breakout *out*).
- **Regulator island** (`U2`, `F1`, `C5`, `C6`) → upper-left, *between* J1 and U1, so power reads
  left→right (`J1 → F1 → U2 → +3V3`). Keep `C5` at VIN/+5V and `C6` at VOUT/+3V3 — **flanking U2**,
  not stranded.
- **D1 → tight against J1** (protection sits at the port).
- **Decouplers** (`C1`/`C2`/`C3`/`C7`) → **hugging U1 at its `3V3` pin** (makes the "bypass caps at
  the power pin" lesson visual).
- **Boot/reset** (`R1`/`R2`/`SW1`/`SW2`) → left of U1, by its `EN`/`IO0`. CC resistors at J1's CC;
  test points + LEDs grouped near what they touch.
- Rails (`+5V`/`+3V3`/`VBUS`) point **up**; `GND` points **down**. Use drag-to-empty-space + `Ctrl+F`
  to navigate; don't chase perfection — edges/center/edges, tidy islands, top-to-bottom power.

### 6.9 The Plot dialog settings (to finish the export now)
`File ▸ Plot…` → Output dir (anywhere findable) · **Format: SVG** · **UNCHECK "Plot drawing sheet"**
(tighter crop + drops the stale `foundry-l1-01-…` title block) · **Output mode: Color** · **Color
theme: a LIGHT one** (e.g. "KiCad Classic" — empty dropdown falls back to the editor theme, which is
dark) · **CHECK "Plot background color"** ⚠ (unchecked = transparent bg → dark traces vanish on the
dark guide page) · Min line width 0 · **Plot Current Page** (single sheet 1/1). Re-run ERC first if any
wire was nudged during placement.

### 6.10 Updated tally count
Corrections now **10** (was 6): + #7 power-the-module, #8 label-both-ends-incl-EN/IO0/IO2,
#9 PWR_FLAG≠GNDPWR, #10 Plot-not-Export/SVG-not-PNG. Additions now **17** (was 15): + #16 placement
convention, + #17 the "design the safety net, teach reading ERC" philosophy (§6.4). Plus the 3-item
export-generator PR (pin-name un-hide · symbol-mismatch severity · title-block rename).
