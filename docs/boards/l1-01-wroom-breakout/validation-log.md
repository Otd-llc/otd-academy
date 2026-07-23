# L1.01 WROOM-breakout — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass.

| | |
| --- | --- |
| **Slug** | `l1-01-wroom-breakout` |
| **Status** | `part-ready (shipped board)` — original ≥10-pass design validation predates this log file; **2→4 layer stackup change 2026-07-14** (layout-domain, scoped — R5 de-risk); **C7 net+value ECN 2026-07-18** (C7 decoupling→EN RC net move + value 0.1→1 µF; schematic net change + BOM refDes regroup, no new part); **WROOM EPAD representation ECN 2026-07-19** (U1 exposed-pad: symbol 9-way split `41_1..41_9`→single pin `41` + footprint SnapEDA→stock `RF_Module`; CAD-representation only, no net/BOM change; starter re-exported); **board outline 28→30 mm + J2/J3 placement 2026-07-23** (R7 close — layout geometry; no schematic/net/part/BOM change; owner-verified in KiCad) |
| **Passes run** | — (pre-protocol) + 1 scoped design-change audit (2026-07-14) + 1 net-change ECN (2026-07-18) + 1 CAD-representation ECN (2026-07-19) + 1 scoped layout-geometry change (2026-07-23, R7 close) |
| **Last dry pass** | 2026-07-23 (R7 header geometry — 30×62 outline + J2/J3 25.4 mm on-center; scoped `[L]`/`[DFM]`/RF/reqs/learnability/consistency clean; placement owner-verified in KiCad) |

> **Note on provenance.** L1.01 was designed, validated, built, and shipped before the
> formal `_protocol.md` / `validation-log.md` machinery existed, so it has no pass-by-pass
> design-stage trail here. This log is opened to record **post-ship sourcing ECNs** against
> the frozen BOM — each one a **scoped** audit, not a fresh full re-validation. The board's
> electrical design is unchanged by these entries. As of **2026-07-14** it also
> records a **scoped layout-domain design change** (the 2→4 layer stackup): that
> changes the board's *physical stackup* but not its schematic, nets, parts, or
> BOM, so per `_protocol.md` it re-runs only the **disturbed lenses** to dry — not
> a fresh whole-board re-validation.

---

## ECN 2026-06-24 — C1 sourcing substitution (Murata → KEMET)

**Trigger.** The nightly DigiKey watchdog flagged **C1** (the 10 µF bulk cap on the 3V3
rail) as unorderable: its part, **Murata `GRM21BR61E106KA73L`** (10 µF / 25 V / X5R / 0805 /
±10%), went on backorder (restock 15-Jul-2026). C1 had previously been swapped Samsung
`CL21A106KOQNNNE` (16 V) → Murata (25 V); the Murata is now itself OOS.

**Replacement chosen.** **KEMET `C0805C106K3PACTU`** — 10 µF / 25 V / X5R / 0805 / ±10%,
**Active**, 272k+ in stock at DigiKey, ~$0.058 @ 1k.

**Scope of this audit (NO silent scope cut).** This is a parametrically-identical, like-for-like
MLCC substitution (same capacitance, voltage, dielectric, tolerance, case, footprint). It can
only disturb three audit lenses; those are re-run below. The other core/conditional lenses
(requirements, net integrity, math, physics, power integrity, FMEA, DFM, layout-readiness,
learnability, RF/antenna keep-out, …) are **untouched** by a same-spec passive and are **not**
re-run — the board's electrical design is unchanged.

### Re-run lenses

