# L1.01 WROOM-breakout — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass.

| | |
| --- | --- |
| **Slug** | `l1-01-wroom-breakout` |
| **Status** | `part-ready (shipped board)` — original ≥10-pass design validation predates this log file |
| **Passes run** | — (pre-protocol) |
| **Last dry pass** | — |

> **Note on provenance.** L1.01 was designed, validated, built, and shipped before the
> formal `_protocol.md` / `validation-log.md` machinery existed, so it has no pass-by-pass
> design-stage trail here. This log is opened to record **post-ship sourcing ECNs** against
> the frozen BOM — each one a **scoped** audit, not a fresh full re-validation. The board's
> electrical design is unchanged by these entries.

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
