# Recursive Board-Design Validation Protocol

> **Canonical source of truth.** Every board's `design.md` must pass this protocol
> before *any* part, BOM line, or revision is created for it. This file is
> board-agnostic — it applies to every board in `docs/boards/*`. The per-board
> evidence lives in that board's `validation-log.md`.

## Why this exists

The board lifecycle's `DESIGN_VALIDATION` checklist items are **honest human
attestations**, not machine proofs. "Calc trail recorded", "each IC
datasheet-verified", "all top risks de-risked" — a person ticks these because they
*did the work*. This protocol is that work: it makes the design **proven**, not
merely plausible, so the attestations mean something and the first physical part
isn't bought against a hand-wave.

**The gate:** a board is **not part-ready** — no parts created in the library, no
BOM CSV import, no revision advanced — until its design has passed this protocol
(see *Definition of done*).

## The engine (the loop is fixed; the audits are the interchangeable parts)

**Prove → find → improve → re-prove.**

1. Run **one audit lens** per pass, taken to the **pad / number level** (not a skim).
2. Record findings with a **severity**: `CRITICAL` / `HIGH` / `MED` / `LOW`.
3. The board owner (the engineer) makes the call on each finding; the fix is folded
   into `design.md`.
4. **Re-prove:** re-run every earlier audit the fix could have disturbed. An audit
   is "passed" only when it is clean *after the latest change*.
5. Log the pass (lens · findings · fixes · re-proof · residual) in the board's
   `validation-log.md`.

**Rules**
- **Minimum 10 passes**, and never stop before a full sweep yields **zero new
  material findings** (a "dry" pass). Whichever is later.
- **Fresh eyes:** rotate an adversarial reviewer per pass — assume the design is
  *wrong* and try to prove it. Confirmation bias is the enemy.
- **Worst case, not typical:** every number is proven at min/max/temperature, not
  the nominal value.
- **No silent scope cuts:** if a pass is skipped or bounded, say so in the log.

## Core audits — run on every board

Each maps 1:1 to a `DESIGN_VALIDATION` attestation (the audit is the evidence; the
tick is the sign-off on that evidence).

**Audit phases.** Not every audit can *close* at the `design.md` stage — some need
artifacts that don't exist yet (chosen KiCad symbols/footprints; a routed board).
Each audit is tagged with the phase it **closes** at:

- **`[D]` design** — closes against `design.md` (gates **part creation** + BOM import).
- **`[S]` schematic** — *captured* at design, **verified** at schematic capture
  (needs the chosen symbols/footprints). Gates **layout**.
- **`[L]` layout** — *captured* at design, **verified** at layout. Gates **gerbers /
  fab order**.

A board reaches **design-stage dry** (part-ready) when every **`[D]`** audit is clean
and a `[D]` pass yields zero new material findings; the `[S]`/`[L]` audits are then
explicitly *owed* at their phase before their own irreversible step. (Friction F7 of
the l1-03 run surfaced this — footprint↔pinout and fab-DRU can't honestly close
pre-schematic.)

1. **`[D]` Requirements & traceability** — every functional/electrical/interface
   requirement is testable and traces forward: requirement → topology net → calc →
   BOM line → risk → validation item. No orphan requirement; no unrequired part.
2. **`[D]` Topology / net integrity** — *every pin of every part* accounted for
   (driven / pulled / NC / unused-parked); no floating nodes; current return paths;
   power-up & power-down sequencing across all rails. *(Logical net at `[D]`; the
   exact pin map re-verifies at `[S]`.)*
3. **`[D]` Math audit** — re-derive *every* number from first principles + datasheet
   at **worst case (min/max/temperature)**; quantify each margin; check units.
4. **`[D]` Physics / first-principles** — what the equations assume away: signal
   integrity, timing, thermal dissipation, inrush/transients, EMI, real-world
   behavior. Sanity beyond the math.
5. **`[D]` Part-truth (datasheet)** — per active part: abs-max vs operating,
   recommended application circuit, pinout, logic-level compatibility, EN/strap/decoupling.
6. **`[S]` Footprint ↔ symbol ↔ pinout** — pad-by-pad: schematic-symbol pin =
   datasheet pin = footprint pad, for every part. *Captured at `[D]` (intended pinout),
   verified at `[S]` once symbols/footprints are chosen — cannot close pre-schematic.*
7. **`[D]` Power integrity** — budgets worst-case, decoupling/bulk adequacy, brownout,
   regulator stability (cap value/ESR), fuse/PTC coordination.