| # | Lens | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `[D]` Sourcing / lifecycle | — | Murata GRM21BR61E106KA73L OOS/backorder (restock 15-Jul-2026). | ✅ DigiKey live + watchdog. | Swap to KEMET C0805C106K3PACTU: **Active**, 272,117 in stock, ~$0.058 @1k. Second sources confirmed: Murata (on restock), TDK C2012X5R1E…106K (NRND), Samsung CL21A106K… — 10 µF 25 V X5R 0805 is broadly multi-sourced. | KEMET line now orderable + Active; standing list clears once the watchdog re-resolves the new part (dkCheckedAt nulls-first). |
| 2 | `[P]` Part-truth (datasheet) | — | Confirm KEMET part really is 10 µF / 25 V / X5R / 0805 / ±10% (part-number dielectric-code raised a momentary X7R-vs-X5R question). | ✅ KEMET datasheet (C-series, F-3102) + TME/Mouser/Arrow/DigiKey parametrics all state **X5R, 25 V, 10 µF, ±10%, 0805**. The decode worry was unfounded. | Accept KEMET C0805C106K3PACTU on datasheet authority. Recorded max height **1.45 mm** (1.25 mm nom ±0.20). | Spec matches C1's design requirement exactly; 25 V on the 3.3 V rail = large DC-bias derating margin (retains ~full 10 µF). |
| 3 | `[S]` Footprint ↔ symbol | LOW | KEMET case is **0805 (2012 metric)** — identical land to the Murata; PCB land pattern unchanged. Height grows ~0.85 mm → **1.45 mm** max. | ✅ DigiKey + datasheet dims (2.0×1.25 mm; 1.45 mm max H). | No PCB change. C1 sits in open board area on the 3V3 bulk position — no component/enclosure overhead, so the taller body is acceptable. Symbol `Device:C`, footprint `Capacitor_SMD:C_0805_2012Metric`. | Drop-in: same footprint, same schematic symbol; only the 3D-model Z differs. |

**Residual after this ECN:** none — drop-in equivalent, scoped lenses clean. Follow-up (non-blocking):
the new KEMET part's DigiKey snapshot is null until the watchdog/Re-check resolves it (nulls-first),
so the live BOM shows "not yet checked" briefly, never stale data (enforced by the
`part_identity_clears_digikey` trigger).

---

## Design change 2026-07-14 — 2-layer → 4-layer stackup (R5 de-risk)

**Trigger.** During KiCad layout the owner routed the native-USB `D+/D-` pair and
found it cannot be routed clean on 2 layers. The pair is a **forced long diagonal**:
USB-C sits at one board edge (cable-exit / breadboard-straddle form factor) and the
module's native-USB pins `GPIO19 (D-) / GPIO20 (D+)` are fixed pads at the opposite
corner, with the module pinned to its edge by the antenna keep-out (M1). Those three
placements (antenna edge, USB-C edge, GPIO19/20 pads) are rigidly coupled — rotating
the module moves the antenna and the pair together, adding no floorplan freedom — so
the pair length is pinned long, and every GPIO via/trace fanning out to the headers
punches the pair's ground reference on a 2-layer board.

**Nature & scope (NO silent scope cut).** This is a **design change**, not a
like-for-like sourcing ECN — so per `_protocol.md` it re-enters the protocol **for the
affected sub-circuit** (USB-pair routing + ground strategy), *not* a fresh whole-board
10-pass. It is confined to the **layout / ground-strategy** domain: **no schematic
change, no net change, no part change, no BOM change, no footprint change.** The
disturbed lenses are re-run below to a dry pass; the untouched lenses are named and
left untouched. This is a Layout-stage `[L]` capture that closes **R5** and extends
**R4**; `[L]` verification (the routed board) is owed at the layout gate.

### Re-run lenses (disturbed by the stackup change)

