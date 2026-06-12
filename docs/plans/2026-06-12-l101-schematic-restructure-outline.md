# L1.01 SCHEMATIC — restructure outline (hybrid KiCad walkthrough)

**Status:** DRAFT for review — no DB changes yet. Once the shape is approved, this becomes the build plan.

## Goal
Turn the SCHEMATIC card from "understand the whole circuit (≈70 read blocks) → then a Draw-it phase" into **one continuous KiCad walkthrough** — from *open KiCad 10* to *export the ERC.rpt the gate wants* — with a short board map up front and **explicit learn/do delineation** so the student always knows when to have hands on the keyboard.

Three reasons this fits SCHEMATIC specifically: it's **transcription from a locked design** (not circuit design), the **part-choice "why" is already taught in BOM_SOURCING** (so re-explaining each part here is partly duplication we can cut), and it's **pure KiCad** (no hand-drawing) — so "open KiCad → … → export the .rpt" is the honest shape of the work, and de-duplicating with BOM should *shorten* the card.

## The delineation system (the core ask)
Every section carries one of three **mode cues** so "am I reading or doing?" is never ambiguous:

- **📖 ORIENT** — background/mental-model. Read only. (Just Part 0.)
- **▶ DO — IN KICAD** — hands on the keyboard now. Each carries a tight action checklist (a `steps` block) and, where useful, a clip.
- **✓ CHECK** — a self-test / "compare against the reference."

Baseline uses the renderer's **existing** role styling — "Draw it ·" callouts already render as a gold **Do ·** badge, "Check yourself" as a self-test, "NN ·" as a numbered section header — plus a one-time **"▶ From here, have KiCad open"** banner at the Part 0→1 boundary. *Optional enhancement (small renderer change):* a persistent mode ribbon at the top of each section (ORIENT / DO / CHECK) for a stronger, always-visible cue. **Decision needed:** baseline-only, or add the ribbon?

---

## Proposed structure