8. **`[D]` Failure modes (FMEA)** — every plausible user error + part fault (reverse
   polarity, hot-plug, ESD, short, mis-wire, latch-up, sequencing) → a mitigation
   or an explicitly-accepted risk.
9. **`[D]` DFM / solderability** — package-by-package against the board's skill
   envelope (e.g. L1 = no leadless, passives ≥ 0805, leaded SMD + THT); courtyards;
   polarity/pin-1 marking; test access; assembly order.
10. **`[D]` Sourcing / lifecycle** — every line: real orderable MPN, in stock, not
    EOL/NRND, the **exact `(manufacturer, mpn)` string** the strict BOM import will
    match, ≥1 real second source for critical parts, cost vs target.
11. **`[L]` Layout-readiness** — keep-outs (e.g. antenna), high-speed/RF routing,
    trace ampacity (esp. any high-current rail), ground strategy, fab design rules
    (`.kicad_dru`). *Constraints captured at `[D]`, verified at `[L]`.*
12. **`[D]` Learnability / pedagogy** — every concept teachable, the "one thing it
    teaches" coherent, complexity matched to the audience tier.
13. **`[D]` Internal consistency** — refDes/values/quantities identical across every
    section + the BOM; naming collisions (e.g. a risk "R1" vs resistor refDes R1);
    no contradictions.
14. **`[D]` Pipeline conformance** — project flags ↔ materialized checklists, each
    attestation honestly checkable, freeze/gate semantics understood, friction logged.

## Conditional audits — fire on the board's nature / project flags

- **Safety / isolation** (`hasMainsNet`, HV) — creepage/clearance, isolation barrier,
  fusing, earthing.
- **Battery / Li-ion** (`hasLiIon`) — protection (OVP/OCP/short), charge & discharge
  limits, cell balancing, thermal/mechanical containment.
- **Deep thermal** (`hasThermalConcern`) — worst-case junction temps, copper
  pour/heatsink, derating.
- **RF / regulatory** — antenna keep-out, pre-certified-module integration rules,
  emissions.
- **Stripboard** (`requiresStripboard`) — perfboard/stripboard buildability.

## Definition of done — phase-gated

### Design-stage dry pass — the gate to **create parts + import the BOM**

All **`[D]`** audits clean:
- [ ] Every requirement traced (audit 1)
- [ ] Every pin accounted for; logical net + sequencing proven (audit 2 `[D]` part)
- [ ] Every number worst-case-proven (audits 3–4)
- [ ] Every active part datasheet-verified — *against the part's OWN datasheet*, incl.
      compatible clones (audit 5)
- [ ] Power integrity proven (audit 7)
- [ ] Every plausible failure mode mitigated-or-accepted (audit 8)
- [ ] Every part hand-buildable (skill envelope) **and** sourceable with exact import
      strings (audits 9–10)
- [ ] Teachable + internally consistent + pipeline-conformant (audits 12–14)
- [ ] `[S]`/`[L]` constraints (footprint intent, layout-readiness) **captured** for
      their stage (audits 6, 11)
- [ ] Every applicable conditional audit run
- [ ] Every risk de-risked, or explicitly scheduled to its later phase
- [ ] **≥ 10 passes run AND a `[D]` dry pass achieved** (zero new material findings)
- [ ] `validation-log.md` complete

**Then:** create the parts, import the BOM. The board is *part-ready* — but **not yet
fab-ready**.

### Schematic-stage — the gate to **layout**
- [ ] Audit 6 **verified**: footprint ↔ symbol ↔ pinout pad-by-pad (now that symbols/
      footprints exist)
- [ ] Audit 2 pin map re-verified against the captured schematic

### Layout-stage — the gate to **gerbers / fab order**
- [ ] Audit 11 **verified**: keep-outs, ampacity, ground strategy honored
- [ ] **Fab-DRU DRC clean** (the `.kicad_dru` rules actually applied) + any ERC
      isolation invariants checked

Each phase has its own dry pass before its irreversible step.

## How to run it

- Copy `_template/validation-log.md` into the board folder at the start.
- Pick a cadence with the owner (pass-by-pass with approval, or batch-and-checkpoint).
- Adversarial passes can be delegated to fresh reviewers/subagents; **verify every
  load-bearing finding against the actual datasheet/code before folding it in** — the
  reviewers can be wrong too.
- When the design passes, the `validation-log.md` is the paper trail behind the
  board's `DESIGN_VALIDATION` ticks.