| # | Lens | Severity | Finding (worst-case) | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `[D]` Physics / SI | LOW | Worst-case FS edge 4 ns (USB 2.0 §7.1.2) → knee ≈ 0.35 / 4 ns ≈ **88 MHz**. Worst-case pair ≈ 90 mm; FR4 µstrip ≈ 6.7 ps/mm → **0.60 ns** one-way < t_r/6 ≈ 0.67 ns → still **lumped** even worst-case, so reflections don't form a settling edge inside an 83 ns bit. 2-layer Zdiff (1.6 mm ref) ≈ 130–150 Ω uncontrolled, Γ ≈ 0.25 — tolerable at this electrical length. **So 2-layer FS *functions*.** The blocker is a continuous *routable* reference under a full-board diagonal, which 2-layer can't give while the GPIO fan out. | ✅ USB 2.0 §7.1.2 edge rates; first-principles prop-delay + knee. | **4-layer:** pair on `F.Cu` over the continuous `In1.Cu` plane → unbroken reference the whole run, independent of GPIO routing. 90 Ω becomes achievable (thin `F→In1` prepreg) but is **not required** at FS. Layer count set by routability, not SI. | Reference is solid-plane by construction; verified at `[L]` on the routed board. |
| 2 | `[L]` Layout-readiness | MED | Ground strategy moves from a single bottom pour to two dedicated inner ground planes (In1 + In2). **Keep-out (R4) must now also exclude `In1.Cu`/`In2.Cu`** — a solid inner plane under the antenna detunes it (uncorrectable after fab). Fab-DRU moves to a 4-layer PCBWay stackup. | ✅ Espressif WROOM keep-out rules; PCBWay 4-layer stackup. | Stackup `F.Cu(sig) / In1.Cu(GND) / In2.Cu(GND) / B.Cu(sig)`, 1.6 mm (signals outside, planes inside — both signal layers reference an adjacent plane). Keep-out rule area ticks **all four** copper layers. `.kicad_dru` = PCBWay 4-layer; hand-margin rules (0.15/0.15 mm) retained. Captured in design.md §1 M5 + §2. | Owed at `[L]`: routed board, keep-out on all copper layers, DRC = 0 on the 4-layer DRU. |
| 3 | `[D]` Power integrity | — (positive) | Inner `In1.Cu` plane shortens the return loop for the ~500 mA WiFi-TX transient + the decoupling loops vs a 2-layer bottom pour. | ✅ first-principles (loop area ↓ → L ↓). | Accept — mild PI gain, no regression; decoupling return vias drop into `In1.Cu`. | Strictly better return path; no new risk. |
| 4 | `[D]` FMEA | HIGH (mitigated) | New/extended failure mode: inner-plane copper left under the antenna (keep-out not applied to `In1.Cu`) → antenna detune → range loss, uncorrectable after fab. | ✅ same mechanism as R4. | Mitigation: keep-out rule area covers all 4 copper layers; LAYOUT lesson + eyeball gate updated to check inner layers. **Extends R4.** | Verified at `[L]` (keep-out layer set + eyeball gate). |
| 5 | `[D]` Learnability | — | Lesson now teaches a 4-layer stackup + the honest WHY (FS-works-anyway, long-diagonal-not-routable, why-4). | ✅ against the L1 true-beginner bar. | Keep plain: plane-as-return concept, no field-solver math; the WHY is real design-tradeoff E-E-A-T. Matched to audience. | Content workstream (separate); readiness re-checked after. |
| 6 | `[D]` Requirements & traceability | LOW | A stackup requirement was implicit/absent. | ✅ | Add **M5 (4-layer stackup, dual inner GND plane)** to design.md §1 + REQUIREMENTS.md; traces M5 → R5 de-risk → layout-readiness `[L]` → LAYOUT lesson. | New requirement traced end-to-end. |
| 7 | `[D]` Internal consistency | LOW | design.md previously stated **no** layer count (latent gap); the lesson taught 2-layer. | ✅ | design.md §1/§2/§5/§6/§7/§8 now state 4-layer consistently; lesson content re-aligned in the content workstream. refDes/values/qty unchanged. | Doc + lesson agree (content shipped 2026-07-15). |

**Untouched lenses (not re-run — the change can't disturb them):** net integrity (same
nets/pins), math (no derived component-value changes — stackup/impedance is a
layout-readiness quantity, not a BOM number), part-truth (same parts/datasheets),
footprint↔symbol↔pinout (same footprints/lands), sourcing/lifecycle (same 17-line BOM;
4-layer is a fab spec, not a part), DFM/solderability (identical packages — layer count
is invisible to hand-soldering), pipeline conformance (no flag change; `hasMainsNet` /
`hasLiIon` / `hasThermalConcern` stay false, `requiresStripboard` stays false).

**Risk moves.** **R5 → DE-RISKED** (4-layer inner plane). **R4 extended** — keep-out now
spans all four copper layers (status stays open → closes at layout review).

**Residual / owed at `[L]` (layout gate, before gerbers / fab order):**
- Routed 4-layer board with a **continuous `In1.Cu` reference under the full pair** and
  the **keep-out excluding all copper layers**; **DRC = 0** against the PCBWay 4-layer
  `.kicad_dru`.
