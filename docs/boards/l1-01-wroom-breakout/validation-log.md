# L1.01 WROOM-breakout — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass.

| | |
| --- | --- |
| **Slug** | `l1-01-wroom-breakout` |
| **Status** | `part-ready (shipped board)` — original ≥10-pass design validation predates this log file; **2→4 layer stackup change 2026-07-14** (layout-domain, scoped — R5 de-risk) |
| **Passes run** | — (pre-protocol) + 1 scoped design-change audit (2026-07-14) |
| **Last dry pass** | 2026-07-14 (scoped, disturbed `[D]` lenses; `[L]` verification owed at layout) |

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