### Part 0 · 📖 ORIENT — meet the board (READ, kept short)
The only pure-read section: the mental map so they build toward a known destination.
- The board as **six small problems**, power flowing left→right (condensed from today's intro).
- **`wroom-power-flow.svg`** (existing, filled) — the one diagram that frames the whole stage.
- Refdes primer (U/C/R/J… ties symbol ↔ BOM line ↔ board).
- *Cut/condense:* today's full per-sub-circuit conceptual teaching moves **into** Part 2 (inline with wiring), and the part-choice rationale is referenced to BOM rather than re-taught.

### Part 1 · ▶ DO — get into KiCad
- **Download the starter** (existing `action` block).
- **Clip 1 — open the project + schematic editor** (existing empty slot, you're re-recording).
- **"What your symbols look like"** table (existing) — the starter quirks (U2 drawn as AP2112K, J1's DP/DN pins, hidden GND pins, LED A/K) — needed *before* wiring.
- **Place by convention** + **`schematic-conventions.svg`** (existing, now labeled `IC`) — the four habits, applied as they place.
- **KiCad keys** quick-reference table (A/P/W/L/M/R/Q…) — they'll use it throughout.

### Part 2 · ▶ DO — build it, island by island
Walk each sub-circuit **in KiCad, in build order**. Each island = a tight loop:
**why (1–2 lines, BOM-referenced) → wire it (checklist + the sub-circuit `.svg` as the "check your wiring" reveal) → optional deepDive (the math) → ✓ check-yourself.**

| # | Island | Existing assets reused | Clip |
|---|---|---|---|
| 1 | **Regulator (U2)** — VIN/EN→+5V, VOUT→+3V3, C5/C6, GND, PWR_FLAG | `l1-01-sub-power.svg`; "wire the regulator with me" steps; LDO-dropout deepDive | **Clip 2** (existing slot — wire the U2 island) |
| 2 | **Decoupling (C1/C2/C3/C7)** at U1's 3V3 pins | `l1-01-sub-mcu.svg`; "why three small caps" deepDive | optional |
| 3 | **The chip (U1)** — 3V3, GND + hidden-pad pins (Show Hidden Pins) | (uses sub-mcu) | — |
| 4 | **Boot & reset (R1/R2/SW1/SW2)** — pull-ups, EN/IO0 | `l1-01-sub-bootreset.svg`; "why 10k / weak" deepDive | optional |
| 5 | **USB front-end (J1/D1/F1/R3/R4)** — CC sink 5.1k, IO19/IO20, diff-pair naming, ESD ahead of fuse | `l1-01-sub-usb.svg`; the CC/ESD deepDives; the "wire by name not number" + diff-pair-naming prose | **Clip 3 (NEW)** — the dense island; high value |
| 6 | **Indicator LEDs (R5/R6/LED1/LED2)** — series current-limit | `l1-01-sub-leds.svg`; Ohm's-law deepDive | optional |
| 7 | **Headers & test points (J2/J3)** — the 44-pin mirror + the ⚠ reused-net 5, TP1/TP2 | `l1-01-sub-headers.svg`, `l1-01-sub-test-points.svg`; the worked "first column" steps; jump-row warning | **Clip 4** (existing slot — Insert-key march) |
| 8 | **Grounds & no-connects** sweep — one GND net, Q on every open pin | — | — |

### Part 3 · ▶ DO / ✓ CHECK — verify & export (the gate)
- **Eyeball what ERC can't catch** (existing warn — VIN-on-+5V, LED polarity, D+/D− not swapped) → ✓.
- **`l1-01-schematic-reference.svg`** (existing answer-key) — compare your sheet.
- **Run ERC → work to zero** — PWR_FLAG on VBUS/+5V/GND, no-connects; the "ERC says…/you do" table + PWR_FLAG deepDive (all existing).
- **Clip 5 — open Inspect ▸ ERC, run to 0 errors, save the `.rpt` in the project folder** (existing slot, at the export step).
- **Export & upload** steps → the `ERC_REPORT` artifact the gate checks. SourceRef (KiCad manual).

### Quiz (✓ CHECK) → Exit this stage (advance banner)
Keep the current quiz (incl. the Q8 header-trap, the hardened distractors) and the exit/advance callout.

---

## What this buys / costs
- **Solves the learn/do problem:** Part 0 is the only "read"; everything after is "do, here's why as you go," each with a checklist + (often) a clip.
- **Likely shorter, not longer:** merging each part's "why" into its wiring step removes the front-half/back-half duplication and the BOM overlap. Rough estimate: ~105 → ~85–95 blocks.
- **Near-zero content loss:** every filled SVG, every worked-example step set, every deepDive, the quiz, and the gate are **reused** — this is a reorder/merge, not a rewrite-from-scratch.
- **Risk:** it restructures the stage all three panels rated strongest. Mitigation: build it in a scratch script, dump + diff against the current 105 blocks, and verify all 8 cards still safeParse before it replaces anything.

## Open decisions for you
1. **Mode cue:** baseline (existing role styling + the one "have KiCad open" banner) or add the persistent **ORIENT/DO/CHECK ribbon** (small renderer change)?
2. **Clip density:** I've marked 5 slots (1 open, 2 regulator, 3 USB-front-end NEW, 4 headers, 5 ERC) + "optional" per-island. How many do you intend to actually shoot? (Slots are free — empty = admin-only — so we can stake out more.)
3. **Generalize?** This "ORIENT → DO-in-tool, with mode cues" model maps onto LAYOUT (KiCad), ASSEMBLY/BRINGUP (bench), ORDERING (browser). Apply the same delineation system lesson-wide, or pilot it on SCHEMATIC first?
4. Keep Part 0's six-problems framing, or trim it even further to just the power-flow diagram + a one-paragraph map?

## Next step
On your answers, I'll write the full block-by-block rewrite as a validated, transactional patch (scratch-build → dump/diff → safeParse all 8 → apply), same as the prior content patches. **Nothing touches the DB until you've seen that diff.**