- **Shipped 2026-07-14/15** (none gated part/BOM state — that is unchanged): lesson content
  (LAYOUT / ORDERING / DRC_GERBER + the WHY deep-dive + all captureHints + the routing-traps
  table + the intro-video title), the `FourLayerCrossSection` + `GerberLayerStack` diagrams,
  and the per-board `copperLayers:4` KiCad-starter regen (live artifact replaced). Verified
  live: page renders, full-field stale-2-layer scan across all 8 cards clean.
- **Still owed, gated on the finished 4-layer layout:** the 4-layer reference-gerber
  re-export, the capture reshoots (Board Setup showing 4 layers, plot/viewer 4-copper,
  ordering Layers = 4, the LAYOUT board renders), and closing R5/R4 at the `[L]` gate
  (routed board with continuous In1 under the pair, keep-out on all copper, DRC = 0).

**Dry pass:** the disturbed `[D]` lenses above yield zero new material findings; `[L]`
verification is explicitly owed at the layout gate.

---

## ECN 2026-07-18 — C7 net correction (decoupling → EN RC cap)

**Trigger.** A first-principles review (Espressif's ESP32-S3 hardware-design schematic
checklist as the primary source) found **C7 (0.1 µF)** wired as a **third 3V3 decoupling
cap** — in the guide's SCHEMATIC card and in the owner's in-progress KiCad reference
schematic — instead of the **EN RC cap** it is specified as. The design docs were already
correct: **design.md §2/§3/§4 and the LAYOUT card** both define C7 as the CHIP_PU (EN) RC
cap forming the 10 kΩ (R1) + 0.1 µF RC. The **SCHEMATIC teaching card, the see-it-wired
`-mcu` SVG, and the in-build wiring** were the outliers.

**First-principles verdict.** The WROOM-1 has internal decoupling; its external 3V3 need is
bulk (**C1**, 10 µF) + ~one 0.1 µF at its single 3V3 pin — already covered by **C2 + C3**. A
third 0.1 µF in parallel is redundant. Meanwhile Espressif's checklist **requires an RC delay
at CHIP_PU (R = 10 k, C = 0.1 µF)** so EN asserts *after* the 3V3 rail, and the same cap
**debounces the EN reset button (SW1)**. Only one 0.1 µF is unallocated to a required role
(C7), and the one unfilled required role is the EN RC. Therefore **C7 = the EN RC cap**;
wiring it to +3V3 leaves the recommended EN RC unpopulated and SW1 undebounced.

**Nature & scope (NO silent scope cut).** A **schematic net change plus a value/BOM change** —
C7 pin 1 moves from the **+3V3** net to the **U1 EN (CHIP_PU)** net (pin 2 stays GND), and the
owner chose to **upgrade C7 0.1 µF → 1 µF** for a more-robust RC (10 kΩ × 1 µF ≈ 10 ms). **No
new part:** C7 regroups from the 0.1 µF line (Samsung `CL21B104KBCNNNC`, now C2,C3) onto the
already-in-BOM 1 µF line (Würth `885012207103`, now C5,C6,C7); same 0805 land, X7R, 50 V. The
BOM stays **17 lines** (a refDes regroup between two existing lines). Re-enters the protocol
for the affected sub-circuits (module decoupling + boot/reset), not a fresh whole-board pass.

### Re-run lenses (disturbed by the C7 net move)

