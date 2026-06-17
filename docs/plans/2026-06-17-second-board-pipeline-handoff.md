# Second board — pipeline validation handoff

**Date:** 2026-06-17
**Status:** Handoff / playbook (no code — a how-to for running the board-design pipeline)
**Context:** The board-design process run (Phase 0 + WS1–WS5) is code-complete and merged to
main. The whole pipeline has only ever been exercised by L1.01 WROOM — and that board was
*retrofitted* into the system, not driven through it cleanly from a blank page. This handoff
takes one board through the pipeline front-to-back to **validate the machine** and shake out
the rough edges before we invest in pedagogically-central or electrically-hard boards.

## TL;DR recommendation

**Do `l1-03-ws2812-node` (WS2812 Addressable-LED Driver) next, validation-first.**

It is the sweet spot: a **real curriculum board** (so the work isn't throwaway) that is also the
**easiest complete new PCB** to push through every stage:

- **Reuses the proven WROOM core.** The ESP32-S3 sub-circuit, USB-C, LDO, and USB-UART are all
  validated already in L1.01 — copy the block. The *new* design surface is tiny: a 3.3 V→5 V
  level shifter on the data line (e.g. 74AHCT125) + an LED-strip connector + decoupling.
- **No risk flags.** No mains, no Li-ion, no thermal-budget, no stripboard → the
  `DESIGN_VALIDATION` conditional blocks stay off, so you exercise the **6 core attestation
  items only** — exactly the base path we most need to validate.
- **Small BOM, simple 2-layer layout, a buildable board** → BOM import, freeze, layout, gerbers,
  order, assembly, and bring-up (→ `BROUGHT_UP`) all run for real, cheaply.
- **Exercises the DAG.** It depends on L1.01 (`FOUNDATION`/`SHARED_BLOCK`), so the dependency
  model gets used too.

**Alternatives & why not:**
- `l1-02-espnow-link` is numerically "second," but it's largely **firmware/RF on the existing
  WROOM board** — likely little new hardware, so it's a weak test of the BOM/layout/build/golden
  stages (the parts we most want to validate). Good board, wrong validation target.
- `l1-04-single-servo` is a fine second choice — nearly as simple, adds a servo power path.
- Anything L2/L3 (Li-ion, isolation, motor, thermal, EEG) deliberately later: those trip the
  conditional-safety paths and have real design risk — validate the machine *before* taking
  those on.

> **The goal here is to find where the pipeline is annoying, wrong, or missing a step — not to
> ship the world's most important board.** Keep a running "friction log" (a scratch section at
> the bottom of the board's `design.md`); each friction point becomes a follow-up issue. That
> log is the real deliverable of this exercise.

## The pipeline, mapped to this board

Each step says **what to do**, **where it lives**, and **what to watch**. The project row
(`l1-03-ws2812-node`) already exists in the DB (seeded with `publicTitle`/`tagline`/`accessTier`);
you're adding a revision and driving it through the stages.

### 0. Kick off the design doc (Phase 0)
- **Do:** `cp docs/boards/_template/design.md docs/boards/l1-03-ws2812-node/design.md`. Use
  `docs/boards/l1-01-wroom-breakout/design.md` (the WS2 worked example) as the reference for
  voice + depth.
- **Watch:** the design doc lives in the **repo**, not the DB (locked decision 1) — it's diffable
  and reviewed in a PR. There is no `DESIGN_DOC` artifact.

### 1. Fill the design doc + set flags (WS2)
- **Do:** Fill §1–§8 — topology, **IC selection rationale** (call out that the ESP32 core is a
  reused/validated block from L1.01; the only genuinely-new part is the level shifter), the
  **calc trail** (level-shifter logic thresholds, WS2812 data timing/Vih, decoupling), and the
  **risk register (§6)** — for WS2812 the textbook risks are the 3.3 V→5 V data-level margin and
  strip inrush/decoupling. Each registered risk needs one de-risk pass.
- **Flags:** on the project page (`/projects/l1-03-ws2812-node`), leave `hasMainsNet`,
  `hasLiIon`, `hasThermalConcern`, `requiresStripboard` **all false** — none apply. (This is the
  point: validate the no-flags base path.)
- **Where:** `docs/boards/l1-03-ws2812-node/design.md` + the project edit toggles.

### 2. Create a revision + materialize DESIGN_VALIDATION (WS1)
- **Do:** Create the first revision (it starts at `REQUIREMENTS`). On the revision detail page,
  use **"Generate DESIGN_VALIDATION checklist"** — it materializes the 6 core attestation items
  at the `BOM_SOURCING` stage (no conditional items, since no flags).
- **Do:** Work the 6 items honestly (calc trail · each IC datasheet-verified · footprint↔pinout ·
  fab-DRU DRC accounted-for · BOM availability · all top risks de-risked). These are
  **attestations, not machine proofs** — tick them as you actually do them.
- **Watch:** a revision with **no** `DESIGN_VALIDATION` checklist reads as not-board-ready in WS4
  — that checklist *is* the design-discipline signal.

### 3. Source + freeze the BOM (WS3)
- **Pre-req (the #1 gotcha):** BOM CSV import is **strict-match** on `(manufacturer, mpn)` against
  the **curated parts library** — unmatched rows are *reported, never auto-created*. So **create
  the new parts first** (the WROOM parts — ESP32-S3, AP2112K, USBLC6, the passives — already
  exist; the **WS2812 LED, the level shifter, and the connector are new** → add them via the
  CreatePart flow before importing).
- **Do:** In the revision's BOM editor, use the **Import CSV** panel. Canonical columns
  (header row required): `refDes, manufacturer, mpn, quantity, unitPrice, altMpn,
  altManufacturer, notes`. `unitPrice` is **dollars**; `refDes` is a comma/space list whose count
  **must equal** `quantity` (the DB CHECK aborts the tx otherwise — the parser guards it and
  reports per-row). Re-importing a corrected sheet is idempotent (upsert on
  `[revisionId, partId]`).
- **Do:** Check the **cost roll-up + lifecycle advisory** (admin BOM editor). Set `unitPriceCents`
  via the dollar input. Add a **second-source** (`altMpn`/`altManufacturer`) for at least one part
  to exercise that field.
- **Freeze:** advancing the stage **past `BOM_SOURCING` into `LAYOUT`** sets `bomFrozenAt` (there
  is no standalone freeze action — it's a side-effect of `advanceStage`). The advance control
  shows a **soft-confirm ack** when sourcing warnings exist. Freeze = "guide authoring may begin."

### 4. Check board-readiness (WS4, advisory)
- **Do:** On the revision detail page, read the **Board readiness** panel — it's `ready` when the
  4 required checks pass (DESIGN_VALIDATION complete · BOM frozen · BOM has parts · no EOL parts).
  Cost is info-only.
- **Watch:** it's **advisory-first** — when not ready, **Generate Guide** still works but requires
  an "I've reviewed board readiness" tick. Nothing hard-blocks (decision 3). If this board exposes
  a case where the advisory *should* have stopped you, that's a friction-log entry toward the
  eventual hard-gate flip (the parent plan's one open question).

### 5. Author the guide
- **Do:** Generate the build guide (materialize), then fill the per-stage cards. Reuse L1.01's
  mode-band structure (ORIENT/DO/CHECK) and the KiCad pickers/export. Every stage needs a quiz;
  no `TODO` stubs; a final exam ≥ 10 Q for the publishable bar.
- **Where:** the guide hub (`/projects/l1-03-ws2812-node/<rev>/guide`) shows the admin
  **ReadinessPanel** (publishable/vetted) + the **capture queue** (empty media slots).

### 6. Team-build → golden set → vetted (WS5)
- **Do:** Order the PCB (PCBWay affiliate / the reference flow), create a **Build**, register
  **Boards**, assemble, and bring them up. Take **bring-up Measurements**. Mark bring-up complete
  → boards reach **`BROUGHT_UP`** (the vetted signal).
- **Do:** **Capture media** with the in-app gold-`+` (screenshots/clips → R2) to fill the empty
  slots the capture queue flags.
- **Do (golden set):** on `/learn/l1-03-ws2812-node/complete` (admin), the **GoldenReferencePanel**
  shows the 3-item kit worklist. Attach: the **reference gerbers** (`.zip`), the **bring-up
  measurements CSV**, and ensure the **KiCad starter** (`BOM_EXPORT`) is generated onto the
  published revision. Learners then see the **Proven board kit** downloads.
- **Result:** once published **and** vetted (real media everywhere + ≥1 `BROUGHT_UP` board), the
  board reads **golden** — the operator dashboard (`/`) shows the **★ Golden** pill. Publishing at
  the **publishable** bar (free/SEO) is allowed earlier; **vetted** is the premium bar.

## What's automated vs. manual (set expectations)
- **Automated / checkable:** BOM lifecycle + availability flags (parts MCP / `Part.lifecycle`),
  cost roll-up vs `targetCost`, the readiness assessors (board + lesson + golden), the publish-gate
  (publishable floor), the `★ Golden` derivation.
- **Manual attestation (a *process* gate, honestly framed):** the `DESIGN_VALIDATION` ticks
  (calc trail, datasheet-verified, footprint↔pinout, fab-DRU, risks de-risked) and the soft-confirm
  acks. The system records that you attested; it does not prove the engineering.

## Watch-list (known gotchas to confirm on a fresh board)
1. **Parts-library-first** — create new parts before the BOM CSV import (strict match).
2. **`refDes` count must equal `quantity`** or the import tx aborts (parser reports it per-row).
3. **`.env.local` `DATABASE_URL` is PROD** — any seed/script writes hit prod. Never run two vitest
   processes at once (corrupts the `esp32-sensor-breakout` fixture; `pnpm db:seed` restores).
4. **Restart `next dev` after `prisma generate`** if you touch schema; `pnpm` runs via PowerShell,
   not the Bash tool.
5. **Guide content render-verify** — a card silently renders blank on any block-schema parse
   failure; verify edits by loading the *page*, not just the DB write.

## First-session task list (concrete)
1. `cp docs/boards/_template/design.md docs/boards/l1-03-ws2812-node/design.md`; draft §1–§3
   (orient, topology, IC selection — note the reused WROOM core).
2. Decide the new parts (WS2812 LED, level shifter, LED connector) and **create them in the parts
   library**.
3. Draft the **risk register (§6)** (data-level margin, strip inrush) + a de-risk note each.
4. Create the revision; **Generate DESIGN_VALIDATION**; start ticking core items as you complete
   §4 (calc trail) and §5 (IC datasheets).
5. Build a tiny **BOM CSV** and import it; set prices; add one second-source; read the advisory.
6. Open the **friction log** at the bottom of the board's `design.md` — capture every rough edge.

## Why this is the right next move
The run's whole philosophy is "de-risk before you invest." We just built a lot of machinery whose
only real-world exercise is one retrofitted board. Running an *easy, real* board through it
front-to-back is the cheapest way to discover what's missing or annoying — and it produces a second
published board as a side effect. The friction log it generates is what should drive the next round
of pipeline work (including the deferred advisory→hard-gate decision).
