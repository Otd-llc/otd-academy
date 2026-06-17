# <Board name> — design doc

> Template. Copy this file to `docs/boards/<project-slug>/design.md` and fill it
> in. Also copy `docs/boards/_template/validation-log.md` into the board folder.
> The design doc is the first artifact in the board lifecycle (see
> `docs/plans/2026-06-16-board-design-process.md`): draft it → validate (lock the
> math + ICs) → source/freeze the BOM → only then author the guide. Keep it in
> the repo so it's diffable and reviewable in PRs.

> ⛔ **NOT part-ready.** This board owes the **Recursive Board-Design Validation
> Protocol** (`../_protocol.md`) before *any* part is created, BOM imported, or
> revision advanced: ≥ 10 recursive audit passes, a "dry" pass, every applicable
> audit clean, `validation-log.md` complete. The `DESIGN_VALIDATION` ticks are
> honest human attestations — earn them. **Do not add parts until this passes.**

| | |
| --- | --- |
| **Slug** | `<project-slug>` |
| **Owner** | <name> |
| **Status** | `draft` → `validated` → `bom-frozen` |
| **Track / Level** | <SENSE/ACT/POWER/COMMS> / <L1/L2/L3> |
| **Teaches** | <the one discipline this board is the vehicle for> |
| **Validation** | `not started` → `pass N/≥10` → `DRY ✓ (part-ready)` — see `validation-log.md` |

---

## 1 · ORIENT — what & why

<!-- Mirror the guide's ORIENT band: the one-paragraph "what this board is and the
one thing it teaches", then the hard requirements and constraints. -->

- **What it is:** <one paragraph>
- **Functional requirements:** <bulleted, testable>
- **Constraints / DFM / safety flags:** <mains? Li-ion? thermal? stripboard? antenna keep-out?>

## 2 · Topology

<!-- Block diagram (ASCII or a linked image) + the signal/power chain. Name the
sub-circuits the schematic will be organised into. -->

## 3 · Calc trail (DO — lock the math)

<!-- Every derived value with its source, so a reviewer can follow each number.
This is a MANDATORY validation item — don't hand-wave a value. -->

| Value | Formula / source | Result | Notes |
| --- | --- | --- | --- |
| e.g. LDO Cout | datasheet §7.2 min 1 µF | 2.2 µF | margin |

## 4 · IC selection (DO — lock the parts)

<!-- One row per active part. "Datasheet-verified" means you read the relevant
sections, not just the marketing page. MANDATORY validation item. -->

| Ref | Part (MPN) | Why this part | Datasheet §s read |
| --- | --- | --- | --- |
| U1 | … | … | pinout, abs-max, power |

## 5 · Power & thermal

<!-- Rails, budgets, worst-case dissipation, any thermal relief. MANDATORY. -->

## 6 · Risk register

<!-- Top risks + ONE de-risk pass each before the board advances. Kept here in
markdown (not a DB model). The validation checklist gates on "all de-risked". -->

| # | Risk | Likelihood × Impact | De-risk plan | Status |
| --- | --- | --- | --- | --- |
| 1 | … | … | … | open / de-risked |

## 7 · DESIGN_VALIDATION checklist

Core — **mandatory on every board**:

- [ ] Calc trail complete — every derived value sourced (§3)
- [ ] Each IC datasheet-verified (§4)
- [ ] Footprint ↔ pinout cross-checked against each datasheet
- [ ] Fab-DRU DRC clean (vendor design rules loaded)
- [ ] BOM availability checked (every part sourceable — see §8)
- [ ] All top risks de-risked (§6)

Conditional — include the rows the board's flags trigger:

- [ ] **Safety review** — required if `hasMainsNet`, Li-ion, or notable thermal
- [ ] **Isolation / creepage** review — if mains or high-voltage
- [ ] **Stripboard validation** — if `requiresStripboard`

> These are *attestations* (a human checked), not machine proofs — except BOM
> availability (parts MCP) and DRU presence, which are verifiable.

## 8 · BOM sourcing & freeze

<!-- Source every part into the revision's BomLine (CSV import for bulk), confirm
stock/lifecycle/lead-time via the parts MCP, record a second source where it
matters, then FREEZE (bomFrozenAt) — the handoff that says guide authoring may
begin. Design around parts you can actually buy. -->

- **Design-to-cost target:** <Project.targetCost>
- **Second sources noted for:** <critical parts>
- **BOM frozen:** <date / "not yet">