| # | Lens | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `[D]` Requirements / vendor guidance | MED | C7 belongs on CHIP_PU as the EN RC (Espressif ESP32-S3 checklist: 10 k + 0.1 µF at CHIP_PU → EN asserts after the rail + debounces the reset button). A 3rd 3V3 decoupling cap is redundant (C2/C3 + module-internal cover it). | ✅ Espressif ESP32-S3 hardware-design schematic checklist. | Move C7: +3V3 → U1 EN. R1 (10 k) + C7 (0.1 µF) now form the EN RC. | Matches vendor guidance + design.md §3 calc trail. |
| 2 | `[D]` Net integrity | LOW | Only C7's pin-1 net changes (+3V3 → EN); pin 2 stays GND. Decoupling drops to C1 (bulk) + C2/C3 (0.1 µF ×2). | ✅ owner rewired in KiCad (C7 pin 1 → EN); guide steps/tables updated to match. | +3V3 loses one tap (C7); EN gains the RC cap. No other net disturbed. | C7 now on EN; +3V3 = C1/C2/C3/R1/R5/TP1/U1/U2-VOUT/J2/J3. |
| 3 | `[D]` Math (derived value) | — | EN RC delay = R1 × C7 = 10 kΩ × **1 µF** = **~10 ms** (Espressif's more-robust value; 0.1 µF → 1 ms is the leaner option). Also debounces SW1. | ✅ first-principles RC. | **Owner chose 1 µF** for extra reset margin over a slow LDO soft-start. | Rise-delay comfortably > typical LDO soft-start; one clean reset per SW1 press. |
| 4 | `[P]` Part-truth / BOM | LOW | C7 value 0.1 µF → 1 µF. No new part: reuses the in-BOM Würth `885012207103` (1 µF X7R 50 V 0805) already on C5/C6. | ✅ both parts already curated + in the frozen BOM. | refDes regroup: `C2,C3,C7`(0.1 µF)→`C2,C3` qty 2; `C5,C6`(1 µF)→`C5,C6,C7` qty 3. Same 0805 land/symbol. | BOM stays **17 lines**; DB CHECK (refDes count = qty) satisfied. |
| 5 | `[D]` Internal consistency | MED | design.md §2/§3/§4 + LAYOUT card = C7 EN cap (correct). SCHEMATIC card + `-mcu` SVG + in-build wiring = C7 decoupling (wrong). | ✅ | Guide SCHEMATIC card corrected — C7 moved decoupling → boot/reset across the Draw-it steps, part tables, intro prose, deepDive count, quiz q2, arrange step, and both see-it-wired alt/captureHints. design.md unchanged (already correct). | Full C7 scan of the SCHEMATIC card clean except the `wroom-power-flow.svg` overview (deferred). |
| 6 | `[D]` Learnability | — | Boot/reset island now teaches the EN RC (POR rise-delay + SW1 debounce, Espressif-cited); decoupling island now correctly two 0.1 µF bypass caps. | ✅ against the L1 true-beginner bar. | Plain-language RC + debounce, no surface math; the "why" is honest vendor-guidance E-E-A-T. | Content edits live on local (not prod-pushed). |

**Untouched lenses:** sourcing/lifecycle (same 17-line BOM), footprint↔symbol↔pinout (same
C7 land/symbol), DFM/solderability (same package), physics/power-integrity (3V3 still
well-decoupled: C1 bulk + C2/C3 + module-internal; the WiFi-TX transient is handled by C1 per
the prior PI lens), RF/antenna keep-out, pipeline flags.

**Risk.** A latent **design-vs-build/guide inconsistency** (docs said EN cap; guide + build
said decoupling). Now resolved: board rewired (C7 → EN), guide aligned, docs consistent.

**Residual / owed:**
- **Recapture** the decoupling + boot/reset "see it wired" shots — emptied here because the
  prior captures show the pre-move (stale) wiring.
- **Redraw + re-export** the `wroom-power-flow.svg` overview diagram — its block still labels
  C7 under "decoupling" (designed SVG, not auto-fixed).
- **EN cap value — RESOLVED 1 µF** (10 kΩ × 1 µF ≈ 10 ms). BOM regrouped (C7 → Würth
  `885012207103` line, no new part); guide C7 value + RC-delay prose/table updated to 1 µF / ~10 ms.
- Guide content edits **and the BOM regroup** are on **LOCAL only** (owner's DO-NOT-PROD-PUSH
  hold) pending sign-off.

**Dry pass:** the disturbed `[D]` lenses above yield zero new material findings; the board is
rewired and the guide + docs are consistent.

---

## ECN 2026-07-19 — U1 (ESP32-S3-WROOM-1-N16R2) exposed-pad representation

**Trigger.** KiCad **"Update PCB from Schematic"** warned *"No net found for component U1
pad 41_10 … 41_21 (no pin 41_NN in symbol)"* — 12 warnings. Traced to a **non-idiomatic
EPAD model** in the WROOM part: the module's exposed thermal pad (Espressif **pin 41**,
GND, ONE net) was modelled as a **9-way split** — symbol pins `41_1..41_9` paired with an
**UNVERIFIED** SnapEDA footprint (`XCVR_ESP32-S3-WROOM-1-N16R2`, thermal vias all named
`41_1`). The academy starter export was internally self-consistent (`41_1..41_9` on both
symbol and footprint), so it did not itself emit the warnings — but the split is
**incompatible with any single-`41` WROOM footprint** (KiCad's stock uses one pad `41`),
so the warnings appear the moment a stock-style footprint is on U1.

**Fix chosen (done right).** Model the EPAD the idiomatic KiCad way — one pin, one pad:
- **Symbol** (kept — our teaching symbol; pins 1–40 untouched): collapse EPAD pins
  `41_1..41_9` → a single pin **`41`** (GND). 49 → 41 pins.
- **Footprint**: drop the UNVERIFIED SnapEDA PartAsset and **reference the KiCad-stock
  `RF_Module:ESP32-S3-WROOM-1`** (pads 1–40 + `41`×13 + 9 netless paste/mechanical pads).

**Nature & scope (NO silent scope cut).** A **CAD-representation fix**, not an electrical
change: the EPAD was always GND (one net); the schematic/nets/BOM/parts are unchanged; the
starter is unwired. Re-enters the protocol only for the **disturbed lenses** below —
`[S]` footprint↔symbol↔pinout, `[P]` part-truth, `[DFM]` land pattern.

### Re-run lenses

| # | Lens | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `[P]` Part-truth (datasheet) | — | Is the EPAD really pin 41 = GND, module = 41 pins (40 perimeter + EPAD)? | ✅ **Espressif ESP32-S3-WROOM-1/-1U datasheet** (v1.8): 41 pins; pin 41 = EPAD, "Soldering the EPAD to the ground of the base board … optimizes thermal performance." Matches KiCad's stock symbol (pin 41 = GND). | Model EPAD as a single pin `41` (GND). | Datasheet-authoritative; corroborated by KiCad's maintained stock symbol. |
| 2 | `[S]` Footprint↔symbol↔pinout | (the defect) | 9-way EPAD split mismatches a single-`41` footprint → 12 "no net" warnings. Are the perimeter pins 1–40 standard-numbered (so the stock footprint's pads 1–40 still map)? | ✅ Symbol spot-check vs Table 3-1: pin 1=GND, 2=3V3, 3=EN, 28=IO35, 34=IO41, 40=GND — all standard. Stock fp pads = 1–40 + `41`×13 + 9 netless. | Symbol → single pin `41`; footprint → stock ref. **Re-export verified** (`scripts/_verify-wroom-fix.ts`): symbol pin `41` present, **no `41_*` split**, U1.Footprint = `RF_Module:ESP32-S3-WROOM-1`, WROOM fp/3D no longer bundled. | Symbol pins {1..41} ↔ stock pads {1..41}: every numbered pad has a pin and every pin a pad → **zero "no net" warnings**. |
| 3 | `[DFM]` Land pattern | LOW | Starter footprint changes **SnapEDA (UNVERIFIED) → KiCad-stock**. | ✅ Both follow the Espressif WROOM-1 land pattern; KiCad's is the maintained/vetted one. | Adopt the stock footprint for the **starter**. Drops an UNVERIFIED asset. | Stock `RF_Module` footprint is the canonical WROOM-1 land; strict trust improvement. |

**Untouched lenses (not re-run — a CAD-representation fix can't disturb them):**
requirements & traceability, net integrity (same nets/pins; EPAD still GND), math,
physics, power integrity, FMEA, DFM-solderability (same module package), sourcing/lifecycle
(same 17-line BOM; no part change), layout-readiness, RF/antenna keep-out, learnability,
pipeline flags (`hasMainsNet`/`hasLiIon`/`hasThermalConcern` false, `requiresStripboard` false).

**Residual / owed:**
- The fabricated **reference board** and its **reference gerbers** (separate `GERBER_ZIP`
  artifact) are **NOT** touched by this ECN — only the learner **starter** footprint changes.
  Both footprints follow the datasheet land pattern (interchangeable for the module).
- **Bundled 3D drops** for U1 (the referenced stock footprint pulls KiCad's own WROOM 3D).
- **Not yet driven through an actual KiCad "Update PCB from Schematic"** on this machine
  (no KiCad here) — consistency proven **structurally** (pin↔pad number coverage). An owner
  eyeball in KiCad closes it.

**Applied (PROD).** Symbol re-uploaded (single pin `41`), FOOTPRINT PartAsset deleted,
`Part.kicadFootprint = RF_Module:ESP32-S3-WROOM-1`; l1-01 starter re-exported
(`exports/…/kicad-q4m11894….zip`). Idempotent scripts (gitignored, local):
`scripts/_fix-wroom-epad.ts` (s-expr parser, self-verifying), `_reexport-kicad-starter.ts`,
`_verify-wroom-fix.ts`.

**Dry pass:** the disturbed `[S]`/`[P]`/`[DFM]` lenses yield zero new material findings;
symbol↔footprint are consistent (pin `41` ↔ stock pad `41`) and the starter is re-exported
+ verified.

---

## Design change 2026-07-23 — board outline 28→30 mm + J2/J3 header placement (R7 close)

**Trigger.** Closing **R7** (outline / header row spacing, open since design — "close at
layout"). Test-fitting the two 1×22 breakout headers in KiCad against the module showed the
**S3-WROOM-1 (18 mm body) sits *between* J2 and J3**, so the row spacing has a hard floor of
**23.114 mm** (module body + ~0.1″ hand-clearance per side). The smallest breadboard-grid
spacing above that floor is **25.4 mm (1.0″)**, which the old **28 mm** outline can't hold with
PCBWay's 0.5 mm copper-to-edge → outline grows to **30 mm**. At 25.4 mm the board is wider than
a single breadboard straddles, so it seats across **two** breadboards (one row per board).

**Nature & scope (NO silent scope cut).** A **layout / mechanical design change** — board
**outline** (28→30 mm wide) + **header placement geometry**. **No schematic, net, part,
footprint, or BOM change** (same 1×22 Sullins `PRPC040SAAN-RC` headers, same nets, same 17-line
BOM). Per `_protocol.md` it re-enters only for the **disturbed lenses** below; the electrical
lenses are named and left untouched. It **closes R7** and **extends R4** (the header top pins
add a lateral antenna keep-out check, verified at the `[L]` gate).

**Derived geometry** (datasheet-grounded — ESP32-S3-WROOM-1/-1U **Datasheet v1.8**, Fig 10-1
module = **18 × 25.5 × 3.1 mm**, Fig 11-1 **antenna area = top 6 mm**; the antenna overhangs the
top board edge, so its radiating keep-out is air):

- **Board:** 30 (W) × 62 (H) mm.
- **J2:** X **2.3**, Y **4.33**, **0°** (pin 1 top). **J3:** X **27.7**, Y **57.67** (= 62 − 4.33),
  **180°** (rotated so the pin order matches the ratsnest).
- C-C **25.4 mm** (1.0″); header pads **~1.45 mm** off each side edge (> PCBWay 0.5 mm); the
  module (X 6–24) clears each header by **3.7 mm** (> the 23.114 mm floor); the 53.34 mm header
  (pin1→pin22) centered vertically → **4.33 mm** top/bottom margins; top pins beside the module
  (outside the 18 mm antenna width), bottom pins beside the centered USB-C.

### Re-run lenses (disturbed by the outline + placement change)

| # | Lens | Severity | Finding (worst-case) | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `[L]` Layout-readiness | MED | 25.4 mm C-C needs the 18 mm module to fit *between* the rows AND header pads to clear the fab's 0.5 mm copper-to-edge; the old 28 mm outline left only ~0.03 mm edge margin at 25.4 mm. | ✅ datasheet module width + PCBWay 0.5 mm edge rule; **owner placed J2/J3 in KiCad — ratsnest lines up (J3 @ 180°)**. | Outline → **30 mm**; J2 (2.3, 4.33) 0°, J3 (27.7, 57.67) 180°. Pads ~1.45 mm off each edge; module clears each header 3.7 mm. | Placement fits with margin, owner-verified in KiCad; routed-board DRC = 0 owed at `[L]`. |
| 2 | `[DFM]` Fab / edge clearance | LOW | Header pad-to-board-edge must clear PCBWay's 0.5 mm min copper-to-edge. | ✅ ~0.85 mm pad radius → ~1.45 mm edge gap at X 2.3/27.7 on the 30 mm outline. | Accept the 30 mm outline (1.45 mm edge margin). | > PCBWay 0.5 mm; verified on the routed copper at `[L]`. |
| 3 | `[D]` Physics / RF (antenna keep-out) | MED | Header top pins sit at the top corners — must clear the antenna's **lateral** keep-out (the datasheet defers it to the Hardware Design Guidelines, §11.2). | ⚠ **partial** — the headers at X 2.3/27.7 are outside the 18 mm antenna width and the antenna (top 6 mm) overhangs the top edge (radiating keep-out = air); the exact lateral clearance is **owed at `[L]`**. | Keep the header top at Y 4.33 (owner-placed); confirm the lateral keep-out against the Hardware Design Guidelines on the routed board. **Extends R4.** | Owed at `[L]` with R4 (keep-out on all copper + DRC = 0). |
| 4 | `[D]` Requirements & traceability | LOW | The outline was a lesson-only number (the LAYOUT rectangle), never a design constraint; header spacing (R7) was open. | ✅ | Add **M6** (30×62 outline + J2/J3 25.4 mm on-center, two-breadboard) to design.md §1; trace M6 → R7 close → `[L]`. | New mechanical constraint traced end-to-end. |
| 5 | `[D]` Learnability | — | The lesson must teach the exact placement (25.4 mm C-C, 4.33 mm margins, **J3 @ 180°** for the ratsnest, KiCad's **in-field math** `62 - 4.33`) + why two breadboards. | ✅ against the L1 beginner bar. | Author into the LAYOUT card (Properties X/Y or Move Exactly, the 180° rotation, in-field math) + a two-breadboard demo. Content workstream (prod DB), separate. | Owed as a content edit; readiness re-checked after. |
| 6 | `[D]` Internal consistency | LOW | The LAYOUT card draws a **28 mm** rectangle; design.md stated no outline. | ✅ | design.md §1 (M6) + §6 (R7) now state 30×62 + the placement; the LAYOUT card rectangle 28→30 + placement steps land in the content workstream. | Doc updated here; lesson update owed (tracked below). |

**Untouched lenses (not re-run — an outline/placement change can't disturb them):** net
integrity (same nets/pins), math (no derived component-value change — outline/placement is a
layout quantity, not a BOM number), part-truth (same parts/datasheets), footprint↔symbol↔pinout
(same 1×22 header footprint + all others), power integrity, FMEA (no new electrical failure mode
— the antenna-detune mode is R4, already tracked), sourcing/lifecycle (30 mm is a bare-board
spec, not a part; BOM stays 17 lines), pipeline flags (`hasMainsNet`/`hasLiIon`/`hasThermalConcern`
false, `requiresStripboard` false).

**Risk moves.** **R7 geometry captured + owner-verified in KiCad** (J2/J3 placed, ratsnest
aligned with J3 @ 180°); the final **`[L]` tick** (routed 30×62 board, antenna lateral keep-out
per the Hardware Design Guidelines, DRC = 0) closes at LAYOUT_REVIEW **with R4**. **R4 extended**
— the header top pins add a lateral keep-out check to the antenna sign-off.

**Residual / owed:**
- **`[L]` gate:** routed 30×62 board — antenna lateral keep-out clearance verified, header edge
  clearances on the real copper, DRC = 0 on the PCBWay 4-layer DRU.
- **Content workstream (prod DB, separate):** LAYOUT card outline 28→30 mm, the exact placement
  steps (25.4 mm C-C, J2/J3 X/Y, **J3 @ 180°**, in-field math `62 - 4.33`), and the two-breadboard
  demo — coordinated with the net-class starter-export fix (PR #355).

**Dry pass:** the disturbed lenses yield zero new material findings; the placement is
owner-verified in KiCad (ratsnest aligned). The antenna lateral keep-out + DRC = 0 are the only
items owed, explicitly at the `[L]` gate (with R4).
