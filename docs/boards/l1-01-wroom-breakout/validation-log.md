# L1.01 WROOM-breakout — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass.

| | |
| --- | --- |
| **Slug** | `l1-01-wroom-breakout` |
| **Status** | `part-ready (shipped board)` — original ≥10-pass design validation predates this log file; **2→4 layer stackup change 2026-07-14** (layout-domain, scoped — R5 de-risk); **C7 net+value ECN 2026-07-18** (C7 decoupling→EN RC net move + value 0.1→1 µF; schematic net change + BOM refDes regroup, no new part) |
| **Passes run** | — (pre-protocol) + 1 scoped design-change audit (2026-07-14) + 1 net-change ECN (2026-07-18) |
| **Last dry pass** | 2026-07-18 (C7 net ECN, scoped `[D]` lenses clean; board rewired, guide + docs consistent) |

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
